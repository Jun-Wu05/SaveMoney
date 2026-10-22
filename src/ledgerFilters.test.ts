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