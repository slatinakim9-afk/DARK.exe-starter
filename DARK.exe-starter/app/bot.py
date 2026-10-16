import asyncio
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DARK.exe")

bot = Bot(token=settings.bot_token)
dp = Dispatcher()


@dp.message(CommandStart())
async def start_handler(message: Message):
    if not settings.bot_token:
        await message.answer("DARK.exe: BOT_TOKEN не настроен.")
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="ОТКРЫТЬ DARK.exe",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            ]
        ]
    )

    await message.answer(
        "◈ DARK.exe CONTROL CENTER\n\n"
        "Система готова к запуску.\n"
        "Нажми кнопку ниже, чтобы открыть панель.",
        reply_markup=keyboard,
    )


async def main():
    if not settings.bot_token:
        raise RuntimeError("Укажи BOT_TOKEN в файле .env")

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
