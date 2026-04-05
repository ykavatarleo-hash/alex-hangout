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
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const HEX = "#8B8C92";

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

let autoPingChannelId = null;
const giveaways = new Map();

// ===== HELPERS =====
function parseTime(input) {
  const match = input.match(/^(\d+)(mi|h|d|mo)$/i);
  if (!match) return null;

  const num = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "mi") return num * 60000;
  if (unit === "h") return num * 3600000;
  if (unit === "d") return num * 86400000;
  if (unit === "mo") return num * 2592000000;
  return null;
}

function canStaff(interaction) {
  const member = interaction.member;
  if (!member) return false;

  return (
    member.roles?.cache?.has(STAFF_ROLE) ||
    member.roles?.cache?.has(ADMIN_ROLE) ||
    member.permissions?.has(PermissionsBitField.Flags.Administrator)
  );
}

async function sendLog(title, description) {
  try {
    const log = await client.channels.fetch(LOG_CHANNEL);
    if (!log) return;

    await log.send({
      embeds: [
        new EmbedBuilder()
          .setColor(HEX)
          .setTitle(title)
          .setDescription(description)
      ]
    });
  } catch {}
}

async function punish(interaction, type, user, reason) {
  try {
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member) {
      await member.send(
        `You have been **${type}** in **${interaction.guild.name}**\nReason: ${reason}`
      ).catch(() => {});
    }

    if (type === "banned") {
      await interaction.guild.members.ban(user.id, { reason }).catch(() => {});
    }

    if (type === "kicked") {
      await member?.kick(reason).catch(() => {});
    }

    await sendLog(
      `User ${type}`,
      `${user}\nReason: ${reason}\nBy: ${interaction.user}`
    );

    return interaction.reply({
      content: `✅ ${user.tag} has been ${type}.`,
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: `❌ Failed to ${type} user.`,
      ephemeral: true
    }).catch(() => {});
  }
}

