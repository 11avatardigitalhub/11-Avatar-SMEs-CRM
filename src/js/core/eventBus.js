/* ==========================================
   11 AVATAR DIGITAL HUB
   Event Bus System - Pub/Sub Communication
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Decoupled component communication
   - Custom event system (not DOM events)
   - Namespaced events
   - Event priority & ordering
   - Event logging & debugging
   - Async event support
   - One-time event listeners
   - Event history for replay
   - Event filtering & routing
   - Memory leak prevention
   - Wildcard event matching
   - Event payload validation
   ==========================================
   Usage Examples:
   
   // Subscribe
   eventBus.on('lead:created', (payload) => {
       console.log('New lead:', payload.lead)
   })
   
   // Publish
   eventBus.emit('lead:created', { lead: {...} })
   
   // One-time
   eventBus.once('app:ready', () => {
       console.log('App is ready!')
   })
   
   // Namespaced
   eventBus.on('leads:*', (payload, eventName) => {
       console.log(`Lead event: ${eventName}`)
   })
   ========================================== */

// ==========================================
// EVENT BUS CLASS
// ==========================================
class EventBus {
    
    /**
     * Initialize the Event Bus
     */
    constructor() {
        // Event registry: Map<eventName, Set<Listener>>
        this._listeners = new Map();
        
        // One-time listeners: Map<eventName, Set<Listener>>
        this._onceListeners = new Map();
        
        // Wildcard listeners: Set<Listener>
        this._wildcardListeners = new Set();
        
        // Event history for debugging
        this._history = [];
        this._maxHistory = 100;
        this._recordHistory = false;
        
        // Event counter for statistics
        this._eventCount = 0;
        this._listenerCount = 0;
        
        // Paused state
        this._paused = false;
        this._pendingEvents = [];
        
        // Debug mode
        this._debug = false;
        
        // Priority queues
        this._priorities = new Map();
        
        // Bound methods for proper 'this' context
        this._boundHandleError = this._handleError.bind(this);
        
        console.log('📡 Event Bus initialized');
    }
    
    // ==========================================
    // SUBSCRIPTION METHODS
    // ==========================================
    
    /**
     * Subscribe to an event
     * @param {string} eventName - Event name (supports wildcards with *)
     * @param {Function} callback - Callback function (payload, eventName) => void
     * @param {Object} options - Listener options
     * @param {number} options.priority - Priority (lower = runs first, default: 100)
     * @param {boolean} options.once - One-time listener
     * @param {Object} options.context - 'this' context for callback
     * @returns {Function} Unsubscribe function
     * 
     * @example
     * // Basic subscription
     * const unsubscribe = eventBus.on('lead:created', (lead) => {
     *     console.log('Lead created:', lead)
     * })
     * 
     * // With priority (lower number = runs first)
     * eventBus.on('lead:created', handler1, { priority: 10 })
     * eventBus.on('lead:created', handler2, { priority: 20 }) // Runs after handler1
     * 
     * // Wildcard subscription
     * eventBus.on('lead:*', (payload, eventName) => {
     *     console.log(`Lead event: ${eventName}`, payload)
     * })
     */
    on(eventName, callback, options = {}) {
        const {
            priority = 100,
            once = false,
            context = null
        } = options;
        
        // Validate inputs
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('EventBus.on: eventName must be a non-empty string');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('EventBus.on: callback must be a function');
        }
        
        // Create listener object
        const listener = {
            id: this._generateListenerId(),
            callback: context ? callback.bind(context) : callback,
            originalCallback: callback,
            priority: priority,
            context: context,
            eventName: eventName,
            createdAt: new Date().toISOString(),
            callCount: 0
        };
        
        // Determine target registry
        if (once) {
            this._addToRegistry(this._onceListeners, eventName, listener);
        } else {
            this._addToRegistry(this._listeners, eventName, listener);
        }
        
        // Store priority
        if (!this._priorities.has(eventName)) {
            this._priorities.set(eventName, new Map());
        }
        this._priorities.get(eventName).set(listener.id, priority);
        
        // Increment counter
        this._listenerCount++;
        
