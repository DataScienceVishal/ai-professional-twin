# AI Professional Twin V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a recruiter-ready AI Professional Twin with FastAPI backend, RAG pipeline, and React frontend - deployed on Railway + Vercel at $0/month.

**Architecture:** Two independently deployed services. Python/FastAPI backend with ChromaDB RAG pipeline using GitHub Models for LLM and embeddings. React + Vite + Tailwind frontend with real SSE streaming, recruiter/interview modes, and project explorer.

**Tech Stack:** Python 3.12, FastAPI, uv, ChromaDB, OpenAI SDK (GitHub Models), React 19, Vite, TailwindCSS, Framer Motion, Docker, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-07-11-ai-professional-twin-v2-design.md`

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `pyproject.toml` | Project metadata, dependencies, tool config (ruff, mypy, pytest) |
| `.env.example` | Documented env vars with dummy values |
| `Dockerfile` | Multi-stage build: builder (uv + deps) and runtime (slim, non-root) |
| `app/__init__.py` | Empty package marker |
| `app/main.py` | FastAPI app factory, lifespan (ChromaDB init), middleware (CORS, rate limit, logging) |
| `app/config.py` | Pydantic Settings - all env var config with typed defaults |
| `app/routers/__init__.py` | Empty package marker |
| `app/routers/health.py` | `GET /health` - service status + ChromaDB connectivity |
| `app/routers/chat.py` | `POST /chat` - SSE streaming endpoint, orchestrates RAG + LLM |
| `app/routers/knowledge.py` | `GET /projects`, `GET /projects/{slug}`, `GET /skills`, `GET /resume/download` |
| `app/services/__init__.py` | Empty package marker |
| `app/services/llm.py` | GitHub Models client wrapper - chat completion with streaming |
| `app/services/rag.py` | RAG orchestrator - ties retriever + prompt builder + LLM together |
| `app/services/github_api.py` | GitHub REST API client - fetch repos, READMEs, languages |
| `app/rag/__init__.py` | Empty package marker |
| `app/rag/embeddings.py` | Embedding model wrapper using GitHub Models text-embedding-3-small |
| `app/rag/store.py` | ChromaDB interface - init, add documents, query, persist |
| `app/rag/chunker.py` | Loaders + semantic chunking with metadata for each source type |
| `app/rag/retriever.py` | Hybrid search (dense + keyword), RRF fusion, context assembly |
| `app/prompts/__init__.py` | Empty package marker |
| `app/prompts/system.py` | System prompt builder - assembles composable layers per request |
| `app/prompts/templates.py` | Mode-specific prompt templates (default, recruiter, interview) |
| `app/models/__init__.py` | Empty package marker |
| `app/models/chat.py` | Pydantic schemas: Message, ChatRequest, ChatMode, SSE event types |
| `app/models/knowledge.py` | Pydantic schemas: Project, Skill, Certificate, SkillCategory |
| `knowledge/projects.yaml` | Structured project data |
| `knowledge/skills.yaml` | Skills grouped by category |
| `knowledge/career_qa.yaml` | Pre-written Q&A pairs |
| `knowledge/certificates.yaml` | Certifications with metadata |
| `knowledge/linkedin.yaml` | LinkedIn profile data (manually maintained) |
| `knowledge/resume.pdf` | Resume PDF (copied from existing `data/vishal_khan.pdf`) |
| `tests/conftest.py` | Shared fixtures: test client, mock services, temp ChromaDB |
| `tests/test_rag/test_chunker.py` | Tests for document loading and chunking |
| `tests/test_rag/test_embeddings.py` | Tests for embedding wrapper |
| `tests/test_rag/test_store.py` | Tests for ChromaDB operations |
| `tests/test_rag/test_retriever.py` | Tests for hybrid search and context assembly |
| `tests/test_services/test_llm.py` | Tests for LLM client |
| `tests/test_services/test_rag_service.py` | Tests for RAG orchestrator |
| `tests/test_services/test_github_api.py` | Tests for GitHub API client |
| `tests/test_routers/test_health.py` | Tests for health endpoint |
| `tests/test_routers/test_chat.py` | Tests for chat SSE endpoint |
| `tests/test_routers/test_knowledge.py` | Tests for knowledge endpoints |
| `tests/test_prompts/test_system.py` | Tests for prompt assembly |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite config with proxy for dev |
| `tailwind.config.ts` | Tailwind theme - dark cyberpunk colors, fonts |
| `index.html` | HTML shell |
| `src/main.tsx` | React entry point |
| `src/app.tsx` | Root component, layout wrapper |
| `src/styles/globals.css` | Tailwind directives + custom design tokens |
| `src/lib/api.ts` | Backend API client - typed fetch + SSE helpers |
| `src/lib/constants.ts` | Mode definitions, suggestion chips per mode |
| `src/lib/types.ts` | Shared TypeScript types (Message, Project, etc.) |
| `src/hooks/use-chat.ts` | SSE streaming hook - message state, send, abort |
| `src/hooks/use-projects.ts` | Fetch projects from backend |
| `src/components/layout/sidebar.tsx` | Left sidebar - profile, mode switcher, links |
| `src/components/layout/header.tsx` | Mobile header |
| `src/components/chat/chat-panel.tsx` | Message list with auto-scroll |
| `src/components/chat/message.tsx` | Single message - markdown rendering + citations |
| `src/components/chat/input-bar.tsx` | Text input + send button |
| `src/components/chat/suggestion-chips.tsx` | Context-aware suggestion buttons |
| `src/components/chat/source-citation.tsx` | Collapsible source tag |
| `src/components/modes/recruiter-panel.tsx` | Quick-action buttons for recruiters |
| `src/components/modes/interview-panel.tsx` | Technical question categories |
| `src/components/projects/project-grid.tsx` | Project card grid |
| `src/components/projects/project-card.tsx` | Individual project card |
| `src/components/ui/button.tsx` | Reusable button primitive |
| `src/components/ui/badge.tsx` | Tech stack badge |
| `src/components/ui/skeleton.tsx` | Loading skeleton |
| `src/pages/home.tsx` | Main page - landing hero + chat + mode panels |

### Root

| File | Responsibility |
|------|---------------|
| `.github/workflows/ci.yml` | CI pipeline: lint, type check, test, build, deploy |

---

## Milestone 1: Backend Scaffolding

### Task 1: Python Project Setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`

- [ ] **Step 1: Initialize backend directory and pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "ai-professional-twin"
version = "0.2.0"
description = "AI Professional Twin - RAG-powered digital professional identity"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic>=2.9.0",
    "pydantic-settings>=2.5.0",
    "openai>=1.50.0",
    "chromadb>=0.5.0",
    "pypdf>=4.0.0",
    "pyyaml>=6.0.0",
    "structlog>=24.0.0",
    "slowapi>=0.1.9",
    "httpx>=0.27.0",
    "sse-starlette>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
    "ruff>=0.6.0",
    "mypy>=1.11.0",
    "types-PyYAML>=6.0.0",
]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "TCH"]

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create .env.example**

```bash
# backend/.env.example
# GitHub Models API token (required)
GITHUB_TOKEN=ghp_your_token_here

# GitHub username for API queries
GITHUB_USERNAME=DataScienceVishal

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# ChromaDB persistence directory
CHROMA_PERSIST_DIR=./chromadb_data

# Log level
LOG_LEVEL=info
```

- [ ] **Step 3: Create config module**

```python
# backend/app/__init__.py
```

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    github_username: str = "DataScienceVishal"
    cors_origins: list[str] = ["http://localhost:5173"]
    chroma_persist_dir: str = "./chromadb_data"
    log_level: str = "info"
    llm_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"
    github_models_base_url: str = "https://models.github.ai/inference"
    rate_limit: str = "30/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Install dependencies and verify**

```bash
cd backend
uv sync
uv run python -c "from app.config import Settings; print('Config module OK')"
```

Expected: prints `Config module OK`

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/.env.example backend/app/__init__.py backend/app/config.py
git commit -m "feat(backend): initialize Python project with uv and config module"
```

---

### Task 2: FastAPI App with Health Endpoint

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_routers/__init__.py`
- Create: `backend/tests/test_routers/test_health.py`

- [ ] **Step 1: Write the health endpoint test**

```python
# backend/tests/__init__.py
```

```python
# backend/tests/test_routers/__init__.py
```

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)
```

```python
# backend/tests/test_routers/test_health.py
from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "version" in body
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_routers/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement FastAPI app and health router**

```python
# backend/app/routers/__init__.py
```

```python
# backend/app/routers/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "version": "0.2.0",
    }
```

```python
# backend/app/main.py
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    logger = structlog.get_logger()
    await logger.ainfo("Starting AI Professional Twin backend")
    yield
    await logger.ainfo("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Professional Twin",
        version="0.2.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)

    return app
```

- [ ] **Step 4: Create a `.env` for local development**

```bash
# Copy .env.example and fill in your GitHub token
cp .env.example .env
# Edit .env and set GITHUB_TOKEN=<your actual token>
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && uv run pytest tests/test_routers/test_health.py -v
```

Expected: PASS

- [ ] **Step 6: Verify the server starts**

```bash
cd backend && uv run uvicorn app.main:create_app --factory --port 8000 &
curl http://localhost:8000/health
kill %1
```

Expected: `{"status":"healthy","version":"0.2.0"}`

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/app/routers/ backend/tests/
git commit -m "feat(backend): add FastAPI app with health endpoint and test"
```

---

### Task 3: Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Write the multi-stage Dockerfile**

```dockerfile
# backend/Dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm AS runtime

RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid 1000 --shell /bin/bash appuser

WORKDIR /app
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Generate lock file**

```bash
cd backend && uv lock
```

- [ ] **Step 3: Build and test Docker image**

```bash
cd backend && docker build -t ai-twin-backend .
docker run --rm -e GITHUB_TOKEN=test -p 8000:8000 ai-twin-backend &
sleep 3
curl http://localhost:8000/health
docker stop $(docker ps -q --filter ancestor=ai-twin-backend)
```

Expected: `{"status":"healthy","version":"0.2.0"}`

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/uv.lock
git commit -m "feat(backend): add multi-stage Dockerfile with uv"
```

---

## Milestone 2: Knowledge Base

### Task 4: Knowledge Data Files

**Files:**
- Create: `backend/knowledge/projects.yaml`
- Create: `backend/knowledge/skills.yaml`
- Create: `backend/knowledge/career_qa.yaml`
- Create: `backend/knowledge/certificates.yaml`
- Create: `backend/knowledge/linkedin.yaml`
- Copy: `data/vishal_khan.pdf` to `backend/knowledge/resume.pdf`

- [ ] **Step 1: Create projects.yaml**

Populate with real project data from Vishal's GitHub and resume. Minimum 3 projects:

```yaml
# backend/knowledge/projects.yaml
- name: AI Professional Twin
  slug: ai-professional-twin
  description: >
    A RAG-powered AI assistant that serves as a digital professional identity.
    Features semantic chunking with metadata filtering, hybrid retrieval,
    real SSE streaming, and recruiter/interview modes. Built with FastAPI,
    ChromaDB, React, and GitHub Models.
  tech_stack: [Python, FastAPI, ChromaDB, React, TypeScript, Docker]
  github_url: https://github.com/DataScienceVishal/my-ai-resume
  category: AI/LLM
  highlights:
    - Semantic chunking with metadata-filtered retrieval
    - Composable prompt architecture with mode switching
    - Real Server-Sent Events streaming
    - Hybrid search combining dense embeddings and keyword matching

- name: Reinforcement Learning Research
  slug: rl-research
  description: >
    MSc thesis research on reinforcement learning approaches.
    Implemented and evaluated RL algorithms for decision-making tasks.
  tech_stack: [Python, PyTorch, OpenAI Gym, NumPy]
  github_url: https://github.com/DataScienceVishal
  category: Research/ML
  highlights:
    - Custom RL environment implementations
    - Comparative analysis of policy gradient methods
    - Reproducible experiment framework
```

Note: Vishal should expand this with all his real projects.

- [ ] **Step 2: Create skills.yaml**

```yaml
# backend/knowledge/skills.yaml
- category: Programming Languages
  skills: [Python, SQL, JavaScript, TypeScript]
  proficiency: advanced

- category: Machine Learning
  skills: [PyTorch, TensorFlow, Scikit-Learn, XGBoost, Keras]
  proficiency: advanced

- category: LLM Engineering
  skills: [RAG, LangChain, Prompt Engineering, Vector Databases, ChromaDB, FAISS]
  proficiency: advanced

- category: Data Engineering
  skills: [Azure Data Factory, Databricks, ETL Pipelines, Apache Spark]
  proficiency: advanced

- category: Cloud & DevOps
  skills: [Azure, Docker, GitHub Actions, Vercel, Railway]
  proficiency: intermediate

- category: Web Frameworks
  skills: [FastAPI, React, Streamlit]
  proficiency: intermediate

- category: Databases
  skills: [PostgreSQL, MongoDB, ChromaDB, FAISS]
  proficiency: intermediate
```

- [ ] **Step 3: Create career_qa.yaml**

```yaml
# backend/knowledge/career_qa.yaml
- question: Why should we hire Vishal?
  answer: >
    Vishal combines deep ML/AI expertise with production data engineering
    experience. At Accenture, he built ETL pipelines processing millions
    of records using Azure Data Factory and Databricks. He is now pursuing
    an MSc in AI and Computer Science at Northeastern University London,
    with hands-on experience building RAG systems, LLM applications, and
    production-grade AI services. He bridges the gap between research and
    engineering.
  topic: hiring

- question: What is Vishal's career goal?
  answer: >
    Vishal aims to work as an Applied AI Engineer, building production AI
    systems that solve real problems. He is particularly interested in
    LLM applications, RAG architectures, and agentic AI systems.
  topic: career

- question: What is Vishal's strongest technical skill?
  answer: >
    Building end-to-end AI systems that go from research to production.
    He understands the full stack: ML model training, embedding pipelines,
    retrieval systems, API design, and deployment. His AI Professional Twin
    project demonstrates this range.
  topic: skills

- question: Tell me about Vishal's work experience
  answer: >
    Vishal worked as a Data Engineer at Accenture from August 2021 to
    August 2023. He built and maintained ETL pipelines using Azure Data
    Factory and Databricks, processing large-scale data for enterprise
    clients. This experience gave him strong fundamentals in data systems,
    cloud infrastructure, and production engineering.
  topic: experience

- question: What is Vishal studying?
  answer: >
    MSc in AI and Computer Science at Northeastern University London.
    His coursework covers machine learning, deep learning, reinforcement
    learning, and AI systems design. His thesis focuses on reinforcement
    learning.
  topic: education
```

- [ ] **Step 4: Create certificates.yaml**

```yaml
# backend/knowledge/certificates.yaml
- name: Azure Data Fundamentals
  issuer: Microsoft
  date: "2022"
  credential_id: ""
  url: ""

# Vishal should add all real certificates here
```

- [ ] **Step 5: Create linkedin.yaml**

```yaml
# backend/knowledge/linkedin.yaml
headline: MSc AI & Computer Science | Ex-Data Engineer at Accenture
url: https://www.linkedin.com/in/vishal-khan-a53aboraaa
location: London, United Kingdom
current_role: MSc Student & AI Engineer
education:
  - institution: Northeastern University London
    degree: MSc AI and Computer Science
    dates: "2023 - 2025"
  - institution: Previous University
    degree: Bachelor's Degree
    dates: ""

experience:
  - company: Accenture
    role: Data Engineer
    dates: Aug 2021 - Aug 2023
    description: >
      Built ETL pipelines using Azure Data Factory and Databricks.
      Processed large-scale enterprise data. Worked with SQL, Python,
      and Azure cloud services.

summary: >
  AI and Computer Science graduate student with production data engineering
  experience. Focused on applied AI, LLM systems, and RAG architectures.
  Building production-grade AI applications that demonstrate modern
  engineering practices.
```

- [ ] **Step 6: Copy resume PDF**

```bash
cp data/vishal_khan.pdf backend/knowledge/resume.pdf
```

- [ ] **Step 7: Commit**

```bash
git add backend/knowledge/
git commit -m "feat(backend): add knowledge base files (projects, skills, career QA, LinkedIn)"
```

---

### Task 5: Pydantic Knowledge Models

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/knowledge.py`

- [ ] **Step 1: Write tests for knowledge models**

```python
# backend/tests/test_models/__init__.py
```

```python
# backend/tests/test_models/test_knowledge.py
from app.models.knowledge import Project, Skill, SkillCategory


def test_project_from_yaml_dict() -> None:
    data = {
        "name": "AI Twin",
        "slug": "ai-twin",
        "description": "An AI assistant",
        "tech_stack": ["Python", "FastAPI"],
        "github_url": "https://github.com/user/repo",
        "category": "AI/LLM",
        "highlights": ["Feature 1"],
    }
    project = Project(**data)
    assert project.name == "AI Twin"
    assert project.tech_stack == ["Python", "FastAPI"]


def test_skill_category_from_yaml_dict() -> None:
    data = {
        "category": "Machine Learning",
        "skills": ["PyTorch", "TensorFlow"],
        "proficiency": "advanced",
    }
    cat = SkillCategory(**data)
    assert cat.category == "Machine Learning"
    assert len(cat.skills) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_models/test_knowledge.py -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement knowledge models**

```python
# backend/app/models/__init__.py
```

```python
# backend/app/models/knowledge.py
from pydantic import BaseModel


class Project(BaseModel):
    name: str
    slug: str
    description: str
    tech_stack: list[str]
    github_url: str
    category: str
    highlights: list[str] = []


class SkillCategory(BaseModel):
    category: str
    skills: list[str]
    proficiency: str


class Skill(BaseModel):
    name: str
    category: str
    proficiency: str


class Certificate(BaseModel):
    name: str
    issuer: str
    date: str
    credential_id: str = ""
    url: str = ""


class CareerQA(BaseModel):
    question: str
    answer: str
    topic: str


class LinkedInProfile(BaseModel):
    headline: str
    url: str
    location: str
    current_role: str
    summary: str
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_models/test_knowledge.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/ backend/tests/test_models/
git commit -m "feat(backend): add Pydantic knowledge models"
```

---

## Milestone 3: RAG Pipeline

### Task 6: Embedding Service

**Files:**
- Create: `backend/app/rag/__init__.py`
- Create: `backend/app/rag/embeddings.py`
- Create: `backend/tests/test_rag/__init__.py`
- Create: `backend/tests/test_rag/test_embeddings.py`

- [ ] **Step 1: Write tests for embedding service**

```python
# backend/tests/test_rag/__init__.py
```

```python
# backend/tests/test_rag/test_embeddings.py
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.embeddings import EmbeddingService


@pytest.fixture
def embedding_service() -> EmbeddingService:
    return EmbeddingService(
        api_key="test-key",
        base_url="https://models.github.ai/inference",
        model="text-embedding-3-small",
    )


