"""The page's Sources list must name exactly the files the assistant reads.

`frontend/src/components/sheet/sources-list.tsx` tells visitors which local
files the answers come from, and `load_all_knowledge` in `app/rag/chunker.py`
decides which files are read. If one changes without the other, the page would
name a file the assistant never reads, or leave one out, so this fails until the
two lists agree again.
"""

import re
from pathlib import Path

import pytest

from app.rag import chunker
from app.rag.store import Document

REPO = Path(__file__).resolve().parents[2]
SOURCES_LIST = REPO / "frontend" / "src" / "components" / "sheet" / "sources-list.tsx"
KNOWLEDGE = REPO / "backend" / "knowledge"


def test_sources_list_names_exactly_the_files_the_assistant_reads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listed = re.findall(r"'([\w.]+\.(?:yaml|pdf))'", SOURCES_LIST.read_text())
    read: list[str] = []

    def record_yaml(path: Path, file_type: str) -> list[Document]:
        read.append(path.name)
        return []

    def record_pdf(path: Path) -> list[Document]:
        read.append(path.name)
        return []

    # The real folder, so a configured file that is missing on disk counts as unread.
    monkeypatch.setattr(chunker, "chunk_yaml_file", record_yaml)
    monkeypatch.setattr(chunker, "chunk_resume_pdf", record_pdf)
    chunker.load_all_knowledge(KNOWLEDGE)

    assert sorted(listed) == sorted(read), "the Sources list and load_all_knowledge disagree"