        if (this._debug) {
            console.log(`📡 [EventBus] Subscribed: ${eventName}`, {
                listenerId: listener.id,
                priority: priority,
                once: once,
                totalListeners: this._listenerCount
            });
        }
        
        // Return unsubscribe function
        return () => {
            this.off(eventName, listener.id);
        };
    }
    
    /**
     * Subscribe to an event once (auto-unsubscribe after first trigger)
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Listener options
     * @returns {Function} Unsubscribe function
     */
    once(eventName, callback, options = {}) {
        return this.on(eventName, callback, { ...options, once: true });
    }
    
    /**
     * Subscribe to multiple events with the same handler
     * @param {string[]} eventNames - Array of event names
     * @param {Function} callback - Callback function
     * @param {Object} options - Listener options
     * @returns {Function} Unsubscribe function (removes from all)
     */
    onMany(eventNames, callback, options = {}) {
        if (!Array.isArray(eventNames)) {
            throw new Error('EventBus.onMany: eventNames must be an array');
        }
        
        const unsubscribers = eventNames.map(eventName => 
            this.on(eventName, callback, options)
        );
        
        // Return function that unsubscribes from all
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }
    
    /**
     * Subscribe to all events (wildcard)
     * @param {Function} callback - (payload, eventName) => void
     * @param {Object} options - Listener options
     * @returns {Function} Unsubscribe function
     */
    onAny(callback, options = {}) {
        const { context = null } = options;
        
        if (typeof callback !== 'function') {
            throw new Error('EventBus.onAny: callback must be a function');
        }
        
        const listener = {
            id: this._generateListenerId(),
            callback: context ? callback.bind(context) : callback,
            createdAt: new Date().toISOString()
        };
        
        this._wildcardListeners.add(listener);
        this._listenerCount++;
        
        if (this._debug) {
            console.log(`📡 [EventBus] Subscribed to ALL events`, {
                listenerId: listener.id
            });
        }
        
        return () => {
            this._wildcardListeners.delete(listener);
            this._listenerCount--;
        };
    }
    
    /**
     * Add listener to appropriate registry
     * @private
     */
    _addToRegistry(registry, eventName, listener) {
        if (!registry.has(eventName)) {
            registry.set(eventName, new Set());
        }
        registry.get(eventName).add(listener);
    }
    
    // ==========================================
    // UNSUBSCRIPTION METHODS
    // ==========================================
    
    /**
     * Remove a specific listener
     * @param {string} eventName - Event name
     * @param {string} listenerId - Listener ID (returned from on())
     */
    off(eventName, listenerId) {
        let removed = false;
        
        // Remove from regular listeners
        if (this._listeners.has(eventName)) {
            const listeners = this._listeners.get(eventName);
            for (const listener of listeners) {
                if (listener.id === listenerId) {
                    listeners.delete(listener);
                    removed = true;
                    break;
                }
            }
            
            // Clean up empty sets
            if (listeners.size === 0) {
                this._listeners.delete(eventName);
            }
        }
        
        // Remove from once listeners
        if (!removed && this._onceListeners.has(eventName)) {
            const listeners = this._onceListeners.get(eventName);
            for (const listener of listeners) {
                if (listener.id === listenerId) {
                    listeners.delete(listener);
                    removed = true;
                    break;
                }
            }
            
            if (listeners.size === 0) {
                this._onceListeners.delete(eventName);
            }
        }
        
        // Remove from wildcard listeners
        if (!removed) {
            for (const listener of this._wildcardListeners) {
                if (listener.id === listenerId) {
                    this._wildcardListeners.delete(listener);
                    removed = true;
                    break;
                }
            }
        }
        
        if (removed) {
            this._listenerCount--;
            
            if (this._debug) {
                console.log(`📡 [EventBus] Unsubscribed from: ${eventName}`, {
                    listenerId: listenerId,
                    totalListeners: this._listenerCount
                });
            }
        }
    }
    
    /**
     * Remove all listeners for an event
     * @param {string} eventName - Event name (or '*' for all)
     */
    removeAllListeners(eventName = null) {
        if (eventName && eventName !== '*') {
            // Remove specific event
            const regularCount = this._listeners.get(eventName)?.size || 0;
            const onceCount = this._onceListeners.get(eventName)?.size || 0;
            
            this._listeners.delete(eventName);
            this._onceListeners.delete(eventName);
            this._priorities.delete(eventName);
            
            this._listenerCount -= (regularCount + onceCount);
            
            if (this._debug) {
                console.log(`📡 [EventBus] Removed all listeners for: ${eventName}`, {
                    removed: regularCount + onceCount
                });
            }
        } else {
            // Remove all
            const totalCount = this._listenerCount;
            
            this._listeners.clear();
            this._onceListeners.clear();
            this._wildcardListeners.clear();
            this._priorities.clear();
            
            this._listenerCount = 0;
            
            if (this._debug) {
                console.log(`📡 [EventBus] Removed ALL listeners`, {
                    removed: totalCount
                });
            }
        }
    }
    
    // ==========================================
    // EMIT METHODS
    // ==========================================
    
    /**
     * Emit (publish) an event
     * @param {string} eventName - Event name
     * @param {*} payload - Event payload data
     * @param {Object} options - Emit options
     * @returns {boolean} Whether event had listeners
     * 
     * @example
     * eventBus.emit('lead:created', {
     *     lead: { id: 'LD001', name: 'Rakesh' },
     *     source: 'form'
     * })
     */
    emit(eventName, payload = {}, options = {}) {
        const {
            async = false,
            recordHistory = true
        } = options;
        
        // Validate
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('EventBus.emit: eventName must be a non-empty string');
        }
        
        // If paused, queue the event
        if (this._paused) {
            this._pendingEvents.push({ eventName, payload, options, timestamp: Date.now() });
            
            if (this._debug) {
                console.log(`📡 [EventBus] Queued (paused): ${eventName}`);
            }
            
            return false;
        }
        
        // Increment counter
        this._eventCount++;
        
        // Record history
        if (this._recordHistory || recordHistory) {
            this._addToHistory(eventName, payload);
        }
        
        // Collect all matching listeners
        const matchingListeners = this._getMatchingListeners(eventName);
        
        if (matchingListeners.length === 0) {
            if (this._debug) {
                console.log(`📡 [EventBus] No listeners for: ${eventName}`);
            }
            return false;
        }
        
        // Sort by priority
        matchingListeners.sort((a, b) => a.priority - b.priority);
        
        if (this._debug) {
            console.log(`📡 [EventBus] Emitting: ${eventName}`, {
                listeners: matchingListeners.length,
                payload: payload,
                eventNumber: this._eventCount
            });
        }
        
        // Execute listeners
        if (async) {
            // Async execution (non-blocking)
            setTimeout(() => {
                this._executeListeners(matchingListeners, eventName, payload);
            }, 0);
        } else {
            // Synchronous execution
            this._executeListeners(matchingListeners, eventName, payload);
        }
        
        // Remove one-time listeners
        this._cleanupOnceListeners(eventName, matchingListeners);
        
        return true;
    }
    
    /**
     * Emit event asynchronously
     * @param {string} eventName - Event name
     * @param {*} payload - Event payload
     * @returns {Promise<void>}
     */
    async emitAsync(eventName, payload = {}) {
        return new Promise((resolve) => {
            this.emit(eventName, payload, { async: true });
            
            // Resolve after a microtask
            setTimeout(resolve, 0);
        });
    }
    
    /**
     * Emit multiple events at once
     * @param {Object} events - { eventName: payload } map
     */
    emitMany(events) {
        if (typeof events !== 'object') {
            throw new Error('EventBus.emitMany: events must be an object');
        }
        
        for (const [eventName, payload] of Object.entries(events)) {
            this.emit(eventName, payload);
        }
    }
    
    /**
     * Emit event and wait for all listeners to complete (including promises)
     * @param {string} eventName - Event name
     * @param {*} payload - Event payload
     * @returns {Promise<void>}
     */
    async emitAndWait(eventName, payload = {}) {
        const matchingListeners = this._getMatchingListeners(eventName);
        
        const promises = matchingListeners.map(listener => {
            try {
                const result = listener.callback(payload, eventName);
                return result instanceof Promise ? result : Promise.resolve(result);
            } catch (error) {
                this._handleError(eventName, listener, error);
                return Promise.resolve();
            }
        });
        
        await Promise.allSettled(promises);
        
        this._cleanupOnceListeners(eventName, matchingListeners);
    }
    
    // ==========================================
    // EXECUTION HELPERS
    // ==========================================
    
    /**
     * Get all listeners matching an event name
     * @private
     */
    _getMatchingListeners(eventName) {
        const matching = [];
        
        // Exact match
        if (this._listeners.has(eventName)) {
            this._listeners.get(eventName).forEach(listener => {
                matching.push(listener);
            });
        }
        
        // Once listeners
        if (this._onceListeners.has(eventName)) {
            this._onceListeners.get(eventName).forEach(listener => {
                matching.push(listener);
            });
        }
        
        // Wildcard pattern matching
        this._listeners.forEach((listeners, pattern) => {
            if (pattern.includes('*') && this._matchWildcard(pattern, eventName)) {
                listeners.forEach(listener => {
                    matching.push(listener);
                });
            }
        });
        
        this._onceListeners.forEach((listeners, pattern) => {
            if (pattern.includes('*') && this._matchWildcard(pattern, eventName)) {
                listeners.forEach(listener => {
                    matching.push(listener);
                });
            }
        });
        
        // Global wildcard listeners
        this._wildcardListeners.forEach(listener => {
            matching.push(listener);
        });
        
        return matching;
    }
    
    /**
     * Execute a list of listeners
     * @private
     */
    _executeListeners(listeners, eventName, payload) {
        listeners.forEach(listener => {
            try {
                listener.callback(payload, eventName);
                listener.callCount = (listener.callCount || 0) + 1;
            } catch (error) {
                this._handleError(eventName, listener, error);
            }
        });
    }
    
    /**
     * Remove one-time listeners after execution
     * @private
     */
    _cleanupOnceListeners(eventName, listeners) {
        if (this._onceListeners.has(eventName)) {
            const onceSet = this._onceListeners.get(eventName);
            
            listeners.forEach(listener => {
                if (onceSet.has(listener)) {
                    onceSet.delete(listener);
                    this._listenerCount--;
                }
            });
            
            if (onceSet.size === 0) {
                this._onceListeners.delete(eventName);
            }
        }
    }
    
    /**
     * Match event name against wildcard pattern
     * @private
     */
    _matchWildcard(pattern, eventName) {
        // Convert pattern to regex
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\*/g, '.*');                   // * becomes .*
        
        const regex = new RegExp('^' + regexPattern + '$');
        return regex.test(eventName);
    }
    
    /**
     * Handle errors in listener execution
     * @private
     */
    _handleError(eventName, listener, error) {
        console.error(`❌ [EventBus] Error in listener for "${eventName}":`, {
            listenerId: listener.id,
            error: error.message,
            stack: error.stack
        });
        
        // Emit error event (without infinite loop protection)
        if (eventName !== 'eventbus:error') {
            this.emit('eventbus:error', {
                originalEvent: eventName,
                listenerId: listener.id,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // ==========================================
    // CONTROL METHODS
    // ==========================================
    
    /**
     * Pause all event emission
     */
    pause() {
        this._paused = true;
        
        if (this._debug) {
            console.log('📡 [EventBus] Paused');
        }
    }
    
    /**
     * Resume event emission and process pending events
     */
    resume() {
        this._paused = false;
        
        if (this._debug) {
            console.log('📡 [EventBus] Resumed', {
                pendingEvents: this._pendingEvents.length
            });
        }
        
        // Process pending events
        const pending = [...this._pendingEvents];
        this._pendingEvents = [];
        
        pending.forEach(({ eventName, payload, options }) => {
            this.emit(eventName, payload, options);
        });
    }
    
    /**
     * Enable debug logging
     */
    enableDebug() {
        this._debug = true;
        console.log('📡 [EventBus] Debug mode enabled');
    }
    
    /**
     * Disable debug logging
     */
    disableDebug() {
        this._debug = false;
        console.log('📡 [EventBus] Debug mode disabled');
    }
    
    /**
     * Enable event history recording
     */
    enableHistory() {
        this._recordHistory = true;
        console.log('📡 [EventBus] History recording enabled');
    }
    
    /**
     * Disable event history recording
     */
    disableHistory() {
        this._recordHistory = false;
        console.log('📡 [EventBus] History recording disabled');
    }
    
    /**
     * Add event to history
     * @private
     */
    _addToHistory(eventName, payload) {
        this._history.push({
            eventName,
            payload,
            timestamp: Date.now(),
            isoTime: new Date().toISOString()
        });
        
        // Enforce max history
        if (this._history.length > this._maxHistory) {
            this._history = this._history.slice(-this._maxHistory);
        }
    }
    
    // ==========================================
    // QUERY METHODS
    // ==========================================
    
    /**
     * Get event history
     * @param {Object} filters - Optional filters
     * @returns {Array} Event history
     */
    getHistory(filters = {}) {
        let history = [...this._history];
        
        if (filters.eventName) {
            history = history.filter(h => h.eventName === filters.eventName);
        }
        
        if (filters.since) {
            history = history.filter(h => h.timestamp >= filters.since);
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }
        
        return history;
    }
    
    /**
     * Clear event history
     */
    clearHistory() {
        this._history = [];
        
        if (this._debug) {
            console.log('📡 [EventBus] History cleared');
        }
    }
    
    /**
     * Get all registered event names
     * @returns {string[]} Array of event names
     */
    getEventNames() {
        const names = new Set();
        
        this._listeners.forEach((_, key) => names.add(key));
        this._onceListeners.forEach((_, key) => names.add(key));
        
        return Array.from(names).sort();
    }
    
    /**
     * Get listener count for an event
     * @param {string} eventName - Event name
     * @returns {number} Listener count
     */
    getListenerCount(eventName = null) {
        if (eventName) {
            let count = 0;
            
            if (this._listeners.has(eventName)) {
                count += this._listeners.get(eventName).size;
            }
            
            if (this._onceListeners.has(eventName)) {
                count += this._onceListeners.get(eventName).size;
            }
            
            return count;
        }
        
        return this._listenerCount;
    }
    
    /**
     * Check if event has listeners
     * @param {string} eventName - Event name
     * @returns {boolean}
     */
    hasListeners(eventName) {
        return this.getListenerCount(eventName) > 0;
    }
    
    /**
     * Get statistics
     * @returns {Object} Event bus statistics
     */
    getStats() {
        return {
            totalEvents: this._eventCount,
            totalListeners: this._listenerCount,
            registeredEvents: this.getEventNames().length,
            historySize: this._history.length,
            paused: this._paused,
            pendingEvents: this._pendingEvents.length,
            debug: this._debug,
            historyEnabled: this._recordHistory,
            memoryUsage: this._calculateMemoryUsage()
        };
    }
    
    /**
     * Calculate approximate memory usage
     * @private
     */
    _calculateMemoryUsage() {
        let size = 0;
        
        // Estimate size of stored data
        size += this._history.length * 200; // ~200 bytes per history entry
        size += this._listenerCount * 150;  // ~150 bytes per listener
        
        return {
            bytes: size,
            kilobytes: (size / 1024).toFixed(2),
            megabytes: (size / (1024 * 1024)).toFixed(4)
        };
    }
    
    /**
     * Debug: Print event bus state to console
     */
    debug() {
        console.group('📡 Event Bus Debug');
        console.log('Statistics:', this.getStats());
        console.log('Registered Events:', this.getEventNames());
        console.log('Recent History:', this._history.slice(-10));
        console.log('Wildcard Listeners:', this._wildcardListeners.size);
        console.log('Paused:', this._paused);
        console.log('Pending Events:', this._pendingEvents.length);
        console.groupEnd();
    }
    
    /**
     * Generate unique listener ID
     * @private
     */
    _generateListenerId() {
        return 'listener_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    /**
     * Destroy the event bus (cleanup)
     */
    destroy() {
        this.removeAllListeners('*');
        this._history = [];
        this._pendingEvents = [];
        this._eventCount = 0;
        this._listenerCount = 0;
        
        console.log('📡 Event Bus destroyed');
    }
}

// ==========================================
// PREDEFINED APPLICATION EVENTS
// ==========================================

/**
 * Standard event names used across the application
 * Using constants prevents typos and enables IDE autocomplete
 */
const EVENTS = {
    // App Lifecycle
    APP_READY: 'app:ready',
    APP_INIT: 'app:init',
    APP_PAUSE: 'app:pause',
    APP_RESUME: 'app:resume',
    APP_CLOSING: 'app:closing',
    APP_ERROR: 'app:error',
    
    // Authentication
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_REGISTER: 'auth:register',
    AUTH_SESSION_EXPIRED: 'auth:sessionExpired',
    AUTH_PERMISSION_DENIED: 'auth:permissionDenied',
    
    // Navigation
    NAVIGATION_CHANGE: 'navigation:change',
    NAVIGATION_COMPLETE: 'navigation:complete',
    NAVIGATION_ERROR: 'navigation:error',
    
    // Leads
    LEAD_CREATED: 'lead:created',
    LEAD_UPDATED: 'lead:updated',
    LEAD_DELETED: 'lead:deleted',
    LEAD_STATUS_CHANGED: 'lead:statusChanged',
    LEAD_IMPORTED: 'lead:imported',
    LEAD_EXPORTED: 'lead:exported',
    
    // Clients
    CLIENT_CREATED: 'client:created',
    CLIENT_UPDATED: 'client:updated',
    CLIENT_DELETED: 'client:deleted',
    CLIENT_STATUS_CHANGED: 'client:statusChanged',
    
    // Revenue
    REVENUE_ADDED: 'revenue:added',
    REVENUE_UPDATED: 'revenue:updated',
    REVENUE_DELETED: 'revenue:deleted',
    
    // Pipeline
    PIPELINE_STAGE_CHANGED: 'pipeline:stageChanged',
    PIPELINE_DEAL_WON: 'pipeline:dealWon',
    PIPELINE_DEAL_LOST: 'pipeline:dealLost',
    
    // Projects
    PROJECT_CREATED: 'project:created',
    PROJECT_UPDATED: 'project:updated',
    PROJECT_COMPLETED: 'project:completed',
    
    // UI
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    TOAST_SHOW: 'toast:show',
    LOADER_SHOW: 'loader:show',
    LOADER_HIDE: 'loader:hide',
    SIDEBAR_TOGGLE: 'sidebar:toggle',
    SIDEBAR_OPEN: 'sidebar:open',
    SIDEBAR_CLOSE: 'sidebar:close',
    THEME_CHANGED: 'theme:changed',
    
    // Data
    DATA_SAVED: 'data:saved',
    DATA_LOADED: 'data:loaded',
    DATA_SYNCED: 'data:synced',
    DATA_IMPORT: 'data:import',
    DATA_EXPORT: 'data:export',
    
    // Network
    NETWORK_ONLINE: 'network:online',
    NETWORK_OFFLINE: 'network:offline',
    NETWORK_SLOW: 'network:slow',
    
    // Backup
    BACKUP_STARTED: 'backup:started',
    BACKUP_COMPLETED: 'backup:completed',
    BACKUP_FAILED: 'backup:failed',
    BACKUP_RESTORED: 'backup:restored',
    
    // Notifications
    NOTIFICATION_RECEIVED: 'notification:received',
    NOTIFICATION_READ: 'notification:read',
    NOTIFICATION_CLEARED: 'notification:cleared',
    
    // Search
    SEARCH_START: 'search:start',
    SEARCH_COMPLETE: 'search:complete',
    SEARCH_CLEARED: 'search:cleared',
    
    // Keyboard
    KEYBOARD_SHORTCUT: 'keyboard:shortcut',
    
    // System
    SYSTEM_ERROR: 'system:error',
    SYSTEM_WARNING: 'system:warning',
    SYSTEM_INFO: 'system:info'
};

// ==========================================
// CREATE & EXPORT EVENT BUS INSTANCE
// ==========================================
const eventBus = new EventBus();

// Enable debug in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // eventBus.enableDebug(); // Uncomment for debugging
}

// Make available globally
window.EventBus = eventBus;
window.EVENTS = EVENTS;

// Export for module usage
export default eventBus;
export { EVENTS };

console.log('📡 Event Bus ready');
console.log('📡 Predefined events:', Object.keys(EVENTS).length);

// ==========================================
// END OF EVENT BUS
// ==========================================

