import {describe,expect,it} from 'vitest'
import {shouldRestoreGoodsZoom} from './goodsPwaZoom'

describe('iPhone standalone PWA input zoom recovery',()=>{
 it('restores only focus-induced scaling in installed PWA',()=>{
  expect(shouldRestoreGoodsZoom(true,1,1.4,false)).toBe(true)
  expect(shouldRestoreGoodsZoom(true,1,1,false)).toBe(false)
  expect(shouldRestoreGoodsZoom(false,1,1.4,false)).toBe(false)
 })
 it('preserves deliberate accessibility/pinch zoom',()=>{
  expect(shouldRestoreGoodsZoom(true,1,1.5,true)).toBe(false)
  expect(shouldRestoreGoodsZoom(true,1.6,1.6,false)).toBe(false)
 })
})
