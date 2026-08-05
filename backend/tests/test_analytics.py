import json
from pathlib import Path
from typing import Any

from app.analytics import (
    OUTCOME_ERROR,
    OUTCOME_OK,
    OUTCOME_REFUSED,
    QueryAnalytics,
    QueryRecord,
    build_query_analytics,
    normalise_question,
    summarise,
)
from app.config import Settings

# Every field a persisted line is allowed to carry. The privacy promise in the
# module docstring is only worth something if a new field has to break a test
# to get in here.
EXPECTED_KEYS = {
    "timestamp",
    "query",
    "mode",
    "outcome",
    "retrieved_chunks",
    "has_context",
    "tools_used",
    "latency_ms",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
}


def _analytics(tmp_path: Path, max_bytes: int = 5_000_000) -> QueryAnalytics:
    return QueryAnalytics(path=tmp_path / "analytics" / "queries.jsonl", max_bytes=max_bytes)


def _row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "timestamp": "2026-08-05T10:00:00+00:00",
        "query": "Is he open to relocation?",
        "mode": "recruiter",
        "outcome": OUTCOME_OK,
        "retrieved_chunks": 3,
        "has_context": True,
        "tools_used": [],
        "latency_ms": 120.0,
        "prompt_tokens": 100,
        "completion_tokens": 20,
        "total_tokens": 120,
    }
    row.update(overrides)
    return row


