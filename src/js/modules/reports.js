/**
 * 11 AVATAR DIGITAL HUB - Reports & Analytics Module
 * Enterprise-grade reporting, analytics & business intelligence
 * Custom dashboards, exportable reports, charts, KPIs, scheduled reports
 * 
 * @module Reports
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
 * Reports Module - Complete business intelligence & analytics
 * Handles dashboards, reports, KPIs, charts, exports, scheduled delivery
 */
class ReportsModule {
    constructor() {
        // Module identity
        this.moduleName = 'reports';
        this.apiEndpoint = '/api/reports';
        this.cachePrefix = 'report_';
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
        
        // Report categories
        this.reportCategories = {
            'sales': { label: 'Sales & Revenue', icon: 'fa-chart-line', color: '#3B82F6' },
            'marketing': { label: 'Marketing', icon: 'fa-bullhorn', color: '#EC4899' },
            'financial': { label: 'Financial', icon: 'fa-rupee-sign', color: '#10B981' },
            'client': { label: 'Client Analytics', icon: 'fa-users', color: '#8B5CF6' },
            'project': { label: 'Project Performance', icon: 'fa-tasks', color: '#F59E0B' },
            'team': { label: 'Team Performance', icon: 'fa-user-check', color: '#14B8A6' },
            'whatsapp': { label: 'WhatsApp Analytics', icon: 'fa-whatsapp', color: '#25D366' },
            'training': { label: 'Training & LMS', icon: 'fa-graduation-cap', color: '#F97316' },
            'referral': { label: 'Referral Analytics', icon: 'fa-link', color: '#DC2626' },
            'custom': { label: 'Custom Reports', icon: 'fa-cog', color: '#6B7280' }
        };
        
        // Chart types
        this.chartTypes = {
            'line': { label: 'Line Chart', icon: 'fa-chart-line' },
            'bar': { label: 'Bar Chart', icon: 'fa-chart-bar' },
            'pie': { label: 'Pie Chart', icon: 'fa-chart-pie' },
            'doughnut': { label: 'Doughnut', icon: 'fa-circle-notch' },
            'area': { label: 'Area Chart', icon: 'fa-chart-area' },
            'scatter': { label: 'Scatter Plot', icon: 'fa-braille' },
            'radar': { label: 'Radar Chart', icon: 'fa-spider' },
            'funnel': { label: 'Funnel', icon: 'fa-filter' },
            'gauge': { label: 'Gauge', icon: 'fa-tachometer-alt' },
            'heatmap': { label: 'Heatmap', icon: 'fa-th' },
            'table': { label: 'Data Table', icon: 'fa-table' },
            'kpi': { label: 'KPI Card', icon: 'fa-clipboard-check' }
        };
        
        // Time periods
        this.timePeriods = {
            'today': { label: 'Today', days: 0 },
            'yesterday': { label: 'Yesterday', days: -1 },
            'this_week': { label: 'This Week', days: 7 },
            'last_week': { label: 'Last Week', days: 7, offset: -7 },
            'this_month': { label: 'This Month', days: 30 },
            'last_month': { label: 'Last Month', days: 30, offset: -30 },
            'this_quarter': { label: 'This Quarter', days: 90 },
            'last_quarter': { label: 'Last Quarter', days: 90, offset: -90 },
            'this_year': { label: 'This Year', days: 365 },
            'last_year': { label: 'Last Year', days: 365, offset: -365 },
            'custom': { label: 'Custom Range', days: 0 }
        };
        
        // Export formats
        this.exportFormats = {
            'pdf': { label: 'PDF Report', icon: 'fa-file-pdf', mime: 'application/pdf' },
            'excel': { label: 'Excel (.xlsx)', icon: 'fa-file-excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            'csv': { label: 'CSV', icon: 'fa-file-csv', mime: 'text/csv' },
            'json': { label: 'JSON', icon: 'fa-code', mime: 'application/json' },
            'image': { label: 'PNG Image', icon: 'fa-image', mime: 'image/png' }
        };
        
        // KPI definitions
        this.kpiDefinitions = {
            'total_revenue': { label: 'Total Revenue', format: 'currency', color: '#10B981' },
            'total_deals': { label: 'Total Deals', format: 'number', color: '#3B82F6' },
            'conversion_rate': { label: 'Conversion Rate', format: 'percentage', color: '#8B5CF6' },
            'avg_deal_size': { label: 'Avg Deal Size', format: 'currency', color: '#F59E0B' },
            'sales_cycle': { label: 'Avg Sales Cycle', format: 'days', color: '#EC4899' },
            'pipeline_value': { label: 'Pipeline Value', format: 'currency', color: '#14B8A6' },
            'customer_acquisition_cost': { label: 'CAC', format: 'currency', color: '#F97316' },
            'customer_lifetime_value': { label: 'CLV', format: 'currency', color: '#DC2626' },
            'churn_rate': { label: 'Churn Rate', format: 'percentage', color: '#EF4444' },
            'nps_score': { label: 'NPS Score', format: 'number', color: '#6366F1' },
            'roi': { label: 'ROI', format: 'percentage', color: '#059669' },
            'gross_margin': { label: 'Gross Margin', format: 'percentage', color: '#7C3AED' }
        };
        
        // Scheduled report frequencies
        this.scheduleFrequencies = {
            'daily': { label: 'Daily', cron: '0 8 * * *' },
            'weekly': { label: 'Weekly', cron: '0 8 * * 1' },
            'biweekly': { label: 'Bi-Weekly', cron: '0 8 1,15 * *' },
            'monthly': { label: 'Monthly', cron: '0 8 1 * *' },
            'quarterly': { label: 'Quarterly', cron: '0 8 1 1,4,7,10 *' },
            'yearly': { label: 'Yearly', cron: '0 8 1 1 *' }
        };
        
        // Module state
        this.reports = new Map();
        this.dashboards = new Map();
        this.scheduledReports = new Map();
        this.selectedReportId = null;
        this.selectedDashboardId = null;
        
        // Active report configuration
        this.activeReport = {
            type: 'sales',
            period: 'this_month',
            dateRange: null,
            filters: {},
            chartType: 'bar',
            groupBy: 'day',
            metrics: ['total_revenue', 'total_deals'],
            comparison: false
        };
        
        // Dashboard layout
        this.dashboardLayout = [];
        this.isEditingDashboard = false;
        
        // Filters
        this.filters = {
            category: 'all',
            dateRange: null,
            search: '',
            author: 'all'
        };
        
        // Sort config
        this.sortConfig = {
            field: 'updatedAt',
            order: 'desc'
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
        };
        
        // View state
        this.currentView = 'list'; // list, dashboard, builder, viewer
        this.currentDashboardId = null;
        
        // Cache for report data
        this.dataCache = new Map();
        
        // Performance
        this.performance = {
            reportsGenerated: 0,
            exportsDone: 0,
            averageGenerationTime: 0,
            lastReportGenerated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            reportList: null,
            dashboardView: null,
            reportBuilder: null,
            reportViewer: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            exportButton: null,
            scheduleButton: null,
            chartContainer: null
        };
        
        // Chart.js instance reference
        this.chartInstances = new Map();
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize reports module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Reports] Initializing reports & analytics module...');
            
            // Check permissions
            const canAccess = await Permissions.check('reports', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Reports module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load data
            await this.loadReports();
            await this.loadDashboards();
            await this.loadScheduledReports();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Render
            await this.render();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Reports] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('reports:ready', {
                reports: this.reports.size,
                dashboards: this.dashboards.size
            });
            
        } catch (error) {
            console.error('[Reports] Initialization failed:', error);
            Toast.show('Failed to load reports module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#reports-container',
                reportList: '#reports-list',
                dashboardView: '#dashboard-view',
                reportBuilder: '#report-builder',
                reportViewer: '#report-viewer',
                filterBar: '#reports-filters',
                searchInput: '#reports-search',
                createButton: '#report-create-btn',
                exportButton: '#report-export-btn',
                scheduleButton: '#report-schedule-btn',
                chartContainer: '#chart-container'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Reports] DOM elements cached');
            
        } catch (error) {
            console.error('[Reports] DOM cache failed:', error);
        }
    }
    
    /**
     * Load reports
     */
    async loadReports(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            if (this.filters.category !== 'all') params.set('category', this.filters.category);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (response.success && response.data) {
                this.reports.clear();
                response.data.reports?.forEach(report => {
                    this.reports.set(report.id, {
                        ...report,
                        formattedCreated: Formatters.date(report.createdAt),
                        formattedUpdated: Formatters.relativeTime(report.updatedAt),
                        categoryInfo: this.reportCategories[report.category] || this.reportCategories.custom
                    });
                });
                
                if (response.data.pagination) {
                    this.pagination.total = response.data.pagination.total || 0;
                    this.pagination.totalPages = response.data.pagination.totalPages || 1;
                }
            }
            
            console.log(`[Reports] Loaded ${this.reports.size} reports`);
            
        } catch (error) {
            console.error('[Reports] Load failed:', error);
        }
    }
    
    /**
     * Load dashboards
     */
    async loadDashboards() {
        try {
            const response = await API.get(`${this.apiEndpoint}/dashboards`);
            
            if (response.success && response.data) {
                this.dashboards.clear();
                response.data.forEach(dashboard => {
                    this.dashboards.set(dashboard.id, dashboard);
                });
                
                console.log(`[Reports] Loaded ${this.dashboards.size} dashboards`);
            }
            
        } catch (error) {
            console.error('[Reports] Dashboards load failed:', error);
        }
    }
    
    /**
     * Load scheduled reports
     */
    async loadScheduledReports() {
        try {
            const response = await API.get(`${this.apiEndpoint}/scheduled`);
            
            if (response.success && response.data) {
                this.scheduledReports.clear();
                response.data.forEach(schedule => {
                    this.scheduledReports.set(schedule.id, schedule);
                });
                
                console.log(`[Reports] Loaded ${this.scheduledReports.size} scheduled reports`);
            }
            
        } catch (error) {
            console.error('[Reports] Scheduled reports load failed:', error);
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
                    this.openReportBuilder();
                });
            }
            
            if (this.elements.exportButton) {
                this.elements.exportButton.addEventListener('click', () => {
                    this.showExportOptions();
                });
            }
            
            if (this.elements.scheduleButton) {
                this.elements.scheduleButton.addEventListener('click', () => {
                    this.openScheduleDialog();
                });
            }
            
            EventBus.on('report:generate', this.generateReport.bind(this));
            EventBus.on('report:export', this.exportReport.bind(this));
            EventBus.on('report:schedule', this.scheduleReport.bind(this));
            EventBus.on('dashboard:create', this.createDashboard.bind(this));
            
            console.log('[Reports] Event listeners initialized');
            
        } catch (error) {
            console.error('[Reports] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render reports view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            switch (this.currentView) {
                case 'list':
                    await this.renderListView();
                    break;
                case 'dashboard':
                    await this.renderDashboardView();
                    break;
                case 'builder':
                    await this.renderReportBuilder();
                    break;
                case 'viewer':
                    await this.renderReportViewer();
                    break;
                default:
                    await this.renderListView();
            }
            
        } catch (error) {
            console.error('[Reports] Render failed:', error);
        }
    }
    
    /**
     * Render list view
     */
    async renderListView() {
        try {
            const html = `
                <div class="reports-list-container">
                    <!-- Header -->
                    <div class="reports-header">
                        <h2><i class="fas fa-chart-pie"></i> Reports & Analytics</h2>
                        <div class="header-actions">
                            <button class="btn btn-outline" onclick="window.Global.Reports.openDashboardView()">
                                <i class="fas fa-th-large"></i> Dashboards
                            </button>
                            <button class="btn btn-primary" onclick="window.Global.Reports.openReportBuilder()">
                                <i class="fas fa-plus"></i> Create Report
                            </button>
                        </div>
                    </div>
                    
                    <!-- Quick KPI Cards -->
                    <div class="quick-kpi-cards">
                        ${this.renderQuickKPIs()}
                    </div>
                    
                    <!-- Category Tabs -->
                    <div class="category-tabs">
                        <button class="cat-tab ${this.filters.category === 'all' ? 'active' : ''}" 
                                onclick="window.Global.Reports.filterByCategory('all')">
                            All Reports
                        </button>
                        ${Object.entries(this.reportCategories).map(([key, cat]) => `
                            <button class="cat-tab ${this.filters.category === key ? 'active' : ''}" 
                                    onclick="window.Global.Reports.filterByCategory('${key}')">
                                <i class="fas ${cat.icon}"></i> ${cat.label}
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Reports Grid -->
                    <div class="reports-grid">
                        ${this.renderReportCards()}
                    </div>
                    
                    ${this.reports.size === 0 ? this.renderEmptyState() : ''}
                    ${this.renderPagination()}
                    
                    <!-- Scheduled Reports Section -->
                    <div class="scheduled-reports-section">
                        <h3><i class="fas fa-clock"></i> Scheduled Reports</h3>
                        ${this.renderScheduledReports()}
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Reports] List view rendered');
            
        } catch (error) {
            console.error('[Reports] List render failed:', error);
        }
    }
    
    /**
     * Render quick KPI cards
     */
    renderQuickKPIs() {
        // Simulated KPI data - in production this comes from API
        const kpis = [
            { key: 'total_revenue', value: 8750000 },
            { key: 'total_deals', value: 147 },
            { key: 'conversion_rate', value: 23.5 },
            { key: 'avg_deal_size', value: 59500 },
            { key: 'pipeline_value', value: 3200000 },
            { key: 'sales_cycle', value: 18 }
        ];
        
        return kpis.map(kpi => {
            const def = this.kpiDefinitions[kpi.key];
            let formattedValue = kpi.value;
            
            switch (def.format) {
                case 'currency':
                    formattedValue = Formatters.currency(kpi.value);
                    break;
                case 'percentage':
                    formattedValue = `${kpi.value}%`;
                    break;
                case 'days':
                    formattedValue = `${kpi.value} days`;
                    break;
                default:
                    formattedValue = Formatters.number(kpi.value);
            }
            
            return `
                <div class="kpi-card glass-card" style="border-top: 3px solid ${def.color}">
                    <div class="kpi-label">${def.label}</div>
                    <div class="kpi-value" style="color: ${def.color}">${formattedValue}</div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render report cards
     */
    renderReportCards() {
        if (this.reports.size === 0) return '';
        
        let cards = '';
        
        this.reports.forEach((report) => {
            const catInfo = report.categoryInfo;
            
            cards += `
                <div class="report-card" onclick="window.Global.Reports.viewReport('${report.id}')">
                    <div class="report-card-header">
                        <div class="report-icon" style="background: ${catInfo.color}20; color: ${catInfo.color}">
                            <i class="fas ${catInfo.icon}"></i>
                        </div>
                        <div class="report-meta">
                            <span class="report-type">${catInfo.label}</span>
                            <span class="report-date">${report.formattedUpdated}</span>
                        </div>
                    </div>
                    
                    <h4 class="report-title">${this.escapeHtml(report.name)}</h4>
                    <p class="report-description">${this.escapeHtml(report.description?.substring(0, 80) || '')}</p>
                    
                    <div class="report-stats">
                        <div class="stat">
                            <i class="fas fa-chart-bar"></i>
                            <span>${report.chartType || 'Table'}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-sync"></i>
                            <span>${report.lastGenerated ? Formatters.relativeTime(report.lastGenerated) : 'Never'}</span>
                        </div>
                    </div>
                    
                    <div class="report-card-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-primary" onclick="window.Global.Reports.generateReport('${report.id}')">
                            <i class="fas fa-play"></i> Generate
                        </button>
                        <button class="btn-icon" title="Export" onclick="window.Global.Reports.exportReport('${report.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-icon" title="Schedule" onclick="window.Global.Reports.openScheduleDialog('${report.id}')">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="btn-icon more" title="More" onclick="window.Global.Reports.showContextMenu(event, '${report.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        return cards;
    }
    
    /**
     * Render scheduled reports
     */
    renderScheduledReports() {
        if (this.scheduledReports.size === 0) {
            return '<div class="no-scheduled">No scheduled reports</div>';
        }
        
        return `
            <div class="scheduled-list">
                ${Array.from(this.scheduledReports.values()).map(schedule => `
                    <div class="scheduled-item">
                        <div class="schedule-info">
                            <i class="fas fa-clock"></i>
                            <div>
                                <strong>${this.escapeHtml(schedule.reportName)}</strong>
                                <span>${schedule.frequency} • Next: ${Formatters.date(schedule.nextRun)}</span>
                            </div>
                        </div>
                        <div class="schedule-status">
                            <span class="status-badge ${schedule.active ? 'active' : 'inactive'}">
                                ${schedule.active ? 'Active' : 'Paused'}
                            </span>
                        </div>
                        <div class="schedule-actions">
                            <button class="btn-icon" title="Edit" onclick="window.Global.Reports.editSchedule('${schedule.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" title="Delete" onclick="window.Global.Reports.deleteSchedule('${schedule.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Render report builder
     */
    async renderReportBuilder() {
        try {
            const html = `
                <div class="report-builder-container">
                    <div class="builder-header">
                        <h3><i class="fas fa-tools"></i> Report Builder</h3>
                        <button class="btn btn-outline" onclick="window.Global.Reports.switchView('list')">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                    </div>
                    
                    <div class="builder-layout">
                        <!-- Configuration Panel -->
                        <div class="builder-config">
                            <div class="config-section">
                                <h4>Report Type</h4>
                                <select id="builder-category" onchange="window.Global.Reports.updateBuilder()">
                                    ${Object.entries(this.reportCategories).map(([key, cat]) => `
                                        <option value="${key}" ${this.activeReport.type === key ? 'selected' : ''}>
                                            ${cat.label}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div class="config-section">
                                <h4>Time Period</h4>
                                <select id="builder-period" onchange="window.Global.Reports.updateBuilder()">
                                    ${Object.entries(this.timePeriods).map(([key, period]) => `
                                        <option value="${key}" ${this.activeReport.period === key ? 'selected' : ''}>
                                            ${period.label}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div class="config-section">
                                <h4>Chart Type</h4>
                                <div class="chart-type-grid">
                                    ${Object.entries(this.chartTypes).map(([key, chart]) => `
                                        <button class="chart-type-btn ${this.activeReport.chartType === key ? 'active' : ''}"
                                                onclick="window.Global.Reports.selectChartType('${key}')"
                                                title="${chart.label}">
                                            <i class="fas ${chart.icon}"></i>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4>Group By</h4>
                                <select id="builder-groupby" onchange="window.Global.Reports.updateBuilder()">
                                    <option value="day">Day</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="quarter">Quarter</option>
                                    <option value="year">Year</option>
                                </select>
                            </div>
                            
                            <div class="config-section">
                                <h4>Metrics</h4>
                                <div class="metrics-checklist">
                                    ${Object.entries(this.kpiDefinitions).map(([key, kpi]) => `
                                        <label class="metric-checkbox">
                                            <input type="checkbox" value="${key}" 
                                                   ${this.activeReport.metrics.includes(key) ? 'checked' : ''}
                                                   onchange="window.Global.Reports.toggleMetric('${key}')">
                                            ${kpi.label}
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <label>
                                    <input type="checkbox" ${this.activeReport.comparison ? 'checked' : ''} 
                                           onchange="window.Global.Reports.toggleComparison()">
                                    Show Comparison (vs Previous Period)
                                </label>
                            </div>
                        </div>
                        
                        <!-- Preview Panel -->
                        <div class="builder-preview">
                            <div class="preview-header">
                                <h4>Preview</h4>
                                <div class="preview-actions">
                                    <button class="btn btn-sm btn-primary" onclick="window.Global.Reports.generateReport()">
                                        <i class="fas fa-sync"></i> Refresh
                                    </button>
                                    <button class="btn btn-sm btn-outline" onclick="window.Global.Reports.saveReport()">
                                        <i class="fas fa-save"></i> Save Report
                                    </button>
                                </div>
                            </div>
                            
                            <div class="chart-preview" id="chart-container">
                                <canvas id="report-chart"></canvas>
                            </div>
                            
                            <div class="data-preview" id="data-table-container">
                                <!-- Data table rendered dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            // Render sample chart
            setTimeout(() => {
                this.renderChart();
            }, 200);
            
            console.log('[Reports] Builder view rendered');
            
        } catch (error) {
            console.error('[Reports] Builder render failed:', error);
        }
    }
    
    /**
     * Render chart using Chart.js or similar
     */
    renderChart() {
        try {
            const canvas = document.getElementById('report-chart');
            if (!canvas) return;
            
            // Destroy existing chart
            const existingChart = this.chartInstances.get('report-chart');
            if (existingChart) {
                existingChart.destroy();
            }
            
            // Sample data
            const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const data = {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: [650000, 720000, 810000, 750000, 890000, 950000, 870000, 920000, 980000, 1050000, 1100000, 1200000],
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3B82F6',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            };
            
            const config = {
                type: this.activeReport.chartType || 'bar',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return `₹${context.parsed.y.toLocaleString('en-IN')}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => `₹${(value / 100000).toFixed(1)}L`
                            }
                        }
                    }
                }
            };
            
            // Check if Chart.js is available
            if (typeof Chart !== 'undefined') {
                const chart = new Chart(canvas, config);
                this.chartInstances.set('report-chart', chart);
            } else {
                // Fallback: display placeholder
                canvas.parentElement.innerHTML = `
                    <div class="chart-placeholder">
                        <i class="fas fa-chart-bar"></i>
                        <p>Chart library loading...</p>
                        <p class="text-muted">Install Chart.js for full charting capabilities</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('[Reports] Chart render failed:', error);
        }
    }
    
    /**
     * Generate a report
     */
    async generateReport(reportId = null) {
        try {
            const reportConfig = reportId ? 
                this.reports.get(reportId) : 
                this.activeReport;
            
            if (!reportConfig) {
                Toast.show('Report configuration not found', 'error');
                return;
            }
            
            Toast.show('Generating report...', 'info');
            
            const startTime = performance.now();
            
            const response = await API.post(`${this.apiEndpoint}/generate`, {
                reportId: reportId,
                config: reportConfig
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Report generation failed');
            }
            
            const generationTime = performance.now() - startTime;
            
            // Update performance metrics
            this.performance.reportsGenerated++;
            this.performance.averageGenerationTime = 
                ((this.performance.averageGenerationTime * (this.performance.reportsGenerated - 1)) + generationTime) / 
                this.performance.reportsGenerated;
            this.performance.lastReportGenerated = new Date();
            
            // Cache report data
            const cacheKey = reportId || 'builder';
            this.dataCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
            
            // Switch to viewer if not already
            if (!reportId) {
                this.renderChart();
            } else {
                this.viewReport(reportId);
            }
            
            Toast.show(`Report generated in ${(generationTime / 1000).toFixed(1)}s`, 'success');
            
            EventBus.emit('report:generated', { reportId, data: response.data });
            
        } catch (error) {
            console.error('[Reports] Generation failed:', error);
            Toast.show('Failed to generate report: ' + error.message, 'error');
        }
    }
    
    /**
     * Export report
     */
    async exportReport(reportId) {
        try {
            const report = this.reports.get(reportId);
            if (!report) throw new Error('Report not found');
            
            // Show format selector
            const formatHtml = `
                <div class="export-format-selector">
                    <h4>Select Export Format</h4>
                    <div class="format-grid">
                        ${Object.entries(this.exportFormats).map(([key, format]) => `
                            <button class="format-card" onclick="window.Global.Reports.doExport('${reportId}', '${key}')">
                                <i class="fas ${format.icon}"></i>
                                <span>${format.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Export Report',
                content: formatHtml,
                size: 'medium'
            });
            
            modal.open();
            
        } catch (error) {
            console.error('[Reports] Export failed:', error);
            Toast.show('Export failed', 'error');
        }
    }
    
    /**
     * Perform actual export
     */
    async doExport(reportId, format) {
        try {
            Toast.show(`Exporting as ${format.toUpperCase()}...`, 'info');
            
            const response = await API.get(
                `${this.apiEndpoint}/${reportId}/export?format=${format}`,
                { responseType: 'blob' }
            );
            
            // Download file
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `report-${reportId}.${format === 'excel' ? 'xlsx' : format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            this.performance.exportsDone++;
            
            Modal.close();
            Toast.show('Report exported successfully', 'success');
            
        } catch (error) {
            console.error('[Reports] Export execution failed:', error);
            Toast.show('Export failed', 'error');
        }
    }
    
    /**
     * Schedule a report
     */
    async scheduleReport(reportId) {
        try {
            const scheduleHtml = `
                <div class="schedule-form">
                    <form id="schedule-form">
                        <div class="form-group">
                            <label for="schedule-frequency">Frequency *</label>
                            <select id="schedule-frequency" name="frequency" required>
                                ${Object.entries(this.scheduleFrequencies).map(([key, freq]) => `
                                    <option value="${key}">${freq.label}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="schedule-emails">Recipients (comma-separated)</label>
                            <input type="text" id="schedule-emails" name="emails" 
                                   placeholder="email1@example.com, email2@example.com">
                        </div>
                        
                        <div class="form-group">
                            <label for="schedule-format">Export Format</label>
                            <select id="schedule-format" name="format">
                                <option value="pdf">PDF</option>
                                <option value="excel">Excel</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="includeSummary" checked>
                                Include Executive Summary
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="attachData" checked>
                                Attach Raw Data
                            </label>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-clock"></i> Schedule Report
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Schedule Report',
                content: scheduleHtml,
                size: 'medium'
            });
            
            modal.open();
            
            setTimeout(() => {
                const form = document.getElementById('schedule-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData(form);
                        
                        try {
                            const response = await API.post(`${this.apiEndpoint}/${reportId}/schedule`, {
                                frequency: formData.get('frequency'),
                                recipients: formData.get('emails').split(',').map(e => e.trim()),
                                format: formData.get('format'),
                                includeSummary: formData.get('includeSummary') === 'on',
                                attachData: formData.get('attachData') === 'on'
                            });
                            
                            if (!response.success) throw new Error(response.error);
                            
                            Modal.close();
                            Toast.show('Report scheduled successfully', 'success');
                            
                            await this.loadScheduledReports();
                            await this.render();
                            
                        } catch (error) {
                            Toast.show('Failed to schedule: ' + error.message, 'error');
                        }
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('[Reports] Schedule failed:', error);
            Toast.show('Failed to open schedule dialog', 'error');
        }
    }
    
    /**
     * Open schedule dialog
     */
    async openScheduleDialog(reportId) {
        if (reportId) {
            await this.scheduleReport(reportId);
        } else if (this.selectedReportId) {
            await this.scheduleReport(this.selectedReportId);
        }
    }
    
    /**
     * Show export options
     */
    showExportOptions() {
        if (this.selectedReportId) {
            this.exportReport(this.selectedReportId);
        }
    }
    
    /**
     * Open report builder
     */
    openReportBuilder() {
        this.currentView = 'builder';
        this.render();
    }
    
    /**
     * View report
     */
    async viewReport(reportId) {
        this.selectedReportId = reportId;
        this.currentView = 'viewer';
        await this.render();
    }
    
    /**
     * Open dashboard view
     */
    openDashboardView() {
        this.currentView = 'dashboard';
        this.render();
    }
    
    /**
     * Switch view
     */
    async switchView(view) {
        this.currentView = view;
        await this.render();
    }
    
    /**
     * Filter by category
     */
    async filterByCategory(category) {
        this.filters.category = category;
        await this.loadReports();
        await this.render();
    }
    
    /**
     * Select chart type
     */
    selectChartType(type) {
        this.activeReport.chartType = type;
        this.renderChart();
    }
    
    /**
     * Toggle metric
     */
    toggleMetric(metric) {
        const index = this.activeReport.metrics.indexOf(metric);
        if (index > -1) {
            this.activeReport.metrics.splice(index, 1);
        } else {
            this.activeReport.metrics.push(metric);
        }
        this.renderChart();
    }
    
    /**
     * Toggle comparison
     */
    toggleComparison() {
        this.activeReport.comparison = !this.activeReport.comparison;
        this.renderChart();
    }
    
    /**
     * Update builder
     */
    updateBuilder() {
        const categoryEl = document.getElementById('builder-category');
        const periodEl = document.getElementById('builder-period');
        const groupByEl = document.getElementById('builder-groupby');
        
        if (categoryEl) this.activeReport.type = categoryEl.value;
        if (periodEl) this.activeReport.period = periodEl.value;
        if (groupByEl) this.activeReport.groupBy = groupByEl.value;
        
        this.renderChart();
    }
    
    /**
     * Save report
     */
    async saveReport() {
        try {
            const name = prompt('Enter report name:');
            if (!name) return;
            
            const response = await API.post(`${this.apiEndpoint}/save`, {
                name,
                config: this.activeReport
            });
            
            if (!response.success) throw new Error(response.error);
            
            Toast.show('Report saved successfully', 'success');
            await this.loadReports();
            this.switchView('list');
            
        } catch (error) {
            console.error('[Reports] Save failed:', error);
            Toast.show('Failed to save report', 'error');
        }
    }
    
    /**
     * Create dashboard
     */
    async createDashboard() {
        try {
            const name = prompt('Enter dashboard name:');
            if (!name) return;
            
            const response = await API.post(`${this.apiEndpoint}/dashboards`, { name });
            
            if (!response.success) throw new Error(response.error);
            
            Toast.show('Dashboard created', 'success');
            await this.loadDashboards();
            
        } catch (error) {
            console.error('[Reports] Dashboard create failed:', error);
            Toast.show('Failed to create dashboard', 'error');
        }
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-chart-pie"></i>
                </div>
                <h3>No Reports Found</h3>
                <p>Create your first custom report</p>
                <button class="btn btn-primary" onclick="window.Global.Reports.openReportBuilder()">
                    <i class="fas fa-plus"></i> Create Report
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
        
        html += `<button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                        onclick="window.Global.Reports.loadReports(${this.pagination.page - 1})">
                    <i class="fas fa-chevron-left"></i></button>`;
        
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `<button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                                onclick="window.Global.Reports.loadReports(${i})">${i}</button>`;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        html += `<button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                        onclick="window.Global.Reports.loadReports(${this.pagination.page + 1})">
                    <i class="fas fa-chevron-right"></i></button>`;
        
        html += '</div>';
        return html;
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
        // Destroy all chart instances
        this.chartInstances.forEach(chart => chart.destroy());
        this.chartInstances.clear();
        
        EventBus.off('report:generate');
        EventBus.off('report:export');
        EventBus.off('report:schedule');
        
        console.log('[Reports] Module destroyed');
    }
}

// Singleton
const reports = new ReportsModule();

// Exports
export { reports, ReportsModule };
export default reports;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Reports = reports;
}


