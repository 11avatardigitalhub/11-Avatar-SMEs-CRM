/**
 * 11 AVATAR DIGITAL HUB - Data Cleanup Cloud Function
 * Enterprise-grade Firebase Cloud Function for data maintenance
 * Automated cleanup, archiving, anonymization, GDPR compliance, optimization
 * 
 * @function dataCleanup
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

/**
 * Cleanup Configuration
 */
const CLEANUP_CONFIG = {
    schedules: {
        otpCleanup: 'every 15 minutes',
        sessionCleanup: 'every 1 hours',
        tempFileCleanup: 'every 6 hours',
        logCleanup: 'every 24 hours',
        softDeleteCleanup: 'every 24 hours',
        archiveCleanup: 'every 24 hours',
        metricsAggregation: 'every 1 hours',
        cacheCleanup: 'every 30 minutes',
        orphanCleanup: 'every 24 hours',
        indexOptimization: 'every 7 days'
    },
    
    retention: {
        otps: { maxAgeMinutes: 15, maxRecords: 10000 },
        sessions: { maxAgeHours: 24, maxRecords: 50000 },
        tempFiles: { maxAgeHours: 24 },
        logs: { maxAgeDays: 90, maxRecords: 100000 },
        auditLogs: { maxAgeDays: 365 },
        notifications: { readMaxAgeDays: 30, unreadMaxAgeDays: 90 },
        emailQueue: { failedMaxAgeDays: 7, sentMaxAgeDays: 30 },
        smsQueue: { failedMaxAgeDays: 7, sentMaxAgeDays: 30 },
        cache: { maxAgeMinutes: 60 },
        exports: { maxAgeDays: 7 },
        trash: { maxAgeDays: 30 },
        metrics: { rawMaxAgeDays: 90, aggregatedMaxAgeDays: 365 }
    },
    
    batchSize: 500,
    maxOperationsPerRun: 5000,
    
    notifications: {
        onError: true,
        onCompletion: false,
        email: process.env.ADMIN_EMAIL || ''
    }
};

/**
 * Cleanup expired OTPs
 */
