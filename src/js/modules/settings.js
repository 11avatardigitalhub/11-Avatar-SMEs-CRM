/**
 * 11 AVATAR DIGITAL HUB - Settings Module
 * Enterprise-grade settings & configuration management
 * System settings, user preferences, organization profile, integrations, security
 * 
 * @module Settings
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
 * Settings Module - Complete system configuration management
 * Handles all settings, preferences, integrations, security, billing
 */
class SettingsModule {
    constructor() {
        // Module identity
        this.moduleName = 'settings';
        this.apiEndpoint = '/api/settings';
        this.cachePrefix = 'settings_';
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        
        // Settings sections
        this.sections = {
            'organization': {
                label: 'Organization',
                icon: 'fa-building',
                color: '#3B82F6',
                description: 'Company profile, branding, legal info'
            },
            'general': {
                label: 'General',
                icon: 'fa-cog',
                color: '#6B7280',
                description: 'Application preferences, locale, timezone'
            },
            'users': {
                label: 'Users & Roles',
                icon: 'fa-users-cog',
                color: '#8B5CF6',
                description: 'User management, RBAC, permissions'
            },
            'billing': {
                label: 'Billing & Subscription',
                icon: 'fa-credit-card',
                color: '#10B981',
                description: 'Plans, invoices, payment methods'
            },
            'integrations': {
                label: 'Integrations',
                icon: 'fa-plug',
                color: '#EC4899',
                description: 'Third-party apps, APIs, webhooks'
            },
            'notifications': {
                label: 'Notifications',
                icon: 'fa-bell',
                color: '#F59E0B',
                description: 'Email, SMS, push notification settings'
            },
            'security': {
                label: 'Security',
                icon: 'fa-shield-alt',
                color: '#DC2626',
                description: '2FA, sessions, API keys, audit log'
            },
            'appearance': {
                label: 'Appearance',
                icon: 'fa-palette',
                color: '#14B8A6',
                description: 'Theme, layout, display preferences'
            },
            'email': {
                label: 'Email Settings',
                icon: 'fa-envelope',
                color: '#6366F1',
                description: 'SMTP, templates, signatures'
            },
            'backup': {
                label: 'Backup & Restore',
                icon: 'fa-cloud-upload-alt',
                color: '#F97316',
                description: 'Data backup, restore, export'
            },
            'developer': {
                label: 'Developer',
                icon: 'fa-code',
                color: '#7C3AED',
                description: 'API keys, webhooks, custom code'
            }
        };
        
        // Organization settings
        this.organization = {
            name: '',
            legalName: '',
            website: '',
            email: '',
            phone: '',
            address: {
                line1: '',
                line2: '',
                city: '',
                state: '',
                pincode: '',
                country: 'India'
            },
            gstin: '',
            pan: '',
            cin: '',
            logo: null,
            favicon: null,
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h',
            language: 'en',
            industry: 'IT Services'
        };
        
        // General settings
        this.general = {
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h',
            timezone: 'Asia/Kolkata',
            language: 'en',
            weekStartDay: 'monday',
            fiscalYearStart: 'april',
            decimalPlaces: 2,
            thousandSeparator: ',',
            autoSave: true,
            autoSaveInterval: 60,
            sessionTimeout: 30,
            itemsPerPage: 25
        };
        
        // Security settings
        this.security = {
            twoFactorAuth: false,
            twoFactorMethod: 'app', // app, sms, email
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                maxAge: 90,
                preventReuse: 5
            },
            sessionManagement: {
                maxConcurrentSessions: 3,
                sessionTimeout: 30,
                rememberMe: true,
                forceLogoutOnPasswordChange: true
            },
            ipWhitelisting: false,
            ipWhitelist: [],
            loginAlerts: true,
            auditLogEnabled: true
        };
        
        // Appearance settings
        this.appearance = {
            theme: 'light', // light, dark, system
            primaryColor: '#D4AF37',
            sidebarPosition: 'left',
            sidebarCollapsed: false,
            menuStyle: 'expanded', // expanded, collapsed, icons
            density: 'comfortable', // compact, comfortable, spacious
            font: 'Inter',
            fontSize: 14,
            animations: true,
            glassEffects: true,
            showBreadcrumbs: true
        };
        
        // Billing settings
        this.billing = {
            plan: 'free',
            planDetails: {
                name: 'Free',
                price: 0,
                users: 5,
                storage: '1GB',
                features: ['basic']
            },
            paymentMethod: null,
            billingAddress: null,
            autoRenew: true,
            nextBillingDate: null,
            invoices: []
        };
        
