/**
 * @fileoverview 11 Avatar SMEs CRM - Core Application Bootstrap
 * @description Multi-page application bootstrap for GitHub Pages static deployment.
 *              Handles theme management, auth state monitoring, global event bus,
 *              offline support, error logging, keyboard shortcuts, and page lifecycle.
 *              Designed for .html multi-page architecture (NOT SPA).
 * @module core/app
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires FirebaseService (window.FirebaseService) - optional
 * @requires Constants (window.Constants) - optional
 * @requires RoutesConfig (window.RoutesConfig) - optional
 *
 * @exports window.AppCore - Global namespace
 */

'use strict';

// =============================================================================
// APP CORE - Self-executing IIFE
// =============================================================================
const AppCore = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: APPLICATION STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} Centralized application state */
    const state = {
        /** @type {Object|null} Current Firebase user */
        currentUser: null,
        
        /** @type {Object|null} User profile from Firestore */
        userProfile: null,
        
        /** @type {boolean} Whether user is authenticated */
        isAuthenticated: false,
        
        /** @type {boolean} Whether app has fully initialized */
        initialized: false,
        
        /** @type {string} Current page identifier */
        currentPage: null,
        
        /** @type {string} Previous page identifier */
        previousPage: null,
        
        /** @type {string} Current theme: 'public' or 'internal' */
        theme: 'internal',
        
        /** @type {boolean} Whether dark mode is enabled */
        darkMode: false,
        
        /** @type {boolean} Whether sidebar is open */
        sidebarOpen: false,
        
        /** @type {boolean} Whether app is in loading state */
        loading: false,
        
        /** @type {string} Loading message */
        loadingMessage: '',
        
        /** @type {boolean} Whether browser is online */
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        
        /** @type {Array} Offline operation queue */
        offlineQueue: [],
        
        /** @type {number} App start timestamp */
        startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        
        /** @type {Object} Application metrics */
        metrics: {
            appLoadTime: null,
            lastSaveTime: null,
            errors: [],
        },
        
        /** @type {string} Current page's route ID from RoutesConfig */
        currentRouteId: null,
    };
    
    /** @type {Map} Event listeners registry */
    const eventRegistry = new Map();
    
    /** @type {Array} One-time initialization queue */
    const initQueue = [];
    
    /** @type {boolean} Whether init queue is being processed */
    let isProcessingQueue = false;

    // -------------------------------------------------------------------------
    // SECTION 2: UTILITY FUNCTIONS
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
            
            var prefix = '[AppCore]';
            switch (level) {
                case 'error':
                    console.error(prefix, message, data || '');
                    break;
                case 'warn':
                    console.warn(prefix, message, data || '');
                    break;
                default:
                    console.log(prefix, message, data || '');
                    break;
            }
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Get a safe value from Constants module or fallback
     * @param {string} path - Dot-notation path (e.g., 'UI.THEME.DEFAULT')
     * @param {*} fallback - Default value if not found
     * @returns {*} Value or fallback
     */
    function getConstant(path, fallback) {
        try {
            if (!window.Constants) return fallback;
            
            var parts = path.split('.');
            var value = window.Constants;
            
            for (var i = 0; i < parts.length; i++) {
                value = value[parts[i]];
                if (value === undefined || value === null) return fallback;
            }
            
            return value;
        } catch (e) {
            return fallback;
        }
    }
    
    /**
     * Get current page route ID from URL
     * @returns {string} Route ID or 'unknown'
     */
    function detectCurrentPage() {
        try {
            var path = window.location.pathname;
            
            // Extract filename from path
            var filename = path.split('/').pop() || 'index.html';
            
            // Remove .html extension
            var pageName = filename.replace(/\.html$/, '');
            
            // Handle root
            if (!pageName || pageName === 'index' || path.endsWith('/')) {
                pageName = 'landing';
            }
            
            // Try RoutesConfig if available
            if (window.RoutesConfig && typeof window.RoutesConfig.getRouteIdByPath === 'function') {
                var routeId = window.RoutesConfig.getRouteIdByPath(path);
                if (routeId) return routeId;
            }
            
            return pageName;
        } catch (e) {
            return 'unknown';
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 3: THEME MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Initialize theme from storage or defaults
     */
    function initTheme() {
        try {
            var savedTheme = localStorage.getItem('11avatar_theme');
            var savedDarkMode = localStorage.getItem('11avatar_darkMode');
            
            state.theme = savedTheme || 'internal';
            state.darkMode = savedDarkMode === 'true';
            
            // Override with route-specific theme if RoutesConfig available
            var routeId = detectCurrentPage();
            if (window.RoutesConfig && typeof window.RoutesConfig.getRouteTheme === 'function') {
                var routeTheme = window.RoutesConfig.getRouteTheme(routeId);
                if (routeTheme) state.theme = routeTheme;
            }
            
            applyTheme();
            log('log', 'Theme initialized: ' + state.theme + (state.darkMode ? ' (dark)' : ''));
        } catch (e) {
            log('error', 'Theme init failed:', e);
        }
    }
    
    /**
     * Apply current theme to DOM
     */
    function applyTheme() {
        try {
            document.documentElement.setAttribute('data-theme', state.theme);
            
            if (state.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            // Save preferences
            localStorage.setItem('11avatar_theme', state.theme);
            localStorage.setItem('11avatar_darkMode', String(state.darkMode));
            
            // Emit theme change event
            emit('theme:changed', { theme: state.theme, darkMode: state.darkMode });
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Toggle dark mode
     */
    function toggleDarkMode() {
        state.darkMode = !state.darkMode;
        applyTheme();
        log('log', 'Dark mode ' + (state.darkMode ? 'enabled' : 'disabled'));
        return state.darkMode;
    }
    
    /**
     * Set theme
     * @param {string} theme - 'public' or 'internal'
     */
    function setTheme(theme) {
        if (theme === 'public' || theme === 'internal') {
            state.theme = theme;
            applyTheme();
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: AUTH STATE MONITORING
    // -------------------------------------------------------------------------
    
    /**
     * Initialize auth state listener
     */
    function initAuth() {
        try {
            // Check if Firebase is available
            if (typeof firebase === 'undefined' || !firebase.auth) {
                log('warn', 'Firebase Auth not available - skipping auth monitoring');
                state.initialized = true;
                emit('app:ready', { authAvailable: false });
                return;
            }
            
            // Listen for auth state changes
            firebase.auth().onAuthStateChanged(
                function(user) {
                    if (user) {
                        state.currentUser = user;
                        state.isAuthenticated = true;
                        
                        // Store basic session info
                        try {
                            var sessionData = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName,
                                emailVerified: user.emailVerified,
                                lastLogin: new Date().toISOString(),
                            };
                            sessionStorage.setItem('auth_user', JSON.stringify(sessionData));
                        } catch (e) {
                            // Storage may be full
                        }
                        
                        // Try to fetch profile if FirebaseService available
                        fetchUserProfile(user.uid);
                        
                        log('log', 'User authenticated: ' + user.email);
                        emit('auth:login', { user: user });
                    } else {
                        state.currentUser = null;
                        state.isAuthenticated = false;
                        state.userProfile = null;
                        
                        try {
                            sessionStorage.removeItem('auth_user');
                        } catch (e) {
                            // Silent
                        }
                        
                        log('log', 'User signed out');
                        emit('auth:logout', {});
                    }
                    
                    // Mark as initialized after first auth state
                    if (!state.initialized) {
                        state.initialized = true;
                        state.metrics.appLoadTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - state.startTime;
                        emit('app:ready', { authAvailable: true });
                        processInitQueue();
                    }
                },
                function(error) {
                    log('error', 'Auth state observer error:', error);
                    if (!state.initialized) {
                        state.initialized = true;
                        emit('app:ready', { authAvailable: false, error: error.message });
                        processInitQueue();
                    }
                }
            );
            
            // Timeout fallback
            setTimeout(function() {
                if (!state.initialized) {
                    state.initialized = true;
                    state.metrics.appLoadTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - state.startTime;
                    emit('app:ready', { authAvailable: false, timeout: true });
                    processInitQueue();
                }
            }, 8000);
            
        } catch (e) {
            log('error', 'Auth init failed:', e);
            state.initialized = true;
            emit('app:ready', { authAvailable: false, error: e.message });
            processInitQueue();
        }
    }
    
    /**
     * Fetch user profile from Firestore
     * @param {string} uid - User ID
     */
    async function fetchUserProfile(uid) {
        try {
            // Try FirebaseService
            if (window.FirebaseService && typeof window.FirebaseService.getDocument === 'function') {
                var profile = await window.FirebaseService.getDocument('users', uid);
                if (profile) {
                    state.userProfile = profile;
                    log('log', 'User profile loaded, role: ' + (profile.role || 'unknown'));
                    emit('profile:loaded', { profile: profile });
                    return;
                }
            }
            
            // Direct Firestore fallback
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                var doc = await firebase.firestore().collection('users').doc(uid).get();
                if (doc.exists) {
                    state.userProfile = { id: doc.id, uid: uid, data: doc.data() };
                    log('log', 'User profile loaded via Firestore');
                    emit('profile:loaded', { profile: state.userProfile });
                }
            }
        } catch (e) {
            log('warn', 'Could not fetch user profile:', e);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: EVENT SYSTEM
    // -------------------------------------------------------------------------
    
    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    function on(event, callback) {
        if (typeof callback !== 'function') {
            return function() {};
        }
        
        if (!eventRegistry.has(event)) {
            eventRegistry.set(event, []);
        }
        
        eventRegistry.get(event).push(callback);
        
        return function() {
            off(event, callback);
        };
    }
    
    /**
     * Remove an event listener
     * @param {string} event
     * @param {Function} callback
     */
    function off(event, callback) {
        if (!eventRegistry.has(event)) return;
        
        var listeners = eventRegistry.get(event);
        var index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
    
    /**
     * Emit an event to all listeners
     * @param {string} event - Event name
     * @param {*} [data={}] - Event payload
     */
    function emit(event, data) {
        if (!eventRegistry.has(event)) return;
        
        var listeners = eventRegistry.get(event).slice(); // Copy for safe iteration
        
        listeners.forEach(function(callback) {
            try {
                callback(data || {});
            } catch (error) {
                log('error', 'Error in event handler for "' + event + '":', error);
            }
        });
        
        // Also dispatch as DOM custom event for inter-module communication
        try {
            window.dispatchEvent(new CustomEvent('app:' + event, {
                detail: data || {},
                bubbles: false,
            }));
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Register a one-time event listener
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    function once(event, callback) {
        var unsubscribe = on(event, function(data) {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }

    // -------------------------------------------------------------------------
    // SECTION 6: INIT QUEUE
    // -------------------------------------------------------------------------
    
    /**
     * Queue a function to run after app is ready
     * @param {Function} fn - Function to execute
     */
    function whenReady(fn) {
        if (state.initialized) {
            try {
                fn();
            } catch (e) {
                log('error', 'Error in ready callback:', e);
            }
        } else {
            initQueue.push(fn);
        }
    }
    
    /**
     * Process the initialization queue
     */
    function processInitQueue() {
        if (isProcessingQueue) return;
        isProcessingQueue = true;
        
        while (initQueue.length > 0) {
            var fn = initQueue.shift();
            try {
                fn();
            } catch (e) {
                log('error', 'Error processing init queue:', e);
            }
        }
        
        isProcessingQueue = false;
    }

    // -------------------------------------------------------------------------
    // SECTION 7: GLOBAL EVENT LISTENERS
    // -------------------------------------------------------------------------
    
    /**
     * Setup global browser event listeners
     */
    function setupGlobalListeners() {
        try {
            // Online/Offline
            window.addEventListener('online', function() {
                state.online = true;
                log('log', 'Network: Online');
                emit('network:online', {});
                processOfflineQueue();
            });
            
            window.addEventListener('offline', function() {
                state.online = false;
                log('log', 'Network: Offline');
                emit('network:offline', {});
            });
            
            // Page visibility
            document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'visible') {
                    emit('app:resume', {});
                } else {
                    emit('app:pause', {});
                }
            });
            
            // Global error handling
            window.addEventListener('error', function(event) {
                logError('Uncaught Error', event.error || event.message);
            });
            
            window.addEventListener('unhandledrejection', function(event) {
                logError('Unhandled Promise Rejection', event.reason);
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', function(event) {
                // Ctrl/Cmd + D = Toggle dark mode
                if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
                    event.preventDefault();
                    toggleDarkMode();
                }
                
                // Escape = Emit escape event (for closing modals/drawers)
                if (event.key === 'Escape') {
                    emit('keyboard:escape', {});
                }
            });
            
            log('log', 'Global listeners setup complete');
        } catch (e) {
            log('error', 'Global listener setup failed:', e);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 8: OFFLINE SUPPORT
    // -------------------------------------------------------------------------
    
    /**
     * Setup offline support with service worker
     */
    function setupOfflineSupport() {
        try {
            if (!('serviceWorker' in navigator)) {
                log('warn', 'Service Worker not supported');
                return;
            }
            
            // Register service worker with correct scope for GitHub Pages
            var swPath = getConstant('APP.NAME', '') === '' 
                ? '/sw.js' 
                : '/11-Avatar-SMEs-CRM/sw.js';
            
            // Try relative path first
            navigator.serviceWorker.register('sw.js', { scope: './' })
                .then(function(registration) {
                    log('log', 'Service Worker registered: ' + registration.scope);
                })
                .catch(function(error) {
                    log('warn', 'Service Worker registration failed: ' + error.message);
                    
                    // Try alternate path
                    navigator.serviceWorker.register(swPath, { scope: '/' })
                        .then(function(reg) {
                            log('log', 'Service Worker registered (alt path): ' + reg.scope);
                        })
                        .catch(function() {
                            // Both failed - non-critical
                        });
                });
        } catch (e) {
            log('warn', 'Offline support setup failed:', e);
        }
    }
    
    /**
     * Process queued offline operations
     */
    async function processOfflineQueue() {
        if (state.offlineQueue.length === 0) return;
        
        log('log', 'Processing offline queue: ' + state.offlineQueue.length + ' items');
        
        var queue = state.offlineQueue.slice();
        state.offlineQueue = [];
        
        for (var i = 0; i < queue.length; i++) {
            var item = queue[i];
            try {
                if (window.FirebaseService) {
                    switch (item.type) {
                        case 'create':
                            await window.FirebaseService.createDocument(item.collection, item.data, item.docId);
                            break;
                        case 'update':
                            await window.FirebaseService.updateDocument(item.collection, item.docId, item.data);
                            break;
                        case 'delete':
                            await window.FirebaseService.deleteDocument(item.collection, item.docId);
                            break;
                    }
                }
            } catch (e) {
                log('error', 'Offline queue item failed:', e);
                state.offlineQueue.push(item);
            }
        }
        
        if (state.offlineQueue.length === 0) {
            log('log', 'Offline queue processed successfully');
            emit('offline:queueCleared', {});
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: ERROR LOGGING
    // -------------------------------------------------------------------------
    
    /**
     * Log an error
     * @param {string} message - Error description
     * @param {Error|string} [error] - Error object or message
     */
    function logError(message, error) {
        try {
            var errorEntry = {
                message: message,
                stack: error && error.stack ? error.stack : null,
                details: error && error.message ? error.message : String(error || ''),
                timestamp: new Date().toISOString(),
                page: state.currentPage || detectCurrentPage(),
                user: state.currentUser ? state.currentUser.uid : 'anonymous',
                online: state.online,
            };
            
            state.metrics.errors.push(errorEntry);
            
            // Keep only last 50 errors
            if (state.metrics.errors.length > 50) {
                state.metrics.errors = state.metrics.errors.slice(-50);
            }
            
            console.error('[AppCore] Error:', errorEntry);
            
            // Try to persist to Firestore (non-blocking)
            if (window.FirebaseService && state.isAuthenticated) {
                window.FirebaseService.createDocument('error_logs', errorEntry)
                    .catch(function() {
                        // Silent - don't want error logging to cause errors
                    });
            }
            
            emit('app:error', errorEntry);
        } catch (e) {
            // Last resort
            console.error('[AppCore] Error in logError:', e);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 10: UTILITY METHODS
    // -------------------------------------------------------------------------
    
    /**
     * Check if user has specific permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    function hasPermission(permission) {
        try {
            if (!state.isAuthenticated || !state.userProfile) return false;
            
            // Try RoutesConfig
            if (window.RoutesConfig && state.currentRouteId) {
                return window.RoutesConfig.canAccessRoute(state.currentRouteId, state.userProfile);
            }
            
            // Check profile permissions directly
            var permissions = state.userProfile.permissions || 
                            (state.userProfile.data && state.userProfile.data.permissions) || 
                            [];
            
            return permissions.indexOf(permission) !== -1 || 
                   permissions.indexOf('*') !== -1 || 
                   permissions.indexOf('all') !== -1;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean}
     */
    function hasRole(role) {
        try {
            if (!state.userProfile) return false;
            var userRole = state.userProfile.role || 
                          (state.userProfile.data && state.userProfile.data.role);
            return userRole === role;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Format currency in Indian format
     * @param {number} amount
     * @returns {string} Formatted currency
     */
    function formatCurrency(amount) {
        try {
            return '₹' + Number(amount || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            });
        } catch (e) {
            return '₹' + (amount || 0);
        }
    }
    
    /**
     * Format date in Indian format
     * @param {string|Date} date
     * @returns {string} Formatted date
     */
    function formatDate(date) {
        try {
            if (!date) return '';
            var d = new Date(date);
            if (isNaN(d.getTime())) return '';
            
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        } catch (e) {
            return String(date);
        }
    }
    
    /**
     * Get current screen information
     * @returns {Object} Screen dimensions
     */
    function getScreenInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: window.innerWidth < 768,
            isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
            isDesktop: window.innerWidth >= 1024,
        };
    }

    // -------------------------------------------------------------------------
    // SECTION 11: INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the application core
     * @returns {boolean} True if initialization started
     */
    function init() {
        try {
            log('log', 'Initializing AppCore v3.0.0...');
            
            // Detect current page
            state.currentPage = detectCurrentPage();
            state.currentRouteId = state.currentPage;
            log('log', 'Current page: ' + state.currentPage);
            
            // Initialize theme
            initTheme();
            
            // Setup global listeners
            setupGlobalListeners();
            
            // Setup offline support
            setupOfflineSupport();
            
            // Start auth monitoring (may be async)
            initAuth();
            
            log('log', 'AppCore initialized');
            return true;
        } catch (e) {
            log('error', 'AppCore initialization failed:', e);
            // Still mark as initialized
            state.initialized = true;
            emit('app:ready', { error: e.message });
            return false;
        }
    }
    
    /**
     * Destroy and cleanup
     */
    function destroy() {
        try {
            eventRegistry.clear();
            initQueue.length = 0;
            log('log', 'AppCore destroyed');
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 12: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface */
    const publicAPI = Object.freeze({
        // State (read-only via getters)
        get state() { return Object.assign({}, state); },
        get currentUser() { return state.currentUser; },
        get userProfile() { return state.userProfile; },
        get isAuthenticated() { return state.isAuthenticated; },
        get isInitialized() { return state.initialized; },
        get currentPage() { return state.currentPage; },
        get isOnline() { return state.online; },
        
        // Theme
        initTheme: initTheme,
        applyTheme: applyTheme,
        toggleDarkMode: toggleDarkMode,
        setTheme: setTheme,
        
        // Events
        on: on,
        off: off,
        emit: emit,
        once: once,
        whenReady: whenReady,
        
        // Utilities
        hasPermission: hasPermission,
        hasRole: hasRole,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        getScreenInfo: getScreenInfo,
        detectCurrentPage: detectCurrentPage,
        
        // Error handling
        logError: logError,
        
        // Lifecycle
        init: init,
        destroy: destroy,
    });
    
    return publicAPI;
    
})(); // End of AppCore IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            AppCore.init();
        });
    } else {
        AppCore.init();
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.App = AppCore; // Backward compatibility alias
    window.Global = window.Global || {};
    window.Global.AppCore = AppCore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppCore;
}

export {
    AppCore as default,
    AppCore,
};