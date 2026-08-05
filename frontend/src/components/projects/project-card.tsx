import { motion } from 'framer-motion'
import { Badge } from '../ui/badge'
import type { Project } from '../../lib/types'

interface ProjectCardProps {
  project: Project
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

export function ProjectCard({ project }: ProjectCardProps) {
  // Not every project is public - the MSc thesis has no repository. An empty
  // `github_url` must produce no link at all rather than an `href=""` that
  // silently reloads the page.
  const githubUrl = project.github_url.trim()

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent-cyan/30 sm:p-5"
    >
      {/* `flex-wrap` drops the category onto its own line rather than letting
          it overflow the card when the title needs the width. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold break-words text-text-primary">
          {project.name}
        </h3>
        <Badge variant="cyan" className="shrink-0 whitespace-nowrap">
          {project.category}
        </Badge>
      </div>
      <p className="text-sm break-words text-text-secondary line-clamp-3">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.tech_stack.map((tech) => (
          <Badge key={tech}>{tech}</Badge>
        ))}
      </div>
      {project.highlights.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {project.highlights.slice(0, 3).map((h) => (
            <li key={h} className="break-words">
              - {h}
            </li>
          ))}
        </ul>
      )}
      {githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          // `min-h-11` keeps a 44px touch target on phones; the desktop grid is
          // mouse-driven and stays compact, matching `ContactCta`.
          className="mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 text-xs font-medium text-accent-cyan hover:underline lg:min-h-0"
        >
          View on GitHub
          <ExternalLinkIcon />
        </a>
      )}
    </motion.div>
  )
}
