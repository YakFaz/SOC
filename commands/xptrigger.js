// commands/xptrigger.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { initializeRoblox } = require('../utils/noblox');
const experienceMapping = require('../config/experienceMapping');
const levelMapping = require('../config/levelMapping');
const roleMapping = require('../config/roleMapping');

const FIREBASE_BASE_URL = process.env.FIREBASE_BASE_URL;
const FIREBASE_SECRET    = process.env.FIREBASE_SECRET;
const LOG_CHANNEL_ID     = '1376890064403173548';
// Desired output order:
const DEPARTMENTS        = ['Marine', 'Army', 'Naval'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xptrigger')
    .setDescription('Manually triggers XP calculation and Roblox rank updates based on playtime.'),

  async execute(interaction) {
    await interaction.reply({ content: '🧠 Running XP & rank updates…', ephemeral: true });

    const logEntries = [];

    try {
      const nobloxInstance = await initializeRoblox(process.env.BOT_ACCOUNT_COOKIE);

      // Process each department
      for (const department of DEPARTMENTS) {
        const deptConfig = roleMapping.find(r => r.groupName === department);
        const ptRes = await fetch(`${FIREBASE_BASE_URL}/Departments/${department}.json?auth=${FIREBASE_SECRET}`);
        const playtimeData = await ptRes.json();
        if (!playtimeData) continue;

        // Process each user in this department
        for (const userId of Object.keys(playtimeData)) {
          try {
            // Calculate earned XP
            const seconds = playtimeData[userId];
            const earnedXP = Math.floor((seconds / 900) * 1);

            // Load existing XP/level
            const xpPath = `${FIREBASE_BASE_URL}/XP/${department}/${userId}.json?auth=${FIREBASE_SECRET}`;
            const xpRes = await fetch(xpPath);
            const xpData = (await xpRes.json()) || {};
            const oldXP = xpData.xp ?? 0;
            const oldLevel = xpData.level ?? 1;

            // Compute new XP/level
            let newXP = oldXP + earnedXP;
            let newLevel = oldLevel;
            while (
              newLevel < experienceMapping.length &&
              newXP >= experienceMapping[newLevel]
            ) {
              newXP -= experienceMapping[newLevel];
              newLevel++;
            }

            // Save back to Firebase
            await fetch(xpPath, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ xp: newXP, level: newLevel }),
            });

            // Determine new rank
            let newRank = '—';
            if (deptConfig) {
              const rankName = levelMapping[newLevel]?.[department];
              if (rankName) {
                const inverseRoles = Object.entries(deptConfig.roles)
                  .reduce((acc, [rid, name]) => { acc[name] = rid; return acc; }, {});
                const targetRoleId = inverseRoles[rankName];
                if (targetRoleId) {
                  try {
                    await nobloxInstance.setRank(
                      deptConfig.groupId,
                      parseInt(userId, 10),
                      parseInt(targetRoleId, 10)
                    );
                    newRank = rankName;
                  } catch (err) {
                    const m = err.message || '';
                    if (m.includes('permission to manage'))      newRank = `${rankName} (no perms)`;
                    else if (m.includes('same role'))            newRank = `${rankName} (unchanged)`;
                    else if (m.includes('invalid or does not exist')) newRank = `${rankName} (invalid)`;
                    else { console.error(`❌ Unexpected rank error for ${userId}:`, err); newRank = `${rankName} (error)`; }
                  }
                }
              }
            }

            // Fetch Roblox username for logs
            const username = await nobloxInstance.getUsernameFromId(parseInt(userId, 10));

            // Collect log entry
            logEntries.push({
              department,
              userId,
              username,
              oldLevel, newLevel,
              oldXP, newXP,
              rank: newRank
            });

          } catch (userErr) {
            console.error(`🔥 Error processing user ${userId} in ${department}:`, userErr);
          }
        }
      }

      // Send grouped logs
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        for (const dept of DEPARTMENTS) {
          const entries = logEntries.filter(e => e.department === dept);
          if (entries.length === 0) continue;

          // Batch in chunks of 10 per embed
          for (let i = 0; i < entries.length; i += 10) {
            const batch = entries.slice(i, i + 10);
            const embed = new EmbedBuilder()
              .setTitle(`📋 ${dept} Updates`)
              .setColor('Blue')
              .setTimestamp();

            for (const e of batch) {
              embed.addFields({
                name: `${e.username} (ID: ${e.userId})`,
                value:
                  `• Level: **${e.oldLevel}** → **${e.newLevel}**\n` +
                  `• XP: **${e.oldXP}** → **${e.newXP}**\n` +
                  `• Rank: **${e.rank}**`
              });
            }

            try {
              await logChannel.send({ embeds: [embed] });
            } catch (logErr) {
              console.error(`❌ Failed to send ${dept} log embed:`, logErr);
            }
          }
        }
      }

      return interaction.editReply({ content: '✅ XP & rank updates complete.' });
    } catch (err) {
      console.error('❌ xptrigger failed:', err);
      return interaction.editReply({ content: '❌ Process failed—see logs.' });
    }
  },
};