"""The recorded answer on the first screen and the entry it cites must share the checked facts.

`frontend/src/lib/exhibit.ts` quotes one real answer from the live assistant
and cites career_qa.yaml's `availability` entry as its source. These tests
fail only when that entry stops stating one of the facts in FACTS, or when the
quote stops stating them or citing the entry. Every other edit to either file
passes unnoticed: after the entry is reworded, the quote is recorded again by hand.
"""

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
EXHIBIT = REPO / "frontend" / "src" / "lib" / "exhibit.ts"
CAREER_QA = REPO / "backend" / "knowledge" / "career_qa.yaml"

# Facts the quoted answer states, each of which the cited entry must state too.
FACTS = ("January 2027", "20 hours per week", "internship")


def _availability_answer() -> str:
    entries = yaml.safe_load(CAREER_QA.read_text())
    entry = next(e for e in entries if e.get("topic") == "availability")
    return " ".join(str(entry["answer"]).split())


def test_cited_entry_still_states_the_checked_facts() -> None:
    answer = _availability_answer()
    for fact in FACTS:
        assert fact in answer, f"career_qa.yaml availability no longer says {fact!r}"


def test_quote_states_the_same_facts_and_cites_that_entry() -> None:
    exhibit = EXHIBIT.read_text().replace("**", "")
    for fact in FACTS:
        assert fact in exhibit
    assert "detail: 'availability'" in exhibit
