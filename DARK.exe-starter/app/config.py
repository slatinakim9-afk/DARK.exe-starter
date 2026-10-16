from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    bot_token: str = ""
    webapp_url: str = "https://example.com"
    database_url: str = "postgresql://dark:change_me@db:5432/dark"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
