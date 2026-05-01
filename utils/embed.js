const { EmbedBuilder } = require("discord.js");

function createEmbed(options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color || 0x2b2d31)
        .setTimestamp();

    if (options.title) {
        embed.setTitle(options.title);
    }

    if (options.description) {
        embed.setDescription(options.description);
    }

    embed.setFooter({
        text: options.footer || "BettingBlox"
    });

    if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
    }

    return embed;
}

module.exports = { createEmbed };
