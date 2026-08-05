import { Badge } from '../ui/badge'
import { SectionHeading } from '../ui/section-heading'
import { Skeleton } from '../ui/skeleton'
import { useSkills } from '../../hooks/use-skills'

export function SkillSummary() {
  const { skills, loading } = useSkills()

  if (loading) {
    return (
      <section aria-label="Skills" aria-busy="true" className="w-full min-w-0">
        <SectionHeading>Skills</SectionHeading>
        <Skeleton className="h-40 w-full" />
      </section>
    )
  }

  // Same contract as `ProjectGrid`: nothing to show means nothing rendered.
  if (skills.length === 0) return null

  return (
    <section aria-labelledby="skills-heading" className="w-full min-w-0">
      <SectionHeading id="skills-heading">Skills</SectionHeading>
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.category} className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {group.category}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.skills.map((skill, i) => (
                <Badge key={`${skill}-${i}`}>{skill}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
