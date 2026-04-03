import discord
from discord.ext import commands

# Create a bot instance
bot = commands.Bot(command_prefix='!')

@bot.event
async def on_ready():
    # Set the bot's status
    await bot.change_presence(activity=discord.Game(name="Alex's Hangout"))
    print(f'Logged in as {bot.user}')

# Run the bot with your token
bot.run('YOUR_BOT_TOKEN')