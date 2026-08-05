from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode


class Settings(BaseSettings):
    github_token: str = ""
    github_username: str = "DataScienceVishal"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    # Public origin of THIS api, used to build shareable links (resume download,
    # etc). Deliberately separate from cors_origins, which is the frontend.
    public_base_url: str = "http://localhost:8000"
    chroma_persist_dir: str = "./chromadb_data"
    log_level: str = "info"

    # Question analytics. The JSONL log has to survive restarts to be worth
    # anything, so it belongs on the same mounted volume as the vector store.
    # Left empty it is derived as a sibling of chroma_persist_dir, which puts it
    # at /data/analytics/queries.jsonl in production without hardcoding /data.
    analytics_log_path: str = ""
    # Size at which the log rotates to a single .1 backup. The volume is small
    # and the file only grows, so worst case on disk is roughly twice this.
    analytics_max_bytes: int = 5_000_000
    # Bearer token for GET /analytics. Empty disables the endpoint entirely (it
    # 404s, so its existence is not advertised). Never logged or echoed back.
    analytics_token: str = ""

    llm_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_api_key: str = ""

    # Sampling temperature. Ignored for GPT-5 / o-series deployments, which only
    # accept the default and return HTTP 400 for anything else. Set
    # llm_send_temperature to force the parameter on (true) or off (false)
    # instead of letting the model name decide.
    llm_temperature: float = 0.3
    llm_send_temperature: bool | None = None
    # Hard ceiling on completion length. Sent as max_completion_tokens for
    # GPT-5 / o-series and as max_tokens for everything else.
    llm_max_output_tokens: int = 1024
    # Ask the provider for token counts on streamed responses so spend shows up
    # in the logs. Disable if a deployment rejects stream_options.
    llm_stream_usage: bool = True
    # Reasoning effort for GPT-5 / o-series deployments. Reasoning tokens are
    # billed as output and are spent before the first visible token, so this
    # drives both cost and time-to-first-token. Answering from retrieved context
    # needs little deliberation. One of minimal/low/medium/high, or "" to omit
    # the parameter. Ignored for non-reasoning models.
    llm_reasoning_effort: str = "low"

    # Loose default for the cheap read-only endpoints.
    rate_limit: str = "60/minute"
    # Tight per-IP limit for /chat, which costs money on every call.
    chat_rate_limit: str = "10/minute"
    # Global ceiling on chat completions per UTC day, across all visitors.
    daily_chat_budget: int = 500

    ingest_github: bool = True
    github_repo_limit: int = 100
    github_concurrency: int = 5

    # Repos never ingested, whatever they contain (comma-separated, matched
    # case-insensitively on the exact repo name). my-ai-resume is the retired V1
    # of this project: still a public repo, but citing it as evidence for the
    # current one is actively misleading.
    # DataScienceVishal is the GitHub profile repo (username/username). It holds
    # a profile README, so the content gate keeps it, but it is not a project and
    # citing it as evidence for one is noise.
    github_exclude_repos: Annotated[list[str], NoDecode] = [
        "my-ai-resume",
        "DataScienceVishal",
    ]
    # Quality gates applied before a repo is embedded. Each one is a judgement
    # call, so each is switchable: forks are not his own work, archived repos are
    # dead, and a repo with neither a description nor a README has nothing worth
    # embedding beyond its name.
    github_skip_forks: bool = True
    github_skip_archived: bool = True
    github_require_content: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("cors_origins", "github_exclude_repos", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("public_base_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @model_validator(mode="after")
    def _derive_analytics_log_path(self) -> "Settings":
        """Default the query log to a sibling of the vector store directory.

        One Railway volume is mounted at /data and CHROMA_PERSIST_DIR is
        /data/chromadb, so this lands at /data/analytics/queries.jsonl with no
        second path to configure - while staying overridable for anyone who
        mounts things elsewhere.
        """
        if not self.analytics_log_path:
            parent = Path(self.chroma_persist_dir).parent
            self.analytics_log_path = str(parent / "analytics" / "queries.jsonl")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached so per-request lookups (rate limits) do not re-read the env file."""
    return Settings()
