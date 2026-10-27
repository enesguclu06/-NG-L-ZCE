// Service Worker Push Notification Handler for YOKDILHUNTER

self.addEventListener('push', function (event) {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      data = { title: 'YOKDILHUNTER 🎯', body: event.data.text() }
    }
  }

  const title = data.title || 'YOKDILHUNTER 🎯'
  const options = {
    body: data.body || 'Kelime ezberleme vakti! Bugün tekrar etmen gereken kelimeleri unutma 📚',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'yokdilhunter-daily-reminder',
    renotify: true,
    data: data.data || { url: '/review' },
    actions: [
      { action: 'open', title: 'Kelime Çalış 📚' },
      { action: 'close', title: 'Kapat' }
    ]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.action === 'close') return

  const targetUrl = event.notification.data?.url || '/review'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
