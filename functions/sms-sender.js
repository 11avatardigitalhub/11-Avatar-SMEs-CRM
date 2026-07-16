/**
 * 11 AVATAR DIGITAL HUB - SMS Sender Cloud Function
 * Enterprise-grade Firebase Cloud Function for SMS delivery
 * Twilio, MSG91, TextLocal, Gupshup, DLT compliance, OTP, bulk SMS
 * 
 * @function smsSender
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * SMS Configuration
 */
const SMS_CONFIG = {
    defaultProvider: process.env.SMS_PROVIDER || 'msg91',
    
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        fromNumber: process.env.TWILIO_FROM_NUMBER || '',
        statusCallback: process.env.TWILIO_STATUS_CALLBACK || ''
    },
    
    msg91: {
        authKey: process.env.MSG91_AUTH_KEY || '',
        senderId: process.env.MSG91_SENDER_ID || 'AVATAR',
        route: '4',
        country: '91',
        apiEndpoint: 'https://api.msg91.com/api/v5/flow/'
    },
    
    textlocal: {
        apiKey: process.env.TEXTLOCAL_API_KEY || '',
        senderId: process.env.TEXTLOCAL_SENDER_ID || 'AVATAR',
        apiEndpoint: 'https://api.textlocal.in/send/'
    },
    
    gupshup: {
        apiKey: process.env.GUPSHUP_API_KEY || '',
        appName: process.env.GUPSHUP_APP_NAME || '',
        apiEndpoint: 'https://api.gupshup.io/sm/api/v1/msg'
    },
    
    dlt: {
        enabled: process.env.DLT_ENABLED === 'true',
        entityId: process.env.DLT_ENTITY_ID || '',
        headerId: process.env.DLT_HEADER_ID || '',
        templateEndpoint: process.env.DLT_TEMPLATE_ENDPOINT || ''
    },
    
    limits: {
        transactional: { maxPerMinute: 100, maxPerHour: 5000, maxPerDay: 50000 },
        promotional: { maxPerMinute: 50, maxPerHour: 1000, maxPerDay: 10000 },
        otp: { maxPerMinute: 20, maxPerPhonePerDay: 5, maxPerPhonePerHour: 3 },
        maxBulkBatch: 1000,
        allowedHours: { start: 9, end: 21 }
    },
    
    retry: {
        maxAttempts: 3,
        backoffMs: 5000,
        backoffMultiplier: 2
    }
};

/**
 * OTP Configuration
 */
const OTP_CONFIG = {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    resendCooldownSeconds: 60,
    template: '{#var#} is your OTP for {#var#}. Valid for {#var#} minutes. Do not share. - 11 Avatar',
    allowedPurposes: ['authentication', 'verification', 'password_reset', 'login', 'registration']
};

/**
 * Send SMS via configured provider
 */
async function sendSMS(smsData) {
    const provider = smsData.provider || SMS_CONFIG.defaultProvider;
    
    switch (provider) {
        case 'twilio':
            return await sendViaTwilio(smsData);
        case 'msg91':
            return await sendViaMSG91(smsData);
        case 'textlocal':
            return await sendViaTextLocal(smsData);
        case 'gupshup':
            return await sendViaGupshup(smsData);
        default:
            return await sendViaMSG91(smsData);
    }
}

/**
 * Send via Twilio
 */
async function sendViaTwilio(smsData) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = SMS_CONFIG.twilio;
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new Error('Twilio credentials not configured');
    }
    
    const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    
    const message = await twilio.messages.create({
        body: smsData.content,
        from: SMS_CONFIG.twilio.fromNumber,
        to: formatPhoneNumber(smsData.to, 'e164'),
        statusCallback: SMS_CONFIG.twilio.statusCallback || undefined
    });
    
    console.log(`[SMS] Twilio sent: ${message.sid}`);
    
    return {
        success: true,
        messageId: message.sid,
        provider: 'twilio',
        status: message.status,
        segments: message.numSegments,
        price: message.price
    };
}

