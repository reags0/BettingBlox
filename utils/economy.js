const fs = require("fs");
const path = require("path");

const ECONOMY_FILE = path.join(__dirname, "../economy.json");
const PROFIT_TAX_RATE = 0.1;

function defaultUser() {
    return {
        currencies: {
            dollars: 0,
            robux: 0
        },
        wagered: 0,
        profit: 0
    };
}

function normalizeUser(data = {}) {
    return {
        currencies: {
            dollars: data?.currencies?.dollars ?? data?.balance ?? 0,
            robux: data?.currencies?.robux ?? 0
        },
        wagered: data?.wagered ?? 0,
        profit: data?.profit ?? 0
    };
}

function loadEconomy(client) {
    if (!fs.existsSync(ECONOMY_FILE)) {
        fs.writeFileSync(ECONOMY_FILE, "{}");
    }

    const raw = JSON.parse(fs.readFileSync(ECONOMY_FILE, "utf8"));

    client.economy = new Map();

    for (const [id, data] of Object.entries(raw)) {
        client.economy.set(id, normalizeUser(data));
    }

    if (!client.economySaveInterval) {
        client.economySaveInterval = setInterval(() => saveEconomy(client), 10000);
    }
}

function saveEconomy(client) {
    if (!client.economy) return;

    const data = Object.fromEntries(client.economy);
    fs.writeFileSync(ECONOMY_FILE, JSON.stringify(data, null, 2));
}

function getUser(client, id) {
    if (!client.economy) {
        client.economy = new Map();
    }

    if (!client.economy.has(id)) {
        client.economy.set(id, defaultUser());
    }

    return client.economy.get(id);
}

function getBalance(data, currency) {
    return data.currencies[currency] ?? 0;
}

function changeBalance(data, currency, amount) {
    data.currencies[currency] = Math.max(0, getBalance(data, currency) + amount);
}

function calculateTaxedProfit(bet) {
    const grossProfit = Math.max(0, bet);
    const tax = Math.floor(grossProfit * PROFIT_TAX_RATE);
    const netProfit = grossProfit - tax;

    return {
        grossProfit,
        tax,
        netProfit
    };
}

function settlePvpBet({ winnerData, loserData, currency, bet }) {
    const payout = calculateTaxedProfit(bet);

    changeBalance(winnerData, currency, payout.netProfit);
    changeBalance(loserData, currency, -bet);

    winnerData.wagered += bet;
    loserData.wagered += bet;
    winnerData.profit += payout.netProfit;
    loserData.profit -= bet;

    return payout;
}

module.exports = {
    PROFIT_TAX_RATE,
    getBalance,
    changeBalance,
    calculateTaxedProfit,
    settlePvpBet,
    defaultUser,
    loadEconomy,
    normalizeUser,
    saveEconomy,
    getUser
};