@pytest.mark.asyncio
async def test_embed_single_text(embedding_service: EmbeddingService) -> None:
    mock_embedding = [0.1] * 1536
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=mock_embedding)]

    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await embedding_service.embed_texts(["hello world"])

    assert len(result) == 1
    assert len(result[0]) == 1536
    mock_create.assert_called_once_with(
        model="text-embedding-3-small", input=["hello world"]
    )


@pytest.mark.asyncio
async def test_embed_multiple_texts(embedding_service: EmbeddingService) -> None:
    mock_embeddings = [[0.1] * 1536, [0.2] * 1536]
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=e) for e in mock_embeddings]

    with patch.object(
        embedding_service.client.embeddings, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await embedding_service.embed_texts(["text one", "text two"])

    assert len(result) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_rag/test_embeddings.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement embedding service**

```python
# backend/app/rag/__init__.py
```

```python
# backend/app/rag/embeddings.py
from openai import AsyncOpenAI


class EmbeddingService:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.embeddings.create(
            model=self.model, input=texts
        )
        return [item.embedding for item in response.data]

    async def embed_query(self, query: str) -> list[float]:
        result = await self.embed_texts([query])
        return result[0]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_rag/test_embeddings.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/ backend/tests/test_rag/
git commit -m "feat(backend): add embedding service wrapping GitHub Models"
```

---

### Task 7: ChromaDB Store

**Files:**
- Create: `backend/app/rag/store.py`
- Create: `backend/tests/test_rag/test_store.py`

- [ ] **Step 1: Write tests for ChromaDB store**

```python
# backend/tests/test_rag/test_store.py
import tempfile

import pytest

from app.rag.store import ChromaStore, Document


@pytest.fixture
def store() -> ChromaStore:
    with tempfile.TemporaryDirectory() as tmpdir:
        s = ChromaStore(persist_dir=tmpdir, collection_name="test")
        yield s


def test_add_and_query_documents(store: ChromaStore) -> None:
    docs = [
        Document(
            id="doc1",
            text="Vishal worked as a Data Engineer at Accenture",
            metadata={"source": "resume", "section": "experience"},
            embedding=[0.1] * 10,
        ),
        Document(
            id="doc2",
            text="Built ETL pipelines using Azure Data Factory",
            metadata={"source": "resume", "section": "experience"},
            embedding=[0.2] * 10,
        ),
    ]
    store.add_documents(docs)
    results = store.query(query_embedding=[0.1] * 10, n_results=2)
    assert len(results) > 0
    assert results[0].id == "doc1"


def test_query_with_metadata_filter(store: ChromaStore) -> None:
    docs = [
        Document(
            id="proj1",
            text="AI Professional Twin project",
            metadata={"source": "projects", "name": "AI Twin"},
            embedding=[0.3] * 10,
        ),
        Document(
            id="skill1",
            text="Python, FastAPI, PyTorch",
            metadata={"source": "skills", "category": "ML"},
            embedding=[0.3] * 10,
        ),
    ]
    store.add_documents(docs)
    results = store.query(
        query_embedding=[0.3] * 10,
        n_results=5,
        where={"source": "projects"},
    )
    assert len(results) == 1
    assert results[0].metadata["source"] == "projects"


def test_document_count(store: ChromaStore) -> None:
    docs = [
        Document(
            id="d1", text="text 1", metadata={"source": "test"}, embedding=[0.1] * 10
        ),
        Document(
            id="d2", text="text 2", metadata={"source": "test"}, embedding=[0.2] * 10
        ),
    ]
    store.add_documents(docs)
    assert store.count() == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_rag/test_store.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement ChromaDB store**

```python
# backend/app/rag/store.py
from dataclasses import dataclass, field

import chromadb


@dataclass
class Document:
    id: str
    text: str
    metadata: dict[str, str]
    embedding: list[float] = field(default_factory=list)


@dataclass
class SearchResult:
    id: str
    text: str
    metadata: dict[str, str]
    distance: float


class ChromaStore:
    def __init__(self, persist_dir: str, collection_name: str = "knowledge") -> None:
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, documents: list[Document]) -> None:
        if not documents:
            return
        self.collection.upsert(
            ids=[d.id for d in documents],
            documents=[d.text for d in documents],
            metadatas=[d.metadata for d in documents],
            embeddings=[d.embedding for d in documents] if documents[0].embedding else None,
        )

    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict[str, str] | None = None,
    ) -> list[SearchResult]:
        kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
        }
        if where:
            kwargs["where"] = where

        results = self.collection.query(**kwargs)

        search_results: list[SearchResult] = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                search_results.append(
                    SearchResult(
                        id=doc_id,
                        text=results["documents"][0][i] if results["documents"] else "",
                        metadata=results["metadatas"][0][i] if results["metadatas"] else {},
                        distance=results["distances"][0][i] if results["distances"] else 0.0,
                    )
                )
        return search_results

    def count(self) -> int:
        return self.collection.count()

    def reset(self) -> None:
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection.name,
            metadata={"hnsw:space": "cosine"},
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_rag/test_store.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/store.py backend/tests/test_rag/test_store.py
git commit -m "feat(backend): add ChromaDB store with document CRUD and filtered query"
```

---

### Task 8: Document Chunker

**Files:**
- Create: `backend/app/rag/chunker.py`
- Create: `backend/tests/test_rag/test_chunker.py`

- [ ] **Step 1: Write tests for the chunker**

```python
# backend/tests/test_rag/test_chunker.py
import tempfile
from pathlib import Path

import yaml

from app.rag.chunker import chunk_yaml_file, chunk_projects, chunk_skills, chunk_career_qa
from app.rag.store import Document


def test_chunk_projects() -> None:
    projects = [
        {
            "name": "AI Twin",
            "slug": "ai-twin",
            "description": "A RAG-powered assistant",
            "tech_stack": ["Python", "FastAPI"],
            "github_url": "https://github.com/user/repo",
            "category": "AI/LLM",
            "highlights": ["Feature 1", "Feature 2"],
        }
    ]
    docs = chunk_projects(projects)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "projects"
    assert docs[0].metadata["name"] == "AI Twin"
    assert "Python" in docs[0].text
    assert "Feature 1" in docs[0].text


def test_chunk_skills() -> None:
    skills = [
        {"category": "ML", "skills": ["PyTorch", "TensorFlow"], "proficiency": "advanced"}
    ]
    docs = chunk_skills(skills)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "skills"
    assert docs[0].metadata["category"] == "ML"
    assert "PyTorch" in docs[0].text


def test_chunk_career_qa() -> None:
    qa_pairs = [
        {"question": "Why hire Vishal?", "answer": "Strong AI skills", "topic": "hiring"}
    ]
    docs = chunk_career_qa(qa_pairs)
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "career_qa"
    assert docs[0].metadata["topic"] == "hiring"
    assert "Why hire Vishal?" in docs[0].text
    assert "Strong AI skills" in docs[0].text


def test_chunk_yaml_file_projects() -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump(
            [{"name": "Test", "slug": "test", "description": "Desc",
              "tech_stack": ["Python"], "github_url": "https://gh.com",
              "category": "AI", "highlights": []}],
            f,
        )
        f.flush()
        docs = chunk_yaml_file(Path(f.name), "projects")
    assert len(docs) == 1
    assert docs[0].metadata["source"] == "projects"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_rag/test_chunker.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement the chunker**

