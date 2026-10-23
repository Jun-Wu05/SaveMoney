/** Main-page navigation gesture classifier. Native vertical scrolling wins. */
export const MAIN_TABS = ['home', 'list', 'stats', 'settings'] as const
export type MainTab = typeof MAIN_TABS[number]
export type SwipeAxis = 'pending' | 'vertical' | 'horizontal'
export function classifyTabSwipe(dx: number, dy: number, current: SwipeAxis): SwipeAxis {
  if (current !== 'pending') return current
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return 'pending'
  return Math.abs(dx) > Math.abs(dy) * 1.45 ? 'horizontal' : 'vertical'
}
export function tabFromSwipe(current: MainTab, dx: number, dy: number): MainTab | null {
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.45) return null
  const index = MAIN_TABS.indexOf(current)
  return MAIN_TABS[(index + (dx < 0 ? 1 : -1) + MAIN_TABS.length) % MAIN_TABS.length]
}
