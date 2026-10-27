import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Message } from './message'

// Mermaid arrives in its own chunk, so the request for it can fail, for
// example when the visitor has gone offline, and then the import rejects.
// Vitest keeps the first result of a mocked import for the whole file, so
// this case lives in its own file.
vi.mock('mermaid', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

it('shows the source when Mermaid cannot be loaded', async () => {
  render(<Message message={{ role: 'assistant', content: '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```' }} />)
  expect(await screen.findByText(/graph TD/)).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
})
