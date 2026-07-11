import { PROFILE, MODE_LABELS } from '../../lib/constants'
import { Button } from '../ui/button'
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
          className="w-20 h-20 rounded-full border-2 border-accent-cyan/50"
        />
        <div className="text-center">
          <h2 className="font-semibold text-text-primary">{PROFILE.name}</h2>
          <p className="text-sm text-text-secondary">{PROFILE.title}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Mode</p>
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

      <div className="flex flex-col gap-2 mt-auto">
        <a
          href={PROFILE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          GitHub
        </a>
        <a
          href={PROFILE.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
        >
          LinkedIn
        </a>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear Chat
        </Button>
      </div>
    </aside>
  )
}
