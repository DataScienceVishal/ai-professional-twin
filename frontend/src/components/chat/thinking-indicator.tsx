import { useEffect, useState } from 'react'
import type { ToolActivity } from '../../lib/types'

/**
 * The backend runs a reasoning model, so several seconds pass between the
 * request going out and the first token arriving. An empty bubble reads as a
 * broken page, so narrate the wait instead: these phases advance on a timer
 * and are overridden the moment real tool activity is reported.
 *
 * Delays are measured from mount, so they must be strictly increasing.
 */
const PHASES: { readonly afterMs: number; readonly label: string }[] = [
  { afterMs: 0, label: 'Searching his knowledge base' },
  { afterMs: 2500, label: 'Reading the most relevant sources' },
  { afterMs: 6000, label: 'Writing an answer' },
]

/**
 * Present-tense counterparts to the past-tense badge labels in `message.tsx`.
 * Keyed by the `tool` field of a `tool_start` event.
 */
const TOOL_PHASES: Record<string, string> = {
  search_repos: 'Searching his GitHub repositories',
  get_repo_stats: 'Reading repository stats',
  get_recent_activity: 'Checking his recent activity',
  calculate_experience: 'Working out his years of experience',
  count_projects_by_category: 'Counting his projects',
  get_skill_summary: 'Pulling together his skills',
  get_resume_download_link: 'Fetching his CV link',
  generate_comparison_table: 'Building a comparison table',
}

/** Resolve the line to show. Live tool activity always beats the timer. */
function thinkingLabel(phaseIndex: number, toolsUsed?: ToolActivity[]): string {
  const running = toolsUsed?.find((activity) => !activity.summary)
  if (running) return TOOL_PHASES[running.tool] || `Running ${running.tool}`
  // A tool has finished, so retrieval is done and the model is composing.
  if (toolsUsed && toolsUsed.length > 0) return 'Writing an answer'
  const phase = PHASES[phaseIndex] || PHASES[PHASES.length - 1]
  return phase.label
}

interface ThinkingIndicatorProps {
  /** Tool activity for the in-flight turn, in the order the events arrived. */
  toolsUsed?: ToolActivity[]
}

/**
 * Pending state for an assistant turn that has not streamed any content yet.
 * Rendered inside the assistant bubble and removed as soon as the first
 * `chunk` event lands.
 */
export function ThinkingIndicator({ toolsUsed }: ThinkingIndicatorProps) {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timers = PHASES.slice(1).map((phase, i) =>
      setTimeout(() => setPhaseIndex(i + 1), phase.afterMs),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="thinking-indicator"
      className="flex items-center gap-2 text-sm text-text-secondary"
    >
      {/* Decorative: the label already carries the meaning for screen readers.
          `motion-safe:` keeps it still for prefers-reduced-motion. */}
      <span className="flex shrink-0 gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan motion-safe:animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan motion-safe:animate-bounce [animation-delay:0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan motion-safe:animate-bounce [animation-delay:0.3s]" />
      </span>
      <span>{thinkingLabel(phaseIndex, toolsUsed)}&hellip;</span>
    </div>
  )
}
