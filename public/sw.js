// Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'default',
    renotify: true,
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Infinity Group', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url)
    })
  )
})
