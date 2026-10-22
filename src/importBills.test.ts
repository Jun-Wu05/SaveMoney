import { describe,expect,it } from 'vitest'
import { billKey, previewImport } from './importBills'
import type { Category,Entry } from './db'
const categories: Category[] = [{id:'food',name:'餐饮',type:'expense',icon:'utensils',sortOrder:1}]
const entry: Entry = {id:'a',date:'2026-10-22',type:'expense',amountMinor:1250,categoryId:'food',note:'午餐',createdAt:'2026-10-22T10:00:00Z',updatedAt:'2026-10-22T10:00:00Z'}
describe('CSV import deduplication',()=>{
  it('skips existing bills and repeated rows within one file',()=>{
    const existing = {date:entry.date,type:entry.type,amountMinor:entry.amountMinor,category:'餐饮',note:'午餐'}
    const next = {...existing,note:'晚餐'}
    expect(previewImport([existing,next,next],[entry],categories)).toEqual({fresh:[next],duplicates:2})
  })
  it('keeps distinct transaction amounts and types',()=>{
    const first = {date:entry.date,type:entry.type,amountMinor:entry.amountMinor,category:'餐饮',note:'午餐'}
    expect(billKey(first)).not.toBe(billKey({...first,amountMinor:1300}))
    expect(billKey(first)).not.toBe(billKey({...first,type:'income'}))
  })
})
