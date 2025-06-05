const generateCode = require('../utils/generateCode');
const getRobloxUser = require('../utils/getRobloxUser');
const axios = require('axios');
const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  InteractionType
} = require('discord.js');

const LOG_CHANNEL_ID = '1376893851536461824';
const UNVERIFIED_ROLE_ID = '1361864673225343166';

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    // Slash command handling
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
    }

    // Modal submission handling
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId === 'verify-modal'
    ) {
      const username = interaction.fields.getTextInputValue('roblox-username');

      // --- DUPLICATE-VERIFICATION CHECK ---
      await interaction.guild.members.fetch();
      const already = interaction.guild.members.cache.some((member) => {
        const nickMatches = member.nickname === username;
        const hasVerifiedRole = member.roles.cache.has(process.env.VERIFIED_ROLE_ID);
        return nickMatches && hasVerifiedRole;
      });

      if (already) {
        return interaction.reply({
          content: '❌ That Roblox account is already verified by someone in this server.',
          ephemeral: true
        });
      }
      // --- END CHECK ---

      const code = generateCode();
      client.verificationRequests[interaction.user.id] = {
        username,
        code,
        expiresAt: Date.now() + 10 * 60 * 1000
      };

      const embed = new EmbedBuilder()
        .setTitle('Step 2: Add Code to Roblox')
        .setDescription(`Add this code to your Roblox profile:\n\n\`${code}\``)
        .setColor(0x00aeff);

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify-check')
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('verify-regen')
          .setLabel('Regenerate Code')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: true
      });
    }

    // Button interaction handling
    if (interaction.isButton()) {
      const data = client.verificationRequests[interaction.user.id];
      if (!data) {
        return interaction.reply({
          content: '❌ No active session. Use /verify.',
          ephemeral: true
        });
      }

      // Regenerate code cooldown
      if (interaction.customId === 'verify-regen') {
        const last = client.regenCooldowns[interaction.user.id];
        if (last && Date.now() - last < 15_000) {
          return interaction.reply({
            content: '❌ Wait before regenerating code.',
            ephemeral: true
          });
        }

        const newCode = generateCode();
        client.verificationRequests[interaction.user.id].code = newCode;
        client.regenCooldowns[interaction.user.id] = Date.now();

        const embed = new EmbedBuilder()
          .setTitle('✅ New Code Generated')
          .setDescription(`Use this code:\n\n\`${newCode}\``)
          .setColor(0x00aeff);

        return interaction.update({ embeds: [embed] });
      }

      // Verification check
      if (interaction.customId === 'verify-check') {
        try {
          const robloxUser = await getRobloxUser(data.username);
          const profile = await axios.get(
            `https://users.roblox.com/v1/users/${robloxUser.id}`
          );
          const description = profile.data.description;

          // Code match check
          if (!description.includes(data.code)) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle('❌ Verification Failed')
                  .setDescription('Wrong code in profile.')
              ],
              components: []
            });
          }

          // Set nickname and manage roles
          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.setNickname(robloxUser.username);

          // Add verified role
          await member.roles.add(process.env.VERIFIED_ROLE_ID);

          // Remove unverified role if they have it
          if (member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
            await member.roles.remove(UNVERIFIED_ROLE_ID);
          }

          // Log to channel
          const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔒 User Verified')
              .addFields(
                { name: 'Discord User', value: `${interaction.user.tag} (${interaction.user.id})` },
                { name: 'Roblox Username', value: `${robloxUser.username} (${robloxUser.id})` },
                { name: 'Verification Code', value: `\`${data.code}\`` },
                { name: 'Verified At', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
              )
              .setColor(0x00ff00)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }

          // Clean up request
          delete client.verificationRequests[interaction.user.id];

          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Verified!')
                .setDescription(`Welcome, ${robloxUser.username}!`)
            ],
            components: []
          });
        } catch (err) {
          return interaction.reply({
            content: '❌ Verification failed. Try again later.',
            ephemeral: true
          });
        }
      }
    }
  }
};