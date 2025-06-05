const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const rankMapping = require('../config/rankMapping');
const getRobloxUser = require('../utils/getRobloxUser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update Discord roles based on Roblox group ranks.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select the Discord user to update (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id);
    const robloxUsername = member.nickname || member.user.username;

    if (!robloxUsername) {
      return interaction.reply({ content: '❌ Could not determine Roblox username.', ephemeral: true });
    }

    await interaction.deferReply();
    try {
      const robloxUser = await getRobloxUser(robloxUsername);
      const response = await axios.get(`https://groups.roblox.com/v2/users/${robloxUser.id}/groups/roles`);
      const userGroups = response.data.data;

      if (!member.manageable) {
        return interaction.editReply({ content: '❌ I cannot manage roles for this user.' });
      }

      const currentRoles = new Set(member.roles.cache.map(r => r.id));
      let changes = false, updatedRoles = [];
      
      for (const [groupName, config] of Object.entries(rankMapping)) {
        const groupInfo = userGroups.find(g => g.group.id === config.groupId);
        const validRoles = Object.values(config.roles);
        const correctRoleId = groupInfo ? config.roles[groupInfo.role.id] : null;

        // Remove any outdated role from this mapping
        const rolesToRemove = validRoles.filter(id => currentRoles.has(id) && id !== correctRoleId);
        if (rolesToRemove.length) {
          await member.roles.remove(rolesToRemove);
          changes = true;
        }

        // Add the correct role if missing
        if (correctRoleId && !currentRoles.has(correctRoleId)) {
          await member.roles.add(correctRoleId);
          updatedRoles.push(`🛡️ **${groupName}** → \`${groupInfo.role.name}\``);
          changes = true;
        }
      }

      const communityGroupId = 35878333;
      const communityRoleId  = '1362918437516476648';

      const inCommunityGroup = userGroups.some(g => g.group.id === communityGroupId);

      if (inCommunityGroup && !currentRoles.has(communityRoleId)) {

        await member.roles.add(communityRoleId);
        updatedRoles.push(`🌐 **Community Member** role added.`);
        changes = true;
      } else if (!inCommunityGroup && currentRoles.has(communityRoleId)) {

        await member.roles.remove(communityRoleId);
        updatedRoles.push(`❌ **Community Member** role removed.`);
        changes = true;
      }

      const embed = new EmbedBuilder()
        .setTitle(changes ? '✅ Roles Synced' : '✅ Already Synced')
        .setDescription(
          changes
            ? `The following roles were updated:\n\n${updatedRoles.join('\n')}`
            : `${member.displayName} already has correct roles.`
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp()
        .setColor(changes ? 0x00FF99 : 0x00CCFF);

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.editReply({ content: '❌ Failed to update roles. Try again later.' });
    }
  }
};