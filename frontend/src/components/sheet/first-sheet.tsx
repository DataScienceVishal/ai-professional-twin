import type { Ref } from 'react'
import { BuildsTable } from './builds-table'
import { RecordStrip, RouteMap } from './route-map'
import { sameSource, useSheet } from './sheet-context'
import { SkillsLegend } from './skills-legend'
import { SourcesList } from './sources-list'
import { SurveyNote } from './survey-note'
import { TitlePanel } from './title-panel'
import { Message } from '../chat/message'
import { EXHIBIT } from '../../lib/exhibit'
import type { SheetRecord } from '../../lib/timeline'
import type { Project, SkillCategory } from '../../lib/types'

interface FirstSheetProps {
  record: SheetRecord | null
  now: Date
  projects: Project[]
  projectsLoading: boolean
  skills: SkillCategory[]
  skillsLoading: boolean
  /** Watches the title panel's row of contact links, which the contact bar stands in for. */
  contactRowRef?: Ref<HTMLDivElement>
}

export function FirstSheet({
  record,
  now,
  projects,
  projectsLoading,
  skills,
  skillsLoading,
  contactRowRef,
}: FirstSheetProps) {
  const { focused } = useSheet()
  const exhibitLit = EXHIBIT.message.sources.some((source) => sameSource(focused, source))

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-10">
        <TitlePanel ref={contactRowRef} />
        <SurveyNote
          question={EXHIBIT.question}
          // No-break spaces keep the date whole and its dot on the line the date ends, as the title panel's facts do.
          dateline={`The assistant's answer, recorded ${EXHIBIT.recordedOn.replaceAll(' ', '\u00a0')}\u00a0· career_qa.yaml, availability`}
          lit={exhibitLit}
        >
          <Message message={EXHIBIT.message} />
        </SurveyNote>
      </div>
      {record && (record.entries.length > 0 || record.unplotted.length > 0) && (
        // From lg the strip is `sr-only`, which positions it absolutely. Without a
        // positioned ancestor it measured against <body> and made the whole page scroll.
        <section aria-labelledby="record-heading" data-record className="relative min-w-0">
          {/* The caption shares the heading's row: under the map it fell on the dock's top line at 1440x900. */}
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="record-heading" className="sheet-label">
              His record, {record.from} to {record.to - 1}
            </h2>
            <p className="text-xs text-muted">
              {/* Below lg the record is a strip, which has no year columns. */}
              <span className="hidden lg:inline">One column is one year. </span>
              Dates come from academics.yaml and linkedin.yaml.
            </p>
          </div>
          <RouteMap record={record} now={now} className="hidden lg:block" />
          <RecordStrip record={record} now={now} className="lg:sr-only" />
        </section>
      )}
      <BuildsTable projects={projects} loading={projectsLoading} />
      <SkillsLegend skills={skills} loading={skillsLoading} />
      <SourcesList />
    </div>
  )
}
