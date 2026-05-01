const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require("discord.js");

const sendLog = require("../utils/logger");
const { getUser, saveEconomy } = require("../utils/economy");

const ALLOWED_ROLE = "1499518664985284681";
const PANEL_BUTTON_IDS = new Set([
    "panel_add_dollars",
    "panel_remove_dollars",
    "panel_reset_stats",
    "panel_add_robux",
    "panel_remove_robux",
    "panel_reset_robux_stats"
]);
const PANEL_MODAL_IDS = new Set([
    "add_dollars_modal",
    "remove_dollars_modal",
    "reset_stats_modal",
    "add_robux_modal",
    "remove_robux_modal",
    "reset_robux_stats_modal"
]);

module.exports = async (interaction, client) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                return interaction.reply({ content: "Command not found.", ephemeral: true });
            }

            return command.execute(interaction, client);
        }

        if (interaction.isButton()) {
            if (!PANEL_BUTTON_IDS.has(interaction.customId)) {
                return;
            }

            if (!interaction.guild) {
                return interaction.reply({ content: "This action can only be used in a server.", ephemeral: true });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(ALLOWED_ROLE)) {
                return interaction.reply({ content: "Permission not granted", ephemeral: true });
            }

            if (interaction.customId === "panel_add_dollars") {
                const modal = new ModalBuilder()
                    .setCustomId("add_dollars_modal")
                    .setTitle("Add Dollars");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("amount")
                            .setLabel("Set Dollars To")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === "panel_remove_dollars") {
                const modal = new ModalBuilder()
                    .setCustomId("remove_dollars_modal")
                    .setTitle("Remove Dollars");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("amount")
                            .setLabel("Amount")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === "panel_reset_stats") {
                const modal = new ModalBuilder()
                    .setCustomId("reset_stats_modal")
                    .setTitle("Reset Dollar Stats");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === "panel_add_robux") {
                const modal = new ModalBuilder()
                    .setCustomId("add_robux_modal")
                    .setTitle("Add Robux");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("amount")
                            .setLabel("Set Robux To")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === "panel_remove_robux") {
                const modal = new ModalBuilder()
                    .setCustomId("remove_robux_modal")
                    .setTitle("Remove Robux");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("amount")
                            .setLabel("Amount")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === "panel_reset_robux_stats") {
                const modal = new ModalBuilder()
                    .setCustomId("reset_robux_stats_modal")
                    .setTitle("Reset Robux Stats");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("user_id")
                            .setLabel("User ID")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            return;
        }

        if (interaction.isModalSubmit()) {
            if (!PANEL_MODAL_IDS.has(interaction.customId)) {
                return;
            }

            if (!interaction.guild) {
                return interaction.reply({ content: "This action can only be used in a server.", ephemeral: true });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!member.roles.cache.has(ALLOWED_ROLE)) {
                return interaction.reply({ content: "Permission not granted", ephemeral: true });
            }

            if (interaction.customId === "add_dollars_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const amount = Number.parseInt(interaction.fields.getTextInputValue("amount"), 10);

                if (!Number.isFinite(amount) || amount < 0) {
                    return interaction.reply({ content: "Amount must be a valid positive number.", ephemeral: true });
                }

                const data = getUser(client, id);
                data.currencies.dollars = amount;
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Set Dollars")
                    .setDescription(`User: <@${id}>\nNew dollars balance: ${amount}`)
                    .setColor(0x00ffcc));

                return interaction.reply({ content: "Dollars balance updated.", ephemeral: true });
            }

            if (interaction.customId === "remove_dollars_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const amount = Number.parseInt(interaction.fields.getTextInputValue("amount"), 10);

                if (!Number.isFinite(amount) || amount < 0) {
                    return interaction.reply({ content: "Amount must be a valid positive number.", ephemeral: true });
                }

                const data = getUser(client, id);
                data.currencies.dollars = Math.max(0, data.currencies.dollars - amount);
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Removed Dollars")
                    .setDescription(`User: <@${id}>\nRemoved dollars: ${amount}`)
                    .setColor(0xff0000));

                return interaction.reply({ content: "Dollars removed.", ephemeral: true });
            }

            if (interaction.customId === "reset_stats_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const data = getUser(client, id);

                data.currencies.dollars = 0;
                data.wagered = 0;
                data.profit = 0;
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Reset Dollar Stats")
                    .setDescription(`User: <@${id}> dollars, wagered, and profit reset`)
                    .setColor(0x7a00ff));

                return interaction.reply({ content: "Dollar stats reset.", ephemeral: true });
            }

            if (interaction.customId === "add_robux_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const amount = Number.parseInt(interaction.fields.getTextInputValue("amount"), 10);

                if (!Number.isFinite(amount) || amount < 0) {
                    return interaction.reply({ content: "Amount must be a valid positive number.", ephemeral: true });
                }

                const data = getUser(client, id);
                data.currencies.robux = amount;
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Set Robux")
                    .setDescription(`User: <@${id}>\nNew Robux balance: ${amount}`)
                    .setColor(0x00ffcc));

                return interaction.reply({ content: "Robux balance updated.", ephemeral: true });
            }

            if (interaction.customId === "remove_robux_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const amount = Number.parseInt(interaction.fields.getTextInputValue("amount"), 10);

                if (!Number.isFinite(amount) || amount < 0) {
                    return interaction.reply({ content: "Amount must be a valid positive number.", ephemeral: true });
                }

                const data = getUser(client, id);
                data.currencies.robux = Math.max(0, data.currencies.robux - amount);
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Removed Robux")
                    .setDescription(`User: <@${id}>\nRemoved Robux: ${amount}`)
                    .setColor(0xff0000));

                return interaction.reply({ content: "Robux removed.", ephemeral: true });
            }

            if (interaction.customId === "reset_robux_stats_modal") {
                const id = interaction.fields.getTextInputValue("user_id");
                const data = getUser(client, id);

                data.currencies.robux = 0;
                data.wagered = 0;
                data.profit = 0;
                saveEconomy(client);

                await sendLog(client, new EmbedBuilder()
                    .setTitle("Reset Robux Stats")
                    .setDescription(`User: <@${id}> Robux, wagered, and profit reset`)
                    .setColor(0x7a00ff));

                return interaction.reply({ content: "Robux stats reset.", ephemeral: true });
            }
        }
    } catch (err) {
        console.error(err);

        if (interaction.deferred || interaction.replied) {
            return interaction.followUp({ content: "An error occurred while handling that interaction.", ephemeral: true });
        }

        return interaction.reply({ content: "An error occurred while handling that interaction.", ephemeral: true });
    }
};
