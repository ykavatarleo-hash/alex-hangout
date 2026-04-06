// ===== IMPORTS =====
const TOKEN = process.env.TOKEN;

const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, PermissionsBitField,
  ChannelType, REST, Routes,
  SlashCommandBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");

const fs = require("fs");

// ===== CLIENT =====
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
const TRANSCRIPT_CHANNEL = "1453974468547444819";
const WELCOME_CHANNEL = "1453945503434936512";
const LOG_CHANNEL = "1475224763327582309";

const SUPPORT_IMAGE = "https://cdn.discordapp.com/attachments/1453949932841992325/1490316347748647002/Copy_of_Solani_Banners_-_WelcomeBanner.png";

let ticketCount = 0;
let autoPingChannel = null;
const giveaways = new Map();

// ===== TIME PARSER =====
function parseDuration(input) {
  const match = input.match(/(\d+)(mi|h|d|mo)/);
  if (!match) return null;

  const num = Number(match[1]);
  const unit = match[2];

  if (unit === "mi") return num * 60000;
  if (unit === "h") return num * 3600000;
  if (unit === "d") return num * 86400000;
  if (unit === "mo") return num * 2592000000;
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Send ticket panel"),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn user")
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
      .setDescription("Set auto ping")
      .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")
      .addSubcommand(sub =>
        sub.setName("start")
          .setDescription("Start giveaway")
          .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
          .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
          .addStringOption(o => o.setName("duration").setDescription("1mi / 1h / 1d / 1mo").setRequired(true))
          .addIntegerOption(o => o.setName("winners").setDescription("Winners").setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName("reroll")
          .setDescription("Reroll giveaway")
          .addStringOption(o => o.setName("link").setDescription("Message link").setRequired(true))
      )
  ];

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Bot Ready");
});

// ===== MOD SYSTEM =====
async function punish(interaction, type, user, reason) {
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (member) {
    await member.send(`You have been **${type}** in ${interaction.guild.name}\nReason: ${reason}`).catch(() => {});
  }

  if (type === "banned") {
    await interaction.guild.members.ban(user.id).catch(() => {});
  }

  const log = await client.channels.fetch(LOG_CHANNEL);
  log.send({
    embeds: [new EmbedBuilder().setColor("#8B8C92").setDescription(`${user} ${type}\n${reason}`)]
  });

  interaction.reply({ content: `✅ ${type}`, flags: MessageFlags.Ephemeral });
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {

  // ===== COMMANDS =====
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "ticketpanel") {

      const embed1 = new EmbedBuilder().setColor("#8B8C92").setImage(SUPPORT_IMAGE);

      const embed2 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setDescription("Please select a ticket type below.");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "General Support", value: "general", emoji: "💼" },
          { label: "Staff Report", value: "staff", emoji: "📖" },
          { label: "Partnerships", value: "partner", emoji: "🤝" },
          { label: "Leadership Support", value: "leader", emoji: "👑" },
          { label: "Sponsored Giveaway", value: "giveaway", emoji: "🎉" }
        ]);

      const ch = await client.channels.fetch(PANEL_CHANNEL);
      await ch.send({ embeds: [embed1, embed2], components: [new ActionRowBuilder().addComponents(menu)] });

      return interaction.reply({ content: "Panel sent", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "warn")
      return punish(interaction, "warned", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "remind")
      return punish(interaction, "reminded", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "ban")
      return punish(interaction, "banned", interaction.options.getUser("user"), interaction.options.getString("reason"));

    if (interaction.commandName === "autoping") {
      autoPingChannel = interaction.options.getChannel("channel").id;
      return interaction.reply({ content: "Auto ping set", flags: MessageFlags.Ephemeral });
    }

    // ===== GIVEAWAY =====
    if (interaction.commandName === "giveaway") {

      const sub = interaction.options.getSubcommand();

      if (sub === "start") {

        const channel = interaction.options.getChannel("channel");
        const prize = interaction.options.getString("prize");
        const duration = parseDuration(interaction.options.getString("duration"));
        const winnersCount = interaction.options.getInteger("winners");

        const endTime = Date.now() + duration;

        const embed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setTitle(`🎉 ${prize}`)
          .setDescription(
            `**Ends:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:F>)\n` +
            `**Hosted By:** ${interaction.user}\n` +
            `**Entries:** 0\n` +
            `**Winners:** ${winnersCount}`
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("giveaway_enter")
            .setEmoji("🎉")
            .setStyle(ButtonStyle.Secondary) // grey
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });

        giveaways.set(msg.id, {
          entries: new Set(),
          winnersCount,
          endTime
        });

        // LIVE TIMER
        const interval = setInterval(async () => {

          const data = giveaways.get(msg.id);
          if (!data) return clearInterval(interval);

          if (Date.now() >= data.endTime) {
            clearInterval(interval);

            const users = [...data.entries];
            const winners = users.sort(() => 0.5 - Math.random()).slice(0, data.winnersCount);

            return channel.send(`🎉 Winners: ${winners.map(id => `<@${id}>`).join(", ")}`);
          }

          const updatedEmbed = new EmbedBuilder()
            .setColor("#8B8C92")
            .setTitle(`🎉 ${prize}`)
            .setDescription(
              `**Ends:** <t:${Math.floor(data.endTime / 1000)}:R> (<t:${Math.floor(data.endTime / 1000)}:F>)\n` +
              `**Hosted By:** ${interaction.user}\n` +
              `**Entries:** ${data.entries.size}\n` +
              `**Winners:** ${data.winnersCount}`
            );

          await msg.edit({ embeds: [updatedEmbed] });

        }, 5000);

        return interaction.reply({ content: "Giveaway started", flags: MessageFlags.Ephemeral });
      }
    }
  }

  // ===== BUTTON =====
  if (interaction.isButton() && interaction.customId === "giveaway_enter") {

    const data = giveaways.get(interaction.message.id);
    if (!data) return;

    if (data.entries.has(interaction.user.id)) {
      return interaction.reply({
        content: "You have already entered this giveaway!",
        flags: MessageFlags.Ephemeral
      });
    }

    data.entries.add(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor("#8B8C92")
      .setTitle(interaction.message.embeds[0].title)
      .setDescription(
        interaction.message.embeds[0].description.replace(
          /Entries:\s\d+/,
          `Entries: ${data.entries.size}`
        )
      );

    await interaction.update({ embeds: [embed] });
  }
});

// ===== LOGIN =====
client.login(TOKEN);
