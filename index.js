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

// ================= CONFIG =================

// Roles
const GENERAL_ROLE = "1453942545691447366";
const STAFF_ROLE = "1453942664830521376";
const ADMIN_ROLE = "1453942621520138360";

// Categories
const CAT_GENERAL = "1453972934946459769";
const CAT_STAFF = "1477641183810556099";
const CAT_LEADER = "1477640903488438357";

const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136";

let ticketCount = 0;

// ================= READY =================

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Alex’s Hangout", type: 3 }],
    status: "online"
  });

  const commands = [
    { name: "ticketpanel", description: "Send the ticket panel" }
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
      { body: commands }
    );
    console.log("✅ Commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  // ===== PANEL =====
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {

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
        embeds: [
          new EmbedBuilder()
            .setColor("#8B8C92")
            .setDescription("Select a ticket type below")
        ],
        components: [row]
      });

      return interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
    }
  }

  // ===== DROPDOWN =====
  if (interaction.isStringSelectMenu()) {

    const type = interaction.values[0];

    let category;
    let allowedRoles = [];
    let ping = "";

    // ===== ROUTING =====
    if (type === "general") {
      category = CAT_GENERAL;
      allowedRoles = [GENERAL_ROLE];
      ping = `<@&${GENERAL_ROLE}>`;
    }

    if (type === "staff" || type === "partner") {
      category = CAT_STAFF;
      allowedRoles = [STAFF_ROLE, ADMIN_ROLE];
      ping = `<@&${STAFF_ROLE}> <@&${ADMIN_ROLE}>`;
    }

    if (type === "leader") {
      category = CAT_LEADER;
      allowedRoles = [ADMIN_ROLE];
      ping = `<@&${ADMIN_ROLE}>`;
    }

    if (type === "giveaway") {
      category = CAT_LEADER;
      allowedRoles = [ADMIN_ROLE];
      ping = `<@&${ADMIN_ROLE}>`;
    }

    ticketCount++;

    // ===== PERMISSIONS (STRICT FIX) =====
    const overwrites = [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionsBitField.Flags.ViewChannel]
      }
    ];

    // ONLY allow selected roles
    allowedRoles.forEach(role => {
      overwrites.push({
        id: role,
        allow: [PermissionsBitField.Flags.ViewChannel]
      });
    });

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}-${ticketCount}`,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: overwrites
    });

    // ===== GIVEAWAY MODAL (FIXED) =====
    if (type === "giveaway") {

      const modal = new ModalBuilder()
        .setCustomId("giveaway_form")
        .setTitle("Sponsored Giveaway");

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
          new TextInputBuilder().setCustomId("ping").setLabel("Ping").setStyle(TextInputStyle.Short)
        )
      );

      await interaction.showModal(modal);

      // SEND MESSAGE AFTER MODAL (important)
      await channel.send({ content: ping });

      return;
    }

    // NORMAL TICKET
    await interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: ping,
      embeds: [
        new EmbedBuilder()
          .setDescription("Describe your issue below.")
          .setColor("#8B8C92")
      ],
      components: [buttons]
    });
  }

  // ===== MODAL SUBMIT =====
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "giveaway_form") {

      const embed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle("🎉 Giveaway Details")
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

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    if (interaction.customId === "claim") {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE)) {
        return interaction.reply({ content: "❌ Staff only!", ephemeral: true });
      }

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

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 3000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
