
import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

BOT_TOKEN = ""
WEBAPP_URL = "https://dark-exe-starter.vercel.app"

dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="ОТКРЫТЬ DARK.exe",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ],
        resize_keyboard=True,
    )

    await message.answer(
        "DARK.exe // ACCESS TERMINAL\n\n"
        "Система готова к запуску.\n"
        "Нажми кнопку, чтобы открыть интерфейс.",
        reply_markup=keyboard,
    )


async def main():
    if not BOT_TOKEN:
        raise RuntimeError(
            "Добавь токен бота в переменную BOT_TOKEN."
        )

    bot = Bot(token=BOT_TOKEN)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
