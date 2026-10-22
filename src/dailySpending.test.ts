import { describe, expect, it } from 'vitest'
import { dailySpendingSummary } from './dailySpending'
import type { Entry } from './db'

function expense(date: string, amountMinor: number, type: Entry['type'] = 'expense'): Entry {
  return { id: date + amountMinor, date, amountMinor, type, categoryId: 'food', note: '', createdAt: '', updatedAt: '' }
}
describe('dailySpendingSummary', () => {
  it('compares current month only through today and ignores income and future entries', () => {
    const entries = [
      expense('2026-10-01', 1000), expense('2026-10-10', 2000), expense('2026-10-25', 9999),
      expense('2026-09-01', 500), expense('2026-09-10', 500),
      expense('2026-10-10', 10000, 'income'),
    ]
    const result = dailySpendingSummary(entries, '2026-10', new Date(2026, 9, 22))
    expect(result.totalMinor).toBe(3000)
    expect(result.previousMinor).toBe(1000)
    expect(result.peakDay).toBe(10)
    expect(result.averageMinor).toBe(Math.round(3000 / 22))
    expect(result.percentChange).toBe(200)
    expect(result.points).toHaveLength(31)
  })
  it('uses full selected historical month and handles zero previous month', () => {
    const result = dailySpendingSummary([expense('2026-02-28', 1234)], '2026-02', new Date(2026, 9, 22))
    expect(result.points).toHaveLength(28)
    expect(result.comparedDays).toBe(28)
    expect(result.totalMinor).toBe(1234)
    expect(result.percentChange).toBeNull()
  })
  it('handles a month without spending', () => {
    const result = dailySpendingSummary([], '2026-10', new Date(2026, 9, 22))
    expect(result.peakDay).toBeNull()
    expect(result.averageMinor).toBe(0)
  })
})
