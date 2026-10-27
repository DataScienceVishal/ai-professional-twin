import { describe, expect, it } from 'vitest'
import { SKILL_LEVELS, orderDetail } from './source-label'

describe('orderDetail', () => {
  it('moves a known trailing value to the end', () => {
    expect(orderDetail('Machine Learning - Telecom Churn Prediction', ['Machine Learning'])).toBe(
      'Telecom Churn Prediction - Machine Learning',
    )
  })

  it('leaves a detail that already ends with it alone', () => {
    expect(orderDetail('Telecom Churn Prediction - Machine Learning', ['Machine Learning'])).toBe(
      'Telecom Churn Prediction - Machine Learning',
    )
  })

  it('handles skill levels', () => {
    expect(orderDetail('advanced - Generative AI', SKILL_LEVELS)).toBe('Generative AI - advanced')
  })

  it('ignores an empty token', () => {
    expect(orderDetail(' - x', [''])).toBe(' - x')
  })
})
