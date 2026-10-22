import { describe, it, expect } from 'vitest'
import { chartSlices } from './SpendingDonut'

describe('donut data model', () => {
  it('preserves up to six valid categories', () => {
    expect(chartSlices([{ id:'a',name:'A',amount:100 },{ id:'b',name:'B',amount:0 }])).toEqual([{ id:'a',name:'A',amount:100 }])
  })
  it('groups remaining categories without losing cents', () => {
    const data = Array.from({length:8},(_,i)=>({id:String(i),name:String(i),amount:100-i}))
    const slices=chartSlices(data)
    expect(slices).toHaveLength(6)
    expect(slices.reduce((sum,item)=>sum+item.amount,0)).toBe(data.reduce((sum,item)=>sum+item.amount,0))
    expect(slices[5].name).toBe('其他分类')
  })
})
