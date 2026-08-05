import pytest

from app.prompts.system import build_system_prompt
from app.prompts.templates import CITATION_RULES, ChatMode


def test_build_default_prompt_contains_identity() -> None:
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context="")
    assert "Vishal Khan" in prompt
    assert "professional assistant" in prompt.lower()


def test_build_recruiter_prompt_contains_mode_instructions() -> None:
    prompt = build_system_prompt(mode=ChatMode.RECRUITER, rag_context="")
    assert "recruiter evaluating Vishal" in prompt
    assert "Next step:" in prompt


def test_build_interview_prompt_contains_mode_instructions() -> None:
    prompt = build_system_prompt(mode=ChatMode.INTERVIEW, rag_context="")
    assert "technical interviewer" in prompt


def test_rag_context_injected() -> None:
    context = "[Source: resume]\nData Engineer at Teleperformance"
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context=context)
    assert "Data Engineer at Teleperformance" in prompt
    assert "[Source: resume]" in prompt


def test_rag_context_is_delimited_and_marked_untrusted() -> None:
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context="some retrieved text")
    assert "<retrieved_context>" in prompt
    assert "</retrieved_context>" in prompt
    assert "untrusted" in prompt.lower()


def test_empty_rag_context_handled() -> None:
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context="")
    assert "no retrieved information" in prompt.lower() or "not available" in prompt.lower()


@pytest.mark.parametrize("mode", [ChatMode.DEFAULT, ChatMode.RECRUITER])
def test_reader_facing_modes_suppress_inline_citations(mode: ChatMode) -> None:
    """Chips below the answer already show provenance; inline markers are clutter."""
    prompt = build_system_prompt(mode=mode, rag_context="ctx")
    assert "Do NOT write inline source markers" in prompt


def test_interview_mode_keeps_inline_citations() -> None:
    """A technical reader wants to see retrieval provenance in the prose."""
    prompt = build_system_prompt(mode=ChatMode.INTERVIEW, rag_context="ctx")
    assert "[Source: X] notation" in prompt
    assert "Do NOT write inline source markers" not in prompt


def test_every_mode_has_a_citation_rule() -> None:
    assert set(CITATION_RULES) == set(ChatMode)


@pytest.mark.parametrize("mode", list(ChatMode))
def test_technical_questions_about_own_work_are_in_scope(mode: ChatMode) -> None:
    """Regression: the scope rule used to make the assistant refuse to explain the
    RAG architecture of this very project, which is one of its own suggestion chips."""
    prompt = build_system_prompt(mode=mode, rag_context="")
    assert "ALWAYS answer technical questions about the systems Vishal has built" in prompt
    assert "including this" in prompt


@pytest.mark.parametrize("mode", list(ChatMode))
def test_personal_questions_are_deflected_not_refused(mode: ChatMode) -> None:
    prompt = build_system_prompt(mode=mode, rag_context="")
    assert "do NOT refuse rudely" in prompt


@pytest.mark.parametrize("mode", list(ChatMode))
def test_compensation_is_never_volunteered(mode: ChatMode) -> None:
    prompt = build_system_prompt(mode=mode, rag_context="")
    assert "Never raise compensation unless the user asks" in prompt
