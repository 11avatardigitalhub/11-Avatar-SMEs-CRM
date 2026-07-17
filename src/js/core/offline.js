/* ==========================================
   11 AVATAR DIGITAL HUB
   Offline Support Manager
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Complete offline-first architecture
   - Service Worker registration & management
   - Offline data synchronization
   - Background sync
   - Periodic sync
   - Offline queue management
   - Network status detection
   - Connection quality monitoring
   - Offline UI indicators
   - Data conflict resolution
   - Storage estimation
   - Offline analytics
   ==========================================
   Architecture:
   
   OfflineManager
   ├── Service Worker Manager
   ├── Network Monitor
   ├── Sync Queue Manager
   ├── Conflict Resolver
   └── Storage Manager
   
   Features:
   - Works offline with full functionality
   - Auto-syncs when back online
   - Background sync for pending operations
   - Smart conflict resolution
   - Offline indicators in UI
   ========================================== */

// ==========================================
// OFFLINE MANAGER CLASS
// ==========================================
class OfflineManager {
    
    /**
     * Initialize the Offline Manager
     */
    constructor() {
        // Configuration
        this.config = {
            // Service Worker
            serviceWorker: {
                enabled: true,
                path: '/sw.js',
                scope: '/',
                updateInterval: 60 * 60 * 1000 // 1 hour
            },
            
            // Sync
            sync: {
                enabled: true,
                maxRetries: 5,
                retryDelay: 30000, // 30 seconds
                maxQueueSize: 500,
                batchSize: 10,
                priorityLevels: ['critical', 'high', 'normal', 'low']
            },
            
            // Network
            network: {
                pingURL: '/api/health',
                pingInterval: 30000, // 30 seconds
                slowThreshold: 2000, // 2 seconds response = slow
                offlineThreshold: 5000 // 5 seconds = offline
            },
            
            // Storage
            storage: {
                warningThreshold: 0.8, // 80% full = warning
                criticalThreshold: 0.95, // 95% full = critical
                cleanupThreshold: 0.9
            },
            
            // UI
            ui: {
                showIndicator: true,
                showBanner: true,
                bannerDuration: 5000
            }
        };
        
        // State
        this.state = {
            online: navigator.onLine,
            connectionType: null,
            connectionQuality: 'unknown', // 'excellent' | 'good' | 'slow' | 'offline'
            serviceWorkerRegistered: false,
            serviceWorkerVersion: null,
            syncInProgress: false,
            lastSyncTime: null,
            lastOnlineTime: null,
            lastOfflineTime: null,
            storageUsage: 0,
            storageQuota: 0,
            storageWarning: false,
            storageCritical: false
        };
        
        // Sync queue
        this._syncQueue = [];
        
        // Listeners
        this._networkListeners = [];
        this._storageListeners = [];
        
        // Timers
        this._pingTimer = null;
        this._swUpdateTimer = null;
        
        // Service Worker registration
        this._swRegistration = null;
        
        // Bind methods
        this._handleOnline = this._handleOnline.bind(this);
        this._handleOffline = this._handleOffline.bind(this);
        this._handleConnectionChange = this._handleConnectionChange.bind(this);
        this._ping = this._ping.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the offline manager
     * @private
     */
    async _init() {
        console.log('📡 Initializing Offline Manager...');
        
        // Setup network monitoring
        this._setupNetworkMonitoring();
        
        // Register Service Worker
        if (this.config.serviceWorker.enabled) {
            await this._registerServiceWorker();
        }
        
        // Setup background sync
        if (this.config.sync.enabled) {
            this._setupBackgroundSync();
        }
        
        // Load sync queue from storage
        await this._loadSyncQueue();
        
        // Check storage
        await this._checkStorage();
        
        // Start periodic checks
        this._startPeriodicChecks();
        
        // Restore state
        this._restoreState();
        
        console.log('✅ Offline Manager initialized');
        console.log('📡 Status:', this.getStatus());
    }
    
    // ==========================================
    // SERVICE WORKER MANAGEMENT
    // ==========================================
    
    /**
     * Register the Service Worker
     * @private
     */
    async _registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Worker not supported in this browser');
            this.config.serviceWorker.enabled = false;
            return;
        }
        
