"""Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = ""
    ML_SERVICE_URL: str = "http://ml-service:8001"
    GROQ_API_KEY: str
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    GROQ_FALLBACK_MODEL: str = "llama-3.1-8b-instant"
    AI_INSIGHTS_CACHE_TTL_SECONDS: int = 10800
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""

    class Config:
        env_file = Path(__file__).resolve().parent.parent / ".env"
        extra = "ignore"


settings = Settings()
