import { describe, expect, it } from 'vitest'
import { monthlyExpenseTrend, spendingInsights } from './insights'
import type { Entry, Category } from './db'
const make = (id: string, date: string, amountMinor: number, type: 'expense'|'income' = 'expense', categoryId='food'): Entry =>
  ({ id, date, amountMinor, type, categoryId, note:'', createdAt:date+'T00:00:00Z', updatedAt:date+'T00:00:00Z' })
const categories: Category[] = [{id:'food',name:'餐饮',type:'expense',icon:'utensils',sortOrder:0}]
describe('six-month trend', () => {
  it('includes empty months and filters income', () => {
    const trend = monthlyExpenseTrend([make('a','2026-09-01',2000),make('b','2026-10-01',9000,'income')], '2026-10')
    expect(trend).toHaveLength(6)
    expect(trend.map(x=>x.month)).toEqual(['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'])
    expect(trend[4].expenseMinor).toBe(2000)
    expect(trend[5].expenseMinor).toBe(0)
  })
  it('crosses year boundaries', () => expect(monthlyExpenseTrend([], '2026-02')[0].month).toBe('2025-09'))
})
describe('local spending insights', () => {
  it('handles empty month safely', () => expect(spendingInsights([], categories,'2026-10')).toHaveLength(1))
  it('shows category, previous month and budget', () => {
    const insights = spendingInsights([make('a','2026-10-02',3000),make('b','2026-09-02',1000)],categories,'2026-10',2000)
    expect(insights.join(' ')).toContain('餐饮')
    expect(insights.join(' ')).toContain('比上个月多')
    expect(insights.join(' ')).toContain('超过预算')
  })
})
