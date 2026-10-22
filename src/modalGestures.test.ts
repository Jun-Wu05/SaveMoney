import { describe, expect, it } from 'vitest'
import { blockSheetTouchMove } from './modalGestures'
const common = { inScroller:true, scrollTop:75, scrollHeight:600, clientHeight:300 }
describe('iOS editor gestures', () => {
  it('allows ordinary vertical movement', () => {
    expect(blockSheetTouchMove({...common,deltaX:3,deltaY:-25})).toBe(false)
    expect(blockSheetTouchMove({...common,deltaX:-4,deltaY:32})).toBe(false)
  })
  it('blocks sideways swipe even inside the editor', () => {
    expect(blockSheetTouchMove({...common,deltaX:35,deltaY:12})).toBe(true)
    expect(blockSheetTouchMove({...common,deltaX:-25,deltaY:4})).toBe(true)
  })
  it('blocks overscroll/bounce at the top and bottom', () => {
    expect(blockSheetTouchMove({...common,scrollTop:0,deltaX:0,deltaY:20})).toBe(true)
    expect(blockSheetTouchMove({...common,scrollTop:300,deltaX:0,deltaY:-20})).toBe(true)
    expect(blockSheetTouchMove({...common,scrollHeight:250,deltaX:0,deltaY:-20})).toBe(true)
  })
  it('prevents a gesture outside the scrolling region', () => {
    expect(blockSheetTouchMove({...common,inScroller:false,deltaX:0,deltaY:20})).toBe(true)
  })
})
