/* ==========================================
   11 AVATAR DIGITAL HUB
   Firebase Cloud Functions - Backend API
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Serverless backend operations
   - Authentication triggers
   - Database triggers & maintenance
   - Scheduled backups
   - WhatsApp webhook processing
   - Email notifications
   - Data cleanup & optimization
   - Security & validation
   ========================================== */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Service references
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    backup: {
        enabled: true,
        schedule: 'every 24 hours',
        retentionDays: 30,
        collections: ['users','leads','clients','revenue','projects','retainers','invoices','history']
    },
    cleanup: {
        enabled: true,
        schedule: 'every 24 hours',
        maxHistoryAge: 90, // days
        maxAuditLogAge: 180, // days
        maxInactiveUserDays: 365
    },
    notifications: {
        enabled: true,
        senderEmail: '11avatardigitalhub@gmail.com'
    },
    whatsapp: {
        enabled: true,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '11avatar_wa_verify_token_2024'
    }
};

// ==========================================
// AUTHENTICATION TRIGGERS
// ==========================================

/**
 * Trigger: New user registered
 * Creates user profile document in Firestore
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    console.log('👤 New user created:', user.uid, user.email);
    
    try {
        const userProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            phone: user.phoneNumber || '',
            role: 'client_owner',
            clientId: null,
            permissions: [],
            emailVerified: user.emailVerified || false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            lastLogin: Timestamp.now(),
            loginCount: 1,
            status: 'active',
            onboardingComplete: false,
            provider: user.providerData[0]?.providerId || 'email',
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
                }
            }
        };
        
        // Create user document
        await db.collection('users').doc(user.uid).set(userProfile);
        
        // Create welcome notification
        await db.collection('notifications').add({
            userId: user.uid,
            type: 'welcome',
            title: 'Welcome to 11 Avatar Digital Hub! 🎉',
            message: 'Your account has been created successfully. Start managing your leads and revenue today.',
            read: false,
            createdAt: Timestamp.now()
        });
        
        // Log activity
        await db.collection('history').add({
            userId: user.uid,
            type: 'user_created',
            desc: `User account created: ${user.email}`,
            timestamp: Timestamp.now(),
            date: new Date().toISOString().slice(0, 10)
        });
        
        console.log('✅ User profile created:', user.uid);
        
    } catch (error) {
        console.error('❌ Error creating user profile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create user profile');
    }
});

/**
 * Trigger: User deleted
 * Cleans up user data
 */
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
    console.log('🗑️ User deleted:', user.uid);
    
    try {
        // Delete user profile
        await db.collection('users').doc(user.uid).delete();
        
        // Delete user notifications
        const notifications = await db.collection('notifications')
            .where('userId', '==', user.uid)
            .get();
        
        const batch = db.batch();
        notifications.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        // Log deletion
        await db.collection('history').add({
            userId: 'system',
            type: 'user_deleted',
            desc: `User account deleted: ${user.email || user.uid}`,
            timestamp: Timestamp.now(),
            date: new Date().toISOString().slice(0, 10)
        });
        
        console.log('✅ User data cleaned up:', user.uid);
        
    } catch (error) {
        console.error('❌ Error cleaning up user:', error);
    }
});

// ==========================================
// FIRESTORE TRIGGERS
// ==========================================

/**
 * Trigger: Lead status changed to Won
 * Auto-creates client and project
 */
