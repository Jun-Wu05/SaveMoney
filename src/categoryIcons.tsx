import { BookOpen, Bus, Ellipsis, Film, Gift, Heart, House, ShoppingBag, Utensils, Wallet, Briefcase, Coffee, CarFront, Plane, Gamepad2, HeartPulse, PawPrint, Shirt, Smartphone, Music, Dumbbell, PiggyBank, Home } from 'lucide-react'

export const icons: Record<string, typeof Home> = {
  utensils: Utensils, 'shopping-bag': ShoppingBag, bus: Bus, house: House, film: Film,
  heart: Heart, book: BookOpen, ellipsis: Ellipsis, wallet: Wallet, gift: Gift, briefcase: Briefcase, coffee: Coffee, 'car-front': CarFront, plane: Plane, 'gamepad-2': Gamepad2, 'heart-pulse': HeartPulse, 'paw-print': PawPrint, shirt: Shirt, smartphone: Smartphone, music: Music, dumbbell: Dumbbell, 'piggy-bank': PiggyBank,
}
const iconChoices = [
  ['utensils','餐饮'],['coffee','咖啡'],['shopping-bag','购物'],['shirt','服饰'],
  ['bus','交通'],['car-front','汽车'],['house','住房'],['plane','旅行'],
  ['film','娱乐'],['gamepad-2','游戏'],['heart','健康'],['heart-pulse','医疗'],
  ['book','学习'],['paw-print','宠物'],['gift','礼物'],['smartphone','数码'],
  ['music','音乐'],['dumbbell','运动'],['wallet','钱包'],['piggy-bank','储蓄'],
  ['briefcase','工作'],['ellipsis','其他'],
] as const
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return <div className="category-icon-picker" role="group" aria-label="选择分类图标">
    {iconChoices.map(([key,label])=>{const Icon=icons[key];return <button key={key} type="button" aria-label={label} aria-pressed={value===key} className={value===key?'chosen':''} onClick={()=>onChange(key)}><Icon size={20}/><span>{label}</span></button>})}
  </div>
}