```python
# backend/app/rag/chunker.py
from pathlib import Path

import yaml
from pypdf import PdfReader

from app.rag.store import Document


def chunk_projects(projects: list[dict]) -> list[Document]:
    docs: list[Document] = []
    for p in projects:
        tech = ", ".join(p.get("tech_stack", []))
        highlights = "\n".join(f"- {h}" for h in p.get("highlights", []))
        text = (
            f"Project: {p['name']}\n"
            f"Category: {p.get('category', '')}\n"
            f"Tech Stack: {tech}\n"
            f"Description: {p['description']}\n"
        )
        if highlights:
            text += f"Key Highlights:\n{highlights}\n"
        if p.get("github_url"):
            text += f"GitHub: {p['github_url']}\n"

        docs.append(
            Document(
                id=f"project-{p['slug']}",
                text=text,
                metadata={
                    "source": "projects",
                    "name": p["name"],
                    "category": p.get("category", ""),
                    "github_url": p.get("github_url", ""),
                },
            )
        )
    return docs


def chunk_skills(skills: list[dict]) -> list[Document]:
    docs: list[Document] = []
    for i, cat in enumerate(skills):
        skill_list = ", ".join(cat["skills"])
        text = (
            f"Skill Category: {cat['category']}\n"
            f"Proficiency: {cat['proficiency']}\n"
            f"Skills: {skill_list}\n"
        )
        docs.append(
            Document(
                id=f"skills-{i}-{cat['category'].lower().replace(' ', '-')}",
                text=text,
                metadata={
                    "source": "skills",
                    "category": cat["category"],
                    "proficiency": cat["proficiency"],
                },
            )
        )
    return docs


def chunk_career_qa(qa_pairs: list[dict]) -> list[Document]:
    docs: list[Document] = []
    for i, qa in enumerate(qa_pairs):
        text = f"Question: {qa['question']}\nAnswer: {qa['answer']}\n"
        docs.append(
            Document(
                id=f"career-qa-{i}-{qa['topic']}",
                text=text,
                metadata={
                    "source": "career_qa",
                    "topic": qa["topic"],
                },
            )
        )
    return docs


def chunk_certificates(certs: list[dict]) -> list[Document]:
    docs: list[Document] = []
    for i, cert in enumerate(certs):
        text = (
            f"Certificate: {cert['name']}\n"
            f"Issuer: {cert['issuer']}\n"
            f"Date: {cert['date']}\n"
        )
        docs.append(
            Document(
                id=f"cert-{i}-{cert['name'].lower().replace(' ', '-')}",
                text=text,
                metadata={"source": "certificates", "issuer": cert["issuer"]},
            )
        )
    return docs


def chunk_linkedin(data: dict) -> list[Document]:
    parts = [
        f"LinkedIn Profile: {data.get('headline', '')}",
        f"Location: {data.get('location', '')}",
        f"Current Role: {data.get('current_role', '')}",
        f"Summary: {data.get('summary', '')}",
    ]
    for exp in data.get("experience", []):
        parts.append(
            f"Experience: {exp['role']} at {exp['company']} ({exp['dates']}). "
            f"{exp.get('description', '')}"
        )
    for edu in data.get("education", []):
        parts.append(f"Education: {edu['degree']} at {edu['institution']} ({edu['dates']})")

    return [
        Document(
            id="linkedin-profile",
            text="\n".join(parts),
            metadata={"source": "linkedin", "url": data.get("url", "")},
        )
    ]


def chunk_resume_pdf(pdf_path: Path) -> list[Document]:
    reader = PdfReader(str(pdf_path))
    docs: list[Document] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            docs.append(
                Document(
                    id=f"resume-page-{i}",
                    text=text.strip(),
                    metadata={"source": "resume", "page": str(i + 1)},
                )
            )
    return docs


CHUNKER_MAP = {
    "projects": chunk_projects,
    "skills": chunk_skills,
    "career_qa": chunk_career_qa,
    "certificates": chunk_certificates,
}


def chunk_yaml_file(path: Path, file_type: str) -> list[Document]:
    with open(path) as f:
        data = yaml.safe_load(f)
    if file_type == "linkedin":
        return chunk_linkedin(data)
    chunker = CHUNKER_MAP.get(file_type)
    if not chunker:
        return []
    return chunker(data)


def load_all_knowledge(knowledge_dir: Path) -> list[Document]:
    docs: list[Document] = []

    yaml_files = {
        "projects.yaml": "projects",
        "skills.yaml": "skills",
        "career_qa.yaml": "career_qa",
        "certificates.yaml": "certificates",
        "linkedin.yaml": "linkedin",
    }
    for filename, file_type in yaml_files.items():
        path = knowledge_dir / filename
        if path.exists():
            docs.extend(chunk_yaml_file(path, file_type))

    resume_path = knowledge_dir / "resume.pdf"
    if resume_path.exists():
        docs.extend(chunk_resume_pdf(resume_path))

    return docs
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_rag/test_chunker.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/chunker.py backend/tests/test_rag/test_chunker.py
git commit -m "feat(backend): add document chunker with metadata for all knowledge sources"
```

---

### Task 9: Retriever with Hybrid Search

**Files:**
- Create: `backend/app/rag/retriever.py`
- Create: `backend/tests/test_rag/test_retriever.py`

- [ ] **Step 1: Write tests for the retriever**

```python
# backend/tests/test_rag/test_retriever.py
import pytest

from app.rag.retriever import (
    QueryClassifier,
    QueryIntent,
    Retriever,
    format_context,
)
from app.rag.store import SearchResult


def test_classify_project_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Tell me about the AI Twin project")
    assert intent == QueryIntent.PROJECTS


def test_classify_skills_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("What programming languages does Vishal know?")
    assert intent == QueryIntent.SKILLS


def test_classify_experience_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Where did Vishal work before?")
    assert intent == QueryIntent.EXPERIENCE


def test_classify_general_query() -> None:
    classifier = QueryClassifier()
    intent = classifier.classify("Tell me about Vishal")
    assert intent == QueryIntent.GENERAL


def test_format_context_with_sources() -> None:
    results = [
        SearchResult(
            id="doc1",
            text="Data Engineer at Accenture",
            metadata={"source": "resume", "section": "experience"},
            distance=0.1,
        ),
        SearchResult(
            id="doc2",
            text="AI Professional Twin project",
            metadata={"source": "projects", "name": "AI Twin"},
            distance=0.2,
        ),
    ]
    context, sources = format_context(results)
    assert "[Source: resume]" in context
    assert "[Source: projects]" in context
    assert "Data Engineer at Accenture" in context
    assert len(sources) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_rag/test_retriever.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement the retriever**

```python
# backend/app/rag/retriever.py
from dataclasses import dataclass
from enum import Enum

from app.rag.embeddings import EmbeddingService
from app.rag.store import ChromaStore, SearchResult


class QueryIntent(Enum):
    PROJECTS = "projects"
    SKILLS = "skills"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    GENERAL = "general"


INTENT_KEYWORDS: dict[QueryIntent, list[str]] = {
    QueryIntent.PROJECTS: [
        "project", "built", "build", "created", "portfolio", "github", "repository", "repo",
        "application", "app", "twin", "rag",
    ],
    QueryIntent.SKILLS: [
        "skill", "technology", "tech", "language", "framework", "tool", "know",
        "proficient", "experience with", "familiar", "stack",
    ],
    QueryIntent.EXPERIENCE: [
        "work", "job", "company", "role", "position", "accenture", "career",
        "employment", "professional", "engineer",
    ],
    QueryIntent.EDUCATION: [
        "study", "university", "degree", "msc", "course", "thesis", "academic",
        "northeastern", "student", "research",
    ],
}

INTENT_FILTER_MAP: dict[QueryIntent, dict[str, str] | None] = {
    QueryIntent.PROJECTS: {"source": "projects"},
    QueryIntent.SKILLS: {"source": "skills"},
    QueryIntent.EXPERIENCE: {"source": "resume"},
    QueryIntent.EDUCATION: {"source": "resume"},
    QueryIntent.GENERAL: None,
}


class QueryClassifier:
    def classify(self, query: str) -> QueryIntent:
        query_lower = query.lower()
        scores: dict[QueryIntent, int] = {intent: 0 for intent in QueryIntent}
        for intent, keywords in INTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    scores[intent] += 1
        best = max(scores, key=lambda k: scores[k])
        if scores[best] == 0:
            return QueryIntent.GENERAL
        return best


@dataclass
class SourceInfo:
    source: str
    detail: str


def format_context(results: list[SearchResult]) -> tuple[str, list[SourceInfo]]:
    context_parts: list[str] = []
    sources: list[SourceInfo] = []

    for result in results:
        source = result.metadata.get("source", "unknown")
        detail_parts = [
            v for k, v in result.metadata.items()
            if k != "source" and v
        ]
        detail = " > ".join(detail_parts) if detail_parts else ""

        context_parts.append(f"[Source: {source}]\n{result.text}\n")
        sources.append(SourceInfo(source=source, detail=detail))

    return "\n".join(context_parts), sources


class Retriever:
    def __init__(
        self,
        store: ChromaStore,
        embedding_service: EmbeddingService,
        top_k: int = 5,
    ) -> None:
        self.store = store
        self.embedding_service = embedding_service
        self.classifier = QueryClassifier()
        self.top_k = top_k

    async def retrieve(self, query: str) -> tuple[str, list[SourceInfo]]:
        intent = self.classifier.classify(query)
        query_embedding = await self.embedding_service.embed_query(query)

        metadata_filter = INTENT_FILTER_MAP.get(intent)

        results = self.store.query(
            query_embedding=query_embedding,
            n_results=self.top_k,
            where=metadata_filter,
        )

        if not results and metadata_filter:
            results = self.store.query(
                query_embedding=query_embedding,
                n_results=self.top_k,
            )

        return format_context(results)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_rag/test_retriever.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/retriever.py backend/tests/test_rag/test_retriever.py
git commit -m "feat(backend): add retriever with query classification and hybrid search"
```

---

## Milestone 4: LLM + Chat

### Task 10: Prompt Templates

**Files:**
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/app/prompts/templates.py`
- Create: `backend/app/prompts/system.py`
- Create: `backend/tests/test_prompts/__init__.py`
- Create: `backend/tests/test_prompts/test_system.py`

- [ ] **Step 1: Write tests for prompt assembly**

```python
# backend/tests/test_prompts/__init__.py
```

```python
# backend/tests/test_prompts/test_system.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_prompts/ -v
```

Expected: FAIL

- [ ] **Step 3: Implement prompt templates and builder**

```python
# backend/app/prompts/__init__.py
```

```python
# backend/app/prompts/templates.py
from enum import Enum


class ChatMode(Enum):
    DEFAULT = "default"
    RECRUITER = "recruiter"
    INTERVIEW = "interview"


BASE_IDENTITY = """You are Vishal Khan's AI Professional Twin - a digital representation \
of his professional identity.

You speak about Vishal in the third person. You are knowledgeable, precise, and grounded \
in the information provided to you.

You NEVER fabricate information. If you don't have information about something, say so \
clearly rather than guessing. You cite your sources using [Source: X] notation."""


MODE_TEMPLATES: dict[ChatMode, str] = {
    ChatMode.DEFAULT: """Answer naturally and conversationally. Be professional but approachable. \
Use markdown formatting for readability. Provide enough detail to be helpful without being \
overwhelming.""",

    ChatMode.RECRUITER: """The user is a recruiter evaluating Vishal as a candidate. Be concise \
- they have limited time. Lead with impact and quantified results. Keep responses under 150 \
words unless more detail is specifically requested. End responses with a relevant next action \
such as: view a specific project, download the resume, or book a meeting.""",

    ChatMode.INTERVIEW: """The user is a technical interviewer. Provide depth - architecture \
decisions, engineering tradeoffs, implementation details. Reference specific repositories and \
link to source code when relevant. Use technical terminology appropriate for a software \
engineering audience. Explain the "why" behind decisions, not just the "what".""",
}


RESPONSE_RULES = """Rules:
- Always cite the source of information using [Source: X] notation
- Never invent projects, skills, or experience that aren't in the provided context
- If asked about something not covered in the provided information, say "I don't have that \
information about Vishal"
- Include relevant links (GitHub, LinkedIn) when available
- Format responses with markdown for readability"""
```

