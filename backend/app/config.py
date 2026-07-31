from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode


class Settings(BaseSettings):
    github_token: str = ""
    github_username: str = "DataScienceVishal"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    chroma_persist_dir: str = "./chromadb_data"
    log_level: str = "info"
    llm_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_api_key: str = ""
    rate_limit: str = "30/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
