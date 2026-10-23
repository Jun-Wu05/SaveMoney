import { useState } from 'react'
import { ChevronLeft, ChevronRight, Ticket, TrendingDown, TrendingUp } from 'lucide-react'
import { money } from './money'
import { parseAmountMinor } from './money'
import { setCategoryBudget } from './categoryBudget'
import { LOTTERY_EXPENSE_ID, lotteryTotals, lotteryHistory } from './lottery'
import type { Entry, Category } from './db'

const pad = (v: number) => String(v).padStart(2, '0')
const monthShift = (month: string, delta: number) => {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}`
}

type Props = {
  entries: Entry[]
  categories: Category[]
  month: string
  onMonthChange: (month: string) => void
  budgetMinor: number | null
  inheritedBudgetFrom: string | null
  onBack: () => void
  onQuickRecord: (type: 'expense' | 'income') => void
  onEdit: (entry: Entry) => void
}

export function LotteryPage({ entries, month, onMonthChange, budgetMinor, inheritedBudgetFrom, onBack, onQuickRecord, onEdit }: Props) {
  const [budgetEdit, setBudgetEdit] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const { records, expenseMinor, incomeMinor, netMinor } = lotteryTotals(entries, month)
  const history = lotteryHistory(entries, month)
  const historyNet = history.reduce((sum, item)=>sum+item.netMinor, 0)
  const remaining = budgetMinor === null ? null : budgetMinor - expenseMinor
  const progress = budgetMinor ? Math.min(100, Math.round(expenseMinor / budgetMinor * 100)) : 0
  async function saveBudget(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (parseAmountMinor(budgetInput) === null) { setBudgetError('请输入有效的正数预算，最多两位小数'); return }
    setBusy(true); setBudgetError('')
    try {
      await setCategoryBudget(month, LOTTERY_EXPENSE_ID, budgetInput)
      setBudgetEdit(false)
    } catch (e) { setBudgetError(e instanceof Error ? e.message : '预算保存失败') }
    finally { setBusy(false) }
  }
  return <div className="lottery-page">
    <button className="lottery-back" type="button" onClick={onBack}><ChevronLeft size={19}/> 返回首页</button>
    <div className="lottery-heading"><div><span className="lottery-eyebrow">LOTTERY LEDGER</span><h1>彩票账本</h1><p>记录投入，看清盈亏</p></div><span className="lottery-emblem"><Ticket size={28}/></span></div>
    <div className="lottery-month"><button aria-label="上个月" onClick={()=>onMonthChange(monthShift(month,-1))}><ChevronLeft size={20}/></button><strong>{month.slice(0,4)} 年 {Number(month.slice(5))} 月</strong><button aria-label="下个月" onClick={()=>onMonthChange(monthShift(month,1))}><ChevronRight size={20}/></button></div>
    <section className="lottery-net-card"><div className="lottery-card-label">本月净盈亏</div><strong className="lottery-net-number">{netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}¥{money(Math.abs(netMinor))}</strong><div className="lottery-totals"><div><span><TrendingDown size={15}/> 彩票投入</span><b>¥{money(expenseMinor)}</b></div><div><span><TrendingUp size={15}/> 中奖收入</span><b>¥{money(incomeMinor)}</b></div></div></section>
    <section className="lottery-budget-card">
      <div className="lottery-card-head"><strong>购买彩票预算</strong><button type="button" onClick={()=>{setBudgetInput(budgetMinor ? (budgetMinor/100).toFixed(2) : '1000');setBudgetError('');setBudgetEdit(!budgetEdit)}}>{budgetEdit ? '取消' : budgetMinor === null ? '设置预算' : '调整预算'}</button></div>
      {budgetMinor === null ? <p className="lottery-muted">还未设置本月彩票预算。建议为购买金额设定独立上限。</p> : <>
        <div className="lottery-budget-values"><strong>¥{money(expenseMinor)} <small>/ ¥{money(budgetMinor)}</small></strong><span>{remaining !== null && remaining >= 0 ? `剩余 ¥${money(remaining)}` : `已超出 ¥${money(Math.abs(remaining ?? 0))}`}</span></div>
        <div className="lottery-progress" role="progressbar" aria-label="彩票预算使用率" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${progress}%`}}/></div>
      </>}
      <p className="lottery-muted">{inheritedBudgetFrom ? `本月沿用 ${inheritedBudgetFrom} 设置的预算额度；可单独调整。` : '中奖金额不会增加购彩预算。'}</p>
      <p className="lottery-muted">后续月份自动沿用最近一次设置的额度，不结转上月剩余，也不以中奖抵扣预算。</p>
      {budgetEdit && <form className="lottery-budget-form" onSubmit={e=>void saveBudget(e)}><label htmlFor="lottery-budget-input">本月预算（元）</label><div><input id="lottery-budget-input" inputMode="decimal" type="text" placeholder="例如 1000" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)}/><button type="submit" disabled={busy}>{busy ? '保存中…' : '保存预算'}</button></div>{budgetError && <p className="error" role="alert">{budgetError}</p>}</form>}
    </section>
    <div className="lottery-actions"><button type="button" onClick={()=>onQuickRecord('expense')}>− 记彩票支出</button><button type="button" onClick={()=>onQuickRecord('income')}>＋ 记录中奖</button></div>
    <section className="lottery-records lottery-history">
      <h2>近六个月盈亏 <small>截至 {month}</small></h2>
      <div className="lottery-history-table" role="table" aria-label="近六个月彩票收支统计">
        <div className="lottery-history-row lottery-history-head" role="row"><span role="columnheader">月份</span><span role="columnheader">投入</span><span role="columnheader">中奖</span><span role="columnheader">净盈亏</span></div>
        {history.map(item=><div className="lottery-history-row" role="row" key={item.month}>
          <span role="cell">{item.month.slice(5)}月</span><span role="cell">¥{money(item.expenseMinor)}</span><span role="cell">¥{money(item.incomeMinor)}</span>
          <strong role="cell" className={item.netMinor>0?'lottery-income':''}>{item.netMinor>0?'+':item.netMinor<0?'−':''}¥{money(Math.abs(item.netMinor))}</strong>
        </div>)}
      </div>
      <p className="lottery-history-summary">六个月累计净盈亏 <strong>{historyNet>0?'+':historyNet<0?'−':''}¥{money(Math.abs(historyNet))}</strong></p>
    </section>
    <section className="lottery-records"><h2>本月记录 <small>{records.length} 笔</small></h2>{records.length ? records.map(entry => <button className="lottery-record" type="button" key={entry.id} onClick={()=>onEdit(entry)}><div><strong>{entry.type==='expense' ? '购买彩票' : '彩票中奖'}</strong><small>{entry.date}{entry.note ? ` · ${entry.note}` : ''}</small></div><b className={entry.type==='income'?'lottery-income':''}>{entry.type === 'income' ? '+' : '−'}¥{money(entry.amountMinor)}</b></button>) : <div className="lottery-empty">本月还没有彩票记录</div>}</section>
  </div>
}
