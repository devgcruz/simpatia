// Service Worker para Web Push Notifications
// Este arquivo será servido como /sw.js

const CACHE_NAME = 'simpatia-notifications-v1';

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  self.skipWaiting(); // Ativar imediatamente
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  return self.clients.claim(); // Controlar todas as páginas imediatamente
});

// Escutar mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Escutar push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification recebida:', event);
  
  let notificationData = {
    title: 'Novo Agendamento',
    body: 'Você tem um novo agendamento',
      icon: '/icon-192x192.svg',
      badge: '/icon-192x192.svg',
    tag: 'agendamento',
    requireInteraction: false,
    data: {
      url: '/atendimento-do-dia',
    },
  };

  // Se houver dados no evento, usar eles
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
      };
    } catch (e) {
      // Se não for JSON, tentar como texto
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200], // Vibração para dispositivos móveis
      actions: [
        {
          action: 'open',
          title: 'Ver Agendamento',
        },
        {
          action: 'close',
          title: 'Fechar',
        },
      ],
    })
  );
});

// Escutar cliques nas notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificação clicada:', event);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Abrir/focar a aplicação
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Se já houver uma janela aberta, focar nela
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((client) => {
              // Navegar para a URL do agendamento se especificada
              if (event.notification.data && event.notification.data.url) {
                return client.navigate(event.notification.data.url);
              }
              return client;
            });
          }
        }
        // Se não houver janela aberta, abrir uma nova
        if (clients.openWindow) {
          const url = event.notification.data?.url || '/atendimento-do-dia';
          return clients.openWindow(url);
        }
      })
    );
  }
});

