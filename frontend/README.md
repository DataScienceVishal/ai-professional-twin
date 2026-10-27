# Frontend

React 19 + Vite + Tailwind 4 UI for the professional profile assistant.

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server (proxies `/api` to `:8000`)   |
| `npm run lint`      | oxlint                                        |
| `npm run typecheck` | `tsc -b`                                      |
| `npm run test`      | Vitest, single run                            |
| `npm run test:watch`| Vitest in watch mode                          |
| `npm run build`     | Type check + production build to `dist/`      |

## API routing: read this before deploying

The frontend always calls the **same-origin** path `/api/...`. Nothing else is
configured at build time: there is no CORS setup and no required env var.

The backend routes are **not** prefixed:

```
/chat            /projects        /skills          /timeline
/health          /ready           /resume/download
```

So both proxies must **strip the `/api` prefix** when forwarding:

| Environment | Browser requests | Proxy                             | Backend receives      |
| ----------- | ---------------- | --------------------------------- | --------------------- |
| Local dev   | `/api/chat`      | `vite.config.ts` `server.proxy`   | `localhost:8000/chat` |
| Production  | `/api/chat`      | `vercel.json` rewrite             | `<backend host>/chat` |

### The rewrite in `vercel.json`

JSON cannot hold comments, so the note lives here. `frontend/vercel.json`
sends every `/api` request to the backend on Azure Container Apps:

```json
{
  "source": "/api/:path*",
  "destination": "https://ai-twin-api.bravecoast-78fd612a.francecentral.azurecontainerapps.io/:path*"
}
```

If the backend moves, change the host there. Give the hostname only: the
`https://` is already there, and there is no trailing slash and no `/api`
segment.

Two things matter about this rewrite:

1. **Order.** Vercel evaluates `rewrites` top-down and takes the first match.
   The `/api/:path*` rule must stay **above** the SPA catch-all
   `{"source": "/(.*)", "destination": "/index.html"}`. If it does not, every
   API call returns `index.html` with a `200`, and the chat silently renders
   an empty reply. (`src/lib/api.ts` now guards against this by rejecting any
   `/chat` response whose `content-type` is not `text/event-stream`, so the
   failure is loud rather than silent — but the rewrite still has to be right.)
2. **Prefix stripping.** `:path*` captures everything *after* `/api/`, and the
   destination re-emits only `:path*`, so `/api/chat` reaches the backend as
   `/chat`.

### `VITE_API_URL` (optional)

See `.env.example`. It is only an escape hatch for pointing the app at a
backend directly and bypassing the proxy; leave it unset for normal local dev
and for production.
