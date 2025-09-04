const CACHE_NAME = 'incident-dashboard-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-152.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached successfully');
        return self.skipWaiting(); // Activate new service worker immediately
      })
      .catch(error => {
        console.error('Service Worker: Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activate event');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API calls - always try network first for real-time data
  if (url.hostname === 'sizeup.firstduesizeup.com' || 
      url.hostname === 'corsproxy.io') {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, return the response
          if (response.ok) {
            return response;
          }
          throw new Error('Network response not ok');
        })
        .catch(error => {
          console.log('Service Worker: API request failed, app will handle offline state');
          // Return a custom offline response for API calls
          return new Response(
            JSON.stringify({ 
              error: 'offline', 
              message: 'API unavailable - check connection' 
            }),
            { 
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }
  
  // Handle static assets - cache first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        
        // Otherwise fetch from network
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Add to cache for future use
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.log('Service Worker: Fetch failed:', error);
            
            // If it's an HTML request, return the main page from cache
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // For other requests, let them fail naturally
            throw error;
          });
      })
  );
});

// Handle background sync (if supported)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync event:', event.tag);
  
  if (event.tag === 'incident-sync') {
    event.waitUntil(
      // This could be used to sync data when connection is restored
      Promise.resolve()
    );
  }
});

// Handle push notifications (if you want to add them later)
self.addEventListener('push', event => {
  console.log('Service Worker: Push event received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New incident alert',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [300, 100, 400],
      data: data,
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Incident Alert', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click event');
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/?notification=true')
    );
  }
});