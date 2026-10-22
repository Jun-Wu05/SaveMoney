import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, BookOpen, Bus, ChevronLeft, ChevronRight, Ellipsis, Film, Gift, Heart, Home, House, List, Plus, Settings, ShoppingBag, Trash2, Utensils, Wallet, X, Briefcase } from 'lucide-react'
import { db, initializeCategories, removeEntry, saveEntry, type Category, type Entry, type TransactionType } from './db'
import { localDay, money, parseAmountMinor, sumMinor } from './money'

type Tab = 'home' | 'list' | 'stats' | 'settings'
const nav = [
  { id: 'home', text: '首页', icon: Home },
  { id: 'list', text: '账单', icon: List },
  { id: 'stats', text: '统计', icon: BarChart3 },
  { id: 'settings', text: '设置', icon: Settings },
] as const
const icons: Record<string, typeof Home> = {
  utensils: Utensils, 'shopping-bag': ShoppingBag, bus: Bus, house: House, film: Film,
  heart: Heart, book: BookOpen, ellipsis: Ellipsis, wallet: Wallet, gift: Gift, briefcase: Briefcase,
}
const pad = (v: number) => String(v).padStart(2, '0')
const monthString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const monthLabel = (month: string) => `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`
const categoryName = (all: Category[], id: string) => all.find(c => c.id === id)?.name ?? '已删除分类'

function adjustMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  return monthString(new Date(year, m - 1 + delta, 1))
}

function EntryRow({ entry, categories, onEdit }: { entry: Entry; categories: Category[]; onEdit: (entry: Entry) => void }) {
  const category = categories.find(c => c.id === entry.categoryId)
  const Icon = icons[category?.icon ?? 'ellipsis'] ?? Ellipsis
  return <button className="entry-row" onClick={() => onEdit(entry)} aria-label={`编辑${categoryName(categories, entry.categoryId)}`}>
    <span className="entry-icon"><Icon size={18} /></span>
    <span className="entry-info"><strong>{categoryName(categories, entry.categoryId)}</strong><small>{entry.date}{entry.note ? ` · ${entry.note}` : ''}</small></span>
    <span className={entry.type === 'income' ? 'amount income' : 'amount'}>{entry.type === 'income' ? '+' : '−'} ¥{money(entry.amountMinor)}</span>
  </button>
}

