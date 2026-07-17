/**
 * @fileoverview 11 Avatar SMEs CRM - Offline Support Manager
 * @description Lightweight offline manager for GitHub Pages static deployment.
 *              Handles network detection, sync queue management, service worker
 *              communication, and connection quality monitoring.
 *              Designed for multi-page architecture (NOT SPA).
 * @module core/offline
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires AppCore (window.AppCore) - optional, for event system
 *
 * @exports window.OfflineManager - Global namespace
 */

'use strict';

// =============================================================================
// OFFLINE MANAGER - Self-executing IIFE
// =============================================================================
const OfflineManager = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: CONFIGURATION
    // -------------------------------------------------------------------------
    
    /** @type {Object} Default configuration */
    const config = {
        /** @type {boolean} Whether service worker is enabled */
        serviceWorkerEnabled: true,
        
        /** @type {string} Path to service worker file */
        serviceWorkerPath: 'sw.js',
        
        /** @type {number} How often to ping for connectivity (ms) */
        pingInterval: 30000,
        
        /** @type {number} Maximum sync queue size */
        maxQueueSize: 500,
        
        /** @type {number} Max retries for failed sync items */
        maxRetries: 5,
        
        /** @type {number} Delay between retries (ms) */
        retryDelay: 30000,
        
        /** @type {string[]} Priority levels for sync items */
        priorityLevels: ['critical', 'high', 'normal', 'low'],
    };

    // -------------------------------------------------------------------------
    // SECTION 2: STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} Internal state */
    const state = {
        /** @type {boolean} Whether browser is online */
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        
        /** @type {string|null} Connection type (4g, 3g, wifi, etc.) */
        connectionType: null,
        
        /** @type {string} Connection quality: excellent, good, slow, offline */
        connectionQuality: typeof navigator !== 'undefined' && navigator.onLine ? 'good' : 'offline',
        
        /** @type {boolean} Whether service worker is registered */
        serviceWorkerRegistered: false,
        
        /** @type {string|null} Service worker version */
        serviceWorkerVersion: null,
        
        /** @type {boolean} Whether sync is in progress */
        syncInProgress: false,
        
        /** @type {string|null} Last successful sync timestamp */
        lastSyncTime: null,
        
        /** @type {string|null} Last online timestamp */
        lastOnlineTime: null,
        
        /** @type {Array} Pending sync operations queue */
        syncQueue: [],
        
        /** @type {number|null} Ping timer interval ID */
        pingTimer: null,
        
        /** @type {Object|null} Service worker registration */
        swRegistration: null,
        
        /** @type {boolean} Whether manager is initialized */
        isInitialized: false,
    };

    // -------------------------------------------------------------------------
    // SECTION 3: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Log message with module prefix
     * @param {string} level - 'log', 'warn', 'error'
     * @param {string} message
     * @param {*} [data]
     */
    function log(level, message, data) {
        try {
            var isDebug = window.Constants && 
                         window.Constants.APP && 
                         window.Constants.APP.DEBUG;
            if (!isDebug && level === 'log') return;
            
            var prefix = '[OfflineManager]';
            switch (level) {
                case 'error': console.error(prefix, message, data || ''); break;
                case 'warn': console.warn(prefix, message, data || ''); break;
                default: console.log(prefix, message, data || ''); break;
            }
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Emit event via AppCore if available, otherwise DOM custom event
     * @param {string} eventName
     * @param {*} [data]
     */
    function emitEvent(eventName, data) {
        try {
            // Try AppCore event system
            if (window.AppCore && typeof window.AppCore.emit === 'function') {
                window.AppCore.emit(eventName, data || {});
            }
            // Also dispatch as DOM custom event
            window.dispatchEvent(new CustomEvent(eventName, {
                detail: data || {},
                bubbles: false,
            }));
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Generate unique sync item ID
     * @returns {string}
     */
    function generateSyncId() {
        return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
    }
    
    /**
     * Get connection info from browser API
     * @returns {Object}
     */
    function getConnectionInfo() {
        try {
            var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn) {
                return {
                    type: conn.effectiveType || 'unknown',
                    downlink: conn.downlink || 0,
                    rtt: conn.rtt || 0,
                };
            }
        } catch (e) { /* Silent */ }
        return { type: 'unknown', downlink: 0, rtt: 0 };
    }
    
    /**
     * Assess connection quality from connection info
     * @param {Object} connInfo
     * @returns {string} 'excellent' | 'good' | 'slow' | 'offline'
     */
    function assessQuality(connInfo) {
        if (!state.online) return 'offline';
        if (connInfo.rtt < 100 && connInfo.downlink > 5) return 'excellent';
        if (connInfo.rtt < 300 && connInfo.downlink > 2) return 'good';
        return 'slow';
    }
    
    /**
     * Sort sync queue by priority
     */
    function sortSyncQueue() {
        var priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        state.syncQueue.sort(function(a, b) {
            var pa = priorityOrder[a.priority] || 2;
            var pb = priorityOrder[b.priority] || 2;
            if (pa !== pb) return pa - pb;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
    }
    
    /**
     * Save sync queue to localStorage
     */
    function saveSyncQueue() {
        try {
            var serializable = state.syncQueue.map(function(item) {
                return {
                    id: item.id,
                    type: item.type,
                    collection: item.collection,
                    docId: item.docId || null,
                    data: item.data || null,
                    priority: item.priority || 'normal',
                    retryCount: item.retryCount || 0,
                    maxRetries: item.maxRetries || config.maxRetries,
                    createdAt: item.createdAt || Date.now(),
                    updatedAt: item.updatedAt || Date.now(),
                    status: item.status || 'pending',
                    error: item.error || null,
                };
            });
            localStorage.setItem('11avatar_sync_queue', JSON.stringify(serializable));
        } catch (e) {
            log('warn', 'Failed to save sync queue:', e.message);
        }
    }
    
    /**
     * Load sync queue from localStorage
     */
    function loadSyncQueue() {
        try {
            var saved = localStorage.getItem('11avatar_sync_queue');
            if (saved) {
                state.syncQueue = JSON.parse(saved);
                log('log', 'Loaded ' + state.syncQueue.length + ' sync items from storage');
            }
        } catch (e) {
            log('warn', 'Failed to load sync queue:', e.message);
            state.syncQueue = [];
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: SERVICE WORKER MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Register the service worker
     * @returns {Promise<void>}
     */
    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            log('warn', 'Service Worker not supported');
            config.serviceWorkerEnabled = false;
            return;
        }
        
        try {
            var registration = await navigator.serviceWorker.register(
                config.serviceWorkerPath,
                { scope: './' }
            );
            
            state.swRegistration = registration;
            state.serviceWorkerRegistered = true;
            
            log('log', 'Service Worker registered: ' + registration.scope);
            
            // Listen for updates
            registration.addEventListener('updatefound', function() {
                var newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            log('log', 'New Service Worker available');
                            emitEvent('offline:updateAvailable', {});
                        }
                    });
                }
            });
            
            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', function(event) {
                handleSWMessage(event.data);
            });
            
            // Check for updates periodically (every hour)
            setInterval(function() {
                registration.update().catch(function() {});
            }, 60 * 60 * 1000);
            
        } catch (error) {
            log('error', 'Service Worker registration failed:', error);
            config.serviceWorkerEnabled = false;
            
            // Try alternate path for GitHub Pages
            try {
                var altRegistration = await navigator.serviceWorker.register(
                    '/11-Avatar-SMEs-CRM/sw.js',
                    { scope: '/11-Avatar-SMEs-CRM/' }
                );
                state.swRegistration = altRegistration;
                state.serviceWorkerRegistered = true;
                log('log', 'Service Worker registered (alt path): ' + altRegistration.scope);
            } catch (e2) {
                log('error', 'Alt path registration also failed');
            }
        }
    }
    
    /**
     * Handle messages from service worker
     * @param {Object} data - Message data
     */
    function handleSWMessage(data) {
        if (!data) return;
        
        switch (data.type) {
            case 'SYNC_COMPLETE':
                log('log', 'Background sync completed: ' + data.processed + '/' + data.total);
                state.syncInProgress = false;
                state.lastSyncTime = new Date().toISOString();
                emitEvent('offline:syncComplete', data);
                break;
                
            case 'CACHE_UPDATED':
                log('log', 'Cache updated by SW');
                emitEvent('offline:cacheUpdated', data);
                break;
                
            default:
                break;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: NETWORK MONITORING
    // -------------------------------------------------------------------------
    
    /**
     * Handle browser online event
     */
    function handleOnline() {
        log('log', 'Network: Online');
        state.online = true;
        state.lastOnlineTime = new Date().toISOString();
        
        var connInfo = getConnectionInfo();
        state.connectionType = connInfo.type;
        state.connectionQuality = assessQuality(connInfo);
        
        // Save last online time
        try {
            localStorage.setItem('11avatar_last_online', Date.now().toString());
        } catch (e) { /* Silent */ }
        
        // Process pending sync
        processSyncQueue();
        
        emitEvent('network:online', { connectionType: state.connectionType });
    }
    
    /**
     * Handle browser offline event
     */
    function handleOffline() {
        log('log', 'Network: Offline');
        state.online = false;
        state.connectionQuality = 'offline';
        
        emitEvent('network:offline', {});
    }
    
    /**
     * Handle connection type change
     */
    function handleConnectionChange() {
        var connInfo = getConnectionInfo();
        state.connectionType = connInfo.type;
        state.connectionQuality = assessQuality(connInfo);
        
        log('log', 'Connection changed: ' + state.connectionType + ' (' + state.connectionQuality + ')');
        emitEvent('network:connectionChange', {
            type: state.connectionType,
            quality: state.connectionQuality,
            downlink: connInfo.downlink,
            rtt: connInfo.rtt,
        });
    }
    
    /**
     * Setup network event listeners
     */
    function setupNetworkListeners() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Connection API
        if (navigator.connection) {
            navigator.connection.addEventListener('change', handleConnectionChange);
            // Initial values
            var connInfo = getConnectionInfo();
            state.connectionType = connInfo.type;
            state.connectionQuality = assessQuality(connInfo);
        }
        
        log('log', 'Network listeners setup complete');
    }

    // -------------------------------------------------------------------------
    // SECTION 6: SYNC QUEUE MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Add an operation to the sync queue
     * @param {Object} operation
     * @param {string} operation.type - 'create' | 'update' | 'delete'
     * @param {string} operation.collection - Firestore collection name
     * @param {string} [operation.docId] - Document ID
     * @param {Object} [operation.data] - Document data
     * @param {string} [operation.priority='normal'] - Priority level
     * @returns {string} Sync item ID
     */
    function addToSyncQueue(operation) {
        try {
            if (!operation || !operation.type || !operation.collection) {
                throw new Error('Sync operation requires type and collection');
            }
            
            if (state.syncQueue.length >= config.maxQueueSize) {
                throw new Error('Sync queue is full (' + config.maxQueueSize + ' items max)');
            }
            
            var syncItem = {
                id: generateSyncId(),
                type: operation.type,
                collection: operation.collection,
                docId: operation.docId || null,
                data: operation.data || null,
                priority: config.priorityLevels.indexOf(operation.priority) !== -1 
                    ? operation.priority : 'normal',
                retryCount: 0,
                maxRetries: operation.maxRetries || config.maxRetries,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'pending',
                error: null,
            };
            
            state.syncQueue.push(syncItem);
            sortSyncQueue();
            saveSyncQueue();
            
            log('log', 'Added to sync queue: ' + syncItem.id + ' (' + operation.type + ' ' + operation.collection + ')');
            
            // Try to process immediately if online
            if (state.online && state.connectionQuality !== 'slow') {
                processSyncQueue();
            }
            
            // Register background sync if available
            if (state.swRegistration && 'sync' in state.swRegistration) {
                state.swRegistration.sync.register('sync-queue').catch(function() {});
            }
            
            return syncItem.id;
            
        } catch (e) {
            log('error', 'Failed to add to sync queue:', e);
            throw e;
        }
    }
    
    /**
     * Process the sync queue
     * @returns {Promise<Object>} { successCount, failCount }
     */
    async function processSyncQueue() {
        if (state.syncInProgress) {
            log('log', 'Sync already in progress');
            return { successCount: 0, failCount: 0 };
        }
        
        if (!state.online) {
            log('log', 'Cannot sync - offline');
            return { successCount: 0, failCount: 0 };
        }
        
        var pendingItems = state.syncQueue.filter(function(item) {
            return item.status === 'pending' || item.status === 'failed';
        });
        
        if (pendingItems.length === 0) return { successCount: 0, failCount: 0 };
        
        state.syncInProgress = true;
        log('log', 'Processing sync queue: ' + pendingItems.length + ' items');
        emitEvent('offline:syncStarted', { queueSize: pendingItems.length });
        
        var successCount = 0;
        var failCount = 0;
        
        // Process items sequentially to avoid overwhelming Firebase
        for (var i = 0; i < pendingItems.length; i++) {
            var item = pendingItems[i];
            
            try {
                var result = await processSyncItem(item);
                if (result) successCount++;
                else failCount++;
            } catch (e) {
                failCount++;
            }
        }
        
        // Clean completed items
        state.syncQueue = state.syncQueue.filter(function(item) {
            return item.status !== 'completed';
        });
        
        saveSyncQueue();
        
        state.syncInProgress = false;
        state.lastSyncTime = new Date().toISOString();
        
        log('log', 'Sync complete: ' + successCount + ' success, ' + failCount + ' failed');
        emitEvent('offline:syncCompleted', {
            successCount: successCount,
            failCount: failCount,
            remainingQueue: state.syncQueue.length,
        });
        
        return { successCount: successCount, failCount: failCount };
    }
    
    /**
     * Process a single sync item
     * @param {Object} item - Sync item
     * @returns {Promise<boolean>} True if successful
     */
    async function processSyncItem(item) {
        try {
            item.status = 'processing';
            item.updatedAt = Date.now();
            
            var result;
            
            if (window.FirebaseService) {
                switch (item.type) {
                    case 'create':
                        result = await window.FirebaseService.createDocument(
                            item.collection, item.data, item.docId
                        );
                        break;
                    case 'update':
                        result = await window.FirebaseService.updateDocument(
                            item.collection, item.docId, item.data
                        );
                        break;
                    case 'delete':
                        result = await window.FirebaseService.deleteDocument(
                            item.collection, item.docId
                        );
                        break;
                    default:
                        throw new Error('Unknown sync type: ' + item.type);
                }
            } else if (typeof firebase !== 'undefined' && firebase.firestore) {
                var db = firebase.firestore();
                switch (item.type) {
                    case 'create':
                        if (item.docId) {
                            await db.collection(item.collection).doc(item.docId).set(item.data);
                        } else {
                            await db.collection(item.collection).add(item.data);
                        }
                        break;
                    case 'update':
                        await db.collection(item.collection).doc(item.docId).update(item.data);
                        break;
                    case 'delete':
                        await db.collection(item.collection).doc(item.docId).delete();
                        break;
                }
            } else {
                throw new Error('No Firebase service available');
            }
            
            item.status = 'completed';
            item.completedAt = Date.now();
            return true;
            
        } catch (error) {
            item.retryCount++;
            item.error = error.message;
            item.updatedAt = Date.now();
            
            if (item.retryCount >= item.maxRetries) {
                item.status = 'failed';
                log('error', 'Sync item failed permanently: ' + item.id, error);
            } else {
                item.status = 'pending';
                log('warn', 'Sync item will retry: ' + item.id + ' (' + item.retryCount + '/' + item.maxRetries + ')');
            }
            
            return false;
        }
    }
    
    /**
     * Retry all failed sync items
     */
    function retryFailedSync() {
        state.syncQueue.forEach(function(item) {
            if (item.status === 'failed') {
                item.status = 'pending';
                item.retryCount = 0;
                item.error = null;
            }
        });
        saveSyncQueue();
        processSyncQueue();
    }
    
    /**
     * Clear the entire sync queue
     */
    function clearSyncQueue() {
        state.syncQueue = [];
        saveSyncQueue();
        log('log', 'Sync queue cleared');
    }

    // -------------------------------------------------------------------------
    // SECTION 7: PUBLIC API
    // -------------------------------------------------------------------------
    
    /**
     * Check if currently online
     * @returns {boolean}
     */
    function isOnline() {
        return state.online;
    }
    
    /**
     * Check if offline
     * @returns {boolean}
     */
    function isOffline() {
        return !state.online;
    }
    
    /**
     * Get network status
     * @returns {Object}
     */
    function getNetworkStatus() {
        return {
            online: state.online,
            connectionType: state.connectionType,
            connectionQuality: state.connectionQuality,
            lastOnlineTime: state.lastOnlineTime,
        };
    }
    
    /**
     * Get sync queue status
     * @returns {Object}
     */
    function getSyncStatus() {
        var pending = 0, processing = 0, failed = 0, completed = 0;
        
        state.syncQueue.forEach(function(item) {
            switch (item.status) {
                case 'pending': pending++; break;
                case 'processing': processing++; break;
                case 'failed': failed++; break;
                case 'completed': completed++; break;
            }
        });
        
        return {
            total: state.syncQueue.length,
            pending: pending,
            processing: processing,
            failed: failed,
            completed: completed,
            syncInProgress: state.syncInProgress,
            lastSyncTime: state.lastSyncTime,
        };
    }
    
    /**
     * Get complete status
     * @returns {Object}
     */
    function getStatus() {
        return {
            network: getNetworkStatus(),
            sync: getSyncStatus(),
            serviceWorker: {
                registered: state.serviceWorkerRegistered,
                version: state.serviceWorkerVersion,
            },
        };
    }
    
    /**
     * Force immediate sync
     */
    function forceSync() {
        return processSyncQueue();
    }

    // -------------------------------------------------------------------------
    // SECTION 8: INITIALIZATION & DESTROY
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the offline manager
     * @returns {Promise<boolean>}
     */
    async function init() {
        try {
            if (state.isInitialized) return true;
            
            log('log', 'Initializing OfflineManager v3.0.0...');
            
            // Load saved sync queue
            loadSyncQueue();
            
            // Setup network monitoring
            setupNetworkListeners();
            
            // Register service worker
            if (config.serviceWorkerEnabled) {
                await registerServiceWorker();
            }
            
            // Initial state
            state.online = navigator.onLine;
            if (!navigator.onLine) {
                state.connectionQuality = 'offline';
            }
            
            state.isInitialized = true;
            
            log('log', 'OfflineManager initialized. Online: ' + state.online);
            emitEvent('offline:ready', getStatus());
            
            return true;
        } catch (e) {
            log('error', 'OfflineManager init failed:', e);
            state.isInitialized = true; // Mark ready anyway
            return false;
        }
    }
    
    /**
     * Destroy and cleanup
     */
    function destroy() {
        try {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            
            if (navigator.connection) {
                navigator.connection.removeEventListener('change', handleConnectionChange);
            }
            
            if (state.pingTimer) {
                clearInterval(state.pingTimer);
                state.pingTimer = null;
            }
            
            saveSyncQueue();
            state.isInitialized = false;
            
            log('log', 'OfflineManager destroyed');
        } catch (e) { /* Silent */ }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API */
    const publicAPI = Object.freeze({
        // Initialization
        init: init,
        destroy: destroy,
        get isInitialized() { return state.isInitialized; },
        
        // Network
        isOnline: isOnline,
        isOffline: isOffline,
        getNetworkStatus: getNetworkStatus,
        
        // Sync queue
        addToSyncQueue: addToSyncQueue,
        processSyncQueue: processSyncQueue,
        retryFailedSync: retryFailedSync,
        clearSyncQueue: clearSyncQueue,
        getSyncStatus: getSyncStatus,
        forceSync: forceSync,
        
        // Status
        getStatus: getStatus,
        
        // Service worker
        get swRegistration() { return state.swRegistration; },
        get serviceWorkerRegistered() { return state.serviceWorkerRegistered; },
    });
    
    return publicAPI;
    
})(); // End of OfflineManager IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            OfflineManager.init();
        });
    } else {
        OfflineManager.init();
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
    window.offline = OfflineManager;
    window.Global = window.Global || {};
    window.Global.OfflineManager = OfflineManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
}

export {
    OfflineManager as default,
    OfflineManager,
};