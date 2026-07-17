/**
 * 11 AVATAR DIGITAL HUB - Referrals Module
 * Enterprise-grade referral & affiliate management system
 * Multi-level tracking, commission engine, payout management, partner portal
 * 
 * @module Referrals
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
 * Referrals Module - Complete referral program lifecycle
 * Handles partners, referral codes, commissions, multi-level, payouts
 */
class ReferralsModule {
    constructor() {
        // Module identity
        this.moduleName = 'referrals';
        this.apiEndpoint = '/api/referrals';
        this.cachePrefix = 'referral_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Referral status definitions
        this.referralStatuses = {
            'pending': { label: 'Pending', color: '#F59E0B', icon: 'fa-clock' },
            'qualified': { label: 'Qualified', color: '#3B82F6', icon: 'fa-check' },
            'converted': { label: 'Converted', color: '#10B981', icon: 'fa-trophy' },
            'rejected': { label: 'Rejected', color: '#DC2626', icon: 'fa-times-circle' },
            'expired': { label: 'Expired', color: '#6B7280', icon: 'fa-calendar-times' },
            'fraud': { label: 'Fraudulent', color: '#991B1B', icon: 'fa-ban' }
        };
        
        // Commission types
        this.commissionTypes = {
            'percentage': { label: 'Percentage', icon: 'fa-percent', description: '% of deal value' },
            'fixed': { label: 'Fixed Amount', icon: 'fa-rupee-sign', description: 'Fixed per conversion' },
            'tiered': { label: 'Tiered', icon: 'fa-layer-group', description: 'Based on volume tiers' },
            'hybrid': { label: 'Hybrid', icon: 'fa-cubes', description: 'Fixed + Percentage' }
        };
        
        // Commission statuses
        this.commissionStatuses = {
            'earned': { label: 'Earned', color: '#3B82F6', icon: 'fa-star' },
            'approved': { label: 'Approved', color: '#10B981', icon: 'fa-check-circle' },
            'pending_payout': { label: 'Pending Payout', color: '#F59E0B', icon: 'fa-clock' },
            'paid': { label: 'Paid', color: '#8B5CF6', icon: 'fa-money-check' },
            'cancelled': { label: 'Cancelled', color: '#DC2626', icon: 'fa-times-circle' },
            'disputed': { label: 'Disputed', color: '#F97316', icon: 'fa-exclamation-triangle' }
        };
        
        // Payout methods
        this.payoutMethods = {
            'bank_transfer': { label: 'Bank Transfer', icon: 'fa-university', processingDays: 3 },
            'upi': { label: 'UPI', icon: 'fa-mobile-alt', processingDays: 1 },
            'paypal': { label: 'PayPal', icon: 'fa-paypal', processingDays: 2 },
            'wallet': { label: 'Digital Wallet', icon: 'fa-wallet', processingDays: 1 },
            'cheque': { label: 'Cheque', icon: 'fa-money-check', processingDays: 7 }
        };
        
        // Partner tiers
        this.partnerTiers = {
            'bronze': { 
                label: 'Bronze', 
                color: '#CD7F32', 
                icon: 'fa-medal',
                minReferrals: 0,
                commissionMultiplier: 1.0,
                benefits: ['Basic referral link', 'Standard commission']
            },
            'silver': { 
                label: 'Silver', 
                color: '#C0C0C0', 
                icon: 'fa-medal',
                minReferrals: 10,
                commissionMultiplier: 1.25,
                benefits: ['Priority support', 'Bonus commission', 'Marketing materials']
            },
            'gold': { 
                label: 'Gold', 
                color: '#FFD700', 
                icon: 'fa-medal',
                minReferrals: 50,
                commissionMultiplier: 1.5,
                benefits: ['Dedicated manager', 'Custom tracking', 'Co-branded landing pages']
            },
            'platinum': { 
                label: 'Platinum', 
                color: '#E5E4E2', 
                icon: 'fa-crown',
                minReferrals: 200,
                commissionMultiplier: 2.0,
                benefits: ['VIP support', 'Highest commissions', 'Revenue sharing', 'Early access']
            }
        };
        
        // Referral sources
        this.referralSources = {
            'partner': { label: 'Partner', icon: 'fa-handshake' },
            'client': { label: 'Client', icon: 'fa-building' },
            'employee': { label: 'Employee', icon: 'fa-user-tie' },
            'affiliate': { label: 'Affiliate', icon: 'fa-link' },
            'social_media': { label: 'Social Media', icon: 'fa-share-alt' },
            'website': { label: 'Website', icon: 'fa-globe' },
            'event': { label: 'Event', icon: 'fa-calendar-star' },
            'other': { label: 'Other', icon: 'fa-ellipsis-h' }
        };
        
        // Module state
        this.referrals = new Map();
        this.partners = new Map();
        this.commissions = new Map(); // referralId -> commission
        this.payouts = new Map(); // partnerId -> [payouts]
        this.referralCodes = new Map();
        
        // Multi-level tracking
        this.referralTree = new Map(); // parentReferralId -> [childReferrals]
        this.maxLevels = 5; // Maximum 5 levels deep
        
        // Selected items
        this.selectedReferralId = null;
        this.selectedPartnerId = null;
        
        // Filters
        this.filters = {
            status: 'all',
            source: 'all',
            partner: 'all',
            dateRange: null,
            search: '',
            commissionStatus: 'all',
            minValue: null
        };
        
        // Sort config
        this.sortConfig = {
            field: 'createdAt',
            order: 'desc'
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 25,
            total: 0,
            totalPages: 0
        };
        
        // View state
        this.currentView = 'list'; // list, partners, commissions, payouts, tree
        this.currentTab = 'referrals'; // referrals, partners, commissions, payouts
        
        // Commission settings
        this.commissionSettings = {
            defaultRate: 10, // 10%
            minimumPayout: 1000, // ₹1000
            payoutSchedule: 'monthly', // weekly, biweekly, monthly, quarterly
            cookieDuration: 90, // 90 days cookie
            allowMultiLevel: true,
            levelRates: {
                level1: 10,  // 10% for direct referral
                level2: 5,   // 5% for sub-referral
                level3: 2,   // 2% for level 3
                level4: 1,   // 1% for level 4
                level5: 0.5  // 0.5% for level 5
            }
        };
        
        // Performance metrics
        this.metrics = {
            totalReferrals: 0,
            convertedReferrals: 0,
            conversionRate: 0,
            totalCommissions: 0,
            paidCommissions: 0,
            pendingPayouts: 0,
            activePartners: 0,
            totalPartners: 0,
            averageCommission: 0,
            topPartner: null,
            lastCalculated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            referralList: null,
            partnerGrid: null,
            commissionTable: null,
            payoutHistory: null,
            referralTree: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            metricsPanel: null,
            tabNavigation: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize referrals module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Referrals] Initializing referral management module...');
            
            // Check permissions
            const canAccess = await Permissions.check('referrals', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Referrals module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load data
            await this.loadPartners();
            await this.loadReferrals();
            await this.loadCommissions();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Render
            await this.render();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Referrals] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('referrals:ready', {
                referrals: this.referrals.size,
                partners: this.partners.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Referrals] Initialization failed:', error);
            Toast.show('Failed to load referrals module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#referrals-container',
                referralList: '#referral-list',
                partnerGrid: '#partners-grid',
                commissionTable: '#commissions-table',
                payoutHistory: '#payout-history',
                referralTree: '#referral-tree',
                filterBar: '#referral-filters',
                searchInput: '#referral-search',
                createButton: '#referral-create-btn',
                metricsPanel: '#referral-metrics',
                tabNavigation: '#referral-tabs'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Referrals] DOM elements cached');
            
        } catch (error) {
            console.error('[Referrals] DOM cache failed:', error);
        }
    }
    
    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}config`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.commissionSettings = { ...this.commissionSettings, ...cached.data };
                return;
            }
            
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                this.commissionSettings = { ...this.commissionSettings, ...response.data };
                await Cache.set(`${this.cachePrefix}config`, this.commissionSettings, this.cacheTimeout);
            }
            
        } catch (error) {
            console.error('[Referrals] Config load failed:', error);
        }
    }
    
    /**
     * Load partners
     */
    async loadPartners() {
        try {
            const response = await API.get('/api/partners');
            
            if (response.success && response.data) {
                this.partners.clear();
                response.data.forEach(partner => {
                    const processed = {
                        ...partner,
                        formattedJoined: Formatters.date(partner.joinedAt),
                        tierInfo: this.partnerTiers[partner.tier] || this.partnerTiers.bronze,
                        totalEarnings: Formatters.currency(partner.totalEarnings || 0),
                        pendingEarnings: Formatters.currency(partner.pendingEarnings || 0),
                        referralCount: partner.referralCount || 0,
                        conversionRate: partner.totalReferrals > 0 ? 
                            ((partner.convertedReferrals || 0) / partner.totalReferrals * 100).toFixed(1) : 0,
                        nextTier: this.getNextTier(partner.tier)
                    };
                    this.partners.set(partner.id, processed);
                });
                
                console.log(`[Referrals] Loaded ${this.partners.size} partners`);
            }
            
        } catch (error) {
            console.error('[Referrals] Partners load failed:', error);
        }
    }
    
    /**
     * Load referrals
     */
    async loadReferrals(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.source !== 'all') params.set('source', this.filters.source);
            if (this.filters.partner !== 'all') params.set('partner', this.filters.partner);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processReferralsData(cached.data);
                    return;
                }
            }
            
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load referrals');
            }
            
            this.processReferralsData(response.data);
            
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Referrals] Loaded ${this.referrals.size} referrals`);
            
        } catch (error) {
            console.error('[Referrals] Load failed:', error);
            Toast.show('Failed to load referrals', 'error');
        }
    }
    
    /**
     * Process referrals data
     */
    processReferralsData(data) {
        try {
            this.referrals.clear();
            this.referralTree.clear();
            
            if (data.referrals && Array.isArray(data.referrals)) {
                data.referrals.forEach(referral => {
                    const processed = {
                        ...referral,
                        // Format fields
                        formattedDate: Formatters.date(referral.createdAt),
                        formattedUpdated: Formatters.relativeTime(referral.updatedAt),
                        
                        // Status info
                        statusInfo: this.referralStatuses[referral.status] || this.referralStatuses.pending,
                        
                        // Source info
                        sourceInfo: this.referralSources[referral.source] || this.referralSources.other,
                        
                        // Partner info
                        partnerName: referral.partner?.name || 'Unknown',
                        partnerTier: this.partnerTiers[referral.partner?.tier]?.label || 'N/A',
                        
                        // Referred entity info
                        referredName: referral.referred?.name || 'Unknown',
                        referredType: referral.referred?.type || 'lead',
                        
                        // Commission info
                        commissionAmount: referral.commission?.amount || 0,
                        formattedCommission: Formatters.currency(referral.commission?.amount || 0),
                        commissionStatus: this.commissionStatuses[referral.commission?.status] || null,
                        
                        // Derived fields
                        daysSinceCreated: this.calculateDaysSince(referral.createdAt),
                        isConverted: referral.status === 'converted',
                        hasCommission: referral.commission?.amount > 0,
                        isMultiLevel: referral.parentReferralId ? true : false,
                        level: referral.level || 1,
                        
                        // Referral code
                        referralCode: referral.code || 'N/A',
                        clickCount: referral.clicks || 0,
                        
                        // Cookie tracking
                        cookieExpiry: referral.cookieExpiresAt ? Formatters.date(referral.cookieExpiresAt) : null,
                        isCookieActive: referral.cookieExpiresAt ? 
                            new Date(referral.cookieExpiresAt) > new Date() : false
                    };
                    
                    this.referrals.set(referral.id, processed);
                    
                    // Build referral tree
                    if (referral.parentReferralId) {
                        if (!this.referralTree.has(referral.parentReferralId)) {
                            this.referralTree.set(referral.parentReferralId, []);
                        }
                        this.referralTree.get(referral.parentReferralId).push(referral.id);
                    }
                });
            }
            
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
        } catch (error) {
            console.error('[Referrals] Data processing failed:', error);
        }
    }
    
    /**
     * Load commissions
     */
    async loadCommissions() {
        try {
            const response = await API.get(`${this.apiEndpoint}/commissions`);
            
            if (response.success && response.data) {
                this.commissions.clear();
                response.data.forEach(commission => {
                    this.commissions.set(commission.referralId, commission);
                });
                
                console.log(`[Referrals] Loaded ${this.commissions.size} commissions`);
            }
            
        } catch (error) {
            console.error('[Referrals] Commissions load failed:', error);
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
                    this.openCreateReferral();
                });
            }
            
            EventBus.on('referral:create', this.createReferral.bind(this));
            EventBus.on('referral:update', this.updateReferral.bind(this));
            EventBus.on('referral:convert', this.convertReferral.bind(this));
            EventBus.on('partner:create', this.createPartner.bind(this));
            EventBus.on('commission:approve', this.approveCommission.bind(this));
            EventBus.on('payout:process', this.processPayout.bind(this));
            
            console.log('[Referrals] Event listeners initialized');
            
        } catch (error) {
            console.error('[Referrals] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render referrals view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            const html = `
                <div class="referrals-container">
                    <!-- Metrics Dashboard -->
                    <div class="referral-metrics-dashboard">
                        <div class="metric-card primary">
                            <i class="fas fa-link"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.totalReferrals}</span>
                                <span class="metric-label">Total Referrals</span>
                            </div>
                        </div>
                        
                        <div class="metric-card success">
                            <i class="fas fa-trophy"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.convertedReferrals}</span>
                                <span class="metric-label">Converted</span>
                            </div>
                        </div>
                        
                        <div class="metric-card info">
                            <i class="fas fa-chart-line"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.conversionRate}%</span>
                                <span class="metric-label">Conversion Rate</span>
                            </div>
                        </div>
                        
                        <div class="metric-card warning">
                            <i class="fas fa-rupee-sign"></i>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.totalCommissions)}</span>
                                <span class="metric-label">Total Commissions</span>
                            </div>
                        </div>
                        
                        <div class="metric-card purple">
                            <i class="fas fa-users"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.activePartners}</span>
                                <span class="metric-label">Active Partners</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <i class="fas fa-money-bill-wave"></i>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.pendingPayouts)}</span>
                                <span class="metric-label">Pending Payouts</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tab Navigation -->
                    <div class="referral-tabs" id="referral-tabs">
                        <button class="tab-btn ${this.currentTab === 'referrals' ? 'active' : ''}" 
                                onclick="window.Global.Referrals.switchTab('referrals')">
                            <i class="fas fa-link"></i> Referrals
                        </button>
                        <button class="tab-btn ${this.currentTab === 'partners' ? 'active' : ''}" 
                                onclick="window.Global.Referrals.switchTab('partners')">
                            <i class="fas fa-handshake"></i> Partners
                        </button>
                        <button class="tab-btn ${this.currentTab === 'commissions' ? 'active' : ''}" 
                                onclick="window.Global.Referrals.switchTab('commissions')">
                            <i class="fas fa-percent"></i> Commissions
                        </button>
                        <button class="tab-btn ${this.currentTab === 'payouts' ? 'active' : ''}" 
                                onclick="window.Global.Referrals.switchTab('payouts')">
                            <i class="fas fa-money-check"></i> Payouts
                        </button>
                        <button class="tab-btn ${this.currentTab === 'tree' ? 'active' : ''}" 
                                onclick="window.Global.Referrals.switchTab('tree')">
                            <i class="fas fa-sitemap"></i> Referral Tree
                        </button>
                    </div>
                    
                    <!-- Tab Content -->
                    <div class="tab-content">
                        ${this.renderTabContent()}
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Referrals] View rendered');
            
        } catch (error) {
            console.error('[Referrals] Render failed:', error);
        }
    }
    
    /**
     * Render tab content based on current tab
     */
    renderTabContent() {
        switch (this.currentTab) {
            case 'referrals':
                return this.renderReferralsTab();
            case 'partners':
                return this.renderPartnersTab();
            case 'commissions':
                return this.renderCommissionsTab();
            case 'payouts':
                return this.renderPayoutsTab();
            case 'tree':
                return this.renderReferralTreeTab();
            default:
                return this.renderReferralsTab();
        }
    }
    
    /**
     * Render referrals tab
     */
    renderReferralsTab() {
        return `
            <div class="referrals-list-container">
                <div class="list-header">
                    <h3>All Referrals</h3>
                    <button class="btn btn-primary" onclick="window.Global.Referrals.openCreateReferral()">
                        <i class="fas fa-plus"></i> New Referral
                    </button>
                </div>
                
                <div class="table-responsive">
                    <table class="referral-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Partner</th>
                                <th>Referred To</th>
                                <th>Source</th>
                                <th>Status</th>
                                <th>Commission</th>
                                <th>Level</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderReferralRows()}
                        </tbody>
                    </table>
                </div>
                
                ${this.referrals.size === 0 ? this.renderEmptyState('referrals') : ''}
                ${this.renderPagination()}
            </div>
        `;
    }
    
    /**
     * Render referral table rows
     */
    renderReferralRows() {
        if (this.referrals.size === 0) return '';
        
        let rows = '';
        
        this.referrals.forEach((referral) => {
            const statusInfo = referral.statusInfo;
            
            rows += `
                <tr class="referral-row" data-referral-id="${referral.id}">
                    <td>
                        <div class="date-cell">
                            <span>${referral.formattedDate}</span>
                            <small>${referral.daysSinceCreated}d ago</small>
                        </div>
                    </td>
                    <td>
                        <div class="partner-cell">
                            <span class="partner-name">${this.escapeHtml(referral.partnerName)}</span>
                            <small class="partner-tier">${referral.partnerTier}</small>
                        </div>
                    </td>
                    <td>
                        <div class="referred-cell">
                            <span>${this.escapeHtml(referral.referredName)}</span>
                            <small>${referral.referredType}</small>
                        </div>
                    </td>
                    <td>
                        <span class="source-badge" style="background: ${referral.sourceInfo.color}20; color: ${referral.sourceInfo.color}">
                            <i class="fas ${referral.sourceInfo.icon}"></i>
                            ${referral.sourceInfo.label}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge" style="background: ${statusInfo.color}20; color: ${statusInfo.color}">
                            <i class="fas ${statusInfo.icon}"></i>
                            ${statusInfo.label}
                        </span>
                    </td>
                    <td>
                        ${referral.hasCommission ? `
                            <div class="commission-cell">
                                <span class="commission-amount">${referral.formattedCommission}</span>
                                ${referral.commissionStatus ? `
                                    <small style="color: ${referral.commissionStatus.color}">
                                        ${referral.commissionStatus.label}
                                    </small>
                                ` : ''}
                            </div>
                        ` : '<span class="no-commission">-</span>'}
                    </td>
                    <td>
                        <span class="level-badge">L${referral.level}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" title="View" onclick="window.Global.Referrals.viewReferral('${referral.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${referral.status === 'pending' ? `
                                <button class="btn-icon" title="Convert" onclick="window.Global.Referrals.convertReferral('${referral.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            <button class="btn-icon more" title="More" onclick="window.Global.Referrals.showContextMenu(event, '${referral.id}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        return rows;
    }
    
    /**
     * Render partners tab
     */
    renderPartnersTab() {
        return `
            <div class="partners-container">
                <div class="list-header">
                    <h3>Referral Partners</h3>
                    <button class="btn btn-primary" onclick="window.Global.Referrals.openCreatePartner()">
                        <i class="fas fa-plus"></i> Add Partner
                    </button>
                </div>
                
                <div class="partners-grid" id="partners-grid">
                    ${this.renderPartnerCards()}
                </div>
                
                ${this.partners.size === 0 ? this.renderEmptyState('partners') : ''}
            </div>
        `;
    }
    
    /**
     * Render partner cards
     */
    renderPartnerCards() {
        if (this.partners.size === 0) return '';
        
        let cards = '';
        
        this.partners.forEach((partner) => {
            const tierInfo = partner.tierInfo;
            const nextTier = partner.nextTier;
            
            cards += `
                <div class="partner-card glass-card-3d" onclick="window.Global.Referrals.viewPartner('${partner.id}')">
                    <div class="partner-tier-bar" style="background: ${tierInfo.color}"></div>
                    
                    <div class="partner-header">
                        <div class="partner-avatar">
                            <img src="${partner.avatar || '/assets/default-avatar.png'}" alt="${this.escapeHtml(partner.name)}">
                            <span class="tier-badge" style="background: ${tierInfo.color}">
                                <i class="fas ${tierInfo.icon}"></i>
                                ${tierInfo.label}
                            </span>
                        </div>
                        <h4>${this.escapeHtml(partner.name)}</h4>
                        ${partner.company ? `<small>${this.escapeHtml(partner.company)}</small>` : ''}
                    </div>
                    
                    <div class="partner-stats">
                        <div class="stat">
                            <span class="stat-value">${partner.referralCount}</span>
                            <span class="stat-label">Referrals</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${partner.conversionRate}%</span>
                            <span class="stat-label">Conv. Rate</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${partner.totalEarnings}</span>
                            <span class="stat-label">Earnings</span>
                        </div>
                    </div>
                    
                    ${nextTier ? `
                        <div class="next-tier-progress">
                            <small>Progress to ${nextTier.label}</small>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(partner.referralCount / nextTier.minReferrals) * 100}%; background: ${nextTier.color}"></div>
                            </div>
                            <small>${partner.referralCount}/${nextTier.minReferrals} referrals</small>
                        </div>
                    ` : ''}
                    
                    <div class="partner-footer">
                        <span>Joined ${partner.formattedJoined}</span>
                        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.Global.Referrals.viewPartner('${partner.id}')">
                            View Profile
                        </button>
                    </div>
                </div>
            `;
        });
        
        return cards;
    }
    
    /**
     * Render commissions tab
     */
    renderCommissionsTab() {
        return `
            <div class="commissions-container">
                <div class="list-header">
                    <h3>Commission Management</h3>
                    <div class="commission-summary">
                        <span>Total Earned: <strong>${Formatters.currency(this.metrics.totalCommissions)}</strong></span>
                        <span>Pending Payout: <strong>${Formatters.currency(this.metrics.pendingPayouts)}</strong></span>
                    </div>
                </div>
                
                <div class="commission-settings">
                    <h4><i class="fas fa-cog"></i> Commission Structure</h4>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label>Default Rate</label>
                            <span>${this.commissionSettings.defaultRate}%</span>
                        </div>
                        <div class="setting-item">
                            <label>Minimum Payout</label>
                            <span>${Formatters.currency(this.commissionSettings.minimumPayout)}</span>
                        </div>
                        <div class="setting-item">
                            <label>Payout Schedule</label>
                            <span>${this.commissionSettings.payoutSchedule}</span>
                        </div>
                        <div class="setting-item">
                            <label>Cookie Duration</label>
                            <span>${this.commissionSettings.cookieDuration} days</span>
                        </div>
                    </div>
                    
                    ${this.commissionSettings.allowMultiLevel ? `
                        <div class="multi-level-rates">
                            <h5>Multi-Level Commission Rates</h5>
                            ${Object.entries(this.commissionSettings.levelRates).map(([level, rate]) => `
                                <div class="level-rate-item">
                                    <span>${level.replace('level', 'Level ')}</span>
                                    <span class="rate">${rate}%</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="table-responsive">
                    <table class="commission-table" id="commissions-table">
                        <thead>
                            <tr>
                                <th>Referral</th>
                                <th>Partner</th>
                                <th>Amount</th>
                                <th>Rate</th>
                                <th>Status</th>
                                <th>Earned Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderCommissionRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    /**
     * Render commission rows
     */
    renderCommissionRows() {
        let rows = '';
        
        this.commissions.forEach((commission, referralId) => {
            const referral = this.referrals.get(referralId);
            const statusInfo = this.commissionStatuses[commission.status] || this.commissionStatuses.earned;
            
            rows += `
                <tr>
                    <td>${this.escapeHtml(referral?.referredName || 'N/A')}</td>
                    <td>${this.escapeHtml(referral?.partnerName || 'N/A')}</td>
                    <td>${Formatters.currency(commission.amount)}</td>
                    <td>${commission.rate}%</td>
                    <td>
                        <span class="status-badge" style="background: ${statusInfo.color}20; color: ${statusInfo.color}">
                            ${statusInfo.label}
                        </span>
                    </td>
                    <td>${Formatters.date(commission.earnedAt)}</td>
                    <td>
                        <div class="action-buttons">
                            ${commission.status === 'earned' ? `
                                <button class="btn btn-sm btn-success" 
                                        onclick="window.Global.Referrals.approveCommission('${referralId}')">
                                    Approve
                                </button>
                            ` : ''}
                            ${commission.status === 'approved' || commission.status === 'pending_payout' ? `
                                <button class="btn btn-sm btn-primary" 
                                        onclick="window.Global.Referrals.processPayout('${referralId}')">
                                    Pay
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (!rows) {
            rows = '<tr><td colspan="7" class="text-center">No commissions found</td></tr>';
        }
        
        return rows;
    }
    
    /**
     * Render referral tree tab
     */
    renderReferralTreeTab() {
        return `
            <div class="referral-tree-container">
                <div class="list-header">
                    <h3><i class="fas fa-sitemap"></i> Multi-Level Referral Tree</h3>
                    <span class="tree-info">Showing up to ${this.maxLevels} levels</span>
                </div>
                
                <div class="tree-view" id="referral-tree">
                    ${this.renderReferralTree()}
                </div>
            </div>
        `;
    }
    
    /**
     * Render referral tree visualization
     */
    renderReferralTree() {
        if (this.referrals.size === 0) {
            return '<div class="tree-empty">No referral tree data available</div>';
        }
        
        // Find root referrals (no parent)
        const rootReferrals = [];
        this.referrals.forEach((referral, id) => {
            if (!referral.parentReferralId) {
                rootReferrals.push(referral);
            }
        });
        
        if (rootReferrals.length === 0) {
            return '<div class="tree-empty">No root referrals found</div>';
        }
        
        let treeHtml = '<div class="tree-structure">';
        
        rootReferrals.forEach(rootReferral => {
            treeHtml += this.renderTreeNode(rootReferral, 0);
        });
        
        treeHtml += '</div>';
        
        return treeHtml;
    }
    
    /**
     * Render tree node recursively
     */
    renderTreeNode(referral, level) {
        if (level >= this.maxLevels) return '';
        
        const children = this.referralTree.get(referral.id) || [];
        const hasChildren = children.length > 0;
        
        let html = `
            <div class="tree-node level-${level}">
                <div class="node-card" style="border-left: 3px solid ${referral.statusInfo.color}">
                    <div class="node-header">
                        <span class="node-level">L${level + 1}</span>
                        <span class="status-dot" style="background: ${referral.statusInfo.color}"></span>
                        <strong>${this.escapeHtml(referral.referredName)}</strong>
                    </div>
                    <div class="node-details">
                        <small>Partner: ${this.escapeHtml(referral.partnerName)}</small>
                        <small>Commission: ${referral.formattedCommission}</small>
                    </div>
                </div>
        `;
        
        if (hasChildren) {
            html += '<div class="tree-children">';
            children.forEach(childId => {
                const childReferral = this.referrals.get(childId);
                if (childReferral) {
                    html += this.renderTreeNode(childReferral, level + 1);
                }
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Open create referral modal
     */
    async openCreateReferral() {
        try {
            const formHtml = `
                <div class="referral-form-container">
                    <form id="referral-form">
                        <div class="form-section">
                            <h4><i class="fas fa-link"></i> Referral Details</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="referral-partner">Partner *</label>
                                    <select id="referral-partner" name="partnerId" required>
                                        <option value="">Select Partner...</option>
                                        ${Array.from(this.partners.values()).map(p => `
                                            <option value="${p.id}">${this.escapeHtml(p.name)} (${p.tierInfo.label})</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="referral-source">Source *</label>
                                    <select id="referral-source" name="source" required>
                                        ${Object.entries(this.referralSources).map(([key, source]) => `
                                            <option value="${key}">${source.label}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="referral-name">Referred Person/Company *</label>
                                <input type="text" id="referral-name" name="referredName" required placeholder="Name of the referred entity">
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="referral-email">Email</label>
                                    <input type="email" id="referral-email" name="email" placeholder="Email address">
                                </div>
                                <div class="form-group col-6">
                                    <label for="referral-phone">Phone</label>
                                    <input type="tel" id="referral-phone" name="phone" placeholder="Phone number">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-cog"></i> Commission Details</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="referral-commission-type">Commission Type</label>
                                    <select id="referral-commission-type" name="commissionType">
                                        ${Object.entries(this.commissionTypes).map(([key, type]) => `
                                            <option value="${key}">${type.label} - ${type.description}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="referral-commission-rate">Commission Rate</label>
                                    <div class="input-with-suffix">
                                        <input type="number" id="referral-commission-rate" name="commissionRate" 
                                               value="${this.commissionSettings.defaultRate}" min="0" max="100" step="0.1">
                                        <span class="suffix">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-sticky-note"></i> Notes</h4>
                            <div class="form-group">
                                <textarea id="referral-notes" name="notes" rows="2" placeholder="Additional notes..."></textarea>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-link"></i> Create Referral
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Create New Referral',
                content: formHtml,
                size: 'large',
                onClose: () => {}
            });
            
            modal.open();
            
            setTimeout(() => {
                this.setupReferralForm();
            }, 100);
            
        } catch (error) {
            console.error('[Referrals] Create form open failed:', error);
            Toast.show('Failed to open referral form', 'error');
        }
    }
    
    /**
     * Set up referral form handlers
     */
    setupReferralForm() {
        try {
            const form = document.getElementById('referral-form');
            if (!form) return;
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const data = {
                    partnerId: formData.get('partnerId'),
                    source: formData.get('source'),
                    referredName: formData.get('referredName'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    commissionType: formData.get('commissionType'),
                    commissionRate: parseFloat(formData.get('commissionRate')),
                    notes: formData.get('notes')
                };
                
                try {
                    await this.createReferral(data);
                    Modal.close();
                    await this.loadReferrals();
                    await this.render();
                    Toast.show('Referral created successfully', 'success');
                } catch (error) {
                    Toast.show('Failed to create referral: ' + error.message, 'error');
                }
            });
            
        } catch (error) {
            console.error('[Referrals] Form setup failed:', error);
        }
    }
    
    /**
     * Convert a referral
     */
    async convertReferral(referralId) {
        try {
            const referral = this.referrals.get(referralId);
            if (!referral) throw new Error('Referral not found');
            
            const confirmed = await this.confirmDialog(
                'Convert Referral',
                `Mark referral for "${referral.referredName}" as converted? This will trigger commission calculation.`
            );
            
            if (!confirmed) return;
            
            const response = await API.post(`${this.apiEndpoint}/${referralId}/convert`, {
                dealValue: prompt('Enter deal value (₹):', '0')
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Calculate and create commission
            const commissionData = response.data.commission;
            
            Toast.show('Referral converted! Commission calculated.', 'success');
            
            await this.loadReferrals();
            await this.loadCommissions();
            await this.calculateMetrics();
            await this.render();
            
            EventBus.emit('referral:converted', { referralId, commission: commissionData });
            
        } catch (error) {
            console.error('[Referrals] Conversion failed:', error);
            Toast.show('Failed to convert referral', 'error');
        }
    }
    
    /**
     * Approve commission
     */
    async approveCommission(referralId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/commissions/${referralId}/approve`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Commission approved', 'success');
            await this.loadCommissions();
            await this.render();
            
        } catch (error) {
            console.error('[Referrals] Commission approval failed:', error);
            Toast.show('Failed to approve commission', 'error');
        }
    }
    
    /**
     * Process payout
     */
    async processPayout(referralId) {
        try {
            const payoutFormHtml = `
                <div class="payout-form">
                    <form id="payout-form">
                        <div class="form-group">
                            <label>Commission Amount</label>
                            <input type="text" value="${Formatters.currency(this.commissions.get(referralId)?.amount || 0)}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="payout-method">Payout Method *</label>
                            <select id="payout-method" name="method" required>
                                ${Object.entries(this.payoutMethods).map(([key, method]) => `
                                    <option value="${key}">${method.label} (${method.processingDays} days)</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="payout-reference">Reference Number</label>
                            <input type="text" id="payout-reference" name="reference" placeholder="Transaction reference">
                        </div>
                        <div class="form-group">
                            <label for="payout-notes">Notes</label>
                            <textarea id="payout-notes" name="notes" rows="2"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Process Payout</button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Process Payout',
                content: payoutFormHtml,
                size: 'medium'
            });
            
            modal.open();
            
            setTimeout(() => {
                const form = document.getElementById('payout-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData(form);
                        
                        try {
                            const response = await API.post(`${this.apiEndpoint}/payouts/process`, {
                                referralId,
                                method: formData.get('method'),
                                reference: formData.get('reference'),
                                notes: formData.get('notes')
                            });
                            
                            if (!response.success) throw new Error(response.error);
                            
                            Modal.close();
                            Toast.show('Payout processed successfully', 'success');
                            await this.loadCommissions();
                            await this.calculateMetrics();
                            await this.render();
                        } catch (error) {
                            Toast.show('Payout failed: ' + error.message, 'error');
                        }
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('[Referrals] Payout processing failed:', error);
            Toast.show('Failed to process payout', 'error');
        }
    }
    
    /**
     * Get next tier for partner
     */
    getNextTier(currentTier) {
        const tiers = Object.entries(this.partnerTiers);
        const currentIndex = tiers.findIndex(([key]) => key === currentTier);
        
        if (currentIndex < tiers.length - 1) {
            const [key, tier] = tiers[currentIndex + 1];
            return { key, ...tier };
        }
        
        return null; // Already at highest tier
    }
    
    /**
     * Calculate days since date
     */
    calculateDaysSince(dateString) {
        if (!dateString) return 0;
        const date = new Date(dateString);
        const now = new Date();
        return Math.floor((now - date) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalReferrals = 0;
            let convertedReferrals = 0;
            let totalCommissions = 0;
            let paidCommissions = 0;
            let pendingPayouts = 0;
            let activePartners = 0;
            let totalPartners = 0;
            
            this.referrals.forEach(referral => {
                totalReferrals++;
                if (referral.isConverted) convertedReferrals++;
            });
            
            this.commissions.forEach(commission => {
                totalCommissions += commission.amount || 0;
                if (commission.status === 'paid') paidCommissions += commission.amount || 0;
                if (commission.status === 'pending_payout' || commission.status === 'approved') {
                    pendingPayouts += commission.amount || 0;
                }
            });
            
            this.partners.forEach(partner => {
                totalPartners++;
                if (partner.referralCount > 0) activePartners++;
            });
            
            this.metrics.totalReferrals = totalReferrals;
            this.metrics.convertedReferrals = convertedReferrals;
            this.metrics.conversionRate = totalReferrals > 0 ? 
                Math.round((convertedReferrals / totalReferrals) * 100) : 0;
            this.metrics.totalCommissions = totalCommissions;
            this.metrics.paidCommissions = paidCommissions;
            this.metrics.pendingPayouts = pendingPayouts;
            this.metrics.activePartners = activePartners;
            this.metrics.totalPartners = totalPartners;
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Referrals] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Create referral
     */
    async createReferral(data) {
        const response = await API.post(`${this.apiEndpoint}/create`, data);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}list`);
        return response.data;
    }
    
    /**
     * Update referral
     */
    async updateReferral(data) {
        const response = await API.put(`${this.apiEndpoint}/${data.id}`, data);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}list`);
        return response.data;
    }
    
    /**
     * Create partner
     */
    async createPartner(data) {
        const response = await API.post('/api/partners', data);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }
    
    /**
     * Switch tab
     */
    async switchTab(tab) {
        this.currentTab = tab;
        await this.render();
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
     * Render empty state
     */
    renderEmptyState(type) {
        const messages = {
            referrals: { icon: 'fa-link', title: 'No Referrals', text: 'Create your first referral' },
            partners: { icon: 'fa-handshake', title: 'No Partners', text: 'Add referral partners' }
        };
        
        const msg = messages[type] || messages.referrals;
        
        return `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas ${msg.icon}"></i></div>
                <h3>${msg.title}</h3>
                <p>${msg.text}</p>
                ${type === 'referrals' ? `
                    <button class="btn btn-primary" onclick="window.Global.Referrals.openCreateReferral()">
                        <i class="fas fa-plus"></i> New Referral
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Render pagination
     */
    renderPagination() {
        if (this.pagination.totalPages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        html += `<button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                        onclick="window.Global.Referrals.loadReferrals(${this.pagination.page - 1})">
                    <i class="fas fa-chevron-left"></i></button>`;
        
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `<button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                                onclick="window.Global.Referrals.loadReferrals(${i})">${i}</button>`;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        html += `<button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                        onclick="window.Global.Referrals.loadReferrals(${this.pagination.page + 1})">
                    <i class="fas fa-chevron-right"></i></button>`;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Are default filters
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.source === 'all' &&
               this.filters.partner === 'all' &&
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
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Clean up
     */
    destroy() {
        EventBus.off('referral:create');
        EventBus.off('referral:update');
        EventBus.off('referral:convert');
        
        console.log('[Referrals] Module destroyed');
    }
}

// Singleton
const referrals = new ReferralsModule();

// Exports
export { referrals, ReferralsModule };
export default referrals;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Referrals = referrals;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
