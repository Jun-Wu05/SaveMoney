import { db, type Entry, type Category } from './db'

export const LOTTERY_EXPENSE_ID = 'lottery-expense'
export const LOTTERY_INCOME_ID = 'lottery-income'

/** Explicit opt-in; does not change any existing categories or entries. */
export async function ensureLotteryCategories() {
  await db.transaction('rw', db.categories, async () => {
    const existing = await db.categories.toArray()
    const definitions = [
      { id: LOTTERY_EXPENSE_ID, type: 'expense' as const, name: '彩票支出', icon: 'ticket' },
      { id: LOTTERY_INCOME_ID, type: 'income' as const, name: '彩票中奖', icon: 'gift' },
    ]
    for (const definition of definitions) {
      if (existing.some(c => c.id === definition.id)) continue
      const nameTaken = existing.some(c => c.type === definition.type && c.name === definition.name)
      const name = nameTaken ? `${definition.name}（专项）` : definition.name
      const order = Math.max(0, ...existing.filter(c => c.type === definition.type).map(c => c.sortOrder)) + 1
      const category: Category = { ...definition, name, sortOrder: order }
      await db.categories.add(category)
      existing.push(category)
    }
  })
}

export function lotteryTotals(entries: Entry[], month: string) {
  const records = entries.filter(e => e.date.startsWith(month) && (
    (e.type === 'expense' && e.categoryId === LOTTERY_EXPENSE_ID) ||
    (e.type === 'income' && e.categoryId === LOTTERY_INCOME_ID)
  ))
  const expenseMinor = records.filter(e => e.type === 'expense').reduce((n, e) => n + e.amountMinor, 0)
  const incomeMinor = records.filter(e => e.type === 'income').reduce((n, e) => n + e.amountMinor, 0)
  return { records: records.sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), expenseMinor, incomeMinor, netMinor: incomeMinor - expenseMinor }
}
