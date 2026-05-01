const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { loadEconomy } = require("./utils/economy");
const handleInteraction = require("./handlers/interactionHandler");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const folders = ["EconomyCommands", "GameCommands", "CommandsModeration", "CommandsOther"];

for (const folder of folders) {
    const folderPath = path.join(__dirname, folder);

    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter((file) => file.endsWith(".js"));

    for (const file of files) {
        const command = require(path.join(folderPath, file));

        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
        }
    }
}

console.log(`Loaded ${client.commands.size} commands`);

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    loadEconomy(client);
    console.log("Economy loaded");
});

client.on("interactionCreate", (interaction) => handleInteraction(interaction, client));

client.login(process.env.DISCORD_TOKEN);
