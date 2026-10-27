import type { TrailingTokens } from '../components/sheet/sheet-context'
import type { SourceInfo } from './types'

export const SKILL_LEVELS = ['advanced', 'intermediate', 'working knowledge'] as const

/**
 * The backend joins a chunk's metadata values in whatever order the store
 * returns them, so one document can read "Machine Learning - Telecom Churn
 * Prediction" on one answer and the other way round on the next. A known
 * trailing value, such as a project category, a skill level or a degree, is
 * moved to the end.
 */
export function orderDetail(detail: string, trailing: readonly string[]): string {
  for (const token of trailing) {
    const prefix = `${token} - `
    if (token && detail.startsWith(prefix)) return `${detail.slice(prefix.length)} - ${token}`
  }
  return detail
}

const SOURCE_LABELS: Record<string, string> = {
  projects: 'Project',
  skills: 'Skills',
  career_qa: 'Career Q&A',
  certificates: 'Certificate',
  linkedin: 'LinkedIn',
  resume: 'CV',
  academics: 'Academics',
  github: 'GitHub',
}

const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

const SMALL_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'to', 'with', 'a', 'an', 'on'])

const ACRONYMS: Readonly<Record<string, string>> = {
  ai: 'AI',
  genai: 'GenAI',
  ml: 'ML',
  rag: 'RAG',
  llm: 'LLM',
  nlp: 'NLP',
  cnn: 'CNN',
  sql: 'SQL',
  api: 'API',
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word, i) => {
      if (ACRONYMS[word]) return ACRONYMS[word]
      if (i > 0 && SMALL_WORDS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * A metadata value is either an internal slug (`technical-strengths`,
 * `years-of-experience`), which would read like a leaked database key, or a
 * name as the knowledge files write it ("University of Delhi", "IIIT-B").
 * Only a slug is turned into words; every other part is shown as written.
 */
function humanizeDetail(detail: string): string {
  return detail
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (SLUG.test(part) ? humanizeSlug(part) : part))
    .join(' · ')
}

/** The text a reference shows: its kind, then its detail in a stable order. */
export function sourceLabel(source: SourceInfo, trailing: TrailingTokens): string {
  const label = SOURCE_LABELS[source.source] || source.source
  // Each kind has its own tokens: "Machine Learning" is a project category to
  // move last, but in a skills detail only the level goes last.
  const tokens = source.source === 'skills' ? SKILL_LEVELS : trailing[source.source] ?? []
  const detail = humanizeDetail(orderDetail(source.detail, tokens))
  return detail ? `${label} · ${detail}` : label
}
