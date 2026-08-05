interface SectionHeadingProps {
  children: React.ReactNode
  /** Links the heading to its `<section>` via `aria-labelledby`. */
  id?: string
}

/**
 * Quiet section label for the chat empty state, matching the "Mode" label in
 * the desktop sidebar so the showcase reads as chrome rather than content.
 */
export function SectionHeading({ children, id }: SectionHeadingProps) {
  return (
    <h2
      id={id}
      className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted"
    >
      {children}
    </h2>
  )
}
