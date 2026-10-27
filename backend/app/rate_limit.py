"""Request throttling and spend guardrails.

Lives in its own module so both ``app.main`` (which installs the middleware)
and ``app.routers.chat`` (which decorates the endpoint) can share one limiter
without importing each other.
"""

import secrets
from datetime import UTC, datetime
from ipaddress import IPv4Network, IPv6Network, ip_address

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import get_settings

# Added to /api requests by a routing rule in the Vercel project.
ORIGIN_SECRET_HEADER = "x-origin-secret"


def default_rate_limit() -> str:
    """Loose global limit for the cheap read-only endpoints."""
    return get_settings().rate_limit


def chat_rate_limit() -> str:
    """Tight per-IP limit for /chat, which costs money on every call."""
    return get_settings().chat_rate_limit


def client_address(request: Request) -> str:
    """The address a request counts against, as far as a known proxy vouches for it.

    In production the TCP peer is always the Container Apps ingress, so keying
    on the peer puts every visitor in the same few buckets, one per ingress
    address. The ingress appends the address that connected to it as the last
    X-Forwarded-For entry, and anything to the left of that was written by the
    caller. The exception is a request carrying the origin secret: its caller
    was Vercel, which overwrites X-Forwarded-For with the visitor's address, so
    the entry before Vercel's own is the visitor.
    """
    peer = get_remote_address(request)
    settings = get_settings()
    if not _is_trusted(peer, settings.trusted_proxies):
        return peer

    hops = [
        hop.strip()
        for line in request.headers.getlist("x-forwarded-for")
        for hop in line.split(",")
        if hop.strip()
    ]
    if not hops:
        return peer
    vouched = hops[-1]
    if len(hops) > 1 and _came_through_vercel(request, settings.origin_secret):
        vouched = hops[-2]

    try:
        return str(ip_address(vouched))
    except ValueError:
        # Both hops write bare addresses. Anything else, such as an address
        # with its port, could give every connection a fresh allowance.
        return peer


def _is_trusted(host: str, proxies: list[IPv4Network | IPv6Network]) -> bool:
    try:
        address = ip_address(host)
    except ValueError:
        return False
    return any(address in network for network in proxies)


def _came_through_vercel(request: Request, secret: str) -> bool:
    if not secret:
        return False
    presented = request.headers.get(ORIGIN_SECRET_HEADER, "")
    # compare_digest on bytes, as for the analytics token, so a non-ASCII
    # header cannot raise instead of failing the match.
    return secrets.compare_digest(presented.encode("utf-8"), secret.encode("utf-8"))


# Both limits are callables so the settings are read per request rather than
# frozen at import time.
limiter = Limiter(key_func=client_address, default_limits=[default_rate_limit])


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
