/**
 * iOS standalone PWA occasionally retains WebKit's focus-induced page zoom
 * after the software keyboard closes. Browser Safari is intentionally excluded.
 *
 * A temporary viewport clamp is only used when an editing session started at
 * normal scale and there was no user pinch gesture. The original viewport meta
 * is always restored so accessibility pinch-to-zoom remains available.
 */
export function isStandaloneGoodsPwa() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || window.matchMedia('(display-mode: standalone)').matches
}

export function shouldRestoreGoodsZoom(
  standalone: boolean, initialScale: number, currentScale: number, userPinched: boolean,
) {
  return standalone && initialScale <= 1.04 && currentScale > 1.045 && !userPinched
}

export function installGoodsPwaZoomRecovery(container: HTMLElement): () => void {
  if (!isStandaloneGoodsPwa() || !window.visualViewport) return () => {}
  const viewport = window.visualViewport
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return () => {}
  let initialScale = 1
  let userPinched = false
  let editing = false
  let lastHeight = viewport.height
  let keyboardClosed = false
  let restoring = false
  let restoreTimer = 0
  const originalViewportContent = meta.getAttribute('content')
  const recoveryTimers = new Set<number>()

  const isEditor = (target: EventTarget | null): target is HTMLElement =>
    target instanceof HTMLElement &&
    container.contains(target) &&
    target.matches('input, textarea, select, [contenteditable="true"]')

  const clearRecoveryTimers = () => {
    for (const id of recoveryTimers) window.clearTimeout(id)
    recoveryTimers.clear()
  }

  const tryRestore = () => {
    if (!editing || restoring) return
    if (isEditor(document.activeElement) && !keyboardClosed) return
    if (!shouldRestoreGoodsZoom(true, initialScale, viewport.scale, userPinched)) return
    // Clamp the zoom just long enough for WebKit to recompute the visual viewport.
    // Restore on a later frame: never leave pinch-to-zoom disabled.
    const original = meta.getAttribute('content')
    if (original === null) return
    restoring = true
    const unclamped = original.replace(/,?\s*(?:maximum-scale|minimum-scale|user-scalable)\s*=\s*[^,]+/gi, '')
    meta.setAttribute('content', unclamped + ', maximum-scale=1')
    restoreTimer = window.setTimeout(() => {
      meta.setAttribute('content', original)
      restoring = false
      // A zoomed layout can remain horizontally panned even after the scale resets.
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' })
    }, 110)
  }

  const scheduleRecovery = () => {
    clearRecoveryTimers()
    for (const ms of [160, 420, 850]) {
      const id = window.setTimeout(() => {
        recoveryTimers.delete(id)
        tryRestore()
      }, ms)
      recoveryTimers.add(id)
    }
  }

  const onFocusIn = (event: FocusEvent) => {
    if (!isEditor(event.target)) return
    if (!editing) {
      initialScale = viewport.scale
      userPinched = false
    }
    editing = true
    keyboardClosed = false
  }
  const onFocusOut = (event: FocusEvent) => {
    if (!isEditor(event.target)) return
    // New input may receive focus in the same microtask. Recovery only runs
    // when no goods input is actively editing.
    keyboardClosed = true
    scheduleRecovery()
  }
  const onTouchStart = (event: TouchEvent) => {
    if (editing && event.touches.length > 1) userPinched = true
  }
  const onResize = () => {
    const nextHeight = viewport.height
    // Keyboard dismissal can occur without blur on the installed home-screen app.
    if (editing && nextHeight - lastHeight > 90) {keyboardClosed = true; scheduleRecovery()}
    lastHeight = nextHeight
  }
  const onTouchEnd = () => {
    if (editing && !isEditor(document.activeElement)) scheduleRecovery()
  }

  container.addEventListener('focusin', onFocusIn)
  container.addEventListener('focusout', onFocusOut)
  container.addEventListener('touchstart', onTouchStart, { passive: true })
  container.addEventListener('touchend', onTouchEnd, { passive: true })
  viewport.addEventListener('resize', onResize)
  return () => {
    clearRecoveryTimers()
    window.clearTimeout(restoreTimer)
    if (restoring) {
      // The temporary content is not persisted when the screen unmounts.
      if (originalViewportContent !== null) meta.setAttribute('content', originalViewportContent)
    }
    container.removeEventListener('focusin', onFocusIn)
    container.removeEventListener('focusout', onFocusOut)
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('touchend', onTouchEnd)
    viewport.removeEventListener('resize', onResize)
  }
}
