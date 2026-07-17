/**
 * @fileoverview 11 Avatar SMEs CRM - Firebase Configuration & Service Layer
 * @description Enterprise-grade Firebase initialization with Firestore, Auth, Storage,
 *              Realtime Database, Functions, Analytics, Performance Monitoring,
 *              and Cloud Messaging. Full error handling, offline persistence,
 *              emulator support, and comprehensive CRUD service layer.
 *              Compatible with regular script tags (no ES modules required).
 * @module config/firebase
 * @version 3.0.1
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires firebase (CDN loaded globally via script tag)
 * @requires firebase-firestore-compat.js (for Firestore)
 * @requires firebase-auth-compat.js (for Authentication)
 * @requires firebase-storage-compat.js (for Storage)
 *
 * @exports window.FirebaseService - Global namespace for Firebase operations
 */

'use strict';

// =============================================================================
// FIREBASE CONFIGURATION MODULE - Self-executing IIFE
// =============================================================================
const FirebaseService = (function() {
    
    // -------------------------------------------------------------------------
    // SECTION 1: FIREBASE CONFIGURATION OBJECT
    // -------------------------------------------------------------------------
    
    /**
     * Firebase project configuration for avatar-wa-dual-crm
     * @constant {Object} firebaseConfig - Frozen configuration object
     * @property {string} apiKey - Public Firebase API key (restricted via Console)
     * @property {string} authDomain - Firebase Authentication domain
     * @property {string} projectId - Google Cloud/Firebase project identifier
     * @property {string} storageBucket - Cloud Storage bucket for file uploads
     * @property {string} messagingSenderId - Firebase Cloud Messaging sender ID
     * @property {string} appId - Firebase application unique identifier
     * @property {string} measurementId - Google Analytics measurement ID
     * @property {string} databaseURL - Realtime Database URL (asia-southeast1)
     */
    const firebaseConfig = Object.freeze({
        apiKey: 'AIzaSyBZDaHJSt-4AV6EJYG76p8kcsIHf6LOxdU',
        authDomain: 'avatar-wa-dual-crm.firebaseapp.com',
        projectId: 'avatar-wa-dual-crm',
        storageBucket: 'avatar-wa-dual-crm.appspot.com',
        messagingSenderId: '946959261009',
        appId: '1:946959261009:web:175f5390d63715f1f8c770',
        measurementId: 'G-XXXXXXXXXX',
        databaseURL: 'https://avatar-wa-dual-crm-default-rtdb.asia-southeast1.firebasedatabase.app',
    });

    // -------------------------------------------------------------------------
    // SECTION 2: SERVICE INSTANCE HOLDERS
    // -------------------------------------------------------------------------
    
    /** @type {firebase.app.App|null} Firebase App instance */
    let app = null;
    
    /** @type {firebase.firestore.Firestore|null} Firestore database instance */
    let db = null;
    
    /** @type {firebase.auth.Auth|null} Firebase Auth instance */
    let auth = null;
    
    /** @type {firebase.storage.Storage|null} Firebase Storage instance */
    let storage = null;
    
    /** @type {firebase.database.Database|null} Realtime Database instance */
    let rtdb = null;
    
    /** @type {firebase.functions.Functions|null} Cloud Functions instance */
    let functions = null;
    
    /** @type {firebase.analytics.Analytics|null} Google Analytics instance */
    let analytics = null;
    
    /** @type {firebase.performance.Performance|null} Performance Monitoring */
    let performance = null;
    
    /** @type {firebase.messaging.Messaging|null} Cloud Messaging instance */
    let messaging = null;
    
    /** @type {boolean} Flag indicating Firebase SDK script has loaded */
    let isSDKLoaded = false;
    
    /** @type {boolean} Flag indicating Firebase services are fully initialized */
    let isInitialized = false;
    
    /** @type {Array<Function>} Queue of operations to execute after initialization */
    const pendingOperations = [];
    
    /** @type {Map<string, Object>} In-memory document cache for fast reads */
    const documentCache = new Map();
    
    /** @type {number} Cache entry time-to-live in milliseconds (5 minutes) */
    const CACHE_TTL = 5 * 60 * 1000;
    
    // -------------------------------------------------------------------------
    // SECTION 3: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Check if Firebase SDK is available in the global scope
     * @returns {boolean} True if firebase SDK is loaded and ready
     */
    function isFirebaseSDKAvailable() {
        try {
            return typeof firebase !== 'undefined' && 
                   typeof firebase.initializeApp === 'function';
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Detect if running on localhost for emulator configuration
     * @returns {boolean} True if running on localhost
     */
    function isLocalhost() {
        try {
            var hostname = window.location.hostname;
            return hostname === 'localhost' || 
                   hostname === '127.0.0.1' ||
                   hostname.indexOf('.local') !== -1;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Log message with module prefix - only verbose in development
     * @param {string} level - Log level: 'log', 'warn', 'error', 'info'
     * @param {string} message - Human-readable log message
     * @param {*} [data] - Optional data payload to log
     */
    function logMessage(level, message, data) {
        try {
            var prefix = '[FirebaseService]';
            
            switch (level) {
                case 'error':
                    console.error(prefix, message, data || '');
                    break;
                case 'warn':
                    console.warn(prefix, message, data || '');
                    break;
                case 'info':
                    console.info(prefix, message, data || '');
                    break;
                default:
                    if (isLocalhost()) {
                        console.log(prefix, message, data || '');
                    }
                    break;
            }
        } catch (error) {
            // Silent fail - logging should never break the application
        }
    }
    
    /**
     * Process all pending operations that were queued before initialization
     */
    function processPendingOperations() {
        try {
            if (pendingOperations.length > 0) {
                logMessage('log', 'Processing ' + pendingOperations.length + ' pending operations');
                
                while (pendingOperations.length > 0) {
                    var operation = pendingOperations.shift();
                    if (operation && typeof operation === 'function') {
                        try {
                            operation();
                        } catch (error) {
                            logMessage('error', 'Error executing pending operation', error);
                        }
                    }
                }
            }
        } catch (error) {
            logMessage('error', 'Error processing pending operations', error);
        }
    }
    
    /**
     * Queue an operation to execute once Firebase finishes initializing
     * @param {Function} operation - Function to execute after initialization
     */
    function queueOperation(operation) {
        try {
            if (isInitialized) {
                operation();
            } else {
                pendingOperations.push(operation);
            }
        } catch (error) {
            logMessage('error', 'Error queueing operation', error);
        }
    }
    
    /**
     * Retrieve a cached document if still within TTL
     * @param {string} cacheKey - Cache key in format "collection:docId"
     * @returns {Object|null} Cached document data or null if expired/missing
     */
    function getCachedDocument(cacheKey) {
        try {
            var cached = documentCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                return cached.data;
            }
            documentCache.delete(cacheKey);
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Store a document in the in-memory cache
     * @param {string} cacheKey - Cache key in format "collection:docId"
     * @param {Object} data - Document data to cache
     */
    function setCachedDocument(cacheKey, data) {
        try {
            documentCache.set(cacheKey, {
                data: data,
                timestamp: Date.now(),
            });
            
            if (documentCache.size > 500) {
                var oldestKey = documentCache.keys().next().value;
                documentCache.delete(oldestKey);
            }
        } catch (error) {
            // Silent fail - caching is optional
        }
    }
    
    /**
     * Clear document cache - optionally filtered by collection
     * @param {string} [collection] - Optional collection name to clear, or all
     */
    function clearCache(collection) {
        try {
            if (collection) {
                var keysToDelete = [];
                documentCache.forEach(function(value, key) {
                    if (key.indexOf(collection + ':') === 0) {
                        keysToDelete.push(key);
                    }
                });
                keysToDelete.forEach(function(k) {
                    documentCache.delete(k);
                });
            } else {
                documentCache.clear();
            }
        } catch (error) {
            logMessage('error', 'Error clearing cache', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: FIREBASE INITIALIZATION FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the Firebase App instance
     * @returns {firebase.app.App|null} Firebase App instance or null on failure
     */
    function initializeApp() {
        try {
            if (!isFirebaseSDKAvailable()) {
                throw new Error('Firebase SDK not loaded. Ensure firebase-app-compat.js is included via script tag.');
            }
            
            isSDKLoaded = true;
            
            if (firebase.apps && firebase.apps.length > 0) {
                app = firebase.apps[0];
                logMessage('log', 'Using existing Firebase App instance');
            } else {
                app = firebase.initializeApp(firebaseConfig);
                logMessage('log', 'Firebase App initialized successfully');
            }
            
            return app;
        } catch (error) {
            logMessage('error', 'Firebase App initialization failed: ' + error.message);
            app = null;
            return null;
        }
    }
    
    /**
     * Initialize Firestore with offline persistence support
     * @returns {firebase.firestore.Firestore|null} Firestore instance or null
     */
    function initializeFirestore() {
        try {
            if (!app) {
                throw new Error('Firebase App must be initialized before Firestore');
            }
            
            if (typeof firebase.firestore !== 'function') {
                logMessage('warn', 'Firestore SDK not loaded - skipping');
                return null;
            }
            
            db = firebase.firestore();
            
            db.enablePersistence({ synchronizeTabs: true })
                .then(function() {
                    logMessage('log', 'Firestore offline persistence enabled');
                })
                .catch(function(error) {
                    if (error.code === 'failed-precondition') {
                        logMessage('warn', 'Firestore persistence failed - multiple tabs may be open');
                    } else if (error.code === 'unimplemented') {
                        logMessage('warn', 'Firestore persistence not supported in this browser');
                    } else {
                        logMessage('error', 'Firestore persistence error', error);
                    }
                });
            
            if (isLocalhost()) {
                try {
                    db.useEmulator('localhost', 8080);
                    logMessage('log', 'Firestore connected to local emulator on port 8080');
                } catch (emulatorError) {
                    logMessage('warn', 'Firestore emulator not available - using production');
                }
            }
            
            db.settings({
                ignoreUndefinedProperties: true,
                merge: true,
            });
            
            logMessage('log', 'Firestore initialized successfully');
            return db;
        } catch (error) {
            logMessage('error', 'Firestore initialization failed: ' + error.message);
            db = null;
            return null;
        }
    }
    
    /**
     * Initialize Firebase Authentication with session persistence
     * @returns {firebase.auth.Auth|null} Auth instance or null
     */
    function initializeAuth() {
        try {
            if (!app) {
                throw new Error('Firebase App must be initialized before Auth');
            }
            
            if (typeof firebase.auth !== 'function') {
                logMessage('warn', 'Auth SDK not loaded - skipping');
                return null;
            }
            
            auth = firebase.auth();
            
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(function() {
                    logMessage('log', 'Auth persistence set to LOCAL');
                })
                .catch(function(error) {
                    logMessage('error', 'Auth persistence setting failed', error);
                });
            
            if (isLocalhost()) {
                try {
                    auth.useEmulator('http://localhost:9099');
                    logMessage('log', 'Auth connected to local emulator on port 9099');
                } catch (emulatorError) {
                    logMessage('warn', 'Auth emulator not available - using production');
                }
            }
            
            auth.onAuthStateChanged(
                function(user) {
                    try {
                        if (user) {
                            logMessage('log', 'User signed in: ' + (user.email || user.uid));
                            
                            var sessionData = {
                                uid: user.uid,
                                email: user.email,
                                emailVerified: user.emailVerified,
                                displayName: user.displayName,
                                phoneNumber: user.phoneNumber,
                                photoURL: user.photoURL,
                                providerId: (user.providerData && user.providerData[0]) ? user.providerData[0].providerId : 'password',
                                lastLogin: new Date().toISOString(),
                                tenantId: user.tenantId || null,
                            };
                            
                            localStorage.setItem('auth_user', JSON.stringify(sessionData));
                            sessionStorage.setItem('auth_session_active', 'true');
                            
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('firebase:userSignedIn', {
                                    detail: { user: sessionData },
                                }));
                            }
                        } else {
                            logMessage('log', 'User signed out');
                            
                            localStorage.removeItem('auth_user');
                            sessionStorage.removeItem('auth_session_active');
                            clearCache();
                            
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('firebase:userSignedOut'));
                            }
                        }
                    } catch (observerError) {
                        logMessage('error', 'Auth state observer error', observerError);
                    }
                },
                function(error) {
                    logMessage('error', 'Auth state observer failed', error);
                }
            );
            
            logMessage('log', 'Auth initialized successfully');
            return auth;
        } catch (error) {
            logMessage('error', 'Auth initialization failed: ' + error.message);
            auth = null;
            return null;
        }
    }
    
    /**
     * Initialize Firebase Storage for file uploads
     * @returns {firebase.storage.Storage|null} Storage instance or null
     */
    function initializeStorage() {
        try {
            if (!app) {
                throw new Error('Firebase App must be initialized before Storage');
            }
            
            if (typeof firebase.storage !== 'function') {
                logMessage('warn', 'Storage SDK not loaded - skipping');
                return null;
            }
            
            storage = firebase.storage();
            
            if (isLocalhost()) {
                try {
                    storage.useEmulator('localhost', 9199);
                    logMessage('log', 'Storage connected to local emulator on port 9199');
                } catch (emulatorError) {
                    logMessage('warn', 'Storage emulator not available - using production');
                }
            }
            
            logMessage('log', 'Storage initialized successfully');
            return storage;
        } catch (error) {
            logMessage('error', 'Storage initialization failed: ' + error.message);
            storage = null;
            return null;
        }
    }
    
    /**
     * Initialize Realtime Database (optional)
     * @returns {firebase.database.Database|null} RTDB instance or null
     */
    function initializeRTDB() {
        try {
            if (!app) {
                throw new Error('Firebase App must be initialized before RTDB');
            }
            
            if (typeof firebase.database !== 'function') {
                logMessage('warn', 'RTDB SDK not loaded - skipping');
                return null;
            }
            
            rtdb = firebase.database();
            
            if (isLocalhost()) {
                try {
                    rtdb.useEmulator('localhost', 9000);
                    logMessage('log', 'RTDB connected to local emulator on port 9000');
                } catch (emulatorError) {
                    logMessage('warn', 'RTDB emulator not available - using production');
                }
            }
            
            logMessage('log', 'Realtime Database initialized');
            return rtdb;
        } catch (error) {
            logMessage('warn', 'RTDB initialization failed (non-critical): ' + error.message);
            rtdb = null;
            return null;
        }
    }
    
    /**
     * Initialize Cloud Functions (optional)
     * @returns {firebase.functions.Functions|null} Functions instance or null
     */
    function initializeFunctions() {
        try {
            if (!app) {
                throw new Error('Firebase App must be initialized before Functions');
            }
            
            if (typeof firebase.functions !== 'function') {
                logMessage('warn', 'Functions SDK not loaded - skipping');
                return null;
            }
            
            functions = firebase.functions();
            functions.region = 'asia-south1';
            
            if (isLocalhost()) {
                try {
                    functions.useEmulator('localhost', 5001);
                    logMessage('log', 'Functions connected to local emulator on port 5001');
                } catch (emulatorError) {
                    logMessage('warn', 'Functions emulator not available - using production');
                }
            }
            
            logMessage('log', 'Cloud Functions initialized');
            return functions;
        } catch (error) {
            logMessage('warn', 'Functions initialization failed (non-critical): ' + error.message);
            functions = null;
            return null;
        }
    }
    
    /**
     * Initialize Google Analytics (optional)
     * @returns {firebase.analytics.Analytics|null} Analytics instance or null
     */
    function initializeAnalytics() {
        try {
            if (!app) {
                logMessage('warn', 'App not initialized - skipping Analytics');
                return null;
            }
            
            if (typeof firebase.analytics !== 'function') {
                logMessage('warn', 'Analytics SDK not loaded - skipping');
                return null;
            }
            
            analytics = firebase.analytics();
            analytics.setAnalyticsCollectionEnabled(true);
            
            logMessage('log', 'Analytics initialized');
            return analytics;
        } catch (error) {
            logMessage('warn', 'Analytics init failed (non-critical): ' + error.message);
            analytics = null;
            return null;
        }
    }
    
    /**
     * Initialize Performance Monitoring (optional)
     * @returns {firebase.performance.Performance|null} Performance instance or null
     */
    function initializePerformance() {
        try {
            if (!app) {
                return null;
            }
            
            if (typeof firebase.performance !== 'function') {
                logMessage('warn', 'Performance SDK not loaded - skipping');
                return null;
            }
            
            performance = firebase.performance();
            performance.instrumentationEnabled = true;
            performance.dataCollectionEnabled = true;
            
            logMessage('log', 'Performance monitoring initialized');
            return performance;
        } catch (error) {
            logMessage('warn', 'Performance init failed (non-critical): ' + error.message);
            performance = null;
            return null;
        }
    }
    
    /**
     * Initialize Cloud Messaging (optional)
     * @returns {firebase.messaging.Messaging|null} Messaging instance or null
     */
    function initializeMessaging() {
        try {
            if (!app) {
                return null;
            }
            
            if (typeof firebase.messaging !== 'function') {
                logMessage('warn', 'Messaging SDK not loaded - skipping');
                return null;
            }
            
            messaging = firebase.messaging();
            
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(function(permission) {
                    if (permission === 'granted') {
                        logMessage('log', 'Notification permission granted');
                    }
                });
            }
            
            logMessage('log', 'Cloud Messaging initialized');
            return messaging;
        } catch (error) {
            logMessage('warn', 'Messaging init failed (non-critical): ' + error.message);
            messaging = null;
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: MASTER INITIALIZATION SEQUENCE
    // -------------------------------------------------------------------------
    
    /**
     * Initialize all Firebase services in the correct order
     * Core services (Firestore, Auth, Storage) are initialized in parallel.
     * Optional services (RTDB, Functions, Analytics, Performance, Messaging)
     * are initialized non-blocking - failures are logged but don't break the app.
     * @returns {Promise<Object>} Service snapshot after initialization
     */
    async function initializeAll() {
        try {
            logMessage('log', 'Starting Firebase initialization sequence...');
            
            // Step 1: Initialize App (required first step)
            var appInstance = initializeApp();
            if (!appInstance) {
                throw new Error('Critical: Firebase App failed to initialize');
            }
            
            // Step 2: Initialize core services in parallel
            var results = await Promise.allSettled([
                Promise.resolve(initializeFirestore()),
                Promise.resolve(initializeAuth()),
                Promise.resolve(initializeStorage()),
            ]);
            
            var firestoreOk = results[0].status === 'fulfilled';
            var authOk = results[1].status === 'fulfilled';
            var storageOk = results[2].status === 'fulfilled';
            
            if (!firestoreOk) logMessage('error', 'Firestore init failed', results[0].reason);
            if (!authOk) logMessage('error', 'Auth init failed', results[1].reason);
            if (!storageOk) logMessage('error', 'Storage init failed', results[2].reason);
            
            // Step 3: Initialize optional services (non-blocking - errors are logged but ignored)
            try { initializeRTDB(); } catch (e) { logMessage('warn', 'RTDB init skipped: ' + e.message); }
            try { initializeFunctions(); } catch (e) { logMessage('warn', 'Functions init skipped: ' + e.message); }
            try { initializeAnalytics(); } catch (e) { logMessage('warn', 'Analytics init skipped: ' + e.message); }
            try { initializePerformance(); } catch (e) { logMessage('warn', 'Performance init skipped: ' + e.message); }
            try { initializeMessaging(); } catch (e) { logMessage('warn', 'Messaging init skipped: ' + e.message); }
            
            // Mark as initialized
            isInitialized = true;
            
            // Process any operations that were queued during initialization
            processPendingOperations();
            
            logMessage('log', 'Firebase initialization complete');
            
            // Notify application that Firebase is ready
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('firebase:initialized', {
                    detail: { 
                        success: true, 
                        services: { 
                            app: !!app, 
                            db: !!db, 
                            auth: !!auth, 
                            storage: !!storage 
                        } 
                    },
                }));
            }
            
            return getServiceSnapshot();
        } catch (error) {
            logMessage('error', 'Firebase initialization sequence failed', error);
            
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('firebase:initialized', {
                    detail: { success: false, error: error.message },
                }));
            }
            
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: CRUD SERVICE METHODS
    // -------------------------------------------------------------------------
    
    /**
     * Get the currently authenticated Firebase user
     * @returns {firebase.User|null} Current user object or null if not signed in
     */
    function getCurrentUser() {
        try {
            return auth ? auth.currentUser : null;
        } catch (error) {
            logMessage('error', 'Error getting current user', error);
            return null;
        }
    }
    
    /**
     * Sign out the current user and clear cache
     * @returns {Promise<void>} Resolves when sign-out is complete
     */
    async function signOut() {
        try {
            if (auth) {
                await auth.signOut();
                clearCache();
                logMessage('log', 'User signed out successfully');
            }
        } catch (error) {
            logMessage('error', 'Sign out failed', error);
            throw error;
        }
    }
    
    /**
     * Create a new document in a Firestore collection
     * @param {string} collection - Collection name (e.g., 'users', 'leads')
     * @param {Object} data - Document data to store
     * @param {string} [docId] - Optional custom document ID (auto-generated if omitted)
     * @returns {Promise<Object>} Created document with ID and data
     */
    async function createDocument(collection, data, docId) {
        try {
            if (!db) throw new Error('Firestore is not available. Ensure firebase-firestore-compat.js is loaded.');
            if (!collection || typeof collection !== 'string') throw new Error('Invalid collection name');
            if (!data || typeof data !== 'object') throw new Error('Invalid document data');
            
            var enrichedData = Object.assign({}, data, {
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUser() ? getCurrentUser().uid : 'system',
                updatedBy: getCurrentUser() ? getCurrentUser().uid : 'system',
            });
            
            var docRef;
            if (docId) {
                docRef = db.collection(collection).doc(docId);
                await docRef.set(enrichedData);
            } else {
                docRef = await db.collection(collection).add(enrichedData);
            }
            
            var result = Object.assign({ id: docRef.id }, enrichedData);
            setCachedDocument(collection + ':' + docRef.id, result);
            
            logMessage('log', 'Document created: ' + collection + '/' + docRef.id);
            return result;
        } catch (error) {
            logMessage('error', 'Error creating document in ' + collection, error);
            throw error;
        }
    }
    
    /**
     * Get a document by its ID from a Firestore collection
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID to retrieve
     * @returns {Promise<Object|null>} Document data or null if not found
     */
    async function getDocument(collection, docId) {
        try {
            if (!db) throw new Error('Firestore is not available');
            if (!collection || !docId) throw new Error('Collection and document ID are required');
            
            var cacheKey = collection + ':' + docId;
            var cached = getCachedDocument(cacheKey);
            if (cached) return cached;
            
            var doc = await db.collection(collection).doc(docId).get();
            if (!doc.exists) return null;
            
            var result = Object.assign({ id: doc.id }, doc.data());
            setCachedDocument(cacheKey, result);
            
            return result;
        } catch (error) {
            logMessage('error', 'Error getting document ' + collection + '/' + docId, error);
            throw error;
        }
    }
    
    /**
     * Update fields in an existing Firestore document
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID to update
     * @param {Object} data - Fields to update (merged with existing data)
     * @returns {Promise<Object>} Updated document data
     */
    async function updateDocument(collection, docId, data) {
        try {
            if (!db) throw new Error('Firestore is not available');
            if (!collection || !docId) throw new Error('Collection and document ID are required');
            if (!data || typeof data !== 'object') throw new Error('Invalid update data');
            
            var updateData = Object.assign({}, data, {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: getCurrentUser() ? getCurrentUser().uid : 'system',
            });
            
            await db.collection(collection).doc(docId).update(updateData);
            clearCache(collection);
            
            logMessage('log', 'Document updated: ' + collection + '/' + docId);
            return await getDocument(collection, docId);
        } catch (error) {
            logMessage('error', 'Error updating document ' + collection + '/' + docId, error);
            throw error;
        }
    }
    
    /**
     * Delete a document from a Firestore collection
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID to delete
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async function deleteDocument(collection, docId) {
        try {
            if (!db) throw new Error('Firestore is not available');
            if (!collection || !docId) throw new Error('Collection and document ID are required');
            
            await db.collection(collection).doc(docId).delete();
            clearCache(collection);
            
            logMessage('log', 'Document deleted: ' + collection + '/' + docId);
            return true;
        } catch (error) {
            logMessage('error', 'Error deleting document ' + collection + '/' + docId, error);
            throw error;
        }
    }
    
    /**
     * Query documents from a Firestore collection with filters and sorting
     * @param {string} collection - Collection name to query
     * @param {Array<Array>} [conditions] - Array of [field, operator, value] conditions
     * @param {Object} [options] - Query options (orderBy, orderDir, limit)
     * @returns {Promise<Array<Object>>} Array of matching documents
     */
    async function queryDocuments(collection, conditions, options) {
        try {
            if (!db) throw new Error('Firestore is not available');
            if (!collection) throw new Error('Collection name is required');
            
            var query = db.collection(collection);
            
            if (conditions && conditions.length > 0) {
                conditions.forEach(function(cond) {
                    if (Array.isArray(cond) && cond.length === 3) {
                        query = query.where(cond[0], cond[1], cond[2]);
                    }
                });
            }
            
            if (options && options.orderBy) {
                query = query.orderBy(options.orderBy, options.orderDir || 'desc');
            }
            
            if (options && options.limit && options.limit > 0) {
                query = query.limit(Math.min(options.limit, 500));
            }
            
            var snapshot = await query.get();
            
            var results = snapshot.docs.map(function(doc) {
                var docData = doc.data();
                return Object.assign({ id: doc.id }, docData);
            });
            
            results.forEach(function(doc) {
                setCachedDocument(collection + ':' + doc.id, doc);
            });
            
            return results;
        } catch (error) {
            logMessage('error', 'Error querying ' + collection, error);
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: SERVICE STATUS & DIAGNOSTICS
    // -------------------------------------------------------------------------
    
    /**
     * Get a snapshot of all service instances and their status
     * @returns {Object} Complete service status object
     */
    function getServiceSnapshot() {
        return {
            app: app,
            db: db,
            auth: auth,
            storage: storage,
            config: firebaseConfig,
            isSDKLoaded: isSDKLoaded,
            isInitialized: isInitialized,
            cacheSize: documentCache.size,
        };
    }
    
    /**
     * Check if all critical services are ready for use
     * @returns {boolean} True if app, db, auth, and storage are all initialized
     */
    function isServiceReady() {
        return isInitialized && !!app && !!db && !!auth && !!storage;
    }
    
    /**
     * Wait for Firebase to complete initialization
     * @param {number} [timeout] - Maximum wait time in milliseconds (default 10000)
     * @returns {Promise<Object>} Resolves with service snapshot when ready
     */
    function waitForInit(timeout) {
        var maxWait = timeout || 10000;
        
        return new Promise(function(resolve, reject) {
            if (isInitialized) {
                resolve(getServiceSnapshot());
                return;
            }
            
            var timeoutId = setTimeout(function() {
                window.removeEventListener('firebase:initialized', handler);
                reject(new Error('Firebase initialization timeout after ' + maxWait + 'ms'));
            }, maxWait);
            
            var handler = function(event) {
                clearTimeout(timeoutId);
                if (event.detail && event.detail.success) {
                    resolve(getServiceSnapshot());
                } else {
                    reject(new Error(event.detail ? event.detail.error : 'Initialization failed'));
                }
            };
            
            window.addEventListener('firebase:initialized', handler, { once: true });
        });
    }

    // -------------------------------------------------------------------------
    // SECTION 8: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Frozen public API for FirebaseService */
    const publicAPI = Object.freeze({
        config: firebaseConfig,
        get app() { return app; },
        get db() { return db; },
        get auth() { return auth; },
        get storage() { return storage; },
        isInitialized: function() { return isInitialized; },
        isSDKLoaded: function() { return isSDKLoaded; },
        isServiceReady: isServiceReady,
        getServiceSnapshot: getServiceSnapshot,
        waitForInit: waitForInit,
        initializeAll: initializeAll,
        getCurrentUser: getCurrentUser,
        signOut: signOut,
        createDocument: createDocument,
        getDocument: getDocument,
        updateDocument: updateDocument,
        deleteDocument: deleteDocument,
        queryDocuments: queryDocuments,
        clearCache: clearCache,
        getCachedDocument: getCachedDocument,
        queueOperation: queueOperation,
    });
    
    return publicAPI;
    
})(); // End of FirebaseService IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            FirebaseService.initializeAll().catch(function(error) {
                console.error('[FirebaseService] Auto-initialization failed:', error);
            });
        });
    } else {
        FirebaseService.initializeAll().catch(function(error) {
            console.error('[FirebaseService] Auto-initialization failed:', error);
        });
    }
}

// =============================================================================
// EXPORTS - Global namespace ONLY (no ES module export)
// =============================================================================

if (typeof window !== 'undefined') {
    window.FirebaseService = FirebaseService;
    window.Global = window.Global || {};
    window.Global.FirebaseService = FirebaseService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseService;
}