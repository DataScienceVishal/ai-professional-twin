FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app
COPY --from=builder /app /app

RUN mkdir -p /data/chromadb && chmod 777 /data/chromadb

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV CHROMA_PERSIST_DIR=/data/chromadb

EXPOSE 8000

CMD uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}
