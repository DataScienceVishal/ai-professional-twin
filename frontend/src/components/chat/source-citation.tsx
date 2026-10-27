import { sameSource, useSheet } from '../sheet/sheet-context'
import { sourceLabel } from '../../lib/source-label'
import type { SourceInfo } from '../../lib/types'

interface SourceCitationProps {
  source: SourceInfo
}

/**
 * A reference under an answer. Pressing it opens the source on the sheet,
 * which dims everything else. A source with a public URL also gets its own
 * link that opens it in a new tab.
 */
export function SourceCitation({ source }: SourceCitationProps) {
  const { trailing, focused, setFocused } = useSheet()
  const displayText = sourceLabel(source, trailing)
  const isOpen = sameSource(focused, source)

  return (
    <span className="inline-flex min-w-0 max-w-full items-stretch border border-survey/50 text-xs text-survey">
      <button
        type="button"
        aria-pressed={isOpen}
        onClick={() => setFocused(isOpen ? null : source)}
        // A note can carry several of these, so a full 44px target would turn
        // the reference row into the bulk of the note. 36px on touch screens
        // clears WCAG 2.5.8; `lg` and up is mouse-driven.
        className="min-h-9 min-w-0 px-2.5 text-left break-words hover:bg-work aria-pressed:bg-survey aria-pressed:text-paper lg:min-h-0 lg:py-1"
      >
        {displayText}
      </button>
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${displayText} in a new tab`}
          className="flex min-h-9 shrink-0 items-center border-l border-survey/50 px-2 hover:bg-work lg:min-h-0"
        >
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a1.25 1.25 0 00-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25v-3.5a.75.75 0 011.5 0v3.5A2.75 2.75 0 0111.25 15h-7.5A2.75 2.75 0 011 12.25v-7.5A2.75 2.75 0 013.75 2z" />
            <path d="M10 1.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V3.56L8.78 9.28a.75.75 0 01-1.06-1.06l5.72-5.72H10.75A.75.75 0 0110 1.75z" />
          </svg>
        </a>
      )}
    </span>
  )
}
