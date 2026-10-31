import { useEffect, useRef, useState } from 'react'
import { type Category, type TransactionType } from './db'
import { addCategory, updateCategoryDetails, deleteUnusedCategory, reorderCategories } from './categories'
import { IconPicker } from './categoryIcons'
import { GripVertical } from 'lucide-react'

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
    if (busy || editingId) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id, pointerId: event.pointerId, startY: event.clientY, moved: false }
    setDraggingId(id)
  }
  function onDragMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (Math.abs(event.clientY - drag.startY) > 5) drag.moved = true
    if (!drag.moved) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-category-sort-id]')?.dataset.categorySortId
    if (!target) return
    const current = previewRef.current ?? shown.map(c => c.id)
    const from = current.indexOf(drag.id), to = current.indexOf(target)
    if (from < 0 || to < 0 || from === to) return
    const next = [...current]; next.splice(from, 1); next.splice(to, 0, drag.id)
    setPreview(next)
  }
  function onDragEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null; setDraggingId(null)
    const ids = previewRef.current
    if (ids && drag.moved) void perform(() => reorderCategories(type, ids), () => setPreview(null))
    else setPreview(null)
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
        <button type="button" className="category-sort-handle" disabled={busy} aria-label={`调整${category.name}顺序，长按拖动或使用上下方向键`} title="按住拖动排序" onPointerDown={event => onDragStart(event, category.id)} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={event => { if (dragRef.current?.pointerId === event.pointerId) { dragRef.current = null; setDraggingId(null); setPreview(null) } }} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); moveByKey(category.id, event.key === 'ArrowUp' ? -1 : 1) } }}><GripVertical size={21}/></button>
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

