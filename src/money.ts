import type { Entry } from './db'

export function parseAmountMinor(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, decimal = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

export function money(minor: number): string {
  return (minor / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function sumMinor(entries: Entry[], type: Entry['type']): number {
  return entries.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amountMinor, 0)
}

export function localDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