function EntryEditor({ categories, entry, onClose }: { categories: Category[]; entry: Entry | null; onClose: () => void }) {
  const [type, setType] = useState<TransactionType>(entry?.type ?? 'expense')
  const [amount, setAmount] = useState(entry ? (entry.amountMinor / 100).toFixed(2) : '')
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '')
  const [date, setDate] = useState(entry?.date ?? localDay(new Date()))
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const available = categories.filter(c => c.type === type).sort((a, b) => a.sortOrder - b.sortOrder)
  const selected = available.some(c => c.id === categoryId) ? categoryId : available[0]?.id ?? ''

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const amountMinor = parseAmountMinor(amount)
    if (amountMinor === null) return setError('请输入正确的金额，最多两位小数')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).valueOf())) return setError('请选择有效日期')
    if (!selected) return setError('请先选择分类')
    setBusy(true); setError('')
    const timestamp = new Date().toISOString()
    try {
      await saveEntry({
        id: entry?.id ?? crypto.randomUUID(), type, amountMinor, categoryId: selected,
        date, note: note.trim().slice(0, 200), createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp,
      })
      onClose()
    } catch {
      setError('保存失败，请检查设备存储空间')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!entry || busy || !window.confirm('确定删除这笔记录？删除后无法撤销。')) return
    setBusy(true)
    try { await removeEntry(entry.id); onClose() }
    catch { setError('删除失败，请重试'); setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="editor" role="dialog" aria-modal="true" aria-label={entry ? '编辑账单' : '记一笔'}>
      <header className="editor-header"><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22}/></button><strong>{entry ? '编辑账单' : '记一笔'}</strong><span style={{width:40}}/></header>
      <form onSubmit={submit}>
        <div className="type-toggle"><button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => {setType('expense');setCategoryId('')}}>支出</button><button type="button" className={type === 'income' ? 'active' : ''} onClick={() => {setType('income');setCategoryId('')}}>收入</button></div>
        <label className="amount-label" htmlFor="amount">金额（人民币）</label>
        <div className="money-input"><span>¥</span><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)} autoFocus /></div>
        <h3 className="section-label">选择分类</h3>
        <div className="categories">{available.map(c => {const Icon = icons[c.icon] ?? Ellipsis;return <button type="button" key={c.id} onClick={() => setCategoryId(c.id)} className={selected === c.id ? 'category chosen' : 'category'}><Icon size={20}/><span>{c.name}</span></button>})}</div>
        <div className="form-fields"><label>日期<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>备注（可选）<input maxLength={200} placeholder="写点什么…" value={note} onChange={e => setNote(e.target.value)} /></label></div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="save-button" type="submit" disabled={busy}>{busy ? '保存中…' : entry ? '保存修改' : '保存记录'}</button>
        {entry && <button className="delete-button" type="button" disabled={busy} onClick={remove}><Trash2 size={16}/> 删除这笔记录</button>}
      </form>
    </section>
  </div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(() => monthString(new Date()))
  const [editing, setEditing] = useState<Entry | null | 'new'>(null)
  const [initError, setInitError] = useState(false)
  useEffect(() => { initializeCategories().catch(() => setInitError(true)) }, [])
  const entries = useLiveQuery(() => db.entries.toArray(), [], [])
  const categories = useLiveQuery(() => db.categories.toArray(), [], [])
  const categoryList = useMemo(() => categories ?? [], [categories])
  const monthEntries = useMemo(() => (entries ?? []).filter(entry => entry.date.startsWith(month)).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [entries, month])
  const expenses = sumMinor(monthEntries, 'expense')
  const income = sumMinor(monthEntries, 'income')
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthEntries.filter(e => e.type === 'expense')) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amountMinor)
    return Array.from(map, ([id, amount]) => ({ id, amount })).sort((a,b) => b.amount - a.amount)
  }, [monthEntries])
  const recent = [...(entries ?? [])].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0,5)
  const openEditor = (entry: Entry | 'new') => setEditing(entry)

  return <div className="app-shell">
    <header className="app-header"><div className="brand">SaveMoney<span className="brand-dot">.</span></div><span className="brand-caption">花了多少，心里有数</span></header>
    {initError && <p className="error">本地数据库初始化失败，请检查 Safari 存储权限。</p>}
    <main className="content">
      {tab !== 'settings' && <div className="month-picker"><button aria-label="上个月" onClick={() => setMonth(adjustMonth(month, -1))}><ChevronLeft size={20}/></button><strong>{monthLabel(month)}</strong><button aria-label="下个月" onClick={() => setMonth(adjustMonth(month, 1))}><ChevronRight size={20}/></button></div>}
      {tab === 'home' && <>
        <div className="hero"><p>本月支出</p><h1>¥ {money(expenses)}</h1><div className="hero-grid"><div><small>本月收入</small><strong>¥ {money(income)}</strong></div><div><small>本月结余</small><strong>¥ {money(income - expenses)}</strong></div></div></div>
        <div className="section-heading"><h2>最近记录</h2><button onClick={() => setTab('list')}>查看全部 <ChevronRight size={15}/></button></div>
        {recent.length ? recent.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor} />) : <div className="empty"><Wallet size={30}/><strong>还没有账单</strong><span>从记录第一笔消费开始吧</span></div>}
      </>}
      {tab === 'list' && <><div className="section-heading"><h2>本月账单</h2><span className="meta">{monthEntries.length} 笔</span></div>{monthEntries.length ? monthEntries.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor}/>) : <div className="empty"><List size={30}/><strong>这个月还没有记录</strong><span>点击下方按钮开始记账</span></div>}</>}
      {tab === 'stats' && <>
        <div className="stats-summary"><span>本月支出</span><h1>¥ {money(expenses)}</h1><div>收入 ¥ {money(income)} · 结余 ¥ {money(income - expenses)}</div></div>
        <div className="section-heading"><h2>支出分类</h2><span className="meta">按金额排序</span></div>
        {byCategory.length ? byCategory.map(item => <div className="stat-row" key={item.id}><div className="stat-heading"><strong>{categoryName(categoryList,item.id)}</strong><span>¥ {money(item.amount)} · {expenses ? Math.round(item.amount / expenses * 100) : 0}%</span></div><div className="bar-track"><div className="bar-fill" style={{width:`${expenses ? item.amount/expenses*100 : 0}%`}} /></div></div>) : <div className="empty"><BarChart3 size={30}/><strong>暂无支出数据</strong><span>记账后就能看到分类统计</span></div>}
      </>}
      {tab === 'settings' && <><div className="section-heading"><h2>设置</h2></div><div className="setting-card"><h3>本地独立记账</h3><p>所有账单仅存储在当前设备浏览器的 IndexedDB 中，不会发送到开发者服务器，与你的朋友互不共享。</p></div><div className="setting-card warning"><h3>数据安全提醒</h3><p>目前是开发预览版，尚未提供备份与恢复。清理 Safari 网站数据、卸载网页 App 或设备损坏可能导致账单永久丢失。请暂勿用于长期保存重要财务记录。</p></div><div className="setting-card"><h3>版本</h3><p>SaveMoney 0.1.0 · 开发预览</p></div></>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">
      {nav.slice(0,2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => setTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
      <button className="add-button" aria-label="记一笔" onClick={() => openEditor('new')}><Plus size={25}/></button>
      {nav.slice(2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => setTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
    </nav>
    {editing && <EntryEditor key={editing === 'new' ? 'new' : editing.id} categories={categoryList} entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)}/>}
  </div>
}
