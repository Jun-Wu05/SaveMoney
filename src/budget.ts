import { db } from './db'
import { parseAmountMinor } from './money'

export function validateMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

export function budgetProgress(spentMinor: number, budgetMinor: number) {
  if (budgetMinor <= 0) throw new Error('预算必须大于零')
  const remainingMinor = budgetMinor - spentMinor
  return { remainingMinor, percent: Math.round(spentMinor / budgetMinor * 100), exceeded: spentMinor > budgetMinor }
}

export async function setMonthlyBudget(month: string, rawAmount: string): Promise<void> {
  if (!validateMonth(month)) throw new Error('月份格式不正确')
  const amountMinor = parseAmountMinor(rawAmount)
  if (amountMinor === null) throw new Error('请输入大于零的预算金额，最多两位小数')
  await db.budgets.put({ month, amountMinor })
}

export async function removeMonthlyBudget(month: string): Promise<void> {
  if (!validateMonth(month)) throw new Error('月份格式不正确')
  await db.budgets.delete(month)
}
