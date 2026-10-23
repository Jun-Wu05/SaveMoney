import { describe, expect, it } from 'vitest'
import { LOTTERY_EXPENSE_ID, LOTTERY_INCOME_ID, lotteryTotals } from './lottery'
import type { Entry } from './db'
function row(id: string, type: Entry['type'], categoryId: string, amountMinor: number, date = '2026-10-23'): Entry {
  return { id, type, categoryId, amountMinor, date, note:'', createdAt:date, updatedAt:date }
}
describe('lottery ledger calculations', () => {
  const entries = [
    row('a','expense',LOTTERY_EXPENSE_ID,70000),
    row('b','income',LOTTERY_INCOME_ID,65000),
    row('c','expense','food',20000),
    row('d','expense',LOTTERY_EXPENSE_ID,10000,'2026-09-03'),
    row('e','income','salary',100000),
  ]
  it('shows expense, winnings, and true net independently', () => {
    const result=lotteryTotals(entries,'2026-10')
    expect(result.expenseMinor).toBe(70000)
    expect(result.incomeMinor).toBe(65000)
    expect(result.netMinor).toBe(-5000)
    expect(result.records.map(x=>x.id)).toEqual(['a','b'])
  })
  it('limits month, avoids cross-category totals', () => {
    const result=lotteryTotals(entries,'2026-09')
    expect(result.expenseMinor).toBe(10000)
    expect(result.incomeMinor).toBe(0)
  })
  it('does not offset spending when there is a large win', () => {
    const result=lotteryTotals([row('w','income',LOTTERY_INCOME_ID,500000),row('e','expense',LOTTERY_EXPENSE_ID,100000)],'2026-10')
    expect(result.expenseMinor).toBe(100000)
    expect(result.netMinor).toBe(400000)
  })
})
