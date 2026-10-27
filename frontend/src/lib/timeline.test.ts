import { describe, expect, it } from 'vitest'
import {
  buildRecord,
  entriesForSource,
  parseDates,
  routePoints,
  shortDegree,
  shortInstitution,
  toYear,
} from './timeline'
import type { Timeline } from './types'

const NOW = new Date(2026, 9, 12)

const TIMELINE: Timeline = {
  education: [
    {
      institution: 'Northeastern University London',
      degree: 'MSc Artificial Intelligence & Computer Science',
      dates: 'January 2026 - January 2027',
      status: 'Currently enrolled',
    },
    {
      institution: 'Liverpool John Moores University (LJMU)',
      degree: 'MSc Data Science',
      dates: 'August 2023 - August 2024',
      status: 'Completed',
    },
    {
      institution: 'Angel Public School, Om Vihar, Uttam Nagar, Delhi',
      degree: 'Secondary School Certificate (Class 10 / CBSE)',
      dates: '2016',
      status: 'Completed',
    },
    { institution: 'Somewhere', degree: 'Unknown', dates: 'sometime', status: '' },
  ],
  work: [
    { company: 'Teleperformance Global Business Pvt. Ltd.', role: 'Data Engineer', dates: 'Jun 2024 - Jan 2026' },
    { company: 'PJRJ Associates', role: 'Finance/Accounts/Taxation', dates: 'Jul 2018 - Sep 2020' },
  ],
}

describe('parseDates', () => {
  it('reads full month names and counts the end month in full', () => {
    const span = parseDates('August 2023 - August 2024', NOW)
    expect(span?.point).toBe(false)
    expect(span?.start).toBeCloseTo(2023 + 7 / 12, 6)
    expect(span?.end).toBeCloseTo(2024 + 8 / 12, 6)
  })

  it('reads three-letter months as linkedin.yaml writes them', () => {
    const span = parseDates('Jun 2024 - Jan 2026', NOW)
    expect(span?.start).toBeCloseTo(2024 + 5 / 12, 6)
    expect(span?.end).toBeCloseTo(2026 + 1 / 12, 6)
  })

  it('treats a year on its own as a one-year point', () => {
    expect(parseDates('2018', NOW)).toEqual({ start: 2018, end: 2019, point: true })
  })

  it('ends an open entry today', () => {
    expect(parseDates('Jan 2026 - Present', NOW)?.end).toBeCloseTo(toYear(NOW), 6)
  })

  it('refuses text it cannot read rather than guessing', () => {
    expect(parseDates('sometime', NOW)).toBeNull()
    expect(parseDates('Smarch 2023 - May 2024', NOW)).toBeNull()
    expect(parseDates('August 2024 - March 2023', NOW)).toBeNull()
  })
})

describe('short labels', () => {
  it('prefers the bracketed short form of an institution', () => {
    expect(shortInstitution('Liverpool John Moores University (LJMU)')).toBe('LJMU')
    expect(shortInstitution('International Institute of Information Technology Bangalore (IIIT-B)')).toBe('IIIT-B')
  })

  it('drops a campus or an address after the name', () => {
    expect(shortInstitution('University of Delhi - School of Open Learning')).toBe('University of Delhi')
    expect(shortInstitution('Angel Public School, Om Vihar, Uttam Nagar, Delhi')).toBe('Angel Public School')
  })

  it('uses a degree short form when the file gives one', () => {
    expect(shortDegree('Bachelor of Commerce (B.Com.)')).toBe('B.Com')
    expect(shortDegree('MSc Data Science')).toBe('MSc Data Science')
  })
})

describe('buildRecord', () => {
  const record = buildRecord(TIMELINE, NOW, 2027)

  it('orders entries by start date across both tracks', () => {
    expect(record.entries.map((e) => e.id)).toEqual([
      'education-2',
      'work-1',
      'education-1',
      'work-0',
      'education-0',
    ])
  })

  it('lists undated entries instead of plotting them', () => {
    expect(record.unplotted).toEqual([{ title: 'Unknown, Somewhere', dates: 'sometime' }])
  })

  it('spans the axis from the first year to the year after full-time availability', () => {
    expect(record.from).toBe(2016)
    expect(record.to).toBe(2028)
  })

  it('labels entries in short form and keeps the full text', () => {
    const job = record.entries.find((e) => e.id === 'work-0')
    expect(job?.label).toBe('Data Engineer, Teleperformance Global Business')
    expect(job?.title).toBe('Data Engineer, Teleperformance Global Business Pvt. Ltd.')
  })

  it('keeps working once the planned start has passed', () => {
    const later = new Date(2027, 5, 1)
    const lateRecord = buildRecord(TIMELINE, later, 2027)
    expect(lateRecord.to).toBeGreaterThanOrEqual(2028)
    const points = routePoints(lateRecord, later)
    expect(points[points.length - 1].year).toBeCloseTo(toYear(later), 6)
  })
})

describe('routePoints', () => {
  it('visits each start in order and ends today on the current track', () => {
    const points = routePoints(buildRecord(TIMELINE, NOW, 2027), NOW)
    expect(points.map((p) => p.track)).toEqual([
      'education',
      'work',
      'education',
      'work',
      'education',
      'education',
    ])
    expect(points[points.length - 1].year).toBeCloseTo(toYear(NOW), 6)
  })
})

describe('entriesForSource', () => {
  const { entries } = buildRecord(TIMELINE, NOW, 2027)

  it('finds an education entry by institution whichever way round the detail is', () => {
    const forward = 'Liverpool John Moores University (LJMU) - MSc Data Science'
    const reversed = 'MSc Data Science - Liverpool John Moores University (LJMU)'
    expect(entriesForSource({ source: 'academics', detail: forward, url: '' }, entries)).toEqual(['education-1'])
    expect(entriesForSource({ source: 'academics', detail: reversed, url: '' }, entries)).toEqual(['education-1'])
  })

  it('points a LinkedIn source at every job, because it arrives as one chunk', () => {
    const linkedin = { source: 'linkedin', detail: '', url: 'https://www.linkedin.com/in/x/' }
    expect(entriesForSource(linkedin, entries)).toEqual(['work-1', 'work-0'])
  })

  it('gives no position to a source without dates', () => {
    expect(entriesForSource({ source: 'career_qa', detail: 'availability', url: '' }, entries)).toEqual([])
  })

  it('matches each real academics source to exactly one entry', () => {
    const real = buildRecord(
      {
        education: [
          { institution: 'University of Delhi - School of Open Learning', degree: 'Bachelor of Commerce (B.Com.)', dates: 'November 2018 - November 2021', status: 'Completed' },
          { institution: 'Northeastern University London', degree: 'MSc Artificial Intelligence & Computer Science', dates: 'January 2026 - January 2027', status: '' },
          { institution: 'Sarvodaya Bal Vidyalaya No 2 C Block Janakpuri, Delhi', degree: 'Senior School Certificate (Class 12 / CBSE)', dates: '2018', status: '' },
        ],
        work: [],
      },
      NOW,
      2027,
    ).entries
    const details = [
      'Bachelor of Commerce (B.Com.) - University of Delhi - School of Open Learning',
      'University of Delhi - School of Open Learning - Bachelor of Commerce (B.Com.)',
      'MSc Artificial Intelligence & Computer Science - Northeastern University London',
      'Senior School Certificate (Class 12 / CBSE) - Sarvodaya Bal Vidyalaya No 2 C Block Janakpuri, Delhi',
    ]
    for (const detail of details) {
      expect(entriesForSource({ source: 'academics', detail, url: '' }, real)).toHaveLength(1)
    }
  })
})
