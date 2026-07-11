import { ProjectCard } from './project-card'
import { Skeleton } from '../ui/skeleton'
import { useProjects } from '../../hooks/use-projects'

export function ProjectGrid() {
  const { projects, loading } = useProjects()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <p className="text-center text-text-muted p-8">No projects loaded.</p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {projects.map((project) => (
        <ProjectCard key={project.slug} project={project} />
      ))}
    </div>
  )
}
