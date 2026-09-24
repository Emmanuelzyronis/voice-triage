from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    assemblyai_api_key: str
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str = "gpt-4o"
    chroma_persist_directory: str = "./chroma_db"

    # Pipeline behaviour
    max_retries: int = 3
    approval_timeout_seconds: int = 300  # 5 min before auto-escalate


settings = Settings()
