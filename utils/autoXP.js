// utils/autoXP.js

const cron = require('node-cron');
const { DateTime } = require('luxon');
const { EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { initializeRoblox } = require('../utils/noblox');
const roleMapping = require('../config/roleMapping');
const levelMapping = require('../config/levelMapping');

const FIREBASE_BASE_URL = process.env.FIREBASE_BASE_URL;
const FIREBASE_SECRET = process.env.FIREBASE_SECRET;
const LOG_CHANNEL_ID = '1376890064403173548';

const DEPARTMENTS = ['Army', 'Marine', 'Naval'];

async function autoXPTrigger(client) {
  console.log('📡 [AUTO-XP] Running scheduled XP trigger (1 hour before reset)...');

  let nobloxInstance;
  try {
    nobloxInstance = await initializeRoblox(process.env.BOT_ACCOUNT_COOKIE);
  } catch (err) {
    console.error('❌ [AUTO-XP] Failed to initialize Roblox:', err);
    return;
  }

  const logEntries = [];

  for (const department of DEPARTMENTS) {
    try {
      const playtimeRes = await fetch(`${FIREBASE_BASE_URL}/Departments/${department}.json?auth=${FIREBASE_SECRET}`);
      const playtimeData = await playtimeRes.json();
      if (!playtimeData) continue;

      const deptConfig = roleMapping.find(r => r.groupName === department);
      if (!deptConfig) {
        console.warn(`⚠️ [AUTO-XP] No role mapping for department: ${department}`);
        continue;
      }

      for (const userId in playtimeData) {
        try {
          const seconds = playtimeData[userId];
          const earnedXP = Math.floor((seconds / 900) * 1);


          // Fetch existing XP and level
          const xpPath = `${FIREBASE_BASE_URL}/XP/${department}/${userId}.json?auth=${FIREBASE_SECRET}`;
          const existingRes = await fetch(xpPath);
          const existingData = await existingRes.json();

          let currentXP = existingData?.xp ?? 0;
          let currentLevel = existingData?.level ?? 1;

          currentXP += earnedXP;

          // Calculate new level & XP
          while (currentLevel < Object.keys(levelMapping).length && currentXP >= (100 + (currentLevel - 1) * 20)) {
            currentXP -= (100 + (currentLevel - 1) * 20);
            currentLevel++;
          }

          // Save new XP and level to Firebase
          await fetch(xpPath, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp: currentXP, level: currentLevel }),
          });

          // Determine Roblox rank from levelMapping and roleMapping
          const rankName = levelMapping[currentLevel]?.[department];
          let newRank = '—';
          if (rankName) {
            // Invert roles: name => roleId
            const inverseRoles = Object.entries(deptConfig.roles).reduce((acc, [rid, name]) => {
              acc[name] = rid;
              return acc;
            }, {});
            const targetRoleId = inverseRoles[rankName];

            if (targetRoleId) {
              try {
                await nobloxInstance.setRank(deptConfig.groupId, parseInt(userId, 10), parseInt(targetRoleId, 10));
                newRank = rankName;
              } catch (err) {
                const m = err.message || '';
                if (m.includes('permission to manage')) newRank = `${rankName} (no perms)`;
                else if (m.includes('same role')) newRank = `${rankName} (unchanged)`;
                else if (m.includes('invalid or does not exist')) newRank = `${rankName} (invalid)`;
                else {
                  console.error(`❌ [AUTO-XP] Unexpected rank error for user ${userId}:`, err);
                  newRank = `${rankName} (error)`;
                }
              }
            }
          }

          // Fetch Roblox username for logs
          let username = 'Unknown';
          try {
            username = await nobloxInstance.getUsernameFromId(parseInt(userId, 10));
          } catch {
            username = 'Unknown';
          }

          // Collect log entry
          logEntries.push({
            department,
            userId,
            username,
            oldLevel: existingData?.level ?? 1,
            newLevel: currentLevel,
            oldXP: existingData?.xp ?? 0,
            newXP: currentXP,
            rank: newRank
          });

        } catch (userErr) {
          console.error(`🔥 [AUTO-XP] Error processing user ${userId} in ${department}:`, userErr);
        }
      }

    } catch (err) {
      console.error(`🔥 [AUTO-XP] Error with department ${department}:`, err);
    }
  }

  // Send logs grouped by department as embeds
  try {
    if (!client) {
      console.warn('⚠️ [AUTO-XP] Discord client not provided, skipping log sending.');
    } else {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      if (!logChannel?.isTextBased()) {
        console.warn('⚠️ [AUTO-XP] Log channel not found or not text-based.');
      } else {
        for (const dept of DEPARTMENTS) {
          const entries = logEntries.filter(e => e.department === dept);
          if (entries.length === 0) continue;

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

            await logChannel.send({ embeds: [embed] });
          }
        }
      }
    }
  } catch (logErr) {
    console.error('❌ [AUTO-XP] Failed to send logs:', logErr);
  }

  console.log('✅ [AUTO-XP] Finished assigning XP globally.');
}

function scheduleAutoXP(client) {
  cron.schedule('0 23 * * *', () => {
    const nowEST = DateTime.now().setZone('America/New_York');
    if (nowEST.hour === 23) {
      autoXPTrigger(client);
    }
  }, {
    timezone: 'America/New_York'
  });
}

module.exports = { scheduleAutoXP, autoXPTrigger };