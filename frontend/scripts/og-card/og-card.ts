/**
 * Fills og-card.html when it opens. The lettering is quoted from
 * src/lib/constants.ts. The route is the first sheet's own: the record comes
 * from the backend's /timeline and is placed by buildRecord and routePoints,
 * so the card draws what the page draws on the day it is rendered.
 */
import '@fontsource/signika/latin-400.css'
import '@fontsource/signika/latin-600.css'
import { fetchTimeline } from '../../src/lib/api'
import { FULL_TIME_FROM, PROFILE, ROLE_LINE, SHEET_FACTS } from '../../src/lib/constants'
import { buildRecord, routePoints, toYear, type SheetRecord, type Track } from '../../src/lib/timeline'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The strip's size in px. og-card.html places it inside the sheet's inner frame. */
const WIDTH = 1130
const HEIGHT = 132

const TRACKS: Track[] = ['education', 'work']

// Each track's band, in px from the strip's top.
const BAND: Record<Track, { top: number; height: number }> = {
  education: { top: 14, height: 52 },
  work: { top: 70, height: 52 },
}

/** The facts the card has room for, named by their SHEET_FACTS label. */
const CARD_FACTS = ['Available', 'Visa']

function centre(track: Track): number {
  return BAND[track].top + BAND[track].height / 2
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function slot<T extends Element>(name: string): T {
  const node = document.querySelector<T>(`[data-slot="${name}"]`)
  if (!node) throw new Error(`og-card.html has no data-slot="${name}".`)
  return node
}

function shape(name: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  return node
}

function letter(): void {
  slot('name').textContent = PROFILE.name
  slot('role').textContent = ROLE_LINE
  const list = slot('facts')
  for (const label of CARD_FACTS) {
    const fact = SHEET_FACTS.find((item) => item.label === label)
    if (!fact) throw new Error(`SHEET_FACTS has no "${label}" fact.`)
    const term = document.createElement('dt')
    term.textContent = fact.label
    const value = document.createElement('dd')
    value.textContent = fact.value
    list.append(term, value)
  }
}

/** The first sheet's map at card size, without its lettering. */
function drawRoute(svg: SVGSVGElement, record: SheetRecord, now: Date): void {
  const x = (year: number) => ((year - record.from) / (record.to - record.from)) * WIDTH
  svg.setAttribute('width', String(WIDTH))
  svg.setAttribute('height', String(HEIGHT))
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  for (const track of TRACKS) {
    svg.append(shape('rect', { class: `band ${track}`, x: 0, y: BAND[track].top, width: WIDTH, height: BAND[track].height }))
  }
  // The strip's two ends are the axis ends, so only the year starts between them need a line.
  for (let year = record.from + 1; year < record.to; year++) {
    svg.append(shape('line', { class: 'grid', 'data-year': year, x1: x(year), y1: 0, x2: x(year), y2: HEIGHT }))
  }
  for (const entry of record.entries) {
    // As on the page: a year-only entry is a 3px tick at its year's start, and a bar stands taller than the casing.
    const tall = entry.point ? 26 : 20
    svg.append(
      shape('rect', {
        class: `bar ${entry.track}`,
        x: x(entry.start),
        y: centre(entry.track) - tall / 2,
        width: entry.point ? 3 : Math.max(x(entry.end) - x(entry.start), WIDTH * 0.004),
        height: tall,
      }),
    )
  }

  const route = routePoints(record, now)
  const points = route.map((p) => `${x(p.year)},${centre(p.track)}`).join(' ')
  svg.append(shape('polyline', { class: 'path casing', points }), shape('polyline', { class: 'path line', points }))

  const today = toYear(now)
  const hereTrack: Track = route.at(-1)?.track ?? 'education'
  const beforeFullTime = today < FULL_TIME_FROM
  if (beforeFullTime) {
    svg.append(shape('line', { class: 'leg', x1: x(today), y1: centre(hereTrack), x2: x(FULL_TIME_FROM), y2: centre('work') }))
  }
  svg.append(
    shape('circle', { class: 'here', 'data-marker': 'today', cx: x(today), cy: centre(hereTrack), r: 10 }),
    shape('circle', {
      class: beforeFullTime ? 'ring' : 'ring reached',
      'data-marker': 'full-time',
      cx: x(FULL_TIME_FROM),
      cy: centre('work'),
      r: 9,
    }),
  )
}

async function fill(): Promise<void> {
  const now = new Date()
  const timeline = await fetchTimeline()
  if (!timeline) throw new Error('/api/timeline sent no record. Is the backend running on port 8000?')
  const record = buildRecord(timeline, now, FULL_TIME_FROM)
  if (record.entries.length === 0) throw new Error('The record has no dated entries to draw.')
  if (record.unplotted.length > 0) {
    const titles = record.unplotted.map((item) => item.title).join('; ')
    throw new Error(`The route would leave out entries whose dates do not read: ${titles}`)
  }
  letter()
  drawRoute(slot<SVGSVGElement>('route'), record, now)
  for (const weight of [400, 600]) {
    const faces = await document.fonts.load(`${weight} 32px Signika`)
    if (!faces.some((face) => face.status === 'loaded')) throw new Error(`Signika ${weight} did not load.`)
  }
  await document.fonts.ready
  document.documentElement.dataset.now = isoDate(now)
}

fill().then(
  () => {
    document.documentElement.dataset.state = 'ready'
  },
  (error: unknown) => {
    document.documentElement.dataset.state = 'error'
    const message = document.createElement('pre')
    message.className = 'error'
    message.textContent = error instanceof Error ? error.message : String(error)
    document.body.replaceChildren(message)
  },
)
