/**
 * 11 AVATAR DIGITAL HUB - Retainers Module
 * Enterprise-grade retainer management system
 * Recurring billing, auto-invoicing, utilization tracking, SLA monitoring
 * 
 * @module Retainers
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
 * Retainers Module - Complete retainer lifecycle management
 * Handles agreements, billing cycles, auto-invoicing, utilization, renewals
 */
class RetainersModule {
    constructor() {
        // Module identity
        this.moduleName = 'retainers';
        this.apiEndpoint = '/api/retainers';
        this.cachePrefix = 'retainer_';
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
        
        // Retainer status definitions
        this.statuses = {
            'draft': {
                label: 'Draft',
                color: '#6B7280',
                icon: 'fa-pencil-alt',
                order: 1
            },
            'active': {
                label: 'Active',
                color: '#10B981',
                icon: 'fa-play-circle',
                order: 2
            },
            'paused': {
                label: 'Paused',
                color: '#F59E0B',
                icon: 'fa-pause-circle',
                order: 3
            },
            'exhausted': {
                label: 'Hours Exhausted',
                color: '#F97316',
                icon: 'fa-exclamation-triangle',
                order: 4
            },
            'expired': {
                label: 'Expired',
                color: '#DC2626',
                icon: 'fa-calendar-times',
                order: 5
            },
            'cancelled': {
                label: 'Cancelled',
                color: '#9CA3AF',
                icon: 'fa-times-circle',
                order: 6
            },
            'renewed': {
                label: 'Renewed',
                color: '#8B5CF6',
                icon: 'fa-sync',
                order: 7
            }
        };
        
        // Billing cycle types
        this.billingCycles = {
            'weekly': { label: 'Weekly', days: 7, icon: 'fa-calendar-week' },
            'biweekly': { label: 'Bi-Weekly', days: 14, icon: 'fa-calendar-alt' },
            'monthly': { label: 'Monthly', days: 30, icon: 'fa-calendar-check' },
            'quarterly': { label: 'Quarterly', days: 90, icon: 'fa-calendar' },
            'half_yearly': { label: 'Half-Yearly', days: 180, icon: 'fa-calendar-plus' },
            'yearly': { label: 'Yearly', days: 365, icon: 'fa-calendar' },
            'custom': { label: 'Custom', days: 0, icon: 'fa-cog' }
        };
        
        // Retainer types
        this.retainerTypes = {
            'hourly': {
                label: 'Hourly Retainer',
                icon: 'fa-clock',
                color: '#3B82F6',
                description: 'Pre-paid hours per billing cycle'
            },
            'fixed': {
                label: 'Fixed Retainer',
                icon: 'fa-tag',
                color: '#10B981',
                description: 'Fixed monthly fee for defined scope'
            },
            'dedicated': {
                label: 'Dedicated Team',
                icon: 'fa-users',
                color: '#8B5CF6',
                description: 'Dedicated resources on retainer'
            },
            'project': {
                label: 'Project Retainer',
                icon: 'fa-project-diagram',
                color: '#F59E0B',
                description: 'Project-based advance payment'
            },
            'support': {
                label: 'Support Retainer',
                icon: 'fa-headset',
                color: '#EC4899',
                description: 'Ongoing support & maintenance'
            },
            'consulting': {
                label: 'Consulting Retainer',
                icon: 'fa-user-tie',
                color: '#14B8A6',
                description: 'Strategic consulting hours'
            }
        };
        
        // Auto-invoice settings
        this.invoiceSettings = {
            autoGenerate: true,
            generateBefore: 7, // Days before cycle end
            sendAutomatically: false,
            paymentTerms: '15 days',
            lateFeeEnabled: true,
            lateFeePercentage: 2.5, // 2.5% per month
            lateFeeAfterDays: 15
        };
        
        // SLA definitions
        this.slaLevels = {
            'standard': {
                label: 'Standard',
                responseTime: 24, // hours
                resolutionTime: 72,
                priority: 3
            },
            'priority': {
                label: 'Priority',
                responseTime: 8,
                resolutionTime: 24,
                priority: 2
            },
            'critical': {
                label: 'Critical',
                responseTime: 2,
                resolutionTime: 8,
                priority: 1
            },
            'custom': {
                label: 'Custom',
                responseTime: null,
                resolutionTime: null,
                priority: 4
            }
        };
        
        // Module state
        this.retainers = new Map();
        this.selectedRetainerId = null;
        
        // Utilization tracking
        this.utilization = new Map(); // retainerId -> { used, remaining, percentage }
        
        // Invoice history
        this.invoiceHistory = new Map(); // retainerId -> [invoices]
        
        // Upcoming renewals
        this.upcomingRenewals = [];
        
        // Filters
        this.filters = {
            status: 'all',
            type: 'all',
            client: 'all',
            cycle: 'all',
            search: '',
            expiringWithin: null, // days
            lowBalance: false
        };
        
        // Sort config
        this.sortConfig = {
            field: 'nextBillingDate',
            order: 'asc'
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
        };
        
        // View state
        this.currentView = 'grid'; // grid, list, timeline, utilization
        
        // Notifications
        this.notifications = {
            enabled: true,
            renewalReminderDays: [30, 15, 7, 3, 1],
            lowBalanceThreshold: 20, // 20% remaining
            exhaustedNotification: true
        };
        
        // Performance metrics
        this.metrics = {
            totalRetainers: 0,
            activeRetainers: 0,
            totalMRR: 0, // Monthly Recurring Revenue
            totalARR: 0, // Annual Recurring Revenue
            averageUtilization: 0,
            expiringThisMonth: 0,
            renewalRate: 0,
            lastCalculated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            retainerGrid: null,
            retainerList: null,
            retainerDetail: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            metricsPanel: null,
            renewalAlerts: null,
            utilizationChart: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize retainers module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Retainers] Initializing retainer management module...');
            
            // Check permissions
            const canAccess = await Permissions.check('retainers', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Retainers module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load retainers
            await this.loadRetainers();
            
            // Calculate utilization
            await this.calculateAllUtilization();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Check renewals
            this.checkUpcomingRenewals();
            
            // Render
            await this.render();
            
            // Set up auto-renewal check
            this.setupRenewalChecker();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Retainers] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('retainers:ready', {
                count: this.retainers.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Retainers] Initialization failed:', error);
            Toast.show('Failed to load retainers module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#retainers-container',
                retainerGrid: '#retainers-grid',
                retainerList: '#retainers-list',
                retainerDetail: '#retainer-detail',
                filterBar: '#retainers-filters',
                searchInput: '#retainers-search',
                createButton: '#retainer-create-btn',
                metricsPanel: '#retainers-metrics',
                renewalAlerts: '#renewal-alerts',
                utilizationChart: '#utilization-chart'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Retainers] DOM elements cached');
            
        } catch (error) {
            console.error('[Retainers] DOM cache failed:', error);
        }
    }
    
    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}config`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.invoiceSettings = { ...this.invoiceSettings, ...cached.data.invoiceSettings };
                this.notifications = { ...this.notifications, ...cached.data.notifications };
                return;
            }
            
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                this.invoiceSettings = { ...this.invoiceSettings, ...response.data.invoiceSettings };
                this.notifications = { ...this.notifications, ...response.data.notifications };
                
                await Cache.set(`${this.cachePrefix}config`, {
                    invoiceSettings: this.invoiceSettings,
                    notifications: this.notifications
                }, this.cacheTimeout);
            }
            
        } catch (error) {
            console.error('[Retainers] Config load failed:', error);
        }
    }
    
    /**
     * Load retainers
     */
    async loadRetainers(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.type !== 'all') params.set('type', this.filters.type);
            if (this.filters.client !== 'all') params.set('client', this.filters.client);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processRetainersData(cached.data);
                    return;
                }
            }
            
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load retainers');
            }
            
            this.processRetainersData(response.data);
            
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Retainers] Loaded ${this.retainers.size} retainers`);
            
        } catch (error) {
            console.error('[Retainers] Load failed:', error);
            Toast.show('Failed to load retainers', 'error');
        }
    }
    
    /**
     * Process retainers data
     */
    processRetainersData(data) {
        try {
            this.retainers.clear();
            this.invoiceHistory.clear();
            
            if (data.retainers && Array.isArray(data.retainers)) {
                data.retainers.forEach(retainer => {
                    const processed = {
                        ...retainer,
                        // Format fields
                        formattedStartDate: Formatters.date(retainer.startDate),
                        formattedEndDate: Formatters.date(retainer.endDate),
                        formattedNextBilling: Formatters.date(retainer.nextBillingDate),
                        formattedCreated: Formatters.date(retainer.createdAt),
                        
                        // Status info
                        statusInfo: this.statuses[retainer.status] || this.statuses.draft,
                        
                        // Type info
                        typeInfo: this.retainerTypes[retainer.type] || this.retainerTypes.hourly,
                        
                        // Billing cycle info
                        cycleInfo: this.billingCycles[retainer.billingCycle] || this.billingCycles.monthly,
                        
                        // SLA info
                        slaInfo: this.slaLevels[retainer.slaLevel] || this.slaLevels.standard,
                        
                        // Financial
                        formattedAmount: Formatters.currency(retainer.amount),
                        formattedTotalValue: Formatters.currency(retainer.totalValue || (retainer.amount * retainer.totalCycles)),
                        formattedPaidAmount: Formatters.currency(retainer.paidAmount || 0),
                        formattedBalance: Formatters.currency((retainer.totalValue || 0) - (retainer.paidAmount || 0)),
                        
                        // Derived fields
                        daysUntilRenewal: this.calculateDaysUntilRenewal(retainer),
                        isExpiringSoon: this.isExpiringSoon(retainer),
                        isActive: retainer.status === 'active',
                        
                        // Hours tracking (for hourly retainers)
                        totalHours: retainer.totalHours || 0,
                        usedHours: retainer.usedHours || 0,
                        remainingHours: (retainer.totalHours || 0) - (retainer.usedHours || 0),
                        
                        // Client info
                        clientName: retainer.client?.name || 'Unknown',
                        clientCompany: retainer.client?.company || '',
                        
                        // Invoice count
                        invoiceCount: retainer.invoices?.length || 0,
                        
                        // Flags
                        needsAttention: this.checkRetainerNeedsAttention(retainer),
                        canRenew: retainer.status === 'active' || retainer.status === 'expired',
                        canPause: retainer.status === 'active',
                        canCancel: retainer.status !== 'cancelled'
                    };
                    
                    this.retainers.set(retainer.id, processed);
                    
                    // Store invoice history
                    if (retainer.invoices) {
                        this.invoiceHistory.set(retainer.id, retainer.invoices);
                    }
                });
            }
            
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
        } catch (error) {
            console.error('[Retainers] Data processing failed:', error);
        }
    }
    
    /**
     * Calculate utilization for all retainers
     */
    async calculateAllUtilization() {
        try {
            this.utilization.clear();
            
            this.retainers.forEach((retainer, id) => {
                const utilization = this.calculateUtilization(retainer);
                this.utilization.set(id, utilization);
            });
            
            console.log('[Retainers] Utilization calculated');
            
        } catch (error) {
            console.error('[Retainers] Utilization calculation failed:', error);
        }
    }
    
    /**
     * Calculate utilization for a retainer
     */
    calculateUtilization(retainer) {
        try {
            let used = 0;
            let total = 0;
            let percentage = 0;
            
            switch (retainer.type) {
                case 'hourly':
                case 'dedicated':
                case 'consulting':
                    total = retainer.totalHours || 0;
                    used = retainer.usedHours || 0;
                    percentage = total > 0 ? Math.round((used / total) * 100) : 0;
                    break;
                    
                case 'fixed':
                case 'project':
                    total = retainer.totalValue || 0;
                    used = retainer.paidAmount || 0;
                    percentage = total > 0 ? Math.round((used / total) * 100) : 0;
                    break;
                    
                case 'support':
                    total = retainer.totalTickets || 0;
                    used = retainer.usedTickets || 0;
                    percentage = total > 0 ? Math.round((used / total) * 100) : 0;
                    break;
            }
            
            return {
                used,
                total,
                percentage,
                remaining: total - used,
                isLow: percentage > this.notifications.lowBalanceThreshold,
                isExhausted: percentage >= 100
            };
            
        } catch (error) {
            console.error('[Retainers] Utilization calc failed:', error);
            return { used: 0, total: 0, percentage: 0, remaining: 0, isLow: false, isExhausted: false };
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            if (this.elements.createButton) {
                this.elements.createButton.addEventListener('click', () => {
                    this.openCreateRetainer();
                });
            }
            
            EventBus.on('retainer:create', this.createRetainer.bind(this));
            EventBus.on('retainer:update', this.updateRetainer.bind(this));
            EventBus.on('retainer:renew', this.renewRetainer.bind(this));
            EventBus.on('retainer:cancel', this.cancelRetainer.bind(this));
            EventBus.on('retainer:pause', this.pauseRetainer.bind(this));
            EventBus.on('retainer:generate-invoice', this.generateInvoice.bind(this));
            
            console.log('[Retainers] Event listeners initialized');
            
        } catch (error) {
            console.error('[Retainers] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render retainers view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            switch (this.currentView) {
                case 'grid':
                    await this.renderGridView();
                    break;
                case 'list':
                    await this.renderListView();
                    break;
                case 'timeline':
                    await this.renderTimelineView();
                    break;
                case 'utilization':
                    await this.renderUtilizationView();
                    break;
                default:
                    await this.renderGridView();
            }
            
        } catch (error) {
            console.error('[Retainers] Render failed:', error);
        }
    }
    
    /**
     * Render grid view
     */
    async renderGridView() {
        try {
            const html = `
                <div class="retainers-grid-container">
                    <!-- Renewal Alerts -->
                    ${this.renderRenewalAlerts()}
                    
                    <!-- Metrics Dashboard -->
                    <div class="retainer-metrics">
                        <div class="metric-card primary">
                            <i class="fas fa-hand-holding-usd"></i>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.totalMRR)}</span>
                                <span class="metric-label">Monthly Recurring Revenue</span>
                            </div>
                        </div>
                        
                        <div class="metric-card success">
                            <i class="fas fa-chart-line"></i>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.totalARR)}</span>
                                <span class="metric-label">Annual Recurring Revenue</span>
                            </div>
                        </div>
                        
                        <div class="metric-card info">
                            <i class="fas fa-play-circle"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.activeRetainers}</span>
                                <span class="metric-label">Active Retainers</span>
                            </div>
                        </div>
                        
                        <div class="metric-card warning">
                            <i class="fas fa-tachometer-alt"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.averageUtilization}%</span>
                                <span class="metric-label">Avg Utilization</span>
                            </div>
                        </div>
                        
                        <div class="metric-card danger">
                            <i class="fas fa-calendar-times"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.expiringThisMonth}</span>
                                <span class="metric-label">Expiring This Month</span>
                            </div>
                        </div>
                        
                        <div class="metric-card purple">
                            <i class="fas fa-sync"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.renewalRate}%</span>
                                <span class="metric-label">Renewal Rate</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Retainer Cards Grid -->
                    <div class="retainers-grid" id="retainers-grid">
                        ${this.renderRetainerCards()}
                    </div>
                    
                    ${this.retainers.size === 0 ? this.renderEmptyState() : ''}
                    ${this.renderPagination()}
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Retainers] Grid view rendered');
            
        } catch (error) {
            console.error('[Retainers] Grid render failed:', error);
        }
    }
    
    /**
     * Render renewal alerts
     */
    renderRenewalAlerts() {
        if (this.upcomingRenewals.length === 0) return '';
        
        return `
            <div class="renewal-alerts" id="renewal-alerts">
                <div class="alert-header">
                    <i class="fas fa-bell"></i>
                    <span>Upcoming Renewals (${this.upcomingRenewals.length})</span>
                    <button class="btn-close" onclick="window.Global.Retainers.dismissAlerts()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="alert-list">
                    ${this.upcomingRenewals.map(renewal => `
                        <div class="alert-item ${renewal.urgency}">
                            <div class="alert-info">
                                <strong>${this.escapeHtml(renewal.clientName)}</strong>
                                <span>${this.escapeHtml(renewal.retainerName)}</span>
                            </div>
                            <div class="alert-meta">
                                <span class="days-left">${renewal.daysLeft} days left</span>
                                <span class="amount">${Formatters.currency(renewal.amount)}</span>
                            </div>
                            <div class="alert-actions">
                                <button class="btn btn-sm btn-primary" 
                                        onclick="window.Global.Retainers.renewRetainer('${renewal.id}')">
                                    Renew Now
                                </button>
                                <button class="btn btn-sm btn-outline" 
                                        onclick="window.Global.Retainers.sendReminder('${renewal.id}')">
                                    Remind Client
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render retainer cards
     */
    renderRetainerCards() {
        if (this.retainers.size === 0) return '';
        
        let cards = '';
        
        this.retainers.forEach((retainer) => {
            const statusInfo = retainer.statusInfo;
            const typeInfo = retainer.typeInfo;
            const utilization = this.utilization.get(retainer.id);
            const utilizationPercent = utilization?.percentage || 0;
            const utilizationColor = this.getUtilizationColor(utilizationPercent);
            
            cards += `
                <div class="retainer-card glass-card-3d" 
                     data-retainer-id="${retainer.id}"
                     onclick="window.Global.Retainers.openRetainerDetail('${retainer.id}')">
                    
                    <!-- Status Bar -->
                    <div class="retainer-status-bar" style="background: ${statusInfo.color}"></div>
                    
                    <!-- Card Header -->
                    <div class="retainer-card-header">
                        <div class="retainer-type-icon" style="background: ${typeInfo.color}20; color: ${typeInfo.color}">
                            <i class="fas ${typeInfo.icon}"></i>
                        </div>
                        <div class="retainer-status">
                            <span class="status-badge" style="background: ${statusInfo.color}20; color: ${statusInfo.color}">
                                <i class="fas ${statusInfo.icon}"></i>
                                ${statusInfo.label}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Retainer Name -->
                    <h3 class="retainer-name">${this.escapeHtml(retainer.name)}</h3>
                    
                    <!-- Client Info -->
                    <div class="retainer-client">
                        <i class="fas fa-building"></i>
                        <span>${this.escapeHtml(retainer.clientName)}</span>
                    </div>
                    
                    <!-- Financial Info -->
                    <div class="retainer-financials">
                        <div class="financial-item">
                            <small>Amount</small>
                            <strong>${retainer.formattedAmount}</strong>
                            <span class="cycle-badge">/${this.escapeHtml(retainer.cycleInfo.label)}</span>
                        </div>
                        ${retainer.totalValue ? `
                            <div class="financial-item">
                                <small>Total Value</small>
                                <strong>${retainer.formattedTotalValue}</strong>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Utilization -->
                    <div class="retainer-utilization">
                        <div class="utilization-header">
                            <span>Utilization</span>
                            <span style="color: ${utilizationColor}">${utilizationPercent}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(utilizationPercent, 100)}%; background: ${utilizationColor}"></div>
                        </div>
                        <div class="utilization-details">
                            ${retainer.type === 'hourly' ? `
                                <span>${retainer.usedHours || 0}h / ${retainer.totalHours || 0}h</span>
                                <span>${retainer.remainingHours}h remaining</span>
                            ` : `
                                <span>Paid: ${retainer.formattedPaidAmount}</span>
                                <span>Balance: ${retainer.formattedBalance}</span>
                            `}
                        </div>
                    </div>
                    
                    <!-- Billing Info -->
                    <div class="retainer-billing">
                        <div class="billing-item">
                            <i class="fas fa-calendar"></i>
                            <div>
                                <small>Next Billing</small>
                                <span>${retainer.formattedNextBilling}</span>
                                ${retainer.isExpiringSoon ? `
                                    <span class="expiring-tag">Expiring Soon</span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="billing-item">
                            <i class="fas fa-file-invoice"></i>
                            <div>
                                <small>Invoices</small>
                                <span>${retainer.invoiceCount} generated</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- SLA Info -->
                    <div class="retainer-sla">
                        <i class="fas fa-stopwatch"></i>
                        <span>SLA: ${this.escapeHtml(retainer.slaInfo.label)}</span>
                        <small>${retainer.slaInfo.responseTime}h response</small>
                    </div>
                    
                    <!-- Card Actions -->
                    <div class="retainer-card-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-primary" 
                                onclick="window.Global.Retainers.generateInvoice('${retainer.id}')">
                            <i class="fas fa-file-invoice"></i> Invoice
                        </button>
                        ${retainer.canPause ? `
                            <button class="btn-icon" title="Pause" 
                                    onclick="window.Global.Retainers.pauseRetainer('${retainer.id}')">
                                <i class="fas fa-pause"></i>
                            </button>
                        ` : ''}
                        ${retainer.canRenew ? `
                            <button class="btn-icon" title="Renew" 
                                    onclick="window.Global.Retainers.renewRetainer('${retainer.id}')">
                                <i class="fas fa-sync"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon more" title="More" 
                                onclick="window.Global.Retainers.showContextMenu(event, '${retainer.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        return cards;
    }
    
    /**
     * Open create retainer modal
     */
    async openCreateRetainer(retainerData = null) {
        try {
            const isEditing = !!retainerData;
            const title = isEditing ? 'Edit Retainer Agreement' : 'Create New Retainer';
            
            const formHtml = `
                <div class="retainer-form-container">
                    <form id="retainer-form">
                        <!-- Basic Information -->
                        <div class="form-section">
                            <h4><i class="fas fa-info-circle"></i> Agreement Details</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="retainer-name">Agreement Name *</label>
                                    <input type="text" id="retainer-name" name="name" 
                                           value="${retainerData?.name || ''}" required maxlength="200">
                                </div>
                                <div class="form-group col-6">
                                    <label for="retainer-code">Agreement Code</label>
                                    <input type="text" id="retainer-code" name="code" 
                                           value="${retainerData?.code || this.generateRetainerCode()}" readonly>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="retainer-description">Description</label>
                                <textarea id="retainer-description" name="description" rows="2">${retainerData?.description || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- Type & Cycle -->
                        <div class="form-section">
                            <h4><i class="fas fa-cog"></i> Configuration</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="retainer-type">Retainer Type *</label>
                                    <select id="retainer-type" name="type" required 
                                            onchange="window.Global.Retainers.onTypeChange()">
                                        ${Object.entries(this.retainerTypes).map(([key, type]) => `
                                            <option value="${key}" ${retainerData?.type === key ? 'selected' : ''}>
                                                ${type.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-cycle">Billing Cycle *</label>
                                    <select id="retainer-cycle" name="billingCycle" required>
                                        ${Object.entries(this.billingCycles).map(([key, cycle]) => `
                                            <option value="${key}" ${retainerData?.billingCycle === key ? 'selected' : ''}>
                                                ${cycle.label} ${cycle.days > 0 ? `(${cycle.days} days)` : ''}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-sla">SLA Level</label>
                                    <select id="retainer-sla" name="slaLevel">
                                        ${Object.entries(this.slaLevels).map(([key, sla]) => `
                                            <option value="${key}" ${retainerData?.slaLevel === key ? 'selected' : ''}>
                                                ${sla.label} (${sla.responseTime}h/${sla.resolutionTime}h)
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Financial Details -->
                        <div class="form-section">
                            <h4><i class="fas fa-rupee-sign"></i> Financial Terms</h4>
                            <div class="form-row">
                                <div class="form-group col-3">
                                    <label for="retainer-amount">Amount Per Cycle *</label>
                                    <div class="input-with-prefix">
                                        <span class="prefix">₹</span>
                                        <input type="number" id="retainer-amount" name="amount" 
                                               value="${retainerData?.amount || ''}" min="0" step="0.01" required>
                                    </div>
                                </div>
                                <div class="form-group col-3">
                                    <label for="retainer-total-cycles">Number of Cycles</label>
                                    <input type="number" id="retainer-total-cycles" name="totalCycles" 
                                           value="${retainerData?.totalCycles || 12}" min="1" max="120">
                                </div>
                                <div class="form-group col-3">
                                    <label>Total Value</label>
                                    <div class="calculated-field" id="total-value-display">
                                        ${Formatters.currency((retainerData?.amount || 0) * (retainerData?.totalCycles || 12))}
                                    </div>
                                </div>
                                <div class="form-group col-3">
                                    <label for="retainer-currency">Currency</label>
                                    <select id="retainer-currency" name="currency">
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Hourly Retainer Fields -->
                            <div id="hourly-fields" class="form-row" style="display: ${retainerData?.type === 'hourly' ? 'flex' : 'none'}">
                                <div class="form-group col-4">
                                    <label for="retainer-hours">Hours Per Cycle</label>
                                    <input type="number" id="retainer-hours" name="totalHours" 
                                           value="${retainerData?.totalHours || ''}" min="1">
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-hourly-rate">Hourly Rate</label>
                                    <div class="input-with-prefix">
                                        <span class="prefix">₹</span>
                                        <input type="number" id="retainer-hourly-rate" name="hourlyRate" 
                                               value="${retainerData?.hourlyRate || ''}" min="0" readonly>
                                    </div>
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-rollover">Unused Hours</label>
                                    <select id="retainer-rollover" name="rolloverPolicy">
                                        <option value="expire">Expire at cycle end</option>
                                        <option value="rollover">Rollover to next cycle</option>
                                        <option value="credit">Credit to account</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Dates -->
                        <div class="form-section">
                            <h4><i class="fas fa-calendar"></i> Term & Dates</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="retainer-start">Start Date *</label>
                                    <input type="date" id="retainer-start" name="startDate" 
                                           value="${retainerData?.startDate || ''}" required>
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-end">End Date</label>
                                    <input type="date" id="retainer-end" name="endDate" 
                                           value="${retainerData?.endDate || ''}" readonly>
                                </div>
                                <div class="form-group col-4">
                                    <label for="retainer-next-billing">Next Billing Date</label>
                                    <input type="date" id="retainer-next-billing" name="nextBillingDate" 
                                           value="${retainerData?.nextBillingDate || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Client -->
                        <div class="form-section">
                            <h4><i class="fas fa-building"></i> Client Information</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="retainer-client">Client *</label>
                                    <select id="retainer-client" name="clientId" required>
                                        <option value="">Select Client...</option>
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="retainer-contact">Primary Contact</label>
                                    <input type="text" id="retainer-contact" name="primaryContact" 
                                           value="${retainerData?.primaryContact || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Auto-Invoice Settings -->
                        <div class="form-section">
                            <h4><i class="fas fa-file-invoice"></i> Invoice Settings</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label>
                                        <input type="checkbox" name="autoInvoice" 
                                               ${retainerData?.autoInvoice !== false ? 'checked' : ''}>
                                        Auto-generate invoices
                                    </label>
                                </div>
                                <div class="form-group col-6">
                                    <label>
                                        <input type="checkbox" name="autoSend" 
                                               ${retainerData?.autoSend === true ? 'checked' : ''}>
                                        Auto-send to client
                                    </label>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label>Generate Before (days)</label>
                                    <input type="number" name="generateBefore" 
                                           value="${retainerData?.generateBefore || this.invoiceSettings.generateBefore}" 
                                           min="1" max="30">
                                </div>
                                <div class="form-group col-6">
                                    <label>Payment Terms</label>
                                    <input type="text" name="paymentTerms" 
                                           value="${retainerData?.paymentTerms || this.invoiceSettings.paymentTerms}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> ${isEditing ? 'Update Retainer' : 'Create Retainer'}
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: title,
                content: formHtml,
                size: 'xlarge',
                onClose: () => {
                    this.selectedRetainerId = null;
                }
            });
            
            modal.open();
            
            setTimeout(() => {
                this.setupRetainerForm(isEditing, retainerData);
            }, 100);
            
        } catch (error) {
            console.error('[Retainers] Create form open failed:', error);
            Toast.show('Failed to open retainer form', 'error');
        }
    }
    
    /**
     * Set up retainer form handlers
     */
    setupRetainerForm(isEditing, retainerData) {
        try {
            const form = document.getElementById('retainer-form');
            if (!form) return;
            
            // Amount change → update total value
            const amountInput = document.getElementById('retainer-amount');
            const cyclesInput = document.getElementById('retainer-total-cycles');
            const totalDisplay = document.getElementById('total-value-display');
            
            const updateTotal = () => {
                const amount = parseFloat(amountInput?.value) || 0;
                const cycles = parseInt(cyclesInput?.value) || 0;
                if (totalDisplay) {
                    totalDisplay.textContent = Formatters.currency(amount * cycles);
                }
            };
            
            amountInput?.addEventListener('input', updateTotal);
            cyclesInput?.addEventListener('input', updateTotal);
            
            // Type change → show/hide hourly fields
            const typeSelect = document.getElementById('retainer-type');
            typeSelect?.addEventListener('change', () => {
                const hourlyFields = document.getElementById('hourly-fields');
                if (hourlyFields) {
                    hourlyFields.style.display = typeSelect.value === 'hourly' ? 'flex' : 'none';
                }
            });
            
            // Start date change → calculate end date
            const startInput = document.getElementById('retainer-start');
            const cycleSelect = document.getElementById('retainer-cycle');
            const endInput = document.getElementById('retainer-end');
            
            const updateEndDate = () => {
                const startDate = startInput?.value;
                const cycleKey = cycleSelect?.value;
                const cycle = this.billingCycles[cycleKey];
                
                if (startDate && cycle && cycle.days > 0) {
                    const cycles = parseInt(cyclesInput?.value) || 1;
                    const start = new Date(startDate);
                    const end = new Date(start);
                    end.setDate(end.getDate() + (cycle.days * cycles));
                    
                    if (endInput) {
                        endInput.value = end.toISOString().split('T')[0];
                    }
                }
            };
            
            startInput?.addEventListener('change', updateEndDate);
            cycleSelect?.addEventListener('change', updateEndDate);
            cyclesInput?.addEventListener('input', updateEndDate);
            
            // Form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const retainerData = {
                    name: formData.get('name'),
                    code: formData.get('code'),
                    description: formData.get('description'),
                    type: formData.get('type'),
                    billingCycle: formData.get('billingCycle'),
                    slaLevel: formData.get('slaLevel'),
                    amount: parseFloat(formData.get('amount')),
                    totalCycles: parseInt(formData.get('totalCycles')),
                    totalValue: parseFloat(formData.get('amount')) * parseInt(formData.get('totalCycles')),
                    currency: formData.get('currency'),
                    startDate: formData.get('startDate'),
                    endDate: formData.get('endDate'),
                    nextBillingDate: formData.get('nextBillingDate'),
                    clientId: formData.get('clientId'),
                    primaryContact: formData.get('primaryContact'),
                    autoInvoice: formData.get('autoInvoice') === 'on',
                    autoSend: formData.get('autoSend') === 'on',
                    generateBefore: parseInt(formData.get('generateBefore')),
                    paymentTerms: formData.get('paymentTerms'),
                    status: 'draft'
                };
                
                // Hourly-specific fields
                if (retainerData.type === 'hourly') {
                    retainerData.totalHours = parseInt(formData.get('totalHours')) || 0;
                    retainerData.hourlyRate = parseFloat(formData.get('hourlyRate')) || 0;
                    retainerData.rolloverPolicy = formData.get('rolloverPolicy');
                }
                
                try {
                    if (isEditing && this.selectedRetainerId) {
                        await this.updateRetainer({ id: this.selectedRetainerId, ...retainerData });
                    } else {
                        await this.createRetainer(retainerData);
                    }
                    
                    Modal.close();
                    await this.loadRetainers();
                    await this.render();
                    
                    Toast.show(
                        isEditing ? 'Retainer updated successfully' : 'Retainer created successfully',
                        'success'
                    );
                } catch (error) {
                    Toast.show('Failed to save retainer: ' + error.message, 'error');
                }
            });
            
        } catch (error) {
            console.error('[Retainers] Form setup failed:', error);
        }
    }
    
    /**
     * Generate retainer code
     */
    generateRetainerCode() {
        const year = new Date().getFullYear().toString().slice(-2);
        const seq = String(this.retainers.size + 1).padStart(4, '0');
        return `RET-${year}-${seq}`;
    }
    
    /**
     * Calculate days until renewal
     */
    calculateDaysUntilRenewal(retainer) {
        if (!retainer.endDate) return 0;
        const end = new Date(retainer.endDate);
        const now = new Date();
        const diff = end - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    
    /**
     * Check if retainer is expiring soon (within 30 days)
     */
    isExpiringSoon(retainer) {
        const days = this.calculateDaysUntilRenewal(retainer);
        return days > 0 && days <= 30 && retainer.status === 'active';
    }
    
    /**
     * Check if retainer needs attention
     */
    checkRetainerNeedsAttention(retainer) {
        if (retainer.isExpiringSoon) return true;
        
        const utilization = this.utilization.get(retainer.id);
        if (utilization?.isExhausted) return true;
        if (utilization?.isLow && retainer.status === 'active') return true;
        
        return false;
    }
    
    /**
     * Get color for utilization percentage
     */
    getUtilizationColor(percentage) {
        if (percentage >= 100) return '#DC2626'; // Red - exhausted
        if (percentage >= 80) return '#F97316'; // Orange - high
        if (percentage >= 50) return '#F59E0B'; // Yellow - medium
        return '#10B981'; // Green - low/normal
    }
    
    /**
     * Check upcoming renewals
     */
    checkUpcomingRenewals() {
        try {
            this.upcomingRenewals = [];
            
            this.retainers.forEach((retainer) => {
                if (retainer.status !== 'active' || !retainer.isExpiringSoon) return;
                
                const daysLeft = this.calculateDaysUntilRenewal(retainer);
                let urgency = 'low';
                if (daysLeft <= 7) urgency = 'critical';
                else if (daysLeft <= 15) urgency = 'high';
                else if (daysLeft <= 30) urgency = 'medium';
                
                this.upcomingRenewals.push({
                    id: retainer.id,
                    retainerName: retainer.name,
                    clientName: retainer.clientName,
                    daysLeft: daysLeft,
                    amount: retainer.amount,
                    urgency: urgency
                });
            });
            
            // Sort by urgency (days left ascending)
            this.upcomingRenewals.sort((a, b) => a.daysLeft - b.daysLeft);
            
        } catch (error) {
            console.error('[Retainers] Renewal check failed:', error);
        }
    }
    
    /**
     * Generate invoice for retainer
     */
    async generateInvoice(retainerId) {
        try {
            const retainer = this.retainers.get(retainerId);
            if (!retainer) throw new Error('Retainer not found');
            
            const confirmed = await this.confirmDialog(
                'Generate Invoice',
                `Generate invoice for ${retainer.formattedAmount} for retainer "${retainer.name}"?`
            );
            
            if (!confirmed) return;
            
            const response = await API.post(`${this.apiEndpoint}/${retainerId}/generate-invoice`, {
                amount: retainer.amount,
                billingDate: retainer.nextBillingDate || new Date().toISOString()
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Invoice generated successfully', 'success');
            
            // Update invoice count
            retainer.invoiceCount++;
            this.retainers.set(retainerId, retainer);
            
            // Update invoice history
            if (!this.invoiceHistory.has(retainerId)) {
                this.invoiceHistory.set(retainerId, []);
            }
            this.invoiceHistory.get(retainerId).push(response.data);
            
            EventBus.emit('retainer:invoice:generated', {
                retainerId,
                invoice: response.data
            });
            
        } catch (error) {
            console.error('[Retainers] Invoice generation failed:', error);
            Toast.show('Failed to generate invoice', 'error');
        }
    }
    
    /**
     * Renew retainer
     */
    async renewRetainer(retainerId) {
        try {
            const retainer = this.retainers.get(retainerId);
            if (!retainer) throw new Error('Retainer not found');
            
            const response = await API.post(`${this.apiEndpoint}/${retainerId}/renew`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Retainer renewed successfully', 'success');
            
            await this.loadRetainers();
            await this.render();
            
            EventBus.emit('retainer:renewed', response.data);
            
        } catch (error) {
            console.error('[Retainers] Renew failed:', error);
            Toast.show('Failed to renew retainer', 'error');
        }
    }
    
    /**
     * Pause retainer
     */
    async pauseRetainer(retainerId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/${retainerId}/pause`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Retainer paused', 'info');
            await this.loadRetainers();
            await this.render();
            
        } catch (error) {
            console.error('[Retainers] Pause failed:', error);
            Toast.show('Failed to pause retainer', 'error');
        }
    }
    
    /**
     * Cancel retainer
     */
    async cancelRetainer(retainerId) {
        try {
            const retainer = this.retainers.get(retainerId);
            if (!retainer) throw new Error('Retainer not found');
            
            const confirmed = await this.confirmDialog(
                'Cancel Retainer',
                `Are you sure you want to cancel retainer "${retainer.name}"? This action cannot be undone.`
            );
            
            if (!confirmed) return;
            
            const response = await API.post(`${this.apiEndpoint}/${retainerId}/cancel`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Retainer cancelled', 'info');
            await this.loadRetainers();
            await this.render();
            
        } catch (error) {
            console.error('[Retainers] Cancel failed:', error);
            Toast.show('Failed to cancel retainer', 'error');
        }
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalRetainers = 0;
            let activeRetainers = 0;
            let totalMRR = 0;
            let totalARR = 0;
            let totalUtilization = 0;
            let expiringThisMonth = 0;
            let renewedCount = 0;
            let expiredCount = 0;
            
            this.retainers.forEach((retainer) => {
                totalRetainers++;
                
                if (retainer.status === 'active') {
                    activeRetainers++;
                    
                    // Calculate MRR based on billing cycle
                    const cycleDays = retainer.cycleInfo.days;
                    if (cycleDays > 0) {
                        const monthlyAmount = (retainer.amount / cycleDays) * 30;
                        totalMRR += monthlyAmount;
                    }
                }
                
                // ARR = MRR * 12
                totalARR = totalMRR * 12;
                
                // Utilization
                const utilization = this.utilization.get(retainer.id);
                if (utilization) {
                    totalUtilization += utilization.percentage;
                }
                
                // Expiring this month
                if (retainer.isExpiringSoon && retainer.daysUntilRenewal <= 30) {
                    expiringThisMonth++;
                }
                
                if (retainer.status === 'renewed') renewedCount++;
                if (retainer.status === 'expired' || retainer.status === 'cancelled') expiredCount++;
            });
            
            this.metrics.totalRetainers = totalRetainers;
            this.metrics.activeRetainers = activeRetainers;
            this.metrics.totalMRR = totalMRR;
            this.metrics.totalARR = totalARR;
            this.metrics.averageUtilization = activeRetainers > 0 ? 
                Math.round(totalUtilization / activeRetainers) : 0;
            this.metrics.expiringThisMonth = expiringThisMonth;
            
            const totalEnded = renewedCount + expiredCount;
            this.metrics.renewalRate = totalEnded > 0 ? 
                Math.round((renewedCount / totalEnded) * 100) : 100;
            
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Retainers] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Set up renewal checker interval
     */
    setupRenewalChecker() {
        // Check renewals daily
        setInterval(() => {
            this.checkUpcomingRenewals();
            this.calculateMetrics();
        }, 86400000); // 24 hours
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
     * Create retainer
     */
    async createRetainer(retainerData) {
        const response = await API.post(`${this.apiEndpoint}/create`, retainerData);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}list`);
        return response.data;
    }
    
    /**
     * Update retainer
     */
    async updateRetainer(retainerData) {
        const response = await API.put(`${this.apiEndpoint}/${retainerData.id}`, retainerData);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}list`);
        return response.data;
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-hand-holding-usd"></i>
                </div>
                <h3>No Retainers Found</h3>
                <p>Create your first retainer agreement</p>
                <button class="btn btn-primary" onclick="window.Global.Retainers.openCreateRetainer()">
                    <i class="fas fa-plus"></i> Create Retainer
                </button>
            </div>
        `;
    }
    
    /**
     * Render pagination
     */
    renderPagination() {
        if (this.pagination.totalPages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        html += `
            <button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                    onclick="window.Global.Retainers.loadRetainers(${this.pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `
                    <button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                            onclick="window.Global.Retainers.loadRetainers(${i})">${i}</button>
                `;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        html += `
            <button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                    onclick="window.Global.Retainers.loadRetainers(${this.pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Are default filters
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.type === 'all' &&
               this.filters.client === 'all' &&
               !this.filters.search;
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
     * Debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Clean up
     */
    destroy() {
        EventBus.off('retainer:create');
        EventBus.off('retainer:update');
        EventBus.off('retainer:renew');
        
        console.log('[Retainers] Module destroyed');
    }
}

// Singleton
const retainers = new RetainersModule();

// Exports
export { retainers, RetainersModule };
export default retainers;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Retainers = retainers;
}