/**
 * Send via MSG91
 */
async function sendViaMSG91(smsData) {
    const { authKey, senderId, route, country, apiEndpoint } = SMS_CONFIG.msg91;
    
    if (!authKey) throw new Error('MSG91 auth key not configured');
    
    const phone = formatPhoneNumber(smsData.to, 'national');
    const isDLT = SMS_CONFIG.dlt.enabled && smsData.type === 'promotional';
    
    const payload = {
        template_id: smsData.dltTemplateId || '',
        sender: senderId,
        short_url: '0',
        mobiles: phone,
        VAR1: smsData.templateData?.var1 || smsData.content,
        VAR2: smsData.templateData?.var2 || '',
        VAR3: smsData.templateData?.var3 || ''
    };

    if (isDLT) {
        payload.entity_id = SMS_CONFIG.dlt.entityId;
        payload.header_id = SMS_CONFIG.dlt.headerId;
    }

    const axios = require('axios');
    
    const response = await axios.post(apiEndpoint, payload, {
        headers: {
            'authkey': authKey,
            'Content-Type': 'application/json'
        }
    });

    if (response.data.type === 'success') {
        console.log(`[SMS] MSG91 sent to ${phone}`);
        return {
            success: true,
            messageId: response.data.request_id || `msg91-${Date.now()}`,
            provider: 'msg91',
            status: 'sent'
        };
    } else {
        throw new Error(response.data.message || 'MSG91 send failed');
    }
}

/**
 * Send via TextLocal
 */
async function sendViaTextLocal(smsData) {
    const { apiKey, senderId, apiEndpoint } = SMS_CONFIG.textlocal;
    
    if (!apiKey) throw new Error('TextLocal API key not configured');
    
    const phone = formatPhoneNumber(smsData.to, 'national');
    
    const axios = require('axios');
    
    const params = new URLSearchParams({
        apikey: apiKey,
        sender: senderId,
        numbers: phone,
        message: smsData.content,
        test: process.env.TEXTLOCAL_TEST_MODE === 'true' ? 'true' : 'false'
    });

    const response = await axios.post(apiEndpoint, params);

    if (response.data.status === 'success') {
        console.log(`[SMS] TextLocal sent to ${phone}`);
        
        return {
            success: true,
            messageId: response.data.request_id || `tl-${Date.now()}`,
            provider: 'textlocal',
            status: 'sent',
            warnings: response.data.warnings || []
        };
    } else {
        const errorMsg = response.data.errors?.[0]?.message || 'TextLocal send failed';
        throw new Error(errorMsg);
    }
}

/**
 * Send via Gupshup
 */
