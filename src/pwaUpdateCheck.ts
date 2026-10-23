/** Manual Service Worker update check. Never deletes caches or app data. */
export type PwaUpdateCheckResult = 'available' | 'current' | 'inconclusive'

export async function checkPwaUpdate(registration: ServiceWorkerRegistration, settleMs = 6500): Promise<PwaUpdateCheckResult> {
  if (registration.waiting) return 'available'

  const tracked: { worker: ServiceWorker | null } = { worker: null }
  let settle: (() => void) | null = null
  const installed = new Promise<void>(resolve => { settle = resolve })
  const onWorkerState = () => {
    if (tracked.worker?.state === 'installed' || tracked.worker?.state === 'redundant') settle?.()
  }
  const watchInstalling = () => {
    const worker = registration.installing
    if (!worker || tracked.worker === worker) return
    tracked.worker?.removeEventListener('statechange', onWorkerState)
    tracked.worker = worker
    worker.addEventListener('statechange', onWorkerState)
    onWorkerState()
  }
  const onUpdateFound = () => watchInstalling()
  registration.addEventListener('updatefound', onUpdateFound)
  watchInstalling()

  try {
    // update() checks the network; waiting worker becomes available only after install.
    await registration.update()
    watchInstalling()
    if (registration.waiting) return 'available'
    if (tracked.worker && tracked.worker.state !== 'installed' && tracked.worker.state !== 'redundant') {
      const finished = await Promise.race([
        installed.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), settleMs)),
      ])
      if (!finished) return 'inconclusive'
    }
    return registration.waiting ? 'available' : 'current'
  } finally {
    registration.removeEventListener('updatefound', onUpdateFound)
    tracked.worker?.removeEventListener('statechange', onWorkerState)
  }
}
