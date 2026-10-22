export type ImportedBill = { date: string; type: 'expense' | 'income'; amountMinor: number; category: string; note: string }
export type CsvImportPreview = { rows: ImportedBill[]; errors: { line: number; message: string }[] }

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell === '') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      row.push(cell); rows.push(row); row = []; cell = ''
      if (char === '\r' && source[i + 1] === '\n') i++
    } else cell += char
  }
  if (quoted) throw new Error('CSV 引号未正确闭合')
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function parseSaveMoneyCsv(text: string): CsvImportPreview {
  const data = parseRows(text)
  if (!data.length || data[0].map(v => v.trim()).join('|') !== '日期|类型|金额(元)|分类|备注') {
    throw new Error('不是 SaveMoney 导出的 CSV 账单格式')
  }
  const rows: ImportedBill[] = [], errors: CsvImportPreview['errors'] = []
  if (data.length > 100_005) throw new Error('CSV 记录过多')
  for (let i = 1; i < data.length; i++) {
    const fields = data[i]
    if (fields.every(v => !v.trim())) continue
    if (fields[0].trim() === '全部汇总' || (!fields[0].trim() && ['收入合计', '支出合计', '收支结余'].includes(fields[1]?.trim()))) continue
    const [date, type, amount, category, note] = fields.map(v => v.trim())
    const amountMatch = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(amount ?? '')
    const amountMinor = amountMatch ? Number(amountMatch[1]) * 100 + Number((amountMatch[2] ?? '').padEnd(2, '0')) : 0
    if (fields.length !== 5 || !validDate(date ?? '') || !['支出', '收入'].includes(type) || !amountMatch || amountMinor <= 0 || !category || category.length > 40 || (note ?? '').length > 200) {
      errors.push({ line: i + 1, message: '日期、类型、金额、分类或备注格式不正确' })
      continue
    }
    rows.push({ date, type: type === '收入' ? 'income' : 'expense', amountMinor, category, note: note ?? '' })
  }
  return { rows, errors }
}
