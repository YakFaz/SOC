const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const groupsMapping = require(path.resolve(__dirname, '../config/groupsMapping'));
const experienceMapping = require(path.resolve(__dirname, '../config/experienceMapping'));
const levelMapping      = require(path.resolve(__dirname, '../config/levelMapping'));

const FIREBASE_BASE_URL = process.env.FIREBASE_BASE_URL;
const FIREBASE_SECRET   = process.env.FIREBASE_SECRET;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check a user\'s XP, level, rank, divisions, and playtime in a wing')
    .addStringOption(option =>
      option.setName('wing')
        .setDescription('Select the wing')
        .setRequired(true)
        .addChoices(
          { name: 'Army', value: 'Army' },
          { name: 'Marine', value: 'Marine' },
          { name: 'Naval', value: 'Naval' },
          { name: 'JSOC', value: 'JSOC' }
        )
    )
    .addUserOption(option =>
      option.setName('username')
        .setDescription('Select the user (must have Roblox username as server nickname)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const department = interaction.options.getString('wing');
    const member     = interaction.options.getUser('username');
    const robloxUsername = interaction.guild.members.cache.get(member.id)?.nickname || member.username;

    // Validate Roblox username
    const idRes  = await fetch(`https://users.roblox.com/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [robloxUsername] })
    });
    const idData    = await idRes.json();
    const robloxId  = idData?.data?.[0]?.id;

    if (!robloxId) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Invalid Username')
        .setDescription(`Could not find Roblox user **${robloxUsername}**.`)
        .setColor('Red');
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Get XP and level from Firebase
    const xpUrl  = `${FIREBASE_BASE_URL}/XP/${department}/${robloxId}.json?auth=${FIREBASE_SECRET}`;
    const xpRes  = await fetch(xpUrl);
    const xpData = await xpRes.json();
    const xp     = xpData?.xp    ?? 0;
    const level  = xpData?.level ?? 1;

    // Get playtime from Firebase
    const ptUrl        = `${FIREBASE_BASE_URL}/Departments/${department}/${robloxId}.json?auth=${FIREBASE_SECRET}`;
    const playtimeRes  = await fetch(ptUrl);
    const playtimeData = await playtimeRes.json();
    const playtime     = playtimeData ? playtimeData.toString() : 'No playtime data';

    // Get rank in department
    const groupId       = groupsMapping[department].groupId;
    const userGroupsRes = await fetch(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
    const userGroupsData = await userGroupsRes.json();
    const groups        = userGroupsData?.data ?? [];
    const mainGroup     = groups.find(g => g.group.id.toString() === groupId);
    const mainRank      = mainGroup ? mainGroup.role.name : 'Not in group';

    // Get divisions
    const divisionRanks = [];
    for (const [divisionId, divisionName] of Object.entries(groupsMapping[department].divisions)) {
      const match = groups.find(g => g.group.id.toString() === divisionId);
      if (match) divisionRanks.push(`${divisionName} — ${match.role.name}`);
    }

    // --- Progress-to-Next-Rank Bar ---
    const xpCurrentLevel = experienceMapping[level - 1];
    const xpNextLevel    = experienceMapping[level] ?? xpCurrentLevel;
    const xpIntoLevel    = xp - xpCurrentLevel;
    const xpLevelTotal   = xpNextLevel - xpCurrentLevel;

    let rawPercent;
    if (xp < xpCurrentLevel) {
      rawPercent = xpNextLevel > 0 ? xp / xpNextLevel : 1;
    } else {
      rawPercent = xpLevelTotal > 0 ? xpIntoLevel / xpLevelTotal : 1;
    }
    // Clamp between 0 and 1
    const percent = Math.max(0, Math.min(rawPercent, 1));

    const totalBlocks  = 10;
    const filledBlocks = Math.floor(percent * totalBlocks);
    const emptyBlocks  = totalBlocks - filledBlocks;
    const progressBar  = '🟩'.repeat(filledBlocks) + '🟥'.repeat(emptyBlocks);
    const percentText  = `${Math.round(percent * 100)}%`;

    const nextLevel = level + 1;
    const nextRank  = levelMapping[nextLevel]?.[department] || 'Max Level';

    // Build the Embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 **User Information for ${robloxUsername}**`)
      .setColor('#00A9E0')
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`)
      .addFields(
        { name: 'Wing',           value: department, inline: true },
        { name: 'Roblox ID',      value: robloxId.toString(), inline: true },
        { name: 'Rank',           value: mainRank, inline: true },
        { name: 'Level',          value: level.toString(), inline: true },
        { name: 'XP',             value: xp.toString(), inline: true },
        { name: 'Playtime (hrs)', value: (playtime / 3600).toFixed(2), inline: true },
        {
          name: 'Divisions',
          value: divisionRanks.length > 0 ? divisionRanks.join('\n') : 'None',
          inline: false
        },
        {
          name: `Progress to Next Rank (${nextRank})`,
          value: `${progressBar} ${percentText}`,
          inline: false
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};