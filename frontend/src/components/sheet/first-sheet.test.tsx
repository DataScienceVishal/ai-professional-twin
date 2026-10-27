import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FirstSheet } from './first-sheet'
import { EXHIBIT } from '../../lib/exhibit'
import { buildRecord } from '../../lib/timeline'

const NOW = new Date(2026, 9, 12)

const record = buildRecord(
  {
    education: [
      {
        institution: 'Northeastern University London',
        degree: 'MSc Artificial Intelligence & Computer Science',
        dates: 'January 2026 - January 2027',
        status: 'Currently enrolled',
      },
    ],
    work: [{ company: 'Teleperformance Global Business Pvt. Ltd.', role: 'Data Engineer', dates: 'Jun 2024 - Jan 2026' }],
  },
  NOW,
  2027,
)

function renderSheet() {
  return render(
    <FirstSheet record={record} now={NOW} projects={[]} projectsLoading={false} skills={[]} skillsLoading={false} />,
  )
}

describe('FirstSheet', () => {
  it("dates the recorded answer as the assistant's, and names the entry it restates", () => {
    renderSheet()
    const dateline = screen.getByText("The assistant's answer, recorded 12 Oct 2026 · career_qa.yaml, availability")
    expect(screen.getByRole('heading', { level: 2, name: EXHIBIT.question }).nextElementSibling).toBe(dateline)
  })

  it('keeps the recording date whole, and its dot on the line the date ends', () => {
    renderSheet()
    const dateline = screen.getByRole('heading', { level: 2, name: EXHIBIT.question }).nextElementSibling
    expect(dateline?.textContent).toContain('recorded 12\u00a0Oct\u00a02026\u00a0· career_qa.yaml')
  })

  it('sets the record caption on its heading row, above the map, so the dock cannot cut it at the fold', () => {
    renderSheet()
    const heading = screen.getByRole('heading', { level: 2, name: 'His record, 2024 to 2027' })
    const caption = screen.getByText('Dates come from academics.yaml and linkedin.yaml.')
    expect(caption.parentElement).toBe(heading.parentElement)
    expect(heading.closest('section')?.firstElementChild).toBe(heading.parentElement)
  })
})
