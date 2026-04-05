const TOKEN = process.env.TOKEN;

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== CONFIG =====
const STAFF_PANEL_CHANNEL = "1453949648082567278";
const LOG_CHANNEL = "1475224763327582309";
const WELCOME_CHANNEL = "1453945503434936512";

let autoPingChannel = null;
let giveaways = {};

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands("1479902342395596941", "1453937653539147820"),
    {
      body: [
        {
          name: "staffpanel",
          description: "Send staff panel"
        },
        {
          name: "autoping",
          description: "Set auto ping",
          options: [
            {
              name: "channel",
              description: "Channel",
              type: 7,
              required: true
            }
          ]
        },
        {
          name: "giveaway",
          description: "Giveaway system",
          options: [
            {
              name: "start",
              description: "Start giveaway",
              type: 1,
              options: [
                { name: "channel", description: "Channel", type: 7, required: true },
                { name: "prize", description: "Prize", type: 3, required: true },
                { name: "duration", description: "Duration", type: 3, required: true },
                { name: "image", description: "Image URL", type: 3 }
              ]
            },
            {
              name: "reroll",
              description: "Reroll giveaway",
              type: 1,
              options: [
                { name: "messageid", description: "Message ID", type: 3, required: true }
              ]
            }
          ]
        }
      ]
    }
  );

  console.log("✅ Commands ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== COMMANDS =====
  if (interaction.isChatInputCommand()) {

    // STAFF PANEL
    if (interaction.commandName === "staffpanel") {

      const embed = new EmbedBuilder()
        .setColor("#8B8C92")
        .setTitle("Staff Manager")
        .setDescription("Select an action");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("promo").setLabel("Promote").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("demo").setLabel("Demote").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("warn").setLabel("Warn").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("remind").setLabel("Reminder").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ban").setLabel("Ban").setStyle(ButtonStyle.Danger)
      );

      const channel = await client.channels.fetch(STAFF_PANEL_CHANNEL);
      await channel.send({ embeds: [embed], components: [row] });

      return interaction.reply({ content: "✅ Panel sent", ephemeral: true });
    }

    // AUTOPING
    if (interaction.commandName === "autoping") {
      autoPingChannel = interaction.options.getChannel("channel").id;
      return interaction.reply({ content: "✅ Auto ping set", ephemeral: true });
    }

    // GIVEAWAY
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
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    // PROMOTE / DEMOTE → ROLE SELECT
    if (interaction.customId === "promo" || interaction.customId === "demo") {

      const roles = interaction.guild.roles.cache
        .filter(r => r.name !== "@everyone")
        .map(r => ({
          label: r.name,
          value: r.id
        }))
        .slice(0, 25);

      const select = new StringSelectMenuBuilder()
        .setCustomId(interaction.customId + "_role")
        .setPlaceholder("Select a role")
        .addOptions(roles);

      const row = new ActionRowBuilder().addComponents(select);

      return interaction.reply({
        content: "Select a role (tier)",
        components: [row],
        ephemeral: true
      });
    }

    // OTHER BUTTONS → MODAL
    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("Action");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("user").setLabel("User ID").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("reason").setLabel("Reason").setStyle(TextInputStyle.Paragraph)
      )
    );

    return interaction.showModal(modal);
  }

  // ===== ROLE SELECT =====
  if (interaction.isStringSelectMenu()) {

    const roleId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId("role_action_" + roleId + "_" + interaction.customId)
      .setTitle("User");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("user").setLabel("User ID").setStyle(TextInputStyle.Short)
      )
    );

    return interaction.showModal(modal);
  }

  // ===== MODALS =====
  if (interaction.isModalSubmit()) {

    const logChannel = await client.channels.fetch(LOG_CHANNEL);

    // ROLE ACTION
    if (interaction.customId.startsWith("role_action_")) {
      const [, roleId, action] = interaction.customId.split("_");

      const userId = interaction.fields.getTextInputValue("user");
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (member) {
        if (action === "promo_role") await member.roles.add(roleId);
        if (action === "demo_role") await member.roles.remove(roleId);
      }

      return interaction.reply({ content: "✅ Done", ephemeral: true });
    }

    // MOD ACTIONS
    const userId = interaction.fields.getTextInputValue("user");
    const reason = interaction.fields.getTextInputValue("reason");

    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor("#8B8C92")
      .setDescription(`User: <@${userId}>\nReason: ${reason}\nBy: ${interaction.user}`);

    if (interaction.customId === "warn") embed.setTitle("Warned");

    if (interaction.customId === "remind") {
      embed.setTitle("Reminder");
      if (member) member.send(reason).catch(() => {});
    }

    if (interaction.customId === "ban") {
      embed.setTitle("Banned");
      if (member) await member.ban({ reason });
    }

    await logChannel.send({ embeds: [embed] });

    return interaction.reply({ content: "✅ Done", ephemeral: true });
  }
});

// ===== JOIN =====
client.on("guildMemberAdd", async (member) => {

  if (autoPingChannel) {
    const ch = member.guild.channels.cache.get(autoPingChannel);
    if (ch) ch.send(`${member} check out this giveaway!`);
  }

  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (ch) ch.send(`Welcome ${member}!`);
});

client.login(TOKEN);
