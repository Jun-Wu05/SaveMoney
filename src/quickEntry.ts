import type { Entry, Category, TransactionType } from './db'
/** Keep entry editor order identical to Settings → Category Manager. */
export function preferredCategories(_entries: Entry[], categories: Category[], type: TransactionType): Category[] {
  return [...categories].filter(c => c.type === type)
    .sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}
export function lastEntryOfType(entries: Entry[], type: TransactionType): Entry | undefined {
 return [...entries].filter(e=>e.type===type).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0]
}
