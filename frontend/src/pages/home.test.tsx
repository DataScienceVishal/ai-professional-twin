import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Home from './home'
import { CONTACT_MAILTO, RECRUITER_ACTIONS } from '../lib/constants'
import { EXHIBIT } from '../lib/exhibit'
import { sseResponse } from '../test/sse'
import type { SourceInfo } from '../lib/types'

const TIMELINE = {
  education: [
    {
      institution: 'Northeastern University London',
      degree: 'MSc Artificial Intelligence & Computer Science',
      dates: 'January 2026 - January 2027',
      status: 'Currently enrolled',
    },
  ],
  work: [{ company: 'Teleperformance Global Business Pvt. Ltd.', role: 'Data Engineer', dates: 'Jun 2024 - Jan 2026' }],
}

const PROJECTS = [
  {
    name: 'AI Digital Twin - Full-Stack RAG Assistant',
    slug: 'ai-digital-twin',
    description: 'This assistant.',
    tech_stack: ['FastAPI', 'React'],
    github_url: 'https://github.com/DataScienceVishal/ai-professional-twin',
    category: 'Software Engineering',
    highlights: [],
  },
  {
    name: 'Telecom Churn Prediction',
    slug: 'telecom-churn-prediction',
    description: 'Predicted customer churn from 21 predictor variables and identified the strongest retention levers.',
    tech_stack: ['Python', 'Pandas', 'Scikit-learn', 'SQL'],
    github_url: 'https://github.com/DataScienceVishal/Telecom_Churn',
    category: 'Machine Learning',
    highlights: [],
  },
]

const SKILLS = [{ category: 'Core Programming', skills: ['Python'], proficiency: 'advanced' }]

// The backend joins a chunk's metadata in the order the store returns it: file order on one answer, flipped on another.
const IN_FILE_ORDER: SourceInfo[] = [
  { source: 'projects', detail: 'Telecom Churn Prediction - Machine Learning', url: 'https://github.com/DataScienceVishal/Telecom_Churn' },
  { source: 'academics', detail: 'Northeastern University London - MSc Artificial Intelligence & Computer Science', url: '' },
]

const FLIPPED: SourceInfo[] = [
  { source: 'projects', detail: 'Machine Learning - Telecom Churn Prediction', url: 'https://github.com/DataScienceVishal/Telecom_Churn' },
  { source: 'academics', detail: 'MSc Artificial Intelligence & Computer Science - Northeastern University London', url: '' },
]

const PROJECT_LABEL = 'Project · Telecom Churn Prediction · Machine Learning'
const ACADEMICS_LABEL = 'Academics · Northeastern University London · MSc Artificial Intelligence & Computer Science'

/** A reply carrying the recorded answer word for word, so the fixture says nothing the page does not already show. */
function reply(sources: SourceInfo[]): Response {
  return sseResponse([
    `data: ${JSON.stringify({ type: 'chunk', content: EXHIBIT.message.content })}\n\n`,
    `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`,
    'data: {"type":"done"}\n\n',
  ])
}

