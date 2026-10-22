import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { blockSheetTouchMove } from './modalGestures'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, BookOpen, Bus, CalendarDays, ChevronLeft, ChevronRight, Delete, Ellipsis, Film, Gift, Heart, Home, House, List, Plus, Settings, ShoppingBag, Trash2, Utensils, Wallet, X, Briefcase, Coffee, CarFront, Plane, Gamepad2, HeartPulse, PawPrint, Shirt, Smartphone, Music, Dumbbell, PiggyBank } from 'lucide-react'
import { db, initializeCategories, removeEntry, saveEntry, type Category, type Entry, type TransactionType } from './db'
import { localDay, money, parseAmountMinor, sumMinor } from './money'
import { addCategory, updateCategoryDetails, deleteUnusedCategory } from './categories'
import { budgetProgress, removeMonthlyBudget, setMonthlyBudget } from './budget'
import { SpendingDonut } from './SpendingDonut'
import { monthlyExpenseTrend, spendingInsights } from './insights'
import { SpendingTrend } from './SpendingTrend'
import { groupEntriesByDay } from './dailyGroups'
import { calculateMonthlyReview, reviewSentence } from './monthlyReview'
import { filterEntries } from './ledgerFilters'
import { preferredCategories, lastEntryOfType } from './quickEntry'
import { downloadBackup, downloadCsv, restoreBackup, validateBackupText, type BackupData } from './backup'
import { downloadExcel } from './excelExport'
import { parseSaveMoneyCsv, type CsvImportPreview } from './csvImport'
import { importCsvBills, previewImport } from './importBills'
import { ExpenseCalendar } from './ExpenseCalendar'
import { pressAmountKey, type AmountKey } from './amountKeypad'

type Tab = 'home' | 'list' | 'stats' | 'settings'
const nav = [
  { id: 'home', text: '首页', icon: Home },
  { id: 'list', text: '账单', icon: List },
  { id: 'stats', text: '统计', icon: BarChart3 },
  { id: 'settings', text: '设置', icon: Settings },
] as const
const icons: Record<string, typeof Home> = {
  utensils: Utensils, 'shopping-bag': ShoppingBag, bus: Bus, house: House, film: Film,
  heart: Heart, book: BookOpen, ellipsis: Ellipsis, wallet: Wallet, gift: Gift, briefcase: Briefcase, coffee: Coffee, 'car-front': CarFront, plane: Plane, 'gamepad-2': Gamepad2, 'heart-pulse': HeartPulse, 'paw-print': PawPrint, shirt: Shirt, smartphone: Smartphone, music: Music, dumbbell: Dumbbell, 'piggy-bank': PiggyBank,
}
const iconChoices = [
  ['utensils','餐饮'],['coffee','咖啡'],['shopping-bag','购物'],['shirt','服饰'],
  ['bus','交通'],['car-front','汽车'],['house','住房'],['plane','旅行'],
  ['film','娱乐'],['gamepad-2','游戏'],['heart','健康'],['heart-pulse','医疗'],
  ['book','学习'],['paw-print','宠物'],['gift','礼物'],['smartphone','数码'],
  ['music','音乐'],['dumbbell','运动'],['wallet','钱包'],['piggy-bank','储蓄'],
  ['briefcase','工作'],['ellipsis','其他'],
] as const
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return <div className="category-icon-picker" role="group" aria-label="选择分类图标">
    {iconChoices.map(([key,label])=>{const Icon=icons[key];return <button key={key} type="button" aria-label={label} aria-pressed={value===key} className={value===key?'chosen':''} onClick={()=>onChange(key)}><Icon size={20}/><span>{label}</span></button>})}
  </div>
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

