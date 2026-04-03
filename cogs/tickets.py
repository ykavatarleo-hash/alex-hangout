import discord
from discord.ext import commands

class TicketSelectMenu(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label='Support', value='support'),
            discord.SelectOption(label='Bug Report', value='bug'),
            discord.SelectOption(label='Feature Request', value='feature'),
            discord.SelectOption(label='General Inquiry', value='inquiry'),
            discord.SelectOption(label='Other', value='other')
        ]
        super().__init__(placeholder='Choose a ticket type...', options=options)

    async def callback(self, interaction: discord.Interaction):
        ticket_type = self.values[0]
        await interaction.response.send_message(f'Ticket of type `{ticket_type}` created!', ephemeral=True)
        # Additional logic to create the channel and roles goes here

class TicketActionView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(TicketSelectMenu())

class Tickets(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name='ticket_setup')
    @commands.has_permissions(administrator=True)
    async def ticket_setup(self, ctx):
        view = TicketActionView()
        await ctx.send('Create a ticket:', view=view)

    @commands.Cog.listener()
    async def on_ready(self):
        print(f'{self.bot.user.name} has connected to Discord!')

async def setup(bot):
    await bot.add_cog(Tickets(bot))