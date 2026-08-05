import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Message } from './message'
import type { Message as MessageType } from '../../lib/types'

function assistant(partial: Partial<MessageType> = {}): MessageType {
  return { role: 'assistant', content: '', sources: [], toolsUsed: [], ...partial }
}

describe('Message pending state', () => {
  it('shows the thinking indicator while the turn is in flight with no content', () => {
    render(<Message message={assistant()} isStreaming />)
    expect(screen.getByRole('status')).toHaveTextContent(/searching his knowledge base/i)
  })

  it('replaces the indicator with content as soon as the first chunk arrives', () => {
    const { rerender } = render(<Message message={assistant()} isStreaming />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<Message message={assistant({ content: 'V' })} isStreaming />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('reflects tool activity reported mid-turn', () => {
    render(
      <Message
        message={assistant({ toolsUsed: [{ tool: 'search_repos', args: {} }] })}
        isStreaming
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/searching his github repositories/i)
  })

  it('does not show the indicator once streaming has finished', () => {
    render(<Message message={assistant({ content: 'Done.' })} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('never shows the indicator for a user message', () => {
    render(<Message message={{ role: 'user', content: 'Who is Vishal?' }} isStreaming />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Message failure state', () => {
  it('announces a failed turn instead of leaving it looking like an answer', () => {
    const notice = 'The assistant could not accept that message - it may be too long.'

    render(<Message message={assistant({ content: notice, isError: true })} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(notice)
    expect(alert.className).toContain('border-red-200')
  })
})

describe('Message mobile overflow guards', () => {
  it('puts code blocks in their own horizontal scroller', () => {
    const code = '```python\n' + `x = "${'a'.repeat(200)}"\n` + '```'
    const { container } = render(<Message message={assistant({ content: code })} />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.className).toContain('overflow-x-auto')
    expect(pre?.className).toContain('max-w-full')
  })

  it('wraps tables in a horizontal scroller', () => {
    const table = ['| a | b |', '| - | - |', '| 1 | 2 |'].join('\n')
    const { container } = render(<Message message={assistant({ content: table })} />)
    const wrapper = container.querySelector('table')?.parentElement
    expect(wrapper?.className).toContain('overflow-x-auto')
  })

  it('lets long unbroken strings break inside the bubble', () => {
    const { container } = render(<Message message={assistant({ content: 'x'.repeat(300) })} />)
    const bubble = container.querySelector('.rounded-xl')
    expect(bubble?.className).toContain('break-words')
    expect(bubble?.className).toContain('min-w-0')
  })
})

describe('diagram rendering during streaming', () => {
  const mermaidMsg = {
    role: 'assistant' as const,
    content: '```mermaid\ngraph TD\n  A["User"] --> B["API"]\n```',
  }

  it('shows a placeholder instead of raw diagram source while streaming', () => {
    render(<Message message={mermaidMsg} isStreaming />)
    expect(screen.getByRole('status', { name: /building diagram/i })).toBeInTheDocument()
    expect(screen.queryByText(/graph TD/)).toBeNull()
  })

  it('still renders ordinary code blocks as code while streaming', () => {
    render(
      <Message
        message={{ role: 'assistant', content: '```python\nprint("hi")\n```' }}
        isStreaming
      />,
    )
    expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
    expect(screen.getByText(/print/)).toBeInTheDocument()
  })

  it('drops the placeholder once streaming finishes', () => {
    render(<Message message={mermaidMsg} />)
    expect(screen.queryByRole('status', { name: /building diagram/i })).toBeNull()
  })
})
