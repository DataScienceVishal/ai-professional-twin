import type { ChatMode, Project, SkillCategory, SSEEvent } from './types'

/**
 * Base URL for API calls.
 *
 * Default is the same-origin `/api` prefix, which is proxied to the backend:
 *   - dev  : `vite.config.ts` -> `server.proxy` strips `/api` and forwards to
 *            http://localhost:8000
 *   - prod : `vercel.json` -> rewrite strips `/api` and forwards to Railway
 *
 * The backend routes themselves are NOT prefixed (`/chat`, `/projects`,
 * `/skills`, `/health`, `/resume/download`), so both proxies strip `/api`.
 *
 * `VITE_API_URL` is an optional escape hatch for pointing at a backend
 * directly (bypassing the proxy). Trailing slashes are trimmed so callers can
 * always join with a leading `/`.
 */
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_URL
  if (typeof raw !== 'string') return '/api'
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed === '' ? '/api' : trimmed
}

export const API_BASE = resolveApiBase()

const SSE_CONTENT_TYPE = 'text/event-stream'

/**
 * Guard against the API base resolving to something that is not actually the
 * API - e.g. a missing/mis-ordered Vercel rewrite serving `index.html` with a
 * 200 and `content-type: text/html`. Without this the stream parses to zero
 * events and the chat silently produces an empty reply.
 */
function assertEventStream(response: Response, url: string): void {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.toLowerCase().includes(SSE_CONTENT_TYPE)) return

  const detail = contentType || 'no content-type header'
  throw new Error(
    `Expected an SSE stream from ${url} but got "${detail}". ` +
      'The /api route is probably not proxied to the backend ' +
      '(check the Vercel rewrite or the Vite dev proxy).',
  )
}

/** Parse one SSE `data:` payload; returns null for malformed JSON. */
function parseEvent(data: string): SSEEvent | null {
  try {
    return JSON.parse(data) as SSEEvent
  } catch {
    return null
  }
}

/**
 * Pull complete lines out of `buffer`, leaving any trailing partial line
 * behind. Handles `\n`, `\r\n` and lone `\r` line endings so that events
 * split across chunk boundaries are never dropped or corrupted.
 */
function takeLines(buffer: string): { lines: string[]; rest: string } {
  const lines = buffer.split(/\r\n|\n|\r/)
  const rest = lines.pop() ?? ''
  return { lines, rest }
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  mode: ChatMode,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const url = `${API_BASE}/chat`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: SSE_CONTENT_TYPE },
    body: JSON.stringify({ messages, mode }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status} ${response.statusText}`.trim())
  }

  assertEventStream(response, url)

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { lines, rest } = takeLines(buffer)
      buffer = rest

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        const event = parseEvent(data)
        if (event) yield event
      }
    }

    // Flush anything the decoder was holding, plus a final line with no
    // trailing newline (some servers omit the terminating blank line).
    buffer += decoder.decode()
    const tail = buffer.trim()
    if (tail.startsWith('data:')) {
      const data = tail.slice(5).trim()
      if (data) {
        const event = parseEvent(data)
        if (event) yield event
      }
    }
  } finally {
    // Releasing the lock lets an aborted fetch tear the stream down cleanly.
    reader.releaseLock()
  }
}

export async function fetchProjects(signal?: AbortSignal): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`, { signal })
  if (!response.ok) return []
  return response.json()
}

export async function fetchSkills(signal?: AbortSignal): Promise<SkillCategory[]> {
  const response = await fetch(`${API_BASE}/skills`, { signal })
  if (!response.ok) return []
  return response.json()
}

export function getResumeDownloadUrl(): string {
  return `${API_BASE}/resume/download`
}
