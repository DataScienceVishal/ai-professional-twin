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

/**
 * Metadata values arrive as internal slugs (`technical-strengths`,
 * `years-of-experience`). Rendered raw they read like leaked database keys, so
 * turn them into prose. Values that are already human (`AI Twin`) survive
 * unchanged.
 */
function humanizeDetail(detail: string): string {
  return detail
    .split(' - ')
    .map((part) =>
      part
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\p{Ll}/gu, (c) => c.toUpperCase()),
    )
    .filter(Boolean)
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
