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
    changeBalance,
    calculateTaxedProfit,
    PROFIT_TAX_RATE
} = require("../utils/economy");

const BLOX_IMAGE = path.join(__dirname, "..", "blox.png");
const CURRENCY_LABELS = {
    dollars: "Dollars",
    robux: "Robux"
};
const DIE_ART = {
    1: ["+-------+", "|       |", "|   o   |", "|       |", "+-------+"],
    2: ["+-------+", "| o     |", "|       |", "|     o |", "+-------+"],
    3: ["+-------+", "| o     |", "|   o   |", "|     o |", "+-------+"],
    4: ["+-------+", "| o   o |", "|       |", "| o   o |", "+-------+"],
    5: ["+-------+", "| o   o |", "|   o   |", "| o   o |", "+-------+"],
    6: ["+-------+", "| o   o |", "| o   o |", "| o   o |", "+-------+"]
};
const ROLLING_ART = ["+-------+", "| .   . |", "|   ?   |", "| .   . |", "+-------+"];

function buildImage() {
    return new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });
}

function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

function rollPair() {
    const first = rollDie();
    const second = rollDie();

    return {
        dice: [first, second],
        total: first + second
    };
}

function formatDice(values) {
    return values.map((value) => `[${value}]`).join(" ");
}

function renderBigDie(value, rolling = false) {
    return rolling ? ROLLING_ART : DIE_ART[value];
}

function renderBigDice(values, rolling = false) {
    const renderedDice = values.map((value) => renderBigDie(value, rolling));
    const lines = [];

    for (let lineIndex = 0; lineIndex < renderedDice[0].length; lineIndex += 1) {
        lines.push(renderedDice.map((die) => die[lineIndex]).join("  "));
    }

    return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function buildRollDisplay(name, values, total = null, rolling = false) {
    return [
        `**${name}**${total === null ? "" : `  Total: **${total}**`}`,
        renderBigDice(values, rolling)
    ].join("\n");
}

function buildDiceMessage(title, sections) {
    return [`## ${title}`, ...sections].join("\n\n");
}

function settleEscrowedDiceDuel({ hostData, opponentData, winnerData, loserData, currency, bet }) {
    const payout = calculateTaxedProfit(bet);

    changeBalance(hostData, currency, -bet);
    changeBalance(opponentData, currency, -bet);
    changeBalance(winnerData, currency, (bet * 2) - payout.tax);

    hostData.wagered += bet;
    opponentData.wagered += bet;
    winnerData.profit += payout.netProfit;
    loserData.profit -= bet;

    return {
        tax: payout.tax,
        netProfit: payout.netProfit,
        payoutAmount: (bet * 2) - payout.tax
    };
}

function buildGameEmbed({
    title,
    color,
    host,
    opponent,
    bet,
    currencyLabel,
    extraLines
}) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail("attachment://blox.png")
        .setDescription(
            `**${host.username}${opponent ? ` vs ${opponent.username}` : ""}**\n\n` +
            `Bet: **${bet.toLocaleString()} ${currencyLabel}** each\n` +
            `Pot: **${(bet * 2).toLocaleString()} ${currencyLabel}**\n` +
            `Profit Tax: **${Math.round(PROFIT_TAX_RATE * 100)}%**\n` +
            `Theme: **Neon blue and purple**\n\n` +
            extraLines.join("\n")
        )
        .setFooter({
            text: "BBLOX | Neon Stakes",
            iconURL: "attachment://blox.png"
        })
        .setTimestamp();
}

