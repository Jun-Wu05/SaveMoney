import type { Entry, Category } from './db'
import { money } from './money'

export type MonthlyPoint = { month: string; expenseMinor: number }
function monthOffset(month: string, offset: number): string {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(0); d.setFullYear(year, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthlyExpenseTrend(entries: Entry[], selectedMonth: string): MonthlyPoint[] {
  const months = Array.from({ length: 6 }, (_, i) => monthOffset(selectedMonth, i - 5))
  const result = new Map(months.map(month => [month, 0]))
  for (const e of entries) {
    if (e.type === 'expense') {
      const key = e.date.slice(0, 7)
      if (result.has(key)) result.set(key, result.get(key)! + e.amountMinor)
    }
  }
  return months.map(month => ({ month, expenseMinor: result.get(month)! }))
}

export function spendingInsights(entries: Entry[], categories: Category[], selectedMonth: string, budgetMinor?: number): string[] {
  const current = entries.filter(e => e.type === 'expense' && e.date.startsWith(selectedMonth))
  const spent = current.reduce((sum, e) => sum + e.amountMinor, 0)
  if (!current.length) return ['这个月还没有支出记录，记下第一笔后就能看到消费洞察。']
  const totals = new Map<string, number>()
  for (const e of current) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amountMinor)
  const top = [...totals].sort((a,b) => b[1] - a[1])[0]
  const name = categories.find(c => c.id === top[0])?.name ?? '其他'
  const messages = [`本月支出最多的是「${name}」，共 ¥${money(top[1])}，占总支出的 ${(top[1] / spent * 100).toFixed(1)}%。`]
  const previousMonth = monthOffset(selectedMonth, -1)
  const previous = entries.filter(e => e.type === 'expense' && e.date.startsWith(previousMonth))
    .reduce((sum,e) => sum + e.amountMinor,0)
  if (previous > 0) {
    const difference = spent - previous
    if (difference === 0) messages.push('当前记录的支出总额与上个月相同。')
    else messages.push(`截至目前，本月支出比上个月${difference > 0 ? '多' : '少'} ¥${money(Math.abs(difference))}。`)
  } else messages.push('上个月暂无支出记录，暂时无法进行环比分析。')
  if (budgetMinor && budgetMinor > 0) {
    if (spent > budgetMinor) messages.push(`本月已经超过预算 ¥${money(spent - budgetMinor)}。`)
    else messages.push(`本月预算还剩 ¥${money(budgetMinor - spent)}。`)
  }
  return messages
}
