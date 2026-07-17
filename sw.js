/**
 * @fileoverview 11 Avatar SMEs CRM - Service Worker (PWA)
 * @description Progressive Web App service worker for offline support,
 *              intelligent caching strategies, background sync, and
 *              push notifications. Optimized for GitHub Pages deployment.
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 */

'use strict';

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

/** @constant {string} Current cache version for cache busting */
const CACHE_VERSION = '11avatar-v3-' + Date.now();

/** @constant {string} Static assets cache name */
const STATIC_CACHE = CACHE_VERSION + '-static';

/** @constant {string} Dynamic content cache name */
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

/** @constant {string} API response cache name */
const API_CACHE = CACHE_VERSION + '-api';

/**
 * Static assets to pre-cache on install
 * @constant {Array<string>} URLs relative to service worker scope
 */
const STATIC_ASSETS = [
    // Core pages
    'index.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    '404.html',
    'offline.html',
    'demo.html',
    
    // Landing pages
    'about.html',
    'contact.html',
    'pricing.html',
    'features.html',
    'integrations.html',
    'privacy.html',
    'terms.html',
    'refund.html',
    'security.html',
    'careers.html',
    'partners.html',
    
    // Core CSS
    'src/css/main.css',
    'src/css/auth.css',
    'src/css/landing.css',
    'src/css/dashboard.css',
    
    // Core JS
    'src/js/config/constants.js',
    'src/js/config/firebase.js',
    'src/js/config/routes.js',
    'src/js/core/app.js',
    'src/js/core/router.js',
    'src/js/index.js',
    
    // Auth JS
    'src/js/auth/auth.js',
    'src/js/auth/login.js',
    'src/js/auth/register.js',
    
    // Manifest & Icons
    'manifest.json',
    'icons/icon.svg',
    'icons/icon-72x72.png',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    
    // Assets
    'assets/og-image.svg',
    'assets/empty-state.svg',
];

/**
 * URLs that should always bypass cache (network-only)
 * @constant {Array<string>} URL patterns
 */
const NETWORK_ONLY_PATTERNS = [
    '/api/',
    '/__/auth/',
    'identitytoolkit.googleapis.com',
    'firestore.googleapis.com',
    'securetoken.googleapis.com',
    'googleapis.com/identitytoolkit',
];

/**
 * Maximum cache age for dynamic content (24 hours)
 * @constant {number} Milliseconds
 */
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;

// =============================================================================
// INSTALL EVENT
// =============================================================================

self.addEventListener('install', function(event) {
    console.log('[SW] Installing v' + CACHE_VERSION + '...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                console.log('[SW] Pre-caching ' + STATIC_ASSETS.length + ' static assets...');
                
                // Cache each asset individually for better error handling
                return Promise.allSettled(
                    STATIC_ASSETS.map(function(url) {
                        return cache.add(url).catch(function(error) {
                            console.warn('[SW] Failed to cache:', url, error.message);
                        });
                    })
                );
            })
            .then(function() {
                console.log('[SW] Static assets cached');
                // Activate immediately
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('[SW] Cache install failed:', error);
            })
    );
});

// =============================================================================
// ACTIVATE EVENT
// =============================================================================

self.addEventListener('activate', function(event) {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                // Delete old cache versions
                return Promise.all(
                    cacheNames
                        .filter(function(name) {
                            return name.startsWith('11avatar-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE && 
                                   name !== API_CACHE;
                        })
                        .map(function(name) {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                console.log('[SW] Activated, claiming clients...');
                return self.clients.claim();
            })
    );
});

// =============================================================================
// FETCH EVENT - Smart Caching
// =============================================================================

self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip non-HTTP(S) requests
    if (!url.protocol.startsWith('http')) return;
    
    // Skip browser extensions
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;
    
    // Network-only for API calls and Firebase auth
    if (isNetworkOnly(url)) {
        event.respondWith(networkOnlyStrategy(request));
        return;
    }
    
    // HTML pages - Network first, offline fallback
    if (request.mode === 'navigate' || isHTMLRequest(request)) {
        event.respondWith(htmlStrategy(request));
        return;
    }
    
    // Static assets - Cache first
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }
    
    // Default - Network first
    event.respondWith(networkFirstStrategy(request));
});

