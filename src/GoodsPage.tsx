import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronRight, Folder, Plus, Search, Star, Pencil, Trash2, ImagePlus, Check, X, GripVertical } from 'lucide-react'
import { db, type Good, type GoodCategory } from './db'
import { DateWheelPicker } from './DateWheelPicker'
import './GoodsPage.css'

const initial: Array<[string,string|null]> = [
  ['服装',null],['食品饮料',null],['日用品',null],['数码家电',null],['运动户外',null],['家居生活',null],
  ['上衣','服装'],['裤子','服装'],['内衣','服装'],['鞋靴','服装'],
  ['羽绒服','上衣'],['外套','上衣'],['T恤','上衣'],
  ['短裤','裤子'],['长裤','裤子'],['内裤','内衣'],['袜子','内衣']
]
async function ensureGoodsCategories() {
  await db.transaction('rw', db.goodCategories, async () => {
    if (await db.goodCategories.count()) return
    const ids = new Map<string,string>()
    const values: GoodCategory[] = initial.map(([name,parent],i) => {
      const id = crypto.randomUUID(); ids.set(name,id)
      return { id, name, parentId: parent ? ids.get(parent)! : null, sortOrder: i }
    })
    await db.goodCategories.bulkAdd(values)
  })
}
const dateNow = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-') }
const emptyGood = (): Good => ({ id: crypto.randomUUID(),name:'',categoryId:'', brand:'',date:dateNow(),priceMinor:null,highlights:'',review:'',rating:'normal',image:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString() })
const descendants = (id:string, all:GoodCategory[]): Set<string> => { const ids=new Set([id]); for(let changed=true;changed;){changed=false;for(const c of all) if(c.parentId && ids.has(c.parentId) && !ids.has(c.id)){ids.add(c.id);changed=true}} return ids }
function pathFor(id:string,all:GoodCategory[]):string { const out:string[]=[];const seen=new Set<string>();let current=all.find(c=>c.id===id);while(current&&!seen.has(current.id)){seen.add(current.id);out.unshift(current.name);current=all.find(c=>c.id===current?.parentId)}return out.join(' › ') }
export function findGoods(goods:Good[],cats:GoodCategory[],query:string) {
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
 if(!words.length)return goods
 return goods.filter(g=>{const haystack=[g.name,g.brand,g.date,g.priceMinor===null?'':String(g.priceMinor/100),g.highlights,g.review,g.rating==='recommend'?'推荐 回购':g.rating==='avoid'?'不推荐':'一般',pathFor(g.categoryId,cats)].join(' ').toLocaleLowerCase();return words.every(w=>haystack.includes(w))})
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
 const categories=useLiveQuery(()=>db.goodCategories.toArray(),[],[])
 const goods=useLiveQuery(()=>db.goods.toArray(),[],[])
 const [stack,setStack]=useState<string[]>([])
 const [mode,setMode]=useState<'browse'|'edit'|'detail'|'manage'|'choose'>('browse')
 const [draft,setDraft]=useState<Good|null>(null)
 const [detail,setDetail]=useState<string|null>(null)
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState<'all'|'recommend'|'recent'>('all')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [dateOpen,setDateOpen]=useState(false)
 const [categoryParent,setCategoryParent]=useState<string|null>(null)
 const [categoryName,setCategoryName]=useState('')
 const [editingCategory,setEditingCategory]=useState<string|null>(null)
 const [dragId,setDragId]=useState<string|null>(null)
 useEffect(()=>{ensureGoodsCategories().catch(()=>setError('分类初始化失败，请检查本地存储空间'))},[])
 const cats=useMemo(()=>(categories??[]).sort((a,b)=>a.sortOrder-b.sortOrder),[categories])
 const all=goods??[]
 const active=stack.at(-1)??null
 const activeCategory=cats.find(c=>c.id===active)
 const current=all.find(g=>g.id===detail)
 const currentIds=active?descendants(active,cats):null
 const children=cats.filter(c=>c.parentId===active)
 const matched=useMemo(()=>{
   let list=all.filter(g=>!currentIds||currentIds.has(g.categoryId))
   list=findGoods(list,cats,query)
   if(filter==='recommend')list=list.filter(g=>g.rating==='recommend')
   return list.sort((a,b)=>filter==='recent'?b.createdAt.localeCompare(a.createdAt):b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))
 },[all,cats,query,filter,active])
 const goBack=()=>{
  setError('')
  if(mode==='choose'){setMode('edit');return}
  if(mode==='edit'||mode==='detail'||mode==='manage'){setMode(mode==='edit'&&detail?'detail':'browse');setDraft(null);return}
  if(stack.length){setStack(s=>s.slice(0,-1));setQuery('');setFilter('all');return}
  onClose()
 }
 const edit=(item?:Good)=>{setDraft(item?{...item}:emptyGood());setDetail(item?.id??null);setMode('edit');setError('')}
 const openDetail=(id:string)=>{setDetail(id);setMode('detail');setError('')}
 const save=async()=>{if(!draft)return; if(!draft.name.trim()){setError('请填写商品名称');return} if(!draft.categoryId||!cats.some(c=>c.id===draft.categoryId)){setError('请选择分类');return}setSaving(true);setError('');try{await db.goods.put({...draft,name:draft.name.trim(),updatedAt:new Date().toISOString()});setDetail(draft.id);setMode('detail')}catch{setError('保存失败，请检查设备存储空间')}finally{setSaving(false)}}
 const erase=async()=>{if(!current||!confirm('确定删除这件好物？此操作无法撤销。'))return;await db.goods.delete(current.id);setDetail(null);setMode('browse')}
 const addCategory=async()=>{const name=categoryName.trim();if(!name){setError('请输入分类名称');return}if(cats.some(c=>c.name===name&&c.parentId===categoryParent&&c.id!==editingCategory)){setError('同级分类名称已存在');return}if(editingCategory){await db.goodCategories.update(editingCategory,{name})}else await db.goodCategories.add({id:crypto.randomUUID(),name,parentId:categoryParent,sortOrder:cats.length});setCategoryName('');setEditingCategory(null);setError('')}
 const deleteCategory=async(id:string)=>{const ids=descendants(id,cats);if(all.some(g=>ids.has(g.categoryId))){setError('该分类或下级分类包含商品，请先将商品移到其他分类');return}if(!confirm('确定删除该分类及其空的子分类？'))return;await db.goodCategories.bulkDelete([...ids]);setError('')}
 const moveBy=async(id:string,delta:number)=>{const c=cats.find(x=>x.id===id);if(!c)return;const siblings=cats.filter(x=>x.parentId===c.parentId);const index=siblings.findIndex(x=>x.id===id);const other=siblings[index+delta];if(!other)return;await db.goodCategories.update(id,{sortOrder:other.sortOrder});await db.goodCategories.update(other.id,{sortOrder:c.sortOrder})}
 const moveCategory=async(target:GoodCategory)=>{if(!dragId||dragId===target.id)return;const from=cats.find(c=>c.id===dragId);if(!from||from.parentId!==target.parentId)return;await db.goodCategories.update(from.id,{sortOrder:target.sortOrder});await db.goodCategories.update(target.id,{sortOrder:from.sortOrder});setDragId(null)}
 const headerTitle=mode==='edit'?'添加 / 编辑好物':mode==='detail'?'好物详情':mode==='manage'?'分类管理':mode==='choose'?'选择分类':activeCategory?.name??'我的好物'
 return <div className="goods-screen"><header className="goods-header"><button aria-label="返回" onClick={goBack}><ArrowLeft size={21}/></button><strong>{headerTitle}</strong>{mode==='browse'?<button aria-label="添加好物" onClick={()=>edit()}><Plus size={23}/></button>:mode==='edit'?<button className="goods-accent-text" disabled={saving} onClick={()=>void save()}>保存</button>:mode==='detail'?<button className="goods-accent-text" onClick={()=>current&&edit(current)}>编辑</button>:mode==='manage'?<button className="goods-accent-text" onClick={()=>{setEditingCategory(null);setCategoryParent(null);setCategoryName('');setError('');setMode('choose')}}>新增</button>:<span/>}</header>
 {error&&<p className="goods-error" role="alert">{error}</p>}
 {mode==='browse'&&<div className="goods-body">
  <label className="goods-search"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={active?'搜索此分类的商品、材质、价格…':'搜索名称、材质、参数、店铺…'}/></label>
  {!active&&<section className="goods-shortcuts">{[['all','全部好物',all.length],['recommend','推荐回购',all.filter(g=>g.rating==='recommend').length],['recent','最近添加',all.length]] .map(([key,label,count])=><button key={key} className={filter===key?'on':''} onClick={()=>setFilter(key as typeof filter)}><span>{label}</span><small>{count}</small></button>)}</section>}
  {children.length>0&&<><div className="goods-section-head"><h3>{active?'子分类':'我的分类'}</h3>{!active&&<button onClick={()=>setMode('manage')}>管理</button>}</div><div className="goods-list">{children.map(c=><button className="goods-row" key={c.id} onClick={()=>{setStack(s=>[...s,c.id]);setQuery('');setFilter('all')}}><Folder size={19}/><span>{c.name}</span><small>{all.filter(g=>descendants(c.id,cats).has(g.categoryId)).length}</small><ChevronRight size={17}/></button>)}</div></>}
  {(active||query||filter!=='all')&&<div className="goods-section-head"><h3>全部商品（{matched.length}）</h3><span>按购买日期排序</span></div>}
  {matched.length>0&&<div className="goods-products">{matched.slice(0,active||query||filter!=='all'?undefined:5).map(item=><button key={item.id} className="goods-product" onClick={()=>openDetail(item.id)}>{item.image?<img src={item.image} alt=""/>:<span className="goods-no-photo"><ImagePlus size={19}/></span>}<span className="goods-product-desc"><strong>{item.name}</strong><small>{item.highlights.trim().split('\n')[0]?.slice(0,45)||pathFor(item.categoryId,cats)}</small><em>{moneyLabel(item.priceMinor)}</em></span>{item.rating==='recommend'&&<span className="goods-badge"><Star size={12} fill="currentColor"/>推荐</span>}<ChevronRight size={14}/></button>)}</div>}
  {!matched.length&&<div className="goods-empty">{all.length?'没有找到相关商品':'还没有好物，点击右上角 + 开始记录。'}</div>}
 </div>}
 {mode==='detail'&&current&&<div className="goods-body goods-detail">{current.image?<img className="goods-hero-img" src={current.image} alt={current.name}/>:<div className="goods-hero-placeholder"><ImagePlus/>暂无图片</div>}<div className="goods-detail-name"><h2>{current.name}</h2>{current.rating==='recommend'&&<span className="goods-badge">★ 推荐</span>}{current.rating==='avoid'&&<span className="goods-badge neutral">不推荐</span>}</div><div className="goods-price">{moneyLabel(current.priceMinor)}</div><div className="goods-list">{[['分类',pathFor(current.categoryId,cats)],['品牌 / 店铺',current.brand],['购买日期',current.date],['购买价格',moneyLabel(current.priceMinor)]].filter(([,v])=>Boolean(v)).map(([k,v])=><div className="goods-info-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>{current.highlights&&<section className="goods-note"><h3>商品要点</h3><p>{current.highlights}</p></section>}{current.review&&<section className="goods-note"><h3>使用评价</h3><p>{current.review}</p></section>}<button className="goods-delete" onClick={()=>void erase()}><Trash2 size={16}/> 删除好物</button></div>}
 {mode==='edit'&&draft&&<div className="goods-body goods-form"><label className="goods-photo-input">{draft.image?<img src={draft.image} alt="商品照片"/>:<><ImagePlus size={27}/><span>添加照片</span></>}<input type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)void loadPhoto(f).then(v=>setDraft(d=>d?{...d,image:v}:d)).catch(err=>setError(err.message));e.currentTarget.value=''}}/></label>{draft.image&&<button className="goods-remove-photo" onClick={()=>setDraft({...draft,image:''})}>移除照片</button>}
 <div className="goods-list goods-fields"><label>商品名称 <input placeholder="请输入商品名称" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><button onClick={()=>setMode('choose')}>分类 <strong>{pathFor(draft.categoryId,cats)||'请选择分类'}</strong><ChevronRight size={17}/></button><label>品牌 / 店铺<input placeholder="选填" value={draft.brand} onChange={e=>setDraft({...draft,brand:e.target.value})}/></label><button onClick={()=>setDateOpen(true)}>购买日期 <strong>{draft.date}</strong><ChevronRight size={17}/></button><label>购买价格<input inputMode="decimal" placeholder="选填（元）" value={draft.priceMinor===null?'':String(draft.priceMinor/100)} onChange={e=>{const value=e.target.value;if(value===''){setDraft({...draft,priceMinor:null});return}if(/^\d{0,8}(\.\d{0,2})?$/.test(value))setDraft({...draft,priceMinor:Math.round(Number(value)*100)})}}/></label></div>
 <label className="goods-textarea">商品要点 <textarea rows={5} placeholder={'记录材质、配比、规格等关键信息…\n例如：白鸭绒、绒子含量90%、充绒量180g'} value={draft.highlights} onChange={e=>setDraft({...draft,highlights:e.target.value})}/></label>
 <label className="goods-textarea">使用评价 <textarea rows={4} placeholder="记录实际使用感受、优缺点…" value={draft.review} onChange={e=>setDraft({...draft,review:e.target.value})}/></label><div className="goods-rating"><h3>推荐状态</h3><div>{([['recommend','☆ 推荐'],['normal','一般'],['avoid','不推荐']] as const).map(([v,label])=><button className={draft.rating===v?'selected':''} key={v} onClick={()=>setDraft({...draft,rating:v})}>{label}</button>)}</div></div><button className="goods-save" disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存好物'}</button></div>}
 {mode==='choose'&&<div className="goods-body">{draft?<><p className="goods-muted">选择商品所属分类</p>{cats.map(c=><button className="goods-choice" style={{paddingLeft:18+pathFor(c.id,cats).split(' › ').length*13}} key={c.id} onClick={()=>{setDraft({...draft,categoryId:c.id});setMode('edit')}}>{pathFor(c.id,cats)}<ChevronRight size={15}/></button>)}</>:<><p className="goods-muted">新分类的上级分类（不选则为一级分类）</p><button className="goods-choice" onClick={()=>{setCategoryParent(null);setMode('manage')}}>一级分类</button>{cats.map(c=><button className="goods-choice" key={c.id} onClick={()=>{setCategoryParent(c.id);setMode('manage')}}>{pathFor(c.id,cats)}</button>)}</>}</div>}
 {mode==='manage'&&<div className="goods-body"><p className="goods-muted">长按或拖动排序图标可调整同级分类的顺序；点击名称编辑。</p><div className="goods-manage-create"><input placeholder="输入分类名称" value={categoryName} onChange={e=>setCategoryName(e.target.value)}/><button onClick={()=>void addCategory()}><Check size={18}/>{editingCategory?'保存':'添加'}</button></div><button className="goods-parent" onClick={()=>setMode('choose')}>上级分类：{categoryParent?pathFor(categoryParent,cats):'一级分类'} <ChevronRight size={16}/></button>{cats.map(c=><div key={c.id} className="goods-manage-row" onDragOver={e=>e.preventDefault()} onDrop={()=>void moveCategory(c)}><span style={{paddingLeft:(pathFor(c.id,cats).split(' › ').length-1)*14}}>{c.name}</span><button aria-label={'编辑'+c.name} onClick={()=>{setEditingCategory(c.id);setCategoryParent(c.parentId);setCategoryName(c.name)}}><Pencil size={16}/></button><button aria-label={'分类上移'+c.name} onClick={()=>void moveBy(c.id,-1)}>↑</button><button aria-label={'分类下移'+c.name} onClick={()=>void moveBy(c.id,1)}>↓</button><button aria-label={'删除'+c.name} onClick={()=>void deleteCategory(c.id)}><X size={16}/></button><span draggable onDragStart={()=>setDragId(c.id)} onDragEnd={()=>setDragId(null)}><GripVertical size={18}/></span></div>)}</div>}
 {dateOpen&&draft&&<DateWheelPicker value={draft.date} onCancel={()=>setDateOpen(false)} onConfirm={date=>{setDraft({...draft,date});setDateOpen(false)}}/>}
 </div>
}
