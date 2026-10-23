import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
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
