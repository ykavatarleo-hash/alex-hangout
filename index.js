// ===== BASIC SETUP =====
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
  TextInputStyle,
  SlashCommandBuilder,
  MessageFlags
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== CONFIG =====
const GENERAL_ROLE = "1453942545691447366";
const STAFF_ROLE = "1453942664830521376";
const ADMIN_ROLE = "1453942621520138360";

const CAT_GENERAL = "1453972934946459769";
const CAT_STAFF = "1477641183810556099";
const CAT_LEADER = "1477640903488438357";

const PANEL_CHANNEL = "1453944972477862136";
const STAFF_PANEL_CHANNEL = "1453949648082567278";
const TRANSCRIPT_CHANNEL = "1453974468547444819";
const WELCOME_CHANNEL = "1453945503434936512";
const LOG_CHANNEL = "1475224763327582309";

const SUPPORT_IMAGE = "https://cdn.discordapp.com/attachments/1453949932841992325/1490316347748647002/Copy_of_Solani_Banners_-_WelcomeBanner.png";

let ticketCount = 0;
let autoPingChannelId = null;
const giveaways = new Map();

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Send ticket panel"),
    new SlashCommandBuilder().setName("staffpanel").setDescription("Send staff panel"),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("remind")
      .setDescription("Reminder")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("autoping")
      .setDescription("Set auto ping channel")
      .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")
      .addSubcommand(sub =>
        sub.setName("start")
          .setDescription("Start giveaway")
          .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
          .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
          .addStringOption(o => o.setName("duration").setDescription("1mi / 1h / 1d").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("reroll")
          .setDescription("Reroll giveaway")
          .addStringOption(o => o.setName("messageid").setDescription("Message ID").setRequired(true))
      )
  ];

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands ready");
});

// ===== DURATION FIX =====
function parseTime(input) {
  const match = input.match(/(\d+)(mi|h|d|mo)/);
  if (!match) return null;

  const num = Number(match[1]);
  const unit = match[2];

  if (unit === "mi") return num * 60000;
  if (unit === "h") return num * 3600000;
  if (unit === "d") return num * 86400000;
  if (unit === "mo") return num * 2592000000;
}

// ===== MOD SYSTEM WITH DM =====
async function punish(interaction, type, user, reason) {
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (member) {
    await member.send(
      `You have been **${type}** in **${interaction.guild.name}**\nReason: ${reason}`
    ).catch(() => {});
  }

  if (type === "banned") {
    await interaction.guild.members.ban(user.id, { reason }).catch(() => {});
  }

  const log = await client.channels.fetch(LOG_CHANNEL);
  log.send({
    embeds: [
      new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle(`User ${type}`)
        .setDescription(`${user} | ${reason}`)
    ]
  });

  interaction.reply({ content: `✅ ${type}`, flags: MessageFlags.Ephemeral });
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {

  // ===== COMMANDS =====
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "ticketpanel") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select ticket")
        .addOptions([
          { label: "General", value: "general" },
          { label: "Staff", value: "staff" }
        ]);

      const ch = await client.channels.fetch(PANEL_CHANNEL);
      ch.send({
        embeds: [new EmbedBuilder().setColor("#8B8C92").setDescription("Open ticket")],
        components: [new ActionRowBuilder().addComponents(menu)]
      });

      return interaction.reply({ content: "Sent", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "staffpanel") {
      const ch = await client.channels.fetch(STAFF_PANEL_CHANNEL);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("promo").setLabel("Promote").setStyle(3),
        new ButtonBuilder().setCustomId("demo").setLabel("Demote").setStyle(4),
        new ButtonBuilder().setCustomId("warnbtn").setLabel("Warn").setStyle(2),
        new ButtonBuilder().setCustomId("remindbtn").setLabel("Remind").setStyle(2),
        new ButtonBuilder().setCustomId("banbtn").setLabel("Ban").setStyle(4)
      );

      ch.send({ embeds: [new EmbedBuilder().setTitle("Staff Panel")], components: [row] });

      return interaction.reply({ content: "Sent", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "warn")
      return punish(interaction, "warned", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "remind")
      return punish(interaction, "reminded", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "ban")
      return punish(interaction, "banned", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "autoping") {
      autoPingChannelId = interaction.options.getChannel("channel").id;
      return interaction.reply({ content: "Auto ping set", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "giveaway") {
      const sub = interaction.options.getSubcommand();

      if (sub === "start") {
        const ch = interaction.options.getChannel("channel");
        const prize = interaction.options.getString("prize");
        const duration = parseTime(interaction.options.getString("duration"));

        const msg = await ch.send(`🎉 **${prize}**\nReact 🎉`);

        msg.react("🎉");

        setTimeout(async () => {
          const fetched = await msg.fetch();
          const users = await fetched.reactions.cache.get("🎉").users.fetch();
          const winner = users.filter(u => !u.bot).random();
          ch.send(`Winner: ${winner}`);
        }, duration);

        return interaction.reply({ content: "Started", flags: MessageFlags.Ephemeral });
      }
    }
  }

  // ===== TICKET =====
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const ch = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText
    });

    interaction.reply({ content: `Created ${ch}`, flags: MessageFlags.Ephemeral });
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    if (interaction.customId === "warnbtn")
      return interaction.showModal(
        new ModalBuilder().setCustomId("warnmodal").setTitle("Warn")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user").setLabel("User ID").setStyle(1)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(2))
          )
      );

    if (interaction.customId === "remindbtn")
      return interaction.showModal(
        new ModalBuilder().setCustomId("remindmodal").setTitle("Remind")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user").setLabel("User ID").setStyle(1)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(2))
          )
      );

    if (interaction.customId === "banbtn")
      return interaction.showModal(
        new ModalBuilder().setCustomId("banmodal").setTitle("Ban")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user").setLabel("User ID").setStyle(1)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(2))
          )
      );
  }

  // ===== MODALS =====
  if (interaction.isModalSubmit()) {
    const user = await client.users.fetch(interaction.fields.getTextInputValue("user"));
    const reason = interaction.fields.getTextInputValue("reason");

    if (interaction.customId === "warnmodal") return punish(interaction, "warned", user, reason);
    if (interaction.customId === "remindmodal") return punish(interaction, "reminded", user, reason);
    if (interaction.customId === "banmodal") return punish(interaction, "banned", user, reason);
  }
});

// ===== AUTO PING =====
client.on("guildMemberAdd", member => {
  if (autoPingChannelId) {
    const ch = member.guild.channels.cache.get(autoPingChannelId);
    if (ch) ch.send(`${member} check out this giveaway!`);
  }
});

client.login(TOKEN);
