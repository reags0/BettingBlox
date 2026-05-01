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
const CARD_VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const CARD_SUITS = ["S", "H", "D", "C"];
const CARD_RANKS = Object.fromEntries(CARD_VALUES.map((value, index) => [value, index + 2]));

function buildImage() {
    return new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });
}

function createDeck() {
    const deck = [];

    for (const suit of CARD_SUITS) {
        for (const value of CARD_VALUES) {
            deck.push({ value, suit, rank: CARD_RANKS[value] });
        }
    }

    for (let index = deck.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const temp = deck[index];
        deck[index] = deck[swapIndex];
        deck[swapIndex] = temp;
    }

    return deck;
}

function drawCard(deck) {
    if (deck.length === 0) {
        const newDeck = createDeck();
        deck.push(...newDeck);
    }

    return deck.pop();
}

function renderCard(card) {
    const left = card.value.padEnd(2, " ");
    const right = card.value.padStart(2, " ");

    return [
        "+-------+",
        `|${left}     |`,
        `|   ${card.suit}   |`,
        `|     ${right}|`,
        "+-------+"
    ];
}

function renderCardRow(cards) {
    const rendered = cards.map((card) => renderCard(card));
    const lines = [];

    for (let lineIndex = 0; lineIndex < rendered[0].length; lineIndex += 1) {
        lines.push(rendered.map((cardLines) => cardLines[lineIndex]).join("  "));
    }

    return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function settleEscrowedPot({ hostData, opponentData, winnerData, loserData, currency, bet }) {
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

function buildChoiceButtons(hostId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`higherlower_higher_${hostId}`)
                .setLabel("Higher")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`higherlower_lower_${hostId}`)
                .setLabel("Lower")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        )
    ];
}

