const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const FIREBASE_BASE_URL = process.env.FIREBASE_BASE_URL;
const FIREBASE_SECRET = process.env.FIREBASE_SECRET;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const GROUP_IDS = {
  Army: 35878400,
  Marine: 35878424,
  Naval: 35878408,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rmvxp')
    .setDescription('Remove XP from a Roblox user in a department')
    .addStringOption(option =>
      option.setName('department')
        .setDescription('Select the department')
        .setRequired(true)
        .addChoices(
          { name: 'Army', value: 'Army' },
          { name: 'Marine', value: 'Marine' },
          { name: 'Naval', value: 'Naval' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Select a user (their nickname must be their Roblox username)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('XP amount to remove')
        .setRequired(true)
    ),

  async execute(interaction) {
    const department = interaction.options.getString('department');
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    const username = interaction.guild.members.cache.get(user.id)?.nickname;

    if (!username) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Username Missing')
            .setDescription(`This user doesn't have a nickname set. Please make sure their nickname is set to their Roblox username.`)
            .setColor('Red')
        ],
        ephemeral: true
      });
    }

    // Resolve Roblox ID
    const idRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username] })
    });
    const idData = await idRes.json();
    const robloxId = idData?.data?.[0]?.id;
    if (!robloxId) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Invalid Username')
            .setDescription(`Could not find Roblox user **${username}**.`)
            .setColor('Red')
        ],
        ephemeral: true
      });
    }

    // Check department group membership
    const groupId = GROUP_IDS[department];
    const groupRes = await fetch(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
    const groupData = await groupRes.json();
    const inGroup = groupData.data?.some(g => g.group.id === groupId);

    if (!inGroup) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 User Not In Department')
            .setDescription(`**${username}** is not in the **${department}** group.`)
            .setColor('Red')
            .setFooter({ text: 'XP was not removed.' })
        ],
        ephemeral: true
      });
    }

    // Fetch existing XP/level
    const xpUrl = `${FIREBASE_BASE_URL}/XP/${department}/${robloxId}.json?auth=${FIREBASE_SECRET}`;
    const xpRes = await fetch(xpUrl);
    const existing = await xpRes.json();
    let xp = existing?.xp ?? 0;
    let level = existing?.level ?? 1;

    // Remove XP
    xp -= amount;
    while (xp < 0 && level > 1) {
      level -= 1;
      xp += (100 + (level - 1) * 20);
    }

    if (xp < 0) xp = 0;

    // Write to Firebase
    await fetch(xpUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp, level })
    });

    const replyEmbed = new EmbedBuilder()
      .setTitle('✅ XP Removed')
      .setColor('Orange')
      .addFields(
        { name: 'Department', value: department, inline: true },
        { name: 'User', value: username, inline: true },
        { name: 'Amount', value: `-${amount}`, inline: true },
        { name: 'New Level', value: level.toString(), inline: true },
        { name: 'Current XP', value: xp.toString(), inline: true }
      )
      .setFooter({ text: `Run by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [replyEmbed] });

    const logEmbed = new EmbedBuilder()
      .setTitle('🔧 /RmvXP Command Used')
      .setColor('DarkRed')
      .addFields(
        { name: 'Invoker', value: interaction.user.tag, inline: true },
        { name: 'Department', value: department, inline: true },
        { name: 'Target', value: `${username} (${robloxId})`, inline: true },
        { name: 'Amount', value: `-${amount}`, inline: true },
        { name: 'Result Lvl', value: level.toString(), inline: true },
        { name: 'Result XP', value: xp.toString(), inline: true }
      )
      .setTimestamp();

    const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
    if (logChannel?.isTextBased()) {
      logChannel.send({ embeds: [logEmbed] });
    }
  }
};