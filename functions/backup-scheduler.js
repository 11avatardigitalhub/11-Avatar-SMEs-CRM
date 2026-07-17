/**
 * 11 AVATAR DIGITAL HUB - Backup Scheduler Cloud Function
 * Enterprise-grade Firebase Cloud Function for automated backups
 * Scheduled backups, Firestore export, Storage sync, retention, notifications
 * 
 * @function backupScheduler
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const stream = require('stream');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const storage = new Storage();
const firestore = new Firestore();

/**
 * Backup Configuration
 */
const BACKUP_CONFIG = {
    projectId: process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'avatar-wa-dual-crm',
    bucketName: `${process.env.GCP_PROJECT || 'avatar-wa-dual-crm'}.appspot.com`,
    backupBucketName: process.env.BACKUP_BUCKET || `${process.env.GCP_PROJECT || 'avatar-wa-dual-crm'}-backups`,
    
    collections: [
        'users', 'clients', 'leads', 'contacts', 'deals', 'invoices', 
        'payments', 'tasks', 'projects', 'retainers', 'training_courses',
        'referrals', 'notifications', 'settings', 'email_templates',
        'sms_templates', 'whatsapp_templates', 'calendar_events',
        'locations', 'territories', 'routes', 'webhook_events',
        'email_queue', 'sms_queue', 'sent_emails', 'sent_sms',
        'otps', 'otp_logs', 'audit_logs', 'metrics', 'reports'
    ],
    
    excludeCollections: [
        'otps', 'otp_logs', 'webhook_events', 'email_queue', 
        'sms_queue', 'cache', 'sessions', 'temp'
    ],
    
    schedules: {
        full: { cron: '0 2 * * 0', retention: 12, label: 'Weekly Full' },
        incremental: { cron: '0 2 * * 1-6', retention: 7, label: 'Daily Incremental' },
        config: { cron: '0 3 * * 0', retention: 24, label: 'Weekly Config' }
    },
    
    retention: {
        full: 12, // 12 weeks
        incremental: 7, // 7 days
        config: 24, // 24 weeks
        maxBackups: 100
    },
    
    compression: {
        enabled: true,
        format: 'zip'
    },
    
    encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm'
    },
    
    notifications: {
        onSuccess: process.env.BACKUP_NOTIFY_SUCCESS === 'true',
        onFailure: true,
        email: process.env.BACKUP_NOTIFY_EMAIL || '',
        slackWebhook: process.env.BACKUP_SLACK_WEBHOOK || ''
    }
};

/**
 * Create full backup
 */
