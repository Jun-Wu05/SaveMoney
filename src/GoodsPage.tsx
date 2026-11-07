import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronRight, Folder, Plus, Search, Star, Pencil, Trash2, ImagePlus, Check, MoreHorizontal, GripVertical, Download, FileSpreadsheet, Archive } from 'lucide-react'
import { db, type Good, type GoodCategory, type GoodPurchase } from './db'
import { DateWheelPicker } from './DateWheelPicker'
import { installGoodsPwaZoomRecovery } from './goodsPwaZoom'
import { exportGoodsExcel, exportGoodsZip } from './goodsExport'
import './GoodsPage.css'

const initial: Array<[string,string|null]> = [
  ['服装',null],['食品饮料',null],['日用品',null],['数码家电',null],['运动户外',null],['家居生活',null],
  ['上衣','服装'],['裤子','服装'],['内衣','服装'],['鞋靴','服装'],
  ['羽绒服','上衣'],['外套','上衣'],['T恤','上衣'],
  ['短裤','裤子'],['长裤','裤子'],['内裤','内衣'],['袜子','内衣']
]
async function ensureGoodsCategories() {
  await db.transaction('rw', db.goodCategories, async () => {
    const count=await db.goodCategories.count()
    if(count){localStorage.setItem('savemoney-goods-categories-initialized','1');return}
    if(localStorage.getItem('savemoney-goods-categories-initialized')==='1')return
    const ids = new Map<string,string>()
    const values: GoodCategory[] = initial.map(([name,parent],i) => {
      const id = crypto.randomUUID(); ids.set(name,id)
      return { id, name, parentId: parent ? ids.get(parent)! : null, sortOrder: i }
    })
    await db.goodCategories.bulkAdd(values)
    localStorage.setItem('savemoney-goods-categories-initialized','1')
  })
}
const dateNow = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-') }
const emptyGood = (): Good => ({ id: crypto.randomUUID(),name:'',categoryId:'', brand:'',date:dateNow(),priceMinor:null,highlights:'',review:'',rating:'normal',image:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString() })
const descendants = (id:string, all:GoodCategory[]): Set<string> => { const ids=new Set([id]); for(let changed=true;changed;){changed=false;for(const c of all) if(c.parentId && ids.has(c.parentId) && !ids.has(c.id)){ids.add(c.id);changed=true}} return ids }
function pathFor(id:string,all:GoodCategory[]):string { const out:string[]=[];const seen=new Set<string>();let current=all.find(c=>c.id===id);while(current&&!seen.has(current.id)){seen.add(current.id);out.unshift(current.name);current=all.find(c=>c.id===current?.parentId)}return out.join(' › ') }
export type GoodsSearchField = 'name'|'all'|'category'|'brand'|'highlights'|'review'|'price'|'date'|'rating'
export const goodsSearchFields: {value:GoodsSearchField;label:string}[] = [
 {value:'name',label:'商品名称'}, {value:'all',label:'全部字段'}, {value:'category',label:'分类'},
 {value:'brand',label:'品牌 / 店铺'}, {value:'highlights',label:'商品要点'},
 {value:'review',label:'使用评价'}, {value:'price',label:'购买价格'},
 {value:'date',label:'购买日期'}, {value:'rating',label:'推荐状态'},
]
const ratingLabel=(rating:Good['rating'])=>rating==='recommend'?'推荐 回购':rating==='avoid'?'不推荐':'一般'
const priceMatch=(minor:number|null,query:string)=> {
 if(minor===null)return false
 const clean=query.replace(/[¥￥,，\s]/g,'').trim()
 return /^\d+(?:\.\d{1,2})?$/.test(clean) && Math.round(Number(clean)*100)===minor
}
const dateMatch=(date:string,query:string,explicit:boolean)=>{
 const clean=query.trim().replaceAll('/','-')
 return explicit ? /^\d{4}-\d{2}(?:-\d{2})?$/.test(clean) && date.startsWith(clean)
  : /^\d{4}-\d{2}-\d{2}$/.test(clean) && date===clean
}
const textMatches=(value:string,words:string[])=>words.every(w=>value.toLocaleLowerCase().includes(w))
export function findGoods(goods:Good[],cats:GoodCategory[],query:string,field:GoodsSearchField='all') {
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
 if(!words.length)return goods
 const textFor=(g:Good,f:GoodsSearchField):string=>{
  if(f==='name')return g.name
  if(f==='category')return pathFor(g.categoryId,cats)
  if(f==='brand')return g.brand
  if(f==='highlights')return g.highlights
  if(f==='review')return g.review
  if(f==='rating')return ratingLabel(g.rating)
  return ''
 }
 if(field==='price')return goods.filter(g=>priceMatch(g.priceMinor,query))
 if(field==='date')return goods.filter(g=>dateMatch(g.date,query,true))
 if(field!=='all')return goods.filter(g=>textMatches(textFor(g,field),words))
 return goods.filter(g=> {
  const searchable=['name','category','brand','highlights','review','rating'] as const
  return words.every(word=>searchable.some(f=>textFor(g,f).toLocaleLowerCase().includes(word)) ||
   priceMatch(g.priceMinor,word) || dateMatch(g.date,word,false))
 })
}
export function searchReason(g:Good,cats:GoodCategory[],query:string,field:GoodsSearchField='all'):string {
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
 const candidates:[GoodsSearchField,string,string][]=[
  ['name','商品名称',g.name],['highlights','商品要点',g.highlights],
  ['review','使用评价',g.review],['brand','品牌 / 店铺',g.brand],
  ['category','分类',pathFor(g.categoryId,cats)],['rating','推荐状态',ratingLabel(g.rating)],
  ['price','购买价格',g.priceMinor===null?'':'¥'+(g.priceMinor/100).toFixed(2)],
  ['date','购买日期',g.date],
 ]
 const items=field==='all'?candidates:candidates.filter(c=>c[0]===field)
 const matching=items.find(([key,,value])=>key==='price'?priceMatch(g.priceMinor,query):
  key==='date'?dateMatch(g.date,query,field==='date'):
  words.some(w=>value.toLocaleLowerCase().includes(w)))
 if(!matching)return '商品名称：'+g.name
 const [,label,value]=matching
 const excerpt=value.split('\n').find(line=>words.some(w=>line.toLocaleLowerCase().includes(w)))??value
 return label+'：'+excerpt.slice(0,65)
}
async function loadPhoto(file:File):Promise<string> {
 if(!file.type.startsWith('image/'))throw new Error('请选择图片文件')
 if(file.size>20_000_000)throw new Error('图片超过 20MB，请选择较小的照片')
 const bitmap=await createImageBitmap(file)
 const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height))
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
 canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
 const result=canvas.toDataURL('image/jpeg',.76)
 if(result.length>1_500_000)throw new Error('图片压缩后仍过大，请换一张照片')
 return result
}
const moneyLabel=(v:number|null)=>v===null?'':('¥'+(v/100).toFixed(2).replace(/\.00$/,''))
export function GoodsPage({onClose}:{onClose:()=>void}){
 const screenRef=useRef<HTMLDivElement|null>(null)
 useEffect(()=>{const screen=screenRef.current;return screen?installGoodsPwaZoomRecovery(screen):undefined},[])
 const categories=useLiveQuery(()=>db.goodCategories.toArray(),[],[])
 const goods=useLiveQuery(()=>db.goods.toArray(),[],[])
 const groups=useLiveQuery(()=>db.consumptionGroups.toArray(),[],[])
 const purchases=useLiveQuery(()=>db.goodPurchases.toArray(),[],[])
 const [stack,setStack]=useState<string[]>([])
 const [mode,setMode]=useState<'browse'|'edit'|'detail'|'manage'|'choose'|'export'|'consumption'>('browse')
 const [draft,setDraft]=useState<Good|null>(null)
 const [detail,setDetail]=useState<string|null>(null)
 const [query,setQuery]=useState('')
 const [searchField,setSearchField]=useState<GoodsSearchField>('name')
 const [fieldMenuOpen,setFieldMenuOpen]=useState(false)
 const [filter,setFilter]=useState<'all'|'recommend'|'recent'>('all')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [exportBusy,setExportBusy]=useState(false)
 const [exportStatus,setExportStatus]=useState('')
 const [purchaseOpen,setPurchaseOpen]=useState(false)
 const [purchaseDate,setPurchaseDate]=useState(dateNow())
 const [purchasePrice,setPurchasePrice]=useState('')
 const [purchaseQuantity,setPurchaseQuantity]=useState('1')
 const [purchaseNote,setPurchaseNote]=useState('')
 const [groupName,setGroupName]=useState('')
 const [dateOpen,setDateOpen]=useState(false)
 const [managePath,setManagePath]=useState<string[]>([])
 const [choosePath,setChoosePath]=useState<string[]>([])
 const [categoryForm,setCategoryForm]=useState(false)
 const [categoryName,setCategoryName]=useState('')
 const [editingCategory,setEditingCategory]=useState<string|null>(null)
 const [actionCategory,setActionCategory]=useState<string|null>(null)
 const [dragOrder,setDragOrder]=useState<string[]|null>(null)
 const dragRef=useRef<{id:string;pointerId:number}|null>(null)
 const dragSaving=useRef(false)
 useEffect(()=>{ensureGoodsCategories().catch(()=>setError('分类初始化失败，请检查本地存储空间'))},[])
 const cats=useMemo(()=>(categories??[]).sort((a,b)=>a.sortOrder-b.sortOrder),[categories])
 const all=goods??[]
 const active=stack.at(-1)??null
 const activeCategory=cats.find(c=>c.id===active)
 const current=all.find(g=>g.id===detail)
 const currentIds=active?descendants(active,cats):null
 const children=cats.filter(c=>c.parentId===active)
 const searching=query.trim().length>0
 const searchCategories=useMemo(()=>{
  if(!searching)return []
  const keywords=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if(searchField!=='category'&&searchField!=='all')return []
  return cats.filter(c=>(!currentIds||currentIds.has(c.id)) && keywords.every(w=>pathFor(c.id,cats).toLocaleLowerCase().includes(w)))
 },[cats,query,active,searching,searchField])
 const matched=useMemo(()=>{
   let list=all.filter(g=>!currentIds||currentIds.has(g.categoryId))
   list=findGoods(list,cats,query,searchField)
   if(filter==='recommend')list=list.filter(g=>g.rating==='recommend')
   return list.sort((a,b)=>filter==='recent'?b.createdAt.localeCompare(a.createdAt):b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))
 },[all,cats,query,filter,active,searchField])
 const goBack=()=>{
  setError('')
  if(mode==='consumption'){setMode('browse');return}
  if(mode==='export'){setMode('browse');setExportStatus('');return}
  if(mode==='choose'){if(choosePath.length){setChoosePath(old=>old.slice(0,-1));return}setMode('edit');return}
  if(mode==='manage'){
    if(categoryForm){setCategoryForm(false);setEditingCategory(null);setCategoryName('');return}
    if(managePath.length){setManagePath(old=>old.slice(0,-1));setActionCategory(null);return}
    setMode('browse');return
  }
  if(mode==='edit'||mode==='detail'){setMode(mode==='edit'&&detail?'detail':'browse');setDraft(null);return}
  if(stack.length){setStack(s=>s.slice(0,-1));setQuery('');setFilter('all');return}
  onClose()
 }
 const edit=(item?:Good)=>{setDraft(item?{...item}:emptyGood());setDetail(item?.id??null);setMode('edit');setError('')}
 const openDetail=(id:string)=>{setDetail(id);setMode('detail');setError('')}
 const save=async()=>{if(!draft)return; if(!draft.name.trim()){setError('请填写商品名称');return} if(!draft.categoryId||!cats.some(c=>c.id===draft.categoryId)){setError('请选择分类');return}setSaving(true);setError('');try{await db.goods.put({...draft,name:draft.name.trim(),updatedAt:new Date().toISOString()});setDetail(draft.id);setMode('detail')}catch{setError('保存失败，请检查设备存储空间')}finally{setSaving(false)}}
 const erase=async()=>{if(!current||!confirm('确定删除这件好物及全部购买记录？此操作无法撤销。'))return;await db.transaction('rw',db.goods,db.goodPurchases,async()=>{await db.goodPurchases.where('goodId').equals(current.id).delete();await db.goods.delete(current.id)});setDetail(null);setMode('browse')}
 const manageParent=managePath.at(-1)??null
 const manageChildren=useMemo(()=>{
  const siblings=cats.filter(c=>c.parentId===manageParent)
  return dragOrder?[...siblings].sort((a,b)=>dragOrder.indexOf(a.id)-dragOrder.indexOf(b.id)):siblings
 },[cats,manageParent,dragOrder])
 useEffect(()=>setDragOrder(null),[manageParent])
 const openCategoryForm=(category?:GoodCategory)=>{
   setEditingCategory(category?.id??null);setCategoryName(category?.name??'');setCategoryForm(true);setActionCategory(null);setError('')
 }
 const addCategory=async()=>{
  const name=categoryName.trim()
  if(!name){setError('请填写分类名称');return}
  if(name.length>60){setError('分类名称不能超过60个字符');return}
  if(cats.some(c=>c.name===name&&c.parentId===manageParent&&c.id!==editingCategory)){setError('当前目录中已有同名分类');return}
  try{
   if(editingCategory)await db.goodCategories.update(editingCategory,{name})
   else await db.goodCategories.add({id:crypto.randomUUID(),name,parentId:manageParent,sortOrder:Math.max(-1,...manageChildren.map(c=>c.sortOrder))+1})
   setCategoryName('');setEditingCategory(null);setCategoryForm(false);setError('')
  }catch{setError('保存分类失败，请重试')}
 }
 const deleteCategory=async(id:string)=>{
  const selected=cats.find(c=>c.id===id)
  if(!selected)return
  const ids=descendants(id,cats)
  const linked=all.filter(g=>ids.has(g.categoryId)).length
  if(linked){setError(`「${selected.name}」及其子分类中有 ${linked} 件商品，请先调整商品分类后再删除`);setActionCategory(null);return}
  const childCount=ids.size-1
  const tip=childCount?`「${selected.name}」包含 ${childCount} 个空的下级分类，确定一并删除吗？`:`确定删除分类「${selected.name}」吗？`
  if(!window.confirm(tip))return
  try{await db.goodCategories.bulkDelete([...ids]);setActionCategory(null);setError('')}
  catch{setError('删除分类失败，请重试')}
 }
 const saveOrder=(ids:string[])=>{
  dragSaving.current=true
  setDragOrder(ids)
  void db.transaction('rw',db.goodCategories,async()=>{
   for(let i=0;i<ids.length;i++)await db.goodCategories.update(ids[i],{sortOrder:i})
  }).catch(()=>setError('排序保存失败，请重试')).finally(()=>{dragSaving.current=false;setDragOrder(null)})
 }
 const dragCategory=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{
  if(dragRef.current||dragSaving.current||categoryForm)return
  if(event.pointerType==='mouse'&&event.button!==0)return
  const row=event.currentTarget.closest<HTMLElement>('[data-goods-sort-id]')
  const list=row?.parentElement
  if(!row||!list)return
  const rows=Array.from(list.querySelectorAll<HTMLElement>('[data-goods-sort-id]'))
  const ids=rows.map(el=>el.dataset.goodsSortId??'')
  const startIndex=ids.indexOf(id);if(startIndex<0||rows.length<2)return
  event.preventDefault()
  const pointerId=event.pointerId,startY=event.clientY
  const rowHeight=row.getBoundingClientRect().height
  let currentY=startY,target=startIndex,moved=false,raf=0
  dragRef.current={id,pointerId};setActionCategory(null)
  row.style.position='relative';row.style.zIndex='3';row.style.background='#fff6ee';row.style.boxShadow='0 6px 18px #31251b25'
  const tick=()=>{
   if(!dragRef.current||dragRef.current.pointerId!==pointerId)return
   const delta=currentY-startY,direction=Math.sign(delta)
   target=Math.max(0,Math.min(rows.length-1,startIndex+Math.round(delta/rowHeight)))
   row.style.transform=`translate3d(0,${delta}px,0)`
   rows.forEach((el,i)=>{
    if(i===startIndex)return
    const steps=(i-startIndex)*direction
    const shift=steps>0?-direction*Math.max(0,Math.min(rowHeight,Math.abs(delta)-(steps-1)*rowHeight)):0
    el.style.transform=shift?`translate3d(0,${shift}px,0)`:''
   })
   if(currentY<65)window.scrollBy(0,-Math.min(9,(65-currentY)/7))
   else if(currentY>window.innerHeight-65)window.scrollBy(0,Math.min(9,(currentY-window.innerHeight+65)/7))
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  const cleanup=()=>{
   window.removeEventListener('pointermove',move)
   window.removeEventListener('pointerup',up)
   window.removeEventListener('pointercancel',cancel)
   cancelAnimationFrame(raf)
   rows.forEach(el=>{el.style.transform=''})
   row.style.position='';row.style.zIndex='';row.style.background='';row.style.boxShadow=''
   dragRef.current=null
  }
  const finish=(cancelled:boolean)=>{
   if(!dragRef.current||dragRef.current.pointerId!==pointerId)return
   cleanup()
   if(cancelled||!moved||target===startIndex)return
   const reordered=[...ids];reordered.splice(startIndex,1);reordered.splice(target,0,id)
   saveOrder(reordered)
  }
  const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;currentY=e.clientY;if(Math.abs(currentY-startY)>4)moved=true}
  const up=(e:PointerEvent)=>{if(e.pointerId===pointerId)finish(false)}
  const cancel=(e:PointerEvent)=>{if(e.pointerId===pointerId)finish(true)}
  window.addEventListener('pointermove',move)
  window.addEventListener('pointerup',up)
  window.addEventListener('pointercancel',cancel)
 }
 const moveByKeyboard=(id:string,direction:number)=>{
  if(dragSaving.current)return
  const ids=manageChildren.map(c=>c.id),index=ids.indexOf(id),target=index+direction
  if(index<0||target<0||target>=ids.length)return
  ids.splice(index,1);ids.splice(target,0,id);saveOrder(ids)
 }
 const chooseParent=choosePath.at(-1)??null
 const chooseChildren=cats.filter(c=>c.parentId===chooseParent)
 const runGoodsExport=async(format:'xlsx'|'zip')=>{
  if(exportBusy)return
  setExportBusy(true);setExportStatus('')
  try{
   if(format==='xlsx')await exportGoodsExcel()
   else await exportGoodsZip()
   setExportStatus('已生成文件，请在 iPhone 分享菜单中选择「存储到文件」，或检查浏览器下载。')
  }catch(e){setExportStatus(e instanceof Error?e.message:'导出失败，请检查设备剩余空间')}
  finally{setExportBusy(false)}
 }
 const currentPurchases=(purchases??[]).filter(p=>p.goodId===detail).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))
 const purchaseStats=(items:GoodPurchase[])=>{const dates=[...new Set(items.map(p=>p.date))].sort();const gaps=dates.slice(1).map((d,i)=>(Date.parse(d+'T00:00:00')-Date.parse(dates[i]+'T00:00:00'))/86400000);return {count:items.length,total:items.reduce((n,p)=>n+(p.priceMinor??0)*p.quantity,0),avg:gaps.length?Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length):null}}
 const recordPurchase=async()=>{if(!current)return;const quantity=Number(purchaseQuantity),price=purchasePrice.trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)||!Number.isFinite(Date.parse(purchaseDate+'T00:00:00'))||!Number.isInteger(quantity)||quantity<1||quantity>9999|| (price!==''&&!/^\d{1,8}(\.\d{1,2})?$/.test(price))){setError('请检查日期、价格和数量');return}try{await db.goodPurchases.add({id:crypto.randomUUID(),goodId:current.id,date:purchaseDate,priceMinor:price===''?null:Math.round(Number(price)*100),quantity,note:purchaseNote.trim(),createdAt:new Date().toISOString()});setPurchaseOpen(false);setError('')}catch{setError('购买记录保存失败')}}
 const headerTitle=mode==='consumption'?'消耗统计':mode==='export'?'导出我的好物':mode==='edit'?'添加 / 编辑好物':mode==='detail'?'好物详情':mode==='manage'?(manageParent?cats.find(c=>c.id===manageParent)?.name??'分类管理':'分类管理'):mode==='choose'?(chooseParent?cats.find(c=>c.id===chooseParent)?.name??'选择分类':'选择分类'):activeCategory?.name??'我的好物'
 return <div className="goods-screen" ref={screenRef}><header className="goods-header"><button aria-label="返回" onClick={goBack}><ArrowLeft size={21}/></button><strong>{headerTitle}</strong>{mode==='browse'?<div className="goods-header-actions"><button aria-label="导出好物" title="导出好物" onClick={()=>{setExportStatus('');setMode('export')}}><Download size={21}/></button><button aria-label="添加好物" title="添加好物" onClick={()=>edit()}><Plus size={23}/></button></div>:mode==='edit'?<button className="goods-accent-text" disabled={saving} onClick={()=>void save()}>保存</button>:mode==='detail'?<button className="goods-accent-text" onClick={()=>current&&edit(current)}>编辑</button>:mode==='manage'?<button className="goods-accent-text" aria-label="新增分类" onClick={()=>openCategoryForm()}><Plus size={22}/></button>:<span/>}</header>
 {error&&<p className="goods-error" role="alert">{error}</p>}
 {mode==='consumption'&&<div className="goods-body"><h3>消耗组统计</h3>{(groups??[]).map(group=>{const members=all.filter(g=>g.consumptionGroupId===group.id);const items=(purchases??[]).filter(p=>members.some(g=>g.id===p.goodId));const stats=purchaseStats(items);return <section className="goods-note" key={group.id}><h3>{group.name} · {members.length} 件商品</h3><p>购买 {stats.count} 次 · 累计 ¥{(stats.total/100).toFixed(2)} · 平均间隔 {stats.avg===null?'数据不足':stats.avg+' 天'}</p><div className="goods-list">{items.sort((a,b)=>b.date.localeCompare(a.date)).map(p=><div className="goods-info-row" key={p.id}><span>{p.date} · {members.find(g=>g.id===p.goodId)?.name}</span><strong>{p.quantity} 件 · {moneyLabel(p.priceMinor)||'未填价格'}</strong></div>)}</div></section>})}{!(groups??[]).length&&<p className="goods-muted">还没有消耗组，请在编辑好物时创建。</p>}</div>}
 {mode==='export'&&<div className="goods-body goods-export-page">
   <p className="goods-export-hint">导出范围：全部 {all.length} 件好物、{cats.length} 个分类（包含空分类）。本模块独立导出，不包含账单。</p>
   <button type="button" className="goods-export-option" disabled={exportBusy} onClick={()=>void runGoodsExport('xlsx')}><span className="goods-export-option-icon"><FileSpreadsheet size={23}/></span><span><strong>导出 Excel 清单</strong><small>带商品照片的 .xlsx · 全部好物、分类目录、AI 分析说明</small></span><ChevronRight size={18}/></button>
   <button type="button" className="goods-export-option" disabled={exportBusy} onClick={()=>void runGoodsExport('zip')}><span className="goods-export-option-icon"><Archive size={23}/></span><span><strong>导出完整备份 ZIP</strong><small>Excel + 独立商品照片 + 好物原始数据 backup.json</small></span><ChevronRight size={18}/></button>
   <p className="goods-export-note">照片会嵌入 Excel 第一列（64×64 缩略图）。ZIP 额外保存原始照片和完整分类层级、商品数据，便于未来迁移；目前 ZIP 不支持直接在 App 内导入。导出数据会离开本地设备，请妥善保存。</p>
   {exportBusy&&<p className="goods-export-feedback" role="status">正在生成文件，请不要关闭页面…</p>}
   {exportStatus&&<p className="goods-export-feedback" role="status">{exportStatus}</p>}
 </div>}
 {mode==='browse'&&<div className="goods-body">
  <div className="goods-search-bar">
   <label className="goods-search"><Search size={17}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())setFilter('all')}} placeholder={searchField==='price'?'例如 799 或 799.50':searchField==='date'?'例如 2026-11 或 2026-11-07':'输入关键词搜索'} aria-label="搜索好物"/>{query&&<button className="goods-search-clear" type="button" aria-label="清除搜索" onClick={()=>setQuery('')}>×</button>}</label>
   <div className="goods-search-field-wrap"><button className="goods-search-field" type="button" aria-label={'根据'+goodsSearchFields.find(f=>f.value===searchField)?.label+'搜索'} aria-haspopup="listbox" aria-expanded={fieldMenuOpen} onClick={()=>setFieldMenuOpen(v=>!v)}><small>根据</small><strong>{goodsSearchFields.find(f=>f.value===searchField)?.label}</strong><ChevronRight size={14} className={fieldMenuOpen?'expanded':''}/></button>
   {fieldMenuOpen&&<div className="goods-field-popover" role="listbox" aria-label="选择搜索字段">{goodsSearchFields.map(item=><button type="button" role="option" aria-selected={searchField===item.value} key={item.value} onClick={()=>{setSearchField(item.value);setFieldMenuOpen(false);setFilter('all')}}><span>{item.label}</span>{searchField===item.value&&<Check size={16}/>}</button>)}</div>}</div>
  </div>
  {searching ? <div className="goods-search-results" role="region" aria-label="搜索结果">
    <div className="goods-search-summary" role="status">根据「{goodsSearchFields.find(f=>f.value===searchField)?.label}」找到 {searchCategories.length} 个分类、{matched.length} 件好物</div>
    {searchCategories.length>0&&<section><div className="goods-section-head"><h3>相关分类</h3></div><div className="goods-list">{searchCategories.map(c=><button className="goods-row" key={c.id} onClick={()=>{const chain:string[]=[];const seen=new Set<string>();let node:GoodCategory|undefined=c;while(node&&!seen.has(node.id)){chain.unshift(node.id);seen.add(node.id);node=cats.find(parent=>parent.id===node?.parentId)}setStack(chain);setQuery('');setFilter('all')}}><Folder size={19}/><span>{pathFor(c.id,cats)}</span><ChevronRight size={17}/></button>)}</div></section>}
    {matched.length>0&&<section><div className="goods-section-head"><h3>相关好物</h3></div><div className="goods-products">{matched.map(item=><button key={item.id} className="goods-product" onClick={()=>openDetail(item.id)}>{item.image?<img src={item.image} alt=""/>:<span className="goods-no-photo"><ImagePlus size={19}/></span>}<span className="goods-product-desc"><strong>{item.name}</strong><small>{searchReason(item,cats,query,searchField)}</small><em>{moneyLabel(item.priceMinor)}</em></span><ChevronRight size={14}/></button>)}</div></section>}
    {!matched.length&&!searchCategories.length&&<div className="goods-empty"><strong>没有找到相关内容</strong><span>试试商品名称、分类、品牌、价格或商品要点</span></div>}
  </div> : <>
  {!active&&<button className="goods-category-use" onClick={()=>setMode('consumption')}>消耗统计 · 查看重复购买周期 <ChevronRight size={17}/></button>}
  {!active&&<section className="goods-shortcuts">{[['all','全部好物',all.length],['recommend','推荐回购',all.filter(g=>g.rating==='recommend').length],['recent','最近添加',all.length]] .map(([key,label,count])=><button key={key} className={filter===key?'on':''} onClick={()=>setFilter(key as typeof filter)}><span>{label}</span><small>{count}</small></button>)}</section>}
  {children.length>0&&<><div className="goods-section-head"><h3>{active?'子分类':'我的分类'}</h3>{!active&&<button onClick={()=>{setManagePath([]);setActionCategory(null);setCategoryForm(false);setMode('manage')}}>管理</button>}</div><div className="goods-list">{children.map(c=><button className="goods-row" key={c.id} onClick={()=>{setStack(s=>[...s,c.id]);setQuery('');setFilter('all')}}><Folder size={19}/><span>{c.name}</span><small>{all.filter(g=>descendants(c.id,cats).has(g.categoryId)).length}</small><ChevronRight size={17}/></button>)}</div></>}
  {(active||query||filter!=='all')&&<div className="goods-section-head"><h3>全部商品（{matched.length}）</h3><span>按购买日期排序</span></div>}
  {matched.length>0&&<div className="goods-products">{matched.slice(0,active||query||filter!=='all'?undefined:5).map(item=><button key={item.id} className="goods-product" onClick={()=>openDetail(item.id)}>{item.image?<img src={item.image} alt=""/>:<span className="goods-no-photo"><ImagePlus size={19}/></span>}<span className="goods-product-desc"><strong>{item.name}</strong><small>{item.highlights.trim().split('\n')[0]?.slice(0,45)||pathFor(item.categoryId,cats)}</small><em>{moneyLabel(item.priceMinor)}</em></span>{item.rating==='recommend'&&<span className="goods-badge"><Star size={12} fill="currentColor"/>推荐</span>}<ChevronRight size={14}/></button>)}</div>}
  {!matched.length&&<div className="goods-empty">{all.length?'没有找到相关商品':'还没有好物，点击右上角 + 开始记录。'}</div>}  </>}
 </div>}
 {mode==='detail'&&current&&<div className="goods-body goods-detail">{current.image?<img className="goods-hero-img" src={current.image} alt={current.name}/>:<div className="goods-hero-placeholder"><ImagePlus/>暂无图片</div>}<div className="goods-detail-name"><h2>{current.name}</h2>{current.rating==='recommend'&&<span className="goods-badge">★ 推荐</span>}{current.rating==='avoid'&&<span className="goods-badge neutral">不推荐</span>}</div><div className="goods-price">{moneyLabel(current.priceMinor)}</div><div className="goods-list">{[['分类',pathFor(current.categoryId,cats)],['品牌 / 店铺',current.brand],['购买日期',current.date],['购买价格',moneyLabel(current.priceMinor)]].filter(([,v])=>Boolean(v)).map(([k,v])=><div className="goods-info-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><section className="goods-note"><h3>购买记录 · {currentPurchases.length} 次</h3><p>累计 ¥{(purchaseStats(currentPurchases).total/100).toFixed(2)} · 平均购买间隔 {purchaseStats(currentPurchases).avg===null?'数据不足':purchaseStats(currentPurchases).avg+' 天'}</p><button className="goods-save" onClick={()=>{setPurchaseDate(dateNow());setPurchasePrice(current.priceMinor===null?'':String(current.priceMinor/100));setPurchaseQuantity('1');setPurchaseNote('');setPurchaseOpen(true)}}>+ 再次购买</button><div className="goods-list">{currentPurchases.map(p=><div className="goods-info-row" key={p.id}><span>{p.date} · {p.quantity} 件 {p.note&&'· '+p.note}</span><strong>{moneyLabel(p.priceMinor)||'未填价格'} <button aria-label="删除购买记录" onClick={async()=>{if(confirm('删除这条购买记录？'))await db.goodPurchases.delete(p.id)}}><Trash2 size={15}/></button></strong></div>)}</div></section>{current.highlights&&<section className="goods-note"><h3>商品要点</h3><p>{current.highlights}</p></section>}{current.review&&<section className="goods-note"><h3>使用评价</h3><p>{current.review}</p></section>}<button className="goods-delete" onClick={()=>void erase()}><Trash2 size={16}/> 删除好物</button></div>}
 {mode==='edit'&&draft&&<div className="goods-body goods-form"><label className="goods-photo-input">{draft.image?<img src={draft.image} alt="商品照片"/>:<><ImagePlus size={27}/><span>添加照片</span></>}<input type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)void loadPhoto(f).then(v=>setDraft(d=>d?{...d,image:v}:d)).catch(err=>setError(err.message));e.currentTarget.value=''}}/></label>{draft.image&&<button className="goods-remove-photo" onClick={()=>setDraft({...draft,image:''})}>移除照片</button>}
 <div className="goods-list goods-fields"><label>商品名称 <input placeholder="请输入商品名称" enterKeyHint="done" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/></label><button onClick={()=>{setChoosePath([]);setMode('choose')}}>分类 <strong>{pathFor(draft.categoryId,cats)||'请选择分类'}</strong><ChevronRight size={17}/></button><label>品牌 / 店铺<input placeholder="选填" value={draft.brand} onChange={e=>setDraft({...draft,brand:e.target.value})}/></label><button onClick={()=>setDateOpen(true)}>购买日期 <strong>{draft.date}</strong><ChevronRight size={17}/></button><label>购买价格<input inputMode="decimal" placeholder="选填（元）" value={draft.priceMinor===null?'':String(draft.priceMinor/100)} onChange={e=>{const value=e.target.value;if(value===''){setDraft({...draft,priceMinor:null});return}if(/^\d{0,8}(\.\d{0,2})?$/.test(value))setDraft({...draft,priceMinor:Math.round(Number(value)*100)})}}/></label></div>
 <section className="goods-note"><h3>消耗组（选填，与商品分类独立）</h3><div className="goods-list goods-fields"><label>所属消耗组 <select value={draft.consumptionGroupId??''} onChange={e=>setDraft({...draft,consumptionGroupId:e.target.value||null})}><option value="">不加入消耗组</option>{(groups??[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div><div className="goods-manage-create"><input placeholder="例如：抽纸、洗发水" value={groupName} onChange={e=>setGroupName(e.target.value)}/><button onClick={async()=>{const name=groupName.trim();if(!name)return;const existing=(groups??[]).find(g=>g.name===name);if(existing){setDraft({...draft,consumptionGroupId:existing.id});setGroupName('');return}const id=crypto.randomUUID();await db.consumptionGroups.add({id,name,createdAt:new Date().toISOString()});setDraft({...draft,consumptionGroupId:id});setGroupName('')}}>创建并选择</button></div></section>
 <label className="goods-textarea">商品要点 <textarea rows={5} placeholder={'记录材质、配比、规格等关键信息…\n例如：白鸭绒、绒子含量90%、充绒量180g'} value={draft.highlights} onChange={e=>setDraft({...draft,highlights:e.target.value})}/></label>
 <label className="goods-textarea">使用评价 <textarea rows={4} placeholder="记录实际使用感受、优缺点…" value={draft.review} onChange={e=>setDraft({...draft,review:e.target.value})}/></label><div className="goods-rating"><h3>推荐状态</h3><div>{([['recommend','☆ 推荐'],['normal','一般'],['avoid','不推荐']] as const).map(([v,label])=><button className={draft.rating===v?'selected':''} key={v} onClick={()=>setDraft({...draft,rating:v})}>{label}</button>)}</div></div><button className="goods-save" disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存好物'}</button></div>}
 {mode==='choose'&&draft&&<div className="goods-body goods-choose-category">
   <p className="goods-muted">{chooseParent?'继续选择子分类，或使用当前分类。':'先选择一级分类，再逐级进入需要的子分类。'}</p>
   {chooseParent&&<button className="goods-category-use" onClick={()=>{setDraft({...draft,categoryId:chooseParent});setMode('edit')}}><Check size={18}/>使用当前分类：{pathFor(chooseParent,cats)}</button>}
   {chooseChildren.length>0?<div className="goods-list">{chooseChildren.map(c=><button className="goods-row" key={c.id} onClick={()=>{setChoosePath(old=>[...old,c.id]);if(!cats.some(child=>child.parentId===c.id)){setDraft({...draft,categoryId:c.id});setMode('edit')}}}><Folder size={19}/><span>{c.name}</span><ChevronRight size={16}/></button>)}</div>:!chooseParent&&<p className="goods-category-empty">暂无分类，请先到「我的好物 → 管理」中添加。</p>}
   {chooseParent&&<p className="goods-muted">当前路径：{pathFor(chooseParent,cats)}</p>}
 </div>}
 {mode==='manage'&&<div className="goods-body goods-category-manager">
   {!categoryForm&&<>
     <p className="goods-category-location">{manageParent?<><button onClick={()=>{setManagePath([]);setActionCategory(null)}}>全部分类</button>{managePath.map((id,index)=><span key={id}><ChevronRight size={13}/><button onClick={()=>{setManagePath(managePath.slice(0,index+1));setActionCategory(null)}}>{cats.find(c=>c.id===id)?.name}</button></span>)}</>:'一级分类'}</p>
     <p className="goods-muted">{manageParent?'这里展示当前分类的直接子分类。按住右侧手柄可拖动排序。':'点击分类管理子目录，按住右侧手柄上下拖动排序。'}</p>
     {manageChildren.length>0?<div className="goods-list">
       {manageChildren.map(c=>{
        const total=all.filter(g=>descendants(c.id,cats).has(g.categoryId)).length
        const subCount=cats.filter(x=>x.parentId===c.id).length
        return <div className="goods-manage-item" key={c.id} data-goods-sort-id={c.id}>
          <button className="goods-manage-open" onClick={()=>{setManagePath(old=>[...old,c.id]);setActionCategory(null);setError('')}}><Folder size={19}/><span><strong>{c.name}</strong><small>{subCount} 个子分类 · {total} 件商品</small></span><ChevronRight size={17}/></button>
          <button type="button" className="goods-manage-more" aria-label={`管理「${c.name}」`} aria-expanded={actionCategory===c.id} onClick={()=>{setActionCategory(actionCategory===c.id?null:c.id);setError('')}}><MoreHorizontal size={21}/></button>
          <button type="button" className="goods-category-drag-handle" aria-label={`调整${c.name}顺序，按住拖动或使用上下方向键`} title="按住拖动排序" onPointerDown={e=>dragCategory(e,c.id)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();moveByKeyboard(c.id,e.key==='ArrowUp'?-1:1)}}}><GripVertical size={21}/></button>
          {actionCategory===c.id&&<div className="goods-category-actions">
             <button onClick={()=>openCategoryForm(c)}><Pencil size={15}/>重命名</button>
             <button className="goods-category-danger" onClick={()=>void deleteCategory(c.id)}><Trash2 size={15}/>删除</button>
          </div>}
        </div>
       })}
     </div>:<div className="goods-category-empty">{manageParent?'还没有子分类，可以点击右上角 + 添加。':'还没有分类，可以点击右上角 + 添加。'}</div>}
     <button className="goods-add-category" onClick={()=>openCategoryForm()}><Plus size={18}/>{manageParent?'新增子分类':'新增一级分类'}</button>
   </>}
   {categoryForm&&<div className="goods-category-editor">
     <p className="goods-muted">{editingCategory?'修改当前分类的名称，不影响已记录的商品。':manageParent?'新分类将归属于以下分类：':'你正在创建一个一级分类。'}</p>
     {manageParent&&!editingCategory&&<div className="goods-category-parent-preview"><Folder size={16}/>{pathFor(manageParent,cats)}</div>}
     <label htmlFor="goods-category-name">分类名称</label>
     <input autoFocus id="goods-category-name" maxLength={60} placeholder={manageParent?'例如：羽绒服、短裤、内裤':'例如：服装、食品饮料'} value={categoryName} onChange={e=>setCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void addCategory()}}/>
     <div className="goods-category-form-actions"><button onClick={()=>{setCategoryForm(false);setEditingCategory(null);setCategoryName('');setError('')}}>取消</button><button disabled={!categoryName.trim()} onClick={()=>void addCategory()}><Check size={17}/>{editingCategory?'保存名称':'创建分类'}</button></div>
   </div>}
 </div>}
 {purchaseOpen&&current&&<div className="goods-purchase-overlay"><div className="goods-purchase-dialog"><h3>再次购买 · {current.name}</h3><label>购买日期<input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/></label><label>单价（元）<input inputMode="decimal" placeholder="选填" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)}/></label><label>数量<input inputMode="numeric" value={purchaseQuantity} onChange={e=>setPurchaseQuantity(e.target.value)}/></label><label>备注<input value={purchaseNote} onChange={e=>setPurchaseNote(e.target.value)} placeholder="选填"/></label><div className="goods-category-form-actions"><button onClick={()=>setPurchaseOpen(false)}>取消</button><button onClick={()=>void recordPurchase()}>保存购买记录</button></div></div></div>}
 {dateOpen&&draft&&<DateWheelPicker value={draft.date} onCancel={()=>setDateOpen(false)} onConfirm={date=>{setDraft({...draft,date});setDateOpen(false)}}/>}
 </div>
}
