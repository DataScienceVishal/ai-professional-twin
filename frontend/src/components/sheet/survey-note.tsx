import type { ReactNode } from 'react'

interface SurveyNoteProps {
  question: string
  /** When and from which entry a recorded answer was taken, set under its question. */
  dateline?: string
  children: ReactNode
  /** The answer is in flight: the rule stays magenta until it finishes. */
  writing?: boolean
  /** Answer text is streaming. Set only then, since some screen readers hold back the thinking indicator's live updates inside a busy element. */
  busy?: boolean
  /** One of this note's sources is open on the sheet. */
  lit?: boolean
}

export function SurveyNote({ question, dateline, children, writing = false, busy = false, lit = false }: SurveyNoteProps) {
  return (
    <article
      data-lit={lit || undefined}
      aria-busy={busy || undefined}
      className={`min-w-0 border-l-[3px] py-2 pr-3 pl-4 sm:pl-5 ${writing ? 'border-route' : 'border-ink'}`}
    >
      <h2 className="text-xl font-semibold leading-snug break-words sm:text-2xl">{question}</h2>
      {dateline && <p className="mt-1 text-sm text-muted">{dateline}</p>}
      <div className="mt-3">{children}</div>
    </article>
  )
}
