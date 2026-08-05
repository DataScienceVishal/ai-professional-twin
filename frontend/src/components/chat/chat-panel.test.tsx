import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './chat-panel'
import type { Message, Project, SkillCategory } from '../../lib/types'

const PROJECTS: Project[] = [
  {
    name: 'Telecom Churn Prediction',
    slug: 'telecom-churn-prediction',
    description: 'Predicted customer churn from 21 predictor variables.',
    tech_stack: ['Python'],
    github_url: 'https://github.com/DataScienceVishal/Telecom_Churn',
    category: 'Machine Learning',
    highlights: [],
  },
  {
    name: 'RL for Dynamic Pricing',
    slug: 'rl-dynamic-pricing',
    description: 'MSc thesis on reinforcement learning for pricing.',
    tech_stack: ['Python'],
    github_url: '',
    category: 'Research',
    highlights: [],
  },
]

const SKILLS: SkillCategory[] = [
  { category: 'Core Programming', skills: ['Python'], proficiency: 'advanced' },
]

/** Route `/api/projects` and `/api/skills` to their own payloads. */
function mockApi({ projects = PROJECTS, skills = SKILLS, fail = false } = {}) {
  const fetchMock = vi.fn((url: string) => {
    if (fail) return Promise.reject(new Error('network down'))
    const body = url.includes('/skills') ? skills : projects
    return Promise.resolve({ ok: true, json: async () => body } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPanel(messages: Message[] = []) {
  return render(
    <ChatPanel messages={messages} isStreaming={false} mode="default" onSend={() => {}} />,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ChatPanel empty state', () => {
  it('shows the project showcase alongside the intro copy', async () => {
    mockApi()
    renderPanel()

    expect(screen.getByText("Vishal Khan's AI Twin")).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    expect(screen.getByText('Telecom Churn Prediction')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeInTheDocument()
  })

  it('links only the projects that have a repository', async () => {
    mockApi()
    renderPanel()

    await screen.findByText('RL for Dynamic Pricing')
    const links = screen.getAllByRole('link', { name: /View on GitHub/ })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://github.com/DataScienceVishal/Telecom_Churn')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('keeps the intro copy intact when the showcase requests fail', async () => {
    mockApi({ fail: true })
    const { container } = renderPanel()

    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeNull())
    // Nothing broken and no empty shell: the showcase wrapper renders no DOM
    // at all, so `empty:hidden` collapses its spacing too.
    expect(screen.getByTestId('showcase')).toBeEmptyDOMElement()
    expect(container.querySelectorAll('section')).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Skills' })).toBeNull()
    // The chat itself is untouched.
    expect(screen.getByText("Vishal Khan's AI Twin")).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask me anything/)).toBeInTheDocument()
  })

  it('drops the showcase as soon as a conversation starts', async () => {
    const fetchMock = mockApi()
    renderPanel([{ role: 'user', content: 'Who is Vishal?' }])

    expect(screen.queryByText("Vishal Khan's AI Twin")).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull()
    expect(screen.getByText('Who is Vishal?')).toBeInTheDocument()
    // The showcase never mounted, so it never hit the network either.
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
  })

  it('does not auto-scroll past the showcase on first paint', async () => {
    mockApi()
    const { container } = renderPanel()
    await screen.findByText('Telecom Churn Prediction')

    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    // jsdom reports 0 heights, so assert the intent: the "follow the
    // conversation" jump must not run while the empty state is showing.
    expect(scroller.scrollTop).toBe(0)
  })
})
