import { parseAmountMinor } from './money'
export type CalcOperator = '+' | '-'
export type CalcPending = { baseMinor: number; operator: CalcOperator } | null
export type CalcResult = { amountMinor: number; display: string } | { error: string }

/** Money calculations are performed in integer cents, never JS floats. */
export function calculateAmount(pending: CalcPending, input: string): CalcResult {
  const right = parseAmountMinor(input)
  if (right === null) return { error: '请输入有效金额后再计算' }
  const result = pending ? pending.operator === '+' ? pending.baseMinor + right : pending.baseMinor - right : right
  if (!Number.isSafeInteger(result) || result <= 0) return { error: '计算结果必须大于零' }
  if (result > 99_999_999_999) return { error: '计算结果超出允许金额' }
  const whole = Math.floor(result / 100)
  if (whole > 999_999_999) return { error: '计算结果超出输入范围' }
  return { amountMinor: result, display: (result / 100).toFixed(2) }
}

/** Finalize an entry even if an operator is pending without a right-hand amount. */
export function finalizeAmount(pending: CalcPending, input: string): CalcResult {
  if (pending && input.trim() === '') return {
    amountMinor: pending.baseMinor,
    display: (pending.baseMinor / 100).toFixed(2),
  }
  return calculateAmount(pending, input)
}
