/**
 * 11 AVATAR DIGITAL HUB - Payments Module
 * Enterprise-grade payment tracking & reconciliation system
 * Multi-currency, multi-method, UPI, bank transfers, automated reconciliation
 * 
 * @module Payments
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
 * Payments Module - Complete payment lifecycle management
 * Handles collections, reconciliations, reminders, UPI integration
 */
class PaymentsModule {
    constructor() {
        // Module identity
        this.moduleName = 'payments';
        this.apiEndpoint = '/api/payments';
        this.cachePrefix = 'payment_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Payment methods configuration
        this.paymentMethods = {
            'upi': {
                name: 'UPI',
                icon: 'fa-mobile-alt',
                color: '#10B981',
                enabled: true,
                providers: ['gpay', 'phonepe', 'paytm', 'bhim'],
                validationPattern: /^[\w.-]+@[\w]+$|^\d{10}$/
            },
            'bank_transfer': {
                name: 'Bank Transfer',
                icon: 'fa-university',
                color: '#3B82F6',
                enabled: true,
                requiresReference: true
            },
            'cheque': {
                name: 'Cheque',
                icon: 'fa-money-check',
                color: '#F59E0B',
                enabled: true,
                requiresNumber: true,
                clearingDays: 3
            },
            'cash': {
                name: 'Cash',
                icon: 'fa-money-bill-wave',
                color: '#6B7280',
                enabled: true,
                maxAmount: 200000 // ₹2 lakh limit as per Indian IT rules
            },
            'credit_card': {
                name: 'Credit Card',
                icon: 'fa-credit-card',
                color: '#8B5CF6',
                enabled: true,
                processingFee: 2.0 // 2% processing fee
            },
            'neft_rtgs': {
                name: 'NEFT/RTGS',
                icon: 'fa-exchange-alt',
                color: '#EC4899',
                enabled: true,
                minAmount: 2 // Minimum ₹2 for NEFT
            },
            'demand_draft': {
                name: 'Demand Draft',
                icon: 'fa-file-invoice',
                color: '#F97316',
                enabled: true,
                clearingDays: 1
            }
        };
        
        // Payment status definitions
        this.paymentStatuses = {
            'pending': { label: 'Pending', color: '#F59E0B', icon: 'fa-clock' },
            'processing': { label: 'Processing', color: '#3B82F6', icon: 'fa-spinner' },
            'completed': { label: 'Completed', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#EF4444', icon: 'fa-times-circle' },
            'refunded': { label: 'Refunded', color: '#8B5CF6', icon: 'fa-undo' },
            'partial': { label: 'Partially Paid', color: '#F97316', icon: 'fa-adjust' },
            'disputed': { label: 'Disputed', color: '#DC2626', icon: 'fa-exclamation-triangle' },
            'on_hold': { label: 'On Hold', color: '#6B7280', icon: 'fa-pause-circle' }
        };
        
        // Module state
        this.payments = new Map();
        this.selectedPaymentId = null;
        this.filters = {
            status: 'all',
            method: 'all',
            clientId: 'all',
            invoiceId: 'all',
            dateRange: null,
            search: '',
            minAmount: null,
            maxAmount: null
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 25,
            total: 0,
            totalPages: 0
        };
        
        // Sort state
        this.sortConfig = {
            field: 'paymentDate',
            order: 'desc'
        };
        
        // UI State
        this.currentView = 'list'; // list, grid, calendar, detail, record
        this.isProcessing = false;
        this.pendingSync = [];
        
        // Reconciliation state
        this.reconciliation = {
            lastSyncDate: null,
            unmatchedTransactions: [],
            autoReconcile: true,
            toleranceAmount: 1.0 // ₹1 tolerance for auto-reconciliation
        };
        
        // UPI Integration
        this.upiConfig = {
            merchantId: null,
            vpa: null, // Virtual Payment Address
            qrCode: null,
            callbackUrl: null,
            enabled: false
        };
        
        // Bank accounts
        this.bankAccounts = [];
        
        // Performance metrics
        this.metrics = {
            totalProcessed: 0,
            totalAmount: 0,
            averageTime: 0,
            successRate: 0,
            lastUpdated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            paymentList: null,
            paymentGrid: null,
            paymentDetail: null,
            filterBar: null,
            searchInput: null,
            dateRangePicker: null,
            recordButton: null,
            exportButton: null,
            reconciliationPanel: null
        };
        
        // Auto-refresh interval
        this.refreshInterval = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize payments module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Payments] Initializing payment module...');
            
            // Check permissions
            const canAccess = await Permissions.check('payments', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Insufficient permissions for payments', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM elements
            this.cacheDOM();
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load bank accounts
            await this.loadBankAccounts();
            
            // Load payments
            await this.loadPayments();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up auto-refresh (every 2 minutes)
            this.setupAutoRefresh();
            
            // Render initial view
            await this.render();
            
            // Calculate metrics
            this.calculateMetrics();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Payments] Initialized in ${loadTime.toFixed(2)}ms`);
            
            // Emit ready event
            EventBus.emit('payments:ready', {
                count: this.payments.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Payments] Initialization failed:', error);
            Toast.show('Failed to load payments module', 'error');
        }
    }
    
    /**
     * Cache DOM element references
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#payments-container',
                paymentList: '#payment-list',
                paymentGrid: '#payment-grid',
                paymentDetail: '#payment-detail',
                filterBar: '#payment-filters',
                searchInput: '#payment-search',
                dateRangePicker: '#payment-date-range',
                recordButton: '#record-payment-btn',
                exportButton: '#export-payments-btn',
                reconciliationPanel: '#reconciliation-panel'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                } else {
                    console.warn(`[Payments] Element not found: ${selector}`);
                }
            }
            
            console.log('[Payments] DOM elements cached');
            
        } catch (error) {
            console.error('[Payments] DOM cache failed:', error);
        }
    }
    
    /**
     * Load module configuration
     */
    async loadConfiguration() {
        try {
            // Check cache
            const cached = await Cache.get(`${this.cachePrefix}config`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.upiConfig = cached.data.upiConfig || this.upiConfig;
                this.reconciliation = { ...this.reconciliation, ...cached.data.reconciliation };
                this.bankAccounts = cached.data.bankAccounts || [];
                return;
            }
            
            // Fetch from API
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                // Update UPI config
                if (response.data.upiConfig) {
                    this.upiConfig = { ...this.upiConfig, ...response.data.upiConfig };
                }
                
                // Update reconciliation config
                if (response.data.reconciliation) {
                    this.reconciliation = { ...this.reconciliation, ...response.data.reconciliation };
                }
                
                // Cache configuration
                await Cache.set(`${this.cachePrefix}config`, {
                    upiConfig: this.upiConfig,
                    reconciliation: this.reconciliation,
                    bankAccounts: this.bankAccounts
                }, this.cacheTimeout);
            }
            
            console.log('[Payments] Configuration loaded');
            
        } catch (error) {
            console.error('[Payments] Config load failed:', error);
            // Continue with defaults
        }
    }
    
    /**
     * Load bank accounts
     */
    async loadBankAccounts() {
        try {
            const response = await API.get('/api/bank-accounts');
            
            if (response.success && response.data) {
                this.bankAccounts = response.data;
                console.log(`[Payments] Loaded ${this.bankAccounts.length} bank accounts`);
            }
            
        } catch (error) {
            console.error('[Payments] Bank accounts load failed:', error);
        }
    }
    
    /**
     * Load payments from API with pagination
     */
    async loadPayments(page = 1) {
        try {
            this.pagination.page = page;
            
            // Build query parameters
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            // Add active filters
            if (this.filters.status !== 'all') {
                params.set('status', this.filters.status);
            }
            if (this.filters.method !== 'all') {
                params.set('method', this.filters.method);
            }
            if (this.filters.clientId !== 'all') {
                params.set('clientId', this.filters.clientId);
            }
            if (this.filters.invoiceId !== 'all') {
                params.set('invoiceId', this.filters.invoiceId);
            }
            if (this.filters.search) {
                params.set('search', this.filters.search);
            }
            if (this.filters.dateRange) {
                params.set('dateFrom', this.filters.dateRange.from);
                params.set('dateTo', this.filters.dateRange.to);
            }
            
            // Check cache for default filters, first page
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processPaymentData(cached.data);
                    console.log('[Payments] Loaded from cache');
                    return;
                }
            }
            
            // API request
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load payments');
            }
            
            // Process payment data
            this.processPaymentData(response.data);
            
            // Cache if default filters
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Payments] Loaded ${this.payments.size} payments`);
            
        } catch (error) {
            console.error('[Payments] Load failed:', error);
            Toast.show('Failed to load payments', 'error');
        }
    }
    
    /**
     * Process and enrich payment data
     */
    processPaymentData(data) {
        try {
            this.payments.clear();
            
            if (data.payments && Array.isArray(data.payments)) {
                data.payments.forEach(payment => {
                    const processed = {
                        ...payment,
                        // Formatted fields
                        formattedAmount: Formatters.currency(payment.amount),
                        formattedDate: Formatters.date(payment.paymentDate),
                        formattedCreatedAt: Formatters.date(payment.createdAt),
                        
                        // Status with metadata
                        statusInfo: this.paymentStatuses[payment.status] || this.paymentStatuses.pending,
                        
                        // Method with metadata
                        methodInfo: this.paymentMethods[payment.method] || null,
                        
                        // Client info
                        clientName: payment.client?.name || 'Unknown',
                        clientCompany: payment.client?.company || '',
                        
                        // Invoice info
                        invoiceNumber: payment.invoice?.invoiceNumber || 'N/A',
                        invoiceTotal: Formatters.currency(payment.invoice?.total || 0),
                        
                        // Payment status derived fields
                        isCompleted: payment.status === 'completed',
                        isPending: payment.status === 'pending' || payment.status === 'processing',
                        isFailed: payment.status === 'failed',
                        canRefund: payment.status === 'completed',
                        canRetry: payment.status === 'failed',
                        
                        // Reconciliation status
                        isReconciled: payment.reconciled || false,
                        reconciliationDate: payment.reconciledAt ? Formatters.date(payment.reconciledAt) : null,
                        
                        // Age tracking
                        ageInDays: this.calculateAge(payment.paymentDate),
                        
                        // Reference tracking
                        hasReference: !!(payment.reference || payment.transactionId || payment.utr),
                        
                        // Amount breakdown if partial payment
                        remainingAmount: payment.invoice?.total - (payment.invoice?.paidAmount || 0),
                        paymentPercentage: payment.invoice?.total ? 
                            ((payment.amount / payment.invoice.total) * 100).toFixed(1) : 0
                    };
                    
                    this.payments.set(payment.id, processed);
                });
            }
            
            // Update pagination
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
            this.metrics.lastUpdated = new Date();
            
        } catch (error) {
            console.error('[Payments] Data processing failed:', error);
        }
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        try {
            // Search input with debounce
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 400)
                );
            }
            
            // Filter changes
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (event) => {
                    if (event.target.dataset.filter) {
                        this.handleFilterChange(
                            event.target.dataset.filter,
                            event.target.value
                        );
                    }
                });
            }
            
            // Date range picker
            if (this.elements.dateRangePicker) {
                this.elements.dateRangePicker.addEventListener('change', (event) => {
                    this.handleDateRangeChange(event.target.value);
                });
            }
            
            // Record payment button
            if (this.elements.recordButton) {
                this.elements.recordButton.addEventListener('click', () => {
                    this.openRecordPayment();
                });
            }
            
            // Export button
            if (this.elements.exportButton) {
                this.elements.exportButton.addEventListener('click', () => {
                    this.exportPayments();
                });
            }
            
            // Event bus subscriptions
            EventBus.on('payment:record', this.recordPayment.bind(this));
            EventBus.on('payment:update', this.updatePayment.bind(this));
            EventBus.on('payment:delete', this.deletePayment.bind(this));
            EventBus.on('payment:refund', this.refundPayment.bind(this));
            EventBus.on('payment:reconcile', this.reconcilePayment.bind(this));
            EventBus.on('payment:send-reminder', this.sendPaymentReminder.bind(this));
            EventBus.on('invoice:paid', this.handleInvoicePaid.bind(this));
            
            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
            
            // Online/Offline sync
            window.addEventListener('online', () => {
                this.syncPendingPayments();
            });
            
            console.log('[Payments] Event listeners initialized');
            
        } catch (error) {
            console.error('[Payments] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up auto-refresh for real-time updates
     */
    setupAutoRefresh() {
        try {
            // Clear existing interval
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            // Refresh every 2 minutes
            this.refreshInterval = setInterval(async () => {
                console.log('[Payments] Auto-refreshing...');
                await this.loadPayments(this.pagination.page);
                await this.render();
            }, 120000); // 2 minutes
            
            console.log('[Payments] Auto-refresh set (2 min interval)');
            
        } catch (error) {
            console.error('[Payments] Auto-refresh setup failed:', error);
        }
    }
    
    /**
     * Render payments view
     */
    async render() {
        try {
            if (!this.elements.container) {
                console.error('[Payments] Container not found');
                return;
            }
            
            switch (this.currentView) {
                case 'list':
                    await this.renderListView();
                    break;
                case 'grid':
                    await this.renderGridView();
                    break;
                case 'calendar':
                    await this.renderCalendarView();
                    break;
                case 'detail':
                    await this.renderDetailView();
                    break;
                case 'record':
                    await this.renderRecordForm();
                    break;
                default:
                    await this.renderListView();
            }
            
        } catch (error) {
            console.error('[Payments] Render failed:', error);
            Toast.show('Failed to render payments view', 'error');
        }
    }
    
    /**
     * Render list view - main payment table
     */
    async renderListView() {
        try {
            if (!this.elements.paymentList) return;
            
            // Calculate summary stats
            const stats = this.calculateSummaryStats();
            
            let html = `
                <div class="payments-list-container">
                    <!-- Summary Cards -->
                    <div class="payment-summary-cards">
                        <div class="summary-card total-collected">
                            <div class="card-icon">
                                <i class="fas fa-rupee-sign"></i>
                            </div>
                            <div class="card-data">
                                <h4>Total Collected</h4>
                                <div class="card-value">${Formatters.currency(stats.totalCollected)}</div>
                                <div class="card-subtitle">${stats.totalPayments} payments</div>
                            </div>
                        </div>
                        
                        <div class="summary-card pending-amount">
                            <div class="card-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="card-data">
                                <h4>Pending</h4>
                                <div class="card-value">${Formatters.currency(stats.pendingAmount)}</div>
                                <div class="card-subtitle">${stats.pendingCount} payments</div>
                            </div>
                        </div>
                        
                        <div class="summary-card success-rate">
                            <div class="card-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="card-data">
                                <h4>Success Rate</h4>
                                <div class="card-value">${stats.successRate.toFixed(1)}%</div>
                                <div class="card-subtitle">Last 30 days</div>
                            </div>
                        </div>
                        
                        <div class="summary-card todays-collection">
                            <div class="card-icon">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="card-data">
                                <h4>Today's Collection</h4>
                                <div class="card-value">${Formatters.currency(stats.todayCollection)}</div>
                                <div class="card-subtitle">${stats.todayCount} payments</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bulk Actions Bar -->
                    <div class="bulk-actions-bar" id="payment-bulk-actions" style="display: none;">
                        <span class="selected-count">0 selected</span>
                        <button class="btn btn-sm btn-success" onclick="window.Global.Payments.bulkReconcile()">
                            <i class="fas fa-check-double"></i> Reconcile
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Payments.bulkExport()">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Payments.bulkSendReminder()">
                            <i class="fas fa-bell"></i> Send Reminder
                        </button>
                    </div>
                    
                    <!-- Payments Table -->
                    <div class="table-responsive">
                        <table class="payment-table" role="grid" aria-label="Payments list">
                            <thead>
                                <tr>
                                    <th scope="col" class="col-checkbox">
                                        <input type="checkbox" id="select-all-payments" aria-label="Select all">
                                    </th>
                                    <th scope="col" class="col-date sortable" data-sort="paymentDate">
                                        Date <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-invoice sortable" data-sort="invoiceId">
                                        Invoice <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-client sortable" data-sort="clientId">
                                        Client <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-method sortable" data-sort="method">
                                        Method <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-amount sortable" data-sort="amount">
                                        Amount <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-status sortable" data-sort="status">
                                        Status <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-reference">
                                        Reference
                                    </th>
                                    <th scope="col" class="col-actions">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="payment-table-body">
                                ${this.renderPaymentRows()}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Empty State -->
                    ${this.payments.size === 0 ? this.renderEmptyState() : ''}
                    
                    <!-- Pagination -->
                    ${this.renderPagination()}
                    
                    <!-- Reconciliation Panel -->
                    <div class="reconciliation-panel" id="reconciliation-panel" style="display: none;">
                        <div class="panel-header">
                            <h3><i class="fas fa-balance-scale"></i> Reconciliation</h3>
                            <button class="btn-close" onclick="window.Global.Payments.toggleReconciliation()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="panel-body">
                            <div class="reconciliation-stats">
                                <div class="stat-item">
                                    <span>Last Sync</span>
                                    <strong>${this.reconciliation.lastSyncDate ? 
                                        Formatters.date(this.reconciliation.lastSyncDate) : 'Never'}</strong>
                                </div>
                                <div class="stat-item">
                                    <span>Unmatched</span>
                                    <strong>${this.reconciliation.unmatchedTransactions.length}</strong>
                                </div>
                            </div>
                            <button class="btn btn-primary" onclick="window.Global.Payments.startReconciliation()">
                                <i class="fas fa-sync"></i> Start Reconciliation
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            this.elements.paymentList.innerHTML = html;
            
            // Set up sort handlers
            this.setupSortHandlers();
            
            // Set up select all
            this.setupSelectAll();
            
            console.log('[Payments] List view rendered');
            
        } catch (error) {
            console.error('[Payments] List render failed:', error);
        }
    }
    
    /**
     * Render payment table rows
     */
    renderPaymentRows() {
        try {
            if (this.payments.size === 0) return '';
            
            let rows = '';
            
            this.payments.forEach((payment) => {
                const statusInfo = payment.statusInfo;
                const methodInfo = payment.methodInfo;
                
                rows += `
                    <tr class="payment-row ${payment.isReconciled ? 'reconciled' : ''}" 
                        data-payment-id="${payment.id}">
                        <td class="col-checkbox">
                            <input type="checkbox" class="payment-select" 
                                   data-id="${payment.id}" 
                                   aria-label="Select payment">
                        </td>
                        <td class="col-date" data-sort-value="${payment.paymentDate}">
                            <div class="date-display">
                                <span class="date">${payment.formattedDate}</span>
                                <small class="age">${payment.ageInDays}d ago</small>
                            </div>
                        </td>
                        <td class="col-invoice">
                            <a href="#" onclick="window.Global.Payments.viewInvoice('${payment.invoiceId}')" 
                               class="invoice-link">
                                #${this.escapeHtml(payment.invoiceNumber)}
                            </a>
                        </td>
                        <td class="col-client">
                            <div class="client-display">
                                <span class="client-name">${this.escapeHtml(payment.clientName)}</span>
                                ${payment.clientCompany ? `
                                    <small class="client-company">${this.escapeHtml(payment.clientCompany)}</small>
                                ` : ''}
                            </div>
                        </td>
                        <td class="col-method">
                            <span class="method-badge" style="background: ${methodInfo?.color || '#6B7280'}20; 
                                                                color: ${methodInfo?.color || '#6B7280'}">
                                <i class="fas ${methodInfo?.icon || 'fa-credit-card'}"></i>
                                ${methodInfo?.name || payment.method}
                            </span>
                        </td>
                        <td class="col-amount" data-sort-value="${payment.amount}">
                            <div class="amount-display">
                                <strong>${payment.formattedAmount}</strong>
                                ${payment.paymentPercentage < 100 ? `
                                    <div class="payment-progress-mini">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${payment.paymentPercentage}%"></div>
                                        </div>
                                        <small>${payment.paymentPercentage}% of invoice</small>
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td class="col-status">
                            <span class="status-badge" style="background: ${statusInfo.color}20; 
                                                              color: ${statusInfo.color}">
                                <i class="fas ${statusInfo.icon}"></i>
                                ${statusInfo.label}
                            </span>
                            ${payment.isReconciled ? `
                                <span class="reconciled-badge">
                                    <i class="fas fa-check-double"></i> Reconciled
                                </span>
                            ` : ''}
                        </td>
                        <td class="col-reference">
                            ${payment.reference ? `
                                <span class="reference-number" title="${this.escapeHtml(payment.reference)}">
                                    ${this.escapeHtml(payment.reference.substring(0, 15))}${payment.reference.length > 15 ? '...' : ''}
                                </span>
                            ` : '<span class="no-reference">-</span>'}
                            ${payment.utr ? `
                                <small class="utr">UTR: ${this.escapeHtml(payment.utr)}</small>
                            ` : ''}
                        </td>
                        <td class="col-actions">
                            <div class="action-buttons">
                                <button class="btn-icon view-payment" title="View Details"
                                        onclick="window.Global.Payments.viewPayment('${payment.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${payment.canRefund ? `
                                    <button class="btn-icon refund-payment" title="Refund"
                                            onclick="window.Global.Payments.refundPayment('${payment.id}')">
                                        <i class="fas fa-undo"></i>
                                    </button>
                                ` : ''}
                                ${!payment.isReconciled ? `
                                    <button class="btn-icon reconcile-payment" title="Reconcile"
                                            onclick="window.Global.Payments.reconcilePayment('${payment.id}')">
                                        <i class="fas fa-check-double"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-icon more-actions" title="More"
                                        onclick="window.Global.Payments.showContextMenu(event, '${payment.id}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            return rows;
            
        } catch (error) {
            console.error('[Payments] Row render failed:', error);
            return '<tr><td colspan="9" class="error-cell">Failed to load payments</td></tr>';
        }
    }
    
    /**
     * Calculate summary statistics
     */
    calculateSummaryStats() {
        try {
            const stats = {
                totalCollected: 0,
                totalPayments: 0,
                pendingAmount: 0,
                pendingCount: 0,
                successRate: 0,
                todayCollection: 0,
                todayCount: 0,
                methodBreakdown: {},
                statusBreakdown: {}
            };
            
            const today = new Date().toISOString().split('T')[0];
            let successfulPayments = 0;
            let totalAttempts = 0;
            
            // Initialize breakdown objects
            Object.keys(this.paymentMethods).forEach(method => {
                stats.methodBreakdown[method] = { count: 0, amount: 0 };
            });
            
            Object.keys(this.paymentStatuses).forEach(status => {
                stats.statusBreakdown[status] = { count: 0, amount: 0 };
            });
            
            this.payments.forEach(payment => {
                const amount = parseFloat(payment.amount) || 0;
                
                // Total collected (completed payments)
                if (payment.status === 'completed') {
                    stats.totalCollected += amount;
                    stats.totalPayments++;
                    successfulPayments++;
                }
                
                // Pending amount
                if (payment.isPending) {
                    stats.pendingAmount += amount;
                    stats.pendingCount++;
                }
                
                // Today's collection
                if (payment.paymentDate === today && payment.status === 'completed') {
                    stats.todayCollection += amount;
                    stats.todayCount++;
                }
                
                // Method breakdown
                if (stats.methodBreakdown[payment.method]) {
                    stats.methodBreakdown[payment.method].count++;
                    stats.methodBreakdown[payment.method].amount += amount;
                }
                
                // Status breakdown
                if (stats.statusBreakdown[payment.status]) {
                    stats.statusBreakdown[payment.status].count++;
                    stats.statusBreakdown[payment.status].amount += amount;
                }
                
                totalAttempts++;
            });
            
            // Calculate success rate
            stats.successRate = totalAttempts > 0 ? 
                (successfulPayments / totalAttempts) * 100 : 0;
            
            return stats;
            
        } catch (error) {
            console.error('[Payments] Stats calculation failed:', error);
            return {
                totalCollected: 0,
                totalPayments: 0,
                pendingAmount: 0,
                pendingCount: 0,
                successRate: 0,
                todayCollection: 0,
                todayCount: 0
            };
        }
    }
    
    /**
     * Open record payment form
     */
    async openRecordPayment(paymentData = null) {
        try {
            // Check permissions
            const canCreate = await Permissions.check('payments', 'create');
            if (!canCreate) {
                Toast.show('You do not have permission to record payments', 'error');
                return;
            }
            
            const isEditing = !!paymentData;
            const title = isEditing ? 'Update Payment' : 'Record New Payment';
            
            // Fetch pending invoices for dropdown
            const invoicesResponse = await API.get('/api/invoices/pending');
            const pendingInvoices = invoicesResponse.success ? invoicesResponse.data : [];
            
            const formHtml = `
                <div class="record-payment-form">
                    <form id="payment-form">
                        <!-- Invoice Selection -->
                        <div class="form-section">
                            <h3><i class="fas fa-file-invoice"></i> Invoice Details</h3>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="payment-invoice">Invoice *</label>
                                    <select id="payment-invoice" name="invoiceId" required 
                                            onchange="window.Global.Payments.onInvoiceSelect()">
                                        <option value="">Select Invoice...</option>
                                        ${pendingInvoices.map(inv => `
                                            <option value="${inv.id}" 
                                                    data-total="${inv.total}" 
                                                    data-paid="${inv.paidAmount || 0}"
                                                    data-client="${this.escapeHtml(inv.client?.name || '')}"
                                                    ${paymentData?.invoiceId === inv.id ? 'selected' : ''}>
                                                #${inv.invoiceNumber} - ${this.escapeHtml(inv.client?.name || '')} 
                                                (${Formatters.currency(inv.total)})
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label>Invoice Total</label>
                                    <input type="text" id="payment-invoice-total" readonly 
                                           value="₹0.00">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label>Balance Due</label>
                                    <input type="text" id="payment-invoice-balance" readonly 
                                           value="₹0.00">
                                </div>
                                <div class="form-group col-6">
                                    <label>Client</label>
                                    <input type="text" id="payment-client-name" readonly>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Payment Details -->
                        <div class="form-section">
                            <h3><i class="fas fa-money-bill-wave"></i> Payment Details</h3>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="payment-amount">Amount *</label>
                                    <div class="input-with-prefix">
                                        <span class="prefix">₹</span>
                                        <input type="number" id="payment-amount" name="amount" 
                                               value="${paymentData?.amount || ''}" 
                                               min="0.01" step="0.01" required>
                                    </div>
                                </div>
                                <div class="form-group col-4">
                                    <label for="payment-method">Payment Method *</label>
                                    <select id="payment-method" name="method" required>
                                        ${Object.entries(this.paymentMethods)
                                            .filter(([key, method]) => method.enabled)
                                            .map(([key, method]) => `
                                                <option value="${key}" 
                                                    ${paymentData?.method === key ? 'selected' : ''}>
                                                    ${method.name}
                                                </option>
                                            `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="payment-date">Payment Date *</label>
                                    <input type="date" id="payment-date" name="paymentDate" 
                                           value="${paymentData?.paymentDate || this.getTodayDate()}" required>
                                </div>
                            </div>
                            
                            <!-- UPI Details (shown conditionally) -->
                            <div id="upi-details" class="form-row" style="display: none;">
                                <div class="form-group col-6">
                                    <label for="payment-upi-id">UPI Transaction ID</label>
                                    <input type="text" id="payment-upi-id" name="upiTransactionId" 
                                           placeholder="Enter UPI reference number">
                                </div>
                                <div class="form-group col-6">
                                    <label for="payment-upi-app">UPI App</label>
                                    <select id="payment-upi-app" name="upiApp">
                                        <option value="">Select App</option>
                                        <option value="gpay">Google Pay</option>
                                        <option value="phonepe">PhonePe</option>
                                        <option value="paytm">Paytm</option>
                                        <option value="bhim">BHIM</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Bank Transfer Details -->
                            <div id="bank-details" class="form-row" style="display: none;">
                                <div class="form-group col-6">
                                    <label for="payment-bank-account">Bank Account</label>
                                    <select id="payment-bank-account" name="bankAccountId">
                                        <option value="">Select Account</option>
                                        ${this.bankAccounts.map(acc => `
                                            <option value="${acc.id}">
                                                ${this.escapeHtml(acc.bankName)} - ${acc.accountNumber}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="payment-utr">UTR/Reference Number</label>
                                    <input type="text" id="payment-utr" name="utr" 
                                           placeholder="Bank reference number">
                                </div>
                            </div>
                            
                            <!-- Cheque Details -->
                            <div id="cheque-details" class="form-row" style="display: none;">
                                <div class="form-group col-6">
                                    <label for="payment-cheque-number">Cheque Number</label>
                                    <input type="text" id="payment-cheque-number" name="chequeNumber" 
                                           placeholder="Enter cheque number">
                                </div>
                                <div class="form-group col-6">
                                    <label for="payment-cheque-date">Cheque Date</label>
                                    <input type="date" id="payment-cheque-date" name="chequeDate">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Additional Information -->
                        <div class="form-section">
                            <h3><i class="fas fa-info-circle"></i> Additional Information</h3>
                            <div class="form-row">
                                <div class="form-group col-12">
                                    <label for="payment-notes">Notes</label>
                                    <textarea id="payment-notes" name="notes" rows="2" 
                                              placeholder="Any additional notes...">${paymentData?.notes || ''}</textarea>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="payment-receipt">Upload Receipt</label>
                                    <input type="file" id="payment-receipt" name="receipt" 
                                           accept=".pdf,.jpg,.jpeg,.png">
                                </div>
                                <div class="form-group col-6">
                                    <label>
                                        <input type="checkbox" name="sendReceipt" checked>
                                        Send receipt to client
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" 
                                    onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-check"></i> 
                                ${isEditing ? 'Update Payment' : 'Record Payment'}
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: title,
                content: formHtml,
                size: 'large',
                onClose: () => {
                    // Cleanup
                }
            });
            
            modal.open();
            
            // Set up form handlers after render
            setTimeout(() => {
                this.setupPaymentForm();
            }, 100);
            
        } catch (error) {
            console.error('[Payments] Record form open failed:', error);
            Toast.show('Failed to open payment form', 'error');
        }
    }
    
    /**
     * Set up payment form handlers
     */
    setupPaymentForm() {
        try {
            const form = document.getElementById('payment-form');
            if (!form) return;
            
            // Form submission
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitPayment();
            });
            
            // Payment method change - show/hide relevant fields
            const methodSelect = document.getElementById('payment-method');
            if (methodSelect) {
                methodSelect.addEventListener('change', (e) => {
                    this.togglePaymentMethodFields(e.target.value);
                });
                
                // Trigger initial toggle
                if (methodSelect.value) {
                    this.togglePaymentMethodFields(methodSelect.value);
                }
            }
            
            console.log('[Payments] Payment form handlers set up');
            
        } catch (error) {
            console.error('[Payments] Form setup failed:', error);
        }
    }
    
    /**
     * Toggle payment method specific fields
     */
    togglePaymentMethodFields(method) {
        try {
            // Hide all method-specific sections
            const sections = ['upi-details', 'bank-details', 'cheque-details'];
            sections.forEach(id => {
                const section = document.getElementById(id);
                if (section) section.style.display = 'none';
            });
            
            // Show relevant section
            switch (method) {
                case 'upi':
                    const upiSection = document.getElementById('upi-details');
                    if (upiSection) upiSection.style.display = 'flex';
                    break;
                    
                case 'bank_transfer':
                case 'neft_rtgs':
                    const bankSection = document.getElementById('bank-details');
                    if (bankSection) bankSection.style.display = 'flex';
                    break;
                    
                case 'cheque':
                case 'demand_draft':
                    const chequeSection = document.getElementById('cheque-details');
                    if (chequeSection) chequeSection.style.display = 'flex';
                    break;
            }
            
        } catch (error) {
            console.error('[Payments] Field toggle failed:', error);
        }
    }
    
    /**
     * Handle invoice selection in payment form
     */
    onInvoiceSelect() {
        try {
            const select = document.getElementById('payment-invoice');
            if (!select || !select.value) return;
            
            const selectedOption = select.options[select.selectedIndex];
            const total = parseFloat(selectedOption.dataset.total) || 0;
            const paid = parseFloat(selectedOption.dataset.paid) || 0;
            const balance = total - paid;
            const client = selectedOption.dataset.client || '';
            
            // Update display fields
            const totalInput = document.getElementById('payment-invoice-total');
            const balanceInput = document.getElementById('payment-invoice-balance');
            const clientInput = document.getElementById('payment-client-name');
            const amountInput = document.getElementById('payment-amount');
            
            if (totalInput) totalInput.value = Formatters.currency(total);
            if (balanceInput) balanceInput.value = Formatters.currency(balance);
            if (clientInput) clientInput.value = client;
            
            // Set default payment amount to balance due
            if (amountInput && balance > 0) {
                amountInput.value = balance.toFixed(2);
                amountInput.max = balance;
            }
            
        } catch (error) {
            console.error('[Payments] Invoice select failed:', error);
        }
    }
    
    /**
     * Submit payment record
     */
    async submitPayment() {
        try {
            const form = document.getElementById('payment-form');
            if (!form) return;
            
            // Validate form
            if (!this.validatePaymentForm()) {
                return;
            }
            
            this.isProcessing = true;
            
            // Collect form data
            const formData = new FormData(form);
            const paymentData = {
                invoiceId: formData.get('invoiceId'),
                amount: parseFloat(formData.get('amount')),
                method: formData.get('method'),
                paymentDate: formData.get('paymentDate'),
                notes: formData.get('notes'),
                status: 'pending'
            };
            
            // Add method-specific fields
            switch (paymentData.method) {
                case 'upi':
                    paymentData.upiTransactionId = formData.get('upiTransactionId');
                    paymentData.upiApp = formData.get('upiApp');
                    break;
                    
                case 'bank_transfer':
                case 'neft_rtgs':
                    paymentData.bankAccountId = formData.get('bankAccountId');
                    paymentData.utr = formData.get('utr');
                    break;
                    
                case 'cheque':
                case 'demand_draft':
                    paymentData.chequeNumber = formData.get('chequeNumber');
                    paymentData.chequeDate = formData.get('chequeDate');
                    break;
            }
            
            // Save payment
            const response = await API.post(`${this.apiEndpoint}/record`, paymentData);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to record payment');
            }
            
            this.isProcessing = false;
            
            // Close modal
            Modal.close();
            
            // Refresh payments list
            await this.loadPayments();
            await this.render();
            
            // Calculate updated metrics
            this.calculateMetrics();
            
            Toast.show('Payment recorded successfully', 'success');
            
            // Emit event
            EventBus.emit('payment:recorded', response.data);
            
            // Send receipt if checked
            if (formData.get('sendReceipt')) {
                this.sendPaymentReceipt(response.data.id);
            }
            
        } catch (error) {
            console.error('[Payments] Submit failed:', error);
            this.isProcessing = false;
            Toast.show('Failed to record payment: ' + error.message, 'error');
        }
    }
    
    /**
     * Validate payment form
     */
    validatePaymentForm() {
        try {
            const invoiceId = document.getElementById('payment-invoice')?.value;
            const amount = parseFloat(document.getElementById('payment-amount')?.value);
            const method = document.getElementById('payment-method')?.value;
            const date = document.getElementById('payment-date')?.value;
            
            // Required fields
            if (!invoiceId) {
                Toast.show('Please select an invoice', 'warning');
                return false;
            }
            
            if (!amount || amount <= 0) {
                Toast.show('Please enter a valid amount', 'warning');
                return false;
            }
            
            if (!method) {
                Toast.show('Please select payment method', 'warning');
                return false;
            }
            
            if (!date) {
                Toast.show('Please select payment date', 'warning');
                return false;
            }
            
            // Cash payment limit check (₹2 lakh as per Indian IT Act)
            if (method === 'cash' && amount > 200000) {
                Toast.show('Cash payments cannot exceed ₹2,00,000 as per Income Tax rules', 'warning');
                return false;
            }
            
            // Validate method-specific fields
            switch (method) {
                case 'cheque':
                    const chequeNumber = document.getElementById('payment-cheque-number')?.value;
                    if (!chequeNumber) {
                        Toast.show('Please enter cheque number', 'warning');
                        return false;
                    }
                    break;
                    
                case 'bank_transfer':
                case 'neft_rtgs':
                    const utr = document.getElementById('payment-utr')?.value;
                    if (!utr) {
                        Toast.show('Please enter UTR/Reference number', 'warning');
                        return false;
                    }
                    break;
                    
                case 'upi':
                    const upiId = document.getElementById('payment-upi-id')?.value;
                    if (!upiId) {
                        Toast.show('Please enter UPI transaction ID', 'warning');
                        return false;
                    }
                    break;
            }
            
            return true;
            
        } catch (error) {
            console.error('[Payments] Validation failed:', error);
            return false;
        }
    }
    
    /**
     * Record payment (API call)
     */
    async recordPayment(paymentData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/record`, paymentData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Clear cache
            await Cache.delete(`${this.cachePrefix}list`);
            
            return response.data;
            
        } catch (error) {
            console.error('[Payments] Record failed:', error);
            throw error;
        }
    }
    
    /**
     * Reconcile payment
     */
    async reconcilePayment(paymentId) {
        try {
            const payment = this.payments.get(paymentId);
            if (!payment) throw new Error('Payment not found');
            
            const response = await API.post(`${this.apiEndpoint}/${paymentId}/reconcile`, {
                reconciledAt: new Date().toISOString(),
                reconciledBy: State.getCurrentUser()?.id
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Update local state
            payment.isReconciled = true;
            payment.reconciledAt = new Date().toISOString();
            this.payments.set(paymentId, payment);
            
            await this.render();
            
            Toast.show('Payment reconciled successfully', 'success');
            EventBus.emit('payment:reconciled', payment);
            
        } catch (error) {
            console.error('[Payments] Reconciliation failed:', error);
            Toast.show('Reconciliation failed', 'error');
        }
    }
    
    /**
     * Send payment reminder
     */
    async sendPaymentReminder(paymentId) {
        try {
            const payment = this.payments.get(paymentId);
            if (!payment) throw new Error('Payment not found');
            
            const response = await API.post(`${this.apiEndpoint}/${paymentId}/send-reminder`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Payment reminder sent successfully', 'success');
            
        } catch (error) {
            console.error('[Payments] Reminder failed:', error);
            Toast.show('Failed to send reminder', 'error');
        }
    }
    
    /**
     * Send payment receipt
     */
    async sendPaymentReceipt(paymentId) {
        try {
            await API.post(`${this.apiEndpoint}/${paymentId}/send-receipt`);
            console.log('[Payments] Receipt sent');
        } catch (error) {
            console.error('[Payments] Receipt send failed:', error);
        }
    }
    
    /**
     * Sync pending payments (offline support)
     */
    async syncPendingPayments() {
        try {
            const pendingPayments = await Cache.get('pending_payments');
            if (!pendingPayments || !pendingPayments.data || pendingPayments.data.length === 0) {
                console.log('[Payments] No pending payments to sync');
                return;
            }
            
            console.log(`[Payments] Syncing ${pendingPayments.data.length} pending payments...`);
            
            let synced = 0;
            for (const payment of pendingPayments.data) {
                try {
                    await this.recordPayment(payment);
                    synced++;
                } catch (error) {
                    console.error('[Payments] Sync failed for payment:', error);
                }
            }
            
            // Clear synced payments
            await Cache.delete('pending_payments');
            
            if (synced > 0) {
                Toast.show(`Synced ${synced} offline payments`, 'success');
            }
            
        } catch (error) {
            console.error('[Payments] Sync failed:', error);
        }
    }
    
    /**
     * Calculate payment age in days
     */
    calculateAge(dateString) {
        try {
            if (!dateString) return 0;
            
            const date = new Date(dateString);
            const today = new Date();
            const diffTime = Math.abs(today - date);
            
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Check if using default filters
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.method === 'all' &&
               this.filters.clientId === 'all' &&
               this.filters.invoiceId === 'all' &&
               !this.filters.search &&
               !this.filters.dateRange;
    }
    
    /**
     * Calculate performance metrics
     */
    calculateMetrics() {
        try {
            const stats = this.calculateSummaryStats();
            
            this.metrics.totalProcessed = stats.totalPayments;
            this.metrics.totalAmount = stats.totalCollected;
            this.metrics.successRate = stats.successRate;
            
            console.log('[Payments] Metrics updated:', this.metrics);
            
        } catch (error) {
            console.error('[Payments] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-receipt"></i>
                </div>
                <h3>No Payments Recorded</h3>
                <p>Start recording payments for your invoices</p>
                <button class="btn btn-primary" onclick="window.Global.Payments.openRecordPayment()">
                    <i class="fas fa-plus"></i> Record Payment
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
        
        // Previous
        html += `
            <button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                    onclick="window.Global.Payments.loadPayments(${this.pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Pages
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `
                    <button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                            onclick="window.Global.Payments.loadPayments(${i})">${i}</button>
                `;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        // Next
        html += `
            <button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                    onclick="window.Global.Payments.loadPayments(${this.pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Get today's date
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
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
     * Debounce utility
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
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        EventBus.off('payment:record');
        EventBus.off('payment:update');
        EventBus.off('payment:delete');
        EventBus.off('payment:refund');
        EventBus.off('payment:reconcile');
        
        console.log('[Payments] Module destroyed');
    }
}

// Singleton instance
const payments = new PaymentsModule();

// Exports
export { payments, PaymentsModule };
export default payments;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Payments = payments;
}

