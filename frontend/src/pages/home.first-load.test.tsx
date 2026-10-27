import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Home from './home'
import { Message } from '../components/chat/message'
import { EXHIBIT } from '../lib/exhibit'

// Mermaid and the syntax highlighter are large, and the first sheet has no
// diagram and no code, so each should load only for an answer that needs it.
// Each factory below runs the first time its module is imported, which records
// the load. Vitest keeps a module once it has loaded, so these checks live in
// their own file, and each test asks only about its own module.
const loaded = vi.hoisted(() => new Set<string>())

vi.mock('mermaid', async (importOriginal) => {
  loaded.add('mermaid')
  return importOriginal()
})

vi.mock('rehype-highlight', async (importOriginal) => {
  loaded.add('rehype-highlight')
  return importOriginal()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Draw the first sheet and let its requests settle. They fail, which leaves the title panel and the recorded answer. */
async function drawFirstSheet() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) } as Response)))
  render(<Home />)
  expect(screen.getByRole('heading', { level: 2, name: EXHIBIT.question })).toBeInTheDocument()
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
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
  expect(loaded.has('rehype-highlight')).toBe(false)

  render(<Message message={{ role: 'assistant', content: '```python\nprint("hi")\n```' }} />)
  await waitFor(() => expect(loaded.has('rehype-highlight')).toBe(true))
})
