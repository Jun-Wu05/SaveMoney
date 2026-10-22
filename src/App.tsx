import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, BookOpen, Bus, ChevronLeft, ChevronRight, Ellipsis, Film, Gift, Heart, Home, House, List, Plus, Settings, ShoppingBag, Trash2, Utensils, Wallet, X, Briefcase } from 'lucide-react'
import { db, initializeCategories, removeEntry, saveEntry, type Category, type Entry, type TransactionType } from './db'
import { localDay, money, parseAmountMinor, sumMinor } from './money'
import { addCategory, renameCategory, deleteUnusedCategory } from './categories'
import { budgetProgress, removeMonthlyBudget, setMonthlyBudget } from './budget'
import { SpendingDonut } from './SpendingDonut'
import { downloadBackup, downloadCsv, restoreBackup, validateBackupText, type BackupData } from './backup'

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
const isValidLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const actual = new Date(0)
  actual.setFullYear(year, month - 1, day)
  return actual.getFullYear() === year && actual.getMonth() === month - 1 && actual.getDate() === day
}
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
    if (!isValidLocalDate(date)) return setError('请选择有效日期')
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

function CategoryManager({ categories }: { categories: Category[] }) {
  const [type, setType] = useState<TransactionType>('expense')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function perform(action: () => Promise<void>, after?: () => void) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action(); after?.() }
    catch (e) { setError(e instanceof Error ? e.message : '操作失败，请重试') }
    finally { setBusy(false) }
  }

  const shown = categories.filter(c => c.type === type).sort((a,b) => a.sortOrder - b.sortOrder)

  return <div className="setting-card category-manager">
    <h3>分类管理</h3>
    <p>可以新增、重命名分类。已经有账单的分类不能直接删除，以免账单丢失。</p>
    <div className="type-toggle compact-toggle">
      <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => {setType('expense');setEditingId(null);setError('')}}>支出分类</button>
      <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => {setType('income');setEditingId(null);setError('')}}>收入分类</button>
    </div>
    <div className="manage-list">{shown.map(category => <div className="manage-category" key={category.id}>
      {editingId === category.id ? <>
        <input aria-label="编辑分类名称" maxLength={20} value={editName} onChange={e => setEditName(e.target.value)}/>
        <button type="button" disabled={busy} onClick={() => void perform(() => renameCategory(category.id,editName),() => setEditingId(null))}>保存</button>
        <button type="button" disabled={busy} onClick={() => setEditingId(null)}>取消</button>
      </> : <>
        <span>{category.name}</span>
        <button type="button" disabled={busy} onClick={() => {setEditingId(category.id);setEditName(category.name);setError('')}}>改名</button>
        <button type="button" disabled={busy} onClick={() => {
          if (window.confirm(`确定删除「${category.name}」？已有账单的分类无法删除。`))
            void perform(() => deleteUnusedCategory(category.id))
        }}>删除</button>
      </>}
    </div>)}</div>
    <form className="manage-add" onSubmit={e => {e.preventDefault(); void perform(() => addCategory(type,newName),() => setNewName(''))}}>
      <input aria-label="新分类名称" maxLength={20} placeholder="添加新分类，如 宠物" value={newName} onChange={e => setNewName(e.target.value)}/>
      <button disabled={busy || !newName.trim()} type="submit">添加</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(() => monthString(new Date()))
  const [editing, setEditing] = useState<Entry | null | 'new'>(null)
  const [initError, setInitError] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [backupStatus, setBackupStatus] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  useEffect(() => { initializeCategories().catch(() => setInitError(true)) }, [])
  const entries = useLiveQuery(() => db.entries.toArray(), [], [])
  const currentBudget = useLiveQuery(() => db.budgets.get(month), [month])
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [budgetBusy, setBudgetBusy] = useState(false)
  useEffect(() => { setBudgetInput(''); setBudgetError('') }, [month])
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
  const recent = monthEntries.slice(0, 5)
  const openEditor = (entry: Entry | 'new') => setEditing(entry)

  async function saveBudget(event: React.FormEvent) {
    event.preventDefault()
    if (budgetBusy) return
    setBudgetBusy(true)
    setBudgetError('')
    try { await setMonthlyBudget(month, budgetInput); setBudgetInput('') }
    catch (error) { setBudgetError(error instanceof Error ? error.message : '预算保存失败') }
    finally { setBudgetBusy(false) }
  }

  async function clearBudget() {
    if (budgetBusy || !window.confirm(`确定取消 ${monthLabel(month)} 的预算？不会删除账单。`)) return
    setBudgetBusy(true)
    try { await removeMonthlyBudget(month) }
    catch { setBudgetError('取消预算失败') }
    finally { setBudgetBusy(false) }
  }

  async function chooseBackup(file?: File) {
    if (!file) return
    setBackupStatus('')
    setPendingBackup(null)
    if (file.size > 20_000_000) { setBackupStatus('文件过大，拒绝导入'); return }
    try {
      const text = await file.text()
      const backup = validateBackupText(text)
      setPendingBackup(backup)
    } catch (error) { setBackupStatus(error instanceof Error ? error.message : '读取备份失败') }
  }

  async function confirmRestore() {
    if (!pendingBackup || backupBusy) return
    if (!window.confirm(`即将用备份中的 ${pendingBackup.entries.length} 笔账单替换当前全部数据。这个操作无法撤销，请先导出当前账本。是否继续？`)) return
    setBackupBusy(true)
    try {
      await restoreBackup(pendingBackup)
      setPendingBackup(null)
      setBackupStatus('恢复成功，请检查账单数据')
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : '恢复失败，原数据未修改')
    } finally { setBackupBusy(false) }
  }

  async function exportData(kind: 'json' | 'csv') {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupStatus('')
    try {
      if (kind === 'json') await downloadBackup()
      else await downloadCsv()
      setBackupStatus('文件已生成。请确认已保存到 iPhone「文件」App 或 iCloud Drive。')
    } catch { setBackupStatus('导出失败，请检查浏览器权限或设备空间') }
    finally { setBackupBusy(false) }
  }

  return <div className="app-shell">
    <header className="app-header"><div className="brand">SaveMoney<span className="brand-dot">.</span></div><span className="brand-caption">花了多少，心里有数</span></header>
    {initError && <p className="error">本地数据库初始化失败，请检查 Safari 存储权限。</p>}
    <main className="content">
      {<div className="month-picker"><button aria-label="上个月" onClick={() => setMonth(adjustMonth(month, -1))}><ChevronLeft size={20}/></button><strong>{monthLabel(month)}</strong><button aria-label="下个月" onClick={() => setMonth(adjustMonth(month, 1))}><ChevronRight size={20}/></button></div>}
      {tab === 'home' && <>
        <div className="hero"><p>本月支出</p><h1>¥ {money(expenses)}</h1><div className="hero-grid"><div><small>本月收入</small><strong>¥ {money(income)}</strong></div><div><small>本月结余</small><strong>¥ {money(income - expenses)}</strong></div></div></div>
        {currentBudget && <section className="budget-card" aria-label="月度预算">
          <div className="budget-heading"><span>本月预算</span><strong>¥ {money(currentBudget.amountMinor)}</strong></div>
          <div className="bar-track budget-track"><div className={expenses > currentBudget.amountMinor ? 'bar-fill over-budget' : 'bar-fill'} style={{width:`${Math.min(100, expenses/currentBudget.amountMinor*100)}%`}}/></div>
          <div className="budget-footer"><span>已使用 {budgetProgress(expenses,currentBudget.amountMinor).percent}%</span><strong className={expenses > currentBudget.amountMinor ? 'over-text' : ''}>{expenses > currentBudget.amountMinor ? '超出' : '剩余'} ¥ {money(Math.abs(currentBudget.amountMinor - expenses))}</strong></div>
        </section>}
        <div className="section-heading"><h2>最近记录</h2><button onClick={() => setTab('list')}>查看全部 <ChevronRight size={15}/></button></div>
        {recent.length ? recent.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor} />) : <div className="empty"><Wallet size={30}/><strong>还没有账单</strong><span>从记录第一笔消费开始吧</span></div>}
      </>}
      {tab === 'list' && <><div className="section-heading"><h2>本月账单</h2><span className="meta">{monthEntries.length} 笔</span></div>{monthEntries.length ? monthEntries.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor}/>) : <div className="empty"><List size={30}/><strong>这个月还没有记录</strong><span>点击下方按钮开始记账</span></div>}</>}
      {tab === 'stats' && <>
        <div className="stats-summary"><span>本月支出</span><h1>¥ {money(expenses)}</h1><div>收入 ¥ {money(income)} · 结余 ¥ {money(income - expenses)}</div></div>
        <div className="section-heading"><h2>支出分类</h2><span className="meta">按金额排序</span></div>
        {byCategory.length ? <SpendingDonut key={month} items={byCategory.map(item => ({ id: item.id, name: categoryName(categoryList, item.id), amount: item.amount }))} /> : <div className="empty"><BarChart3 size={30}/><strong>暂无支出数据</strong><span>记账后就能看到分类统计</span></div>}
      </>}
      {tab === 'settings' && <><div className="section-heading"><h2>设置</h2></div><div className="setting-card"><h3>本地独立记账</h3><p>所有账单仅存储在当前设备浏览器的 IndexedDB 中，不会发送到开发者服务器，与你的朋友互不共享。</p></div><div className="setting-card budget-settings"><h3>{monthLabel(month)} · 月度预算</h3>
        <p>预算只针对当前选择的月份，不会修改任何历史账单。可在首页切换月份查看和调整。</p>
        {currentBudget && <div className="current-budget">当前预算：¥ {money(currentBudget.amountMinor)} <button type="button" disabled={budgetBusy} onClick={() => void clearBudget()}>取消</button></div>}
        <form className="manage-add" onSubmit={e => void saveBudget(e)}>
          <input inputMode="decimal" aria-label="月度预算金额" placeholder="输入预算金额（元）" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} />
          <button type="submit" disabled={budgetBusy || !budgetInput.trim()}>{currentBudget ? '更新预算' : '设置预算'}</button>
        </form>
        {budgetError && <p className="error" role="alert">{budgetError}</p>}
      </div><CategoryManager categories={categoryList} /><div className="setting-card warning"><h3>数据安全提醒</h3><p>本地数据可能被系统或浏览器清除。建议每周备份，并将 JSON 文件保存至「文件」App 或 iCloud Drive。更换手机不会自动同步账单。</p></div>
      <div className="setting-card"><h3>备份与导出</h3><p>完整 JSON 可以恢复所有账目与分类；CSV 仅用于表格查看，不能用于完整恢复。</p>
        <div className="action-grid">
          <button disabled={backupBusy} onClick={() => exportData('json')}>导出完整备份</button>
          <button disabled={backupBusy} onClick={() => exportData('csv')}>导出 CSV 账单</button>
        </div>
      </div>
      <div className="setting-card"><h3>从备份恢复</h3><p>选择此前导出的 SaveMoney JSON 文件。恢复会替换现有全部账本，操作前请先备份当前数据。</p>
        <label className="file-label">选择 JSON 备份文件<input type="file" accept="application/json,.json" disabled={backupBusy} onChange={e => {void chooseBackup(e.target.files?.[0]);e.target.value=''}} /></label>
        {pendingBackup && <div className="restore-preview">
          <strong>恢复预览</strong>
          <p>备份时间：{new Date(pendingBackup.exportedAt).toLocaleString('zh-CN')}</p>
          <p>{pendingBackup.entries.length} 笔记录 · {pendingBackup.categories.length} 个分类</p>
          <button className="restore-button" disabled={backupBusy} onClick={() => void confirmRestore()}>确认覆盖并恢复</button>
          <button className="cancel-restore" disabled={backupBusy} onClick={() => setPendingBackup(null)}>取消</button>
        </div>}
        {backupStatus && <p className="feedback" role="status">{backupStatus}</p>}
      </div>
      <div className="setting-card"><h3>添加到 iPhone 桌面</h3><p>请使用 Safari 打开此网址，点击「分享」→「添加到主屏幕」。首次访问需要联网，之后可离线记账。</p></div>
      <div className="setting-card"><h3>版本</h3><p>SaveMoney 1.0 · 私人使用版</p></div></>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">
      {nav.slice(0,2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => setTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
      <button className="add-button" aria-label="记一笔" onClick={() => openEditor('new')}><Plus size={25}/></button>
      {nav.slice(2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => setTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
    </nav>
    {editing && <EntryEditor key={editing === 'new' ? 'new' : editing.id} categories={categoryList} entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)}/>}
  </div>
}