function mockApi({
  timelineOk = true,
  timelineBody = TIMELINE,
  replies = [],
}: { timelineOk?: boolean; timelineBody?: unknown; replies?: Response[] } = {}) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.endsWith('/chat')) return Promise.resolve(replies.shift())
    if (url.endsWith('/timeline')) {
      return Promise.resolve({ ok: timelineOk, json: async () => (timelineOk ? timelineBody : { detail: 'Not Found' }) } as Response)
    }
    const body = url.endsWith('/skills') ? SKILLS : PROJECTS
    return Promise.resolve({ ok: true, json: async () => body } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The first sheet has its data: a build row and the record are drawn. */
async function loaded() {
  await screen.findByRole('heading', { level: 3, name: PROJECTS[0].name })
  await screen.findByRole('list', { name: 'Dated record' })
}

/** Ask, then wait until the answer has finished and Ask is back. */
async function ask(question: string) {
  fireEvent.change(screen.getByLabelText('Ask about his record'), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await screen.findByRole('button', { name: 'Ask' })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Home', () => {
  it('opens on the title panel, the recorded answer and the record', async () => {
    mockApi()
    render(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: EXHIBIT.question })).toBeInTheDocument()
    expect(screen.getByText('Recorded 12 Oct 2026 · career_qa.yaml, availability')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Dated record' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Builds' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Legend' })).toBeInTheDocument()
  })

  it('keeps the contact links in the contact bar', async () => {
    mockApi()
    render(<Home />)
    const nav = screen.getByRole('navigation', { name: 'Contact' })
    expect(within(nav).getByRole('link', { name: 'Email' })).toHaveAttribute('href', CONTACT_MAILTO)
    await screen.findByRole('heading', { level: 3, name: PROJECTS[0].name })
  })

  it("switches layer and shows that layer's questions", async () => {
    mockApi()
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: 'Recruiter' }))
    expect(screen.getByRole('button', { name: 'Recruiter' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: RECRUITER_ACTIONS[0].label })).toBeInTheDocument()
    await screen.findByRole('heading', { level: 3, name: PROJECTS[0].name })
  })

  it('folds the layer row away on short screens, so the sheet keeps its room', async () => {
    mockApi()
    render(<Home />)
    const row = screen.getByRole('group', { name: 'Layer' }).parentElement
    expect(row).toContainElement(screen.getByRole('list', { name: 'Suggested questions' }))
    expect(row).toHaveClass('[@media(max-height:30rem)]:hidden')
    expect(screen.getByLabelText('Ask about his record').closest('form')?.parentElement).toContainElement(row)
    await screen.findByRole('heading', { level: 3, name: PROJECTS[0].name })
  })

  it('sends the chosen layer as the backend mode', async () => {
    const fetchMock = mockApi({ replies: [reply([])] })
    render(<Home />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Recruiter' }))
    fireEvent.click(screen.getByRole('button', { name: RECRUITER_ACTIONS[0].label }))
    await screen.findByRole('button', { name: 'Ask' })
    const [, init] = fetchMock.mock.calls.find(([url]) => url.endsWith('/chat')) ?? []
    expect(JSON.parse(String(init?.body))).toEqual({
      messages: [{ role: 'user', content: RECRUITER_ACTIONS[0].message }],
      mode: 'recruiter',
    })
  })

  it('re-plots the same sheet when the layer changes', async () => {
    mockApi()
    const { container } = render(<Home />)
    await screen.findByRole('list', { name: 'Dated record' })
    fireEvent.click(screen.getByRole('button', { name: 'Interview' }))
    expect(container.querySelector('main')).toHaveAttribute('data-layer', 'interview')
    expect(container.querySelector('[data-layer="interview"] [data-record]')).not.toBeNull()
  })

  it('hides the record when the backend has no timeline yet', async () => {
    mockApi({ timelineOk: false })
    render(<Home />)
    await screen.findByRole('heading', { name: 'Builds' })
    expect(screen.queryByRole('list', { name: 'Dated record' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
  })

  it('keeps the title panel, the recorded answer and the dock when the timeline reply has the wrong shape', async () => {
    mockApi({ timelineBody: {} })
    render(<Home />)
    await screen.findByRole('heading', { name: 'Builds' })
    expect(screen.queryByRole('list', { name: 'Dated record' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: EXHIBIT.question })).toBeInTheDocument()
    expect(screen.getByLabelText('Ask about his record')).toBeInTheDocument()
  })

  it('draws no record band for an empty timeline', async () => {
    mockApi({ timelineBody: { education: [], work: [] } })
    const { container } = render(<Home />)
    await screen.findByRole('heading', { name: 'Builds' })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('section[data-record]')).toBeNull()
    expect(screen.queryByRole('heading', { name: /His record/ })).toBeNull()
  })

  it('still lists the record when its only entry has dates it cannot read', async () => {
    mockApi({ timelineBody: { education: [{ institution: 'Somewhere', degree: 'Unknown', dates: 'sometime', status: '' }], work: [] } })
    render(<Home />)
    const list = await screen.findByRole('list', { name: 'Dated record' })
    expect(within(list).getByText('Unknown, Somewhere')).toBeInTheDocument()
  })

  it('closes an open source with Escape', async () => {
    mockApi()
    render(<Home />)
    const chip = screen.getByRole('button', { name: 'Career Q&A · Availability' })
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'false'))
    expect(chip).toBeInTheDocument()
  })

  it("lights the recorded answer's note while its source is open", async () => {
    mockApi()
    render(<Home />)
    const note = screen.getByRole('heading', { level: 2, name: EXHIBIT.question }).closest('article')
    expect(note).not.toHaveAttribute('data-lit')
    fireEvent.click(screen.getByRole('button', { name: 'Career Q&A · Availability' }))
    expect(note).toHaveAttribute('data-lit', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(note).not.toHaveAttribute('data-lit'))
  })

  it('keeps every text section of the first sheet at full contrast', async () => {
    mockApi()
    const { container } = render(<Home />)
    await screen.findByRole('list', { name: 'Dated record' })
    await screen.findByRole('heading', { name: 'Builds' })
    for (const section of container.querySelectorAll('section, article')) {
      expect(section).not.toHaveAttribute('data-dim')
    }
  })

  it('claims one column a year only where the map draws columns', async () => {
    mockApi()
    render(<Home />)
    await screen.findByRole('list', { name: 'Dated record' })
    const scale = screen.getByText('One column is one year.')
    expect(scale).toHaveClass('hidden', 'lg:inline')
    expect(scale.parentElement).toHaveTextContent('Dates come from academics.yaml and linkedin.yaml.')
    expect(scale.parentElement).not.toHaveClass('hidden')
  })

  it('keeps the hidden record strip inside the record section', async () => {
    mockApi()
    const { container } = render(<Home />)
    await screen.findByRole('list', { name: 'Dated record' })
    expect(container.querySelector('section[data-record]')).toHaveClass('relative')
  })

  it('labels each cited source the same way, whatever order its metadata arrives in', async () => {
    mockApi({ replies: [reply(IN_FILE_ORDER), reply(FLIPPED)] })
    render(<Home />)
    await loaded()
    await ask(EXHIBIT.question)
    await ask(EXHIBIT.question)
    expect(screen.getAllByRole('button', { name: PROJECT_LABEL })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: ACADEMICS_LABEL })).toHaveLength(2)
  })

  it('Clear chat closes an open source and returns to the first sheet', async () => {
    mockApi({ replies: [reply(IN_FILE_ORDER)] })
    const { container } = render(<Home />)
    await loaded()
    await ask(EXHIBIT.question)
    fireEvent.click(screen.getByRole('button', { name: ACADEMICS_LABEL }))
    expect(container.querySelector('[data-focus="on"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual(['General'])
    expect(container.querySelector('[data-focus]')).toBeNull()
  })

  it('shows the record beside the conversation', async () => {
    mockApi({ replies: [reply(IN_FILE_ORDER)] })
    render(<Home />)
    await loaded()
    await ask(EXHIBIT.question)
    const lists = screen.getAllByRole('list', { name: 'Dated record' })
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) {
      expect(list.closest('aside, [role="group"]')).toHaveAccessibleName('His record')
    }
  })

  it('shows the contact bar on desktop while the title panel is out of view', async () => {
    let report: ((entries: { isIntersecting: boolean }[]) => void) | undefined
    let watched: Element | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          report = callback
        }
        observe(element: Element) {
          watched = element
        }
        disconnect() {}
      },
    )
    mockApi()
    render(<Home />)
    await loaded()
    const nav = () => screen.getByRole('navigation', { name: 'Contact' })
    expect(watched).toBe(screen.getByRole('region', { name: 'Vishal Khan' }))
    expect(nav().className).toContain('lg:hidden')
    act(() => report?.([{ isIntersecting: false }]))
    expect(nav().className).not.toContain('lg:hidden')
    act(() => report?.([{ isIntersecting: true }]))
    expect(nav().className).toContain('lg:hidden')
  })

  it('shows the contact bar on desktop once a conversation starts', async () => {
    mockApi({ replies: [reply(IN_FILE_ORDER)] })
    render(<Home />)
    await loaded()
    expect(screen.getByRole('navigation', { name: 'Contact' }).className).toContain('lg:hidden')
    await ask(EXHIBIT.question)
    expect(screen.getByRole('navigation', { name: 'Contact' }).className).not.toContain('lg:hidden')
  })
})
