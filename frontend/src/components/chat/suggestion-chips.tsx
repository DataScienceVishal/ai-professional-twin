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

  return (
    <motion.div
      key={`${mode}-${messageCount}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-wrap gap-1.5 px-4 pb-2"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="rounded-md border border-border bg-bg-card/60 px-2.5 py-1 text-xs text-text-secondary hover:border-accent-cyan/40 hover:text-accent-cyan hover:bg-accent-cyan/5 transition-all duration-200"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}
