import { FULL_TIME_FROM, FULL_TIME_LABEL, FULL_TIME_SOURCE } from '../../lib/constants'
import { sourceLabel } from '../../lib/source-label'
import {
  entriesForSource,
  routePoints,
  toYear,
  type RecordEntry,
  type SheetRecord,
  type Track,
} from '../../lib/timeline'
import { sameSource, useSheet } from './sheet-context'

interface MapProps {
  record: SheetRecord
  now: Date
  className?: string
}

const TRACKS: Track[] = ['education', 'work']

const TRACK_NAMES: Record<Track, string> = { education: 'Education', work: 'Work' }

const KNOCKOUT: Record<Track, string> = { education: 'bg-edu-band', work: 'bg-work-band' }

// Each track's band on the horizontal map, as a percentage of its height.
const BAND: Record<Track, { top: number; height: number }> = {
  education: { top: 14, height: 34 },
  work: { top: 52, height: 34 },
}

function centre(track: Track): number {
  return BAND[track].top + BAND[track].height / 2
}

function position(record: SheetRecord, year: number): number {
  return ((year - record.from) / (record.to - record.from)) * 100
}

/** The magenta route over a paper casing 3px wider on each side, as survey maps draw roads. */
function RouteLine({ points, width }: { points: string; width: number }) {
  return (
    <>
      <polyline
        data-route="casing"
        points={points}
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth={width + 6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        data-route="line"
        points={points}
        fill="none"
        stroke="var(--color-route)"
        strokeWidth={width}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}

function featureBox(record: SheetRecord, entry: RecordEntry) {
  const left = position(record, entry.start)
  return {
    left: `${left}%`,
    width: entry.point ? '3px' : `${Math.max(position(record, entry.end) - left, 0.4)}%`,
    // Bars stand taller than the route's 10px casing, so a bar the route runs along still shows on both sides.
    top: `calc(${centre(entry.track)}% - ${entry.point ? 12 : 9}px)`,
    height: entry.point ? '24px' : '18px',
    anchorRight: left > 70,
    atStart: left <= 0,
    // A tick sits at its year's start, so only a range bar can end at the right edge.
    atEnd: !entry.point && position(record, entry.end) >= 100,
  }
}

function FeatureLabel({ record, entry, above }: { record: SheetRecord; entry: RecordEntry; above: boolean }) {
  const box = featureBox(record, entry)
  // The block-out reaches 4px past the bar, but never past the map's edges.
  const start = box.atStart ? 'left-0' : '-left-1'
  const end = box.atEnd ? 'right-0' : '-right-1'
  return (
    <div className="absolute" style={{ left: box.left, width: box.width, top: box.top, height: box.height }}>
      <span
        data-knockout={entry.track}
        className={`absolute max-w-56 truncate whitespace-nowrap px-1 text-xs leading-tight ${KNOCKOUT[entry.track]} ${
          box.anchorRight ? `${end} text-right` : start
        } ${above ? 'bottom-full mb-1' : 'top-full mt-1'}`}
      >
        {entry.label}
      </span>
    </div>
  )
}

function Dot({ left, top, solid, marker, lit }: { left: number; top: number; solid: boolean; marker: string; lit?: boolean }) {
  return (
    <span
      data-marker={marker}
      data-dim
      data-lit={lit || undefined}
      className={`route-marker absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-route ${
        solid ? 'bg-route' : 'bg-paper'
      }`}
      style={{ left: `${left}%`, top: `${top}%` }}
    />
  )
}

/**
 * A marker's label takes a margin row of its own, on bare paper, so wider text
 * spacing cannot push it into the labels inside a band (WCAG 1.4.12).
 */
function MarkerLabel({ left, top, label, lit }: { left: number; top: string; label: string; lit?: boolean }) {
  // Past 85% of the width the label ends at its marker, so it never runs off the sheet.
  const shift = left > 85 ? '-translate-x-full' : '-translate-x-1/2'
  return (
    <span
      className={`route-marker absolute ${shift} whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-route`}
      style={{ left: `${left}%`, top }}
    >
      <span data-knockout="paper" data-lit={lit || undefined} className="bg-paper px-1">
        {label}
      </span>
    </span>
  )
}

/**
 * The first sheet's horizontal map. Decorative: RecordStrip carries the same
 * facts as text. Graphics and lettering sit in separate layers, so a layer that
 * lets the graphics recede never fades a label.
 */
export function RouteMap({ record, now, className = '' }: MapProps) {
  const { focused } = useSheet()
  // The recorded answer's source is where the full-time date comes from, so opening it lights that marker.
  const fullTimeLit = sameSource(focused, FULL_TIME_SOURCE)
  const route = routePoints(record, now)
  const here = route[route.length - 1]
  // "You are here" is the visitor's date, so it shows even before any entry has started.
  const hereTrack: Track = here?.track ?? 'education'
  const line = route.map((p) => `${position(record, p.year)},${centre(p.track)}`).join(' ')
  const years = Array.from({ length: record.to - record.from }, (_, i) => record.from + i)
  const today = position(record, toYear(now))
  const planned = position(record, FULL_TIME_FROM)
  // Once full-time has started, the planned line would run backwards in time.
  const beforeFullTime = toYear(now) < FULL_TIME_FROM

  return (
    <div aria-hidden="true" className={`relative h-60 select-none ${className}`}>
      <div data-graphic className="absolute inset-0">
        <div className="absolute inset-0 flex">
          {years.map((year) => (
            <div key={year} className="flex-1 border-l border-grid last:border-r" />
          ))}
        </div>
        {TRACKS.map((track) => (
          <div
            key={track}
            className={`absolute inset-x-0 opacity-80 ${track === 'education' ? 'bg-edu' : 'bg-work'}`}
            style={{ top: `${BAND[track].top}%`, height: `${BAND[track].height}%` }}
          />
        ))}
        {record.entries.map((entry) => {
          const box = featureBox(record, entry)
          return (
            <div
              key={entry.id}
              data-dim
              className={`absolute ${entry.track === 'education' ? 'bg-edu-bar' : 'bg-work-bar'}`}
              style={{ left: box.left, width: box.width, top: box.top, height: box.height }}
            />
          )
        })}
        <svg
          className="route-reveal absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <g data-dim>
            <RouteLine points={line} width={4} />
          </g>
          {beforeFullTime && (
            <line
              data-marker="planned"
              data-dim
              data-lit={fullTimeLit || undefined}
              x1={today}
              y1={centre(hereTrack)}
              x2={planned}
              y2={centre('work')}
              stroke="var(--color-route)"
              strokeWidth={3}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <Dot left={today} top={centre(hereTrack)} solid marker="today" />
        <Dot left={planned} top={centre('work')} solid={!beforeFullTime} marker="full-time" lit={fullTimeLit} />
      </div>
      <div className="absolute inset-0">
        <div className="absolute inset-0 flex">
          {years.map((year) => (
            <div key={year} className="relative flex-1">
              <span className="absolute left-1.5 top-0 text-xs tabular-nums tracking-wider text-muted">{year}</span>
            </div>
          ))}
        </div>
        {TRACKS.map((track) => (
          <span
            key={track}
            className="sheet-label absolute left-1.5"
            style={{ top: `calc(${BAND[track].top}% + 4px)` }}
          >
            {TRACK_NAMES[track]}
          </span>
        ))}
        {TRACKS.map((track) =>
          record.entries
            .filter((entry) => entry.track === track)
            .map((entry, i) => <FeatureLabel key={entry.id} record={record} entry={entry} above={i % 2 === 1} />),
        )}
        {/* The year row above is one 16px line of text-xs; this row starts just under it. */}
        <MarkerLabel left={today} top="1.125rem" label="You are here" />
        <MarkerLabel
          left={planned}
          top={`calc(${BAND.work.top + BAND.work.height}% + 2px)`}
          label={FULL_TIME_LABEL}
          lit={fullTimeLit}
        />
      </div>
    </div>
  )
}

/**
 * A vertical strip with the record as text beside it. It lights whatever the
 * open source points at, and names an open source that has no date.
 */
export function RecordStrip({ record, now, className = '' }: MapProps) {
  const { focused, trailing } = useSheet()
  const lit = new Set(focused ? entriesForSource(focused, record.entries) : [])
  const column = (track: Track) => (track === 'education' ? 25 : 75)
  const line = routePoints(record, now)
    .map((p) => `${column(p.track)},${position(record, p.year)}`)
    .join(' ')

  return (
    <div className={`flex gap-4 ${className}`}>
      <div aria-hidden="true" data-graphic className="relative min-h-72 w-14 shrink-0 self-stretch">
        <div className="absolute inset-y-0 left-1/4 w-px bg-grid" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-grid" />
        {record.entries.map((entry) => (
          <div
            key={entry.id}
            data-dim
            data-lit={lit.has(entry.id) || undefined}
            className={`absolute -translate-x-1/2 ${
              entry.track === 'education' ? 'left-1/4 bg-edu-bar' : 'left-3/4 bg-work-bar'
            }`}
            style={{
              top: `${position(record, entry.start)}%`,
              // Wider than the strip's 9px casing, so a bar the route runs along still shows on both sides.
              width: '16px',
              height: entry.point ? '6px' : `${position(record, entry.end) - position(record, entry.start)}%`,
            }}
          />
        ))}
        <svg
          className="route-reveal absolute inset-0 h-full w-full overflow-visible"
          data-axis="y"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <RouteLine points={line} width={3} />
        </svg>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {focused && lit.size === 0 && (
          <p data-lit className="py-1 pl-2 pr-2 text-sm break-words">
            {`${sourceLabel(focused, trailing)} is not tied to a date on the record.`}
          </p>
        )}
        {/* Safari drops list semantics when list-style is none. This list is the map's only text equivalent. */}
        <ol role="list" aria-label="Dated record" className="space-y-1 text-sm">
          {record.entries.map((entry) => (
            <li
              key={entry.id}
              data-lit={lit.has(entry.id) || undefined}
              data-track={entry.track}
              className={`py-1 pl-2 pr-2 ${lit.has(entry.id) ? 'font-semibold' : ''}`}
            >
              <span className="block break-words">{entry.title}</span>
              <span className="block text-xs text-muted">{`${TRACK_NAMES[entry.track]} · ${entry.dates}`}</span>
            </li>
          ))}
          {record.unplotted.map((item, index) => (
            <li key={`undated-${index}`} className="py-1 pl-2 pr-2">
              <span className="block break-words">{item.title}</span>
              <span className="block text-xs text-muted">{`Undated · ${item.dates}`}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
