import { describe, expect, it } from 'vitest'
import { parseMonthlyRows } from './excelImport'

const header = ['日期','类型','分类','备注','收入（元）','支出（元）','结余（元）']

describe('monthly Excel import', () => {
  it('parses monthly rows, skips totals and reports invalid records', () => {
    const result = parseMonthlyRows([header,
      ['2026-10-22','支出','餐饮','午餐',0,12.5,-12.5],
      ['2026-10-23','收入','工资','',300,0,300],
      ['月度合计','','','',300,12.5,287.5],
      ['2026-02-30','支出','餐饮','',0,3,-3],
    ], '2026-10')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].amountMinor).toBe(1250)
    expect(result.errors).toHaveLength(1)
  })
  it('rejects unrelated sheet headers', () => {
    expect(() => parseMonthlyRows([['wrong']], '2026-10')).toThrow()
  })
  it('rejects valid dates belonging to a different monthly sheet', () => {
    const result = parseMonthlyRows([header, ['2026-09-30','支出','餐饮','',0,12,0]], '2026-10')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
  })
  it('roundtrips floating Excel numeric cents without accepting fractional cents', () => {
    const result = parseMonthlyRows([header,
      ['2026-10-01','支出','餐饮','',0,12.300000000000001,0],
      ['2026-10-02','支出','餐饮','',0,12.345,0],
    ], '2026-10')
    expect(result.rows.map(row => row.amountMinor)).toEqual([1230])
    expect(result.errors).toHaveLength(1)
  })
  it('restores formula-escaped notes from SaveMoney Excel export', () => {
    const result = parseMonthlyRows([header, ['2026-10-01','支出','餐饮',"'=SUM(1,2)",0,12,0]], '2026-10')
    expect(result.rows[0].note).toBe('=SUM(1,2)')
  })
  it('rejects invalid type and amount direction', () => {
    const result = parseMonthlyRows([header,
      ['2026-10-01','收入','工资','',10,10,0],
      ['2026-10-02','支出','餐饮','',0,-5,0],
      ['2026-10-03','未知','餐饮','',0,5,0],
    ], '2026-10')
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(3)
  })
})
