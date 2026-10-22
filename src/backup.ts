import { db, type Category, type Entry } from './db'

export const BACKUP_FORMAT = 'savemoney-backup'
export const BACKUP_VERSION = 1
const MAX_BACKUP_CHARS = 20_000_000
const MAX_ITEMS = 100_000

export type BackupData = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  entries: Entry[]
  categories: Category[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max

const isIsoDate = (date: unknown): date is string => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(0)
  d.setFullYear(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))

function validEntry(value: unknown): value is Entry {
  if (!isObject(value)) return false
  return (
    isString(value.id, 100) && value.id.length > 0 &&
    (value.type === 'expense' || value.type === 'income') &&
    typeof value.amountMinor === 'number' && Number.isSafeInteger(value.amountMinor) &&
    value.amountMinor > 0 && value.amountMinor <= 99_999_999_999 &&
    isString(value.categoryId, 100) && value.categoryId.length > 0 &&
    isIsoDate(value.date) && isString(value.note, 200) &&
    isTimestamp(value.createdAt) && isTimestamp(value.updatedAt)
  )
}

function validCategory(value: unknown): value is Category {
  if (!isObject(value)) return false
  return (
    isString(value.id, 100) && value.id.length > 0 &&
    isString(value.name, 40) && value.name.trim().length > 0 &&
    (value.type === 'expense' || value.type === 'income') &&
    isString(value.icon, 50) &&
    typeof value.sortOrder === 'number' && Number.isSafeInteger(value.sortOrder) &&
    value.sortOrder >= 0 && value.sortOrder < 100_000
  )
}

export function validateBackupText(text: string): BackupData {
  if (text.length > MAX_BACKUP_CHARS) throw new Error('备份文件过大，已拒绝导入')
  let data: unknown
  try { data = JSON.parse(text) }
  catch { throw new Error('不是有效的 JSON 备份文件') }
  if (!isObject(data) || data.format !== BACKUP_FORMAT || data.version !== BACKUP_VERSION) {
    throw new Error('备份格式或版本不受支持')
  }
  if (!isTimestamp(data.exportedAt) || !Array.isArray(data.entries) || !Array.isArray(data.categories)) {
    throw new Error('备份缺少必要字段')
  }
  if (data.entries.length > MAX_ITEMS || data.categories.length > 5000) {
    throw new Error('备份记录数量超出允许范围')
  }
  if (!data.entries.every(validEntry) || !data.categories.every(validCategory)) {
    throw new Error('备份中包含无效交易或分类')
  }
  const entries = data.entries as Entry[]
  const categories = data.categories as Category[]
  const uniqueEntryIds = new Set(entries.map(e => e.id))
  const uniqueCategoryIds = new Set(categories.map(c => c.id))
  if (uniqueEntryIds.size !== entries.length || uniqueCategoryIds.size !== categories.length) {
    throw new Error('备份包含重复的记录 ID')
  }
  const index = new Map(categories.map(c => [c.id, c.type]))
  if (entries.some(e => index.get(e.categoryId) !== e.type)) {
    throw new Error('备份存在缺失或类型错误的分类')
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: data.exportedAt, entries, categories }
}

export async function createBackup(): Promise<BackupData> {
  const [entries, categories] = await Promise.all([db.entries.toArray(), db.categories.toArray()])
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), entries, categories }
}

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadBackup() {
  const backup = await createBackup()
  const date = new Date().toLocaleDateString('sv-SE')
  download(`SaveMoney-backup-${date}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
}

const csvSafe = (value: string) => {
  const protectedValue = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${protectedValue.replace(/"/g, '""')}"`
}

export async function downloadCsv() {
  const [entries, categories] = await Promise.all([db.entries.toArray(), db.categories.toArray()])
  const names = new Map(categories.map(c => [c.id, c.name]))
  const rows = [['日期', '类型', '金额(元)', '分类', '备注']]
  for (const e of entries.sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([e.date, e.type === 'expense' ? '支出' : '收入', (e.amountMinor / 100).toFixed(2), names.get(e.categoryId) ?? '其他', e.note])
  }
  const csv = '\uFEFF' + rows.map(row => row.map(csvSafe).join(',')).join('\r\n')
  download(`SaveMoney-账单-${new Date().toLocaleDateString('sv-SE')}.csv`, csv, 'text/csv;charset=utf-8')
}

export async function restoreBackup(backup: BackupData): Promise<void> {
  // 再次校验，以防传入的对象在预览后被修改。
  const safe = validateBackupText(JSON.stringify(backup))
  await db.transaction('rw', db.entries, db.categories, async () => {
    await db.entries.clear()
    await db.categories.clear()
    await db.categories.bulkAdd(safe.categories)
    await db.entries.bulkAdd(safe.entries)
  })
}
