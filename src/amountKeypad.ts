/** Page-local keypad: no database changes and no floating-point calculations. */
export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'
export function pressAmountKey(current: string, key: AmountKey): string {
  if (key === 'backspace') return current.slice(0, -1)
  if (key === '.') return current.includes('.') ? current : (current || '0') + '.'
  const normalized = current === '0' ? (key === '0' ? '0' : key) : current + key
  const [integer, fraction] = normalized.split('.')
  if (integer.length > 9 || (fraction !== undefined && fraction.length > 2)) return current
  return normalized
}
