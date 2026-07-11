from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    github_username: str = "DataScienceVishal"
    cors_origins: list[str] = ["http://localhost:5173"]
    chroma_persist_dir: str = "./chromadb_data"
    log_level: str = "info"
    llm_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"
    github_models_base_url: str = "https://models.github.ai/inference"
    rate_limit: str = "30/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
