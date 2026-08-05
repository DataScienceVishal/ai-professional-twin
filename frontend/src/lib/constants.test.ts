import { describe, expect, it } from 'vitest'
import {
  CONTACT_MAILTO,
  PROFILE,
  SUGGESTION_CHIPS,
  getShuffledChips,
} from './constants'
import type { ChatMode } from './types'

const MODES: ChatMode[] = ['default', 'recruiter', 'interview']

describe('getShuffledChips', () => {
  it('is deterministic for a given mode and seed', () => {
    for (const mode of MODES) {
      expect(getShuffledChips(mode, 7)).toEqual(getShuffledChips(mode, 7))
    }
  })

  it('produces different orderings for different seeds', () => {
    const a = getShuffledChips('default', 1, 8)
    const b = getShuffledChips('default', 2, 8)
    expect(a).not.toEqual(b)
  })

  it('returns exactly the requested count', () => {
    expect(getShuffledChips('default', 3, 5)).toHaveLength(5)
    expect(getShuffledChips('recruiter', 3, 1)).toHaveLength(1)
    expect(getShuffledChips('interview', 3, 12)).toHaveLength(12)
  })

  it('defaults to five chips', () => {
    expect(getShuffledChips('default', 3)).toHaveLength(5)
  })

  it('never repeats a chip within one result', () => {
    for (const mode of MODES) {
      for (let seed = 0; seed < 25; seed++) {
        const chips = getShuffledChips(mode, seed, 8)
        expect(new Set(chips).size).toBe(chips.length)
      }
    }
  })

  it('only returns chips from the requested mode', () => {
    for (const mode of MODES) {
      const source = new Set(SUGGESTION_CHIPS[mode])
      for (const chip of getShuffledChips(mode, 11, 6)) {
        expect(source.has(chip)).toBe(true)
      }
    }
  })

  it('does not mutate the source chip list', () => {
    const before = [...SUGGESTION_CHIPS.default]
    getShuffledChips('default', 42, 5)
    expect(SUGGESTION_CHIPS.default).toEqual(before)
  })

  it('caps at the number of available chips', () => {
    const all = SUGGESTION_CHIPS.recruiter.length
    expect(getShuffledChips('recruiter', 5, all + 10)).toHaveLength(all)
  })
})

describe('suggestion chips content', () => {
  it('does not promise a hybrid search that the backend does not implement', () => {
    const everyChip = MODES.flatMap((mode) => SUGGESTION_CHIPS[mode])
    expect(everyChip.some((chip) => /hybrid search/i.test(chip))).toBe(false)
  })

  it('has no duplicate chips within a mode', () => {
    for (const mode of MODES) {
      const chips = SUGGESTION_CHIPS[mode]
      expect(new Set(chips).size).toBe(chips.length)
    }
  })
})

describe('PROFILE contact details', () => {
  it('uses the live LinkedIn vanity URL', () => {
    expect(PROFILE.linkedinUrl).toBe('https://www.linkedin.com/in/vishalkhandatascience/')
  })

  it('builds a mailto with a pre-filled subject and body', () => {
    expect(CONTACT_MAILTO.startsWith(`mailto:${PROFILE.email}?`)).toBe(true)
    const query = new URLSearchParams(CONTACT_MAILTO.split('?')[1])
    expect(query.get('subject')).toContain('Vishal Khan')
    expect(query.get('body')).toContain('Hi Vishal,')
  })
})