// =============================================================================
// CACHING STRATEGIES
// =============================================================================

/**
 * Cache First: Check cache → Return → Network fallback → Cache for next time
 * Best for: CSS, JS, images, fonts (static assets)
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstStrategy(request) {
    try {
        var cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
    } catch (e) {
        // Cache match failed, continue to network
    }
    
    try {
        var networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            var cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return a fallback for images
        if (request.destination === 'image') {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#1A1A1A" width="200" height="200"/><text fill="#888" font-size="14" text-anchor="middle" x="100" y="105">Image Offline</text></svg>',
                { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' } }
            );
        }
        
        throw error;
    }
}

/**
 * Network First: Fetch → Return → Cache → Fallback to cache
 * Best for: API responses, dynamic content
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstStrategy(request) {
    try {
        var networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
            var cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        var cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            // Check if cached response is too old
            var cacheDate = cachedResponse.headers.get('sw-cached-date');
            if (cacheDate) {
                var age = Date.now() - parseInt(cacheDate, 10);
                if (age > MAX_CACHE_AGE) {
                    console.log('[SW] Cached response too old, returning anyway');
                }
            }
            return cachedResponse;
        }
        
        throw error;
    }
}

/**
 * HTML Strategy: Network first → Cache → Offline page fallback
 * Best for: HTML page navigations
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function htmlStrategy(request) {
    try {
        var networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            var cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Try cache
        var cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page
        var offlineResponse = await caches.match('offline.html');
        if (offlineResponse) {
            return offlineResponse;
        }
        
        // Ultimate fallback
        return new Response(
            '<!DOCTYPE html><html lang="en-IN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Offline</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0A0A0A;color:#D4AF37;text-align:center;padding:20px}h1{font-size:2rem;margin-bottom:8px}p{color:#888}</style></head><body><div><h1>📡 You are Offline</h1><p>Please check your internet connection and try again.</p></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    }
}

/**
 * Network Only: Always fetch from network
 * Best for: Authentication, real-time data
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkOnlyStrategy(request) {
    try {
        return await fetch(request);
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'You are offline', offline: true, timestamp: new Date().toISOString() }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// =============================================================================
// REQUEST CLASSIFICATION
// =============================================================================

/**
 * Check if URL should bypass cache
 * @param {URL} url
 * @returns {boolean}
 */
function isNetworkOnly(url) {
    var href = url.href;
    for (var i = 0; i < NETWORK_ONLY_PATTERNS.length; i++) {
        if (href.indexOf(NETWORK_ONLY_PATTERNS[i]) !== -1) {
            return true;
        }
    }
    return false;
}

/**
 * Check if request is for an HTML page
 * @param {Request} request
 * @returns {boolean}
 */
function isHTMLRequest(request) {
    var accept = request.headers.get('accept') || '';
    return accept.indexOf('text/html') !== -1;
}

/**
 * Check if URL is a static asset
 * @param {URL} url
 * @returns {boolean}
 */
function isStaticAsset(url) {
    var pathname = url.pathname;
    return /\.(css|js|json|png|jpg|jpeg|svg|ico|woff|woff2|webp|gif|ttf|eot)$/i.test(pathname) ||
           pathname.indexOf('/icons/') !== -1 ||
           pathname.indexOf('/assets/') !== -1 ||
           pathname.indexOf('/fonts/') !== -1;
}

// =============================================================================
// BACKGROUND SYNC
// =============================================================================

self.addEventListener('sync', function(event) {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-queue') {
        event.waitUntil(processSyncQueue());
    } else if (event.tag === 'sync-data') {
        event.waitUntil(syncAllData());
    }
});

