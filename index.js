const TOKEN = process.env.TOKEN;
if (!TOKEN) console.error("❌ TOKEN NOT FOUND");

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
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const STAFF_ROLE = "1453942664830521376";
const ADMIN_ROLE = "1453942621520138360";

const PANEL_CHANNEL = "1453944972477862136";
const LOG_CHANNEL = "1475224763327582309";
const WELCOME_CHANNEL = "1453945503434936512";

let autoPingChannel = null;

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    {
      body: [
        { name: "ticketpanel", description: "Send ticket panel" },
        { name: "staffpanel", description: "Send staff panel" }
      ]
    }
  );

  console.log("✅ Bot ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== SLASH =====
  if (interaction.isChatInputCommand()) {

    // ===== STAFF PANEL =====
    if (interaction.commandName === "staffpanel") {

      const embed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle("Staff Manager")
        .setDescription("Manage staff & moderation");

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("promo").setLabel("Staff Promo").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("demo").setLabel("Staff Demo").setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("warn").setLabel("Warn").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("remind").setLabel("Reminder").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ban").setLabel("Ban").setStyle(ButtonStyle.Danger)
      );

      const channel = await client.channels.fetch(PANEL_CHANNEL);
      await channel.send({ embeds: [embed], components: [row1, row2] });

      return interaction.reply({ content: "✅ Staff panel sent", ephemeral: true });
    }

    // ===== KEEP YOUR TICKET PANEL =====
    if (interaction.commandName === "ticketpanel") {
      return interaction.reply({ content: "Use your existing panel", ephemeral: true });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("Action");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
      )
    );

    return interaction.showModal(modal);
  }

  // ===== MODALS =====
  if (interaction.isModalSubmit()) {

    const userId = interaction.fields.getTextInputValue("user");
    const reason = interaction.fields.getTextInputValue("reason");

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    const logChannel = await client.channels.fetch(LOG_CHANNEL);

    const embed = new EmbedBuilder()
      .setColor("#8B8C92")
      .setDescription(`User: <@${userId}>\nReason: ${reason}\nBy: ${interaction.user}`);

    // ===== PROMOTE =====
    if (interaction.customId === "promo") {
      if (member) await member.roles.add(STAFF_ROLE);
      embed.setTitle("Promoted");
    }

    // ===== DEMOTE =====
    if (interaction.customId === "demo") {
      if (member) await member.roles.remove(STAFF_ROLE);
      embed.setTitle("Demoted");
    }

    // ===== WARN =====
    if (interaction.customId === "warn") {
      embed.setTitle("Warned");
    }

    // ===== REMINDER =====
    if (interaction.customId === "remind") {
      embed.setTitle("Reminder Sent");
      if (member) member.send(`Reminder: ${reason}`).catch(() => {});
    }

    // ===== BAN =====
    if (interaction.customId === "ban") {
      if (member) await member.ban({ reason });
      embed.setTitle("Banned");
    }

    await logChannel.send({ embeds: [embed] });

    return interaction.reply({ content: "✅ Done", ephemeral: true });
  }
});

// ===== AUTO PING =====
client.on("guildMemberAdd", async (member) => {

  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (welcomeChannel) {
    welcomeChannel.send(`Welcome ${member}!`);
  }

  if (autoPingChannel) {
    const ch = member.guild.channels.cache.get(autoPingChannel);
    if (ch) ch.send(`${member} check out this giveaway!`);
  }
});

client.login(TOKEN);
