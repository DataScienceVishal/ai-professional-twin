import { PROFILE, MODE_LABELS } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface HeaderProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

const modes: ChatMode[] = ['default', 'recruiter', 'interview']

export function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-3">
        <img
          src={PROFILE.avatarUrl}
          alt={PROFILE.name}
          className="w-8 h-8 rounded-full"
        />
        <span className="font-medium text-sm">{PROFILE.name}</span>
      </div>
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              mode === m
                ? 'bg-accent-cyan text-bg-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </header>
  )
}
