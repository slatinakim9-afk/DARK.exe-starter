import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import asyncpg
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dark-exe")

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

bot = Bot(settings.bot_token) if settings.bot_token else None
dp = Dispatcher()

pool = None
bot_task = None


@dp.message(CommandStart())
async def start(message: Message):
    if not settings.webapp_url.startswith("https://"):
        await message.answer(
            "DARK.exe: WEBAPP_URL должен использовать HTTPS."
        )
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="☠ ОТКРЫТЬ DARK.exe",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            ]
        ]
    )

    await message.answer(
        "⛧ DARK.exe // СЕАНС ИНИЦИИРОВАН\n\n"
        "Система нестабильна. Входи на свой страх и риск.",
        reply_markup=keyboard,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, bot_task

    if settings.database_url:
        try:
            pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=5,
                command_timeout=10,
            )

            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS events (
                        id BIGSERIAL PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        detail TEXT NOT NULL DEFAULT '',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )

            log.info("Database connection established")

        except Exception:
            log.exception("Database initialization failed")

            if pool:
                await pool.close()
                pool = None

    else:
        log.warning("DATABASE_URL not configured; database features disabled")

    if bot:
        bot_task = asyncio.create_task(dp.start_polling(bot))
        log.info("Telegram bot polling started")
    else:
        log.warning("BOT_TOKEN not set; bot polling disabled")

    yield

    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass
        except Exception:
            log.exception("Telegram bot stopped with an error")

    if bot:
        await bot.session.close()

    if pool:
        await pool.close()

    log.info("DARK.exe shutdown complete")


app = FastAPI(
    title="DARK.exe API",
    version="1.0.0",
    lifespan=lifespan,
)

if STATIC_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )


def require_database():
    if pool is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured or unavailable",
        )
    return pool


async def record_event(event_type: str, detail: str):
    database = require_database()

    async with database.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO events (event_type, detail)
            VALUES ($1, $2)
            """,
            event_type,
            detail,
        )


@app.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"

    if not index_file.is_file():
        raise HTTPException(
            status_code=404,
            detail="DARK.exe interface not found",
        )

    return FileResponse(index_file)


@app.get("/api/health")
async def health():
    database_status = "offline"

    if pool is not None:
        try:
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            database_status = "online"
        except Exception:
            log.exception("Health check database query failed")

    return {
        "system": "DARK.exe",
        "status": "online",
        "database": database_status,
        "bot_configured": bot is not None,
        "version": app.version,
    }


@app.get("/api/events")
async def get_events():
    database = require_database()

    try:
        async with database.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, event_type, detail, created_at
                FROM events
                ORDER BY id DESC
                LIMIT 8
                """
            )
    except Exception:
        log.exception("Failed to retrieve events")
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve events",
        )

    return [
        {
            "id": row["id"],
            "type": row["event_type"],
            "detail": row["detail"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]


@app.post("/api/events/demo")
async def demo_event():
    await record_event(
        "USER_SIGNAL",
        "Тестовое событие интерфейса",
    )
    return {"ok": True}


@app.get("/api/status")
async def system_status():
    database_status = "online" if pool is not None else "offline"

    return {
        "system": "DARK.exe",
        "status": "online",
        "database": database_status,
        "bot_configured": bot is not None,
        "modules": {
            "ghost_mode": {
                "name": "GHOST MODE",
                "status": "standby",
                "enabled": False,
            },
            "auto_reply": {
                "name": "AUTO REPLY",
                "status": "standby",
                "enabled": False,
            },
        },
    }
