/**
 * 11 AVATAR DIGITAL HUB - SMS Integration Module
 * Enterprise-grade SMS communication system
 * Twilio, MSG91, TextLocal, DLT compliance, templates, bulk SMS, delivery tracking
 * 
 * @module SMSIntegration
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
 * SMS Integration - Complete SMS management system
 * Multi-provider, DLT compliance, templates, scheduling, delivery tracking
 */
class SMSIntegration {
    constructor() {
        // Module identity
        this.moduleName = 'sms';
        this.apiEndpoint = '/api/sms';
        this.cachePrefix = 'sms_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // SMS providers
        this.providers = {
            'twilio': {
                label: 'Twilio',
                icon: 'fa-sms',
                color: '#F22F46',
                enabled: true,
                supportsUnicode: true,
                supportsMMS: true,
                maxLength: 1600,
                accountSid: null,
                authToken: null,
                fromNumber: null
            },
            'msg91': {
                label: 'MSG91',
                icon: 'fa-mobile-alt',
                color: '#00B4D8',
                enabled: true,
                supportsUnicode: true,
                maxLength: 160,
                authKey: null,
                senderId: null,
                route: 'transactional' // transactional, promotional
            },
            'textlocal': {
                label: 'TextLocal',
                icon: 'fa-comment-sms',
                color: '#FF6B35',
                enabled: true,
                supportsUnicode: true,
                maxLength: 160,
                apiKey: null,
                senderId: null
            },
            'gupshup': {
                label: 'Gupshup',
                icon: 'fa-comment-dots',
                color: '#0088CC',
                enabled: true,
                supportsUnicode: true,
                supportsWhatsApp: true,
                apiKey: null,
                appName: null
            }
        };
        
        // SMS types
        this.smsTypes = {
            'transactional': {
                label: 'Transactional',
                icon: 'fa-exchange-alt',
                color: '#3B82F6',
                description: 'OTP, alerts, notifications',
                priority: 'high'
            },
            'promotional': {
                label: 'Promotional',
                icon: 'fa-bullhorn',
                color: '#F59E0B',
                description: 'Marketing, offers',
                priority: 'low',
                dltRequired: true
            },
            'reminder': {
                label: 'Reminder',
                icon: 'fa-clock',
                color: '#10B981',
                description: 'Payment reminders, appointments',
                priority: 'normal'
            },
            'automated': {
                label: 'Automated',
                icon: 'fa-robot',
                color: '#8B5CF6',
                description: 'System generated',
                priority: 'normal'
            }
        };
        
        // SMS statuses
        this.smsStatuses = {
            'queued': { label: 'Queued', color: '#F59E0B', icon: 'fa-clock' },
            'sent': { label: 'Sent', color: '#3B82F6', icon: 'fa-paper-plane' },
            'delivered': { label: 'Delivered', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'undelivered': { label: 'Undelivered', color: '#F97316', icon: 'fa-exclamation-triangle' },
            'rejected': { label: 'Rejected', color: '#991B1B', icon: 'fa-ban' }
        };
        
        // DLT (Distributed Ledger Technology) compliance for India
        this.dltConfig = {
            enabled: true,
            entityId: null, // PE ID from TRAI
            headerId: null, // Sender ID registration
            templateIds: new Map(), // Template ID mappings
            consentRequired: true,
            scrubbingRequired: true
        };
        
        // Module state
        this.activeProvider = 'msg91';
        this.messages = new Map();
        this.templates = new Map();
        this.selectedMessageId = null;
        
        // SMS queue
        this.smsQueue = [];
        this.isProcessingQueue = false;
        this.queueInterval = null;
        
        // Sender IDs
        this.senderIds = new Map();
        
        // Bulk SMS settings
        this.bulkSettings = {
            batchSize: 100,
            delayBetweenBatches: 2000, // 2 seconds
            maxPerDay: 10000,
            maxPerHour: 1000,
            allowedHours: { start: 9, end: 21 }, // 9 AM to 9 PM as per TRAI
            dltCompliant: true,
            scrubbingEnabled: true
        };
        
        // Filters
        this.filters = {
            status: 'all',
            type: 'all',
            provider: 'all',
            search: '',
            dateRange: null,
            phoneNumber: ''
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
        };
        
        // Performance metrics
        this.metrics = {
            totalSent: 0,
            totalDelivered: 0,
            totalFailed: 0,
            deliveryRate: 0,
            failureRate: 0,
            totalCost: 0,
            averageCost: 0,
            lastUpdated: null
        };
        
        // Cost tracking
        this.costPerSMS = {
            transactional: 0.15,
            promotional: 0.10,
            reminder: 0.12,
            automated: 0.15,
            international: 2.50
        };
        
        // DOM references
        this.elements = {
            container: null,
            messageList: null,
            smsComposer: null,
            templateList: null,
            deliveryReport: null,
            queueStatus: null,
            dltPanel: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize SMS integration
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[SMS] Initializing SMS integration...');
            
            // Check permissions
            const canAccess = await Permissions.check('sms', 'read');
            if (!canAccess) {
                console.warn('[SMS] Limited access - permissions required');
                return;
            }
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load templates
            await this.loadTemplates();
            
            // Load sender IDs
            await this.loadSenderIds();
            
            // Load messages
            await this.loadMessages();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start queue processor
            this.startQueueProcessor();
            
            // Render if container exists
            if (document.getElementById('sms-container')) {
                await this.render();
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`[SMS] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('sms:ready', {
                messages: this.messages.size,
                templates: this.templates.size
            });
            
        } catch (error) {
            console.error('[SMS] Initialization failed:', error);
        }
    }
    
    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                this.activeProvider = response.data.activeProvider || 'msg91';
                this.bulkSettings = { ...this.bulkSettings, ...response.data.bulkSettings };
                this.dltConfig = { ...this.dltConfig, ...response.data.dlt };
                
                // Update provider configs
                Object.entries(response.data.providers || {}).forEach(([key, config]) => {
                    if (this.providers[key]) {
                        this.providers[key] = { ...this.providers[key], ...config };
                    }
                });
                
                console.log('[SMS] Configuration loaded');
            }
            
        } catch (error) {
            console.error('[SMS] Config load failed:', error);
        }
    }
    
    /**
     * Load SMS templates
     */
    async loadTemplates() {
        try {
            const response = await API.get(`${this.apiEndpoint}/templates`);
            
            if (response.success && response.data) {
                this.templates.clear();
                response.data.forEach(template => {
                    this.templates.set(template.id, {
                        ...template,
                        formattedCreated: Formatters.date(template.createdAt),
                        typeInfo: this.smsTypes[template.type] || this.smsTypes.transactional,
                        charCount: template.content?.length || 0,
                        messageCount: Math.ceil((template.content?.length || 0) / 160),
                        variables: this.extractVariables(template.content),
                        isDLTApproved: template.dltStatus === 'approved'
                    });
                });
                
                console.log(`[SMS] Loaded ${this.templates.size} templates`);
            }
            
        } catch (error) {
            console.error('[SMS] Templates load failed:', error);
        }
    }
    
    /**
     * Load sender IDs
     */
    async loadSenderIds() {
        try {
            const response = await API.get(`${this.apiEndpoint}/sender-ids`);
            
            if (response.success && response.data) {
                this.senderIds.clear();
                response.data.forEach(senderId => {
                    this.senderIds.set(senderId.id, {
                        ...senderId,
                        isApproved: senderId.status === 'approved',
                        isDefault: senderId.isDefault
                    });
                });
                
                console.log(`[SMS] Loaded ${this.senderIds.size} sender IDs`);
            }
            
        } catch (error) {
            console.error('[SMS] Sender IDs load failed:', error);
        }
    }
    
    /**
     * Load SMS messages
     */
    async loadMessages(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString()
            });
            
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.type !== 'all') params.set('type', this.filters.type);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const response = await API.get(`${this.apiEndpoint}/messages?${params.toString()}`);
            
            if (response.success && response.data) {
                this.messages.clear();
                
                response.data.messages?.forEach(msg => {
                    this.messages.set(msg.id, {
                        ...msg,
                        formattedDate: Formatters.date(msg.createdAt),
                        formattedTime: Formatters.time(msg.createdAt),
                        statusInfo: this.smsStatuses[msg.status] || this.smsStatuses.queued,
                        typeInfo: this.smsTypes[msg.type] || this.smsTypes.transactional,
                        providerInfo: this.providers[msg.provider],
                        charCount: msg.content?.length || 0,
                        creditUsed: Math.ceil((msg.content?.length || 0) / 160),
                        cost: this.calculateCost(msg.type, msg.content?.length || 0)
                    });
                });
                
                if (response.data.pagination) {
                    this.pagination.total = response.data.pagination.total || 0;
                    this.pagination.totalPages = response.data.pagination.totalPages || 1;
                }
                
                this.calculateMetrics();
                console.log(`[SMS] Loaded ${this.messages.size} messages`);
            }
            
        } catch (error) {
            console.error('[SMS] Messages load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('sms:send', this.sendSMS.bind(this));
            EventBus.on('sms:send-template', this.sendTemplateSMS.bind(this));
            EventBus.on('sms:bulk-send', this.sendBulkSMS.bind(this));
            EventBus.on('sms:send-otp', this.sendOTP.bind(this));
            EventBus.on('sms:verify-otp', this.verifyOTP.bind(this));
            EventBus.on('sms:check-delivery', this.checkDeliveryStatus.bind(this));
            
            // Auto-send SMS on events
            EventBus.on('payment:overdue', (data) => {
                this.sendTemplateSMS('payment_reminder', data.phone, {
                    name: data.clientName,
                    amount: Formatters.currency(data.amount),
                    invoiceNumber: data.invoiceNumber,
                    dueDate: Formatters.date(data.dueDate)
                });
            });
            
            EventBus.on('appointment:reminder', (data) => {
                this.sendTemplateSMS('appointment_reminder', data.phone, {
                    name: data.clientName,
                    date: Formatters.date(data.date),
                    time: data.time
                });
            });
            
            console.log('[SMS] Event listeners initialized');
            
        } catch (error) {
            console.error('[SMS] Event listener setup failed:', error);
        }
    }
    
    /**
     * Send single SMS
     */
    async sendSMS(smsData) {
        try {
            // Validate phone number
            const phone = this.formatPhoneNumber(smsData.to);
            if (!Validators.isPhone(phone)) {
                throw new Error('Invalid phone number');
            }
            
            // Check if within allowed hours (TRAI compliance)
            if (!this.isWithinAllowedHours()) {
                // Queue for later
                this.smsQueue.push({
                    ...smsData,
                    to: phone,
                    queuedAt: new Date().toISOString(),
                    scheduledFor: this.getNextAllowedTime()
                });
                
                Toast.show('SMS queued for allowed hours (9 AM - 9 PM)', 'info');
                return { success: true, queued: true };
            }
            
            // DLT scrubbing if enabled
            let content = smsData.content;
            if (this.dltConfig.enabled && this.dltConfig.scrubbingRequired) {
                content = await this.scrubContent(content, smsData.templateId);
            }
            
            // Build SMS object
            const sms = {
                to: phone,
                content: content,
                type: smsData.type || 'transactional',
                provider: smsData.provider || this.activeProvider,
                senderId: smsData.senderId || this.getDefaultSenderId(),
                templateId: smsData.templateId || null,
                templateData: smsData.templateData || {},
                unicode: smsData.unicode || false,
                flash: smsData.flash || false,
                scheduleAt: smsData.scheduleAt || null,
                metadata: smsData.metadata || {}
            };
            
            // Schedule or send immediately
            if (sms.scheduleAt) {
                return await this.scheduleSMS(sms);
            }
            
            // Add to queue
            this.smsQueue.push({
                ...sms,
                queuedAt: new Date().toISOString()
            });
            
            // Process queue
            this.processSMSQueue();
            
            return { success: true, queued: true };
            
        } catch (error) {
            console.error('[SMS] Send failed:', error);
            return null;
        }
    }
    
    /**
     * Send template-based SMS
     */
    async sendTemplateSMS(templateId, phone, data = {}) {
        try {
            const template = this.templates.get(templateId);
            
            if (!template) {
                throw new Error(`Template "${templateId}" not found`);
            }
            
            // DLT check for promotional SMS
            if (template.type === 'promotional' && this.dltConfig.enabled) {
                if (!template.isDLTApproved) {
                    throw new Error('Template is not DLT approved');
                }
                
                if (this.dltConfig.consentRequired) {
                    const hasConsent = await this.checkDLTConsent(phone, templateId);
                    if (!hasConsent) {
                        throw new Error('No DLT consent from recipient');
                    }
                }
            }
            
            // Process template
            const content = this.processTemplate(template.content, data);
            
            return await this.sendSMS({
                to: phone,
                content: content,
                type: template.type,
                templateId: templateId,
                templateData: data
            });
            
        } catch (error) {
            console.error('[SMS] Template SMS failed:', error);
            return null;
        }
    }
    
    /**
     * Send bulk SMS
     */
    async sendBulkSMS(bulkData) {
        try {
            const recipients = this.parseRecipients(bulkData.to);
            
            if (recipients.length === 0) {
                throw new Error('No recipients for bulk SMS');
            }
            
            // Validate limits
            if (recipients.length > this.bulkSettings.maxPerDay) {
                throw new Error(`Maximum ${this.bulkSettings.maxPerDay} SMS per day`);
            }
            
            // DLT scrubbing for all recipients
            if (this.dltConfig.scrubbingRequired) {
                await this.scrubBulkContent(recipients, bulkData.content, bulkData.templateId);
            }
            
            // Split into batches
            const batches = [];
            for (let i = 0; i < recipients.length; i += this.bulkSettings.batchSize) {
                batches.push(recipients.slice(i, i + this.bulkSettings.batchSize));
            }
            
            let sentCount = 0;
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                
                for (const recipient of batch) {
                    this.smsQueue.push({
                        to: this.formatPhoneNumber(recipient),
                        content: bulkData.content,
                        type: bulkData.type || 'promotional',
                        templateId: bulkData.templateId,
                        bulkId: bulkData.bulkId || Date.now().toString(),
                        tags: ['bulk', ...(bulkData.tags || [])]
                    });
                    
                    sentCount++;
                }
                
                // Delay between batches
                if (i < batches.length - 1) {
                    await this.delay(this.bulkSettings.delayBetweenBatches);
                }
            }
            
            this.processSMSQueue();
            
            return { success: true, batches: batches.length, recipients: sentCount };
            
        } catch (error) {
            console.error('[SMS] Bulk send failed:', error);
            return null;
        }
    }
    
    /**
     * Send OTP
     */
    async sendOTP(phone, purpose = 'authentication') {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            
            if (!Validators.isPhone(formattedPhone)) {
                throw new Error('Invalid phone number');
            }
            
            // Generate OTP
            const otp = this.generateOTP();
            
            // Store OTP with expiry (5 minutes)
            const otpData = {
                phone: formattedPhone,
                otp: otp,
                purpose: purpose,
                attempts: 0,
                maxAttempts: 3,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                verified: false
            };
            
            await API.post(`${this.apiEndpoint}/otp/store`, otpData);
            
            // Send OTP via high-priority transactional SMS
            const result = await this.sendSMS({
                to: formattedPhone,
                content: `${otp} is your OTP for ${purpose}. Valid for 5 minutes. Do not share with anyone. - 11 Avatar Digital Hub`,
                type: 'transactional',
                priority: 'high',
                metadata: { purpose, otpId: otpData.otp }
            });
            
            return { success: true, message: 'OTP sent successfully' };
            
        } catch (error) {
            console.error('[SMS] OTP send failed:', error);
            return null;
        }
    }
    
    /**
     * Verify OTP
     */
    async verifyOTP(phone, otp, purpose = 'authentication') {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            
            const response = await API.post(`${this.apiEndpoint}/otp/verify`, {
                phone: formattedPhone,
                otp: otp,
                purpose: purpose
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Invalid OTP');
            }
            
            return { success: true, verified: true };
            
        } catch (error) {
            console.error('[SMS] OTP verification failed:', error);
            return { success: false, verified: false, error: error.message };
        }
    }
    
    /**
     * Generate 6-digit OTP
     */
    generateOTP() {
        return String(Math.floor(100000 + Math.random() * 900000));
    }
    
    /**
     * Process SMS queue
     */
    async processSMSQueue() {
        if (this.isProcessingQueue || this.smsQueue.length === 0) return;
        
        try {
            this.isProcessingQueue = true;
            
            // Process scheduled messages first
            this.smsQueue.sort((a, b) => {
                const aTime = a.scheduledFor || a.queuedAt;
                const bTime = b.scheduledFor || b.queuedAt;
                return new Date(aTime) - new Date(bTime);
            });
            
            while (this.smsQueue.length > 0) {
                const sms = this.smsQueue[0];
                
                // Check if it's time to send
                if (sms.scheduledFor && new Date(sms.scheduledFor) > new Date()) {
                    break; // Wait for scheduled time
                }
                
                // Check allowed hours
                if (!this.isWithinAllowedHours() && sms.type !== 'transactional') {
                    break; // Wait for allowed hours
                }
                
                // Remove from queue
                this.smsQueue.shift();
                
                // Send via provider
                const result = await this.sendViaProvider(sms);
                
                if (result.success) {
                    // Add to messages
                    this.messages.set(result.id, {
                        ...result,
                        formattedDate: Formatters.date(new Date()),
                        statusInfo: this.smsStatuses.sent
                    });
                    
                    this.metrics.totalSent++;
                } else {
                    // Re-queue on failure (max 3 attempts)
                    if (!sms.retryCount || sms.retryCount < 3) {
                        sms.retryCount = (sms.retryCount || 0) + 1;
                        sms.lastError = result.error;
                        this.smsQueue.push(sms);
                    } else {
                        this.metrics.totalFailed++;
                    }
                }
                
                // Small delay between sends
                await this.delay(50);
            }
            
        } catch (error) {
            console.error('[SMS] Queue processing failed:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }
    
    /**
     * Send SMS via configured provider
     */
    async sendViaProvider(sms) {
        try {
            const response = await API.post(`${this.apiEndpoint}/send`, {
                ...sms,
                provider: sms.provider || this.activeProvider
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            return response.data;
            
        } catch (error) {
            console.error('[SMS] Provider send failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Schedule SMS for future delivery
     */
    async scheduleSMS(smsData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/schedule`, smsData);
            
            if (response.success) {
                Toast.show(`SMS scheduled for ${Formatters.date(smsData.scheduleAt)}`, 'success');
                return response.data;
            }
            
        } catch (error) {
            console.error('[SMS] Schedule failed:', error);
            return null;
        }
    }
    
    /**
     * Check delivery status
     */
    async checkDeliveryStatus(messageId) {
        try {
            const response = await API.get(`${this.apiEndpoint}/status/${messageId}`);
            
            if (response.success) {
                const message = this.messages.get(messageId);
                if (message) {
                    message.status = response.data.status;
                    message.statusInfo = this.smsStatuses[response.data.status];
                    message.deliveredAt = response.data.deliveredAt;
                    
                    this.messages.set(messageId, message);
                    
                    if (response.data.status === 'delivered') {
                        this.metrics.totalDelivered++;
                    }
                }
                
                return response.data;
            }
            
        } catch (error) {
            console.error('[SMS] Status check failed:', error);
            return null;
        }
    }
    
    /**
     * Start queue processor interval
     */
    startQueueProcessor() {
        if (this.queueInterval) {
            clearInterval(this.queueInterval);
        }
        
        this.queueInterval = setInterval(() => {
            this.processSMSQueue();
            
            // Check delivery status for pending messages
            this.checkPendingDeliveries();
        }, 10000); // Every 10 seconds
        
        console.log('[SMS] Queue processor started');
    }
    
    /**
     * Check delivery status for pending messages
     */
    async checkPendingDeliveries() {
        const pendingMessages = Array.from(this.messages.values())
            .filter(msg => msg.status === 'sent' || msg.status === 'queued')
            .slice(0, 10); // Check max 10 at a time
        
        for (const msg of pendingMessages) {
            await this.checkDeliveryStatus(msg.id);
        }
    }
    
    /**
     * Process template variables
     */
    processTemplate(template, data) {
        if (!template) return '';
        
        return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            return data[variable] !== undefined ? String(data[variable]) : match;
        });
    }
    
    /**
     * Extract variables from template
     */
    extractVariables(content) {
        if (!content) return [];
        
        const matches = content.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    }
    
    /**
     * DLT content scrubbing
     */
    async scrubContent(content, templateId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/dlt/scrub`, {
                content,
                templateId
            });
            
            if (response.success) {
                return response.data.scrubbedContent;
            }
            
            return content;
            
        } catch (error) {
            console.error('[SMS] DLT scrubbing failed:', error);
            return content;
        }
    }
    
    /**
     * Scrub bulk content for DLT compliance
     */
    async scrubBulkContent(recipients, content, templateId) {
        try {
            await API.post(`${this.apiEndpoint}/dlt/scrub-bulk`, {
                recipients,
                content,
                templateId
            });
            
        } catch (error) {
            console.error('[SMS] Bulk scrubbing failed:', error);
        }
    }
    
    /**
     * Check DLT consent
     */
    async checkDLTConsent(phone, templateId) {
        try {
            const response = await API.get(`${this.apiEndpoint}/dlt/consent/${phone}/${templateId}`);
            return response.success && response.data.hasConsent;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Format phone number to Indian format
     */
    formatPhoneNumber(phone) {
        if (!phone) return '';
        
        // Remove all non-digits
        let cleaned = phone.replace(/\D/g, '');
        
        // Remove leading zeros
        cleaned = cleaned.replace(/^0+/, '');
        
        // Add India country code if 10 digits
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        
        return cleaned;
    }
    
    /**
     * Parse recipients
     */
    parseRecipients(recipients) {
        if (!recipients) return [];
        
        if (Array.isArray(recipients)) return recipients.filter(Boolean);
        
        return recipients
            .split(/[,;\n]/)
            .map(p => p.trim())
            .filter(Boolean);
    }
    
    /**
     * Calculate SMS cost
     */
    calculateCost(type, charCount) {
        const baseCost = this.costPerSMS[type] || this.costPerSMS.transactional;
        const credits = Math.ceil(charCount / 160);
        return baseCost * credits;
    }
    
    /**
     * Get default sender ID
     */
    getDefaultSenderId() {
        const defaultSender = Array.from(this.senderIds.values())
            .find(s => s.isDefault && s.isApproved);
        
        return defaultSender?.id || null;
    }
    
    /**
     * Check if current time is within allowed hours
     */
    isWithinAllowedHours() {
        const now = new Date();
        const hour = now.getHours();
        const { start, end } = this.bulkSettings.allowedHours;
        
        return hour >= start && hour < end;
    }
    
    /**
     * Get next allowed time
     */
    getNextAllowedTime() {
        const now = new Date();
        const { start } = this.bulkSettings.allowedHours;
        
        const nextAllowed = new Date(now);
        
        if (now.getHours() >= this.bulkSettings.allowedHours.end) {
            // Tomorrow at start time
            nextAllowed.setDate(nextAllowed.getDate() + 1);
            nextAllowed.setHours(start, 0, 0, 0);
        } else {
            nextAllowed.setHours(start, 0, 0, 0);
        }
        
        return nextAllowed.toISOString();
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalSent = 0;
            let totalDelivered = 0;
            let totalFailed = 0;
            let totalCost = 0;
            
            this.messages.forEach(msg => {
                totalSent++;
                
                if (msg.status === 'delivered') totalDelivered++;
                if (msg.status === 'failed' || msg.status === 'undelivered' || msg.status === 'rejected') {
                    totalFailed++;
                }
                
                totalCost += msg.cost || 0;
            });
            
            this.metrics.totalSent = totalSent;
            this.metrics.totalDelivered = totalDelivered;
            this.metrics.totalFailed = totalFailed;
            this.metrics.deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
            this.metrics.failureRate = totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0;
            this.metrics.totalCost = totalCost;
            this.metrics.averageCost = totalSent > 0 ? (totalCost / totalSent) : 0;
            this.metrics.lastUpdated = new Date();
            
        } catch (error) {
            console.error('[SMS] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Open SMS composer
     */
    openSMSComposer(options = {}) {
        const templateOptions = Array.from(this.templates.values())
            .map(t => `<option value="${t.id}">${this.escapeHtml(t.name)} (${t.typeInfo.label})</option>`)
            .join('');
        
        const composerHtml = `
            <div class="sms-composer">
                <form id="sms-compose-form">
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>To *</label>
                            <input type="text" name="to" required 
                                   value="${options.to || ''}" 
                                   placeholder="Phone number(s)">
                            <small>Comma-separate for multiple recipients</small>
                        </div>
                        <div class="form-group col-3">
                            <label>Type</label>
                            <select name="type">
                                ${Object.entries(this.smsTypes).map(([key, type]) => `
                                    <option value="${key}">${type.label}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group col-3">
                            <label>Provider</label>
                            <select name="provider">
                                ${Object.entries(this.providers).map(([key, provider]) => `
                                    <option value="${key}" ${this.activeProvider === key ? 'selected' : ''}>
                                        ${provider.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-8">
                            <label>Template</label>
                            <select name="templateId" onchange="window.Global.SMS.applyTemplate(this.value)">
                                <option value="">Type Custom Message</option>
                                ${templateOptions}
                            </select>
                        </div>
                        <div class="form-group col-4">
                            <label>Sender ID</label>
                            <select name="senderId">
                                <option value="">Default</option>
                                ${Array.from(this.senderIds.values()).map(s => `
                                    <option value="${s.id}" ${s.isDefault ? 'selected' : ''}>
                                        ${this.escapeHtml(s.senderId)} ${s.isApproved ? '✓' : '⏳'}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Message *</label>
                        <textarea id="sms-content" name="content" rows="5" maxlength="1600" required
                                  placeholder="Type your message...">${options.content || ''}</textarea>
                        <div class="char-counter">
                            <span id="char-count">0</span>/160 characters | 
                            <span id="msg-count">1</span> SMS credit(s)
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Schedule (Optional)</label>
                            <input type="datetime-local" name="scheduleAt">
                        </div>
                        <div class="form-group col-6">
                            <label class="toggle-check">
                                <input type="checkbox" name="unicode" ${options.unicode ? 'checked' : ''}>
                                Use Unicode (for regional languages)
                            </label>
                        </div>
                    </div>
                    
                    ${this.dltConfig.enabled ? `
                        <div class="dlt-notice">
                            <i class="fas fa-shield-alt"></i>
                            <span>DLT compliance enabled. Templates must be pre-approved for promotional SMS.</span>
                        </div>
                    ` : ''}
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i> Send SMS
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        const modal = new Modal({
            title: 'Send SMS',
            content: composerHtml,
            size: 'large'
        });
        
        modal.open();
        
        // Set up form handlers
        setTimeout(() => {
            this.setupComposerForm(options);
        }, 100);
    }
    
    /**
     * Set up composer form
     */
    setupComposerForm(options = {}) {
        const form = document.getElementById('sms-compose-form');
        const contentArea = document.getElementById('sms-content');
        const charCount = document.getElementById('char-count');
        const msgCount = document.getElementById('msg-count');
        
        if (!form) return;
        
        // Character counter
        contentArea?.addEventListener('input', () => {
            const length = contentArea.value.length;
            const messages = Math.ceil(length / 160);
            
            if (charCount) charCount.textContent = length;
            if (msgCount) msgCount.textContent = messages;
            
            // Color warning
            if (charCount) {
                charCount.style.color = length > 160 ? '#F97316' : '#10B981';
            }
        });
        
        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const content = formData.get('content');
            const to = formData.get('to');
            
            // Determine if single or bulk
            const recipients = this.parseRecipients(to);
            
            try {
                let result;
                
                if (recipients.length > 1) {
                    result = await this.sendBulkSMS({
                        to: recipients,
                        content: content,
                        type: formData.get('type'),
                        templateId: formData.get('templateId') || undefined
                    });
                } else {
                    result = await this.sendSMS({
                        to: to,
                        content: content,
                        type: formData.get('type'),
                        provider: formData.get('provider'),
                        senderId: formData.get('senderId') || undefined,
                        templateId: formData.get('templateId') || undefined,
                        scheduleAt: formData.get('scheduleAt') || undefined,
                        unicode: formData.get('unicode') === 'on'
                    });
                }
                
                if (result) {
                    Modal.close();
                    
                    if (recipients.length > 1) {
                        Toast.show(`Bulk SMS queued for ${recipients.length} recipients`, 'success');
                    } else {
                        Toast.show('SMS sent successfully', 'success');
                    }
                }
            } catch (error) {
                Toast.show('Failed to send SMS: ' + error.message, 'error');
            }
        });
    }
    
    /**
     * Apply template to composer
     */
    applyTemplate(templateId) {
        const template = this.templates.get(templateId);
        const contentArea = document.getElementById('sms-content');
        
        if (template && contentArea) {
            contentArea.value = template.content;
            contentArea.dispatchEvent(new Event('input'));
        }
    }
    
    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        if (this.queueInterval) {
            clearInterval(this.queueInterval);
        }
        
        EventBus.off('sms:send');
        EventBus.off('sms:send-template');
        EventBus.off('sms:bulk-send');
        EventBus.off('sms:send-otp');
        EventBus.off('sms:verify-otp');
        
        console.log('[SMS] Module destroyed');
    }
}

// Singleton
const smsIntegration = new SMSIntegration();

// Exports
export { smsIntegration, SMSIntegration };
export default smsIntegration;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.SMS = smsIntegration;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
