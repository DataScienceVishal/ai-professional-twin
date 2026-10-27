import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LayerKey } from './layer-key'
import { InputBar } from '../chat/input-bar'
import { RECRUITER_ACTIONS } from '../../lib/constants'

/** The key beside the real ask field, as the page's dock renders them. */
function renderWithField({ disabled = false, onSelect = () => {} } = {}) {
  render(
    <>
      <LayerKey mode="recruiter" seed={1} onSelect={onSelect} disabled={disabled} />
      <InputBar onSend={() => {}} />
    </>,
  )
  return {
    chip: screen.getByRole('button', { name: RECRUITER_ACTIONS[0].label }),
    field: screen.getByRole('textbox', { name: 'Ask about his record' }),
  }
}

/** jsdom lays nothing out, so each wheel test gives the row a width to scroll through. */
function scrollRow(scrollWidth: number, clientWidth: number) {
  render(<LayerKey mode="interview" seed={1} onSelect={() => {}} />)
  const list = screen.getByRole('list', { name: 'Suggested questions' })
  Object.defineProperty(list, 'scrollWidth', { value: scrollWidth })
  Object.defineProperty(list, 'clientWidth', { value: clientWidth })
  Object.defineProperty(list, 'scrollLeft', { value: 0, writable: true })
  return list
}

function turnWheel(list: HTMLElement, init: WheelEventInit) {
  const event = new WheelEvent('wheel', { cancelable: true, ...init })
  list.dispatchEvent(event)
  return event
}

describe('LayerKey', () => {
  it('gives its row the thin, muted scrollbar from lg, where the bar shows', () => {
    render(<LayerKey mode="interview" seed={1} onSelect={() => {}} />)
    expect(screen.getByRole('list', { name: 'Suggested questions' })).toHaveClass('lg:scroll-frame')
  })

  it("shows the layer's questions", () => {
    render(<LayerKey mode="recruiter" seed={1} onSelect={() => {}} />)
    for (const action of RECRUITER_ACTIONS) {
      expect(screen.getByRole('button', { name: action.label })).toBeInTheDocument()
    }
  })

  it('sends the full question, not the short label', () => {
    const onSelect = vi.fn()
    render(<LayerKey mode="recruiter" seed={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: RECRUITER_ACTIONS[0].label }))
    expect(onSelect).toHaveBeenCalledWith(RECRUITER_ACTIONS[0].message)
  })

  it('cannot send while an answer is being written, and keeps the chip focusable', () => {
    const onSelect = vi.fn()
    render(<LayerKey mode="recruiter" seed={1} onSelect={onSelect} disabled />)
    const chip = screen.getByRole('button', { name: RECRUITER_ACTIONS[0].label })
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).not.toBeDisabled()
    fireEvent.click(chip)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('hands focus to the ask field when a chip is chosen from the keyboard', () => {
    const { chip, field } = renderWithField()
    fireEvent.click(chip, { detail: 0 })
    expect(field).toHaveFocus()
  })

  it('leaves focus alone when a chip is tapped', () => {
    const { chip, field } = renderWithField()
    fireEvent.click(chip, { detail: 1 })
    expect(field).not.toHaveFocus()
  })

  it('keeps focus on a busy chip pressed from the keyboard', () => {
    const onSelect = vi.fn()
    const { chip } = renderWithField({ disabled: true, onSelect })
    chip.focus()
    fireEvent.click(chip, { detail: 0 })
    expect(chip).toHaveFocus()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('gives each chip a 3:1 border and room for its focus ring when it scrolls into view', () => {
    render(<LayerKey mode="recruiter" seed={1} onSelect={() => {}} />)
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toHaveClass('border-ink/50', 'scroll-mx-1')
    }
  })

  it('names each interview category once, in front of its first question', () => {
    render(<LayerKey mode="interview" seed={1} onSelect={() => {}} />)
    for (const group of ['RAG & Retrieval', 'System Design', 'ML & AI']) {
      expect(screen.getAllByText(group)).toHaveLength(1)
    }
    const first = screen.getByRole('button', { name: 'Explain the RAG architecture in this project' })
    expect(first.closest('li')).toHaveTextContent(/^RAG & Retrieval/)
    const second = screen.getByRole('button', { name: 'Why did you choose dense vector search over BM25?' })
    expect(second.closest('li')).not.toHaveTextContent('RAG & Retrieval')
    expect(screen.getAllByRole('button')).toHaveLength(9)
  })

  it('shows plain questions with no category labels on the General layer', () => {
    render(<LayerKey mode="default" seed={1} onSelect={() => {}} />)
    const list = screen.getByRole('list', { name: 'Suggested questions' })
    expect(list).toHaveAttribute('role', 'list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    for (const item of items) {
      expect(item.textContent).toBe(within(item).getByRole('button').textContent)
    }
  })

  it('starts a new layer or a new shuffle from its first question', () => {
    const { rerender } = render(<LayerKey mode="default" seed={1} onSelect={() => {}} />)
    const list = screen.getByRole('list', { name: 'Suggested questions' })
    list.scrollLeft = 300
    expect(list.scrollLeft).toBe(300)
    rerender(<LayerKey mode="recruiter" seed={1} onSelect={() => {}} />)
    expect(list.scrollLeft).toBe(0)
    list.scrollLeft = 300
    rerender(<LayerKey mode="recruiter" seed={3} onSelect={() => {}} />)
    expect(list.scrollLeft).toBe(0)
  })

  it('shows shuffled questions with no category labels once a question has been asked', () => {
    render(<LayerKey mode="interview" seed={3} onSelect={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.queryByText('RAG & Retrieval')).toBeNull()
  })

  it('turns a vertical mouse wheel into sideways movement over the row', () => {
    const list = scrollRow(1000, 300)
    expect(turnWheel(list, { deltaY: 100 }).defaultPrevented).toBe(true)
    expect(list.scrollLeft).toBe(100)
    turnWheel(list, { deltaY: 100, ctrlKey: true })
    expect(list.scrollLeft).toBe(100)
    turnWheel(list, { deltaY: 100, metaKey: true })
    expect(list.scrollLeft).toBe(100)
  })

  it('moves the row 16px per line for wheels that count in lines', () => {
    const list = scrollRow(1000, 300)
    turnWheel(list, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE })
    expect(list.scrollLeft).toBe(48)
  })

  it('leaves a mostly sideways gesture to the browser', () => {
    const list = scrollRow(1000, 300)
    expect(turnWheel(list, { deltaX: 100, deltaY: 10 }).defaultPrevented).toBe(false)
    expect(list.scrollLeft).toBe(0)
  })

  it('leaves the wheel alone when the whole row fits', () => {
    const list = scrollRow(300, 300)
    expect(turnWheel(list, { deltaY: 100 }).defaultPrevented).toBe(false)
    expect(list.scrollLeft).toBe(0)
  })
})