exports.onLeadWon = functions.firestore
    .document('leads/{leadId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const leadId = context.params.leadId;
        
        // Check if status changed to Won
        if (beforeData.status !== 'Won' && afterData.status === 'Won') {
            console.log('🏆 Lead won:', leadId, afterData.name);
            
            try {
                // Create client
                const clientRef = await db.collection('clients').add({
                    name: afterData.name || 'Unknown',
                    business: afterData.business || '',
                    mobile: afterData.mobile || '',
                    email: afterData.email || '',
                    city: afterData.city || '',
                    dealValue: parseFloat(afterData.dealValue) || 0,
                    status: 'Active',
                    leadId: leadId,
                    clientId: afterData.clientId || null,
                    createdBy: afterData.createdBy || 'system',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    notes: afterData.notes || '',
                    mrr: 0,
                    renewalDate: ''
                });
                
                // Create project if service exists
                if (afterData.service) {
                    await db.collection('projects').add({
                        name: `${afterData.service} - ${afterData.name}`,
                        clientName: afterData.name,
                        clientId: clientRef.id,
                        service: afterData.service,
                        startDate: new Date().toISOString().slice(0, 10),
                        dueDate: '',
                        status: 'Planning',
                        progress: 0,
                        leadId: leadId,
                        clientDataId: afterData.clientId || null,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                }
                
                // Create retainer if deal value > 0
                if (parseFloat(afterData.dealValue) > 0) {
                    await db.collection('retainers').add({
                        clientName: afterData.name,
                        clientId: clientRef.id,
                        service: afterData.service || 'General',
                        monthlyFee: parseFloat(afterData.dealValue) || 0,
                        status: 'Active',
                        clientDataId: afterData.clientId || null,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                }
                
                // Log history
                await db.collection('history').add({
                    leadId: leadId,
                    leadName: afterData.name,
                    type: 'won',
                    desc: `Lead won → Client created: ${afterData.name}`,
                    userId: afterData.updatedBy || 'system',
                    timestamp: Timestamp.now(),
                    date: new Date().toISOString().slice(0, 10)
                });
                
                console.log('✅ Client, project & retainer created for:', afterData.name);
                
            } catch (error) {
                console.error('❌ Error processing won lead:', error);
            }
        }
        
        return null;
    });

/**
 * Trigger: New revenue entry added
 * Updates client MRR and revenue stats
 */
exports.onRevenueAdded = functions.firestore
    .document('revenue/{entryId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        console.log('💰 Revenue added:', data.client, data.amount);
        
        try {
            // Find matching client
            if (data.client) {
                const clientsSnapshot = await db.collection('clients')
                    .where('name', '==', data.client)
                    .limit(1)
                    .get();
                
                if (!clientsSnapshot.empty) {
                    const clientDoc = clientsSnapshot.docs[0];
                    const clientData = clientDoc.data();
                    const currentMRR = parseFloat(clientData.mrr) || 0;
                    const newMRR = currentMRR + parseFloat(data.amount || 0);
                    
                    await clientDoc.ref.update({
                        mrr: newMRR,
                        updatedAt: Timestamp.now()
                    });
                }
            }
            
            // Log history
            await db.collection('history').add({
                type: 'revenue',
                desc: `Revenue added: ₹${parseFloat(data.amount || 0).toLocaleString('en-IN')} from ${data.client}`,
                userId: data.createdBy || 'system',
                timestamp: Timestamp.now(),
                date: new Date().toISOString().slice(0, 10)
            });
            
        } catch (error) {
            console.error('❌ Error processing revenue:', error);
        }
        
        return null;
    });

// ==========================================
// SCHEDULED FUNCTIONS
// ==========================================

/**
 * Scheduled: Daily Backup
 * Exports all collections to backup storage
 */
exports.dailyBackup = functions.pubsub
    .schedule('0 2 * * *') // Every day at 2:00 AM IST
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('💾 Starting daily backup...');
        
        try {
            const backupData = {};
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Backup each collection
            for (const collectionName of CONFIG.backup.collections) {
                const snapshot = await db.collection(collectionName).get();
                backupData[collectionName] = [];
                
                snapshot.forEach(doc => {
                    backupData[collectionName].push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log(`  📦 ${collectionName}: ${backupData[collectionName].length} documents`);
            }
            
            // Add metadata
            backupData._metadata = {
                timestamp: new Date().toISOString(),
                totalCollections: CONFIG.backup.collections.length,
                totalDocuments: Object.values(backupData).reduce(
                    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
                ),
                version: '2.0.0'
            };
            
            // Save to Storage
            const bucket = storage.bucket();
            const fileName = `backups/daily/backup-${timestamp}.json`;
            const file = bucket.file(fileName);
            
            await file.save(JSON.stringify(backupData, null, 2), {
                contentType: 'application/json',
                metadata: {
                    metadata: {
                        type: 'daily_backup',
                        timestamp: new Date().toISOString()
                    }
                }
            });
            
            // Update backup log
            await db.collection('backups').add({
                fileName: fileName,
                timestamp: Timestamp.now(),
                collections: CONFIG.backup.collections,
                totalDocuments: backupData._metadata.totalDocuments,
                status: 'success',
                size: JSON.stringify(backupData).length
            });
            
            // Clean old backups
            await cleanOldBackups(bucket);
            
            console.log('✅ Daily backup completed:', fileName);
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
            
            // Log failed backup
            await db.collection('backups').add({
                timestamp: Timestamp.now(),
                status: 'failed',
                error: error.message
            });
        }
        
        return null;
    });

/**
 * Scheduled: Data Cleanup
 * Removes old data to optimize storage
 */
exports.dataCleanup = functions.pubsub
    .schedule('0 3 * * *') // Every day at 3:00 AM IST
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('🧹 Starting data cleanup...');
        let cleanedCount = 0;
        
        try {
            const now = Timestamp.now();
            
            // Clean old history entries
            const historyCutoff = new Date();
            historyCutoff.setDate(historyCutoff.getDate() - CONFIG.cleanup.maxHistoryAge);
            
            const oldHistory = await db.collection('history')
                .where('timestamp', '<', Timestamp.fromDate(historyCutoff))
                .limit(500)
                .get();
            
            if (!oldHistory.empty) {
                const batch = db.batch();
                oldHistory.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                cleanedCount += oldHistory.size;
                console.log(`  🗑️ Deleted ${oldHistory.size} old history entries`);
            }
            
            // Clean old notifications
            const notificationCutoff = new Date();
            notificationCutoff.setDate(notificationCutoff.getDate() - 30);
            
            const oldNotifications = await db.collection('notifications')
                .where('createdAt', '<', Timestamp.fromDate(notificationCutoff))
                .where('read', '==', true)
                .limit(500)
                .get();
            
            if (!oldNotifications.empty) {
                const batch2 = db.batch();
                oldNotifications.docs.forEach(doc => batch2.delete(doc.ref));
                await batch2.commit();
                cleanedCount += oldNotifications.size;
                console.log(`  🔔 Deleted ${oldNotifications.size} old notifications`);
            }
            
            // Clean old backup files
            const bucket = storage.bucket();
            await cleanOldBackups(bucket);
            
            // Log cleanup
            await db.collection('history').add({
                type: 'system',
                desc: `Data cleanup completed: ${cleanedCount} items removed`,
                userId: 'system',
                timestamp: Timestamp.now(),
                date: new Date().toISOString().slice(0, 10)
            });
            
            console.log('✅ Cleanup completed:', cleanedCount, 'items removed');
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
        
        return null;
    });

/**
 * Scheduled: Weekly Report Generation
 */
exports.weeklyReport = functions.pubsub
    .schedule('0 8 * * 1') // Every Monday at 8:00 AM IST
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('📊 Generating weekly report...');
        
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().slice(0, 10);
            
            // Get weekly stats
            const newLeads = await db.collection('leads')
                .where('createdDate', '>=', weekAgoStr)
                .get();
            
            const newRevenue = await db.collection('revenue')
                .where('date', '>=', weekAgoStr)
                .get();
            
            const wonDeals = await db.collection('leads')
                .where('status', '==', 'Won')
                .where('createdDate', '>=', weekAgoStr)
                .get();
            
            const totalRevenue = newRevenue.docs.reduce(
                (sum, doc) => sum + (parseFloat(doc.data().amount) || 0), 0
            );
            
            // Save report
            await db.collection('reports').add({
                type: 'weekly',
                period: `${weekAgoStr} to ${new Date().toISOString().slice(0, 10)}`,
                stats: {
                    newLeads: newLeads.size,
                    newRevenue: totalRevenue,
                    wonDeals: wonDeals.size,
                    conversionRate: newLeads.size > 0 
                        ? ((wonDeals.size / newLeads.size) * 100).toFixed(1) 
                        : 0
                },
                createdAt: Timestamp.now()
            });
            
            console.log('✅ Weekly report generated');
            
        } catch (error) {
            console.error('❌ Report generation failed:', error);
        }
        
        return null;
    });

