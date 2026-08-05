from pydantic import BaseModel

# The shapes served by GET /analytics. Everything here is aggregated: the
# endpoint never returns raw log rows.


class QuestionCount(BaseModel):
    """One distinct question and how often it was asked.

    Counting happens on a normalised form (trimmed, whitespace-collapsed,
    lowercased) so "Visa?" and " visa? " are one entry, but `question` holds a
    representative original because a wall of lowercase is hard to skim.
    """

    question: str
    count: int


class TokenTotals(BaseModel):
    prompt: int = 0
    completion: int = 0
    total: int = 0


class AnalyticsSummary(BaseModel):
    total_queries: int
    by_mode: dict[str, int]
    by_outcome: dict[str, int]
    error_count: int
    refusal_count: int
    top_questions: list[QuestionCount]
    # Questions where retrieval came back with nothing usable - the list worth
    # acting on, because each one is a gap in the knowledge base.
    unanswered_count: int
    unanswered_questions: list[QuestionCount]
    tokens: TokenTotals
    # The window the retained log actually covers. Rotation discards the oldest
    # history, so totals mean little without knowing where they start.
    first_query_at: str | None = None
    last_query_at: str | None = None
