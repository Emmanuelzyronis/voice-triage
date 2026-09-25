from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    assemblyai_api_key: str
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str = "gpt-5-mini"
    azure_openai_api_version: str = "2025-01-01-preview"
    azure_tts_deployment: str = "tts-1"
    chroma_persist_directory: str = "./chroma_db"

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Pipeline behaviour
    max_retries: int = 3
    approval_timeout_seconds: int = 300  # 5 min before auto-escalate


settings = Settings()
