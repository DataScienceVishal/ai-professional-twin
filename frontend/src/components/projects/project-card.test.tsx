import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectCard } from './project-card'
import type { Project } from '../../lib/types'

function project(partial: Partial<Project> = {}): Project {
  return {
    name: 'Telecom Churn Prediction',
    slug: 'telecom-churn-prediction',
    description: 'Predicted customer churn from 21 predictor variables.',
    tech_stack: ['Python', 'Pandas', 'Scikit-learn'],
    github_url: 'https://github.com/DataScienceVishal/Telecom_Churn',
    category: 'Machine Learning',
    highlights: ['Full EDA pipeline', '~80% accuracy', 'Tenure is the top predictor'],
    ...partial,
  }
}

describe('ProjectCard', () => {
  it('opens the repository in a new tab without leaking the opener', () => {
    render(<ProjectCard project={project()} />)

    const link = screen.getByRole('link', { name: /View on GitHub/ })
    expect(link).toHaveAttribute('href', 'https://github.com/DataScienceVishal/Telecom_Churn')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders no link at all for a project with no repository', () => {
    // The MSc thesis ships with an empty `github_url`; an `href=""` would be a
    // dead link that silently reloads the page.
    render(<ProjectCard project={project({ github_url: '' })} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/View on GitHub/)).toBeNull()
  })

  it('treats a whitespace-only github_url as absent', () => {
    render(<ProjectCard project={project({ github_url: '   ' })} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders the category and every tech-stack entry as a badge', () => {
    render(<ProjectCard project={project()} />)

    expect(screen.getByText('Machine Learning')).toBeInTheDocument()
    for (const tech of ['Python', 'Pandas', 'Scikit-learn']) {
      expect(screen.getByText(tech)).toBeInTheDocument()
    }
  })

  it('caps the highlight list at three so cards stay skimmable', () => {
    render(
      <ProjectCard
        project={project({ highlights: ['one', 'two', 'three', 'four', 'five'] })}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText(/four/)).toBeNull()
  })

  it('omits the highlight list entirely when there are none', () => {
    render(<ProjectCard project={project({ highlights: [] })} />)
    expect(screen.queryByRole('list')).toBeNull()
  })
})
