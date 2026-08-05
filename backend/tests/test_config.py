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


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
