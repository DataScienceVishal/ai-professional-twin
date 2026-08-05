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


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
