import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecordStrip, RouteMap } from './route-map'
import { FULL_TIME_SOURCE } from '../../lib/constants'
import { buildRecord } from '../../lib/timeline'
import { renderWithSheet } from '../../test/sheet'
import type { Timeline } from '../../lib/types'

const NOW = new Date(2026, 9, 12)

const TIMELINE: Timeline = {
  education: [
    {
      institution: 'Liverpool John Moores University (LJMU)',
      degree: 'MSc Data Science',
      dates: 'August 2023 - August 2024',
      status: 'Completed',
    },
    {
      institution: 'Northeastern University London',
      degree: 'MSc Artificial Intelligence & Computer Science',
      dates: 'January 2026 - January 2027',
      status: 'Currently enrolled',
    },
    { institution: 'Somewhere', degree: 'Unknown', dates: 'sometime', status: '' },
  ],
  work: [
    { company: 'Teleperformance Global Business Pvt. Ltd.', role: 'Data Engineer', dates: 'Jun 2024 - Jan 2026' },
  ],
}

const record = buildRecord(TIMELINE, NOW, 2027)

// A year-only 2016 entry starts the axis in 2016, which puts today and the full-time start past 85% of the width.
const fromSchool = buildRecord(
  {
    ...TIMELINE,
    education: [
      ...TIMELINE.education,
      {
        institution: 'Angel Public School, Om Vihar, Uttam Nagar, Delhi',
        degree: 'Secondary School Certificate (Class 10 / CBSE)',
        dates: '2016',
        status: 'Completed',
      },
    ],
  },
  NOW,
  2027,
)

