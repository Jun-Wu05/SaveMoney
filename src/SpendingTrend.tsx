import { money } from './money'
import type { MonthlyPoint } from './insights'

export function SpendingTrend({ points }: { points: MonthlyPoint[] }) {
  const width = 320, height = 148, top = 12, bottom = 112
  const max = Math.max(1, ...points.map(p => p.expenseMinor))
  const coords = points.map((p, i) => ({
    x: 18 + i * 56.8,
    y: bottom - (p.expenseMinor / max) * (bottom - top),
    ...p,
  }))
  const line = coords.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  return <section className="trend-card">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近六个月支出趋势折线图">
      <line x1="18" x2="302" y1={bottom} y2={bottom} stroke="#dce4db" />
      <path d={line} fill="none" stroke="#527d66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map(p => <g key={p.month}>
        <circle cx={p.x} cy={p.y} r="5" fill="#527d66" stroke="#fff" strokeWidth="2">
          <title>{p.month}：¥{money(p.expenseMinor)}</title>
        </circle>
        <text x={p.x} y="138" textAnchor="middle" fontSize="11" fill="#879087">{Number(p.month.slice(5))}月</text>
      </g>)}
    </svg>
    <div className="trend-accessible">{points.map(p => <span key={p.month}>{p.month.slice(5)}月 ¥{money(p.expenseMinor)}</span>)}</div>
  </section>
}
