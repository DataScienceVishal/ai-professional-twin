import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Message } from './message'

// jsdom cannot lay out SVG, so a real Mermaid render always fails here: it
// measures text with getBBox. This stand-in hands back a drawn SVG instead.
const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaid }))

const DIAGRAM = '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```'

beforeEach(() => {
  mermaid.render.mockReset()
})

describe('a diagram in a finished answer', () => {
  it('stays on screen when the answer re-renders', async () => {
    mermaid.render.mockResolvedValue({ svg: '<svg data-drawn="yes"></svg>' })
    const answer = { role: 'assistant' as const, content: DIAGRAM }
    const { container, rerender } = render(<Message message={answer} />)
    const drawn = await waitFor(() => {
      const svg = container.querySelector('svg[data-drawn]')
      expect(svg).not.toBeNull()
      return svg
    })

    rerender(<Message message={answer} />)

    expect(container.querySelector('svg[data-drawn]')).toBe(drawn)
  })
})
