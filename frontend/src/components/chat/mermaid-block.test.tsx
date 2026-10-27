import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Message } from './message'

// jsdom cannot lay out SVG, so a real Mermaid render always fails here: it
// measures text with getBBox. This stand-in hands back a drawn SVG instead.
const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaid }))

const DIAGRAM = '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```'
const answer = { role: 'assistant' as const, content: DIAGRAM }

beforeEach(() => {
  mermaid.render.mockReset()
})

/** A promise the test settles by hand, to hold Mermaid mid-draw. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** Wait for the stand-in's SVG to reach the page. */
function drawnSvg(container: HTMLElement) {
  return waitFor(() => {
    const svg = container.querySelector('svg[data-drawn]')
    expect(svg).not.toBeNull()
    return svg
  })
}

describe('a diagram in a finished answer', () => {
  it('keeps the placeholder until Mermaid has drawn the diagram', async () => {
    const drawing = deferred<{ svg: string }>()
    mermaid.render.mockReturnValue(drawing.promise)
    const { container } = render(<Message message={answer} />)
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()

    // Mermaid has loaded and is drawing, and the drawing has not come back yet.
    await waitFor(() => expect(mermaid.render).toHaveBeenCalled())
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()

    drawing.resolve({ svg: '<svg data-drawn="yes"></svg>' })
    await drawnSvg(container)
    expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
  })

  it('keeps the placeholder from the end of the stream until the diagram is drawn', async () => {
    const drawing = deferred<{ svg: string }>()
    mermaid.render.mockReturnValue(drawing.promise)
    const { container, rerender } = render(<Message message={answer} isStreaming />)
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()

    rerender(<Message message={answer} />)
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()
    await waitFor(() => expect(mermaid.render).toHaveBeenCalled())
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()

    drawing.resolve({ svg: '<svg data-drawn="yes"></svg>' })
    await drawnSvg(container)
    expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
  })

  it('shows the source when Mermaid cannot draw the diagram', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error on line 2'))
    render(<Message message={answer} />)
    expect(await screen.findByText(/graph TD/)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
  })

  it('stays on screen when the answer re-renders', async () => {
    mermaid.render.mockResolvedValue({ svg: '<svg data-drawn="yes"></svg>' })
    const { container, rerender } = render(<Message message={answer} />)
    const drawn = await drawnSvg(container)

    rerender(<Message message={answer} />)

    expect(container.querySelector('svg[data-drawn]')).toBe(drawn)
  })
})
