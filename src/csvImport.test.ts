import { describe, expect, it } from 'vitest'
import { parseSaveMoneyCsv } from './csvImport'

describe('SaveMoney CSV import parsing', () => {
  const header = '日期,类型,金额(元),分类,备注'
  it('reads BOM, quoted commas and skips exported totals', () => {
    const csv = '\uFEFF' + header + '\r\n"2026-10-22","支出","12.50","餐饮","午餐,饮料"\r\n"全部汇总","收入合计","0.00","",""\r\n"","支出合计","12.50","",""'
    expect(parseSaveMoneyCsv(csv)).toEqual({ rows: [{ date:'2026-10-22', type:'expense', amountMinor:1250, category:'餐饮', note:'午餐,饮料' }], errors:[] })
  })
  it('rejects invalid dates and nonpositive amounts without importing them', () => {
    const result = parseSaveMoneyCsv(header + '\n2026-02-30,支出,12.00,餐饮,测试\n2026-10-22,收入,0,工资,测试')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
  })
  it('rejects unknown headers and malformed quotes', () => {
    expect(() => parseSaveMoneyCsv('wrong,columns')).toThrow()
    expect(() => parseSaveMoneyCsv(header + '\n"unfinished')).toThrow()
  })
})
