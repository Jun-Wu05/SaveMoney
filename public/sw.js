/* Minimal offline shell for GitHub Pages project site. No external analytics. */
const CACHE = 'savemoney-shell-v1'
const BASE = self.registration.scope
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon.svg'])))
  self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('savemoney-shell-') && k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put(BASE, response.clone())
      return response
    }).catch(() => caches.match(BASE)))
    return
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
    if (response.ok && new URL(request.url).pathname.startsWith(new URL(BASE).pathname)) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)))
    }
    return response
  })))
})
