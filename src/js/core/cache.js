/* ==========================================
   11 AVATAR DIGITAL HUB
   Cache Manager - Multi-Layer Caching System
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Multi-layer caching (Memory, IndexedDB, localStorage)
   - Intelligent cache invalidation
   - Time-To-Live (TTL) management
   - Least Recently Used (LRU) eviction
   - Cache warming & preloading
   - Cache statistics & monitoring
   - Offline data availability
   - Automatic cache cleanup
   - Quota management
   - Compression for large objects
   ==========================================
   Architecture:
   
   CacheManager
   ├── L1: Memory Cache (Fastest, Limited Size)
   ├── L2: IndexedDB Cache (Large, Persistent)
   └── L3: localStorage Cache (Small, Simple)
   
   Cache Strategy:
   - Write-through: Write to all layers
   - Read-through: Check L1 → L2 → L3 → Fetch
   - LRU Eviction: Remove least recently used
   - TTL: Auto-expire after configured time
   ========================================== */

// ==========================================
// CACHE MANAGER CLASS
// ==========================================
class CacheManager {
    
    /**
     * Initialize the Cache Manager
     */
    constructor() {
        // Configuration
        this.config = {
            // Memory Cache (L1)
            memory: {
                enabled: true,
                maxSize: 100,           // Maximum entries
                maxItemSize: 500 * 1024, // 500KB per item max
                defaultTTL: 5 * 60 * 1000 // 5 minutes
            },
            
            // IndexedDB Cache (L2)
            indexedDB: {
                enabled: true,
                dbName: '11AvatarCache',
                dbVersion: 1,
                storeName: 'cacheStore',
                maxSize: 50 * 1024 * 1024, // 50MB
                defaultTTL: 30 * 60 * 1000  // 30 minutes
            },
            
            // localStorage Cache (L3)
            localStorage: {
                enabled: true,
                maxSize: 5 * 1024 * 1024,  // 5MB
                defaultTTL: 60 * 60 * 1000  // 1 hour
            },
            
            // Global settings
            compression: true,
            compressionThreshold: 10 * 1024, // 10KB
            cleanupInterval: 5 * 60 * 1000,  // 5 minutes
            statsEnabled: true
        };
        
        // Memory cache storage
        this._memoryCache = new Map();
        this._memoryAccessOrder = [];
        
        // IndexedDB reference
        this._db = null;
        this._dbReady = false;
        this._dbPromise = null;
        
        // Statistics
        this._stats = {
            hits: { memory: 0, indexedDB: 0, localStorage: 0 },
            misses: { memory: 0, indexedDB: 0, localStorage: 0 },
            sets: { memory: 0, indexedDB: 0, localStorage: 0 },
            evictions: 0,
            expirations: 0,
            totalSize: 0,
            lastCleanup: null
        };
        
        // Cleanup timer
        this._cleanupTimer = null;
        
        // Bind methods
        this._cleanup = this._cleanup.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the cache manager
     * @private
     */
    async _init() {
        console.log('💾 Initializing Cache Manager...');
        
        // Initialize IndexedDB
        if (this.config.indexedDB.enabled) {
            try {
                await this._initIndexedDB();
                console.log('💾 IndexedDB cache initialized');
            } catch (error) {
                console.warn('⚠️ IndexedDB cache unavailable:', error.message);
                this.config.indexedDB.enabled = false;
            }
        }
        
        // Start cleanup timer
        this._cleanupTimer = setInterval(this._cleanup, this.config.cleanupInterval);
        
        // Load persisted stats
        this._loadStats();
        
        console.log('✅ Cache Manager initialized');
        console.log('💾 Cache layers:', this._getActiveLayers().join(', '));
    }
    
    /**
     * Initialize IndexedDB database
     * @private
     */
    async _initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                this.config.indexedDB.dbName,
                this.config.indexedDB.dbVersion
            );
            
            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                this._db = event.target.result;
                this._dbReady = true;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create cache store if not exists
                if (!db.objectStoreNames.contains(this.config.indexedDB.storeName)) {
                    const store = db.createObjectStore(
                        this.config.indexedDB.storeName,
                        { keyPath: 'key' }
                    );
                    
                    // Create indexes
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('ttl', 'ttl', { unique: false });
                    store.createIndex('size', 'size', { unique: false });
                    store.createIndex('accessCount', 'accessCount', { unique: false });
                    
                    console.log('💾 IndexedDB store created');
                }
            };
        });
    }
    
    /**
     * Get list of active cache layers
     * @private
     */
    _getActiveLayers() {
        const layers = [];
        
        if (this.config.memory.enabled) layers.push('L1:Memory');
        if (this.config.indexedDB.enabled && this._dbReady) layers.push('L2:IndexedDB');
        if (this.config.localStorage.enabled) layers.push('L3:localStorage');
        
        return layers;
    }
    
    // ==========================================
    // CORE CACHE OPERATIONS
    // ==========================================
    
    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @param {Object} options - Get options
     * @returns {Promise<*>} Cached value or null
     * 
     * @example
     * const data = await cache.get('leads:list', { ttl: 60000 })
     * if (data) {
     *     // Use cached data
     * } else {
     *     // Fetch from API
     *     const freshData = await api.getDocuments('leads')
     *     await cache.set('leads:list', freshData, { ttl: 60000 })
     * }
     */
    async get(key, options = {}) {
        const {
            layer = null,      // Force specific layer: 'memory' | 'indexedDB' | 'localStorage'
            defaultValue = null,
            updateAccessTime = true
        } = options;
        
        if (!key) {
            console.warn('⚠️ Cache.get: key is required');
            return defaultValue;
        }
        
        // Try memory cache first
        if (!layer || layer === 'memory') {
            const result = this._getFromMemory(key, updateAccessTime);
            if (result !== undefined) {
                this._stats.hits.memory++;
                return result;
            }
            this._stats.misses.memory++;
        }
        
        // Try IndexedDB
        if ((!layer || layer === 'indexedDB') && this.config.indexedDB.enabled && this._dbReady) {
            try {
                const result = await this._getFromIndexedDB(key);
                if (result !== null) {
                    this._stats.hits.indexedDB++;
                    
                    // Promote to memory cache
                    if (this.config.memory.enabled && (!layer || layer !== 'indexedDB')) {
                        this._setToMemory(key, result.data, result.metadata);
                    }
                    
                    return result.data;
                }
                this._stats.misses.indexedDB++;
            } catch (error) {
                console.warn('⚠️ IndexedDB get failed:', error.message);
                this._stats.misses.indexedDB++;
            }
        }
        
        // Try localStorage
        if ((!layer || layer === 'localStorage') && this.config.localStorage.enabled) {
            const result = this._getFromLocalStorage(key);
            if (result !== null) {
                this._stats.hits.localStorage++;
                return result;
            }
            this._stats.misses.localStorage++;
        }
        
        return defaultValue;
    }
    
    /**
     * Set a value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {Object} options - Set options
     * @returns {Promise<boolean>} Success
     * 
     * @example
     * await cache.set('leads:list', leads, { ttl: 5 * 60 * 1000 })
     * await cache.set('user:profile', profile, { layers: ['memory', 'indexedDB'] })
     */
    async set(key, value, options = {}) {
        const {
            ttl = null,
            layers = null,           // Specific layers: ['memory', 'indexedDB', 'localStorage']
            tags = [],               // Tags for group invalidation
            compress = this.config.compression,
            metadata = {}
        } = options;
        
        if (!key) {
            console.warn('⚠️ Cache.set: key is required');
            return false;
        }
        
        if (value === undefined || value === null) {
            console.warn('⚠️ Cache.set: value cannot be undefined or null');
            return false;
        }
        
        // Determine TTL
        const effectiveTTL = ttl || this.config.memory.defaultTTL;
        const expiresAt = Date.now() + effectiveTTL;
        
        // Build cache entry
        const entry = {
            data: value,
            metadata: {
                key,
                timestamp: Date.now(),
                ttl: effectiveTTL,
                expiresAt,
                tags,
                size: this._calculateSize(value),
                accessCount: 0,
                ...metadata
            }
        };
        
        let success = false;
        
        // Set in memory cache
        if ((!layers || layers.includes('memory')) && this.config.memory.enabled) {
            const memorySuccess = this._setToMemory(key, value, entry.metadata);
            if (memorySuccess) success = true;
            this._stats.sets.memory++;
        }
        
        // Set in IndexedDB
        if ((!layers || layers.includes('indexedDB')) && this.config.indexedDB.enabled && this._dbReady) {
            try {
                await this._setToIndexedDB(key, entry);
                success = true;
                this._stats.sets.indexedDB++;
            } catch (error) {
                console.warn('⚠️ IndexedDB set failed:', error.message);
            }
        }
        
        // Set in localStorage
        if ((!layers || layers.includes('localStorage')) && this.config.localStorage.enabled) {
            const localStorageSuccess = this._setToLocalStorage(key, value, entry.metadata);
            if (localStorageSuccess) success = true;
            this._stats.sets.localStorage++;
        }
        
        return success;
    }
    
    /**
     * Delete a value from cache
     * @param {string} key - Cache key
     * @param {Object} options - Delete options
     * @returns {Promise<boolean>} Success
     */
    async delete(key, options = {}) {
        const { layers = null } = options;
        
        let deleted = false;
        
        // Delete from memory
        if ((!layers || layers.includes('memory')) && this._memoryCache.has(key)) {
            this._memoryCache.delete(key);
            this._removeFromAccessOrder(key);
            deleted = true;
        }
        
        // Delete from IndexedDB
        if ((!layers || layers.includes('indexedDB')) && this.config.indexedDB.enabled && this._dbReady) {
            try {
                await this._deleteFromIndexedDB(key);
                deleted = true;
            } catch (error) {
                console.warn('⚠️ IndexedDB delete failed:', error.message);
            }
        }
        
        // Delete from localStorage
        if ((!layers || layers.includes('localStorage')) && this.config.localStorage.enabled) {
            this._deleteFromLocalStorage(key);
            deleted = true;
        }
        
        return deleted;
    }
    
    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>}
     */
    async has(key) {
        // Check memory
        if (this._memoryCache.has(key)) {
            const entry = this._memoryCache.get(key);
            if (!this._isExpired(entry.metadata)) {
                return true;
            }
        }
        
        // Check IndexedDB
        if (this.config.indexedDB.enabled && this._dbReady) {
            try {
                const result = await this._getFromIndexedDB(key);
                if (result !== null) return true;
            } catch {}
        }
        
        // Check localStorage
        if (this.config.localStorage.enabled) {
            const result = this._getFromLocalStorage(key);
            if (result !== null) return true;
        }
        
        return false;
    }
    
    /**
     * Get or set (fetch if not cached)
     * @param {string} key - Cache key
     * @param {Function} fetcher - Function to fetch data if not cached
     * @param {Object} options - Cache options
     * @returns {Promise<*>} Data from cache or fetcher
     * 
     * @example
     * const leads = await cache.getOrSet('leads:list',
     *     () => api.getDocuments('leads'),
     *     { ttl: 5 * 60 * 1000 }
     * )
     */
    async getOrSet(key, fetcher, options = {}) {
        // Try to get from cache first
        const cached = await this.get(key, options);
        
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        
        // Fetch fresh data
        if (typeof fetcher !== 'function') {
            throw new Error('Cache.getOrSet: fetcher must be a function');
        }
        
        const freshData = await fetcher();
        
        // Cache the fresh data
        if (freshData !== null && freshData !== undefined) {
            await this.set(key, freshData, options);
        }
        
        return freshData;
    }
    
    // ==========================================
    // MEMORY CACHE (L1)
    // ==========================================
    
    /**
     * Get from memory cache
     * @private
     */
    _getFromMemory(key, updateAccessTime = true) {
        const entry = this._memoryCache.get(key);
        
        if (!entry) return undefined;
        
        // Check expiration
        if (this._isExpired(entry.metadata)) {
            this._memoryCache.delete(key);
            this._removeFromAccessOrder(key);
            this._stats.expirations++;
            return undefined;
        }
        
        // Update access order for LRU
        if (updateAccessTime) {
            this._updateAccessOrder(key);
        }
        
        // Update access count
        entry.metadata.accessCount++;
        entry.metadata.lastAccessed = Date.now();
        
        return entry.data;
    }
    
    /**
     * Set to memory cache
     * @private
     */
    _setToMemory(key, data, metadata) {
        // Check size limit
        const size = metadata.size || this._calculateSize(data);
        
        if (size > this.config.memory.maxItemSize) {
            console.warn(`⚠️ Item too large for memory cache: ${key} (${this._formatSize(size)})`);
            return false;
        }
        
        // Enforce max entries (LRU eviction)
        while (this._memoryCache.size >= this.config.memory.maxSize) {
            const lruKey = this._memoryAccessOrder[0];
            if (lruKey) {
                this._memoryCache.delete(lruKey);
                this._removeFromAccessOrder(lruKey);
                this._stats.evictions++;
            } else {
                break;
            }
        }
        
        // Store in memory
        this._memoryCache.set(key, {
            data,
            metadata: {
                ...metadata,
                size,
                stored: Date.now()
            }
        });
        
        // Update access order
        this._updateAccessOrder(key);
        
        return true;
    }
    
    /**
     * Update access order for LRU tracking
     * @private
     */
    _updateAccessOrder(key) {
        this._removeFromAccessOrder(key);
        this._memoryAccessOrder.push(key);
    }
    
    /**
     * Remove key from access order
     * @private
     */
    _removeFromAccessOrder(key) {
        const index = this._memoryAccessOrder.indexOf(key);
        if (index > -1) {
            this._memoryAccessOrder.splice(index, 1);
        }
    }
    
    // ==========================================
    // INDEXEDDB CACHE (L2)
    // ==========================================
    
    /**
     * Get from IndexedDB
     * @private
     */
    async _getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve(null);
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readonly'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                
                if (!result) {
                    resolve(null);
                    return;
                }
                
                // Check expiration
                if (result.metadata && result.metadata.expiresAt < Date.now()) {
                    this._deleteFromIndexedDB(key);
                    this._stats.expirations++;
                    resolve(null);
                    return;
                }
                
                // Update access count
                result.metadata.accessCount = (result.metadata.accessCount || 0) + 1;
                result.metadata.lastAccessed = Date.now();
                
                // Update in background
                this._setToIndexedDB(key, result).catch(() => {});
                
                resolve(result);
            };
            
            request.onerror = () => {
                reject(new Error('IndexedDB get failed'));
            };
        });
    }
    
    /**
     * Set to IndexedDB
     * @private
     */
    async _setToIndexedDB(key, entry) {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve(false);
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readwrite'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            
            // Compress large entries
            if (this.config.compression && entry.metadata.size > this.config.compressionThreshold) {
                try {
                    entry.data = this._compress(entry.data);
                    entry.metadata.compressed = true;
                } catch {}
            }
            
            const request = store.put({
                key,
                data: entry.data,
                metadata: entry.metadata,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(new Error('IndexedDB set failed'));
        });
    }
    
    /**
     * Delete from IndexedDB
     * @private
     */
    async _deleteFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve(false);
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readwrite'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(new Error('IndexedDB delete failed'));
        });
    }
    
    // ==========================================
    // LOCALSTORAGE CACHE (L3)
    // ==========================================
    
    /**
     * Get from localStorage
     * @private
     */
    _getFromLocalStorage(key) {
        try {
            const raw = localStorage.getItem(this._localStorageKey(key));
            
            if (!raw) return null;
            
            const entry = JSON.parse(raw);
            
            // Check expiration
            if (entry.metadata && entry.metadata.expiresAt < Date.now()) {
                this._deleteFromLocalStorage(key);
                this._stats.expirations++;
                return null;
            }
            
            return entry.data;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Set to localStorage
     * @private
     */
    _setToLocalStorage(key, data, metadata) {
        try {
            const entry = {
                data,
                metadata,
                timestamp: Date.now()
            };
            
            const serialized = JSON.stringify(entry);
            
            // Check size limit
            if (serialized.length > this.config.localStorage.maxSize) {
                console.warn(`⚠️ Item too large for localStorage: ${key}`);
                return false;
            }
            
            // Check total localStorage usage
            if (!this._hasLocalStorageSpace(serialized.length)) {
                this._cleanLocalStorage();
            }
            
            localStorage.setItem(this._localStorageKey(key), serialized);
            return true;
        } catch (error) {
            console.warn('⚠️ localStorage set failed:', error.message);
            return false;
        }
    }
    
    /**
     * Delete from localStorage
     * @private
     */
    _deleteFromLocalStorage(key) {
        try {
            localStorage.removeItem(this._localStorageKey(key));
        } catch {}
    }
    
    /**
     * Generate localStorage key with prefix
     * @private
     */
    _localStorageKey(key) {
        return `11avatar_cache_${key}`;
    }
    
    /**
     * Check if localStorage has space
     * @private
     */
    _hasLocalStorageSpace(neededBytes) {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            
            // Estimate available space
            const used = JSON.stringify(localStorage).length;
            const maxSize = 5 * 1024 * 1024; // 5MB typical limit
            
            return (used + neededBytes) < maxSize;
        } catch {
            return false;
        }
    }
    
    /**
     * Clean localStorage cache entries
     * @private
     */
    _cleanLocalStorage() {
        try {
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('11avatar_cache_')) {
                    keysToRemove.push(key);
                }
            }
            
            // Sort by access time (if available) and remove oldest
            keysToRemove.sort((a, b) => {
                try {
                    const entryA = JSON.parse(localStorage.getItem(a));
                    const entryB = JSON.parse(localStorage.getItem(b));
                    return (entryA.timestamp || 0) - (entryB.timestamp || 0);
                } catch {
                    return 0;
                }
            });
            
            // Remove oldest 50%
            const removeCount = Math.ceil(keysToRemove.length / 2);
            keysToRemove.slice(0, removeCount).forEach(key => {
                localStorage.removeItem(key);
                this._stats.evictions++;
            });
        } catch {}
    }
    
    // ==========================================
    // BULK OPERATIONS
    // ==========================================
    
    /**
     * Set multiple cache entries at once
     * @param {Object} entries - { key: { value, options } } map
     */
    async setMany(entries) {
        const promises = Object.entries(entries).map(([key, config]) => {
            const value = config.value !== undefined ? config.value : config;
            const options = config.options || {};
            return this.set(key, value, options);
        });
        
        return Promise.all(promises);
    }
    
    /**
     * Get multiple cache entries at once
     * @param {string[]} keys - Array of cache keys
     */
    async getMany(keys) {
        const promises = keys.map(key => this.get(key));
        const results = await Promise.all(promises);
        
        return keys.reduce((map, key, index) => {
            map[key] = results[index];
            return map;
        }, {});
    }
    
    /**
     * Delete multiple cache entries at once
     * @param {string[]} keys - Array of cache keys
     */
    async deleteMany(keys) {
        const promises = keys.map(key => this.delete(key));
        return Promise.all(promises);
    }
    
    /**
     * Clear all cache entries matching a pattern
     * @param {string} pattern - Key pattern (supports * wildcard)
     * 
     * @example
     * await cache.clear('leads:*')    // Clear all lead caches
     * await cache.clear('user:*')     // Clear all user caches
     */
    async clear(pattern = null) {
        if (!pattern) {
            // Clear all
            this._memoryCache.clear();
            this._memoryAccessOrder = [];
            
            if (this.config.indexedDB.enabled && this._dbReady) {
                await this._clearIndexedDB();
            }
            
            this._clearLocalStorage();
            
            console.log('🗑️ All cache cleared');
            return;
        }
        
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        
        // Clear memory
        for (const key of this._memoryCache.keys()) {
            if (regex.test(key)) {
                this._memoryCache.delete(key);
                this._removeFromAccessOrder(key);
            }
        }
        
        // Clear IndexedDB
        if (this.config.indexedDB.enabled && this._dbReady) {
            const allKeys = await this._getAllIndexedDBKeys();
            for (const key of allKeys) {
                if (regex.test(key)) {
                    await this._deleteFromIndexedDB(key);
                }
            }
        }
        
        // Clear localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('11avatar_cache_')) {
                const cacheKey = key.replace('11avatar_cache_', '');
                if (regex.test(cacheKey)) {
                    localStorage.removeItem(key);
                }
            }
        }
        
        console.log(`🗑️ Cache cleared for pattern: ${pattern}`);
    }
    
    /**
     * Clear by tags
     * @param {string[]} tags - Tags to clear
     */
    async clearByTags(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return;
        
        // Clear from memory
        for (const [key, entry] of this._memoryCache.entries()) {
            if (entry.metadata.tags && entry.metadata.tags.some(tag => tags.includes(tag))) {
                this._memoryCache.delete(key);
                this._removeFromAccessOrder(key);
            }
        }
        
        // Clear from IndexedDB
        if (this.config.indexedDB.enabled && this._dbReady) {
            const allEntries = await this._getAllIndexedDBEntries();
            for (const entry of allEntries) {
                if (entry.metadata.tags && entry.metadata.tags.some(tag => tags.includes(tag))) {
                    await this._deleteFromIndexedDB(entry.key);
                }
            }
        }
        
        console.log(`🗑️ Cache cleared for tags: ${tags.join(', ')}`);
    }
    
    /**
     * Clear entire IndexedDB store
     * @private
     */
    async _clearIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve();
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readwrite'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('IndexedDB clear failed'));
        });
    }
    
    /**
     * Clear all localStorage cache entries
     * @private
     */
    _clearLocalStorage() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('11avatar_cache_')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    /**
     * Get all IndexedDB keys
     * @private
     */
    async _getAllIndexedDBKeys() {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve([]);
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readonly'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            const request = store.getAllKeys();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error('IndexedDB getAllKeys failed'));
        });
    }
    
    /**
     * Get all IndexedDB entries
     * @private
     */
    async _getAllIndexedDBEntries() {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._dbReady) {
                resolve([]);
                return;
            }
            
            const transaction = this._db.transaction(
                [this.config.indexedDB.storeName],
                'readonly'
            );
            
            const store = transaction.objectStore(this.config.indexedDB.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error('IndexedDB getAll failed'));
        });
    }
    
    // ==========================================
    // WARMING & PRELOADING
    // ==========================================
    
    /**
     * Warm the cache with frequently used data
     * @param {Array} items - [{ key, fetcher, options }]
     */
    async warmUp(items) {
        console.log(`🔥 Warming cache with ${items.length} items...`);
        
        const promises = items.map(async (item) => {
            try {
                const data = await item.fetcher();
                await this.set(item.key, data, item.options || {});
                console.log(`  ✅ ${item.key}`);
            } catch (error) {
                console.warn(`  ⚠️ Failed to warm ${item.key}:`, error.message);
            }
        });
        
        await Promise.allSettled(promises);
        console.log('🔥 Cache warming complete');
    }
    
    /**
     * Preload cache entries that will be needed soon
     * @param {string[]} keys - Keys to preload
     */
    async preload(keys) {
        const promises = keys.map(key => this.get(key, { updateAccessTime: true }));
        await Promise.allSettled(promises);
    }
    
    // ==========================================
    // MAINTENANCE
    // ==========================================
    
    /**
     * Run cache cleanup (remove expired entries)
     * @private
     */
    async _cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        // Clean memory cache
        for (const [key, entry] of this._memoryCache.entries()) {
            if (this._isExpired(entry.metadata)) {
                this._memoryCache.delete(key);
                this._removeFromAccessOrder(key);
                cleaned++;
                this._stats.expirations++;
            }
        }
        
        // Clean IndexedDB
        if (this.config.indexedDB.enabled && this._dbReady) {
            try {
                const entries = await this._getAllIndexedDBEntries();
                for (const entry of entries) {
                    if (entry.metadata && entry.metadata.expiresAt < now) {
                        await this._deleteFromIndexedDB(entry.key);
                        cleaned++;
                        this._stats.expirations++;
                    }
                }
            } catch {}
        }
        
        // Clean localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('11avatar_cache_')) {
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    if (entry.metadata && entry.metadata.expiresAt < now) {
                        localStorage.removeItem(key);
                        cleaned++;
                        this._stats.expirations++;
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            }
        }
        
        this._stats.lastCleanup = new Date().toISOString();
        
        if (cleaned > 0) {
            console.log(`🧹 Cache cleanup: ${cleaned} entries removed`);
        }
        
        // Save stats
        this._saveStats();
    }
    
    /**
     * Check if cache entry is expired
     * @private
     */
    _isExpired(metadata) {
        if (!metadata || !metadata.expiresAt) return false;
        return metadata.expiresAt < Date.now();
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Calculate approximate size of a value in bytes
     * @private
     */
    _calculateSize(value) {
        try {
            if (typeof value === 'string') {
                return value.length * 2; // UTF-16
            }
            
            if (value instanceof Blob) {
                return value.size;
            }
            
            if (value instanceof ArrayBuffer) {
                return value.byteLength;
            }
            
            // Estimate for objects
            const serialized = JSON.stringify(value);
            return serialized ? serialized.length * 2 : 0;
        } catch {
            return 0;
        }
    }
    
    /**
     * Compress data (simple string compression)
     * @private
     */
    _compress(data) {
        try {
            const serialized = JSON.stringify(data);
            // In production, use CompressionStream API or a library like lz-string
            return serialized;
        } catch {
            return data;
        }
    }
    
    /**
     * Format bytes to human readable string
     * @private
     */
    _formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    /**
     * Save statistics to localStorage
     * @private
     */
    _saveStats() {
        try {
            localStorage.setItem('11avatar_cache_stats', JSON.stringify(this._stats));
        } catch {}
    }
    
    /**
     * Load statistics from localStorage
     * @private
     */
    _loadStats() {
        try {
            const saved = localStorage.getItem('11avatar_cache_stats');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(this._stats, parsed);
            }
        } catch {}
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const totalHits = this._stats.hits.memory + this._stats.hits.indexedDB + this._stats.hits.localStorage;
        const totalMisses = this._stats.misses.memory + this._stats.misses.indexedDB + this._stats.misses.localStorage;
        const totalRequests = totalHits + totalMisses;
        
        return {
            layers: {
                memory: {
                    enabled: this.config.memory.enabled,
                    entries: this._memoryCache.size,
                    maxEntries: this.config.memory.maxSize
                },
                indexedDB: {
                    enabled: this.config.indexedDB.enabled && this._dbReady
                },
                localStorage: {
                    enabled: this.config.localStorage.enabled
                }
            },
            performance: {
                totalRequests,
                totalHits,
                totalMisses,
                hitRate: totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(1) + '%' : '0%',
                detailedHits: { ...this._stats.hits },
                detailedMisses: { ...this._stats.misses }
            },
            maintenance: {
                evictions: this._stats.evictions,
                expirations: this._stats.expirations,
                lastCleanup: this._stats.lastCleanup
            }
        };
    }
    
    /**
     * Debug: Print cache state to console
     */
    debug() {
        console.group('💾 Cache Manager Debug');
        console.log('Statistics:', this.getStats());
        console.log('Memory Keys:', Array.from(this._memoryCache.keys()));
        console.log('Access Order:', this._memoryAccessOrder.slice(-10));
        console.groupEnd();
    }
    
    /**
     * Destroy the cache manager
     */
    destroy() {
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
        }
        
        this._saveStats();
        this._memoryCache.clear();
        this._memoryAccessOrder = [];
        
        if (this._db) {
            this._db.close();
            this._db = null;
            this._dbReady = false;
        }
        
        console.log('💾 Cache Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT CACHE MANAGER INSTANCE
// ==========================================
const cacheManager = new CacheManager();

// Make available globally
window.CacheManager = cacheManager;
window.cache = cacheManager; // Convenience alias

// Export for module usage
export default cacheManager;

console.log('💾 Cache Manager ready');
console.log('💾 Stats:', cacheManager.getStats().performance);

// ==========================================
// END OF CACHE MANAGER
// ==========================================
