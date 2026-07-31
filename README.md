# Project Overview

This repository contains a FastAPI backend and a Vite + React frontend for a professional profile assistant.

## Layout

- `backend/` - API, retrieval, prompts, and GitHub data ingestion
- `frontend/` - web UI

## Local setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in your Azure OpenAI settings and GitHub token locally.
3. Install backend and frontend dependencies.
4. Run the backend and frontend dev servers.

## Notes

- Do not commit `.env` or other local secrets.
- Legacy demo assets and planning docs have been removed from the tracked release surface.