async function createFullBackup(metadata = {}) {
    const backupId = `full-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const startTime = Date.now();
    
    try {
        console.log(`[Backup] Starting full backup: ${backupId}`);
        
        await updateBackupStatus(backupId, 'in_progress', { type: 'full', ...metadata });
        
        // Create temp directory
        const tempDir = path.join(os.tmpdir(), backupId);
        fs.mkdirSync(tempDir, { recursive: true });
        
        const backupData = {
            id: backupId,
            type: 'full',
            timestamp: new Date().toISOString(),
            collections: {},
            metadata: metadata,
            version: '2.0.0'
        };
        
        // Export all collections
        const collections = BACKUP_CONFIG.collections.filter(
            col => !BACKUP_CONFIG.excludeCollections.includes(col)
        );
        
        let totalDocs = 0;
        let totalSize = 0;
        
        for (const collectionName of collections) {
            console.log(`[Backup] Exporting collection: ${collectionName}`);
            
            const documents = await exportCollection(collectionName);
            
            backupData.collections[collectionName] = {
                count: documents.length,
                data: documents
            };
            
            totalDocs += documents.length;
            totalSize += JSON.stringify(documents).length;
            
            // Write to temp file
            const filePath = path.join(tempDir, `${collectionName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
        }
        
        // Create manifest
        const manifest = {
            backupId,
            type: 'full',
            createdAt: new Date().toISOString(),
            collections: Object.keys(backupData.collections).map(name => ({
                name,
                count: backupData.collections[name].count
            })),
            totalDocuments: totalDocs,
            totalSize: totalSize,
            version: '2.0.0'
        };
        
        fs.writeFileSync(
            path.join(tempDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
        
        // Compress backup
        let backupFile;
        if (BACKUP_CONFIG.compression.enabled) {
            backupFile = await compressBackup(tempDir, backupId);
        } else {
            backupFile = path.join(tempDir, 'backup.json');
            fs.writeFileSync(backupFile, JSON.stringify(backupData));
        }
        
        // Upload to storage
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const destination = `backups/${backupId}.zip`;
        
        await bucket.upload(backupFile, {
            destination,
            metadata: {
                contentType: 'application/zip',
                metadata: {
                    backupId,
                    type: 'full',
                    totalDocuments: String(totalDocs),
                    totalSize: String(totalSize)
                }
            }
        });
        
        // Cleanup temp files
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        // Update status
        const duration = Date.now() - startTime;
        const fileSize = fs.statSync(backupFile).size;
        
        await updateBackupStatus(backupId, 'completed', {
            totalDocuments: totalDocs,
            totalSize: fileSize,
            duration,
            storagePath: destination
        });
        
        // Apply retention policy
        await applyRetentionPolicy('full');
        
        // Send notification
        if (BACKUP_CONFIG.notifications.onSuccess) {
            await sendBackupNotification({
                backupId,
                type: 'full',
                status: 'completed',
                totalDocuments: totalDocs,
                fileSize: formatFileSize(fileSize),
                duration: formatDuration(duration)
            });
        }
        
        console.log(`[Backup] Full backup completed: ${backupId} (${totalDocs} docs, ${formatFileSize(fileSize)}, ${formatDuration(duration)})`);
        
        return { backupId, totalDocuments, fileSize, duration };
        
    } catch (error) {
        console.error(`[Backup] Full backup failed: ${backupId}`, error);
        
        await updateBackupStatus(backupId, 'failed', {
            error: error.message,
            duration: Date.now() - startTime
        });
        
        if (BACKUP_CONFIG.notifications.onFailure) {
            await sendBackupNotification({
                backupId,
                type: 'full',
                status: 'failed',
                error: error.message
            }, 'error');
        }
        
        throw error;
    }
}

/**
 * Create incremental backup (changes since last backup)
 */
async function createIncrementalBackup(metadata = {}) {
    const backupId = `inc-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const startTime = Date.now();
    
    try {
        console.log(`[Backup] Starting incremental backup: ${backupId}`);
        
        await updateBackupStatus(backupId, 'in_progress', { type: 'incremental', ...metadata });
        
        // Get last backup timestamp
        const lastBackup = await getLastBackupTimestamp();
        
        const backupData = {
            id: backupId,
            type: 'incremental',
            timestamp: new Date().toISOString(),
            sinceTimestamp: lastBackup?.toISOString() || null,
            collections: {},
            metadata: metadata,
            version: '2.0.0'
        };
        
        const collections = BACKUP_CONFIG.collections.filter(
            col => !BACKUP_CONFIG.excludeCollections.includes(col)
        );
        
        let totalDocs = 0;
        
        for (const collectionName of collections) {
            const documents = await exportCollectionChanges(collectionName, lastBackup);
            
            if (documents.length > 0) {
                backupData.collections[collectionName] = {
                    count: documents.length,
                    data: documents
                };
                totalDocs += documents.length;
            }
        }
        
        // If no changes, skip backup
        if (totalDocs === 0) {
            console.log(`[Backup] No changes detected, skipping incremental backup`);
            
            await updateBackupStatus(backupId, 'completed', {
                totalDocuments: 0,
                duration: Date.now() - startTime,
                skipped: true
            });
            
            return { backupId, totalDocuments: 0, skipped: true };
        }
        
        // Compress and upload
        const tempDir = path.join(os.tmpdir(), backupId);
        fs.mkdirSync(tempDir, { recursive: true });
        
        const backupPath = path.join(tempDir, 'backup.json');
        fs.writeFileSync(backupPath, JSON.stringify(backupData));
        
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const destination = `backups/${backupId}.json`;
        
        await bucket.upload(backupPath, {
            destination,
            metadata: {
                contentType: 'application/json',
                metadata: {
                    backupId,
                    type: 'incremental',
                    totalDocuments: String(totalDocs)
                }
            }
        });
        
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        const duration = Date.now() - startTime;
        
        await updateBackupStatus(backupId, 'completed', {
            totalDocuments: totalDocs,
            duration,
            storagePath: destination
        });
        
        await applyRetentionPolicy('incremental');
        
        console.log(`[Backup] Incremental backup completed: ${backupId} (${totalDocs} changes, ${formatDuration(duration)})`);
        
        return { backupId, totalDocuments: totalDocs, duration };
        
    } catch (error) {
        console.error(`[Backup] Incremental backup failed: ${backupId}`, error);
        
        await updateBackupStatus(backupId, 'failed', {
            error: error.message,
            duration: Date.now() - startTime
        });
        
        throw error;
    }
}

/**
 * Create configuration backup
 */
async function createConfigBackup(metadata = {}) {
    const backupId = `cfg-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const startTime = Date.now();
    
    try {
        console.log(`[Backup] Starting config backup: ${backupId}`);
        
        await updateBackupStatus(backupId, 'in_progress', { type: 'config', ...metadata });
        
        const configCollections = ['settings', 'email_templates', 'sms_templates', 'whatsapp_templates'];
        
        const backupData = {
            id: backupId,
            type: 'config',
            timestamp: new Date().toISOString(),
            collections: {},
            metadata: metadata
        };
        
        for (const collectionName of configCollections) {
            const documents = await exportCollection(collectionName);
            backupData.collections[collectionName] = {
                count: documents.length,
                data: documents
            };
        }
        
        // Also backup environment config (sanitized)
        backupData.environment = {
            projectId: BACKUP_CONFIG.projectId,
            functionsRegion: process.env.FUNCTION_REGION || 'us-central1',
            databaseURL: process.env.DATABASE_URL || '',
            storageBucket: BACKUP_CONFIG.bucketName
        };
        
        const tempDir = path.join(os.tmpdir(), backupId);
        fs.mkdirSync(tempDir, { recursive: true });
        
        const backupPath = path.join(tempDir, 'config-backup.json');
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const destination = `backups/${backupId}.json`;
        
        await bucket.upload(backupPath, {
            destination,
            metadata: {
                contentType: 'application/json',
                metadata: { backupId, type: 'config' }
            }
        });
        
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        const duration = Date.now() - startTime;
        
        await updateBackupStatus(backupId, 'completed', { duration, storagePath: destination });
        await applyRetentionPolicy('config');
        
        console.log(`[Backup] Config backup completed: ${backupId} (${formatDuration(duration)})`);
        
        return { backupId, duration };
        
    } catch (error) {
        console.error(`[Backup] Config backup failed: ${backupId}`, error);
        
        await updateBackupStatus(backupId, 'failed', {
            error: error.message,
            duration: Date.now() - startTime
        });
        
        throw error;
    }
}

/**
 * Export entire collection
 */
async function exportCollection(collectionName, batchSize = 500) {
    const documents = [];
    let lastDoc = null;
    
    while (true) {
        let query = db.collection(collectionName).limit(batchSize);
        
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) break;
        
        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                ...doc.data(),
                _exportedAt: new Date().toISOString()
            });
        });
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        if (snapshot.size < batchSize) break;
    }
    
    return documents;
}

