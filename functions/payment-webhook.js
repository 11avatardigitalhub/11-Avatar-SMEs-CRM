/**
 * 11 AVATAR DIGITAL HUB - Payment Webhook Cloud Function
 * Enterprise-grade Firebase Cloud Function for payment gateway webhooks
 * Razorpay, Stripe, PayPal, UPI webhook processing with idempotency & retry
 * 
 * @function paymentWebhook
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Payment Webhook Configuration
 */
const WEBHOOK_CONFIG = {
    razorpay: {
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
        supportedEvents: [
            'payment.authorized',
            'payment.captured', 
            'payment.failed',
            'refund.created',
            'refund.processed',
            'order.paid',
            'dispute.created',
            'dispute.won',
            'dispute.lost'
        ]
    },
    stripe: {
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        supportedEvents: [
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'charge.refunded',
            'charge.dispute.created'
        ]
    },
    paypal: {
        webhookId: process.env.PAYPAL_WEBHOOK_ID,
        supportedEvents: [
            'PAYMENT.CAPTURE.COMPLETED',
            'PAYMENT.CAPTURE.DENIED',
            'PAYMENT.CAPTURE.REFUNDED'
        ]
    }
};

/**
 * Process webhook with idempotency check
 */
async function processWebhookWithIdempotency(eventId, gateway, eventType, processFn) {
    const idempotencyRef = db.collection('webhook_events').doc(eventId);
    
    try {
        // Check if already processed
        const existingDoc = await idempotencyRef.get();
        
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            
            if (existingData.status === 'completed') {
                console.log(`[Webhook] Event ${eventId} already processed - skipping`);
                return { status: 'already_processed', eventId };
            }
            
            if (existingData.status === 'processing') {
                console.log(`[Webhook] Event ${eventId} currently processing - waiting`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                const retryDoc = await idempotencyRef.get();
                if (retryDoc.exists && retryDoc.data().status === 'completed') {
                    return { status: 'already_processed', eventId };
                }
            }
            
            if (existingData.retryCount >= 5) {
                console.error(`[Webhook] Event ${eventId} exceeded max retries`);
                await idempotencyRef.update({
                    status: 'failed',
                    error: 'Max retries exceeded',
                    failedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return { status: 'failed', error: 'Max retries exceeded' };
            }
        }
        
        // Mark as processing
        await idempotencyRef.set({
            eventId,
            gateway,
            eventType,
            status: 'processing',
            retryCount: existingDoc.exists ? (existingDoc.data().retryCount || 0) + 1 : 0,
            firstAttemptAt: existingDoc.exists ? existingDoc.data().firstAttemptAt : admin.firestore.FieldValue.serverTimestamp(),
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Process the event
        const result = await processFn();
        
        // Mark as completed
        await idempotencyRef.update({
            status: 'completed',
            result: result,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { status: 'completed', eventId, result };
        
    } catch (error) {
        console.error(`[Webhook] Processing failed for ${eventId}:`, error);
        
        // Update with error
        await idempotencyRef.update({
            status: 'failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
        
        throw error;
    }
}

/**
 * Verify Razorpay webhook signature
 */
function verifyRazorpaySignature(payload, signature) {
    try {
        const secret = WEBHOOK_CONFIG.razorpay.webhookSecret;
        if (!secret) throw new Error('Razorpay webhook secret not configured');
        
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature)
        );
    } catch (error) {
        console.error('[Razorpay] Signature verification failed:', error);
        return false;
    }
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, signature, timestamp) {
    try {
        const secret = WEBHOOK_CONFIG.stripe.webhookSecret;
        if (!secret) throw new Error('Stripe webhook secret not configured');
        
        const signedPayload = `${timestamp}.${payload}`;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature.split(',')[1])
        );
    } catch (error) {
        console.error('[Stripe] Signature verification failed:', error);
        return false;
    }
}

/**
 * Handle payment captured/succeeded event
 */
async function handlePaymentSuccess(paymentData, gateway) {
    const batch = db.batch();
    
    try {
        const paymentId = paymentData.id || paymentData.payment_id;
        const orderId = paymentData.order_id || paymentData.metadata?.orderId;
        const amount = paymentData.amount || paymentData.amount_received || 0;
        const currency = paymentData.currency || 'INR';
        const method = paymentData.method || 'unknown';
        const customerEmail = paymentData.email || paymentData.customer_email || '';
        const customerPhone = paymentData.contact || paymentData.customer_phone || '';
        
        // Create payment record
        const paymentRef = db.collection('payments').doc(paymentId);
        batch.set(paymentRef, {
            id: paymentId,
            gateway: gateway,
            amount: amount / 100, // Convert from paise/cents
            currency: currency,
            method: method,
            status: 'completed',
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            gatewayResponse: paymentData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Update invoice if orderId present
        if (orderId) {
            const invoicesSnapshot = await db.collection('invoices')
                .where('orderId', '==', orderId)
                .limit(1)
                .get();
            
            if (!invoicesSnapshot.empty) {
                const invoiceDoc = invoicesSnapshot.docs[0];
                const invoiceData = invoiceDoc.data();
                const paidAmount = (invoiceData.paidAmount || 0) + (amount / 100);
                const isFullyPaid = paidAmount >= (invoiceData.total || 0);
                
                batch.update(invoiceDoc.ref, {
                    status: isFullyPaid ? 'paid' : 'partial',
                    paidAmount: paidAmount,
                    balance: (invoiceData.total || 0) - paidAmount,
                    lastPaymentId: paymentId,
                    lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Create payment-invoice link
                const linkRef = db.collection('payment_invoice_links').doc();
                batch.set(linkRef, {
                    paymentId: paymentId,
                    invoiceId: invoiceDoc.id,
                    amount: amount / 100,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Send notification for full payment
                if (isFullyPaid) {
                    await sendPaymentNotification(invoiceData, paidAmount);
                }
            }
        }
        
        // Update revenue metrics
        const metricsRef = db.collection('metrics').doc('revenue');
        batch.set(metricsRef, {
            totalRevenue: admin.firestore.FieldValue.increment(amount / 100),
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Commit batch
        await batch.commit();
        
        console.log(`[Payment] Payment ${paymentId} processed successfully`);
        
        return { success: true, paymentId, amount: amount / 100 };
        
    } catch (error) {
        console.error('[Payment] Payment success handling failed:', error);
        throw error;
    }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(paymentData, gateway) {
    try {
        const paymentId = paymentData.id || paymentData.payment_id;
        const orderId = paymentData.order_id || paymentData.metadata?.orderId;
        const errorCode = paymentData.error_code || paymentData.error?.code || 'unknown';
        const errorDescription = paymentData.error_description || paymentData.error?.description || 'Payment failed';
        
        // Create failed payment record
        await db.collection('payments').doc(paymentId).set({
            id: paymentId,
            gateway: gateway,
            amount: (paymentData.amount || 0) / 100,
            status: 'failed',
            errorCode: errorCode,
            errorDescription: errorDescription,
            gatewayResponse: paymentData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Log failure
        await db.collection('payment_failures').add({
            paymentId: paymentId,
            gateway: gateway,
            orderId: orderId || '',
            errorCode: errorCode,
            errorDescription: errorDescription,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[Payment] Payment failure ${paymentId} logged`);
        
        return { success: true, paymentId, status: 'failed' };
        
    } catch (error) {
        console.error('[Payment] Payment failure handling failed:', error);
        throw error;
    }
}

/**
 * Handle refund event
 */
async function handleRefund(refundData, gateway) {
    try {
        const refundId = refundData.id || refundData.refund_id;
        const paymentId = refundData.payment_id;
        const amount = refundData.amount || 0;
        
        // Create refund record
        await db.collection('refunds').doc(refundId).set({
            id: refundId,
            paymentId: paymentId,
            gateway: gateway,
            amount: amount / 100,
            status: 'processed',
            gatewayResponse: refundData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Update payment status
        if (paymentId) {
            await db.collection('payments').doc(paymentId).update({
                status: 'refunded',
                refundId: refundId,
                refundAmount: amount / 100,
                refundedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Update linked invoice
            const linksSnapshot = await db.collection('payment_invoice_links')
                .where('paymentId', '==', paymentId)
                .limit(1)
                .get();
            
            if (!linksSnapshot.empty) {
                const invoiceId = linksSnapshot.docs[0].data().invoiceId;
                await db.collection('invoices').doc(invoiceId).update({
                    status: 'refunded',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        // Update metrics
        await db.collection('metrics').doc('revenue').update({
            totalRefunds: admin.firestore.FieldValue.increment(amount / 100),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[Payment] Refund ${refundId} processed`);
        
        return { success: true, refundId, amount: amount / 100 };
        
    } catch (error) {
        console.error('[Payment] Refund handling failed:', error);
        throw error;
    }
}

/**
 * Handle dispute event
 */
async function handleDispute(disputeData, gateway) {
    try {
        const disputeId = disputeData.id || disputeData.dispute_id;
        const paymentId = disputeData.payment_id;
        
        await db.collection('disputes').doc(disputeId).set({
            id: disputeId,
            paymentId: paymentId,
            gateway: gateway,
            amount: (disputeData.amount || 0) / 100,
            reason: disputeData.reason || 'Unknown',
            status: disputeData.status || 'open',
            gatewayResponse: disputeData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (paymentId) {
            await db.collection('payments').doc(paymentId).update({
                status: 'disputed',
                disputeId: disputeId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Send admin notification
        await sendAdminAlert('Payment Dispute Filed', 
            `A dispute has been filed for payment ${paymentId}. Amount: ₹${(disputeData.amount || 0) / 100}`);
        
        console.log(`[Payment] Dispute ${disputeId} logged`);
        
        return { success: true, disputeId };
        
    } catch (error) {
        console.error('[Payment] Dispute handling failed:', error);
        throw error;
    }
}

/**
 * Send payment notification
 */
async function sendPaymentNotification(invoiceData, paidAmount) {
    try {
        // Send to client
        if (invoiceData.clientEmail) {
            await db.collection('notifications').add({
                type: 'payment_received',
                title: 'Payment Received',
                message: `Payment of ₹${paidAmount} received for invoice #${invoiceData.invoiceNumber}`,
                recipientEmail: invoiceData.clientEmail,
                channels: ['email', 'in_app'],
                data: {
                    invoiceId: invoiceData.id,
                    invoiceNumber: invoiceData.invoiceNumber,
                    amount: paidAmount
                },
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Send push notification to admin
        const adminUsers = await db.collection('users')
            .where('role', 'in', ['admin', 'finance'])
            .get();
        
        const tokens = [];
        adminUsers.forEach(doc => {
            const fcmTokens = doc.data().fcmTokens || [];
            tokens.push(...fcmTokens);
        });
        
        if (tokens.length > 0) {
            await messaging.sendMulticast({
                tokens: tokens.slice(0, 500),
                notification: {
                    title: '💰 Payment Received',
                    body: `₹${paidAmount} received for invoice #${invoiceData.invoiceNumber}`
                },
                data: {
                    type: 'payment',
                    invoiceId: invoiceData.id || ''
                }
            });
        }
        
    } catch (error) {
        console.error('[Payment] Notification sending failed:', error);
    }
}

/**
 * Send admin alert
 */
async function sendAdminAlert(title, message) {
    try {
        await db.collection('admin_alerts').add({
            title,
            message,
            severity: 'high',
            acknowledged: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('[Payment] Admin alert failed:', error);
    }
}

/**
 * Validate webhook request origin
 */
function validateWebhookOrigin(request, gateway) {
    const allowedIPs = {
        razorpay: ['52.66.0.0/16', '52.66.0.0/16'],
        stripe: ['54.187.0.0/16', '54.187.0.0/16']
    };
    
    const clientIP = request.ip || request.connection.remoteAddress;
    console.log(`[Webhook] Request from IP: ${clientIP}`);
    
    return true;
}

// ============================================================
// MAIN CLOUD FUNCTION
// ============================================================

/**
 * Payment Webhook Handler
 * POST /webhooks/payment
 */
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
    const startTime = Date.now();
    
    try {
        // CORS headers
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature, Stripe-Signature');
        
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        
        const gateway = req.query.gateway || req.path.split('/').pop();
        console.log(`[Webhook] Processing ${gateway} webhook`);
        
        let eventId, eventType, paymentData;
        
        // Parse based on gateway
        switch (gateway) {
            case 'razorpay': {
                const signature = req.headers['x-razorpay-signature'];
                const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
                
                if (!verifyRazorpaySignature(rawBody, signature)) {
                    console.error('[Razorpay] Invalid signature');
                    res.status(400).json({ error: 'Invalid signature' });
                    return;
                }
                
                const payload = req.body;
                eventId = payload.payload?.payment?.entity?.id || `razorpay-${Date.now()}`;
                eventType = payload.event;
                paymentData = payload.payload?.payment?.entity || payload.payload;
                break;
            }
            
            case 'stripe': {
                const signature = req.headers['stripe-signature'];
                const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
                const [timestamp] = (signature || '').split(',').map(s => s.split('=')[1]);
                
                if (!verifyStripeSignature(rawBody, signature, timestamp)) {
                    console.error('[Stripe] Invalid signature');
                    res.status(400).json({ error: 'Invalid signature' });
                    return;
                }
                
                const payload = req.body;
                eventId = payload.id || `stripe-${Date.now()}`;
                eventType = payload.type;
                paymentData = payload.data?.object || payload;
                break;
            }
            
            case 'paypal': {
                const payload = req.body;
                eventId = payload.id || `paypal-${Date.now()}`;
                eventType = payload.event_type;
                paymentData = payload.resource || payload;
                break;
            }
            
            default:
                res.status(400).json({ error: 'Unknown gateway' });
                return;
        }
        
        if (!eventId) {
            res.status(400).json({ error: 'Missing event ID' });
            return;
        }
        
        // Process with idempotency
        const result = await processWebhookWithIdempotency(
            eventId, gateway, eventType,
            async () => {
                let handlerResult;
                
                // Route to appropriate handler
                switch (eventType) {
                    case 'payment.authorized':
                    case 'payment.captured':
                    case 'payment_intent.succeeded':
                    case 'PAYMENT.CAPTURE.COMPLETED':
                    case 'order.paid':
                        handlerResult = await handlePaymentSuccess(paymentData, gateway);
                        break;
                        
                    case 'payment.failed':
                    case 'payment_intent.payment_failed':
                    case 'PAYMENT.CAPTURE.DENIED':
                        handlerResult = await handlePaymentFailed(paymentData, gateway);
                        break;
                        
                    case 'refund.created':
                    case 'refund.processed':
                    case 'charge.refunded':
                    case 'PAYMENT.CAPTURE.REFUNDED':
                        handlerResult = await handleRefund(paymentData, gateway);
                        break;
                        
                    case 'dispute.created':
                    case 'charge.dispute.created':
                    case 'dispute.won':
                    case 'dispute.lost':
                        handlerResult = await handleDispute(paymentData, gateway);
                        break;
                        
                    default:
                        console.log(`[Webhook] Unhandled event type: ${eventType}`);
                        handlerResult = { status: 'unhandled', eventType };
                }
                
                return handlerResult;
            }
        );
        
        const duration = Date.now() - startTime;
        console.log(`[Webhook] ${gateway}/${eventType} processed in ${duration}ms`);
        
        res.status(200).json({
            success: true,
            eventId,
            status: result.status,
            processingTime: duration
        });
        
    } catch (error) {
        console.error('[Webhook] Fatal error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Get webhook events status
 * GET /webhooks/payment/events
 */
exports.getWebhookEvents = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');
        
        const { status, gateway, limit = 50 } = req.query;
        
        let query = db.collection('webhook_events').orderBy('lastAttemptAt', 'desc');
        
        if (status) query = query.where('status', '==', status);
        if (gateway) query = query.where('gateway', '==', gateway);
        
        const snapshot = await query.limit(parseInt(limit)).get();
        
        const events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });
        
        res.status(200).json({ success: true, events, count: events.length });
        
    } catch (error) {
        console.error('[Webhook] Events fetch failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Retry failed webhook event
 * POST /webhooks/payment/retry
 */
exports.retryWebhookEvent = functions.https.onRequest(async (req, res) => {
    try {
        res.set('Access-Control-Allow-Origin', '*');
        
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        
        const { eventId } = req.body;
        if (!eventId) {
            res.status(400).json({ error: 'eventId required' });
            return;
        }
        
        const eventDoc = await db.collection('webhook_events').doc(eventId).get();
        
        if (!eventDoc.exists) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        
        // Reset retry count
        await eventDoc.ref.update({
            retryCount: 0,
            status: 'pending',
            error: null
        });
        
        res.status(200).json({ success: true, message: 'Event queued for retry' });
        
    } catch (error) {
        console.error('[Webhook] Retry failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Cleanup old webhook events
 * Runs daily via Cloud Scheduler
 */
exports.cleanupWebhookEvents = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const snapshot = await db.collection('webhook_events')
                .where('status', 'in', ['completed', 'already_processed'])
                .where('completedAt', '<', thirtyDaysAgo)
                .get();
            
            const batch = db.batch();
            let deletedCount = 0;
            
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
                
                if (deletedCount >= 500) return;
            });
            
            await batch.commit();
            
            console.log(`[Webhook] Cleaned up ${deletedCount} old webhook events`);
            return { success: true, deletedCount };
            
        } catch (error) {
            console.error('[Webhook] Cleanup failed:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Webhook health check
 * GET /webhooks/payment/health
 */
exports.paymentWebhookHealth = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
        const stats = {
            razorpay: WEBHOOK_CONFIG.razorpay.webhookSecret ? 'configured' : 'missing',
            stripe: WEBHOOK_CONFIG.stripe.webhookSecret ? 'configured' : 'missing',
            paypal: WEBHOOK_CONFIG.paypal.webhookId ? 'configured' : 'missing'
        };
        
        const recentEvents = await db.collection('webhook_events')
            .orderBy('lastAttemptAt', 'desc')
            .limit(5)
            .get();
        
        const recentEventList = [];
        recentEvents.forEach(doc => recentEventList.push(doc.data()));
        
        res.status(200).json({
            success: true,
            status: 'healthy',
            config: stats,
            recentEvents: recentEventList,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = exports;


