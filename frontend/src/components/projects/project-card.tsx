import { motion } from 'framer-motion'
import { Badge } from '../ui/badge'
import type { Project } from '../../lib/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-bg-card p-5 flex flex-col gap-3 transition-colors hover:border-accent-cyan/30"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-text-primary">{project.name}</h3>
        <Badge variant="cyan">{project.category}</Badge>
      </div>
      <p className="text-sm text-text-secondary line-clamp-3">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.tech_stack.map((tech) => (
          <Badge key={tech}>{tech}</Badge>
        ))}
      </div>
      {project.highlights.length > 0 && (
        <ul className="text-xs text-text-muted space-y-1">
          {project.highlights.slice(0, 3).map((h) => (
            <li key={h}>- {h}</li>
          ))}
        </ul>
      )}
      <a
        href={project.github_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-cyan hover:underline mt-auto"
      >
        View on GitHub
      </a>
    </motion.div>
  )
}
