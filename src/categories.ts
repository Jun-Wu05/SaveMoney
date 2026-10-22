import { db, type Category, type TransactionType } from './db'

export function normalizeCategoryName(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 20) throw new Error('分类名称需为 1–20 个字符')
  return trimmed
}

export function hasDuplicateCategoryName(categories: Category[], type: TransactionType, name: string, exceptId?: string) {
  return categories.some(category => category.type === type && category.id !== exceptId && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())
}

export async function addCategory(type: TransactionType, rawName: string, icon = 'ellipsis'): Promise<string> {
  const name = normalizeCategoryName(rawName)
  return await db.transaction('rw', db.categories, async () => {
    const categories = await db.categories.toArray()
    if (hasDuplicateCategoryName(categories, type, name)) throw new Error('该分类名称已存在')
    const order = Math.max(0, ...categories.filter(c => c.type === type).map(c => c.sortOrder)) + 1
    const id = crypto.randomUUID()
    await db.categories.add({ id, type, name, icon, sortOrder: order })
    return id
  })
}

export async function renameCategory(id: string, rawName: string): Promise<void> {
  const name = normalizeCategoryName(rawName)
  await db.transaction('rw', db.categories, async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('分类不存在，请刷新后重试')
    const categories = await db.categories.toArray()
    if (hasDuplicateCategoryName(categories, category.type, name, id)) throw new Error('该分类名称已存在')
    await db.categories.update(id, { name })
  })
}

export async function deleteUnusedCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.entries, db.categoryBudgets, async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('分类不存在')
    const inUse = await db.entries.where('categoryId').equals(id).count()
    if (inUse) throw new Error('该分类已有账单，请先修改相关账单的分类')
    const count = await db.categories.where('type').equals(category.type).count()
    if (count <= 1) throw new Error('每种收支类型至少保留一个分类')
    await db.categoryBudgets.where('categoryId').equals(id).delete()
    await db.categories.delete(id)
  })
}

export async function updateCategoryDetails(id: string, rawName: string, icon: string): Promise<void> {
  const name = normalizeCategoryName(rawName)
  if (!/^[a-z][a-z0-9-]{0,49}$/.test(icon)) throw new Error('分类图标无效')
  await db.transaction('rw', db.categories, async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('分类不存在')
    const categories = await db.categories.toArray()
    if (hasDuplicateCategoryName(categories, category.type, name, id)) throw new Error('该分类名称已存在')
    await db.categories.update(id, { name, icon })
  })
}
