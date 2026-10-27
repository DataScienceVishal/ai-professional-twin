import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Message } from './message'

// Mermaid and the highlighter arrive in their own chunks, so the request for
// either can fail, for example when the visitor has gone offline, and then the
// import rejects. Each factory below fails the first time and loads after
// that. Vitest keeps a module once it has loaded, so these cases live in their
// own file, and each test touches only its own module.
const attempts = vi.hoisted(() => ({ mermaid: 0, highlighter: 0 }))

vi.mock('mermaid', () => {
  attempts.mermaid++
  if (attempts.mermaid === 1) throw new Error('Failed to fetch dynamically imported module')
  // jsdom cannot lay out SVG, so a stand-in draws the diagram.
  return { default: { initialize: () => {}, render: async () => ({ svg: '<svg data-drawn="yes"></svg>' }) } }
})

vi.mock('rehype-highlight', async (importOriginal) => {
  attempts.highlighter++
  if (attempts.highlighter === 1) throw new Error('Failed to fetch dynamically imported module')
  return importOriginal()
})

const DIAGRAM = '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```'
const CODE = '```python\nprint("hi")\n```'

it('shows the source when Mermaid cannot be loaded, and tries again for the next diagram', async () => {
  const first = render(<Message message={{ role: 'assistant', content: DIAGRAM }} />)
  expect(await screen.findByText(/graph TD/)).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
  first.unmount()

  const { container } = render(<Message message={{ role: 'assistant', content: DIAGRAM }} />)
  await waitFor(() => expect(container.querySelector('svg[data-drawn]')).not.toBeNull())
})

it('shows code unhighlighted when the highlighter cannot be loaded, and tries again for the next answer', async () => {
  const first = render(<Message message={{ role: 'assistant', content: CODE }} />)
  await waitFor(() => expect(attempts.highlighter).toBe(1))
  // Let the failed import settle before the next answer asks again.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(screen.getByText(/print/)).toBeInTheDocument()
  expect(first.container.querySelector('.hljs-string')).toBeNull()
  first.unmount()

  const { container } = render(<Message message={{ role: 'assistant', content: CODE }} />)
  await waitFor(() => expect(container.querySelector('.hljs-string')).not.toBeNull())
})
