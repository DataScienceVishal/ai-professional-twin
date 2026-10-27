import type { Message } from './types'

/**
 * One real answer from the live assistant, shown before anyone types.
 *
 * Copied character for character from the live test on 12 Oct 2026 (probe
 * P09, General mode). The backend also returned career-gap, target-roles,
 * salary-expectations and sponsorship chips, which the answer does not
 * restate, so only the entry it does restate is shown.
 * `backend/tests/test_recorded_answer.py` checks that this quote and that
 * entry share three facts, not that their wording matches.
 */
export const EXHIBIT = {
  question: 'When is he available to start a new role?',
  recordedOn: '12 Oct 2026',
  message: {
    role: 'assistant',
    content:
      "Vishal's priority is a full-time permanent role starting **January 2027**, when he completes his **MSc in AI and Computer Science at Northeastern University London**. He is happy to interview and accept an offer well in advance of that date.\n\nIn the meantime he is available immediately for part-time work (up to **20 hours per week** during term time) and full-time during university holidays, and he is actively looking for internships or placement opportunities that fit alongside his studies.",
    sources: [{ source: 'career_qa', detail: 'availability', url: '' }],
  } satisfies Message,
}
