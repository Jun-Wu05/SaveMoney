import type { Entry, Category } from './db'
import { money } from './money'
export type MonthlyReview = { expenseMinor:number; incomeMinor:number; days:number; topCategory:string|null; previousExpenseMinor:number; hasPrevious:boolean; budgetRemainingMinor:number|null }
export function calculateMonthlyReview(entries:Entry[],categories:Category[],month:string,budgetMinor?:number):MonthlyReview {
 const current=entries.filter(e=>e.date.startsWith(month))
 const expenses=current.filter(e=>e.type==='expense')
 const expenseMinor=expenses.reduce((a,e)=>a+e.amountMinor,0)
 const incomeMinor=current.filter(e=>e.type==='income').reduce((a,e)=>a+e.amountMinor,0)
 const days=new Set(current.map(e=>e.date)).size
 const totals=new Map<string,number>()
 expenses.forEach(e=>totals.set(e.categoryId,(totals.get(e.categoryId)||0)+e.amountMinor))
 const topId=[...totals.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]
 const topCategory=topId ? categories.find(c=>c.id===topId)?.name ?? '其他' : null
 const [year,m]=month.split('-').map(Number)
 const previousDate=new Date(0);previousDate.setFullYear(year,m-2,1)
 const previous=`${previousDate.getFullYear()}-${String(previousDate.getMonth()+1).padStart(2,'0')}`
 const prev=entries.filter(e=>e.date.startsWith(previous)&&e.type==='expense')
 return {expenseMinor,incomeMinor,days,topCategory,previousExpenseMinor:prev.reduce((a,e)=>a+e.amountMinor,0),hasPrevious:prev.length>0,budgetRemainingMinor:budgetMinor===undefined?null:budgetMinor-expenseMinor}
}
export function reviewSentence(review:MonthlyReview):string {
 if(review.days===0)return '这个月还没有账单，记录第一笔后就能看到月度回顾。'
 if(!review.hasPrevious)return '上个月尚无支出记录，继续积累账本后即可比较消费变化。'
 const difference=review.expenseMinor-review.previousExpenseMinor
 if(difference===0)return '本月累计支出与上个月相同。'
 return `本月已记录的支出比上个月${difference>0?'多':'少'} ¥${money(Math.abs(difference))}。这不是未来消费预测。`
}
