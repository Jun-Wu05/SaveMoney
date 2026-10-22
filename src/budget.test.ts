import { describe, it, expect } from 'vitest'
import { budgetProgress, validateMonth } from './budget'

describe('monthly budgets', () => {
  it('validates month keys', () => {
    expect(validateMonth('2026-09')).toBe(true)
    expect(validateMonth('2026-13')).toBe(false)
    expect(validateMonth('2026-9')).toBe(false)
  })
  it('calculates remaining money and percentage', () => {
    expect(budgetProgress(185000, 300000)).toEqual({remainingMinor:115000,percent:62,exceeded:false})
    expect(budgetProgress(320000, 300000)).toEqual({remainingMinor:-20000,percent:107,exceeded:true})
  })
})
