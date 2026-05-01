const { REST, Routes } = require("discord.js");
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const commands = [];
const commandFolders = ["EconomyCommands", "GameCommands", "CommandsModeration", "CommandsOther"];

for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, folder);

    if (!fs.existsSync(folderPath)) {
        continue;
    }

    const files = fs.readdirSync(folderPath).filter((file) => file.endsWith(".js"));

    for (const file of files) {
        const command = require(path.join(folderPath, file));

        if (command.data && command.execute) {
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Refreshing guild slash commands...");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(`Updated ${commands.length} slash commands.`);
    } catch (error) {
        console.error(error);
    }
})();
