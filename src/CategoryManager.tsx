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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  useEffect(() => { previewRef.current = null; setOrderPreview(null) }, [categories, type])
  function setPreview(ids: string[] | null) { previewRef.current = ids; setOrderPreview(ids) }
  function onDragStart(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (busy || editingId || dragRef.current) return
    const row = event.currentTarget.closest<HTMLElement>('[data-category-sort-id]')
    if (!row) return
    const rect = row.getBoundingClientRect()
    const ids = shown.map(c => c.id)
    dragRef.current = { id, pointerId: event.pointerId, startY: event.clientY, moved: false }
    setDraggingId(id)
    const ghost = row.cloneNode(true) as HTMLElement
    ghost.removeAttribute('data-category-sort-id')
    Object.assign(ghost.style, {
      position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px', margin: '0',
      zIndex: '9999', pointerEvents: 'none', transform: 'scale(1.02)',
      boxShadow: '0 10px 28px rgba(0,0,0,.18)', background: '#fff',
      borderRadius: '12px', willChange: 'transform'
    })
    document.body.appendChild(ghost)
    let y = event.clientY
    let raf = 0
    let lastTarget = ''
    const tick = () => {
      const drag = dragRef.current
      if (!drag) return
      ghost.style.transform = `translate3d(0,${y - drag.startY}px,0) scale(1.02)`
      const rows = Array.from(document.querySelectorAll<HTMLElement>('.category-manager [data-category-sort-id]'))
      const target = rows.find(el => el.dataset.categorySortId !== id && y >= el.getBoundingClientRect().top && y < el.getBoundingClientRect().bottom)
      const targetId = target?.dataset.categorySortId ?? ''
      if (drag.moved && targetId && targetId !== lastTarget) {
        const current = previewRef.current ?? ids
        const from = current.indexOf(id), to = current.indexOf(targetId)
        if (from >= 0 && to >= 0 && from !== to) {
          const next = [...current]
          next.splice(from, 1)
          next.splice(to, 0, id)
          setPreview(next)
        }
        lastTarget = targetId
      }
      if (drag.moved) {
        const edge = 72
        if (y < edge) window.scrollBy(0, -Math.min(12, (edge - y) / 5))
        else if (y > window.innerHeight - edge) window.scrollBy(0, Math.min(12, (y - window.innerHeight + edge) / 5))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId || !dragRef.current) return
      y = e.clientY
      if (Math.abs(y - dragRef.current.startY) > 4) dragRef.current.moved = true
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      cancelAnimationFrame(raf)
      ghost.remove()
    }
    const finish = (cancelled: boolean) => {
      const drag = dragRef.current
      if (!drag) return
      cleanup()
      dragRef.current = null
      setDraggingId(null)
      const next = previewRef.current
      if (!cancelled && drag.moved && next && next.join('|') !== ids.join('|')) {
        void perform(() => reorderCategories(type, next), () => setPreview(null))
      } else setPreview(null)
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
    <div className="manage-list">{shown.map(category => <div className={`manage-category ${draggingId === category.id ? "is-dragging" : ""}`} data-category-sort-id={category.id} key={category.id} style={{ opacity: draggingId === category.id ? 0.25 : 1, transition: "opacity 150ms ease" }}>
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

