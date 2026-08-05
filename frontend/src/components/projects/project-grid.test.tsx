import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectGrid } from './project-grid'
import type { Project } from '../../lib/types'

function project(partial: Partial<Project> = {}): Project {
  return {
    name: 'Telecom Churn Prediction',
    slug: 'telecom-churn-prediction',
    description: 'Predicted customer churn from 21 predictor variables.',
    tech_stack: ['Python', 'Pandas'],
    github_url: 'https://github.com/DataScienceVishal/Telecom_Churn',
    category: 'Machine Learning',
    highlights: ['Full EDA pipeline'],
    ...partial,
  }
}

/** Mock `fetch` with a JSON response; the promise never settles if `pending`. */
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

describe('ProjectGrid', () => {
  it('renders a card per project once they load', async () => {
    mockJson([project(), project({ name: 'CIFAR-10 CNN', slug: 'cifar-10' })])
    render(<ProjectGrid />)

    expect(await screen.findByText('Telecom Churn Prediction')).toBeInTheDocument()
    expect(screen.getByText('CIFAR-10 CNN')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('requests the projects route under the API base', async () => {
    const fetchMock = mockJson([project()])
    render(<ProjectGrid />)

    await screen.findByText('Telecom Churn Prediction')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(url).toBe('/api/projects')
  })

  it('shows the skeleton placeholder while the request is in flight', () => {
    mockJson(null, { pending: true })
    const { container } = render(<ProjectGrid />)

    const section = screen.getByRole('region', { name: 'Projects' })
    expect(section).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('renders nothing at all - not an empty shell - when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const { container } = render(<ProjectGrid />)

    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeNull())
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull()
  })

  it('renders nothing when the backend responds with an empty list', async () => {
    mockJson([])
    const { container } = render(<ProjectGrid />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders nothing when the backend returns a non-OK status', async () => {
    mockJson({ detail: 'boom' }, { ok: false })
    const { container } = render(<ProjectGrid />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('aborts the in-flight request when it unmounts mid-conversation', () => {
    let captured: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        captured = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      }),
    )

    const { unmount } = render(<ProjectGrid />)
    expect(captured).toBeDefined()
    expect(captured?.aborted).toBe(false)

    unmount()
    expect(captured?.aborted).toBe(true)
  })
})