        // Integration settings
        this.integrations = {
            whatsapp: {
                enabled: true,
                cloudWAUrl: 'https://cloudwa.11avatardigitalhub.cloud',
                apiKey: '',
                phoneNumberId: '',
                webhookSecret: ''
            },
            email: {
                provider: 'smtp',
                smtp: {
                    host: '',
                    port: 587,
                    username: '',
                    password: '',
                    encryption: 'tls'
                }
            },
            sms: {
                provider: 'twilio',
                accountSid: '',
                authToken: '',
                fromNumber: ''
            },
            payment: {
                gateway: 'razorpay',
                keyId: '',
                keySecret: '',
                webhookSecret: ''
            },
            calendar: {
                provider: 'google',
                clientId: '',
                clientSecret: '',
                syncEnabled: true
            },
            storage: {
                provider: 'firebase',
                bucket: 'avatar-wa-dual-crm.appspot.com'
            }
        };
        
        // API Keys
        this.apiKeys = [];
        
        // Webhooks
        this.webhooks = [];
        
        // Module state
        this.activeSection = 'organization';
        this.isDirty = false;
        this.unsavedChanges = new Map();
        this.originalSettings = null;
        
        // Audit log
        this.auditLog = [];
        this.auditLogPage = 1;
        
        // Performance
        this.performance = {
            settingsLoadTime: 0,
            lastSaved: null,
            changeCount: 0
        };
        
        // DOM references
        this.elements = {
            container: null,
            sidebar: null,
            contentArea: null,
            sectionTabs: null,
            saveButton: null,
            resetButton: null,
            auditLogTable: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize settings module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Settings] Initializing settings module...');
            
