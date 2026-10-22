import { useState } from 'react'
import { money } from './money'
import type { DailySummary } from './dailySpending'

export function DailySpendingChart({ summary }: { summary: DailySummary }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const max = Math.max(1, ...summary.points.map(p => p.amountMinor))
  const width = 330, left = 12, chartWidth = 306, base = 122
  const step = chartWidth / summary.points.length
  const chosen = summary.points.find(p => p.day === selectedDay)
  return <section className="daily-trend-card motion-chart">
    <div className="daily-chart-readout" role="status" aria-live="polite">
      {chosen ? <><strong>{chosen.day} 日</strong><span>支出 ¥{money(chosen.amountMinor)}</span></> : <span>轻点柱状图，查看当天支出</span>}
    </div>
    <div className="daily-chart-touch-wrap">
    <svg viewBox={`0 0 ${width} 157`} role="img" aria-label="每日支出柱状图，轻点图中日期查看金额">
      <line x1={left} x2={left + chartWidth} y1={base} y2={base} stroke="#dce4db" />
      {summary.points.map(p => {
        const height = p.amountMinor / max * 102
        const x = left + (p.day - 1) * step + 1
        const selected = selectedDay === p.day
        return <g key={p.day} className={selected ? 'daily-chart-day is-selected' : 'daily-chart-day'}>
          <rect className="daily-chart-bar" x={x} y={base - height}
            width={Math.max(2, step - 2)} height={Math.max(0, height)} rx="2"
            fill={p.day > summary.comparedDays ? '#e7eae5' : selected ? '#365e47' : '#648c73'}
            pointerEvents="none">
            <title>{p.day}日：¥{money(p.amountMinor)}</title>
          </rect>
        </g>
      })}
      {[1, 8, 15, 22, summary.points.length].map((day, i) =>
        <text key={i} x={left + (day - .5) * step} y="145" textAnchor="middle" fontSize="10" fill="#879087">{day}日</text>)}
    </svg>
    <div className="trend-accessible motion-daily-sr-only">{summary.points.filter(p => p.amountMinor > 0).map(p => <span key={p.day}>{p.day}日 ¥{money(p.amountMinor)}</span>)}</div>
  </section>
}
