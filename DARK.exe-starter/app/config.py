
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bot_token: str = ""
    webapp_url: str = "https://dark-exe-starter.vercel.app"
    database_url: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings(
    bot_token=os.getenv("BOT_TOKEN", ""),
    webapp_url=os.getenv(
        "WEBAPP_URL",
        "https://dark-exe-starter.vercel.app",
    ),
    database_url=os.getenv("DATABASE_URL", ""),
)
