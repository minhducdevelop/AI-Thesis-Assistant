import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    # API Keys
    gemini_api_key: str = ""
    openai_api_key: str = ""
    
    # Storage settings
    upload_dir: str = "./data/pdfs"
    chroma_db_dir: str = "./data/chroma"
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def chroma_path(self) -> Path:
        p = Path(self.chroma_db_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

settings = Settings()
