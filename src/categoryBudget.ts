import { db } from './db'
import { parseAmountMinor } from './money'
import { validateMonth } from './budget'

export function categoryBudgetId(month: string, categoryId: string) {
  return `${month}:${categoryId}`
}
export async function setCategoryBudget(month: string, categoryId: string, rawAmount: string) {
  if (!validateMonth(month)) throw new Error('月份格式不正确')
  const category = await db.categories.get(categoryId)
  if (!category || category.type !== 'expense') throw new Error('请选择有效的支出分类')
  const amountMinor = parseAmountMinor(rawAmount)
  if (amountMinor === null) throw new Error('请输入大于零的预算金额，最多两位小数')
  await db.categoryBudgets.put({ id: categoryBudgetId(month, categoryId), month, categoryId, amountMinor })
}
export async function removeCategoryBudget(month: string, categoryId: string) {
  if (!validateMonth(month)) throw new Error('月份格式不正确')
  await db.categoryBudgets.delete(categoryBudgetId(month, categoryId))
}
