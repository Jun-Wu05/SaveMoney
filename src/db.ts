import Dexie, { type EntityTable } from 'dexie'

export type TransactionType = 'expense' | 'income'

export interface Entry {
  id: string
  type: TransactionType
  amountMinor: number
  categoryId: string
  date: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string
  sortOrder: number
}

export interface GoodCategory { id: string; name: string; parentId: string | null; sortOrder: number }
export interface Good {
  id: string
  name: string
  categoryId: string
  brand: string
  date: string
  priceMinor: number | null
  highlights: string
  review: string
  rating: 'recommend' | 'normal' | 'avoid'
  image: string
  consumptionGroupId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ConsumptionGroup { id: string; name: string; createdAt: string }
export interface GoodPurchase { id: string; goodId: string; date: string; priceMinor: number | null; quantity: number; note: string; createdAt: string }

export interface Budget { month: string; amountMinor: number }
export interface CategoryBudget { id: string; month: string; categoryId: string; amountMinor: number }

class LedgerDb extends Dexie {
  entries!: EntityTable<Entry, 'id'>
  categories!: EntityTable<Category, 'id'>
  budgets!: EntityTable<Budget, 'month'>
  categoryBudgets!: EntityTable<CategoryBudget, 'id'>
  goodCategories!: EntityTable<GoodCategory, 'id'>
  goods!: EntityTable<Good, 'id'>
  consumptionGroups!: EntityTable<ConsumptionGroup, 'id'>
  goodPurchases!: EntityTable<GoodPurchase, 'id'>

  constructor() {
    super('SaveMoneyLedger')
    this.version(1).stores({
      entries: 'id, date, type, categoryId',
      categories: 'id, type, sortOrder',
    })
    this.version(2).stores({
      entries: 'id, date, type, categoryId',
      categories: 'id, type, sortOrder',
      budgets: 'month',
    })
    this.version(3).stores({
      entries: 'id, date, type, categoryId',
      categories: 'id, type, sortOrder',
      budgets: 'month',
      categoryBudgets: 'id, month, categoryId',
    })
    this.version(4).stores({
      entries: 'id, date, type, categoryId',
      categories: 'id, type, sortOrder',
      budgets: 'month',
      categoryBudgets: 'id, month, categoryId',
      goodCategories: 'id, parentId, sortOrder',
      goods: 'id, categoryId, date, rating',
    })
    this.version(5).stores({
      entries: 'id, date, type, categoryId',
      categories: 'id, type, sortOrder',
      budgets: 'month',
      categoryBudgets: 'id, month, categoryId',
      goodCategories: 'id, parentId, sortOrder',
      goods: 'id, categoryId, date, rating, consumptionGroupId',
      consumptionGroups: 'id, name',
      goodPurchases: 'id, goodId, date',
    }).upgrade(async tx => {
      const goods = await tx.table('goods').toArray() as Good[]
      const purchases = tx.table('goodPurchases')
      for (const good of goods) {
        await purchases.add({id: 'initial-'+good.id, goodId:good.id, date:good.date, priceMinor:good.priceMinor, quantity:1, note:'首次购买（从原好物记录迁移）', createdAt:good.createdAt})
      }
    })
  }
}

export const db = new LedgerDb()

export const initialCategories: Category[] = [
  { id: 'food', name: '餐饮', type: 'expense', icon: 'utensils', sortOrder: 1 },
  { id: 'shopping', name: '购物', type: 'expense', icon: 'shopping-bag', sortOrder: 2 },
  { id: 'transport', name: '交通', type: 'expense', icon: 'bus', sortOrder: 3 },
  { id: 'home', name: '居住', type: 'expense', icon: 'house', sortOrder: 4 },
  { id: 'fun', name: '娱乐', type: 'expense', icon: 'film', sortOrder: 5 },
  { id: 'health', name: '健康', type: 'expense', icon: 'heart', sortOrder: 6 },
  { id: 'study', name: '学习', type: 'expense', icon: 'book', sortOrder: 7 },
  { id: 'other-expense', name: '其他', type: 'expense', icon: 'ellipsis', sortOrder: 8 },
  { id: 'salary', name: '工资', type: 'income', icon: 'wallet', sortOrder: 1 },
  { id: 'bonus', name: '奖金', type: 'income', icon: 'gift', sortOrder: 2 },
  { id: 'side-job', name: '兼职', type: 'income', icon: 'briefcase', sortOrder: 3 },
  { id: 'other-income', name: '其他收入', type: 'income', icon: 'ellipsis', sortOrder: 4 },
]

export async function initializeCategories() {
  await db.transaction('rw', db.categories, async () => {
    const count = await db.categories.count()
    if (count === 0) await db.categories.bulkAdd(initialCategories)
  })
}

export async function saveEntry(entry: Entry) {
  await db.entries.put(entry)
}

export async function removeEntry(id: string) {
  await db.entries.delete(id)
}
