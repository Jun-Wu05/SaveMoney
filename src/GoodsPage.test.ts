import { describe, expect, it } from 'vitest'
import { findGoods } from './GoodsPage'
import type { Good, GoodCategory } from './db'

const cats: GoodCategory[] = [
 {id:'clothes',name:'服装',parentId:null,sortOrder:0},
 {id:'tops',name:'上衣',parentId:'clothes',sortOrder:1},
 {id:'coats',name:'羽绒服',parentId:'tops',sortOrder:2},
]
const item:Good = {id:'1',name:'轻量羽绒服',categoryId:'coats',brand:'优衣库',date:'2026-11-07',priceMinor:79900,
 highlights:'填充物：白鸭绒\n绒子含量：90%\n充绒量：180g',review:'保暖舒适，值得回购',rating:'recommend',image:'',
 createdAt:'2026-11-07T01:00:00.000Z',updatedAt:'2026-11-07T01:00:00.000Z'}
describe('好物全字段搜索',()=>{
 it('searches nested category paths and arbitrary parameter text',()=>{
  expect(findGoods([item],cats,'服装 90%')).toHaveLength(1)
  expect(findGoods([item],cats,'白鸭绒 180g')).toHaveLength(1)
 })
 it('matches brand, dates, notes, prices and ratings',()=>{
  for(const term of ['优衣库','2026-11','799','保暖','推荐'])expect(findGoods([item],cats,term)).toHaveLength(1)
 })
 it('uses AND for multiple words and matches no unrelated goods',()=>{
  expect(findGoods([item],cats,'羽绒服 京东')).toHaveLength(0)
 })
})
