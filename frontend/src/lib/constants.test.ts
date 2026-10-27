import { describe, expect, it } from 'vitest'
import {
  CONTACT_MAILTO,
  FULL_TIME_LABEL,
  INTERVIEW_STARTERS,
  PROFILE,
  RECRUITER_ACTIONS,
  ROLE_LINE,
  SHEET_FACTS,
  SUGGESTION_CHIPS,
  getLayerSuggestions,
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

describe('getLayerSuggestions', () => {
  it('shows the curated recruiter actions before the first question', () => {
    expect(getLayerSuggestions('recruiter', 1)).toEqual(RECRUITER_ACTIONS)
  })

  it('shows all nine interview starters in their old order before the first question', () => {
    const starters = getLayerSuggestions('interview', 1)
    expect(starters).toHaveLength(9)
    expect(starters).toEqual(INTERVIEW_STARTERS)
  })

  it('keeps the old interview categories in order, three questions each', () => {
    expect(getLayerSuggestions('interview', 1).map((s) => s.group)).toEqual(
      ['RAG & Retrieval', 'System Design', 'ML & AI'].flatMap((group) => [group, group, group]),
    )
  })

  it('falls back to shuffled chips once a conversation has started', () => {
    expect(getLayerSuggestions('recruiter', 3).map((s) => s.message)).toEqual(
      getShuffledChips('recruiter', 3, 5),
    )
  })

  it('shuffles the interview layer too once a conversation has started', () => {
    expect(getLayerSuggestions('interview', 3).map((s) => s.message)).toEqual(
      getShuffledChips('interview', 3, 5),
    )
  })

  it('always shuffles on the general layer', () => {
    expect(getLayerSuggestions('default', 1).map((s) => s.label)).toEqual(getShuffledChips('default', 1, 5))
  })

  it('applies count only to the shuffled chips', () => {
    expect(getLayerSuggestions('recruiter', 1, 2)).toEqual(RECRUITER_ACTIONS)
    expect(getLayerSuggestions('interview', 1, 2)).toEqual(INTERVIEW_STARTERS)
    expect(getLayerSuggestions('recruiter', 3, 2)).toHaveLength(2)
  })
})

describe('title panel copy', () => {
  const copy = [
    ROLE_LINE,
    FULL_TIME_LABEL,
    ...SHEET_FACTS.flatMap((f) => [f.label, f.value]),
    ...RECRUITER_ACTIONS.map((a) => a.label),
  ]

  it('uses none of the dash characters the writing rules ban', () => {
    for (const text of copy) expect(text).not.toMatch(/[\u2013\u2014\u2015]/)
  })

  it('carries the approved role and availability lines', () => {
    expect(ROLE_LINE).toBe('Seeking AI engineer roles · four years in data')
    expect(SHEET_FACTS.find((f) => f.label === 'Available')?.value).toBe(
      'Full-time from January 2027 · part-time and internships now',
    )
  })
})
