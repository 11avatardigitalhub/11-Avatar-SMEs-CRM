/**
 * 11 AVATAR DIGITAL HUB - Email Sender Cloud Function
 * Enterprise-grade Firebase Cloud Function for email delivery
 * SMTP, SendGrid, Mailgun, templates, bulk email, tracking, scheduling
 * 
 * @function emailSender
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Email Configuration
 */
const EMAIL_CONFIG = {
    defaultProvider: process.env.EMAIL_PROVIDER || 'smtp',
    fromName: process.env.EMAIL_FROM_NAME || '11 Avatar Digital Hub',
    fromEmail: process.env.EMAIL_FROM_EMAIL || 'noreply@11avatardigitalhub.cloud',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@11avatardigitalhub.cloud',
    
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    },
    
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY || '',
        maxRecipientsPerCall: 1000
    },
    
    mailgun: {
        apiKey: process.env.MAILGUN_API_KEY || '',
        domain: process.env.MAILGUN_DOMAIN || '',
        maxRecipientsPerCall: 1000
    },
    
    limits: {
        maxPerMinute: 60,
        maxPerHour: 1000,
        maxPerDay: 10000,
        maxBatchSize: 100,
        maxAttachmentSize: 10 * 1024 * 1024, // 10MB
        rateLimitWindow: 60000 // 1 minute
    },
    
    tracking: {
        enabled: true,
        openTracking: true,
        clickTracking: true,
        trackingDomain: process.env.TRACKING_DOMAIN || 'track.11avatardigitalhub.cloud'
    },
    
    retry: {
        maxAttempts: 3,
        backoffMs: 5000,
        backoffMultiplier: 2
    }
};

// Initialize transports
let smtpTransport = null;
let mailgunClient = null;

/**
 * Get or create SMTP transport
 */
function getSMTPTransport() {
    if (!smtpTransport) {
        smtpTransport = nodemailer.createTransport({
            host: EMAIL_CONFIG.smtp.host,
            port: EMAIL_CONFIG.smtp.port,
            secure: EMAIL_CONFIG.smtp.secure,
            auth: {
                user: EMAIL_CONFIG.smtp.user,
                pass: EMAIL_CONFIG.smtp.pass
            },
            pool: true,
            maxConnections: 5,
            maxMessages: Infinity,
            rateLimit: 10
        });
    }
    return smtpTransport;
}

/**
 * Get Mailgun client
 */
function getMailgunClient() {
    if (!mailgunClient) {
        const mailgun = new Mailgun(formData);
        mailgunClient = mailgun.client({
            username: 'api',
            key: EMAIL_CONFIG.mailgun.apiKey
        });
    }
    return mailgunClient;
}

/**
 * Main email sender function
 */
async function sendEmail(emailData) {
    try {
        const provider = emailData.provider || EMAIL_CONFIG.defaultProvider;
        
        switch (provider) {
            case 'sendgrid':
                return await sendViaSendGrid(emailData);
            case 'mailgun':
                return await sendViaMailgun(emailData);
            case 'smtp':
            default:
                return await sendViaSMTP(emailData);
        }
    } catch (error) {
        console.error('[EmailSender] Send failed:', error);
        throw error;
    }
}

/**
 * Send via SMTP (Nodemailer)
 */
