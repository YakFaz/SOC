const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Start Roblox verification.'),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('verify-modal')
      .setTitle('Enter Your Roblox Username')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('roblox-username')
            .setLabel('Roblox Username')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }
};