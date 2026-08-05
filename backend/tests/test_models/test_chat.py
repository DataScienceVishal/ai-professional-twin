import pytest
from pydantic import ValidationError

from app.config import get_settings
from app.models.chat import MAX_CONTENT_CHARS, ChatRequest


def _request(*messages: tuple[str, str]) -> ChatRequest:
    return ChatRequest.model_validate(
        {"messages": [{"role": role, "content": content} for role, content in messages]}
    )


def test_a_replayed_answer_longer_than_the_user_limit_is_accepted() -> None:
    """Regression: every follow-up question used to fail with a 422.

    The client replays the whole conversation, so the assistant's previous
    answer arrives back as input. A single 2000-character cap rejected the
    server's own output, and the second turn of any conversation died.
    """
    answer = "### Architecture\n\n" + "The retrieval pipeline. " * 200

    request = _request(
        ("user", "How does retrieval work?"), ("assistant", answer), ("user", "Why?")
    )

    assert len(answer) > MAX_CONTENT_CHARS["user"]
    assert request.messages[1].content == answer


def test_a_user_turn_is_still_capped() -> None:
    """The cap is a real guard on input: a pasted wall of text is prompt spend."""
    with pytest.raises(ValidationError, match="at most 2000 characters"):
        _request(("user", "x" * (MAX_CONTENT_CHARS["user"] + 1)))


def test_an_assistant_turn_is_still_capped() -> None:
    """A replayed answer is client-supplied, so a forged one must not be unbounded."""
    with pytest.raises(ValidationError, match="at most"):
        _request(("assistant", "x" * (MAX_CONTENT_CHARS["assistant"] + 1)))


def test_the_assistant_cap_clears_what_the_model_can_generate() -> None:
    """The server must never reject an answer it produced itself.

    An assistant turn is bounded by `llm_max_output_tokens`, and no token is
    worth anything close to six characters of prose. If that ceiling is ever
    raised past this headroom, raise the assistant cap with it.
    """
    worst_case_chars_per_token = 6
    longest_possible_answer = get_settings().llm_max_output_tokens * worst_case_chars_per_token

    assert MAX_CONTENT_CHARS["assistant"] >= longest_possible_answer
