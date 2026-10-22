import { describe, expect, it } from 'vitest'
import { groupEntriesByDay } from './dailyGroups'
import type { Entry } from './db'
const entry = (id:string,date:string,type:'income'|'expense',amountMinor:number):Entry => ({id,date,type,amountMinor,categoryId:'food',note:'',createdAt:date+'T10:00:00Z',updatedAt:date+'T10:00:00Z'})
describe('date grouping',()=>{
 it('groups and sorts newest day first',()=>{
 const groups=groupEntriesByDay([entry('a','2026-09-01','expense',2800),entry('b','2026-10-02','income',50000),entry('c','2026-09-01','income',1000)])
 expect(groups.map(x=>x.date)).toEqual(['2026-10-02','2026-09-01'])
 expect(groups[1].expenseMinor).toBe(2800)
 expect(groups[1].incomeMinor).toBe(1000)
 })
 it('handles no transactions',()=>expect(groupEntriesByDay([])).toEqual([]))
})