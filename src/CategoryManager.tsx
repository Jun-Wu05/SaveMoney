import { useEffect, useRef, useState } from 'react'
import { type Category, type TransactionType } from './db'
import { addCategory, updateCategoryDetails, deleteUnusedCategory, reorderCategories } from './categories'
import { IconPicker } from './categoryIcons'
import { Menu } from 'lucide-react'

export function CategoryManager({ categories, initialType = 'expense' }: { categories: Category[]; initialType?: TransactionType }) {
  const [type, setType] = useState<TransactionType>(initialType)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('ellipsis')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('ellipsis')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)


  const [orderPreview, setOrderPreview] = useState<string[] | null>(null)
  const previewRef = useRef<string[] | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; startY: number; moved: boolean } | null>(null)
  useEffect(() => { previewRef.current = null; setOrderPreview(null) }, [categories, type])
  function setPreview(ids: string[] | null) { previewRef.current = ids; setOrderPreview(ids) }
  function onDragStart(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (busy || editingId || dragRef.current) return
    const row = event.currentTarget.closest<HTMLElement>('[data-category-sort-id]')
    const list = row?.parentElement
    if (!row || !list) return
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-category-sort-id]'))
    const ids = rows.map(el => el.dataset.categorySortId ?? '')
    const startIndex = ids.indexOf(id)
    const startY = event.clientY
    const rowHeight = row.getBoundingClientRect().height
    const centers = rows.map(el => { const rect = el.getBoundingClientRect(); return rect.top + rect.height / 2 })
    let currentY = startY
    let targetIndex = startIndex
    let moved = false
    let raf = 0
    dragRef.current = { id, pointerId: event.pointerId, startY, moved: false }
    // Keep the real row in the list: no cloned card, no empty placeholder.
    row.style.position = 'relative'
    row.style.zIndex = '3'
    row.style.willChange = 'transform'
    row.style.background = 'var(--card-bg, #fff)'
    row.style.boxShadow = '0 8px 22px rgba(0,0,0,.10)'
    row.style.borderRadius = '10px'
    const tick = () => {
      if (!dragRef.current) return
      const delta = currentY - startY
      row.style.transform = `translate3d(0,${delta}px,0)`
      if (moved) {
        const midpoint = centers[startIndex] + delta
        let next = 0
        for (let i = 0; i < centers.length; i++) if (midpoint > centers[i]) next = i
        if (next !== targetIndex) {
          targetIndex = next
          rows.forEach((el, index) => {
            if (index === startIndex) return
            const shift = startIndex < targetIndex && index > startIndex && index <= targetIndex ? -rowHeight
              : startIndex > targetIndex && index >= targetIndex && index < startIndex ? rowHeight : 0
            el.style.transition = 'transform 190ms cubic-bezier(.2,.8,.2,1)'
            el.style.transform = shift ? `translate3d(0,${shift}px,0)` : ''
          })
        }
        const edge = 65
        if (currentY < edge) window.scrollBy(0, -Math.min(9, (edge - currentY) / 7))
        else if (currentY > window.innerHeight - edge) window.scrollBy(0, Math.min(9, (currentY - window.innerHeight + edge) / 7))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return
      currentY = e.clientY
      if (Math.abs(currentY - startY) > 4) {
        moved = true
        if (dragRef.current) dragRef.current.moved = true
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      cancelAnimationFrame(raf)
      rows.forEach(el => {
        el.style.transform = ''
        el.style.transition = ''
      })
      row.style.position = ''
      row.style.zIndex = ''
      row.style.willChange = ''
      row.style.background = ''
      row.style.boxShadow = ''
      row.style.borderRadius = ''
    }
    const finish = (cancelled: boolean) => {
      if (!dragRef.current) return
      dragRef.current = null
      cleanup()
      if (!cancelled && moved && targetIndex !== startIndex) {
        const next = [...ids]
        next.splice(startIndex, 1)
        next.splice(targetIndex, 0, id)
        setPreview(next)
        void perform(() => reorderCategories(type, next), () => setPreview(null))
      }
    }
    const up = (e: PointerEvent) => { if (e.pointerId === event.pointerId) finish(false) }
    const cancel = (e: PointerEvent) => { if (e.pointerId === event.pointerId) finish(true) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }
  function moveByKey(id: string, direction: number) {
    if (busy) return
    const ids = shown.map(c => c.id), current = ids.indexOf(id), target = current + direction
    if (current < 0 || target < 0 || target >= ids.length) return
    ;[ids[current], ids[target]] = [ids[target], ids[current]]
    setPreview(ids)
    void perform(() => reorderCategories(type, ids), () => setPreview(null))
  }

  async function perform(action: () => Promise<void>, after?: () => void) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action(); after?.() }
    catch (e) { setError(e instanceof Error ? e.message : '操作失败，请重试') }
    finally { setBusy(false) }
  }

  const ordered = categories.filter(c => c.type === type).sort((a,b) => a.sortOrder - b.sortOrder)
  const shown = orderPreview ? [...ordered].sort((a,b) => orderPreview.indexOf(a.id) - orderPreview.indexOf(b.id)) : ordered

  return <div className="setting-card category-manager">
    <h3>分类管理</h3>
    <p>可以新增、重命名分类。按住右侧手柄上下拖动排序；顺序同步到「记一笔」。</p>
    <div className="type-toggle compact-toggle">
      <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => {setType('expense');setEditingId(null);setError('')}}>支出分类</button>
      <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => {setType('income');setEditingId(null);setError('')}}>收入分类</button>
    </div>
    <div className="manage-list">{shown.map(category => <div className={`manage-category ${draggingId === category.id ? "is-dragging" : ""}`} data-category-sort-id={category.id} key={category.id}>
      {editingId === category.id ? <>
        <input aria-label="编辑分类名称" maxLength={20} value={editName} onChange={e => setEditName(e.target.value)}/>
        <IconPicker value={editIcon} onChange={setEditIcon}/>
        <button type="button" disabled={busy} onClick={() => void perform(() => updateCategoryDetails(category.id,editName,editIcon),() => setEditingId(null))}>保存</button>
        <button type="button" disabled={busy} onClick={() => setEditingId(null)}>取消</button>
      </> : <>
        <span>{category.name}</span>
        <button type="button" disabled={busy} onClick={() => {setEditingId(category.id);setEditName(category.name);setEditIcon(category.icon);setError('')}}>编辑</button>
        <button type="button" disabled={busy} onClick={() => {
          if (window.confirm(`确定删除「${category.name}」？已有账单的分类无法删除。`))
            void perform(() => deleteUnusedCategory(category.id))
        }}>删除</button>
        <button type="button" className="category-sort-handle" disabled={busy} aria-label={`调整${category.name}顺序，长按拖动或使用上下方向键`} title="按住拖动排序" onPointerDown={event => onDragStart(event, category.id)} style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); moveByKey(category.id, event.key === 'ArrowUp' ? -1 : 1) } }}><Menu size={21}/></button>
      </>}
    </div>)}</div>
    <form className="manage-add" onSubmit={e => {e.preventDefault(); void perform(async () => { await addCategory(type,newName,newIcon) },() => {setNewName('');setNewIcon('ellipsis')})}}>
      <input aria-label="新分类名称" maxLength={20} placeholder="添加新分类，如 宠物" value={newName} onChange={e => setNewName(e.target.value)}/>
      <button disabled={busy || !newName.trim()} type="submit">添加</button>
      <IconPicker value={newIcon} onChange={setNewIcon}/>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}