function EntryEditor({ categories, entries, entry, initialDate, onClose, onSaved, onDeleted }: { categories: Category[]; entries: Entry[]; entry: Entry | null; initialDate?: string; onClose: () => void; onSaved: (message: string) => void; onDeleted: () => void }) {
  const [type, setType] = useState<TransactionType>(entry?.type ?? 'expense')
  const [amount, setAmount] = useState(entry ? (entry.amountMinor / 100).toFixed(2) : '')
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '')
  const [date, setDate] = useState(entry?.date ?? initialDate ?? localDay(new Date()))
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [categoryView, setCategoryView] = useState<'list' | 'new' | 'manage'>('list')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [customKeypad, setCustomKeypad] = useState(true)
  const keypadKeys: AmountKey[] = ['1','2','3','4','5','6','7','8','9','.','0','backspace']
  const applyAmountKey = (key: AmountKey) => { setAmount(current => pressAmountKey(current,key)); setError('') }
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const originalBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    const originalRootOverflow = root.style.overflow
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'

    const overlay = overlayRef.current
    let touchX = 0
    let touchY = 0
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      touchX = event.touches[0].clientX
      touchY = event.touches[0].clientY
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      const dx = touch.clientX - touchX
      const dy = touch.clientY - touchY
      const target = event.target
      const scroller = target instanceof Element ? target.closest<HTMLElement>('.editor-scroller') : null
      if (blockSheetTouchMove({
        deltaX: dx, deltaY: dy, inScroller: Boolean(scroller),
        scrollTop: scroller?.scrollTop ?? 0,
        scrollHeight: scroller?.scrollHeight ?? 0,
        clientHeight: scroller?.clientHeight ?? 0,
      }) && event.cancelable) event.preventDefault()
    }
    // Safari requires a non-passive native listener to suppress rubber-band scroll.
    overlay?.addEventListener('touchstart', onTouchStart, { passive: true })
    overlay?.addEventListener('touchmove', onTouchMove, { passive: false })
    const viewport = window.visualViewport
    const syncViewport = () => {
      if (!overlay) return
      overlay.style.height = `${viewport?.height ?? window.innerHeight}px`
      overlay.style.top = `${viewport?.offsetTop ?? 0}px`
    }
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    return () => {
      overlay?.removeEventListener('touchstart', onTouchStart)
      overlay?.removeEventListener('touchmove', onTouchMove)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      body.style.position = originalBody.position
      body.style.top = originalBody.top
      body.style.left = originalBody.left
      body.style.width = originalBody.width
      body.style.overflow = originalBody.overflow
      root.style.overflow = originalRootOverflow
      window.scrollTo(0, scrollY)
    }
  }, [])
  const available = preferredCategories(entries, categories, type)
  const recentCategoryId = lastEntryOfType(entries, type)?.categoryId
  const selected = available.some(c => c.id === categoryId) ? categoryId : (recentCategoryId && available.some(c => c.id === recentCategoryId) ? recentCategoryId : available[0]?.id ?? '')

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
      onSaved(entry ? '修改已保存' : '记账成功，已保存到本机')
    } catch {
      setError('保存失败，请检查设备存储空间')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!entry || busy || !window.confirm('确定删除这笔记录？删除后无法撤销。')) return
    setBusy(true)
    try { await removeEntry(entry.id); onDeleted() }
    catch { setError('删除失败，请重试'); setBusy(false) }
  }

  async function createInlineCategory(event: React.FormEvent) {
    event.preventDefault()
    if (categoryBusy) return
    setCategoryBusy(true)
    setError('')
    try {
      const id = await addCategory(type, newCategoryName)
      setCategoryId(id)
      setNewCategoryName('')
      setCategoryView('list')
    } catch (e) { setError(e instanceof Error ? e.message : '添加分类失败') }
    finally { setCategoryBusy(false) }
  }

  return createPortal(<div ref={overlayRef} className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="editor" role="dialog" aria-modal="true" aria-label={entry ? '编辑账单' : '记一笔'}>
      <header className="editor-header"><button type="button" className="icon-button" onClick={categoryView !== 'list' ? () => { setCategoryView('list'); setError('') } : onClose} aria-label={categoryView !== 'list' ? '返回记账' : '关闭'}>{categoryView !== 'list' ? <ChevronLeft size={22}/> : <X size={22}/>}</button><strong>{categoryView === 'manage' ? '管理分类' : categoryView === 'new' ? '新增分类' : entry ? '编辑账单' : '记一笔'}</strong><span style={{width:40}}/></header>
      {categoryView === 'new' && <form className="inline-category-form editor-scroller" onSubmit={createInlineCategory}>
        <p>新增{type === 'expense' ? '支出' : '收入'}分类，完成后将自动选中；已填写的金额、日期和备注都会保留。</p>
        <label htmlFor="new-category-name">分类名称</label>
        <input id="new-category-name" maxLength={20} autoFocus placeholder="例如：宠物、旅行" value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)}/>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="save-button" disabled={!newCategoryName.trim() || categoryBusy} type="submit">{categoryBusy ? '添加中…' : '添加并选中'}</button>
      </form>}
      {categoryView === 'manage' && <div className="editor-scroller"><CategoryManager categories={categories} initialType={type} /></div>}
      <form id="entry-editor-form" className="editor-scroller entry-editor-form" hidden={categoryView !== 'list'} onSubmit={submit}>
        <div className="type-toggle"><button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => {setType('expense');setCategoryId('')}}>支出</button><button type="button" className={type === 'income' ? 'active' : ''} onClick={() => {setType('income');setCategoryId('')}}>收入</button></div>
        <label className="amount-label" htmlFor="amount">金额（人民币）</label>
        <div className="money-input"><span>¥</span><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} readOnly={customKeypad} onChange={event => setAmount(event.target.value)} aria-label="记账金额" /></div>
        <div className="keypad-mode"><button type="button" onClick={()=>setCustomKeypad(value=>!value)}>{customKeypad?'使用系统键盘':'使用记账数字键盘'}</button></div>
        {customKeypad && <div className="amount-keypad" role="group" aria-label="记账数字键盘">
          {keypadKeys.map(key=><button key={key} type="button" className={key==='backspace'?'key-backspace':''}
            aria-label={key==='backspace'?'删除末位数字':key==='.'?'小数点':`数字${key}`}
            onClick={()=>applyAmountKey(key)}>{key==='backspace'?<Delete size={22}/>:key}</button>)}
        </div>}
        {!entry && lastEntryOfType(entries, type) && <button type="button" className="copy-last" onClick={() => {
          const previous = lastEntryOfType(entries, type)!
          setAmount((previous.amountMinor / 100).toFixed(2))
          setCategoryId(previous.categoryId)
          setNote(previous.note)
          setError('')
        }}>复制上一笔金额、分类与备注（请核对后保存）</button>}
        <h3 className="section-label">选择分类</h3>
        <div className="categories">{available.map(c => {const Icon = icons[c.icon] ?? Ellipsis;return <button type="button" key={c.id} onClick={() => setCategoryId(c.id)} className={selected === c.id ? 'category chosen' : 'category'}><Icon size={20}/><span>{c.name}</span></button>})}<button type="button" className="category category-add" onClick={() => {setCategoryView('new');setError('')}}><Plus size={20}/><span>新增分类</span></button></div>
        <button type="button" className="manage-category-link" onClick={() => {setCategoryView('manage');setError('')}}>管理分类 <ChevronRight size={16}/></button>
        <div className="form-fields"><label>日期<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>备注（可选）<input maxLength={200} placeholder="写点什么…" value={note} onChange={e => setNote(e.target.value)} /></label></div>
        {error && <p className="error" role="alert">{error}</p>}
        {entry && <button className="delete-button" type="button" disabled={busy} onClick={remove}><Trash2 size={16}/> 删除这笔记录</button>}
      </form>
      {categoryView === 'list' && <footer className="editor-footer">
        <button className="save-button" type="submit" form="entry-editor-form" disabled={busy}>{busy ? '保存中…' : entry ? '保存修改' : '保存记录'}</button>
      </footer>}
    </section>
  </div>, document.body)
}

