import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkillsLegend } from './skills-legend'
import type { SkillCategory } from '../../lib/types'

const SKILLS: SkillCategory[] = [
  { category: 'Core Programming', skills: ['Python', 'SQL'], proficiency: 'advanced' },
  { category: 'Reinforcement Learning', skills: ['DQN'], proficiency: 'intermediate' },
  { category: 'Web & Frontend', skills: ['React'], proficiency: 'working knowledge' },
]

describe('SkillsLegend', () => {
  it('titles the legend and keeps each dot on the line of the word before it', () => {
    render(<SkillsLegend skills={SKILLS} loading={false} />)
    expect(screen.getByRole('heading', { name: 'Legend' })).toBeInTheDocument()
    // A no-break space ties each dot to the word before it, so a wrapped line never starts with one.
    expect(screen.getByText('Python · SQL').textContent).toBe('Python\u00a0· SQL')
  })

  it('shows a busy placeholder while loading and nothing at all when empty', () => {
    const { rerender, container } = render(<SkillsLegend skills={[]} loading />)
    expect(screen.getByRole('region', { name: 'Legend' })).toHaveAttribute('aria-busy', 'true')
    rerender(<SkillsLegend skills={[]} loading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps its text at full contrast when a source opens', () => {
    const { container, rerender } = render(<SkillsLegend skills={SKILLS} loading={false} />)
    expect(container.querySelector('[data-dim]')).toBeNull()
    rerender(<SkillsLegend skills={[]} loading />)
    expect(container.querySelector('[data-dim]')).toBeNull()
  })

  it('pairs each area with the level recorded for it', () => {
    render(<SkillsLegend skills={SKILLS} loading={false} />)
    expect(screen.getByRole('region', { name: 'Legend' })).not.toHaveAttribute('aria-busy')
    for (const { category, proficiency } of SKILLS) {
      const term = screen.getByText(category).closest('dt')
      expect(term).not.toBeNull()
      expect(within(term as HTMLElement).getByText(proficiency)).toBeInTheDocument()
    }
  })

  it('sets the skills at 16px on phones', () => {
    render(<SkillsLegend skills={SKILLS} loading={false} />)
    expect(screen.getByText('Python · SQL')).toHaveClass('text-base', 'lg:text-[15px]')
  })
})
