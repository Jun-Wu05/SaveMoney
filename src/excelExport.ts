import type { Category, Entry } from './db'
import { db } from './db'

export type ExcelCell = string | number
export type MonthlySheet = { sheet: string; data: ExcelCell[][]; columns: { width: number }[]; stickyRowsCount: number }
const columns = [{ width: 15 }, { width: 12 }, { width: 18 }, { width: 34 }, { width: 17 }, { width: 17 }, { width: 17 }]
const headers = ['日期', '类型', '分类', '备注', '收入（元）', '支出（元）', '结余（元）']

// Spreadsheet applications must treat user-entered notes as text, never formulas.
export function safeSpreadsheetText(input: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(input) ? "'" + input : input
}

export function buildMonthlySheets(entries: Entry[], categories: Category[]): MonthlySheet[] {
  const names = new Map(categories.map(category => [category.id, category.name]))
  const months = new Map<string, Entry[]>()
  for (const entry of entries) {
    const month = entry.date.slice(0, 7)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('发现日期格式不正确的账单')
    if (!months.has(month)) months.set(month, [])
    months.get(month)!.push(entry)
  }

  const summary: ExcelCell[][] = [['月份', '收入（元）', '支出（元）', '结余（元）', '记录数']]
  let allIncome = 0
  let allExpense = 0
  const sheets: MonthlySheet[] = []
  for (const month of [...months.keys()].sort().reverse()) {
    const monthEntries = months.get(month)!.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    const rows: ExcelCell[][] = [headers]
    let incomeMinor = 0
    let expenseMinor = 0
    for (const entry of monthEntries) {
      const amount = entry.amountMinor / 100
      if (entry.type === 'income') incomeMinor += entry.amountMinor
      else expenseMinor += entry.amountMinor
      rows.push([
        entry.date, entry.type === 'income' ? '收入' : '支出',
        safeSpreadsheetText(names.get(entry.categoryId) ?? '其他'),
        safeSpreadsheetText(entry.note),
        entry.type === 'income' ? amount : 0,
        entry.type === 'expense' ? amount : 0,
        entry.type === 'income' ? amount : -amount,
      ])
    }
    rows.push(['月度合计', '', '', '', incomeMinor / 100, expenseMinor / 100, (incomeMinor - expenseMinor) / 100])
    summary.push([month, incomeMinor / 100, expenseMinor / 100, (incomeMinor - expenseMinor) / 100, monthEntries.length])
    allIncome += incomeMinor
    allExpense += expenseMinor
    sheets.push({ sheet: month, data: rows, columns, stickyRowsCount: 1 })
  }
  summary.push(['全部合计', allIncome / 100, allExpense / 100, (allIncome - allExpense) / 100, entries.length])
  return [
    { sheet: '月度汇总', data: summary, columns: [{ width: 16 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }], stickyRowsCount: 1 },
    ...sheets,
  ]
}

export async function downloadExcel(): Promise<void> {
  const [entries, categories] = await Promise.all([db.entries.toArray(), db.categories.toArray()])
  const sheets = buildMonthlySheets(entries, categories)
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  await writeExcelFile(sheets).toFile(`SaveMoney-月度账单-${new Date().toLocaleDateString('sv-SE')}.xlsx`)
}
