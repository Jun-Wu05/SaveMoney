import { useMemo } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { makeCalendar } from './calendarData'
import type { Entry, Category } from './db'
import { money } from './money'

type Props = {
  month: string
  entries: Entry[]
  categories: Category[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onCreateDate: (date: string) => void
  onEdit: (entry: Entry) => void
}
export function ExpenseCalendar({ month, entries, categories, selectedDate, onSelectDate, onCreateDate, onEdit }: Props) {
  const { days, firstWeekday } = useMemo(() => makeCalendar(month, entries), [month, entries])
  const chosen = selectedDate ? days.find(day => day.date === selectedDate) : undefined
  const transactions = selectedDate ? entries.filter(entry => entry.date === selectedDate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) : []
  const names = new Map(categories.map(category => [category.id, category.name]))
  const maxExpense = Math.max(0,...days.map(day=>day.expenseMinor))
  return <section className="expense-calendar" aria-label="本月消费日历">
    <header className="calendar-intro"><CalendarDays size={18}/><span>每日收支</span><small>点选日期查看明细</small></header>
    <div className="calendar-grid calendar-weekdays" aria-hidden="true">{['一','二','三','四','五','六','日'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="calendar-grid calendar-days">
      {Array.from({ length:firstWeekday }, (_,i)=><span key={`blank-${i}`} aria-hidden="true"/>)}
      {days.map(day=><button key={day.date} type="button" className={`calendar-day ${selectedDate===day.date?'is-selected':''} ${day.count>0?'has-entries':''}`}
        aria-pressed={selectedDate===day.date} aria-label={`${day.date}，支出${money(day.expenseMinor)}元，收入${money(day.incomeMinor)}元`}
        onClick={()=>onSelectDate(day.date)}>
        <strong>{day.day}</strong>
        <small>{day.expenseMinor>0?`−${money(day.expenseMinor)}`:day.incomeMinor>0?`+${money(day.incomeMinor)}`:''}</small>
        {day.count>0&&<span className="calendar-indicator" style={{opacity:maxExpense>0 && day.expenseMinor>0 ? .3+.7*day.expenseMinor/maxExpense : .4}}/>}
      </button>)}
    </div>
    {chosen ? <div className="calendar-detail">
      <div className="calendar-detail-title"><div><strong>{chosen.date} · {chosen.count} 笔</strong><small>支出 ¥{money(chosen.expenseMinor)}{chosen.incomeMinor>0?` · 收入 ¥${money(chosen.incomeMinor)}`:''}</small></div>
        <button type="button" onClick={()=>onCreateDate(chosen.date)}><Plus size={16}/> 记这一天</button></div>
      {transactions.length?transactions.map(entry=><button className="calendar-entry" type="button" onClick={()=>onEdit(entry)} key={entry.id}>
        <span>{names.get(entry.categoryId)??'其他'}{entry.note?` · ${entry.note}`:''}</span><strong className={entry.type==='income'?'income':''}>{entry.type==='income'?'+':'−'} ¥{money(entry.amountMinor)}</strong>
      </button>):<p className="calendar-no-entry">这一天还没有账单，可以补记一笔。</p>}
    </div>:<p className="calendar-no-entry">选择一天，查看消费记录或补记账单。</p>}
  </section>
}
