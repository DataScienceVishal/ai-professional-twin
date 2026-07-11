import type { SourceInfo } from '../../lib/types'

interface SourceCitationProps {
  source: SourceInfo
}

export function SourceCitation({ source }: SourceCitationProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-purple/10 border border-accent-purple/30 px-2 py-0.5 text-xs text-accent-purple">
      {source.source}
      {source.detail && ` : ${source.detail}`}
    </span>
  )
}
