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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const GENERAL_ROLE = "1453942545691447366";
const STAFF_ROLE = "1453942664830521376";
const ADMIN_ROLE = "1453942621520138360";

const CAT_GENERAL = "1453972934946459769";
const CAT_STAFF = "1477641183810556099";
const CAT_LEADER = "1477640903488438357";

const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136"; // ticket panel channel
const STAFF_PANEL_CHANNEL = "1453949648082567278"; // staff panel channel
const WELCOME_CHANNEL = "1453945503434936512";
const LOG_CHANNEL = "1475224763327582309";

const SUPPORT_IMAGE = "https://cdn.discordapp.com/attachments/1453949932841992325/1490316347748647002/Copy_of_Solani_Banners_-_WelcomeBanner.png";

const TIER_ROLE_NAMES = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  tier4: "Tier 4",
  tier5: "Tier 5"
};

let ticketCount = 0;
let autoPingChannelId = null;
const giveaways = new Map();

const MAX_TIMEOUT = 2_147_483_647;

function ephemeral() {
  return { flags: MessageFlags.Ephemeral };
}

function makeLogEmbed(title, userId, reason, moderator, extraFields = []) {
  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setTitle(title)
    .addFields(
      { name: "User", value: `<@${userId}>`, inline: true },
      { name: "Moderator", value: `${moderator}`, inline: true },
      { name: "Reason", value: reason || "No reason provided" }
    );

  if (extraFields.length) embed.addFields(extraFields);
  return embed;
}

function parseDurationToMs(input) {
  if (!input) return null;

  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|mi|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|mon|month|months)$/);

  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  switch (unit) {
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return value * 1_000;
    case "m":
    case "min":
    case "mins":
    case "mi":
    case "minute":
    case "minutes":
      return value * minute;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return value * hour;
    case "d":
    case "day":
    case "days":
      return value * day;
    case "w":
    case "wk":
    case "wks":
    case "week":
    case "weeks":
      return value * week;
    case "mo":
    case "mon":
    case "month":
    case "months":
      return value * month;
    default:
      return null;
  }
}

function scheduleGiveawayEnd(messageId) {
  const data = giveaways.get(messageId);
  if (!data || data.ended) return;

  const delay = data.endsAt - Date.now();

  if (delay <= 0) {
    endGiveaway(messageId).catch(console.error);
    return;
  }

  data.timer = setTimeout(() => {
    scheduleGiveawayEnd(messageId);
  }, Math.min(delay, MAX_TIMEOUT));
}

async function endGiveaway(messageId) {
  const data = giveaways.get(messageId);
  if (!data || data.ended) return;

  data.ended = true;

  const channel = await client.channels.fetch(data.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  await message.reactions.fetch().catch(() => {});
  const reaction = message.reactions.cache.get("🎉");

  if (!reaction) {
    await channel.send(`🎉 Giveaway ended for **${data.prize}** — no entries were found.`);
    return;
  }

  const users = await reaction.users.fetch().catch(() => null);
  const entrants = users
    ? users.filter((u) => !u.bot && u.id !== client.user.id)
    : null;

  if (!entrants || entrants.size === 0) {
    await channel.send(`🎉 Giveaway ended for **${data.prize}** — no valid entries.`);
    return;
  }

  const winner = entrants.random();
  await channel.send(`🎉 Giveaway ended for **${data.prize}** — winner: ${winner}`);
}

function getTierRole(guild, tierKey) {
  const roleName = TIER_ROLE_NAMES[tierKey];
  if (!roleName) return null;

  return guild.roles.cache.find(
    (role) => role.name.toLowerCase() === roleName.toLowerCase()
  ) || null;
}

function buildTierSelect(action) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`tier_select:${action}`)
      .setPlaceholder("Choose a tier")
      .addOptions([
        { label: "Tier 1", value: "tier1", emoji: "1️⃣" },
        { label: "Tier 2", value: "tier2", emoji: "2️⃣" },
        { label: "Tier 3", value: "tier3", emoji: "3️⃣" },
        { label: "Tier 4", value: "tier4", emoji: "4️⃣" },
        { label: "Tier 5", value: "tier5", emoji: "5️⃣" }
      ])
  );
}

