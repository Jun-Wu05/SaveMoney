import type { Entry } from './db'

export type DailyPoint = { day: number; amountMinor: number }
export type DailySummary = {
  points: DailyPoint[]
  totalMinor: number
  averageMinor: number
  peakDay: number | null
  peakMinor: number
  previousMinor: number
  differenceMinor: number
  percentChange: number | null
  comparedDays: number
  previousDays: number
}

export function dailySpendingSummary(entries: Entry[], month: string, today = new Date()): DailySummary {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(year, monthNumber, 0).getDate()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const comparedDays = month === currentMonth ? Math.min(today.getDate(), days) : days
  const prevDate = new Date(year, monthNumber - 2, 1)
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const previousDays = Math.min(comparedDays, new Date(year, monthNumber - 1, 0).getDate())
  const points = Array.from({ length: days }, (_, i) => ({ day: i + 1, amountMinor: 0 }))
  let previousMinor = 0
  for (const entry of entries) {
    if (entry.type !== 'expense') continue
    const entryMonth = entry.date.slice(0, 7)
    const day = Number(entry.date.slice(8, 10))
    if (entryMonth === month && day >= 1 && day <= days && day <= comparedDays) points[day - 1].amountMinor += entry.amountMinor
    if (entryMonth === previousMonth && day >= 1 && day <= previousDays) previousMinor += entry.amountMinor
  }
  const totalMinor = points.reduce((sum, p) => sum + p.amountMinor, 0)
  const peak = points.reduce<DailyPoint | null>((best, p) => p.amountMinor > (best?.amountMinor ?? 0) ? p : best, null)
  return {
    points, totalMinor, averageMinor: Math.round(totalMinor / comparedDays),
    peakDay: peak?.day ?? null, peakMinor: peak?.amountMinor ?? 0,
    previousMinor, differenceMinor: totalMinor - previousMinor,
    percentChange: previousMinor > 0 ? (totalMinor - previousMinor) / previousMinor * 100 : null,
    comparedDays, previousDays,
  }
}
