import {describe,it,expect} from 'vitest'
import {preferredCategories,lastEntryOfType} from './quickEntry'
import type {Entry,Category} from './db'
const cats=[{id:'a',type:'expense',sortOrder:1},{id:'b',type:'expense',sortOrder:2}] as Category[]
const e=(id:string,date:string,categoryId:string):Entry=>({id,date,categoryId,type:'expense',note:'',amountMinor:100,createdAt:date+'T00:00:00Z',updatedAt:date+'T00:00:00Z'})
describe('quick entry',()=>{it('matches settings category order even when another category is used more frequently',()=>expect(preferredCategories([e('1','2026-10-01','b'),e('2','2026-10-02','b'),e('3','2026-10-03','a')],cats,'expense').map(c=>c.id)).toEqual(['a','b']));it('gets latest record',()=>expect(lastEntryOfType([e('1','2026-09-01','a'),e('2','2026-10-01','b')],'expense')?.id).toBe('2'))})
