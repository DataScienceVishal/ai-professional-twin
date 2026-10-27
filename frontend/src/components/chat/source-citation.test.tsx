import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SourceCitation } from './source-citation'
import { renderWithSheet } from '../../test/sheet'
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

  it('gives the toggle and the link 44px targets on touch screens, and marks a pressed toggle in forced colours', () => {
    render(<SourceCitation source={source({ source: 'github', detail: 'CIFAR-10-CNN', url: 'https://example.com/r' })} />)
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveClass('min-h-11', 'lg:min-h-0', 'forced-colors:aria-pressed:underline')
    expect(screen.getByRole('link')).toHaveClass('min-h-11', 'min-w-11', 'justify-center', 'lg:min-h-0', 'lg:min-w-0')
  })

  it('shows only the label when there is no detail', () => {
    render(<SourceCitation source={source({ source: 'resume' })} />)
    expect(screen.getByText('CV')).toBeInTheDocument()
  })
})

describe('SourceCitation on the sheet', () => {
  it('opens and closes the source when pressed', () => {
    renderWithSheet(<SourceCitation source={source({ detail: 'availability' })} />)
    const button = screen.getByRole('button', { name: 'Career Q&A · Availability' })

    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('puts a known category after the project name, whatever order the backend sent', () => {
    renderWithSheet(
      <SourceCitation source={source({ source: 'projects', detail: 'Machine Learning - Telecom Churn Prediction' })} />,
      { trailing: { projects: ['Machine Learning'] } },
    )
    expect(screen.getByText('Project · Telecom Churn Prediction · Machine Learning')).toBeInTheDocument()
  })

  it('puts a skill level after the category', () => {
    render(<SourceCitation source={source({ source: 'skills', detail: 'advanced - Generative AI' })} />)
    expect(screen.getByText('Skills · Generative AI · Advanced')).toBeInTheDocument()
  })

  it('puts the level last when a skills category is also a project category, in either order', () => {
    renderWithSheet(
      <>
        <SourceCitation source={source({ source: 'skills', detail: 'Machine Learning - advanced' })} />
        <SourceCitation source={source({ source: 'skills', detail: 'advanced - Machine Learning' })} />
      </>,
      { trailing: { projects: ['Machine Learning'] } },
    )
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Skills · Machine Learning · Advanced',
      'Skills · Machine Learning · Advanced',
    ])
  })

  it('puts a known degree after the institution', () => {
    renderWithSheet(
      <SourceCitation source={source({ source: 'academics', detail: 'MSc Data Science - Liverpool John Moores University (LJMU)' })} />,
      { trailing: { academics: ['MSc Data Science'] } },
    )
    expect(screen.getByText('Academics · Liverpool John Moores University (LJMU) · MSc Data Science')).toBeInTheDocument()
  })
})
