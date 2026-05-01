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
const CARD_VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CARD_SUITS = ["♠", "♥", "♦", "♣"];

function buildImage() {
    return new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });
}

function drawCard(deck) {
    return deck.pop();
}

function createDeck() {
    const deck = [];

    for (const suit of CARD_SUITS) {
        for (const value of CARD_VALUES) {
            deck.push({ suit, value });
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

function getHandTotal(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === "A") {
            total += 11;
            aces += 1;
            continue;
        }

        if (["J", "Q", "K"].includes(card.value)) {
            total += 10;
            continue;
        }

        total += Number.parseInt(card.value, 10);
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }

    return total;
}

function renderCard(card, hidden = false) {
    if (hidden) {
        return [
            "┌─────┐",
            "│░░░░░│",
            "│░ BB│",
            "│░░░░░│",
            "└─────┘"
        ];
    }

    const valueLeft = card.value.padEnd(2, " ");
    const valueRight = card.value.padStart(2, " ");

    return [
        "┌─────┐",
        `│${valueLeft}   │`,
        `│  ${card.suit}  │`,
        `│   ${valueRight}│`,
        "└─────┘"
    ];
}

function formatHand(hand, hideFirstCard = false) {
    if (hand.length === 0) {
        return "_No cards yet_";
    }

    const renderedCards = hand.map((card, index) => renderCard(card, hideFirstCard && index === 0));
    const lines = [];

    for (let lineIndex = 0; lineIndex < renderedCards[0].length; lineIndex += 1) {
        lines.push(renderedCards.map((cardLines) => cardLines[lineIndex]).join(" "));
    }

    return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function buildTableEmbed({
    title,
    color,
    host,
    opponent,
    dealerHand,
    hostHand,
    opponentHand,
    hideDealerCard,
    currentTurnId,
    bet,
    currencyLabel,
    extraLines
}) {
    const dealerVisibleTotal = hideDealerCard ? "?" : getHandTotal(dealerHand);

    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail("attachment://blox.png")
        .setDescription(
            `**${host.username} + ${opponent ? opponent.username : "Waiting..."} vs Dealer**\n\n` +
            `Bet: **${bet.toLocaleString()} ${currencyLabel}** each\n` +
            `Pot: **${(bet * 2).toLocaleString()} ${currencyLabel}**\n` +
            `Profit Tax: **${Math.round(PROFIT_TAX_RATE * 100)}%**\n` +
            `Theme: **Neon blue and purple**\n` +
            `${currentTurnId ? `Current Turn: <@${currentTurnId}>\n\n` : "\n"}` +
            `Dealer (${dealerVisibleTotal}):\n${formatHand(dealerHand, hideDealerCard)}\n` +
            `${host.username} (${getHandTotal(hostHand)}):\n${formatHand(hostHand)}\n` +
            `${opponent ? `${opponent.username} (${getHandTotal(opponentHand)}):\n${formatHand(opponentHand)}\n\n` : "\n"}` +
            extraLines.join("\n")
        )
        .setFooter({
            text: "BBLOX | Neon Table",
            iconURL: "attachment://blox.png"
        })
        .setTimestamp();
}

function buildLobbyButtons(hostId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`blackjack_join_${hostId}`)
                .setLabel("Join Blackjack")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`blackjack_cancel_${hostId}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function buildTurnButtons(hostId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`blackjack_hit_${hostId}`)
                .setLabel("Hit")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`blackjack_stand_${hostId}`)
                .setLabel("Stand")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        )
    ];
}

function pickWinner(players, dealerTotal) {
    const eligible = players
        .filter((player) => !player.busted)
        .filter((player) => dealerTotal > 21 || player.total > dealerTotal);

    if (eligible.length === 0) {
        return { type: "dealer" };
    }

    eligible.sort((left, right) => right.total - left.total);

    if (eligible.length > 1 && eligible[0].total === eligible[1].total) {
        return { type: "push", players: [eligible[0], eligible[1]] };
    }

    return { type: "player", player: eligible[0] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blackjack")
        .setDescription("Start a two-player blackjack game versus the dealer")
        .addIntegerOption((option) =>
            option
                .setName("bet")
                .setDescription("Amount each player bets")
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
        let dealerHand = [];
        let hostHand = [];
        let opponentHand = [];
        let currentTurnId = null;
        let hostStanding = false;
        let opponentStanding = false;
        let resolved = false;

        const msg = await interaction.reply({
            embeds: [
                buildTableEmbed({
                    title: "BBLOX Blackjack",
                    color: 0x7a00ff,
                    host,
                    opponent: null,
                    dealerHand: [{ value: "?", suit: "" }],
                    hostHand: [],
                    opponentHand: [],
                    hideDealerCard: false,
                    currentTurnId: null,
                    bet,
                    currencyLabel,
                    extraLines: [
                        "Waiting for a second player...",
                        "Two players face the dealer. The best player who beats the dealer takes the pot."
                    ]
                })
            ],
            components: buildLobbyButtons(host.id),
            files: [buildImage()],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ time: 180000 });

        async function finishGame(finalReason = null) {
            if (resolved) {
                return;
            }

            resolved = true;
            collector.stop(finalReason ?? "resolved");

            while (getHandTotal(dealerHand) < 17) {
                dealerHand.push(drawCard(deck));
            }

            const hostTotal = getHandTotal(hostHand);
            const opponentTotal = getHandTotal(opponentHand);
            const dealerTotal = getHandTotal(dealerHand);
            const outcome = pickWinner(
                [
                    { user: host, hand: hostHand, total: hostTotal, busted: hostTotal > 21 },
                    { user: opponent, hand: opponentHand, total: opponentTotal, busted: opponentTotal > 21 }
                ],
                dealerTotal
            );

            if (outcome.type === "player") {
                const winner = outcome.player.user;
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

                await msg.edit({
                    embeds: [
                        buildTableEmbed({
                            title: "BBLOX Blackjack Result",
                            color: 0x00c3ff,
                            host,
                            opponent,
                            dealerHand,
                            hostHand,
                            opponentHand,
                            hideDealerCard: false,
                            currentTurnId: null,
                            bet,
                            currencyLabel,
                            extraLines: [
                                `Dealer total: **${dealerTotal}**`,
                                `Winner: **${winner.username}**`,
                                `Pot Claimed: **${(bet * 2).toLocaleString()} ${currencyLabel}**`,
                                `Net Profit Won: **${payout.netProfit.toLocaleString()} ${currencyLabel}**`,
                                `Tax Taken: **${payout.tax.toLocaleString()} ${currencyLabel}**`
                            ]
                        })
                    ],
                    components: buildTurnButtons(host.id, true),
                    files: [buildImage()]
                });

                return;
            }

            if (outcome.type === "push") {
                await msg.edit({
                    embeds: [
                        buildTableEmbed({
                            title: "BBLOX Blackjack Result",
                            color: 0x5865f2,
                            host,
                            opponent,
                            dealerHand,
                            hostHand,
                            opponentHand,
                            hideDealerCard: false,
                            currentTurnId: null,
                            bet,
                            currencyLabel,
                            extraLines: [
                                `Dealer total: **${dealerTotal}**`,
                                `Tie between **${outcome.players[0].user.username}** and **${outcome.players[1].user.username}**.`,
                                "Round pushed. No balances changed."
                            ]
                        })
                    ],
                    components: buildTurnButtons(host.id, true),
                    files: [buildImage()]
                });

                return;
            }

            const hostFinalData = getUser(client, host.id);
            const opponentFinalData = getUser(client, opponent.id);

            hostFinalData.currencies[currency] = Math.max(0, getBalance(hostFinalData, currency) - bet);
            opponentFinalData.currencies[currency] = Math.max(0, getBalance(opponentFinalData, currency) - bet);
            hostFinalData.wagered += bet;
            opponentFinalData.wagered += bet;
            hostFinalData.profit -= bet;
            opponentFinalData.profit -= bet;
            saveEconomy(client);

            await msg.edit({
                embeds: [
                    buildTableEmbed({
                        title: "BBLOX Blackjack Result",
                        color: 0xff3366,
                        host,
                        opponent,
                        dealerHand,
                        hostHand,
                        opponentHand,
                        hideDealerCard: false,
                        currentTurnId: null,
                        bet,
                        currencyLabel,
                        extraLines: [
                            `Dealer total: **${dealerTotal}**`,
                            "Dealer wins the table.",
                            `Both players lost **${bet.toLocaleString()} ${currencyLabel}**.`
                        ]
                    })
                ],
                components: buildTurnButtons(host.id, true),
                files: [buildImage()]
            });
        }

        collector.on("collect", async (btn) => {
            if (btn.customId === `blackjack_cancel_${host.id}`) {
                if (btn.user.id !== host.id) {
                    return btn.reply({ content: "Only the host can cancel.", ephemeral: true });
                }

                collector.stop("cancelled");
                return btn.update({
                    content: "Blackjack cancelled.",
                    embeds: [],
                    components: [],
                    files: []
                });
            }

            if (btn.customId === `blackjack_join_${host.id}`) {
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
                        content: `You do not have enough ${currencyLabel.toLowerCase()} to join this blackjack game.`,
                        ephemeral: true
                    });
                }

                deck = createDeck();
                dealerHand = [drawCard(deck), drawCard(deck)];
                hostHand = [drawCard(deck), drawCard(deck)];
                opponentHand = [drawCard(deck), drawCard(deck)];
                currentTurnId = host.id;
                hostStanding = false;
                opponentStanding = false;

                return btn.update({
                    embeds: [
                        buildTableEmbed({
                            title: "BBLOX Blackjack",
                            color: 0x7a00ff,
                            host,
                            opponent,
                            dealerHand,
                            hostHand,
                            opponentHand,
                            hideDealerCard: true,
                            currentTurnId,
                            bet,
                            currencyLabel,
                            extraLines: [
                                `<@${host.id}> acts first.`,
                                "Use Hit or Stand. After both players finish, the dealer plays."
                            ]
                        })
                    ],
                    components: buildTurnButtons(host.id),
                    files: [buildImage()]
                });
            }

            if (
                btn.customId !== `blackjack_hit_${host.id}` &&
                btn.customId !== `blackjack_stand_${host.id}`
            ) {
                return;
            }

            if (!opponent || !deck || resolved) {
                return btn.reply({ content: "This game is not ready yet.", ephemeral: true });
            }

            if (btn.user.id !== host.id && btn.user.id !== opponent.id) {
                return btn.reply({ content: "You are not part of this game.", ephemeral: true });
            }

            if (btn.user.id !== currentTurnId) {
                return btn.reply({ content: "It is not your turn.", ephemeral: true });
            }

            const actingOnHost = btn.user.id === host.id;
            const hand = actingOnHost ? hostHand : opponentHand;

            if (btn.customId === `blackjack_hit_${host.id}`) {
                hand.push(drawCard(deck));

                if (getHandTotal(hand) > 21) {
                    if (actingOnHost) {
                        hostStanding = true;
                        currentTurnId = opponent.id;
                    } else {
                        opponentStanding = true;
                        currentTurnId = null;
                    }

                    await btn.update({
                        embeds: [
                            buildTableEmbed({
                                title: "BBLOX Blackjack",
                                color: 0x5865f2,
                                host,
                                opponent,
                                dealerHand,
                                hostHand,
                                opponentHand,
                                hideDealerCard: true,
                                currentTurnId,
                                bet,
                                currencyLabel,
                                extraLines: [
                                    `**${btn.user.username}** busted.`,
                                    currentTurnId
                                        ? `It is now <@${currentTurnId}>'s turn.`
                                        : "Both player turns are complete. Dealer is playing..."
                                ]
                            })
                        ],
                        components: buildTurnButtons(host.id, !currentTurnId),
                        files: [buildImage()]
                    });

                    if (!currentTurnId || (hostStanding && opponentStanding)) {
                        await finishGame();
                    }

                    return;
                }

                return btn.update({
                    embeds: [
                        buildTableEmbed({
                            title: "BBLOX Blackjack",
                            color: 0x5865f2,
                            host,
                            opponent,
                            dealerHand,
                            hostHand,
                            opponentHand,
                            hideDealerCard: true,
                            currentTurnId,
                            bet,
                            currencyLabel,
                            extraLines: [
                                `**${btn.user.username}** hit and is still in.`,
                                "Choose your next move."
                            ]
                        })
                    ],
                    components: buildTurnButtons(host.id),
                    files: [buildImage()]
                });
            }

            if (actingOnHost) {
                hostStanding = true;
                currentTurnId = opponent.id;
            } else {
                opponentStanding = true;
                currentTurnId = null;
            }

            await btn.update({
                embeds: [
                    buildTableEmbed({
                        title: "BBLOX Blackjack",
                        color: 0x5865f2,
                        host,
                        opponent,
                        dealerHand,
                        hostHand,
                        opponentHand,
                        hideDealerCard: true,
                        currentTurnId,
                        bet,
                        currencyLabel,
                        extraLines: [
                            `**${btn.user.username}** stands.`,
                            currentTurnId
                                ? `It is now <@${currentTurnId}>'s turn.`
                                : "Both player turns are complete. Dealer is playing..."
                        ]
                    })
                ],
                components: buildTurnButtons(host.id, !currentTurnId),
                files: [buildImage()]
            });

            if (!currentTurnId || (hostStanding && opponentStanding)) {
                await finishGame();
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "time") {
                return;
            }

            await msg.edit({
                content: "Blackjack expired.",
                components: []
            }).catch(() => {});
        });
    }
};
