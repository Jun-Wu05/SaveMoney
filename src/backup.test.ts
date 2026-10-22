import { describe, expect, it } from 'vitest'
import { validateBackupText } from './backup'

const sample = {
  format: 'savemoney-backup',
  version: 1,
  exportedAt: '2026-10-22T00:00:00.000Z',
  categories: [{ id:'food',name:'餐饮',type:'expense',icon:'utensils',sortOrder:0 }],
  entries: [{id:'a',type:'expense',amountMinor:1299,categoryId:'food',date:'2026-10-22',note:'测试',createdAt:'2026-10-22T00:00:00.000Z',updatedAt:'2026-10-22T00:00:00.000Z'}],
}

describe('backup validation', () => {
  it('accepts a valid backup', () => expect(validateBackupText(JSON.stringify(sample)).entries).toHaveLength(1))
  it('rejects malformed JSON', () => expect(() => validateBackupText('{bad')).toThrow())
  it('rejects missing linked categories', () => expect(() => validateBackupText(JSON.stringify({...sample,categories:[]}))).toThrow())
  it('rejects duplicate transaction ids', () => expect(() => validateBackupText(JSON.stringify({...sample,entries:[sample.entries[0],sample.entries[0]]}))).toThrow())
  it('rejects nonpositive amounts', () => expect(() => validateBackupText(JSON.stringify({...sample,entries:[{...sample.entries[0],amountMinor:0}]}))).toThrow())
  it('rejects invalid dates', () => expect(() => validateBackupText(JSON.stringify({...sample,entries:[{...sample.entries[0],date:'2026-02-31'}]}))).toThrow())
})
