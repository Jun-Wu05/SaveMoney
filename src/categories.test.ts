import { describe, expect, it } from 'vitest'
import { hasDuplicateCategoryName, normalizeCategoryName } from './categories'
import type { Category } from './db'

const categories: Category[] = [{id:'food',name:'餐饮',type:'expense',icon:'utensils',sortOrder:1}]

describe('category validation', () => {
  it('trims valid category names', () => expect(normalizeCategoryName('  宠物  ')).toBe('宠物'))
  it('rejects empty and overlong names', () => {
    expect(() => normalizeCategoryName('  ')).toThrow()
    expect(() => normalizeCategoryName('太'.repeat(21))).toThrow()
  })
  it('prevents duplicate names for same type', () => {
    expect(hasDuplicateCategoryName(categories,'expense','餐饮')).toBe(true)
    expect(hasDuplicateCategoryName(categories,'income','餐饮')).toBe(false)
    expect(hasDuplicateCategoryName(categories,'expense','餐饮','food')).toBe(false)
  })
})
