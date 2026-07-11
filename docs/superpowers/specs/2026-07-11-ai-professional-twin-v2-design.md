# AI Professional Twin — V2 Design Specification

**Date**: 2026-07-11
**Status**: Approved
**Author**: Vishal Khan + Claude (Architect)

---

## 1. Vision

Build a recruiter-ready AI Professional Twin — a digital representation of Vishal Khan's professional identity. Not a chatbot. A production-quality AI system that demonstrates modern AI engineering, software architecture, and LLM application design.

**Success metric**: A recruiter spends 5 minutes with the app and leaves convinced this candidate understands production AI systems.

**Target users**: Recruiters, hiring managers, technical interviewers (primary). Professors, engineers, friends (secondary).

---

## 2. Constraints

| Constraint | Value |
|-----------|-------|
| Budget | $0/month — free tiers only |
| LLM Provider | GitHub Models (GPT-4.1-mini, text-embedding-3-small) |
| Backend Hosting | Railway free tier ($5 credit/month) |
| Frontend Hosting | Vercel free tier |
| Vector Store | ChromaDB embedded (no managed service) |
| Language | Python 3.12 (backend), TypeScript (frontend) |

---

## 3. Architecture Overview

```
┌─────────────────┐     SSE/REST      ┌──────────────────┐      ┌─────────────────┐
│   React + Vite  │ ───────────────►  │  FastAPI Backend  │ ───► │  External APIs   │
│   (Vercel)      │                   │  (Railway/Docker) │      │  GitHub, LinkedIn│
└─────────────────┘                   └────────┬─────────┘      │  GitHub Models   │
                                               │                 │  Cal.com, SMTP   │
                                               ▼                 └─────────────────┘
                                      ┌──────────────────┐
                                      │   RAG Pipeline    │ ◄── Knowledge Base
                                      │   ChromaDB        │     (YAML, PDF, MD)
                                      └──────────────────┘
```

Two independently deployed services:
- **Frontend**: React SPA on Vercel (CDN edge, free)
- **Backend**: FastAPI in Docker on Railway (persistent volume for ChromaDB)

---

## 4. Backend — FastAPI

### 4.1 Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, lifespan events, middleware
│   ├── config.py               # Pydantic Settings (env vars, typed config)
│   ├── routers/
│   │   ├── chat.py             # POST /chat — streaming SSE endpoint
│   │   ├── knowledge.py        # GET /projects, /skills, /resume
│   │   └── health.py           # GET /health — service status
│   ├── services/
│   │   ├── llm.py              # GitHub Models client (OpenAI-compatible SDK)
│   │   ├── rag.py              # Orchestrates retrieval pipeline
│   │   ├── github_api.py       # Live GitHub repository data
│   │   └── linkedin_api.py     # LinkedIn profile data (static scrape fallback — LinkedIn API requires app review)
│   ├── rag/
│   │   ├── chunker.py          # Semantic chunking with metadata enrichment
│   │   ├── embeddings.py       # Embedding model wrapper
│   │   ├── store.py            # ChromaDB interface (persist + query)
│   │   └── retriever.py        # Hybrid search + reranking + context assembly
│   ├── prompts/
│   │   ├── system.py           # System prompt builder (composable layers)
│   │   └── templates.py        # Mode-specific prompt templates
│   └── models/
│       ├── chat.py             # ChatRequest, ChatResponse, Message schemas
│       └── knowledge.py        # Project, Skill, Certificate schemas
├── knowledge/                  # Knowledge source files
│   ├── resume.pdf
│   ├── projects.yaml
│   ├── skills.yaml
│   ├── career_qa.yaml
│   └── certificates.yaml
├── tests/
│   ├── test_routers/
│   ├── test_services/
│   └── test_rag/
├── Dockerfile
├── pyproject.toml
└── .env.example
```

### 4.2 Key Design Decisions

**Service layer pattern**: Routers are thin (validation + routing). Services hold business logic. This separation makes the code testable — services can be tested without HTTP.

**Pydantic Settings**: All configuration loaded from environment variables with type validation. No hardcoded values. `.env.example` documents required vars with dummy values.

**Lifespan events**: ChromaDB initialization and knowledge ingestion happen in FastAPI's lifespan context manager — once at startup, not per-request.

**Dependency injection**: FastAPI's `Depends()` for service injection. Makes testing trivial (swap real services for mocks).

### 4.3 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat` | Streaming chat via SSE. Accepts `{messages, mode}` |
| GET | `/projects` | List all projects with metadata |
| GET | `/projects/{slug}` | Single project details |
| GET | `/skills` | Skills matrix grouped by category |
| GET | `/resume/download` | Serve resume PDF |
| GET | `/health` | Service health + ChromaDB status |

### 4.4 Streaming Implementation