async function startGiveaway(channel, prize, duration, hostUser) {
  const endTime = Date.now() + duration;
  const unix = Math.floor(endTime / 1000);
  const entries = new Set();

  const embed = new EmbedBuilder()
    .setColor(HEX)
    .setDescription(
      `# ${prize}\n` +
      `Ends: in <t:${unix}:R> (<t:${unix}:F>)\n` +
      `Hosted by: ${hostUser}\n` +
      `Entries: **0**\n` +
      `Winners: **1**`
    )
    .setFooter({ text: new Date(endTime).toLocaleDateString() });

  const button = new ButtonBuilder()
    .setCustomId(`giveaway_join_${Date.now()}`)
    .setLabel("Join")
    .setEmoji("🎉")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({
    time: duration
  });

  collector.on("collect", async i => {
    if (i.user.bot) return;

    if (entries.has(i.user.id)) {
      return i.reply({
        content: "❌ You already entered this giveaway.",
        ephemeral: true
      });
    }

    entries.add(i.user.id);

    const updated = new EmbedBuilder()
      .setColor(HEX)
      .setDescription(
        `# ${prize}\n` +
        `Ends: in <t:${unix}:R> (<t:${unix}:F>)\n` +
        `Hosted by: ${hostUser}\n` +
        `Entries: **${entries.size}**\n` +
        `Winners: **1**`
      )
      .setFooter({ text: new Date(endTime).toLocaleDateString() });

    await msg.edit({
      embeds: [updated],
      components: [row]
    });

    await i.reply({
      content: "🎉 You entered the giveaway!",
      ephemeral: true
    });
  });

  collector.on("end", async () => {
    const disabledButton = ButtonBuilder.from(button).setDisabled(true);
    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

    await msg.edit({
      components: [disabledRow]
    }).catch(() => {});

    const winnerIds = [...entries];
    if (!winnerIds.length) {
      return channel.send("❌ Giveaway ended — no valid entries.");
    }

    const winner = winnerIds[Math.floor(Math.random() * winnerIds.length)];
    await channel.send(`🎉 Winner: <@${winner}>`);
  });

  giveaways.set(msg.id, {
    channelId: channel.id,
    prize,
    endTime,
    hostId: hostUser.id,
    entries
  });

  return msg;
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName("ticketpanel")
      .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
      .setName("staffpanel")
      .setDescription("Send staff panel"),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("remind")
      .setDescription("Remind a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a user")
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
        sub
          .setName("start")
          .setDescription("Start giveaway")
          .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
          .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
          .addStringOption(o => o.setName("duration").setDescription("1mi / 1h / 1d").setRequired(true))
      )
      .addSubcommand(sub =>
        sub
          .setName("reroll")
          .setDescription("Reroll a giveaway")
          .addStringOption(o => o.setName("messageid").setDescription("Message ID").setRequired(true))
      )
  ];

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {
  try {
    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      // ===== TICKET PANEL =====
      if (interaction.commandName === "ticketpanel") {
        if (!canStaff(interaction)) {
          return interaction.reply({
            content: "❌ You do not have permission to use this.",
            ephemeral: true
          });
        }

        const ch = await client.channels.fetch(PANEL_CHANNEL).catch(() => null);
        if (!ch) {
          return interaction.reply({
            content: "❌ Panel channel not found.",
            ephemeral: true
          });
        }

        const messages = await ch.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
          const oldPanel = messages.find(
            msg => msg.author.id === client.user.id && msg.components.length > 0
          );
          if (oldPanel) await oldPanel.delete().catch(() => {});
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("ticket_select")
          .setPlaceholder("Select ticket type")
          .addOptions([
            {
              label: "General Support",
              description: "Open a general support ticket",
              value: "general"
            },
            {
              label: "Staff Support",
              description: "Open a staff support ticket",
              value: "staff"
            }
          ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
          .setColor(HEX)
          .setTitle("Support Tickets")
          .setDescription("Choose a ticket type below.")
          .setImage(SUPPORT_IMAGE);

        await ch.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: "✅ Ticket panel sent.",
          ephemeral: true
        });
      }

      // ===== STAFF PANEL =====
      if (interaction.commandName === "staffpanel") {
        if (!canStaff(interaction)) {
          return interaction.reply({
            content: "❌ You do not have permission to use this.",
            ephemeral: true
          });
        }

        const ch = await client.channels.fetch(STAFF_PANEL_CHANNEL).catch(() => null);
        if (!ch) {
          return interaction.reply({
            content: "❌ Staff panel channel not found.",
            ephemeral: true
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("promo").setLabel("Promote").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("demo").setLabel("Demote").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("warnbtn").setLabel("Warn").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("remindbtn").setLabel("Remind").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("banbtn").setLabel("Ban").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("kickbtn").setLabel("Kick").setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setColor(HEX)
          .setTitle("Staff Panel")
          .setDescription("Use the buttons below to manage moderation actions.");

        await ch.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content: "✅ Staff panel sent.",
          ephemeral: true
        });
      }

      // ===== WARN =====
      if (interaction.commandName === "warn") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }
        return punish(
          interaction,
          "warned",
          interaction.options.getUser("user"),
          interaction.options.getString("reason")
        );
      }

      // ===== REMIND =====
      if (interaction.commandName === "remind") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }
        return punish(
          interaction,
          "reminded",
          interaction.options.getUser("user"),
          interaction.options.getString("reason")
        );
      }

      // ===== BAN =====
      if (interaction.commandName === "ban") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }
        return punish(
          interaction,
          "banned",
          interaction.options.getUser("user"),
          interaction.options.getString("reason")
        );
      }

      // ===== KICK =====
      if (interaction.commandName === "kick") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }
        return punish(
          interaction,
          "kicked",
          interaction.options.getUser("user"),
          interaction.options.getString("reason")
        );
      }

      // ===== AUTOPING =====
      if (interaction.commandName === "autoping") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        autoPingChannelId = interaction.options.getChannel("channel").id;

        return interaction.reply({
          content: `✅ Auto ping channel set to <#${autoPingChannelId}>`,
          ephemeral: true
        });
      }

      // ===== GIVEAWAY =====
      if (interaction.commandName === "giveaway") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "start") {
          const ch = interaction.options.getChannel("channel");
          const prize = interaction.options.getString("prize");
          const durationInput = interaction.options.getString("duration");
          const duration = parseTime(durationInput);

          if (!duration) {
            return interaction.reply({
              content: "❌ Invalid duration. Use 1mi / 1h / 1d / 1mo.",
              ephemeral: true
            });
          }

          await startGiveaway(ch, prize, duration, interaction.user);

          return interaction.reply({
            content: "✅ Giveaway started.",
            ephemeral: true
          });
        }

        if (sub === "reroll") {
          const messageId = interaction.options.getString("messageid");
          const stored = giveaways.get(messageId);

          if (!stored) {
            return interaction.reply({
              content: "❌ Giveaway not found in memory. You may need to restart it manually.",
              ephemeral: true
            });
          }

          const ch = await client.channels.fetch(stored.channelId).catch(() => null);
          if (!ch) {
            return interaction.reply({
              content: "❌ Giveaway channel not found.",
              ephemeral: true
            });
          }

          const winnerIds = [...stored.entries];
          if (!winnerIds.length) {
            return interaction.reply({
              content: "❌ No entries to reroll.",
              ephemeral: true
            });
          }

          const winner = winnerIds[Math.floor(Math.random() * winnerIds.length)];
          await ch.send(`🎉 Rerolled winner: <@${winner}>`);

          return interaction.reply({
            content: `✅ Rerolled winner: <@${winner}>`,
            ephemeral: true
          });
        }
      }
    }

    // ===== TICKET SELECT =====
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const selected = interaction.values[0];

      const category =
        selected === "staff" ? CAT_STAFF : CAT_GENERAL;

      const safeName = interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const channel = await interaction.guild.channels.create({
        name: `ticket-${safeName || interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ["ViewChannel"]
          },
          {
            id: interaction.user.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
          },
          {
            id: STAFF_ROLE,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
          },
          {
            id: ADMIN_ROLE,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(HEX)
        .setTitle("Ticket Opened")
        .setDescription(`Hello ${interaction.user}, support will assist you soon.`);

      await channel.send({
        content: `${interaction.user}`,
        embeds: [embed]
      });

      return interaction.reply({
        content: `✅ Created ${channel}`,
        ephemeral: true
      });
    }

    // ===== BUTTONS =====
    if (interaction.isButton()) {
      if (interaction.customId === "warnbtn") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId("warnmodal")
          .setTitle("Warn User");

        const userInput = new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "remindbtn") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId("remindmodal")
          .setTitle("Remind User");

        const userInput = new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "banbtn") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId("banmodal")
          .setTitle("Ban User");

        const userInput = new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "kickbtn") {
        if (!canStaff(interaction)) {
          return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId("kickmodal")
          .setTitle("Kick User");

        const userInput = new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }
    }

    // ===== MODALS =====
    if (interaction.isModalSubmit()) {
      const userId = interaction.fields.getTextInputValue("user");
      const reason = interaction.fields.getTextInputValue("reason");
      const user = await client.users.fetch(userId).catch(() => null);

      if (!user) {
        return interaction.reply({
          content: "❌ Invalid user ID.",
          ephemeral: true
        });
      }

      if (interaction.customId === "warnmodal") {
        return punish(interaction, "warned", user, reason);
      }

      if (interaction.customId === "remindmodal") {
        return punish(interaction, "reminded", user, reason);
      }

      if (interaction.customId === "banmodal") {
        return punish(interaction, "banned", user, reason);
      }

      if (interaction.customId === "kickmodal") {
        return punish(interaction, "kicked", user, reason);
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);

    if (interaction && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ===== AUTO PING =====
client.on("guildMemberAdd", member => {
  if (!autoPingChannelId) return;

  const ch = member.guild.channels.cache.get(autoPingChannelId);
  if (ch) ch.send(`${member} check out this giveaway!`);
});

client.login(TOKEN);
