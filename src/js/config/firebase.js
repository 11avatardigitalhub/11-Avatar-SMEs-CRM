/* ==========================================
   11 AVATAR DIGITAL HUB
   Firebase Configuration & Services
   Version: 2.0 Enterprise
   ==========================================
   Services Initialized:
   - Firebase App
   - Firestore Database
   - Firebase Authentication
   - Firebase Storage
   - Analytics (optional)
   ========================================== */

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBZDaHJSt-4AV6EJYG76p8kcsIHf6LOxdU",
    authDomain: "avatar-wa-dual-crm.firebaseapp.com",
    projectId: "avatar-wa-dual-crm",
    storageBucket: "avatar-wa-dual-crm.firebasestorage.app",
    messagingSenderId: "946959261009",
    appId: "1:946959261009:web:175f5390d63715f1f8c770"
};

// ==========================================
// INITIALIZE FIREBASE APP
// ==========================================
let app;
let db;
let auth;
let storage;
let analytics = null;

try {
    app = firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase App initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw new Error('Firebase initialization failed. Check your configuration.');
}

// ==========================================
// INITIALIZE FIRESTORE DATABASE
// ==========================================
try {
    db = firebase.firestore();
    
    // Enable offline persistence
    db.enablePersistence({ synchronizeTabs: true })
        .then(() => {
            console.log('📦 Firestore offline persistence enabled');
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Multiple tabs open, persistence disabled');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Browser does not support persistence');
            }
        });

    // Firestore settings
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        merge: true
    });

    console.log('📦 Firestore database initialized');
} catch (error) {
    console.error('❌ Firestore initialization failed:', error.message);
    throw new Error('Firestore initialization failed.');
}

// ==========================================
// INITIALIZE AUTHENTICATION
// ==========================================
try {
    auth = firebase.auth();
    
    // Auth settings
    auth.useDeviceLanguage();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log('🔐 Auth persistence set to LOCAL');
        })
        .catch((error) => {
            console.error('Auth persistence error:', error);
        });

    console.log('🔐 Firebase Auth initialized');
} catch (error) {
    console.error('❌ Auth initialization failed:', error.message);
    throw new Error('Auth initialization failed.');
}

// ==========================================
// INITIALIZE STORAGE
// ==========================================
try {
    storage = firebase.storage();
    console.log('🗄️ Firebase Storage initialized');
} catch (error) {
    console.error('❌ Storage initialization failed:', error.message);
    throw new Error('Storage initialization failed.');
}

// ==========================================
// INITIALIZE ANALYTICS (Optional)
// ==========================================
try {
    if (firebase.analytics) {
        analytics = firebase.analytics();
        analytics.setAnalyticsCollectionEnabled(true);
        console.log('📊 Firebase Analytics initialized');
    }
} catch (error) {
    console.warn('⚠️ Analytics not available:', error.message);
}

// ==========================================
// AUTH STATE OBSERVER
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('👤 User signed in:', user.email);
        localStorage.setItem('auth_user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            lastLogin: new Date().toISOString()
        }));
        
        // Dispatch custom event for app
        window.dispatchEvent(new CustomEvent('auth:login', { 
            detail: { user } 
        }));
    } else {
        console.log('👤 User signed out');
        localStorage.removeItem('auth_user');
        
        // Dispatch custom event for app
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
});

// ==========================================
// FIRESTORE COLLECTION REFERENCES
// ==========================================
const collections = {
    users: () => db.collection('users'),
    leads: () => db.collection('leads'),
    clients: () => db.collection('clients'),
    contacts: () => db.collection('contacts'),
    revenue: () => db.collection('revenue'),
    projects: () => db.collection('projects'),
    retainers: () => db.collection('retainers'),
    invoices: () => db.collection('invoices'),
    payments: () => db.collection('payments'),
    tasks: () => db.collection('tasks'),
    appointments: () => db.collection('appointments'),
    campaigns: () => db.collection('campaigns'),
    trainings: () => db.collection('trainings'),
    referrals: () => db.collection('referrals'),
    history: () => db.collection('history'),
    audits: () => db.collection('audits'),
    proposals: () => db.collection('proposals'),
    settings: () => db.collection('settings'),
    notifications: () => db.collection('notifications'),
    whatsappMessages: () => db.collection('whatsappMessages'),
    chatMessages: () => db.collection('chatMessages'),
    activityLogs: () => db.collection('activityLogs'),
    backups: () => db.collection('backups'),
    tenants: () => db.collection('tenants'),
    subscriptions: () => db.collection('subscriptions'),
    roles: () => db.collection('roles'),
    permissions: () => db.collection('permissions')
};

