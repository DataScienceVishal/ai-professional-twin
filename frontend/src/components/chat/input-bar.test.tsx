import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InputBar } from './input-bar'

describe('InputBar', () => {
  it('sends the trimmed question and clears the field', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} />)
    const field = screen.getByRole('textbox', { name: 'Ask about his record' })

    fireEvent.change(field, { target: { value: '  Who is Vishal?  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(onSend).toHaveBeenCalledWith('Who is Vishal?')
    expect(field).toHaveValue('')
  })

  it('keeps Ask enabled with nothing typed, and moves focus to the field instead of sending', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} />)
    const ask = screen.getByRole('button', { name: 'Ask' })
    expect(ask).toBeEnabled()

    fireEvent.click(ask)

    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Ask about his record' })).toHaveFocus()
  })

  it('sends nothing for a question that is only spaces', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask about his record' }), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables Ask while an answer is written if no Stop is offered', () => {
    render(<InputBar onSend={() => {}} disabled />)
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  })

  it('offers Stop while an answer is being written', () => {
    const onStop = vi.fn()
    render(<InputBar onSend={() => {}} onStop={onStop} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('waits for the visitor instead of taking focus when the page opens', () => {
    render(<InputBar onSend={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'Ask about his record' })).not.toHaveFocus()
  })

  it('keeps the field focused for the next question', async () => {
    render(<InputBar onSend={() => {}} />)
    const field = screen.getByRole('textbox', { name: 'Ask about his record' })
    fireEvent.change(field, { target: { value: 'Who is Vishal?' } })
    const ask = screen.getByRole('button', { name: 'Ask' })
    ask.focus()
    expect(ask).toHaveFocus()
    fireEvent.click(ask)
    await waitFor(() => expect(field).toHaveFocus())
  })

  it('hands focus back to the field when Stop is pressed from the keyboard', () => {
    const onStop = vi.fn()
    render(<InputBar onSend={() => {}} onStop={onStop} disabled />)
    const stop = screen.getByRole('button', { name: 'Stop' })
    stop.focus()
    fireEvent.click(stop, { detail: 0 })
    expect(onStop).toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Ask about his record' })).toHaveFocus()
  })

  it('leaves focus alone when Stop is tapped', () => {
    const onStop = vi.fn()
    render(<InputBar onSend={() => {}} onStop={onStop} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }), { detail: 1 })
    expect(onStop).toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Ask about his record' })).not.toHaveFocus()
  })

  it('keeps the field at 16px at every width, so iOS never zooms', () => {
    render(<InputBar onSend={() => {}} />)
    const field = screen.getByRole('textbox', { name: 'Ask about his record' })
    expect(field).toHaveClass('text-base')
    expect(field.className).not.toContain('lg:text-')
  })
})
