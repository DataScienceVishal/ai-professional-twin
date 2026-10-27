import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { ChatPanel } from './chat-panel'
import { InputBar } from './input-bar'
import { RecordStrip } from '../sheet/route-map'
import { SheetContext } from '../sheet/sheet-context'
import { renderWithSheet } from '../../test/sheet'
import { FULL_TIME_FROM } from '../../lib/constants'
import { buildRecord } from '../../lib/timeline'
import type { Message, SourceInfo } from '../../lib/types'

const SOURCE: SourceInfo = { source: 'career_qa', detail: 'availability', url: '' }

const CONVERSATION: Message[] = [
  { role: 'user', content: 'When can he start?' },
  { role: 'assistant', content: 'January 2027.', sources: [SOURCE] },
  { role: 'user', content: 'Where is he based?' },
  { role: 'assistant', content: 'London.', sources: [] },
]

const NOW = new Date(2026, 9, 12)

const RECORD = buildRecord(
  {
    education: [
      {
        institution: 'Northeastern University London',
        degree: 'MSc Artificial Intelligence & Computer Science',
        dates: 'January 2026 - January 2027',
        status: 'Currently enrolled',
      },
    ],
    work: [{ company: 'Teleperformance Global Business Pvt. Ltd.', role: 'Data Engineer', dates: 'Jun 2024 - Jan 2026' }],
  },
  NOW,
  FULL_TIME_FROM,
)

const ACADEMICS: SourceInfo = {
  source: 'academics',
  detail: 'Northeastern University London - MSc Artificial Intelligence & Computer Science',
  url: '',
}

function renderPanel(messages: Message[], extra: { isStreaming?: boolean; onClear?: () => void } = {}) {
  return renderWithSheet(
    <ChatPanel
      messages={messages}
      isStreaming={extra.isStreaming ?? false}
      firstSheet={<p>first sheet</p>}
      rail={<p>record strip</p>}
      onClear={extra.onClear ?? (() => {})}
    />,
  )
}

/** jsdom lays nothing out, so every element gets these sizes until the test ends. */
function fakeLayout(scrollHeight: number, offsetTop: (element: HTMLElement) => number = () => 0) {
  const height = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')!
  const top = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      return offsetTop(this)
    },
  })
  onTestFinished(() => {
    Object.defineProperty(Element.prototype, 'scrollHeight', height)
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', top)
  })
}

/** The desktop rail's frame: the one box that sticks beside the notes. */
function railFrame(): HTMLElement {
  const frame = document.querySelector<HTMLElement>('aside .sticky')
  if (!frame) throw new Error('no rail frame')
  return frame
}

