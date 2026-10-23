import { describe,it,expect } from 'vitest'
import { filterEntries } from './ledgerFilters'
import type { Entry,Category } from './db'
const rows=[{id:'a',date:'2026-09-01',type:'expense',categoryId:'food',note:'咖啡'}, {id:'b',date:'2026-10-01',type:'income',categoryId:'salary',note:'月薪'}] as Entry[]
const cats=[{id:'food',name:'餐饮'},{id:'salary',name:'工资'}] as Category[]
describe('ledger filters',()=>{
 it('filters by month',()=>expect(filterEntries(rows,cats,{keyword:'',type:'all',month:'2026-09'})).toHaveLength(1))
 it('searches note and category',()=>expect(filterEntries(rows,cats,{keyword:'餐饮',type:'all',month:null})).toHaveLength(1))
 it('filters by type',()=>expect(filterEntries(rows,cats,{keyword:'',type:'income',month:null})).toHaveLength(1))
})
describe('multi-select transaction types',()=>{
 it('displays both when selected',()=>expect(filterEntries(rows,cats,{keyword:'',type:['income','expense'],month:null})).toHaveLength(2))
 it('filters only expense',()=>expect(filterEntries(rows,cats,{keyword:'',type:['expense'],month:null}).map(x=>x.id)).toEqual(['a']))
 it('filters only income',()=>expect(filterEntries(rows,cats,{keyword:'',type:['income'],month:null}).map(x=>x.id)).toEqual(['b']))
 it('shows none when both unchecked',()=>expect(filterEntries(rows,cats,{keyword:'',type:[],month:null})).toHaveLength(0))
})

describe('combined types and category multiselection',()=>{
 it('combines expense and income lottery categories in one query',()=>{
  const entries=[
   {id:'e',date:'2026-10-23',type:'expense',categoryId:'lottery-expense',note:''},
   {id:'i',date:'2026-10-23',type:'income',categoryId:'lottery-income',note:''},
   {id:'other',date:'2026-10-23',type:'expense',categoryId:'food',note:''},
  ] as Entry[]
  const selected=['lottery-expense','lottery-income']
  expect(filterEntries(entries,[],{keyword:'',month:'2026-10',type:['expense','income'],categoryIds:selected}).map(x=>x.id)).toEqual(['e','i'])
  expect(filterEntries(entries,[],{keyword:'',month:'2026-10',type:['income'],categoryIds:['lottery-income']}).map(x=>x.id)).toEqual(['i'])
  expect(filterEntries(entries,[],{keyword:'',month:'2026-10',type:['expense','income'],categoryIds:[]}).map(x=>x.id)).toEqual(['e','i','other'])
 })
})
