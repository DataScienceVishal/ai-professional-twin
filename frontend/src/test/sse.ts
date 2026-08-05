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

/** Install a `fetch` mock that always resolves to `response`. */
export function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
