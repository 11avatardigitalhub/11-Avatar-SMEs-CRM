/**
 * 11 AVATAR DIGITAL HUB - Email Integration Module
 * Enterprise-grade email communication system
 * SMTP, IMAP, email templates, bulk email, tracking, scheduling, signatures
 * 
 * @module EmailIntegration
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
 * Email Integration - Complete email management system
 * SMTP/IMAP, templates, tracking, scheduling, signatures, bulk mail
 */
class EmailIntegration {
    constructor() {
        // Module identity
        this.moduleName = 'email';
        this.apiEndpoint = '/api/email';
        this.cachePrefix = 'email_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Email providers
        this.providers = {
            'smtp': {
                label: 'SMTP Server',
                icon: 'fa-server',
                color: '#3B82F6',
                enabled: true,
                requiresConfig: true
            },
            'gmail': {
                label: 'Gmail / Google Workspace',
                icon: 'fa-google',
                color: '#EA4335',
                enabled: true,
                requiresOAuth: true,
                authURL: 'https://accounts.google.com/o/oauth2/auth',
                scopes: ['https://mail.google.com/']
            },
            'outlook': {
                label: 'Outlook / Microsoft 365',
                icon: 'fa-microsoft',
                color: '#0078D4',
                enabled: true,
                requiresOAuth: true
            },
            'sendgrid': {
                label: 'SendGrid',
                icon: 'fa-paper-plane',
                color: '#00B2A9',
                enabled: true,
                requiresApiKey: true
            },
            'mailgun': {
                label: 'Mailgun',
                icon: 'fa-envelope-open-text',
                color: '#F06B66',
                enabled: true,
                requiresApiKey: true
            }
        };
        
        // Email statuses
        this.emailStatuses = {
            'draft': { label: 'Draft', color: '#6B7280', icon: 'fa-pencil-alt' },
            'queued': { label: 'Queued', color: '#F59E0B', icon: 'fa-clock' },
            'sending': { label: 'Sending', color: '#3B82F6', icon: 'fa-spinner' },
            'sent': { label: 'Sent', color: '#10B981', icon: 'fa-check-circle' },
            'delivered': { label: 'Delivered', color: '#8B5CF6', icon: 'fa-inbox' },
            'opened': { label: 'Opened', color: '#6366F1', icon: 'fa-envelope-open' },
            'clicked': { label: 'Clicked', color: '#EC4899', icon: 'fa-mouse-pointer' },
            'bounced': { label: 'Bounced', color: '#DC2626', icon: 'fa-undo' },
            'failed': { label: 'Failed', color: '#991B1B', icon: 'fa-times-circle' },
            'spam': { label: 'Spam', color: '#F97316', icon: 'fa-exclamation-triangle' },
            'unsubscribed': { label: 'Unsubscribed', color: '#9CA3AF', icon: 'fa-user-slash' }
        };
        
        // Email priorities
        this.priorities = {
            'high': { label: 'High', color: '#DC2626', icon: 'fa-arrow-up' },
            'normal': { label: 'Normal', color: '#3B82F6', icon: 'fa-minus' },
            'low': { label: 'Low', color: '#6B7280', icon: 'fa-arrow-down' }
        };
        
        // Template categories
        this.templateCategories = {
            'invoice': { label: 'Invoice', icon: 'fa-file-invoice', color: '#3B82F6' },
            'payment': { label: 'Payment', icon: 'fa-rupee-sign', color: '#10B981' },
            'reminder': { label: 'Reminder', icon: 'fa-clock', color: '#F59E0B' },
            'welcome': { label: 'Welcome', icon: 'fa-handshake', color: '#8B5CF6' },
            'follow_up': { label: 'Follow Up', icon: 'fa-undo', color: '#EC4899' },
            'notification': { label: 'Notification', icon: 'fa-bell', color: '#6366F1' },
            'marketing': { label: 'Marketing', icon: 'fa-bullhorn', color: '#F97316' },
            'custom': { label: 'Custom', icon: 'fa-cog', color: '#6B7280' }
        };
        
        // Module state
        this.activeProvider = 'smtp';
        this.emails = new Map();
        this.templates = new Map();
        this.signatures = new Map();
        this.selectedEmailId = null;
        
        // Email queue
        this.emailQueue = [];
        this.isProcessingQueue = false;
        this.queueInterval = null;
        
        // Tracking
        this.trackingEnabled = true;
        this.trackingData = new Map();
        
        // SMTP Configuration
        this.smtpConfig = {
            host: '',
            port: 587,
            username: '',
            password: '',
            encryption: 'tls', // tls, ssl, none
            fromName: '',
            fromEmail: '',
            replyTo: '',
            signature: ''
        };
        
        // Bulk email settings
        this.bulkSettings = {
            batchSize: 50,
            delayBetweenBatches: 1000, // 1 second
            maxPerHour: 500,
            unsubscribeLink: true,
            trackOpens: true,
            trackClicks: true
        };
        
        // Filters
        this.filters = {
            status: 'all',
            priority: 'all',
            template: 'all',
            search: '',
            dateRange: null,
            hasTracking: false
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 25,
            total: 0,
            totalPages: 0
        };
        
        // Performance metrics
        this.metrics = {
            totalSent: 0,
            totalDelivered: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalBounced: 0,
            deliveryRate: 0,
            openRate: 0,
            clickRate: 0,
            bounceRate: 0,
            averageDeliveryTime: 0,
            lastUpdated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            emailList: null,
            emailComposer: null,
            templateList: null,
            trackingPanel: null,
            queueStatus: null,
            signatureEditor: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize email integration
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Email] Initializing email integration...');
            
            // Check permissions
            const canAccess = await Permissions.check('email', 'read');
            if (!canAccess) {
                console.warn('[Email] Limited access - permissions required');
                return;
            }
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load templates
            await this.loadTemplates();
            
            // Load signatures
            await this.loadSignatures();
            
            // Load emails
            await this.loadEmails();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start queue processor
            this.startQueueProcessor();
            
            // Render if container exists
            if (document.getElementById('email-container')) {
                await this.render();
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`[Email] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('email:ready', {
                emails: this.emails.size,
                templates: this.templates.size
            });
            
        } catch (error) {
            console.error('[Email] Initialization failed:', error);
        }
    }
    
    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                this.smtpConfig = { ...this.smtpConfig, ...response.data.smtp };
                this.bulkSettings = { ...this.bulkSettings, ...response.data.bulkSettings };
                this.trackingEnabled = response.data.trackingEnabled !== false;
                this.activeProvider = response.data.activeProvider || 'smtp';
                
                console.log('[Email] Configuration loaded');
            }
            
        } catch (error) {
            console.error('[Email] Config load failed:', error);
        }
    }
    
    /**
     * Load email templates
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
                        formattedUpdated: Formatters.relativeTime(template.updatedAt),
                        categoryInfo: this.templateCategories[template.category] || this.templateCategories.custom,
                        variableCount: (template.content.match(/\{\{(\w+)\}\}/g) || []).length,
                        variables: this.extractVariables(template.content)
                    });
                });
                
                console.log(`[Email] Loaded ${this.templates.size} templates`);
            }
            
        } catch (error) {
            console.error('[Email] Templates load failed:', error);
        }
    }
    
    /**
     * Load signatures
     */
    async loadSignatures() {
        try {
            const response = await API.get(`${this.apiEndpoint}/signatures`);
            
            if (response.success && response.data) {
                this.signatures.clear();
                response.data.forEach(sig => {
                    this.signatures.set(sig.id, sig);
                });
                
                console.log(`[Email] Loaded ${this.signatures.size} signatures`);
            }
            
        } catch (error) {
            console.error('[Email] Signatures load failed:', error);
        }
    }
    
    /**
     * Load sent/received emails
     */
    async loadEmails(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString()
            });
            
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.priority !== 'all') params.set('priority', this.filters.priority);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (response.success && response.data) {
                this.emails.clear();
                
                response.data.emails?.forEach(email => {
                    this.emails.set(email.id, {
                        ...email,
                        formattedDate: Formatters.date(email.createdAt),
                        formattedTime: Formatters.time(email.createdAt),
                        statusInfo: this.emailStatuses[email.status] || this.emailStatuses.draft,
                        priorityInfo: this.priorities[email.priority] || this.priorities.normal,
                        hasAttachments: email.attachments?.length > 0,
                        isTracked: email.trackingEnabled,
                        openRate: email.recipientCount > 0 ? 
                            Math.round(((email.opens || 0) / email.recipientCount) * 100) : 0,
                        clickRate: email.recipientCount > 0 ? 
                            Math.round(((email.clicks || 0) / email.recipientCount) * 100) : 0
                    });
                });
                
                if (response.data.pagination) {
                    this.pagination.total = response.data.pagination.total || 0;
                    this.pagination.totalPages = response.data.pagination.totalPages || 1;
                }
                
                console.log(`[Email] Loaded ${this.emails.size} emails`);
            }
            
        } catch (error) {
            console.error('[Email] Emails load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('email:send', this.sendEmail.bind(this));
            EventBus.on('email:send-template', this.sendTemplateEmail.bind(this));
            EventBus.on('email:bulk-send', this.sendBulkEmail.bind(this));
            EventBus.on('email:save-draft', this.saveDraft.bind(this));
            EventBus.on('email:schedule', this.scheduleEmail.bind(this));
            EventBus.on('email:track-open', this.trackEmailOpen.bind(this));
            EventBus.on('email:track-click', this.trackEmailClick.bind(this));
            
            // Auto-send emails on events
            EventBus.on('invoice:created', (invoice) => {
                this.sendTemplateEmail('invoice', invoice.clientEmail, {
                    invoiceNumber: invoice.invoiceNumber,
                    amount: Formatters.currency(invoice.total),
                    dueDate: Formatters.date(invoice.dueDate),
                    clientName: invoice.clientName
                });
            });
            
            EventBus.on('payment:received', (payment) => {
                this.sendTemplateEmail('payment_receipt', payment.clientEmail, {
                    amount: Formatters.currency(payment.amount),
                    date: Formatters.date(payment.paymentDate),
                    reference: payment.reference || 'N/A',
                    clientName: payment.clientName
                });
            });
            
            console.log('[Email] Event listeners initialized');
            
        } catch (error) {
            console.error('[Email] Event listener setup failed:', error);
        }
    }
    
    /**
     * Send email
     */
    async sendEmail(emailData) {
        try {
            // Validate recipients
            const recipients = this.parseRecipients(emailData.to);
            if (recipients.length === 0) {
                throw new Error('No valid recipients');
            }
            
            // Validate each email
            for (const recipient of recipients) {
                if (!Validators.isEmail(recipient)) {
                    throw new Error(`Invalid email address: ${recipient}`);
                }
            }
            
            // Build email object
            const email = {
                to: recipients,
                cc: this.parseRecipients(emailData.cc),
                bcc: this.parseRecipients(emailData.bcc),
                subject: emailData.subject || '(No Subject)',
                body: emailData.body || '',
                html: emailData.html || this.convertToHTML(emailData.body),
                priority: emailData.priority || 'normal',
                attachments: emailData.attachments || [],
                templateId: emailData.templateId || null,
                templateData: emailData.templateData || {},
                signature: emailData.signature || this.smtpConfig.signature,
                trackingEnabled: emailData.trackingEnabled !== false && this.trackingEnabled,
                scheduleAt: emailData.scheduleAt || null,
                tags: emailData.tags || [],
                metadata: emailData.metadata || {}
            };
            
            // Schedule or send immediately
            if (email.scheduleAt) {
                return await this.scheduleEmail(email);
            }
            
            // Add to queue
            this.emailQueue.push({
                ...email,
                queuedAt: new Date().toISOString()
            });
            
            // Process queue
            this.processEmailQueue();
            
            Toast.show('Email queued for sending', 'info');
            
            return { success: true, queued: true };
            
        } catch (error) {
            console.error('[Email] Send failed:', error);
            Toast.show('Failed to send email: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Send template-based email
     */
    async sendTemplateEmail(templateId, recipients, data = {}) {
        try {
            const template = this.templates.get(templateId);
            
            if (!template) {
                throw new Error(`Template "${templateId}" not found`);
            }
            
            // Process template with data
            const processedContent = this.processTemplate(template.content, data);
            const processedSubject = this.processTemplate(template.subject, data);
            
            const emailData = {
                to: Array.isArray(recipients) ? recipients : [recipients],
                subject: processedSubject,
                html: processedContent,
                templateId: templateId,
                templateData: data,
                category: template.category
            };
            
            return await this.sendEmail(emailData);
            
        } catch (error) {
            console.error('[Email] Template email failed:', error);
            return null;
        }
    }
    
    /**
     * Send bulk email
     */
    async sendBulkEmail(bulkData) {
        try {
            const recipients = this.parseRecipients(bulkData.to);
            
            if (recipients.length === 0) {
                throw new Error('No recipients for bulk email');
            }
            
            if (recipients.length > this.bulkSettings.maxPerHour) {
                throw new Error(`Maximum ${this.bulkSettings.maxPerHour} recipients per batch`);
            }
            
            // Split into batches
            const batches = [];
            for (let i = 0; i < recipients.length; i += this.bulkSettings.batchSize) {
                batches.push(recipients.slice(i, i + this.bulkSettings.batchSize));
            }
            
            Toast.show(`Sending bulk email to ${recipients.length} recipients in ${batches.length} batches`, 'info');
            
            let sentCount = 0;
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                
                // Add unsubscribe link if enabled
                let htmlContent = bulkData.html || bulkData.body;
                if (this.bulkSettings.unsubscribeLink) {
                    htmlContent += this.generateUnsubscribeLink();
                }
                
                for (const recipient of batch) {
                    this.emailQueue.push({
                        to: [recipient],
                        subject: bulkData.subject,
                        html: htmlContent,
                        priority: bulkData.priority || 'normal',
                        trackingEnabled: this.bulkSettings.trackOpens,
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
            
            this.processEmailQueue();
            
            return { success: true, batches: batches.length, recipients: sentCount };
            
        } catch (error) {
            console.error('[Email] Bulk send failed:', error);
            Toast.show('Bulk email failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Process email queue
     */
    async processEmailQueue() {
        if (this.isProcessingQueue || this.emailQueue.length === 0) return;
        
        try {
            this.isProcessingQueue = true;
            
            while (this.emailQueue.length > 0) {
                const email = this.emailQueue.shift();
                
                // Add tracking pixel if enabled
                if (email.trackingEnabled) {
                    email.html = this.addTrackingPixel(email.html, email.id);
                    email.html = this.addClickTracking(email.html, email.id);
                }
                
                // Add signature
                if (email.signature) {
                    email.html += `<br><br>${email.signature}`;
                }
                
                // Send via API
                const response = await API.post(`${this.apiEndpoint}/send`, email);
                
                if (response.success) {
                    // Add to sent emails
                    this.emails.set(response.data.id, {
                        ...response.data,
                        formattedDate: Formatters.date(new Date()),
                        statusInfo: this.emailStatuses.sent
                    });
                    
                    this.metrics.totalSent++;
                } else {
                    console.error('[Email] Queue send failed:', response.error);
                    
                    // Re-queue on failure (max 3 attempts)
                    if (!email.retryCount || email.retryCount < 3) {
                        email.retryCount = (email.retryCount || 0) + 1;
                        this.emailQueue.push(email);
                    } else {
                        this.metrics.totalBounced++;
                    }
                }
                
                // Small delay between sends
                await this.delay(100);
            }
            
        } catch (error) {
            console.error('[Email] Queue processing failed:', error);
        } finally {
            this.isProcessingQueue = false;
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
            if (this.emailQueue.length > 0 && !this.isProcessingQueue) {
                this.processEmailQueue();
            }
        }, 5000); // Check every 5 seconds
        
        console.log('[Email] Queue processor started');
    }
    
    /**
     * Schedule email for later
     */
    async scheduleEmail(emailData) {
        try {
            const scheduleAt = emailData.scheduleAt || emailData.scheduleTime;
            
            if (!scheduleAt) {
                throw new Error('Schedule time is required');
            }
            
            const scheduleDate = new Date(scheduleAt);
            
            if (scheduleDate <= new Date()) {
                throw new Error('Schedule time must be in the future');
            }
            
            const response = await API.post(`${this.apiEndpoint}/schedule`, {
                ...emailData,
                scheduleAt: scheduleDate.toISOString()
            });
            
            if (response.success) {
                Toast.show(`Email scheduled for ${Formatters.date(scheduleDate)} at ${Formatters.time(scheduleDate)}`, 'success');
                return response.data;
            }
            
        } catch (error) {
            console.error('[Email] Schedule failed:', error);
            Toast.show('Failed to schedule email: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Save email as draft
     */
    async saveDraft(emailData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/drafts`, {
                ...emailData,
                status: 'draft'
            });
            
            if (response.success) {
                Toast.show('Draft saved', 'success');
                return response.data;
            }
            
        } catch (error) {
            console.error('[Email] Draft save failed:', error);
            return null;
        }
    }
    
    /**
     * Process template with variables
     */
    processTemplate(template, data) {
        if (!template) return '';
        
        return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
            return data[variable] !== undefined ? data[variable] : match;
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
     * Add tracking pixel for open tracking
     */
    addTrackingPixel(html, emailId) {
        const trackingURL = `${API.baseURL}/api/email/track/open/${emailId}.png`;
        const pixel = `<img src="${trackingURL}" width="1" height="1" style="display:none;" alt="" />`;
        
        return html + pixel;
    }
    
    /**
     * Add click tracking to links
     */
    addClickTracking(html, emailId) {
        return html.replace(/<a\s+href="([^"]+)"/g, (match, url) => {
            const trackURL = `${API.baseURL}/api/email/track/click/${emailId}?url=${encodeURIComponent(url)}`;
            return `<a href="${trackURL}" data-original-url="${url}"`;
        });
    }
    
    /**
     * Track email open
     */
    async trackEmailOpen(emailId) {
        try {
            if (!this.trackingEnabled) return;
            
            const email = this.emails.get(emailId);
            if (email) {
                email.opens = (email.opens || 0) + 1;
                email.status = 'opened';
                email.statusInfo = this.emailStatuses.opened;
                email.openedAt = new Date().toISOString();
                
                this.emails.set(emailId, email);
                this.metrics.totalOpened++;
                
                // Notify sender (optional)
                EventBus.emit('email:opened', { emailId, openedAt: email.openedAt });
            }
            
        } catch (error) {
            console.error('[Email] Open tracking failed:', error);
        }
    }
    
    /**
     * Track email click
     */
    async trackEmailClick(emailId, url) {
        try {
            if (!this.trackingEnabled) return;
            
            const email = this.emails.get(emailId);
            if (email) {
                email.clicks = (email.clicks || 0) + 1;
                email.status = 'clicked';
                email.statusInfo = this.emailStatuses.clicked;
                email.lastClickedAt = new Date().toISOString();
                
                this.emails.set(emailId, email);
                this.metrics.totalClicked++;
                
                EventBus.emit('email:clicked', { emailId, url, clickedAt: email.lastClickedAt });
            }
            
        } catch (error) {
            console.error('[Email] Click tracking failed:', error);
        }
    }
    
    /**
     * Generate unsubscribe link
     */
    generateUnsubscribeLink() {
        return `
            <br><br>
            <div style="text-align:center; color:#999; font-size:12px; margin-top:20px; padding-top:20px; border-top:1px solid #eee;">
                <p>You received this email because you're registered with 11 Avatar Digital Hub.</p>
                <p>
                    <a href="${window.location.origin}/unsubscribe" style="color:#999;">Unsubscribe</a> | 
                    <a href="${window.location.origin}/preferences" style="color:#999;">Manage Preferences</a>
                </p>
            </div>
        `;
    }
    
    /**
     * Convert plain text to HTML
     */
    convertToHTML(text) {
        if (!text) return '';
        
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    /**
     * Parse recipients string to array
     */
    parseRecipients(recipients) {
        if (!recipients) return [];
        
        if (Array.isArray(recipients)) return recipients.filter(Boolean);
        
        return recipients
            .split(/[,;]/)
            .map(email => email.trim())
            .filter(Boolean);
    }
    
    /**
     * Create/update email template
     */
    async saveTemplate(templateData) {
        try {
            const isEditing = templateData.id && this.templates.has(templateData.id);
            
            const response = isEditing ?
                await API.put(`${this.apiEndpoint}/templates/${templateData.id}`, templateData) :
                await API.post(`${this.apiEndpoint}/templates`, templateData);
            
            if (response.success) {
                Toast.show(`Template ${isEditing ? 'updated' : 'created'} successfully`, 'success');
                await this.loadTemplates();
                return response.data;
            }
            
        } catch (error) {
            console.error('[Email] Template save failed:', error);
            Toast.show('Failed to save template', 'error');
            return null;
        }
    }
    
    /**
     * Open email composer modal
     */
    openEmailComposer(options = {}) {
        const templateOptions = Array.from(this.templates.values())
            .map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`)
            .join('');
        
        const signatureOptions = Array.from(this.signatures.values())
            .map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`)
            .join('');
        
        const composerHtml = `
            <div class="email-composer">
                <form id="email-compose-form">
                    <div class="form-row">
                        <div class="form-group col-12">
                            <label>To *</label>
                            <input type="text" name="to" required 
                                   value="${options.to || ''}" 
                                   placeholder="email@example.com (comma-separated for multiple)">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>CC</label>
                            <input type="text" name="cc" value="${options.cc || ''}" placeholder="cc@example.com">
                        </div>
                        <div class="form-group col-6">
                            <label>BCC</label>
                            <input type="text" name="bcc" value="${options.bcc || ''}" placeholder="bcc@example.com">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Subject *</label>
                        <input type="text" name="subject" required 
                               value="${options.subject || ''}" 
                               placeholder="Email subject...">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-4">
                            <label>Template</label>
                            <select name="templateId" onchange="window.Global.Email.applyTemplate(this.value)">
                                <option value="">No Template</option>
                                ${templateOptions}
                            </select>
                        </div>
                        <div class="form-group col-4">
                            <label>Priority</label>
                            <select name="priority">
                                ${Object.entries(this.priorities).map(([key, p]) => `
                                    <option value="${key}">${p.label}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group col-4">
                            <label>Signature</label>
                            <select name="signatureId">
                                <option value="">Default</option>
                                ${signatureOptions}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="email-body" name="body" rows="12" 
                                  placeholder="Write your message...">${options.body || ''}</textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Schedule (Optional)</label>
                            <input type="datetime-local" name="scheduleAt">
                        </div>
                        <div class="form-group col-6">
                            <label>Attachments</label>
                            <input type="file" name="attachments" multiple>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-12">
                            <label class="toggle-check">
                                <input type="checkbox" name="trackingEnabled" checked>
                                Enable open & click tracking
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-outline" id="save-draft-btn">
                            <i class="fas fa-save"></i> Save Draft
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i> Send Email
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        const modal = new Modal({
            title: 'Compose Email',
            content: composerHtml,
            size: 'xlarge',
            onClose: () => {}
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
        const form = document.getElementById('email-compose-form');
        if (!form) return;
        
        // Save draft button
        const draftBtn = document.getElementById('save-draft-btn');
        draftBtn?.addEventListener('click', async () => {
            const formData = new FormData(form);
            await this.saveDraft({
                to: formData.get('to'),
                cc: formData.get('cc'),
                bcc: formData.get('bcc'),
                subject: formData.get('subject'),
                body: formData.get('body'),
                priority: formData.get('priority'),
                templateId: formData.get('templateId')
            });
        });
        
        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            
            try {
                const result = await this.sendEmail({
                    to: formData.get('to'),
                    cc: formData.get('cc'),
                    bcc: formData.get('bcc'),
                    subject: formData.get('subject'),
                    body: formData.get('body'),
                    priority: formData.get('priority'),
                    templateId: formData.get('templateId') || undefined,
                    scheduleAt: formData.get('scheduleAt') || undefined,
                    trackingEnabled: formData.get('trackingEnabled') === 'on',
                    signatureId: formData.get('signatureId') || undefined
                });
                
                if (result) {
                    Modal.close();
                }
            } catch (error) {
                Toast.show('Failed to send email', 'error');
            }
        });
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalSent = 0;
            let totalDelivered = 0;
            let totalOpened = 0;
            let totalClicked = 0;
            let totalBounced = 0;
            
            this.emails.forEach(email => {
                totalSent++;
                if (email.status === 'delivered' || email.status === 'opened' || email.status === 'clicked') {
                    totalDelivered++;
                }
                if (email.status === 'opened' || email.status === 'clicked') totalOpened++;
                if (email.status === 'clicked') totalClicked++;
                if (email.status === 'bounced' || email.status === 'failed') totalBounced++;
            });
            
            this.metrics.totalSent = totalSent;
            this.metrics.totalDelivered = totalDelivered;
            this.metrics.totalOpened = totalOpened;
            this.metrics.totalClicked = totalClicked;
            this.metrics.totalBounced = totalBounced;
            this.metrics.deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
            this.metrics.openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;
            this.metrics.clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;
            this.metrics.bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;
            this.metrics.lastUpdated = new Date();
            
        } catch (error) {
            console.error('[Email] Metrics calculation failed:', error);
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
        
        EventBus.off('email:send');
        EventBus.off('email:send-template');
        EventBus.off('email:bulk-send');
        EventBus.off('email:save-draft');
        EventBus.off('email:schedule');
        
        console.log('[Email] Module destroyed');
    }
}

// Singleton
const emailIntegration = new EmailIntegration();

// Exports
export { emailIntegration, EmailIntegration };
export default emailIntegration;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Email = emailIntegration;
}
