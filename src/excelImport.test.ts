import {describe,expect,it} from 'vitest'
import {parseMonthlyRows} from './excelImport'
const header=['日期','类型','分类','备注','收入（元）','支出（元）','结余（元）']
describe('monthly Excel import',()=>{
 it('parses monthly rows, skips totals and rejects invalid records',()=>{
  const result=parseMonthlyRows([header,['2026-10-22','支出','餐饮','午餐',0,12.5,-12.5],['2026-10-23','收入','工资','',300,0,300],['月度合计','','','',300,12.5,287.5],['2026-02-30','支出','餐饮','',0,3,-3]],'2026-10')
  expect(result.rows).toHaveLength(2)
  expect(result.rows[0].amountMinor).toBe(1250)
  expect(result.errors).toHaveLength(1)
 })
 it('rejects unrelated sheets',()=>expect(()=>parseMonthlyRows([['wrong']],'2026-10')).toThrow())
})
