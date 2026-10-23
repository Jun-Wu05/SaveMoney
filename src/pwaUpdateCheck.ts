/** Manual Service Worker update check. Never deletes caches or app data. */
export type PwaUpdateCheckResult = 'available' | 'current' | 'inconclusive'

export async function checkPwaUpdate(registration: ServiceWorkerRegistration, settleMs = 6500): Promise<PwaUpdateCheckResult> {
  if (registration.waiting) return 'available'

  let installing: ServiceWorker | null = null
  let settle: (() => void) | null = null
  const installed = new Promise<void>(resolve => { settle = resolve })
  const onWorkerState = () => {
    if (installing?.state === 'installed' || installing?.state === 'redundant') settle?.()
  }
  const watchInstalling = () => {
    const worker = registration.installing
    if (!worker || installing === worker) return
    installing?.removeEventListener('statechange', onWorkerState)
    installing = worker
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
    if (installing && installing.state !== 'installed' && installing.state !== 'redundant') {
      const finished = await Promise.race([
        installed.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), settleMs)),
      ])
      if (!finished) return 'inconclusive'
    }
    return registration.waiting ? 'available' : 'current'
  } finally {
    registration.removeEventListener('updatefound', onUpdateFound)
    installing?.removeEventListener('statechange', onWorkerState)
  }
}
