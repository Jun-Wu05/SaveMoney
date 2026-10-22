import type { Entry } from './db'

export type CalendarDay = { date: string; day: number; expenseMinor: number; incomeMinor: number; count: number }
export function monthDays(month: string): CalendarDay[] {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) throw new Error('月份格式不正确')
  const year = Number(match[1])
  const m = Number(match[2])
  const end = new Date(year, m, 0).getDate()
  return Array.from({ length: end }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`,
    day: i + 1, expenseMinor: 0, incomeMinor: 0, count: 0,
  }))
}

export function makeCalendar(month: string, entries: Entry[]) {
  const days = monthDays(month)
  const index = new Map(days.map(d => [d.date, d]))
  for (const e of entries) {
    const day = index.get(e.date)
    if (!day) continue
    day.count++
    if (e.type === 'expense') day.expenseMinor += e.amountMinor
    else day.incomeMinor += e.amountMinor
  }
  const year = Number(month.slice(0,4))
  const m = Number(month.slice(5))
  const firstWeekday = (new Date(year, m - 1, 1).getDay() + 6) % 7
  return { days, firstWeekday }
}
