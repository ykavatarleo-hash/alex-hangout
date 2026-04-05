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
    GatewayIntentBits.GuildMessages,
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
const PANEL_CHANNEL = "1453944972477862136";
const WELCOME_CHANNEL = "1453945503434936512";

// ✅ FINAL CLEAN IMAGE (NO EXPIRY)
const SUPPORT_IMAGE = "https://cdn.discordapp.com/attachments/1453949932841992325/1490316347748647002/Copy_of_Solani_Banners_-_WelcomeBanner.png";

let ticketCount = 0;

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Alex’s Hangout", type: 3 }],
    status: "online"
  });

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    {
      body: [{ name: "ticketpanel", description: "Send ticket panel" }]
    }
  );

  console.log("✅ Bot ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== PANEL =====
  if (interaction.isChatInputCommand()) {

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setImage(SUPPORT_IMAGE)
      .setDescription(
        "Please use the dropdown menu to select a ticket. " +
        "Most questions can be answered inside a General Support one."
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select a ticket type")
      .addOptions([
        { label: "General Support", value: "general" },
        { label: "Staff Report", value: "staff" },
        { label: "Partnership", value: "partner" },
        { label: "Leadership Support", value: "leader" },
        { label: "Sponsored Giveaway", value: "giveaway" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    const channel = await client.channels.fetch(PANEL_CHANNEL);
    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
  }

  // ===== DROPDOWN =====
  if (interaction.isStringSelectMenu()) {

    const type = interaction.values[0];

    let category, roles, ping;

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

    if (type === "leader") {
      category = CAT_LEADER;
      roles = [ADMIN_ROLE];
      ping = `<@&${ADMIN_ROLE}>`;
    }

    // ✅ FIXED GIVEAWAY (correct role only)
    if (type === "giveaway") {
      category = CAT_LEADER;
      roles = [STAFF_ROLE];
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

    // ===== GIVEAWAY =====
    if (type === "giveaway") {

      const modal = new ModalBuilder()
        .setCustomId(`giveaway_${ticketChannel.id}`)
        .setTitle("🎉 Sponsored Giveaway");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("prize").setLabel("Prize").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("announcement").setLabel("Announcement").setStyle(TextInputStyle.Paragraph)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("addons").setLabel("Add-ons").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("days").setLabel("Duration").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("ping").setLabel("Ping Role").setStyle(TextInputStyle.Short)
        )
      );

      await interaction.showModal(modal);

      await ticketChannel.send({
        content: `${ping}\n${interaction.user} opened a giveaway ticket`
      });

      return;
    }

    // ===== NORMAL TICKETS =====
    await interaction.reply({
      content: `✅ Ticket created: ${ticketChannel}`,
      ephemeral: true
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setEmoji("🙋‍♂️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: ping,
      embeds: [
        new EmbedBuilder()
          .setColor("#2b2d31")
          .setDescription(
            `Hello ${interaction.user}\n\n` +
            "Please describe your issue below.\nSupport will be with you shortly."
          )
      ],
      components: [buttons]
    });
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith("giveaway_")) {

      const channelId = interaction.customId.split("_")[1];
      const channel = await client.channels.fetch(channelId);

      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("🎉 Giveaway Submission")
        .setDescription(
          `**Prize**\n${interaction.fields.getTextInputValue("prize")}\n\n` +
          `**Announcement**\n${interaction.fields.getTextInputValue("announcement")}\n\n` +
          `**Add-ons**\n${interaction.fields.getTextInputValue("addons")}\n\n` +
          `**Duration**\n${interaction.fields.getTextInputValue("days")}\n\n` +
          `**Ping**\n${interaction.fields.getTextInputValue("ping")}`
        );

      await interaction.reply({ content: "✅ Submitted!", ephemeral: true });
      await channel.send({ embeds: [embed] });
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
        .map(m => `${m.author.tag}: ${m.content}`)
        .reverse()
        .join("\n");

      const file = `transcript-${interaction.channel.id}.txt`;
      fs.writeFileSync(file, transcript);

      const logChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL);

      await logChannel.send({
        content: `Transcript for ${interaction.channel.name}`,
        files: [file]
      });

      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
  }
});

// ===== WELCOME =====
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle("👋 Welcome to Alex’s Hangout!")
    .setDescription(
      `Welcome {user}!\n\n` +
      "Please use the buttons below to navigate through the server. " +
      "If you need any help, feel free to open a support ticket.\n\n" +
      "Most questions can be answered in the Information section.\n\n" +
      "*We hope you enjoy your stay at Alex’s Hangout!* 💙"
    )
    .setImage(SUPPORT_IMAGE);

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

  channel.send({
    embeds: [embed],
    components: [buttons]
  });
});

client.login(TOKEN);
