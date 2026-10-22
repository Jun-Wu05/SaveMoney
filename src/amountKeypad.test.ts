import { describe, expect, it } from 'vitest'
import { pressAmountKey } from './amountKeypad'

describe('amount keypad', () => {
  it('starts a decimal with zero', () => {
    expect(pressAmountKey('', '.')).toBe('0.')
    expect(pressAmountKey('0.', '5')).toBe('0.5')
  })
  it('prevents duplicate decimal points and more than 2 decimal places', () => {
    expect(pressAmountKey('12.34', '5')).toBe('12.34')
    expect(pressAmountKey('12.34', '.')).toBe('12.34')
  })
  it('prevents leading zeros and oversized integers', () => {
    expect(pressAmountKey('0', '8')).toBe('8')
    expect(pressAmountKey('123456789', '0')).toBe('123456789')
  })
  it('supports deletion back to blank', () => {
    expect(pressAmountKey('25.0', 'backspace')).toBe('25.')
    expect(pressAmountKey('2', 'backspace')).toBe('')
  })
})
