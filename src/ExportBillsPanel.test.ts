import { describe, expect, it } from 'vitest'
import type { Category, Entry } from './db'
import { buildSelectedSheets, buildSelectedCsv, dateInterval, filterExportEntries } from './ExportBillsPanel'
import { parseMonthlyRows } from './excelImport'
import { parseSaveMoneyCsv } from './csvImport'

const timestamp = '2026-11-05T01:00:00.000Z'
const categories: Category[] = [
  {id:'food',type:'expense',name:'餐饮',icon:'utensils',sortOrder:1},
  {id:'salary',type:'income',name:'工资',icon:'wallet',sortOrder:2},
]
const bill = (id:string,date:string,type:'income'|'expense',amountMinor:number,note='测试'):Entry =>
  ({id,date,type,amountMinor,categoryId:type==='income'?'salary':'food',note,createdAt:timestamp,updatedAt:timestamp})
const entries = [
  bill('old','2026-10-30','expense',1800),
  bill('a','2026-11-05','expense',2500,'=SUM(A1:A2)'),
  bill('b','2026-11-06','income',500000),
]
const options = {from:'2026-11-01',to:'2026-11-30',expenses:true,incomes:true,notes:true,summary:true,aiPrompt:true}

describe('filtered AI-friendly exports',()=>{
  it('calculates preset ranges without dropping month end',()=>{
    const today=new Date(2026,10,5)
    expect(dateInterval('month',today)).toEqual({from:'2026-11-01',to:'2026-11-05'})
    expect(dateInterval('previous',today)).toEqual({from:'2026-10-01',to:'2026-10-31'})
    expect(dateInterval('year',today)).toEqual({from:'2026-01-01',to:'2026-11-05'})
    expect(dateInterval('custom',today)).toBeNull()
  })
  it('filters inclusively by dates and transaction type',()=>{
    expect(filterExportEntries(entries,options).map(e=>e.id)).toEqual(['a','b'])
    expect(filterExportEntries(entries,{...options,incomes:false}).map(e=>e.id)).toEqual(['a'])
    expect(()=>filterExportEntries(entries,{...options,from:'2026-11-31'})).toThrow()
    expect(()=>filterExportEntries(entries,{...options,expenses:false,incomes:false})).toThrow()
  })
  it('adds prompt and detail without breaking monthly import compatibility',()=>{
    const sheets=buildSelectedSheets(entries,categories,options)
    expect(sheets.map(s=>s.sheet)).toEqual(['AI分析说明','账单明细','统计汇总','月度汇总','2026-11'])
    expect(sheets[1].data).toHaveLength(3)
    expect(sheets[0].data.some(r=>String(r[1]).includes('环形图'))).toBe(true)
    const parsed=parseMonthlyRows(sheets[4].data as (string|number)[][],'2026-11')
    expect(parsed.rows.map(e=>e.amountMinor)).toEqual([2500,500000])
    expect(parsed.errors).toHaveLength(0)
  })
  it('removes notes when deselected and keeps CSV reimportable',()=>{
    const settings={...options,notes:false,summary:false,aiPrompt:false}
    const sheets=buildSelectedSheets(entries,categories,settings)
    expect(sheets.map(s=>s.sheet)).toEqual(['账单明细','2026-11'])
    expect(sheets[1].data[1][3]).toBe('')
    const csv=buildSelectedCsv(entries,categories,settings)
    const parsed=parseSaveMoneyCsv(csv)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0].note).toBe('')
    expect(parsed.errors).toHaveLength(0)
  })
})
