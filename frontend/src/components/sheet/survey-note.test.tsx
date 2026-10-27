import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SurveyNote } from './survey-note'

describe('SurveyNote', () => {
  it('sets the question as the note heading under its kicker', () => {
    render(
      <SurveyNote kicker="Question 1" question="Who is Vishal?">
        <p>An answer.</p>
      </SurveyNote>,
    )
    expect(screen.getByText('Question 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Who is Vishal?' })).toBeInTheDocument()
    expect(screen.getByText('An answer.')).toBeInTheDocument()
    const note = screen.getByRole('article')
    expect(note.className).toContain('border-ink')
    expect(note.className).not.toContain('border-route')
    expect(note).not.toHaveAttribute('aria-busy')
    expect(note).not.toHaveAttribute('data-lit')
  })

  it('turns its rule magenta while the answer is in flight', () => {
    render(
      <SurveyNote kicker="Question 1" question="Who is Vishal?" writing>
        <p>Searching his knowledge base</p>
      </SurveyNote>,
    )
    const note = screen.getByRole('article')
    expect(note.className).toContain('border-route')
    expect(note).not.toHaveAttribute('aria-busy')
  })

  it('reports busy only while answer text is streaming', () => {
    render(
      <SurveyNote kicker="Question 1" question="Who is Vishal?" writing busy>
        <p>An</p>
      </SurveyNote>,
    )
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true')
  })

  it('stays lit while one of its sources is open', () => {
    render(
      <SurveyNote kicker="Question 1" question="Who is Vishal?" lit>
        <p>An answer.</p>
      </SurveyNote>,
    )
    expect(screen.getByRole('article')).toHaveAttribute('data-lit', 'true')
  })

  it('lets a long unbroken question wrap instead of clipping', () => {
    render(
      <SurveyNote kicker="Question 1" question={'https://example.com/' + 'a'.repeat(200)}>
        <p>An answer.</p>
      </SurveyNote>,
    )
    expect(screen.getByRole('heading', { level: 2 }).className).toContain('break-words')
  })

  it('carries no dimming hook, because text keeps full contrast when a source opens', () => {
    render(
      <SurveyNote kicker="Question 1" question="Who is Vishal?">
        <p>An answer.</p>
      </SurveyNote>,
    )
    expect(screen.getByRole('article')).not.toHaveAttribute('data-dim')
  })
})
