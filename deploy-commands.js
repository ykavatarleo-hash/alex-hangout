const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "ticketpanel",
    description: "Send the ticket panel",
  },
];

const clientId = "1479902342395596941"; // your bot ID
const guildId = "1453937653539147820"; // your server ID

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands...");

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
