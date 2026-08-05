import { ProjectCard } from './project-card'
import { SectionHeading } from '../ui/section-heading'
import { Skeleton } from '../ui/skeleton'
import { useProjects } from '../../hooks/use-projects'

// `min-w-0` on the tracks: a grid item defaults to `min-width: auto`, so a
// wide card would push the chat scroller sideways instead of wrapping.
const GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 [&>*]:min-w-0'

const SKELETON_KEYS = ['a', 'b', 'c', 'd']

export function ProjectGrid() {
  const { projects, loading } = useProjects()

  if (loading) {
    return (
      <section aria-label="Projects" aria-busy="true" className="w-full min-w-0">
        <SectionHeading>Projects</SectionHeading>
        <div className={GRID}>
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-48 w-full" />
          ))}
        </div>
      </section>
    )
  }

  // A failed request resolves to an empty list (see `useRemoteList`). Render
  // nothing rather than an empty shell - the chat below still works, so the
  // empty state degrades to exactly what it was before this section existed.
  if (projects.length === 0) return null

  return (
    <section aria-labelledby="projects-heading" className="w-full min-w-0">
      <SectionHeading id="projects-heading">Projects</SectionHeading>
      <div className={GRID}>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  )
}
