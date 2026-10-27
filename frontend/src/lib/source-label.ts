import type { TrailingTokens } from '../components/sheet/sheet-context'
import type { SourceInfo } from './types'

/**
 * The levels skills.yaml records, as a label shows them. "working knowledge"
 * has a space, so the slug rule below would leave it lowercase beside
 * "Advanced"; this table gives all three the same case.
 */
const SKILL_LEVEL_LABELS: Readonly<Record<string, string>> = {
  advanced: 'Advanced',
  intermediate: 'Intermediate',
  'working knowledge': 'Working knowledge',
}

export const SKILL_LEVELS: readonly string[] = Object.keys(SKILL_LEVEL_LABELS)

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

/**
 * Only a table's own keys count, so a value such as "constructor" or
 * "__proto__" never reads what every object inherits.
 */
function lookup<T>(table: Readonly<Partial<Record<string, T>>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word, i) => {
      const acronym = lookup(ACRONYMS, word)
      if (acronym) return acronym
      if (i > 0 && SMALL_WORDS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * A metadata value is either an internal slug (`technical-strengths`,
 * `years-of-experience`), which would read like a leaked database key, or a
 * name as the knowledge files write it ("University of Delhi", "IIIT-B").
 * A part listed in `names` takes the form given there; otherwise only a slug
 * is turned into words, and every other part is shown as written.
 */
function humanizeDetail(detail: string, names: Readonly<Record<string, string>> = {}): string {
  return detail
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => lookup(names, part) ?? (SLUG.test(part) ? humanizeSlug(part) : part))
    .join(' · ')
}

/** The text a reference shows: its kind, then its detail in a stable order. */
export function sourceLabel(source: SourceInfo, trailing: TrailingTokens): string {
  const label = lookup(SOURCE_LABELS, source.source) ?? source.source
  // Each kind has its own tokens: "Machine Learning" is a project category to
  // move last, but in a skills detail only the level goes last.
  const detail =
    source.source === 'skills'
      ? humanizeDetail(orderDetail(source.detail, SKILL_LEVELS), SKILL_LEVEL_LABELS)
      : humanizeDetail(orderDetail(source.detail, lookup(trailing, source.source) ?? []))
  return detail ? `${label} · ${detail}` : label
}
