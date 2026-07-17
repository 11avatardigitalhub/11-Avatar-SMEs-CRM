/**
 * @fileoverview 11 Avatar SMEs CRM - Firebase Configuration & Service Layer
 * @description Enterprise-grade Firebase initialization with Firestore, Auth, Storage,
 *              Realtime Database, Functions, Analytics, and Performance Monitoring.
 *              Full error handling, offline persistence, emulator support, and
 *              comprehensive CRUD service layer with batch operations.
 * @module config/firebase
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires firebase (CDN loaded globally or ES module import)
 * @requires Constants module for configuration values
 * @exports window.FirebaseService - Global namespace
 * @exports FirebaseService - ES Module export
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
     * @constant {Object} firebaseConfig
     * @property {string} apiKey - Firebase API key (public, restricted via Console)
     * @property {string} authDomain - Firebase Auth domain
     * @property {string} projectId - GCP/Firebase project identifier
     * @property {string} storageBucket - Cloud Storage bucket
     * @property {string} messagingSenderId - FCM sender ID
     * @property {string} appId - Firebase application ID
     * @property {string} measurementId - Google Analytics measurement ID
     * @property {string} databaseURL - Realtime Database URL
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
    
    /** @type {boolean} Flag indicating Firebase SDK is loaded */
    let isSDKLoaded = false;
    
    /** @type {boolean} Flag indicating Firebase is fully initialized */
    let isInitialized = false;
    
    /** @type {Array<Function>} Queue of pending operations before init completes */
    const pendingOperations = [];
    
    /** @type {Object} In-memory cache for frequently accessed documents */
    const documentCache = new Map();
    
    /** @type {number} Cache time-to-live in milliseconds */
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    // -------------------------------------------------------------------------
    // SECTION 3: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Check if Firebase SDK is available in the global scope
     * @returns {boolean} True if firebase SDK is loaded
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
     * Get environment detection for emulator usage
     * @returns {boolean} True if running on localhost
     */
    function isLocalhost() {
        try {
            return window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.includes('.local');
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Log message with timestamp and module prefix
     * @param {string} level - Log level: 'log', 'warn', 'error', 'info'
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     */
    function logMessage(level, message, data) {
        try {
            const timestamp = new Date().toISOString();
            const prefix = '[FirebaseService]';
            
            switch (level) {
                case 'error':
                    console.error(`${prefix} ${message}`, data || '');
                    break;
                case 'warn':
                    console.warn(`${prefix} ${message}`, data || '');
                    break;
                case 'info':
                    console.info(`${prefix} ${message}`, data || '');
                    break;
                default:
                    if (isLocalhost()) {
                        console.log(`${prefix} ${message}`, data || '');
                    }
                    break;
            }
        } catch (error) {
            // Silent fail - logging should never break the application
        }
    }
    
    /**
     * Process pending operations queue after initialization
     */
    function processPendingOperations() {
        try {
            if (pendingOperations.length > 0) {
                logMessage('log', `Processing ${pendingOperations.length} pending operations`);
                
                while (pendingOperations.length > 0) {
                    const operation = pendingOperations.shift();
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
     * Queue an operation to execute after Firebase initializes
     * @param {Function} operation - Function to execute after init
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
     * Get cached document if still valid
     * @param {string} cacheKey - Cache key (collection:docId)
     * @returns {Object|null} Cached document or null
     */
    function getCachedDocument(cacheKey) {
        try {
            const cached = documentCache.get(cacheKey);
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
     * Set document in cache
     * @param {string} cacheKey - Cache key (collection:docId)
     * @param {Object} data - Document data to cache
     */
    function setCachedDocument(cacheKey, data) {
        try {
            documentCache.set(cacheKey, {
                data: data,
                timestamp: Date.now(),
            });
            
            // Limit cache size to prevent memory issues
            if (documentCache.size > 500) {
                const oldestKey = documentCache.keys().next().value;
                documentCache.delete(oldestKey);
            }
        } catch (error) {
            // Silent fail - caching is optional
        }
    }
    
    /**
     * Clear document cache
     * @param {string} [collection] - Optional collection to clear, or all
     */
    function clearCache(collection) {
        try {
            if (collection) {
                const keysToDelete = [];
                documentCache.forEach((value, key) => {
                    if (key.startsWith(collection + ':')) {
                        keysToDelete.push(key);
                    }
                });
                keysToDelete.forEach(key => documentCache.delete(key));
            } else {
                documentCache.clear();
            }
        } catch (error) {
            logMessage('error', 'Error clearing cache', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: FIREBASE INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize Firebase App
     * @returns {firebase.app.App|null} Firebase App instance or null on failure
     */
    function initializeApp() {
        try {
            if (!isFirebaseSDKAvailable()) {
                throw new Error('Firebase SDK not loaded. Ensure firebase-app.js is included.');
            }
            
            isSDKLoaded = true;
            
            // Check if app is already initialized
            if (firebase.apps && firebase.apps.length > 0) {
                app = firebase.apps[0];
                logMessage('log', 'Using existing Firebase App instance');
            } else {
                app = firebase.initializeApp(firebaseConfig);
                logMessage('log', 'Firebase App initialized successfully');
            }
            
            return app;
        } catch (error) {
            logMessage('error', 'Firebase App initialization failed', error.message);
            app = null;
            return null;
        }
    }
    
    /**
     * Initialize Firestore with offline persistence
     * @returns {firebase.firestore.Firestore|null} Firestore instance or null
     */
    function initializeFirestore() {
        try {
            if (!app) {
                throw new Error('Firebase App not initialized');
            }
            
            if (typeof firebase.firestore !== 'function') {
                throw new Error('Firestore SDK not loaded. Include firebase-firestore.js');
            }
            
            db = firebase.firestore();
            
            // Enable offline persistence
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => {
                    logMessage('log', 'Firestore offline persistence enabled');
                })
                .catch((error) => {
                    if (error.code === 'failed-precondition') {
                        logMessage('warn', 'Firestore persistence failed - multiple tabs open');
                    } else if (error.code === 'unimplemented') {
                        logMessage('warn', 'Firestore persistence not supported in this browser');
                    } else {
                        logMessage('error', 'Firestore persistence error', error);
                    }
                });
            
            // Connect to Firestore emulator in development
            if (isLocalhost()) {
                try {
                    db.useEmulator('localhost', 8080);
                    logMessage('log', 'Firestore connected to local emulator');
                } catch (emulatorError) {
                    logMessage('warn', 'Firestore emulator not available, using production');
                }
            }
            
            // Firestore settings
            db.settings({
                ignoreUndefinedProperties: true,
                merge: true,
            });
            
            logMessage('log', 'Firestore initialized successfully');
            return db;
        } catch (error) {
            logMessage('error', 'Firestore initialization failed', error.message);
            db = null;
            return null;
        }
    }
    
    /**
     * Initialize Firebase Auth with persistence
     * @returns {firebase.auth.Auth|null} Auth instance or null
     */
    function initializeAuth() {
        try {
            if (!app) {
                throw new Error('Firebase App not initialized');
            }
            
            if (typeof firebase.auth !== 'function') {
                throw new Error('Firebase Auth SDK not loaded. Include firebase-auth.js');
            }
            
            auth = firebase.auth();
            
            // Set persistence to LOCAL (survives browser restarts)
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    logMessage('log', 'Auth persistence set to LOCAL');
                })
                .catch((error) => {
                    logMessage('error', 'Auth persistence setting failed', error);
                });
            
            // Connect to Auth emulator in development
            if (isLocalhost()) {
                try {
                    auth.useEmulator('http://localhost:9099');
                    logMessage('log', 'Auth connected to local emulator');
                } catch (emulatorError) {
                    logMessage('warn', 'Auth emulator not available, using production');
                }
            }
            
            // Auth state observer for session management
            auth.onAuthStateChanged(
                function(user) {
                    try {
                        if (user) {
                            logMessage('log', `User signed in: ${user.email || user.uid}`);
                            
                            // Store user session info locally
                            const sessionData = {
                                uid: user.uid,
                                email: user.email,
                                emailVerified: user.emailVerified,
                                displayName: user.displayName,
                                phoneNumber: user.phoneNumber,
                                photoURL: user.photoURL,
                                providerId: user.providerData[0]?.providerId || 'password',
                                lastLogin: new Date().toISOString(),
                                tenantId: user.tenantId || null,
                            };
                            
                            localStorage.setItem('auth_user', JSON.stringify(sessionData));
                            sessionStorage.setItem('auth_session_active', 'true');
                            
                            // Dispatch custom event for other modules
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('firebase:userSignedIn', {
                                    detail: { user: sessionData },
                                }));
                            }
                        } else {
                            logMessage('log', 'User signed out');
                            
                            // Clear session data
                            localStorage.removeItem('auth_user');
                            sessionStorage.removeItem('auth_session_active');
                            clearCache(); // Clear all cached data on sign out
                            
                            // Dispatch custom event
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
            
            // Token refresh listener
            auth.onIdTokenChanged(function(user) {
                if (user) {
                    user.getIdTokenResult()
                        .then((idTokenResult) => {
                            // Store token expiration info
                            const expirationTime = new Date(idTokenResult.expirationTime).getTime();
                            localStorage.setItem('auth_token_expiry', expirationTime.toString());
                            
                            // Refresh token 5 minutes before expiry
                            const refreshTime = expirationTime - (5 * 60 * 1000);
                            setTimeout(() => {
                                if (auth.currentUser) {
                                    auth.currentUser.getIdToken(true)
                                        .then(() => logMessage('log', 'Token refreshed proactively'))
                                        .catch((err) => logMessage('warn', 'Token refresh failed', err));
                                }
                            }, Math.max(0, refreshTime - Date.now()));
                        })
                        .catch((error) => {
                            logMessage('error', 'Token result error', error);
                        });
                }
            });
            
            logMessage('log', 'Auth initialized successfully');
            return auth;
        } catch (error) {
            logMessage('error', 'Auth initialization failed', error.message);
            auth = null;
            return null;
        }
    }
    
    /**
     * Initialize Firebase Storage
     * @returns {firebase.storage.Storage|null} Storage instance or null
     */
    function initializeStorage() {
        try {
            if (!app) {
                throw new Error('Firebase App not initialized');
            }
            
            if (typeof firebase.storage !== 'function') {
                throw new Error('Storage SDK not loaded. Include firebase-storage.js');
            }
            
            storage = firebase.storage();
            
            // Connect to Storage emulator in development
            if (isLocalhost()) {
                try {
                    storage.useEmulator('localhost', 9199);
                    logMessage('log', 'Storage connected to local emulator');
                } catch (emulatorError) {
                    logMessage('warn', 'Storage emulator not available, using production');
                }
            }
            
            // Set max upload size warning
            storage.setMaxUploadRetryTime(30000); // 30 seconds
            storage.setMaxOperationRetryTime(120000); // 2 minutes
            
            logMessage('log', 'Storage initialized successfully');
            return storage;
        } catch (error) {
            logMessage('error', 'Storage initialization failed', error.message);
            storage = null;
            return null;
        }
    }
    
    /**
     * Initialize Realtime Database
     * @returns {firebase.database.Database|null} RTDB instance or null
     */
    function initializeRTDB() {
        try {
            if (!app) {
                throw new Error('Firebase App not initialized');
            }
            
            if (typeof firebase.database !== 'function') {
                logMessage('warn', 'RTDB SDK not loaded - skipping');
                return null;
            }
            
            rtdb = firebase.database();
            
            if (isLocalhost()) {
                try {
                    rtdb.useEmulator('localhost', 9000);
                    logMessage('log', 'RTDB connected to local emulator');
                } catch (emulatorError) {
                    logMessage('warn', 'RTDB emulator not available');
                }
            }
            
            logMessage('log', 'Realtime Database initialized');
            return rtdb;
        } catch (error) {
            logMessage('warn', 'RTDB initialization failed (non-critical)', error.message);
            rtdb = null;
            return null;
        }
    }
    
    /**
     * Initialize Cloud Functions
     * @returns {firebase.functions.Functions|null} Functions instance or null
     */
    function initializeFunctions() {
        try {
            if (!app) {
                throw new Error('Firebase App not initialized');
            }
            
            if (typeof firebase.functions !== 'function') {
                logMessage('warn', 'Functions SDK not loaded - skipping');
                return null;
            }
            
            functions = firebase.functions();
            functions.region = 'asia-south1'; // Mumbai region
            
            if (isLocalhost()) {
                try {
                    functions.useEmulator('localhost', 5001);
                    logMessage('log', 'Functions connected to local emulator');
                } catch (emulatorError) {
                    logMessage('warn', 'Functions emulator not available');
                }
            }
            
            logMessage('log', 'Cloud Functions initialized');
            return functions;
        } catch (error) {
            logMessage('warn', 'Functions initialization failed (non-critical)', error.message);
            functions = null;
            return null;
        }
    }
    
    /**
     * Initialize Analytics
     * @returns {firebase.analytics.Analytics|null} Analytics instance or null
     */
    function initializeAnalytics() {
        try {
            if (!app) return null;
            if (typeof firebase.analytics !== 'function') return null;
            
            analytics = firebase.analytics();
            analytics.setAnalyticsCollectionEnabled(true);
            
            logMessage('log', 'Analytics initialized');
            return analytics;
        } catch (error) {
            logMessage('warn', 'Analytics initialization failed (non-critical)', error.message);
            analytics = null;
            return null;
        }
    }
    
    /**
     * Initialize Performance Monitoring
     * @returns {firebase.performance.Performance|null} Performance instance or null
     */
    function initializePerformance() {
        try {
            if (!app) return null;
            if (typeof firebase.performance !== 'function') return null;
            
            performance = firebase.performance();
            performance.instrumentationEnabled = true;
            performance.dataCollectionEnabled = true;
            
            logMessage('log', 'Performance monitoring initialized');
            return performance;
        } catch (error) {
            logMessage('warn', 'Performance init failed (non-critical)', error.message);
            performance = null;
            return null;
        }
    }
    
    /**
     * Initialize Cloud Messaging
     * @returns {firebase.messaging.Messaging|null} Messaging instance or null
     */
    function initializeMessaging() {
        try {
            if (!app) return null;
            if (typeof firebase.messaging !== 'function') return null;
            
            messaging = firebase.messaging();
            
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then((permission) => {
                    if (permission === 'granted') {
                        logMessage('log', 'Notification permission granted');
                    }
                });
            }
            
            // Foreground message handler
            messaging.onMessage((payload) => {
                logMessage('log', 'Foreground message received', payload);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('firebase:messageReceived', {
                        detail: payload,
                    }));
                }
            });
            
            logMessage('log', 'Cloud Messaging initialized');
            return messaging;
        } catch (error) {
            logMessage('warn', 'Messaging init failed (non-critical)', error.message);
            messaging = null;
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: MASTER INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize all Firebase services in order
     * @returns {Promise<Object>} Object containing all initialized services
     */
    async function initializeAll() {
        try {
            logMessage('log', 'Starting Firebase initialization sequence...');
            
            // Step 1: Initialize App (required)
            const appInstance = initializeApp();
            if (!appInstance) {
                throw new Error('Critical: Firebase App failed to initialize');
            }
            
            // Step 2: Initialize core services in parallel
            const results = await Promise.allSettled([
                Promise.resolve(initializeFirestore()),
                Promise.resolve(initializeAuth()),
                Promise.resolve(initializeStorage()),
            ]);
            
            const [firestoreResult, authResult, storageResult] = results;
            
            if (firestoreResult.status === 'rejected') {
                logMessage('error', 'Firestore init rejected', firestoreResult.reason);
            }
            if (authResult.status === 'rejected') {
                logMessage('error', 'Auth init rejected', authResult.reason);
            }
            if (storageResult.status === 'rejected') {
                logMessage('error', 'Storage init rejected', storageResult.reason);
            }
            
            // Step 3: Initialize optional services (non-blocking)
            initializeRTDB();
            initializeFunctions();
            initializeAnalytics();
            initializePerformance();
            initializeMessaging();
            
            isInitialized = true;
            
            // Process any operations queued during initialization
            processPendingOperations();
            
            logMessage('log', 'Firebase initialization complete', {
                app: !!app,
                db: !!db,
                auth: !!auth,
                storage: !!storage,
                rtdb: !!rtdb,
                functions: !!functions,
                analytics: !!analytics,
                performance: !!performance,
                messaging: !!messaging,
            });
            
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('firebase:initialized', {
                    detail: { success: true, services: { app: !!app, db: !!db, auth: !!auth, storage: !!storage } },
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
     * Get current authenticated user
     * @returns {firebase.User|null} Current user or null
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
     * Get current user's ID token
     * @param {boolean} [forceRefresh=false] - Force token refresh
     * @returns {Promise<string|null>} ID token or null
     */
    async function getIdToken(forceRefresh = false) {
        try {
            const user = getCurrentUser();
            if (!user) return null;
            return await user.getIdToken(forceRefresh);
        } catch (error) {
            logMessage('error', 'Error getting ID token', error);
            return null;
        }
    }
    
    /**
     * Sign out current user
     * @returns {Promise<void>}
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
     * Create a document in Firestore
     * @param {string} collection - Collection name
     * @param {Object} data - Document data
     * @param {string} [docId] - Optional document ID (auto-generated if omitted)
     * @returns {Promise<Object>} Created document with ID
     */
    async function createDocument(collection, data, docId) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!collection || typeof collection !== 'string') {
                throw new Error('Invalid collection name');
            }
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid document data');
            }
            
            const enrichedData = {
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUser()?.uid || 'system',
                updatedBy: getCurrentUser()?.uid || 'system',
                _version: 1,
            };
            
            let docRef;
            if (docId) {
                docRef = db.collection(collection).doc(docId);
                await docRef.set(enrichedData, { merge: false });
            } else {
                docRef = await db.collection(collection).add(enrichedData);
            }
            
            const result = { id: docRef.id, ...enrichedData };
            
            // Cache the newly created document
            setCachedDocument(`${collection}:${docRef.id}`, result);
            
            // Remove server timestamp placeholders for response
            delete result.createdAt;
            delete result.updatedAt;
            result.createdAt = new Date().toISOString();
            result.updatedAt = result.createdAt;
            
            logMessage('log', `Document created: ${collection}/${docRef.id}`);
            return result;
        } catch (error) {
            logMessage('error', `Error creating document in ${collection}`, error);
            throw error;
        }
    }
    
    /**
     * Get a document by ID
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID
     * @param {boolean} [skipCache=false] - Skip cache lookup
     * @returns {Promise<Object|null>} Document data or null if not found
     */
    async function getDocument(collection, docId, skipCache = false) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!collection || !docId) {
                throw new Error('Collection and document ID are required');
            }
            
            // Check cache first
            const cacheKey = `${collection}:${docId}`;
            if (!skipCache) {
                const cached = getCachedDocument(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            
            const docRef = db.collection(collection).doc(docId);
            const doc = await docRef.get();
            
            if (!doc.exists) {
                return null;
            }
            
            const result = { id: doc.id, ...doc.data() };
            
            // Convert Firestore timestamps to ISO strings
            if (result.createdAt && result.createdAt.toDate) {
                result.createdAt = result.createdAt.toDate().toISOString();
            }
            if (result.updatedAt && result.updatedAt.toDate) {
                result.updatedAt = result.updatedAt.toDate().toISOString();
            }
            
            // Cache the result
            setCachedDocument(cacheKey, result);
            
            return result;
        } catch (error) {
            logMessage('error', `Error getting document ${collection}/${docId}`, error);
            throw error;
        }
    }
    
    /**
     * Update a document
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID
     * @param {Object} data - Fields to update
     * @param {boolean} [merge=true] - Merge with existing data
     * @returns {Promise<Object>} Updated document data
     */
    async function updateDocument(collection, docId, data, merge = true) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!collection || !docId) {
                throw new Error('Collection and document ID are required');
            }
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid update data');
            }
            
            const updateData = {
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: getCurrentUser()?.uid || 'system',
                _version: firebase.firestore.FieldValue.increment(1),
            };
            
            const docRef = db.collection(collection).doc(docId);
            await docRef.set(updateData, { merge: merge });
            
            // Invalidate cache
            clearCache(collection);
            
            // Fetch updated document
            const updated = await getDocument(collection, docId, true);
            
            logMessage('log', `Document updated: ${collection}/${docId}`);
            return updated;
        } catch (error) {
            logMessage('error', `Error updating document ${collection}/${docId}`, error);
            throw error;
        }
    }
    
    /**
     * Delete a document
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async function deleteDocument(collection, docId) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!collection || !docId) {
                throw new Error('Collection and document ID are required');
            }
            
            const docRef = db.collection(collection).doc(docId);
            await docRef.delete();
            
            // Invalidate cache
            clearCache(collection);
            
            logMessage('log', `Document deleted: ${collection}/${docId}`);
            return true;
        } catch (error) {
            logMessage('error', `Error deleting document ${collection}/${docId}`, error);
            throw error;
        }
    }
    
    /**
     * Query documents with conditions
     * @param {string} collection - Collection name
     * @param {Array<Array>} [conditions=[]] - Array of where conditions [field, operator, value]
     * @param {Object} [options={}] - Query options (orderBy, orderDir, limit, startAfter, endBefore)
     * @returns {Promise<Array<Object>>} Array of matching documents
     */
    async function queryDocuments(collection, conditions = [], options = {}) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!collection) {
                throw new Error('Collection name is required');
            }
            
            let query = db.collection(collection);
            
            // Apply where conditions
            if (conditions && conditions.length > 0) {
                conditions.forEach((condition) => {
                    if (Array.isArray(condition) && condition.length === 3) {
                        const [field, operator, value] = condition;
                        query = query.where(field, operator, value);
                    }
                });
            }
            
            // Apply ordering
            if (options.orderBy) {
                query = query.orderBy(options.orderBy, options.orderDir || 'desc');
            }
            
            // Apply limit
            if (options.limit && options.limit > 0) {
                query = query.limit(Math.min(options.limit, 500)); // Max 500 per query
            }
            
            // Apply pagination cursors
            if (options.startAfter) {
                query = query.startAfter(options.startAfter);
            }
            if (options.endBefore) {
                query = query.endBefore(options.endBefore);
            }
            
            const snapshot = await query.get();
            
            const results = snapshot.docs.map((doc) => {
                const data = doc.data();
                
                // Convert Firestore timestamps
                if (data.createdAt && data.createdAt.toDate) {
                    data.createdAt = data.createdAt.toDate().toISOString();
                }
                if (data.updatedAt && data.updatedAt.toDate) {
                    data.updatedAt = data.updatedAt.toDate().toISOString();
                }
                
                return { id: doc.id, ...data };
            });
            
            // Cache individual results
            results.forEach((doc) => {
                setCachedDocument(`${collection}:${doc.id}`, doc);
            });
            
            return results;
        } catch (error) {
            logMessage('error', `Error querying ${collection}`, error);
            throw error;
        }
    }
    
    /**
     * Batch write multiple operations atomically
     * @param {Array<Object>} operations - Array of { type, collection, docId, data }
     * @returns {Promise<boolean>} True if batch completed
     */
    async function batchWrite(operations) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            if (!operations || !Array.isArray(operations)) {
                throw new Error('Operations array is required');
            }
            
            const batch = db.batch();
            const affectedCollections = new Set();
            
            operations.forEach((op) => {
                const { type, collection, docId, data } = op;
                const docRef = docId 
                    ? db.collection(collection).doc(docId) 
                    : db.collection(collection).doc();
                
                affectedCollections.add(collection);
                
                switch (type) {
                    case 'set':
                        batch.set(docRef, {
                            ...data,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        });
                        break;
                    case 'update':
                        batch.update(docRef, {
                            ...data,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        });
                        break;
                    case 'delete':
                        batch.delete(docRef);
                        break;
                    default:
                        throw new Error(`Unknown batch operation type: ${type}`);
                }
            });
            
            await batch.commit();
            
            // Invalidate affected collections in cache
            affectedCollections.forEach((col) => clearCache(col));
            
            logMessage('log', `Batch write completed: ${operations.length} operations`);
            return true;
        } catch (error) {
            logMessage('error', 'Batch write failed', error);
            throw error;
        }
    }
    
    /**
     * Run a transaction
     * @param {Function} updateFunction - Transaction update function
     * @returns {Promise<*>} Transaction result
     */
    async function runTransaction(updateFunction) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            
            const result = await db.runTransaction(updateFunction);
            logMessage('log', 'Transaction completed successfully');
            return result;
        } catch (error) {
            logMessage('error', 'Transaction failed', error);
            throw error;
        }
    }
    
    /**
     * Subscribe to real-time document updates
     * @param {string} collection - Collection name
     * @param {string} docId - Document ID
     * @param {Function} callback - Callback function receiving updated data
     * @returns {Function} Unsubscribe function
     */
    function onDocumentSnapshot(collection, docId, callback) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            
            const docRef = db.collection(collection).doc(docId);
            const unsubscribe = docRef.onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        const data = { id: doc.id, ...doc.data() };
                        setCachedDocument(`${collection}:${docId}`, data);
                        callback(null, data);
                    } else {
                        callback(null, null);
                    }
                },
                (error) => {
                    logMessage('error', `Snapshot error for ${collection}/${docId}`, error);
                    callback(error, null);
                }
            );
            
            return unsubscribe;
        } catch (error) {
            logMessage('error', 'Error setting up document snapshot', error);
            throw error;
        }
    }
    
    /**
     * Subscribe to real-time collection query
     * @param {string} collection - Collection name
     * @param {Array<Array>} conditions - Where conditions
     * @param {Object} options - Query options
     * @param {Function} callback - Callback function receiving results array
     * @returns {Function} Unsubscribe function
     */
    function onCollectionSnapshot(collection, conditions, options, callback) {
        try {
            if (!db) {
                throw new Error('Firestore not available');
            }
            
            let query = db.collection(collection);
            
            if (conditions) {
                conditions.forEach(([field, operator, value]) => {
                    query = query.where(field, operator, value);
                });
            }
            
            if (options) {
                if (options.orderBy) {
                    query = query.orderBy(options.orderBy, options.orderDir || 'desc');
                }
                if (options.limit) {
                    query = query.limit(options.limit);
                }
            }
            
            const unsubscribe = query.onSnapshot(
                (snapshot) => {
                    const results = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                    callback(null, results);
                },
                (error) => {
                    logMessage('error', `Collection snapshot error for ${collection}`, error);
                    callback(error, []);
                }
            );
            
            return unsubscribe;
        } catch (error) {
            logMessage('error', 'Error setting up collection snapshot', error);
            throw error;
        }
    }
    
    /**
     * Upload file to Firebase Storage
     * @param {string} path - Storage path
     * @param {File|Blob} file - File to upload
     * @param {Object} [metadata] - File metadata
     * @returns {Promise<string>} Download URL
     */
    async function uploadFile(path, file, metadata) {
        try {
            if (!storage) {
                throw new Error('Storage not available');
            }
            
            const storageRef = storage.ref().child(path);
            const uploadTask = await storageRef.put(file, metadata);
            const downloadURL = await uploadTask.ref.getDownloadURL();
            
            logMessage('log', `File uploaded: ${path}`);
            return downloadURL;
        } catch (error) {
            logMessage('error', `Error uploading file: ${path}`, error);
            throw error;
        }
    }
    
    /**
     * Get download URL for a file
     * @param {string} path - Storage path
     * @returns {Promise<string>} Download URL
     */
    async function getFileURL(path) {
        try {
            if (!storage) {
                throw new Error('Storage not available');
            }
            
            const url = await storage.ref().child(path).getDownloadURL();
            return url;
        } catch (error) {
            logMessage('error', `Error getting file URL: ${path}`, error);
            throw error;
        }
    }
    
    /**
     * Delete file from Storage
     * @param {string} path - Storage path
     * @returns {Promise<boolean>} True if deleted
     */
    async function deleteFile(path) {
        try {
            if (!storage) {
                throw new Error('Storage not available');
            }
            
            await storage.ref().child(path).delete();
            logMessage('log', `File deleted: ${path}`);
            return true;
        } catch (error) {
            logMessage('error', `Error deleting file: ${path}`, error);
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: SERVICE STATUS & DIAGNOSTICS
    // -------------------------------------------------------------------------
    
    /**
     * Get snapshot of all service instances
     * @returns {Object} Service status object
     */
    function getServiceSnapshot() {
        return {
            app,
            db,
            auth,
            storage,
            rtdb,
            functions,
            analytics,
            performance,
            messaging,
            config: firebaseConfig,
            isSDKLoaded,
            isInitialized,
            cacheSize: documentCache.size,
        };
    }
    
    /**
     * Check if all critical services are available
     * @returns {boolean} True if all critical services ready
     */
    function isServiceReady() {
        return isInitialized && !!app && !!db && !!auth && !!storage;
    }
    
    /**
     * Get connection status
     * @returns {Object} Connection status details
     */
    function getConnectionStatus() {
        try {
            return {
                online: navigator.onLine,
                firestore: !!db,
                auth: !!auth,
                storage: !!storage,
                initialized: isInitialized,
                cachedDocuments: documentCache.size,
            };
        } catch (error) {
            return {
                online: false,
                firestore: false,
                auth: false,
                storage: false,
                initialized: false,
                cachedDocuments: 0,
                error: error.message,
            };
        }
    }
    
    /**
     * Wait for Firebase to be fully initialized
     * @param {number} [timeout=10000] - Timeout in milliseconds
     * @returns {Promise<Object>} Resolves with service snapshot when ready
     */
    function waitForInit(timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (isInitialized) {
                resolve(getServiceSnapshot());
                return;
            }
            
            const timeoutId = setTimeout(() => {
                window.removeEventListener('firebase:initialized', handler);
                reject(new Error('Firebase initialization timeout'));
            }, timeout);
            
            const handler = (event) => {
                clearTimeout(timeoutId);
                if (event.detail.success) {
                    resolve(getServiceSnapshot());
                } else {
                    reject(new Error(event.detail.error || 'Initialization failed'));
                }
            };
            
            window.addEventListener('firebase:initialized', handler, { once: true });
        });
    }

    // -------------------------------------------------------------------------
    // SECTION 8: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface of FirebaseService module */
    const publicAPI = Object.freeze({
        // Configuration
        config: firebaseConfig,
        
        // Service instances (read-only via getters)
        get app() { return app; },
        get db() { return db; },
        get auth() { return auth; },
        get storage() { return storage; },
        get rtdb() { return rtdb; },
        get functions() { return functions; },
        get analytics() { return analytics; },
        get performance() { return performance; },
        get messaging() { return messaging; },
        
        // Status
        isInitialized: () => isInitialized,
        isSDKLoaded: () => isSDKLoaded,
        isServiceReady,
        getServiceSnapshot,
        getConnectionStatus,
        waitForInit,
        
        // Initialization
        initializeAll,
        
        // Auth
        getCurrentUser,
        getIdToken,
        signOut,
        
        // CRUD
        createDocument,
        getDocument,
        updateDocument,
        deleteDocument,
        queryDocuments,
        batchWrite,
        runTransaction,
        
        // Real-time
        onDocumentSnapshot,
        onCollectionSnapshot,
        
        // Storage
        uploadFile,
        getFileURL,
        deleteFile,
        
        // Cache
        clearCache,
        getCachedDocument,
        
        // Utility
        queueOperation,
    });
    
    return publicAPI;
    
})(); // End of FirebaseService IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

// Initialize Firebase when the module loads
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            FirebaseService.initializeAll().catch((error) => {
                console.error('[FirebaseService] Auto-initialization failed:', error);
            });
        });
    } else {
        // DOM already loaded
        FirebaseService.initializeAll().catch((error) => {
            console.error('[FirebaseService] Auto-initialization failed:', error);
        });
    }
}

// =============================================================================
// EXPORTS - Dual export strategy
// =============================================================================

// Global namespace export
if (typeof window !== 'undefined') {
    window.FirebaseService = FirebaseService;
    window.Global = window.Global || {};
    window.Global.FirebaseService = FirebaseService;
}

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseService;
}

export {
    FirebaseService as default,
    FirebaseService,
};