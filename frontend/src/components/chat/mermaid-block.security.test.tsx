import { render, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Message } from './message'

// Mermaid's SVG goes into the page as HTML, so its own sanitising has to be on
// before the first draw. Mermaid loads once per page, so that first load has
// to happen inside this test, and it lives in its own file. jsdom cannot lay
// out SVG, so a stand-in does the drawing.
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({ svg: '<svg data-drawn="yes"></svg>' })),
}))
vi.mock('mermaid', () => ({ default: mermaid }))

const DIAGRAM = '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```'

it('sets strict security once, before Mermaid draws anything', async () => {
  const first = render(<Message message={{ role: 'assistant', content: DIAGRAM }} />)
  const second = render(<Message message={{ role: 'assistant', content: DIAGRAM }} />)
  await waitFor(() => {
    expect(first.container.querySelector('svg[data-drawn]')).not.toBeNull()
    expect(second.container.querySelector('svg[data-drawn]')).not.toBeNull()
  })

  expect(mermaid.initialize).toHaveBeenCalledTimes(1)
  expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
  expect(mermaid.initialize.mock.invocationCallOrder[0]).toBeLessThan(Math.min(...mermaid.render.mock.invocationCallOrder))
})
