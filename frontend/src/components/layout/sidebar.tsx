import { PROFILE, MODE_LABELS } from '../../lib/constants'
import { Button } from '../ui/button'
import { ContactCta } from './contact-cta'
import type { ChatMode } from '../../lib/types'

interface SidebarProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  onClear: () => void
}

const modes: ChatMode[] = ['default', 'recruiter', 'interview']

export function Sidebar({ mode, onModeChange, onClear }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-bg-secondary p-6 gap-6">
      <div className="flex flex-col items-center gap-3">
        <img
          src={PROFILE.avatarUrl}
          alt={PROFILE.name}
          className="w-28 h-28 rounded-full border-2 border-accent-cyan/30 shadow-lg shadow-accent-cyan/5"
        />
        <div className="text-center">
          <h2 className="font-semibold text-text-primary">{PROFILE.name}</h2>
          <p className="text-xs text-text-secondary mt-0.5">{PROFILE.title}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-1">Mode</p>
        {modes.map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onModeChange(m)}
            className="w-full justify-center"
          >
            {MODE_LABELS[m]}
          </Button>
        ))}
      </div>

      <ContactCta />

      <div className="flex flex-col gap-2 mt-auto">
        <a
          href={PROFILE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </a>
        <div className="border-t border-border pt-2 mt-1">
          <Button variant="ghost" size="sm" onClick={onClear} className="w-full text-text-muted">
            Clear Chat
          </Button>
        </div>
      </div>
    </aside>
  )
}
