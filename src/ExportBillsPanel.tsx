import { useMemo, useState } from 'react'
import { db, type Entry, type Category } from './db'
import { buildMonthlySheets, safeSpreadsheetText, type MonthlySheet } from './excelExport'

type Preset = 'month' | 'previous' | 'year' | 'all' | 'custom'
type Format = 'xlsx' | 'csv'
type Options = { from: string; to: string; expenses: boolean; incomes: boolean; notes: boolean; summary: boolean; aiPrompt: boolean }
const pad = (v: number) => String(v).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const first = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const last = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1, 0)

export function dateInterval(preset: Preset, today = new Date()): { from: string; to: string } | null {
  if (preset === 'all' || preset === 'custom') return null
  if (preset === 'year') return { from: `${today.getFullYear()}-01-01`, to: iso(today) }
  if (preset === 'previous') {
    const prev = new Date(today.getFullYear(), today.getMonth()-1, 1)
    return { from: iso(first(prev)), to: iso(last(prev)) }
  }
  return { from: iso(first(today)), to: iso(today) }
}

function validDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const [y,m,d] = input.split('-').map(Number)
  const value = new Date(0)
  value.setFullYear(y,m-1,d)
  return value.getFullYear()===y && value.getMonth()===m-1 && value.getDate()===d
}

