import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Ellipsis, Home, List, Plus, Settings, Trash2, Wallet, CircleHelp, DatabaseBackup, ShieldCheck, SlidersHorizontal, Info, LayoutGrid } from 'lucide-react'
import { db, initializeCategories, removeEntry, type Category, type Entry, type TransactionType } from './db'
import { money, sumMinor } from './money'
import { budgetProgress, removeMonthlyBudget, setMonthlyBudget } from './budget'
import { setCategoryBudget, removeCategoryBudget } from './categoryBudget'
import { SpendingDonut } from './SpendingDonut'
import { monthlyExpenseTrend, spendingInsights } from './insights'
import { dailySpendingSummary } from './dailySpending'
import { MemoDailySpendingChart } from './DailySpendingChart'
import { MemoSpendingTrend } from './SpendingTrend'
import { groupEntriesByDay } from './dailyGroups'
import { calculateMonthlyReview, reviewSentence } from './monthlyReview'
import { filterEntries } from './ledgerFilters'
import { downloadBackup, downloadCsv, restoreBackup, validateBackupText, type BackupData } from './backup'
import { downloadExcel } from './excelExport'
import { parseSaveMoneyCsv, type CsvImportPreview } from './csvImport'
import { parseSaveMoneyExcel } from './excelImport'
import { importCsvBills, previewImport } from './importBills'
import { ExpenseCalendar } from './ExpenseCalendar'
import { icons } from './categoryIcons'
import { EntryEditor } from './EntryEditor'
import { CategoryManager } from './CategoryManager'
import { LotteryPage } from './LotteryPage'
import { LOTTERY_EXPENSE_ID, LOTTERY_INCOME_ID, ensureLotteryCategories, lotteryTotals, effectiveLotteryBudget } from './lottery'
import { checkPwaUpdate } from './pwaUpdateCheck'

type Tab = 'home' | 'list' | 'stats' | 'settings'
const nav = [
  { id: 'home', text: '首页', icon: Home },
  { id: 'list', text: '账单', icon: List },
  { id: 'stats', text: '统计', icon: BarChart3 },
  { id: 'settings', text: '设置', icon: Settings },
] as const
const pad = (v: number) => String(v).padStart(2, '0')
const monthString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const monthLabel = (month: string) => `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`
const categoryName = (all: Category[], id: string) => all.find(c => c.id === id)?.name ?? '已删除分类'

function adjustMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  return monthString(new Date(year, m - 1 + delta, 1))
}

const SWIPE_WIDTH = 66
function EntryRow({ entry, categories, onEdit, onDeleted }: { entry: Entry; categories: Category[]; onEdit: (entry: Entry) => void; onDeleted?: () => void }) {
  const category = categories.find(c => c.id === entry.categoryId)
  const Icon = icons[category?.icon ?? 'ellipsis'] ?? Ellipsis
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const start = useRef<{x:number;y:number;offset:number;axis:'pending'|'horizontal'|'vertical'}|null>(null)
  const offsetRef = useRef(0)
  const suppressClick = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  function moveTo(next: number) { offsetRef.current = next; setOffset(next) }
  useEffect(() => {
    function closeOther(event: Event) {
      if ((event as CustomEvent<string>).detail !== entry.id) moveTo(0)
    }
    document.addEventListener('savemoney-swipe-open', closeOther)
    function outside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) moveTo(0)
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('savemoney-swipe-open', closeOther)
      document.removeEventListener('pointerdown', outside)
    }
  }, [entry.id])
  async function deleteEntry() {
    if (busy) return
    if (!window.confirm(`确定删除「${categoryName(categories,entry.categoryId)}」¥${money(entry.amountMinor)} 这笔账单吗？此操作无法撤销。`)) return
    setBusy(true)
    try { await removeEntry(entry.id); onDeleted?.() }
    catch { window.alert('删除失败，请重试') }
    finally { setBusy(false) }
  }
  return <div ref={rootRef} className={dragging ? 'swipe-entry is-dragging' : 'swipe-entry'}
    onTouchStart={e => {
      const t=e.touches[0]
      start.current={x:t.clientX,y:t.clientY,offset:offsetRef.current,axis:'pending'}
      suppressClick.current=false
    }}
    onTouchMove={e => {
      if (!start.current) return
      const t=e.touches[0], dx=t.clientX-start.current.x,dy=t.clientY-start.current.y
      if (start.current.axis==='pending') {
        if(Math.max(Math.abs(dx),Math.abs(dy))<9)return
        // Prefer native vertical scrolling unless the swipe is clearly horizontal.
        start.current.axis=Math.abs(dx)>Math.abs(dy)*1.6?'horizontal':'vertical'
      }
      if(start.current.axis!=='horizontal')return
      suppressClick.current=true
      setDragging(true)
      const raw=start.current.offset+dx
      moveTo(Math.max(-SWIPE_WIDTH-12,Math.min(12,raw)))
    }}
    onTouchEnd={() => {
      if(!start.current)return
      const horizontal=start.current.axis==='horizontal'
      start.current=null
      setDragging(false)
      if(horizontal) {
        const open=offsetRef.current < -SWIPE_WIDTH*.48
        moveTo(open?-SWIPE_WIDTH:0)
        if(open)document.dispatchEvent(new CustomEvent('savemoney-swipe-open',{detail:entry.id}))
      }
    }}
    onTouchCancel={()=>{start.current=null;setDragging(false);moveTo(0)}}>
    <button type="button" className="swipe-delete" aria-label={`删除${categoryName(categories,entry.categoryId)}账单`} tabIndex={offset===-SWIPE_WIDTH?0:-1} disabled={busy} onClick={()=>void deleteEntry()}><Trash2 size={17}/><span>删除</span></button>
    <button type="button" className="entry-row swipe-entry-content" style={{transform:`translate3d(${offset}px,0,0)`}} onClick={() => {
      if(suppressClick.current){suppressClick.current=false;return}
      if(offsetRef.current!==0){moveTo(0);return}
      onEdit(entry)
    }} aria-label={`编辑${categoryName(categories, entry.categoryId)}`}>
      <span className="entry-icon"><Icon size={18}/></span>
      <span className="entry-info"><strong>{categoryName(categories,entry.categoryId)}</strong><small>{entry.date}{entry.note ? ` · ${entry.note}` : ''}</small></span>
      <span className={entry.type==='income'?'amount income':'amount'}>{entry.type==='income'?'+':'−'} ¥{money(entry.amountMinor)}</span>
    </button>
  </div>
}



