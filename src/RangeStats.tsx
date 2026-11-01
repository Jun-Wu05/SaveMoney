import { useMemo, useState } from 'react'
import type { Category, Entry } from './db'
import { money } from './money'
import { dateRangeSummary, type DateRange } from './dateRangeStats'

const label = (date: string) => `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`

export function RangeStats({entries, categories, range}: {entries: Entry[]; categories: Category[]; range: DateRange}) {
  const data = useMemo(()=>dateRangeSummary(entries, range),[entries,range])
  const [selected, setSelected] = useState<string|null>(null)
  // Group long ranges into equal consecutive buckets so bars remain finger-sized.
  const bucketDays = data.days > 120 ? Math.ceil(data.days / 25) : data.days > 45 ? 7 : 1
  const bars = useMemo(() => {
    const result: {start: string;end: string;amount: number}[]=[]
    for(let i=0;i<data.points.length;i+=bucketDays) {
      const slice=data.points.slice(i,i+bucketDays)
      result.push({start:slice[0].date,end:slice[slice.length-1].date,amount:slice.reduce((n,p)=>n+p.amountMinor,0)})
    }
    return result
  },[data,bucketDays])
  const max = Math.max(1,...bars.map(b=>b.amount))
  const chosen = bars.find(b=>b.start===selected)
  return <>
    <section className="stats-v2-overview">
      <div className="stats-v2-total"><small>区间总支出</small><strong>¥{money(data.expenses)}</strong><span>区间收入 ¥{money(data.income)} · 结余 ¥{money(data.income-data.expenses)}</span></div>
      <div className="stats-v2-metrics">
        <div><small>日均支出</small><strong>¥{money(data.dailyAverage)}</strong><span>共 {data.days} 天</span></div>
        <div><small>最高消费日</small><strong>{data.peakDate ? label(data.peakDate) : '暂无'}</strong><span>{data.peakDate ? `¥${money(data.peakMinor)}` : '暂无记录'}</span></div>
        <div><small>区间账单</small><strong>{data.count} 笔</strong><span>收入及支出</span></div>
      </div>
    </section>
    <div className="section-heading"><h2>区间消费趋势</h2><span className="meta">{bucketDays===1?'按日展示':`每 ${bucketDays} 天汇总`}</span></div>
    <section className="range-trend-card">
      <div className="range-trend-readout" role="status">{chosen ? `${label(chosen.start)}${chosen.start===chosen.end?'':`–${label(chosen.end)}`} · ¥${money(chosen.amount)}` : '轻点柱状图，查看区间支出'}</div>
      <div className="range-bars" role="group" aria-label="区间消费趋势">
        {bars.map(b=><button type="button" key={b.start} className={selected===b.start?'range-bar selected':'range-bar'} aria-label={`${b.start}至${b.end}支出${money(b.amount)}元`} onClick={()=>setSelected(b.start)}><span style={{height:`${Math.max(2,b.amount/max*100)}%`}}/></button>)}
      </div>
      <div className="range-trend-ends"><span>{label(range.start)}</span><span>{label(range.end)}</span></div>
    </section>
    <div className="section-heading"><h2>分类消费排行</h2><span className="meta">所选日期范围</span></div>
    {data.categories.length ? <div className="stats-v2-ranking motion-ranking">{data.categories.map((item,index)=><div className="range-rank-row" key={item.id}><span className="stats-v2-rank">{index+1}</span><span className="stats-v2-rank-main"><span className="stats-v2-rank-title"><strong>{categories.find(c=>c.id===item.id)?.name??'已删除分类'}</strong><b>¥{money(item.amount)}</b></span><span className="stats-v2-track"><i style={{width:`${data.expenses>0?item.amount/data.expenses*100:0}%`}}/></span></span><span className="stats-v2-share">{(item.amount/data.expenses*100).toFixed(1)}%</span></div>)}</div> : <div className="empty"><strong>这个日期区间没有支出</strong><span>请选择其他日期范围</span></div>}
  </>
}