async function sendViaGupshup(smsData) {
    const { apiKey, appName, apiEndpoint } = SMS_CONFIG.gupshup;
    
    if (!apiKey) throw new Error('Gupshup API key not configured');
    
    const phone = formatPhoneNumber(smsData.to, 'e164');
    
    const axios = require('axios');
    
    const payload = {
        source: appName,
        destination: phone,
        message: smsData.content,
        src: { name: appName }
    };

    const response = await axios.post(apiEndpoint, payload, {
        headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (response.data.status === 'submitted') {
        console.log(`[SMS] Gupshup sent to ${phone}`);
        
        return {
            success: true,
            messageId: response.data.messageId || `gs-${Date.now()}`,
            provider: 'gupshup',
            status: 'submitted'
        };
    } else {
        throw new Error(response.data.message || 'Gupshup send failed');
    }
}

/**
 * Generate OTP
 */
function generateOTP(length = OTP_CONFIG.length) {
    if (length === 4) return String(Math.floor(1000 + Math.random() * 9000));
    return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Create OTP record
 */
async function createOTP(phone, purpose, otp) {
    const otpRef = db.collection('otps').doc();
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000);
    
    await otpRef.set({
        phone: formatPhoneNumber(phone, 'national'),
        otp: otp,
        purpose: purpose,
        attempts: 0,
        maxAttempts: OTP_CONFIG.maxAttempts,
        verified: false,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return otpRef.id;
}

/**
 * Verify OTP
 */
async function verifyOTP(phone, otp, purpose) {
    const formattedPhone = formatPhoneNumber(phone, 'national');
    
    const snapshot = await db.collection('otps')
        .where('phone', '==', formattedPhone)
        .where('otp', '==', otp)
        .where('purpose', '==', purpose)
        .where('verified', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        return { success: false, error: 'Invalid OTP', code: 'invalid_otp' };
    }

    const otpDoc = snapshot.docs[0];
    const otpData = otpDoc.data();

    // Check expiry
    if (otpData.expiresAt.toDate() < new Date()) {
        return { success: false, error: 'OTP expired', code: 'expired' };
    }

    // Check attempts
    if (otpData.attempts >= otpData.maxAttempts) {
        return { success: false, error: 'Maximum attempts exceeded', code: 'max_attempts' };
    }

    // Mark as verified
    await otpDoc.ref.update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, verified: true };
}

/**
 * Format phone number
 */
function formatPhoneNumber(phone, format = 'national') {
    let cleaned = String(phone).replace(/[^\d]/g, '');
    
    if (format === 'national') {
        if (cleaned.length === 10) return cleaned;
        if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.substring(2);
        if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.substring(1);
        return cleaned;
    }
    
    if (format === 'e164') {
        if (cleaned.length === 10) return `+91${cleaned}`;
        if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
        if (!cleaned.startsWith('+')) return `+${cleaned}`;
        return cleaned;
    }
    
    return cleaned;
}

/**
 * Check if within allowed hours
 */
function isWithinAllowedHours() {
    const now = new Date();
    const hour = now.getHours();
    const { start, end } = SMS_CONFIG.limits.allowedHours;
    return hour >= start && hour < end;
}

/**
 * Get next allowed time
 */
function getNextAllowedTime() {
    const now = new Date();
    const { start } = SMS_CONFIG.limits.allowedHours;
    
    if (now.getHours() >= SMS_CONFIG.limits.allowedHours.end) {
        now.setDate(now.getDate() + 1);
        now.setHours(start, 0, 0, 0);
    } else {
        now.setHours(start, 0, 0, 0);
    }
    
    return now;
}

/**
 * Rate limiter for OTP
 */
async function checkOTPRateLimit(phone) {
    const formattedPhone = formatPhoneNumber(phone, 'national');
    
    // Check per hour limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourSnapshot = await db.collection('otps')
        .where('phone', '==', formattedPhone)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
        .get();

    if (hourSnapshot.size >= SMS_CONFIG.limits.otp.maxPerPhonePerHour) {
        return { allowed: false, error: 'Too many OTPs. Try again in an hour.', retryAfter: 3600 };
    }

    // Check per day limit
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const daySnapshot = await db.collection('otps')
        .where('phone', '==', formattedPhone)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneDayAgo))
        .get();

    if (daySnapshot.size >= SMS_CONFIG.limits.otp.maxPerPhonePerDay) {
        return { allowed: false, error: 'Daily OTP limit reached. Try again tomorrow.', retryAfter: 86400 };
    }

    // Check resend cooldown
    const cooldownAgo = new Date(Date.now() - OTP_CONFIG.resendCooldownSeconds * 1000);
    const cooldownSnapshot = await db.collection('otps')
        .where('phone', '==', formattedPhone)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(cooldownAgo))
        .get();

    if (cooldownSnapshot.size > 0) {
        const remainingSeconds = Math.ceil((cooldownSnapshot.docs[0].data().createdAt.toDate().getTime() + 
            OTP_CONFIG.resendCooldownSeconds * 1000 - Date.now()) / 1000);
        return { allowed: false, error: `Please wait ${remainingSeconds}s before requesting again.`, retryAfter: remainingSeconds };
    }

    return { allowed: true };
}

