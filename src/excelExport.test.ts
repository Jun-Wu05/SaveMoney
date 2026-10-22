import { describe, expect, it } from 'vitest'
import { buildMonthlySheets, safeSpreadsheetText } from './excelExport'
import type { Entry, Category } from './db'

const now = '2026-10-22T10:00:00.000Z'
const entry = (id: string, date: string, type: Entry['type'], amountMinor: number): Entry => ({
  id, date, type, amountMinor, categoryId: type === 'income' ? 'salary' : 'food',
  note: id, createdAt: now, updatedAt: now,
})
const categories: Category[] = [
  { id:'food',name:'餐饮',type:'expense',icon:'utensils',sortOrder:1 },
  { id:'salary',name:'工资',type:'income',icon:'wallet',sortOrder:1 },
]

describe('monthly workbook export', () => {
  it('creates monthly sheets in descending order plus an overall summary', () => {
    const sheets = buildMonthlySheets([
      entry('a','2026-09-11','expense',1250),
      entry('b','2026-10-01','income',100000),
      entry('c','2026-10-11','expense',2550),
    ], categories)
    expect(sheets.map(x => x.sheet)).toEqual(['月度汇总','2026-10','2026-09'])
    expect(sheets[1].data.at(-1)).toEqual(['月度合计','','','',1000,25.5,974.5])
    expect(sheets[2].data.at(-1)).toEqual(['月度合计','','','',0,12.5,-12.5])
    expect(sheets[0].data.at(-1)).toEqual(['全部合计',1000,38,962,3])
  })
  it('handles empty ledgers', () => {
    const sheets = buildMonthlySheets([],categories)
    expect(sheets).toHaveLength(1)
    expect(sheets[0].data.at(-1)).toEqual(['全部合计',0,0,0,0])
  })
  it('escapes formula-looking user inputs', () => {
    expect(safeSpreadsheetText('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(safeSpreadsheetText('正常备注')).toBe('正常备注')
  })
})
