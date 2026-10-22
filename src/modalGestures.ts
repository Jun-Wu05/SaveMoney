/** Decides when to cancel a native touchmove inside the iOS entry sheet.
 * The scrolling element itself should handle ordinary vertical movement.
 */
export type SheetGesture = {
  deltaX: number
  deltaY: number
  inScroller: boolean
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}
export function blockSheetTouchMove(gesture: SheetGesture): boolean {
  const { deltaX, deltaY, inScroller, scrollTop, scrollHeight, clientHeight } = gesture
  if (!inScroller) return true
  // Cancel diagonal gestures that Safari could interpret as sideways panning.
  if (Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) return true
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  if (maxScroll <= 1) return true
  if (deltaY > 0 && scrollTop <= 0) return true
  if (deltaY < 0 && scrollTop >= maxScroll - 1) return true
  return false
}
