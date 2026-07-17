/* ==========================================
   11 AVATAR DIGITAL HUB
   Firebase Configuration - GitHub Pages Ready
   Version: 2.0 Enterprise
   ========================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBZDaHJSt-4AV6EJYG76p8kcsIHf6LOxdU",
    authDomain: "avatar-wa-dual-crm.firebaseapp.com",
    projectId: "avatar-wa-dual-crm",
    storageBucket: "avatar-wa-dual-crm.firebasestorage.app",
    messagingSenderId: "946959261009",
    appId: "1:946959261009:web:175f5390d63715f1f8c770"
};

var app = null;
var db = null;
var auth = null;
var storage = null;

// Initialize Firebase
try {
    app = firebase.initializeApp(firebaseConfig);
    console.log('Firebase App initialized');
} catch (e) {
    console.error('Firebase init error:', e.message);
}

// Initialize Firestore
try {
    db = firebase.firestore();
    console.log('Firestore initialized');
} catch (e) {
    console.error('Firestore error:', e.message);
    db = null;
}

// Initialize Auth
try {
    auth = firebase.auth();
    console.log('Auth initialized');
} catch (e) {
    console.error('Auth error:', e.message);
    auth = null;
}

// Initialize Storage
try {
    storage = firebase.storage();
    console.log('Storage initialized');
} catch (e) {
    console.error('Storage error:', e.message);
    storage = null;
}

// Auth State Observer
if (auth) {
    auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('User signed in:', user.email);
            localStorage.setItem('auth_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                lastLogin: new Date().toISOString()
            }));
        } else {
            console.log('User signed out');
            localStorage.removeItem('auth_user');
        }
    });
}

// Export globally
window.FirebaseService = {
    app: app,
    db: db,
    auth: auth,
    storage: storage,
    config: firebaseConfig,
    
    getCurrentUser: function() {
        return auth ? auth.currentUser : null;
    },
    
    signOut: function() {
        if (auth) return auth.signOut();
        return Promise.resolve();
    },
    
    createDocument: function(collection, data) {
        if (!db) return Promise.reject('Firestore not available');
        return db.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },
    
    getDocument: function(collection, docId) {
        if (!db) return Promise.reject('Firestore not available');
        return db.collection(collection).doc(docId).get()
            .then(function(doc) {
                return doc.exists ? { id: doc.id, ...doc.data() } : null;
            });
    },
    
    updateDocument: function(collection, docId, data) {
        if (!db) return Promise.reject('Firestore not available');
        return db.collection(collection).doc(docId).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },
    
    deleteDocument: function(collection, docId) {
        if (!db) return Promise.reject('Firestore not available');
        return db.collection(collection).doc(docId).delete();
    },
    
    queryDocuments: function(collection, conditions, options) {
        if (!db) return Promise.reject('Firestore not available');
        var query = db.collection(collection);
        
        if (conditions) {
            conditions.forEach(function(cond) {
                query = query.where(cond[0], cond[1], cond[2]);
            });
        }
        
        if (options && options.orderBy) {
            query = query.orderBy(options.orderBy, options.orderDir || 'desc');
        }
        
        if (options && options.limit) {
            query = query.limit(options.limit);
        }
        
        return query.get().then(function(snapshot) {
            return snapshot.docs.map(function(doc) {
                return { id: doc.id, ...doc.data() };
            });
        });
    }
};

console.log('Firebase Service ready');