import { describe, expect, it, vi } from 'vitest'
import { checkPwaUpdate } from './pwaUpdateCheck'

function mockRegistration(initialWaiting = false) {
  const emitter = new EventTarget()
  const reg = {
    waiting: initialWaiting ? {} : null,
    installing: null as EventTarget & { state: string } | null,
    update: vi.fn(async () => undefined),
    addEventListener: emitter.addEventListener.bind(emitter),
    removeEventListener: emitter.removeEventListener.bind(emitter),
    notify: () => emitter.dispatchEvent(new Event('updatefound')),
  }
  return reg
}

describe('manual PWA update check', () => {
  it('recognizes a worker already waiting without contacting network', async () => {
    const reg = mockRegistration(true)
    expect(await checkPwaUpdate(reg as unknown as ServiceWorkerRegistration)).toBe('available')
    expect(reg.update).not.toHaveBeenCalled()
  })
  it('reports no update after a successful check without a pending worker', async () => {
    const reg = mockRegistration()
    expect(await checkPwaUpdate(reg as unknown as ServiceWorkerRegistration)).toBe('current')
    expect(reg.update).toHaveBeenCalledOnce()
  })
  it('waits for a newly installed update before reporting available', async () => {
    const reg = mockRegistration()
    const events = new EventTarget()
    const worker = Object.assign(events, { state: 'installing' })
    reg.update = vi.fn(async () => {
      reg.installing = worker
      reg.notify()
      queueMicrotask(() => { worker.state = 'installed'; reg.waiting = {} as never; worker.dispatchEvent(new Event('statechange')) })
    })
    expect(await checkPwaUpdate(reg as unknown as ServiceWorkerRegistration)).toBe('available')
  })
  it('reports an inconclusive check rather than falsely claiming current when install stalls', async () => {
    vi.useFakeTimers()
    try {
      const reg = mockRegistration()
      const worker = Object.assign(new EventTarget(), { state: 'installing' })
      reg.installing = worker
      const result = checkPwaUpdate(reg as unknown as ServiceWorkerRegistration, 100)
      await vi.advanceTimersByTimeAsync(101)
      expect(await result).toBe('inconclusive')
    } finally { vi.useRealTimers() }
  })
  it('passes through update request failure', async () => {
    const reg = mockRegistration()
    reg.update.mockRejectedValueOnce(new Error('offline'))
    await expect(checkPwaUpdate(reg as unknown as ServiceWorkerRegistration)).rejects.toThrow('offline')
  })
})
