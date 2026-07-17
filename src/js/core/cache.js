/**
 * @fileoverview 11 Avatar SMEs CRM - Client-Side Cache Manager
 * @description Lightweight multi-layer caching system (Memory + localStorage)
 *              with TTL expiration, LRU eviction, and tag-based invalidation.
 *              Designed for GitHub Pages static deployment with Firebase backend.
 * @module core/cache
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires AppCore (window.AppCore) - optional, for event system
 *
 * @exports window.CacheManager - Global namespace
 * @exports window.cache - Convenience alias
 */

'use strict';

// =============================================================================
// CACHE MANAGER - Self-executing IIFE
// =============================================================================
const CacheManager = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: CONFIGURATION
    // -------------------------------------------------------------------------
    
    /** @type {Object} Default configuration */
    const config = {
        /** @type {number} Max entries in memory cache */
        maxMemoryEntries: 100,
        
        /** @type {number} Default TTL in ms (5 minutes) */
        defaultTTL: 5 * 60 * 1000,
        
        /** @type {number} Max localStorage entries */
        maxStorageEntries: 200,
        
        /** @type {number} localStorage key prefix */
        storagePrefix: '11avatar_cache_',
        
        /** @type {number} Cleanup interval in ms (10 minutes) */
        cleanupInterval: 10 * 60 * 1000,
        
        /** @type {boolean} Whether to enable localStorage cache */
        storageEnabled: true,
    };

    // -------------------------------------------------------------------------
    // SECTION 2: STATE
    // -------------------------------------------------------------------------
    
    /** @type {Map} Memory cache (L1) - key → { data, metadata } */
    const memoryCache = new Map();
    
    /** @type {Array<string>} Access order for LRU eviction */
    const accessOrder = [];
    
    /** @type {Object} Cache statistics */
    const stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
        expirations: 0,
        lastCleanup: null,
    };
    
    /** @type {number|null} Cleanup timer interval ID */
    let cleanupTimer = null;
    
    /** @type {boolean} Whether manager is initialized */
    let isInitialized = false;

    // -------------------------------------------------------------------------
    // SECTION 3: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Log message with module prefix
     * @param {string} level
     * @param {string} message
     * @param {*} [data]
     */
    function log(level, message, data) {
        try {
            var isDebug = window.Constants && 
                         window.Constants.APP && 
                         window.Constants.APP.DEBUG;
            if (!isDebug && level === 'log') return;
            
            var prefix = '[CacheManager]';
            switch (level) {
                case 'error': console.error(prefix, message, data || ''); break;
                case 'warn': console.warn(prefix, message, data || ''); break;
                default: console.log(prefix, message, data || ''); break;
            }
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Check if cache entry is expired
     * @param {Object} metadata
     * @returns {boolean}
     */
    function isExpired(metadata) {
        if (!metadata || !metadata.expiresAt) return false;
        return Date.now() > metadata.expiresAt;
    }
    
    /**
     * Get storage key with prefix
     * @param {string} key
     * @returns {string}
     */
    function storageKey(key) {
        return config.storagePrefix + key;
    }
    
    /**
     * Update LRU access order
     * @param {string} key
     */
    function updateAccessOrder(key) {
        // Remove if exists
        var index = accessOrder.indexOf(key);
        if (index > -1) {
            accessOrder.splice(index, 1);
        }
        // Add to end (most recently used)
        accessOrder.push(key);
    }
    
    /**
     * Remove key from access order
     * @param {string} key
     */
    function removeFromAccessOrder(key) {
        var index = accessOrder.indexOf(key);
        if (index > -1) {
            accessOrder.splice(index, 1);
        }
    }
    
    /**
     * Evict least recently used entry from memory
     */
    function evictLRU() {
        if (accessOrder.length === 0) return;
        
        var lruKey = accessOrder.shift();
        memoryCache.delete(lruKey);
        stats.evictions++;
        
        log('log', 'LRU evicted: ' + lruKey);
    }

    // -------------------------------------------------------------------------
    // SECTION 4: MEMORY CACHE (L1)
    // -------------------------------------------------------------------------
    
    /**
     * Get from memory cache
     * @param {string} key
     * @returns {*|undefined} Cached data or undefined
     */
    function getFromMemory(key) {
        var entry = memoryCache.get(key);
        if (!entry) {
            stats.misses++;
            return undefined;
        }
        
        // Check expiration
        if (isExpired(entry.metadata)) {
            memoryCache.delete(key);
            removeFromAccessOrder(key);
            stats.expirations++;
            stats.misses++;
            return undefined;
        }
        
        // Update access
        updateAccessOrder(key);
        entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
        entry.metadata.lastAccessed = Date.now();
        
        stats.hits++;
        return entry.data;
    }
    
    /**
     * Set to memory cache
     * @param {string} key
     * @param {*} data
     * @param {Object} metadata
     * @returns {boolean} True if stored
     */
    function setToMemory(key, data, metadata) {
        // Enforce max entries
        while (memoryCache.size >= config.maxMemoryEntries) {
            evictLRU();
        }
        
        memoryCache.set(key, {
            data: data,
            metadata: Object.assign({}, metadata, {
                stored: Date.now(),
                size: estimateSize(data),
            }),
        });
        
        updateAccessOrder(key);
        stats.sets++;
        
        return true;
    }
    
    /**
     * Delete from memory cache
     * @param {string} key
     */
    function deleteFromMemory(key) {
        memoryCache.delete(key);
        removeFromAccessOrder(key);
    }

    // -------------------------------------------------------------------------
    // SECTION 5: LOCALSTORAGE CACHE (L2)
    // -------------------------------------------------------------------------
    
    /**
     * Get from localStorage
     * @param {string} key
     * @returns {*|null} Cached data or null
     */
    function getFromStorage(key) {
        if (!config.storageEnabled) return null;
        
        try {
            var raw = localStorage.getItem(storageKey(key));
            if (!raw) return null;
            
            var entry = JSON.parse(raw);
            
            // Check expiration
            if (isExpired(entry.metadata)) {
                localStorage.removeItem(storageKey(key));
                stats.expirations++;
                return null;
            }
            
            // Update access
            entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
            entry.metadata.lastAccessed = Date.now();
            
            // Write back updated metadata (non-blocking)
            try {
                localStorage.setItem(storageKey(key), JSON.stringify(entry));
            } catch (e) { /* Silent */ }
            
            // Promote to memory
            setToMemory(key, entry.data, entry.metadata);
            
            return entry.data;
        } catch (e) {
            // Corrupt entry - remove it
            try {
                localStorage.removeItem(storageKey(key));
            } catch (e2) { /* Silent */ }
            return null;
        }
    }
    
    /**
     * Set to localStorage
     * @param {string} key
     * @param {*} data
     * @param {Object} metadata
     * @returns {boolean} True if stored
     */
    function setToStorage(key, data, metadata) {
        if (!config.storageEnabled) return false;
        
        try {
            var entry = {
                data: data,
                metadata: metadata,
                timestamp: Date.now(),
            };
            
            var serialized = JSON.stringify(entry);
            
            // Check size (max ~100KB per entry)
            if (serialized.length > 100 * 1024) {
                log('warn', 'Item too large for localStorage: ' + key + ' (' + Math.round(serialized.length / 1024) + 'KB)');
                return false;
            }
            
            // Enforce max entries
            enforceStorageLimit();
            
            localStorage.setItem(storageKey(key), serialized);
            return true;
        } catch (e) {
            // Storage full - try cleanup
            if (e.name === 'QuotaExceededError') {
                cleanupStorage();
                try {
                    localStorage.setItem(storageKey(key), JSON.stringify({ data: data, metadata: metadata, timestamp: Date.now() }));
                    return true;
                } catch (e2) {
                    log('error', 'Storage still full after cleanup');
                }
            }
            return false;
        }
    }
    
    /**
     * Delete from localStorage
     * @param {string} key
     */
    function deleteFromStorage(key) {
        try {
            localStorage.removeItem(storageKey(key));
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Enforce max storage entries
     */
    function enforceStorageLimit() {
        try {
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(config.storagePrefix) === 0) {
                    keys.push(k);
                }
            }
            
            if (keys.length >= config.maxStorageEntries) {
                // Remove oldest entries
                var entries = [];
                keys.forEach(function(k) {
                    try {
                        var entry = JSON.parse(localStorage.getItem(k));
                        entries.push({ key: k, timestamp: entry.timestamp || 0 });
                    } catch (e) {
                        entries.push({ key: k, timestamp: 0 });
                    }
                });
                
                entries.sort(function(a, b) { return a.timestamp - b.timestamp; });
                
                // Remove oldest 25%
                var removeCount = Math.ceil(entries.length * 0.25);
                for (var j = 0; j < removeCount; j++) {
                    localStorage.removeItem(entries[j].key);
                    stats.evictions++;
                }
            }
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Cleanup expired storage entries
     */
    function cleanupStorage() {
        try {
            var now = Date.now();
            var keysToRemove = [];
            
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) {
                    try {
                        var entry = JSON.parse(localStorage.getItem(key));
                        if (entry.metadata && entry.metadata.expiresAt && entry.metadata.expiresAt < now) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key); // Corrupt - remove
                    }
                }
            }
            
            keysToRemove.forEach(function(k) {
                localStorage.removeItem(k);
                stats.expirations++;
            });
            
            if (keysToRemove.length > 0) {
                log('log', 'Storage cleanup: ' + keysToRemove.length + ' entries removed');
            }
        } catch (e) { /* Silent */ }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: CORE CACHE OPERATIONS
    // -------------------------------------------------------------------------
    
    /**
     * Get a value from cache (memory → storage)
     * @param {string} key - Cache key
     * @param {*} [defaultValue=null] - Default if not found
     * @returns {*|null} Cached value or defaultValue
     */
    function get(key, defaultValue) {
        if (!key) return defaultValue !== undefined ? defaultValue : null;
        
        // Try memory first
        var memResult = getFromMemory(key);
        if (memResult !== undefined) {
            return memResult;
        }
        
        // Try storage
        var storageResult = getFromStorage(key);
        if (storageResult !== null) {
            return storageResult;
        }
        
        stats.misses++;
        return defaultValue !== undefined ? defaultValue : null;
    }
    
    /**
     * Set a value in cache (memory + storage)
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {Object} [options={}] - Cache options
     * @param {number} [options.ttl] - Time-to-live in ms
     * @param {string[]} [options.tags] - Tags for group invalidation
     * @param {boolean} [options.persist=true] - Whether to store in localStorage
     * @returns {boolean} True if stored successfully
     */
    function set(key, value, options) {
        if (!key) return false;
        if (value === undefined || value === null) return false;
        
        var opts = options || {};
        var ttl = opts.ttl || config.defaultTTL;
        var metadata = {
            key: key,
            timestamp: Date.now(),
            ttl: ttl,
            expiresAt: Date.now() + ttl,
            tags: opts.tags || [],
            accessCount: 0,
        };
        
        var success = setToMemory(key, value, metadata);
        
        // Persist to storage (unless explicitly disabled)
        if (opts.persist !== false) {
            setToStorage(key, value, metadata);
        }
        
        return success;
    }
    
    /**
     * Delete a value from cache
     * @param {string} key - Cache key
     * @returns {boolean} True if deleted
     */
    function remove(key) {
        if (!key) return false;
        
        var existed = memoryCache.has(key);
        deleteFromMemory(key);
        deleteFromStorage(key);
        
        return existed;
    }
    
    /**
     * Check if key exists and is not expired
     * @param {string} key
     * @returns {boolean}
     */
    function has(key) {
        if (!key) return false;
        return get(key, '__UNDEFINED_SENTINEL__') !== '__UNDEFINED_SENTINEL__';
    }
    
    /**
     * Get or set - fetch if not cached
     * @param {string} key - Cache key
     * @param {Function} fetcher - Function to call if not cached
     * @param {Object} [options] - Cache options (passed to set())
     * @returns {Promise<*>} Data from cache or fetcher
     */
    async function getOrSet(key, fetcher, options) {
        // Try cache first
        var cached = get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        
        // Fetch fresh data
        if (typeof fetcher !== 'function') {
            throw new Error('Cache.getOrSet: fetcher must be a function');
        }
        
        try {
            var freshData = await fetcher();
            
            if (freshData !== null && freshData !== undefined) {
                set(key, freshData, options);
            }
            
            return freshData;
        } catch (error) {
            // Return stale cache if available (even if expired)
            var stale = getFromStorage(key);
            if (stale !== null) {
                log('warn', 'Returning stale cache for: ' + key);
                return stale;
            }
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: BULK OPERATIONS
    // -------------------------------------------------------------------------
    
    /**
     * Get multiple keys at once
     * @param {string[]} keys
     * @returns {Object} { key: value } map
     */
    function getMany(keys) {
        if (!Array.isArray(keys)) return {};
        
        var result = {};
        keys.forEach(function(key) {
            result[key] = get(key);
        });
        return result;
    }
    
    /**
     * Set multiple entries at once
     * @param {Object} entries - { key: value } or { key: { value, options } }
     * @param {Object} [defaultOptions] - Default options for all entries
     */
    function setMany(entries, defaultOptions) {
        if (!entries || typeof entries !== 'object') return;
        
        Object.keys(entries).forEach(function(key) {
            var entry = entries[key];
            if (entry && typeof entry === 'object' && 'value' in entry) {
                set(key, entry.value, entry.options || defaultOptions);
            } else {
                set(key, entry, defaultOptions);
            }
        });
    }
    
    /**
     * Delete multiple keys at once
     * @param {string[]} keys
     */
    function removeMany(keys) {
        if (!Array.isArray(keys)) return;
        keys.forEach(function(key) { remove(key); });
    }

    // -------------------------------------------------------------------------
    // SECTION 8: CACHE INVALIDATION
    // -------------------------------------------------------------------------
    
    /**
     * Clear cache entries matching a pattern
     * @param {string} [pattern] - Key pattern (supports * wildcard). If null, clears all.
     */
    function clear(pattern) {
        // Clear all
        if (!pattern) {
            var memSize = memoryCache.size;
            memoryCache.clear();
            accessOrder.length = 0;
            clearAllStorage();
            log('log', 'All cache cleared (' + memSize + ' memory entries)');
            return;
        }
        
        // Convert pattern to regex
        var regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        
        // Clear from memory
        var memKeys = [];
        memoryCache.forEach(function(entry, key) {
            if (regex.test(key)) memKeys.push(key);
        });
        memKeys.forEach(function(key) {
            memoryCache.delete(key);
            removeFromAccessOrder(key);
        });
        
        // Clear from storage
        clearStorageByPattern(regex);
        
        log('log', 'Cache cleared for pattern: ' + pattern + ' (' + memKeys.length + ' entries)');
    }
    
    /**
     * Clear cache entries by tags
     * @param {string[]} tags
     */
    function clearByTags(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return;
        
        var memKeys = [];
        memoryCache.forEach(function(entry, key) {
            var entryTags = entry.metadata.tags || [];
            if (tags.some(function(tag) { return entryTags.indexOf(tag) !== -1; })) {
                memKeys.push(key);
            }
        });
        memKeys.forEach(function(key) {
            memoryCache.delete(key);
            removeFromAccessOrder(key);
        });
        
        // Clear from storage
        clearStorageByTags(tags);
        
        log('log', 'Cache cleared for tags: ' + tags.join(', ') + ' (' + memKeys.length + ' entries)');
    }
    
    /**
     * Clear all localStorage cache entries
     */
    function clearAllStorage() {
        try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Clear storage entries matching a regex pattern
     * @param {RegExp} regex
     */
    function clearStorageByPattern(regex) {
        try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) {
                    var cacheKey = key.replace(config.storagePrefix, '');
                    if (regex.test(cacheKey)) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Clear storage entries by tags
     * @param {string[]} tags
     */
    function clearStorageByTags(tags) {
        try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) {
                    try {
                        var entry = JSON.parse(localStorage.getItem(key));
                        var entryTags = (entry.metadata && entry.metadata.tags) || [];
                        if (tags.some(function(tag) { return entryTags.indexOf(tag) !== -1; })) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        } catch (e) { /* Silent */ }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: MAINTENANCE
    // -------------------------------------------------------------------------
    
    /**
     * Run periodic cleanup
     */
    function runCleanup() {
        var now = Date.now();
        var memCleaned = 0;
        var storageCleaned = 0;
        
        // Clean expired from memory
        var expiredMemKeys = [];
        memoryCache.forEach(function(entry, key) {
            if (isExpired(entry.metadata)) {
                expiredMemKeys.push(key);
            }
        });
        expiredMemKeys.forEach(function(key) {
            memoryCache.delete(key);
            removeFromAccessOrder(key);
            stats.expirations++;
            memCleaned++;
        });
        
        // Clean expired from storage
        try {
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) {
                    try {
                        var entry = JSON.parse(localStorage.getItem(key));
                        if (entry.metadata && entry.metadata.expiresAt && entry.metadata.expiresAt < now) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(function(k) {
                localStorage.removeItem(k);
                stats.expirations++;
                storageCleaned++;
            });
        } catch (e) { /* Silent */ }
        
        stats.lastCleanup = new Date().toISOString();
        
        if (memCleaned > 0 || storageCleaned > 0) {
            log('log', 'Cleanup: ' + memCleaned + ' memory + ' + storageCleaned + ' storage entries removed');
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 10: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Estimate size of a value in bytes
     * @param {*} value
     * @returns {number}
     */
    function estimateSize(value) {
        try {
            if (typeof value === 'string') return value.length * 2;
            if (value instanceof Blob) return value.size;
            if (value instanceof ArrayBuffer) return value.byteLength;
            var serialized = JSON.stringify(value);
            return serialized ? serialized.length * 2 : 0;
        } catch (e) {
            return 0;
        }
    }
    
    /**
     * Get cache statistics
     * @returns {Object}
     */
    function getStats() {
        var totalRequests = stats.hits + stats.misses;
        return {
            memoryEntries: memoryCache.size,
            memoryMax: config.maxMemoryEntries,
            storageEntries: countStorageEntries(),
            storageMax: config.maxStorageEntries,
            hits: stats.hits,
            misses: stats.misses,
            sets: stats.sets,
            evictions: stats.evictions,
            expirations: stats.expirations,
            hitRate: totalRequests > 0 ? ((stats.hits / totalRequests) * 100).toFixed(1) + '%' : '0%',
            lastCleanup: stats.lastCleanup,
        };
    }
    
    /**
     * Count localStorage cache entries
     * @returns {number}
     */
    function countStorageEntries() {
        try {
            var count = 0;
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(config.storagePrefix) === 0) count++;
            }
            return count;
        } catch (e) {
            return 0;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 11: INITIALIZATION & DESTROY
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the cache manager
     * @returns {boolean}
     */
    function init() {
        try {
            if (isInitialized) return true;
            
            log('log', 'Initializing CacheManager v3.0.0...');
            
            // Load persisted stats
            loadStats();
            
            // Start cleanup timer
            if (cleanupTimer) clearInterval(cleanupTimer);
            cleanupTimer = setInterval(runCleanup, config.cleanupInterval);
            
            // Run initial cleanup
            runCleanup();
            
            isInitialized = true;
            
            log('log', 'CacheManager initialized. Memory: ' + memoryCache.size + ', Storage: ' + countStorageEntries());
            
            return true;
        } catch (e) {
            log('error', 'CacheManager init failed:', e);
            isInitialized = true;
            return false;
        }
    }
    
    /**
     * Destroy and cleanup
     */
    function destroy() {
        try {
            if (cleanupTimer) {
                clearInterval(cleanupTimer);
                cleanupTimer = null;
            }
            
            saveStats();
            
            memoryCache.clear();
            accessOrder.length = 0;
            isInitialized = false;
            
            log('log', 'CacheManager destroyed');
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Save stats to localStorage
     */
    function saveStats() {
        try {
            localStorage.setItem(config.storagePrefix + 'stats', JSON.stringify(stats));
        } catch (e) { /* Silent */ }
    }
    
    /**
     * Load stats from localStorage
     */
    function loadStats() {
        try {
            var saved = localStorage.getItem(config.storagePrefix + 'stats');
            if (saved) {
                var parsed = JSON.parse(saved);
                stats.hits = parsed.hits || 0;
                stats.misses = parsed.misses || 0;
                stats.sets = parsed.sets || 0;
                stats.evictions = parsed.evictions || 0;
                stats.expirations = parsed.expirations || 0;
                stats.lastCleanup = parsed.lastCleanup || null;
            }
        } catch (e) { /* Silent */ }
    }

    // -------------------------------------------------------------------------
    // SECTION 12: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API */
    const publicAPI = Object.freeze({
        // Initialization
        init: init,
        destroy: destroy,
        get isInitialized() { return isInitialized; },
        
        // Core operations
        get: get,
        set: set,
        remove: remove,
        has: has,
        getOrSet: getOrSet,
        
        // Bulk operations
        getMany: getMany,
        setMany: setMany,
        removeMany: removeMany,
        
        // Invalidation
        clear: clear,
        clearByTags: clearByTags,
        
        // Maintenance
        runCleanup: runCleanup,
        
        // Statistics
        getStats: getStats,
        
        // Configuration
        get config() { return Object.assign({}, config); },
        updateConfig: function(newConfig) {
            if (newConfig && typeof newConfig === 'object') {
                Object.assign(config, newConfig);
            }
        },
    });
    
    return publicAPI;
    
})(); // End of CacheManager IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            CacheManager.init();
        });
    } else {
        CacheManager.init();
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
    window.cache = CacheManager; // Convenience alias
    window.Global = window.Global || {};
    window.Global.CacheManager = CacheManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}

export {
    CacheManager as default,
    CacheManager,
};