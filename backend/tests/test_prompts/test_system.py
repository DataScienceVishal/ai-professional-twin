from app.prompts.system import build_system_prompt
from app.prompts.templates import ChatMode


def test_build_default_prompt_contains_identity() -> None:
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context="")
    assert "Vishal Khan" in prompt
    assert "AI Professional Twin" in prompt


def test_build_recruiter_prompt_contains_mode_instructions() -> None:
    prompt = build_system_prompt(mode=ChatMode.RECRUITER, rag_context="")
    assert "recruiter" in prompt.lower()
    assert "concise" in prompt.lower()


def test_build_interview_prompt_contains_mode_instructions() -> None:
    prompt = build_system_prompt(mode=ChatMode.INTERVIEW, rag_context="")
    assert "technical" in prompt.lower()


def test_rag_context_injected() -> None:
    context = "[Source: resume]\nData Engineer at Accenture"
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context=context)
    assert "Data Engineer at Accenture" in prompt
    assert "[Source: resume]" in prompt


def test_empty_rag_context_handled() -> None:
    prompt = build_system_prompt(mode=ChatMode.DEFAULT, rag_context="")
    assert "no retrieved information" in prompt.lower() or "not available" in prompt.lower()