describe('RouteMap', () => {
  it('is hidden from assistive technology, since the strip carries the same facts as text', () => {
    const { container } = render(<RouteMap record={record} now={NOW} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('labels a column for every year on the axis', () => {
    render(<RouteMap record={record} now={NOW} />)
    for (let year = record.from; year < record.to; year++) {
      expect(screen.getByText(String(year))).toBeInTheDocument()
    }
  })

  it('marks today and the full-time start', () => {
    render(<RouteMap record={record} now={NOW} />)
    expect(screen.getByText('You are here')).toBeInTheDocument()
    expect(screen.getByText('Full-time from Jan 2027')).toBeInTheDocument()
  })

  it('draws the route through every start in date order, then today', () => {
    const { container } = render(<RouteMap record={record} now={NOW} />)
    const points = container.querySelector('[data-route="line"]')?.getAttribute('points')?.trim().split(' ')
    expect(points).toHaveLength(record.entries.length + 1)
    const xs = (points ?? []).map((point) => Number(point.split(',')[0]))
    xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThanOrEqual(xs[i]))
  })

  it('puts every bar in the graphics layer, so receding layers reach them', () => {
    const { container } = render(<RouteMap record={record} now={NOW} />)
    const bars = container.querySelectorAll<HTMLElement>('[data-graphic] div[data-dim]')
    expect(bars).toHaveLength(record.entries.length)
    // The axis runs from 2023 to 2028, and Northeastern starts in January 2026.
    expect(bars[2].style.left).toBe('60%')
  })

  it("draws every bar taller than the route's casing, so a bar the route runs along still shows", () => {
    const { container } = render(<RouteMap record={fromSchool} now={NOW} />)
    const casing = parseFloat(container.querySelector('[data-route="casing"]')?.getAttribute('stroke-width') ?? '')
    expect(casing).toBeGreaterThan(0)
    const bars = container.querySelectorAll<HTMLElement>('[data-graphic] div[data-dim]')
    expect(bars).toHaveLength(fromSchool.entries.length)
    for (const bar of bars) {
      expect(parseFloat(bar.style.height)).toBeGreaterThanOrEqual(casing + 8)
    }
  })

  it('centres a marker label on its marker, and ends it at the marker near the right edge', () => {
    // On the 2023 to 2028 axis today and the full-time start sit at about 76% and 80%.
    const centred = render(<RouteMap record={record} now={NOW} />)
    for (const text of ['You are here', 'Full-time from Jan 2027']) {
      const label = within(centred.container).getByText(text).parentElement
      expect(label).toHaveClass('-translate-x-1/2')
      expect(label).not.toHaveClass('-translate-x-full')
    }
    const late = render(<RouteMap record={fromSchool} now={NOW} />)
    for (const text of ['You are here', 'Full-time from Jan 2027']) {
      const label = within(late.container).getByText(text).parentElement
      expect(label).toHaveClass('-translate-x-full')
      expect(label).not.toHaveClass('-translate-x-1/2')
    }
  })

  it('blocks out the route behind every label', () => {
    render(<RouteMap record={record} now={NOW} />)
    for (const [text, track, band] of [
      ['You are here', 'paper', 'bg-paper'],
      ['LJMU MSc Data Science', 'education', 'bg-edu-band'],
      ['Full-time from Jan 2027', 'paper', 'bg-paper'],
    ]) {
      const knockout = screen.getByText(text).closest(`[data-knockout="${track}"]`)
      expect(knockout).not.toBeNull()
      expect(knockout).toHaveClass(band)
    }
  })

  it("sets the marker labels in the map's margin rows, clear of the bands and their labels", () => {
    render(<RouteMap record={record} now={NOW} />)
    // Between the year row and the education band, and below the work band.
    expect(screen.getByText('You are here').parentElement?.style.top).toBe('1.125rem')
    expect(screen.getByText('Full-time from Jan 2027').parentElement?.style.top).toBe('calc(86% + 2px)')
  })

  it('lets the markers and their labels wait for the route to reach them', () => {
    const { container } = render(<RouteMap record={record} now={NOW} />)
    for (const marker of ['today', 'full-time']) {
      expect(container.querySelector(`[data-marker="${marker}"]`)).toHaveClass('route-marker')
    }
    for (const text of ['You are here', 'Full-time from Jan 2027']) {
      expect(screen.getByText(text).closest('.route-marker')).not.toBeNull()
    }
  })

  it("stops a block-out at the map's edge instead of poking past it", () => {
    render(<RouteMap record={fromSchool} now={NOW} />)
    const first = screen.getByText('Class 10 / CBSE')
    expect(first).toHaveClass('left-0')
    expect(first).not.toHaveClass('-left-1')
  })

  it('stops drawing the planned line once full-time has started', () => {
    const later = new Date(2027, 2, 1)
    const after = render(<RouteMap record={buildRecord(TIMELINE, later, 2027)} now={later} />)
    expect(after.container.querySelector('line')).toBeNull()
    const before = render(<RouteMap record={record} now={NOW} />)
    expect(before.container.querySelector('line')).not.toBeNull()
  })

  it('fills the full-time ring once full-time has started', () => {
    const later = new Date(2027, 2, 1)
    const after = render(<RouteMap record={buildRecord(TIMELINE, later, 2027)} now={later} />)
    expect(after.container.querySelector('[data-marker="full-time"]')).toHaveClass('bg-route')
    const before = render(<RouteMap record={record} now={NOW} />)
    expect(before.container.querySelector('[data-marker="full-time"]')).toHaveClass('bg-paper')
    expect(before.container.querySelector('[data-marker="full-time"]')).not.toHaveClass('bg-route')
  })

  it("lights the full-time ring, its dashed leg and its label while the recorded answer's source is open", () => {
    const { container } = renderWithSheet(<RouteMap record={record} now={NOW} />, { focused: FULL_TIME_SOURCE })
    expect(container.querySelector('[data-marker="full-time"]')).toHaveAttribute('data-lit', 'true')
    expect(container.querySelector('line[data-marker="planned"]')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByText('Full-time from Jan 2027').closest('[data-lit]')).not.toBeNull()
    expect(screen.getByText('Full-time from Jan 2027').closest('[data-graphic]')).toBeNull()
    // Everything else recedes: the route, today's dot and every bar.
    const route = container.querySelector('[data-route="line"]')?.closest('g')
    expect(route).toHaveAttribute('data-dim')
    expect(route).not.toHaveAttribute('data-lit')
    const today = container.querySelector('[data-marker="today"]')
    expect(today).toHaveAttribute('data-dim')
    expect(today).not.toHaveAttribute('data-lit')
    const bars = container.querySelectorAll('[data-graphic] div[data-dim]')
    expect(bars).toHaveLength(record.entries.length)
    for (const bar of bars) expect(bar).not.toHaveAttribute('data-lit')
  })

  it('lights nothing on the map for any other source', () => {
    const { container } = renderWithSheet(<RouteMap record={record} now={NOW} />, {
      focused: { source: 'career_qa', detail: 'sponsorship', url: '' },
    })
    expect(container.querySelectorAll('[data-lit]')).toHaveLength(0)
    for (const marker of ['full-time', 'planned', 'today']) {
      expect(container.querySelector(`[data-marker="${marker}"]`)).toHaveAttribute('data-dim')
    }
  })

  it("marks the visitor's date even before any entry has started", () => {
    const future = buildRecord(
      {
        education: [{ institution: 'Somewhere', degree: 'Unknown', dates: 'January 2030 - January 2031', status: '' }],
        work: [],
      },
      NOW,
      2027,
    )
    render(<RouteMap record={future} now={NOW} />)
    expect(screen.getByText('You are here')).toBeInTheDocument()
  })

  it('keeps every label out of the graphics layer, so receding graphics never fade text', () => {
    render(<RouteMap record={record} now={NOW} />)
    for (const text of ['You are here', 'Full-time from Jan 2027', String(record.from), 'Education', 'Work']) {
      expect(screen.getByText(text).closest('[data-graphic]')).toBeNull()
    }
  })

  it('reveals the route along the time axis instead of dashing it', () => {
    const { container } = render(<RouteMap record={record} now={NOW} />)
    const layer = container.querySelector('svg.route-reveal')
    expect(layer).not.toBeNull()
    expect(layer).not.toHaveAttribute('data-axis')
    expect(container.querySelector('[pathLength]')).toBeNull()
  })
})

describe('RecordStrip', () => {
  it('lists every dated entry with its dates as text', () => {
    render(<RecordStrip record={record} now={NOW} />)
    const list = screen.getByRole('list', { name: 'Dated record' })
    expect(list).toHaveAttribute('role', 'list')
    const title = within(list).getByText('Data Engineer, Teleperformance Global Business Pvt. Ltd.')
    const caption = within(list).getByText('Work · Jun 2024 - Jan 2026')
    // The title leads; the track and dates follow as a quiet caption, not a capitalised label.
    expect(title.nextElementSibling).toBe(caption)
    expect(caption).toHaveClass('text-muted')
    expect(caption).not.toHaveClass('sheet-label')
  })

  it('lists an entry it could not date instead of dropping it', () => {
    render(<RecordStrip record={record} now={NOW} />)
    expect(screen.getByText('Undated · sometime')).toBeInTheDocument()
  })

  it('lights the entries an open source points at', () => {
    const { container } = renderWithSheet(<RecordStrip record={record} now={NOW} />, {
      focused: { source: 'academics', detail: 'MSc Data Science - Liverpool John Moores University (LJMU)', url: '' },
    })
    const lit = screen.getByText('MSc Data Science, Liverpool John Moores University (LJMU)').closest('li')
    const other = screen.getByText('Data Engineer, Teleperformance Global Business Pvt. Ltd.').closest('li')
    expect(lit).toHaveAttribute('data-lit', 'true')
    expect(other).not.toHaveAttribute('data-lit')
    expect(container.querySelectorAll('[data-graphic] [data-lit]')).toHaveLength(1)
  })

  it('tags each entry with its track, so a lit entry takes its own territory tint, with no side stripe', () => {
    const { container } = renderWithSheet(<RecordStrip record={record} now={NOW} />, {
      focused: { source: 'academics', detail: 'MSc Data Science - Liverpool John Moores University (LJMU)', url: '' },
    })
    const lit = screen.getByText('MSc Data Science, Liverpool John Moores University (LJMU)').closest('li')
    expect(lit).toHaveAttribute('data-track', 'education')
    expect(screen.getByText('Data Engineer, Teleperformance Global Business Pvt. Ltd.').closest('li')).toHaveAttribute('data-track', 'work')
    for (const element of container.querySelectorAll('li, [data-lit]')) {
      expect(element.className).not.toMatch(/border-l-\[3px\]/)
    }
  })

  it('frames the no-date note instead of striping its side', () => {
    renderWithSheet(<RecordStrip record={record} now={NOW} />, {
      focused: { source: 'career_qa', detail: 'availability', url: '' },
    })
    const note = screen.getByText('Career Q&A · Availability is not tied to a date on the record.')
    expect(note.className).not.toMatch(/border-l-\[3px\]|border-survey/)
    expect(note).not.toHaveAttribute('data-track')
  })

  it('names an open source that has no date instead of lighting nothing', () => {
    renderWithSheet(<RecordStrip record={record} now={NOW} />, {
      focused: { source: 'career_qa', detail: 'availability', url: '' },
    })
    const note = screen.getByText('Career Q&A · Availability is not tied to a date on the record.')
    expect(note).toHaveAttribute('data-lit', 'true')
  })

  it('lists two undated entries that share a title without a key clash', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const twins = buildRecord(
      {
        education: [
          { institution: 'Somewhere', degree: 'Unknown', dates: 'sometime', status: '' },
          { institution: 'Somewhere', degree: 'Unknown', dates: 'later', status: '' },
        ],
        work: [],
      },
      NOW,
      2027,
    )
    try {
      render(<RecordStrip record={twins} now={NOW} />)
      expect(screen.getAllByText('Unknown, Somewhere')).toHaveLength(2)
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }
  })

  it("draws every strip bar wider than the route's casing, so a bar the route runs along still shows", () => {
    const { container } = render(<RecordStrip record={fromSchool} now={NOW} />)
    const casing = parseFloat(container.querySelector('[data-route="casing"]')?.getAttribute('stroke-width') ?? '')
    expect(casing).toBeGreaterThan(0)
    const bars = container.querySelectorAll<HTMLElement>('[data-graphic] [data-dim]')
    expect(bars).toHaveLength(fromSchool.entries.length)
    for (const bar of bars) {
      expect(parseFloat(bar.style.width)).toBeGreaterThanOrEqual(casing + 6)
    }
  })

  it('keeps the record text outside the graphics layer', () => {
    const { container } = render(<RecordStrip record={record} now={NOW} />)
    expect(screen.getByRole('list', { name: 'Dated record' }).closest('[data-graphic]')).toBeNull()
    expect(container.querySelectorAll('[data-graphic] [data-dim]')).toHaveLength(record.entries.length)
  })

  it('reveals its route from the top', () => {
    const { container } = render(<RecordStrip record={record} now={NOW} />)
    expect(container.querySelector('svg.route-reveal[data-axis="y"]')).not.toBeNull()
  })
})
