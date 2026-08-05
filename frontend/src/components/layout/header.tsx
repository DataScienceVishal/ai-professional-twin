import { PROFILE, MODE_LABELS } from '../../lib/constants'
import { ContactCtaCompact } from './contact-cta'
import type { ChatMode } from '../../lib/types'

interface HeaderProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

const modes: ChatMode[] = ['default', 'recruiter', 'interview']

export function Header({ mode, onModeChange }: HeaderProps) {
  // Two rows below `lg`: a single row cannot hold the name, three mode
  // buttons and the "Hire" pill at 44px tap targets within 375px, and the
  // pill is the one thing that must never be the item that gets clipped.
  return (
    <header className="lg:hidden shrink-0 flex flex-col gap-1.5 border-b border-border bg-bg-secondary px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={PROFILE.avatarUrl}
            alt={PROFILE.name}
            className="h-8 w-8 shrink-0 rounded-full"
          />
          <span className="truncate text-sm font-medium">{PROFILE.name}</span>
        </div>
        <ContactCtaCompact />
      </div>
      <div
        role="group"
        aria-label="Assistant mode"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-bg-card/60 p-0.5"
      >
        {modes.map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
            className={`min-h-11 min-w-0 flex-1 rounded-md px-2 text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-accent-cyan text-white'
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
