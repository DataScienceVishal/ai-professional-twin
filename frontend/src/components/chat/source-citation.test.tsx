import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SourceCitation } from './source-citation'
import type { SourceInfo } from '../../lib/types'

function source(partial: Partial<SourceInfo>): SourceInfo {
  return { source: 'career_qa', detail: '', url: '', ...partial }
}

describe('SourceCitation', () => {
  it('maps internal source names to human labels', () => {
    render(<SourceCitation source={source({ source: 'career_qa' })} />)
    expect(screen.getByText('Career Q&A')).toBeInTheDocument()
  })

  it('turns slug details into prose instead of leaking database-looking keys', () => {
    render(<SourceCitation source={source({ detail: 'technical-strengths' })} />)
    expect(screen.getByText('Career Q&A · Technical Strengths')).toBeInTheDocument()
  })

  it('handles multi-part details joined by the chunker', () => {
    render(
      <SourceCitation source={source({ source: 'skills', detail: 'Core Programming - advanced' })} />,
    )
    expect(screen.getByText('Skills · Core Programming · Advanced')).toBeInTheDocument()
  })

  it('leaves already-human detail readable', () => {
    render(<SourceCitation source={source({ source: 'projects', detail: 'AI Twin' })} />)
    expect(screen.getByText('Project · AI Twin')).toBeInTheDocument()
  })

  it('renders a link when the source is externally verifiable', () => {
    render(
      <SourceCitation
        source={source({ source: 'github', detail: 'CIFAR-10-CNN', url: 'https://example.com/r' })}
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com/r')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders a plain chip, not a link, when there is nothing to link to', () => {
    render(<SourceCitation source={source({ detail: 'sponsorship' })} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('falls back to the raw source name for an unknown source', () => {
    render(<SourceCitation source={source({ source: 'something_new' })} />)
    expect(screen.getByText('something_new')).toBeInTheDocument()
  })

  it('shows only the label when there is no detail', () => {
    render(<SourceCitation source={source({ source: 'resume' })} />)
    expect(screen.getByText('CV')).toBeInTheDocument()
  })
})
