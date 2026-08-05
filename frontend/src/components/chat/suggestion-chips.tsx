import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { getShuffledChips } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface SuggestionChipsProps {
  mode: ChatMode
  onSelect: (message: string) => void
  messageCount: number
}

export function SuggestionChips({ mode, onSelect, messageCount }: SuggestionChipsProps) {
  const chips = useMemo(
    () => getShuffledChips(mode, messageCount + 1, 5),
    [mode, messageCount],
  )

  // Below `lg` the chips are one swipeable row. Wrapping five of them at 375px
  // stacks five lines and eats a fifth of the screen; desktop still wraps.
  return (
    <motion.div
      key={`${mode}-${messageCount}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2 lg:flex-wrap lg:overflow-x-visible"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-border bg-bg-card/60 px-3 text-xs text-text-secondary transition-all duration-200 hover:border-accent-cyan/40 hover:bg-accent-cyan/5 hover:text-accent-cyan lg:min-h-0 lg:whitespace-normal lg:px-2.5 lg:py-1"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}
