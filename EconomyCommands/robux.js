const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const { getUser } = require("../utils/economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("robux")
        .setDescription("Check your or another user's Robux balance")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to check")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const target = interaction.options.getUser("user") || interaction.user;
        const data = getUser(client, target.id);

        const embed = new EmbedBuilder()
            .setTitle(`${target.username}'s Robux Stats`)
            .setColor(0x7a00ff)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "Robux Balance", value: `**${data.currencies.robux.toLocaleString()}**`, inline: true },
                { name: "Wagered", value: `**${data.wagered.toLocaleString()}**`, inline: true },
                { name: "Profit", value: `**${data.profit.toLocaleString()}**`, inline: true }
            )
            .setFooter({ text: "BBLOX Economy System" })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