async function sendViaSMTP(emailData) {
    const transport = getSMTPTransport();
    
    const mailOptions = {
        from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.fromEmail}>`,
        to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
        cc: emailData.cc ? (Array.isArray(emailData.cc) ? emailData.cc.join(', ') : emailData.cc) : undefined,
        bcc: emailData.bcc ? (Array.isArray(emailData.bcc) ? emailData.bcc.join(', ') : emailData.bcc) : undefined,
        subject: emailData.subject || '(No Subject)',
        replyTo: emailData.replyTo || EMAIL_CONFIG.replyTo
    };

    if (emailData.html) {
        mailOptions.html = emailData.html;
    } else if (emailData.template) {
        mailOptions.html = await renderTemplate(emailData.template, emailData.templateData || {});
    } else {
        mailOptions.text = emailData.text || emailData.body || '';
    }

    if (emailData.attachments && emailData.attachments.length > 0) {
        mailOptions.attachments = emailData.attachments.map(att => ({
            filename: att.filename || 'attachment',
            content: att.content,
            path: att.path,
            contentType: att.contentType
        }));
    }

    if (EMAIL_CONFIG.tracking.enabled && emailData.trackingId) {
        if (EMAIL_CONFIG.tracking.openTracking) {
            mailOptions.html = addOpenTracking(mailOptions.html, emailData.trackingId);
        }
        if (EMAIL_CONFIG.tracking.clickTracking) {
            mailOptions.html = addClickTracking(mailOptions.html, emailData.trackingId);
        }
    }

    const info = await transport.sendMail(mailOptions);
    
    console.log(`[EmailSender] SMTP sent: ${info.messageId}`);
    
    return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
        accepted: info.accepted,
        rejected: info.rejected
    };
}

/**
 * Send via SendGrid
 */
async function sendViaSendGrid(emailData) {
    if (!EMAIL_CONFIG.sendgrid.apiKey) {
        throw new Error('SendGrid API key not configured');
    }
    
    sgMail.setApiKey(EMAIL_CONFIG.sendgrid.apiKey);
    
    let htmlContent = emailData.html;
    
    if (!htmlContent && emailData.template) {
        htmlContent = await renderTemplate(emailData.template, emailData.templateData || {});
    }
    
    if (EMAIL_CONFIG.tracking.enabled && emailData.trackingId) {
        if (EMAIL_CONFIG.tracking.openTracking) {
            htmlContent = addOpenTracking(htmlContent, emailData.trackingId);
        }
        if (EMAIL_CONFIG.tracking.clickTracking) {
            htmlContent = addClickTracking(htmlContent, emailData.trackingId);
        }
    }
    
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    
    const msg = {
        to: recipients,
        from: {
            email: EMAIL_CONFIG.fromEmail,
            name: EMAIL_CONFIG.fromName
        },
        subject: emailData.subject || '(No Subject)',
        html: htmlContent,
        text: emailData.text || emailData.body || '',
        replyTo: emailData.replyTo || EMAIL_CONFIG.replyTo,
        trackingSettings: {
            openTracking: { enable: EMAIL_CONFIG.tracking.openTracking },
            clickTracking: { enable: EMAIL_CONFIG.tracking.clickTracking }
        }
    };
    
    if (emailData.cc) {
        msg.cc = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc];
    }
    
    if (emailData.bcc) {
        msg.bcc = Array.isArray(emailData.bcc) ? emailData.bcc : [emailData.bcc];
    }
    
    if (emailData.attachments) {
        msg.attachments = emailData.attachments.map(att => ({
            content: att.content,
            filename: att.filename || 'attachment',
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment'
        }));
    }
    
    const [response] = await sgMail.send(msg);
    
    console.log(`[EmailSender] SendGrid sent: ${response.statusCode}`);
    
    return {
        success: true,
        messageId: response.headers['x-message-id'],
        provider: 'sendgrid',
        statusCode: response.statusCode
    };
}

/**
 * Send via Mailgun
 */
async function sendViaMailgun(emailData) {
    if (!EMAIL_CONFIG.mailgun.apiKey || !EMAIL_CONFIG.mailgun.domain) {
        throw new Error('Mailgun API key or domain not configured');
    }
    
    const mg = getMailgunClient();
    
    let htmlContent = emailData.html;
    
    if (!htmlContent && emailData.template) {
        htmlContent = await renderTemplate(emailData.template, emailData.templateData || {});
    }
    
    if (EMAIL_CONFIG.tracking.enabled && emailData.trackingId) {
        if (EMAIL_CONFIG.tracking.openTracking) {
            htmlContent = addOpenTracking(htmlContent, emailData.trackingId);
        }
        if (EMAIL_CONFIG.tracking.clickTracking) {
            htmlContent = addClickTracking(htmlContent, emailData.trackingId);
        }
    }
    
    const messageData = {
        from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.fromEmail}>`,
        to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
        subject: emailData.subject || '(No Subject)',
        html: htmlContent,
        text: emailData.text || emailData.body || ''
    };
    
    if (emailData.cc) {
        messageData.cc = Array.isArray(emailData.cc) ? emailData.cc.join(', ') : emailData.cc;
    }
    
    if (emailData.bcc) {
        messageData.bcc = Array.isArray(emailData.bcc) ? emailData.bcc.join(', ') : emailData.bcc;
    }
    
    if (emailData.attachments) {
        messageData.attachment = emailData.attachments.map(att => ({
            filename: att.filename || 'attachment',
            data: att.content || att.path
        }));
    }
    
    const result = await mg.messages.create(EMAIL_CONFIG.mailgun.domain, messageData);
    
    console.log(`[EmailSender] Mailgun sent: ${result.id}`);
    
    return {
        success: true,
        messageId: result.id,
        provider: 'mailgun',
        status: result.status
    };
}