/**
 * Export collection changes since timestamp
 */
async function exportCollectionChanges(collectionName, sinceTimestamp, batchSize = 500) {
    if (!sinceTimestamp) return exportCollection(collectionName, batchSize);
    
    const documents = [];
    let lastDoc = null;
    
    const firestoreTimestamp = admin.firestore.Timestamp.fromDate(sinceTimestamp);
    
    while (true) {
        let query = db.collection(collectionName)
            .where('updatedAt', '>=', firestoreTimestamp)
            .limit(batchSize);
        
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) break;
        
        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                ...doc.data(),
                _exportedAt: new Date().toISOString()
            });
        });
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        if (snapshot.size < batchSize) break;
    }
    
    return documents;
}

/**
 * Compress backup directory
 */
function compressBackup(sourceDir, backupId) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(os.tmpdir(), `${backupId}.zip`);
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => resolve(outputPath));
        archive.on('error', reject);
        
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

/**
 * Get last backup timestamp
 */
async function getLastBackupTimestamp() {
    const snapshot = await db.collection('backup_history')
        .where('status', '==', 'completed')
        .where('type', 'in', ['full', 'incremental'])
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data().createdAt?.toDate() || null;
}

/**
 * Update backup status in Firestore
 */
async function updateBackupStatus(backupId, status, additionalData = {}) {
    const backupRef = db.collection('backup_history').doc(backupId);
    
    await backupRef.set({
        id: backupId,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(status === 'in_progress' ? { 
            createdAt: admin.firestore.FieldValue.serverTimestamp() 
        } : {}),
        ...(status === 'completed' ? { 
            completedAt: admin.firestore.FieldValue.serverTimestamp() 
        } : {}),
        ...additionalData
    }, { merge: true });
}

