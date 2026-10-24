import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

/** Remove first-paint splash only after React has committed and the browser can paint. */
function LaunchReady() {
  React.useEffect(() => {
    let frame1 = 0
    let frame2 = 0
    let timer = 0
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        const splash = document.getElementById('sm-launch')
        if (!splash) return
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        // Let the short brand motion complete while React becomes interactive.
        // Never delay an accessibility-requested reduced-motion launch.
        const remaining = reducedMotion ? 0 : Math.max(0, 980 - performance.now())
        timer = window.setTimeout(() => {
          splash.classList.add('sm-launch-leaving')
          timer = window.setTimeout(() => splash.remove(), reducedMotion ? 0 : 240)
        }, remaining)
      })
    })
    return () => { cancelAnimationFrame(frame1); cancelAnimationFrame(frame2); clearTimeout(timer) }
  }, [])
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><LaunchReady /></React.StrictMode>,
)

const announceUpdate = () => window.dispatchEvent(new Event('savemoney-update-ready'))
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let userApprovedRefresh = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (userApprovedRefresh) window.location.reload()
  })
  window.addEventListener('savemoney-approve-update', () => {
    userApprovedRefresh = true
    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      .then(registration => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }))
      .catch(() => { userApprovedRefresh = false })
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
      .then(registration => {
        if (registration.waiting) announceUpdate()
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate()
          })
        })
        // Install the listener before checking so fast SW updates are not missed.
        void registration.update().catch(error => console.warn('检查应用更新失败', error))
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update().catch(error => console.warn('检查应用更新失败', error))
        })
      })
      .catch(error => console.warn('离线服务注册失败', error))
  })
}
