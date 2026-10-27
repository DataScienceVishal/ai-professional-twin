import { describe, expect, it } from 'vitest'
import { SKILL_LEVELS, orderDetail, sourceLabel } from './source-label'
import type { SourceInfo } from './types'

function label(source: string, detail: string): string {
  const info: SourceInfo = { source, detail, url: '' }
  return sourceLabel(info, {})
}

describe('sourceLabel', () => {
  it('keeps a name from the knowledge files exactly as written', () => {
    expect(label('academics', 'University of Delhi - School of Open Learning')).toBe(
      'Academics · University of Delhi · School of Open Learning',
    )
  })

  it('keeps the hyphen in a bracketed short form', () => {
    expect(
      label(
        'academics',
        'International Institute of Information Technology Bangalore (IIIT-B) - Executive Post Graduate Programme in Data Science',
      ),
    ).toBe(
      'Academics · International Institute of Information Technology Bangalore (IIIT-B) · Executive Post Graduate Programme in Data Science',
    )
  })

  it('turns a slug into words', () => {
    expect(label('career_qa', 'career-gap')).toBe('Career Q&A · Career Gap')
  })

  it('keeps small words lowercase inside a slug, but not at its start', () => {
    expect(label('career_qa', 'years-of-experience')).toBe('Career Q&A · Years of Experience')
    expect(label('career_qa', 'in-person_and-remote')).toBe('Career Q&A · In Person and Remote')
  })

  it('spells known acronyms in a slug the usual way', () => {
    expect(label('career_qa', 'genai')).toBe('Career Q&A · GenAI')
    expect(label('career_qa', 'rag-and-llm-api')).toBe('Career Q&A · RAG and LLM API')
  })

  it.each([
    ['advanced', 'Advanced'],
    ['intermediate', 'Intermediate'],
    ['working knowledge', 'Working knowledge'],
  ])('shows the skill level "%s" last, as "%s"', (level, shown) => {
    expect(label('skills', `Web & Frontend - ${level}`)).toBe(`Skills · Web & Frontend · ${shown}`)
    expect(label('skills', `${level} - Web & Frontend`)).toBe(`Skills · Web & Frontend · ${shown}`)
  })

  it('reads a slug word that is also an Object property as a word', () => {
    expect(label('career_qa', 'constructor')).toBe('Career Q&A · Constructor')
    expect(label('skills', 'constructor - advanced')).toBe('Skills · Constructor · Advanced')
  })

  it.each(['constructor', 'toString', '__proto__'])('shows the source kind "%s" as written', (kind) => {
    expect(label(kind, 'Telecom Churn Prediction')).toBe(`${kind} · Telecom Churn Prediction`)
  })
})

describe('orderDetail', () => {
  it('moves a known trailing value to the end', () => {
    expect(orderDetail('Machine Learning - Telecom Churn Prediction', ['Machine Learning'])).toBe(
      'Telecom Churn Prediction - Machine Learning',
    )
  })

  it('leaves a detail that already ends with it alone', () => {
    expect(orderDetail('Telecom Churn Prediction - Machine Learning', ['Machine Learning'])).toBe(
      'Telecom Churn Prediction - Machine Learning',
    )
  })

  it('handles skill levels', () => {
    expect(orderDetail('advanced - Generative AI', SKILL_LEVELS)).toBe('Generative AI - advanced')
  })

  it('ignores an empty token', () => {
    expect(orderDetail(' - x', [''])).toBe(' - x')
  })
})
