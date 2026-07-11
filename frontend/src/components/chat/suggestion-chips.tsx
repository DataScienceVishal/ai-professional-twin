import { motion } from 'framer-motion'
import { SUGGESTION_CHIPS } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface SuggestionChipsProps {
  mode: ChatMode
  onSelect: (message: string) => void
  visible: boolean
}

export function SuggestionChips({ mode, onSelect, visible }: SuggestionChipsProps) {
  if (!visible) return null

  const chips = SUGGESTION_CHIPS[mode]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-wrap gap-2 px-4 pb-2"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs text-text-secondary hover:border-accent-cyan/50 hover:text-accent-cyan transition-colors"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}
