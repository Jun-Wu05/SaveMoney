import { describe, expect, it } from 'vitest'
import { LOTTERY_EXPENSE_ID, LOTTERY_INCOME_ID, lotteryTotals, lotteryHistory, effectiveLotteryBudget } from './lottery'
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

describe('lottery budget carry-forward',()=>{
  const budgets=[
    {month:'2026-05',categoryId:LOTTERY_EXPENSE_ID,amountMinor:100000},
    {month:'2026-07',categoryId:LOTTERY_EXPENSE_ID,amountMinor:80000},
    {month:'2026-09',categoryId:'food',amountMinor:12300},
  ]
  it('inherits latest earlier budget and preserves explicit overrides',()=>{
    expect(effectiveLotteryBudget(budgets,'2026-04')).toBeNull()
    expect(effectiveLotteryBudget(budgets,'2026-06')).toEqual({amountMinor:100000,inherited:true,sourceMonth:'2026-05'})
    expect(effectiveLotteryBudget(budgets,'2026-07')).toEqual({amountMinor:80000,inherited:false,sourceMonth:'2026-07'})
    expect(effectiveLotteryBudget(budgets,'2026-10')).toEqual({amountMinor:80000,inherited:true,sourceMonth:'2026-07'})
  })
  it('keeps gross expense independent from winnings',()=>{
    const result=lotteryTotals([row('a','expense',LOTTERY_EXPENSE_ID,50000),row('b','income',LOTTERY_INCOME_ID,30000)],'2026-10')
    expect(result.expenseMinor).toBe(50000)
  })
})
describe('lottery six-month history',()=>{
  it('includes cross-year months chronologically and totals independently',()=>{
    const result=lotteryHistory([row('a','expense',LOTTERY_EXPENSE_ID,2000,'2025-12-25'),row('b','income',LOTTERY_INCOME_ID,3000,'2026-01-06')],'2026-02')
    expect(result.map(x=>x.month)).toEqual(['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'])
    expect(result[3].netMinor).toBe(-2000)
    expect(result[4].netMinor).toBe(3000)
  })
})