Real Server-Sent Events (SSE), not fake typewriter animation:

```
Client sends: POST /chat {messages: [...], mode: "recruiter"}
Server responds: Content-Type: text/event-stream

data: {"type": "chunk", "content": "Vishal"}
data: {"type": "chunk", "content": " is an"}
data: {"type": "chunk", "content": " AI Engineer"}
data: {"type": "sources", "sources": [{"name": "Resume", "section": "Summary"}]}
data: {"type": "done"}
```

Sources are sent as a final event after the text stream completes. This lets the frontend render citations after the response.

---

## 5. RAG Pipeline

### 5.1 Ingestion Pipeline

```
Documents → Loader → Chunker → Metadata Enricher → Embedder → ChromaDB
```

**Loaders** (per file type):
- `PyPDFLoader` — resume PDF, splits by page
- Custom YAML loader — structured data (projects, skills, career Q&A)
- Markdown loader — README files, documentation

**Semantic Chunking Strategy**:

| Source | Chunking Approach | Metadata |
|--------|------------------|----------|
| Resume PDF | Split by section (Education, Experience, Skills, Projects) | `{source, section, company, role, dates}` |
| Projects YAML | One chunk per project | `{source, name, tech_stack[], github_url, description}` |
| Skills YAML | One chunk per skill category | `{source, category, proficiency}` |
| Career Q&A YAML | One chunk per Q&A pair | `{source, topic, question}` |
| Certificates | One chunk per certificate | `{source, issuer, date, name}` |

Metadata is the key differentiator. It enables filtered search — when someone asks about a specific project, we search only project chunks.

**Embeddings**: `text-embedding-3-small` via GitHub Models (OpenAI-compatible API). 1536 dimensions. Free.

**Storage**: ChromaDB in embedded mode with disk persistence. Data survives restarts. Railway persistent volume ensures it survives redeploys.

### 5.2 Retrieval Pipeline

```
Query → Classify Intent → Embed → Hybrid Search → Filter → Score → Assemble Context
```

**Step 1 — Query Classification**:
A lightweight classifier (keyword + pattern matching, not LLM-based) determines query intent:
- Project query → filter `source: "projects"`
- Skills query → filter `source: "skills"`
- Experience query → filter `source: "resume", section: "experience"`
- General → search all collections

**Step 2 — Hybrid Search**:
Combine dense (embedding similarity) and sparse (keyword BM25) retrieval using Reciprocal Rank Fusion:
- Dense: ChromaDB cosine similarity search
- Sparse: ChromaDB `where_document` keyword filtering
- Fusion: RRF merges both ranked lists, top-k results

**Step 3 — Context Assembly**:
Retrieved chunks formatted with source attribution:
```
[Source: Resume > Experience > Accenture]
Data Engineer, Aug 2021 - Aug 2023. Built ETL pipelines
processing 10M+ records daily using Azure Data Factory...

[Source: Project > AI Professional Twin]
RAG-powered FastAPI application with semantic chunking,
hybrid retrieval, and streaming responses...
```

**Step 4 — Source Citations**:
The prompt instructs the LLM to cite sources in `[Source: X]` notation. The backend parses citations from the response and sends them as structured data in the SSE stream's final `sources` event.

### 5.3 Performance Targets

| Metric | Target |
|--------|--------|
| Retrieval latency (query → chunks) | < 200ms |
| End-to-end first token | < 1.5s |
| Chunks retrieved per query | 3-5 (configurable) |
| Embedding dimension | 1536 |
| Max knowledge base size | ~500 chunks (well within ChromaDB embedded limits) |

---

## 6. Prompt Architecture

Composable layers assembled per request:

```
Final Prompt = Base Identity + Mode Layer + RAG Context + Response Rules
```

### Layer 1 — Base Identity (~300 tokens, always present)

Defines WHO the AI is: Vishal's professional twin. Speaks in third person. Never fabricates. Cites sources. No CV data here — that comes from RAG.

### Layer 2 — Mode Templates (swapped per mode)

| Mode | Behavior |
|------|----------|
| Default | Conversational, professional, uses markdown |
| Recruiter | Concise, impact-first, quantified achievements, ends with next action (view project, download resume, book meeting) |
| Interview | Technical depth, architecture decisions, tradeoffs, links to source code |

### Layer 3 — RAG Context (dynamic per query)

Injected by the retrieval pipeline. Contains only relevant chunks with source attribution. Includes explicit instruction: "If the information below doesn't cover the question, say you don't have that information."

### Layer 4 — Response Rules (guardrails)

- Cite sources using `[Source: X]` notation
- Never invent projects, skills, or experience
- Recruiter mode responses under 150 words
- Include relevant links when available
- Format with markdown

---

## 7. Frontend — React + Vite

### 7.1 Design Language