/**
 * Process SMS queue
 */
async function processSMSQueue(batchSize = 100) {
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        
        const snapshot = await db.collection('sms_queue')
            .where('status', '==', 'pending')
            .where('scheduledFor', '<=', now)
            .orderBy('scheduledFor', 'asc')
            .orderBy('priority', 'desc')
            .limit(batchSize)
            .get();

        if (snapshot.empty) {
            return { processed: 0, message: 'No pending SMS' };
        }

        const batch = db.batch();
        let processed = 0;
        let failed = 0;

        for (const doc of snapshot.docs) {
            const smsData = doc.data();
            
            // Check allowed hours for promotional SMS
            if (smsData.type === 'promotional' && !isWithinAllowedHours()) {
                batch.update(doc.ref, {
                    scheduledFor: admin.firestore.Timestamp.fromDate(getNextAllowedTime())
                });
                continue;
            }

            try {
                batch.update(doc.ref, {
                    status: 'processing',
                    processingStartedAt: now
                });

                const result = await sendSMS(smsData);

                if (result.success) {
                    batch.update(doc.ref, {
                        status: 'sent',
                        messageId: result.messageId || '',
                        provider: result.provider || SMS_CONFIG.defaultProvider,
                        sentAt: now
                    });

                    // Log to sent SMS
                    const sentRef = db.collection('sent_sms').doc();
                    batch.set(sentRef, {
                        ...smsData,
                        messageId: result.messageId,
                        sentAt: now
                    });

                    processed++;
                }
            } catch (error) {
                const retryCount = (smsData.retryCount || 0) + 1;
                
                if (retryCount < SMS_CONFIG.retry.maxAttempts) {
                    const nextRetryAt = new Date(Date.now() + 
                        SMS_CONFIG.retry.backoffMs * Math.pow(SMS_CONFIG.retry.backoffMultiplier, retryCount));
                    
                    batch.update(doc.ref, {
                        status: 'pending',
                        retryCount: retryCount,
                        lastError: error.message,
                        scheduledFor: admin.firestore.Timestamp.fromDate(nextRetryAt)
                    });
                } else {
                    batch.update(doc.ref, {
                        status: 'failed',
                        retryCount: retryCount,
                        lastError: error.message,
                        failedAt: now
                    });
                }

                failed++;
            }
        }

        await batch.commit();
        
        console.log(`[SMS] Queue processed: ${processed} sent, ${failed} failed`);
        return { processed, failed, total: snapshot.size };

    } catch (error) {
        console.error('[SMS] Queue processing failed:', error);
        throw error;
    }
}

/**
 * Cleanup expired OTPs
 */
async function cleanupExpiredOTPs() {
    const now = new Date();
    
    const snapshot = await db.collection('otps')
        .where('expiresAt', '<', admin.firestore.Timestamp.fromDate(now))
        .where('verified', '==', false)
        .limit(500)
        .get();

    if (snapshot.empty) return 0;

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
}

// ============================================================
// CLOUD FUNCTIONS
// ============================================================

/**
 * Send single SMS
 * POST /sendSMS
 */
