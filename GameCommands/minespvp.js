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
const GRID_SIZE = 5;
const BOMB_TOTAL = 1;
const HIDDEN_EMOJI = "🟦";
const SAFE_EMOJI = "🟪";
const BOMB_EMOJI = "💣";
const CURRENCY_LABELS = {
    dollars: "Dollars",
    robux: "Robux"
};

function buildImage() {
    return new AttachmentBuilder(BLOX_IMAGE, { name: "blox.png" });
}

function createBoard() {
    const board = Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({
            bomb: false,
            revealed: false
        }))
    );

    let placed = 0;

    while (placed < BOMB_TOTAL) {
        const y = Math.floor(Math.random() * GRID_SIZE);
        const x = Math.floor(Math.random() * GRID_SIZE);

        if (board[y][x].bomb) {
            continue;
        }

        board[y][x].bomb = true;
        placed += 1;
    }

    return board;
}

function buildBoardRows(board, hostId, disabled = false) {
    const rows = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
        const row = new ActionRowBuilder();

        for (let x = 0; x < GRID_SIZE; x += 1) {
            const tile = board[y][x];

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`minespvp_tile_${hostId}_${y}_${x}`)
                    .setLabel(tile.revealed ? (tile.bomb ? BOMB_EMOJI : SAFE_EMOJI) : HIDDEN_EMOJI)
                    .setStyle(tile.revealed ? (tile.bomb ? ButtonStyle.Danger : ButtonStyle.Secondary) : ButtonStyle.Primary)
                    .setDisabled(disabled || tile.revealed)
            );
        }

        rows.push(row);
    }

    return rows;
}

function buildGameEmbed({
    title,
    color,
    host,
    opponent,
    bet,
    currencyLabel,
    currentPlayerId,
    extraLines
}) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setThumbnail("attachment://blox.png")
        .setDescription(
            `**${host.username}${opponent ? ` vs ${opponent.username}` : ""}**\n\n` +
            `Bet: **${bet.toLocaleString()} ${currencyLabel}** each\n` +
            `Profit Tax: **${Math.round(PROFIT_TAX_RATE * 100)}%**\n` +
            `Theme: **Neon blue and purple**\n` +
            `${currentPlayerId ? `Current Turn: <@${currentPlayerId}>\n\n` : "\n"}` +
            extraLines.join("\n")
        )
        .setFooter({
            text: "BBLOX | Neon Stakes",
            iconURL: "attachment://blox.png"
        })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("minespvp")
        .setDescription("Start a PvP mines game")
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

        const lobbyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`minespvp_join_${host.id}`)
                .setLabel("Join Mines")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`minespvp_cancel_${host.id}`)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({
            embeds: [
                buildGameEmbed({
                    title: "BBLOX Mines PvP",
                    color: 0x7a00ff,
                    host,
                    opponent: null,
                    bet,
                    currencyLabel,
                    currentPlayerId: null,
                    extraLines: [
                        "Waiting for an opponent...",
                        "First player to reveal the bomb loses."
                    ]
                })
            ],
            components: [lobbyRow],
            files: [buildImage()],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        let opponent = null;
        let board = null;
        let currentPlayer = host;
        let resolved = false;

        collector.on("collect", async (btn) => {
            if (btn.customId === `minespvp_cancel_${host.id}`) {
                if (btn.user.id !== host.id) {
                    return btn.reply({ content: "Only the host can cancel.", ephemeral: true });
                }

                collector.stop("cancelled");
                return btn.update({
                    content: "Mines PvP cancelled.",
                    embeds: [],
                    components: [],
                    files: []
                });
            }

            if (btn.customId === `minespvp_join_${host.id}`) {
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
                        content: `You do not have enough ${currencyLabel.toLowerCase()} to join this mines game.`,
                        ephemeral: true
                    });
                }

                board = createBoard();
                currentPlayer = host;

                return btn.update({
                    embeds: [
                        buildGameEmbed({
                            title: "BBLOX Mines PvP",
                            color: 0x7a00ff,
                            host,
                            opponent,
                            bet,
                            currencyLabel,
                            currentPlayerId: currentPlayer.id,
                            extraLines: [
                                `<@${host.id}> goes first.`,
                                "Pick one tile per turn. Safe tiles glow purple."
                            ]
                        })
                    ],
                    components: buildBoardRows(board, host.id),
                    files: [buildImage()]
                });
            }

            if (!btn.customId.startsWith(`minespvp_tile_${host.id}_`)) {
                return;
            }

            if (!opponent || !board || resolved) {
                return btn.reply({ content: "This game is not ready yet.", ephemeral: true });
            }

            if (btn.user.id !== host.id && btn.user.id !== opponent.id) {
                return btn.reply({ content: "You are not in this game.", ephemeral: true });
            }

            if (btn.user.id !== currentPlayer.id) {
                return btn.reply({ content: "It is not your turn.", ephemeral: true });
            }

            const [, , , yString, xString] = btn.customId.split("_");
            const y = Number.parseInt(yString, 10);
            const x = Number.parseInt(xString, 10);
            const tile = board?.[y]?.[x];

            if (!tile || tile.revealed) {
                return btn.reply({ content: "That tile has already been revealed.", ephemeral: true });
            }

            tile.revealed = true;

            if (tile.bomb) {
                resolved = true;
                collector.stop("resolved");

                const loser = btn.user;
                const winner = loser.id === host.id ? opponent : host;
                const winnerData = getUser(client, winner.id);
                const loserData = getUser(client, loser.id);
                const payout = settlePvpBet({
                    winnerData,
                    loserData,
                    currency,
                    bet
                });

                saveEconomy(client);

                return btn.update({
                    embeds: [
                        buildGameEmbed({
                            title: "BBLOX Mines PvP Result",
                            color: 0x00c3ff,
                            host,
                            opponent,
                            bet,
                            currencyLabel,
                            currentPlayerId: null,
                            extraLines: [
                                `Bomb hit by: **${loser.username}**`,
                                `Winner: **${winner.username}**`,
                                `Net Profit Won: **${payout.netProfit.toLocaleString()} ${currencyLabel}**`,
                                `Tax Taken: **${payout.tax.toLocaleString()} ${currencyLabel}**`
                            ]
                        })
                    ],
                    components: buildBoardRows(board, host.id, true),
                    files: [buildImage()]
                });
            }

            currentPlayer = currentPlayer.id === host.id ? opponent : host;

            return btn.update({
                embeds: [
                    buildGameEmbed({
                        title: "BBLOX Mines PvP",
                        color: 0x5865f2,
                        host,
                        opponent,
                        bet,
                        currencyLabel,
                        currentPlayerId: currentPlayer.id,
                        extraLines: [
                            `Safe pick by **${btn.user.username}**.`,
                            `It is now <@${currentPlayer.id}>'s turn.`
                        ]
                    })
                ],
                components: buildBoardRows(board, host.id),
                files: [buildImage()]
            });
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "time") {
                return;
            }

            await msg.edit({
                content: "Mines PvP expired.",
                components: []
            }).catch(() => {});
        });
    }
};
