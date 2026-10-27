import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContactBar } from './contact-bar'
import { CONTACT_MAILTO, PROFILE } from '../../lib/constants'

describe('ContactBar', () => {
  it('keeps email, LinkedIn and the CV one tap away', () => {
    render(<ContactBar showOnDesktop={false} />)
    const nav = screen.getByRole('navigation', { name: 'Contact' })
    expect(within(nav).getByRole('link', { name: 'Email' })).toHaveAttribute('href', CONTACT_MAILTO)
    expect(within(nav).getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', PROFILE.linkedinUrl)
    expect(within(nav).getByRole('link', { name: 'CV (PDF)' })).toHaveAttribute('href', '/api/resume/download')
    for (const name of ['LinkedIn', 'CV (PDF)']) {
      const link = within(nav).getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('hides on desktop unless it is asked to show there', () => {
    const { rerender } = render(<ContactBar showOnDesktop={false} />)
    expect(screen.getByRole('navigation', { name: 'Contact' }).className).toContain('lg:hidden')

    rerender(<ContactBar showOnDesktop />)
    expect(screen.getByRole('navigation', { name: 'Contact' }).className).not.toContain('lg:hidden')
  })

  it('draws its focus rings inside the links, since the bar meets the top of the viewport', () => {
    render(<ContactBar showOnDesktop={false} />)
    const nav = screen.getByRole('navigation', { name: 'Contact' })
    expect(nav).toHaveAttribute('data-ring', 'inset')
    const email = within(nav).getByRole('link', { name: 'Email' })
    expect(email).toHaveAttribute('data-fill', 'ink')
    // The paper ring is only visible because the cell really is ink.
    expect(email).toHaveClass('bg-ink', 'text-paper')
  })

  it('keeps every link a 44px tap target on phones', () => {
    render(<ContactBar showOnDesktop={false} />)
    for (const link of within(screen.getByRole('navigation', { name: 'Contact' })).getAllByRole('link')) {
      expect(link).toHaveClass('min-h-11')
    }
  })
})
