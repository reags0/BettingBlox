const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require("discord.js");

const ALLOWED_ROLE = "1499518664985284681";
const BLOX_IMAGE = path.join(__dirname, "..", "blox.png");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("panel")
        .setDescription("Open the BBLOX admin panel"),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "This command can only be used in a server.",
                ephemeral: true
            });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.roles.cache.has(ALLOWED_ROLE)) {
            return interaction.reply({
                content: "Permission not granted",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("BBLOX Control Panel")
            .setColor(0x7a00ff)
            .setDescription(
                "**Welcome to the BBLOX Admin Panel**\n\n" +
                "Use the buttons below to manage dollars and Robux.\n\n" +
                "Status: **ONLINE**\n" +
                "Access Level: **ADMIN**"
            )
            .addFields(
                { name: "Dollars", value: "Add, remove, or reset dollar data", inline: true },
                { name: "Robux", value: "Add, remove, or reset Robux data", inline: true },
                { name: "Games", value: "Control gambling systems", inline: true }
            )
            .setFooter({
                text: "BBLOX | Control System",
                iconURL: "attachment://blox.png"
            })
            .setTimestamp();

        const dollarsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("panel_add_dollars")
                .setLabel("Add Dollars")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("panel_remove_dollars")
                .setLabel("Remove Dollars")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("panel_reset_stats")
                .setLabel("Reset Dollar Stats")
                .setStyle(ButtonStyle.Secondary)
        );

        const robuxRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("panel_add_robux")
                .setLabel("Add Robux")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("panel_remove_robux")
                .setLabel("Remove Robux")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("panel_reset_robux_stats")
                .setLabel("Reset Robux Stats")
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            embeds: [embed],
            components: [dollarsRow, robuxRow],
            files: [new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" })],
            ephemeral: true
        });
    }
};
