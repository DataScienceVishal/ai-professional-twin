import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThinkingIndicator } from './thinking-indicator'
import type { ToolActivity } from '../../lib/types'

afterEach(() => {
  vi.useRealTimers()
})

describe('ThinkingIndicator', () => {
  it('exposes a polite live region so screen readers announce the wait', () => {
    render(<ThinkingIndicator />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/searching his knowledge base/i)
  })

  it('advances through phases while the model is still reasoning', () => {
    vi.useFakeTimers()
    render(<ThinkingIndicator />)

    expect(screen.getByRole('status')).toHaveTextContent(/searching his knowledge base/i)

    act(() => void vi.advanceTimersByTime(2500))
    expect(screen.getByRole('status')).toHaveTextContent(/reading the most relevant sources/i)

    act(() => void vi.advanceTimersByTime(3500))
    expect(screen.getByRole('status')).toHaveTextContent(/writing an answer/i)
  })

  it('reflects a tool_start event instead of the timed phase', () => {
    const toolsUsed: ToolActivity[] = [{ tool: 'search_repos', args: { q: 'rag' } }]
    render(<ThinkingIndicator toolsUsed={toolsUsed} />)
    expect(screen.getByRole('status')).toHaveTextContent(/searching his github repositories/i)
  })

  it('falls back to the raw tool name for a tool it has no copy for', () => {
    render(<ThinkingIndicator toolsUsed={[{ tool: 'some_new_tool' }]} />)
    expect(screen.getByRole('status')).toHaveTextContent(/running some_new_tool/i)
  })

  it('moves on to composing once the tool reports a result', () => {
    const toolsUsed: ToolActivity[] = [{ tool: 'search_repos', summary: '3 repos' }]
    render(<ThinkingIndicator toolsUsed={toolsUsed} />)
    expect(screen.getByRole('status')).toHaveTextContent(/writing an answer/i)
  })

  it('tracks the most recent tool when several run in a turn', () => {
    const toolsUsed: ToolActivity[] = [
      { tool: 'search_repos', summary: '3 repos' },
      { tool: 'get_repo_stats' },
    ]
    render(<ThinkingIndicator toolsUsed={toolsUsed} />)
    expect(screen.getByRole('status')).toHaveTextContent(/reading repository stats/i)
  })

  it('gates the animation behind prefers-reduced-motion', () => {
    const { container } = render(<ThinkingIndicator />)
    const dots = container.querySelectorAll('[class*="animate-bounce"]')
    expect(dots).toHaveLength(3)
    for (const dot of dots) {
      expect(dot.className).toContain('motion-safe:animate-bounce')
      // No unguarded animation class that would run for reduced-motion users.
      expect(dot.className).not.toMatch(/(^|\s)animate-bounce/)
    }
    // The dots carry no meaning the label does not already carry.
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
