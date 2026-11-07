import { describe, expect, it } from 'vitest'
import { findGoods, searchReason } from './GoodsPage'
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
  for(const term of ['优衣库','2026-11-07','799','保暖','推荐'])expect(findGoods([item],cats,term)).toHaveLength(1)
 })
 it('uses AND for multiple words and matches no unrelated goods',()=>{
  expect(findGoods([item],cats,'羽绒服 京东')).toHaveLength(0)
 })
})

describe('搜索匹配原因',()=>{
 it('shows matching field when a numeric detail is searched',()=>{
  expect(searchReason(item,cats,'90%')).toContain('商品要点：')
  expect(searchReason(item,cats,'2026-11','date')).toContain('购买日期：')
  expect(searchReason(item,cats,'799')).toContain('购买价格：')
 })
 it('returns category path for a category match',()=>{
  expect(searchReason(item,cats,'服装')).toContain('分类：')
 })
})

describe('按字段搜索和精确数字规则',()=>{
 it('商品名称搜索不会被日期中的单个数字误命中',()=>{
  expect(findGoods([item],cats,'1','name')).toHaveLength(0)
  expect(findGoods([item],cats,'羽绒服','name')).toHaveLength(1)
 })
 it('全部字段搜索不会把 1 匹配到 2026-11-07 或 799 元',()=>{
  expect(findGoods([{...item,highlights:'',review:''}],cats,'1','all')).toHaveLength(0)
  expect(findGoods([item],cats,'2026-11-07','all')).toHaveLength(1)
 })
 it('价格必须完整数值匹配，不是任意子串',()=>{
  expect(findGoods([item],cats,'799','price')).toHaveLength(1)
  expect(findGoods([item],cats,'799.00','price')).toHaveLength(1)
  expect(findGoods([item],cats,'9','price')).toHaveLength(0)
 })
 it('日期仅在日期模式支持按月筛选',()=>{
  expect(findGoods([item],cats,'2026-11','date')).toHaveLength(1)
  expect(findGoods([item],cats,'1','date')).toHaveLength(0)
 })
 it('商品要点与分类独立选择，搜索结果展示指定字段',()=>{
  expect(findGoods([item],cats,'90%','highlights')).toHaveLength(1)
  expect(findGoods([item],cats,'90%','name')).toHaveLength(0)
  expect(findGoods([item],cats,'服装','category')).toHaveLength(1)
  expect(searchReason(item,cats,'服装','category')).toContain('分类：')
 })
})
