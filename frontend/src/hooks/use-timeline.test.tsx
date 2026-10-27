import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTimeline } from './use-timeline'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTimeline', () => {
  it('loads the timeline once', async () => {
    const body = {
      education: [],
      work: [{ company: 'PJRJ Associates', role: 'Finance/Accounts/Taxation', dates: 'Jul 2018 - Sep 2020' }],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body }) as Response))

    const { result } = renderHook(() => useTimeline())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.timeline).toEqual(body)
  })

  it('settles to null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    const { result } = renderHook(() => useTimeline())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.timeline).toBeNull()
  })

  it('aborts the request on unmount', () => {
    let captured: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        captured = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      }),
    )

    const { unmount } = renderHook(() => useTimeline())
    unmount()

    expect(captured?.aborted).toBe(true)
  })
})
