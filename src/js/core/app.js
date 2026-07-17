/* ==========================================
   11 AVATAR DIGITAL HUB
   Core Application Initialization
   Version: 2.0 Enterprise
   ==========================================
   Responsibilities:
   - App initialization & bootstrap
   - Global state management
   - Route handling & navigation
   - Module loading & orchestration
   - Event system
   - Error handling
   - Offline support
   - Auto-save & backup
   ========================================== */

// ==========================================
// GLOBAL APP STATE
// ==========================================
const AppState = {
    // User
    currentUser: null,
    userProfile: null,
    isAuthenticated: false,
    
    // App
    initialized: false,
    currentPage: null,
    previousPage: null,
    sidebarOpen: false,
    theme: 'internal', // 'public' | 'internal'
    darkMode: false,
    
    // Loading
    loading: false,
    loadingMessage: '',
    
    // Network
    online: navigator.onLine,
    
    // Data cache
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    
    // Pending operations (offline queue)
    offlineQueue: [],
    
    // Modules loaded status
    modules: {
        auth: false,
        leads: false,
        clients: false,
        revenue: false,
        pipeline: false,
        projects: false,
        retainers: false,
        whatsapp: false,
        reports: false,
        settings: false
    },
    
    // Metrics
    metrics: {
        appLoadTime: null,
        lastSaveTime: null,
        lastBackupTime: null,
        errors: []
    }
};

