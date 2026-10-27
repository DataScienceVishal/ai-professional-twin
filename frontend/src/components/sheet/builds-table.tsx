import { Skeleton } from '../ui/skeleton'
import type { Project } from '../../lib/types'

interface BuildsTableProps {
  projects: Project[]
  loading: boolean
}

const SKELETON_KEYS = ['a', 'b', 'c']

export function BuildsTable({ projects, loading }: BuildsTableProps) {
  if (loading) {
    return (
      <section aria-label="Builds" aria-busy="true" className="min-w-0">
        <h2 className="sheet-label mb-3">Builds</h2>
        <div className="space-y-2">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-16 w-full" />
          ))}
        </div>
      </section>
    )
  }

  // A failed request resolves to an empty list (see `useRemoteList`): render
  // nothing rather than an empty table.
  if (projects.length === 0) return null

  return (
    <section aria-labelledby="builds-heading" className="min-w-0">
      <h2 id="builds-heading" className="sheet-label mb-3">
        Builds
      </h2>
      <ol role="list" className="divide-y divide-ink/15 border-y-[1.5px] border-ink md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] md:gap-x-6">
        {projects.map((project) => {
          // Not every build is public: the MSc thesis has no repository.
          const repository = project.github_url.trim()
          return (
            <li
              key={project.slug}
              className="grid gap-y-1 py-4 md:col-span-3 md:grid-cols-subgrid"
            >
              <div className="min-w-0">
                <h3 className="font-semibold break-words">{project.name}</h3>
                <p className="sheet-label mt-0.5">{project.category}</p>
              </div>
              <div className="min-w-0 text-base lg:text-[15px]">
                <p className="break-words">{project.description}</p>
                <p className="mt-1 text-sm break-words text-muted">{project.tech_stack.join('\u00a0· ')}</p>
                {project.highlights.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-muted">
                    {project.highlights.slice(0, 3).map((highlight) => (
                      <li key={highlight} className="break-words">
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {repository ? (
                <a
                  href={repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Names the project, so a screen reader's list of links can tell
                  // the repositories apart. A hidden span read with a stray space.
                  aria-label={`Repository, ${project.name}`}
                  className="inline-flex min-h-11 items-center self-start justify-self-start text-sm font-semibold text-survey underline underline-offset-2 lg:min-h-6"
                >
                  Repository
                </a>
              ) : (
                <span className="self-start justify-self-start text-sm text-muted">No public repository</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
