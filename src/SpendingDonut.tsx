import { useState } from 'react'
import { money } from './money'

export type SpendingSlice = { id: string; name: string; amount: number }

const palette = ['#527d66', '#a2b5a1', '#d19d72', '#779cac', '#c8b3a0', '#a98d9e']
export function chartSlices(items: SpendingSlice[]): SpendingSlice[] {
  const positive = items.filter(item => Number.isFinite(item.amount) && item.amount > 0)
  if (positive.length <= 6) return positive
  const top = positive.slice(0, 5)
  return [...top, { id: '__remaining__', name: '其他分类', amount: positive.slice(5).reduce((sum, item) => sum + item.amount, 0) }]
}

export function SpendingDonut({ items, onOpenCategory, compact = false }: { items: SpendingSlice[]; onOpenCategory?: (categoryIds: string[]) => void; compact?: boolean }) {
  const positive = items.filter(item => Number.isFinite(item.amount) && item.amount > 0)
  const slices = compact && positive.length > 4
    ? [...positive.slice(0, 3), { id: '__remaining__', name: '其他分类', amount: positive.slice(3).reduce((sum, item) => sum + item.amount, 0) }]
    : chartSlices(items)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const total = slices.reduce((sum, item) => sum + item.amount, 0)
  const selected = slices.find(item => item.id === selectedId)
  if (total <= 0) return <div className="empty"><strong>暂无支出数据</strong><span>记账后即可查看分类占比</span></div>

  const radius = 76
  const resolveIds = (id: string) => id !== '__remaining__' ? [id] : items.slice(compact ? 3 : 5).map(item => item.id)
  const choose = (id: string) => {
    if (compact && onOpenCategory) onOpenCategory(resolveIds(id))
    else setSelectedId(current => current === id ? null : id)
  }
  const circumference = 2 * Math.PI * radius
  let accumulated = 0
  return <section className={compact ? 'donut-card donut-compact' : 'donut-card'} aria-label="消费分类占比">
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 220 220" role="img" aria-label="本月各分类消费环形图">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#e8ebe4" strokeWidth="27" />
        {slices.map((item, index) => {
          const length = item.amount / total * circumference
          const offset = accumulated
          accumulated += length
          return <circle key={item.id} cx="110" cy="110" r={radius} fill="none"
            stroke={palette[index % palette.length]} strokeWidth={selectedId === item.id ? 32 : 27}
            strokeDasharray={`${Math.max(0, length - 1.5)} ${circumference}`}
            strokeDashoffset={-offset} transform="rotate(-90 110 110)"
            className="donut-segment" onClick={() => choose(item.id)}
          ><title>{item.name} ¥{money(item.amount)} ({(item.amount / total * 100).toFixed(1)}%)</title></circle>
        })}
      </svg>
      <div className="donut-center"><small>{selected ? selected.name : '本月总支出'}</small>
        <strong>¥ {money(selected ? selected.amount : total)}</strong>
        <span>{selected ? `${(selected.amount / total * 100).toFixed(1)}%` : '100%'}</span>
      </div>
    </div>
    <div className="donut-legend">{slices.map((item, index) => <button type="button" key={item.id}
      aria-pressed={selectedId === item.id} className={selectedId === item.id ? 'legend-row active' : 'legend-row'}
      onClick={() => choose(item.id)}>
      <span className="legend-dot" style={{ backgroundColor: palette[index % palette.length] }} />
      <span className="legend-name">{item.name}</span>
      <span className="legend-value">¥ {money(item.amount)}</span>
      <strong className="legend-percent">{(item.amount / total * 100).toFixed(1)}%</strong>
    </button>)}</div>
    {!compact && selected && onOpenCategory && <button className="drilldown-button" onClick={() => onOpenCategory(resolveIds(selected.id))}>查看「{selected.name}」账单 →</button>}
  </section>
}
