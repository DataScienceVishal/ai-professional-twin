from app.rate_limit import DailyChatBudget, chat_rate_limit, default_rate_limit


def test_budget_allows_up_to_the_cap() -> None:
    budget = DailyChatBudget(max_per_day=3)
    assert [budget.try_consume() for _ in range(3)] == [True, True, True]
    assert budget.used == 3
    assert budget.remaining == 0


def test_budget_refuses_once_exhausted() -> None:
    budget = DailyChatBudget(max_per_day=1)
    assert budget.try_consume() is True
    assert budget.try_consume() is False
    assert budget.try_consume() is False


def test_budget_resets_at_utc_midnight() -> None:
    budget = DailyChatBudget(max_per_day=1)
    assert budget.try_consume() is True
    assert budget.try_consume() is False

    # Simulate the UTC day rolling over.
    budget._day = "1999-12-31"

    assert budget.try_consume() is True
    assert budget.used == 1


def test_zero_budget_refuses_everything() -> None:
    budget = DailyChatBudget(max_per_day=0)
    assert budget.try_consume() is False
    assert budget.remaining == 0


def test_limit_providers_read_settings() -> None:
    """The limits come from settings, not hardcoded strings in main.py."""
    assert default_rate_limit() == "60/minute"
    assert chat_rate_limit() == "10/minute"
