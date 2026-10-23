import type { Entry, Category, TransactionType } from './db'
export type LedgerFilter = { keyword: string; type: TransactionType | 'all' | readonly TransactionType[]; categoryId?: string; categoryIds?: readonly string[]; month: string | null }
export function filterEntries(entries: Entry[], categories: Category[], filter: LedgerFilter) {
  const q = filter.keyword.trim().toLocaleLowerCase()
  const names = new Map(categories.map(c => [c.id, c.name.toLocaleLowerCase()]))
  return entries.filter(e => (!filter.month || e.date.startsWith(filter.month)) &&
    (filter.type === 'all' || (Array.isArray(filter.type) ? filter.type.includes(e.type) : e.type === filter.type)) &&
    (!filter.categoryId || e.categoryId === filter.categoryId) &&
    (!filter.categoryIds?.length || filter.categoryIds.includes(e.categoryId)) &&
    (!q || e.note.toLocaleLowerCase().includes(q) || (names.get(e.categoryId) ?? '').includes(q)))
}
