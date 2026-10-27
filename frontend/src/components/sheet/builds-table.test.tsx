import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BuildsTable } from './builds-table'
import type { Project } from '../../lib/types'

function project(partial: Partial<Project> = {}): Project {
  return {
    name: 'Telecom Churn Prediction',
    slug: 'telecom-churn-prediction',
    description: 'Predicted customer churn from 21 predictor variables.',
    tech_stack: ['Python', 'Pandas', 'Scikit-learn', 'SQL'],
    github_url: 'https://github.com/DataScienceVishal/Telecom_Churn',
    category: 'Machine Learning',
    highlights: ['Full EDA pipeline'],
    ...partial,
  }
}

const THESIS = project({
  name: 'Reinforcement Learning for Dynamic Pricing in E-commerce',
  slug: 'rl-dynamic-pricing',
  description: 'MSc thesis testing whether RL can outperform pricing rules in a simulated e-commerce environment.',
  tech_stack: ['Python', 'Reinforcement Learning', 'OpenAI Gym', 'DQN', 'A2C', 'PPO'],
  github_url: '',
  category: 'Research',
  highlights: ['Compared DQN, A2C, and PPO agents for dynamic pricing'],
})

describe('BuildsTable', () => {
  it('lists each build with what it is and what it was built with', () => {
    render(<BuildsTable projects={[project()]} loading={false} />)
    expect(screen.getByRole('region', { name: 'Builds' })).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('heading', { name: 'Builds' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Telecom Churn Prediction' })).toBeInTheDocument()
    expect(screen.getByText('Machine Learning')).toBeInTheDocument()
    expect(screen.getByText('Predicted customer churn from 21 predictor variables.')).toBeInTheDocument()
    // A no-break space ties each dot to the word before it, so a wrapped line never starts with one.
    expect(screen.getByText('Python · Pandas · Scikit-learn · SQL').textContent).toBe(
      'Python\u00a0· Pandas\u00a0· Scikit-learn\u00a0· SQL',
    )
    expect(screen.getByText('Full EDA pipeline')).toBeInTheDocument()
  })

  it('links a repository in a new tab without leaking the opener', () => {
    render(<BuildsTable projects={[project()]} loading={false} />)
    const link = screen.getByRole('link', { name: /^Repository/ })
    expect(link).toHaveAccessibleName('Repository, Telecom Churn Prediction')
    expect(link).toHaveAttribute('aria-label', 'Repository, Telecom Churn Prediction')
    expect(link).toHaveTextContent(/^Repository$/)
    expect(link).toHaveAttribute('href', 'https://github.com/DataScienceVishal/Telecom_Churn')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says so instead of linking when there is no public repository', () => {
    render(<BuildsTable projects={[project({ github_url: '  ' })]} loading={false} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('No public repository')).toBeInTheDocument()
  })

  it('shows a busy placeholder while loading and nothing at all when empty', () => {
    const { rerender, container } = render(<BuildsTable projects={[]} loading />)
    expect(screen.getByRole('region', { name: 'Builds' })).toHaveAttribute('aria-busy', 'true')
    rerender(<BuildsTable projects={[]} loading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps its text at full contrast when a source opens', () => {
    const { container, rerender } = render(<BuildsTable projects={[project()]} loading={false} />)
    expect(container.querySelector('[data-dim]')).toBeNull()
    rerender(<BuildsTable projects={[]} loading />)
    expect(container.querySelector('[data-dim]')).toBeNull()
  })

  it('keeps the list a list for screen readers and the repository link a 24px target', () => {
    const { container } = render(<BuildsTable projects={[project()]} loading={false} />)
    expect(container.querySelector('ol')).toHaveAttribute('role', 'list')
    expect(screen.getByRole('link', { name: /^Repository/ })).toHaveClass('min-h-11', 'lg:min-h-6')
  })

  it('keeps the order it is given, so the twin stays first', () => {
    const twin = project({ name: 'AI Digital Twin', slug: 'ai-digital-twin' })
    render(<BuildsTable projects={[twin, project()]} loading={false} />)
    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(names).toEqual(['AI Digital Twin', 'Telecom Churn Prediction'])
  })

  it('shows up to three highlights and no more', () => {
    render(<BuildsTable projects={[project({ highlights: ['a', 'b', 'c', 'd'] })]} loading={false} />)
    for (const shown of ['a', 'b', 'c']) expect(screen.getByText(shown)).toBeInTheDocument()
    expect(screen.queryByText('d')).toBeNull()
  })

  it('sets the description at 16px on phones', () => {
    render(<BuildsTable projects={[project()]} loading={false} />)
    expect(screen.getByText('Predicted customer churn from 21 predictor variables.').parentElement).toHaveClass(
      'text-base',
      'lg:text-[15px]',
    )
  })

  it('lines every build up in one set of columns from md', () => {
    const { container } = render(<BuildsTable projects={[project(), THESIS]} loading={false} />)
    expect(container.querySelector('ol')).toHaveClass(
      'md:grid',
      'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]',
      'md:gap-x-6',
    )
    const rows = container.querySelectorAll('ol > li')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toHaveClass('grid', 'gap-y-1', 'md:col-span-3', 'md:grid-cols-subgrid')
      // A subgrid's own column gap would replace the list's 24px gap.
      expect(row).not.toHaveClass('gap-1')
    }
  })

  it('keeps each link only as wide and as tall as its text', () => {
    render(<BuildsTable projects={[project(), THESIS]} loading={false} />)
    expect(screen.getByRole('link', { name: /^Repository/ })).toHaveClass('self-start', 'justify-self-start')
    expect(screen.getByText('No public repository')).toHaveClass('self-start', 'justify-self-start')
  })
})
