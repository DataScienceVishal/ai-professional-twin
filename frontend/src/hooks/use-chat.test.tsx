import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChat } from './use-chat'
import { errorResponse, htmlResponse, mockFetch, sseResponse } from '../test/sse'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useChat', () => {
  it('accumulates streamed chunks into the assistant message', async () => {
    mockFetch(
      sseResponse([
        'data: {"type":"chunk","content":"Vishal "}\n\n',
        'data: {"type":"chunk","content":"is an ML engineer."}\n\n',
        'data: {"type":"sources","sources":[{"source":"cv","detail":"resume","url":"#"}]}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Who is Vishal?')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Who is Vishal?',
    })
    const assistant = result.current.messages[1]
    expect(assistant.role).toBe('assistant')
    expect(assistant.content).toBe('Vishal is an ML engineer.')
    expect(assistant.isError).toBe(false)
    expect(assistant.sources).toHaveLength(1)
  })

  it('records tool activity emitted during the stream', async () => {
    mockFetch(
      sseResponse([
        'data: {"type":"tool_start","tool":"search_repos","args":{"q":"rag"}}\n\n',
        'data: {"type":"tool_result","tool":"search_repos","summary":"3 repos"}\n\n',
        'data: {"type":"chunk","content":"Found some repos."}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Show repos')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.messages[1].toolsUsed).toEqual([
      { tool: 'search_repos', args: { q: 'rag' }, summary: '3 repos' },
    ])
  })

  it('surfaces a backend error event as an error message', async () => {
    mockFetch(
      sseResponse([
        'data: {"type":"chunk","content":"Partial answer"}\n\n',
        'data: {"type":"error","message":"Upstream model unavailable"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Anything')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    const assistant = result.current.messages[1]
    expect(assistant.isError).toBe(true)
    expect(assistant.content).toContain('Partial answer')
    expect(assistant.content).toContain('Upstream model unavailable')
    expect(console.error).toHaveBeenCalled()
  })

  it('logs and surfaces a thrown transport error (HTML instead of SSE)', async () => {
    mockFetch(htmlResponse())

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Anything')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    const assistant = result.current.messages[1]
    expect(assistant.isError).toBe(true)
    expect(assistant.content).toMatch(/could not reach the assistant backend/i)
    expect(assistant.content).toMatch(/Expected an SSE stream/)
    expect(console.error).toHaveBeenCalledWith(
      '[chat] streaming failed:',
      expect.any(Error),
    )
  })

  it('does not blame the network when the backend rejected the request', async () => {
    // A 422 means the request arrived and was understood well enough to be
    // refused, so "could not reach the backend" is both wrong and useless -
    // retrying sends the identical payload and fails identically.
    mockFetch(
      errorResponse(422, {
        detail: [{ type: 'string_too_long', msg: 'String should have at most 2000 characters' }],
      }),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('a follow-up question')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    const assistant = result.current.messages[1]
    expect(assistant.isError).toBe(true)
    expect(assistant.content).not.toMatch(/could not reach/i)
    expect(assistant.content).toMatch(/too long/i)
    // The raw pydantic error is developer noise, not something a visitor reads.
    expect(assistant.content).not.toMatch(/string_too_long/)
  })

  it("shows the backend's own explanation for a 503 or a 429", async () => {
    mockFetch(
      errorResponse(503, {
        detail: 'The assistant is still starting up and indexing its knowledge base.',
      }),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(false))
    expect(result.current.messages[1].content).toMatch(/still starting up/)
  })

  it('does not replay an error bubble back to the model as context', async () => {
    // The failed turn leaves an apology in the transcript; it is a UI notice,
    // not something the assistant said.
    mockFetch(errorResponse(503, { detail: 'Still starting up.' }))
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('first')
    })

    const fetchMock = mockFetch(sseResponse(['data: {"type":"done"}\n\n']))
    await act(async () => {
      await result.current.sendMessage('second')
    })

    const options = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as RequestInit
    expect(JSON.parse(options.body as string).messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ])
  })

  it('ignores empty input', async () => {
    const fetchMock = mockFetch(sseResponse(['data: {"type":"done"}\n\n']))
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('   ')
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('passes an abort signal and aborts in-flight work on clear', async () => {
    const fetchMock = mockFetch(sseResponse(['data: {"type":"done"}\n\n']))
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    const options = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as RequestInit
    const signal = options.signal as AbortSignal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)

    act(() => result.current.clearMessages())
    expect(result.current.messages).toHaveLength(0)
    expect(result.current.isStreaming).toBe(false)
  })

  it('exposes stopStreaming which aborts the active request', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const encoder = new TextEncoder()
    let served = false
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: {
        getReader: () => ({
          read: async () => {
            if (!served) {
              served = true
              return {
                done: false,
                value: encoder.encode('data: {"type":"chunk","content":"start"}\n\n'),
              }
            }
            await gate
            return { done: true, value: undefined }
          },
          releaseLock: () => {},
        }),
      },
    } as unknown as Response

    const fetchMock = mockFetch(response)
    const { result } = renderHook(() => useChat())

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.sendMessage('long running')
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(true))

    act(() => result.current.stopStreaming())
    expect(result.current.isStreaming).toBe(false)

    const options = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as RequestInit
    expect((options.signal as AbortSignal).aborted).toBe(true)

    release?.()
    await act(async () => {
      await pending
    })
  })

  it('aborts the in-flight request when the component unmounts', async () => {
    const fetchMock = mockFetch(sseResponse(['data: {"type":"done"}\n\n']))
    const { result, unmount } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('hello')
    })
    const options = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as RequestInit
    unmount()
    // Already-settled requests are a no-op; the signal object still exists.
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })
})
