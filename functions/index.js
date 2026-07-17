/**
 * @fileoverview 11 Avatar SMEs CRM - Firebase Cloud Functions
 * @description Serverless backend functions for authentication triggers,
 *              Firestore document triggers, scheduled backups, data cleanup,
 *              WhatsApp webhook processing, and weekly reporting.
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 */

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

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
    backup: {
        enabled: true,
        schedule: 'every 24 hours',
        retentionDays: 30,
        collections: [
            'users', 'leads', 'clients', 'deals', 'revenue', 
            'projects', 'retainers', 'invoices', 'payments', 'history'
        ],
    },
    cleanup: {
        enabled: true,
        schedule: 'every 24 hours',
        maxHistoryAge: 90,        // days
        maxAuditLogAge: 180,      // days
        maxInactiveUserDays: 365, // days
        maxNotificationsAge: 30,  // days
    },
    notifications: {
        enabled: true,
        senderEmail: 'info@11avatardigitalhub.cloud',
        supportEmail: 'support@11avatardigitalhub.cloud',
    },
    whatsapp: {
        enabled: true,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    },
};

// =============================================================================
// AUTHENTICATION TRIGGERS
// =============================================================================

/**
 * Trigger: New user registered via Firebase Auth
 * Creates user profile document in Firestore with default role
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
            role: 'viewer',                        // Default role
            clientId: null,
            permissions: [
                'view_assigned_leads',
                'view_assigned_clients',
                'view_assigned_deals',
                'view_invoices',
                'view_reports',
                'view_tasks',
            ],
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
                    sound: true,
                },
            },
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
            createdAt: Timestamp.now(),
        });
        
        // Log activity
        await db.collection('history').add({
            userId: user.uid,
            type: 'user_created',
            desc: 'User account created: ' + (user.email || user.uid),
            timestamp: Timestamp.now(),
            date: new Date().toISOString().slice(0, 10),
        });
        
        console.log('✅ User profile created:', user.uid);
        
    } catch (error) {
        console.error('❌ Error creating user profile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create user profile');
    }
});

/**
 * Trigger: User deleted from Firebase Auth
 * Cleans up all user data across collections
 */
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
    console.log('🗑️ User deleted:', user.uid);
    
    try {
        // Delete user profile
        await db.collection('users').doc(user.uid).delete();
        
        // Delete user notifications (batch)
        const notifications = await db.collection('notifications')
            .where('userId', '==', user.uid)
            .get();
        
        if (!notifications.empty) {
            const batch = db.batch();
            notifications.docs.forEach(function(doc) {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        
        // Log deletion
        await db.collection('history').add({
            userId: 'system',
            type: 'user_deleted',
            desc: 'User account deleted: ' + (user.email || user.uid),
            timestamp: Timestamp.now(),
            date: new Date().toISOString().slice(0, 10),
        });
        
        console.log('✅ User data cleaned up:', user.uid);
        
    } catch (error) {
        console.error('❌ Error cleaning up user:', error);
    }
});

// =============================================================================
// FIRESTORE TRIGGERS
// =============================================================================

/**
 * Trigger: Lead status changed to Won
 * Auto-creates client and optionally project/retainer
 */
exports.onLeadWon = functions.firestore
    .document('leads/{leadId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const leadId = context.params.leadId;
        
        // Check if status changed to Won
        if (beforeData.status !== 'won' && afterData.status === 'won') {
            console.log('🏆 Lead won:', leadId, afterData.name);
            
            try {
                // Create client from won lead
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
                    renewalDate: '',
                });
                
                // Create project if service specified
                if (afterData.service) {
                    await db.collection('projects').add({
                        name: afterData.service + ' - ' + (afterData.name || 'Client'),
                        clientName: afterData.name || 'Client',
                        clientId: clientRef.id,
                        service: afterData.service,
                        startDate: new Date().toISOString().slice(0, 10),
                        dueDate: '',
                        status: 'planning',
                        progress: 0,
                        leadId: leadId,
                        clientDataId: afterData.clientId || null,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    });
                }
                
                // Create retainer if deal value > 0
                if (parseFloat(afterData.dealValue) > 0) {
                    await db.collection('retainers').add({
                        clientName: afterData.name || 'Client',
                        clientId: clientRef.id,
                        service: afterData.service || 'General',
                        monthlyFee: parseFloat(afterData.dealValue) || 0,
                        status: 'Active',
                        clientDataId: afterData.clientId || null,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    });
                }
                
                // Log history
                await db.collection('history').add({
                    leadId: leadId,
                    leadName: afterData.name,
                    type: 'won',
                    desc: 'Lead won → Client created: ' + (afterData.name || 'Unknown'),
                    userId: afterData.updatedBy || 'system',
                    timestamp: Timestamp.now(),
                    date: new Date().toISOString().slice(0, 10),
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
 * Updates client MRR and logs history
 */
exports.onRevenueAdded = functions.firestore
    .document('revenue/{entryId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        console.log('💰 Revenue added:', data.client, data.amount);
        
        try {
            // Find and update matching client MRR
            if (data.client) {
                const clientsSnapshot = await db.collection('clients')
                    .where('name', '==', data.client)
                    .limit(1)
                    .get();
                
                if (!clientsSnapshot.empty) {
                    const clientDoc = clientsSnapshot.docs[0];
                    const currentMRR = parseFloat(clientDoc.data().mrr) || 0;
                    const newMRR = currentMRR + parseFloat(data.amount || 0);
                    
                    await clientDoc.ref.update({
                        mrr: newMRR,
                        updatedAt: Timestamp.now(),
                    });
                }
            }
            
            // Log history
            await db.collection('history').add({
                type: 'revenue',
                desc: 'Revenue added: ₹' + (parseFloat(data.amount || 0)).toLocaleString('en-IN') + ' from ' + (data.client || 'Unknown'),
                userId: data.createdBy || 'system',
                timestamp: Timestamp.now(),
                date: new Date().toISOString().slice(0, 10),
            });
            
        } catch (error) {
            console.error('❌ Error processing revenue:', error);
        }
        
        return null;
    });

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

/**
 * Scheduled: Daily Backup (2:00 AM IST)
 * Exports all collections to Cloud Storage
 */
exports.dailyBackup = functions.pubsub
    .schedule('0 2 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('💾 Starting daily backup...');
        
        try {
            const backupData = {};
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Backup each collection
            for (var i = 0; i < CONFIG.backup.collections.length; i++) {
                var collectionName = CONFIG.backup.collections[i];
                var snapshot = await db.collection(collectionName).get();
                backupData[collectionName] = [];
                
                snapshot.forEach(function(doc) {
                    backupData[collectionName].push({
                        id: doc.id,
                        ...doc.data(),
                    });
                });
                
                console.log('  📦 ' + collectionName + ': ' + backupData[collectionName].length + ' documents');
            }
            
            // Add metadata
            backupData._metadata = {
                timestamp: new Date().toISOString(),
                totalCollections: CONFIG.backup.collections.length,
                totalDocuments: Object.values(backupData).reduce(function(sum, arr) {
                    return sum + (Array.isArray(arr) ? arr.length : 0);
                }, 0),
                version: '3.0.0',
            };
            
            // Save to Storage
            var bucket = storage.bucket();
            var fileName = 'backups/daily/backup-' + timestamp + '.json';
            var file = bucket.file(fileName);
            
            await file.save(JSON.stringify(backupData, null, 2), {
                contentType: 'application/json',
                metadata: {
                    metadata: {
                        type: 'daily_backup',
                        timestamp: new Date().toISOString(),
                    },
                },
            });
            
            // Update backup log in Firestore
            await db.collection('backups').add({
                fileName: fileName,
                timestamp: Timestamp.now(),
                collections: CONFIG.backup.collections,
                totalDocuments: backupData._metadata.totalDocuments,
                status: 'success',
                size: JSON.stringify(backupData).length,
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
                error: error.message,
            });
        }
        
        return null;
    });

/**
 * Scheduled: Data Cleanup (3:00 AM IST)
 * Removes old data to optimize storage costs
 */
exports.dataCleanup = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('🧹 Starting data cleanup...');
        var cleanedCount = 0;
        
        try {
            // Clean old history entries
            var historyCutoff = new Date();
            historyCutoff.setDate(historyCutoff.getDate() - CONFIG.cleanup.maxHistoryAge);
            
            var oldHistory = await db.collection('history')
                .where('timestamp', '<', Timestamp.fromDate(historyCutoff))
                .limit(500)
                .get();
            
            if (!oldHistory.empty) {
                var batch = db.batch();
                oldHistory.docs.forEach(function(doc) {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                cleanedCount += oldHistory.size;
                console.log('  🗑️ Deleted ' + oldHistory.size + ' old history entries');
            }
            
            // Clean old read notifications
            var notificationCutoff = new Date();
            notificationCutoff.setDate(notificationCutoff.getDate() - CONFIG.cleanup.maxNotificationsAge);
            
            var oldNotifications = await db.collection('notifications')
                .where('createdAt', '<', Timestamp.fromDate(notificationCutoff))
                .where('read', '==', true)
                .limit(500)
                .get();
            
            if (!oldNotifications.empty) {
                var batch2 = db.batch();
                oldNotifications.docs.forEach(function(doc) {
                    batch2.delete(doc.ref);
                });
                await batch2.commit();
                cleanedCount += oldNotifications.size;
                console.log('  🔔 Deleted ' + oldNotifications.size + ' old notifications');
            }
            
            // Clean old backup files from Storage
            var bucket = storage.bucket();
            await cleanOldBackups(bucket);
            
            // Log cleanup activity
            await db.collection('history').add({
                type: 'system',
                desc: 'Data cleanup completed: ' + cleanedCount + ' items removed',
                userId: 'system',
                timestamp: Timestamp.now(),
                date: new Date().toISOString().slice(0, 10),
            });
            
            console.log('✅ Cleanup completed:', cleanedCount, 'items removed');
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
        
        return null;
    });

/**
 * Scheduled: Weekly Report (Monday 8:00 AM IST)
 * Generates weekly performance report
 */
exports.weeklyReport = functions.pubsub
    .schedule('0 8 * * 1')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('📊 Generating weekly report...');
        
        try {
            var weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            var weekAgoStr = weekAgo.toISOString().slice(0, 10);
            var todayStr = new Date().toISOString().slice(0, 10);
            
            // Get weekly stats
            var newLeads = await db.collection('leads')
                .where('createdDate', '>=', weekAgoStr)
                .get();
            
            var newRevenue = await db.collection('revenue')
                .where('date', '>=', weekAgoStr)
                .get();
            
            var wonDeals = await db.collection('leads')
                .where('status', '==', 'won')
                .where('createdDate', '>=', weekAgoStr)
                .get();
            
            var totalRevenue = newRevenue.docs.reduce(function(sum, doc) {
                return sum + (parseFloat(doc.data().amount) || 0);
            }, 0);
            
            // Save report
            await db.collection('reports').add({
                type: 'weekly',
                period: weekAgoStr + ' to ' + todayStr,
                stats: {
                    newLeads: newLeads.size,
                    newRevenue: totalRevenue,
                    wonDeals: wonDeals.size,
                    conversionRate: newLeads.size > 0 
                        ? parseFloat(((wonDeals.size / newLeads.size) * 100).toFixed(1))
                        : 0,
                },
                createdAt: Timestamp.now(),
            });
            
            console.log('✅ Weekly report generated');
            
        } catch (error) {
            console.error('❌ Report generation failed:', error);
        }
        
        return null;
    });

// =============================================================================
// WHATSAPP WEBHOOK
// =============================================================================

/**
 * WhatsApp Webhook Handler
 * GET: Verification challenge
 * POST: Process incoming messages
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    
    // Verification challenge (GET request from WhatsApp)
    if (req.method === 'GET') {
        var mode = req.query['hub.mode'];
        var token = req.query['hub.verify_token'];
        var challenge = req.query['hub.challenge'];
        
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
            var body = req.body;
            console.log('📩 WhatsApp message received');
            
            // Process message entries
            if (body.entry && body.entry[0] && body.entry[0].changes) {
                var changes = body.entry[0].changes[0];
                var value = changes.value;
                
                if (value.messages && value.messages[0]) {
                    var message = value.messages[0];
                    var from = message.from;
                    var text = message.text?.body || '';
                    var msgTimestamp = message.timestamp;
                    
                    // Save message to Firestore
                    await db.collection('whatsappMessages').add({
                        from: from,
                        message: text,
                        timestamp: Timestamp.fromMillis(parseInt(msgTimestamp) * 1000),
                        direction: 'incoming',
                        processed: false,
                        createdAt: Timestamp.now(),
                    });
                    
                    // Try to find matching contact
                    var contacts = await db.collection('contacts')
                        .where('mobile', '==', from)
                        .limit(1)
                        .get();
                    
                    if (!contacts.empty) {
                        var contact = contacts.docs[0];
                        await contact.ref.update({
                            lastWhatsAppMessage: text,
                            lastWhatsAppTime: Timestamp.now(),
                        });
                    }
                    
                    // Auto-create lead if new number
                    var existingLeads = await db.collection('leads')
                        .where('mobile', '==', from)
                        .limit(1)
                        .get();
                    
                    if (existingLeads.empty) {
                        await db.collection('leads').add({
                            name: 'WhatsApp Contact',
                            mobile: from,
                            source: 'WhatsApp',
                            status: 'new',
                            notes: 'Auto-created from WhatsApp message: "' + text + '"',
                            createdDate: new Date().toISOString().slice(0, 10),
                            followupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now(),
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clean old backup files from Cloud Storage
 * @param {Bucket} bucket - Storage bucket instance
 */
async function cleanOldBackups(bucket) {
    try {
        var [files] = await bucket.getFiles({ prefix: 'backups/daily/' });
        var cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.backup.retentionDays);
        
        var deletedCount = 0;
        
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var [metadata] = await file.getMetadata();
            var created = new Date(metadata.timeCreated);
            
            if (created < cutoffDate) {
                await file.delete();
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            console.log('  🗑️ Deleted ' + deletedCount + ' old backup files');
        }
        
    } catch (error) {
        console.error('❌ Error cleaning old backups:', error);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Auth triggers
exports.onUserCreate = exports.onUserCreate;
exports.onUserDelete = exports.onUserDelete;

// Firestore triggers
exports.onLeadWon = exports.onLeadWon;
exports.onRevenueAdded = exports.onRevenueAdded;

// Scheduled functions
exports.dailyBackup = exports.dailyBackup;
exports.dataCleanup = exports.dataCleanup;
exports.weeklyReport = exports.weeklyReport;

// HTTP functions
exports.whatsappWebhook = exports.whatsappWebhook;

console.log('🚀 Firebase Cloud Functions v3.0.0 loaded');
console.log('📋 Available functions:', Object.keys(exports).length);