// ==========================================
// STORAGE REFERENCES
// ==========================================
const storageRef = {
    invoices: () => storage.ref('invoices'),
    documents: () => storage.ref('documents'),
    avatars: () => storage.ref('avatars'),
    backups: () => storage.ref('backups'),
    exports: () => storage.ref('exports'),
    uploads: () => storage.ref('uploads')
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get current authenticated user
 * @returns {Object|null} Current user object or null
 */
function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Get current user's Firestore profile
 * @returns {Promise<Object|null>} User profile data
 */
async function getCurrentUserProfile() {
    const user = getCurrentUser();
    if (!user) return null;
    
    try {
        const doc = await collections.users().doc(user.uid).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

/**
 * Check if user has specific role
 * @param {string} role - Role to check
 * @returns {Promise<boolean>}
 */
async function hasRole(role) {
    const profile = await getCurrentUserProfile();
    return profile?.role === role;
}

/**
 * Check if user has specific permission
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>}
 */
async function hasPermission(permission) {
    const profile = await getCurrentUserProfile();
    if (!profile?.permissions) return false;
    return profile.permissions.includes(permission) || profile.permissions.includes('all');
}

/**
 * Get client ID for current user
 * @returns {Promise<string|null>}
 */
async function getClientId() {
    const profile = await getCurrentUserProfile();
    return profile?.clientId || null;
}

/**
 * Create timestamp for Firestore
 * @returns {firebase.firestore.FieldValue}
 */
function timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

/**
 * Create a new document with auto-generated ID
 * @param {string} collectionName - Collection name
 * @param {Object} data - Document data
 * @returns {Promise<Object>} Created document reference
 */
async function createDocument(collectionName, data) {
    try {
        const docRef = await collections[collectionName]().add({
            ...data,
            createdAt: timestamp(),
            updatedAt: timestamp()
        });
        console.log(`✅ Document created in ${collectionName}:`, docRef.id);
        return docRef;
    } catch (error) {
        console.error(`❌ Error creating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Update a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Update data
 * @returns {Promise<void>}
 */
async function updateDocument(collectionName, docId, data) {
    try {
        await collections[collectionName]().doc(docId).update({
            ...data,
            updatedAt: timestamp()
        });
        console.log(`✅ Document updated in ${collectionName}:`, docId);
    } catch (error) {
        console.error(`❌ Error updating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Delete a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
async function deleteDocument(collectionName, docId) {
    try {
        await collections[collectionName]().doc(docId).delete();
        console.log(`✅ Document deleted from ${collectionName}:`, docId);
    } catch (error) {
        console.error(`❌ Error deleting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Get a document by ID
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null
 */
async function getDocument(collectionName, docId) {
    try {
        const doc = await collections[collectionName]().doc(docId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        console.error(`❌ Error getting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Query documents with filters
 * @param {string} collectionName - Collection name
 * @param {Array} conditions - Array of [field, operator, value]
 * @param {Object} options - { orderBy, limit, startAfter }
 * @returns {Promise<Array>} Array of documents
 */
async function queryDocuments(collectionName, conditions = [], options = {}) {
    try {
        let query = collections[collectionName]();
        
        // Apply conditions
        conditions.forEach(([field, operator, value]) => {
            query = query.where(field, operator, value);
        });
        
        // Apply ordering
        if (options.orderBy) {
            query = query.orderBy(options.orderBy, options.orderDir || 'desc');
        }
        
        // Apply limit
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        // Apply pagination
        if (options.startAfter) {
            query = query.startAfter(options.startAfter);
        }
        
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`❌ Error querying ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Upload file to storage
 * @param {string} path - Storage path
 * @param {File} file - File to upload
 * @returns {Promise<string>} Download URL
 */
async function uploadFile(path, file) {
    try {
        const ref = storage.ref(path);
        const snapshot = await ref.put(file);
        const url = await snapshot.ref.getDownloadURL();
        console.log('✅ File uploaded:', url);
        return url;
    } catch (error) {
        console.error('❌ Error uploading file:', error);
        throw error;
    }
}

/**
 * Delete file from storage
 * @param {string} path - Storage path
 * @returns {Promise<void>}
 */
async function deleteFile(path) {
    try {
        await storage.ref(path).delete();
        console.log('✅ File deleted:', path);
    } catch (error) {
        console.error('❌ Error deleting file:', error);
        throw error;
    }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
async function signOut() {
    try {
        await auth.signOut();
        localStorage.clear();
        console.log('👋 User signed out successfully');
    } catch (error) {
        console.error('❌ Sign out error:', error);
        throw error;
    }
}

/**
 * Get Firestore batch for bulk operations
 * @returns {firebase.firestore.WriteBatch}
 */
function getBatch() {
    return db.batch();
}

/**
 * Run a transaction
 * @param {Function} updateFunction - Transaction function
 * @returns {Promise<any>}
 */
async function runTransaction(updateFunction) {
    try {
        return await db.runTransaction(updateFunction);
    } catch (error) {
        console.error('❌ Transaction failed:', error);
        throw error;
    }
}

// ==========================================
// EXPORT ALL SERVICES
// ==========================================
const FirebaseService = {
    // Core
    app,
    db,
    auth,
    storage,
    analytics,
    
    // Collections
    collections,
    storageRef,
    
    // Auth helpers
    getCurrentUser,
    getCurrentUserProfile,
    hasRole,
    hasPermission,
    getClientId,
    signOut,
    
    // CRUD operations
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    queryDocuments,
    
    // Storage operations
    uploadFile,
    deleteFile,
    
    // Advanced
    getBatch,
    runTransaction,
    timestamp,
    
    // Config
    config: firebaseConfig
};

// Make available globally
window.FirebaseService = FirebaseService;

console.log('🚀 Firebase Service fully initialized and ready');
console.log('📋 Available collections:', Object.keys(collections).length);
console.log('🔐 Auth ready:', !!auth);
console.log('📦 Firestore ready:', !!db);
console.log('🗄️ Storage ready:', !!storage);

// ==========================================
// END OF FIREBASE CONFIGURATION
// ==========================================
