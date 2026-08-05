import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillSummary } from './skill-summary'
import type { SkillCategory } from '../../lib/types'

const CATEGORIES: SkillCategory[] = [
  { category: 'Core Programming', skills: ['Python', 'SQL'], proficiency: 'advanced' },
  { category: 'Generative AI', skills: ['LLMs', 'RAG'], proficiency: 'advanced' },
]

function mockJson(body: unknown, init: { ok?: boolean; pending?: boolean } = {}) {
  const { ok = true, pending = false } = init
  const fetchMock = vi.fn(() =>
    pending
      ? new Promise<Response>(() => {})
      : Promise.resolve({ ok, json: async () => body } as Response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SkillSummary', () => {
  it('groups every skill under its category once loaded', async () => {
    mockJson(CATEGORIES)
    render(<SkillSummary />)

    expect(await screen.findByText('Core Programming')).toBeInTheDocument()
    expect(screen.getByText('Generative AI')).toBeInTheDocument()
    for (const skill of ['Python', 'SQL', 'LLMs', 'RAG']) {
      expect(screen.getByText(skill)).toBeInTheDocument()
    }
  })

  it('requests the skills route under the API base', async () => {
    const fetchMock = mockJson(CATEGORIES)
    render(<SkillSummary />)

    await screen.findByText('Core Programming')
    const [url] = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(url).toBe('/api/skills')
  })

  it('shows a skeleton while the request is in flight', () => {
    mockJson(null, { pending: true })
    const { container } = render(<SkillSummary />)

    expect(screen.getByRole('region', { name: 'Skills' })).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders nothing when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const { container } = render(<SkillSummary />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('aborts the in-flight request when it unmounts', () => {
    let captured: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        captured = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      }),
    )

    const { unmount } = render(<SkillSummary />)
    unmount()
    expect(captured?.aborted).toBe(true)
  })
})
