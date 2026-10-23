import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { makeCalendar, calendarNetMinor } from './calendarData'
import { removeEntry, type Entry, type Category } from './db'
import { localDay, money } from './money'

type Props = {
  month: string
  entries: Entry[]
  categories: Category[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onCreateDate: (date: string) => void
  onEdit: (entry: Entry) => void
  onDeleted?: () => void
}
export function ExpenseCalendar({ month, entries, categories, selectedDate, onSelectDate, onCreateDate, onEdit, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  async function deleteOne(entry: Entry) {
    if (deletingId) return
    const label = categories.find(c => c.id === entry.categoryId)?.name ?? '其他'
    if (!window.confirm(`确定删除「${label}」¥${money(entry.amountMinor)} 这笔账单吗？删除后无法恢复。`)) return
    setDeletingId(entry.id)
    try { await removeEntry(entry.id); onDeleted?.() }
    catch { window.alert('删除失败，请重试') }
    finally { setDeletingId(null) }
  }
  const today = localDay(new Date())
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
      {days.map(day=><button key={day.date} type="button" className={`calendar-day ${selectedDate===day.date?'is-selected':''} ${day.count>0?'has-entries':''} ${day.date===today?'is-today':''}`}
        aria-pressed={selectedDate===day.date} aria-current={day.date===today ? 'date' : undefined} aria-label={`${day.date}${day.date===today ? '，今天' : ''}，${day.count}笔，支出${money(day.expenseMinor)}元，收入${money(day.incomeMinor)}元，净收支${calendarNetMinor(day) < 0 ? '负' : calendarNetMinor(day) > 0 ? '正' : ''}${money(Math.abs(calendarNetMinor(day)))}元`}
        onClick={()=>onSelectDate(day.date)}>
        <strong>{day.day}</strong>
        <small className={calendarNetMinor(day)>0 ? 'calendar-income' : ''}>{day.count>0 ? `${calendarNetMinor(day)>0 ? '+' : calendarNetMinor(day)<0 ? '−' : ''}${money(Math.abs(calendarNetMinor(day)))}` : ''}</small>
        {day.count>0&&<span className="calendar-indicator" style={{opacity:maxExpense>0 && day.expenseMinor>0 ? .3+.7*day.expenseMinor/maxExpense : .4}}/>}
      </button>)}
    </div>
    {chosen ? <div key={chosen.date} className="calendar-detail calendar-detail-motion">
      <div className="calendar-detail-title"><div><strong>{chosen.date} · {chosen.count} 笔</strong><small>支出 ¥{money(chosen.expenseMinor)}{chosen.incomeMinor>0?` · 收入 ¥${money(chosen.incomeMinor)}`:''}</small></div>
        <button type="button" onClick={()=>onCreateDate(chosen.date)}><Plus size={16}/> 记这一天</button></div>
      {transactions.length?transactions.map(entry=><div className="calendar-entry-wrap" key={entry.id}>
        <button className="calendar-entry" type="button" onClick={()=>onEdit(entry)} aria-label={`编辑${names.get(entry.categoryId)??'其他'}账单`}>
          <span>{names.get(entry.categoryId)??'其他'}{entry.note?` · ${entry.note}`:''}</span><strong className={entry.type==='income'?'income':''}>{entry.type==='income'?'+':'−'} ¥{money(entry.amountMinor)}</strong>
        </button>
        <button className={`calendar-entry-delete ${deletingId===entry.id?'is-deleting':''}`} type="button" disabled={deletingId!==null} onClick={()=>void deleteOne(entry)} aria-label={`删除${names.get(entry.categoryId)??'其他'} ${money(entry.amountMinor)}元账单`} title="删除这笔账单"><Trash2 size={17}/></button>
      </div>):<p className="calendar-no-entry">这一天还没有账单，可以补记一笔。</p>}
    </div>:<p className="calendar-no-entry">选择一天，查看消费记录或补记账单。</p>}
  </section>
}
