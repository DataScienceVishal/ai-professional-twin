import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import { ROLE_LINE, SHEET_FACTS } from './constants'

function meta(attribute: 'name' | 'property', key: string): string {
  const match = html.match(new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`))
  if (!match) throw new Error(`index.html has no ${key}`)
  return match[1]
}

const AVAILABLE = SHEET_FACTS.find((fact) => fact.label === 'Available')?.value ?? ''

describe('index.html descriptions', () => {
  it.each([
    ['name', 'description'],
    ['property', 'og:description'],
    ['name', 'twitter:description'],
  ] as const)('%s="%s" leads with the role line and availability inside a search snippet', (attribute, key) => {
    const opening = meta(attribute, key).slice(0, 155)
    expect(opening).toContain(ROLE_LINE)
    expect(opening).toContain(AVAILABLE)
  })

  it('no longer invites visitors to ask anything', () => {
    expect(html).not.toMatch(/ask anything/i)
  })
})
