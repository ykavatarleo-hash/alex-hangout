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

  console.log("✅ Commands ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== PANEL =====
  if (interaction.isChatInputCommand()) {

    const embed1 = new EmbedBuilder()
      .setColor("#8B8C92")
      .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546178159837335/Copy_of_Solani_Banners_-_WelcomeBanner.png");

    const embed2 = new EmbedBuilder()
      .setColor("#8B8C92")
      .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546181280530482/36733093-BE93-4153-8809-B6A8D507D066.png")
      .setDescription(
        "**Welcome to Support!**\n\n" +
        "Please select the type of ticket you need from the dropdown below.\n\n" +
        "• 💼 General Support → Questions / Help\n" +
        "• 📖 Staff Report → Report a staff member\n" +
        "• 🤝 Partnership → Business / Collabs\n" +
        "• 👑 Leadership → Serious issues\n" +
        "• 🎉 Giveaway → Sponsor a giveaway\n\n" +
        "*Our team will respond as soon as possible.*"
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("🎫 Select a ticket type")
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

    if (type === "leader" || type === "giveaway") {
      category = CAT_LEADER;
      roles = [ADMIN_ROLE];
      ping = `<@&${ADMIN_ROLE}>`;
    }

    ticketCount++;

    const channel = await interaction.guild.channels.create({
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

    // ===== GIVEAWAY MODAL =====
    if (type === "giveaway") {

      const modal = new ModalBuilder()
        .setCustomId("giveaway_form")
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
      await channel.send({ content: ping });
      return;
    }

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
          .setColor("#8B8C92")
          .setTitle("🎫 Support Ticket")
          .setDescription(
            `Hello ${interaction.user},\n\n` +
            "Please describe your issue in detail.\n" +
            "A staff member will assist you shortly.\n\n" +
            "Thank you for your patience!"
          )
      ],
      components: [buttons]
    });
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {

    if (interaction.customId === "giveaway_form") {

      const embed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle("🎉 Giveaway Submission")
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

// ===== WELCOME SYSTEM =====
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get("1453945503434936512");
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setTitle("👋 Welcome to Alex’s Hangout!")
    .setDescription(
      `Hey ${member}, welcome to **Alex’s Hangout**!\n\n` +
      `🎉 You are our **${member.guild.memberCount}th** member!\n\n` +
      "📜 Please read the rules in <#1453944026444206161>\n" +
      "📢 Check announcements in <#1453944617241149554>\n\n" +
      "🎁 Want giveaway & event pings?\n" +
      "React in the roles channel to get notified!\n\n" +
      "*We hope you enjoy your stay!* 💙"
    )
    .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1490086476929699901/WelcomeBanner.png")
    .setFooter({ text: "Alex’s Hangout • Community" });

  channel.send({ embeds: [embed] });
});

// ===== LOGIN =====
client.login(TOKEN);