export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [settingsPage, setSettingsPage] = useState<'root'|'data'|'categories'|'preferences'|'help'|'privacy'|'about'>('root')
  const [defaultLedgerView, setDefaultLedgerView] = useState<'list'|'calendar'>(() => localStorage.getItem('savemoney-default-ledger-view') === 'list' ? 'list' : 'calendar')
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [lotteryOpen, setLotteryOpen] = useState(false)
  const [lotteryBusy, setLotteryBusy] = useState(false)
  const [lotteryError, setLotteryError] = useState('')
  const [lotteryPreset, setLotteryPreset] = useState<{type: TransactionType; categoryId: string} | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [drilldownIds, setDrilldownIds] = useState<string[] | null>(null)
  const [filterTypes, setFilterTypes] = useState<TransactionType[]>(['expense','income'])
  const [allMonths, setAllMonths] = useState(false)
  const [ledgerDate, setLedgerDate] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState('')
  const [ledgerFiltersOpen, setLedgerFiltersOpen] = useState(false)
  const [month, setMonth] = useState(() => monthString(new Date()))
  const [editing, setEditing] = useState<Entry | null | 'new'>(null)
  const [newEntryDate, setNewEntryDate] = useState<string | undefined>()
  const [copyTemplate, setCopyTemplate] = useState<Entry | null>(null)
  const [ledgerView, setLedgerView] = useState<'list'|'calendar'>('calendar')
  const [calendarDate, setCalendarDate] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [initError, setInitError] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [backupStatus, setBackupStatus] = useState('')
  const [pendingCsv, setPendingCsv] = useState<CsvImportPreview | null>(null)
  const [csvStatus, setCsvStatus] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [manualUpdateStatus, setManualUpdateStatus] = useState<'idle'|'checking'|'current'|'available'|'error'|'unsupported'|'inconclusive'>('idle')
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('savemoney-last-backup-created'))
  const [confirmedBackup, setConfirmedBackup] = useState(() => localStorage.getItem('savemoney-last-backup-confirmed'))
  const [verificationStatus, setVerificationStatus] = useState('')
  const confirmedAgeDays = confirmedBackup && Number.isFinite(Date.parse(confirmedBackup)) ? Math.max(0, Math.floor((Date.now() - Date.parse(confirmedBackup)) / 86_400_000)) : null
  const backupReminder = confirmedAgeDays === null || confirmedAgeDays >= 7
  useEffect(() => { const callback = () => { setUpdateReady(true); setManualUpdateStatus('available') }; window.addEventListener('savemoney-update-ready', callback); return () => window.removeEventListener('savemoney-update-ready', callback) }, [])
  useEffect(() => { initializeCategories().catch(() => setInitError(true)) }, [])
  useEffect(() => { setCalendarDate(null) }, [month])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 2500); return () => window.clearTimeout(timeout) }, [toast])
  const entries = useLiveQuery(() => db.entries.toArray(), [], [])
  const currentBudget = useLiveQuery(() => db.budgets.get(month), [month])
  const budgetCount = useLiveQuery(() => db.budgets.count(), [], 0)
  const categoryBudgetCount = useLiveQuery(() => db.categoryBudgets.count(), [], 0)
  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.where('month').equals(month).toArray(), [month], [])
  const lotteryBudgetHistory = useLiveQuery(() => db.categoryBudgets.where('categoryId').equals(LOTTERY_EXPENSE_ID).toArray(), [], [])
  const [categoryBudgetEditing, setCategoryBudgetEditing] = useState<string | null>(null)
  const [categoryBudgetInput, setCategoryBudgetInput] = useState('')
  const [categoryBudgetBusy, setCategoryBudgetBusy] = useState(false)
  const [categoryBudgetError, setCategoryBudgetError] = useState('')
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [budgetBusy, setBudgetBusy] = useState(false)
  useEffect(() => { setBudgetInput(''); setBudgetError(''); setCategoryBudgetEditing(null); setCategoryBudgetError('') }, [month])
  useEffect(() => { if (budgetOpen && currentBudget) setBudgetInput((currentBudget.amountMinor / 100).toFixed(2)) }, [budgetOpen, currentBudget?.amountMinor, month])
  const categories = useLiveQuery(() => db.categories.toArray(), [], [])
  const categoryList = useMemo(() => categories ?? [], [categories])
  const monthEntries = useMemo(() => (entries ?? []).filter(entry => entry.date.startsWith(month)).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [entries, month])
  const expenses = sumMinor(monthEntries, 'expense')
  const income = sumMinor(monthEntries, 'income')
  const lotterySummary = useMemo(() => lotteryTotals(entries ?? [], month, categoryList), [entries,month,categoryList])
  const lotteryBudget = useMemo(() => effectiveLotteryBudget(lotteryBudgetHistory, month), [lotteryBudgetHistory, month])
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthEntries.filter(e => e.type === 'expense')) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amountMinor)
    return Array.from(map, ([id, amount]) => ({ id, amount })).sort((a,b) => b.amount - a.amount)
  }, [monthEntries])
  const review = useMemo(() => calculateMonthlyReview(entries ?? [], categoryList, month, currentBudget?.amountMinor), [entries,categoryList,month,currentBudget?.amountMinor])
  const trend = useMemo(() => monthlyExpenseTrend(entries ?? [], month), [entries, month])
  const dailySummary = useMemo(() => dailySpendingSummary(entries ?? [], month), [entries, month])
  const insights = useMemo(() => spendingInsights(entries ?? [], categoryList, month, currentBudget?.amountMinor), [entries, categoryList, month, currentBudget?.amountMinor])
  const filteredEntries = useMemo(() => filterEntries(entries ?? [], categoryList, {keyword:searchTerm,type:filterTypes,month:allMonths?null:month}).filter(e=>(!drilldownIds || drilldownIds.includes(e.categoryId)) && (!ledgerCategory || e.categoryId === ledgerCategory) && (!ledgerDate || e.date === ledgerDate)), [entries,categoryList,searchTerm,filterTypes,allMonths,month,drilldownIds,ledgerCategory,ledgerDate])
  const ledgerHasFilters = Boolean(searchTerm.trim() || drilldownIds || filterTypes.length !== 2 || allMonths || ledgerDate || ledgerCategory)
  const clearLedgerFilters = () => { setSearchTerm(''); setDrilldownIds(null); setFilterTypes(['expense','income']); setAllMonths(false); setLedgerDate(''); setLedgerCategory(''); setCalendarDate(null) }
  const recent = monthEntries.slice(0, 5)
  const openEditor = (entry: Entry | 'new', date?: string) => { setCopyTemplate(null); setNewEntryDate(date); setEditing(entry) }
  const duplicateEntry = (entry: Entry) => { setCopyTemplate(entry); setNewEntryDate(undefined); setEditing('new') }
  const closeEditor = () => { setEditing(null); setNewEntryDate(undefined); setCopyTemplate(null); setLotteryPreset(null) }
  const notifyChange = (message: string) => { closeEditor(); setToast(message) }
  const showCalendar = () => { setLedgerView('calendar'); setAllMonths(false); setCalendarDate(ledgerDate || null) }
  const openCategoryBills = (ids: string[]) => { setDrilldownIds(ids); setAllMonths(false); setSearchTerm(''); setFilterTypes(['expense']); setBudgetOpen(false); setTab('list') }
  async function checkUpdates() {
    if (manualUpdateStatus === 'checking') return
    setManualUpdateStatus('checking')
    if (!('serviceWorker' in navigator)) { setManualUpdateStatus('unsupported'); return }
    if (!navigator.onLine) { setManualUpdateStatus('error'); return }
    try {
      const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      if (!registration) { setManualUpdateStatus('error'); return }
      const result = await checkPwaUpdate(registration)
      if (result === 'available' || registration.waiting || updateReady) {
        setUpdateReady(true)
        setManualUpdateStatus('available')
      } else setManualUpdateStatus(result)
    } catch {
      setManualUpdateStatus('error')
    }
  }
  async function openLottery() {
    if (lotteryBusy) return
    setLotteryBusy(true); setLotteryError('')
    try { await ensureLotteryCategories(); setLotteryOpen(true); window.scrollTo(0,0) }
    catch { setLotteryError('彩票账本初始化失败，请重试。现有账单未被修改。') }
    finally { setLotteryBusy(false) }
  }
  async function quickLotteryRecord(type: TransactionType) {
    setLotteryPreset({type,categoryId:type === 'expense' ? LOTTERY_EXPENSE_ID : LOTTERY_INCOME_ID})
    openEditor('new')
  }
  const goToTab = (next: Tab) => {
    setLotteryOpen(false)
    setBudgetOpen(false)
    setTab(next)
    if (next === 'settings') setSettingsPage('root')
    if (next === 'list') { setLedgerView(defaultLedgerView); setLedgerFiltersOpen(false) }
    window.scrollTo(0,0)
  }
  const openSettingsPage = (page: typeof settingsPage) => {setSettingsPage(page);window.scrollTo(0,0)}

  async function saveCategoryBudgetForm(event: React.FormEvent) {
    event.preventDefault()
    if (!categoryBudgetEditing || categoryBudgetBusy) return
    setCategoryBudgetBusy(true); setCategoryBudgetError('')
    try {
      await setCategoryBudget(month, categoryBudgetEditing, categoryBudgetInput)
      setCategoryBudgetEditing(null); setCategoryBudgetInput('')
      setToast('分类预算已保存')
    } catch (error) { setCategoryBudgetError(error instanceof Error ? error.message : '保存失败') }
    finally { setCategoryBudgetBusy(false) }
  }
  async function deleteCategoryBudget(categoryId: string) {
    if (categoryBudgetBusy || !window.confirm('确定取消该分类本月预算？不会删除账单。')) return
    setCategoryBudgetBusy(true); setCategoryBudgetError('')
    try { await removeCategoryBudget(month, categoryId); setCategoryBudgetEditing(null); setToast('分类预算已取消') }
    catch { setCategoryBudgetError('取消预算失败') }
    finally { setCategoryBudgetBusy(false) }
  }

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

  async function verifyBackup(file?: File) {
    if (!file || backupBusy) return
    setVerificationStatus('')
    if (file.size > 20_000_000) { setVerificationStatus('文件过大，无法校验'); return }
    setBackupBusy(true)
    try {
      const backup = validateBackupText(await file.text())
      setVerificationStatus(`校验通过：${backup.entries.length} 笔账单、${backup.categories.length} 个分类。此操作不会修改当前账本。`)
    } catch (error) { setVerificationStatus(error instanceof Error ? `校验失败：${error.message}` : '校验失败') }
    finally { setBackupBusy(false) }
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
    if (!window.confirm(`当前账本 ${entries?.length ?? 0} 笔 → 备份 ${pendingBackup.entries.length} 笔。恢复会覆盖当前全部账单、分类及预算，无法撤销。请先导出当前 JSON 备份并确认文件已保存。确定继续吗？`)) return
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
    if (file.size > 20_000_000) { setCsvStatus('文件过大，请选择不超过 20 MB 的账单'); return }
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('请选择 CSV 或 XLSX 文件')
      setPendingCsv(/\.xlsx$/i.test(file.name) ? await parseSaveMoneyExcel(file) : parseSaveMoneyCsv(await file.text()))
    } catch (error) { setCsvStatus(error instanceof Error ? error.message : '账单解析失败') }
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
      setBackupStatus(kind === 'json' ? '完整备份文件已生成。请在 iPhone「文件」App 或 iCloud Drive 确认文件已保存；生成文件不等于已安全备份。' : '导出文件已生成。请在「文件」App 或 iCloud Drive 确认已保存。')
    } catch { setBackupStatus('导出失败，请检查浏览器权限或设备空间') }
    finally { setBackupBusy(false) }
  }

  return <div className="app-shell">
    <header className="app-header"><div className="brand">SaveMoney<span className="brand-dot">.</span></div><span className="brand-caption">花了多少，心里有数</span></header>
    {updateReady && !editing && !backupBusy && !pendingBackup && <div className="app-update-banner" role="status"><span>发现新版本。请确认当前账单已保存后更新。</span><button onClick={() => window.dispatchEvent(new Event('savemoney-approve-update'))}>立即更新</button></div>}
    {initError && <p className="error">本地数据库初始化失败，请检查 Safari 存储权限。</p>}
    {toast && <div className="save-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span> {toast}</div>}
    <main className="content">
      {!lotteryOpen && (budgetOpen || tab !== 'settings') && <div className="month-picker"><button aria-label="上个月" onClick={() => {setLedgerDate('');setMonth(adjustMonth(month, -1))}}><ChevronLeft size={20}/></button><strong>{monthLabel(month)}</strong><button aria-label="下个月" onClick={() => {setLedgerDate('');setMonth(adjustMonth(month, 1))}}><ChevronRight size={20}/></button></div>}
      {lotteryOpen && tab === 'home' && <LotteryPage entries={entries ?? []} categories={categoryList} month={month} onMonthChange={setMonth} budgetMinor={lotteryBudget?.amountMinor ?? null} inheritedBudgetFrom={lotteryBudget?.inherited ? lotteryBudget.sourceMonth : null} onBack={() => {setLotteryOpen(false);window.scrollTo(0,0)}} onQuickRecord={type => void quickLotteryRecord(type)} onEdit={openEditor}/>}
      {!lotteryOpen && !budgetOpen && tab === 'home' && <div key="motion-home" className="motion-page">
        <div className="hero"><p>本月支出</p><h1>¥ {money(expenses)}</h1><div className="hero-grid"><div><small>本月收入</small><strong>¥ {money(income)}</strong></div><div><small>本月结余</small><strong>¥ {money(income - expenses)}</strong></div></div></div>
        <div className="home-v2-budget-heading"><h2>本月预算</h2><span>${currentBudget ? '掌握可用余额' : '规划本月支出'}</span></div>
        <button type="button" className="budget-card budget-action" aria-label={currentBudget ? '查看和管理月度预算' : '设置月度预算'} onClick={() => { setBudgetOpen(true); window.scrollTo(0, 0) }}>
          {currentBudget ? <>
            <div className="budget-heading"><span>月度预算</span><strong>管理 <ChevronRight size={15}/></strong></div>
            <div className="budget-amount-line"><span>已使用 ¥{money(expenses)}</span><strong className={expenses > currentBudget.amountMinor ? 'over-text' : ''}>{expenses > currentBudget.amountMinor ? '超出' : '剩余'} ¥{money(Math.abs(currentBudget.amountMinor - expenses))}</strong></div>
            <div className="bar-track budget-track"><div className={expenses > currentBudget.amountMinor ? 'bar-fill over-budget' : 'bar-fill'} style={{width:`${Math.min(100, expenses/currentBudget.amountMinor*100)}%`}}/></div>
            <div className="budget-footer"><span>本月预算 ¥{money(currentBudget.amountMinor)}</span><span>已用 {budgetProgress(expenses,currentBudget.amountMinor).percent}%</span></div>
          </> : <div className="budget-heading"><span>还没有设置本月预算</span><strong>设置预算 <ChevronRight size={15}/></strong></div>}
        </button>

        <button type="button" className="lottery-home-link" onClick={() => void openLottery()} disabled={lotteryBusy}>
          <span className="lottery-home-heading"><span className="lottery-home-icon">◈</span><strong>彩票账本</strong><ChevronRight size={19}/></span>
          <span className="lottery-home-description">单独管理购彩预算和中奖收支</span>
          <span className="lottery-home-metrics"><span>本月投入 <b>¥${money(lotterySummary.expenseMinor)}</b></span><span>净盈亏 <b>{lotterySummary.netMinor < 0 ? '−' : lotterySummary.netMinor > 0 ? '+' : ''}¥${money(Math.abs(lotterySummary.netMinor))}</b></span></span>
        </button>
        {lotteryError && <p className="error" role="alert">{lotteryError}</p>}
        <div className="section-heading home-section-heading"><h2>消费结构</h2><button onClick={() => goToTab('stats')}>查看分析 <ChevronRight size={15}/></button></div>
        {byCategory.length ? <>
          <div className="home-v2-top3" aria-label="消费最多的三个分类">{byCategory.slice(0,3).map((item,index)=><button key={item.id} type="button" onClick={()=>openCategoryBills([item.id])}><span className="home-v2-rank">{index+1}</span><span className="home-v2-category">{categoryName(categoryList,item.id)}</span><strong>¥{money(item.amount)}</strong><small>{expenses>0?Math.round(item.amount/expenses*100):0}%</small></button>)}</div>
          <SpendingDonut compact key={month} items={byCategory.map(item => ({ id:item.id, name:categoryName(categoryList,item.id), amount:item.amount }))} onOpenCategory={openCategoryBills}/>
        </> : <div className="empty home-chart-empty"><BarChart3 size={25}/><strong>还没有支出记录</strong><span>记一笔账，看看钱都花在哪里</span></div>}
        <div className="section-heading"><h2>最近记录</h2><button onClick={() => goToTab('list')}>查看全部 <ChevronRight size={15}/></button></div>
        {recent.length ? recent.map(e => <EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor} onDeleted={()=>notifyChange('账单已删除')}/>) : <div className="empty"><Wallet size={30}/><strong>还没有账单</strong><span>从记录第一笔消费开始吧</span></div>}
      </div>}
      {!budgetOpen && tab === 'list' && <div key="motion-list" className="motion-page">
        <div className="ledger-v3-heading"><h2>账单明细</h2><div className="ledger-v3-actions"><button type="button" className={ledgerFiltersOpen?'is-active':''} aria-label="筛选账单" aria-expanded={ledgerFiltersOpen} onClick={()=>setLedgerFiltersOpen(v=>!v)}>筛选{ledgerHasFilters?' · 已启用':''}</button><button type="button" aria-label={ledgerView==='calendar'?'切换列表视图':'切换日历视图'} onClick={()=>{if(ledgerView==='calendar'){setLedgerView('list')}else{showCalendar();setLedgerFiltersOpen(false)}}}>{ledgerView==='calendar'?<List size={19}/>:<CalendarDays size={19}/>}</button></div></div>
        {ledgerFiltersOpen && <div className="ledger-v3-panel">
        <div className="ledger-tools">
          <input aria-label="搜索账单" placeholder="搜索备注或分类…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          <div className="ledger-filters">
            <button className={!allMonths ? 'active' : ''} onClick={()=>setAllMonths(false)}>本月</button>
            {ledgerView==='list' && <button className={allMonths ? 'active' : ''} onClick={()=>{setAllMonths(true);setLedgerDate('')}}>全部月份</button>}
            {(['expense','income'] as const).map(type => <button key={type} type="button" aria-pressed={filterTypes.includes(type)} className={filterTypes.includes(type)?'active':''} onClick={()=>{
              const next=filterTypes.includes(type) ? filterTypes.filter(v=>v!==type) : [...filterTypes,type]
              setFilterTypes(next)
              if(ledgerCategory && !next.includes(categoryList.find(c=>c.id===ledgerCategory)?.type ?? 'expense'))setLedgerCategory('')
            }}>{filterTypes.includes(type)?'✓ ':''}{type==='expense'?'支出':'收入'}</button>)}
          </div>
          <div className="ledger-advanced-filters">
            <label><span>按分类筛选</span><select aria-label="筛选账单分类" value={ledgerCategory} onChange={e=>setLedgerCategory(e.target.value)}><option value="">全部分类</option>{categoryList.filter(c=>filterTypes.includes(c.type)).map(c=><option key={c.id} value={c.id}>{c.type==='income'?'收入 · ':'支出 · '}{c.name}</option>)}</select></label>
          </div>
        </div>

          {ledgerHasFilters && <button className="ledger-v3-reset" type="button" onClick={clearLedgerFilters}>清除全部筛选</button>}
        </div>}
        {ledgerHasFilters && !ledgerFiltersOpen && <div className="ledger-v3-filter-hint"><span>当前已启用筛选 · {filteredEntries.length} 笔</span><button type="button" onClick={clearLedgerFilters}>清除</button></div>}
        {ledgerView==='calendar' ? <><ExpenseCalendar month={month} entries={filteredEntries} categories={categoryList} selectedDate={calendarDate} onSelectDate={date=>{setCalendarDate(date);setLedgerDate('')}} onCreateDate={date=>openEditor('new',date)} onEdit={openEditor} onDeleted={()=>notifyChange('账单已删除')}/>{filteredEntries.length===0 && <p className="calendar-filter-empty" role="status">当前条件下没有账单，可更换月份或清除筛选。</p>}</> : filteredEntries.length ? groupEntriesByDay(filteredEntries).map(day => <section key={day.date} className="day-group"><div className="day-heading"><div className="day-date"><strong>{day.date}</strong><small>{day.entries.length} 笔</small></div><span>支出 ¥{money(day.expenseMinor)}{day.incomeMinor > 0 ? ` · 收入 ¥${money(day.incomeMinor)}` : ''}</span></div>{day.entries.map(e=><EntryRow key={e.id} entry={e} categories={categoryList} onEdit={openEditor} onDeleted={()=>notifyChange('账单已删除')}/>)}</section>) : <div className="empty"><List size={30}/><strong>没有找到符合条件的账单</strong><span>可以切换月份或清除搜索</span></div>}

      </div>}
      {!budgetOpen && tab === 'stats' && <div key="motion-stats" className="motion-page">
        <div className="stats-v2-heading"><h2>消费分析</h2><span>${monthLabel(month)}</span></div>
        <section className="stats-v2-overview">
          <div className="stats-v2-total"><small>本月总支出</small><strong>¥{money(expenses)}</strong><span>本月收入 ¥{money(income)} · 结余 ¥{money(income-expenses)}</span></div>
          <div className="stats-v2-metrics">
            <div><small>日均支出</small><strong>¥{money(dailySummary.averageMinor)}</strong><span>按 {dailySummary.comparedDays} 天</span></div>
            <div><small>最高消费日</small><strong>{dailySummary.peakDay ? `${dailySummary.peakDay} 日` : '暂无'}</strong><span>{dailySummary.peakDay ? `¥${money(dailySummary.peakMinor)}` : '暂无记录'}</span></div>
            <div><small>上月同期</small><strong className={dailySummary.percentChange !== null && dailySummary.percentChange > 0 ? 'stats-v2-up' : ''}>{dailySummary.percentChange === null ? '—' : `${dailySummary.percentChange>0?'+':''}${dailySummary.percentChange.toFixed(1)}%`}</strong><span>{dailySummary.percentChange === null ? '上期为零，无法比较' : dailySummary.percentChange > 0 ? '支出增加' : dailySummary.percentChange < 0 ? '支出减少' : '支出持平'}</span></div>
          </div>
        </section>
        <div className="section-heading"><h2>每日消费趋势</h2><span className="meta">前 {dailySummary.comparedDays} 天 · 对比上月同期</span></div>
        <MemoDailySpendingChart key={month} summary={dailySummary} />
        <div className="stats-v2-compare">本期 ¥{money(dailySummary.totalMinor)} <span>上期 ¥{money(dailySummary.previousMinor)}</span></div>
        <div className="section-heading"><h2>分类消费排行</h2><span className="meta">点击分类查看账单</span></div>
        {byCategory.length ? <div className="stats-v2-ranking motion-ranking">{byCategory.map((item,index)=><button type="button" key={item.id} onClick={()=>openCategoryBills([item.id])}><span className="stats-v2-rank">{index+1}</span><span className="stats-v2-rank-main"><span className="stats-v2-rank-title"><strong>{categoryName(categoryList,item.id)}</strong><b>¥{money(item.amount)}</b></span><span className="stats-v2-track"><i style={{width:`${expenses>0?item.amount/expenses*100:0}%`}}/></span></span><span className="stats-v2-share">{expenses>0?(item.amount/expenses*100).toFixed(1):'0.0'}%</span><ChevronRight size={14}/></button>)}</div> : <div className="empty"><BarChart3 size={26}/><strong>暂无支出数据</strong><span>记账后即可查看分类排行</span></div>}
        <div className="section-heading"><h2>近 6 个月支出趋势</h2><span className="meta">截至所选月份</span></div>
        <MemoSpendingTrend points={trend} />
        <div className="section-heading"><h2>月度回顾</h2><span className="meta">{monthLabel(month)}</span></div>
        <section className="review-card">
          <div className="review-metrics"><div><small>本月支出</small><strong>¥{money(review.expenseMinor)}</strong></div><div><small>本月收入</small><strong>¥{money(review.incomeMinor)}</strong></div><div><small>记账天数</small><strong>{review.days} 天</strong></div><div><small>最多支出类别</small><strong>{review.topCategory ?? '暂无'}</strong></div></div>
          {review.budgetRemainingMinor !== null && <p>预算{review.budgetRemainingMinor >= 0?'剩余':'超出'} ¥{money(Math.abs(review.budgetRemainingMinor))}</p>}
          <p>{reviewSentence(review)}</p>
        </section>
        <div className="section-heading"><h2>消费洞察</h2><span className="meta">本地分析 · 无 AI 费用</span></div>
        <div className="insight-card">{insights.map((message, index) => <p key={index}>{message}</p>)}</div>
      </div>}
      {!budgetOpen && tab === 'settings' && <div key="motion-settings" className="motion-page">
        {settingsPage === 'root' ? <>
          <div className="settings-v2-heading"><h2>设置</h2><button type="button" aria-label="帮助中心" onClick={() => openSettingsPage('help')}><CircleHelp size={23}/></button></div>
          <section className="settings-v2-profile"><div className="settings-v2-brand"><div className="settings-v2-logo"><Wallet size={23}/></div><div><strong>SaveMoney</strong><span>简单记账，清楚生活</span></div><small>本地账本</small></div>
          <div className="settings-v2-stats"><div><strong>{(entries ?? []).length}</strong><span>累计账单</span></div><div><strong>{new Set((entries ?? []).map(e => e.date)).size} 天</strong><span>记账天数</span></div></div></section>
          <div className="settings-v2-group-title">账本管理</div>
          <section className="settings-v2-menu">
            <button onClick={() => openSettingsPage('categories')}><LayoutGrid size={19}/><span><strong>分类管理</strong><small>支出与收入分类</small></span><ChevronRight size={17}/></button>
            <button onClick={() => openSettingsPage('data')}><DatabaseBackup size={19}/><span><strong>数据管理</strong><small>{backupReminder ? '建议备份 · 点击查看' : '备份、恢复与导入导出'}</small></span><ChevronRight size={17}/></button>
            <button onClick={() => openSettingsPage('preferences')}><SlidersHorizontal size={19}/><span><strong>记账偏好</strong><small>账单默认显示方式</small></span><ChevronRight size={17}/></button>
          </section>
          {backupReminder && <button type="button" className="backup-v2-reminder" onClick={() => openSettingsPage('data')}><ShieldCheck size={18}/><span><strong>{confirmedAgeDays === null ? '尚未确认已保存完整备份' : `距离上次确认保存备份已 ${confirmedAgeDays} 天`}</strong><small>建议每周导出 JSON 并保存到文件或 iCloud</small></span><ChevronRight size={16}/></button>}
          <div className="settings-v2-group-title">应用</div>
          <section className="settings-v2-menu">
            <button onClick={() => openSettingsPage('privacy')}><ShieldCheck size={19}/><span><strong>隐私与数据安全</strong></span><ChevronRight size={17}/></button>
            <button onClick={() => openSettingsPage('about')}><Info size={19}/><span><strong>关于 SaveMoney</strong></span><ChevronRight size={17}/></button>
          </section><p className="settings-v2-footer">SaveMoney · 免费 · 本地优先</p>
        </> : <div className="settings-static-page">
          <button className="settings-v2-back" type="button" onClick={() => openSettingsPage('root')}><ChevronLeft size={19}/> 返回设置</button>
          <h2 className="settings-v2-page-title">{{data:'数据管理',categories:'分类管理',preferences:'记账偏好',help:'帮助中心',privacy:'隐私与数据安全',about:'关于 SaveMoney'}[settingsPage]}</h2>
          {settingsPage === 'data' && <>
            <div className="setting-card"><h3>备份状态</h3>
        <p>{lastBackup ? `最近生成：${new Date(lastBackup).toLocaleString('zh-CN')}` : '尚未生成完整 JSON 备份'}</p>
        <p>{confirmedBackup ? `最近确认保存：${new Date(confirmedBackup).toLocaleString('zh-CN')}` : '尚未确认任何备份文件已保存到设备外的安全位置'}</p>
        <p>{backupReminder ? '建议导出并确认保存一份完整备份。' : '建议每周更新完整备份。'} 生成下载不代表文件已经保存，确认状态仅由你手动记录，应用无法验证 iCloud 中的文件。</p>
        <button type="button" disabled={backupBusy || !lastBackup || (confirmedBackup !== null && confirmedBackup >= lastBackup)} onClick={() => { if (!lastBackup || !window.confirm('请先在「文件」App 或 iCloud Drive 确认备份 JSON 文件已保存且可找到。确认已保存吗？')) return; localStorage.setItem('savemoney-last-backup-confirmed', lastBackup); setConfirmedBackup(lastBackup) }}>我已确认备份文件保存成功</button>
        <p>可选择已保存的 JSON 文件校验格式与内容，校验不会覆盖或修改账本。</p>
        <label className="file-label">校验 JSON 备份文件<input type="file" accept="application/json,.json" disabled={backupBusy} onChange={e => { void verifyBackup(e.target.files?.[0]); e.target.value='' }} /></label>
        {verificationStatus && <p role="status">{verificationStatus}</p>}
      </div>
      <div className="setting-card"><h3>备份与导出</h3><p>完整 JSON 可以恢复所有账目与分类；Excel 按月份分 Sheet 并包含汇总，CSV 包含全量账单及总计；仅 JSON 可完整恢复。</p>
        <div className="action-grid">
          <button disabled={backupBusy} onClick={() => exportData('json')}>导出完整备份</button>
          <button disabled={backupBusy} onClick={() => exportData('xlsx')}>导出 Excel（月度分表）</button>
          <button disabled={backupBusy} onClick={() => exportData('csv')}>导出 CSV 账单</button>
        </div>
      </div>
      <div className="setting-card"><h3>导入 CSV / Excel 账单</h3><p>支持 SaveMoney 导出的 CSV 或 Excel 月度账单。只追加新账单，不覆盖现有账本；相同日期、类型、金额、分类和备注的记录视为重复。</p>
        <label className="file-label">选择 CSV / Excel 文件<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={backupBusy} onChange={e=>{void chooseCsv(e.target.files?.[0]);e.target.value=''}} /></label>
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
          <div className="backup-v2-compare"><div><small>当前账本</small><strong>{(entries ?? []).length} 笔</strong><span>{categoryList.length} 个分类</span></div><div><small>将恢复的备份</small><strong>{pendingBackup.entries.length} 笔</strong><span>{pendingBackup.categories.length} 个分类</span></div></div>
          <p>月度预算：当前 {budgetCount} 项 → 备份 {pendingBackup.budgets?.length ?? 0} 项；分类预算：当前 {categoryBudgetCount} 项 → 备份 {pendingBackup.categoryBudgets?.length ?? 0} 项。</p>
          <p className="backup-v2-warning">⚠️ 恢复将完全覆盖当前数据，不会自动合并。请先导出当前 JSON 备份。</p>
          <button className="restore-button" disabled={backupBusy} onClick={() => void confirmRestore()}>确认覆盖并恢复</button>
          <button className="cancel-restore" disabled={backupBusy} onClick={() => setPendingBackup(null)}>取消</button>
        </div>}
        {backupStatus && <p className="feedback" role="status">{backupStatus}</p>}
      </div>

          </>}
          {settingsPage === 'categories' && <CategoryManager categories={categoryList}/>}
          {settingsPage === 'preferences' && <div className="setting-card"><h3>账单默认视图</h3><p>下次进入账单页面时优先显示的方式。</p><div className="settings-v2-segments"><button className={defaultLedgerView === 'calendar' ? 'selected' : ''} onClick={() => {setDefaultLedgerView('calendar');setLedgerView('calendar');localStorage.setItem('savemoney-default-ledger-view','calendar')}}>日历视图</button><button className={defaultLedgerView === 'list' ? 'selected' : ''} onClick={() => {setDefaultLedgerView('list');setLedgerView('list');localStorage.setItem('savemoney-default-ledger-view','list')}}>列表视图</button></div></div>}
          {settingsPage === 'help' && <div className="settings-v2-faq">
            <div><h3>如何新增账单？</h3><p>点击底部中央「+」，选择收支类型、分类和金额后保存。</p></div>
            <div><h3>如何设置预算？</h3><p>首页进入「月度预算」，可设置总预算及各分类预算。</p></div>
            <div><h3>数据保存在哪里？</h3><p>账单保存在当前设备的浏览器本地数据库，不会自动同步到其他设备。</p></div>
            <div><h3>更换手机怎么恢复？</h3><p>先到「数据管理」导出完整 JSON 备份，在新手机的「数据管理」中选择 JSON 恢复。恢复会覆盖当前账本。</p></div>
            <div><h3>如何添加到 iPhone 桌面？</h3><p>使用 Safari 打开 SaveMoney，点击分享按钮，选择「添加到主屏幕」。</p></div>
          </div>}
          {settingsPage === 'privacy' && <div className="setting-card"><h3>本地优先</h3><p>账单仅保存在当前设备浏览器的 IndexedDB 中，不会发送到开发者服务器。</p><h3 className="settings-v2-subheading">请定期备份</h3><p>清除网站数据、卸载应用或更换手机可能导致账本丢失。请在数据管理中导出 JSON 并保存到安全位置。</p><button className="settings-v2-inline-link" onClick={() => openSettingsPage('data')}>前往数据管理 <ChevronRight size={15}/></button></div>}
          {settingsPage === 'about' && <>
            <div className="setting-card"><h3>关于 SaveMoney</h3><p>免费、简洁、本地优先的个人记账工具。</p><p>支持日常记账、分类预算、消费统计及本地备份。</p></div>
            <section className="setting-card app-version-card" aria-label="应用更新">
              <h3>版本与更新</h3>
              <p>随时检查是否有可用的新版本。更新只替换应用资源，不会主动清除本地账单。</p>
              <div className="app-version-action">
                <span className="app-version-status" role="status" aria-live="polite">{{
                  idle: '尚未手动检查',
                  checking: '正在检查更新…',
                  current: '检查完成，暂未发现新版本',
                  available: '发现新版本，可以更新',
                  error: '检查失败，请确认网络后重试',
                  unsupported: '当前浏览器不支持应用内更新',
                  inconclusive: '检查超时，请稍后重试',
                }[updateReady ? 'available' : manualUpdateStatus]}</span>
                <button type="button" disabled={manualUpdateStatus === 'checking'} onClick={() => void checkUpdates()}>
                  {manualUpdateStatus === 'checking' ? '检查中…' : '检查更新'}
                </button>
              </div>
              {updateReady && <button type="button" className="app-version-install" onClick={() => window.dispatchEvent(new Event('savemoney-approve-update'))}>立即更新</button>}
              <p className="app-version-footnote">更新完成后页面可能重新加载。检查更新不会删除账单；建议定期另存完整 JSON 备份。</p>
            </section>
          </>}
        </div>}
      </div>}
      {budgetOpen && <section className="budget-detail">
        <button type="button" className="back-link" onClick={() => setBudgetOpen(false)}><ChevronLeft size={18}/> 返回首页</button>
        <div className="section-heading"><h2>{monthLabel(month)} · 月度预算</h2></div>
        <nav className="budget-section-links" aria-label="预算管理快捷入口"><a href="#category-budget-section">分类预算 <ChevronRight size={15}/></a><a href="#monthly-budget-editor">调整总预算 <ChevronRight size={15}/></a></nav>
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
        <div id="category-budget-section" className="section-heading"><h2>分类预算</h2><span className="meta">按月独立设置</span></div>
        <section className="category-budget-panel">
          <p>给餐饮、购物等支出分类设置独立额度。分类预算不会从月度总预算中重复扣除。</p>
          {categoryList.filter(c => c.type === 'expense').map(category => {
            const configured = categoryBudgets.find(b => b.categoryId === category.id)
            const spent = byCategory.find(item => item.id === category.id)?.amount ?? 0
            const over = configured ? spent > configured.amountMinor : false
            const editingThis = categoryBudgetEditing === category.id
            return <div className="category-budget-row" key={category.id}>
              <div className="category-budget-heading">
                <strong>{category.name}</strong>
                <button type="button" disabled={categoryBudgetBusy} onClick={() => {
                  setCategoryBudgetEditing(editingThis ? null : category.id)
                  setCategoryBudgetInput(configured ? (configured.amountMinor / 100).toFixed(2) : '')
                  setCategoryBudgetError('')
                }}>{editingThis ? '取消' : configured ? '调整' : '设置预算'}</button>
              </div>
              <div className="category-budget-totals"><span>已支出 ¥{money(spent)}</span><span>{configured ? `预算 ¥${money(configured.amountMinor)}` : '未设置预算'}</span></div>
              {configured && <><div className="bar-track"><div className={over ? 'bar-fill over-budget' : 'bar-fill'} style={{width:`${Math.min(100, spent / configured.amountMinor * 100)}%`}}/></div><small className={over ? 'category-budget-over' : ''}>{over ? `已超出 ¥${money(spent - configured.amountMinor)}` : `剩余 ¥${money(configured.amountMinor - spent)}`}</small></>}
              {editingThis && <form className="category-budget-form" onSubmit={e => void saveCategoryBudgetForm(e)}>
                <label>预算金额（元）<input inputMode="decimal" autoFocus placeholder="例如 800" value={categoryBudgetInput} onChange={e => setCategoryBudgetInput(e.target.value)} /></label>
                {categoryBudgetError && <p className="error" role="alert">{categoryBudgetError}</p>}
                <div><button type="submit" disabled={categoryBudgetBusy || !categoryBudgetInput.trim()}>保存预算</button>{configured && <button type="button" className="category-budget-remove" disabled={categoryBudgetBusy} onClick={() => void deleteCategoryBudget(category.id)}>取消该预算</button>}</div>
              </form>}
            </div>
          })}
        </section>
        <div id="monthly-budget-editor" className="setting-card budget-editor-card"><h3>{currentBudget ? '调整本月预算' : '设置本月预算'}</h3><p>预算仅作用于 {monthLabel(month)}，不改变已有账单。</p>
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
    {editing && <EntryEditor key={editing === 'new' ? (copyTemplate ? `copy-${copyTemplate.id}` : 'new') : editing.id} categories={categoryList} entries={entries ?? []} entry={editing === 'new' ? null : editing} template={copyTemplate} initialDate={newEntryDate} preset={lotteryPreset} onClose={closeEditor} onSaved={notifyChange} onQuickSaved={setToast} onDeleted={()=>notifyChange('账单已删除')} onDuplicate={duplicateEntry}/>}
  </div>
}
