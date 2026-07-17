/**
 * 11 AVATAR DIGITAL HUB - GST Invoice Module
 * Enterprise-grade GST-compliant invoicing system
 * Multi-tenant, multi-currency, recurring invoices, payment tracking
 * 
 * @module Invoices
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
 * GST Invoice Module - Complete invoice lifecycle management
 * Handles creation, GST calculation, payment tracking, recurring invoices
 */
class InvoicesModule {
    constructor() {
        // Module identity
        this.moduleName = 'invoices';
        this.apiEndpoint = '/api/invoices';
        this.cachePrefix = 'invoice_';
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
        
        // GST Configuration (India-specific)
        this.gstConfig = {
            enabled: true,
            rates: {
                '5%': 5,
                '12%': 12,
                '18%': 18,
                '28%': 28,
                '0%': 0,  // Nil rated
                'Exempt': 0
            },
            defaultRate: '18%',
            hsnSacCodes: new Map(),
            placeOfSupply: 'Maharashtra',
            reverseChargeApplicable: false
        };
        
        // Invoice state
        this.invoices = new Map();
        this.selectedInvoiceId = null;
        this.currentFilter = {
            status: 'all',        // all, draft, sent, paid, overdue, cancelled
            client: 'all',
            dateRange: null,
            search: '',
            minAmount: null,
            maxAmount: null
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
        };
        
        // Sort configuration
        this.sortConfig = {
            field: 'invoiceDate',
            order: 'desc'  // desc or asc
        };
        
        // UI State
        this.currentView = 'list'; // list, grid, detail, create
        this.isEditing = false;
        this.unsavedChanges = false;
        this.autoSaveInterval = null;
        
        // Invoice number sequence
        this.invoiceSequence = {
            prefix: 'INV',
            current: 0,
            format: 'INV-{YEAR}-{SEQ:04d}',
            financialYear: '2026-2027'
        };
        
        // Performance
        this.performance = {
            loadStart: 0,
            loadEnd: 0,
            operations: 0,
            lastCacheUpdate: null
        };
        
        // DOM cache
        this.elements = {
            container: null,
            invoiceList: null,
            invoiceGrid: null,
            invoiceDetail: null,
            filterBar: null,
            searchInput: null,
            paginationContainer: null,
            bulkActions: null,
            createButton: null,
            exportButton: null
        };
        
        // Initialize module
        this.init();
    }
    
    /**
     * Initialize invoice module
     */
    async init() {
        try {
            this.performance.loadStart = performance.now();
            
            console.log('[Invoices] Initializing GST invoice module...');
            
            // Verify permissions
            const hasAccess = await Permissions.check('invoices', 'read');
            if (!hasAccess) {
                Toast.show('Access denied: Insufficient permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load invoices
            await this.loadInvoices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup auto-save for drafts
            this.setupAutoSave();
            
            // Render initial view
            await this.render();
            
            // Calculate performance
            this.performance.loadEnd = performance.now();
            const loadTime = this.performance.loadEnd - this.performance.loadStart;
            
            console.log(`[Invoices] Initialized in ${loadTime.toFixed(2)}ms`);
            
            // Notify ready
            EventBus.emit('invoices:ready', {
                count: this.invoices.size,
                loadTime
            });
            
        } catch (error) {
            console.error('[Invoices] Initialization failed:', error);
            Toast.show('Failed to load invoice module', 'error');
        }
    }
    
    /**
     * Cache DOM element references
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#invoices-container',
                invoiceList: '#invoice-list',
                invoiceGrid: '#invoice-grid',
                invoiceDetail: '#invoice-detail',
                filterBar: '#invoice-filters',
                searchInput: '#invoice-search',
                paginationContainer: '#invoice-pagination',
                bulkActions: '#invoice-bulk-actions',
                createButton: '#invoice-create-btn',
                exportButton: '#invoice-export-btn'
            };
            
            // Cache all elements with error checking
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                } else {
                    console.warn(`[Invoices] Element not found: ${selector}`);
                }
            }
            
            console.log('[Invoices] DOM elements cached');
            
        } catch (error) {
            console.error('[Invoices] DOM cache failed:', error);
        }
    }
    
    /**
     * Load module configuration
     */
    async loadConfiguration() {
        try {
            // Try cache first
            const cached = await Cache.get(`${this.cachePrefix}config`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.gstConfig = { ...this.gstConfig, ...cached.data.gstConfig };
                this.invoiceSequence = { ...this.invoiceSequence, ...cached.data.sequence };
                return;
            }
            
            // Fetch from API
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                // Merge GST configuration
                if (response.data.gstConfig) {
                    this.gstConfig = { ...this.gstConfig, ...response.data.gstConfig };
                }
                
                // Merge invoice sequence
                if (response.data.sequence) {
                    this.invoiceSequence = { ...this.invoiceSequence, ...response.data.sequence };
                }
                
                // Cache configuration
                await Cache.set(`${this.cachePrefix}config`, {
                    gstConfig: this.gstConfig,
                    sequence: this.invoiceSequence
                }, this.cacheTimeout);
            }
            
            console.log('[Invoices] Configuration loaded');
            
        } catch (error) {
            console.error('[Invoices] Config load failed:', error);
            // Continue with defaults
        }
    }
    
    /**
     * Load invoices from API with pagination
     */
    async loadInvoices(page = 1) {
        try {
            this.pagination.page = page;
            
            // Build query parameters
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            // Add filters
            if (this.currentFilter.status !== 'all') {
                params.set('status', this.currentFilter.status);
            }
            if (this.currentFilter.client !== 'all') {
                params.set('client', this.currentFilter.client);
            }
            if (this.currentFilter.search) {
                params.set('search', this.currentFilter.search);
            }
            if (this.currentFilter.dateRange) {
                params.set('dateFrom', this.currentFilter.dateRange.from);
                params.set('dateTo', this.currentFilter.dateRange.to);
            }
            
            // Check cache for default filters first page
            const isDefaultFilters = this.currentFilter.status === 'all' && 
                                     this.currentFilter.client === 'all' && 
                                     !this.currentFilter.search;
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processInvoicesData(cached.data);
                    console.log('[Invoices] Loaded from cache');
                    return;
                }
            }
            
            // API call
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load invoices');
            }
            
