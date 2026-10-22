import type { Entry } from './db'
export type DayGroup = { date: string; entries: Entry[]; expenseMinor: number; incomeMinor: number }
export function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const entry of entries) {
    let day = groups.get(entry.date)
    if (!day) { day = { date: entry.date, entries: [], expenseMinor: 0, incomeMinor: 0 }; groups.set(entry.date, day) }
    day.entries.push(entry)
    if (entry.type === 'expense') day.expenseMinor += entry.amountMinor
    else day.incomeMinor += entry.amountMinor
  }
  return [...groups.values()].sort((a,b) => b.date.localeCompare(a.date)).map(day => ({
    ...day, entries: [...day.entries].sort((a,b) => b.createdAt.localeCompare(a.createdAt))
  }))
}
