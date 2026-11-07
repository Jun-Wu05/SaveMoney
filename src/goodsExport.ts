import { db, type Good, type GoodCategory } from './db'
import { safeSpreadsheetText } from './excelExport'

/** Export only My Goods, never financial ledger records. */
export const GOODS_ARCHIVE_FORMAT = 'savemoney-goods-backup'
export const GOODS_ARCHIVE_VERSION = 1
const IMAGE_LIMIT_BYTES = 100 * 1024 * 1024
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
type ExcelValue = string | number
type ExcelCell = { value: ExcelValue; height?: number; wrap?: boolean; alignVertical?: 'center' | 'top'; fontWeight?: 'bold'; backgroundColor?: string; textColor?: string }
type ExportImage = { content: Blob; contentType: string; width: number; height: number; dpi: number; anchor: { row: number; column: number }; offsetX: number; offsetY: number; title: string }
type GoodsSheet = {
 sheet: string
 data: ExcelCell[][]
 columns: {width:number}[]
 stickyRowsCount: number
 showGridLines: boolean
 images?: ExportImage[]
}
export type GoodArchiveRecord = Omit<Good, 'image'> & { imageFile: string | null }
export type GoodsArchive = {
 format: typeof GOODS_ARCHIVE_FORMAT
 version: typeof GOODS_ARCHIVE_VERSION
 exportedAt: string
 goods: GoodArchiveRecord[]
 categories: GoodCategory[]
}
const textCell = (value: string, height?: number):ExcelCell => ({ value: safeSpreadsheetText(value), wrap:true, alignVertical:'center', ...(height?{height}: {}) })
const numberCell = (value:number):ExcelCell => ({value, alignVertical:'center'})
const header = (labels:string[]):ExcelCell[] => labels.map(value=>({value,fontWeight:'bold',backgroundColor:'#F2EBE4',textColor:'#513F34',height:32,alignVertical:'center'}))
const rating = (r:Good['rating']) => r==='recommend'?'推荐':r==='avoid'?'不推荐':'一般'
const timestamp = () => {
 const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0')
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
}
const imagePath = (id:string) => 'images/'+encodeURIComponent(id)+'.jpg'
export function goodsCategoryPath(id:string, categories:GoodCategory[]):string[] {
 const lookup=new Map(categories.map(c=>[c.id,c]))
 const result:string[]=[],visited=new Set<string>()
 let current:string|null=id
 while(current && lookup.has(current) && !visited.has(current)) {
  visited.add(current);const cat:GoodCategory=lookup.get(current)!
  result.unshift(cat.name);current=cat.parentId
 }
 return result
}
function sortedGoods(goods:Good[]):Good[] {
 return [...goods].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id))
}
export function buildGoodsExportSheets(goods:Good[],categories:GoodCategory[], exportedAt=new Date().toISOString()):GoodsSheet[] {
 const ordered=sortedGoods(goods)
 const maxDepth=Math.max(3, ...categories.map(c=>goodsCategoryPath(c.id,categories).length))
 const headers=['图片','商品名称',...Array.from({length:maxDepth},(_,i)=>'第'+(i+1)+'级分类'),'完整分类路径','品牌 / 店铺','购买日期','购买价格（元）','商品要点','使用评价','推荐状态','商品ID']
 const detail:ExcelCell[][]=[header(headers)]
 for(const item of ordered){
  const path=goodsCategoryPath(item.categoryId,categories)
  detail.push([
   textCell('',52),textCell(item.name),...Array.from({length:maxDepth},(_,i)=>textCell(path[i]??'')),
   textCell(path.join(' › ')),textCell(item.brand),textCell(item.date),
   item.priceMinor===null?textCell(''):numberCell(item.priceMinor/100),
   textCell(item.highlights),textCell(item.review),textCell(rating(item.rating)),textCell(item.id)
  ])
 }
 const images:ExportImage[]=[]
 // Images are anchored one row below the heading, not linked remotely.
 ordered.forEach((item,i)=>{
  if(!item.image)return
  const blob=goodsImageBlob(item.image)
  images.push({content:blob,contentType:'image/jpeg',width:64,height:64,dpi:96,
    anchor:{row:i+2,column:1},offsetX:5,offsetY:3,title:item.name})
 })
 const imageColumns=[{width:12},{width:24},...Array.from({length:maxDepth},()=>({width:17})),{width:37},{width:24},{width:16},{width:18},{width:49},{width:49},{width:15},{width:40}]
 const byParent=new Map<string|null,GoodCategory[]>()
 for(const c of categories){const siblings=byParent.get(c.parentId)??[];siblings.push(c);byParent.set(c.parentId,siblings)}
 for(const siblings of byParent.values())siblings.sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name))
 const sequence:GoodCategory[]=[]
 const visit=(parent:string|null,visited:Set<string>)=>{
  for(const c of byParent.get(parent)??[]){
   if(visited.has(c.id))continue
   visited.add(c.id);sequence.push(c);visit(c.id,visited)
  }
 }
 visit(null,new Set())
 const directory:ExcelCell[][]=[header(['分类名称','上级分类','层级','完整分类路径','同级排序','分类ID','上级分类ID'])]
 const ids=new Map(categories.map(c=>[c.id,c]))
 for(const cat of sequence){
  const path=goodsCategoryPath(cat.id,categories)
  directory.push([textCell(cat.name),textCell(cat.parentId?ids.get(cat.parentId)?.name??'':''),numberCell(path.length),
   textCell(path.join(' › ')),numberCell(cat.sortOrder),textCell(cat.id),textCell(cat.parentId??'')])
 }
 const aiInfo=[
  ['SaveMoney · 我的好物分析','仅根据本文件已记录的商品数据分析，不要虚构品牌、价格或购买体验。'],
  ['导出日期',exportedAt],['商品总数',String(goods.length)],['分类总数',String(categories.length)],
  ['数据来源','「全部好物」是唯一商品明细来源；「分类目录」包含尚无商品的分类，勿重复统计。'],
  ['图片说明','商品缩略图直接嵌入「全部好物」第一列，商品未上传图片则留空。'],
  ['个人要点','商品要点和使用评价均保留用户换行；各类商品无需统一参数模板。'],
  ['推荐与回购','对比推荐、一般和不推荐商品的数量、品牌及价格，列出依据。'],
  ['价格分析','购买价格单位为人民币元；价格为空时不要按0元计算。'],
  ['分类分析','按完整分类路径分析不同类别的商品数量、价格、品牌和回购建议。'],
  ['参考建议','分析哪些商品或品牌值得再次购买；不要把单次购买误当成长期趋势。'],
  ['图表建议','在信息充足时绘制分类数量柱状图、价格区间分布图、推荐状态占比图。'],
  ['输出格式','中文结论 + 数据表 + 可验证的图表；数据不足时明确说明。'],
  ['隐私说明','商品信息和照片来自个人本地记录，向第三方 AI 提交前请自行确认隐私。'],
 ] as [string,string][]
 return [
  {sheet:'全部好物',data:detail,columns:imageColumns,stickyRowsCount:1,showGridLines:false,images},
  {sheet:'分类目录',data:directory,columns:[{width:25},{width:23},{width:12},{width:47},{width:15},{width:43},{width:43}],stickyRowsCount:1,showGridLines:false},
  {sheet:'AI分析说明',data:[header(['项目','内容']),...aiInfo.map(([a,b])=>[textCell(a),textCell(b)])],columns:[{width:27},{width:110}],stickyRowsCount:1,showGridLines:false}
 ]
}
export function goodsImageBlob(dataUrl:string):Blob {
 const prefix='data:image/jpeg;base64,'
 if(!dataUrl.startsWith(prefix))throw new Error('商品图片格式不支持导出')
 const base64=dataUrl.slice(prefix.length)
 const raw=atob(base64)
 const bytes=new Uint8Array(raw.length)
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i)
 return new Blob([bytes],{type:'image/jpeg'})
}
export function buildGoodsArchive(goods:Good[],categories:GoodCategory[],exportedAt=new Date().toISOString()):GoodsArchive {
 return {
  format:GOODS_ARCHIVE_FORMAT,version:GOODS_ARCHIVE_VERSION,exportedAt,
  categories:categories.map(c=>({...c})),
  goods:goods.map(({image,...rest})=>({...rest,imageFile:image?imagePath(rest.id):null}))
 }
}
async function readExportData() {
 return Promise.all([db.goods.toArray(),db.goodCategories.toArray()] as const)
}
async function generateExcel(goods:Good[],cats:GoodCategory[]):Promise<Blob> {
 const {default:writeExcelFile}=await import('write-excel-file/browser')
 const sheets=buildGoodsExportSheets(goods,cats)
 return writeExcelFile(sheets).toBlob()
}
async function shareOrSave(file:File):Promise<void> {
 // Share directly to iOS Files/AirDrop when the Web Share API supports file sharing.
 if(navigator.canShare?.({files:[file]}) && navigator.share) {
  try {await navigator.share({files:[file],title:file.name});return}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')return}
 }
 const url=URL.createObjectURL(file)
 const a=document.createElement('a');a.href=url;a.download=file.name
 document.body.appendChild(a);a.click();a.remove()
 window.setTimeout(()=>URL.revokeObjectURL(url),60_000)
}
export async function exportGoodsExcel():Promise<void> {
 const [goods,cats]=await readExportData()
 const blob=await generateExcel(goods,cats)
 await shareOrSave(new File([blob],`我的好物_${timestamp()}.xlsx`,{type:XLSX_MIME}))
}
export async function exportGoodsZip():Promise<void> {
 const [goods,cats]=await readExportData()
 const total=goods.reduce((n,g)=>n+g.image.length*.75,0)
 if(total>IMAGE_LIMIT_BYTES)throw new Error('照片合计超过100MB，请分批减少照片后导出')
 const excel=await generateExcel(goods,cats)
 const {zip,strToU8}=await import('fflate')
 const items:Record<string,Uint8Array>={}
 items['我的好物.xlsx']=new Uint8Array(await excel.arrayBuffer())
 items['backup.json']=strToU8(JSON.stringify(buildGoodsArchive(goods,cats),null,2))
 for(const good of goods) if(good.image) items[imagePath(good.id)]=new Uint8Array(await goodsImageBlob(good.image).arrayBuffer())
 const zipped=await new Promise<Uint8Array>((resolve,reject)=>{
  zip(items,{level:1},(error,result)=>error?reject(error):resolve(result))
 })
 const blob=new Blob([zipped as Uint8Array<ArrayBuffer>],{type:'application/zip'})
 await shareOrSave(new File([blob],`我的好物_完整备份_${timestamp()}.zip`,{type:'application/zip'}))
}
