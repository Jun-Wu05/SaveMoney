import { describe,it,expect } from 'vitest'
import {buildGoodsExportSheets,buildGoodsArchive,goodsCategoryPath,GOODS_ARCHIVE_FORMAT} from './goodsExport'
import {unzipSync} from 'fflate'
import type {Good,GoodCategory} from './db'
const categories:GoodCategory[]=[
 {id:'clothes',name:'服装',parentId:null,sortOrder:0},
 {id:'tops',name:'上衣',parentId:'clothes',sortOrder:0},
 {id:'down',name:'羽绒服',parentId:'tops',sortOrder:0},
 {id:'empty',name:'没商品分类',parentId:null,sortOrder:1}
]
const example:Good={id:'good1',name:'冬季羽绒服',categoryId:'down',brand:'=danger',date:'2026-11-07',priceMinor:79900,
 highlights:'绒子含量：90%\n充绒量：180g',review:'第一天不错\n第二天很暖和',
 rating:'recommend',image:'',createdAt:'2026-11-07T01:00:00Z',updatedAt:'2026-11-07T01:00:00Z'}
describe('我的好物 Excel 导出结构',()=>{
 it('exports 5 sheets with item details and intact multiline notes',()=>{
  const sheets=buildGoodsExportSheets([example],categories)
  expect(sheets.map(s=>s.sheet)).toEqual(['全部好物','分类目录','购买记录','消耗组统计','AI分析说明'])
  expect(sheets[0].data[1].some(cell=>String(cell.value).includes('充绒量：180g'))).toBe(true)
  expect(sheets[0].data[1].some(cell=>String(cell.value).includes('第二天很暖和'))).toBe(true)
  expect(sheets[0].data[1].some(cell=>cell.value===799)).toBe(true)
  expect(sheets[0].data[1].some(cell=>cell.value==="'=danger")).toBe(true)
 })
 it('exports purchase records and consumption group statistics',()=>{
  const group={id:'paper',name:'抽纸',createdAt:'2026-11-07T01:00:00Z'}
  const purchase={id:'p1',goodId:'good1',date:'2026-11-07',priceMinor:1200,quantity:2,note:'回购',createdAt:'2026-11-07T01:00:00Z'}
  const sheets=buildGoodsExportSheets([{...example,consumptionGroupId:'paper'}],categories,new Date().toISOString(),[purchase],[group])
  expect(sheets[2].data[1].some(cell=>cell.value==='回购')).toBe(true)
  expect(sheets[2].data[1].some(cell=>cell.value===24)).toBe(true)
  expect(sheets[3].data[1].some(cell=>cell.value==='抽纸')).toBe(true)
  const archive=buildGoodsArchive([example],categories,new Date().toISOString(),[purchase],[group])
  expect(archive.purchases).toHaveLength(1)
  expect(archive.consumptionGroups).toHaveLength(1)
 })
 it('keeps empty categories and full nested path',()=>{
  expect(goodsCategoryPath('down',categories)).toEqual(['服装','上衣','羽绒服'])
  const sheets=buildGoodsExportSheets([example],categories)
  expect(sheets[1].data.some(row=>row.some(cell=>cell.value==='没商品分类'))).toBe(true)
 })
 it('keeps arbitrary-depth category chains',()=>{
  const deeper:GoodCategory={id:'deep',name:'特殊材质',parentId:'down',sortOrder:0}
  const sheets=buildGoodsExportSheets([{...example,categoryId:'deep'}],[...categories,deeper])
  expect(sheets[0].data[0].some(cell=>cell.value==='第4级分类')).toBe(true)
 })
 it('archives all original item details without unrelated ledger data',()=>{
  const archive=buildGoodsArchive([example],categories)
  expect(archive.format).toBe(GOODS_ARCHIVE_FORMAT)
  expect(archive.goods[0].highlights).toBe(example.highlights)
  expect(archive.goods[0].imageFile).toBeNull()
  expect(archive.categories).toHaveLength(4)
  expect(Object.keys(archive)).not.toContain('entries')
 })
 it('provides embedded-image anchor for saved image',()=>{
  const tiny={...example,image:'data:image/jpeg;base64,/9j/2Q=='}
  const sheets=buildGoodsExportSheets([tiny],categories)
  expect(sheets[0].images?.[0].anchor).toEqual({row:2,column:1})
  expect(sheets[0].images?.[0].width).toBe(64)
  expect(sheets[0].images?.[0].height).toBe(64)
  expect(buildGoodsArchive([tiny],categories).goods[0].imageFile).toBe('images/good1.jpg')
 })
})

describe('生成 Excel 的真实图片嵌入',()=>{
 it('writes an XLSX with a sheet drawing and embedded JPEG media file',async()=>{
  const image={...example,image:'data:image/jpeg;base64,/9j/2Q=='}
  const {default:writeExcelFile}=await import('write-excel-file/node')
  const buffer=await writeExcelFile(buildGoodsExportSheets([image],categories)).toBuffer()
  const archive=unzipSync(new Uint8Array(buffer))
  const paths=Object.keys(archive)
  expect(paths.some(path=>path.startsWith('xl/media/'))).toBe(true)
  expect(paths.some(path=>path.startsWith('xl/drawings/drawing'))).toBe(true)
  expect(paths.some(path=>path==='xl/workbook.xml')).toBe(true)
 })
})
