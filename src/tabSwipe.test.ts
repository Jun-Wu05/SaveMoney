import { describe, expect, it } from 'vitest'
import { classifyTabSwipe, tabFromSwipe } from './tabSwipe'
describe('four-tab swipe', () => {
  it('allows both directions and wraps around the four tabs', () => {
    expect(tabFromSwipe('home', -100, 10)).toBe('list')
    expect(tabFromSwipe('list', 100, 10)).toBe('home')
    expect(tabFromSwipe('settings', -100, 10)).toBe('home')
    expect(tabFromSwipe('home', 100, 10)).toBe('settings')
    expect(tabFromSwipe('stats', -90, 10)).toBe('settings')
  })
  it('does not hijack ordinary vertical scroll or small drags', () => {
    expect(tabFromSwipe('home', 45, 8)).toBeNull()
    expect(tabFromSwipe('home', 90, 115)).toBeNull()
    expect(classifyTabSwipe(3, 8, 'pending')).toBe('pending')
    expect(classifyTabSwipe(18, 35, 'pending')).toBe('vertical')
    expect(classifyTabSwipe(35, 7, 'pending')).toBe('horizontal')
    expect(classifyTabSwipe(45, 3, 'vertical')).toBe('vertical')
  })
})
