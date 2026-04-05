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
  ChannelType,
  REST,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  MessageFlags
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const HEX = "#8B8C92";

const CAT_GENERAL = "1453972934946459769";
const CAT_STAFF = "1477641183810556099";

const PANEL_CHANNEL = "1453944972477862136";
const LOG_CHANNEL = "1475224763327582309";

let autoPingChannelId = null;

// ===== TIME PARSER =====
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

// ===== READY =====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")
      .addSubcommand(sub =>
        sub.setName("start")
          .setDescription("Start giveaway")
          .addChannelOption(o =>
            o.setName("channel")
              .setDescription("Giveaway channel")
              .setRequired(true)
          )
          .addStringOption(o =>
            o.setName("prize")
              .setDescription("Prize")
              .setRequired(true)
          )
          .addStringOption(o =>
            o.setName("duration")
              .setDescription("1mi / 1h / 1d")
              .setRequired(true)
          )
      )
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      "1479902342395596941",
      "1453937653539147820"
    ),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Slash commands loaded");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {

    // ===== TICKET PANEL =====
    if (interaction.commandName === "ticketpanel") {
      const channel = await client.channels.fetch(PANEL_CHANNEL);

      const oldMessages = await channel.messages.fetch({ limit: 10 });
      const oldPanel = oldMessages.find(
        msg =>
          msg.author.id === client.user.id &&
          msg.components.length > 0
      );

      if (oldPanel) await oldPanel.delete().catch(() => {});

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select ticket type")
        .addOptions([
          {
            label: "General Support",
            description: "General help ticket",
            value: "general"
          },
          {
            label: "Staff Support",
            description: "Staff help ticket",
            value: "staff"
          }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const embed = new EmbedBuilder()
        .setColor(HEX)
        .setTitle("Support Tickets")
        .setDescription("Choose a ticket type below.");

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: "✅ Ticket panel sent",
        flags: MessageFlags.Ephemeral
      });
    }

    // ===== GIVEAWAY START =====
    if (
      interaction.commandName === "giveaway" &&
      interaction.options.getSubcommand() === "start"
    ) {
      const channel = interaction.options.getChannel("channel");
      const prize = interaction.options.getString("prize");
      const durationInput =
        interaction.options.getString("duration");

      const duration = parseTime(durationInput);

      if (!duration) {
        return interaction.reply({
          content: "❌ Invalid duration",
          flags: MessageFlags.Ephemeral
        });
      }

      const endTime = Date.now() + duration;
      const unix = Math.floor(endTime / 1000);

      let entries = new Set();

      const embed = new EmbedBuilder()
        .setColor(HEX)
        .setDescription(
          `# ${prize}\n` +
          `Ends: <t:${unix}:R> (<t:${unix}:F>)\n` +
          `Hosted by: ${interaction.user}\n` +
          `Entries: **0**\n` +
          `Winners: **1**`
        )
        .setFooter({
          text: new Date(endTime).toLocaleDateString()
        });

      const button = new ButtonBuilder()
        .setCustomId("giveaway_join")
        .setEmoji("🎉")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      const msg = await channel.send({
        embeds: [embed],
        components: [row]
      });

      const collector =
        msg.createMessageComponentCollector({
          time: duration
        });

      collector.on("collect", async i => {
        if (entries.has(i.user.id)) {
          return i.reply({
            content: "❌ Already entered",
            flags: MessageFlags.Ephemeral
          });
        }

        entries.add(i.user.id);

        const updated = new EmbedBuilder()
          .setColor(HEX)
          .setDescription(
            `# ${prize}\n` +
            `Ends: <t:${unix}:R> (<t:${unix}:F>)\n` +
            `Hosted by: ${interaction.user}\n` +
            `Entries: **${entries.size}**\n` +
            `Winners: **1**`
          )
          .setFooter({
            text: new Date(endTime).toLocaleDateString()
          });

        await msg.edit({
          embeds: [updated],
          components: [row]
        });

        await i.reply({
          content: "🎉 Entered giveaway!",
          flags: MessageFlags.Ephemeral
        });
      });

      collector.on("end", async () => {
        const disabledRow =
          new ActionRowBuilder().addComponents(
            ButtonBuilder.from(button).setDisabled(true)
          );

        await msg.edit({
          components: [disabledRow]
        });

        const winners = [...entries];

        if (!winners.length) {
          return channel.send("❌ No entries");
        }

        const winner =
          winners[Math.floor(Math.random() * winners.length)];

        channel.send(`🎉 Winner: <@${winner}>`);
      });

      return interaction.reply({
        content: "✅ Giveaway started",
        flags: MessageFlags.Ephemeral
      });
    }
  }

  // ===== TICKET CREATION =====
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket_select"
  ) {
    const selected = interaction.values[0];

    const category =
      selected === "staff"
        ? CAT_STAFF
        : CAT_GENERAL;

    const channel =
      await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category
      });

    const embed = new EmbedBuilder()
      .setColor(HEX)
      .setTitle("Ticket Opened")
      .setDescription(
        `Hello ${interaction.user}, support will assist you soon.`
      );

    await channel.send({
      content: `${interaction.user}`,
      embeds: [embed]
    });

    return interaction.reply({
      content: `✅ Created ${channel}`,
      flags: MessageFlags.Ephemeral
    });
  }
});

// ===== MEMBER JOIN =====
client.on("guildMemberAdd", member => {
  if (!autoPingChannelId) return;

  const channel =
    member.guild.channels.cache.get(autoPingChannelId);

  if (channel) {
    channel.send(`${member} check out the giveaway 🎉`);
  }
});

client.login(TOKEN);
