/**
 * 11 AVATAR DIGITAL HUB - Payment Gateway Integration Module
 * Enterprise-grade payment processing system
 * Razorpay, Stripe, PayPal, UPI, net banking, wallet integration with reconciliation
 * 
 * @module PaymentIntegration
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';
import { Validators } from '../utils/validators.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Payment Gateway Integration - Complete payment processing
 * Multi-gateway support, webhook handling, reconciliation, refunds
 */
class PaymentIntegration {
    constructor() {
        // Module identity
        this.moduleName = 'paymentGateway';
        this.apiEndpoint = '/api/payments/gateway';
        this.cachePrefix = 'pg_';
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
        
        // Supported payment gateways
        this.gateways = {
            'razorpay': {
                label: 'Razorpay',
                icon: 'fa-credit-card',
                color: '#02042B',
                enabled: true,
                supportedMethods: ['card', 'upi', 'netbanking', 'wallet', 'emi'],
                settlementTime: 'T+2',
                charges: {
                    domestic: 2.0, // 2%
                    international: 3.0,
                    upi: 0.0,
                    netbanking: 2.0
                },
                minAmount: 1,
                maxAmount: 500000,
                currency: 'INR',
                testMode: false,
                keyId: null,
                keySecret: null,
                webhookSecret: null
            },
            'stripe': {
                label: 'Stripe',
                icon: 'fa-cc-stripe',
                color: '#635BFF',
                enabled: true,
                supportedMethods: ['card', 'wallet', 'bank_transfer'],
                settlementTime: 'T+7',
                charges: {
                    domestic: 2.0,
                    international: 3.0
                },
                minAmount: 0.50,
                maxAmount: 999999,
                currency: 'USD',
                testMode: false,
                publishableKey: null,
                secretKey: null,
                webhookSecret: null
            },
            'paypal': {
                label: 'PayPal',
                icon: 'fa-paypal',
                color: '#003087',
                enabled: true,
                supportedMethods: ['paypal', 'card'],
                settlementTime: 'Instant',
                charges: {
                    domestic: 2.5,
                    international: 4.4
                },
                minAmount: 1,
                maxAmount: 10000,
                currency: 'USD',
                testMode: false,
                clientId: null,
                clientSecret: null
            },
            'upi': {
                label: 'UPI Direct',
                icon: 'fa-mobile-alt',
                color: '#10B981',
                enabled: true,
                supportedMethods: ['upi'],
                settlementTime: 'Instant',
                charges: {
                    upi: 0.0
                },
                minAmount: 1,
                maxAmount: 100000,
                currency: 'INR',
                vpa: null,
                merchantId: null
            },
            'bank_transfer': {
                label: 'Bank Transfer',
                icon: 'fa-university',
                color: '#3B82F6',
                enabled: true,
                supportedMethods: ['neft', 'rtgs', 'imps'],
                settlementTime: 'T+1',
                charges: {
                    neft: 0,
                    rtgs: 0,
                    imps: 0
                },
                minAmount: 1,
                maxAmount: 999999999,
                currency: 'INR',
                bankDetails: null
            }
        };
        
        // Payment method types
        this.paymentMethods = {
            'card': { label: 'Credit/Debit Card', icon: 'fa-credit-card', color: '#3B82F6' },
            'upi': { label: 'UPI', icon: 'fa-mobile-alt', color: '#10B981' },
            'netbanking': { label: 'Net Banking', icon: 'fa-university', color: '#8B5CF6' },
            'wallet': { label: 'Wallet', icon: 'fa-wallet', color: '#F59E0B' },
            'emi': { label: 'EMI', icon: 'fa-calendar-alt', color: '#EC4899' },
            'paypal': { label: 'PayPal', icon: 'fa-paypal', color: '#003087' },
            'neft': { label: 'NEFT', icon: 'fa-exchange-alt', color: '#14B8A6' },
            'rtgs': { label: 'RTGS', icon: 'fa-bolt', color: '#F97316' },
            'imps': { label: 'IMPS', icon: 'fa-rocket', color: '#6366F1' },
            'bank_transfer': { label: 'Bank Transfer', icon: 'fa-building', color: '#DC2626' }
        };
        
        // Transaction statuses
        this.transactionStatuses = {
            'created': { label: 'Created', color: '#6B7280', icon: 'fa-circle' },
            'pending': { label: 'Pending', color: '#F59E0B', icon: 'fa-clock' },
            'processing': { label: 'Processing', color: '#3B82F6', icon: 'fa-spinner' },
            'completed': { label: 'Completed', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'refunded': { label: 'Refunded', color: '#8B5CF6', icon: 'fa-undo' },
            'partially_refunded': { label: 'Partially Refunded', color: '#6366F1', icon: 'fa-adjust' },
            'disputed': { label: 'Disputed', color: '#F97316', icon: 'fa-exclamation-triangle' },
            'cancelled': { label: 'Cancelled', color: '#9CA3AF', icon: 'fa-ban' }
        };
        
        // Module state
        this.activeGateway = 'razorpay';
        this.transactions = new Map();
        this.selectedTransactionId = null;
        
        // Payment request state
        this.currentPayment = {
            amount: 0,
            currency: 'INR',
            invoiceId: null,
            customerId: null,
            description: '',
            gateway: 'razorpay',
            method: null,
            notes: {}
        };
        
        // Webhook events
        this.webhookEvents = new Map();
        
        // Reconciliation state
        this.reconciliation = {
            lastReconciliationDate: null,
            pendingTransactions: [],
            mismatchedTransactions: [],
            isReconciling: false
        };
        
        // Performance metrics
        this.metrics = {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            totalVolume: 0,
            totalRefunds: 0,
            successRate: 0,
            averageProcessingTime: 0,
            lastUpdated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            paymentForm: null,
            gatewaySelector: null,
            transactionList: null,
            paymentStatus: null,
            qrCodeContainer: null,
            reconciliationPanel: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize payment integration
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[PaymentGateway] Initializing payment integration...');
            
            // Check permissions
            const canAccess = await Permissions.check('payments', 'read');
            if (!canAccess) {
                console.warn('[PaymentGateway] Limited access - permissions required');
                return;
            }
            
            // Load gateway configurations
            await this.loadGatewayConfigs();
            
            // Load transactions
            await this.loadTransactions();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up webhook handler
            this.setupWebhookHandler();
            
            // Render if container exists
            if (document.getElementById('payment-gateway-container')) {
                await this.render();
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`[PaymentGateway] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('paymentGateway:ready', {
                gateways: Object.keys(this.gateways).length,
                transactions: this.transactions.size
            });
            
        } catch (error) {
            console.error('[PaymentGateway] Initialization failed:', error);
        }
    }
    
    /**
     * Load gateway configurations
     */
    async loadGatewayConfigs() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                // Update gateway configs from server
                Object.entries(response.data.gateways || {}).forEach(([key, config]) => {
                    if (this.gateways[key]) {
                        this.gateways[key] = { ...this.gateways[key], ...config };
                    }
                });
                
                this.activeGateway = response.data.defaultGateway || 'razorpay';
                console.log('[PaymentGateway] Gateway configs loaded');
            }
            
        } catch (error) {
            console.error('[PaymentGateway] Config load failed:', error);
        }
    }
    
    /**
     * Load transactions
     */
    async loadTransactions(page = 1) {
        try {
            const response = await API.get(`${this.apiEndpoint}/transactions?page=${page}&limit=50`);
            
            if (response.success && response.data) {
                this.transactions.clear();
                
                response.data.transactions?.forEach(txn => {
                    this.transactions.set(txn.id, {
                        ...txn,
                        formattedAmount: Formatters.currency(txn.amount, txn.currency),
                        formattedDate: Formatters.date(txn.createdAt),
                        formattedTime: Formatters.time(txn.createdAt),
                        statusInfo: this.transactionStatuses[txn.status] || this.transactionStatuses.pending,
                        gatewayInfo: this.gateways[txn.gateway],
                        methodInfo: this.paymentMethods[txn.method],
                        canRefund: txn.status === 'completed',
                        canRetry: txn.status === 'failed'
                    });
                });
                
                this.calculateMetrics();
                console.log(`[PaymentGateway] Loaded ${this.transactions.size} transactions`);
            }
            
        } catch (error) {
            console.error('[PaymentGateway] Transactions load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('payment:initiate', this.initiatePayment.bind(this));
            EventBus.on('payment:verify', this.verifyPayment.bind(this));
            EventBus.on('payment:refund', this.processRefund.bind(this));
            EventBus.on('payment:reconcile', this.reconcileTransactions.bind(this));
            EventBus.on('payment:webhook', this.handleWebhook.bind(this));
            EventBus.on('payment:create-order', this.createRazorpayOrder.bind(this));
            
            // Auto-verify on payment success
            EventBus.on('invoice:created', (invoice) => {
                // Auto-create payment link if enabled
            });
            
            console.log('[PaymentGateway] Event listeners initialized');
            
        } catch (error) {
            console.error('[PaymentGateway] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up webhook handler
     */
    setupWebhookHandler() {
        // Listen for payment gateway webhooks
        // These are typically server-side but client can poll for status
        this.webhookEvents.set('payment.authorized', this.handlePaymentAuthorized.bind(this));
        this.webhookEvents.set('payment.captured', this.handlePaymentCaptured.bind(this));
        this.webhookEvents.set('payment.failed', this.handlePaymentFailed.bind(this));
        this.webhookEvents.set('refund.created', this.handleRefundCreated.bind(this));
        this.webhookEvents.set('refund.processed', this.handleRefundProcessed.bind(this));
        this.webhookEvents.set('dispute.created', this.handleDisputeCreated.bind(this));
        
        console.log('[PaymentGateway] Webhook handler set up');
    }
    
    /**
     * Initiate a payment
     */
    async initiatePayment(paymentData) {
        try {
            const gateway = paymentData.gateway || this.activeGateway;
            const gatewayConfig = this.gateways[gateway];
            
            if (!gatewayConfig || !gatewayConfig.enabled) {
                throw new Error(`Gateway ${gateway} is not available`);
            }
            
            // Validate amount
            if (paymentData.amount < gatewayConfig.minAmount) {
                throw new Error(`Minimum amount is ${Formatters.currency(gatewayConfig.minAmount)}`);
            }
            
            if (paymentData.amount > gatewayConfig.maxAmount) {
                throw new Error(`Maximum amount is ${Formatters.currency(gatewayConfig.maxAmount)}`);
            }
            
            // Set current payment
            this.currentPayment = {
                amount: paymentData.amount,
                currency: paymentData.currency || gatewayConfig.currency,
                invoiceId: paymentData.invoiceId || null,
                customerId: paymentData.customerId || null,
                description: paymentData.description || 'Payment',
                gateway: gateway,
                method: paymentData.method || null,
                notes: paymentData.notes || {}
            };
            
            let paymentResult = null;
            
            switch (gateway) {
                case 'razorpay':
                    paymentResult = await this.initiateRazorpayPayment();
                    break;
                    
                case 'stripe':
                    paymentResult = await this.initiateStripePayment();
                    break;
                    
                case 'paypal':
                    paymentResult = await this.initiatePayPalPayment();
                    break;
                    
                case 'upi':
                    paymentResult = await this.initiateUPIPayment();
                    break;
                    
                case 'bank_transfer':
                    paymentResult = await this.initiateBankTransfer();
                    break;
                    
                default:
                    throw new Error('Unsupported payment gateway');
            }
            
            return paymentResult;
            
        } catch (error) {
            console.error('[PaymentGateway] Payment initiation failed:', error);
            Toast.show('Payment failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Initiate Razorpay payment
     */
    async initiateRazorpayPayment() {
        try {
            const gateway = this.gateways.razorpay;
            
            if (!gateway.keyId) {
                throw new Error('Razorpay key not configured');
            }
            
            // Create order on server
            const response = await API.post(`${this.apiEndpoint}/razorpay/create-order`, {
                amount: this.currentPayment.amount,
                currency: this.currentPayment.currency,
                invoiceId: this.currentPayment.invoiceId,
                notes: this.currentPayment.notes
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to create order');
            }
            
            const orderData = response.data;
            
            // Check if Razorpay SDK is loaded
            if (typeof Razorpay === 'undefined') {
                await this.loadRazorpaySDK();
            }
            
            // Open Razorpay checkout
            return new Promise((resolve, reject) => {
                const options = {
                    key: gateway.keyId,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: this.currentPayment.notes.companyName || '11 Avatar Digital Hub',
                    description: this.currentPayment.description,
                    image: '/assets/logo.png',
                    order_id: orderData.id,
                    handler: async (response) => {
                        // Verify payment signature
                        const verified = await this.verifyPayment({
                            gateway: 'razorpay',
                            paymentId: response.razorpay_payment_id,
                            orderId: response.razorpay_order_id,
                            signature: response.razorpay_signature
                        });
                        
                        if (verified) {
                            resolve(verified);
                        } else {
                            reject(new Error('Payment verification failed'));
                        }
                    },
                    prefill: {
                        name: this.currentPayment.notes.customerName || '',
                        email: this.currentPayment.notes.customerEmail || '',
                        contact: this.currentPayment.notes.customerPhone || ''
                    },
                    notes: this.currentPayment.notes,
                    theme: {
                        color: '#D4AF37'
                    },
                    modal: {
                        ondismiss: () => {
                            reject(new Error('Payment cancelled'));
                        }
                    }
                };
                
                const razorpay = new Razorpay(options);
                razorpay.open();
                
                razorpay.on('payment.failed', (response) => {
                    reject(new Error(response.error.description || 'Payment failed'));
                });
            });
            
        } catch (error) {
            console.error('[PaymentGateway] Razorpay payment failed:', error);
            throw error;
        }
    }
    
    /**
     * Load Razorpay SDK dynamically
     */
    loadRazorpaySDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            
            script.onload = () => {
                console.log('[PaymentGateway] Razorpay SDK loaded');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Razorpay SDK'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Create Razorpay order (for payment links)
     */
    async createRazorpayOrder(orderData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/razorpay/create-order`, orderData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('[PaymentGateway] Order creation failed:', error);
            return null;
        }
    }
    
    /**
     * Initiate Stripe payment
     */
    async initiateStripePayment() {
        try {
            const gateway = this.gateways.stripe;
            
            if (!gateway.publishableKey) {
                throw new Error('Stripe key not configured');
            }
            
            // Create payment intent on server
            const response = await API.post(`${this.apiEndpoint}/stripe/create-payment-intent`, {
                amount: this.currentPayment.amount,
                currency: this.currentPayment.currency,
                invoiceId: this.currentPayment.invoiceId,
                description: this.currentPayment.description
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            const { clientSecret, paymentIntentId } = response.data;
            
            // Load Stripe.js if not loaded
            if (typeof Stripe === 'undefined') {
                await this.loadStripeSDK();
            }
            
            const stripe = Stripe(gateway.publishableKey);
            
            // Show Stripe Elements or redirect to Checkout
            return new Promise(async (resolve, reject) => {
                const result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: null, // Card element would be here
                        billing_details: {
                            name: this.currentPayment.notes.customerName || '',
                            email: this.currentPayment.notes.customerEmail || ''
                        }
                    }
                });
                
                if (result.error) {
                    reject(new Error(result.error.message));
                } else if (result.paymentIntent.status === 'succeeded') {
                    await this.verifyPayment({
                        gateway: 'stripe',
                        paymentIntentId: result.paymentIntent.id
                    });
                    resolve(result.paymentIntent);
                }
            });
            
        } catch (error) {
            console.error('[PaymentGateway] Stripe payment failed:', error);
            throw error;
        }
    }
    
    /**
     * Load Stripe SDK
     */
    loadStripeSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            
            script.onload = () => {
                console.log('[PaymentGateway] Stripe SDK loaded');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Stripe SDK'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Initiate PayPal payment
     */
    async initiatePayPalPayment() {
        try {
            const gateway = this.gateways.paypal;
            
            // Create PayPal order
            const response = await API.post(`${this.apiEndpoint}/paypal/create-order`, {
                amount: this.currentPayment.amount,
                currency: this.currentPayment.currency,
                description: this.currentPayment.description
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Redirect to PayPal
            if (response.data.approvalUrl) {
                window.location.href = response.data.approvalUrl;
            }
            
            return response.data;
            
        } catch (error) {
            console.error('[PaymentGateway] PayPal payment failed:', error);
            throw error;
        }
    }
    
    /**
     * Initiate UPI payment
     */
    async initiateUPIPayment() {
        try {
            const gateway = this.gateways.upi;
            
            // Generate UPI payment link or QR
            const response = await API.post(`${this.apiEndpoint}/upi/create-payment`, {
                amount: this.currentPayment.amount,
                invoiceId: this.currentPayment.invoiceId,
                description: this.currentPayment.description
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Show UPI QR or deep link
            const upiData = response.data;
            
            // Open UPI app if on mobile
            if (upiData.upiLink && this.isMobileDevice()) {
                window.location.href = upiData.upiLink;
            } else if (upiData.qrCode) {
                // Show QR code
                this.showUPIQRCode(upiData);
            }
            
            // Start polling for payment status
            this.pollUPIPaymentStatus(upiData.transactionId);
            
            return upiData;
            
        } catch (error) {
            console.error('[PaymentGateway] UPI payment failed:', error);
            throw error;
        }
    }
    
    /**
     * Show UPI QR code
     */
    showUPIQRCode(upiData) {
        const modal = new Modal({
            title: 'Scan QR to Pay',
            content: `
                <div class="upi-payment-container">
                    <div class="qr-code-display">
                        <img src="${upiData.qrCode}" alt="UPI QR Code" style="max-width: 300px;">
                    </div>
                    <div class="payment-details">
                        <h4>${Formatters.currency(upiData.amount)}</h4>
                        <p>Scan using any UPI app</p>
                        <p class="transaction-id">Transaction ID: ${upiData.transactionId}</p>
                    </div>
                    <div class="payment-status" id="upi-status">
                        <i class="fas fa-spinner fa-spin"></i> Waiting for payment...
                    </div>
                </div>
            `,
            size: 'medium'
        });
        
        modal.open();
    }
    
    /**
     * Poll UPI payment status
     */
    async pollUPIPaymentStatus(transactionId, maxAttempts = 30) {
        let attempts = 0;
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const response = await API.get(`${this.apiEndpoint}/upi/status/${transactionId}`);
                
                if (response.success && response.data.status === 'completed') {
                    clearInterval(pollInterval);
                    
                    // Update status display
                    const statusEl = document.getElementById('upi-status');
                    if (statusEl) {
                        statusEl.innerHTML = '<i class="fas fa-check-circle" style="color: #10B981;"></i> Payment Successful!';
                    }
                    
                    // Close modal after 2 seconds
                    setTimeout(() => Modal.close(), 2000);
                    
                    Toast.show('Payment received!', 'success');
                    EventBus.emit('payment:completed', response.data);
                }
                
            } catch (error) {
                console.error('[PaymentGateway] UPI polling error:', error);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                
                const statusEl = document.getElementById('upi-status');
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-times-circle" style="color: #DC2626;"></i> Payment timeout';
                }
            }
        }, 2000); // Poll every 2 seconds
    }
    
    /**
     * Initiate bank transfer
     */
    async initiateBankTransfer() {
        try {
            const gateway = this.gateways.bank_transfer;
            
            if (!gateway.bankDetails) {
                throw new Error('Bank details not configured');
            }
            
            // Show bank details
            const modal = new Modal({
                title: 'Bank Transfer Details',
                content: `
                    <div class="bank-transfer-container">
                        <div class="bank-details-card">
                            <h5>Transfer to:</h5>
                            <table class="bank-details-table">
                                <tr><td>Bank:</td><td><strong>${this.escapeHtml(gateway.bankDetails.bankName)}</strong></td></tr>
                                <tr><td>Account Name:</td><td><strong>${this.escapeHtml(gateway.bankDetails.accountName)}</strong></td></tr>
                                <tr><td>Account Number:</td><td><strong>${gateway.bankDetails.accountNumber}</strong></td></tr>
                                <tr><td>IFSC Code:</td><td><strong>${gateway.bankDetails.ifscCode}</strong></td></tr>
                                <tr><td>Account Type:</td><td><strong>${gateway.bankDetails.accountType || 'Current'}</strong></td></tr>
                            </table>
                        </div>
                        
                        <div class="payment-amount-display">
                            <span>Amount to Transfer:</span>
                            <h4>${Formatters.currency(this.currentPayment.amount)}</h4>
                        </div>
                        
                        <div class="form-group">
                            <label>UTR/Reference Number (after transfer)</label>
                            <input type="text" id="bank-utr-input" placeholder="Enter UTR number">
                        </div>
                        
                        <p class="text-muted">
                            <i class="fas fa-info-circle"></i>
                            Please enter the UTR number after completing the transfer for automatic verification.
                        </p>
                        
                        <div class="form-actions">
                            <button class="btn btn-secondary" onclick="window.Global.Modal.close()">Close</button>
                            <button class="btn btn-primary" onclick="window.Global.PaymentGateway.submitBankUTR()">
                                I've Made the Transfer
                            </button>
                        </div>
                    </div>
                `,
                size: 'large'
            });
            
            modal.open();
            
            return { success: true, method: 'bank_transfer' };
            
        } catch (error) {
            console.error('[PaymentGateway] Bank transfer initiation failed:', error);
            throw error;
        }
    }
    
    /**
     * Submit bank transfer UTR for verification
     */
    async submitBankUTR() {
        const utrInput = document.getElementById('bank-utr-input');
        const utr = utrInput?.value?.trim();
        
        if (!utr) {
            Toast.show('Please enter UTR number', 'warning');
            return;
        }
        
        try {
            const response = await API.post(`${this.apiEndpoint}/bank-transfer/verify`, {
                utr: utr,
                amount: this.currentPayment.amount,
                invoiceId: this.currentPayment.invoiceId
            });
            
            if (response.success) {
                Modal.close();
                Toast.show('Payment submitted for verification', 'success');
                EventBus.emit('payment:submitted', response.data);
            }
            
        } catch (error) {
            console.error('[PaymentGateway] UTR submission failed:', error);
            Toast.show('Failed to submit UTR', 'error');
        }
    }
    
    /**
     * Verify payment
     */
    async verifyPayment(verificationData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/verify`, verificationData);
            
            if (!response.success) {
                throw new Error(response.error || 'Verification failed');
            }
            
            const verifiedPayment = response.data;
            
            // Add to transactions
            this.transactions.set(verifiedPayment.id, {
                ...verifiedPayment,
                formattedAmount: Formatters.currency(verifiedPayment.amount, verifiedPayment.currency),
                formattedDate: Formatters.date(verifiedPayment.createdAt),
                statusInfo: this.transactionStatuses.completed,
                gatewayInfo: this.gateways[verifiedPayment.gateway],
                canRefund: true,
                canRetry: false
            });
            
            this.calculateMetrics();
            
            Toast.show('Payment verified successfully!', 'success');
            EventBus.emit('payment:verified', verifiedPayment);
            
            return verifiedPayment;
            
        } catch (error) {
            console.error('[PaymentGateway] Verification failed:', error);
            return null;
        }
    }
    
    /**
     * Process refund
     */
    async processRefund(transactionId, amount = null, reason = '') {
        try {
            const transaction = this.transactions.get(transactionId);
            if (!transaction) throw new Error('Transaction not found');
            
            if (!transaction.canRefund) {
                throw new Error('This transaction cannot be refunded');
            }
            
            const refundAmount = amount || transaction.amount;
            
            if (refundAmount > transaction.amount) {
                throw new Error('Refund amount exceeds transaction amount');
            }
            
            const response = await API.post(`${this.apiEndpoint}/${transactionId}/refund`, {
                amount: refundAmount,
                reason: reason
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Update transaction status
            if (refundAmount === transaction.amount) {
                transaction.status = 'refunded';
                transaction.statusInfo = this.transactionStatuses.refunded;
            } else {
                transaction.status = 'partially_refunded';
                transaction.statusInfo = this.transactionStatuses.partially_refunded;
            }
            
            transaction.canRefund = refundAmount < transaction.amount;
            
            this.transactions.set(transactionId, transaction);
            this.metrics.totalRefunds += refundAmount;
            
            Toast.show('Refund processed successfully', 'success');
            EventBus.emit('payment:refunded', { transactionId, amount: refundAmount });
            
            return response.data;
            
        } catch (error) {
            console.error('[PaymentGateway] Refund failed:', error);
            Toast.show('Refund failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Reconcile transactions
     */
    async reconcileTransactions(startDate = null, endDate = null) {
        try {
            if (this.reconciliation.isReconciling) {
                Toast.show('Reconciliation already in progress', 'warning');
                return;
            }
            
            this.reconciliation.isReconciling = true;
            Toast.show('Starting reconciliation...', 'info');
            
            const response = await API.post(`${this.apiEndpoint}/reconcile`, {
                startDate: startDate || this.reconciliation.lastReconciliationDate,
                endDate: endDate || new Date().toISOString()
            });
            
            if (response.success) {
                this.reconciliation.lastReconciliationDate = new Date().toISOString();
                this.reconciliation.pendingTransactions = response.data.pending || [];
                this.reconciliation.mismatchedTransactions = response.data.mismatched || [];
                
                if (response.data.pending.length === 0 && response.data.mismatched.length === 0) {
                    Toast.show('All transactions reconciled!', 'success');
                } else {
                    Toast.show(
                        `Reconciliation found ${response.data.pending.length} pending and ${response.data.mismatched.length} mismatched transactions`,
                        'warning'
                    );
                }
            }
            
        } catch (error) {
            console.error('[PaymentGateway] Reconciliation failed:', error);
            Toast.show('Reconciliation failed', 'error');
        } finally {
            this.reconciliation.isReconciling = false;
        }
    }
    
    /**
     * Handle webhook events
     */
    async handleWebhook(event) {
        try {
            const handler = this.webhookEvents.get(event.type);
            
            if (handler) {
                await handler(event.data);
            } else {
                console.warn('[PaymentGateway] Unknown webhook event:', event.type);
            }
            
        } catch (error) {
            console.error('[PaymentGateway] Webhook handling failed:', error);
        }
    }
    
    /**
     * Handle payment authorized webhook
     */
    async handlePaymentAuthorized(data) {
        console.log('[PaymentGateway] Payment authorized:', data.paymentId);
    }
    
    /**
     * Handle payment captured webhook
     */
    async handlePaymentCaptured(data) {
        console.log('[PaymentGateway] Payment captured:', data.paymentId);
        
        await this.verifyPayment({
            gateway: data.gateway,
            paymentId: data.paymentId
        });
    }
    
    /**
     * Handle payment failed webhook
     */
    async handlePaymentFailed(data) {
        console.log('[PaymentGateway] Payment failed:', data.paymentId);
        this.metrics.failedTransactions++;
    }
    
    /**
     * Handle refund created webhook
     */
    handleRefundCreated(data) {
        console.log('[PaymentGateway] Refund created:', data.refundId);
    }
    
    /**
     * Handle refund processed webhook
     */
    handleRefundProcessed(data) {
        console.log('[PaymentGateway] Refund processed:', data.refundId);
    }
    
    /**
     * Handle dispute created webhook
     */
    async handleDisputeCreated(data) {
        console.log('[PaymentGateway] Dispute created:', data.disputeId);
        
        // Notify admin
        EventBus.emit('notification:send', {
            category: 'alert',
            priority: 'high',
            title: 'Payment Dispute Filed',
            message: `A dispute has been filed for transaction ${data.transactionId}`,
            channels: ['email', 'in_app']
        });
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let total = 0;
            let successful = 0;
            let failed = 0;
            let totalVolume = 0;
            let totalRefunds = 0;
            
            this.transactions.forEach(txn => {
                total++;
                
                if (txn.status === 'completed') {
                    successful++;
                    totalVolume += txn.amount || 0;
                }
                
                if (txn.status === 'failed') failed++;
                if (txn.status === 'refunded' || txn.status === 'partially_refunded') {
                    totalRefunds += txn.refundAmount || txn.amount || 0;
                }
            });
            
            this.metrics.totalTransactions = total;
            this.metrics.successfulTransactions = successful;
            this.metrics.failedTransactions = failed;
            this.metrics.totalVolume = totalVolume;
            this.metrics.totalRefunds = totalRefunds;
            this.metrics.successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
            this.metrics.lastUpdated = new Date();
            
        } catch (error) {
            console.error('[PaymentGateway] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Check if device is mobile
     */
    isMobileDevice() {
        return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
    }
    
    /**
     * Get available payment methods for a gateway
     */
    getAvailableMethods(gateway) {
        const gatewayConfig = this.gateways[gateway];
        if (!gatewayConfig) return [];
        
        return gatewayConfig.supportedMethods.map(method => ({
            id: method,
            ...this.paymentMethods[method]
        }));
    }
    
    /**
     * Calculate gateway charges
     */
    calculateCharges(amount, gateway, method = 'card') {
        const gatewayConfig = this.gateways[gateway];
        if (!gatewayConfig) return 0;
        
        const chargePercentage = gatewayConfig.charges[method] || gatewayConfig.charges.domestic || 0;
        return Math.round(amount * (chargePercentage / 100) * 100) / 100;
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Clean up
     */
    destroy() {
        EventBus.off('payment:initiate');
        EventBus.off('payment:verify');
        EventBus.off('payment:refund');
        EventBus.off('payment:reconcile');
        EventBus.off('payment:webhook');
        EventBus.off('payment:create-order');
        
        console.log('[PaymentGateway] Module destroyed');
    }
}

// Singleton
const paymentIntegration = new PaymentIntegration();

// Exports
export { paymentIntegration, PaymentIntegration };
export default paymentIntegration;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.PaymentGateway = paymentIntegration;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
