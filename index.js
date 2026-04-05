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
const GENERAL_ROLE = "1453942545691447366";
const STAFF_ROLE = "1453942664830521376";
const ADMIN_ROLE = "1453942621520138360";

const CAT_GENERAL = "1453972934946459769";
const CAT_STAFF = "1477641183810556099";
const CAT_LEADER = "1477640903488438357";

const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136";
const WELCOME_CHANNEL = "1453945503434936512";
const LOG_CHANNEL = "1475224763327582309";

const SUPPORT_IMAGE = "https://cdn.discordapp.com/attachments/1453949932841992325/1490316347748647002/Copy_of_Solani_Banners_-_WelcomeBanner.png";

let ticketCount = 0;
let autoPingChannel = null;
let giveaways = {};

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
      body: [
        { name: "ticketpanel", description: "Send ticket panel" },
        { name: "staffpanel", description: "Send staff panel" },
        {
          name: "autoping",
          description: "Set auto ping",
          options: [
            { name: "channel", type: 7, required: true }
          ]
        },
        {
          name: "giveaway",
          description: "Giveaway system",
          options: [
            {
              name: "start",
              type: 1,
              options: [
                { name: "channel", type: 7, required: true },
                { name: "prize", type: 3, required: true },
                { name: "duration", type: 3, required: true },
                { name: "image", type: 3 }
              ]
            },
            {
              name: "reroll",
              type: 1,
              options: [
                { name: "messageid", type: 3, required: true }
              ]
            }
          ]
        }
      ]
    }
  );

  console.log("✅ Bot ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== SLASH COMMANDS =====
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

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tier1").setLabel("Tier 1").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("tier2").setLabel("Tier 2").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("tier3").setLabel("Tier 3").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("tier4").setLabel("Tier 4").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("tier5").setLabel("Tier 5").setStyle(ButtonStyle.Secondary)
      );

      const channel = await client.channels.fetch(PANEL_CHANNEL);
      await channel.send({ embeds: [embed], components: [row1, row2, row3] });

      return interaction.reply({ content: "✅ Staff panel sent", ephemeral: true });
    }

    // ===== AUTOPING =====
    if (interaction.commandName === "autoping") {
      autoPingChannel = interaction.options.getChannel("channel").id;
      return interaction.reply({ content: "✅ Auto ping set", ephemeral: true });
    }

    // ===== GIVEAWAY =====
    if (interaction.commandName === "giveaway") {
      const sub = interaction.options.getSubcommand();

      if (sub === "start") {
        const channel = interaction.options.getChannel("channel");
        const prize = interaction.options.getString("prize");
        const duration = interaction.options.getString("duration");
        const image = interaction.options.getString("image");

        const embed = new EmbedBuilder()
          .setColor("#8B8C92")
          .setTitle("🎉 Giveaway")
          .setDescription(`**${prize}**\nDuration: ${duration}\nReact 🎉`);

        if (image) embed.setImage(image);

        const msg = await channel.send({ embeds: [embed] });
        await msg.react("🎉");

        giveaways[msg.id] = { channel: channel.id };

        return interaction.reply({ content: "✅ Giveaway started", ephemeral: true });
      }

      if (sub === "reroll") {
        const id = interaction.options.getString("messageid");
        const data = giveaways[id];

        if (!data) return interaction.reply("❌ Not found");

        const channel = await client.channels.fetch(data.channel);
        const msg = await channel.messages.fetch(id);

        const users = await msg.reactions.cache.get("🎉").users.fetch();
        const winner = users.random();

        channel.send(`🎉 Winner: ${winner}`);
        return interaction.reply("✅ Rerolled");
      }
    }

    // ===== ORIGINAL TICKET PANEL (UNCHANGED) =====
    if (interaction.commandName === "ticketpanel") {

      const imageEmbed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage(SUPPORT_IMAGE);

      const textEmbed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setDescription("Please use the dropdown menu to select a ticket.");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "General Support", value: "general" },
          { label: "Staff Report", value: "staff" },
          { label: "Partnership", value: "partner" },
          { label: "Leadership Support", value: "leader" },
          { label: "Sponsored Giveaway", value: "giveaway" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const channel = await client.channels.fetch(PANEL_CHANNEL);
      await channel.send({ embeds: [imageEmbed, textEmbed], components: [row] });

      return interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("Staff Action");

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

    if (interaction.customId === "promo") {
      if (member) await member.roles.add(STAFF_ROLE);
      embed.setTitle("Promoted");
    }

    if (interaction.customId === "demo") {
      if (member) await member.roles.remove(STAFF_ROLE);
      embed.setTitle("Demoted");
    }

    if (interaction.customId === "warn") embed.setTitle("Warned");

    if (interaction.customId === "remind") {
      embed.setTitle("Reminder Sent");
      if (member) member.send(reason).catch(() => {});
    }

    if (interaction.customId === "ban") {
      if (member) await member.ban({ reason });
      embed.setTitle("Banned");
    }

    await logChannel.send({ embeds: [embed] });

    return interaction.reply({ content: "✅ Done", ephemeral: true });
  }
});

// ===== AUTO PING + WELCOME =====
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (channel) {
    channel.send(`Welcome ${member}!`);
  }

  if (autoPingChannel) {
    const ch = member.guild.channels.cache.get(autoPingChannel);
    if (ch) ch.send(`${member} check out this giveaway!`);
  }
});

client.login(TOKEN);
