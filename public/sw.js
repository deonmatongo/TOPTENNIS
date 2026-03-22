// TopTennis Service Worker — Web Push handler
// Receives encrypted push messages from the Supabase Edge Function
// and shows OS-level notifications when the app is in the background.

const CACHE_NAME = 'toptennis-v1';

// ── Push event ────────────────────────────────────────────────────────────────
// Fired when the server sends a Web Push message.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TopTennis', body: event.data.text() };
  }

  const title = payload.title || 'TopTennis';
  const options = {
    body:              payload.body || payload.message || '',
    icon:              '/favicon.ico',
    badge:             '/favicon.ico',
    tag:               payload.tag  || payload.id || String(Date.now()),
    data:              { url: payload.actionUrl || payload.url || '/dashboard' },
    requireInteraction: false,
    silent:            false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
// Focus an existing tab or open a new one when the user clicks the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Activate — claim all tabs immediately ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