def _lines(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


# --- writing ---------------------------------------------------------------


async def test_record_appends_one_json_line(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)

    await analytics.record(
        QueryRecord(query="Does he need a visa?", mode="recruiter", outcome=OUTCOME_OK)
    )
    await analytics.record(
        QueryRecord(query="What is his stack?", mode="default", outcome=OUTCOME_OK)
    )

    rows = _lines(analytics.path)
    assert [r["query"] for r in rows] == ["Does he need a visa?", "What is his stack?"]


async def test_record_creates_the_directory_if_it_is_missing(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)
    assert not analytics.path.parent.exists()

    await analytics.record(QueryRecord(query="hi", mode="default", outcome="ok"))

    assert analytics.path.exists()


async def test_ensure_directory_makes_the_log_directory(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)

    analytics.ensure_directory()

    assert analytics.path.parent.is_dir()


async def test_ensure_directory_swallows_an_unusable_path(tmp_path: Path) -> None:
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory")

    QueryAnalytics(path=blocker / "queries.jsonl", max_bytes=1000).ensure_directory()


async def test_record_stores_no_identifying_fields(tmp_path: Path) -> None:
    """Privacy: the question is the signal, the person asking it is not."""
    analytics = _analytics(tmp_path)

    await analytics.record(
        QueryRecord(query="Where does he live?", mode="recruiter", outcome=OUTCOME_OK)
    )

    row = _lines(analytics.path)[0]
    assert set(row) == EXPECTED_KEYS
    assert not {"ip", "client_ip", "user_agent", "session_id"} & set(row)


async def test_record_persists_every_retrieval_and_cost_field(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)

    await analytics.record(
        QueryRecord(
            query="Show me his repos",
            mode="interview",
            outcome=OUTCOME_OK,
            retrieved_chunks=4,
            has_context=True,
            tools_used=["list_repositories"],
            latency_ms=987.6,
            prompt_tokens=11,
            completion_tokens=22,
            total_tokens=33,
        )
    )

    row = _lines(analytics.path)[0]
    assert row["mode"] == "interview"
    assert row["retrieved_chunks"] == 4
    assert row["has_context"] is True
    assert row["tools_used"] == ["list_repositories"]
    assert row["latency_ms"] == 987.6
    assert row["total_tokens"] == 33
    assert row["timestamp"].endswith("+00:00"), "timestamps must be UTC"


async def test_record_swallows_an_io_error(tmp_path: Path) -> None:
    """A full or read-only volume must never surface to the caller."""
    blocker = tmp_path / "blocker"
    blocker.write_text("not a directory")
    analytics = QueryAnalytics(path=blocker / "queries.jsonl", max_bytes=1000)

    await analytics.record(QueryRecord(query="anything", mode="default", outcome=OUTCOME_OK))

    assert not (blocker / "queries.jsonl").exists()


async def test_unicode_questions_survive_a_round_trip(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)

    await analytics.record(QueryRecord(query="¿Habla español?", mode="default", outcome=OUTCOME_OK))

    assert _lines(analytics.path)[0]["query"] == "¿Habla español?"


# --- rotation --------------------------------------------------------------


async def test_log_rotates_to_a_single_backup_at_the_cap(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path, max_bytes=50)

    await analytics.record(QueryRecord(query="first", mode="default", outcome=OUTCOME_OK))
    assert not analytics.backup_path.exists(), "must not rotate before the cap is reached"

    await analytics.record(QueryRecord(query="second", mode="default", outcome=OUTCOME_OK))

    assert [r["query"] for r in _lines(analytics.backup_path)] == ["first"]
    assert [r["query"] for r in _lines(analytics.path)] == ["second"]


async def test_rotation_keeps_only_one_generation(tmp_path: Path) -> None:
    """The volume is small: the second rotation drops the oldest history."""
    analytics = _analytics(tmp_path, max_bytes=50)

    for query in ("first", "second", "third"):
        await analytics.record(QueryRecord(query=query, mode="default", outcome=OUTCOME_OK))

    assert [r["query"] for r in _lines(analytics.backup_path)] == ["second"]
    assert [r["query"] for r in _lines(analytics.path)] == ["third"]
    assert sorted(p.name for p in analytics.path.parent.iterdir()) == [
        "queries.jsonl",
        "queries.jsonl.1",
    ]


async def test_a_zero_cap_disables_rotation(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path, max_bytes=0)

    for query in ("a", "b", "c"):
        await analytics.record(QueryRecord(query=query, mode="default", outcome=OUTCOME_OK))

    assert len(_lines(analytics.path)) == 3
    assert not analytics.backup_path.exists()


async def test_summary_reads_the_rotated_backup_too(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path, max_bytes=50)

    await analytics.record(QueryRecord(query="first", mode="default", outcome=OUTCOME_OK))
    await analytics.record(QueryRecord(query="second", mode="default", outcome=OUTCOME_OK))

    summary = await analytics.summary()
    assert summary.total_queries == 2
    assert {q.question for q in summary.top_questions} == {"first", "second"}


# --- reading ---------------------------------------------------------------


async def test_summary_of_a_missing_log_is_empty(tmp_path: Path) -> None:
    summary = await _analytics(tmp_path).summary()

    assert summary.total_queries == 0
    assert summary.top_questions == []
    assert summary.unanswered_count == 0
    assert summary.tokens.total == 0
    assert summary.first_query_at is None


async def test_summary_skips_a_torn_line(tmp_path: Path) -> None:
    """A crash mid-write must not take the whole summary down with it."""
    analytics = _analytics(tmp_path)
    analytics.path.parent.mkdir(parents=True)
    analytics.path.write_text(
        json.dumps(_row(query="good")) + "\n" + '{"query": "torn half of a li\n'
    )

    summary = await analytics.summary()

    assert summary.total_queries == 1
    assert summary.top_questions[0].question == "good"


async def test_summary_round_trips_what_record_wrote(tmp_path: Path) -> None:
    analytics = _analytics(tmp_path)

    await analytics.record(
        QueryRecord(query="Does he need a visa?", mode="recruiter", outcome=OUTCOME_OK)
    )

    summary = await analytics.summary()
    assert summary.total_queries == 1
    assert summary.by_mode == {"recruiter": 1}
    # record() defaults retrieved_chunks to 0, so this is a retrieval miss.
    assert summary.unanswered_count == 1


# --- aggregation -----------------------------------------------------------


def test_normalise_question_folds_case_and_whitespace() -> None:
    assert normalise_question("  Does He   Need a VISA? ") == "does he need a visa?"


def test_summarise_counts_totals_and_modes() -> None:
    summary = summarise(
        [
            _row(mode="recruiter"),
            _row(mode="recruiter"),
            _row(mode="interview"),
        ]
    )

    assert summary.total_queries == 3
    assert summary.by_mode == {"recruiter": 2, "interview": 1}


def test_summarise_counts_questions_normalised_but_shows_an_original() -> None:
    summary = summarise(
        [
            _row(query="Does he need a visa?"),
            _row(query="  DOES HE NEED A VISA?  "),
            _row(query="does he   need a visa?"),
            _row(query="What is his stack?"),
        ]
    )

    assert [(q.question, q.count) for q in summary.top_questions] == [
        ("Does he need a visa?", 3),
        ("What is his stack?", 1),
    ]


def test_summarise_orders_top_questions_by_frequency_and_honours_the_limit() -> None:
    records = [_row(query="rare")] + [_row(query="common")] * 3 + [_row(query="middling")] * 2

    summary = summarise(records, limit=2)

    assert [(q.question, q.count) for q in summary.top_questions] == [
        ("common", 3),
        ("middling", 2),
    ]


def test_summarise_flags_queries_where_retrieval_found_nothing() -> None:
    summary = summarise(
        [
            _row(query="answered", has_context=True, retrieved_chunks=2),
            _row(query="no context", has_context=False, retrieved_chunks=2),
            _row(query="no chunks", has_context=True, retrieved_chunks=0),
            _row(query="no chunks", has_context=True, retrieved_chunks=0),
        ]
    )

    assert summary.unanswered_count == 3
    assert [(q.question, q.count) for q in summary.unanswered_questions] == [
        ("no chunks", 2),
        ("no context", 1),
    ]


def test_summarise_excludes_refusals_from_the_found_nothing_bucket() -> None:
    """A budget refusal never reaches retrieval, so counting it as a knowledge
    gap would inflate the one number worth acting on."""
    summary = summarise(
        [
            _row(query="refused", outcome=OUTCOME_REFUSED, has_context=False, retrieved_chunks=0),
            _row(query="failed", outcome=OUTCOME_ERROR, has_context=False, retrieved_chunks=0),
            _row(query="genuine gap", outcome=OUTCOME_OK, has_context=False, retrieved_chunks=0),
        ]
    )

    assert summary.unanswered_count == 1
    assert summary.unanswered_questions[0].question == "genuine gap"


def test_summarise_counts_errors_and_refusals() -> None:
    summary = summarise(
        [
            _row(outcome=OUTCOME_OK),
            _row(outcome=OUTCOME_ERROR),
            _row(outcome=OUTCOME_ERROR),
            _row(outcome=OUTCOME_REFUSED),
        ]
    )

    assert summary.error_count == 2
    assert summary.refusal_count == 1
    assert summary.by_outcome == {OUTCOME_ERROR: 2, OUTCOME_OK: 1, OUTCOME_REFUSED: 1}


def test_summarise_sums_tokens_and_ignores_missing_counts() -> None:
    summary = summarise(
        [
            _row(prompt_tokens=100, completion_tokens=20, total_tokens=120),
            _row(prompt_tokens=5, completion_tokens=1, total_tokens=6),
            # A refusal or a mid-stream failure reports no usage at all.
            _row(prompt_tokens=None, completion_tokens=None, total_tokens=None),
        ]
    )

    assert summary.tokens.prompt == 105
    assert summary.tokens.completion == 21
    assert summary.tokens.total == 126


def test_summarise_reports_the_window_the_log_covers() -> None:
    summary = summarise(
        [
            _row(timestamp="2026-08-05T12:00:00+00:00"),
            _row(timestamp="2026-08-01T09:00:00+00:00"),
            _row(timestamp="2026-08-03T11:00:00+00:00"),
        ]
    )

    assert summary.first_query_at == "2026-08-01T09:00:00+00:00"
    assert summary.last_query_at == "2026-08-05T12:00:00+00:00"


def test_summarise_tolerates_rows_missing_fields() -> None:
    summary = summarise([{}, {"query": "partial"}])

    assert summary.total_queries == 2
    assert summary.by_mode == {"unknown": 2}
    assert [q.question for q in summary.top_questions] == ["partial"]
    # Neither row is outcome "ok", so neither counts as a retrieval gap.
    assert summary.unanswered_count == 0


def test_summarise_ignores_blank_questions() -> None:
    summary = summarise([_row(query="   "), _row(query="real")])

    assert summary.total_queries == 2
    assert [q.question for q in summary.top_questions] == ["real"]


# --- wiring ----------------------------------------------------------------


def test_build_query_analytics_uses_the_configured_settings() -> None:
    settings = Settings(analytics_log_path="/tmp/custom/log.jsonl", analytics_max_bytes=42)

    analytics = build_query_analytics(settings)

    assert analytics.path == Path("/tmp/custom/log.jsonl")
    assert analytics.max_bytes == 42
    assert analytics.backup_path == Path("/tmp/custom/log.jsonl.1")
