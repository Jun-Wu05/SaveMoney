import { describe, expect, it } from 'vitest'
import { parseAmountMinor, money } from './money'

describe('amount handling', () => {
  it('parses valid RMB values in integer cents', () => {
    expect(parseAmountMinor('28.50')).toBe(2850)
    expect(parseAmountMinor('0.01')).toBe(1)
    expect(parseAmountMinor('20')).toBe(2000)
  })
  it('rejects invalid or zero values', () => {
    for (const value of ['0', '-1', '1.234', 'abc', '', '01', '0.00']) {
      expect(parseAmountMinor(value)).toBeNull()
    }
  })
  it('renders two decimals', () => {
    expect(money(2850)).toBe('28.50')
  })
})