Dark theme with subtle neon accents. Inspired by Linear's dark mode and Anthropic's console. Professional enough for recruiters, distinctive enough to be memorable.

- **Typography**: Inter or Geist (clean, modern, highly readable)
- **Colors**: Deep navy/charcoal background, cyan/purple accent highlights
- **Animations**: Smooth, purposeful micro-animations (Framer Motion). Page transitions, message appear, mode switch.
- **Principle**: Readability over decoration. Every animation serves a purpose.

### 7.2 Project Structure

```
frontend/
├── src/
│   ├── app.tsx
│   ├── pages/
│   │   └── home.tsx                # Landing + chat (SPA)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── chat-panel.tsx      # Message list + scroll management
│   │   │   ├── message.tsx         # Single message with markdown + citations
│   │   │   ├── input-bar.tsx       # Text input + send button
│   │   │   ├── suggestion-chips.tsx # Context-aware suggestions
│   │   │   └── source-citation.tsx  # Collapsible source tag
│   │   ├── modes/
│   │   │   ├── recruiter-panel.tsx  # Quick-action buttons for recruiters
│   │   │   └── interview-panel.tsx  # Technical depth controls
│   │   ├── projects/
│   │   │   ├── project-grid.tsx     # Card layout
│   │   │   └── project-card.tsx     # Individual project card
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── footer.tsx
│   │   └── ui/                     # Reusable primitives
│   │       ├── button.tsx
│   │       ├── badge.tsx
│   │       └── skeleton.tsx
│   ├── hooks/
│   │   ├── use-chat.ts             # SSE streaming + message state
│   │   └── use-projects.ts         # Fetch projects from API
│   ├── lib/
│   │   ├── api.ts                  # Backend API client
│   │   └── constants.ts
│   └── styles/
│       └── globals.css             # Tailwind base + custom design tokens
├── index.html
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

### 7.3 Key Components

**Chat Panel**: Real SSE streaming via `EventSource` or `fetch` with `ReadableStream`. Messages accumulate in React state. Auto-scroll with smart behavior (don't interrupt if user scrolled up).

**Recruiter Mode Panel**: Pre-built action buttons:
- Summarize Vishal in 60 seconds
- Why hire Vishal?
- Show AI projects
- Show Data Engineering experience
- Download Resume
- Book Meeting
- Contact Vishal

Each button sends a pre-defined message to the chat. The mode prompt template ensures recruiter-optimized responses.

**Interview Mode Panel**: Technical question categories (RAG, Architecture, ML, etc.) with example questions. Responses include deeper technical detail and GitHub links.

**Source Citations**: Rendered as small collapsible tags below assistant messages. Click to expand and see the full source context.

### 7.4 Responsive Design

- **Desktop** (>1024px): Sidebar + full chat panel + optional right panel for projects
- **Tablet** (768-1024px): Collapsible sidebar, full-width chat
- **Mobile** (<768px): Bottom nav, full-screen chat, slide-up panels

---

## 8. Modes

Modes are a backend concept (prompt template selection) with frontend UI adaptations:

| Mode | Prompt Template | UI Changes | Suggestion Chips |
|------|----------------|------------|-----------------|
| Default | General assistant | Standard chat | "Tell me about Vishal", "What projects has he built?" |
| Recruiter | Concise, impact-focused | Action button panel, compact responses | "Why hire Vishal?", "Show AI experience", "Download resume" |
| Interview | Technical depth | Code block styling, architecture focus | "Explain your RAG architecture", "Walk through the FastAPI design" |

Mode is sent as a parameter in the chat request: `POST /chat {messages, mode: "recruiter"}`. The backend selects the corresponding prompt template.

---

## 9. Knowledge Base

All knowledge stored as version-controlled files in `backend/knowledge/`:

### 9.1 File Formats

**resume.pdf** — The primary resume document. Parsed by PyPDFLoader, chunked by section.

**projects.yaml** — Structured project data:
```yaml
- name: AI Professional Twin
  slug: ai-professional-twin
  description: RAG-powered AI assistant...
  tech_stack: [Python, FastAPI, ChromaDB, React]
  github_url: https://github.com/DataScienceVishal/my-ai-resume
  highlights:
    - Semantic chunking with metadata filtering
    - Real SSE streaming
    - Recruiter and interview modes
  category: AI/LLM
```

**skills.yaml** — Skills grouped by category:
```yaml
- category: Machine Learning
  skills: [PyTorch, TensorFlow, Scikit-Learn, XGBoost]
  proficiency: advanced

- category: LLM Engineering  
  skills: [RAG, LangChain, Prompt Engineering, Vector Databases]
  proficiency: advanced
