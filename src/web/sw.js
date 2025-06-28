// Service Worker for PWA functionality
const CACHE_NAME = 'securechat-v1.0.0';
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/chat.html',
    '/calc.html',
    '/notes.html',
    '/css/main.css',
    '/css/chat.css',
    '/css/calc.css',
    '/css/notes.css',
    '/js/core/storage.js',
    '/js/core/auth.js',
    '/js/core/websocket.js',
    '/js/core/sync.js',
    '/js/security/crypto.js',
    '/js/security/detector.js',
    '/js/security/emergency.js',
    '/js/security/disguise.js',
    '/js/ui/chat-ui.js',
    '/js/ui/calc-ui.js',
    '/js/ui/notes-ui.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('Service Worker installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker installation failed:', error);
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip external requests
    if (url.origin !== location.origin) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }
                
                // Fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Cache successful responses
                        if (networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(request, responseClone);
                                });
                        }
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('Fetch failed:', error);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Background sync
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'New message received',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open Chat',
                icon: '/icons/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/xmark.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('SecureChat', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/chat.html')
        );
    }
});

// Message from main thread
self.addEventListener('message', (event) => {
    console.log('Message received in SW:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Helper function to sync messages
async function syncMessages() {
    try {
        // Get pending messages from IndexedDB
        const pendingMessages = await getPendingMessages();
        
        for (const message of pendingMessages) {
            try {
                // Attempt to send message
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message)
                });
                
                if (response.ok) {
                    // Remove from pending queue
                    await removePendingMessage(message.id);
                }
            } catch (error) {
                console.error('Failed to sync message:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Helper function to get pending messages
async function getPendingMessages() {
    // This would integrate with your IndexedDB implementation
    return [];
}

// Helper function to remove pending message
async function removePendingMessage(messageId) {
    // This would integrate with your IndexedDB implementation
    console.log('Removing pending message:', messageId);
}