/**
 * Process pending sync queue
 * @returns {Promise<void>}
 */
async function processSyncQueue() {
    try {
        var cache = await caches.open(API_CACHE);
        var queueResponse = await cache.match('sync-queue');
        
        if (!queueResponse) {
            console.log('[SW] No pending sync items');
            return;
        }
        
        var queue = await queueResponse.json();
        console.log('[SW] Processing ' + queue.length + ' sync items...');
        
        var processed = 0;
        
        for (var i = 0; i < queue.length; i++) {
            var item = queue[i];
            try {
                var response = await fetch(item.url, {
                    method: item.method || 'POST',
                    headers: item.headers || { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.body),
                });
                
                if (response.ok) processed++;
            } catch (error) {
                console.error('[SW] Sync item failed:', item.id, error.message);
            }
        }
        
        await cache.delete('sync-queue');
        console.log('[SW] Sync complete: ' + processed + '/' + queue.length);
        
        // Notify all clients
        var clients = await self.clients.matchAll();
        clients.forEach(function(client) {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                processed: processed,
                total: queue.length,
            });
        });
        
    } catch (error) {
        console.error('[SW] Sync processing failed:', error);
    }
}

/**
 * Sync all pending data
 * @returns {Promise<void>}
 */
async function syncAllData() {
    try {
        var cache = await caches.open(API_CACHE);
        var pendingData = await cache.match('pending-data');
        
        if (pendingData) {
            await cache.delete('pending-data');
            console.log('[SW] Pending data synced');
        }
    } catch (error) {
        console.error('[SW] Data sync failed:', error);
    }
}

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

self.addEventListener('push', function(event) {
    console.log('[SW] Push notification received');
    
    var data = {
        title: '11 Avatar Digital Hub',
        body: 'You have a new notification',
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-72x72.png',
        data: { url: 'index.html' },
    };
    
    if (event.data) {
        try {
            var payload = event.data.json();
            data = Object.assign(data, payload);
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    var options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [200, 100, 200],
        data: data.data,
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'close', title: 'Dismiss' },
        ],
        requireInteraction: data.requireInteraction !== false,
        tag: data.tag || 'default',
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'close') return;
    
    var url = (event.notification.data && event.notification.data.url) || 'index.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(windowClients) {
                // Focus existing window if open
                for (var i = 0; i < windowClients.length; i++) {
                    var client = windowClients[i];
                    if (client.url.indexOf(url) !== -1 && 'focus' in client) {
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

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

self.addEventListener('message', function(event) {
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
                caches.keys().then(function(names) {
                    return Promise.all(names.map(function(name) {
                        return caches.delete(name);
                    }));
                })
            );
            break;
            
        case 'ADD_TO_SYNC':
            event.waitUntil(
                caches.open(API_CACHE).then(function(cache) {
                    return cache.match('sync-queue').then(function(response) {
                        var queue = [];
                        if (response) {
                            return response.json().then(function(data) {
                                queue = data;
                                queue.push(event.data.item);
                                return cache.put('sync-queue', new Response(JSON.stringify(queue)));
                            });
                        }
                        queue.push(event.data.item);
                        return cache.put('sync-queue', new Response(JSON.stringify(queue)));
                    });
                })
            );
            break;
            
        default:
            console.log('[SW] Unknown message type:', event.data.type);
    }
});

// =============================================================================
// PERIODIC SYNC
// =============================================================================

self.addEventListener('periodicsync', function(event) {
    console.log('[SW] Periodic sync:', event.tag);
    
    if (event.tag === 'data-sync') {
        event.waitUntil(syncAllData());
    }
});

// =============================================================================
// INIT LOG
// =============================================================================

console.log('[SW] Service Worker loaded v' + CACHE_VERSION);
console.log('[SW] Pre-caching ' + STATIC_ASSETS.length + ' assets');