            // Process data
            this.processInvoicesData(response.data);
            
            // Cache if default filters
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Invoices] Loaded ${this.invoices.size} invoices`);
            
        } catch (error) {
            console.error('[Invoices] Load failed:', error);
            Toast.show('Failed to load invoices', 'error');
        }
    }
    
    /**
     * Process and format invoice data
     */
    processInvoicesData(data) {
        try {
            this.invoices.clear();
            
            if (data.invoices && Array.isArray(data.invoices)) {
                data.invoices.forEach(invoice => {
                    // Calculate derived fields
                    const processed = {
                        ...invoice,
                        // Format dates
                        formattedDate: Formatters.date(invoice.invoiceDate),
                        formattedDueDate: Formatters.date(invoice.dueDate),
                        
                        // Format amounts
                        formattedSubtotal: Formatters.currency(invoice.subtotal),
                        formattedTax: Formatters.currency(invoice.totalTax),
                        formattedTotal: Formatters.currency(invoice.total),
                        formattedPaid: Formatters.currency(invoice.paidAmount || 0),
                        formattedBalance: Formatters.currency(invoice.balance || 0),
                        
                        // Status indicators
                        isOverdue: this.isInvoiceOverdue(invoice),
                        daysOverdue: this.getDaysOverdue(invoice),
                        paymentProgress: this.calculatePaymentProgress(invoice),
                        
                        // GST details formatted
                        gstBreakup: this.formatGSTBreakup(invoice.gstDetails),
                        
                        // Client info
                        clientName: invoice.client?.name || 'Unknown Client',
                        clientGST: invoice.client?.gstin || 'N/A',
                        
                        // Quick actions
                        canEdit: invoice.status === 'draft' || invoice.status === 'sent',
                        canDelete: invoice.status === 'draft',
                        canSend: invoice.status === 'draft',
                        canMarkPaid: invoice.status === 'sent' || invoice.status === 'partial',
                        canCancel: invoice.status !== 'paid' && invoice.status !== 'cancelled'
                    };
                    
                    this.invoices.set(invoice.id, processed);
                });
            }
            
            // Update pagination
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
            this.performance.operations++;
            
        } catch (error) {
            console.error('[Invoices] Data processing failed:', error);
        }
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        try {
            // Search with debounce
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', 
                    this.debounce(this.handleSearch.bind(this), 400)
                );
            }
            
            // Filter changes
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (event) => {
                    if (event.target.dataset.filter) {
                        this.handleFilterChange(event.target.dataset.filter, event.target.value);
                    }
                });
            }
            
            // Create button
            if (this.elements.createButton) {
                this.elements.createButton.addEventListener('click', () => {
                    this.openCreateInvoice();
                });
            }
            
            // Export button
            if (this.elements.exportButton) {
                this.elements.exportButton.addEventListener('click', () => {
                    this.showExportOptions();
                });
            }
            
            // Event bus subscriptions
            EventBus.on('invoice:create', this.createInvoice.bind(this));
            EventBus.on('invoice:update', this.updateInvoice.bind(this));
            EventBus.on('invoice:delete', this.deleteInvoice.bind(this));
            EventBus.on('invoice:send', this.sendInvoice.bind(this));
            EventBus.on('invoice:mark-paid', this.markAsPaid.bind(this));
            EventBus.on('invoice:cancel', this.cancelInvoice.bind(this));
            EventBus.on('invoice:duplicate', this.duplicateInvoice.bind(this));
            
            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
            
            // Window events
            window.addEventListener('beforeunload', (e) => {
                if (this.unsavedChanges) {
                    e.preventDefault();
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                }
            });
            
            console.log('[Invoices] Event listeners initialized');
            
        } catch (error) {
            console.error('[Invoices] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up auto-save for draft invoices
     */
    setupAutoSave() {
        try {
            // Clear existing interval
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
            }
            
            // Auto-save every 30 seconds if there are unsaved changes
            this.autoSaveInterval = setInterval(() => {
                if (this.unsavedChanges && this.selectedInvoiceId) {
                    this.autoSaveDraft();
                }
            }, 30000);
            
            console.log('[Invoices] Auto-save configured (30s interval)');
            
        } catch (error) {
            console.error('[Invoices] Auto-save setup failed:', error);
        }
    }
    
    /**
     * Auto-save draft invoice
     */
    async autoSaveDraft() {
        try {
            const draftData = this.getCurrentFormData();
            if (!draftData) return;
            
            await API.put(`${this.apiEndpoint}/draft/${this.selectedInvoiceId}`, draftData);
            
            this.unsavedChanges = false;
            console.log('[Invoices] Draft auto-saved');
            
        } catch (error) {
            console.error('[Invoices] Auto-save failed:', error);
        }
    }
    
    /**
     * Render main invoice view
     */
    async render() {
        try {
            if (!this.elements.container) {
                console.error('[Invoices] Container not found');
                return;
            }
            
            switch (this.currentView) {
                case 'list':
                    await this.renderListView();
                    break;
                case 'grid':
                    await this.renderGridView();
                    break;
                case 'detail':
                    await this.renderDetailView();
                    break;
                case 'create':
                    await this.renderCreateForm();
                    break;
                default:
                    await this.renderListView();
            }
            
        } catch (error) {
            console.error('[Invoices] Render failed:', error);
        }
    }
    
    /**
     * Render list view with invoices table
     */
    async renderListView() {
        try {
            if (!this.elements.invoiceList) return;
            
            let html = `
                <div class="invoice-list-container">
                    <!-- Bulk Actions Bar -->
                    <div class="bulk-actions-bar" id="invoice-bulk-actions" style="display: none;">
                        <span class="selected-count">0 selected</span>
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Invoices.bulkAction('send')">
                            <i class="fas fa-paper-plane"></i> Send
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Invoices.bulkAction('export')">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.Global.Invoices.bulkAction('delete')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    
                    <!-- Invoice Table -->
                    <div class="table-responsive">
                        <table class="invoice-table" role="grid" aria-label="Invoices list">
                            <thead>
                                <tr>
                                    <th scope="col" class="col-checkbox">
                                        <input type="checkbox" id="select-all" aria-label="Select all invoices">
                                    </th>
                                    <th scope="col" class="col-invoice sortable" data-sort="invoiceNumber">
                                        Invoice # <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-client sortable" data-sort="client">
                                        Client <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-date sortable" data-sort="invoiceDate">
                                        Date <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-duedate sortable" data-sort="dueDate">
                                        Due Date <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-amount sortable" data-sort="total">
                                        Amount <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-status sortable" data-sort="status">
                                        Status <i class="fas fa-sort"></i>
                                    </th>
                                    <th scope="col" class="col-actions">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="invoice-table-body">
                                ${this.renderInvoiceRows()}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Empty State -->
                    ${this.invoices.size === 0 ? this.renderEmptyState() : ''}
                    
                    <!-- Pagination -->
                    ${this.renderPagination()}
                </div>
            `;
            
            this.elements.invoiceList.innerHTML = html;
            
            // Setup sort handlers
            this.setupSortHandlers();
            
            // Setup select all
            this.setupSelectAll();
            
            console.log('[Invoices] List view rendered');
            
        } catch (error) {
            console.error('[Invoices] List render failed:', error);
        }
    }
    
    /**
     * Render invoice table rows
     */
    renderInvoiceRows() {
        try {
            if (this.invoices.size === 0) return '';
            
            let rows = '';
            
            this.invoices.forEach((invoice) => {
                const statusClass = this.getStatusClass(invoice.status);
                const overdueClass = invoice.isOverdue ? 'overdue' : '';
                
                rows += `
                    <tr class="invoice-row ${overdueClass}" data-invoice-id="${invoice.id}">
                        <td class="col-checkbox">
                            <input type="checkbox" class="invoice-select" 
                                   data-id="${invoice.id}" 
                                   aria-label="Select invoice ${invoice.invoiceNumber}">
                        </td>
                        <td class="col-invoice">
                            <div class="invoice-number-display">
                                <span class="invoice-number">${this.escapeHtml(invoice.invoiceNumber)}</span>
                                ${invoice.reference ? `
                                    <small class="invoice-ref">Ref: ${this.escapeHtml(invoice.reference)}</small>
                                ` : ''}
                            </div>
                        </td>
                        <td class="col-client">
                            <div class="client-info">
                                <span class="client-name">${this.escapeHtml(invoice.clientName)}</span>
                                ${invoice.clientGST !== 'N/A' ? `
                                    <small class="client-gst">GST: ${this.escapeHtml(invoice.clientGST)}</small>
                                ` : ''}
                            </div>
                        </td>
                        <td class="col-date" data-sort-value="${invoice.invoiceDate}">
                            ${invoice.formattedDate}
                        </td>
                        <td class="col-duedate ${overdueClass}" data-sort-value="${invoice.dueDate}">
                            ${invoice.formattedDueDate}
                            ${invoice.isOverdue ? `
                                <span class="overdue-badge">${invoice.daysOverdue}d overdue</span>
                            ` : ''}
                        </td>
                        <td class="col-amount" data-sort-value="${invoice.total}">
                            <div class="amount-display">
                                <strong>${invoice.formattedTotal}</strong>
                                ${invoice.paidAmount > 0 ? `
                                    <div class="payment-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${invoice.paymentProgress}%"></div>
                                        </div>
                                        <small>${invoice.formattedPaid} paid</small>
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td class="col-status">
                            <span class="status-badge ${statusClass}">
                                ${invoice.status.toUpperCase()}
                            </span>
                        </td>
                        <td class="col-actions">
                            <div class="action-buttons">
                                <button class="btn-icon view-invoice" title="View" 
                                        onclick="window.Global.Invoices.viewInvoice('${invoice.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${invoice.canEdit ? `
                                    <button class="btn-icon edit-invoice" title="Edit" 
                                            onclick="window.Global.Invoices.editInvoice('${invoice.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                ` : ''}
                                ${invoice.canSend ? `
                                    <button class="btn-icon send-invoice" title="Send" 
                                            onclick="window.Global.Invoices.sendInvoice('${invoice.id}')">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-icon more-actions" title="More" 
                                        onclick="window.Global.Invoices.showContextMenu(event, '${invoice.id}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            return rows;
            
        } catch (error) {
            console.error('[Invoices] Row render failed:', error);
            return '<tr><td colspan="8" class="error-cell">Failed to load invoices</td></tr>';
        }
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-file-invoice"></i>
                </div>
                <h3>No Invoices Found</h3>
                <p>Create your first invoice to get started</p>
                <button class="btn btn-primary" onclick="window.Global.Invoices.openCreateInvoice()">
                    <i class="fas fa-plus"></i> Create Invoice
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
        
        // Previous button
        html += `
            <button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''} 
                    onclick="window.Global.Invoices.loadInvoices(${this.pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `
                    <button class="page-btn ${i === this.pagination.page ? 'active' : ''}" 
                            onclick="window.Global.Invoices.loadInvoices(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        // Next button
        html += `
            <button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''} 
                    onclick="window.Global.Invoices.loadInvoices(${this.pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        // Page info
        html += `
            <span class="page-info">
                Page ${this.pagination.page} of ${this.pagination.totalPages} 
                (${this.pagination.total} invoices)
            </span>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Render create/edit invoice form
     */
    async renderCreateForm(invoiceData = null) {
        try {
            const isEditing = !!invoiceData;
            this.isEditing = isEditing;
            
            if (isEditing) {
                this.selectedInvoiceId = invoiceData.id;
            }
            
            const title = isEditing ? `Edit Invoice #${invoiceData.invoiceNumber}` : 'Create New Invoice';
            
            const formHtml = `
                <div class="invoice-form-container">
                    <div class="form-header">
                        <h2>${title}</h2>
                        <div class="form-actions-top">
                            ${isEditing ? `
                                <button class="btn btn-outline" onclick="window.Global.Invoices.duplicateInvoice('${invoiceData.id}')">
                                    <i class="fas fa-copy"></i> Duplicate
                                </button>
                            ` : ''}
                            <button class="btn btn-outline" onclick="window.Global.Invoices.saveAsDraft()">
                                <i class="fas fa-save"></i> Save Draft
                            </button>
                            <button class="btn btn-secondary" onclick="window.Global.Invoices.previewInvoice()">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                        </div>
                    </div>
                    
                    <form id="invoice-form" class="invoice-form">
                        <!-- Client Selection -->
                        <div class="form-section">
                            <h3 class="section-title">
                                <i class="fas fa-user"></i> Client Information
                            </h3>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="invoice-client">Client *</label>
                                    <select id="invoice-client" name="clientId" required>
                                        <option value="">Select Client...</option>
                                        ${await this.renderClientOptions(invoiceData?.clientId)}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="invoice-gstin">GSTIN</label>
                                    <input type="text" id="invoice-gstin" name="clientGST" 
                                           value="${invoiceData?.client?.gstin || ''}" 
                                           placeholder="Auto-filled" readonly>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Invoice Details -->
                        <div class="form-section">
                            <h3 class="section-title">
                                <i class="fas fa-file-invoice"></i> Invoice Details
                            </h3>
                            <div class="form-row">
                                <div class="form-group col-3">
                                    <label for="invoice-number">Invoice # *</label>
                                    <input type="text" id="invoice-number" name="invoiceNumber" 
                                           value="${invoiceData?.invoiceNumber || await this.generateInvoiceNumber()}" 
                                           required readonly>
                                </div>
                                <div class="form-group col-3">
                                    <label for="invoice-date">Invoice Date *</label>
                                    <input type="date" id="invoice-date" name="invoiceDate" 
                                           value="${invoiceData?.invoiceDate || this.getTodayDate()}" required>
                                </div>
                                <div class="form-group col-3">
                                    <label for="invoice-due">Due Date *</label>
                                    <input type="date" id="invoice-due" name="dueDate" 
                                           value="${invoiceData?.dueDate || this.getDefaultDueDate()}" required>
                                </div>
                                <div class="form-group col-3">
                                    <label for="invoice-reference">Reference #</label>
                                    <input type="text" id="invoice-reference" name="reference" 
                                           value="${invoiceData?.reference || ''}" 
                                           placeholder="PO/Reference number">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Line Items -->
                        <div class="form-section">
                            <h3 class="section-title">
                                <i class="fas fa-list"></i> Line Items
                            </h3>
                            <div class="line-items-container">
                                <table class="line-items-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%">#</th>
                                            <th style="width: 30%">Description</th>
                                            <th style="width: 12%">HSN/SAC</th>
                                            <th style="width: 10%">Qty</th>
                                            <th style="width: 10%">Rate (₹)</th>
                                            <th style="width: 10%">GST %</th>
                                            <th style="width: 13%">Amount</th>
                                            <th style="width: 10%">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="line-items-body">
                                        ${this.renderLineItems(invoiceData?.items)}
                                    </tbody>
                                </table>
                                <button type="button" class="btn btn-sm btn-outline add-line-item" 
                                        onclick="window.Global.Invoices.addLineItem()">
                                    <i class="fas fa-plus"></i> Add Line Item
                                </button>
                            </div>
                        </div>
                        
                        <!-- GST Summary -->
                        <div class="form-section">
                            <h3 class="section-title">
                                <i class="fas fa-calculator"></i> Tax Summary
                            </h3>
                            <div class="tax-summary">
                                <div class="summary-row">
                                    <span>Subtotal</span>
                                    <span id="summary-subtotal">₹0.00</span>
                                </div>
                                <div class="summary-row" id="cgst-row">
                                    <span>CGST</span>
                                    <span id="summary-cgst">₹0.00</span>
                                </div>
                                <div class="summary-row" id="sgst-row">
                                    <span>SGST</span>
                                    <span id="summary-sgst">₹0.00</span>
                                </div>
                                <div class="summary-row" id="igst-row">
                                    <span>IGST</span>
                                    <span id="summary-igst">₹0.00</span>
                                </div>
                                <div class="summary-row total-row">
                                    <strong>Total</strong>
                                    <strong id="summary-total">₹0.00</strong>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Notes & Terms -->
                        <div class="form-section">
                            <h3 class="section-title">
                                <i class="fas fa-sticky-note"></i> Notes & Terms
                            </h3>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="invoice-notes">Notes</label>
                                    <textarea id="invoice-notes" name="notes" rows="3" 
                                              placeholder="Additional notes...">${invoiceData?.notes || ''}</textarea>
                                </div>
                                <div class="form-group col-6">
                                    <label for="invoice-terms">Terms & Conditions</label>
                                    <textarea id="invoice-terms" name="terms" rows="3" 
                                              placeholder="Payment terms...">${invoiceData?.terms || 'Payment due within 30 days'}</textarea>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions-bottom">
                            <button type="button" class="btn btn-secondary" 
                                    onclick="window.Global.Invoices.cancelEdit()">
                                Cancel
                            </button>
                            <button type="button" class="btn btn-outline" 
                                    onclick="window.Global.Invoices.saveAsDraft()">
                                Save as Draft
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${isEditing ? 'Update Invoice' : 'Create Invoice'}
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            // Render in container
            if (this.elements.container) {
                this.elements.container.innerHTML = formHtml;
            }
            
            // Initialize form handlers
            setTimeout(() => {
                this.setupFormHandlers();
            }, 100);
            
            console.log('[Invoices] Create form rendered');
            
        } catch (error) {
            console.error('[Invoices] Form render failed:', error);
            Toast.show('Failed to load invoice form', 'error');
        }
    }
    
    /**
     * Render line items in form
     */
    renderLineItems(items = []) {
        try {
            if (!items || items.length === 0) {
                // Default empty line item
                return this.renderSingleLineItem(1);
            }
            
            return items.map((item, index) => 
                this.renderSingleLineItem(index + 1, item)
            ).join('');
            
        } catch (error) {
            console.error('[Invoices] Line items render failed:', error);
            return '';
        }
    }
    
    /**
     * Render single line item row
     */
    renderSingleLineItem(index, item = {}) {
        return `
            <tr class="line-item-row" data-index="${index}">
                <td class="item-number">${index}</td>
                <td>
                    <input type="text" class="item-description" name="items[${index}][description]" 
                           value="${this.escapeHtml(item.description || '')}" 
                           placeholder="Item description" required>
                </td>
                <td>
                    <input type="text" class="item-hsn" name="items[${index}][hsnSac]" 
                           value="${item.hsnSac || ''}" placeholder="HSN/SAC">
                </td>
                <td>
                    <input type="number" class="item-qty" name="items[${index}][quantity]" 
                           value="${item.quantity || 1}" min="1" step="1" required>
                </td>
                <td>
                    <input type="number" class="item-rate" name="items[${index}][rate]" 
                           value="${item.rate || ''}" min="0" step="0.01" placeholder="0.00" required>
                </td>
                <td>
                    <select class="item-gst" name="items[${index}][gstRate]">
                        ${this.renderGSTRateOptions(item.gstRate || this.gstConfig.defaultRate)}
                    </select>
                </td>
                <td class="item-amount">
                    <span class="calculated-amount">₹0.00</span>
                </td>
                <td>
                    <button type="button" class="btn-icon remove-line-item" 
                            onclick="window.Global.Invoices.removeLineItem(${index})"
                            title="Remove item">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    /**
     * Render GST rate options
     */
    renderGSTRateOptions(selectedRate = '18%') {
        return Object.entries(this.gstConfig.rates)
            .map(([label, rate]) => `
                <option value="${label}" ${label === selectedRate ? 'selected' : ''}>
                    ${label}${rate > 0 ? ` (${rate}%)` : ''}
                </option>
            `)
            .join('');
    }
    
    /**
     * Render client options for select
     */
    async renderClientOptions(selectedClientId = null) {
        try {
            // Fetch clients list
            const response = await API.get('/api/clients/list');
            if (!response.success || !response.data) {
                return '<option value="">No clients available</option>';
            }
            
            return response.data.map(client => `
                <option value="${client.id}" 
                        ${client.id === selectedClientId ? 'selected' : ''}
                        data-gstin="${client.gstin || ''}">
                    ${this.escapeHtml(client.name)} ${client.company ? `- ${this.escapeHtml(client.company)}` : ''}
                </option>
            `).join('');
            
        } catch (error) {
            console.error('[Invoices] Client options load failed:', error);
            return '<option value="">Failed to load clients</option>';
        }
    }
    
    /**
     * Set up form handlers and calculations
     */
    setupFormHandlers() {
        try {
            const form = document.getElementById('invoice-form');
            if (!form) return;
            
            // Form submission
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitInvoice();
            });
            
            // Client change - auto-fill GSTIN
            const clientSelect = document.getElementById('invoice-client');
            if (clientSelect) {
                clientSelect.addEventListener('change', (e) => {
                    const selected = e.target.options[e.target.selectedIndex];
                    const gstinInput = document.getElementById('invoice-gstin');
                    if (gstinInput && selected) {
                        gstinInput.value = selected.dataset.gstin || '';
                    }
                });
            }
            
            // Line item calculations (event delegation)
            const lineItemsBody = document.getElementById('line-items-body');
            if (lineItemsBody) {
                lineItemsBody.addEventListener('input', (e) => {
                    if (e.target.matches('.item-qty, .item-rate, .item-gst')) {
                        this.calculateLineItem(e.target.closest('.line-item-row'));
                        this.calculateTotals();
                    }
                });
            }
            
            // Mark as having unsaved changes
            form.addEventListener('change', () => {
                this.unsavedChanges = true;
            });
            
            console.log('[Invoices] Form handlers set up');
            
        } catch (error) {
            console.error('[Invoices] Form handler setup failed:', error);
        }
    }
    
    /**
     * Calculate single line item amount
     */
    calculateLineItem(row) {
        try {
            const qtyInput = row.querySelector('.item-qty');
            const rateInput = row.querySelector('.item-rate');
            const amountSpan = row.querySelector('.calculated-amount');
            
            if (!qtyInput || !rateInput || !amountSpan) return;
            
            const qty = parseFloat(qtyInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            const amount = qty * rate;
            
            amountSpan.textContent = Formatters.currency(amount);
            
        } catch (error) {
            console.error('[Invoices] Line item calculation failed:', error);
        }
    }
    
    /**
     * Calculate invoice totals including GST
     */
    calculateTotals() {
        try {
            const rows = document.querySelectorAll('.line-item-row');
            let subtotal = 0;
            let totalCGST = 0;
            let totalSGST = 0;
            let totalIGST = 0;
            
            rows.forEach(row => {
                const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
                const rate = parseFloat(row.querySelector('.item-rate')?.value) || 0;
                const gstSelect = row.querySelector('.item-gst');
                const gstRate = gstSelect ? parseFloat(gstSelect.value) || 0 : 0;
                
                const amount = qty * rate;
                subtotal += amount;
                
                // GST calculation (split CGST + SGST for intra-state, IGST for inter-state)
                const isInterState = this.checkInterState();
                
                if (isInterState) {
                    totalIGST += amount * (gstRate / 100);
                } else {
                    const halfGST = amount * (gstRate / 100) / 2;
                    totalCGST += halfGST;
                    totalSGST += halfGST;
                }
            });
            
            // Update summary
            const totalGST = totalCGST + totalSGST + totalIGST;
            const grandTotal = subtotal + totalGST;
            
            document.getElementById('summary-subtotal').textContent = Formatters.currency(subtotal);
            document.getElementById('summary-cgst').textContent = Formatters.currency(totalCGST);
            document.getElementById('summary-sgst').textContent = Formatters.currency(totalSGST);
            document.getElementById('summary-igst').textContent = Formatters.currency(totalIGST);
            document.getElementById('summary-total').textContent = Formatters.currency(grandTotal);
            
            // Show/hide GST rows based on inter/intra state
            const isInterState = this.checkInterState();
            document.getElementById('cgst-row').style.display = isInterState ? 'none' : 'flex';
            document.getElementById('sgst-row').style.display = isInterState ? 'none' : 'flex';
            document.getElementById('igst-row').style.display = isInterState ? 'flex' : 'none';
            
        } catch (error) {
            console.error('[Invoices] Total calculation failed:', error);
        }
    }
    
    /**
     * Check if invoice is inter-state (IGST applicable)
     */
    checkInterState() {
        try {
            // Get client state from GSTIN
            const gstinInput = document.getElementById('invoice-gstin');
            if (!gstinInput || !gstinInput.value) {
                // If no GSTIN, check client address or default to intra-state
                return false;
            }
            
            const gstin = gstinInput.value.trim();
            if (gstin.length < 2) return false;
            
            // First two digits of GSTIN represent state code
            const clientStateCode = gstin.substring(0, 2);
            
            // Maharashtra state code is 27 (default place of supply)
            const ourStateCode = '27';
            
            return clientStateCode !== ourStateCode;
            
        } catch (error) {
            console.error('[Invoices] Inter-state check failed:', error);
            return false;
        }
    }
    
    /**
     * Generate next invoice number
     */
    async generateInvoiceNumber() {
        try {
            const response = await API.get(`${this.apiEndpoint}/next-number`);
            
            if (response.success && response.data) {
                this.invoiceSequence.current = response.data.nextNumber;
            } else {
                this.invoiceSequence.current++;
            }
            
            // Format: INV-2026-0001
            const year = new Date().getFullYear();
            const seq = String(this.invoiceSequence.current).padStart(4, '0');
            
            return this.invoiceSequence.format
                .replace('{YEAR}', year)
                .replace('{SEQ:04d}', seq);
                
        } catch (error) {
            console.error('[Invoices] Number generation failed:', error);
            // Fallback: timestamp-based
            return `INV-${Date.now().toString(36).toUpperCase()}`;
        }
    }
    
    /**
     * Submit invoice (create or update)
     */
    async submitInvoice() {
        try {
            const form = document.getElementById('invoice-form');
            if (!form) return;
            
            // Validate form
            if (!this.validateInvoiceForm()) {
                return;
            }
            
            // Collect form data
            const invoiceData = this.collectInvoiceData();
            
            // Determine create or update
            let response;
            if (this.isEditing && this.selectedInvoiceId) {
                response = await API.put(
                    `${this.apiEndpoint}/${this.selectedInvoiceId}`, 
                    invoiceData
                );
            } else {
                response = await API.post(`${this.apiEndpoint}/create`, invoiceData);
            }
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to save invoice');
            }
            
            this.unsavedChanges = false;
            
            Toast.show(
                this.isEditing ? 'Invoice updated successfully' : 'Invoice created successfully',
                'success'
            );
            
            // Return to list view
            this.currentView = 'list';
            await this.loadInvoices();
            await this.render();
            
            EventBus.emit('invoice:saved', response.data);
            
        } catch (error) {
            console.error('[Invoices] Submit failed:', error);
            Toast.show('Failed to save invoice: ' + error.message, 'error');
        }
    }
    
    /**
     * Validate invoice form
     */
    validateInvoiceForm() {
        try {
            const form = document.getElementById('invoice-form');
            if (!form) return false;
            
            // Check required fields
            const requiredFields = [
                { id: 'invoice-client', name: 'Client' },
                { id: 'invoice-date', name: 'Invoice Date' },
                { id: 'invoice-due', name: 'Due Date' }
            ];
            
            for (const field of requiredFields) {
                const element = document.getElementById(field.id);
                if (!element || !element.value) {
                    Toast.show(`${field.name} is required`, 'warning');
                    element?.focus();
                    return false;
                }
            }
            
            // Validate line items
            const rows = document.querySelectorAll('.line-item-row');
            if (rows.length === 0) {
                Toast.show('At least one line item is required', 'warning');
                return false;
            }
            
            let hasValidItem = false;
            rows.forEach(row => {
                const desc = row.querySelector('.item-description')?.value;
                const qty = parseFloat(row.querySelector('.item-qty')?.value);
                const rate = parseFloat(row.querySelector('.item-rate')?.value);
                
                if (desc && qty > 0 && rate >= 0) {
                    hasValidItem = true;
                }
            });
            
            if (!hasValidItem) {
                Toast.show('At least one valid line item is required', 'warning');
                return false;
            }
            
            // Validate due date is after invoice date
            const invoiceDate = new Date(document.getElementById('invoice-date').value);
            const dueDate = new Date(document.getElementById('invoice-due').value);
            
            if (dueDate <= invoiceDate) {
                Toast.show('Due date must be after invoice date', 'warning');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('[Invoices] Validation failed:', error);
            return false;
        }
    }
    
    /**
     * Collect invoice data from form
     */
    collectInvoiceData() {
        try {
            const form = document.getElementById('invoice-form');
            const formData = new FormData(form);
            
            // Basic fields
            const invoiceData = {
                clientId: formData.get('clientId'),
                invoiceNumber: formData.get('invoiceNumber'),
                invoiceDate: formData.get('invoiceDate'),
                dueDate: formData.get('dueDate'),
                reference: formData.get('reference'),
                notes: formData.get('notes'),
                terms: formData.get('terms'),
                status: 'draft'
            };
            
            // Collect line items
            const items = [];
            const rows = document.querySelectorAll('.line-item-row');
            
            rows.forEach((row, index) => {
                const description = row.querySelector('.item-description')?.value;
                const hsnSac = row.querySelector('.item-hsn')?.value;
                const quantity = parseFloat(row.querySelector('.item-qty')?.value) || 0;
                const rate = parseFloat(row.querySelector('.item-rate')?.value) || 0;
                const gstRate = row.querySelector('.item-gst')?.value;
                
                if (description && quantity > 0) {
                    const amount = quantity * rate;
                    const gstPercent = parseFloat(gstRate) || 0;
                    
                    items.push({
                        srNo: index + 1,
                        description,
                        hsnSac,
                        quantity,
                        rate,
                        amount,
                        gstRate: gstRate,
                        gstAmount: amount * (gstPercent / 100),
                        total: amount + (amount * (gstPercent / 100))
                    });
                }
            });
            
            invoiceData.items = items;
            
            // Calculate totals
            invoiceData.subtotal = items.reduce((sum, item) => sum + item.amount, 0);
            invoiceData.totalTax = items.reduce((sum, item) => sum + item.gstAmount, 0);
            invoiceData.total = invoiceData.subtotal + invoiceData.totalTax;
            
            // GST details
            invoiceData.gstDetails = {
                cgst: 0,
                sgst: 0,
                igst: 0,
                isInterState: this.checkInterState()
            };
            
            return invoiceData;
            
        } catch (error) {
            console.error('[Invoices] Data collection failed:', error);
            return null;
        }
    }
    
    /**
     * Create invoice via API
     */
    async createInvoice(invoiceData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/create`, invoiceData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            await this.loadInvoices();
            await this.render();
            
            return response.data;
            
        } catch (error) {
            console.error('[Invoices] Create failed:', error);
            throw error;
        }
    }
    
    /**
     * Send invoice to client
     */
    async sendInvoice(invoiceId) {
        try {
            const invoice = this.invoices.get(invoiceId);
            if (!invoice) throw new Error('Invoice not found');
            
            // Confirm sending
            const confirmed = await this.confirmDialog(
                'Send Invoice',
                `Send invoice #${invoice.invoiceNumber} to ${invoice.clientName}?`
            );
            
            if (!confirmed) return;
            
            const response = await API.post(`${this.apiEndpoint}/${invoiceId}/send`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Update status locally
            invoice.status = 'sent';
            this.invoices.set(invoiceId, invoice);
            
            await this.render();
            
            Toast.show('Invoice sent successfully', 'success');
            EventBus.emit('invoice:sent', invoice);
            
        } catch (error) {
            console.error('[Invoices] Send failed:', error);
            Toast.show('Failed to send invoice', 'error');
        }
    }
    
    /**
     * Mark invoice as paid
     */
    async markAsPaid(invoiceId) {
        try {
            // Open payment collection modal
            const modal = new Modal({
                title: 'Record Payment',
                content: `
                    <div class="payment-form">
                        <div class="form-group">
                            <label>Invoice #</label>
                            <input type="text" value="${this.invoices.get(invoiceId)?.invoiceNumber}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Total Amount</label>
                            <input type="text" value="${this.invoices.get(invoiceId)?.formattedTotal}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Payment Amount *</label>
                            <input type="number" id="payment-amount" min="0.01" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>Payment Date *</label>
                            <input type="date" id="payment-date" required>
                        </div>
                        <div class="form-group">
                            <label>Payment Method</label>
                            <select id="payment-method">
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="upi">UPI</option>
                                <option value="cheque">Cheque</option>
                                <option value="cash">Cash</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                            <button class="btn btn-primary" id="confirm-payment">Record Payment</button>
                        </div>
                    </div>
                `,
                size: 'medium'
            });
            
            modal.open();
            
        } catch (error) {
            console.error('[Invoices] Mark paid failed:', error);
            Toast.show('Failed to process payment', 'error');
        }
    }
    
    /**
     * Get status CSS class
     */
    getStatusClass(status) {
        const classes = {
            'draft': 'status-draft',
            'sent': 'status-sent',
            'partial': 'status-partial',
            'paid': 'status-paid',
            'overdue': 'status-overdue',
            'cancelled': 'status-cancelled'
        };
        return classes[status] || 'status-default';
    }
    
    /**
     * Check if invoice is overdue
     */
    isInvoiceOverdue(invoice) {
        if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
        if (!invoice.dueDate) return false;
        
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        
        return dueDate < today;
    }
    
    /**
     * Get days overdue
     */
    getDaysOverdue(invoice) {
        if (!invoice.dueDate) return 0;
        
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const diffTime = today - dueDate;
        
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }
    
    /**
     * Calculate payment progress percentage
     */
    calculatePaymentProgress(invoice) {
        if (!invoice.total || invoice.total === 0) return 0;
        return Math.min(100, ((invoice.paidAmount || 0) / invoice.total) * 100);
    }
    
    /**
     * Format GST breakup for display
     */
    formatGSTBreakup(gstDetails) {
        if (!gstDetails) return null;
        
        return {
            cgst: Formatters.currency(gstDetails.cgst || 0),
            sgst: Formatters.currency(gstDetails.sgst || 0),
            igst: Formatters.currency(gstDetails.igst || 0),
            total: Formatters.currency(
                (gstDetails.cgst || 0) + (gstDetails.sgst || 0) + (gstDetails.igst || 0)
            )
        };
    }
    
    /**
     * Get today's date in YYYY-MM-DD format
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    /**
     * Get default due date (30 days from today)
     */
    getDefaultDueDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
    }
    
    /**
     * Escape HTML entities
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
     * Confirm dialog helper
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
     * Clean up module
     */
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        EventBus.off('invoice:create');
        EventBus.off('invoice:update');
        EventBus.off('invoice:delete');
        
        this.invoices.clear();
        console.log('[Invoices] Module destroyed');
    }
}

// Create singleton
const invoices = new InvoicesModule();

// Export
export { invoices, InvoicesModule };
export default invoices;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Invoices = invoices;
}

