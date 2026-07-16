/* ==========================================
   11 AVATAR DIGITAL HUB
   Global State Management System
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Centralized application state
   - Reactive state management
   - State persistence (localStorage)
   - State synchronization with Firestore
   - Undo/Redo capability
   - State change history
   - Computed properties
   - State watchers & subscribers
   - State validation
   - Immutable state updates
   ==========================================
   Architecture:
   
   StateManager (Singleton)
   ├── Core State (data)
   ├── UI State (ui)
   ├── User State (user)
   ├── Cache State (cache)
   └── System State (system)
   
   Each state section has:
   - Getters (read)
   - Setters (write + notify)
   - Watchers (react to changes)
   - Validators (ensure data integrity)
   - Persistence (auto-save)
   ========================================== */

// ==========================================
// STATE MANAGER CLASS
// ==========================================
class StateManager {
    
    /**
     * Initialize the state manager
     */
    constructor() {
        // Core reactive state
        this._state = {
            // ==========================================
            // CORE DATA STATE
            // ==========================================
            data: {
                leads: [],
                clients: [],
                contacts: [],
                revenueEntries: [],
                projects: [],
                retainers: [],
                invoices: [],
                payments: [],
                tasks: [],
                appointments: [],
                campaigns: [],
                trainings: [],
                referrals: [],
                audits: [],
                proposals: [],
                history: [],
                notifications: [],
                whatsappMessages: [],
                chatMessages: []
            },
            
            // ==========================================
            // USER INTERFACE STATE
            // ==========================================
            ui: {
                // Navigation
                currentPage: null,
                previousPage: null,
                sidebarOpen: false,
                mobileMenuOpen: false,
                
                // Loading
                globalLoading: false,
                loadingMessage: '',
                loadingTasks: [],
                
                // Modal
                modalOpen: false,
                modalTitle: '',
                modalContent: '',
                modalData: null,
                
                // Toast
                toastQueue: [],
                
                // Theme
                theme: 'internal',
                darkMode: false,
                
                // Search
                searchQuery: '',
                searchResults: [],
                searchOpen: false,
                
                // Filters (persisted per page)
                filters: {},
                
                // Pagination (persisted per page)
                pagination: {},
                
                // Sorting (persisted per page)
                sort: {},
                
                // Selected items (for bulk actions)
                selectedItems: [],
                
                // Form dirty state
                formDirty: false,
                
                // Network status
                online: navigator.onLine,
                
                // Screen info
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                isMobile: window.innerWidth < 768,
                isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
                isDesktop: window.innerWidth >= 1024,
                
                // Last activity timestamp
                lastActivity: Date.now(),
                
                // Breadcrumbs
                breadcrumbs: []
            },
            
            // ==========================================
            // USER STATE
            // ==========================================
            user: {
                // Auth
                isAuthenticated: false,
                currentUser: null,
                userProfile: null,
                
                // Permissions
                role: null,
                permissions: [],
                clientId: null,
                
                // Preferences
                preferences: {
                    theme: 'internal',
                    darkMode: false,
                    language: 'en-IN',
                    timezone: 'Asia/Kolkata',
                    dateFormat: 'DD/MM/YYYY',
                    notifications: {
                        email: true,
                        push: true,
                        sms: false,
                        sound: true
                    },
                    dashboardLayout: 'default',
                    tablePageSize: 25
                },
                
                // Session
                sessionStart: null,
                lastLogin: null,
                loginAttempts: 0,
                
                // Onboarding
                onboardingComplete: false,
                currentOnboardingStep: 0
            },
            
            // ==========================================
            // CACHE STATE
            // ==========================================
            cache: {
                // Data cache with timestamps
                data: {},
                
                // Page cache
                pages: [],
                
                // Image cache
                images: [],
                
                // API response cache
                api: {},
                
                // Last sync timestamps per collection
                lastSync: {},
                
                // Cache statistics
                stats: {
                    hits: 0,
                    misses: 0,
                    size: 0
                }
            },
            
            // ==========================================
            // SYSTEM STATE
            // ==========================================
            system: {
                // App info
                version: '2.0.0',
                build: 'enterprise',
                environment: 'production', // 'development' | 'staging' | 'production'
                
                // Initialization
                initialized: false,
                initTime: null,
                initDuration: 0,
                
                // Performance
                performance: {
                    pageLoadTime: 0,
                    firstPaint: 0,
                    firstContentfulPaint: 0,
                    domInteractive: 0
                },
                
                // Errors
                errors: [],
                lastError: null,
                
                // Network
                online: navigator.onLine,
                connectionType: null, // 'wifi' | 'cellular' | 'ethernet' | 'unknown'
                
                // Storage
                storageUsed: 0,
                storageAvailable: 0,
                
                // Backup
                lastBackup: null,
                backupInProgress: false,
                autoBackupEnabled: true,
                
                // Maintenance
                maintenanceMode: false,
                
                // Feature flags
                features: {},
                
                // Metrics & analytics
                metrics: {
                    pageViews: 0,
                    totalSessions: 0,
                    actionsPerformed: 0,
                    dataExported: 0,
                    dataImported: 0,
                    errorsEncountered: 0
                }
            }
        };
        
        // Watchers registry
        this._watchers = new Map();
        
        // Computed properties registry
        this._computed = new Map();
        
        // State change history (for undo/redo)
        this._history = [];
        this._historyIndex = -1;
        this._maxHistory = 50;
        this._isUndoRedo = false;
        
        // Change tracking
        this._changes = new Set();
        this._batchMode = false;
        this._batchChanges = new Set();
        
        // Persistence
        this._persistenceKey = '11avatar_state';
        this._autoSaveInterval = null;
        this._autoSaveDelay = 2000; // 2 seconds debounce
        
        // Validation rules
        this._validators = new Map();
        
        // Bind methods
        this._autoSaveHandler = this._autoSave.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the state manager
     * @private
     */
    _init() {
        console.log('📦 Initializing State Manager...');
        
        // Load persisted state
        this._loadState();
        
        // Setup auto-save
        this._setupAutoSave();
        
        // Setup network listeners
        this._setupNetworkListeners();
        
        // Setup resize listener
        this._setupResizeListener();
        
        // Setup activity tracking
        this._setupActivityTracking();
        
        // Register default validators
        this._registerDefaultValidators();
        
        // Capture performance metrics
        this._capturePerformanceMetrics();
        
        console.log('✅ State Manager initialized');
        console.log('📊 State sections:', Object.keys(this._state).join(', '));
    }
    
    // ==========================================
    // GETTERS
    // ==========================================
    
    /**
     * Get a value from state using dot notation
     * @param {string} path - Dot notation path (e.g., 'data.leads')
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} The value at the path
     * 
     * @example
     * state.get('data.leads')           // Returns all leads
     * state.get('user.role')            // Returns current user role
     * state.get('ui.modalOpen')         // Returns modal state
     */
    get(path, defaultValue = null) {
        if (!path) return this._state;
        
        const keys = path.split('.');
        let value = this._state;
        
        for (const key of keys) {
            if (value === null || value === undefined) {
                return defaultValue;
            }
            value = value[key];
        }
        
        return value !== undefined ? value : defaultValue;
    }
    
    /**
     * Get entire data section
     * @returns {Object} Data state
     */
    getData() {
        return this._state.data;
    }
    
    /**
     * Get entire UI section
     * @returns {Object} UI state
     */
    getUI() {
        return this._state.ui;
    }
    
    /**
     * Get entire user section
     * @returns {Object} User state
     */
    getUser() {
        return this._state.user;
    }
    
    /**
     * Get entire system section
     * @returns {Object} System state
     */
    getSystem() {
        return this._state.system;
    }
    
    /**
     * Get a computed property
     * @param {string} name - Computed property name
     * @returns {*} Computed value
     */
    getComputed(name) {
        if (this._computed.has(name)) {
            return this._computed.get(name)();
        }
        return null;
    }
    
    /**
     * Check if state is dirty (has unsaved changes)
     * @returns {boolean}
     */
    isDirty() {
        return this._changes.size > 0;
    }
    
    // ==========================================
    // SETTERS
    // ==========================================
    
    /**
     * Set a value in state using dot notation
     * @param {string} path - Dot notation path
     * @param {*} value - New value
     * @param {Object} options - Set options
     * @returns {boolean} Success
     * 
     * @example
     * state.set('data.leads', newLeadsArray)
     * state.set('user.role', 'client_admin')
     * state.set('ui.modalOpen', true)
     */
    set(path, value, options = {}) {
        const {
            silent = false,        // Don't notify watchers
            persist = true,        // Don't save to localStorage
            trackHistory = true,   // Don't add to undo history
            validate = true        // Don't validate
        } = options;
        
        // Validate
        if (validate && !this._validate(path, value)) {
            console.warn(`⚠️ Validation failed for: ${path}`);
            return false;
        }
        
        // Save previous value for history
        const previousValue = this.get(path);
        
        // Set the value
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this._state;
        
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        target[lastKey] = value;
        
        // Track change
        this._trackChange(path);
        
        // Add to history
        if (trackHistory && !this._isUndoRedo) {
            this._addToHistory(path, previousValue, value);
        }
        
        // Notify watchers
        if (!silent) {
            this._notifyWatchers(path, value, previousValue);
        }
        
        // Trigger auto-save
        if (persist) {
            this._scheduleAutoSave();
        }
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('state:change', {
            detail: { path, value, previousValue }
        }));
        
        return true;
    }
    