function CategoryManager({ categories, initialType = 'expense' }: { categories: Category[]; initialType?: TransactionType }) {
  const [type, setType] = useState<TransactionType>(initialType)
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
    <form className="manage-add" onSubmit={e => {e.preventDefault(); void perform(async () => { await addCategory(type,newName) },() => setNewName(''))}}>
      <input aria-label="新分类名称" maxLength={20} placeholder="添加新分类，如 宠物" value={newName} onChange={e => setNewName(e.target.value)}/>
      <button disabled={busy || !newName.trim()} type="submit">添加</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [drilldownIds, setDrilldownIds] = useState<string[] | null>(null)
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all')
  const [allMonths, setAllMonths] = useState(false)
  const [month, setMonth] = useState(() => monthString(new Date()))
  const [editing, setEditing] = useState<Entry | null | 'new'>(null)
  const [newEntryDate, setNewEntryDate] = useState<string | undefined>()
  const [ledgerView, setLedgerView] = useState<'list'|'calendar'>('list')
  const [calendarDate, setCalendarDate] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [initError, setInitError] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [backupStatus, setBackupStatus] = useState('')
  const [pendingCsv, setPendingCsv] = useState<CsvImportPreview | null>(null)
  const [csvStatus, setCsvStatus] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('savemoney-last-backup-created'))
  useEffect(() => { const callback = () => setUpdateReady(true); window.addEventListener('savemoney-update-ready', callback); return () => window.removeEventListener('savemoney-update-ready', callback) }, [])
  useEffect(() => { initializeCategories().catch(() => setInitError(true)) }, [])
  useEffect(() => { setCalendarDate(null) }, [month])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 2500); return () => window.clearTimeout(timeout) }, [toast])
  const entries = useLiveQuery(() => db.entries.toArray(), [], [])
  const currentBudget = useLiveQuery(() => db.budgets.get(month), [month])
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [budgetBusy, setBudgetBusy] = useState(false)
  useEffect(() => { setBudgetInput(''); setBudgetError('') }, [month])
  useEffect(() => { if (budgetOpen && currentBudget) setBudgetInput((currentBudget.amountMinor / 100).toFixed(2)) }, [budgetOpen, currentBudget?.amountMinor, month])
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
  const review = useMemo(() => calculateMonthlyReview(entries ?? [], categoryList, month, currentBudget?.amountMinor), [entries,categoryList,month,currentBudget?.amountMinor])
  const trend = useMemo(() => monthlyExpenseTrend(entries ?? [], month), [entries, month])
  const insights = useMemo(() => spendingInsights(entries ?? [], categoryList, month, currentBudget?.amountMinor), [entries, categoryList, month, currentBudget?.amountMinor])
  const filteredEntries = useMemo(() => filterEntries(entries ?? [], categoryList, {keyword:searchTerm,type:filterType,month:allMonths?null:month}).filter(e=>!drilldownIds || drilldownIds.includes(e.categoryId)), [entries,categoryList,searchTerm,filterType,allMonths,month,drilldownIds])
  const ledgerExpense = sumMinor(filteredEntries, 'expense')
  const ledgerIncome = sumMinor(filteredEntries, 'income')
  const ledgerHasFilters = Boolean(searchTerm.trim() || drilldownIds || filterType !== 'all' || allMonths)
  const clearLedgerFilters = () => { setSearchTerm(''); setDrilldownIds(null); setFilterType('all'); setAllMonths(false) }
  const recent = monthEntries.slice(0, 5)
  const openEditor = (entry: Entry | 'new', date?: string) => { setNewEntryDate(date); setEditing(entry) }
  const closeEditor = () => { setEditing(null); setNewEntryDate(undefined) }
  const notifyChange = (message: string) => { closeEditor(); setToast(message) }
  const showCalendar = () => { setLedgerView('calendar'); setAllMonths(false); setCalendarDate(null) }
  const openCategoryBills = (ids: string[]) => { setDrilldownIds(ids); setAllMonths(false); setSearchTerm(''); setFilterType('expense'); setBudgetOpen(false); setTab('list') }
  const goToTab = (next: Tab) => {setBudgetOpen(false);setTab(next)}

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

  async function chooseCsv(file?: File) {
    setPendingCsv(null); setCsvStatus('')
    if (!file) return
    if (file.size > 20_000_000) { setCsvStatus('CSV 文件过大'); return }
    try { setPendingCsv(parseSaveMoneyCsv(await file.text())) }
    catch (error) { setCsvStatus(error instanceof Error ? error.message : 'CSV 解析失败') }
  }

  async function confirmCsvImport() {
    if (!pendingCsv || backupBusy) return
    if (pendingCsv.errors.length) { setCsvStatus('存在无效数据，请修正文件后重新导入，未修改原账本'); return }
    setBackupBusy(true)
    try {
      const result = await importCsvBills(pendingCsv.rows)
      setCsvStatus(`成功导入 ${result.added} 笔，跳过重复 ${result.skipped} 笔。`)
      setPendingCsv(null)
    } catch { setCsvStatus('导入失败，原账本未被修改') }
    finally { setBackupBusy(false) }
  }

  async function exportData(kind: 'json' | 'csv' | 'xlsx') {
    if (backupBusy) return
    setBackupBusy(true)
    setBackupStatus('')
    try {
      if (kind === 'json') { await downloadBackup(); const at = new Date().toISOString(); localStorage.setItem('savemoney-last-backup-created', at); setLastBackup(at) }
      else if (kind === 'csv') await downloadCsv()
      else await downloadExcel()
      setBackupStatus('文件已生成。请确认已保存到 iPhone「文件」App 或 iCloud Drive。')
    } catch { setBackupStatus('导出失败，请检查浏览器权限或设备空间') }
    finally { setBackupBusy(false) }
  }

  return <div className="app-shell">
    <header className="app-header"><div className="brand">SaveMoney<span className="brand-dot">.</span></div><span className="brand-caption">花了多少，心里有数</span></header>
    {updateReady && !editing && !backupBusy && !pendingBackup && <div className="app-update-banner" role="status"><span>发现新版本。请确认当前账单已保存后更新。</span><button onClick={() => window.dispatchEvent(new Event('savemoney-approve-update'))}>立即更新</button></div>}
    {initError && <p className="error">本地数据库初始化失败，请检查 Safari 存储权限。</p>}
    {toast && <div className="save-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span> {toast}</div>}
    <main className="content">
      {<div className="month-picker"><button aria-label="上个月" onClick={() => setMonth(adjustMonth(month, -1))}><ChevronLeft size={20}/></button><strong>{monthLabel(month)}</strong><button aria-label="下个月" onClick={() => setMonth(adjustMonth(month, 1))}><ChevronRight size={20}/></button></div>}
      {!budgetOpen && tab === 'home' && <>
        <div className="hero"><p>本月支出</p><h1>¥ {money(expenses)}</h1><div className="hero-grid"><div><small>本月收入</small><strong>¥ {money(income)}</strong></div><div><small>本月结余</small><strong>¥ {money(income - expenses)}</strong></div></div></div>
        <div className="section-heading home-section-heading"><h2>消费都花在哪了</h2><button onClick={() => goToTab('stats')}>查看分析 <ChevronRight size={15}/></button></div>
        {byCategory.length ? <SpendingDonut compact key={month} items={byCategory.map(item => ({ id:item.id, name:categoryName(categoryList,item.id), amount:item.amount }))} onOpenCategory={openCategoryBills}/> : <div className="empty home-chart-empty"><BarChart3 size={25}/><strong>还没有支出记录</strong><span>记一笔账，看看钱都花在哪里</span></div>}
        <button type="button" className="budget-card budget-action" aria-label={currentBudget ? '查看和管理月度预算' : '设置月度预算'} onClick={() => setBudgetOpen(true)}>
          {currentBudget ? <>
            <div className="budget-heading"><span>月度预算</span><strong>管理 <ChevronRight size={15}/></strong></div>
            <div className="budget-amount-line"><span>已使用 ¥{money(expenses)}</span><strong className={expenses > currentBudget.amountMinor ? 'over-text' : ''}>{expenses > currentBudget.amountMinor ? '超出' : '剩余'} ¥{money(Math.abs(currentBudget.amountMinor - expenses))}</strong></div>
            <div className="bar-track budget-track"><div className={expenses > currentBudget.amountMinor ? 'bar-fill over-budget' : 'bar-fill'} style={{width:`${Math.min(100, expenses/currentBudget.amountMinor*100)}%`}}/></div>
            <div className="budget-footer"><span>本月预算 ¥{money(currentBudget.amountMinor)}</span><span>已用 {budgetProgress(expenses,currentBudget.amountMinor).percent}%</span></div>
          </> : <div className="budget-heading"><span>还没有设置本月预算</span><strong>设置预算 <ChevronRight size={15}/></strong></div>}
        </button>
        <div className="section-heading"><h2>最近记录</h2><button onClick={() => goToTab('list')}>查看全部 <ChevronRight size={15}/></button></div>
        {recent.length ? recent.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor} />) : <div className="empty"><Wallet size={30}/><strong>还没有账单</strong><span>从记录第一笔消费开始吧</span></div>}
      </>}
      {!budgetOpen && tab === 'list' && <>
        <div className="section-heading"><h2>账单明细</h2><span className="meta">{filteredEntries.length} 笔</span></div>
        <div className="ledger-view-switch" role="group" aria-label="账单查看方式">
          <button type="button" className={ledgerView==='list'?'selected':''} aria-pressed={ledgerView==='list'} onClick={()=>setLedgerView('list')}><List size={16}/> 列表</button>
          <button type="button" className={ledgerView==='calendar'?'selected':''} aria-pressed={ledgerView==='calendar'} onClick={showCalendar}><CalendarDays size={16}/> 日历</button>
        </div>
        {drilldownIds && <div className="filter-notice"><span>正在查看选中的消费分类</span><button onClick={()=>setDrilldownIds(null)}>清除分类筛选</button></div>}
        <div className="ledger-tools">
          <input aria-label="搜索账单" placeholder="搜索备注或分类…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          <div className="ledger-filters">
            <button className={!allMonths ? 'active' : ''} onClick={()=>setAllMonths(false)}>本月</button>
            {ledgerView==='list' && <button className={allMonths ? 'active' : ''} onClick={()=>setAllMonths(true)}>全部月份</button>}
            <button className={filterType==='all'?'active':''} onClick={()=>setFilterType('all')}>全部</button>
            <button className={filterType==='expense'?'active':''} onClick={()=>setFilterType('expense')}>支出</button>
            <button className={filterType==='income'?'active':''} onClick={()=>setFilterType('income')}>收入</button>
          </div>
        </div>
        <div className="ledger-result-summary" role="status" aria-live="polite">
          <div><span>{ledgerHasFilters ? '筛选结果' : '账单汇总'} · {filteredEntries.length} 笔</span><strong>支出 ¥{money(ledgerExpense)} <em>收入 ¥{money(ledgerIncome)}</em></strong></div>
          {ledgerHasFilters && <button type="button" onClick={clearLedgerFilters}>清除筛选</button>}
        </div>
        {ledgerView==='calendar' ? <><ExpenseCalendar month={month} entries={filteredEntries} categories={categoryList} selectedDate={calendarDate} onSelectDate={setCalendarDate} onCreateDate={date=>openEditor('new',date)} onEdit={openEditor}/>{filteredEntries.length===0 && <p className="calendar-filter-empty" role="status">当前条件下没有账单，可更换月份或清除筛选。</p>}</> : filteredEntries.length ? groupEntriesByDay(filteredEntries).map(day => <section key={day.date} className="day-group"><div className="day-heading"><div className="day-date"><strong>{day.date}</strong><small>{day.entries.length} 笔</small></div><span>支出 ¥{money(day.expenseMinor)}{day.incomeMinor > 0 ? ` · 收入 ¥${money(day.incomeMinor)}` : ''}</span></div>{day.entries.map(e=><EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor}/>)}</section>) : <div className="empty"><List size={30}/><strong>没有找到符合条件的账单</strong><span>可以切换月份或清除搜索</span></div>}
      </>}
      {!budgetOpen && tab === 'stats' && <>
        <div className="stats-summary"><span>本月支出</span><h1>¥ {money(expenses)}</h1><div>收入 ¥ {money(income)} · 结余 ¥ {money(income - expenses)}</div></div>
        <div className="section-heading"><h2>支出分类</h2><span className="meta">按金额排序</span></div>
        {byCategory.length ? <SpendingDonut key={month} items={byCategory.map(item => ({ id: item.id, name: categoryName(categoryList, item.id), amount: item.amount }))} onOpenCategory={openCategoryBills} /> : <div className="empty"><BarChart3 size={30}/><strong>暂无支出数据</strong><span>记账后就能看到分类统计</span></div>}
        <div className="section-heading"><h2>近 6 个月支出趋势</h2><span className="meta">截至所选月份</span></div>
        <SpendingTrend points={trend} />
        <div className="section-heading"><h2>月度回顾</h2><span className="meta">{monthLabel(month)}</span></div>
        <section className="review-card">
          <div className="review-metrics"><div><small>本月支出</small><strong>¥{money(review.expenseMinor)}</strong></div><div><small>本月收入</small><strong>¥{money(review.incomeMinor)}</strong></div><div><small>记账天数</small><strong>{review.days} 天</strong></div><div><small>最多支出类别</small><strong>{review.topCategory ?? '暂无'}</strong></div></div>
          {review.budgetRemainingMinor !== null && <p>预算{review.budgetRemainingMinor >= 0?'剩余':'超出'} ¥{money(Math.abs(review.budgetRemainingMinor))}</p>}
          <p>{reviewSentence(review)}</p>
        </section>
        <div className="section-heading"><h2>消费洞察</h2><span className="meta">本地分析 · 无 AI 费用</span></div>
        <div className="insight-card">{insights.map((message, index) => <p key={index}>{message}</p>)}</div>
      </>}
      {!budgetOpen && tab === 'settings' && <><div className="section-heading"><h2>设置</h2></div><div className="setting-card"><h3>本地独立记账</h3><p>所有账单仅存储在当前设备浏览器的 IndexedDB 中，不会发送到开发者服务器，与你的朋友互不共享。</p></div><div className="setting-card"><h3>关于记账功能</h3><p>新增与管理分类请在「记一笔」中操作；预算可以从首页查看和修改。</p></div><div className="setting-card"><h3>备份提醒</h3><p>{lastBackup ? `上次生成 JSON 备份：${new Date(lastBackup).toLocaleDateString('zh-CN')}。请确认文件已保存到 iCloud Drive 或「文件」App。` : '尚未记录生成过 JSON 备份。建议现在导出并保存一份。'} 建议至少每周备份一次。本提示不代表文件已经成功保存。</p></div><div className="setting-card warning"><h3>数据安全提醒</h3><p>本地数据可能被系统或浏览器清除。建议每周备份，并将 JSON 文件保存至「文件」App 或 iCloud Drive。更换手机不会自动同步账单。</p></div>
      <div className="setting-card"><h3>备份与导出</h3><p>完整 JSON 可以恢复所有账目与分类；Excel 按月份分 Sheet 并包含汇总，CSV 包含全量账单及总计；仅 JSON 可完整恢复。</p>
        <div className="action-grid">
          <button disabled={backupBusy} onClick={() => exportData('json')}>导出完整备份</button>
          <button disabled={backupBusy} onClick={() => exportData('xlsx')}>导出 Excel（月度分表）</button>
          <button disabled={backupBusy} onClick={() => exportData('csv')}>导出 CSV 账单</button>
        </div>
      </div>
      <div className="setting-card"><h3>导入 CSV 账单</h3><p>支持 SaveMoney 导出的 CSV 文件。只追加新账单，不覆盖现有账本；相同日期、类型、金额、分类和备注的记录视为重复。</p>
        <label className="file-label">选择 CSV 账单<input type="file" accept=".csv,text/csv" disabled={backupBusy} onChange={e=>{void chooseCsv(e.target.files?.[0]);e.target.value=''}} /></label>
        {pendingCsv && <div className="restore-preview">
          <strong>导入预览</strong>
          <p>有效 {pendingCsv.rows.length} 笔 · 异常 {pendingCsv.errors.length} 行</p>
          <p>预计新增 {previewImport(pendingCsv.rows,entries??[],categoryList).fresh.length} 笔 · 重复 {previewImport(pendingCsv.rows,entries??[],categoryList).duplicates} 笔</p>
          {pendingCsv.errors.length>0 && <p className="error" role="alert">发现异常行：{pendingCsv.errors.slice(0,5).map(e=>e.line).join('、')}。请修正后重试。</p>}
          <button className="restore-button" disabled={backupBusy || pendingCsv.errors.length>0 || previewImport(pendingCsv.rows,entries??[],categoryList).fresh.length===0} onClick={()=>void confirmCsvImport()}>确认追加账单</button>
          <button className="cancel-restore" disabled={backupBusy} onClick={()=>setPendingCsv(null)}>取消</button>
        </div>}
        {csvStatus && <p className="feedback" role="status">{csvStatus}</p>}
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
      {budgetOpen && <section className="budget-detail">
        <button type="button" className="back-link" onClick={() => setBudgetOpen(false)}><ChevronLeft size={18}/> 返回首页</button>
        <div className="section-heading"><h2>{monthLabel(month)} · 月度预算</h2></div>
        <div className="budget-detail-summary">
          <p>{currentBudget ? expenses > currentBudget.amountMinor ? '本月已超出预算' : '本月剩余可支配' : '还没有设定预算'}</p>
          <h1>{currentBudget ? `¥ ${money(Math.abs(currentBudget.amountMinor-expenses))}` : '设定消费目标'}</h1>
          {currentBudget && <>
            <div className="bar-track budget-track"><div className={expenses>currentBudget.amountMinor ? 'bar-fill over-budget' : 'bar-fill'} style={{width:`${Math.min(100, expenses/currentBudget.amountMinor*100)}%`}} /></div>
            <div className="budget-detail-totals"><span>已支出 ¥{money(expenses)}</span><span>预算 ¥{money(currentBudget.amountMinor)}</span></div>
          </>}
        </div>
        {currentBudget && (() => {
          const today = new Date()
          const isCurrent = month === monthString(today)
          const daysInMonth = new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate()
          const remainingDays = isCurrent ? Math.max(0, daysInMonth-today.getDate()+1) : 0
          const remaining = currentBudget.amountMinor-expenses
          return <div className="budget-detail-metrics">
            <div><span>剩余天数</span><strong>{isCurrent ? `${remainingDays} 天` : '—'}</strong></div>
            <div><span>日均可用</span><strong>{isCurrent && remainingDays ? `¥${money(Math.max(0,Math.floor(remaining/remainingDays)))}` : '—'}</strong></div>
          </div>
        })()}
        <div className="setting-card budget-editor-card"><h3>{currentBudget ? '调整本月预算' : '设置本月预算'}</h3><p>预算仅作用于 {monthLabel(month)}，不改变已有账单。</p>
          <form className="budget-editor-form" onSubmit={e => void saveBudget(e)}>
            <label htmlFor="budget-input">预算金额（元）</label>
            <input id="budget-input" inputMode="decimal" placeholder="例如 4000" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}/>
            {budgetError && <p className="error" role="alert">{budgetError}</p>}
            <button className="save-button" type="submit" disabled={budgetBusy || !budgetInput.trim()}>{budgetBusy ? '保存中…' : currentBudget ? '保存预算调整' : '创建月度预算'}</button>
          </form>
          {currentBudget && <button type="button" className="delete-button" disabled={budgetBusy} onClick={() => void clearBudget()}><Trash2 size={15}/> 取消本月预算</button>}
        </div>
      </section>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">
      {nav.slice(0,2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => goToTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
      <button className="add-button" aria-label="记一笔" onClick={() => openEditor('new')}><Plus size={25}/></button>
      {nav.slice(2).map(n => {const Icon = n.icon;return <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} className={tab === n.id ? 'nav-item selected' : 'nav-item'} onClick={() => goToTab(n.id)}><Icon size={21}/><span>{n.text}</span></button>})}
    </nav>
    {editing && <EntryEditor key={editing === 'new' ? 'new' : editing.id} categories={categoryList} entries={entries ?? []} entry={editing === 'new' ? null : editing} initialDate={newEntryDate} onClose={closeEditor} onSaved={notifyChange} onDeleted={()=>notifyChange('账单已删除')}/>}
  </div>
}
