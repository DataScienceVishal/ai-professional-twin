import type { SourceInfo } from '../../lib/types'

interface SourceCitationProps {
  source: SourceInfo
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

export function SourceCitation({ source }: SourceCitationProps) {
  const label = SOURCE_LABELS[source.source] || source.source
  const detail = humanizeDetail(source.detail)
  const displayText = detail ? `${label} · ${detail}` : label

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        // A message can carry six of these, so a full 44px target would turn
        // the citation footer into the bulk of the bubble. 36px on touch
        // screens clears WCAG 2.5.8 with room to spare and still reads as a
        // chip; `lg` and up is mouse-driven and stays compact.
        className="inline-flex min-h-9 items-center gap-1 rounded-md bg-accent-cyan/8 border border-accent-cyan/20 px-2.5 py-1 text-xs text-accent-cyan hover:bg-accent-cyan/15 hover:border-accent-cyan/40 transition-colors lg:min-h-0"
      >
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a1.25 1.25 0 00-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25v-3.5a.75.75 0 011.5 0v3.5A2.75 2.75 0 0111.25 15h-7.5A2.75 2.75 0 011 12.25v-7.5A2.75 2.75 0 013.75 2z" />
          <path d="M10 1.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V3.56L8.78 9.28a.75.75 0 01-1.06-1.06l5.72-5.72H10.75A.75.75 0 0110 1.75z" />
        </svg>
        {displayText}
      </a>
    )
  }

  return (
    <span className="inline-flex min-h-9 items-center rounded-md bg-bg-card border border-border px-2.5 py-1 text-xs text-text-secondary lg:min-h-0">
      {displayText}
    </span>
  )
}
