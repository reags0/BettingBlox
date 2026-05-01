const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require("discord.js");

const {
    getUser,
    saveEconomy,
    getBalance,
    settlePvpBet,
    PROFIT_TAX_RATE
} = require("../utils/economy");

const BLOX_IMAGE = path.join(__dirname, "..", "blox.png");
const CURRENCY_LABELS = {
    dollars: "Dollars",
    robux: "Robux"
};

function buildImage() {
    return new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Start a coinflip game")
        .addIntegerOption((option) =>
            option
                .setName("bet")
                .setDescription("Amount to bet")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("currency")
                .setDescription("What currency to bet with")
                .setRequired(true)
                .addChoices(
                    { name: "Dollars", value: "dollars" },
                    { name: "Robux", value: "robux" }
                )
        ),

    async execute(interaction, client) {
        const bet = interaction.options.getInteger("bet");
        const currency = interaction.options.getString("currency");
        const currencyLabel = CURRENCY_LABELS[currency];
        const host = interaction.user;
        const hostData = getUser(client, host.id);

        if (!currencyLabel) {
            return interaction.reply({
                content: "Invalid currency selected.",
                ephemeral: true
            });
        }

        if (bet <= 0 || getBalance(hostData, currency) < bet) {
            return interaction.reply({
                content: `Invalid bet or not enough ${currencyLabel.toLowerCase()}.`,
                ephemeral: true
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`coinflip_join_${host.id}`)
                .setLabel("Join Coinflip")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`coinflip_cancel_${host.id}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle("BBLOX Coinflip")
            .setColor(0x7a00ff)
            .setThumbnail("attachment://blox.png")
            .setDescription(
                `**${host.username}** started a coinflip\n\n` +
                `Bet: **${bet.toLocaleString()} ${currencyLabel}**\n` +
                "Waiting for an opponent..."
            )
            .setFooter({
                text: "BBLOX | High Stakes",
                iconURL: "attachment://blox.png"
            })
            .setTimestamp();

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row],
            files: [buildImage()],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ time: 60000 });

        let opponent = null;
        let hostChoice = null;
        let oppChoice = null;

        collector.on("collect", async (btn) => {
            if (btn.customId === `coinflip_cancel_${host.id}`) {
                if (btn.user.id !== host.id) {
                    return btn.reply({ content: "Only the host can cancel.", ephemeral: true });
                }

                collector.stop("cancelled");
                return btn.update({
                    content: "Coinflip cancelled.",
                    embeds: [],
                    components: [],
                    files: []
                });
            }

            if (btn.customId === `coinflip_join_${host.id}`) {
                if (btn.user.id === host.id) {
                    return btn.reply({ content: "You cannot join your own game.", ephemeral: true });
                }

                if (opponent && btn.user.id !== opponent.id) {
                    return btn.reply({ content: "Someone has already joined this game.", ephemeral: true });
                }

                opponent = btn.user;
                const oppData = getUser(client, opponent.id);

                if (getBalance(oppData, currency) < bet) {
                    return btn.reply({
                        content: `You do not have enough ${currencyLabel.toLowerCase()} to join this coinflip.`,
                        ephemeral: true
                    });
                }

                const choiceRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cf_heads_${host.id}`)
                        .setLabel("Heads")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`cf_tails_${host.id}`)
                        .setLabel("Tails")
                        .setStyle(ButtonStyle.Danger)
                );

                const newEmbed = EmbedBuilder.from(embed).setDescription(
                    `**${host.username} vs ${opponent.username}**\n\n` +
                    `Bet: **${bet.toLocaleString()} ${currencyLabel}**\n` +
                    "Host chooses first."
                );

                await btn.update({
                    embeds: [newEmbed],
                    components: [choiceRow],
                    files: [buildImage()]
                });

                return;
            }

            if (btn.customId === `cf_heads_${host.id}` || btn.customId === `cf_tails_${host.id}`) {
                if (!opponent) {
                    return btn.reply({ content: "An opponent needs to join first.", ephemeral: true });
                }

                const side = btn.customId.includes("heads") ? "Heads" : "Tails";

                if (btn.user.id === host.id) {
                    if (hostChoice) {
                        return btn.reply({ content: "You already selected.", ephemeral: true });
                    }

                    hostChoice = side;

                    await btn.reply({
                        content: `You selected **${side}**.`,
                        ephemeral: true
                    });

                    await msg.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Coinflip Duel")
                                .setColor(0x7a00ff)
                                .setThumbnail("attachment://blox.png")
                                .setDescription(
                                    `**${host.username} vs ${opponent.username}**\n\n` +
                                    `Bet: **${bet.toLocaleString()} ${currencyLabel}**\n` +
                                    "Host has locked in a choice.\n" +
                                    `<@${opponent.id}>, it is now your turn.`
                                )
                        ],
                        files: [buildImage()]
                    });

                    return;
                }

                if (btn.user.id !== opponent.id) {
                    return btn.reply({ content: "You are not in this game.", ephemeral: true });
                }

                if (!hostChoice) {
                    return btn.reply({ content: "Wait for the host to choose first.", ephemeral: true });
                }

                if (oppChoice) {
                    return btn.reply({ content: "You already selected.", ephemeral: true });
                }

                oppChoice = side;

                await btn.reply({
                    content: `You selected **${side}**.`,
                    ephemeral: true
                });

                collector.stop("resolved");

                const frames = ["Flipping", "Flipping.", "Flipping..", "Flipping..."];

                for (const frame of frames) {
                    await msg.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Coinflip in Motion")
                                .setColor(0x7a00ff)
                                .setDescription(frame)
                                .setThumbnail("attachment://blox.png")
                        ],
                        components: [],
                        files: [buildImage()]
                    });

                    await new Promise((resolve) => setTimeout(resolve, 500));
                }

                const result = Math.random() < 0.5 ? "Heads" : "Tails";
                const winner = hostChoice === result ? host : opponent;
                const loser = winner.id === host.id ? opponent : host;
                const winnerData = getUser(client, winner.id);
                const loserData = getUser(client, loser.id);

                const payout = settlePvpBet({
                    winnerData,
                    loserData,
                    currency,
                    bet
                });
                saveEconomy(client);

                const resultEmbed = new EmbedBuilder()
                    .setTitle("Coinflip Result")
                    .setColor(0x00c3ff)
                    .setThumbnail("attachment://blox.png")
                    .setDescription(
                        `**${host.username} vs ${opponent.username}**\n\n` +
                        `Currency: **${currencyLabel}**\n` +
                        `Result: **${result}**\n` +
                        `Winner: **${winner.username}**\n` +
                        `Net Profit Won: **${payout.netProfit.toLocaleString()} ${currencyLabel}**\n` +
                        `Tax: **${payout.tax.toLocaleString()} ${currencyLabel}** (${Math.round(PROFIT_TAX_RATE * 100)}%)`
                    )
                    .setFooter({
                        text: "BBLOX | Results",
                        iconURL: "attachment://blox.png"
                    })
                    .setTimestamp();

                return msg.edit({
                    embeds: [resultEmbed],
                    components: [],
                    files: [buildImage()]
                });
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "time") {
                return;
            }

            await msg.edit({
                content: "Coinflip expired.",
                components: []
            }).catch(() => {});
        });
    }
};
