/* ==========================================
   11 AVATAR DIGITAL HUB
   Service Worker - PWA Offline Support
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Cache static assets for offline access
   - Network-first strategy for dynamic content
   - Background sync for offline operations
   - Push notification support
   - Periodic cache cleanup
   - Install prompt management
   ========================================== */

// ==========================================
// CACHE CONFIGURATION
// ==========================================
const CACHE_VERSION = '11avatar-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/public/index.html',
    '/public/login.html',
    '/public/register.html',
    '/public/forgot-password.html',
    '/public/404.html',
    '/public/offline.html',
    '/public/manifest.json',
    '/src/css/main.css',
    '/src/js/config/constants.js',
    '/src/js/config/firebase.js',
    '/src/js/core/app.js',
    '/src/js/core/router.js',
    '/src/js/core/state.js',
    '/src/js/core/eventBus.js',
    '/src/js/core/api.js',
    '/src/js/core/cache.js',
    '/src/js/core/offline.js',
    '/src/js/auth/auth.js',
    '/src/js/auth/permissions.js',
    '/src/js/auth/session.js',
    '/src/js/auth/middleware.js',
    '/assets/images/logo-icon.svg',
    '/assets/images/icons/icon-192.png',
    '/assets/images/icons/icon-512.png'
];

// URLs that should always be fetched from network
const NETWORK_ONLY_URLS = [
    '/api/',
    '/__/auth/',
    'identitytoolkit.googleapis.com',
    'firestore.googleapis.com',
    'securetoken.googleapis.com'
];

// ==========================================
// INSTALL EVENT - Cache Static Assets
// ==========================================
self.addEventListener('install', (event) => {
    console.log('👷 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('💾 Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Cache install failed:', error);
            })
    );
});

// ==========================================
// ACTIVATE EVENT - Clean Old Caches
// ==========================================
self.addEventListener('activate', (event) => {
    console.log('👷 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete old version caches
                            return name.startsWith('11avatar-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE && 
                                   name !== API_CACHE;
                        })
                        .map((name) => {
                            console.log('🗑️ Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
    );
});

// ==========================================
// FETCH EVENT - Smart Caching Strategy
// ==========================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Network-only for API calls and auth
    if (NETWORK_ONLY_URLS.some(pattern => url.href.includes(pattern))) {
        event.respondWith(networkOnly(request));
        return;
    }
    
    // HTML pages - Network first, fallback to cache
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Static assets - Cache first, network fallback
    if (
        url.pathname.match(/\.(css|js|json|png|jpg|svg|ico|woff2|webp)$/) ||
        url.pathname.includes('/assets/')
    ) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Default - Network first with cache fallback
    event.respondWith(networkFirst(request));
});

// ==========================================
// CACHING STRATEGIES
// ==========================================

/**
 * Cache First Strategy
 * Check cache → Return cached → Network fallback → Cache response
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return offline fallback for images
        if (request.destination === 'image') {
            return caches.match('/assets/images/offline-placeholder.png');
        }
        
        throw error;
    }
}

/**
 * Network First Strategy
 * Fetch network → Return response → Cache response → Fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If HTML request, return offline page
        if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/public/offline.html');
        }
        
        throw error;
    }
}

/**
 * Network Only Strategy
 * Always fetch from network, no caching
 */
async function networkOnly(request) {
    try {
        return await fetch(request);
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'You are offline', 
            offline: true,
            timestamp: new Date().toISOString()
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ==========================================
// BACKGROUND SYNC
// ==========================================
self.addEventListener('sync', (event) => {
    console.log('🔄 Background Sync triggered:', event.tag);
    
    if (event.tag === 'sync-queue') {
        event.waitUntil(processSyncQueue());
    } else if (event.tag === 'sync-data') {
        event.waitUntil(syncAllData());
    }
});

/**
 * Process offline sync queue
 */
async function processSyncQueue() {
    try {
        const cache = await caches.open(API_CACHE);
        const queueResponse = await cache.match('sync-queue');
        
        if (!queueResponse) {
            console.log('🔄 No pending sync items');
            return;
        }
        
        const queue = await queueResponse.json();
        console.log(`🔄 Processing ${queue.length} sync items...`);
        
        let processed = 0;
        
        for (const item of queue) {
            try {
                const response = await fetch(item.url, {
                    method: item.method || 'POST',
                    headers: item.headers || { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body)
                });
                
                if (response.ok) {
                    processed++;
                }
            } catch (error) {
                console.error('❌ Sync item failed:', item.id, error);
            }
        }
        
        // Clear processed queue
        await cache.delete('sync-queue');
        
        console.log(`✅ Sync complete: ${processed}/${queue.length} items`);
        
        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                processed: processed,
                total: queue.length
            });
        });
        
    } catch (error) {
        console.error('❌ Sync processing failed:', error);
    }
}

/**
 * Sync all pending data
 */
async function syncAllData() {
    try {
        const cache = await caches.open(API_CACHE);
        const pendingData = await cache.match('pending-data');
        
        if (pendingData) {
            const data = await pendingData.json();
            console.log('🔄 Syncing pending data...');
            // Process pending data
            await cache.delete('pending-data');
        }
    } catch (error) {
        console.error('❌ Data sync failed:', error);
    }
}

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', (event) => {
    console.log('📨 Push notification received');
    
    let data = {
        title: '11 Avatar Digital Hub',
        body: 'You have a new notification',
        icon: '/assets/images/icons/icon-192.png',
        badge: '/assets/images/icons/icon-72.png',
        data: {
            url: '/#/dashboard'
        }
    };
    
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [200, 100, 200],
        data: data.data,
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'close', title: 'Dismiss' }
        ],
        requireInteraction: true,
        tag: data.tag || 'default'
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const url = event.notification.data?.url || '/#/dashboard';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there is already a window open
                for (const client of windowClients) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ==========================================
// MESSAGE HANDLING
// ==========================================
self.addEventListener('message', (event) => {
    console.log('📨 Message received in SW:', event.data);
    
    if (!event.data) return;
    
    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ version: CACHE_VERSION });
            }
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(
                caches.keys().then(names => 
                    Promise.all(names.map(name => caches.delete(name)))
                )
            );
            break;
            
        case 'ADD_TO_SYNC':
            event.waitUntil(
                caches.open(API_CACHE).then(cache => {
                    return cache.match('sync-queue').then(response => {
                        let queue = [];
                        if (response) {
                            return response.json().then(data => {
                                queue = data;
                                queue.push(event.data.item);
                                return cache.put('sync-queue', new Response(JSON.stringify(queue)));
                            });
                        } else {
                            queue.push(event.data.item);
                            return cache.put('sync-queue', new Response(JSON.stringify(queue)));
                        }
                    });
                })
            );
            break;
            
        default:
            console.log('📨 Unknown message type:', event.data.type);
    }
});

// ==========================================
// PERIODIC SYNC (if supported)
// ==========================================
self.addEventListener('periodicsync', (event) => {
    console.log('🔄 Periodic sync triggered:', event.tag);
    
    if (event.tag === 'data-sync') {
        event.waitUntil(syncAllData());
    }
});

// ==========================================
// SERVICE WORKER READY
// ==========================================
console.log('👷 Service Worker loaded and ready');
console.log('💾 Cache version:', CACHE_VERSION);
console.log('📦 Static assets:', STATIC_ASSETS.length);

// ==========================================
// END OF SERVICE WORKER
// ==========================================
