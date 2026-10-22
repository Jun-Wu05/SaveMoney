import { db, type Category, type Entry } from './db'
import type { ImportedBill } from './csvImport'

export function billKey(bill: ImportedBill): string {
  return JSON.stringify([bill.date,bill.type,bill.amountMinor,bill.category.trim(),bill.note.trim()])
}
export function existingBillKeys(entries: Entry[], categories: Category[]): Set<string> {
  const names = new Map(categories.map(c=>[c.id,c.name]))
  return new Set(entries.map(e=>billKey({date:e.date,type:e.type,amountMinor:e.amountMinor,category:names.get(e.categoryId)??'',note:e.note})))
}
export function previewImport(bills: ImportedBill[], entries: Entry[], categories: Category[]) {
  const keys = existingBillKeys(entries,categories)
  const fresh: ImportedBill[] = []
  let duplicates = 0
  for (const bill of bills) {
    const key = billKey(bill)
    if (keys.has(key)) duplicates++
    else { keys.add(key); fresh.push(bill) }
  }
  return { fresh, duplicates }
}
export async function importCsvBills(bills: ImportedBill[]): Promise<{ added: number; skipped: number }> {
  if (bills.length > 100_000) throw new Error('导入数量过多')
  return db.transaction('rw',db.entries,db.categories,async()=>{
    const [entries,categories] = await Promise.all([db.entries.toArray(),db.categories.toArray()])
    const { fresh, duplicates } = previewImport(bills,entries,categories)
    const categoryIndex = new Map(categories.map(c=>[JSON.stringify([c.type,c.name]),c.id]))
    const timestamp = new Date().toISOString()
    const createdCategories: Category[] = []
    const newEntries: Entry[] = []
    for (const bill of fresh) {
      const key = JSON.stringify([bill.type,bill.category])
      let categoryId = categoryIndex.get(key)
      if (!categoryId) {
        categoryId = crypto.randomUUID()
        categoryIndex.set(key,categoryId)
        createdCategories.push({id:categoryId,name:bill.category,type:bill.type,icon:'ellipsis',sortOrder:categories.filter(c=>c.type===bill.type).length+createdCategories.filter(c=>c.type===bill.type).length+1})
      }
      newEntries.push({id:crypto.randomUUID(),type:bill.type,amountMinor:bill.amountMinor,categoryId,date:bill.date,note:bill.note,createdAt:timestamp,updatedAt:timestamp})
    }
    if (createdCategories.length) await db.categories.bulkAdd(createdCategories)
    if (newEntries.length) await db.entries.bulkAdd(newEntries)
    return {added:newEntries.length,skipped:duplicates}
  })
}