function buildUserModal(customId, title) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("user")
        .setLabel("User ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

function buildModModal(customId, title) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("user")
        .setLabel("User ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  return modal;
}

async function sendToLog(embed) {
  const logChannel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;
  await logChannel.send({ embeds: [embed] });
}

async function handleStaffModeration(interaction, action, userId, reason) {
  const guild = interaction.guild;
  const moderator = interaction.user;
  const member = await guild.members.fetch(userId).catch(() => null);

  if (action === "warn") {
    await sendToLog(makeLogEmbed("⚠️ Warned", userId, reason, moderator));
    return interaction.reply({ content: "✅ Warn logged", ...ephemeral() });
  }

  if (action === "remind") {
    if (member) {
      await member.send(`Reminder: ${reason}`).catch(() => {});
    }
    await sendToLog(makeLogEmbed("📌 Reminder", userId, reason, moderator));
    return interaction.reply({ content: "✅ Reminder sent", ...ephemeral() });
  }

  if (action === "ban") {
    await guild.members.ban(userId, { reason }).catch(() => {});
    await sendToLog(makeLogEmbed("⛔ Banned", userId, reason, moderator));
    return interaction.reply({ content: "✅ User banned", ...ephemeral() });
  }

  return interaction.reply({ content: "❌ Unknown moderation action", ...ephemeral() });
}

async function startGiveaway(channel, prize, durationInput, image, hostUserId) {
  const durationMs = parseDurationToMs(durationInput);

  if (!durationMs || durationMs < 1_000) {
    return { error: "❌ Invalid duration. Use formats like `1mi`, `10m`, `2h`, `1d`, `1w`, `1mo`." };
  }

  const endsAt = Date.now() + durationMs;
  const endUnix = Math.floor(endsAt / 1000);

  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setTitle("🎉 Giveaway")
    .setDescription(
      `**Prize:** ${prize}\n` +
      `**Ends:** <t:${endUnix}:R>\n` +
      `**Host:** <@${hostUserId}>\n\n` +
      "React with 🎉 to enter."
    );

  if (image) embed.setImage(image);

  const message = await channel.send({ embeds: [embed] });
  await message.react("🎉").catch(() => {});

  giveaways.set(message.id, {
    channelId: channel.id,
    prize,
    endsAt,
    ended: false,
    timer: null
  });

  scheduleGiveawayEnd(message.id);

  return { messageId: message.id };
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Alex’s Hangout", type: 3 }],
    status: "online"
  });

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
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Which user?")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("What is the reason?")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("remind")
      .setDescription("Send a reminder")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Which user?")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("What is the reason?")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Which user?")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("What is the reason?")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("autoping")
      .setDescription("Set auto ping channel")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Which channel should auto ping be sent in?")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription("Giveaway system")
      .addSubcommand((sub) =>
        sub
          .setName("start")
          .setDescription("Start a giveaway")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Which channel?")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("prize")
              .setDescription("What is the prize?")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("duration")
              .setDescription("Duration like 1mi, 10m, 1h, 1d, 1mo")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("image")
              .setDescription("Image URL")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("reroll")
          .setDescription("Reroll a giveaway")
          .addStringOption((option) =>
            option
              .setName("messageid")
              .setDescription("Giveaway message ID")
              .setRequired(true)
          )
      )
  ];

  try {
    await rest.put(
      Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
      {
        body: commands.map((command) => command.toJSON())
      }
    );
    console.log("✅ Commands ready");
  } catch (error) {
    console.error("❌ Command registration failed:", error);
  }
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  try {
    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ticketpanel") {
        const imageEmbed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setImage(SUPPORT_IMAGE);

        const textEmbed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setDescription(
            "Please use the dropdown menu to select a ticket.\n" +
            "Most questions can be answered inside a General Support one."
          );

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

        const channel = await client.channels.fetch(PANEL_CHANNEL).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: "❌ Ticket panel channel not found", ...ephemeral() });
        }

        await channel.send({ embeds: [imageEmbed, textEmbed], components: [row] });
        return interaction.reply({ content: "✅ Panel sent!", ...ephemeral() });
      }

      if (interaction.commandName === "staffpanel") {
        const embed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setTitle("Staff Manager")
          .setDescription("Use the buttons below to manage staff, warnings, reminders, and bans.");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("promo").setLabel("Promote").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("demo").setLabel("Demote").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("warn").setLabel("Warn").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("remind").setLabel("Reminder").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("ban").setLabel("Ban").setStyle(ButtonStyle.Danger)
        );

        const channel = await client.channels.fetch(STAFF_PANEL_CHANNEL).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: "❌ Staff panel channel not found", ...ephemeral() });
        }

        await channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: "✅ Staff panel sent", ...ephemeral() });
      }

      if (interaction.commandName === "warn") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");
        await handleStaffModeration(interaction, "warn", user.id, reason);
        return;
      }

      if (interaction.commandName === "remind") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");
        await handleStaffModeration(interaction, "remind", user.id, reason);
        return;
      }

      if (interaction.commandName === "ban") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");
        await handleStaffModeration(interaction, "ban", user.id, reason);
        return;
      }

      if (interaction.commandName === "autoping") {
        autoPingChannelId = interaction.options.getChannel("channel").id;
        return interaction.reply({ content: `✅ Auto ping channel set to <#${autoPingChannelId}>`, ...ephemeral() });
      }

      if (interaction.commandName === "giveaway") {
        const sub = interaction.options.getSubcommand();

        if (sub === "start") {
          const channel = interaction.options.getChannel("channel");
          const prize = interaction.options.getString("prize");
          const duration = interaction.options.getString("duration");
          const image = interaction.options.getString("image");

          if (!channel || !channel.isTextBased()) {
            return interaction.reply({ content: "❌ That channel cannot be used for giveaways.", ...ephemeral() });
          }

          const result = await startGiveaway(channel, prize, duration, image, interaction.user.id);
          if (result.error) {
            return interaction.reply({ content: result.error, ...ephemeral() });
          }

          return interaction.reply({ content: "✅ Giveaway started", ...ephemeral() });
        }

        if (sub === "reroll") {
          const messageId = interaction.options.getString("messageid");
          const data = giveaways.get(messageId);

          if (!data) {
            return interaction.reply({ content: "❌ Giveaway not found", ...ephemeral() });
          }

          const channel = await client.channels.fetch(data.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) {
            return interaction.reply({ content: "❌ Giveaway channel not found", ...ephemeral() });
          }

          const message = await channel.messages.fetch(messageId).catch(() => null);
          if (!message) {
            return interaction.reply({ content: "❌ Giveaway message not found", ...ephemeral() });
          }

          await message.reactions.fetch().catch(() => {});
          const reaction = message.reactions.cache.get("🎉");
          if (!reaction) {
            return interaction.reply({ content: "❌ No giveaway reaction found", ...ephemeral() });
          }

          const users = await reaction.users.fetch().catch(() => null);
          const entrants = users
            ? users.filter((u) => !u.bot && u.id !== client.user.id)
            : null;

          if (!entrants || entrants.size === 0) {
            await channel.send(`🎉 Reroll for **${data.prize}** — no valid entries.`);
            return interaction.reply({ content: "✅ Rerolled, but no valid entries were found.", ...ephemeral() });
          }

          const winner = entrants.random();
          await channel.send(`🎉 Rerolled winner for **${data.prize}**: ${winner}`);
          return interaction.reply({ content: "✅ Giveaway rerolled", ...ephemeral() });
        }
      }

      return;
    }

    // ===== TICKET + TIER SELECT MENUS =====
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "ticket_select") {
        const type = interaction.values[0];

        let category;
        let roles = [];
        let ping = "";

        if (type === "general") {
          category = CAT_GENERAL;
          roles = [GENERAL_ROLE];
          ping = `<@&${GENERAL_ROLE}>`;
        }

        if (type === "staff" || type === "partner") {
          category = CAT_STAFF;
          roles = [STAFF_ROLE, ADMIN_ROLE];
          ping = `<@&${STAFF_ROLE}> <@&${ADMIN_ROLE}>`;
        }

        if (type === "leader" || type === "giveaway") {
          category = CAT_LEADER;
          roles = [STAFF_ROLE];
          ping = `<@&${STAFF_ROLE}>`;
        }

        ticketCount++;

        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}-${ticketCount}`,
          type: ChannelType.GuildText,
          parent: category,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
            ...roles.map((r) => ({
              id: r,
              allow: [PermissionsBitField.Flags.ViewChannel]
            }))
          ]
        });

        if (type === "giveaway") {
          const modal = new ModalBuilder()
            .setCustomId(`giveaway_${ticketChannel.id}`)
            .setTitle("🎉 Sponsored Giveaway");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("prize")
                .setLabel("Prize")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("announcement")
                .setLabel("Announcement")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("addons")
                .setLabel("Add-ons")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("days")
                .setLabel("Duration")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("ping")
                .setLabel("Ping Role")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

          await interaction.showModal(modal);

          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Claim").setEmoji("🙋‍♂️").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
          );

          const embed = new EmbedBuilder()
            .setColor("#8B8C92")
            .setDescription(
              `Hello ${interaction.user}\n\n` +
              "Please complete the giveaway form.\nStaff will review shortly."
            );

          await ticketChannel.send({
            content: ping,
            embeds: [embed],
            components: [buttons]
          });

          return;
        }

        await interaction.reply({
          content: `✅ Ticket created: ${ticketChannel}`,
          ...ephemeral()
        });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("claim").setLabel("Claim").setEmoji("🙋‍♂️").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          content: ping,
          embeds: [
            new EmbedBuilder()
              .setColor("#8B8C92")
              .setDescription(
                `Hello ${interaction.user}\n\n` +
                "Please describe your issue below.\nSupport will be with you shortly."
              )
          ],
          components: [buttons]
        });

        return;
      }

      if (interaction.customId.startsWith("tier_select:")) {
        const action = interaction.customId.split(":")[1];
        const tierKey = interaction.values[0];

        const modal = buildUserModal(`tier_modal:${action}:${tierKey}`, action === "promo" ? "Promote User" : "Demote User");
        return interaction.showModal(modal);
      }
    }

    // ===== BUTTONS =====
    if (interaction.isButton()) {
      if (interaction.customId === "claim") {
        return interaction.reply({
          content: `✅ ${interaction.user} claimed this ticket`
        });
      }

      if (interaction.customId === "close") {
        await interaction.reply({ content: "Closing ticket..." });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });

        const transcript = messages
          .map((m) => `${m.author.tag}: ${m.content}`)
          .reverse()
          .join("\n");

        const file = `transcript-${interaction.channel.id}.txt`;
        fs.writeFileSync(file, transcript);

        const logChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({
            content: `Transcript for ${interaction.channel.name}`,
            files: [file]
          });
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }

      if (interaction.customId === "promo" || interaction.customId === "demo") {
        const row = buildTierSelect(interaction.customId);
        return interaction.reply({
          content: "Select a tier first:",
          components: [row],
          ...ephemeral()
        });
      }

      if (interaction.customId === "warn" || interaction.customId === "remind" || interaction.customId === "ban") {
        const modal = buildModModal(interaction.customId, interaction.customId === "warn" ? "Warn User" : interaction.customId === "remind" ? "Reminder" : "Ban User");
        return interaction.showModal(modal);
      }
    }

    // ===== MODALS =====
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("giveaway_")) {
        const channelId = interaction.customId.split("_")[1];
        const channel = await client.channels.fetch(channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: "❌ Giveaway channel not found", ...ephemeral() });
        }

        const prize = interaction.fields.getTextInputValue("prize");
        const announcement = interaction.fields.getTextInputValue("announcement");
        const addons = interaction.fields.getTextInputValue("addons");
        const days = interaction.fields.getTextInputValue("days");
        const ping = interaction.fields.getTextInputValue("ping");

        const embed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setTitle("🎉 Giveaway Submission")
          .setDescription(
            `**Prize**\n${prize}\n\n` +
            `**Announcement**\n${announcement}\n\n` +
            `**Add-ons**\n${addons}\n\n` +
            `**Duration**\n${days}\n\n` +
            `**Ping**\n${ping}`
          );

        await interaction.reply({ content: "✅ Submitted!", ...ephemeral() });
        await channel.send({ embeds: [embed] });
        return;
      }

      if (interaction.customId.startsWith("tier_modal:")) {
        const parts = interaction.customId.split(":");
        const action = parts[1];
        const tierKey = parts[2];
        const userId = interaction.fields.getTextInputValue("user");

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
          return interaction.reply({ content: "❌ User not found in the server", ...ephemeral() });
        }

        const role = getTierRole(interaction.guild, tierKey);
        if (!role) {
          return interaction.reply({
            content: `❌ Could not find role named **${TIER_ROLE_NAMES[tierKey]}**. Make sure that role exists.`,
            ...ephemeral()
          });
        }

        if (action === "promo") {
          await member.roles.add(role).catch(() => {});
          await sendToLog(
            makeLogEmbed("⬆️ Promoted", userId, `Added tier role: ${role.name}`, interaction.user, [
              { name: "Tier", value: role.name, inline: true }
            ])
          );
          return interaction.reply({ content: `✅ Promoted ${member} to **${role.name}**`, ...ephemeral() });
        }

        if (action === "demo") {
          await member.roles.remove(role).catch(() => {});
          await sendToLog(
            makeLogEmbed("⬇️ Demoted", userId, `Removed tier role: ${role.name}`, interaction.user, [
              { name: "Tier", value: role.name, inline: true }
            ])
          );
          return interaction.reply({ content: `✅ Demoted ${member} from **${role.name}**`, ...ephemeral() });
        }
      }

      if (interaction.customId === "warn" || interaction.customId === "remind" || interaction.customId === "ban") {
        const userId = interaction.fields.getTextInputValue("user");
        const reason = interaction.fields.getTextInputValue("reason");
        await handleStaffModeration(interaction, interaction.customId, userId, reason);
        return;
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong while handling that interaction.",
        ...ephemeral()
      }).catch(() => {});
    }
  }
});

// ===== WELCOME =====
client.on("guildMemberAdd", async (member) => {
  if (autoPingChannelId) {
    const ch = member.guild.channels.cache.get(autoPingChannelId);
    if (ch && ch.isTextBased()) {
      ch.send(`${member} check out this giveaway!`).catch(() => {});
    }
  }

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setImage(SUPPORT_IMAGE)
    .setTitle("👋 Welcome to Alex’s Hangout!")
    .setDescription(
      `Welcome ${member}!\n\n` +
      "Use the buttons below to navigate the server.\n" +
      "Need help? Open a ticket!\n\n" +
      "*Enjoy your stay!* 💙"
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("📘 Information")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/channels/1453937653539147820/1453944026444206161"),
    new ButtonBuilder()
      .setLabel("📢 Announcements")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/channels/1453937653539147820/1453944617241149554")
  );

  channel.send({ embeds: [embed], components: [buttons] }).catch(() => {});
});

client.login(TOKEN);
