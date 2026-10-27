import { render, screen, within } from '@testing-library/react'
import { MotionConfig } from 'framer-motion'
import { describe, expect, it } from 'vitest'
import { Message } from './message'
import { CONTACT_MAILTO } from '../../lib/constants'
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
    expect(alert.className).toContain('border-dashed')
    expect(alert).toHaveTextContent('Could not answer')
  })
})

describe('Message stopped and limited states', () => {
  it('says an answer was stopped before any text arrived', () => {
    render(<Message message={assistant()} />)
    expect(screen.getByText('Stopped before an answer arrived.')).toBeInTheDocument()
  })

  it('keeps the thinking line, not the stopped line, while the answer is still on its way', () => {
    render(<Message message={assistant()} isStreaming />)
    expect(screen.queryByText('Stopped before an answer arrived.')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not call a failed turn stopped, even one that carries no text', () => {
    render(<Message message={assistant({ isError: true })} />)
    expect(screen.queryByText('Stopped before an answer arrived.')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not answer')
  })

  it('points to email after the safe message when a usage limit refused the turn', () => {
    render(<Message message={assistant({ content: 'Rate limit exceeded. Try again later.', isError: true, limited: true })} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Rate limit exceeded. Try again later.')
    expect(within(alert).getByRole('link', { name: 'Email' })).toHaveAttribute('href', CONTACT_MAILTO)
  })

  it('offers no email line for other failures', () => {
    render(<Message message={assistant({ content: 'The assistant backend ran into a problem.', isError: true })} />)
    expect(screen.queryByRole('link', { name: 'Email' })).toBeNull()
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
    expect(wrapper).toHaveClass('scroll-frame')
  })

  it('gives code blocks the thin, muted scrollbar the sheet uses', () => {
    const { container } = render(<Message message={assistant({ content: '```python\nprint("hi")\n```' })} />)
    expect(container.querySelector('pre')).toHaveClass('scroll-frame')
  })

  it('lets long unbroken strings break inside the answer', () => {
    render(<Message message={assistant({ content: 'x'.repeat(300) })} />)
    const answer = screen.getByTestId('answer')
    expect(answer.className).toContain('break-words')
    expect(answer.className).toContain('min-w-0')
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

describe('Message on the sheet', () => {
  it('lists tool activity as plain log lines', () => {
    render(<Message message={assistant({ content: 'Done.', toolsUsed: [{ tool: 'search_repos', summary: '3 repos' }] })} />)
    expect(screen.getByRole('list', { name: 'Tools used' })).toHaveTextContent('Searched GitHub')
    // Safari drops list semantics from a list styled without markers.
    expect(screen.getByRole('list', { name: 'Tools used' })).toHaveAttribute('role', 'list')
  })

  it('stops marking a tool as running once the answer has stopped streaming', () => {
    const { container } = render(
      <Message message={assistant({ content: 'Partial.', toolsUsed: [{ tool: 'search_repos' }] })} isStreaming={false} />,
    )
    expect(screen.getByRole('list', { name: 'Tools used' })).toHaveTextContent(/^Searched GitHub$/)
    expect(container.querySelector('.bg-route')).toBeNull()
  })

  it('labels the sources under the answer', () => {
    render(<Message message={assistant({ content: 'Done.', sources: [{ source: 'resume', detail: '', url: '' }] })} />)
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CV' })).toBeInTheDocument()
  })

  it('enters without motion when the visitor asks for reduced motion', () => {
    render(
      <MotionConfig reducedMotion="always">
        <Message message={assistant({ content: 'Done.' })} />
      </MotionConfig>,
    )
    expect(screen.getByTestId('answer').style.opacity).not.toBe('0')
  })
})
