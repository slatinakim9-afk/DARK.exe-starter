import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import asyncpg
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dark-exe")
ROOT = Path(__file__).parent
bot = Bot(settings.bot_token) if settings.bot_token else None
dp = Dispatcher()
pool = None
bot_task = None

@dp.message(CommandStart())
async def start(message: Message):
    if not settings.webapp_url.startswith("https://"):
        await message.answer("DARK.exe: WEBAPP_URL должен использовать HTTPS.")
        return
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="☠ ОТКРЫТЬ DARK.exe", web_app=WebAppInfo(url=settings.webapp_url))
    ]])
    await message.answer("⛧ DARK.exe // СЕАНС ИНИЦИИРОВАН\n\nСистема нестабильна. Входи на свой страх и риск.", reply_markup=keyboard)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, bot_task
    pool = await asyncpg.create_pool(settings.database_url)
    async with pool.acquire() as conn:
        await conn.execute("CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, event_type TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
    if bot:
        bot_task = asyncio.create_task(dp.start_polling(bot))
    else:
        log.warning("BOT_TOKEN not set; bot polling disabled")
    yield
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass
    if bot:
        await bot.session.close()
    if pool:
        await pool.close()

app = FastAPI(title="DARK.exe API", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

@app.get("/")
async def index():
    return FileResponse(ROOT / "static" / "index.html")

@app.get("/api/health")
async def health():
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"system": "DARK.exe", "status": "online", "bot_configured": bool(bot)}

@app.get("/api/events")
async def events():
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id,event_type,detail,created_at FROM events ORDER BY id DESC LIMIT 8")
    return [{"id":r["id"],"type":r["event_type"],"detail":r["detail"],"created_at":r["created_at"].isoformat()} for r in rows]

@app.post("/api/events/demo")
async def demo_event():
    async with pool.acquire() as conn:
        await conn.execute("INSERT INTO events(event_type,detail) VALUES($1,$2)", "USER_SIGNAL", "Тестовое событие интерфейса")
    return {"ok": True}