/**
 * Apply retention policy
 */
async function applyRetentionPolicy(type) {
    try {
        const retention = BACKUP_CONFIG.retention[type] || 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retention);
        
        const snapshot = await db.collection('backup_history')
            .where('type', '==', type)
            .where('status', '==', 'completed')
            .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
            .orderBy('createdAt', 'asc')
            .get();
        
        if (snapshot.empty) return;
        
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const batch = db.batch();
        let deletedCount = 0;
        
        for (const doc of snapshot.docs) {
            const backupData = doc.data();
            
            // Delete from storage
            if (backupData.storagePath) {
                try {
                    await bucket.file(backupData.storagePath).delete();
                } catch (err) {
                    console.warn(`[Backup] Failed to delete storage file: ${backupData.storagePath}`, err.message);
                }
            }
            
            // Delete from Firestore
            batch.delete(doc.ref);
            deletedCount++;
        }
        
        await batch.commit();
        
        console.log(`[Backup] Retention applied: deleted ${deletedCount} old ${type} backups`);
        
    } catch (error) {
        console.error('[Backup] Retention policy application failed:', error);
    }
}

/**
 * Cleanup excess backups beyond maxBackups
 */
async function cleanupExcessBackups() {
    try {
        const snapshot = await db.collection('backup_history')
            .where('status', '==', 'completed')
            .orderBy('createdAt', 'desc')
            .get();
        
        const maxBackups = BACKUP_CONFIG.retention.maxBackups;
        
        if (snapshot.size <= maxBackups) return;
        
        const excessDocs = snapshot.docs.slice(maxBackups);
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const batch = db.batch();
        
        for (const doc of excessDocs) {
            const backupData = doc.data();
            
            if (backupData.storagePath) {
                try {
                    await bucket.file(backupData.storagePath).delete();
                } catch (err) {
                    console.warn(`[Backup] Failed to delete excess storage file`, err.message);
                }
            }
            
            batch.delete(doc.ref);
        }
        
        await batch.commit();
        
        console.log(`[Backup] Cleaned up ${excessDocs.length} excess backups`);
        
    } catch (error) {
        console.error('[Backup] Excess cleanup failed:', error);
    }
}

/**
 * Verify backup integrity
 */
async function verifyBackupIntegrity(backupId) {
    try {
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const backupDoc = await db.collection('backup_history').doc(backupId).get();
        
        if (!backupDoc.exists) {
            return { valid: false, error: 'Backup record not found' };
        }
        
        const backupData = backupDoc.data();
        
        // Check storage file exists
        if (backupData.storagePath) {
            const [exists] = await bucket.file(backupData.storagePath).exists();
            
            if (!exists) {
                await backupDoc.ref.update({ verified: false, verificationError: 'Storage file missing' });
                return { valid: false, error: 'Storage file missing' };
            }
            
            // Get file metadata
            const [metadata] = await bucket.file(backupData.storagePath).getMetadata();
            
            await backupDoc.ref.update({
                verified: true,
                verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                fileSize: parseInt(metadata.size),
                contentType: metadata.contentType
            });
            
            return { valid: true, size: parseInt(metadata.size) };
        }
        
        return { valid: false, error: 'No storage path' };
        
    } catch (error) {
        console.error(`[Backup] Verification failed for ${backupId}:`, error);
        return { valid: false, error: error.message };
    }
}

