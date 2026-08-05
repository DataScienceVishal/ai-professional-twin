"""Request throttling and spend guardrails.

Lives in its own module so both ``app.main`` (which installs the middleware)
and ``app.routers.chat`` (which decorates the endpoint) can share one limiter
without importing each other.
"""

from datetime import UTC, datetime

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings


def default_rate_limit() -> str:
    """Loose global limit for the cheap read-only endpoints."""
    return get_settings().rate_limit


def chat_rate_limit() -> str:
    """Tight per-IP limit for /chat, which costs money on every call."""
    return get_settings().chat_rate_limit


# Both limits are callables so the settings are read per request rather than
# frozen at import time.
limiter = Limiter(key_func=get_remote_address, default_limits=[default_rate_limit])


def _utc_day() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


class DailyChatBudget:
    """Global ceiling on chat completions per UTC day, across all visitors.

    The counter is in process memory, so with more than one replica each
    replica gets its own allowance and the effective cap is
    ``max_per_day * replicas``. That is fine for a single-instance personal
    site; a shared store (Redis) would be needed to make it exact.
    """

    def __init__(self, max_per_day: int) -> None:
        self.max_per_day = max_per_day
        self._day = _utc_day()
        self._used = 0

    def _roll_over(self) -> None:
        today = _utc_day()
        if today != self._day:
            self._day = today
            self._used = 0

    @property
    def used(self) -> int:
        self._roll_over()
        return self._used

    @property
    def remaining(self) -> int:
        return max(self.max_per_day - self.used, 0)

    def try_consume(self) -> bool:
        """Reserve one completion. Returns False when the day's budget is gone."""
        self._roll_over()
        if self._used >= self.max_per_day:
            return False
        self._used += 1
        return True
