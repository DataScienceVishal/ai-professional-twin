"""Durable, queryable record of what visitors actually ask.

``app.routers.chat`` already emits one structlog event per request, but Railway
log lines scroll away and cannot be aggregated, so the single most valuable
signal this project produces - what recruiters ask, and which questions the
assistant fails to answer - was being thrown away. This module appends the same
fields to a JSON Lines file on the mounted volume and aggregates them back on
demand for ``GET /analytics``.

Privacy: a line holds the question text, the chat mode, a UTC timestamp and the
retrieval/outcome fields that were already being logged - nothing else. No IP
address, user agent, session id or any other identifier is stored, and none can
be reconstructed from the file, because the question is the signal and the
person asking it is not. Anything added here must clear that same bar.
"""

import asyncio
import json
import threading
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import structlog

from app.config import Settings
from app.models.analytics import AnalyticsSummary, QuestionCount, TokenTotals

logger = structlog.get_logger()

# Outcome values written to the log. Shared with the chat router so the writer
# and the aggregator cannot drift apart on a bare string.
OUTCOME_OK = "ok"
OUTCOME_ERROR = "error"
OUTCOME_REFUSED = "budget_exhausted"

# How many distinct questions the summary lists per bucket.
TOP_QUESTIONS = 20


@dataclass(frozen=True)
class QueryRecord:
    """One chat request, as persisted. See the module docstring on privacy:
    every field here is either the question itself or a quality signal about
    answering it, and nothing identifies who asked."""

    query: str
    mode: str
    outcome: str
    retrieved_chunks: int = 0
    has_context: bool = False
    tools_used: list[str] = field(default_factory=list)
    latency_ms: float = 0.0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


def normalise_question(text: str) -> str:
    """Fold trivial variants together for counting.

    Trims, collapses runs of whitespace and lowercases, so "Visa?", " visa? "
    and "visa?" are one row in the frequency table rather than three.
    """
    return " ".join(text.split()).lower()


def _tally(pairs: list[tuple[str, str]], limit: int) -> list[QuestionCount]:
    """Count ``(normalised_key, original_text)`` pairs, showing an original."""
    counts: Counter[str] = Counter(key for key, _ in pairs)
    representative: dict[str, str] = {}
    for key, original in pairs:
        representative.setdefault(key, original)
    return [
        QuestionCount(question=representative[key], count=count)
        for key, count in counts.most_common(limit)
    ]


def _found_useful_context(entry: dict[str, Any]) -> bool:
    chunks = entry.get("retrieved_chunks")
    return bool(entry.get("has_context")) and isinstance(chunks, int) and chunks > 0


def summarise(records: list[dict[str, Any]], limit: int = TOP_QUESTIONS) -> AnalyticsSummary:
    """Aggregate raw log rows into the shape the endpoint serves.

    A free function so the arithmetic can be tested without touching a disk.
    """
    modes: Counter[str] = Counter()
    outcomes: Counter[str] = Counter()
    asked: list[tuple[str, str]] = []
    unanswered: list[tuple[str, str]] = []
    tokens = {"prompt": 0, "completion": 0, "total": 0}
    timestamps: list[str] = []

    for entry in records:
        query = str(entry.get("query", ""))
        key = normalise_question(query)
        if key:
            asked.append((key, query.strip()))

        modes[str(entry.get("mode", "unknown"))] += 1
        outcome = str(entry.get("outcome", "unknown"))
        outcomes[outcome] += 1

        # "Retrieval found nothing" is only meaningful for a request that got
        # as far as retrieving. A budget refusal short-circuits before that, so
        # counting it here would inflate the one number worth acting on.
        if key and outcome == OUTCOME_OK and not _found_useful_context(entry):
            unanswered.append((key, query.strip()))

        for name in ("prompt", "completion", "total"):
            value = entry.get(f"{name}_tokens")
            if isinstance(value, int):
                tokens[name] += value

        stamp = entry.get("timestamp")
        if isinstance(stamp, str) and stamp:
            timestamps.append(stamp)

    return AnalyticsSummary(
        total_queries=len(records),
        by_mode=dict(modes.most_common()),
        by_outcome=dict(outcomes.most_common()),
        error_count=outcomes[OUTCOME_ERROR],
        refusal_count=outcomes[OUTCOME_REFUSED],
        top_questions=_tally(asked, limit),
        unanswered_count=len(unanswered),
        unanswered_questions=_tally(unanswered, limit),
        tokens=TokenTotals(**tokens),
        # ISO-8601 UTC stamps sort lexicographically, so min/max is the window.
        first_query_at=min(timestamps) if timestamps else None,
        last_query_at=max(timestamps) if timestamps else None,
    )


