import pytest
from starlette.requests import Request

from app.config import get_settings
from app.rate_limit import DailyChatBudget, chat_rate_limit, client_address, default_rate_limit

INGRESS = "100.100.0.28"
# Shaped like the output of `openssl rand -hex 32`.
SECRET = "a1b2c3d4" * 8


def _request(peer: str, headers: list[tuple[str, str]] | None = None) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/skills",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers or []],
            "client": (peer, 50000),
        }
    )


@pytest.fixture
def behind_vercel(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production settings: the ingress range is trusted and Vercel holds the secret."""
    monkeypatch.setenv("TRUSTED_PROXIES", "100.100.0.0/17")
    monkeypatch.setenv("ORIGIN_SECRET", SECRET)
    get_settings.cache_clear()


def test_forwarded_address_from_a_trusted_hop_is_used(behind_vercel: None) -> None:
    request = _request(INGRESS, [("X-Forwarded-For", "203.0.113.7")])

    assert client_address(request) == "203.0.113.7"


def test_forwarded_header_from_an_untrusted_peer_is_ignored(behind_vercel: None) -> None:
    """Only a proxy can vouch for anyone else, and this peer is not one."""
    request = _request("198.51.100.9", [("X-Forwarded-For", "203.0.113.7")])

    assert client_address(request) == "198.51.100.9"


def test_without_a_forwarded_header_the_peer_is_used(behind_vercel: None) -> None:
    assert client_address(_request(INGRESS)) == INGRESS


def test_only_the_entry_the_ingress_appended_is_believed(behind_vercel: None) -> None:
    """A direct caller wrote 192.0.2.1 itself; the ingress appended the address
    the request really came from."""
    request = _request(INGRESS, [("X-Forwarded-For", "192.0.2.1, 198.51.100.9")])

    assert client_address(request) == "198.51.100.9"


def test_repeated_forwarded_for_lines_read_as_one_list(behind_vercel: None) -> None:
    """Reading only the first line would hand the caller's own entry to the limiter."""
    request = _request(
        INGRESS, [("X-Forwarded-For", "192.0.2.1"), ("X-Forwarded-For", "198.51.100.9")]
    )

    assert client_address(request) == "198.51.100.9"


def test_a_request_through_vercel_is_keyed_on_the_visitor(behind_vercel: None) -> None:
    """Vercel overwrites X-Forwarded-For with the visitor's address and the
    ingress then appends Vercel's own, so the visitor is second from the end."""
    request = _request(
        INGRESS,
        [("X-Forwarded-For", "203.0.113.7, 198.51.100.20"), ("X-Origin-Secret", SECRET)],
    )

    assert client_address(request) == "203.0.113.7"


def test_a_wrong_origin_secret_is_not_trusted(behind_vercel: None) -> None:
    request = _request(
        INGRESS,
        [("X-Forwarded-For", "192.0.2.1, 198.51.100.9"), ("X-Origin-Secret", "a-guess")],
    )

    assert client_address(request) == "198.51.100.9"


def test_with_no_secret_configured_an_empty_header_is_not_a_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRUSTED_PROXIES", "100.100.0.0/17")
    monkeypatch.setenv("ORIGIN_SECRET", "")
    get_settings.cache_clear()
    request = _request(
        INGRESS, [("X-Forwarded-For", "192.0.2.1, 198.51.100.9"), ("X-Origin-Secret", "")]
    )

    assert client_address(request) == "198.51.100.9"


def test_the_origin_secret_does_not_make_an_untrusted_peer_trusted(
    behind_vercel: None,
) -> None:
    request = _request(
        "198.51.100.9",
        [("X-Forwarded-For", "203.0.113.7, 198.51.100.20"), ("X-Origin-Secret", SECRET)],
    )

    assert client_address(request) == "198.51.100.9"


def test_a_vercel_request_with_one_entry_keeps_that_entry(behind_vercel: None) -> None:
    """There is no visitor entry to step back to, and the key must not fail."""
    request = _request(INGRESS, [("X-Forwarded-For", "198.51.100.20"), ("X-Origin-Secret", SECRET)])

    assert client_address(request) == "198.51.100.20"


def test_an_entry_that_is_not_an_address_falls_back_to_the_peer(behind_vercel: None) -> None:
    """Keyed with its port, every new connection would start a fresh allowance."""
    request = _request(INGRESS, [("X-Forwarded-For", "203.0.113.7:51234")])

    assert client_address(request) == INGRESS


def test_forwarded_headers_are_ignored_until_a_proxy_is_trusted() -> None:
    """Nothing is trusted by default, so a local run keys on the TCP peer."""
    request = _request(INGRESS, [("X-Forwarded-For", "203.0.113.7")])

    assert client_address(request) == INGRESS


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
