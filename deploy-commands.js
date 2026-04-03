const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "ticketpanel",
    description: "Send the ticket panel"
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
      { body: commands }
    );

    console.log("Done!");
  } catch (err) {
    console.error(err);
  }
})();
