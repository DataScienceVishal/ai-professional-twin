import { vi } from 'vitest'

/**
 * Build a minimal `Response`-like object whose body streams the given string
 * chunks verbatim. Chunks are emitted exactly as supplied so tests can split
 * an SSE event across a chunk boundary.
 */
export function sseResponse(
  chunks: (string | Uint8Array)[],
  init: { ok?: boolean; status?: number; statusText?: string; contentType?: string } = {},
): Response {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    contentType = 'text/event-stream; charset=utf-8',
  } = init

  const encoder = new TextEncoder()
  let i = 0

  const reader = {
    read: async () => {
      if (i >= chunks.length) return { done: true, value: undefined }
      const chunk = chunks[i++]
      return {
        done: false,
        value: typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
      }
    },
    releaseLock: () => {},
  }

  return {
    ok,
    status,
    statusText,
    headers: new Headers(contentType ? { 'content-type': contentType } : {}),
    body: { getReader: () => reader },
  } as unknown as Response
}

/** Response that looks like the SPA `index.html` fallback (the original bug). */
export function htmlResponse(): Response {
  return sseResponse(['<!doctype html><html><body>app</body></html>'], {
    contentType: 'text/html; charset=utf-8',
  })
}

/**
 * Response for a non-OK status with a JSON error body, as FastAPI sends.
 * `statusText` defaults to empty because HTTP/2 - what Vercel serves - drops
 * the reason phrase, so production only ever has the numeric status to go on.
 */
export function errorResponse(status: number, body: unknown, statusText = ''): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    body: null,
  } as unknown as Response
}

/** Install a `fetch` mock that always resolves to `response`. */
export function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