export function filterExportEntries(entries: Entry[], options: Options): Entry[] {
  if (!options.expenses && !options.incomes) throw new Error('请至少选择一种账单类型')
  if (!validDate(options.from) || !validDate(options.to) || options.from > options.to) throw new Error('请选择正确的日期范围')
  return entries.filter(e => e.date >= options.from && e.date <= options.to && (e.type === 'expense' ? options.expenses : options.incomes))
    .sort((a,b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

const aiInstructions = [
  ['SaveMoney AI 可视化消费分析', '请基于本工作簿的真实交易明细，生成中文消费分析报告和实际可视化图表。'],
  ['数据范围', '以「账单明细」工作表为唯一交易数据源。月份工作表为导入兼容副本，「统计汇总」仅供核对，绝对不要重复加总。'],
  ['数据校验', '先检查有效交易笔数、收入、支出及结余；忽略空白行及汇总行；有异常则列出，不得虚构数据。'],
  ['收支概览', '统计总收入、总支出及结余；按分类汇总支出金额和占比。'],
  ['消费洞察', '分析每日及每周消费趋势、前10笔大额消费、高频消费、异常支出。仅在覆盖多个月时比较月度变化。'],
  ['必须绘制的图表', '请尽可能实际生成收支对比柱状图、支出分类环形图、每日支出折线图、TOP10 分类横向柱状图。'],
  ['条件图表', '存在多个月数据时绘制月度趋势图；有充分预算依据时绘制实际消费与建议预算对比图。'],
  ['图表标准', '中文标题和分类、金额为人民币元、简洁浅色主题、清晰标签。无足够数据时跳过，不要补造数字。'],
  ['省钱建议', '给出有计算依据的保守、适中、积极三种节省情景及下月预算建议；考虑必要生活支出。'],
  ['输出', '按照财务概览、可视化图表、分类排行、大额及高频分析、省钱建议、下月预算的顺序输出。'],
  ['绘图能力限制', '如果当前 AI 不能实际绘图，请明确说明并输出可供绘图的结构化数据，不能用文字描述冒充图表。'],
]

export function buildSelectedSheets(entries: Entry[], categories: Category[], options: Options): MonthlySheet[] {
  const picked = filterExportEntries(entries, options)
  const names = new Map(categories.map(c => [c.id, c.name]))
  // Keep YYYY-MM worksheets identical to the original exporter for SaveMoney import compatibility.
  const monthly = buildMonthlySheets(picked.map(e => options.notes ? e : { ...e, note: '' }), categories)
  const incomeMinor = picked.filter(e=>e.type==='income').reduce((n,e)=>n+e.amountMinor,0)
  const expenseMinor = picked.filter(e=>e.type==='expense').reduce((n,e)=>n+e.amountMinor,0)
  const detail: MonthlySheet = {
    sheet: '账单明细',
    data: [['日期','类型','金额（元）','分类','备注'], ...picked.map(e => [
      e.date, e.type === 'income' ? '收入' : '支出', e.amountMinor / 100,
      safeSpreadsheetText(names.get(e.categoryId) ?? '其他'), options.notes ? safeSpreadsheetText(e.note) : '',
    ])],
    columns: [{width:16},{width:12},{width:20},{width:22},{width:42}], stickyRowsCount: 1,
  }
  const result: MonthlySheet[] = []
  if (options.aiPrompt) result.push({sheet:'AI分析说明',data:aiInstructions,columns:[{width:24},{width:110}],stickyRowsCount:1})
  result.push(detail)
  if (options.summary) {
    const totals: (string|number)[][] = [
      ['项目','金额（元）或数量'],['起始日期',options.from],['截止日期',options.to],
      ['交易笔数',picked.length],['总收入（元）',incomeMinor/100],['总支出（元）',expenseMinor/100],
      ['结余（元）',(incomeMinor-expenseMinor)/100],['分类','类型','金额（元）','笔数'],
    ]
    const byCategory = new Map<string,{type:string;amount:number;count:number}>()
    for (const e of picked) {
      const key = JSON.stringify([e.type, names.get(e.categoryId) ?? '其他'])
      const old = byCategory.get(key) ?? {type:e.type,amount:0,count:0}
      old.amount += e.amountMinor; old.count++; byCategory.set(key,old)
    }
    for (const [key,v] of [...byCategory.entries()].sort((a,b)=>b[1].amount-a[1].amount)) {
      const [,name] = JSON.parse(key) as [string,string]
      totals.push([safeSpreadsheetText(name),v.type==='expense'?'支出':'收入',v.amount/100,v.count])
    }
    result.push({sheet:'统计汇总',data:totals,columns:[{width:24},{width:24},{width:20},{width:14}],stickyRowsCount:1})
  }
  // Month tabs are the recognized import format. The old monthly summary remains optional.
  if (options.summary) result.push(monthly[0])
  result.push(...monthly.slice(1))
  return result
}

const csvQuote = (value: string) => {
  const text = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value
  return '"' + text.replace(/"/g,'""') + '"'
}
export function buildSelectedCsv(entries: Entry[], categories: Category[], options: Options): string {
  const names = new Map(categories.map(c => [c.id,c.name]))
  const picked = filterExportEntries(entries,options)
  const rows = [['日期','类型','金额(元)','分类','备注'],...picked.map(e => [
    e.date,e.type==='expense'?'支出':'收入',(e.amountMinor/100).toFixed(2),
    names.get(e.categoryId)??'其他',options.notes?e.note:'',
  ])]
  if (options.summary) {
    const income = picked.filter(e=>e.type==='income').reduce((n,e)=>n+e.amountMinor,0)
    const expense = picked.filter(e=>e.type==='expense').reduce((n,e)=>n+e.amountMinor,0)
    rows.push(['','','','',''],['全部汇总','收入合计',(income/100).toFixed(2),'',''],
      ['','支出合计',(expense/100).toFixed(2),'',''],['','收支结余',((income-expense)/100).toFixed(2),'',''])
  }
  return '\uFEFF' + rows.map(row=>row.map(csvQuote).join(',')).join('\r\n')
}

async function exportFile(entries: Entry[], categories: Category[], options: Options, format: Format) {
  const name = `SaveMoney_${options.from}_${options.to}`
  if (format === 'xlsx') {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    await writeExcelFile(buildSelectedSheets(entries,categories,options)).toFile(`${name}.xlsx`)
    return
  }
  const csv = buildSelectedCsv(entries,categories,options)
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
  const a = document.createElement('a')
  a.href=url; a.download=`${name}.csv`; document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),60000)
}

export function ExportBillsPanel() {
  const [preset,setPreset] = useState<Preset>('month')
  const [customFrom,setCustomFrom] = useState(iso(first(new Date())))
  const [customTo,setCustomTo] = useState(iso(new Date()))
  const [expense,setExpense] = useState(true)
  const [income,setIncome] = useState(true)
  const [format,setFormat] = useState<Format>('xlsx')
  const [summary,setSummary] = useState(true)
  const [notes,setNotes] = useState(true)
  const [aiPrompt,setAiPrompt] = useState(true)
  const [busy,setBusy] = useState(false)
  const [status,setStatus] = useState('')
  const [open,setOpen] = useState(false)
  const interval = useMemo(()=>dateInterval(preset),[preset])
  const options: Options = {from:interval?.from??(preset==='all'?'0001-01-01':customFrom),
    to:interval?.to??(preset==='all'?'9999-12-31':customTo),
    expenses:expense,incomes:income,notes,summary,aiPrompt:format==='xlsx'&&aiPrompt}
  async function runExport() {
    if (busy) return
    setStatus('')
    try {
      if (!expense&&!income) throw new Error('请至少选择收入或支出')
      if (preset==='custom'&&(!validDate(customFrom)||!validDate(customTo)||customFrom>customTo)) throw new Error('日期范围不正确')
      setBusy(true)
      const [entries,categories]=await Promise.all([db.entries.toArray(),db.categories.toArray()])
      const selected=filterExportEntries(entries,options)
      if (!selected.length) throw new Error('该范围内没有符合条件的账单')
      await exportFile(entries,categories,options,format)
      setStatus(`已生成 ${selected.length} 笔账单的 ${format.toUpperCase()} 文件，请在「文件」App 确认保存。`)
    } catch (error) { setStatus(error instanceof Error?error.message:'导出失败，请检查设备空间或浏览器权限') }
    finally { setBusy(false) }
  }
  const chip = (value:Preset,label:string) => <button type="button" key={value} aria-pressed={preset===value}
    style={{borderRadius:10,padding:'9px 11px',border:preset===value?'1px solid #2563eb':'1px solid #dde3ef',background:preset===value?'#eff6ff':'#fff',color:preset===value?'#1d4ed8':'inherit'}}
    onClick={()=>setPreset(value)}>{label}</button>
  const check = (value:boolean,onChange:(v:boolean)=>void,label:string,detail?:string) =>
    <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 0'}}>
      <span><strong style={{fontSize:14}}>{label}</strong>{detail&&<small style={{display:'block',opacity:.68,marginTop:3}}>{detail}</small>}</span>
      <input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)} style={{width:20,height:20,flexShrink:0,accentColor:'#2563eb'}}/>
    </label>
  return <div className="setting-card">
    <h3>导出账单</h3><p>自定义时间、收支类型与导出内容，可交给任意支持文件分析的 AI。</p>
    {!open ? <button type="button" onClick={()=>setOpen(true)}>选择范围并导出 Excel / CSV</button> : <>
      <h4 style={{margin:'14px 0 8px'}}>时间范围</h4>
      <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
        {chip('month','本月')}{chip('previous','上个月')}{chip('year','今年')}{chip('all','全部')}{chip('custom','自定义')}
      </div>
      {preset==='custom'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
        <label style={{fontSize:13}}>开始日期<input aria-label="开始日期" style={{width:'100%',marginTop:5}} type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label>
        <label style={{fontSize:13}}>结束日期<input aria-label="结束日期" style={{width:'100%',marginTop:5}} type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label>
      </div>}
      <p style={{fontSize:12,margin:'10px 0'}}>{preset==='all'?'覆盖全部有记录的日期':`导出范围：${options.from} 至 ${options.to}`}</p>
      <h4 style={{margin:'14px 0 6px'}}>账单类型</h4>
      <div style={{display:'flex',gap:24}}><label><input type="checkbox" checked={expense} onChange={e=>setExpense(e.target.checked)}/> 支出</label><label><input type="checkbox" checked={income} onChange={e=>setIncome(e.target.checked)}/> 收入</label></div>
      <h4 style={{margin:'14px 0 8px'}}>文件格式</h4>
      <div style={{display:'flex',gap:20}}><label><input type="radio" checked={format==='xlsx'} onChange={()=>setFormat('xlsx')}/> Excel（推荐）</label><label><input type="radio" checked={format==='csv'} onChange={()=>setFormat('csv')}/> CSV</label></div>
      <h4 style={{margin:'16px 0 4px'}}>导出选项</h4>
      {format==='xlsx'&&check(aiPrompt,setAiPrompt,'包含 AI 分析提示词','新增 AI分析说明 Sheet，提示生成真实图表')}
      {check(summary,setSummary,'包含统计汇总','便于核对收入、支出、结余与分类数据')}
      {check(notes,setNotes,'包含备注','关闭后去除所有导出账单备注，减少隐私暴露')}
      <p style={{fontSize:12,opacity:.7}}>Excel 保留月度工作表供 SaveMoney 导入；AI 请优先读取「账单明细」，避免重复统计。</p>
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button type="button" disabled={busy||(!expense&&!income)} onClick={()=>void runExport()}>{busy?'正在导出…':`导出 ${format==='xlsx'?'Excel':'CSV'}`}</button>
        <button type="button" disabled={busy} onClick={()=>setOpen(false)}>收起</button>
      </div>
    </>}
    {status&&<p role="status" className="feedback">{status}</p>}
  </div>
}