```python
# backend/app/prompts/system.py
from app.prompts.templates import (
    BASE_IDENTITY,
    MODE_TEMPLATES,
    RESPONSE_RULES,
    ChatMode,
)


def build_system_prompt(mode: ChatMode, rag_context: str) -> str:
    parts = [BASE_IDENTITY, "", MODE_TEMPLATES[mode]]

    if rag_context.strip():
        parts.extend([
            "",
            "Use the following verified information to answer. Cite sources using "
            "[Source: X] notation. If the information below doesn't cover the question, "
            "say you don't have that information about Vishal.",
            "",
            "---",
            rag_context,
            "---",
        ])
    else:
        parts.extend([
            "",
            "No retrieved information is available for this query. Answer only based on "
            "your general knowledge about Vishal from the conversation context, or say you "
            "don't have that information.",
        ])

    parts.extend(["", RESPONSE_RULES])

    return "\n".join(parts)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_prompts/ -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/prompts/ backend/tests/test_prompts/
git commit -m "feat(backend): add composable prompt architecture with mode templates"
```

---

### Task 11: LLM Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/llm.py`
- Create: `backend/tests/test_services/__init__.py`
- Create: `backend/tests/test_services/test_llm.py`

- [ ] **Step 1: Write tests for LLM service**

```python
# backend/tests/test_services/__init__.py
```

```python
# backend/tests/test_services/test_llm.py
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm import LLMService


@pytest.fixture
def llm_service() -> LLMService:
    return LLMService(
        api_key="test-key",
        base_url="https://models.github.ai/inference",
        model="gpt-4.1-mini",
    )


@pytest.mark.asyncio
async def test_chat_returns_text(llm_service: LLMService) -> None:
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Vishal is an AI Engineer"
    mock_response.choices = [mock_choice]

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_response
        result = await llm_service.chat(
            system_prompt="You are a test assistant",
            messages=[{"role": "user", "content": "Who is Vishal?"}],
        )

    assert result == "Vishal is an AI Engineer"


@pytest.mark.asyncio
async def test_stream_yields_chunks(llm_service: LLMService) -> None:
    async def mock_stream():
        for text in ["Vishal ", "is ", "great"]:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = text
            yield chunk

    with patch.object(
        llm_service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_stream()
        chunks = []
        async for chunk in llm_service.stream(
            system_prompt="Test",
            messages=[{"role": "user", "content": "Hi"}],
        ):
            chunks.append(chunk)

    assert chunks == ["Vishal ", "is ", "great"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_services/test_llm.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement LLM service**

```python
# backend/app/services/__init__.py
```

```python
# backend/app/services/llm.py
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI


class LLMService:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def chat(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt}, *messages],
            temperature=0.3,
        )
        return response.choices[0].message.content or ""

    async def stream(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt}, *messages],
            temperature=0.3,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_services/test_llm.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/test_services/
git commit -m "feat(backend): add LLM service with chat and streaming via GitHub Models"
```

---

### Task 12: Chat Models and Router

**Files:**
- Create: `backend/app/models/chat.py`
- Create: `backend/app/routers/chat.py`
- Create: `backend/tests/test_routers/test_chat.py`

- [ ] **Step 1: Write chat Pydantic models**

```python
# backend/app/models/chat.py
from pydantic import BaseModel, Field

from app.prompts.templates import ChatMode


class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(max_length=50)
    mode: ChatMode = ChatMode.DEFAULT
```

- [ ] **Step 2: Write tests for chat router**

```python
# backend/tests/test_routers/test_chat.py
import json
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/chat", json={"messages": []})
    assert response.status_code == 422


def test_chat_rejects_invalid_role(client: TestClient) -> None:
    response = client.post(
        "/chat", json={"messages": [{"role": "system", "content": "hack"}]}
    )
    assert response.status_code == 422


def test_chat_streams_sse_response(client: TestClient) -> None:
    mock_context = "[Source: resume]\nData Engineer"
    mock_sources = []

    async def mock_stream(*args, **kwargs):
        for word in ["Hello ", "world"]:
            yield word

    with (
        patch("app.routers.chat.get_retriever") as mock_get_retriever,
        patch("app.routers.chat.get_llm_service") as mock_get_llm,
    ):
        mock_retriever = AsyncMock()
        mock_retriever.retrieve.return_value = (mock_context, mock_sources)
        mock_get_retriever.return_value = mock_retriever

        mock_llm = AsyncMock()
        mock_llm.stream = mock_stream
        mock_get_llm.return_value = mock_llm

        response = client.post(
            "/chat",
            json={"messages": [{"role": "user", "content": "Who is Vishal?"}]},
            headers={"Accept": "text/event-stream"},
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = response.text.strip().split("\n")
    events = [line for line in lines if line.startswith("data: ")]
    assert len(events) >= 2
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_routers/test_chat.py -v
```

Expected: FAIL

- [ ] **Step 4: Implement chat router**

```python
# backend/app/routers/chat.py
import json
from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.models.chat import ChatRequest
from app.prompts.system import build_system_prompt
from app.rag.retriever import Retriever, SourceInfo
from app.services.llm import LLMService

router = APIRouter()
logger = structlog.get_logger()

_retriever: Retriever | None = None
_llm_service: LLMService | None = None


def init_chat_dependencies(retriever: Retriever, llm_service: LLMService) -> None:
    global _retriever, _llm_service
    _retriever = retriever
    _llm_service = llm_service


def get_retriever() -> Retriever:
    assert _retriever is not None
    return _retriever


def get_llm_service() -> LLMService:
    assert _llm_service is not None
    return _llm_service


@router.post("/chat")
async def chat(
    request: ChatRequest,
    retriever: Retriever = Depends(get_retriever),
    llm: LLMService = Depends(get_llm_service),
) -> EventSourceResponse:
    last_message = request.messages[-1].content
    await logger.ainfo("Chat request", query=last_message, mode=request.mode.value)

    rag_context, sources = await retriever.retrieve(last_message)
    system_prompt = build_system_prompt(mode=request.mode, rag_context=rag_context)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_stream() -> AsyncGenerator[dict[str, str]]:
        async for chunk in llm.stream(
            system_prompt=system_prompt, messages=messages
        ):
            yield {"data": json.dumps({"type": "chunk", "content": chunk})}

        source_data = [
            {"source": s.source, "detail": s.detail} for s in sources
        ]
        yield {"data": json.dumps({"type": "sources", "sources": source_data})}
        yield {"data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_stream())
```

- [ ] **Step 5: Wire chat router into the app**

Update `backend/app/main.py` to include the chat router and initialize dependencies in the lifespan:

```python
# backend/app/main.py
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rag.chunker import load_all_knowledge
from app.rag.embeddings import EmbeddingService
from app.rag.retriever import Retriever
from app.rag.store import ChromaStore
from app.routers import chat, health
from app.routers.chat import init_chat_dependencies
from app.services.llm import LLMService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    logger = structlog.get_logger()
    settings = get_settings()

    await logger.ainfo("Starting AI Professional Twin backend")

    embedding_service = EmbeddingService(
        api_key=settings.github_token,
        base_url=settings.github_models_base_url,
        model=settings.embedding_model,
    )

    store = ChromaStore(
        persist_dir=settings.chroma_persist_dir,
        collection_name="knowledge",
    )

    if store.count() == 0:
        await logger.ainfo("Knowledge base empty, ingesting documents")
        knowledge_dir = Path(__file__).parent.parent / "knowledge"
        docs = load_all_knowledge(knowledge_dir)
        if docs:
            texts = [d.text for d in docs]
            embeddings = await embedding_service.embed_texts(texts)
            for doc, emb in zip(docs, embeddings):
                doc.embedding = emb
            store.add_documents(docs)
            await logger.ainfo("Ingested documents", count=len(docs))

    retriever = Retriever(
        store=store,
        embedding_service=embedding_service,
    )

    llm_service = LLMService(
        api_key=settings.github_token,
        base_url=settings.github_models_base_url,
        model=settings.llm_model,
    )

    init_chat_dependencies(retriever=retriever, llm_service=llm_service)

    yield

    await logger.ainfo("Shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Professional Twin",
        version="0.2.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(chat.router)

    return app
```

- [ ] **Step 6: Update conftest to mock dependencies for tests**

```python
# backend/tests/conftest.py
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.chat import init_chat_dependencies


@pytest.fixture
def client() -> TestClient:
    app = create_app()

    mock_retriever = AsyncMock()
    mock_retriever.retrieve.return_value = ("", [])
    mock_llm = AsyncMock()

    async def mock_stream(*args, **kwargs):
        yield "test response"

    mock_llm.stream = mock_stream
    init_chat_dependencies(retriever=mock_retriever, llm_service=mock_llm)

    return TestClient(app)
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && uv run pytest -v
```

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/chat.py backend/app/routers/chat.py backend/app/main.py \
  backend/tests/conftest.py backend/tests/test_routers/test_chat.py
git commit -m "feat(backend): add chat endpoint with SSE streaming, RAG, and prompt assembly"
```

---

## Milestone 5: Knowledge Endpoints + GitHub API

### Task 13: Knowledge Endpoints

**Files:**
- Create: `backend/app/routers/knowledge.py`
- Create: `backend/tests/test_routers/test_knowledge.py`

- [ ] **Step 1: Write tests for knowledge endpoints**

```python
# backend/tests/test_routers/test_knowledge.py
from fastapi.testclient import TestClient


def test_get_projects_returns_list(client: TestClient) -> None:
    response = client.get("/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_skills_returns_list(client: TestClient) -> None:
    response = client.get("/skills")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_project_by_slug_not_found(client: TestClient) -> None:
    response = client.get("/projects/nonexistent-slug")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_routers/test_knowledge.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement knowledge router**

```python
# backend/app/routers/knowledge.py
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.models.knowledge import CareerQA, Project, SkillCategory

router = APIRouter()

KNOWLEDGE_DIR = Path(__file__).parent.parent.parent / "knowledge"


def _load_yaml(filename: str) -> list | dict:
    path = KNOWLEDGE_DIR / filename
    if not path.exists():
        return []
    with open(path) as f:
        return yaml.safe_load(f) or []


@router.get("/projects")
async def list_projects() -> list[Project]:
    data = _load_yaml("projects.yaml")
    return [Project(**p) for p in data]


@router.get("/projects/{slug}")
async def get_project(slug: str) -> Project:
    data = _load_yaml("projects.yaml")
    for p in data:
        if p["slug"] == slug:
            return Project(**p)
    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/skills")
async def list_skills() -> list[SkillCategory]:
    data = _load_yaml("skills.yaml")
    return [SkillCategory(**s) for s in data]


@router.get("/resume/download")
async def download_resume() -> FileResponse:
    path = KNOWLEDGE_DIR / "resume.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume not found")
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename="Vishal_Khan_Resume.pdf",
    )
```

- [ ] **Step 4: Register knowledge router in main.py**

Add to `backend/app/main.py` in `create_app()`:

```python
from app.routers import chat, health, knowledge

# ... inside create_app():
app.include_router(knowledge.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_routers/test_knowledge.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/knowledge.py backend/tests/test_routers/test_knowledge.py backend/app/main.py
git commit -m "feat(backend): add knowledge endpoints for projects, skills, and resume download"
```

---

### Task 14: GitHub API Service

**Files:**
- Create: `backend/app/services/github_api.py`
- Create: `backend/tests/test_services/test_github_api.py`

- [ ] **Step 1: Write tests for GitHub API service**

```python
# backend/tests/test_services/test_github_api.py
from unittest.mock import AsyncMock, patch

import pytest

from app.services.github_api import GitHubAPIService


@pytest.fixture
def github_service() -> GitHubAPIService:
    return GitHubAPIService(token="test-token", username="DataScienceVishal")


@pytest.mark.asyncio
async def test_fetch_repos_returns_list(github_service: GitHubAPIService) -> None:
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "name": "my-ai-resume",
            "description": "AI Professional Twin",
            "html_url": "https://github.com/DataScienceVishal/my-ai-resume",
            "language": "Python",
            "stargazers_count": 5,
            "topics": ["ai", "rag"],
            "updated_at": "2026-07-01T00:00:00Z",
        }
    ]

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert len(repos) == 1
    assert repos[0]["name"] == "my-ai-resume"


