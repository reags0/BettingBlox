const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = "1499523893617102988";

async function sendLog(client, embed) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) return;
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.log("⚠️ Log failed:", err.message);
    }
}

module.exports = sendLog;