// ==========================================
// APP INITIALIZATION
// ==========================================
class App {
    constructor() {
        this.state = AppState;
        this.events = new Map();
        this.modules = new Map();
        this.startTime = performance.now();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('🚀 Initializing 11 Avatar Digital Hub...');
            this.showLoader('Initializing application...');
            
            // Step 1: Check environment
            this.checkEnvironment();
            
            // Step 2: Load theme
            this.initTheme();
            
            // Step 3: Setup event listeners
            this.setupEvents();
            
            // Step 4: Check auth state
            await this.checkAuth();
            
            // Step 5: Load user preferences
            this.loadPreferences();
            
            // Step 6: Setup offline support
            this.setupOfflineSupport();
            
            // Step 7: Setup auto-save
            this.setupAutoSave();
            
            // Step 8: Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Step 9: Initialize modules
            await this.initModules();
            
            // Step 10: Navigate to start page
            this.navigateTo(this.getStartPage());
            
            // Mark as initialized
            this.state.initialized = true;
            this.state.metrics.appLoadTime = performance.now() - this.startTime;
            
            this.hideLoader();
            console.log('✅ App initialized in', Math.round(this.state.metrics.appLoadTime), 'ms');
            
            // Dispatch ready event
            this.emit('app:ready');
            
            // Show welcome toast
            this.toast('Welcome to 11 Avatar Digital Hub!', 'success');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.handleError(error);
            this.hideLoader();
            this.showErrorPage(error);
        }
    }
    
    /**
     * Check browser environment
     */
    checkEnvironment() {
        // Check required APIs
        const required = ['localStorage', 'indexedDB', 'fetch'];
        const missing = required.filter(api => !window[api]);
        
        if (missing.length > 0) {
            throw new Error(`Browser missing required APIs: ${missing.join(', ')}`);
        }
        
        // Check if Firebase is available
        if (!window.FirebaseService) {
            throw new Error('Firebase service not found. Check firebase.js');
        }
        
        // Check if Constants are available
        if (!window.Constants) {
            throw new Error('Constants not found. Check constants.js');
        }
        
        console.log('✅ Environment check passed');
    }
    
    /**
     * Initialize theme
     */
    initTheme() {
        const savedTheme = localStorage.getItem('11avatar_theme');
        const savedDarkMode = localStorage.getItem('11avatar_darkMode');
        
        this.state.theme = savedTheme || 'internal';
        this.state.darkMode = savedDarkMode === 'true';
        
        this.applyTheme();
        console.log('🎨 Theme initialized:', this.state.theme, this.state.darkMode ? 'dark' : 'light');
    }
    
    /**
     * Apply theme to DOM
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
        
        if (this.state.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        localStorage.setItem('11avatar_theme', this.state.theme);
        localStorage.setItem('11avatar_darkMode', this.state.darkMode);
    }
    
    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        this.state.darkMode = !this.state.darkMode;
        this.applyTheme();
        this.toast(this.state.darkMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 'info');
    }
    
    /**
     * Setup global event listeners
     */
    setupEvents() {
        // Network status
        window.addEventListener('online', () => {
            this.state.online = true;
            this.toast('📶 Back online!', 'success');
            this.processOfflineQueue();
            this.emit('network:online');
        });
        
        window.addEventListener('offline', () => {
            this.state.online = false;
            this.toast('📶 You are offline. Changes will be saved locally.', 'warning');
            this.emit('network:offline');
        });
        
        // Before unload
        window.addEventListener('beforeunload', () => {
            this.saveAll();
            this.emit('app:closing');
        });
        
        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.emit('app:resume');
            } else {
                this.saveAll();
                this.emit('app:pause');
            }
        });
        
        // Resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.emit('app:resize', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, 250);
        });
        
        // Error handling
        window.addEventListener('error', (event) => {
            this.logError('Uncaught error', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled promise rejection', event.reason);
        });
        
        console.log('👂 Event listeners setup complete');
    }
    
    /**
     * Check authentication state
     */
    async checkAuth() {
        return new Promise((resolve) => {
            const unsubscribe = FirebaseService.auth.onAuthStateChanged(async (user) => {
                unsubscribe();
                
                if (user) {
                    this.state.currentUser = user;
                    this.state.isAuthenticated = true;
                    
                    try {
                        this.state.userProfile = await FirebaseService.getCurrentUserProfile();
                        console.log('👤 User authenticated:', user.email);
                        console.log('👤 Role:', this.state.userProfile?.role);
                    } catch (error) {
                        console.warn('⚠️ Could not fetch user profile:', error);
                    }
                } else {
                    this.state.currentUser = null;
                    this.state.isAuthenticated = false;
                    this.state.userProfile = null;
                    console.log('👤 No user authenticated');
                }
                
                resolve();
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                console.warn('⚠️ Auth check timeout');
                resolve();
            }, 5000);
        });
    }
    
    /**
     * Load user preferences
     */
    loadPreferences() {
        try {
            const prefs = localStorage.getItem('11avatar_preferences');
            if (prefs) {
                const parsed = JSON.parse(prefs);
                this.state.theme = parsed.theme || this.state.theme;
                this.state.darkMode = parsed.darkMode || this.state.darkMode;
                this.state.sidebarOpen = parsed.sidebarOpen || false;
            }
        } catch (error) {
            console.warn('⚠️ Could not load preferences');
        }
    }
    
    /**
     * Save user preferences
     */
    savePreferences() {
        try {
            const prefs = {
                theme: this.state.theme,
                darkMode: this.state.darkMode,
                sidebarOpen: this.state.sidebarOpen
            };
            localStorage.setItem('11avatar_preferences', JSON.stringify(prefs));
        } catch (error) {
            console.warn('⚠️ Could not save preferences');
        }
    }
    
    /**
     * Setup offline support
     */
    setupOfflineSupport() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('👷 Service Worker registered:', registration.scope);
                })
                .catch(error => {
                    console.warn('⚠️ Service Worker registration failed:', error);
                });
        }
        
        // Listen for sync events
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-data');
            });
        }
        
        console.log('📡 Offline support setup complete');
    }
    
    /**
     * Process offline queue
     */
    async processOfflineQueue() {
        if (this.state.offlineQueue.length === 0) return;
        
        console.log('📤 Processing offline queue:', this.state.offlineQueue.length, 'items');
        
        const queue = [...this.state.offlineQueue];
        this.state.offlineQueue = [];
        
        for (const item of queue) {
            try {
                await this.executeOfflineItem(item);
                console.log('✅ Offline item processed:', item.type);
            } catch (error) {
                console.error('❌ Offline item failed:', error);
                this.state.offlineQueue.push(item);
            }
        }
        
        if (this.state.offlineQueue.length === 0) {
            this.toast('📤 All offline changes synced!', 'success');
        }
    }
    
    /**
     * Execute offline queue item
     */
    async executeOfflineItem(item) {
        switch (item.type) {
            case 'create':
                await FirebaseService.createDocument(item.collection, item.data);
                break;
            case 'update':
                await FirebaseService.updateDocument(item.collection, item.docId, item.data);
                break;
            case 'delete':
                await FirebaseService.deleteDocument(item.collection, item.docId);
                break;
            default:
                console.warn('Unknown offline item type:', item.type);
        }
    }
    
    /**
     * Setup auto-save
     */
    setupAutoSave() {
        // Auto-save every 30 seconds
        setInterval(() => {
            this.saveAll();
        }, 30000);
        
        // Save on page hide
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveAll();
            }
        });
        
        console.log('💾 Auto-save setup complete');
    }
    
    /**
     * Save all data
     */
    saveAll() {
        this.savePreferences();
        this.state.metrics.lastSaveTime = new Date().toISOString();
        this.emit('app:save');
    }
    
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape - close modals
            if (e.key === 'Escape') {
                this.emit('keyboard:escape');
            }
            
            // Ctrl/Cmd + S - save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveAll();
                this.toast('💾 Saved!', 'success');
            }
            
            // Ctrl/Cmd + K - search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.emit('keyboard:search');
            }
            
            // Ctrl/Cmd + B - toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
            
            // Ctrl/Cmd + D - toggle dark mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleDarkMode();
            }
        });
        
        console.log('⌨️ Keyboard shortcuts setup complete');
    }
    
    /**
     * Initialize all modules
     */
    async initModules() {
        console.log('📦 Initializing modules...');
        
        // Core modules load automatically
        const coreModules = ['auth', 'leads', 'clients', 'revenue', 'pipeline'];
        
        for (const moduleName of coreModules) {
            try {
                await this.loadModule(moduleName);
                this.state.modules[moduleName] = true;
                console.log(`  ✅ ${moduleName}`);
            } catch (error) {
                console.warn(`  ⚠️ ${moduleName}: ${error.message}`);
            }
        }
        
        console.log('📦 Core modules initialized');
    }
    
    /**
     * Load a module dynamically
     */
    async loadModule(moduleName) {
        if (this.modules.has(moduleName)) {
            return this.modules.get(moduleName);
        }
        
        try {
            const module = await import(`../modules/${moduleName}.js`);
            this.modules.set(moduleName, module.default || module);
            return this.modules.get(moduleName);
        } catch (error) {
            console.error(`Failed to load module: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * Get start page based on auth state
     */
    getStartPage() {
        if (this.state.isAuthenticated) {
            return 'dashboard';
        }
        return 'login';
    }
    
    /**
     * Navigate to a page
     */
    navigateTo(page, params = {}) {
        this.state.previousPage = this.state.currentPage;
        this.state.currentPage = page;
        
        console.log(`🧭 Navigating to: ${page}`, params);
        
        // Close sidebar on mobile
        if (window.innerWidth < Constants.UI.mobileBreakpoint) {
            this.closeSidebar();
        }
        
        // Emit navigation event
        this.emit('navigation:change', { page, params, previous: this.state.previousPage });
        
        // Update URL hash
        window.location.hash = page;
    }
    
    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        this.emit('sidebar:toggle', this.state.sidebarOpen);
        this.savePreferences();
    }
    
    /**
     * Open sidebar
     */
    openSidebar() {
        this.state.sidebarOpen = true;
        this.emit('sidebar:open');
        this.savePreferences();
    }
    
    /**
     * Close sidebar
     */
    closeSidebar() {
        this.state.sidebarOpen = false;
        this.emit('sidebar:close');
        this.savePreferences();
    }
    
    // ==========================================
    // EVENT SYSTEM
    // ==========================================
    
    /**
     * Listen for an event
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return () => this.off(event, callback);
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
    }
    
    /**
     * Emit an event
     */
    emit(event, data = {}) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
    
    // ==========================================
    // UI HELPERS
    // ==========================================
    
    /**
     * Show loading overlay
     */
    showLoader(message = 'Loading...') {
        this.state.loading = true;
        this.state.loadingMessage = message;
        this.emit('loader:show', { message });
    }
    
    /**
     * Hide loading overlay
     */
    hideLoader() {
        this.state.loading = false;
        this.state.loadingMessage = '';
        this.emit('loader:hide');
    }
    
    /**
     * Show toast notification
     */
    toast(message, type = 'info', duration = Constants.UI.toastDuration) {
        this.emit('toast:show', { message, type, duration });
        
        // Fallback if no toast handler
        if (!this.events.has('toast:show') || this.events.get('toast:show').length === 0) {
            console.log(`🔔 [${type.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * Show modal
     */
    modal(title, content, options = {}) {
        this.emit('modal:show', { title, content, ...options });
    }
    
    /**
     * Close modal
     */
    closeModal() {
        this.emit('modal:close');
    }
    
    /**
     * Confirm dialog
     */
    async confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.emit('confirm:show', {
                title,
                message,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }
    
    /**
     * Show error page
     */
    showErrorPage(error) {
        console.error('💥 Application Error:', error);
        this.navigateTo('error', { error: error.message });
    }
    
    // ==========================================
    // ERROR HANDLING
    // ==========================================
    
    /**
     * Handle error
     */
    handleError(error) {
        this.logError(error.message, error);
        
        if (error.code === 'permission-denied') {
            this.toast(Constants.ERRORS.PERMISSION_DENIED, 'error');
        } else if (error.code === 'unavailable' || error.code === 'network-error') {
            this.toast(Constants.ERRORS.NETWORK, 'error');
        } else {
            this.toast(error.message || 'An unexpected error occurred', 'error');
        }
    }
    
    /**
     * Log error
     */
    logError(message, error = null) {
        const errorEntry = {
            message,
            stack: error?.stack || null,
            timestamp: new Date().toISOString(),
            page: this.state.currentPage,
            user: this.state.currentUser?.uid || 'anonymous'
        };
        
        this.state.metrics.errors.push(errorEntry);
        
        // Keep only last 100 errors
        if (this.state.metrics.errors.length > 100) {
            this.state.metrics.errors = this.state.metrics.errors.slice(-100);
        }
        
        // Log to console
        console.error('📝 Error logged:', errorEntry);
        
        // Try to save to Firestore
        this.saveError(errorEntry).catch(() => {});
    }
    
    /**
     * Save error to Firestore
     */
    async saveError(errorEntry) {
        try {
            await FirebaseService.createDocument('activityLogs', {
                type: 'error',
                ...errorEntry
            });
        } catch (err) {
            // Silent fail - don't want error logging to cause more errors
        }
    }
    
    // ==========================================
    // UTILITY HELPERS
    // ==========================================
    
    /**
     * Get current screen size info
     */
    getScreenInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: window.innerWidth < Constants.UI.mobileBreakpoint,
            isTablet: window.innerWidth >= Constants.UI.mobileBreakpoint && window.innerWidth < Constants.UI.tabletBreakpoint,
            isDesktop: window.innerWidth >= Constants.UI.tabletBreakpoint
        };
    }
    
    /**
     * Check if user has permission
     */
    hasPermission(permission) {
        if (!this.state.isAuthenticated || !this.state.userProfile) return false;
        
        const role = this.state.userProfile.role;
        if (!role) return false;
        
        const permissions = Constants.ROLE_PERMISSIONS[role];
        if (!permissions) return false;
        
        return permissions.includes(permission) || permissions.includes('all');
    }
    
    /**
     * Check if user has role
     */
    hasRole(role) {
        if (!this.state.isAuthenticated || !this.state.userProfile) return false;
        return this.state.userProfile.role === role;
    }
    
    /**
     * Get current client ID
     */
    getClientId() {
        if (!this.state.userProfile) return null;
        return this.state.userProfile.clientId || null;
    }
    
    /**
     * Format currency (Indian format)
     */
    formatCurrency(amount) {
        const settings = Constants.DEFAULT_SETTINGS;
        const rounded = settings.roundUp ? Math.round(amount) : amount;
        return settings.currencySymbol + Number(rounded).toLocaleString('en-IN');
    }
    
    /**
     * Format date
     */
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
}

// ==========================================
// CREATE & EXPORT APP INSTANCE
// ==========================================
const app = new App();

// Make available globally
window.App = app;
window.AppState = AppState;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

console.log('🏗️ App core initialized, waiting for DOM...');

// ==========================================
// END OF CORE APPLICATION
// ==========================================

