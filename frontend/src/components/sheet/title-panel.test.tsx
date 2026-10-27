import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TitlePanel } from './title-panel'
import { CONTACT_MAILTO, PROFILE, ROLE_LINE, SHEET_FACTS } from '../../lib/constants'

describe('TitlePanel', () => {
  it('names him with the approved role line', () => {
    render(<TitlePanel />)
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
    expect(screen.getByText(ROLE_LINE)).toBeInTheDocument()
  })

  it('states availability, visa and the current MSc', () => {
    render(<TitlePanel />)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(SHEET_FACTS.map((f) => f.label))
    expect(screen.getAllByRole('definition').map((definition) => definition.textContent)).toEqual(
      SHEET_FACTS.map((f) => f.value),
    )
  })

  it('keeps his photo', () => {
    render(<TitlePanel />)
    expect(screen.getByRole('img', { name: 'Vishal Khan' })).toHaveAttribute('src', PROFILE.avatarUrl)
  })

  it('offers email, LinkedIn, the CV and his GitHub', () => {
    render(<TitlePanel />)
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', CONTACT_MAILTO)
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', PROFILE.linkedinUrl)
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'CV (PDF)' })).toHaveAttribute('href', '/api/resume/download')
    expect(screen.getByRole('link', { name: 'Public repositories on GitHub' })).toHaveAttribute(
      'href',
      PROFILE.githubUrl,
    )
    expect(screen.getByRole('link', { name: 'Public repositories on GitHub' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  })

  it('opens his GitHub in a new tab with a 24px target on desktop', () => {
    render(<TitlePanel />)
    const github = screen.getByRole('link', { name: 'Public repositories on GitHub' })
    expect(github).toHaveAttribute('target', '_blank')
    expect(github).toHaveClass('min-h-11', 'lg:min-h-6')
  })

  it('keeps its text at full contrast and sets body copy at 16px on phones', () => {
    const { container } = render(<TitlePanel />)
    expect(container.querySelector('[data-dim]')).toBeNull()
    expect(container.querySelector('[data-facts]')?.className).toContain('text-base')
  })

  it('shows its own contact buttons only on desktop, where the contact bar steps aside', () => {
    render(<TitlePanel />)
    expect(screen.getByRole('link', { name: 'Email' }).parentElement?.className).toMatch(/\bhidden\b.*\blg:flex\b/)
  })

  it('stacks the photo above the facts on narrow phones', () => {
    const { container } = render(<TitlePanel />)
    const row = container.querySelector('[data-facts]')?.parentElement
    expect(row?.className).toContain('flex-col')
    expect(row?.className).toContain('sm:flex-row')
  })
})
