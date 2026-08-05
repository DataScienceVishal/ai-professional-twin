import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, getResumeDownloadUrl, streamChat } from './api'
import { htmlResponse, mockFetch, sseResponse } from '../test/sse'
import type { SSEEvent } from './types'

async function collect(
  chunks: Parameters<typeof sseResponse>[0],
  init?: Parameters<typeof sseResponse>[1],
) {
  mockFetch(sseResponse(chunks, init))
  const events: SSEEvent[] = []
  for await (const event of streamChat([{ role: 'user', content: 'hi' }], 'default')) {
    events.push(event)
  }
  return events
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('API_BASE', () => {
  it('defaults to the same-origin /api prefix that the proxies rewrite', () => {
    expect(API_BASE).toBe('/api')
    expect(getResumeDownloadUrl()).toBe('/api/resume/download')
  })
})

describe('streamChat', () => {
  it('posts to the /chat route under the API base', async () => {
    const fetchMock = mockFetch(sseResponse(['data: {"type":"done"}\n\n']))
    for await (const event of streamChat([{ role: 'user', content: 'hi' }], 'recruiter')) {
      void event
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body as string)).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      mode: 'recruiter',
    })
  })

  it('parses well-formed events delivered one per chunk', async () => {
    const events = await collect([
      'data: {"type":"chunk","content":"Hello"}\n\n',
      'data: {"type":"chunk","content":" world"}\n\n',
      'data: {"type":"done"}\n\n',
    ])
    expect(events).toEqual([
      { type: 'chunk', content: 'Hello' },
      { type: 'chunk', content: ' world' },
      { type: 'done' },
    ])
  })

  it('reassembles an event split across chunk boundaries', async () => {
    // The JSON payload, the `data:` prefix and the newline are all torn apart.
    const events = await collect([
      'da',
      'ta: {"type":"chunk","con',
      'tent":"split across chunks"}',
      '\n\ndata: {"type":"do',
      'ne"}\n\n',
    ])
    expect(events).toEqual([
      { type: 'chunk', content: 'split across chunks' },
      { type: 'done' },
    ])
  })

  it('reassembles multibyte characters split across chunk boundaries', async () => {
    const payload = 'data: {"type":"chunk","content":"café ☕"}\n\n'
    const bytes = new TextEncoder().encode(payload)
    // Cut in the middle of the 2-byte "é" sequence, then again mid-"☕".
    const eIndex = payload.indexOf('é')
    const events = await collect([bytes.slice(0, eIndex + 1), bytes.slice(eIndex + 1)])
    expect(events).toEqual([{ type: 'chunk', content: 'café ☕' }])
  })

  it('handles \\r\\n line endings', async () => {
    const events = await collect([
      'data: {"type":"chunk","content":"crlf"}\r\n\r\n',
      'data: {"type":"done"}\r\n\r\n',
    ])
    expect(events).toEqual([{ type: 'chunk', content: 'crlf' }, { type: 'done' }])
  })

  it('emits a final event that has no trailing newline', async () => {
    const events = await collect(['data: {"type":"done"}'])
    expect(events).toEqual([{ type: 'done' }])
  })

  it('skips malformed JSON without aborting the stream', async () => {
    const events = await collect([
      'data: {"type":"chunk","content":"ok"}\n\n',
      'data: {not json at all\n\n',
      'data: \n\n',
      ': keep-alive comment\n\n',
      'event: ping\n\n',
      'data: {"type":"done"}\n\n',
    ])
    expect(events).toEqual([{ type: 'chunk', content: 'ok' }, { type: 'done' }])
  })

  it('yields the new error event type', async () => {
    const events = await collect(['data: {"type":"error","message":"LLM timed out"}\n\n'])
    expect(events).toEqual([{ type: 'error', message: 'LLM timed out' }])
  })

  it('throws when the response is HTML instead of an SSE stream', async () => {
    mockFetch(htmlResponse())
    const iterate = async () => {
      for await (const event of streamChat([{ role: 'user', content: 'hi' }], 'default')) {
        void event
      }
    }
    await expect(iterate()).rejects.toThrow(/Expected an SSE stream/)
    await expect(iterate()).rejects.toThrow(/text\/html/)
  })

  it('throws when the content-type header is missing entirely', async () => {
    mockFetch(sseResponse(['data: {"type":"done"}\n\n'], { contentType: '' }))
    const iterate = async () => {
      for await (const event of streamChat([{ role: 'user', content: 'hi' }], 'default')) {
        void event
      }
    }
    await expect(iterate()).rejects.toThrow(/no content-type header/)
  })

  it('throws on a non-OK response', async () => {
    mockFetch(
      sseResponse([], { ok: false, status: 502, statusText: 'Bad Gateway' }),
    )
    const iterate = async () => {
      for await (const event of streamChat([{ role: 'user', content: 'hi' }], 'default')) {
        void event
      }
    }
    await expect(iterate()).rejects.toThrow('Chat request failed: 502 Bad Gateway')
  })
})