@pytest.mark.asyncio
async def test_fetch_repos_handles_api_error(github_service: GitHubAPIService) -> None:
    mock_response = AsyncMock()
    mock_response.status_code = 403
    mock_response.json.return_value = {"message": "rate limited"}

    with patch("app.services.github_api.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        repos = await github_service.fetch_repos()

    assert repos == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_services/test_github_api.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement GitHub API service**

```python
# backend/app/services/github_api.py
import structlog
import httpx

logger = structlog.get_logger()


class GitHubAPIService:
    def __init__(self, token: str, username: str) -> None:
        self.token = token
        self.username = username
        self.base_url = "https://api.github.com"

    async def fetch_repos(self, per_page: int = 10) -> list[dict]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/users/{self.username}/repos",
                    params={"sort": "updated", "per_page": per_page},
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        "Accept": "application/vnd.github+json",
                    },
                    timeout=10.0,
                )

            if response.status_code != 200:
                await logger.awarn(
                    "GitHub API error",
                    status=response.status_code,
                    body=response.json(),
                )
                return []

            return [
                {
                    "name": repo["name"],
                    "description": repo.get("description", ""),
                    "html_url": repo["html_url"],
                    "language": repo.get("language", ""),
                    "stargazers_count": repo.get("stargazers_count", 0),
                    "topics": repo.get("topics", []),
                    "updated_at": repo.get("updated_at", ""),
                }
                for repo in response.json()
            ]
        except httpx.HTTPError as e:
            await logger.aerror("GitHub API request failed", error=str(e))
            return []

    async def fetch_readme(self, repo_name: str) -> str:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{self.username}/{repo_name}/readme",
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        "Accept": "application/vnd.github.raw+json",
                    },
                    timeout=10.0,
                )
            if response.status_code == 200:
                return response.text
            return ""
        except httpx.HTTPError:
            return ""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_services/test_github_api.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/github_api.py backend/tests/test_services/test_github_api.py
git commit -m "feat(backend): add GitHub API service for live repo data"
```

---

## Milestone 6: Infrastructure

### Task 15: Rate Limiting + Structured Logging

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/routers/health.py`

- [ ] **Step 1: Add structlog configuration**

Create `backend/app/logging_config.py`:

```python
# backend/app/logging_config.py
import logging

import structlog


def setup_logging(log_level: str = "info") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level.upper()),
    )
```

- [ ] **Step 2: Add rate limiting and logging to main.py**

Update `backend/app/main.py` to add rate limiting middleware and call `setup_logging()` in the lifespan:

```python
# Add to imports:
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.logging_config import setup_logging

# Add limiter as module-level:
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

# In lifespan, add at the top:
setup_logging(settings.log_level)

# In create_app, add after CORS middleware:
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again later."},
    )
```

- [ ] **Step 3: Update health endpoint to include ChromaDB status**

```python
# backend/app/routers/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {
        "status": "healthy",
        "version": "0.2.0",
        "service": "ai-professional-twin",
    }
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && uv run pytest -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/logging_config.py backend/app/main.py backend/app/routers/health.py
git commit -m "feat(backend): add structured logging and rate limiting middleware"
```

---

### Task 16: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.12

      - name: Install dependencies
        run: uv sync --dev

      - name: Lint
        run: uv run ruff check .

      - name: Format check
        run: uv run ruff format --check .

      - name: Type check
        run: uv run mypy app/

      - name: Test
        run: uv run pytest --cov=app --cov-report=term-missing -v
        env:
          GITHUB_TOKEN: fake-token-for-ci

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for backend lint/test and frontend build"
```

---

## Milestone 7: Frontend

### Task 17: React + Vite + Tailwind Scaffolding

**Files:**
- Create: `frontend/` (full Vite + React + TypeScript scaffold)
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/styles/globals.css`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /path/to/project
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite framer-motion react-markdown rehype-highlight remark-gfm
```

- [ ] **Step 3: Configure Tailwind**

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

```css
/* frontend/src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0a1a;
  --color-bg-secondary: #111128;
  --color-bg-card: #16163a;
  --color-border: #1e1e4a;
  --color-accent-cyan: #06b6d4;
  --color-accent-purple: #a855f7;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Update main entry point**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

```tsx
// frontend/src/app.tsx
import Home from './pages/home'

export default function App() {
  return <Home />
}
```

```tsx
// frontend/src/pages/home.tsx
export default function Home() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <h1 className="text-2xl font-bold p-8">AI Professional Twin</h1>
      <p className="px-8 text-text-secondary">Coming soon...</p>
    </div>
  )
}
```

- [ ] **Step 5: Verify it runs**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 - should see dark background with "AI Professional Twin" heading.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold React + Vite + Tailwind with dark theme"
```

---

### Task 18: Types, API Client, and Constants

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/constants.ts`

- [ ] **Step 1: Define shared types**

```ts
// frontend/src/lib/types.ts
export type ChatMode = 'default' | 'recruiter' | 'interview'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceInfo[]
}

export interface SourceInfo {
  source: string
  detail: string
}

export interface Project {
  name: string
  slug: string
  description: string
  tech_stack: string[]
  github_url: string
  category: string
  highlights: string[]
}

export interface SkillCategory {
  category: string
  skills: string[]
  proficiency: string
}

export interface SSEChunkEvent {
  type: 'chunk'
  content: string
}

export interface SSESourcesEvent {
  type: 'sources'
  sources: SourceInfo[]
}

export interface SSEDoneEvent {
  type: 'done'
}

export type SSEEvent = SSEChunkEvent | SSESourcesEvent | SSEDoneEvent
```

- [ ] **Step 2: Create API client**

```ts
// frontend/src/lib/api.ts
import type { ChatMode, Message, Project, SkillCategory, SSEEvent } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

