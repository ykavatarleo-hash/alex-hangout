const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("❌ TOKEN NOT FOUND");
}
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// CONFIG
const STAFF_ROLES = [
  "1453942545691447366",
  "1453942664830521376",
  "1453942621520138360"
];

const CATEGORY_ID = "1453972934946459769";
const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136";

let ticketCount = 0;

// READY
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // STATUS
  client.user.setPresence({
    activities: [{ name: "Tickets & Support", type: 3 }],
    status: "online"
  });

  // COMMAND
  const commands = [
    {
      name: "ticketpanel",
      description: "Send the ticket panel"
    }
  ];

 const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
      { body: commands }
    );
    console.log("✅ Commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// INTERACTIONS
client.on("interactionCreate", async (interaction) => {

  // SLASH COMMAND
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {

      const embed1 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546178159837335/Copy_of_Solani_Banners_-_WelcomeBanner.png");

      const embed2 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546181280530482/36733093-BE93-4153-8809-B6A8D507D066.png")
        .setDescription("Please use the dropdown Menu below to select the appropriate ticket. If you require any help that you believe can be answered by everyone open a General Support ticket.");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select a ticket type")
        .addOptions([
          { label: "General Support", value: "general", emoji: "💼" },
          { label: "Staff Report", value: "staff", emoji: "📖" },
          { label: "Partnership", value: "partner", emoji: "🤝" },
          { label: "Leadership Support", value: "leader", emoji: "👑" },
          { label: "Sponsored Giveaway", value: "giveaway", emoji: "🎉" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const channel = await client.channels.fetch(PANEL_CHANNEL);

      await channel.send({
        embeds: [embed1, embed2],
        components: [row]
      });

      return interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
    }
  }

  // DROPDOWN
  if (interaction.isStringSelectMenu()) {

    ticketCount++;

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        ...STAFF_ROLES.map(role => ({
          id: role,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }))
      ]
    });

    // 🔥 RENAME TO USER + NUMBER
    await ticketChannel.setName(`${interaction.member.displayName}-${ticketCount}`);

    await interaction.reply({
      content: `✅ Your ticket has been created in ${ticketChannel}`,
      ephemeral: true
    });

    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 5000);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🙋‍♂️"),
      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );

    await ticketChannel.send({
      content: `<@&1453942545691447366> <@&1453942664830521376> <@&1453942621520138360>`,
      embeds: [
        new EmbedBuilder()
          .setDescription("hey! thank you for opening a ticket, please describe your question/inquiry here support will be with you shortly.")
          .setColor("#8B8C92")
      ],
      components: [buttons]
    });
  }

  // BUTTONS
  if (interaction.isButton()) {

    if (interaction.customId === "claim") {
      const hasRole = STAFF_ROLES.some(role =>
        interaction.member.roles.cache.has(role)
      );

      if (!hasRole) {
        return interaction.reply({
          content: "❌ Your not a staff member!",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ ${interaction.user} has claimed the ticket`
      });
    }

    if (interaction.customId === "close") {

      await interaction.reply({
        content: "closing ticket.. saving transcript"
      });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });

      let transcript = messages
        .map(m => `${m.author.tag}: ${m.content}`)
        .reverse()
        .join("\n");

      const fileName = `transcript-${interaction.channel.id}.txt`;
      fs.writeFileSync(fileName, transcript);

      const logChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL);

      await logChannel.send({
        content: `Transcript for ${interaction.channel.name}`,
        files: [fileName]
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 3000);
    }
  }

});

// WELCOME
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get("1453945503434936512");
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setTitle("Welcome to Alex's Hangout!")
    .setDescription(`${member} has joined the Alex's Hangout! You are our ${member.guild.memberCount}th member! We're so glad to have you here. Please be sure to check out our rules in <#1453944026444206161> and our most recent announcements in <#1453944617241149554>. If you'd like to receive notifications on giveaways, affiliates or events, be sure to react with the appropriate emoji!`)
    .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1490086476929699901/WelcomeBanner.png");

  channel.send({ embeds: [embed] });
});

client.login(TOKEN);
