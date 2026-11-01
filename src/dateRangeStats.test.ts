import { describe, expect, it } from 'vitest'
import { dateRangeSummary, validRange } from './dateRangeStats'
import type { Entry } from './db'

const bill = (date: string, amountMinor: number, type: 'income'|'expense'='expense', categoryId='food') =>
  ({date, amountMinor, type, categoryId} as Entry)

describe('custom range statistics', () => {
  it('includes both boundaries and months and preserves minor units', () => {
    const summary = dateRangeSummary([
      bill('2026-10-09',9900), bill('2026-10-10',1000), bill('2026-11-10',2000),
      bill('2026-11-11',4000), bill('2026-10-15',5000,'income')
    ], {start:'2026-10-10',end:'2026-11-10'})
    expect(summary.expenses).toBe(3000)
    expect(summary.income).toBe(5000)
    expect(summary.days).toBe(32)
    expect(summary.points).toHaveLength(32)
    expect(summary.categories).toEqual([{id:'food',amount:3000}])
  })
  it('works across years and leap days', () => {
    expect(dateRangeSummary([bill('2024-02-29',300)],{start:'2024-02-28',end:'2024-03-01'}).days).toBe(3)
    expect(dateRangeSummary([],{start:'2026-12-31',end:'2027-01-01'}).days).toBe(2)
  })
  it('rejects invalid and reversed dates', () => {
    expect(validRange({start:'2026-02-30',end:'2026-03-01'})).toBe(false)
    expect(validRange({start:'2026-11-10',end:'2026-10-10'})).toBe(false)
    expect(() => dateRangeSummary([],{start:'2026-11-10',end:'2026-10-10'})).toThrow()
  })
  it('reports zero totals without dividing by zero', () => {
    const summary=dateRangeSummary([], {start:'2026-10-01',end:'2026-10-01'})
    expect(summary.dailyAverage).toBe(0)
    expect(summary.peakDate).toBeNull()
  })
})
