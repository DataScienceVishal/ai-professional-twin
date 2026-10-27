import { MODE_LABELS } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

const LAYERS: ChatMode[] = ['default', 'recruiter', 'interview']

interface LayerSwitchProps {
  mode: ChatMode
  onChange: (mode: ChatMode) => void
}

/** One control re-plots the same sheet: each layer is a mode the backend answers in. */
export function LayerSwitch({ mode, onChange }: LayerSwitchProps) {
  return (
    <div role="group" aria-label="Layer" className="inline-flex self-start border-[1.5px] border-ink">
      {LAYERS.map((layer) => (
        <button
          key={layer}
          type="button"
          aria-pressed={mode === layer}
          onClick={() => onChange(layer)}
          className="min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.12em] aria-pressed:bg-ink aria-pressed:text-paper forced-colors:aria-pressed:underline lg:min-h-9 lg:px-4"
        >
          {MODE_LABELS[layer]}
        </button>
      ))}
    </div>
  )
}
