import type { Entry } from './db'

export type DateRange = { start: string; end: string }
export type RangePoint = { date: string; amountMinor: number }
export type RangeSummary = {
  expenses: number
  income: number
  days: number
  dailyAverage: number
  peakDate: string | null
  peakMinor: number
  points: RangePoint[]
  categories: { id: string; amount: number }[]
  count: number
}

// Strict YYYY-MM-DD validation avoids timezone offsets and invalid native-date input values.
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d
}
export function validRange(range: DateRange): boolean {
  return validDate(range.start) && validDate(range.end) && range.start <= range.end
}
export function isoLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function offsetDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}
export function dateRangeSummary(entries: Entry[], range: DateRange): RangeSummary {
  if (!validRange(range)) throw new Error('日期区间无效')
  const start = new Date(Number(range.start.slice(0,4)), Number(range.start.slice(5,7))-1, Number(range.start.slice(8,10)))
  const end = new Date(Number(range.end.slice(0,4)), Number(range.end.slice(5,7))-1, Number(range.end.slice(8,10)))
  const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1
  const perDay = new Map<string, number>()
  const categories = new Map<string, number>()
  let expenses = 0, income = 0, count = 0
  for (const e of entries) {
    if (e.date < range.start || e.date > range.end) continue
    count++
    if (e.type === 'income') income += e.amountMinor
    else {
      expenses += e.amountMinor
      perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.amountMinor)
      categories.set(e.categoryId, (categories.get(e.categoryId) ?? 0) + e.amountMinor)
    }
  }
  const points = Array.from({length: days}, (_, i) => {
    const date = isoLocal(offsetDays(start, i))
    return {date, amountMinor: perDay.get(date) ?? 0}
  })
  const peak = points.reduce<RangePoint | null>((best, p) => p.amountMinor > (best?.amountMinor ?? 0) ? p : best, null)
  return {expenses, income, days, dailyAverage: Math.round(expenses / days),
    peakDate: peak?.date ?? null, peakMinor: peak?.amountMinor ?? 0, points,
    categories: [...categories].map(([id, amount]) => ({id, amount})).sort((a,b)=>b.amount-a.amount), count}
}