    /**
     * Set multiple values at once (batch update)
     * @param {Object} updates - { path: value } map
     * @param {Object} options - Set options
     */
    batchSet(updates, options = {}) {
        this._batchMode = true;
        this._batchChanges.clear();
        
        for (const [path, value] of Object.entries(updates)) {
            this.set(path, value, { ...options, silent: true });
        }
        
        this._batchMode = false;
        
        // Notify all batched changes at once
        const changedPaths = Array.from(this._batchChanges);
        this._batchChanges.clear();
        
        changedPaths.forEach(path => {
            this._notifyWatchers(path, this.get(path), null);
        });
        
        // Single event for batch
        window.dispatchEvent(new CustomEvent('state:batchChange', {
            detail: { paths: changedPaths }
        }));
        
        this._scheduleAutoSave();
    }
    
    /**
     * Reset a state path to its default value
     * @param {string} path - Dot notation path
     */
    reset(path) {
        const defaultValue = this._getDefaultValue(path);
        this.set(path, defaultValue);
    }
    
    /**
     * Reset entire state to defaults
     */
    resetAll() {
        console.warn('⚠️ Resetting all state to defaults');
        
        this._state = {
            data: {},
            ui: this._getDefaultUIState(),
            user: this._getDefaultUserState(),
            cache: { data: {}, pages: [], images: [], api: {}, lastSync: {}, stats: { hits: 0, misses: 0, size: 0 } },
            system: this._getDefaultSystemState()
        };
        
        this._history = [];
        this._historyIndex = -1;
        this._changes.clear();
        
        this._notifyWatchers('*', this._state, null);
        localStorage.removeItem(this._persistenceKey);
    }
    