```

**career_qa.yaml** — Pre-written Q&A pairs for common questions:
```yaml
- question: Why should we hire Vishal?
  answer: |
    Vishal combines deep ML expertise with production
    engineering skills. He has built ETL pipelines at scale
    (Accenture), designed RAG systems, and...
  topic: hiring
```

**certificates.yaml** — Certifications with metadata.

### 9.2 Future Knowledge Sources (V3+)

- Google Drive documents
- Blog posts (markdown)
- GitHub README auto-ingestion
- User-uploaded PDFs (with approval workflow)

---

## 10. Security

| Concern | Mitigation |
|---------|-----------|
| API key exposure | All secrets in Railway/Vercel env vars. `.env` in `.gitignore`. `.env.example` with dummy values only. |
| System prompt leakage | Prompt assembled server-side. Client never sees system prompt or RAG context. |
| CORS | Restrict to Vercel frontend domain only (+ localhost for dev). |
| Rate limiting | `slowapi` at 30 req/min per IP. Protects GitHub Models quota. |
| Input validation | Pydantic schemas on all endpoints. Max message length (2000 chars). Max conversation length (50 messages). |
| Prompt injection | System prompt includes instruction to ignore attempts to override identity. Response rules prevent leaking system prompt. |
| Historical secrets | Rotate all leaked keys (Google API, Tavily, LinkedIn OAuth). Document in README that old keys are invalidated. |

---

## 11. Infrastructure

### 11.1 Docker

Multi-stage build:
- **Builder stage**: Python 3.12, uv, install dependencies
- **Runtime stage**: Python 3.12-slim, copy only app + deps, run as non-root user

### 11.2 CI/CD (GitHub Actions)

On push to `main`:
1. **Lint**: `ruff check` + `ruff format --check`
2. **Type check**: `mypy --strict`
3. **Test**: `pytest` with coverage report
4. **Build**: Docker build (validates Dockerfile compiles)
5. **Deploy**: Railway CLI deploy (backend) + Vercel CLI deploy (frontend)

### 11.3 Logging

`structlog` with JSON output:
```json
{"timestamp": "2026-07-11T10:30:00Z", "level": "info", "event": "rag_retrieval",
 "request_id": "abc123", "query": "What projects...", "chunks_retrieved": 5,
 "latency_ms": 120, "mode": "recruiter"}
```

### 11.4 Monitoring

- Railway dashboard: CPU, memory, request count
- Vercel Analytics: page views, Web Vitals
- `GET /health` endpoint: service status, ChromaDB connectivity, knowledge base stats

---

## 12. Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Backend Language | Python 3.12 | Free |
| Backend Framework | FastAPI | Free |
| Package Manager | uv | Free |
| LLM | GPT-4.1-mini (GitHub Models) | Free |
| Embeddings | text-embedding-3-small (GitHub Models) | Free |
| Vector Store | ChromaDB (embedded, persistent) | Free |
| Frontend Framework | React 19 + Vite | Free |
| CSS | TailwindCSS | Free |
| Animations | Framer Motion | Free |
| Markdown Rendering | react-markdown + rehype-highlight | Free |
| Backend Hosting | Railway | Free ($5 credit) |
| Frontend Hosting | Vercel | Free |
| CI/CD | GitHub Actions | Free |
| Containerization | Docker (multi-stage) | Free |
| Linting | Ruff | Free |
| Type Checking | mypy | Free |
| Testing | pytest | Free |
| Logging | structlog | Free |
| Rate Limiting | slowapi | Free |

**Total monthly cost: $0**

---

## 13. V3 and V4 Extension Points

The modular architecture is designed so V3/V4 features layer on without restructuring:

| Future Feature | Extension Point |
|---------------|----------------|
| Tool Calling (V3) | Add tools to `services/`, register in LLM client |
| LangGraph Workflows (V3) | New `workflows/` module, called from chat router |
| Google Drive Retrieval (V3) | New loader in `rag/`, new collection in ChromaDB |
| Admin Dashboard (V3) | New router `routers/admin.py`, new React page |
| Feedback System (V3) | New router + SQLite/JSON storage |
| Agentic Workflows (V4) | `agents/` module with planner/researcher/coder agents |
| Voice (V4) | New router `routers/voice.py`, Whisper API |
| Vision (V4) | Multimodal message support in chat schemas |
| Model Routing (V4) | Strategy pattern in `services/llm.py` |
| Observability (V4) | OpenTelemetry integration in middleware |

---

## 14. Out of Scope for V2

- Persistent conversation history (V3)
- User authentication (V3 — admin dashboard)
- Feedback collection (V3)
- Analytics dashboard (V3)
- Tool calling / function calling (V3)
- Voice input/output (V4)
- Image/vision understanding (V4)
- Multi-agent workflows (V4)
- Model switching (V4)
- Cost tracking (V4)

These are explicitly deferred to keep V2 focused and deployable.
