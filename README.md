# AI Professional Twin

A RAG-powered professional profile assistant. Recruiters and interviewers ask questions in
chat and get grounded, cited answers drawn from a curated knowledge base plus live GitHub data.

- **Backend** - FastAPI (Python 3.12), ChromaDB vector store, Azure OpenAI for chat and
  embeddings, SSE streaming with tool calling. Deployed on Railway.
- **Frontend** - React 19 + Vite + Tailwind 4. Deployed on Vercel.

## Layout

| Path | Contents |
|---|---|
| `backend/app/` | API routers, RAG pipeline, prompts, tools, ingestion |
| `backend/knowledge/` | YAML knowledge base + resume PDF (the content the bot answers from) |
| `backend/tests/` | pytest suite, mirrors the `app/` tree |
| `frontend/src/` | React UI, chat hook, SSE client |

## API routing (read this before deploying)

The backend routes are **unprefixed**: `/chat`, `/projects`, `/skills`, `/health`, `/ready`,
`/resume/download`.

The browser always calls `/api/*`, and the `/api` prefix is **stripped** in transit:

| Environment | Mechanism | `/api/chat` becomes |
|---|---|---|
| Production | `frontend/vercel.json` rewrite | `https://<railway-host>/chat` |
| Local dev | `frontend/vite.config.ts` `server.proxy` | `http://localhost:8000/chat` |

Two things that will silently break the site if you get them wrong:

1. In `vercel.json`, the `/api/:path*` rewrite **must come before** the SPA catch-all
   `/(.*)` → `/index.html`. Vercel matches rewrites in order.
2. Vercel reserves `/api/*` for serverless functions. Without the rewrite, every API call
   returns **404**, the chat dies, and the projects and skills panels render empty.

`frontend/src/lib/api.ts` guards against a recurrence: it rejects any `/chat` response whose
`content-type` is not `text/event-stream`, so a misrouted call fails loudly instead of
silently.

## Local setup

```bash
# backend
cd backend
cp .env.example .env      # fill in Azure OpenAI endpoint + key
uv sync --extra dev
uv run uvicorn app.main:create_app --factory --reload --port 8000
```

```bash
# frontend (separate terminal)
cd frontend
npm install
npm run dev               # proxies /api -> localhost:8000
```

## Checks

```bash
cd backend && uv run ruff check . && uv run mypy app/ && uv run pytest
```

```bash
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
```

Both run in CI on every push and pull request to `main`.

## Deployment

### Railway (backend)

1. **Attach a volume mounted at `/data`.** Without it, ChromaDB is wiped on every restart and
   each cold boot re-embeds the entire knowledge base at your expense. This is the single most
   important setting.
2. Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `GITHUB_TOKEN`.
3. Set `PUBLIC_BASE_URL` to the backend's own Railway URL (not the Vercel frontend) - it is
   used to build the resume download link.
4. Set `CORS_ORIGINS` to include the Vercel domain.
5. Leave the healthcheck on `/health`. Do **not** point it at `/ready`, which returns 503 until
   ingestion finishes and would restart-loop a cold boot.

Cost controls, all overridable by env var: `CHAT_RATE_LIMIT` (default `10/minute` per IP),
`DAILY_CHAT_BUDGET` (default `500` completions per UTC day), `LLM_MAX_OUTPUT_TOKENS`
(default `1024`), and `INGEST_GITHUB=false` to skip GitHub ingestion entirely.

### Vercel (frontend)

Set the Railway host in the `vercel.json` rewrite destination. No build-time env var is
needed - `VITE_API_URL` exists only as a local override.

## Updating the knowledge base

Everything the assistant says comes from `backend/knowledge/`. Edit the YAML, redeploy, and
ingestion picks up changed files automatically via content hashing - unchanged documents are
not re-embedded.

Entries in `career_qa.yaml` tagged `time_sensitive: true` contain dates, availability windows,
or visa details that go stale. Review them whenever term dates, visa status, or job-search
priorities change.

## Notes

- Never commit `.env` or other secrets.
- `backend/knowledge/resume.pdf` is served publicly and unauthenticated at `/resume/download`.
  Anything in that PDF - phone number, email, address - is public. Check before replacing it.