function buildLobbyButtons(hostId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`diceduels_join_${hostId}`)
                .setLabel("Join Dice Duel")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`diceduels_cancel_${hostId}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("diceduels")
        .setDescription("Start a two-player dice duel")
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

        const msg = await interaction.reply({
            content: buildDiceMessage("Dice Duels", ["Waiting for players to join the table."]),
            embeds: [
                buildGameEmbed({
                    title: "BBLOX Dice Duels",
                    color: 0x7a00ff,
                    host,
                    opponent: null,
                    bet,
                    currencyLabel,
                    extraLines: [
                        "Waiting for an opponent...",
                        "Each player rolls 2 dice. The higher combined total wins the pot."
                    ]
                })
            ],
            components: buildLobbyButtons(host.id),
            files: [buildImage()],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ time: 90000 });
        let opponent = null;

        collector.on("collect", async (btn) => {
            if (btn.customId === `diceduels_cancel_${host.id}`) {
                if (btn.user.id !== host.id) {
                    return btn.reply({ content: "Only the host can cancel.", ephemeral: true });
                }

                collector.stop("cancelled");
                return btn.update({
                    content: buildDiceMessage("Dice Duels", ["Dice duel cancelled."]),
                    embeds: [],
                    components: [],
                    files: []
                });
            }

            if (btn.customId !== `diceduels_join_${host.id}`) {
                return;
            }

            if (btn.user.id === host.id) {
                return btn.reply({ content: "You cannot join your own game.", ephemeral: true });
            }

            if (opponent && btn.user.id !== opponent.id) {
                return btn.reply({ content: "Someone has already joined this game.", ephemeral: true });
            }

            opponent = btn.user;
            const opponentData = getUser(client, opponent.id);

            if (getBalance(opponentData, currency) < bet) {
                return btn.reply({
                    content: `You do not have enough ${currencyLabel.toLowerCase()} to join this dice duel.`,
                    ephemeral: true
                });
            }

            collector.stop("resolved");

            const rollingSamples = [
                [rollDie(), rollDie()],
                [rollDie(), rollDie()],
                [rollDie(), rollDie()],
                [rollDie(), rollDie()]
            ];
            const rollingFrames = [
                [
                    buildRollDisplay(host.username, rollingSamples[0], null, true),
                    buildRollDisplay(opponent.username, rollingSamples[1], null, true)
                ].join("\n\n"),
                [
                    buildRollDisplay(host.username, rollingSamples[0]),
                    buildRollDisplay(opponent.username, rollingSamples[1], null, true)
                ].join("\n\n"),
                [
                    buildRollDisplay(host.username, rollingSamples[2], null, true),
                    buildRollDisplay(opponent.username, rollingSamples[3], null, true)
                ].join("\n\n"),
                [
                    buildRollDisplay(host.username, rollingSamples[2]),
                    buildRollDisplay(opponent.username, rollingSamples[3])
                ].join("\n\n")
            ];

            for (const frame of rollingFrames) {
                await msg.edit({
                    content: buildDiceMessage("Rolling Dice", [frame]),
                    embeds: [
                        buildGameEmbed({
                            title: "Dice Duels Rolling",
                            color: 0x5865f2,
                            host,
                            opponent,
                            bet,
                            currencyLabel,
                            extraLines: [
                                "Rolling the dice...",
                                "Live dice are shown above the embed."
                            ]
                        })
                    ],
                    components: [],
                    files: [buildImage()]
                });

                await new Promise((resolve) => setTimeout(resolve, 700));
            }

            let hostRoll = rollPair();
            let opponentRoll = rollPair();
            let rerollCount = 0;

            while (hostRoll.total === opponentRoll.total) {
                rerollCount += 1;

                await msg.edit({
                    content: buildDiceMessage("Tie Re-roll", [
                        buildRollDisplay(host.username, hostRoll.dice, hostRoll.total),
                        buildRollDisplay(opponent.username, opponentRoll.dice, opponentRoll.total)
                    ]),
                    embeds: [
                        buildGameEmbed({
                            title: "Dice Duels Tie",
                            color: 0x7a00ff,
                            host,
                            opponent,
                            bet,
                            currencyLabel,
                            extraLines: [
                                `Both players rolled **${hostRoll.total}**.`,
                                "Tie detected. Re-rolling for a clear winner...",
                                "Live dice are shown above the embed."
                            ]
                        })
                    ],
                    components: [],
                    files: [buildImage()]
                });

                await new Promise((resolve) => setTimeout(resolve, 900));
                hostRoll = rollPair();
                opponentRoll = rollPair();
            }

            const winner = hostRoll.total > opponentRoll.total ? host : opponent;
            const loser = winner.id === host.id ? opponent : host;
            const winnerData = getUser(client, winner.id);
            const loserData = getUser(client, loser.id);
            const payout = settleEscrowedDiceDuel({
                hostData,
                opponentData,
                winnerData,
                loserData,
                currency,
                bet
            });

            saveEconomy(client);

            return msg.edit({
                content: buildDiceMessage("Final Roll", [
                    buildRollDisplay(host.username, hostRoll.dice, hostRoll.total),
                    buildRollDisplay(opponent.username, opponentRoll.dice, opponentRoll.total)
                ]),
                embeds: [
                        buildGameEmbed({
                            title: "BBLOX Dice Duels Result",
                            color: 0x00c3ff,
                            host,
                            opponent,
                        bet,
                        currencyLabel,
                        extraLines: [
                            rerollCount > 0 ? `Tie Re-rolls: **${rerollCount}**` : "Tie Re-rolls: **0**",
                            `Winner: **${winner.username}**`,
                            `Quick View: ${formatDice(hostRoll.dice)} vs ${formatDice(opponentRoll.dice)}`,
                            `Pot Paid Out: **${payout.payoutAmount.toLocaleString()} ${currencyLabel}**`,
                            `Net Profit Won: **${payout.netProfit.toLocaleString()} ${currencyLabel}**`,
                            `Tax Taken: **${payout.tax.toLocaleString()} ${currencyLabel}**`
                        ]
                    })
                ],
                components: [],
                files: [buildImage()]
            });
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "time") {
                return;
            }

            await msg.edit({
                content: buildDiceMessage("Dice Duels", ["Dice duel expired."]),
                components: []
            }).catch(() => {});
        });
    }
};
