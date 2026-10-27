import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SourcesList } from './sources-list'
import { PROFILE } from '../../lib/constants'

const FILES = [
  'projects.yaml',
  'skills.yaml',
  'academics.yaml',
  'certificates.yaml',
  'career_qa.yaml',
  'linkedin.yaml',
  'resume.pdf',
]

describe('SourcesList', () => {
  it('links his public repositories', () => {
    render(<SourcesList />)
    expect(screen.getByRole('link', { name: 'public GitHub repositories' })).toHaveAttribute('href', PROFILE.githubUrl)
  })

  it('keeps its text at full contrast when a source opens', () => {
    const { container } = render(<SourcesList />)
    expect(container.querySelector('[data-dim]')).toBeNull()
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list')
  })

  it('names exactly the files the assistant reads', () => {
    render(<SourcesList />)
    const region = screen.getByRole('region', { name: 'Sources' })
    const items = within(region).getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(FILES)
  })

  it('opens his repositories in a new tab without leaking the opener', () => {
    render(<SourcesList />)
    const link = screen.getByRole('link', { name: 'public GitHub repositories' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sets its sentence at 16px on phones', () => {
    render(<SourcesList />)
    expect(screen.getByText(/The assistant reads these files/)).toHaveClass('text-base', 'lg:text-[15px]')
  })

  it('gives the inline GitHub link a 24px target', () => {
    render(<SourcesList />)
    expect(screen.getByRole('link', { name: 'public GitHub repositories' })).toHaveClass('py-1')
  })
})