class QueryAnalytics:
    """Append-only JSONL query log with a size cap, plus its aggregator."""

    def __init__(self, path: Path, max_bytes: int) -> None:
        self.path = path
        self.max_bytes = max_bytes
        self.backup_path = path.parent / f"{path.name}.1"
        # Appends happen on the thread pool, so the guard has to be a real
        # thread lock rather than an asyncio one.
        self._lock = threading.Lock()

    def ensure_directory(self) -> None:
        """Create the log directory at startup so the first write cannot fail on it."""
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            # A missing directory degrades analytics, never the service.
            logger.warning(
                "analytics_dir_unavailable",
                path=str(self.path.parent),
                error_type=type(exc).__name__,
            )

    async def record(self, entry: QueryRecord) -> None:
        """Append one line.

        Never raises. Analytics are a nice-to-have; a full volume or a
        read-only mount must not turn into a failed chat request, so every
        error is logged and swallowed.
        """
        try:
            payload: dict[str, Any] = {
                "timestamp": datetime.now(UTC).isoformat(),
                **asdict(entry),
            }
            line = json.dumps(payload, ensure_ascii=False)
            await asyncio.to_thread(self._append, line)
        except Exception as exc:
            await logger.awarning(
                "analytics_write_failed",
                exc_info=exc,
                error_type=type(exc).__name__,
                path=str(self.path),
            )

    async def summary(self, limit: int = TOP_QUESTIONS) -> AnalyticsSummary:
        """Aggregate the retained log. An unreadable log reads as empty."""
        try:
            records = await asyncio.to_thread(self._read_records)
        except OSError as exc:
            await logger.awarning(
                "analytics_read_failed",
                error_type=type(exc).__name__,
                path=str(self.path),
            )
            records = []
        return summarise(records, limit=limit)

    def _append(self, line: str) -> None:
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._rotate_if_full()
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(f"{line}\n")

    def _rotate_if_full(self) -> None:
        """Cap the log at ``max_bytes``, keeping a single ``.1`` backup.

        The Railway volume is small and this file only ever grows. Two
        generations keeps recent history without pulling in a log shipper; the
        older backup is dropped on the next rotation.
        """
        if self.max_bytes <= 0:
            return
        if not self.path.exists() or self.path.stat().st_size < self.max_bytes:
            return
        self.backup_path.unlink(missing_ok=True)
        self.path.rename(self.backup_path)

    def _read_records(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        # Oldest first: the rotated backup, then the live file.
        for path in (self.backup_path, self.path):
            if not path.exists():
                continue
            with path.open(encoding="utf-8") as handle:
                for raw in handle:
                    stripped = raw.strip()
                    if not stripped:
                        continue
                    try:
                        entry = json.loads(stripped)
                    except json.JSONDecodeError:
                        # A line torn by a crash mid-write must not take the
                        # whole summary down with it.
                        continue
                    if isinstance(entry, dict):
                        records.append(entry)
        return records


def build_query_analytics(settings: Settings) -> QueryAnalytics:
    return QueryAnalytics(
        path=Path(settings.analytics_log_path),
        max_bytes=settings.analytics_max_bytes,
    )
