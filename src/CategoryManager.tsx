import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { type Category, type TransactionType } from './db'
import { addCategory, updateCategoryDetails, deleteUnusedCategory } from './categories'
import { IconPicker } from './categoryIcons'

export function CategoryManager({ categories, initialType = 'expense' }: { categories: Category[]; initialType?: TransactionType }) {
  const [type, setType] = useState<TransactionType>(initialType)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('ellipsis')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('ellipsis')
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