exports.sendSMS = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }

        const { to, content, type, templateId, templateData, provider, priority, scheduleAt } = data;

        if (!to) throw new functions.https.HttpsError('invalid-argument', 'Phone number required');
        if (!content && !templateId) throw new functions.https.HttpsError('invalid-argument', 'Content or template ID required');

        const smsData = {
            to: formatPhoneNumber(to, 'national'),
            content: content || '',
            type: type || 'transactional',
            templateId: templateId || '',
            templateData: templateData || {},
            provider: provider || SMS_CONFIG.defaultProvider,
            priority: priority || 'normal',
            status: 'pending',
            retryCount: 0,
            userId: context.auth.uid,
            scheduledFor: scheduleAt ? 
                admin.firestore.Timestamp.fromDate(new Date(scheduleAt)) : 
                admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // DLT compliance for promotional
        if (smsData.type === 'promotional' && SMS_CONFIG.dlt.enabled) {
            if (!smsData.templateId) {
                throw new functions.https.HttpsError('invalid-argument', 'DLT template ID required for promotional SMS');
            }
            smsData.dltEntityId = SMS_CONFIG.dlt.entityId;
            smsData.dltHeaderId = SMS_CONFIG.dlt.headerId;
        }

        const docRef = await db.collection('sms_queue').add(smsData);

        if (priority === 'high' || type === 'otp') {
            const savedData = (await docRef.get()).data();
            const result = await sendSMS(savedData);
            
            await docRef.update({
                status: result.success ? 'sent' : 'failed',
                messageId: result.messageId || '',
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, sent: true, messageId: result.messageId };
        }

        return { success: true, queued: true, queueId: docRef.id };

    } catch (error) {
        console.error('[SMS] Send failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send OTP
 * POST /sendOTP
 */
exports.sendOTP = functions.https.onCall(async (data, context) => {
    try {
        const { phone, purpose } = data;

        if (!phone) throw new functions.https.HttpsError('invalid-argument', 'Phone number required');
        if (!purpose || !OTP_CONFIG.allowedPurposes.includes(purpose)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid purpose');
        }

        // Rate limit check
        const rateCheck = await checkOTPRateLimit(phone);
        if (!rateCheck.allowed) {
            throw new functions.https.HttpsError('resource-exhausted', rateCheck.error);
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Create OTP record
        await createOTP(phone, purpose, otp);

        // Prepare SMS content
        const content = OTP_CONFIG.template
            .replace('{#var#}', otp)
            .replace('{#var#}', purpose.replace(/_/g, ' '))
            .replace('{#var#}', OTP_CONFIG.expiryMinutes.toString());

        // Send via SMS
        const smsData = {
            to: formatPhoneNumber(phone, 'national'),
            content: content,
            type: 'transactional',
            priority: 'high',
            status: 'pending',
            userId: context.auth?.uid || 'system',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const result = await sendSMS(smsData);

        // Log OTP request
        await db.collection('otp_logs').add({
            phone: formatPhoneNumber(phone, 'national'),
            purpose: purpose,
            status: result.success ? 'sent' : 'failed',
            provider: result.provider,
            ip: context.rawRequest?.ip || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            message: 'OTP sent successfully',
            expiresIn: OTP_CONFIG.expiryMinutes * 60,
            retryAfter: OTP_CONFIG.resendCooldownSeconds
        };

    } catch (error) {
        console.error('[SMS] OTP send failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Verify OTP
 * POST /verifyOTP
 */
exports.verifyOTP = functions.https.onCall(async (data, context) => {
    try {
        const { phone, otp, purpose } = data;

        if (!phone || !otp || !purpose) {
            throw new functions.https.HttpsError('invalid-argument', 'Phone, OTP and purpose required');
        }

        const result = await verifyOTP(phone, otp, purpose);

        if (!result.success) {
            const errorMessages = {
                'invalid_otp': 'Invalid OTP',
                'expired': 'OTP has expired',
                'max_attempts': 'Maximum attempts exceeded'
            };
            throw new functions.https.HttpsError('failed-precondition', 
                errorMessages[result.code] || result.error);
        }

        return { success: true, verified: true };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('[SMS] OTP verification failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send bulk SMS
 * POST /sendBulkSMS
 */
exports.sendBulkSMS = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }

        const { to, content, type, templateId, provider } = data;

        if (!to || !Array.isArray(to) || to.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Recipients array required');
        }

        const limitType = type === 'promotional' ? 'promotional' : 'transactional';
        const dayLimit = SMS_CONFIG.limits[limitType].maxPerDay;

        if (to.length > dayLimit) {
            throw new functions.https.HttpsError('invalid-argument', 
                `Maximum ${dayLimit} recipients per day for ${type} SMS`);
        }

        const bulkId = `bulk-sms-${Date.now()}`;
        const batchSize = 100;
        let queued = 0;

        for (let i = 0; i < to.length; i += batchSize) {
            const batch = to.slice(i, i + batchSize);
            const firestoreBatch = db.batch();

            batch.forEach(phone => {
                const ref = db.collection('sms_queue').doc();
                firestoreBatch.set(ref, {
                    to: formatPhoneNumber(phone, 'national'),
                    content: content || '',
                    type: type || 'promotional',
                    templateId: templateId || '',
                    bulkId: bulkId,
                    priority: 'normal',
                    status: 'pending',
                    retryCount: 0,
                    userId: context.auth.uid,
                    scheduledFor: type === 'promotional' && !isWithinAllowedHours() ?
                        admin.firestore.Timestamp.fromDate(getNextAllowedTime()) :
                        admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                queued++;
            });

            await firestoreBatch.commit();
        }

        return {
            success: true,
            queued: queued,
            bulkId: bulkId,
            estimatedTime: `${Math.ceil(to.length / SMS_CONFIG.limits[limitType].maxPerMinute)} minutes`
        };

    } catch (error) {
        console.error('[SMS] Bulk send failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Process SMS queue (Cloud Scheduler - every 1 minute)
 */
exports.processSMSQueue = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        try {
            const result = await processSMSQueue(100);
            console.log('[SMS] Queue processed:', result);
            return result;
        } catch (error) {
            console.error('[SMS] Queue processing failed:', error);
            return { error: error.message };
        }
    });

/**
 * Get SMS status
 */
exports.getSMSStatus = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }

        const { messageId, queueId } = data;

        if (queueId) {
            const doc = await db.collection('sms_queue').doc(queueId).get();
            if (!doc.exists) return { status: 'not_found' };
            return { ...doc.data(), status: doc.data().status };
        }

        if (messageId) {
            const snapshot = await db.collection('sent_sms')
                .where('messageId', '==', messageId)
                .limit(1)
                .get();
            if (!snapshot.empty) {
                return { ...snapshot.docs[0].data(), status: 'sent' };
            }
        }

        return { status: 'not_found' };

    } catch (error) {
        console.error('[SMS] Status check failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cleanup old SMS and OTPs (daily)
 */
exports.cleanupSMS = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        try {
            // Cleanup old sent SMS
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const sentSnapshot = await db.collection('sent_sms')
                .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .limit(500)
                .get();

            const batch1 = db.batch();
            sentSnapshot.forEach(doc => batch1.delete(doc.ref));
            await batch1.commit();

            // Cleanup old queue items
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const failedSnapshot = await db.collection('sms_queue')
                .where('status', '==', 'failed')
                .where('failedAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
                .limit(500)
                .get();

            const batch2 = db.batch();
            failedSnapshot.forEach(doc => batch2.delete(doc.ref));
            await batch2.commit();

            // Cleanup expired OTPs
            const otpDeleted = await cleanupExpiredOTPs();

            // Cleanup old OTP logs
            const otpLogSnapshot = await db.collection('otp_logs')
                .where('createdAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .limit(500)
                .get();

            const batch3 = db.batch();
            otpLogSnapshot.forEach(doc => batch3.delete(doc.ref));
            await batch3.commit();

            console.log(`[SMS] Cleanup: ${sentSnapshot.size} sent, ${failedSnapshot.size} failed, ${otpDeleted} OTPs, ${otpLogSnapshot.size} logs`);
            return { success: true, sentDeleted: sentSnapshot.size, failedDeleted: failedSnapshot.size, otpDeleted, logDeleted: otpLogSnapshot.size };

        } catch (error) {
            console.error('[SMS] Cleanup failed:', error);
            return { error: error.message };
        }
    });

module.exports = exports;
