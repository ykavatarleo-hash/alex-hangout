import os
import discord
from discord.ext import commands

# Create a bot instance with default intents (required for discord.py 2.0+)
intents = discord.Intents.default()
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    # Set the bot's status
    await bot.change_presence(activity=discord.Game(name="Alex's Hangout"))
    print(f'Logged in as {bot.user}')

# Run the bot using the token from the environment variable
bot.run(os.environ.get('DISCORD_TOKEN'))