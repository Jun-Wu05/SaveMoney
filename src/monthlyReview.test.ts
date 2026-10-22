import {describe,it,expect} from 'vitest'
import {calculateMonthlyReview,reviewSentence} from './monthlyReview'
import type {Entry} from './db'
const e=(id:string,date:string,type:'income'|'expense',amountMinor:number):Entry=>({id,date,type,amountMinor,categoryId:'food',note:'',createdAt:date+'T00:00:00Z',updatedAt:date+'T00:00:00Z'})
describe('monthly review',()=>{
 it('counts distinct bookkeeping days and both types',()=>{
 const r=calculateMonthlyReview([e('1','2026-10-01','expense',200),e('2','2026-10-01','income',300),e('3','2026-10-02','expense',100)],[],'2026-10',500)
 expect(r.days).toBe(2);expect(r.expenseMinor).toBe(300);expect(r.incomeMinor).toBe(300);expect(r.budgetRemainingMinor).toBe(200)
 })
 it('handles empty month',()=>expect(reviewSentence(calculateMonthlyReview([],[],'2026-10'))).toContain('还没有账单'))
 it('checks year boundary',()=>expect(calculateMonthlyReview([e('1','2025-12-01','expense',100)],[],'2026-01').hasPrevious).toBe(true))
})