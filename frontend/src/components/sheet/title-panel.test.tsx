import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TitlePanel } from './title-panel'
import { CONTACT_MAILTO, PROFILE, ROLE_LINE, SHEET_FACTS } from '../../lib/constants'

describe('TitlePanel', () => {
  it('names him with the role line, with no sheet label above the name', () => {
    render(<TitlePanel />)
    expect(screen.getByRole('heading', { level: 1, name: 'Vishal Khan' })).toBeInTheDocument()
    expect(screen.queryByText(/Sheet 1/)).toBeNull()
    expect(screen.getByText(ROLE_LINE)).toBeInTheDocument()
  })

  it('states availability, visa and the current MSc', () => {
    render(<TitlePanel />)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(SHEET_FACTS.map((f) => f.label))
    expect(screen.getAllByRole('definition').map((definition) => definition.textContent?.replace(/\u00a0/g, ' '))).toEqual(
      SHEET_FACTS.map((f) => f.value),
    )
  })

  it('glues each middle dot to the word before it, so no wrapped line starts with one', () => {
    const { container } = render(<TitlePanel />)
    const role = [...container.querySelectorAll('p')].find((p) => p.textContent?.replace(/\u00a0/g, ' ') === ROLE_LINE)
    const texts = [role, ...screen.getAllByRole('definition')].map((element) => element?.textContent ?? '')
    expect(texts).toHaveLength(SHEET_FACTS.length + 1)
    for (const text of texts) {
      expect(text).not.toMatch(/ \u00b7/)
    }
    expect(texts.filter((text) => text.includes('\u00a0\u00b7 '))).toHaveLength(3)
  })

  it('keeps his photo, with no alt text to repeat the name beside it', () => {
    const { container } = render(<TitlePanel />)
    const photo = container.querySelector(`img[src="${PROFILE.avatarUrl}"]`)
    expect(photo).not.toBeNull()
    expect(photo).toHaveAttribute('alt', '')
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

  it('sets a 64px photo beside the name on phones, and the 88px photo beside the facts from sm', () => {
    const { container } = render(<TitlePanel />)
    const photos = container.querySelectorAll('img')
    expect(photos).toHaveLength(1)
    const [photo] = photos
    const name = screen.getByRole('heading', { level: 1 })
    const facts = container.querySelector('[data-facts]')
    // Phones: the photo and the name share the first row, and the facts run the full width below.
    expect(photo).toHaveClass('h-16', 'w-16', 'col-start-1', 'row-start-1')
    expect(name).toHaveClass('col-start-2', 'row-start-1')
    expect(facts).toHaveClass('col-span-2')
    // From sm: the name runs across, and the photo sits beside the facts.
    expect(photo).toHaveClass('sm:h-[88px]', 'sm:w-[88px]', 'sm:row-start-3')
    expect(name).toHaveClass('sm:col-start-1', 'sm:col-span-2')
    expect(facts).toHaveClass('sm:col-span-1', 'sm:col-start-2')
    expect(photo.parentElement).toBe(name.parentElement)
    expect(facts?.parentElement).toBe(name.parentElement)
  })
})