        try {
            const registration = await navigator.serviceWorker.register(
                this.config.serviceWorker.path,
                { scope: this.config.serviceWorker.scope }
            );
            
            this._swRegistration = registration;
            this.state.serviceWorkerRegistered = true;
            
            console.log('👷 Service Worker registered:', registration.scope);
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 New Service Worker available');
                            this._notifyUpdateAvailable();
                        }
                    });
                }
            });
            
            // Check for updates periodically
            this._swUpdateTimer = setInterval(() => {
                registration.update().catch(() => {});
            }, this.config.serviceWorker.updateInterval);
            
            // Listen for messages from Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this._handleSWMessage(event.data);
            });
            
            // Get version
            if (registration.active) {
                this.state.serviceWorkerVersion = await this._getSWVersion(registration.active);
            }
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            this.config.serviceWorker.enabled = false;
        }
    }
    
    /**
     * Get Service Worker version
     * @private
     */
    async _getSWVersion(worker) {
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                resolve(event.data.version || 'unknown');
            };
            
            worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
            
            // Timeout
            setTimeout(() => resolve('unknown'), 1000);
        });
    }
    
    /**
     * Handle messages from Service Worker
     * @private
     */
    _handleSWMessage(data) {
        if (!data) return;
        
        switch (data.type) {
            case 'SYNC_COMPLETE':
                console.log('🔄 Background sync completed');
                this.state.syncInProgress = false;
                this.state.lastSyncTime = new Date().toISOString();
                window.EventBus?.emit('offline:syncComplete', data);
                break;
                
            case 'SYNC_FAILED':
                console.warn('⚠️ Background sync failed:', data.error);
                this.state.syncInProgress = false;
                window.EventBus?.emit('offline:syncFailed', data);
                break;
                
            case 'CACHE_UPDATED':
                console.log('💾 Cache updated by Service Worker');
                window.EventBus?.emit('offline:cacheUpdated', data);
                break;
                
            case 'OFFLINE_READY':
                console.log('📡 App is ready for offline use');
                window.EventBus?.emit('offline:ready', data);
                break;
                
            default:
                if (this.config.debug) {
                    console.log('📡 SW Message:', data);
                }
        }
    }
    
    /**
     * Notify user about available update
     * @private
     */
    _notifyUpdateAvailable() {
        window.EventBus?.emit('offline:updateAvailable', {
            message: 'A new version is available. Refresh to update.'
        });
        
        if (window.App?.toast) {
            window.App.toast('🔄 New version available! Refresh to update.', 'info', 10000);
        }
    }
    
    /**
     * Skip waiting and activate new Service Worker
     */
    async updateSW() {
        if (!this._swRegistration || !this._swRegistration.waiting) {
            return false;
        }
        
        try {
            this._swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Reload page to activate new SW
            window.location.reload();
            return true;
        } catch (error) {
            console.error('❌ Failed to update Service Worker:', error);
            return false;
        }
    }
    
    /**
     * Unregister Service Worker
     */
    async unregisterSW() {
        if (!this._swRegistration) return false;
        
        try {
            const success = await this._swRegistration.unregister();
            
            if (success) {
                console.log('👷 Service Worker unregistered');
                this._swRegistration = null;
                this.state.serviceWorkerRegistered = false;
            }
            
            return success;
        } catch (error) {
            console.error('❌ Failed to unregister Service Worker:', error);
            return false;
        }
    }
    
    // ==========================================
    // NETWORK MONITORING
    // ==========================================
    
    /**
     * Setup network monitoring
     * @private
     */
    _setupNetworkMonitoring() {
        // Online/Offline events
        window.addEventListener('online', this._handleOnline);
        window.addEventListener('offline', this._handleOffline);
        
        // Connection API
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (connection) {
                connection.addEventListener('change', this._handleConnectionChange);
                
                // Initial connection type
                this.state.connectionType = connection.effectiveType || 'unknown';
                this._assessConnectionQuality(connection);
            }
        }
        
        // Initial state
        this.state.online = navigator.onLine;
        if (!navigator.onLine) {
            this.state.connectionQuality = 'offline';
        }
        
        console.log('📶 Network monitoring setup complete');
    }
    
    /**
     * Handle coming online
     * @private
     */
    async _handleOnline() {
        console.log('📶 Online');
        
        this.state.online = true;
        this.state.lastOnlineTime = new Date().toISOString();
        this.state.connectionQuality = 'good';
        
        // Process sync queue
        await this.processSyncQueue();
        
        // Notify app
        window.EventBus?.emit('network:online');
        
        if (window.App?.toast) {
            window.App.toast('📶 Back online! Syncing data...', 'success');
        }
    }
    
    /**
     * Handle going offline
     * @private
     */
    _handleOffline() {
        console.log('📶 Offline');
        
        this.state.online = false;
        this.state.lastOfflineTime = new Date().toISOString();
        this.state.connectionQuality = 'offline';
        
        // Notify app
        window.EventBus?.emit('network:offline');
        
        if (window.App?.toast) {
            window.App.toast('📶 You are offline. Changes will be saved locally.', 'warning');
        }
    }
    
    /**
     * Handle connection type change
     * @private
     */
    _handleConnectionChange(event) {
        const connection = event.target;
        
        this.state.connectionType = connection.effectiveType || 'unknown';
        this._assessConnectionQuality(connection);
        
        window.EventBus?.emit('network:connectionChange', {
            type: this.state.connectionType,
            quality: this.state.connectionQuality,
            downlink: connection.downlink,
            rtt: connection.rtt
        });
        
        console.log('📶 Connection changed:', this.state.connectionType, this.state.connectionQuality);
    }
    
    /**
     * Assess connection quality
     * @private
     */
    _assessConnectionQuality(connection) {
        if (!connection || !navigator.onLine) {
            this.state.connectionQuality = 'offline';
            return;
        }
        
        const rtt = connection.rtt || 0;
        const downlink = connection.downlink || 0;
        
        if (rtt < 100 && downlink > 5) {
            this.state.connectionQuality = 'excellent';
        } else if (rtt < 300 && downlink > 2) {
            this.state.connectionQuality = 'good';
        } else {
            this.state.connectionQuality = 'slow';
        }
    }
    
    /**
     * Ping server to check real connectivity
     * @private
     */
    async _ping() {
        if (!navigator.onLine) {
            this.state.connectionQuality = 'offline';
            return;
        }
        
        const startTime = performance.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.network.offlineThreshold);
            
            const response = await fetch(this.config.network.pingURL, {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const latency = performance.now() - startTime;
            
            if (latency > this.config.network.slowThreshold) {
                this.state.connectionQuality = 'slow';
            } else {
                this.state.connectionQuality = 'good';
            }
            
            return {
                online: true,
                latency: Math.round(latency),
                quality: this.state.connectionQuality
            };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.state.connectionQuality = 'offline';
                this._handleOffline();
            }
            
            return {
                online: false,
                latency: null,
                quality: 'offline'
            };
        }
    }
    
    /**
     * Start periodic checks
     * @private
     */
    _startPeriodicChecks() {
        // Ping every 30 seconds
        this._pingTimer = setInterval(this._ping, this.config.network.pingInterval);
        
        // Check storage every 5 minutes
        setInterval(() => this._checkStorage(), 5 * 60 * 1000);
    }
    
    // ==========================================
    // SYNC QUEUE MANAGEMENT
    // ==========================================
    
    /**
     * Setup background sync
     * @private
     */
    _setupBackgroundSync() {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
            console.warn('⚠️ Background Sync not supported');
            this.config.sync.enabled = false;
            return;
        }
        
        // Register for periodic sync if available
        if ('periodicSync' in ServiceWorkerRegistration.prototype) {
            this._registerPeriodicSync();
        }
        
        console.log('🔄 Background sync setup complete');
    }
    
    /**
     * Register for periodic background sync
     * @private
     */
    async _registerPeriodicSync() {
        try {
            const status = await navigator.permissions.query({
                name: 'periodic-background-sync'
            });
            
            if (status.state === 'granted' && this._swRegistration) {
                await this._swRegistration.periodicSync.register('data-sync', {
                    minInterval: 60 * 60 * 1000 // 1 hour
                });
                console.log('🔄 Periodic sync registered');
            }
        } catch (error) {
            console.warn('⚠️ Periodic sync not available:', error.message);
        }
    }
    
    /**
     * Add an operation to the sync queue
     * @param {Object} operation - Operation to sync
     * @returns {Promise<string>} Operation ID
     */
    async addToSyncQueue(operation) {
        const {
            type,          // 'create' | 'update' | 'delete'
            collection,    // Firestore collection name
            docId = null,  // Document ID (for update/delete)
            data = null,   // Document data (for create/update)
            priority = 'normal', // 'critical' | 'high' | 'normal' | 'low'
            metadata = {}
        } = operation;
        
        // Validate
        if (!type || !collection) {
            throw new Error('Sync operation requires type and collection');
        }
        
        // Check queue size
        if (this._syncQueue.length >= this.config.sync.maxQueueSize) {
            throw new Error('Sync queue is full');
        }
        
        // Create sync item
        const syncItem = {
            id: this._generateSyncId(),
            type,
            collection,
            docId,
            data,
            priority: this.config.sync.priorityLevels.includes(priority) ? priority : 'normal',
            retryCount: 0,
            maxRetries: this.config.sync.maxRetries,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'pending', // 'pending' | 'processing' | 'completed' | 'failed'
            error: null,
            metadata
        };
        
        // Add to queue
        this._syncQueue.push(syncItem);
        
        // Sort by priority
        this._sortSyncQueue();
        
        // Save queue
        await this._saveSyncQueue();
        
        // Try to process immediately if online
        if (this.state.online && this.state.connectionQuality !== 'slow') {
            this.processSyncQueue();
        }
        
        // Register background sync
        if (this._swRegistration && 'sync' in this._swRegistration) {
            try {
                await this._swRegistration.sync.register('sync-queue');
            } catch {}
        }
        
        console.log('🔄 Added to sync queue:', syncItem.id, type, collection);
        
        return syncItem.id;
    }
    
    /**
     * Process the sync queue
     */
    async processSyncQueue() {
        if (this.state.syncInProgress) {
            console.log('🔄 Sync already in progress');
            return;
        }
        
        if (!this.state.online) {
            console.log('🔄 Cannot sync - offline');
            return;
        }
        
        if (this._syncQueue.length === 0) {
            return;
        }
        
        this.state.syncInProgress = true;
        
        console.log(`🔄 Processing sync queue: ${this._syncQueue.length} items`);
        
        window.EventBus?.emit('offline:syncStarted', {
            queueSize: this._syncQueue.length
        });
        
        let successCount = 0;
        let failCount = 0;
        
        // Process in batches
        const pendingItems = this._syncQueue.filter(item => 
            item.status === 'pending' || item.status === 'failed'
        );
        
        for (let i = 0; i < pendingItems.length; i += this.config.sync.batchSize) {
            const batch = pendingItems.slice(i, i + this.config.sync.batchSize);
            
            const results = await Promise.allSettled(
                batch.map(item => this._processSyncItem(item))
            );
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                } else {
                    failCount++;
                }
            });
        }
        
        // Clean up completed items
        this._syncQueue = this._syncQueue.filter(item => 
            item.status !== 'completed'
        );
        
        // Save updated queue
        await this._saveSyncQueue();
        
        this.state.syncInProgress = false;
        this.state.lastSyncTime = new Date().toISOString();
        
        console.log(`🔄 Sync complete: ${successCount} success, ${failCount} failed`);
        
        window.EventBus?.emit('offline:syncCompleted', {
            successCount,
            failCount,
            remainingQueue: this._syncQueue.length
        });
        
        if (successCount > 0 && window.App?.toast) {
            window.App.toast(`🔄 Synced ${successCount} items successfully!`, 'success');
        }
    }
    
    /**
     * Process a single sync item
     * @private
     */
    async _processSyncItem(item) {
        try {
            item.status = 'processing';
            item.updatedAt = Date.now();
            
            let result;
            
            switch (item.type) {
                case 'create':
                    result = await window.API.createDocument(item.collection, item.data);
                    break;
                    
                case 'update':
                    result = await window.API.updateDocument(item.collection, item.docId, item.data);
                    break;
                    
                case 'delete':
                    result = await window.API.deleteDocument(item.collection, item.docId);
                    break;
                    
                default:
                    throw new Error(`Unknown sync type: ${item.type}`);
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
                console.error('❌ Sync item failed permanently:', item.id, error.message);
            } else {
                item.status = 'pending';
                console.warn('⚠️ Sync item failed, will retry:', item.id, `(${item.retryCount}/${item.maxRetries})`);
            }
            
            return false;
        }
    }
    
    /**
     * Retry all failed sync items
     */
    async retryFailedSync() {
        const failedItems = this._syncQueue.filter(item => item.status === 'failed');
        
        failedItems.forEach(item => {
            item.status = 'pending';
            item.retryCount = 0;
            item.error = null;
        });
        
        await this._saveSyncQueue();
        await this.processSyncQueue();
    }
    
    /**
     * Clear the sync queue
     */
    async clearSyncQueue() {
        this._syncQueue = [];
        await this._saveSyncQueue();
        console.log('🔄 Sync queue cleared');
    }
    
    /**
     * Sort sync queue by priority
     * @private
     */
    _sortSyncQueue() {
        const priorityOrder = {
            critical: 0,
            high: 1,
            normal: 2,
            low: 3
        };
        
        this._syncQueue.sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt - b.createdAt; // Older first
        });
    }
    
    /**
     * Save sync queue to storage
     * @private
     */
    async _saveSyncQueue() {
        try {
            const serializable = this._syncQueue.map(item => ({
                ...item,
                // Remove functions if any
                resolve: undefined,
                reject: undefined
            }));
            
            localStorage.setItem('11avatar_sync_queue', JSON.stringify(serializable));
        } catch (error) {
            console.warn('⚠️ Failed to save sync queue:', error.message);
        }
    }
    
    /**
     * Load sync queue from storage
     * @private
     */
    async _loadSyncQueue() {
        try {
            const saved = localStorage.getItem('11avatar_sync_queue');
            
            if (saved) {
                this._syncQueue = JSON.parse(saved);
                console.log(`🔄 Loaded ${this._syncQueue.length} sync items from storage`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load sync queue:', error.message);
            this._syncQueue = [];
        }
    }
    
    /**
     * Generate unique sync ID
     * @private
     */
    _generateSyncId() {
        return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    // ==========================================
    // CONFLICT RESOLUTION
    // ==========================================
    
    /**
     * Resolve conflict between local and server data
     * @param {Object} localData - Local version of the data
     * @param {Object} serverData - Server version of the data
     * @param {string} strategy - Resolution strategy
     * @returns {Object} Resolved data
     */
    resolveConflict(localData, serverData, strategy = 'last-write-wins') {
        switch (strategy) {
            case 'last-write-wins':
                return this._resolveLastWriteWins(localData, serverData);
                
            case 'server-wins':
                return serverData;
                
            case 'client-wins':
                return localData;
                
            case 'merge':
                return this._resolveMerge(localData, serverData);
                
            case 'manual':
                // Emit event for manual resolution
                window.EventBus?.emit('offline:conflictDetected', {
                    localData,
                    serverData
                });
                return null; // Caller must handle
                
            default:
                return this._resolveLastWriteWins(localData, serverData);
        }
    }
    
    /**
     * Last-write-wins strategy
     * @private
     */
    _resolveLastWriteWins(localData, serverData) {
        const localTime = localData.updatedAt || localData.createdAt || 0;
        const serverTime = serverData.updatedAt || serverData.createdAt || 0;
        
        return localTime > serverTime ? localData : serverData;
    }
    
    /**
     * Merge strategy (shallow merge)
     * @private
     */
    _resolveMerge(localData, serverData) {
        return {
            ...serverData,
            ...localData,
            // Preserve server critical fields
            id: serverData.id,
            createdAt: serverData.createdAt,
            createdBy: serverData.createdBy,
            updatedAt: new Date().toISOString(),
            _merged: true,
            _mergeTime: new Date().toISOString()
        };
    }
    
    // ==========================================
    // STORAGE MANAGEMENT
    // ==========================================
    
    /**
     * Check storage usage
     * @private
     */
    async _checkStorage() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                
                this.state.storageUsage = estimate.usage || 0;
                this.state.storageQuota = estimate.quota || 0;
                
                const usageRatio = this.state.storageQuota > 0 
                    ? this.state.storageUsage / this.state.storageQuota 
                    : 0;
                
                // Check thresholds
                if (usageRatio >= this.config.storage.criticalThreshold) {
                    this.state.storageCritical = true;
                    this.state.storageWarning = true;
                    this._handleStorageCritical();
                } else if (usageRatio >= this.config.storage.warningThreshold) {
                    this.state.storageWarning = true;
                    this.state.storageCritical = false;
                    this._handleStorageWarning();
                } else {
                    this.state.storageWarning = false;
                    this.state.storageCritical = false;
                }
                
                // Cleanup if needed
                if (usageRatio >= this.config.storage.cleanupThreshold) {
                    await this._cleanupStorage();
                }
            }
        } catch (error) {
            console.warn('⚠️ Storage check failed:', error.message);
        }
    }
    
    /**
     * Handle storage warning
     * @private
     */
    _handleStorageWarning() {
        window.EventBus?.emit('offline:storageWarning', {
            usage: this._formatBytes(this.state.storageUsage),
            quota: this._formatBytes(this.state.storageQuota),
            percentage: this._getStoragePercentage()
        });
        
        console.warn('⚠️ Storage warning:', this._getStoragePercentage());
    }
    
    /**
     * Handle storage critical
     * @private
     */
    _handleStorageCritical() {
        window.EventBus?.emit('offline:storageCritical', {
            usage: this._formatBytes(this.state.storageUsage),
            quota: this._formatBytes(this.state.storageQuota),
            percentage: this._getStoragePercentage()
        });
        
        if (window.App?.toast) {
            window.App.toast('⚠️ Storage is almost full! Please clear some data.', 'warning', 10000);
        }
        
        console.error('⚠️ Storage critical:', this._getStoragePercentage());
    }
    
    /**
     * Cleanup storage
     * @private
     */
    async _cleanupStorage() {
        console.log('🧹 Cleaning up storage...');
        
        // Clear old cache entries
        if (window.cache) {
            await window.cache.clear();
        }
        
        // Clear old sync queue items (completed ones)
        this._syncQueue = this._syncQueue.filter(item => item.status !== 'completed');
        await this._saveSyncQueue();
        
        // Clear old history
        if (window.StateManager) {
            const history = window.StateManager.get('data.history') || [];
            if (history.length > 100) {
                window.StateManager.set('data.history', history.slice(-50));
            }
        }
        
        console.log('🧹 Storage cleanup complete');
    }
    
    /**
     * Get storage usage percentage
     * @private
     */
    _getStoragePercentage() {
        if (this.state.storageQuota === 0) return '0%';
        return ((this.state.storageUsage / this.state.storageQuota) * 100).toFixed(1) + '%';
    }
    
    /**
     * Format bytes to human readable
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    
    // ==========================================
    // STATE MANAGEMENT
    // ==========================================
    
    /**
     * Save offline manager state
     * @private
     */
    _saveState() {
        try {
            const state = {
                lastSyncTime: this.state.lastSyncTime,
                lastOnlineTime: this.state.lastOnlineTime,
                lastOfflineTime: this.state.lastOfflineTime
            };
            
            localStorage.setItem('11avatar_offline_state', JSON.stringify(state));
        } catch {}
    }
    
    /**
     * Restore offline manager state
     * @private
     */
    _restoreState() {
        try {
            const saved = localStorage.getItem('11avatar_offline_state');
            
            if (saved) {
                const state = JSON.parse(saved);
                Object.assign(this.state, state);
            }
        } catch {}
    }
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /**
     * Check if currently online
     * @returns {boolean}
     */
    isOnline() {
        return this.state.online;
    }
    
    /**
     * Check if offline
     * @returns {boolean}
     */
    isOffline() {
        return !this.state.online;
    }
    
    /**
     * Get current network status
     * @returns {Object}
     */
    getNetworkStatus() {
        return {
            online: this.state.online,
            connectionType: this.state.connectionType,
            connectionQuality: this.state.connectionQuality,
            lastOnlineTime: this.state.lastOnlineTime,
            lastOfflineTime: this.state.lastOfflineTime
        };
    }
    
    /**
     * Get sync queue status
     * @returns {Object}
     */
    getSyncStatus() {
        const pending = this._syncQueue.filter(i => i.status === 'pending').length;
        const processing = this._syncQueue.filter(i => i.status === 'processing').length;
        const failed = this._syncQueue.filter(i => i.status === 'failed').length;
        const completed = this._syncQueue.filter(i => i.status === 'completed').length;
        
        return {
            total: this._syncQueue.length,
            pending,
            processing,
            failed,
            completed,
            syncInProgress: this.state.syncInProgress,
            lastSyncTime: this.state.lastSyncTime
        };
    }
    
    /**
     * Get storage status
     * @returns {Object}
     */
    getStorageStatus() {
        return {
            usage: this._formatBytes(this.state.storageUsage),
            quota: this._formatBytes(this.state.storageQuota),
            percentage: this._getStoragePercentage(),
            warning: this.state.storageWarning,
            critical: this.state.storageCritical
        };
    }
    
    /**
     * Get complete status
     * @returns {Object}
     */
    getStatus() {
        return {
            network: this.getNetworkStatus(),
            sync: this.getSyncStatus(),
            storage: this.getStorageStatus(),
            serviceWorker: {
                registered: this.state.serviceWorkerRegistered,
                version: this.state.serviceWorkerVersion
            }
        };
    }
    
    /**
     * Force sync now
     */
    async forceSync() {
        console.log('🔄 Force sync requested');
        await this.processSyncQueue();
    }
    
    /**
     * Debug: Print offline manager state
     */
    debug() {
        console.group('📡 Offline Manager Debug');
        console.log('Status:', this.getStatus());
        console.log('Sync Queue:', this._syncQueue);
        console.log('Config:', this.config);
        console.groupEnd();
    }
    
    /**
     * Destroy the offline manager
     */
    destroy() {
        window.removeEventListener('online', this._handleOnline);
        window.removeEventListener('offline', this._handleOffline);
        
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                connection.removeEventListener('change', this._handleConnectionChange);
            }
        }
        
        if (this._pingTimer) clearInterval(this._pingTimer);
        if (this._swUpdateTimer) clearInterval(this._swUpdateTimer);
        
        this._saveState();
        this._saveSyncQueue();
        
        console.log('📡 Offline Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT OFFLINE MANAGER INSTANCE
// ==========================================
const offlineManager = new OfflineManager();

// Make available globally
window.OfflineManager = offlineManager;
window.offline = offlineManager; // Convenience alias

// Export for module usage
export default offlineManager;

console.log('📡 Offline Manager ready');
console.log('📡 Status:', offlineManager.getNetworkStatus());

// ==========================================
// END OF OFFLINE MANAGER
// ==========================================