describe('ChatPanel', () => {
  it('shows the first sheet until the first question', () => {
    renderPanel([])
    expect(screen.getByText('first sheet')).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('pairs each question with its answer in one note', () => {
    renderPanel(CONVERSATION)
    const notes = screen.getAllByRole('article')
    expect(notes).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'When can he start?' })).toBeInTheDocument()
    expect(screen.getByText('January 2027.')).toBeInTheDocument()
    expect(screen.queryByText('first sheet')).toBeNull()
  })

  it('marks only the last note as being written while streaming', () => {
    renderPanel(CONVERSATION, { isStreaming: true })
    const notes = screen.getAllByRole('article')
    expect(notes[0]).not.toHaveAttribute('aria-busy')
    expect(notes[0].className).toContain('border-ink')
    expect(notes[0].className).not.toContain('border-route')
    expect(notes[1]).toHaveAttribute('aria-busy', 'true')
  })

  it('clears the conversation', () => {
    const onClear = vi.fn()
    renderPanel(CONVERSATION, { onClear })
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('lights only the note whose source is open', () => {
    const { container } = renderPanel(CONVERSATION)
    fireEvent.click(screen.getByRole('button', { name: 'Career Q&A · Availability' }))
    const notes = screen.getAllByRole('article')
    expect(container.querySelector('[data-focus="on"]')).not.toBeNull()
    expect(notes[0]).toHaveAttribute('data-lit', 'true')
    expect(notes[1]).not.toHaveAttribute('data-lit')
  })

  it('keeps the note column shrinkable beside the rail', () => {
    renderPanel(CONVERSATION)
    const column = screen.getAllByRole('article')[0].parentElement
    expect(column?.className).toContain('min-w-0')
    expect(screen.getAllByText('record strip').length).toBeGreaterThan(0)
  })

  it('goes back to the top of the first sheet when the conversation empties', () => {
    fakeLayout(1000)
    const panel = (messages: Message[]) => (
      <ChatPanel messages={messages} isStreaming={false} firstSheet={<p>first sheet</p>} onClear={() => {}} />
    )
    const { container, rerender } = render(panel(CONVERSATION))
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    expect(scroller.scrollTop).toBe(1000)
    rerender(panel([]))
    expect(scroller.scrollTop).toBe(0)
  })

  it('reports busy only once answer text is streaming', () => {
    renderPanel([...CONVERSATION.slice(0, 3), { role: 'assistant', content: '' }], { isStreaming: true })
    const last = screen.getAllByRole('article')[1]
    expect(last.className).toContain('border-route')
    expect(last).not.toHaveAttribute('aria-busy')
  })

  it('numbers no questions and dates no answers in the conversation', () => {
    renderPanel(CONVERSATION)
    expect(screen.queryByText(/^Question \d/)).toBeNull()
    for (const note of screen.getAllByRole('article')) {
      expect(note.firstElementChild?.tagName).toBe('H2')
      expect(note.querySelector('h2 + p')).toBeNull()
    }
  })

  it('heads the conversation view with the page heading', () => {
    renderPanel(CONVERSATION)
    expect(screen.getByRole('heading', { level: 1, name: 'Conversation' })).toBeInTheDocument()
  })

  it('follows the open source in the rail', () => {
    // Lit bars sit lower than the lit entry, so aiming at a graphic would land elsewhere.
    fakeLayout(900, (element) => (element.closest('[data-graphic]') ? 500 : element.hasAttribute('data-lit') ? 240 : 0))
    const conversation: Message[] = [
      { role: 'user', content: 'Where does he study?' },
      { role: 'assistant', content: 'Northeastern.', sources: [ACADEMICS] },
    ]
    // One provider tree throughout, so the panel and its frame stay mounted as on the page.
    const panel = (messages: Message[], focused: SourceInfo | null) => (
      <SheetContext.Provider value={{ record: RECORD, trailing: {}, focused, setFocused: () => {} }}>
        <ChatPanel
          messages={messages}
          isStreaming={false}
          firstSheet={<p>first sheet</p>}
          rail={<RecordStrip record={RECORD} now={NOW} />}
          onClear={() => {}}
        />
      </SheetContext.Provider>
    )
    const { rerender } = render(panel([], null))
    rerender(panel(conversation, null))
    const frame = railFrame()
    expect(frame.scrollTop).toBe(900)
    rerender(panel(conversation, ACADEMICS))
    expect(frame.scrollTop).toBe(232)
    rerender(panel(conversation, null))
    expect(frame.scrollTop).toBe(900)
  })

  it('lets the keyboard reach the rail', () => {
    renderPanel(CONVERSATION)
    expect(railFrame()).toHaveAttribute('tabindex', '0')
  })

  it('gives the rail the thin, muted scrollbar the sheet uses', () => {
    renderPanel(CONVERSATION)
    expect(railFrame()).toHaveClass('scroll-frame')
  })

  it('hands focus to the ask field when Clear chat is pressed from the keyboard', () => {
    renderWithSheet(
      <>
        <ChatPanel messages={CONVERSATION} isStreaming={false} firstSheet={<p>first sheet</p>} onClear={() => {}} />
        <InputBar onSend={() => {}} />
      </>,
    )
    const field = screen.getByLabelText('Ask about his record')
    const clear = screen.getByRole('button', { name: 'Clear chat' })
    fireEvent.click(clear, { detail: 1 })
    expect(field).not.toHaveFocus()
    fireEvent.click(clear, { detail: 0 })
    expect(field).toHaveFocus()
  })

  it('says once, politely, that an answer is ready when its stream ends', () => {
    const question: Message = { role: 'user', content: 'When can he start?' }
    const answer: Message = { role: 'assistant', content: 'January 2027.', sources: [] }
    const view = (messages: Message[], isStreaming: boolean) => (
      <ChatPanel messages={messages} isStreaming={isStreaming} firstSheet={<p>first sheet</p>} onClear={() => {}} />
    )
    const { rerender } = render(view([], false))
    const status = screen.getByTestId('answer-status')
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toBeEmptyDOMElement()

    rerender(view([question, { role: 'assistant', content: '' }], true))
    expect(screen.getByTestId('answer-status')).toBe(status)
    expect(status).toBeEmptyDOMElement()
    rerender(view([question, { role: 'assistant', content: 'January' }], true))
    expect(status).toBeEmptyDOMElement()
    rerender(view([question, answer], false))
    expect(status).toHaveTextContent('Answer ready')

    rerender(view([question, answer, { role: 'user', content: 'Where is he based?' }, { role: 'assistant', content: '' }], true))
    expect(status).toBeEmptyDOMElement()
  })

  it('says nothing about an answer it did not see stream, or one stopped before any text', () => {
    const question: Message = { role: 'user', content: 'When can he start?' }
    const view = (messages: Message[], isStreaming: boolean) => (
      <ChatPanel messages={messages} isStreaming={isStreaming} firstSheet={<p>first sheet</p>} onClear={() => {}} />
    )
    const { rerender } = render(view([question, { role: 'assistant', content: 'January 2027.' }], false))
    expect(screen.getByTestId('answer-status')).toBeEmptyDOMElement()
    rerender(view([question, { role: 'assistant', content: 'January 2027.' }, question, { role: 'assistant', content: '' }], true))
    rerender(view([question, { role: 'assistant', content: 'January 2027.' }, question, { role: 'assistant', content: '' }], false))
    expect(screen.getByTestId('answer-status')).toBeEmptyDOMElement()
  })

  it('leaves the failure to its own alert instead of saying an answer is ready', () => {
    const question: Message = { role: 'user', content: 'When can he start?' }
    const view = (messages: Message[], isStreaming: boolean) => (
      <ChatPanel messages={messages} isStreaming={isStreaming} firstSheet={<p>first sheet</p>} onClear={() => {}} />
    )
    const { rerender } = render(view([question, { role: 'assistant', content: '' }], true))
    rerender(view([question, { role: 'assistant', content: 'The assistant backend ran into a problem.', isError: true }], false))
    expect(screen.getByTestId('answer-status')).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toHaveTextContent('ran into a problem')
  })

  it('names the desktop rail once, on its frame', () => {
    renderPanel(CONVERSATION)
    const frame = screen.getByRole('group', { name: 'His record' })
    expect(frame.closest('aside')).not.toHaveAttribute('aria-label')
    expect(screen.getAllByRole('complementary', { name: 'His record' })).toHaveLength(1)
  })

  it('reads the phone record before the notes', () => {
    renderPanel(CONVERSATION)
    const phone = screen.getByRole('complementary', { name: 'His record' })
    const desktop = screen.getByRole('group', { name: 'His record' }).closest('aside') as HTMLElement
    const notes = screen.getAllByRole('article')
    expect(phone.querySelector('details')).not.toBeNull()
    expect(phone.compareDocumentPosition(notes[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notes[notes.length - 1].compareDocumentPosition(desktop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