// ==========================================
// WHATSAPP WEBHOOK
// ==========================================

/**
 * WhatsApp Webhook Handler
 * Processes incoming WhatsApp messages
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    
    // Verification challenge (GET request)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        if (mode === 'subscribe' && token === CONFIG.whatsapp.verifyToken) {
            console.log('✅ WhatsApp webhook verified');
            return res.status(200).send(challenge);
        }
        
        console.warn('⚠️ WhatsApp webhook verification failed');
        return res.status(403).send('Verification failed');
    }
    
    // Handle incoming messages (POST request)
    if (req.method === 'POST') {
        try {
            const body = req.body;
            console.log('📩 WhatsApp message received:', JSON.stringify(body));
            
            // Process message
            if (body.entry && body.entry[0] && body.entry[0].changes) {
                const changes = body.entry[0].changes[0];
                const value = changes.value;
                
                if (value.messages && value.messages[0]) {
                    const message = value.messages[0];
                    const from = message.from;
                    const text = message.text?.body || '';
                    const timestamp = message.timestamp;
                    
                    // Save message to Firestore
                    await db.collection('whatsappMessages').add({
                        from: from,
                        message: text,
                        timestamp: Timestamp.fromMillis(parseInt(timestamp) * 1000),
                        direction: 'incoming',
                        processed: false,
                        createdAt: Timestamp.now()
                    });
                    
                    // Try to find matching lead/contact
                    const contacts = await db.collection('contacts')
                        .where('mobile', '==', from)
                        .limit(1)
                        .get();
                    
                    if (!contacts.empty) {
                        const contact = contacts.docs[0];
                        await contact.ref.update({
                            lastWhatsAppMessage: text,
                            lastWhatsAppTime: Timestamp.now()
                        });
                    }
                    
                    // Create lead if new number
                    const existingLeads = await db.collection('leads')
                        .where('mobile', '==', from)
                        .limit(1)
                        .get();
                    
                    if (existingLeads.empty) {
                        await db.collection('leads').add({
                            name: 'WhatsApp Contact',
                            mobile: from,
                            source: 'WhatsApp',
                            status: 'New',
                            notes: `Auto-created from WhatsApp message: "${text}"`,
                            createdDate: new Date().toISOString().slice(0, 10),
                            followupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        });
                        
                        console.log('📋 Auto-lead created from WhatsApp:', from);
                    }
                }
            }
            
            return res.status(200).json({ status: 'received' });
            
        } catch (error) {
            console.error('❌ WhatsApp webhook error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    return res.status(405).send('Method Not Allowed');
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Clean old backup files from Storage
 */
