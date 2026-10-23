import { describe, expect, it } from 'vitest'
import { makeCalendar, monthDays, calendarNetMinor } from './calendarData'
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
  it('shows net income minus expense for the same day', () => {
    const days=makeCalendar('2026-10', [
      entry('a','2026-10-23','expense',1300),
      entry('b','2026-10-23','expense',5200),
      entry('c','2026-10-23','expense',13000),
      entry('d','2026-10-23','expense',18100),
      entry('e','2026-10-23','income',27600),
    ]).days
    expect(days[22]).toMatchObject({ expenseMinor:37600, incomeMinor:27600, count:5 })
    expect(calendarNetMinor(days[22])).toBe(-10000)
  })
  it('handles positive, zero, and empty net consistently', () => {
    expect(calendarNetMinor({incomeMinor:5000,expenseMinor:2000})).toBe(3000)
    expect(calendarNetMinor({incomeMinor:3000,expenseMinor:3000})).toBe(0)
    expect(calendarNetMinor({incomeMinor:0,expenseMinor:0})).toBe(0)
  })
  it('rejects invalid month',()=>expect(()=>monthDays('2026-13')).toThrow())
})