/**
 * Send backup notification
 */
async function sendBackupNotification(data, level = 'info') {
    try {
        // Email notification
        if (BACKUP_CONFIG.notifications.email) {
            await db.collection('notifications').add({
                type: 'backup',
                title: `Backup ${data.status}`,
                message: `${data.type} backup ${data.backupId} ${data.status}. ${data.totalDocuments || 0} documents, ${data.fileSize || 'N/A'}, ${data.duration || 'N/A'}`,
                recipientEmail: BACKUP_CONFIG.notifications.email,
                channels: ['email'],
                data,
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Slack notification
        if (BACKUP_CONFIG.notifications.slackWebhook) {
            const axios = require('axios');
            
            const color = data.status === 'completed' ? '#36a64f' : '#dc3545';
            const icon = data.status === 'completed' ? '✅' : '❌';
            
            await axios.post(BACKUP_CONFIG.notifications.slackWebhook, {
                attachments: [{
                    color,
                    title: `${icon} Backup ${data.status.toUpperCase()}`,
                    fields: [
                        { title: 'Backup ID', value: data.backupId, short: true },
                        { title: 'Type', value: data.type, short: true },
                        { title: 'Documents', value: String(data.totalDocuments || 'N/A'), short: true },
                        { title: 'Size', value: data.fileSize || 'N/A', short: true },
                        { title: 'Duration', value: data.duration || 'N/A', short: true }
                    ],
                    footer: '11 Avatar Digital Hub - Backup Scheduler',
                    ts: Math.floor(Date.now() / 1000)
                }]
            });
        }
        
    } catch (error) {
        console.error('[Backup] Notification failed:', error);
    }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// ============================================================
// CLOUD FUNCTIONS
// ============================================================

/**
 * Weekly full backup (Sunday 2 AM)
 */
exports.scheduledFullBackup = functions.pubsub
    .schedule('0 2 * * 0')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            console.log('[Backup] Starting scheduled full backup');
            const result = await createFullBackup({ trigger: 'scheduled' });
            return { success: true, ...result };
        } catch (error) {
            console.error('[Backup] Scheduled full backup failed:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Daily incremental backup (Monday-Saturday 2 AM)
 */
exports.scheduledIncrementalBackup = functions.pubsub
    .schedule('0 2 * * 1-6')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            console.log('[Backup] Starting scheduled incremental backup');
            const result = await createIncrementalBackup({ trigger: 'scheduled' });
            return { success: true, ...result };
        } catch (error) {
            console.error('[Backup] Scheduled incremental backup failed:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Weekly config backup (Sunday 3 AM)
 */
exports.scheduledConfigBackup = functions.pubsub
    .schedule('0 3 * * 0')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            console.log('[Backup] Starting scheduled config backup');
            const result = await createConfigBackup({ trigger: 'scheduled' });
            return { success: true, ...result };
        } catch (error) {
            console.error('[Backup] Scheduled config backup failed:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Manual backup trigger (HTTP callable)
 */
exports.createManualBackup = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        // Check admin permission
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userRole = userDoc.data()?.role;
        
        if (!['admin', 'super_admin'].includes(userRole)) {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required');
        }
        
        const { type, metadata } = data;
        
        let result;
        switch (type) {
            case 'full':
                result = await createFullBackup({ ...metadata, trigger: 'manual', userId: context.auth.uid });
                break;
            case 'incremental':
                result = await createIncrementalBackup({ ...metadata, trigger: 'manual', userId: context.auth.uid });
                break;
            case 'config':
                result = await createConfigBackup({ ...metadata, trigger: 'manual', userId: context.auth.uid });
                break;
            default:
                throw new functions.https.HttpsError('invalid-argument', 'Invalid backup type');
        }
        
        return { success: true, ...result };
        
    } catch (error) {
        console.error('[Backup] Manual backup failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get backup history
 */
exports.getBackupHistory = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const { limit = 20, type } = data || {};
        
        let query = db.collection('backup_history')
            .orderBy('createdAt', 'desc');
        
        if (type) {
            query = query.where('type', '==', type);
        }
        
        const snapshot = await query.limit(limit).get();
        
        const backups = [];
        snapshot.forEach(doc => {
            const backupData = doc.data();
            backups.push({
                id: doc.id,
                type: backupData.type,
                status: backupData.status,
                totalDocuments: backupData.totalDocuments,
                duration: backupData.duration,
                createdAt: backupData.createdAt?.toDate()?.toISOString(),
                completedAt: backupData.completedAt?.toDate()?.toISOString(),
                fileSize: backupData.fileSize
            });
        });
        
        return { success: true, backups };
        
    } catch (error) {
        console.error('[Backup] History fetch failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Verify backup
 */
exports.verifyBackup = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const { backupId } = data;
        if (!backupId) {
            throw new functions.https.HttpsError('invalid-argument', 'Backup ID required');
        }
        
        const result = await verifyBackupIntegrity(backupId);
        return { success: true, ...result };
        
    } catch (error) {
        console.error('[Backup] Verification failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Restore from backup
 */
exports.restoreBackup = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userRole = userDoc.data()?.role;
        
        if (!['admin', 'super_admin'].includes(userRole)) {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required');
        }
        
        const { backupId, collections, dryRun } = data;
        if (!backupId) {
            throw new functions.https.HttpsError('invalid-argument', 'Backup ID required');
        }
        
        // Get backup record
        const backupDoc = await db.collection('backup_history').doc(backupId).get();
        
        if (!backupDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Backup not found');
        }
        
        const backupData = backupDoc.data();
        
        if (!backupData.storagePath) {
            throw new functions.https.HttpsError('failed-precondition', 'Backup file not available');
        }
        
        // Download backup file
        const bucket = storage.bucket(BACKUP_CONFIG.backupBucketName);
        const tempPath = path.join(os.tmpdir(), `${backupId}.json`);
        
        await bucket.file(backupData.storagePath).download({ destination: tempPath });
        
        const backupContent = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
        fs.unlinkSync(tempPath);
        
        const collectionsToRestore = collections || Object.keys(backupContent.collections || {});
        
        if (dryRun) {
            let totalDocuments = 0;
            collectionsToRestore.forEach(col => {
                totalDocuments += backupContent.collections[col]?.count || 0;
            });
            
            return {
                success: true,
                dryRun: true,
                collections: collectionsToRestore,
                totalDocuments,
                message: `Would restore ${totalDocuments} documents across ${collectionsToRestore.length} collections`
            };
        }
        
        // Restore data
        let restoredCount = 0;
        const batchSize = 500;
        
        for (const collectionName of collectionsToRestore) {
            const collectionData = backupContent.collections[collectionName];
            if (!collectionData || !collectionData.data) continue;
            
            const documents = collectionData.data;
            
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = db.batch();
                const chunk = documents.slice(i, i + batchSize);
                
                chunk.forEach(doc => {
                    const docRef = db.collection(collectionName).doc(doc.id);
                    const cleanData = { ...doc };
                    delete cleanData.id;
                    delete cleanData._exportedAt;
                    
                    batch.set(docRef, {
                        ...cleanData,
                        restoredAt: admin.firestore.FieldValue.serverTimestamp(),
                        restoredFrom: backupId
                    }, { merge: true });
                });
                
                await batch.commit();
                restoredCount += chunk.length;
            }
        }
        
        // Update backup record
        await backupDoc.ref.update({
            lastRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRestoredBy: context.auth.uid,
            restoreCount: restoredCount
        });
        
        return {
            success: true,
            restoredCount,
            collections: collectionsToRestore
        };
        
    } catch (error) {
        console.error('[Backup] Restore failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Daily cleanup of old backups
 */
exports.cleanupOldBackups = functions.pubsub
    .schedule('0 4 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            await applyRetentionPolicy('full');
            await applyRetentionPolicy('incremental');
            await applyRetentionPolicy('config');
            await cleanupExcessBackups();
            
            return { success: true };
        } catch (error) {
            console.error('[Backup] Cleanup failed:', error);
            return { success: false, error: error.message };
        }
    });

module.exports = exports;