export async function* streamChat(
  messages: { role: string; content: string }[],
  mode: ChatMode,
): AsyncGenerator<SSEEvent> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, mode }),
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data) {
          try {
            yield JSON.parse(data) as SSEEvent
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`)
  if (!response.ok) return []
  return response.json()
}

export async function fetchSkills(): Promise<SkillCategory[]> {
  const response = await fetch(`${API_BASE}/skills`)
  if (!response.ok) return []
  return response.json()
}

export function getResumeDownloadUrl(): string {
  return `${API_BASE}/resume/download`
}
```

- [ ] **Step 3: Create constants**

```ts
// frontend/src/lib/constants.ts
import type { ChatMode } from './types'

export const MODE_LABELS: Record<ChatMode, string> = {
  default: 'General',
  recruiter: 'Recruiter',
  interview: 'Interview',
}

export const SUGGESTION_CHIPS: Record<ChatMode, string[]> = {
  default: [
    'Tell me about Vishal',
    'What projects has he built?',
    'What are his technical skills?',
    'What is his educational background?',
    'What was his role at Accenture?',
  ],
  recruiter: [
    'Summarize Vishal in 60 seconds',
    'Why should we hire Vishal?',
    'Show AI and LLM projects',
    'Show Data Engineering experience',
    'What makes him stand out?',
  ],
  interview: [
    'Explain the RAG architecture in this project',
    'How does the retrieval pipeline work?',
    'Walk through the FastAPI backend design',
    'What engineering tradeoffs did you make?',
    'Explain the prompt engineering approach',
  ],
}

export const PROFILE = {
  name: 'Vishal Khan',
  title: 'AI Engineer & MSc AI Student',
  avatarUrl: 'https://github.com/DataScienceVishal.png',
  githubUrl: 'https://github.com/DataScienceVishal',
  linkedinUrl: 'https://www.linkedin.com/in/vishal-khan-a53aboraaa',
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat(frontend): add types, API client with SSE streaming, and constants"
```

---

### Task 19: Chat Hook

**Files:**
- Create: `frontend/src/hooks/use-chat.ts`

- [ ] **Step 1: Implement the use-chat hook**

```ts
// frontend/src/hooks/use-chat.ts
import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../lib/api'
import type { ChatMode, Message, SourceInfo } from '../lib/types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<ChatMode>('default')
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      const userMessage: Message = { role: 'user', content }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsStreaming(true)

      const assistantMessage: Message = { role: 'assistant', content: '', sources: [] }
      setMessages([...updatedMessages, assistantMessage])

      try {
        const chatMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        let fullContent = ''
        let sources: SourceInfo[] = []

        for await (const event of streamChat(chatMessages, mode)) {
          if (event.type === 'chunk') {
            fullContent += event.content
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: fullContent,
              }
              return next
            })
          } else if (event.type === 'sources') {
            sources = event.sources
          } else if (event.type === 'done') {
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: fullContent,
                sources,
              }
              return next
            })
          }
        }
      } catch (error) {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: 'Sorry, something went wrong. Please try again.',
          }
          return next
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, mode, isStreaming],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, mode, setMode, sendMessage, clearMessages }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/use-chat.ts
git commit -m "feat(frontend): add useChat hook with SSE streaming and mode switching"
```

---

### Task 20: UI Primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/skeleton.tsx`

- [ ] **Step 1: Create button component**

```tsx
// frontend/src/components/ui/button.tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: 'bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90',
  secondary: 'bg-bg-card border border-border text-text-primary hover:bg-border/50',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-card',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
```

- [ ] **Step 2: Create badge component**

```tsx
// frontend/src/components/ui/badge.tsx
interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'cyan' | 'purple'
}

const badgeVariants = {
  default: 'bg-bg-card text-text-secondary border-border',
  cyan: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeVariants[variant]}`}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Create skeleton component**

```tsx
// frontend/src/components/ui/skeleton.tsx
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-card ${className}`}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(frontend): add UI primitives (Button, Badge, Skeleton)"
```

---

### Task 21: Layout Components

**Files:**
- Create: `frontend/src/components/layout/sidebar.tsx`
- Create: `frontend/src/components/layout/header.tsx`

- [ ] **Step 1: Create sidebar**

```tsx
// frontend/src/components/layout/sidebar.tsx
import { PROFILE, MODE_LABELS } from '../../lib/constants'
import { Button } from '../ui/button'
import type { ChatMode } from '../../lib/types'

interface SidebarProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  onClear: () => void
}

const modes: ChatMode[] = ['default', 'recruiter', 'interview']

