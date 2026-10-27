import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Home from './home'
import { Message } from '../components/chat/message'
import { EXHIBIT } from '../lib/exhibit'

// Mermaid is large and the first sheet has no diagram, so it should load only
// for an answer that has one. Each factory below runs the first time its module
// is imported, which records the load. Vitest keeps a module once it has
// loaded, so these checks live in their own file.
const loaded = vi.hoisted(() => new Set<string>())

vi.mock('mermaid', async (importOriginal) => {
  loaded.add('mermaid')
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
