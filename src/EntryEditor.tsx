import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Delete, Ellipsis, Plus, Trash2, X } from 'lucide-react'
import { blockSheetTouchMove } from './modalGestures'
import { saveEntry, removeEntry, type Category, type Entry, type TransactionType } from './db'
import { localDay, money, parseAmountMinor } from './money'
import { addCategory } from './categories'
import { pressAmountKey, type AmountKey } from './amountKeypad'
import { calculateAmount, type CalcOperator, type CalcPending } from './amountCalculator'
import { preferredCategories, lastEntryOfType } from './quickEntry'
import { icons, IconPicker } from './categoryIcons'
import { CategoryManager } from './CategoryManager'

const isValidLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const actual = new Date(0)
  actual.setFullYear(year, month - 1, day)
  return actual.getFullYear() === year && actual.getMonth() === month - 1 && actual.getDate() === day
}

export function EntryEditor({ categories, entries, entry, template, initialDate, preset, onClose, onSaved, onQuickSaved, onDeleted, onDuplicate }: { categories: Category[]; entries: Entry[]; entry: Entry | null; template?: Entry | null; initialDate?: string; preset?: {type: TransactionType; categoryId: string} | null; onClose: () => void; onSaved: (message: string) => void; onQuickSaved: (message: string) => void; onDeleted: () => void; onDuplicate: (entry: Entry) => void }) {
  const [type, setType] = useState<TransactionType>(entry?.type ?? template?.type ?? preset?.type ?? 'expense')
  const [amount, setAmount] = useState(entry || template ? ((entry ?? template)!.amountMinor / 100).toFixed(2) : '')
  const [pendingCalc, setPendingCalc] = useState<CalcPending>(null)
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? template?.categoryId ?? preset?.categoryId ?? '')
  const [date, setDate] = useState(entry?.date ?? initialDate ?? localDay(new Date()))
  const [note, setNote] = useState(entry?.note ?? template?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [motionState, setMotionState] = useState<'idle' | 'closing' | 'saved'>('idle')
  const motionTimer = useRef<number | null>(null)
  useEffect(() => () => { if (motionTimer.current !== null) window.clearTimeout(motionTimer.current) }, [])
  function requestClose() {
    if (busy || motionState !== 'idle') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    setMotionState('closing')
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current)
    motionTimer.current = window.setTimeout(() => { motionTimer.current = null; onClose() }, 190)
  }
  const [categoryView, setCategoryView] = useState<'list' | 'new' | 'manage'>('list')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('ellipsis')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [customKeypad, setCustomKeypad] = useState(true)
  const keypadKeys: AmountKey[] = ['1','2','3','4','5','6','7','8','9','.','0','backspace']
  const applyAmountKey = (key: AmountKey) => { setAmount(current => pressAmountKey(current,key)); setError('') }
  const startCalc = (operator: CalcOperator) => {
    if (pendingCalc && amount.trim() === '') { setPendingCalc({ ...pendingCalc, operator }); return }
    const result = calculateAmount(pendingCalc, amount)
    if ('error' in result) { setError(result.error); return }
    setPendingCalc({ baseMinor: result.amountMinor, operator })
    setAmount('')
    setError('')
  }
  const finishCalc = () => {
    const result = calculateAmount(pendingCalc, amount)
    if ('error' in result) { setError(result.error); return }
    setAmount(result.display)
    setPendingCalc(null)
    setError('')
  }
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
    // Keep focused date/note fields visible when the iOS software keyboard opens.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.closest('.editor-scroller')) return
      window.setTimeout(() => {
        const scroller = target.closest<HTMLElement>('.editor-scroller')
        if (!scroller || !target.isConnected) return
        const inputRect = target.getBoundingClientRect()
        const areaRect = scroller.getBoundingClientRect()
        if (inputRect.bottom > areaRect.bottom - 12) scroller.scrollTop += inputRect.bottom - areaRect.bottom + 12
        else if (inputRect.top < areaRect.top + 12) scroller.scrollTop -= areaRect.top - inputRect.top + 12
      }, 220)
    }
    overlay?.addEventListener('focusin', onFocusIn)
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    return () => {
      overlay?.removeEventListener('touchstart', onTouchStart)
      overlay?.removeEventListener('touchmove', onTouchMove)
      overlay?.removeEventListener('focusin', onFocusIn)
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
    const saveAndContinue = !entry && ((event.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.action === 'again'
    const computed = calculateAmount(pendingCalc, amount)
    if ('error' in computed) return setError(pendingCalc ? computed.error : '请输入正确的金额，最多两位小数')
    const amountMinor = computed.amountMinor
    setAmount(computed.display)
    setPendingCalc(null)
    if (!isValidLocalDate(date)) return setError('请选择有效日期')
    if (!selected) return setError('请先选择分类')
    setBusy(true); setError('')
    const timestamp = new Date().toISOString()
    try {
      await saveEntry({
        id: entry?.id ?? crypto.randomUUID(), type, amountMinor, categoryId: selected,
        date, note: note.trim().slice(0, 200), createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp,
      })
      if (saveAndContinue) {
        setAmount('')
        setPendingCalc(null)
        setNote('')
        setCategoryId(selected)
        onQuickSaved('已保存一笔，可以继续记账')
      } else {
        const message = entry ? '修改已保存' : '记账成功，已保存到本机'
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onSaved(message)
        else {
          setMotionState('saved')
          if (motionTimer.current !== null) window.clearTimeout(motionTimer.current)
          motionTimer.current = window.setTimeout(() => { motionTimer.current = null; onSaved(message) }, 340)
        }
      }
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
      const id = await addCategory(type, newCategoryName, newCategoryIcon)
      setCategoryId(id)
      setNewCategoryName('')
      setCategoryView('list')
    } catch (e) { setError(e instanceof Error ? e.message : '添加分类失败') }
    finally { setCategoryBusy(false) }
  }

  return createPortal(<div ref={overlayRef} className={`modal-backdrop motion-sheet ${motionState === 'closing' ? 'motion-sheet-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) requestClose() }}>
    <section className="editor" role="dialog" aria-modal="true" aria-label={entry ? '编辑账单' : '记一笔'}>
      <header className="editor-header"><button type="button" className="icon-button" onClick={categoryView !== 'list' ? () => { setCategoryView('list'); setError('') } : requestClose} aria-label={categoryView !== 'list' ? '返回记账' : '关闭'}>{categoryView !== 'list' ? <ChevronLeft size={22}/> : <X size={22}/>}</button><strong>{categoryView === 'manage' ? '管理分类' : categoryView === 'new' ? '新增分类' : entry ? '编辑账单' : '记一笔'}</strong><span style={{width:40}}/></header>
      {categoryView === 'new' && <form className="inline-category-form editor-scroller" onSubmit={createInlineCategory}>
        <p>新增{type === 'expense' ? '支出' : '收入'}分类，完成后将自动选中；已填写的金额、日期和备注都会保留。</p>
        <label htmlFor="new-category-name">分类名称</label>
        <input id="new-category-name" maxLength={20} autoFocus placeholder="例如：宠物、旅行" value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)}/>
        <label>选择图标</label><IconPicker value={newCategoryIcon} onChange={setNewCategoryIcon}/>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="save-button" disabled={!newCategoryName.trim() || categoryBusy} type="submit">{categoryBusy ? '添加中…' : '添加并选中'}</button>
      </form>}
      {categoryView === 'manage' && <div className="editor-scroller"><CategoryManager categories={categories} initialType={type} /></div>}
      <form id="entry-editor-form" className="editor-scroller entry-editor-form" hidden={categoryView !== 'list'} onSubmit={submit}>
        <div className="type-toggle"><button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => {setType('expense');setCategoryId('')}}>支出</button><button type="button" className={type === 'income' ? 'active' : ''} onClick={() => {setType('income');setCategoryId('')}}>收入</button></div>
        <label className="amount-label" htmlFor="amount">金额（人民币）</label>
        <div className="money-input"><span>¥</span><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} readOnly={customKeypad} onChange={event => {setAmount(event.target.value);setError('')}} aria-label="记账金额" /></div>
        <div className="amount-calc-bar" role="group" aria-label="金额加减计算">
          <span className="amount-calc-preview" aria-live="polite">{pendingCalc ? `¥${money(pendingCalc.baseMinor)} ${pendingCalc.operator}` : '可直接加减金额'}</span>
          <button type="button" onClick={()=>startCalc('+')} aria-label="加">＋</button>
          <button type="button" onClick={()=>startCalc('-')} aria-label="减">−</button>
          <button type="button" onClick={finishCalc} aria-label="等于">＝</button>
        </div>
        <div className="keypad-mode"><button type="button" onClick={()=>setCustomKeypad(value=>!value)}>{customKeypad?'使用系统键盘':'使用记账数字键盘'}</button></div>
        {customKeypad && <div className="amount-keypad" role="group" aria-label="记账数字键盘">
          {keypadKeys.map(key=><button key={key} type="button" className={key==='backspace'?'key-backspace':''}
            aria-label={key==='backspace'?'删除末位数字':key==='.'?'小数点':`数字${key}`}
            onClick={()=>applyAmountKey(key)}>{key==='backspace'?<Delete size={22}/>:key}</button>)}
        </div>}
        {!entry && lastEntryOfType(entries, type) && <button type="button" className="copy-last" onClick={() => {
          const previous = lastEntryOfType(entries, type)!
          setAmount((previous.amountMinor / 100).toFixed(2))
          setPendingCalc(null)
          setCategoryId(previous.categoryId)
          setNote(previous.note)
          setError('')
        }}>复制上一笔金额、分类与备注（请核对后保存）</button>}
        <h3 className="section-label">选择分类</h3>
        <div className="categories">{available.map(c => {const Icon = icons[c.icon] ?? Ellipsis;return <button type="button" key={c.id} onClick={() => setCategoryId(c.id)} className={selected === c.id ? 'category chosen' : 'category'}><Icon size={20}/><span>{c.name}</span></button>})}<button type="button" className="category category-add" onClick={() => {setCategoryView('new');setError('')}}><Plus size={20}/><span>新增分类</span></button></div>
        <button type="button" className="manage-category-link" onClick={() => {setCategoryView('manage');setError('')}}>管理分类 <ChevronRight size={16}/></button>
        <div className="form-fields"><label>日期<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>备注（可选）<input maxLength={200} placeholder="写点什么…" value={note} onChange={e => setNote(e.target.value)} /></label></div>
        {error && <p className="error" role="alert">{error}</p>}
        {entry && <button className="copy-entry-button" type="button" disabled={busy} onClick={() => onDuplicate(entry)}>复制为新账单 <ChevronRight size={16}/></button>}
        {entry && <button className="delete-button" type="button" disabled={busy} onClick={remove}><Trash2 size={16}/> 删除这笔记录</button>}
      </form>
      {motionState === 'saved' && <div className="motion-save-success" role="status" aria-live="polite"><span className="motion-save-check">✓</span><strong>{entry ? '修改已保存' : `已记下 ¥${money(parseAmountMinor(amount) ?? 0)}`}</strong></div>}
      {categoryView === 'list' && <footer className="editor-footer">
        <div className="editor-footer-actions">
          {!entry && <button className="save-again-button" type="submit" form="entry-editor-form" data-action="again" disabled={busy}>保存并继续</button>}
          <button className="save-button" type="submit" form="entry-editor-form" disabled={busy} aria-busy={busy}>{busy ? '保存中…' : entry ? '保存修改' : '保存记录'}</button>
        </div>
      </footer>}
    </section>
  </div>, document.body)
}

