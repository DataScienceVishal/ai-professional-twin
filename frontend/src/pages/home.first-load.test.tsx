import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Home from './home'
import { Message } from '../components/chat/message'
import { EXHIBIT } from '../lib/exhibit'

// Mermaid and the syntax highlighter are large, and the first sheet has no
// diagram and no code, so each should load only for an answer that needs it.
// Each factory below runs the first time its module is imported, which records
// the load, and hands back a stand-in, so no real module keeps working in the
// background. Vitest keeps a module once it has loaded, so these checks live in
// their own file, and each test asks only about its own module.
const loaded = vi.hoisted(() => new Set<string>())

vi.mock('mermaid', () => {
  loaded.add('mermaid')
  return { default: { initialize: () => {}, render: async () => ({ svg: '<svg></svg>' }) } }
})

vi.mock('rehype-highlight', () => {
  loaded.add('rehype-highlight')
  return { default: () => () => {} }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Let effects, and the requests and imports they start, settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Draw the first sheet and let its requests settle. They fail, which leaves the title panel and the recorded answer. */
async function drawFirstSheet() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) } as Response)))
  render(<Home />)
  expect(screen.getByRole('heading', { level: 2, name: EXHIBIT.question })).toBeInTheDocument()
  await settle()
}

it('loads Mermaid only once an answer begins a diagram', async () => {
  await drawFirstSheet()
  expect(loaded.has('mermaid')).toBe(false)

  // Mid-stream, the diagram's fence is still open.
  render(<Message message={{ role: 'assistant', content: '```mermaid\ngraph TD\n  A["User"] --> B' }} isStreaming />)
  await waitFor(() => expect(loaded.has('mermaid')).toBe(true))
})

it('loads the highlighter only once an answer has a code block', async () => {
  await drawFirstSheet()
  // A question shows as plain text, even one with a fence in it.
  render(<Message message={{ role: 'user', content: '```python\nprint("hi")\n```' }} />)
  await settle()
  expect(loaded.has('rehype-highlight')).toBe(false)

  render(<Message message={{ role: 'assistant', content: '```python\nprint("hi")\n```' }} />)
  await waitFor(() => expect(loaded.has('rehype-highlight')).toBe(true))
})