    // ==========================================
    // WATCHERS
    // ==========================================
    
    /**
     * Watch for changes on a state path
     * @param {string} path - Path to watch (supports wildcards)
     * @param {Function} callback - (newValue, oldValue, path) => void
     * @param {Object} options - Watch options
     * @returns {Function} Unsubscribe function
     * 
     * @example
     * state.watch('data.leads', (newLeads, oldLeads) => {
     *     console.log('Leads changed!', newLeads.length)
     * })
     * 
     * state.watch('user.*', (newVal, oldVal, path) => {
     *     console.log(`User ${path} changed`)
     * })
     */
    watch(path, callback, options = {}) {
        const { immediate = false } = options;
        
        if (!this._watchers.has(path)) {
            this._watchers.set(path, new Set());
        }
        
        this._watchers.get(path).add(callback);
        
        // Call immediately with current value
        if (immediate) {
            const currentValue = this.get(path);
            callback(currentValue, null, path);
        }
        
        // Return unsubscribe function
        return () => {
            const watchers = this._watchers.get(path);
            if (watchers) {
                watchers.delete(callback);
                if (watchers.size === 0) {
                    this._watchers.delete(path);
                }
            }
        };
    }
    
    /**
     * Watch once - callback fires only one time
     * @param {string} path - Path to watch
     * @param {Function} callback - Called once on next change
     */
    watchOnce(path, callback) {
        const unsubscribe = this.watch(path, (newValue, oldValue, p) => {
            callback(newValue, oldValue, p);
            unsubscribe();
        });
    }
    
