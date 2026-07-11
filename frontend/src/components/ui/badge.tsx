interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'cyan' | 'purple'
}

const badgeVariants = {
  default: 'bg-bg-card text-text-secondary border-border',
  cyan: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeVariants[variant]}`}
    >
      {children}
    </span>
  )
}