/**
 * Send bulk email with batching
 */
async function sendBulkEmail(bulkData, provider = 'smtp') {
    const recipients = bulkData.to || [];
    const batchSize = EMAIL_CONFIG.limits.maxBatchSize;
    const results = {
        total: recipients.length,
        sent: 0,
        failed: 0,
        batches: Math.ceil(recipients.length / batchSize),
        errors: []
    };
    
    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        try {
            const emailData = {
                ...bulkData,
                to: batch,
                trackingId: `${bulkData.bulkId || Date.now()}-batch-${Math.floor(i / batchSize)}`
            };
            
            const result = await sendEmail(emailData);
            
            if (result.success) {
                results.sent += batch.length;
            }
            
            // Log batch
            await db.collection('email_batches').add({
                bulkId: bulkData.bulkId,
                batchIndex: Math.floor(i / batchSize),
                recipientCount: batch.length,
                status: 'sent',
                messageId: result.messageId,
                provider: result.provider,
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
        } catch (error) {
            results.failed += batch.length;
            results.errors.push({
                batchIndex: Math.floor(i / batchSize),
                error: error.message
            });
        }
        
        // Rate limiting delay
        if (i + batchSize < recipients.length) {
            await delay(EMAIL_CONFIG.limits.rateLimitWindow / 
                (EMAIL_CONFIG.limits.maxPerMinute / (batchSize / recipients.length)));
        }
    }
    
    return results;
}

/**
 * Render email template with Handlebars
 */
async function renderTemplate(templateName, data = {}) {
    try {
        // Check if template exists in Firestore
        const templateDoc = await db.collection('email_templates').doc(templateName).get();
        
        let templateContent = '';
        
        if (templateDoc.exists) {
            templateContent = templateDoc.data().content || templateDoc.data().html || '';
        } else {
            // Try loading from local templates directory
            const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
            
            if (fs.existsSync(templatePath)) {
                templateContent = fs.readFileSync(templatePath, 'utf-8');
            } else {
                throw new Error(`Template "${templateName}" not found`);
            }
        }
        
        // Add common template data
        const enrichedData = {
            ...data,
            currentYear: new Date().getFullYear(),
            companyName: '11 Avatar Digital Hub',
            companyAddress: data.companyAddress || '',
            supportEmail: EMAIL_CONFIG.replyTo,
            unsubscribeLink: data.unsubscribeLink || '',
            logoUrl: data.logoUrl || 'https://11avatardigitalhub.cloud/logo.png'
        };
        
        // Register helpers
        handlebars.registerHelper('formatDate', (date) => {
            return new Date(date).toLocaleDateString('en-IN');
        });
        
        handlebars.registerHelper('formatCurrency', (amount) => {
            return new Intl.NumberFormat('en-IN', { 
                style: 'currency', 
                currency: 'INR' 
            }).format(amount);
        });
        
        handlebars.registerHelper('ifCond', (v1, operator, v2, options) => {
            switch (operator) {
                case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                default: return options.inverse(this);
            }
        });
        
        const template = handlebars.compile(templateContent);
        return template(enrichedData);
        
    } catch (error) {
        console.error('[EmailSender] Template render failed:', error);
        
        // Fallback: basic HTML wrapper
        return `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto;">
                    <h2>${data.title || 'Notification'}</h2>
                    <p>${data.message || data.body || ''}</p>
                    <hr>
                    <p style="color: #999; font-size: 12px;">
                        Sent by ${EMAIL_CONFIG.fromName}<br>
                        ${data.unsubscribeLink ? `<a href="${data.unsubscribeLink}">Unsubscribe</a>` : ''}
                    </p>
                </div>
            </body>
            </html>
        `;
    }
}

/**
 * Add open tracking pixel
 */
function addOpenTracking(html, trackingId) {
    if (!html || !trackingId) return html;
    
    const trackingURL = `https://${EMAIL_CONFIG.tracking.trackingDomain}/o/${trackingId}.png`;
    const pixel = `<img src="${trackingURL}" width="1" height="1" alt="" style="display:none;" />`;
    
    if (html.includes('</body>')) {
        return html.replace('</body>', `${pixel}</body>`);
    }
    
    return html + pixel;
}

/**
 * Add click tracking to links
 */
function addClickTracking(html, trackingId) {
    if (!html || !trackingId) return html;
    
    return html.replace(/<a\s+(?!.*data-notrack)([^>]*?)href="([^"]+)"/gi, (match, attrs, url) => {
        if (url.startsWith('#') || url.startsWith('mailto:')) return match;
        
        const trackingURL = `https://${EMAIL_CONFIG.tracking.trackingDomain}/c/${trackingId}?url=${encodeURIComponent(url)}`;
        return `<a ${attrs}href="${trackingURL}" data-original-url="${url}"`;
    });
}

