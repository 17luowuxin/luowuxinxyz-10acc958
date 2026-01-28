// Service Worker for Push Notifications + PWA Precaching
const CACHE_NAME = 'lovable-v1';

// 核心资源预缓存列表（首次安装时缓存）
const PRECACHE_ASSETS = [
  '/',
  '/app-icon.jpg',
  '/favicon.ico',
  '/manifest.json',
  // 视频背景在需要时缓存，不预加载（太大）
];

// 需要网络优先策略的路径（API、实时数据）
const NETWORK_FIRST_PATHS = [
  '/functions/',
  '/rest/',
  '/auth/',
];

// 安装时预缓存核心资源
self.addEventListener('install', function(event) {
  console.log('[SW] Installing with precache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('[SW] Precache failed:', err);
        return self.skipWaiting();
      })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => clients.claim())
  );
});

// 请求拦截：智能缓存策略
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // 跳过非GET请求
  if (event.request.method !== 'GET') return;
  
  // 跳过需要网络优先的路径（API调用等）
  if (NETWORK_FIRST_PATHS.some(path => url.pathname.includes(path))) {
    return;
  }
  
  // 跳过外部请求
  if (!url.origin.includes(self.location.origin) && 
      !url.hostname.includes('supabase')) {
    return;
  }
  
  // 静态资源：缓存优先策略
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot|ico)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            // 后台更新缓存
            fetch(event.request)
              .then(response => {
                if (response.ok) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response);
                  });
                }
              })
              .catch(() => {});
            return cached;
          }
          return fetch(event.request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }
  
  // HTML页面：网络优先，失败回退缓存
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/'))
    );
    return;
  }
});

// Push 通知处理
self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  let data = { title: '新消息', body: '你收到了一条新消息' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }
  
  const options = {
    body: data.body || '你收到了一条新消息',
    icon: '/app-icon.jpg',
    badge: '/app-icon.jpg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      characterId: data.characterId,
      messageId: data.messageId
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '新消息', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 尝试聚焦已存在的窗口
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // 没有窗口则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