async function cleanOldBackups(bucket) {
    try {
        const [files] = await bucket.getFiles({ prefix: 'backups/daily/' });
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.backup.retentionDays);
        
        let deletedCount = 0;
        
        for (const file of files) {
            const [metadata] = await file.getMetadata();
            const created = new Date(metadata.timeCreated);
            
            if (created < cutoffDate) {
                await file.delete();
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            console.log(`  🗑️ Deleted ${deletedCount} old backup files`);
        }
        
    } catch (error) {
        console.error('❌ Error cleaning old backups:', error);
    }
}

/**
 * Send email notification (placeholder)
 */
async function sendEmailNotification(to, subject, html) {
    // Integration with SendGrid, Resend, or other email service
    console.log('📧 Email would be sent:', { to, subject });
    return true;
}

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================

module.exports = {
    // Auth triggers
    onUserCreate: exports.onUserCreate,
    onUserDelete: exports.onUserDelete,
    
    // Firestore triggers
    onLeadWon: exports.onLeadWon,
    onRevenueAdded: exports.onRevenueAdded,
    
    // Scheduled functions
    dailyBackup: exports.dailyBackup,
    dataCleanup: exports.dataCleanup,
    weeklyReport: exports.weeklyReport,
    
    // HTTP functions
    whatsappWebhook: exports.whatsappWebhook
};

console.log('🚀 Firebase Cloud Functions loaded and ready');
console.log('📋 Available functions:', Object.keys(exports).length);
