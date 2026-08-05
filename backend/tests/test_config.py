from app.config import Settings, get_settings


def test_defaults_are_portfolio_sized() -> None:
    settings = Settings(github_token="", azure_openai_api_key="")
    assert settings.rate_limit == "60/minute"
    assert settings.chat_rate_limit == "10/minute"
    assert settings.daily_chat_budget == 500
    assert settings.llm_max_output_tokens == 1024
    assert settings.ingest_github is True
    assert settings.github_concurrency == 5


def test_send_temperature_defaults_to_auto_detect() -> None:
    assert Settings().llm_send_temperature is None


def test_public_base_url_is_separate_from_cors_origins() -> None:
    settings = Settings(
        cors_origins="https://frontend.vercel.app",
        public_base_url="https://api.up.railway.app",
    )
    assert settings.cors_origins == ["https://frontend.vercel.app"]
    assert settings.public_base_url == "https://api.up.railway.app"


def test_public_base_url_trailing_slash_is_stripped() -> None:
    assert Settings(public_base_url="https://api.example.com/").public_base_url == (
        "https://api.example.com"
    )


def test_cors_origins_split_from_csv() -> None:
    settings = Settings(cors_origins="http://a.com, http://b.com ,")
    assert settings.cors_origins == ["http://a.com", "http://b.com"]


def test_retired_v1_repo_is_denylisted_by_default() -> None:
    """my-ai-resume is deliberately shut down; it must never be cited."""
    assert "my-ai-resume" in Settings().github_exclude_repos


def test_profile_repo_is_denylisted_by_default() -> None:
    """DataScienceVishal is the username/username profile repo. It has a README
    so the content gate keeps it, but it is not a project worth citing."""
    assert "DataScienceVishal" in Settings().github_exclude_repos


def test_github_exclude_repos_split_from_csv() -> None:
    settings = Settings(github_exclude_repos="my-ai-resume, DataScienceVishal ,")
    assert settings.github_exclude_repos == ["my-ai-resume", "DataScienceVishal"]


def test_github_quality_gates_default_on() -> None:
    settings = Settings()
    assert settings.github_skip_forks is True
    assert settings.github_skip_archived is True
    assert settings.github_require_content is True


def test_analytics_log_path_is_derived_beside_the_vector_store() -> None:
    """One Railway volume is mounted at /data, so the query log has to land on
    it too - without hardcoding /data anywhere."""
    settings = Settings(chroma_persist_dir="/data/chromadb")

    assert settings.analytics_log_path == "/data/analytics/queries.jsonl"


def test_analytics_log_path_follows_a_relocated_vector_store() -> None:
    settings = Settings(chroma_persist_dir="/mnt/volume/chroma")

    assert settings.analytics_log_path == "/mnt/volume/analytics/queries.jsonl"


def test_an_explicit_analytics_log_path_wins() -> None:
    settings = Settings(
        chroma_persist_dir="/data/chromadb",
        analytics_log_path="/somewhere/else/q.jsonl",
    )

    assert settings.analytics_log_path == "/somewhere/else/q.jsonl"


def test_analytics_endpoint_is_off_unless_a_token_is_set() -> None:
    """No token means GET /analytics 404s, so a fresh deploy leaks nothing."""
    assert Settings().analytics_token == ""


def test_analytics_log_is_capped_by_default() -> None:
    """The volume is small and the file only grows."""
    assert Settings().analytics_max_bytes == 5_000_000


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