            // Check permissions
            const canAccess = await Permissions.check('settings', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Settings requires admin permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load all settings
            await this.loadAllSettings();
            
            // Store original for change detection
            this.originalSettings = this.getCurrentSettingsSnapshot();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Render
            await this.render();
            
            this.performance.settingsLoadTime = performance.now() - startTime;
            console.log(`[Settings] Initialized in ${this.performance.settingsLoadTime.toFixed(2)}ms`);
            
            EventBus.emit('settings:ready', {
                sections: Object.keys(this.sections).length
            });
            
        } catch (error) {
            console.error('[Settings] Initialization failed:', error);
            Toast.show('Failed to load settings', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#settings-container',
                sidebar: '#settings-sidebar',
                contentArea: '#settings-content',
                sectionTabs: '#settings-tabs',
                saveButton: '#settings-save-btn',
                resetButton: '#settings-reset-btn',
                auditLogTable: '#audit-log-table'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Settings] DOM elements cached');
            
        } catch (error) {
            console.error('[Settings] DOM cache failed:', error);
        }
    }
    
    /**
     * Load all settings
     */
    async loadAllSettings() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}all`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.applySettingsFromCache(cached.data);
                return;
            }
            
            const response = await API.get(`${this.apiEndpoint}/all`);
            
            if (response.success && response.data) {
                this.organization = { ...this.organization, ...response.data.organization };
                this.general = { ...this.general, ...response.data.general };
                this.security = { ...this.security, ...response.data.security };
                this.appearance = { ...this.appearance, ...response.data.appearance };
                this.billing = { ...this.billing, ...response.data.billing };
                this.integrations = { ...this.integrations, ...response.data.integrations };
                this.apiKeys = response.data.apiKeys || [];
                this.webhooks = response.data.webhooks || [];
                
                await Cache.set(`${this.cachePrefix}all`, {
                    organization: this.organization,
                    general: this.general,
                    security: this.security,
                    appearance: this.appearance,
                    billing: this.billing,
                    integrations: this.integrations,
                    apiKeys: this.apiKeys,
                    webhooks: this.webhooks
                }, this.cacheTimeout);
            }
            
            console.log('[Settings] All settings loaded');
            
        } catch (error) {
            console.error('[Settings] Load failed:', error);
        }
    }
    
    /**
     * Apply settings from cache
     */
    applySettingsFromCache(data) {
        this.organization = { ...this.organization, ...data.organization };
        this.general = { ...this.general, ...data.general };
        this.security = { ...this.security, ...data.security };
        this.appearance = { ...this.appearance, ...data.appearance };
        this.billing = { ...this.billing, ...data.billing };
        this.integrations = { ...this.integrations, ...data.integrations };
        this.apiKeys = data.apiKeys || [];
        this.webhooks = data.webhooks || [];
    }
    
    /**
     * Get current settings snapshot
     */
    getCurrentSettingsSnapshot() {
        return JSON.parse(JSON.stringify({
            organization: this.organization,
            general: this.general,
            security: this.security,
            appearance: this.appearance,
            billing: this.billing,
            integrations: this.integrations
        }));
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            // Save button
            if (this.elements.saveButton) {
                this.elements.saveButton.addEventListener('click', () => {
                    this.saveAllSettings();
                });
            }
            
            // Reset button
            if (this.elements.resetButton) {
                this.elements.resetButton.addEventListener('click', () => {
                    this.resetSettings();
                });
            }
            
            // Before unload warning
            window.addEventListener('beforeunload', (e) => {
                if (this.isDirty) {
                    e.preventDefault();
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                }
            });
            
            // Keyboard shortcut for save
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (this.isDirty) {
                        this.saveAllSettings();
                    }
                }
            });
            
            EventBus.on('settings:save', this.saveAllSettings.bind(this));
            EventBus.on('settings:reset', this.resetSettings.bind(this));
            
            console.log('[Settings] Event listeners initialized');
            
        } catch (error) {
            console.error('[Settings] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render settings view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            const html = `
                <div class="settings-container">
                    <!-- Settings Header -->
                    <div class="settings-header">
                        <div class="header-left">
                            <h2><i class="fas fa-cog"></i> Settings</h2>
                            ${this.isDirty ? `
                                <span class="dirty-indicator">
                                    <i class="fas fa-circle"></i> Unsaved changes
                                </span>
                            ` : ''}
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-outline" id="settings-reset-btn" 
                                    ${!this.isDirty ? 'disabled' : ''}>
                                <i class="fas fa-undo"></i> Reset
                            </button>
                            <button class="btn btn-primary" id="settings-save-btn"
                                    ${!this.isDirty ? 'disabled' : ''}>
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                        </div>
                    </div>
                    
                    <!-- Settings Layout -->
                    <div class="settings-layout">
                        <!-- Sidebar Navigation -->
                        <div class="settings-sidebar" id="settings-sidebar">
                            ${this.renderSidebar()}
                        </div>
                        
                        <!-- Content Area -->
                        <div class="settings-content" id="settings-content">
                            ${this.renderSectionContent()}
                        </div>
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            // Re-cache dynamic elements
            this.elements.saveButton = document.getElementById('settings-save-btn');
            this.elements.resetButton = document.getElementById('settings-reset-btn');
            
            console.log('[Settings] View rendered');
            
        } catch (error) {
            console.error('[Settings] Render failed:', error);
        }
    }
    
    /**
     * Render sidebar navigation
     */
    renderSidebar() {
        return Object.entries(this.sections).map(([key, section]) => `
            <div class="settings-nav-item ${this.activeSection === key ? 'active' : ''}"
                 onclick="window.Global.Settings.switchSection('${key}')"
                 style="${this.activeSection === key ? `border-left: 3px solid ${section.color}` : ''}">
                <i class="fas ${section.icon}" style="color: ${section.color}"></i>
                <div class="nav-item-content">
                    <span class="nav-label">${section.label}</span>
                    <small>${section.description}</small>
                </div>
                ${this.hasUnsavedChangesInSection(key) ? `
                    <span class="section-dirty-dot"></span>
                ` : ''}
            </div>
        `).join('');
    }
    
    /**
     * Render section content based on active section
     */
    renderSectionContent() {
        switch (this.activeSection) {
            case 'organization':
                return this.renderOrganizationSection();
            case 'general':
                return this.renderGeneralSection();
            case 'users':
                return this.renderUsersSection();
            case 'billing':
                return this.renderBillingSection();
            case 'integrations':
                return this.renderIntegrationsSection();
            case 'notifications':
                return this.renderNotificationsSection();
            case 'security':
                return this.renderSecuritySection();
            case 'appearance':
                return this.renderAppearanceSection();
            case 'email':
                return this.renderEmailSection();
            case 'backup':
                return this.renderBackupSection();
            case 'developer':
                return this.renderDeveloperSection();
            default:
                return this.renderOrganizationSection();
        }
    }
    
    /**
     * Render organization section
     */
    renderOrganizationSection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-building"></i> Organization Profile</h3>
                    <p>Manage your company information, branding, and legal details</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>Company Information</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label for="org-name">Company Name *</label>
                                <input type="text" id="org-name" value="${this.escapeHtml(this.organization.name)}" 
                                       onchange="window.Global.Settings.updateSetting('organization', 'name', this.value)">
                            </div>
                            <div class="form-group col-6">
                                <label for="org-legal-name">Legal Name</label>
                                <input type="text" id="org-legal-name" value="${this.escapeHtml(this.organization.legalName)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'legalName', this.value)">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label for="org-email">Email</label>
                                <input type="email" id="org-email" value="${this.escapeHtml(this.organization.email)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'email', this.value)">
                            </div>
                            <div class="form-group col-6">
                                <label for="org-phone">Phone</label>
                                <input type="tel" id="org-phone" value="${this.escapeHtml(this.organization.phone)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'phone', this.value)">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label for="org-website">Website</label>
                                <input type="url" id="org-website" value="${this.escapeHtml(this.organization.website)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'website', this.value)">
                            </div>
                            <div class="form-group col-6">
                                <label for="org-industry">Industry</label>
                                <select id="org-industry" onchange="window.Global.Settings.updateSetting('organization', 'industry', this.value)">
                                    <option value="IT Services" ${this.organization.industry === 'IT Services' ? 'selected' : ''}>IT Services</option>
                                    <option value="Software" ${this.organization.industry === 'Software' ? 'selected' : ''}>Software</option>
                                    <option value="Consulting" ${this.organization.industry === 'Consulting' ? 'selected' : ''}>Consulting</option>
                                    <option value="Marketing" ${this.organization.industry === 'Marketing' ? 'selected' : ''}>Marketing</option>
                                    <option value="Other" ${this.organization.industry === 'Other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Tax & Legal Information</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="org-gstin">GSTIN</label>
                                <input type="text" id="org-gstin" value="${this.escapeHtml(this.organization.gstin)}" 
                                       pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
                                       onchange="window.Global.Settings.updateSetting('organization', 'gstin', this.value)">
                            </div>
                            <div class="form-group col-4">
                                <label for="org-pan">PAN</label>
                                <input type="text" id="org-pan" value="${this.escapeHtml(this.organization.pan)}"
                                       pattern="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                                       onchange="window.Global.Settings.updateSetting('organization', 'pan', this.value)">
                            </div>
                            <div class="form-group col-4">
                                <label for="org-cin">CIN</label>
                                <input type="text" id="org-cin" value="${this.escapeHtml(this.organization.cin)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'cin', this.value)">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Address</h4>
                        <div class="form-group">
                            <label for="org-address1">Address Line 1</label>
                            <input type="text" id="org-address1" value="${this.escapeHtml(this.organization.address.line1)}"
                                   onchange="window.Global.Settings.updateSetting('organization', 'address.line1', this.value)">
                        </div>
                        <div class="form-group">
                            <label for="org-address2">Address Line 2</label>
                            <input type="text" id="org-address2" value="${this.escapeHtml(this.organization.address.line2)}"
                                   onchange="window.Global.Settings.updateSetting('organization', 'address.line2', this.value)">
                        </div>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="org-city">City</label>
                                <input type="text" id="org-city" value="${this.escapeHtml(this.organization.address.city)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'address.city', this.value)">
                            </div>
                            <div class="form-group col-4">
                                <label for="org-state">State</label>
                                <input type="text" id="org-state" value="${this.escapeHtml(this.organization.address.state)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'address.state', this.value)">
                            </div>
                            <div class="form-group col-4">
                                <label for="org-pincode">Pincode</label>
                                <input type="text" id="org-pincode" value="${this.escapeHtml(this.organization.address.pincode)}"
                                       onchange="window.Global.Settings.updateSetting('organization', 'address.pincode', this.value)">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Branding</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label>Company Logo</label>
                                <div class="file-upload">
                                    <input type="file" accept="image/*" onchange="window.Global.Settings.uploadLogo(this)">
                                    ${this.organization.logo ? `
                                        <img src="${this.organization.logo}" alt="Logo" class="logo-preview">
                                    ` : '<p class="upload-placeholder">Upload logo (Recommended: 200x60px)</p>'}
                                </div>
                            </div>
                            <div class="form-group col-6">
                                <label>Favicon</label>
                                <div class="file-upload">
                                    <input type="file" accept="image/x-icon,image/png" onchange="window.Global.Settings.uploadFavicon(this)">
                                    ${this.organization.favicon ? `
                                        <img src="${this.organization.favicon}" alt="Favicon" class="favicon-preview">
                                    ` : '<p class="upload-placeholder">Upload favicon (32x32px)</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render general section
     */
    renderGeneralSection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-cog"></i> General Settings</h3>
                    <p>Configure application-wide preferences</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>Regional Settings</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="gen-timezone">Timezone</label>
                                <select id="gen-timezone" onchange="window.Global.Settings.updateSetting('general', 'timezone', this.value)">
                                    <option value="Asia/Kolkata" ${this.general.timezone === 'Asia/Kolkata' ? 'selected' : ''}>Asia/Kolkata (IST)</option>
                                    <option value="America/New_York" ${this.general.timezone === 'America/New_York' ? 'selected' : ''}>America/New York (EST)</option>
                                    <option value="Europe/London" ${this.general.timezone === 'Europe/London' ? 'selected' : ''}>Europe/London (GMT)</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-dateformat">Date Format</label>
                                <select id="gen-dateformat" onchange="window.Global.Settings.updateSetting('general', 'dateFormat', this.value)">
                                    <option value="DD/MM/YYYY" ${this.general.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                                    <option value="MM/DD/YYYY" ${this.general.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                                    <option value="YYYY-MM-DD" ${this.general.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-timeformat">Time Format</label>
                                <select id="gen-timeformat" onchange="window.Global.Settings.updateSetting('general', 'timeFormat', this.value)">
                                    <option value="12h" ${this.general.timeFormat === '12h' ? 'selected' : ''}>12-Hour</option>
                                    <option value="24h" ${this.general.timeFormat === '24h' ? 'selected' : ''}>24-Hour</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="gen-language">Language</label>
                                <select id="gen-language" onchange="window.Global.Settings.updateSetting('general', 'language', this.value)">
                                    <option value="en" ${this.general.language === 'en' ? 'selected' : ''}>English</option>
                                    <option value="hi" ${this.general.language === 'hi' ? 'selected' : ''}>हिंदी</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-weekstart">Week Starts On</label>
                                <select id="gen-weekstart" onchange="window.Global.Settings.updateSetting('general', 'weekStartDay', this.value)">
                                    <option value="monday" ${this.general.weekStartDay === 'monday' ? 'selected' : ''}>Monday</option>
                                    <option value="sunday" ${this.general.weekStartDay === 'sunday' ? 'selected' : ''}>Sunday</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-fiscal">Fiscal Year Start</label>
                                <select id="gen-fiscal" onchange="window.Global.Settings.updateSetting('general', 'fiscalYearStart', this.value)">
                                    <option value="april" ${this.general.fiscalYearStart === 'april' ? 'selected' : ''}>April</option>
                                    <option value="january" ${this.general.fiscalYearStart === 'january' ? 'selected' : ''}>January</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Number Formatting</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="gen-decimals">Decimal Places</label>
                                <input type="number" id="gen-decimals" value="${this.general.decimalPlaces}" min="0" max="6"
                                       onchange="window.Global.Settings.updateSetting('general', 'decimalPlaces', parseInt(this.value))">
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-separator">Thousands Separator</label>
                                <select id="gen-separator" onchange="window.Global.Settings.updateSetting('general', 'thousandSeparator', this.value)">
                                    <option value="," ${this.general.thousandSeparator === ',' ? 'selected' : ''}>Comma (,)</option>
                                    <option value="." ${this.general.thousandSeparator === '.' ? 'selected' : ''}>Dot (.)</option>
                                    <option value=" " ${this.general.thousandSeparator === ' ' ? 'selected' : ''}>Space</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="gen-itemsperpage">Items Per Page</label>
                                <input type="number" id="gen-itemsperpage" value="${this.general.itemsPerPage}" min="10" max="100" step="5"
                                       onchange="window.Global.Settings.updateSetting('general', 'itemsPerPage', parseInt(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Auto-Save</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${this.general.autoSave ? 'checked' : ''} 
                                           onchange="window.Global.Settings.updateSetting('general', 'autoSave', this.checked)">
                                    <span class="toggle-slider"></span>
                                    Enable Auto-Save
                                </label>
                            </div>
                            <div class="form-group col-6">
                                <label for="gen-autosave-interval">Auto-Save Interval (seconds)</label>
                                <input type="number" id="gen-autosave-interval" value="${this.general.autoSaveInterval}" min="30" max="300" step="30"
                                       onchange="window.Global.Settings.updateSetting('general', 'autoSaveInterval', parseInt(this.value))">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render integrations section
     */
    renderIntegrationsSection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-plug"></i> Integrations</h3>
                    <p>Manage third-party service integrations</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>WhatsApp (CloudWA)</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label>CloudWA URL</label>
                                <input type="url" value="${this.escapeHtml(this.integrations.whatsapp.cloudWAUrl)}" readonly>
                            </div>
                            <div class="form-group col-6">
                                <label>Status</label>
                                <span class="status-badge success">Connected</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Email (SMTP)</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="int-smtp-host">SMTP Host</label>
                                <input type="text" id="int-smtp-host" value="${this.escapeHtml(this.integrations.email.smtp.host)}"
                                       onchange="window.Global.Settings.updateIntegration('email', 'smtp.host', this.value)">
                            </div>
                            <div class="form-group col-2">
                                <label for="int-smtp-port">Port</label>
                                <input type="number" id="int-smtp-port" value="${this.integrations.email.smtp.port}"
                                       onchange="window.Global.Settings.updateIntegration('email', 'smtp.port', parseInt(this.value))">
                            </div>
                            <div class="form-group col-3">
                                <label for="int-smtp-user">Username</label>
                                <input type="text" id="int-smtp-user" value="${this.escapeHtml(this.integrations.email.smtp.username)}"
                                       onchange="window.Global.Settings.updateIntegration('email', 'smtp.username', this.value)">
                            </div>
                            <div class="form-group col-3">
                                <label for="int-smtp-pass">Password</label>
                                <input type="password" id="int-smtp-pass" value="${this.escapeHtml(this.integrations.email.smtp.password)}"
                                       onchange="window.Global.Settings.updateIntegration('email', 'smtp.password', this.value)">
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Payment Gateway</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label for="int-payment-gateway">Gateway</label>
                                <select id="int-payment-gateway" onchange="window.Global.Settings.updateIntegration('payment', 'gateway', this.value)">
                                    <option value="razorpay" ${this.integrations.payment.gateway === 'razorpay' ? 'selected' : ''}>Razorpay</option>
                                    <option value="stripe" ${this.integrations.payment.gateway === 'stripe' ? 'selected' : ''}>Stripe</option>
                                    <option value="paypal" ${this.integrations.payment.gateway === 'paypal' ? 'selected' : ''}>PayPal</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label for="int-payment-key">Key ID</label>
                                <input type="text" id="int-payment-key" value="${this.escapeHtml(this.integrations.payment.keyId)}"
                                       onchange="window.Global.Settings.updateIntegration('payment', 'keyId', this.value)">
                            </div>
                            <div class="form-group col-4">
                                <label for="int-payment-secret">Key Secret</label>
                                <input type="password" id="int-payment-secret" value="${this.escapeHtml(this.integrations.payment.keySecret)}"
                                       onchange="window.Global.Settings.updateIntegration('payment', 'keySecret', this.value)">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render security section
     */
    renderSecuritySection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-shield-alt"></i> Security Settings</h3>
                    <p>Manage authentication, sessions, and security policies</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>Two-Factor Authentication</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${this.security.twoFactorAuth ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('security', 'twoFactorAuth', this.checked)">
                                    <span class="toggle-slider"></span>
                                    Enable 2FA
                                </label>
                            </div>
                            <div class="form-group col-6">
                                <label>2FA Method</label>
                                <select onchange="window.Global.Settings.updateSetting('security', 'twoFactorMethod', this.value)"
                                        ${!this.security.twoFactorAuth ? 'disabled' : ''}>
                                    <option value="app" ${this.security.twoFactorMethod === 'app' ? 'selected' : ''}>Authenticator App</option>
                                    <option value="sms" ${this.security.twoFactorMethod === 'sms' ? 'selected' : ''}>SMS</option>
                                    <option value="email" ${this.security.twoFactorMethod === 'email' ? 'selected' : ''}>Email</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Password Policy</h4>
                        <div class="form-row">
                            <div class="form-group col-3">
                                <label>Min Length</label>
                                <input type="number" value="${this.security.passwordPolicy.minLength}" min="6" max="32"
                                       onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.minLength', parseInt(this.value))">
                            </div>
                            <div class="form-group col-3">
                                <label>Max Age (days)</label>
                                <input type="number" value="${this.security.passwordPolicy.maxAge}" min="0" max="365"
                                       onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.maxAge', parseInt(this.value))">
                            </div>
                            <div class="form-group col-3">
                                <label>Prevent Reuse</label>
                                <input type="number" value="${this.security.passwordPolicy.preventReuse}" min="0" max="20"
                                       onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.preventReuse', parseInt(this.value))">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-3">
                                <label class="toggle-check">
                                    <input type="checkbox" ${this.security.passwordPolicy.requireUppercase ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.requireUppercase', this.checked)">
                                    Require Uppercase
                                </label>
                            </div>
                            <div class="form-group col-3">
                                <label class="toggle-check">
                                    <input type="checkbox" ${this.security.passwordPolicy.requireLowercase ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.requireLowercase', this.checked)">
                                    Require Lowercase
                                </label>
                            </div>
                            <div class="form-group col-3">
                                <label class="toggle-check">
                                    <input type="checkbox" ${this.security.passwordPolicy.requireNumbers ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.requireNumbers', this.checked)">
                                    Require Numbers
                                </label>
                            </div>
                            <div class="form-group col-3">
                                <label class="toggle-check">
                                    <input type="checkbox" ${this.security.passwordPolicy.requireSpecialChars ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('security', 'passwordPolicy.requireSpecialChars', this.checked)">
                                    Require Special Chars
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Session Management</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label>Max Concurrent Sessions</label>
                                <input type="number" value="${this.security.sessionManagement.maxConcurrentSessions}" min="1" max="10"
                                       onchange="window.Global.Settings.updateSetting('security', 'sessionManagement.maxConcurrentSessions', parseInt(this.value))">
                            </div>
                            <div class="form-group col-4">
                                <label>Session Timeout (minutes)</label>
                                <input type="number" value="${this.security.sessionManagement.sessionTimeout}" min="5" max="480"
                                       onchange="window.Global.Settings.updateSetting('security', 'sessionManagement.sessionTimeout', parseInt(this.value))">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render appearance section
     */
    renderAppearanceSection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-palette"></i> Appearance</h3>
                    <p>Customize the look and feel of your CRM</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>Theme</h4>
                        <div class="theme-selector">
                            <div class="theme-card ${this.appearance.theme === 'light' ? 'active' : ''}"
                                 onclick="window.Global.Settings.updateSetting('appearance', 'theme', 'light')">
                                <div class="theme-preview light-preview"></div>
                                <span>Light</span>
                            </div>
                            <div class="theme-card ${this.appearance.theme === 'dark' ? 'active' : ''}"
                                 onclick="window.Global.Settings.updateSetting('appearance', 'theme', 'dark')">
                                <div class="theme-preview dark-preview"></div>
                                <span>Dark</span>
                            </div>
                            <div class="theme-card ${this.appearance.theme === 'system' ? 'active' : ''}"
                                 onclick="window.Global.Settings.updateSetting('appearance', 'theme', 'system')">
                                <div class="theme-preview system-preview"></div>
                                <span>System</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Layout</h4>
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label>Sidebar Position</label>
                                <select onchange="window.Global.Settings.updateSetting('appearance', 'sidebarPosition', this.value)">
                                    <option value="left" ${this.appearance.sidebarPosition === 'left' ? 'selected' : ''}>Left</option>
                                    <option value="right" ${this.appearance.sidebarPosition === 'right' ? 'selected' : ''}>Right</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label>Density</label>
                                <select onchange="window.Global.Settings.updateSetting('appearance', 'density', this.value)">
                                    <option value="compact" ${this.appearance.density === 'compact' ? 'selected' : ''}>Compact</option>
                                    <option value="comfortable" ${this.appearance.density === 'comfortable' ? 'selected' : ''}>Comfortable</option>
                                    <option value="spacious" ${this.appearance.density === 'spacious' ? 'selected' : ''}>Spacious</option>
                                </select>
                            </div>
                            <div class="form-group col-4">
                                <label>Font Size</label>
                                <input type="range" min="12" max="20" value="${this.appearance.fontSize}" 
                                       onchange="window.Global.Settings.updateSetting('appearance', 'fontSize', parseInt(this.value))">
                                <span>${this.appearance.fontSize}px</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Effects</h4>
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${this.appearance.animations ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('appearance', 'animations', this.checked)">
                                    <span class="toggle-slider"></span>
                                    Animations
                                </label>
                            </div>
                            <div class="form-group col-6">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${this.appearance.glassEffects ? 'checked' : ''}
                                           onchange="window.Global.Settings.updateSetting('appearance', 'glassEffects', this.checked)">
                                    <span class="toggle-slider"></span>
                                    Glass Effects
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render developer section
     */
    renderDeveloperSection() {
        return `
            <div class="settings-section">
                <div class="section-header">
                    <h3><i class="fas fa-code"></i> Developer Settings</h3>
                    <p>API keys, webhooks, and developer tools</p>
                </div>
                
                <div class="settings-form">
                    <div class="form-section">
                        <h4>API Keys</h4>
                        <div class="api-keys-list">
                            ${this.apiKeys.length > 0 ? this.apiKeys.map(key => `
                                <div class="api-key-item">
                                    <div class="key-info">
                                        <strong>${this.escapeHtml(key.name)}</strong>
                                        <code>${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}</code>
                                        <small>Created: ${Formatters.date(key.createdAt)}</small>
                                    </div>
                                    <div class="key-actions">
                                        <button class="btn btn-sm btn-outline" onclick="window.Global.Settings.copyApiKey('${key.key}')">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="window.Global.Settings.deleteApiKey('${key.id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted">No API keys created</p>'}
                        </div>
                        <button class="btn btn-primary" onclick="window.Global.Settings.createApiKey()">
                            <i class="fas fa-plus"></i> Generate New API Key
                        </button>
                    </div>
                    
                    <div class="form-section">
                        <h4>Webhooks</h4>
                        <div class="webhooks-list">
                            ${this.webhooks.length > 0 ? this.webhooks.map(webhook => `
                                <div class="webhook-item">
                                    <div class="webhook-info">
                                        <strong>${this.escapeHtml(webhook.name)}</strong>
                                        <span class="webhook-url">${this.escapeHtml(webhook.url)}</span>
                                        <small>Events: ${webhook.events.join(', ')}</small>
                                    </div>
                                    <div class="webhook-status">
                                        <span class="status-badge ${webhook.active ? 'success' : 'inactive'}">
                                            ${webhook.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted">No webhooks configured</p>'}
                        </div>
                        <button class="btn btn-primary" onclick="window.Global.Settings.createWebhook()">
                            <i class="fas fa-plus"></i> Add Webhook
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Update a setting value
     */
    updateSetting(section, key, value) {
        try {
            // Handle nested keys (e.g., 'address.line1')
            const keys = key.split('.');
            
            if (keys.length === 1) {
                this[section][key] = value;
            } else {
                let obj = this[section];
                for (let i = 0; i < keys.length - 1; i++) {
                    obj = obj[keys[i]];
                }
                obj[keys[keys.length - 1]] = value;
            }
            
            this.isDirty = true;
            this.unsavedChanges.set(section, true);
            this.performance.changeCount++;
            
            // Enable save button
            this.updateSaveButton();
            
        } catch (error) {
            console.error('[Settings] Update setting failed:', error);
        }
    }
    
    /**
     * Update integration setting
     */
    updateIntegration(integration, key, value) {
        const keys = key.split('.');
        if (keys.length === 1) {
            this.integrations[integration][key] = value;
        } else {
            let obj = this.integrations[integration];
            for (let i = 0; i < keys.length - 1; i++) {
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
        }
        
        this.isDirty = true;
        this.updateSaveButton();
    }
    
    /**
     * Update save button state
     */
    updateSaveButton() {
        const saveBtn = document.getElementById('settings-save-btn');
        const resetBtn = document.getElementById('settings-reset-btn');
        
        if (saveBtn) {
            saveBtn.disabled = !this.isDirty;
        }
        if (resetBtn) {
            resetBtn.disabled = !this.isDirty;
        }
    }
    
    /**
     * Check if section has unsaved changes
     */
    hasUnsavedChangesInSection(section) {
        return this.unsavedChanges.has(section);
    }
    
    /**
     * Save all settings
     */
    async saveAllSettings() {
        try {
            if (!this.isDirty) return;
            
            const saveBtn = document.getElementById('settings-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }
            
            const settings = {
                organization: this.organization,
                general: this.general,
                security: this.security,
                appearance: this.appearance,
                billing: this.billing,
                integrations: this.integrations
            };
            
            const response = await API.put(`${this.apiEndpoint}/save`, settings);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to save settings');
            }
            
            // Update state
            this.isDirty = false;
            this.unsavedChanges.clear();
            this.originalSettings = this.getCurrentSettingsSnapshot();
            this.performance.lastSaved = new Date();
            
            // Update cache
            await Cache.set(`${this.cachePrefix}all`, settings, this.cacheTimeout);
            
            // Apply settings (theme, locale, etc.)
            this.applySettings();
            
            Toast.show('Settings saved successfully', 'success');
            
            // Re-render
            await this.render();
            
            EventBus.emit('settings:saved', settings);
            
        } catch (error) {
            console.error('[Settings] Save failed:', error);
            Toast.show('Failed to save settings: ' + error.message, 'error');
            
            const saveBtn = document.getElementById('settings-save-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    }
    
    /**
     * Apply settings (theme changes, etc.)
     */
    applySettings() {
        // Apply theme
        document.documentElement.setAttribute('data-theme', this.appearance.theme);
        
        // Apply font size
        document.documentElement.style.setProperty('--base-font-size', `${this.appearance.fontSize}px`);
        
        // Apply density
        document.documentElement.setAttribute('data-density', this.appearance.density);
        
        // Apply animations
        if (!this.appearance.animations) {
            document.documentElement.classList.add('no-animations');
        } else {
            document.documentElement.classList.remove('no-animations');
        }
    }
    
    /**
     * Reset settings to last saved state
     */
    async resetSettings() {
        try {
            if (!this.isDirty) return;
            
            const confirmed = await this.confirmDialog(
                'Reset Changes',
                'Are you sure you want to reset all unsaved changes?'
            );
            
            if (!confirmed) return;
            
            // Restore from original
            if (this.originalSettings) {
                this.organization = JSON.parse(JSON.stringify(this.originalSettings.organization));
                this.general = JSON.parse(JSON.stringify(this.originalSettings.general));
                this.security = JSON.parse(JSON.stringify(this.originalSettings.security));
                this.appearance = JSON.parse(JSON.stringify(this.originalSettings.appearance));
                this.billing = JSON.parse(JSON.stringify(this.originalSettings.billing));
                this.integrations = JSON.parse(JSON.stringify(this.originalSettings.integrations));
            }
            
            this.isDirty = false;
            this.unsavedChanges.clear();
            
            await this.render();
            
            Toast.show('Settings reset to last saved state', 'info');
            
        } catch (error) {
            console.error('[Settings] Reset failed:', error);
        }
    }
    
    /**
     * Switch active section
     */
    async switchSection(section) {
        this.activeSection = section;
        await this.render();
    }
    
    /**
     * Upload logo
     */
    async uploadLogo(input) {
        try {
            const file = input.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('logo', file);
            
            const response = await API.upload(`${this.apiEndpoint}/upload-logo`, formData);
            
            if (response.success) {
                this.organization.logo = response.data.url;
                this.updateSetting('organization', 'logo', response.data.url);
                Toast.show('Logo uploaded successfully', 'success');
                await this.render();
            }
            
        } catch (error) {
            console.error('[Settings] Logo upload failed:', error);
            Toast.show('Failed to upload logo', 'error');
        }
    }
    
    /**
     * Create API key
     */
    async createApiKey() {
        try {
            const name = prompt('Enter a name for this API key:');
            if (!name) return;
            
            const response = await API.post(`${this.apiEndpoint}/api-keys`, { name });
            
            if (response.success) {
                this.apiKeys.push(response.data);
                this.isDirty = true;
                
                // Show the key (only shown once)
                const modal = new Modal({
                    title: 'API Key Created',
                    content: `
                        <div class="api-key-reveal">
                            <p>Copy your API key now. You won't be able to see it again!</p>
                            <div class="key-display">
                                <code>${response.data.key}</code>
                                <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${response.data.key}'); window.Global.Toast.show('Copied!', 'success')">
                                    <i class="fas fa-copy"></i> Copy
                                </button>
                            </div>
                        </div>
                    `,
                    size: 'medium'
                });
                
                modal.open();
                await this.render();
            }
            
        } catch (error) {
            console.error('[Settings] API key creation failed:', error);
            Toast.show('Failed to create API key', 'error');
        }
    }
    
    /**
     * Confirm dialog
     */
    confirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title,
                content: `
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary confirm-btn">Confirm</button>
                    </div>
                `,
                size: 'small',
                onClose: () => resolve(false)
            });
            
            modal.open();
            
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(false);
                });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(true);
                });
            }, 100);
        });
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
        EventBus.off('settings:save');
        EventBus.off('settings:reset');
        
        console.log('[Settings] Module destroyed');
    }
}

// Singleton
const settings = new SettingsModule();

// Exports
export { settings, SettingsModule };
export default settings;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Settings = settings;
}


