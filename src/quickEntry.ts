import type { Entry, Category, TransactionType } from './db'
export function preferredCategories(entries: Entry[], categories: Category[], type: TransactionType): Category[] {
 const frequency = new Map<string,number>()
 const recent=[...entries].filter(e=>e.type===type).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,30)
 for(const e of recent) frequency.set(e.categoryId,(frequency.get(e.categoryId)||0)+1)
 return [...categories].filter(c=>c.type===type).sort((a,b)=>(frequency.get(b.id)||0)-(frequency.get(a.id)||0)||a.sortOrder-b.sortOrder)
}
export function lastEntryOfType(entries: Entry[], type: TransactionType): Entry | undefined {
 return [...entries].filter(e=>e.type===type).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0]
}
