import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Message } from './message'

// This file uses the real Mermaid; the other diagram tests use a stand-in. To
// draw, Mermaid adds a div to document.body whose id is "d" plus the diagram's
// id, and that div should be removed when the diagram cannot be drawn.
const BROKEN = '```mermaid\ngraph TD\n  A["User"] --> B["API"\n```'

it('leaves no Mermaid div behind when the diagram cannot be drawn', async () => {
  render(<Message message={{ role: 'assistant', content: BROKEN }} />)
  expect(await screen.findByText(/graph TD/)).toBeInTheDocument()
  expect(document.body.querySelector('[id^="dmermaid-"]')).toBeNull()
})