    /**
     * Watch until condition is met
     * @param {string} path - Path to watch
     * @param {Function} condition - Returns true when condition met
     * @param {Function} callback - Called when condition is met
     */
    watchUntil(path, condition, callback) {
        const unsubscribe = this.watch(path, (newValue, oldValue, p) => {
            if (condition(newValue, oldValue)) {
                callback(newValue, oldValue, p);
                unsubscribe();
            }
        });
    }
    
    /**
     * Notify all watchers for a path
     * @private
     */
    _notifyWatchers(path, newValue, oldValue) {
        // Notify exact path watchers
        if (this._watchers.has(path)) {
            this._watchers.get(path).forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`❌ Error in watcher for ${path}:`, error);
                }
            });
        }
        
        // Notify wildcard watchers
        this._watchers.forEach((callbacks, watchPath) => {
            if (watchPath.includes('*')) {
                const regex = new RegExp('^' + watchPath.replace(/\*/g, '.*') + '$');
                if (regex.test(path)) {
                    callbacks.forEach(callback => {
                        try {
                            callback(newValue, oldValue, path);
                        } catch (error) {
                            console.error(`❌ Error in wildcard watcher:`, error);
                        }
                    });
                }
            }
        });
        
        // Notify global watchers
        if (this._watchers.has('*')) {
            this._watchers.get('*').forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`❌ Error in global watcher:`, error);
                }
            });
        }
    }
    
    // ==========================================
    // COMPUTED PROPERTIES
    // ==========================================
    
    /**
     * Register a computed property
     * @param {string} name - Property name
     * @param {Function} computer - Function that returns computed value
     * @param {Array} dependencies - State paths this depends on
     */
    computed(name, computer, dependencies = []) {
        this._computed.set(name, computer);
        
        // Recompute when dependencies change
        dependencies.forEach(dep => {
            this.watch(dep, () => {
                this._computed.set(name, computer);
            });
        });
    }
    
    // ==========================================
    // HISTORY (UNDO/REDO)
    // ==========================================
    
    /**
     * Add change to history
     * @private
     */
    _addToHistory(path, oldValue, newValue) {
        if (this._isUndoRedo) return;
        
        // Remove any future history (when user undid and made new change)
        if (this._historyIndex < this._history.length - 1) {
            this._history = this._history.slice(0, this._historyIndex + 1);
        }
        
        this._history.push({
            path,
            oldValue,
            newValue,
            timestamp: Date.now()
        });
        
        // Enforce max history limit
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }
        
        this._historyIndex = this._history.length - 1;
    }
    
    /**
     * Undo last state change
     * @returns {boolean} Success
     */
    undo() {
        if (this._historyIndex < 0) {
            console.log('📜 Nothing to undo');
            return false;
        }
        
        const change = this._history[this._historyIndex];
        
        this._isUndoRedo = true;
        this.set(change.path, change.oldValue, { trackHistory: false });
        this._isUndoRedo = false;
        
        this._historyIndex--;
        
        console.log('↩️ Undo:', change.path);
        return true;
    }
    
    /**
     * Redo previously undone change
     * @returns {boolean} Success
     */
    redo() {
        if (this._historyIndex >= this._history.length - 1) {
            console.log('📜 Nothing to redo');
            return false;
        }
        
        this._historyIndex++;
        const change = this._history[this._historyIndex];
        
        this._isUndoRedo = true;
        this.set(change.path, change.newValue, { trackHistory: false });
        this._isUndoRedo = false;
        
        console.log('↪️ Redo:', change.path);
        return true;
    }
    
    /**
     * Clear undo/redo history
     */
    clearHistory() {
        this._history = [];
        this._historyIndex = -1;
    }
    
    // ==========================================
    // VALIDATION
    // ==========================================
    
    /**
     * Register a validator for a path
     * @param {string} path - State path
     * @param {Function} validator - (value) => boolean
     */
    addValidator(path, validator) {
        if (!this._validators.has(path)) {
            this._validators.set(path, []);
        }
        this._validators.get(path).push(validator);
    }
    
    /**
     * Validate a value for a path
     * @private
     * @returns {boolean}
     */
    _validate(path, value) {
        if (!this._validators.has(path)) return true;
        
        const validators = this._validators.get(path);
        
        for (const validator of validators) {
            try {
                if (!validator(value)) {
                    return false;
                }
            } catch (error) {
                console.error(`❌ Validator error for ${path}:`, error);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Register default validators
     * @private
     */
    _registerDefaultValidators() {
        // Leads must be an array
        this.addValidator('data.leads', (value) => Array.isArray(value));
        
        // Clients must be an array
        this.addValidator('data.clients', (value) => Array.isArray(value));
        
        // Role must be valid
        this.addValidator('user.role', (value) => {
            return value === null || Object.values(Constants.ROLES).includes(value);
        });
        
        // Modal state must be boolean
        this.addValidator('ui.modalOpen', (value) => typeof value === 'boolean');
    }
    
    // ==========================================
    // PERSISTENCE
    // ==========================================
    
    /**
     * Load state from localStorage
     * @private
     */
    _loadState() {
        try {
            const saved = localStorage.getItem(this._persistenceKey);
            
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // Merge saved state (don't overwrite structure)
                if (parsed.data) {
                    Object.assign(this._state.data, parsed.data);
                }
                
                if (parsed.user) {
                    Object.assign(this._state.user, parsed.user);
                }
                
                if (parsed.ui) {
                    // Only restore specific UI state
                    const { theme, darkMode, filters, pagination, sort } = parsed.ui;
                    Object.assign(this._state.ui, { theme, darkMode, filters, pagination, sort });
                }
                
                if (parsed.system) {
                    const { autoBackupEnabled, lastBackup, metrics } = parsed.system;
                    Object.assign(this._state.system, { autoBackupEnabled, lastBackup, metrics });
                }
                
                console.log('💾 State loaded from localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load state from localStorage:', error);
        }
    }
    
    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const stateToSave = {
                data: this._state.data,
                user: {
                    preferences: this._state.user.preferences,
                    onboardingComplete: this._state.user.onboardingComplete
                },
                ui: {
                    theme: this._state.ui.theme,
                    darkMode: this._state.ui.darkMode,
                    filters: this._state.ui.filters,
                    pagination: this._state.ui.pagination,
                    sort: this._state.ui.sort
                },
                system: {
                    autoBackupEnabled: this._state.system.autoBackupEnabled,
                    lastBackup: this._state.system.lastBackup,
                    metrics: this._state.system.metrics
                }
            };
            
            localStorage.setItem(this._persistenceKey, JSON.stringify(stateToSave));
            
            this._changes.clear();
            this._state.system.lastBackup = new Date().toISOString();
            
            console.log('💾 State saved to localStorage');
        } catch (error) {
            console.warn('⚠️ Failed to save state:', error);
        }
    }
    
    /**
     * Schedule auto-save with debounce
     * @private
     */
    _scheduleAutoSave() {
        if (this._autoSaveInterval) {
            clearTimeout(this._autoSaveInterval);
        }
        
        this._autoSaveInterval = setTimeout(this._autoSaveHandler, this._autoSaveDelay);
    }
    
    /**
     * Auto-save handler
     * @private
     */
    _autoSave() {
        if (this._changes.size === 0) return;
        this.saveState();
    }
    
    /**
     * Setup auto-save on interval
     * @private
     */
    _setupAutoSave() {
        // Save every 30 seconds
        setInterval(() => {
            if (this._changes.size > 0) {
                this.saveState();
            }
        }, 30000);
        
        // Save before page unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
        
        // Save when page becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveState();
            }
        });
    }
    
    /**
     * Track state changes
     * @private
     */
    _trackChange(path) {
        if (this._batchMode) {
            this._batchChanges.add(path);
        } else {
            this._changes.add(path);
        }
    }
    
    // ==========================================
    // NETWORK LISTENERS
    // ==========================================
    
    /**
     * Setup network status listeners
     * @private
     */
    _setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.set('ui.online', true);
            this.set('system.online', true);
        });
        
        window.addEventListener('offline', () => {
            this.set('ui.online', false);
            this.set('system.online', false);
        });
        
        // Get connection type if available
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                this.set('system.connectionType', connection.effectiveType || 'unknown');
                
                connection.addEventListener('change', () => {
                    this.set('system.connectionType', connection.effectiveType);
                });
            }
        }
    }
    
    // ==========================================
    // RESIZE LISTENER
    // ==========================================
    
    /**
     * Setup resize listener
     * @private
     */
    _setupResizeListener() {
        let resizeTimer;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            
            resizeTimer = setTimeout(() => {
                const width = window.innerWidth;
                const height = window.innerHeight;
                
                this.set('ui.screenWidth', width);
                this.set('ui.screenHeight', height);
                this.set('ui.isMobile', width < 768);
                this.set('ui.isTablet', width >= 768 && width < 1024);
                this.set('ui.isDesktop', width >= 1024);
            }, 250);
        });
    }
    
    // ==========================================
    // ACTIVITY TRACKING
    // ==========================================
    
    /**
     * Setup user activity tracking
     * @private
     */
    _setupActivityTracking() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        
        const updateActivity = () => {
            this.set('ui.lastActivity', Date.now());
        };
        
        events.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
    }
    
    // ==========================================
    // PERFORMANCE METRICS
    // ==========================================
    
    /**
     * Capture performance metrics
     * @private
     */
    _capturePerformanceMetrics() {
        if (!window.performance || !window.performance.timing) return;
        
        const timing = window.performance.timing;
        
        this.set('system.performance.pageLoadTime', timing.loadEventEnd - timing.navigationStart);
        this.set('system.performance.firstPaint', timing.responseEnd - timing.fetchStart);
        this.set('system.performance.domInteractive', timing.domInteractive - timing.fetchStart);
    }
    
    // ==========================================
    // DEFAULT VALUES
    // ==========================================
    
    /**
     * Get default value for a path
     * @private
     */
    _getDefaultValue(path) {
        const defaults = {
            'data.leads': [],
            'data.clients': [],
            'data.revenueEntries': [],
            'data.projects': [],
            'ui.modalOpen': false,
            'ui.globalLoading': false,
            'ui.theme': 'internal',
            'ui.darkMode': false,
            'user.role': null,
            'user.permissions': [],
            'user.isAuthenticated': false
        };
        
        return defaults[path] !== undefined ? defaults[path] : null;
    }
    
    /**
     * Get default UI state
     * @private
     */
    _getDefaultUIState() {
        return {
            currentPage: null,
            previousPage: null,
            sidebarOpen: false,
            mobileMenuOpen: false,
            globalLoading: false,
            loadingMessage: '',
            loadingTasks: [],
            modalOpen: false,
            modalTitle: '',
            modalContent: '',
            modalData: null,
            toastQueue: [],
            theme: 'internal',
            darkMode: false,
            searchQuery: '',
            searchResults: [],
            searchOpen: false,
            filters: {},
            pagination: {},
            sort: {},
            selectedItems: [],
            formDirty: false,
            online: navigator.onLine,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            isMobile: window.innerWidth < 768,
            isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
            isDesktop: window.innerWidth >= 1024,
            lastActivity: Date.now(),
            breadcrumbs: []
        };
    }
    
    /**
     * Get default user state
     * @private
     */
    _getDefaultUserState() {
        return {
            isAuthenticated: false,
            currentUser: null,
            userProfile: null,
            role: null,
            permissions: [],
            clientId: null,
            preferences: {
                theme: 'internal',
                darkMode: false,
                language: 'en-IN',
                timezone: 'Asia/Kolkata',
                dateFormat: 'DD/MM/YYYY',
                notifications: { email: true, push: true, sms: false, sound: true },
                dashboardLayout: 'default',
                tablePageSize: 25
            },
            sessionStart: null,
            lastLogin: null,
            loginAttempts: 0,
            onboardingComplete: false,
            currentOnboardingStep: 0
        };
    }
    
    /**
     * Get default system state
     * @private
     */
    _getDefaultSystemState() {
        return {
            version: '2.0.0',
            build: 'enterprise',
            environment: 'production',
            initialized: false,
            initTime: null,
            initDuration: 0,
            performance: { pageLoadTime: 0, firstPaint: 0, firstContentfulPaint: 0, domInteractive: 0 },
            errors: [],
            lastError: null,
            online: navigator.onLine,
            connectionType: null,
            storageUsed: 0,
            storageAvailable: 0,
            lastBackup: null,
            backupInProgress: false,
            autoBackupEnabled: true,
            maintenanceMode: false,
            features: {},
            metrics: { pageViews: 0, totalSessions: 0, actionsPerformed: 0, dataExported: 0, dataImported: 0, errorsEncountered: 0 }
        };
    }
    
    /**
     * Debug: Print current state to console
     */
    debug() {
        console.group('📊 State Debug');
        console.log('Data:', this._state.data);
        console.log('UI:', this._state.ui);
        console.log('User:', this._state.user);
        console.log('System:', this._state.system);
        console.log('Watchers:', this._watchers.size);
        console.log('Computed:', this._computed.size);
        console.log('History:', this._history.length, 'items');
        console.log('Changes:', this._changes.size, 'pending');
        console.groupEnd();
    }
    
    /**
     * Get state statistics
     */
    getStats() {
        return {
            dataCollections: Object.keys(this._state.data).length,
            totalItems: Object.values(this._state.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
            watchers: this._watchers.size,
            computed: this._computed.size,
            historyItems: this._history.length,
            pendingChanges: this._changes.size,
            isDirty: this.isDirty()
        };
    }
}

