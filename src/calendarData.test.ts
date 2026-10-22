import { describe, expect, it } from 'vitest'
import { makeCalendar, monthDays } from './calendarData'
import type { Entry } from './db'
const entry = (id: string, date: string, type: Entry['type'], amountMinor: number): Entry => ({
  id, date, type, amountMinor, categoryId: 'food', note:'', createdAt:date+'T12:00:00Z', updatedAt:date+'T12:00:00Z',
})
describe('calendar math', () => {
  it('handles leap year and Monday-first offset', () => {
    const result = makeCalendar('2024-02', [])
    expect(result.days).toHaveLength(29)
    expect(result.firstWeekday).toBe(3)
    expect(result.days.at(-1)?.date).toBe('2024-02-29')
  })
  it('aggregates income and expense independently', () => {
    const result=makeCalendar('2026-10',[entry('a','2026-10-02','expense',1250),entry('b','2026-10-02','income',3000),entry('c','2026-09-02','expense',900)])
    expect(result.days[1]).toMatchObject({expenseMinor:1250,incomeMinor:3000,count:2})
  })
  it('rejects invalid month',()=>expect(()=>monthDays('2026-13')).toThrow())
})