async function cleanupOTPs() {
    try {
        const cutoffTime = new Date(Date.now() - CLEANUP_CONFIG.retention.otps.maxAgeMinutes * 60 * 1000);
        let deletedCount = 0;
        let lastDoc = null;

        while (deletedCount < CLEANUP_CONFIG.maxOperationsPerRun) {
            let query = db.collection('otps')
                .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
                .orderBy('createdAt', 'asc')
                .limit(CLEANUP_CONFIG.batchSize);

            if (lastDoc) query = query.startAfter(lastDoc);

            const snapshot = await query.get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
        }

        // Cleanup by max records
        const countSnapshot = await db.collection('otps').count().get();
        const totalCount = countSnapshot.data().count;

        if (totalCount > CLEANUP_CONFIG.retention.otps.maxRecords) {
            const excessCount = totalCount - CLEANUP_CONFIG.retention.otps.maxRecords;
            const oldestSnapshot = await db.collection('otps')
                .orderBy('createdAt', 'asc')
                .limit(Math.min(excessCount, CLEANUP_CONFIG.batchSize))
                .get();

            const batch = db.batch();
            oldestSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        console.log(`[Cleanup] OTPs deleted: ${deletedCount}`);
        return { collection: 'otps', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] OTP cleanup failed:', error);
        return { collection: 'otps', error: error.message };
    }
}

/**
 * Cleanup expired sessions
 */
async function cleanupSessions() {
    try {
        const cutoffTime = new Date(Date.now() - CLEANUP_CONFIG.retention.sessions.maxAgeHours * 60 * 60 * 1000);
        let deletedCount = 0;

        const snapshot = await db.collection('sessions')
            .where('lastActivity', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        const countSnapshot = await db.collection('sessions').count().get();
        const totalCount = countSnapshot.data().count;

        if (totalCount > CLEANUP_CONFIG.retention.sessions.maxRecords) {
            const excessCount = totalCount - CLEANUP_CONFIG.retention.sessions.maxRecords;
            const oldestSnapshot = await db.collection('sessions')
                .orderBy('lastActivity', 'asc')
                .limit(Math.min(excessCount, CLEANUP_CONFIG.batchSize))
                .get();

            const batch = db.batch();
            oldestSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        console.log(`[Cleanup] Sessions deleted: ${deletedCount}`);
        return { collection: 'sessions', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Session cleanup failed:', error);
        return { collection: 'sessions', error: error.message };
    }
}

/**
 * Cleanup temporary files from Storage
 */
async function cleanupTempFiles() {
    try {
        const bucket = storage.bucket();
        const cutoffTime = new Date(Date.now() - CLEANUP_CONFIG.retention.tempFiles.maxAgeHours * 60 * 60 * 1000);
        let deletedCount = 0;

        const [files] = await bucket.getFiles({ prefix: 'temp/' });

        for (const file of files) {
            const [metadata] = await file.getMetadata();
            const createdTime = new Date(metadata.timeCreated);

            if (createdTime < cutoffTime) {
                await file.delete();
                deletedCount++;
            }
        }

        // Also cleanup exports
        const [exportFiles] = await bucket.getFiles({ prefix: 'exports/' });
        const exportCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.exports.maxAgeDays * 24 * 60 * 60 * 1000);

        for (const file of exportFiles) {
            const [metadata] = await file.getMetadata();
            const createdTime = new Date(metadata.timeCreated);

            if (createdTime < exportCutoff) {
                await file.delete();
                deletedCount++;
            }
        }

        console.log(`[Cleanup] Temp files deleted: ${deletedCount}`);
        return { type: 'storage_temp', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Temp file cleanup failed:', error);
        return { type: 'storage_temp', error: error.message };
    }
}

/**
 * Cleanup old logs
 */
async function cleanupLogs() {
    try {
        const results = [];
        const logCollections = [
            { name: 'audit_logs', maxAgeDays: CLEANUP_CONFIG.retention.auditLogs.maxAgeDays },
            { name: 'email_logs', maxAgeDays: CLEANUP_CONFIG.retention.logs.maxAgeDays },
            { name: 'sms_logs', maxAgeDays: CLEANUP_CONFIG.retention.logs.maxAgeDays },
            { name: 'api_logs', maxAgeDays: CLEANUP_CONFIG.retention.logs.maxAgeDays },
            { name: 'error_logs', maxAgeDays: CLEANUP_CONFIG.retention.logs.maxAgeDays }
        ];

        for (const logConfig of logCollections) {
            try {
                const cutoffTime = new Date(Date.now() - logConfig.maxAgeDays * 24 * 60 * 60 * 1000);
                let deletedCount = 0;

                const snapshot = await db.collection(logConfig.name)
                    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
                    .limit(CLEANUP_CONFIG.batchSize)
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                        deletedCount++;
                    });
                    await batch.commit();
                }

                // Check max records
                try {
                    const countSnapshot = await db.collection(logConfig.name).count().get();
                    const totalCount = countSnapshot.data().count;

                    if (totalCount > CLEANUP_CONFIG.retention.logs.maxRecords) {
                        const excessCount = totalCount - CLEANUP_CONFIG.retention.logs.maxRecords;
                        const oldestSnapshot = await db.collection(logConfig.name)
                            .orderBy('createdAt', 'asc')
                            .limit(Math.min(excessCount, CLEANUP_CONFIG.batchSize))
                            .get();

                        const batch = db.batch();
                        oldestSnapshot.forEach(doc => {
                            batch.delete(doc.ref);
                            deletedCount++;
                        });
                        await batch.commit();
                    }
                } catch (countError) {
                    // count() may require index
                    console.warn(`[Cleanup] Count failed for ${logConfig.name}:`, countError.message);
                }

                results.push({ collection: logConfig.name, deleted: deletedCount });
            } catch (err) {
                results.push({ collection: logConfig.name, error: err.message });
            }
        }

        console.log(`[Cleanup] Logs cleanup completed:`, results);
        return results;
    } catch (error) {
        console.error('[Cleanup] Log cleanup failed:', error);
        return [{ error: error.message }];
    }
}

/**
 * Cleanup soft-deleted records (trash)
 */
async function cleanupSoftDeletedRecords() {
    try {
        const cutoffTime = new Date(Date.now() - CLEANUP_CONFIG.retention.trash.maxAgeDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        const collectionsToCheck = [
            'clients', 'leads', 'contacts', 'deals', 'invoices',
            'tasks', 'projects', 'retainers', 'payments'
        ];

        for (const collectionName of collectionsToCheck) {
            try {
                const snapshot = await db.collection(collectionName)
                    .where('deleted', '==', true)
                    .where('deletedAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
                    .limit(CLEANUP_CONFIG.batchSize)
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                        deletedCount++;
                    });
                    await batch.commit();
                }
            } catch (err) {
                console.warn(`[Cleanup] Soft-delete cleanup failed for ${collectionName}:`, err.message);
            }
        }

        console.log(`[Cleanup] Soft-deleted records deleted: ${deletedCount}`);
        return { type: 'soft_delete', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Soft-delete cleanup failed:', error);
        return { type: 'soft_delete', error: error.message };
    }
}

/**
 * Cleanup old notifications
 */
async function cleanupNotifications() {
    try {
        let deletedCount = 0;

        // Delete read notifications older than 30 days
        const readCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.notifications.readMaxAgeDays * 24 * 60 * 60 * 1000);
        const readSnapshot = await db.collection('notifications')
            .where('status', '==', 'read')
            .where('readAt', '<', admin.firestore.Timestamp.fromDate(readCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!readSnapshot.empty) {
            const batch = db.batch();
            readSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        // Delete unread notifications older than 90 days
        const unreadCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.notifications.unreadMaxAgeDays * 24 * 60 * 60 * 1000);
        const unreadSnapshot = await db.collection('notifications')
            .where('status', 'in', ['pending', 'sent', 'delivered'])
            .where('createdAt', '<', admin.firestore.Timestamp.fromDate(unreadCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!unreadSnapshot.empty) {
            const batch = db.batch();
            unreadSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        // Delete dismissed notifications older than 7 days
        const dismissedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dismissedSnapshot = await db.collection('notifications')
            .where('status', '==', 'dismissed')
            .where('dismissedAt', '<', admin.firestore.Timestamp.fromDate(dismissedCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!dismissedSnapshot.empty) {
            const batch = db.batch();
            dismissedSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        console.log(`[Cleanup] Notifications deleted: ${deletedCount}`);
        return { collection: 'notifications', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Notification cleanup failed:', error);
        return { collection: 'notifications', error: error.message };
    }
}

/**
 * Cleanup failed email/SMS queue items
 */
async function cleanupMessageQueues() {
    try {
        let deletedCount = 0;

        // Email queue - failed items older than 7 days
        const emailCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.emailQueue.failedMaxAgeDays * 24 * 60 * 60 * 1000);
        const emailSnapshot = await db.collection('email_queue')
            .where('status', '==', 'failed')
            .where('failedAt', '<', admin.firestore.Timestamp.fromDate(emailCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!emailSnapshot.empty) {
            const batch = db.batch();
            emailSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        // SMS queue - failed items older than 7 days
        const smsCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.smsQueue.failedMaxAgeDays * 24 * 60 * 60 * 1000);
        const smsSnapshot = await db.collection('sms_queue')
            .where('status', '==', 'failed')
            .where('failedAt', '<', admin.firestore.Timestamp.fromDate(smsCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!smsSnapshot.empty) {
            const batch = db.batch();
            smsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        // Sent emails older than 30 days
        const sentEmailCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.emailQueue.sentMaxAgeDays * 24 * 60 * 60 * 1000);
        const sentEmailSnapshot = await db.collection('sent_emails')
            .where('sentAt', '<', admin.firestore.Timestamp.fromDate(sentEmailCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!sentEmailSnapshot.empty) {
            const batch = db.batch();
            sentEmailSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        // Sent SMS older than 30 days
        const sentSMSCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.smsQueue.sentMaxAgeDays * 24 * 60 * 60 * 1000);
        const sentSMSSnapshot = await db.collection('sent_sms')
            .where('sentAt', '<', admin.firestore.Timestamp.fromDate(sentSMSCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!sentSMSSnapshot.empty) {
            const batch = db.batch();
            sentSMSSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        console.log(`[Cleanup] Message queues deleted: ${deletedCount}`);
        return { type: 'message_queues', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Message queue cleanup failed:', error);
        return { type: 'message_queues', error: error.message };
    }
}

/**
 * Cleanup expired cache entries
 */
async function cleanupCache() {
    try {
        const cutoffTime = new Date(Date.now() - CLEANUP_CONFIG.retention.cache.maxAgeMinutes * 60 * 1000);
        let deletedCount = 0;

        const snapshot = await db.collection('cache')
            .where('expiresAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
            await batch.commit();
        }

        console.log(`[Cleanup] Cache entries deleted: ${deletedCount}`);
        return { collection: 'cache', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Cache cleanup failed:', error);
        return { collection: 'cache', error: error.message };
    }
}

/**
 * Cleanup orphaned records
 */
async function cleanupOrphanRecords() {
    try {
        let deletedCount = 0;

        // Cleanup payment-invoice links where invoice or payment no longer exists
        const linkSnapshot = await db.collection('payment_invoice_links')
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!linkSnapshot.empty) {
            const batch = db.batch();
            
            for (const doc of linkSnapshot.docs) {
                const data = doc.data();
                
                const invoiceExists = await db.collection('invoices').doc(data.invoiceId).get();
                const paymentExists = await db.collection('payments').doc(data.paymentId).get();
                
                if (!invoiceExists.exists || !paymentExists.exists) {
                    batch.delete(doc.ref);
                    deletedCount++;
                }
            }
            
            await batch.commit();
        }

        // Cleanup task dependencies for deleted tasks
        const taskSnapshot = await db.collection('task_dependencies')
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!taskSnapshot.empty) {
            const batch = db.batch();
            
            for (const doc of taskSnapshot.docs) {
                const data = doc.data();
                const taskExists = await db.collection('tasks').doc(data.taskId).get();
                
                if (!taskExists.exists) {
                    batch.delete(doc.ref);
                    deletedCount++;
                }
            }
            
            await batch.commit();
        }

        console.log(`[Cleanup] Orphan records deleted: ${deletedCount}`);
        return { type: 'orphans', deleted: deletedCount };
    } catch (error) {
        console.error('[Cleanup] Orphan cleanup failed:', error);
        return { type: 'orphans', error: error.message };
    }
}

/**
 * Aggregate metrics
 */
async function aggregateMetrics() {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        // Count today's metrics
        const metrics = {
            date: today.toISOString().split('T')[0],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // New leads today
        const leadsSnapshot = await db.collection('leads')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .count().get();
        metrics.newLeads = leadsSnapshot.data().count;

        // New clients today
        const clientsSnapshot = await db.collection('clients')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .count().get();
        metrics.newClients = clientsSnapshot.data().count;

        // Deals won today
        const dealsSnapshot = await db.collection('deals')
            .where('status', '==', 'won')
            .where('wonAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .count().get();
        metrics.dealsWon = dealsSnapshot.data().count;

        // Revenue today
        const paymentsSnapshot = await db.collection('payments')
            .where('status', '==', 'completed')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .get();
        
        metrics.revenueToday = 0;
        paymentsSnapshot.forEach(doc => {
            metrics.revenueToday += (doc.data().amount || 0);
        });

        // Tasks completed today
        const tasksSnapshot = await db.collection('tasks')
            .where('status', '==', 'done')
            .where('completedAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .count().get();
        metrics.tasksCompleted = tasksSnapshot.data().count;

        // Active users today
        const sessionsSnapshot = await db.collection('sessions')
            .where('lastActivity', '>=', admin.firestore.Timestamp.fromDate(today))
            .count().get();
        metrics.activeUsers = sessionsSnapshot.data().count;

        // Save aggregated metrics
        await db.collection('metrics').doc(today.toISOString().split('T')[0]).set(metrics);

        // Cleanup raw metrics older than retention
        const rawCutoff = new Date(Date.now() - CLEANUP_CONFIG.retention.metrics.rawMaxAgeDays * 24 * 60 * 60 * 1000);
        const rawSnapshot = await db.collection('raw_metrics')
            .where('timestamp', '<', admin.firestore.Timestamp.fromDate(rawCutoff))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        if (!rawSnapshot.empty) {
            const batch = db.batch();
            rawSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        console.log(`[Cleanup] Metrics aggregated for ${metrics.date}`);
        return { type: 'metrics', metrics };
    } catch (error) {
        console.error('[Cleanup] Metrics aggregation failed:', error);
        return { type: 'metrics', error: error.message };
    }
}

/**
 * Anonymize user data for GDPR compliance
 */
async function anonymizeGDPRData() {
    try {
        const cutoffTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        let processedCount = 0;

        // Find deletion requests older than 90 days
        const requestsSnapshot = await db.collection('deletion_requests')
            .where('status', '==', 'approved')
            .where('approvedAt', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
            .limit(CLEANUP_CONFIG.batchSize)
            .get();

        for (const doc of requestsSnapshot.docs) {
            const requestData = doc.data();
            const userId = requestData.userId;

            if (userId) {
                // Anonymize user data
                await db.collection('users').doc(userId).update({
                    name: '[Deleted User]',
                    email: `deleted_${userId}@anonymous.com`,
                    phone: null,
                    address: null,
                    photoURL: null,
                    deleted: true,
                    anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
                    originalEmail: admin.firestore.FieldValue.delete(),
                    originalPhone: admin.firestore.FieldValue.delete()
                });

                // Anonymize related records
                const collectionsToAnonymize = ['clients', 'leads', 'contacts'];
                
                for (const collectionName of collectionsToAnonymize) {
                    const relatedSnapshot = await db.collection(collectionName)
                        .where('createdBy', '==', userId)
                        .limit(CLEANUP_CONFIG.batchSize)
                        .get();

                    const batch = db.batch();
                    relatedSnapshot.forEach(relatedDoc => {
                        batch.update(relatedDoc.ref, {
                            createdBy: 'anonymous',
                            anonymizedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                }

                // Delete auth user
                try {
                    await auth.deleteUser(userId);
                } catch (authError) {
                    console.warn(`[Cleanup] Failed to delete auth user ${userId}:`, authError.message);
                }

                processedCount++;
            }

            // Mark request as completed
            await doc.ref.update({
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`[Cleanup] GDPR anonymization processed: ${processedCount}`);
        return { type: 'gdpr', processed: processedCount };
    } catch (error) {
        console.error('[Cleanup] GDPR anonymization failed:', error);
        return { type: 'gdpr', error: error.message };
    }
}

/**
 * Send cleanup summary notification
 */
async function sendCleanupSummary(results) {
    try {
        const totalDeleted = results.reduce((sum, r) => sum + (r.deleted || r.processed || 0), 0);
        const errors = results.filter(r => r.error);

        if (errors.length > 0 || totalDeleted > 100) {
            await db.collection('admin_alerts').add({
                title: 'Data Cleanup Summary',
                message: `Cleaned up ${totalDeleted} records. ${errors.length} errors.`,
                details: results,
                severity: errors.length > 0 ? 'warning' : 'info',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('[Cleanup] Summary notification failed:', error);
    }
}

// ============================================================
// SCHEDULED CLOUD FUNCTIONS
// ============================================================

/**
 * OTP Cleanup - Every 15 minutes
 */
exports.scheduledOTPCleanup = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async (context) => {
        const result = await cleanupOTPs();
        return result;
    });

/**
 * Session Cleanup - Every hour
 */
exports.scheduledSessionCleanup = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const result = await cleanupSessions();
        return result;
    });

/**
 * Cache Cleanup - Every 30 minutes
 */
exports.scheduledCacheCleanup = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async (context) => {
        const result = await cleanupCache();
        return result;
    });

/**
 * Temp File Cleanup - Every 6 hours
 */
exports.scheduledTempFileCleanup = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        const result = await cleanupTempFiles();
        return result;
    });

/**
 * Metrics Aggregation - Every hour
 */
exports.scheduledMetricsAggregation = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const result = await aggregateMetrics();
        return result;
    });

/**
 * Daily Cleanup - Every day at 3 AM
 */
exports.scheduledDailyCleanup = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        console.log('[Cleanup] Starting daily cleanup...');
        
        const results = [];
        
        results.push(await cleanupLogs());
        results.push(await cleanupNotifications());
        results.push(await cleanupMessageQueues());
        results.push(await cleanupSoftDeletedRecords());
        results.push(await cleanupOrphanRecords());
        results.push(await anonymizeGDPRData());
        
        const flatResults = results.flat();
        await sendCleanupSummary(flatResults);
        
        console.log('[Cleanup] Daily cleanup completed');
        return { results: flatResults };
    });

/**
 * Manual cleanup trigger
 */
exports.triggerManualCleanup = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userRole = userDoc.data()?.role;
        
        if (!['admin', 'super_admin'].includes(userRole)) {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required');
        }

        const { targets } = data || {};
        const results = [];

        if (!targets || targets.includes('otps')) results.push(await cleanupOTPs());
        if (!targets || targets.includes('sessions')) results.push(await cleanupSessions());
        if (!targets || targets.includes('cache')) results.push(await cleanupCache());
        if (!targets || targets.includes('tempFiles')) results.push(await cleanupTempFiles());
        if (!targets || targets.includes('logs')) results.push(await cleanupLogs());
        if (!targets || targets.includes('notifications')) results.push(await cleanupNotifications());
        if (!targets || targets.includes('queues')) results.push(await cleanupMessageQueues());
        if (!targets || targets.includes('softDelete')) results.push(await cleanupSoftDeletedRecords());
        if (!targets || targets.includes('orphans')) results.push(await cleanupOrphanRecords());
        if (!targets || targets.includes('metrics')) results.push(await aggregateMetrics());
        if (!targets || targets.includes('gdpr')) results.push(await anonymizeGDPRData());

        return { success: true, results: results.flat() };

    } catch (error) {
        console.error('[Cleanup] Manual cleanup failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get cleanup stats
 */
exports.getCleanupStats = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }

        const stats = {};

        try {
            const otpCount = await db.collection('otps').count().get();
            stats.otps = otpCount.data().count;
        } catch (e) { stats.otps = -1; }

        try {
            const sessionCount = await db.collection('sessions').count().get();
            stats.sessions = sessionCount.data().count;
        } catch (e) { stats.sessions = -1; }

        try {
            const cacheCount = await db.collection('cache').count().get();
            stats.cache = cacheCount.data().count;
        } catch (e) { stats.cache = -1; }

        try {
            const notifCount = await db.collection('notifications').count().get();
            stats.notifications = notifCount.data().count;
        } catch (e) { stats.notifications = -1; }

        try {
            const emailQueueCount = await db.collection('email_queue').where('status', '==', 'pending').count().get();
            stats.pendingEmails = emailQueueCount.data().count;
        } catch (e) { stats.pendingEmails = -1; }

        try {
            const smsQueueCount = await db.collection('sms_queue').where('status', '==', 'pending').count().get();
            stats.pendingSMS = smsQueueCount.data().count;
        } catch (e) { stats.pendingSMS = -1; }

        return { success: true, stats };

    } catch (error) {
        console.error('[Cleanup] Stats fetch failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

module.exports = exports;
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