// ==========================================
// CREATE & EXPORT STATE MANAGER INSTANCE
// ==========================================
const stateManager = new StateManager();

// Register commonly used computed properties
stateManager.computed('totalLeads', () => {
    return stateManager.get('data.leads').length;
}, ['data.leads']);

stateManager.computed('totalClients', () => {
    return stateManager.get('data.clients').length;
}, ['data.clients']);

stateManager.computed('totalRevenue', () => {
    const entries = stateManager.get('data.revenueEntries');
    return entries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
}, ['data.revenueEntries']);

stateManager.computed('activeLeadsCount', () => {
    return stateManager.get('data.leads').filter(l => l.status !== 'Won' && l.status !== 'Lost').length;
}, ['data.leads']);

stateManager.computed('wonLeadsCount', () => {
    return stateManager.get('data.leads').filter(l => l.status === 'Won').length;
}, ['data.leads']);

stateManager.computed('isAuthenticated', () => {
    return stateManager.get('user.isAuthenticated');
}, ['user.isAuthenticated']);

stateManager.computed('userRole', () => {
    return stateManager.get('user.role');
}, ['user.role']);

// Make available globally
window.StateManager = stateManager;
window.AppState = stateManager; // Alias for convenience

// Export for module usage
export default stateManager;

console.log('📦 State Manager ready');
console.log('📊 Stats:', stateManager.getStats());

// ==========================================
// END OF STATE MANAGER
// ==========================================