/**
 * Process email queue
 */
async function processEmailQueue(batchSize = 50) {
    try {
        const snapshot = await db.collection('email_queue')
            .where('status', '==', 'pending')
            .where('scheduledFor', '<=', admin.firestore.FieldValue.serverTimestamp())
            .orderBy('scheduledFor', 'asc')
            .orderBy('priority', 'desc')
            .limit(batchSize)
            .get();
        
        if (snapshot.empty) {
            return { processed: 0, message: 'No pending emails' };
        }
        
        const batch = db.batch();
        let processed = 0;
        let failed = 0;
        
        for (const doc of snapshot.docs) {
            const emailData = doc.data();
            
            try {
                // Update status to processing
                batch.update(doc.ref, {
                    status: 'processing',
                    processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                const result = await sendEmail(emailData);
                
                if (result.success) {
                    batch.update(doc.ref, {
                        status: 'sent',
                        messageId: result.messageId || '',
                        provider: result.provider || 'smtp',
                        sentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Log to sent emails
                    const sentRef = db.collection('sent_emails').doc();
                    batch.set(sentRef, {
                        ...emailData,
                        messageId: result.messageId,
                        sentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    processed++;
                }
            } catch (error) {
                const retryCount = (emailData.retryCount || 0) + 1;
                const maxRetries = EMAIL_CONFIG.retry.maxAttempts;
                
                if (retryCount < maxRetries) {
                    // Retry with backoff
                    const nextRetryAt = new Date(Date.now() + 
                        EMAIL_CONFIG.retry.backoffMs * Math.pow(EMAIL_CONFIG.retry.backoffMultiplier, retryCount));
                    
                    batch.update(doc.ref, {
                        status: 'pending',
                        retryCount: retryCount,
                        lastError: error.message,
                        scheduledFor: admin.firestore.Timestamp.fromDate(nextRetryAt)
                    });
                } else {
                    // Mark as failed
                    batch.update(doc.ref, {
                        status: 'failed',
                        retryCount: retryCount,
                        lastError: error.message,
                        failedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                failed++;
            }
        }
        
        await batch.commit();
        
        console.log(`[EmailSender] Queue processed: ${processed} sent, ${failed} failed`);
        
        return { processed, failed, total: snapshot.size };
        
    } catch (error) {
        console.error('[EmailSender] Queue processing failed:', error);
        throw error;
    }
}

/**
 * Rate limiter
 */
const rateLimiter = {
    counts: new Map(),
    
    check(key, limit, windowMs) {
        const now = Date.now();
        const entry = this.counts.get(key) || { count: 0, resetAt: now + windowMs };
        
        if (now > entry.resetAt) {
            entry.count = 0;
            entry.resetAt = now + windowMs;
        }
        
        if (entry.count >= limit) {
            return false;
        }
        
        entry.count++;
        this.counts.set(key, entry);
        return true;
    }
};

/**
 * Utility: Delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// CLOUD FUNCTIONS
// ============================================================

/**
 * Send single email
 * POST /sendEmail
 */
exports.sendEmail = functions.https.onCall(async (data, context) => {
    try {
        // Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const { to, subject, html, text, template, templateData, cc, bcc, attachments, provider, priority } = data;
        
        if (!to) {
            throw new functions.https.HttpsError('invalid-argument', 'Recipient (to) is required');
        }
        
        // Rate limiting
        const userKey = `email:${context.auth.uid}`;
        if (!rateLimiter.check(userKey, EMAIL_CONFIG.limits.maxPerMinute, EMAIL_CONFIG.limits.rateLimitWindow)) {
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
        }
        
        // Add to queue
        const queueRef = await db.collection('email_queue').add({
            to: Array.isArray(to) ? to : [to],
            subject: subject || '(No Subject)',
            html: html || '',
            text: text || '',
            template: template || '',
            templateData: templateData || {},
            cc: cc || [],
            bcc: bcc || [],
            attachments: attachments || [],
            provider: provider || EMAIL_CONFIG.defaultProvider,
            priority: priority || 'normal',
            status: 'pending',
            trackingId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: context.auth.uid,
            userEmail: context.auth.token.email || '',
            scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
            retryCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // If high priority, process immediately
        if (priority === 'high') {
            const emailData = (await queueRef.get()).data();
            emailData.id = queueRef.id;
            
            try {
                const result = await sendEmail(emailData);
                
                await queueRef.update({
                    status: 'sent',
                    messageId: result.messageId || '',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return { success: true, messageId: result.messageId, queued: false, sent: true };
            } catch (error) {
                await queueRef.update({
                    status: 'failed',
                    lastError: error.message
                });
                throw error;
            }
        }
        
        return { success: true, queued: true, queueId: queueRef.id };
        
    } catch (error) {
        console.error('[EmailSender] Send email failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send bulk email
 * POST /sendBulkEmail
 */
exports.sendBulkEmail = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const { to, subject, html, template, templateData, provider } = data;
        
        if (!to || !Array.isArray(to) || to.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Recipients array is required');
        }
        
        if (to.length > EMAIL_CONFIG.limits.maxPerDay) {
            throw new functions.https.HttpsError('invalid-argument', 
                `Maximum ${EMAIL_CONFIG.limits.maxPerDay} recipients per day`);
        }
        
        const bulkId = `bulk-${Date.now()}`;
        
        // Add all to queue in batches
        const batchSize = 100;
        let queued = 0;
        
        for (let i = 0; i < to.length; i += batchSize) {
            const batch = to.slice(i, i + batchSize);
            const firestoreBatch = db.batch();
            
            batch.forEach(recipient => {
                const ref = db.collection('email_queue').doc();
                firestoreBatch.set(ref, {
                    to: [recipient],
                    subject: subject || '(No Subject)',
                    html: html || '',
                    template: template || '',
                    templateData: templateData || {},
                    provider: provider || EMAIL_CONFIG.defaultProvider,
                    bulkId: bulkId,
                    status: 'pending',
                    trackingId: `${bulkId}-${recipient.replace(/[^a-zA-Z0-9]/g, '')}`,
                    scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
                    retryCount: 0,
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
            estimatedTime: `${Math.ceil(to.length / EMAIL_CONFIG.limits.maxPerMinute)} minutes`
        };
        
    } catch (error) {
        console.error('[EmailSender] Bulk email failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Process email queue (called by Cloud Scheduler)
 * Runs every minute
 */
exports.processEmailQueue = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        try {
            const result = await processEmailQueue(50);
            console.log(`[EmailSender] Queue processed:`, result);
            return result;
        } catch (error) {
            console.error('[EmailSender] Queue processing failed:', error);
            return { error: error.message };
        }
    });

/**
 * Get email status
 * GET /getEmailStatus
 */
exports.getEmailStatus = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
        }
        
        const { trackingId, messageId } = data;
        
        let query;
        
        if (trackingId) {
            query = db.collection('sent_emails').where('trackingId', '==', trackingId).limit(1);
        } else if (messageId) {
            query = db.collection('sent_emails').where('messageId', '==', messageId).limit(1);
        } else {
            throw new functions.https.HttpsError('invalid-argument', 'trackingId or messageId required');
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            // Check queue
            const queueSnapshot = await db.collection('email_queue')
                .where('trackingId', '==', trackingId)
                .limit(1)
                .get();
            
            if (!queueSnapshot.empty) {
                const queueData = queueSnapshot.docs[0].data();
                return {
                    status: queueData.status,
                    queued: true,
                    retryCount: queueData.retryCount || 0
                };
            }
            
            return { status: 'not_found' };
        }
        
        const emailData = snapshot.docs[0].data();
        
        return {
            status: emailData.status || 'sent',
            messageId: emailData.messageId,
            sentAt: emailData.sentAt,
            deliveredAt: emailData.deliveredAt || null,
            openedAt: emailData.openedAt || null,
            clickedAt: emailData.clickedAt || null,
            tracking: {
                opens: emailData.openCount || 0,
                clicks: emailData.clickCount || 0
            }
        };
        
    } catch (error) {
        console.error('[EmailSender] Status check failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Handle email tracking webhook
 * GET /emailTracking
 */
exports.emailTracking = functions.https.onRequest(async (req, res) => {
    try {
        const { type, id } = req.params;
        const url = req.query.url;
        
        if (type === 'o') {
            // Open tracking
            await db.collection('sent_emails')
                .where('trackingId', '==', id)
                .limit(1)
                .get()
                .then(async (snapshot) => {
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update({
                            openedAt: admin.firestore.FieldValue.serverTimestamp(),
                            openCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                });
            
            // Return 1x1 transparent pixel
            const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(pixel);
            
        } else if (type === 'c') {
            // Click tracking
            await db.collection('sent_emails')
                .where('trackingId', '==', id)
                .limit(1)
                .get()
                .then(async (snapshot) => {
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update({
                            clickedAt: admin.firestore.FieldValue.serverTimestamp(),
                            clickCount: admin.firestore.FieldValue.increment(1)
                        });
                    }
                });
            
            // Redirect to original URL
            const redirectURL = url || 'https://11avatardigitalhub.cloud';
            res.redirect(302, redirectURL);
        } else {
            res.status(400).send('Invalid tracking type');
        }
        
    } catch (error) {
        console.error('[EmailSender] Tracking failed:', error);
        res.status(500).send('Tracking error');
    }
});

/**
 * Cleanup old emails
 * Runs daily
 */
exports.cleanupEmails = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // Delete old sent emails
            const sentSnapshot = await db.collection('sent_emails')
                .where('sentAt', '<', thirtyDaysAgo)
                .limit(500)
                .get();
            
            const batch = db.batch();
            sentSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            // Delete old failed queue items
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const failedSnapshot = await db.collection('email_queue')
                .where('status', '==', 'failed')
                .where('failedAt', '<', sevenDaysAgo)
                .limit(500)
                .get();
            
            const batch2 = db.batch();
            failedSnapshot.forEach(doc => batch2.delete(doc.ref));
            await batch2.commit();
            
            console.log('[EmailSender] Cleanup completed');
            return { success: true };
            
        } catch (error) {
            console.error('[EmailSender] Cleanup failed:', error);
            return { error: error.message };
        }
    });

module.exports = exports;


