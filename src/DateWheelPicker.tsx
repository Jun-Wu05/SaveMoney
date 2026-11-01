import { useEffect, useRef, useState } from 'react'
import { validDate } from './dateRangeStats'

const ITEM_HEIGHT = 44
const pad = (n: number) => String(n).padStart(2, '0')
const format = (value: string) => `${value.slice(0,4)}年${Number(value.slice(5,7))}月${Number(value.slice(8,10))}日`

// Explicit scroll wheels instead of <input type="date">: iOS Safari renders a
// system calendar for date inputs, which cannot be styled as a wheel.
function WheelColumn({items, selected, suffix, onChange}: {
  items: number[]; selected: number; suffix: string; onChange: (value: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const index = Math.max(0, items.indexOf(selected))
    ref.current?.scrollTo({top:index * ITEM_HEIGHT,behavior:'auto'})
  }, [items.length, selected])
  useEffect(() => () => { if(timer.current) clearTimeout(timer.current) }, [])
  const settle = () => {
    if(!ref.current) return
    const index = Math.min(items.length-1, Math.max(0,Math.round(ref.current.scrollTop / ITEM_HEIGHT)))
    if(items[index] !== selected) onChange(items[index])
    ref.current.scrollTo({top:index * ITEM_HEIGHT,behavior:'smooth'})
  }
  return <div className="date-wheel-col">
    <div className="date-wheel-scroll" ref={ref} role="listbox" aria-label={suffix} aria-activedescendant={`wheel-${suffix}-${selected}`}
      onScroll={() => {if(timer.current) clearTimeout(timer.current);timer.current=setTimeout(settle,90)}}>
      <div className="date-wheel-spacer" aria-hidden="true"/>
      {items.map(value=><button type="button" key={value} id={`wheel-${suffix}-${value}`} role="option" aria-selected={selected===value}
        className={value===selected?'date-wheel-item active':'date-wheel-item'}
        onClick={()=>onChange(value)}>{value}{suffix}</button>)}
      <div className="date-wheel-spacer" aria-hidden="true"/>
    </div>
  </div>
}

export function DateWheelPicker({value, onConfirm, onCancel}: {
  value: string; onConfirm: (date:string)=>void; onCancel:()=>void
}) {
  const initial = validDate(value)?value:'2026-01-01'
  const [year,setYear]=useState(Number(initial.slice(0,4)))
  const [month,setMonth]=useState(Number(initial.slice(5,7)))
  const [day,setDay]=useState(Number(initial.slice(8,10)))
  const daysInMonth = new Date(year,month,0).getDate()
  const safeDay = Math.min(day,daysInMonth)
  const years = Array.from({length:151},(_,i)=>1970+i)
  const months = Array.from({length:12},(_,i)=>i+1)
  const days = Array.from({length:daysInMonth},(_,i)=>i+1)
  const confirm = () => onConfirm(`${year}-${pad(month)}-${pad(safeDay)}`)
  return <div className="date-wheel-backdrop" onClick={onCancel}>
    <div className="date-wheel-sheet" role="dialog" aria-modal="true" aria-label="滚动选择日期" onClick={e=>e.stopPropagation()}>
      <div className="date-wheel-toolbar"><button type="button" onClick={onCancel}>取消</button><strong>选择日期</strong><button type="button" onClick={confirm}>确定</button></div>
      <div className="date-wheel-picker"><div className="date-wheel-selection" aria-hidden="true"/>
        <WheelColumn items={years} selected={year} suffix="年" onChange={setYear}/>
        <WheelColumn items={months} selected={month} suffix="月" onChange={setMonth}/>
        <WheelColumn items={days} selected={safeDay} suffix="日" onChange={setDay}/>
      </div>
      <div className="date-wheel-caption">上下滚动选择年月日 · {format(`${year}-${pad(month)}-${pad(safeDay)}`)}</div>
    </div>
  </div>
}