function buildLobbyButtons(hostId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`higherlower_join_${hostId}`)
                .setLabel("Join Higher or Lower")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`higherlower_cancel_${hostId}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function buildEmbed({
    title,
    color,
    host,
    opponent,
    bet,
    currencyLabel,
    roundNumber,
    baseCard,
    revealCard,
    hostChoice,
    opponentChoice,
    extraLines
}) {
    const tableCards = revealCard ? [baseCard, revealCard] : [baseCard];

    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail("attachment://blox.png")
        .setDescription(
            `**${host.username}${opponent ? ` vs ${opponent.username}` : ""}**\n\n` +
            `Bet: **${bet.toLocaleString()} ${currencyLabel}** each\n` +
            `Pot: **${(bet * 2).toLocaleString()} ${currencyLabel}**\n` +
            `Profit Tax: **${Math.round(PROFIT_TAX_RATE * 100)}%**\n` +
            `Theme: **Neon blue and purple**\n` +
            `Round: **${roundNumber}**\n\n` +
            `Table Cards:\n${baseCard ? renderCardRow(tableCards) : "_Waiting for cards_"}\n` +
            `${opponent ? `${host.username}: **${hostChoice ?? "Locked In Secret"}**\n${opponent.username}: **${opponentChoice ?? "Locked In Secret"}**\n\n` : "\n"}` +
            extraLines.join("\n")
        )
        .setFooter({
            text: "BBLOX | Neon Deck",
            iconURL: "attachment://blox.png"
        })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("higherlower")
        .setDescription("Start a two-player higher or lower card duel")
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

        let opponent = null;
        let deck = null;
        let baseCard = null;
        let revealCard = null;
        let hostChoice = null;
        let opponentChoice = null;
        let roundNumber = 1;
        let resolved = false;

        const msg = await interaction.reply({
            embeds: [
                buildEmbed({
                    title: "BBLOX Higher or Lower",
                    color: 0x7a00ff,
                    host,
                    opponent: null,
                    bet,
                    currencyLabel,
                    roundNumber,
                    baseCard: null,
                    revealCard: null,
                    hostChoice: null,
                    opponentChoice: null,
                    extraLines: [
                        "Waiting for an opponent...",
                        "Both players choose whether the next card will be higher or lower."
                    ]
                })
            ],
            components: buildLobbyButtons(host.id),
            files: [buildImage()],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        async function resetRound(reasonText, nextBaseCard) {
            baseCard = nextBaseCard;
            revealCard = null;
            hostChoice = null;
            opponentChoice = null;
            roundNumber += 1;

            await msg.edit({
                embeds: [
                    buildEmbed({
                        title: "BBLOX Higher or Lower",
                        color: 0x5865f2,
                        host,
                        opponent,
                        bet,
                        currencyLabel,
                        roundNumber,
                        baseCard,
                        revealCard,
                        hostChoice,
                        opponentChoice,
                        extraLines: [
                            reasonText,
                            "Choose Higher or Lower for the next card."
                        ]
                    })
                ],
                components: buildChoiceButtons(host.id),
                files: [buildImage()]
            });
        }

        async function resolveRound() {
            revealCard = drawCard(deck);

            const comparison =
                revealCard.rank > baseCard.rank
                    ? "Higher"
                    : revealCard.rank < baseCard.rank
                        ? "Lower"
                        : "Tie";

            await msg.edit({
                embeds: [
                    buildEmbed({
                        title: "Higher or Lower Reveal",
                        color: 0x5865f2,
                        host,
                        opponent,
                        bet,
                        currencyLabel,
                        roundNumber,
                        baseCard,
                        revealCard,
                        hostChoice,
                        opponentChoice,
                        extraLines: [
                            `Result: **${comparison}**`,
                            comparison === "Tie"
                                ? "The drawn card matched the base card rank."
                                : "Checking both guesses..."
                        ]
                    })
                ],
                components: buildChoiceButtons(host.id, true),
                files: [buildImage()]
            });

            await new Promise((resolve) => setTimeout(resolve, 1000));

            if (comparison === "Tie") {
                await resetRound("Card ranks tied. Replaying the round...", revealCard);
                return;
            }

            const hostCorrect = hostChoice === comparison;
            const opponentCorrect = opponentChoice === comparison;

            if (hostCorrect === opponentCorrect) {
                await resetRound("Both players tied on the call. Replaying the round...", revealCard);
                return;
            }

            resolved = true;
            collector.stop("resolved");

            const winner = hostCorrect ? host : opponent;
            const loser = winner.id === host.id ? opponent : host;
            const winnerData = getUser(client, winner.id);
            const loserData = getUser(client, loser.id);
            const payout = settleEscrowedPot({
                hostData,
                opponentData: getUser(client, opponent.id),
                winnerData,
                loserData,
                currency,
                bet
            });

            saveEconomy(client);

            await msg.edit({
                embeds: [
                    buildEmbed({
                        title: "BBLOX Higher or Lower Result",
                        color: 0x00c3ff,
                        host,
                        opponent,
                        bet,
                        currencyLabel,
                        roundNumber,
                        baseCard,
                        revealCard,
                        hostChoice,
                        opponentChoice,
                        extraLines: [
                            `Winning Call: **${comparison}**`,
                            `Winner: **${winner.username}**`,
                            `Pot Paid Out: **${payout.payoutAmount.toLocaleString()} ${currencyLabel}**`,
                            `Net Profit Won: **${payout.netProfit.toLocaleString()} ${currencyLabel}**`,
                            `Tax Taken: **${payout.tax.toLocaleString()} ${currencyLabel}**`
                        ]
                    })
                ],
                components: [],
                files: [buildImage()]
            });
        }

        collector.on("collect", async (btn) => {
            if (btn.customId === `higherlower_cancel_${host.id}`) {
                if (btn.user.id !== host.id) {
                    return btn.reply({ content: "Only the host can cancel.", ephemeral: true });
                }

                collector.stop("cancelled");
                return btn.update({
                    content: "Higher or Lower cancelled.",
                    embeds: [],
                    components: [],
                    files: []
                });
            }

            if (btn.customId === `higherlower_join_${host.id}`) {
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
                        content: `You do not have enough ${currencyLabel.toLowerCase()} to join this higher or lower game.`,
                        ephemeral: true
                    });
                }

                deck = createDeck();
                baseCard = drawCard(deck);
                revealCard = null;

                return btn.update({
                    embeds: [
                        buildEmbed({
                            title: "BBLOX Higher or Lower",
                            color: 0x7a00ff,
                            host,
                            opponent,
                            bet,
                            currencyLabel,
                            roundNumber,
                            baseCard,
                            revealCard,
                            hostChoice,
                            opponentChoice,
                            extraLines: [
                                "Both players choose in secret.",
                                "If both players tie on the outcome, the table redraws and the duel continues."
                            ]
                        })
                    ],
                    components: buildChoiceButtons(host.id),
                    files: [buildImage()]
                });
            }

            if (
                btn.customId !== `higherlower_higher_${host.id}` &&
                btn.customId !== `higherlower_lower_${host.id}`
            ) {
                return;
            }

            if (!opponent || !baseCard || resolved) {
                return btn.reply({ content: "This game is not ready yet.", ephemeral: true });
            }

            if (btn.user.id !== host.id && btn.user.id !== opponent.id) {
                return btn.reply({ content: "You are not in this game.", ephemeral: true });
            }

            const choice = btn.customId.includes("_higher_") ? "Higher" : "Lower";

            if (btn.user.id === host.id) {
                if (hostChoice) {
                    return btn.reply({ content: "You already locked in your choice.", ephemeral: true });
                }

                hostChoice = choice;
            } else {
                if (opponentChoice) {
                    return btn.reply({ content: "You already locked in your choice.", ephemeral: true });
                }

                opponentChoice = choice;
            }

            await btn.reply({
                content: `You chose **${choice}**.`,
                ephemeral: true
            });

            await msg.edit({
                embeds: [
                    buildEmbed({
                        title: "BBLOX Higher or Lower",
                        color: 0x5865f2,
                        host,
                        opponent,
                        bet,
                        currencyLabel,
                        roundNumber,
                        baseCard,
                        revealCard,
                        hostChoice: hostChoice ? "Locked" : null,
                        opponentChoice: opponentChoice ? "Locked" : null,
                        extraLines: [
                            hostChoice && opponentChoice
                                ? "Both players locked in. Revealing the next card..."
                                : "Waiting for both players to lock in their choice..."
                        ]
                    })
                ],
                components: buildChoiceButtons(host.id, Boolean(hostChoice && opponentChoice)),
                files: [buildImage()]
            });

            if (hostChoice && opponentChoice) {
                await new Promise((resolve) => setTimeout(resolve, 800));
                await resolveRound();
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "time") {
                return;
            }

            await msg.edit({
                content: "Higher or Lower expired.",
                components: []
            }).catch(() => {});
        });
    }
};
