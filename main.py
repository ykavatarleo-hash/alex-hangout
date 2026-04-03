import os
import discord
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    await bot.change_presence(activity=discord.Game(name="Alex's Hangout"))
    print(f'Logged in as: {bot.user.name}')

bot.run(os.getenv('DISCORD_TOKEN'))