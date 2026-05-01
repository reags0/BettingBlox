const path = require("path");
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");

const { getUser } = require("../utils/economy");

const BLOX_IMAGE = path.join(__dirname, "..", "blox.png");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dollars")
        .setDescription("View your dollars balance"),

    async execute(interaction, client) {
        try {
            const data = getUser(client, interaction.user.id);
            const image = new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });

            const embed = new EmbedBuilder()
                .setTitle("BBLOX Dollars Wallet")
                .setColor(0x7a00ff)
                .setThumbnail("attachment://blox.png")
                .addFields(
                    {
                        name: "Dollars Balance",
                        value: `**${data.currencies.dollars.toLocaleString()}**`,
                        inline: true
                    },
                    {
                        name: "Wagered",
                        value: `**${data.wagered.toLocaleString()}**`,
                        inline: true
                    },
                    {
                        name: "Profit",
                        value: `**${data.profit.toLocaleString()}**`,
                        inline: true
                    }
                )
                .setFooter({
                    text: `BBLOX | ${interaction.user.username}`,
                    iconURL: "attachment://blox.png"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                files: [image]
            });
        } catch (err) {
            console.error(err);

            return interaction.reply({
                content: "Failed to fetch your dollars balance.",
                ephemeral: true
            });
        }
    }
};
