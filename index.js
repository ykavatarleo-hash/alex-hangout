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
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136";

let ticketCount = 0;

// READY
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // ✅ STATUS UPDATED
  client.user.setPresence({
    activities: [{ name: "Alex’s Hangout", type: 3 }],
    status: "online"
  });

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

// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {

  // =========================
  // SLASH COMMAND
  // =========================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {

      const embed1 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546178159837335/Copy_of_Solani_Banners_-_WelcomeBanner.png");

      const embed2 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546181280530482/36733093-BE93-4153-8809-B6A8D507D066.png")
        .setDescription("Please use the dropdown Menu below to select the appropriate ticket.");

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

  // =========================
  // DROPDOWN
  // =========================
  if (interaction.isStringSelectMenu()) {

    let category;
    let roles;
    let ping;

    if (interaction.values[0] === "general") {
      category = "1453972934946459769";
      roles = ["1453942545691447366"];
      ping = `<@&1453942545691447366>`;
    }

    if (interaction.values[0] === "staff" || interaction.values[0] === "partner") {
      category = "1477641183810556099";
      roles = ["1453942664830521376", "1453942621520138360"];
      ping = `<@&1453942621520138360> <@&1453942664830521376>`;
    }

    if (interaction.values[0] === "leader" || interaction.values[0] === "giveaway") {
      category = "1477640903488438357";
      roles = ["1453942621520138360"];
      ping = `<@&1453942664830521376>`;
    }

    ticketCount++;

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        ...roles.map(r => ({
          id: r,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }))
      ]
    });

    await interaction.reply({
      content: `✅ Your ticket has been created in ${ticketChannel}`,
      ephemeral: true
    });

    // =========================
    // GIVEAWAY MODAL
    // =========================
    if (interaction.values[0] === "giveaway") {

      const modal = new ModalBuilder()
        .setCustomId("giveaway_form")
        .setTitle("Sponsored Giveaway Form");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("prize").setLabel("What’s your prize?").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("announcement").setLabel("Giveaway announcement").setStyle(TextInputStyle.Paragraph)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("addons").setLabel("Add-ons").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("days").setLabel("How many days?").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("ping").setLabel("What ping?").setStyle(TextInputStyle.Short)
        )
      );

      await interaction.showModal(modal);
    }

    // BUTTONS
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
      content: ping,
      embeds: [
        new EmbedBuilder()
          .setDescription("hey! thank you for opening a ticket, please describe your issue.")
          .setColor("#8B8C92")
      ],
      components: [buttons]
    });
  }

  // =========================
  // MODAL SUBMIT
  // =========================
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "giveaway_form") {

      const embed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle("🎉 Sponsored Giveaway Details")
        .addFields(
          { name: "Prize", value: interaction.fields.getTextInputValue("prize") },
          { name: "Announcement", value: interaction.fields.getTextInputValue("announcement") },
          { name: "Add-ons", value: interaction.fields.getTextInputValue("addons") },
          { name: "Duration", value: interaction.fields.getTextInputValue("days") },
          { name: "Ping", value: interaction.fields.getTextInputValue("ping") }
        );

      await interaction.reply({ content: "✅ Submitted!", ephemeral: true });
      await interaction.channel.send({ embeds: [embed] });
    }
  }

  // =========================
  // BUTTONS
  // =========================
  if (interaction.isButton()) {

    if (interaction.customId === "claim") {
      const hasRole = STAFF_ROLES.some(role =>
        interaction.member.roles.cache.has(role)
      );

      if (!hasRole) {
        return interaction.reply({
          content: "❌ You're not staff!",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ ${interaction.user} claimed this ticket`
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
    .setDescription(`${member} has joined the Alex's Hangout! You are our ${member.guild.memberCount}th member!`)
    .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1490086476929699901/WelcomeBanner.png");

  channel.send({ embeds: [embed] });
});

client.login(TOKEN);
