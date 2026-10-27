import { MAP_LABELS } from './constants'
import type { SourceInfo, Timeline } from './types'

export type Track = 'education' | 'work'

export interface RecordEntry {
  id: string
  track: Track
  /** Short form for the map, where space is tight. */
  label: string
  /** Full degree and institution, or role and company. */
  title: string
  dates: string
  /** Text a source's detail must contain to point at this entry. */
  matchKey: string
  /** Fractional years: 2023.5 is the start of July 2023. */
  start: number
  end: number
  /** A year-only entry, such as a school certificate, drawn as a tick. */
  point: boolean
}

export interface SheetRecord {
  entries: RecordEntry[]
  /** Entries whose dates could not be read. They are listed, never plotted. */
  unplotted: { title: string; dates: string }[]
  /** First year on the axis. */
  from: number
  /** The year after the last column. */
  to: number
}

export interface RoutePoint {
  year: number
  track: Track
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

const PRESENT = /^(present|now|current)$/i

const COMPANY_SUFFIX = /\s+(pvt\.?\s*ltd\.?|ltd\.?|llp|inc\.?)$/i

export function toYear(date: Date): number {
  return date.getFullYear() + (date.getMonth() + (date.getDate() - 1) / 31) / 12
}

function monthStart(token: string): number | null {
  const match = token.trim().match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (!match) return null
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()]
  return month === undefined ? null : Number(match[2]) + month / 12
}

/**
 * Reads a `dates` string as academics.yaml and linkedin.yaml write it:
 * "January 2026 - January 2027", "Jun 2024 - Jan 2026", "2018" or
 * "Jan 2026 - Present". An end month counts in full.
 */
export function parseDates(
  dates: string,
  now: Date,
): { start: number; end: number; point: boolean } | null {
  const text = dates.trim()
  if (/^\d{4}$/.test(text)) {
    const year = Number(text)
    return { start: year, end: year + 1, point: true }
  }
  const parts = text.split(/\s+-\s+/)
  if (parts.length !== 2) return null
  const start = monthStart(parts[0])
  if (start === null) return null
  let end: number | null
  if (PRESENT.test(parts[1].trim())) {
    end = toYear(now)
  } else {
    const endMonth = monthStart(parts[1])
    end = endMonth === null ? null : endMonth + 1 / 12
  }
  if (end === null || end <= start) return null
  return { start, end, point: false }
}

/** "Liverpool John Moores University (LJMU)" reads "LJMU"; a campus or address after the name is dropped. */
export function shortInstitution(name: string): string {
  const bracketed = name.match(/\(([^)]+)\)\s*$/)
  if (bracketed) return bracketed[1]
  return name.split(/\s+-\s+|,/)[0].trim()
}

/** "Bachelor of Commerce (B.Com.)" reads "B.Com"; a degree with no bracketed short form stays whole. */
export function shortDegree(degree: string): string {
  const bracketed = degree.match(/\(([^)]+)\)/)
  return (bracketed ? bracketed[1] : degree).replace(/\.$/, '').trim()
}

function shortCompany(company: string): string {
  return company.replace(COMPANY_SUFFIX, '').trim()
}

export function buildRecord(timeline: Timeline, now: Date, plannedFrom: number): SheetRecord {
  const entries: RecordEntry[] = []
  const unplotted: SheetRecord['unplotted'] = []

  const add = (entry: Omit<RecordEntry, 'start' | 'end' | 'point'>) => {
    const span = parseDates(entry.dates, now)
    if (span) entries.push({ ...entry, ...span })
    else unplotted.push({ title: entry.title, dates: entry.dates })
  }

  timeline.education.forEach((item, i) => {
    const title = `${item.degree}, ${item.institution}`
    add({
      id: `education-${i}`,
      track: 'education',
      label: MAP_LABELS[title] ?? `${shortDegree(item.degree)}, ${shortInstitution(item.institution)}`,
      title,
      dates: item.dates,
      matchKey: item.institution,
    })
  })
  timeline.work.forEach((item, i) => {
    const title = `${item.role}, ${item.company}`
    add({
      id: `work-${i}`,
      track: 'work',
      label: MAP_LABELS[title] ?? `${item.role}, ${shortCompany(item.company)}`,
      title,
      dates: item.dates,
      matchKey: item.company,
    })
  })

  entries.sort((a, b) => a.start - b.start)
  const today = toYear(now)
  const from = Math.floor(Math.min(today, ...entries.map((e) => e.start)))
  const to = Math.ceil(Math.max(today, plannedFrom + 1 / 12, ...entries.map((e) => e.end)))
  return { entries, unplotted, from, to }
}

/** The route visits each entry where it starts, in date order, then stops at today. */
export function routePoints(record: SheetRecord, now: Date): RoutePoint[] {
  const today = toYear(now)
  const started = record.entries.filter((e) => e.start <= today)
  const points: RoutePoint[] = started.map((e) => ({ year: e.start, track: e.track }))
  const current = [...started].reverse().find((e) => today <= e.end) ?? started[started.length - 1]
  if (current) points.push({ year: today, track: current.track })
  return points
}

/** Entries a cited source points at. LinkedIn arrives as one chunk, so it covers every job. */
export function entriesForSource(source: SourceInfo, entries: RecordEntry[]): string[] {
  if (source.source === 'linkedin') {
    return entries.filter((e) => e.track === 'work').map((e) => e.id)
  }
  if (source.source === 'academics') {
    return entries
      .filter((e) => e.track === 'education' && source.detail.includes(e.matchKey))
      .map((e) => e.id)
  }
  return []
}