export function Sidebar({ mode, onModeChange, onClear }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-bg-secondary p-6 gap-6">
      <div className="flex flex-col items-center gap-3">
        <img
          src={PROFILE.avatarUrl}
          alt={PROFILE.name}
          className="w-20 h-20 rounded-full border-2 border-accent-cyan/50"
        />
        <div className="text-center">
          <h2 className="font-semibold text-text-primary">{PROFILE.name}</h2>
          <p className="text-sm text-text-secondary">{PROFILE.title}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Mode</p>
        {modes.map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onModeChange(m)}
            className="w-full justify-center"
          >
            {MODE_LABELS[m]}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <a
          href={PROFILE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          GitHub
        </a>
        <a
          href={PROFILE.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          LinkedIn
        </a>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear Chat
        </Button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create mobile header**

```tsx
// frontend/src/components/layout/header.tsx
import { PROFILE, MODE_LABELS } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface HeaderProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

const modes: ChatMode[] = ['default', 'recruiter', 'interview']

export function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-3">
        <img
          src={PROFILE.avatarUrl}
          alt={PROFILE.name}
          className="w-8 h-8 rounded-full"
        />
        <span className="font-medium text-sm">{PROFILE.name}</span>
      </div>
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              mode === m
                ? 'bg-accent-cyan text-bg-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat(frontend): add sidebar and mobile header with mode switching"
```

---

### Task 22: Chat Components

**Files:**
- Create: `frontend/src/components/chat/message.tsx`
- Create: `frontend/src/components/chat/input-bar.tsx`
- Create: `frontend/src/components/chat/suggestion-chips.tsx`
- Create: `frontend/src/components/chat/source-citation.tsx`
- Create: `frontend/src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Create message component**

```tsx
// frontend/src/components/chat/message.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion } from 'framer-motion'
import { SourceCitation } from './source-citation'
import type { Message as MessageType } from '../../lib/types'

interface MessageProps {
  message: MessageType
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent-cyan/15 text-text-primary'
            : 'bg-bg-card text-text-primary'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.sources.map((source, i) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create source citation component**

```tsx
// frontend/src/components/chat/source-citation.tsx
import type { SourceInfo } from '../../lib/types'

interface SourceCitationProps {
  source: SourceInfo
}

export function SourceCitation({ source }: SourceCitationProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-purple/10 border border-accent-purple/30 px-2 py-0.5 text-xs text-accent-purple">
      {source.source}
      {source.detail && ` : ${source.detail}`}
    </span>
  )
}
```

- [ ] **Step 3: Create input bar**

```tsx
// frontend/src/components/chat/input-bar.tsx
import { type FormEvent, useState } from 'react'
import { Button } from '../ui/button'

interface InputBarProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-border">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask me anything about Vishal..."
        disabled={disabled}
        className="flex-1 rounded-xl bg-bg-card border border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 transition-colors"
      />
      <Button type="submit" disabled={disabled || !input.trim()}>
        Send
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create suggestion chips**

```tsx
// frontend/src/components/chat/suggestion-chips.tsx
import { motion } from 'framer-motion'
import { SUGGESTION_CHIPS } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface SuggestionChipsProps {
  mode: ChatMode
  onSelect: (message: string) => void
  visible: boolean
}

export function SuggestionChips({ mode, onSelect, visible }: SuggestionChipsProps) {
  if (!visible) return null

  const chips = SUGGESTION_CHIPS[mode]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-wrap gap-2 px-4 pb-2"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs text-text-secondary hover:border-accent-cyan/50 hover:text-accent-cyan transition-colors"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}
```

- [ ] **Step 5: Create chat panel**

```tsx
// frontend/src/components/chat/chat-panel.tsx
import { useEffect, useRef } from 'react'
import { Message } from './message'
import { InputBar } from './input-bar'
import { SuggestionChips } from './suggestion-chips'
import type { Message as MessageType, ChatMode } from '../../lib/types'

interface ChatPanelProps {
  messages: MessageType[]
  isStreaming: boolean
  mode: ChatMode
  onSend: (message: string) => void
}

export function ChatPanel({ messages, isStreaming, mode, onSend }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 50
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary">
              Vishal Khan's AI Twin
            </h1>
            <p className="text-text-secondary max-w-md">
              Ask me anything about Vishal's experience, projects, skills, and career.
              I'm grounded in real data and will cite my sources.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
        {isStreaming && (
          <div className="flex gap-1 px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.1s]" />
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.2s]" />
          </div>
        )}
      </div>
      <SuggestionChips
        mode={mode}
        onSelect={onSend}
        visible={messages.length === 0}
      />
      <InputBar onSend={onSend} disabled={isStreaming} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chat/
git commit -m "feat(frontend): add chat components with streaming, markdown, and citations"
```

---

### Task 23: Mode Panels

**Files:**
- Create: `frontend/src/components/modes/recruiter-panel.tsx`
- Create: `frontend/src/components/modes/interview-panel.tsx`

- [ ] **Step 1: Create recruiter panel**

```tsx
// frontend/src/components/modes/recruiter-panel.tsx
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { getResumeDownloadUrl } from '../../lib/api'

interface RecruiterPanelProps {
  onAction: (message: string) => void
}

const ACTIONS = [
  { label: 'Summarize Vishal in 60 seconds', message: 'Give me a 60-second summary of Vishal Khan as a candidate.' },
  { label: 'Why hire Vishal?', message: 'Why should we hire Vishal Khan?' },
  { label: 'Show AI projects', message: 'Show me Vishal\'s AI and LLM projects with details.' },
  { label: 'Data Engineering experience', message: 'Tell me about Vishal\'s data engineering experience at Accenture.' },
  { label: 'Generate interview questions', message: 'Generate 5 technical interview questions based on Vishal\'s background.' },
]

export function RecruiterPanel({ onAction }: RecruiterPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden xl:flex flex-col w-64 border-l border-border bg-bg-secondary p-4 gap-3"
    >
      <h3 className="text-sm font-semibold text-text-primary">Quick Actions</h3>
      {ACTIONS.map((action) => (
        <Button
          key={action.label}
          variant="secondary"
          size="sm"
          onClick={() => onAction(action.message)}
          className="w-full text-left justify-start"
        >
          {action.label}
        </Button>
      ))}
      <hr className="border-border" />
      <a
        href={getResumeDownloadUrl()}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="primary" size="sm" className="w-full">
          Download Resume
        </Button>
      </a>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create interview panel**

```tsx
// frontend/src/components/modes/interview-panel.tsx
import { motion } from 'framer-motion'
import { Button } from '../ui/button'

interface InterviewPanelProps {
  onAction: (message: string) => void
}

const CATEGORIES = [
  {
    name: 'RAG & Retrieval',
    questions: [
      'Explain the RAG architecture in this project',
      'How does hybrid search work here?',
      'What chunking strategy did you use and why?',
    ],
  },
  {
    name: 'System Design',
    questions: [
      'Walk through the FastAPI backend architecture',
      'How do you handle streaming responses?',
      'What are the key engineering tradeoffs?',
    ],
  },
  {
    name: 'ML & AI',
    questions: [
      'Explain your reinforcement learning research',
      'How do embeddings work in this system?',
      'What prompt engineering techniques do you use?',
    ],
  },
]

export function InterviewPanel({ onAction }: InterviewPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden xl:flex flex-col w-64 border-l border-border bg-bg-secondary p-4 gap-4 overflow-y-auto"
    >
      <h3 className="text-sm font-semibold text-text-primary">Technical Questions</h3>
      {CATEGORIES.map((cat) => (
        <div key={cat.name} className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-wider text-text-muted font-medium">
            {cat.name}
          </p>
          {cat.questions.map((q) => (
            <Button
              key={q}
              variant="ghost"
              size="sm"
              onClick={() => onAction(q)}
              className="w-full text-left justify-start text-xs"
            >
              {q}
            </Button>
          ))}
        </div>
      ))}
    </motion.div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/modes/
git commit -m "feat(frontend): add recruiter and interview mode panels"
```

---

### Task 24: Home Page Assembly

**Files:**
- Modify: `frontend/src/pages/home.tsx`

- [ ] **Step 1: Wire everything together in home.tsx**

```tsx
// frontend/src/pages/home.tsx
import { useChat } from '../hooks/use-chat'
import { Sidebar } from '../components/layout/sidebar'
import { Header } from '../components/layout/header'
import { ChatPanel } from '../components/chat/chat-panel'
import { RecruiterPanel } from '../components/modes/recruiter-panel'
import { InterviewPanel } from '../components/modes/interview-panel'

export default function Home() {
  const { messages, isStreaming, mode, setMode, sendMessage, clearMessages } = useChat()

  return (
    <div className="flex h-dvh bg-bg-primary text-text-primary">
      <Sidebar mode={mode} onModeChange={setMode} onClear={clearMessages} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header mode={mode} onModeChange={setMode} />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          mode={mode}
          onSend={sendMessage}
        />
      </div>

      {mode === 'recruiter' && <RecruiterPanel onAction={sendMessage} />}
      {mode === 'interview' && <InterviewPanel onAction={sendMessage} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. Verify:
- Dark theme renders correctly
- Sidebar shows with profile, mode buttons, links
- Mode switching works (default/recruiter/interview)
- Chat input is visible and functional
- Suggestion chips appear when chat is empty
- Recruiter panel shows on recruiter mode (desktop only)
- Interview panel shows on interview mode (desktop only)
- Mobile header appears on small screens

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/home.tsx
git commit -m "feat(frontend): assemble home page with chat, sidebar, and mode panels"
```

---

### Task 25: Project Explorer

**Files:**
- Create: `frontend/src/hooks/use-projects.ts`
- Create: `frontend/src/components/projects/project-card.tsx`
- Create: `frontend/src/components/projects/project-grid.tsx`

- [ ] **Step 1: Create useProjects hook**

```ts
// frontend/src/hooks/use-projects.ts
import { useEffect, useState } from 'react'
import { fetchProjects } from '../lib/api'
import type { Project } from '../lib/types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  return { projects, loading }
}
```

- [ ] **Step 2: Create project card**

```tsx
// frontend/src/components/projects/project-card.tsx
import { motion } from 'framer-motion'
import { Badge } from '../ui/badge'
import type { Project } from '../../lib/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-bg-card p-5 flex flex-col gap-3 transition-colors hover:border-accent-cyan/30"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-text-primary">{project.name}</h3>
        <Badge variant="cyan">{project.category}</Badge>
      </div>
      <p className="text-sm text-text-secondary line-clamp-3">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.tech_stack.map((tech) => (
          <Badge key={tech}>{tech}</Badge>
        ))}
      </div>
      {project.highlights.length > 0 && (
        <ul className="text-xs text-text-muted space-y-1">
          {project.highlights.slice(0, 3).map((h) => (
            <li key={h}>- {h}</li>
          ))}
        </ul>
      )}
      <a
        href={project.github_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-cyan hover:underline mt-auto"
      >
        View on GitHub
      </a>
    </motion.div>
  )
}
```

- [ ] **Step 3: Create project grid**

```tsx
// frontend/src/components/projects/project-grid.tsx
import { ProjectCard } from './project-card'
import { Skeleton } from '../ui/skeleton'
import { useProjects } from '../../hooks/use-projects'

export function ProjectGrid() {
  const { projects, loading } = useProjects()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <p className="text-center text-text-muted p-8">No projects loaded.</p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {projects.map((project) => (
        <ProjectCard key={project.slug} project={project} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/use-projects.ts frontend/src/components/projects/
git commit -m "feat(frontend): add project explorer with cards and grid layout"
```

---

## Milestone 8: Integration + Deploy

### Task 26: End-to-End Integration Test

- [ ] **Step 1: Start the backend**

```bash
cd backend && uv run uvicorn app.main:create_app --factory --port 8000
```

Wait for "Ingested documents" log message.

- [ ] **Step 2: Start the frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test in browser**

Open http://localhost:5173 and verify:

1. **Default mode**: Type "Tell me about Vishal" - should get a streamed response with source citations
2. **Recruiter mode**: Switch to recruiter, click "Why hire Vishal?" - should get concise response with next action
3. **Interview mode**: Switch to interview, ask about RAG architecture - should get technical depth
4. **Projects**: Click on a project card - should see tech stack, highlights, GitHub link
5. **Resume download**: Click "Download Resume" - should download the PDF
6. **Mobile**: Resize browser to mobile - header should appear, sidebar should hide
7. **Source citations**: Responses should show purple source tags below the text

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Run full test suite**

```bash
cd backend && uv run pytest -v --cov=app --cov-report=term-missing
```

Expected: All tests pass with >70% coverage

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes"
```

---

### Task 27: Deploy to Railway + Vercel

- [ ] **Step 1: Deploy backend to Railway**

1. Go to https://railway.app and create a new project
2. Connect your GitHub repository
3. Set the root directory to `backend`
4. Add environment variables in Railway dashboard:
   - `GITHUB_TOKEN` = your actual token
   - `GITHUB_USERNAME` = DataScienceVishal
   - `CORS_ORIGINS` = https://your-app.vercel.app
   - `CHROMA_PERSIST_DIR` = /data/chromadb
5. Add a persistent volume mounted at `/data`
6. Railway will detect the Dockerfile and deploy automatically
7. Note the Railway URL (e.g., `https://your-app.up.railway.app`)

- [ ] **Step 2: Verify backend is live**

```bash
curl https://your-app.up.railway.app/health
```

Expected: `{"status":"healthy","version":"0.2.0","service":"ai-professional-twin"}`

- [ ] **Step 3: Deploy frontend to Vercel**

1. Go to https://vercel.com and import the GitHub repository
2. Set the root directory to `frontend`
3. Framework preset: Vite
4. Add environment variable:
   - `VITE_API_URL` = `https://your-app.up.railway.app`
5. Deploy

- [ ] **Step 4: Verify end-to-end in production**

Open the Vercel URL and repeat the integration tests from Task 26.

- [ ] **Step 5: Update CORS in Railway**

Set `CORS_ORIGINS` to the actual Vercel domain.

- [ ] **Step 6: Commit deployment config notes**

Create `DEPLOY.md` in the project root documenting the deployment setup, then commit.

---

### Task 28: Final Cleanup

- [ ] **Step 1: Run linting and fix any issues**

```bash
cd backend && uv run ruff check --fix . && uv run ruff format .
```

- [ ] **Step 2: Run type checking and fix any issues**

```bash
cd backend && uv run mypy app/
```

- [ ] **Step 3: Verify frontend builds cleanly**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: Update .gitignore if needed**

Verify `.env`, `chromadb_data/`, `node_modules/`, `dist/`, `__pycache__/` are all ignored.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup - lint, format, type check"
```
