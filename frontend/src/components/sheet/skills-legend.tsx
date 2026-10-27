import { Skeleton } from '../ui/skeleton'
import type { SkillCategory } from '../../lib/types'

interface SkillsLegendProps {
  skills: SkillCategory[]
  loading: boolean
}

export function SkillsLegend({ skills, loading }: SkillsLegendProps) {
  if (loading) {
    return (
      <section aria-label="Legend" aria-busy="true" className="min-w-0">
        <h2 className="sheet-label mb-3">Legend</h2>
        <Skeleton className="h-40 w-full" />
      </section>
    )
  }

  if (skills.length === 0) return null

  return (
    <section aria-labelledby="legend-heading" className="min-w-0">
      <h2 id="legend-heading" className="sheet-label mb-1">
        Legend
      </h2>
      <p className="mb-3 text-sm text-muted">Skills by area, each with the level recorded in skills.yaml.</p>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.category} className="min-w-0 border-t border-ink/15 pt-2">
            <dt className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{group.category}</span>
              <span className="sheet-label">{group.proficiency}</span>
            </dt>
            <dd className="mt-1 text-base break-words lg:text-[15px]">{group.skills.join('\u00a0· ')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
