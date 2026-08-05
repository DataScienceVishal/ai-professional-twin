from app.models.analytics import AnalyticsSummary, QuestionCount, TokenTotals


def test_token_totals_default_to_zero() -> None:
    totals = TokenTotals()
    assert (totals.prompt, totals.completion, totals.total) == (0, 0, 0)


def test_question_count_pairs_an_original_with_a_frequency() -> None:
    entry = QuestionCount(question="Does he need a visa?", count=7)
    assert entry.question == "Does he need a visa?"
    assert entry.count == 7


def test_analytics_summary_serialises_the_whole_shape() -> None:
    summary = AnalyticsSummary(
        total_queries=2,
        by_mode={"recruiter": 2},
        by_outcome={"ok": 2},
        error_count=0,
        refusal_count=0,
        top_questions=[QuestionCount(question="Who is Vishal?", count=2)],
        unanswered_count=1,
        unanswered_questions=[QuestionCount(question="Who is Vishal?", count=1)],
        tokens=TokenTotals(prompt=10, completion=5, total=15),
        first_query_at="2026-08-01T09:00:00+00:00",
        last_query_at="2026-08-05T12:00:00+00:00",
    )

    dumped = summary.model_dump()
    assert dumped["tokens"] == {"prompt": 10, "completion": 5, "total": 15}
    assert dumped["top_questions"] == [{"question": "Who is Vishal?", "count": 2}]


def test_the_window_is_optional_for_an_empty_log() -> None:
    summary = AnalyticsSummary(
        total_queries=0,
        by_mode={},
        by_outcome={},
        error_count=0,
        refusal_count=0,
        top_questions=[],
        unanswered_count=0,
        unanswered_questions=[],
        tokens=TokenTotals(),
    )

    assert summary.first_query_at is None
    assert summary.last_query_at is None
