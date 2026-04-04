const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// CONFIG
const STAFF_ROLES = [
  "1453942545691447366",
  "1453942664830521376",
  "1453942621520138360"
];

const CATEGORY_ID = "1453972934946459769";
const TRANSCRIPT_CHANNEL = "1453974468547444819";
const PANEL_CHANNEL = "1453944972477862136";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {

  // SLASH COMMAND
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ticketpanel") {

      const embed1 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546178159837335/Copy_of_Solani_Banners_-_WelcomeBanner.png");

      const embed2 = new EmbedBuilder()
        .setColor("#8B8C92")
        .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1489546181280530482/36733093-BE93-4153-8809-B6A8D507D066.png")
        .setDescription("Please use the dropdown menu to select a ticket. Most questions can be answered inside a General Support one");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select a ticket type")
        .addOptions([
          {
            label: "General Support",
            description: "Report a member, general inquiries.",
            emoji: "💼",
            value: "general"
          },
          {
            label: "Staff Report",
            description: "Report a staff member to a High Rank!",
            emoji: "📖",
            value: "staff"
          },
          {
            label: "Partnership Request/Concerns",
            description: "Partnership requests, concerns.",
            emoji: "🤝",
            value: "partner"
          },
          {
            label: "Leadership Support",
            description: "Claim giveaways, leadership concerns.",
            emoji: "👑",
            value: "leader"
          },
          {
            label: "Sponsored Giveaway",
            description: "Buy a sponsored giveaway!",
            emoji: "🎉",
            value: "giveaway"
          }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const channel = await client.channels.fetch(PANEL_CHANNEL);

      await channel.send({
        embeds: [embed1, embed2],
        components: [row]
      });

      return interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
    }
  }

  // DROPDOWN
  if (interaction.isStringSelectMenu()) {

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        ...STAFF_ROLES.map(role => ({
          id: role,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }))
      ]
    });

    await interaction.reply({
      content: `✅ Your ticket has been created in ${ticketChannel}`,
      ephemeral: true
    });

    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 5000);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🙋‍♂️"),
      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );

    await ticketChannel.send({
      content: `<@&1453942545691447366> <@&1453942664830521376> <@&1453942621520138360>`,
      embeds: [
        new EmbedBuilder()
          .setDescription("hey! thank you for opening a ticket, please describe your question/inquiry here support will be with you shortly.")
          .setColor("#8B8C92")
      ],
      components: [buttons]
    });
  }

  // BUTTONS
  if (interaction.isButton()) {

    if (interaction.customId === "claim") {
      const hasRole = STAFF_ROLES.some(role =>
        interaction.member.roles.cache.has(role)
      );

      if (!hasRole) {
        return interaction.reply({
          content: "❌ Your not a staff member!",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ ${interaction.user} has claimed the ticket`
      });
    }

    if (interaction.customId === "close") {

      await interaction.reply({
        content: "closing ticket.. saving transcript"
      });

      const messages = await interaction.channel.messages.fetch({ limit: 100 });

      let transcript = messages
        .map(m => `${m.author.tag}: ${m.content}`)
        .reverse()
        .join("\n");

      fs.writeFileSync(`transcript-${interaction.channel.id}.txt`, transcript);

      const logChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL);

      await logChannel.send({
        content: `Transcript for ${interaction.channel.name}`,
        files: [`transcript-${interaction.channel.id}.txt`]
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 3000);
    }
  }

});
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get("1453945503434936512");
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#8B8C92")
    .setTitle("Welcome to Alex's Hangout!")
    .setDescription(`${member} has joined the Alex's Hangout! You are our ${member.guild.memberCount}th member! We're so glad to have you here. Please be sure to check out our rules in <#1453944026444206161> and our most recent announcements in <#1453944617241149554>. If you'd like to receive notifications on giveaways, affiliates or events, be sure to react with the appropriate emoji!`)
    .setImage("https://cdn.discordapp.com/attachments/1453949932841992325/1490086476929699901/WelcomeBanner.png");

  channel.send({ embeds: [embed] });

});
client.login(process.env.TOKEN);
