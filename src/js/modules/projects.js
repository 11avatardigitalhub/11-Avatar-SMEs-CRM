/**
 * 11 AVATAR DIGITAL HUB - Projects Module
 * Enterprise-grade project management system
 * Portfolio management, milestones, budgets, resource allocation, Gantt charts
 * 
 * @module Projects
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
 * Projects Module - Complete project lifecycle management
 * Handles portfolios, projects, milestones, budgets, resources, Gantt
 */
class ProjectsModule {
    constructor() {
        // Module identity
        this.moduleName = 'projects';
        this.apiEndpoint = '/api/projects';
        this.cachePrefix = 'project_';
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
        
        // Project status definitions
        this.statuses = {
            'planning': {
                label: 'Planning',
                color: '#3B82F6',
                icon: 'fa-lightbulb',
                order: 1,
                description: 'Project is being planned'
            },
            'active': {
                label: 'Active',
                color: '#10B981',
                icon: 'fa-play-circle',
                order: 2,
                description: 'Project is in progress'
            },
            'on_hold': {
                label: 'On Hold',
                color: '#F59E0B',
                icon: 'fa-pause-circle',
                order: 3,
                description: 'Project temporarily paused'
            },
            'at_risk': {
                label: 'At Risk',
                color: '#F97316',
                icon: 'fa-exclamation-triangle',
                order: 4,
                description: 'Project facing challenges'
            },
            'completed': {
                label: 'Completed',
                color: '#8B5CF6',
                icon: 'fa-check-circle',
                order: 5,
                description: 'Project successfully completed'
            },
            'cancelled': {
                label: 'Cancelled',
                color: '#DC2626',
                icon: 'fa-times-circle',
                order: 6,
                description: 'Project cancelled'
            },
            'archived': {
                label: 'Archived',
                color: '#6B7280',
                icon: 'fa-archive',
                order: 7,
                description: 'Project archived'
            }
        };
        
        // Project types
        this.projectTypes = {
            'client': { label: 'Client Project', icon: 'fa-building', color: '#3B82F6' },
            'internal': { label: 'Internal', icon: 'fa-cogs', color: '#8B5CF6' },
            'rnd': { label: 'R&D', icon: 'fa-flask', color: '#EC4899' },
            'marketing': { label: 'Marketing', icon: 'fa-bullhorn', color: '#F59E0B' },
            'product': { label: 'Product', icon: 'fa-box', color: '#10B981' },
            'support': { label: 'Support', icon: 'fa-headset', color: '#14B8A6' }
        };
        
        // Priority definitions
        this.priorities = {
            'critical': { label: 'Critical', color: '#DC2626', weight: 5 },
            'high': { label: 'High', color: '#F97316', weight: 4 },
            'medium': { label: 'Medium', color: '#F59E0B', weight: 3 },
            'low': { label: 'Low', color: '#3B82F6', weight: 2 },
            'minimal': { label: 'Minimal', color: '#6B7280', weight: 1 }
        };
        
        // Budget types
        this.budgetTypes = {
            'fixed': { label: 'Fixed Price', icon: 'fa-tag' },
            'hourly': { label: 'Hourly', icon: 'fa-clock' },
            'retainer': { label: 'Retainer', icon: 'fa-calendar-check' },
            'milestone': { label: 'Milestone Based', icon: 'fa-flag-checkered' }
        };
        
        // Module state
        this.projects = new Map();
        this.portfolios = new Map();
        this.selectedProjectId = null;
        this.selectedPortfolioId = null;
        
        // Milestones
        this.milestones = new Map(); // projectId -> [milestones]
        
        // Resources
        this.resources = new Map(); // projectId -> [resources]
        
        // Budget tracking
        this.budgets = new Map(); // projectId -> budget
        
        // Filters
        this.filters = {
            status: 'all',
            type: 'all',
            priority: 'all',
            client: 'all',
            portfolio: 'all',
            search: '',
            dateRange: null,
            budgetRange: null,
            showArchived: false
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
        this.currentView = 'grid'; // grid, list, gantt, timeline, portfolio
        this.selectedMilestoneId = null;
        
        // Gantt chart state
        this.ganttState = {
            startDate: null,
            endDate: null,
            zoom: 'month', // day, week, month, quarter, year
            showWeekends: true,
            showDependencies: true
        };
        
        // Performance metrics
        this.metrics = {
            totalProjects: 0,
            activeProjects: 0,
            atRiskProjects: 0,
            completedThisMonth: 0,
            totalBudget: 0,
            totalSpent: 0,
            onTimeDelivery: 0,
            clientSatisfaction: 0,
            lastCalculated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            projectGrid: null,
            projectList: null,
            ganttChart: null,
            projectDetail: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            portfolioSelector: null,
            metricsPanel: null,
            bulkActions: null
        };
        
        // Auto-save
        this.autoSaveTimeout = null;
        this.unsavedChanges = false;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize projects module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Projects] Initializing project management module...');
            
            // Check permissions
            const canAccess = await Permissions.check('projects', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Projects module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load portfolios
            await this.loadPortfolios();
            
            // Load projects
            await this.loadProjects();
            
            // Load resources
            await this.loadResources();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Render
            await this.render();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Projects] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('projects:ready', {
                count: this.projects.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Projects] Initialization failed:', error);
            Toast.show('Failed to load projects module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#projects-container',
                projectGrid: '#projects-grid',
                projectList: '#projects-list',
                ganttChart: '#gantt-chart',
                projectDetail: '#project-detail',
                filterBar: '#projects-filters',
                searchInput: '#projects-search',
                createButton: '#project-create-btn',
                portfolioSelector: '#portfolio-selector',
                metricsPanel: '#projects-metrics',
                bulkActions: '#projects-bulk-actions'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Projects] DOM elements cached');
            
        } catch (error) {
            console.error('[Projects] DOM cache failed:', error);
        }
    }
    
    /**
     * Load portfolios
     */
    async loadPortfolios() {
        try {
            const response = await API.get('/api/portfolios');
            
            if (response.success && response.data) {
                this.portfolios.clear();
                response.data.forEach(portfolio => {
                    this.portfolios.set(portfolio.id, portfolio);
                });
                
                console.log(`[Projects] Loaded ${this.portfolios.size} portfolios`);
            }
            
        } catch (error) {
            console.error('[Projects] Portfolio load failed:', error);
        }
    }
    
    /**
     * Load projects
     */
    async loadProjects(page = 1) {
        try {
            this.pagination.page = page;
            
            // Build query
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            // Add filters
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.type !== 'all') params.set('type', this.filters.type);
            if (this.filters.priority !== 'all') params.set('priority', this.filters.priority);
            if (this.filters.client !== 'all') params.set('client', this.filters.client);
            if (this.filters.portfolio !== 'all') params.set('portfolio', this.filters.portfolio);
            if (this.filters.search) params.set('search', this.filters.search);
            
            // Check cache
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processProjectsData(cached.data);
                    return;
                }
            }
            
            // API call
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load projects');
            }
            
            this.processProjectsData(response.data);
            
            // Cache
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Projects] Loaded ${this.projects.size} projects`);
            
        } catch (error) {
            console.error('[Projects] Load failed:', error);
            Toast.show('Failed to load projects', 'error');
        }
    }
    
    /**
     * Process projects data
     */
    processProjectsData(data) {
        try {
            this.projects.clear();
            
            if (data.projects && Array.isArray(data.projects)) {
                data.projects.forEach(project => {
                    const processed = {
                        ...project,
                        // Format fields
                        formattedStartDate: Formatters.date(project.startDate),
                        formattedEndDate: Formatters.date(project.endDate),
                        formattedCreated: Formatters.date(project.createdAt),
                        formattedUpdated: Formatters.relativeTime(project.updatedAt),
                        
                        // Status info
                        statusInfo: this.statuses[project.status] || this.statuses.planning,
                        
                        // Type info
                        typeInfo: this.projectTypes[project.type] || this.projectTypes.client,
                        
                        // Priority info
                        priorityInfo: this.priorities[project.priority] || this.priorities.medium,
                        
                        // Budget info
                        budgetInfo: this.budgetTypes[project.budgetType] || this.budgetTypes.fixed,
                        
                        // Derived fields
                        progress: this.calculateProgress(project),
                        isOverdue: this.isProjectOverdue(project),
                        daysRemaining: this.calculateDaysRemaining(project),
                        durationDays: this.calculateDuration(project),
                        
                        // Budget calculations
                        budgetUtilization: this.calculateBudgetUtilization(project),
                        budgetRemaining: (project.budget || 0) - (project.spent || 0),
                        
                        // Resource info
                        teamSize: project.resources?.length || 0,
                        
                        // Milestone summary
                        totalMilestones: project.milestones?.length || 0,
                        completedMilestones: project.milestones?.filter(m => m.status === 'completed').length || 0,
                        
                        // Task summary
                        totalTasks: project.tasks?.length || 0,
                        completedTasks: project.tasks?.filter(t => t.status === 'done').length || 0,
                        
                        // Client info
                        clientName: project.client?.name || 'Internal',
                        clientCompany: project.client?.company || '',
                        
                        // Health score
                        healthScore: this.calculateHealthScore(project),
                        
                        // Flags
                        needsAttention: this.checkNeedsAttention(project),
                        isActive: project.status === 'active',
                        canEdit: project.status !== 'archived',
                        canArchive: project.status === 'completed' || project.status === 'cancelled'
                    };
                    
                    this.projects.set(project.id, processed);
                });
            }
            
            // Update pagination
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
        } catch (error) {
            console.error('[Projects] Data processing failed:', error);
        }
    }
    
    /**
     * Load resources
     */
    async loadResources() {
        try {
            const response = await API.get('/api/resources');
            
            if (response.success && response.data) {
                this.resources.clear();
                response.data.forEach(resource => {
                    const projectId = resource.projectId;
                    if (!this.resources.has(projectId)) {
                        this.resources.set(projectId, []);
                    }
                    this.resources.get(projectId).push(resource);
                });
                
                console.log(`[Projects] Loaded resources for ${this.resources.size} projects`);
            }
            
        } catch (error) {
            console.error('[Projects] Resources load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            // Search
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            // Filters
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            // Create button
            if (this.elements.createButton) {
                this.elements.createButton.addEventListener('click', () => {
                    this.openCreateProject();
                });
            }
            
            // Portfolio selector
            if (this.elements.portfolioSelector) {
                this.elements.portfolioSelector.addEventListener('change', (e) => {
                    this.selectPortfolio(e.target.value);
                });
            }
            
            // Event bus
            EventBus.on('project:create', this.createProject.bind(this));
            EventBus.on('project:update', this.updateProject.bind(this));
            EventBus.on('project:delete', this.deleteProject.bind(this));
            EventBus.on('project:archive', this.archiveProject.bind(this));
            EventBus.on('milestone:create', this.createMilestone.bind(this));
            EventBus.on('milestone:complete', this.completeMilestone.bind(this));
            EventBus.on('resource:assign', this.assignResource.bind(this));
            
            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
            
            console.log('[Projects] Event listeners initialized');
            
        } catch (error) {
            console.error('[Projects] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render projects view
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
                case 'gantt':
                    await this.renderGanttView();
                    break;
                case 'timeline':
                    await this.renderTimelineView();
                    break;
                case 'portfolio':
                    await this.renderPortfolioView();
                    break;
                default:
                    await this.renderGridView();
            }
            
        } catch (error) {
            console.error('[Projects] Render failed:', error);
        }
    }
    
    /**
     * Render grid view with project cards
     */
    async renderGridView() {
        try {
            const html = `
                <div class="projects-grid-container">
                    <!-- Metrics Dashboard -->
                    <div class="project-metrics-dashboard">
                        <div class="metric-card">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #3B82F6, #2563EB)">
                                <i class="fas fa-project-diagram"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.totalProjects}</span>
                                <span class="metric-label">Total Projects</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #10B981, #059669)">
                                <i class="fas fa-play-circle"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.activeProjects}</span>
                                <span class="metric-label">Active</span>
                            </div>
                        </div>
                        
                        <div class="metric-card warning">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #F97316, #EA580C)">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.atRiskProjects}</span>
                                <span class="metric-label">At Risk</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED)">
                                <i class="fas fa-rupee-sign"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.totalBudget)}</span>
                                <span class="metric-label">Total Budget</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #EC4899, #DB2777)">
                                <i class="fas fa-chart-pie"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${Formatters.currency(this.metrics.totalSpent)}</span>
                                <span class="metric-label">Total Spent</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-icon" style="background: linear-gradient(135deg, #14B8A6, #0D9488)">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.onTimeDelivery}%</span>
                                <span class="metric-label">On-Time Delivery</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Portfolio Selector -->
                    <div class="portfolio-selector-bar">
                        <select id="portfolio-filter" onchange="window.Global.Projects.selectPortfolio(this.value)">
                            <option value="all">All Portfolios</option>
                            ${Array.from(this.portfolios.values()).map(p => `
                                <option value="${p.id}">${this.escapeHtml(p.name)} (${p.projectCount || 0})</option>
                            `).join('')}
                        </select>
                        
                        <div class="view-toggles">
                            <button class="view-toggle ${this.currentView === 'grid' ? 'active' : ''}" 
                                    onclick="window.Global.Projects.switchView('grid')">
                                <i class="fas fa-th-large"></i>
                            </button>
                            <button class="view-toggle ${this.currentView === 'list' ? 'active' : ''}" 
                                    onclick="window.Global.Projects.switchView('list')">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="view-toggle ${this.currentView === 'gantt' ? 'active' : ''}" 
                                    onclick="window.Global.Projects.switchView('gantt')">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Project Cards Grid -->
                    <div class="projects-grid" id="projects-grid">
                        ${this.renderProjectCards()}
                    </div>
                    
                    <!-- Empty State -->
                    ${this.projects.size === 0 ? this.renderEmptyState() : ''}
                    
                    <!-- Pagination -->
                    ${this.renderPagination()}
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Projects] Grid view rendered');
            
        } catch (error) {
            console.error('[Projects] Grid render failed:', error);
        }
    }
    
    /**
     * Render project cards
     */
    renderProjectCards() {
        try {
            if (this.projects.size === 0) return '';
            
            let cards = '';
            
            this.projects.forEach((project) => {
                const statusInfo = project.statusInfo;
                const healthScore = project.healthScore;
                const healthColor = this.getHealthColor(healthScore);
                
                cards += `
                    <div class="project-card glass-card-3d" 
                         data-project-id="${project.id}"
                         onclick="window.Global.Projects.openProjectDetail('${project.id}')">
                        
                        <!-- Status Indicator -->
                        <div class="project-status-bar" style="background: ${statusInfo.color}"></div>
                        
                        <!-- Health Score Badge -->
                        <div class="project-health-badge" style="background: ${healthColor}20; color: ${healthColor}">
                            <i class="fas fa-heartbeat"></i>
                            ${healthScore}%
                        </div>
                        
                        <!-- Project Header -->
                        <div class="project-card-header">
                            <div class="project-icon" style="background: ${project.typeInfo.color}20; color: ${project.typeInfo.color}">
                                <i class="fas ${project.typeInfo.icon}"></i>
                            </div>
                            <div class="project-status">
                                <span class="status-badge" style="background: ${statusInfo.color}20; color: ${statusInfo.color}">
                                    <i class="fas ${statusInfo.icon}"></i>
                                    ${statusInfo.label}
                                </span>
                            </div>
                        </div>
                        
                        <!-- Project Title -->
                        <h3 class="project-title">${this.escapeHtml(project.name)}</h3>
                        
                        <!-- Project Description -->
                        ${project.description ? `
                            <p class="project-description">
                                ${this.escapeHtml(project.description.substring(0, 100))}${project.description.length > 100 ? '...' : ''}
                            </p>
                        ` : ''}
                        
                        <!-- Progress Bar -->
                        <div class="project-progress-section">
                            <div class="progress-header">
                                <span>Progress</span>
                                <span>${project.progress}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${project.progress}%"></div>
                            </div>
                        </div>
                        
                        <!-- Project Meta -->
                        <div class="project-meta-grid">
                            <div class="meta-item">
                                <i class="fas fa-calendar"></i>
                                <div>
                                    <small>Timeline</small>
                                    <span>${project.formattedStartDate} - ${project.formattedEndDate}</span>
                                    ${project.isOverdue ? `
                                        <span class="overdue-tag">Overdue</span>
                                    ` : `
                                        <span class="days-remaining">${project.daysRemaining} days left</span>
                                    `}
                                </div>
                            </div>
                            
                            <div class="meta-item">
                                <i class="fas fa-rupee-sign"></i>
                                <div>
                                    <small>Budget</small>
                                    <span>${Formatters.currency(project.budget || 0)}</span>
                                    ${project.budgetUtilization > 0 ? `
                                        <div class="budget-utilization">
                                            <div class="mini-progress-bar">
                                                <div class="mini-progress-fill ${project.budgetUtilization > 90 ? 'over-budget' : ''}" 
                                                     style="width: ${Math.min(project.budgetUtilization, 100)}%"></div>
                                            </div>
                                            <small>${project.budgetUtilization}% utilized</small>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            
                            <div class="meta-item">
                                <i class="fas fa-users"></i>
                                <div>
                                    <small>Team</small>
                                    <span>${project.teamSize} members</span>
                                </div>
                            </div>
                            
                            <div class="meta-item">
                                <i class="fas fa-flag"></i>
                                <div>
                                    <small>Milestones</small>
                                    <span>${project.completedMilestones}/${project.totalMilestones}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Client Info -->
                        ${project.clientName !== 'Internal' ? `
                            <div class="project-client">
                                <i class="fas fa-building"></i>
                                <span>${this.escapeHtml(project.clientName)}</span>
                                ${project.clientCompany ? `<small>${this.escapeHtml(project.clientCompany)}</small>` : ''}
                            </div>
                        ` : ''}
                        
                        <!-- Priority Indicator -->
                        <div class="project-priority" style="color: ${project.priorityInfo.color}">
                            <i class="fas fa-circle"></i>
                            <span>${project.priorityInfo.label} Priority</span>
                        </div>
                        
                        <!-- Card Actions -->
                        <div class="project-card-actions" onclick="event.stopPropagation()">
                            <button class="btn-icon" title="Edit" onclick="window.Global.Projects.editProject('${project.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" title="Tasks" onclick="window.Global.Projects.viewTasks('${project.id}')">
                                <i class="fas fa-tasks"></i>
                            </button>
                            <button class="btn-icon" title="Gantt" onclick="window.Global.Projects.viewGantt('${project.id}')">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                            <button class="btn-icon more" title="More" onclick="window.Global.Projects.showContextMenu(event, '${project.id}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            return cards;
            
        } catch (error) {
            console.error('[Projects] Card render failed:', error);
            return '<div class="error-message">Failed to render projects</div>';
        }
    }
    
    /**
     * Render Gantt chart view
     */
    async renderGanttView() {
        try {
            const html = `
                <div class="gantt-container">
                    <div class="gantt-header">
                        <h3>Project Timeline</h3>
                        <div class="gantt-controls">
                            <select onchange="window.Global.Projects.changeGanttZoom(this.value)">
                                <option value="day">Day</option>
                                <option value="week" selected>Week</option>
                                <option value="month">Month</option>
                                <option value="quarter">Quarter</option>
                            </select>
                            <label>
                                <input type="checkbox" checked onchange="window.Global.Projects.toggleGanttDependencies()">
                                Show Dependencies
                            </label>
                            <button class="btn btn-sm btn-outline" onclick="window.Global.Projects.exportGantt()">
                                <i class="fas fa-download"></i> Export
                            </button>
                        </div>
                    </div>
                    
                    <div class="gantt-chart" id="gantt-chart">
                        ${this.renderGanttChart()}
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Projects] Gantt view rendered');
            
        } catch (error) {
            console.error('[Projects] Gantt render failed:', error);
        }
    }
    
    /**
     * Render Gantt chart
     */
    renderGanttChart() {
        try {
            if (this.projects.size === 0) {
                return '<div class="gantt-empty">No projects to display</div>';
            }
            
            // Calculate date range
            const dates = [];
            this.projects.forEach(project => {
                if (project.startDate) dates.push(new Date(project.startDate));
                if (project.endDate) dates.push(new Date(project.endDate));
            });
            
            if (dates.length === 0) return '<div class="gantt-empty">No dates available</div>';
            
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            
            // Extend range by 2 weeks each side
            minDate.setDate(minDate.getDate() - 14);
            maxDate.setDate(maxDate.getDate() + 14);
            
            const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
            
            // Generate month headers
            let currentDate = new Date(minDate);
            let monthHeaders = '';
            while (currentDate <= maxDate) {
                const monthName = currentDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                const widthPercent = (daysInMonth / totalDays) * 100;
                
                monthHeaders += `
                    <div class="gantt-month" style="width: ${widthPercent}%">
                        ${monthName}
                    </div>
                `;
                
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
            
            // Generate project bars
            let projectBars = '';
            this.projects.forEach((project) => {
                if (!project.startDate || !project.endDate) return;
                
                const startDate = new Date(project.startDate);
                const endDate = new Date(project.endDate);
                
                const leftOffset = ((startDate - minDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                const width = ((endDate - startDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                
                const statusColor = project.statusInfo.color;
                
                projectBars += `
                    <div class="gantt-row">
                        <div class="gantt-label">
                            <span class="project-name">${this.escapeHtml(project.name)}</span>
                            <span class="project-dates">${project.formattedStartDate} - ${project.formattedEndDate}</span>
                        </div>
                        <div class="gantt-bar-container">
                            <div class="gantt-bar" style="left: ${leftOffset}%; width: ${Math.max(width, 0.5)}%; background: ${statusColor}">
                                <div class="gantt-bar-progress" style="width: ${project.progress}%; background: ${this.lightenColor(statusColor, 30)}"></div>
                                <span class="gantt-bar-label">${project.progress}%</span>
                            </div>
                            
                            <!-- Milestones -->
                            ${project.milestones?.map(milestone => {
                                if (!milestone.date) return '';
                                const milestoneDate = new Date(milestone.date);
                                const milestoneLeft = ((milestoneDate - minDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                                return `
                                    <div class="gantt-milestone" 
                                         style="left: ${milestoneLeft}%" 
                                         title="${this.escapeHtml(milestone.name)}">
                                        <i class="fas fa-flag" style="color: ${milestone.status === 'completed' ? '#10B981' : '#F59E0B'}"></i>
                                    </div>
                                `;
                            }).join('') || ''}
                        </div>
                    </div>
                `;
            });
            
            return `
                <div class="gantt-table">
                    <div class="gantt-header-row">
                        <div class="gantt-label-header">Project</div>
                        <div class="gantt-months-header">
                            ${monthHeaders}
                        </div>
                    </div>
                    <div class="gantt-body">
                        ${projectBars}
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('[Projects] Gantt chart render failed:', error);
            return '<div class="error-message">Failed to render Gantt chart</div>';
        }
    }
    
    /**
     * Open create project modal
     */
    async openCreateProject(projectData = null) {
        try {
            const isEditing = !!projectData;
            const title = isEditing ? 'Edit Project' : 'Create New Project';
            
            const formHtml = `
                <div class="project-form-container">
                    <form id="project-form">
                        <!-- Basic Information -->
                        <div class="form-section">
                            <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
                            <div class="form-row">
                                <div class="form-group col-8">
                                    <label for="project-name">Project Name *</label>
                                    <input type="text" id="project-name" name="name" 
                                           value="${projectData?.name || ''}" required maxlength="200">
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-code">Project Code</label>
                                    <input type="text" id="project-code" name="code" 
                                           value="${projectData?.code || this.generateProjectCode()}" readonly>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="project-description">Description</label>
                                <textarea id="project-description" name="description" rows="3">${projectData?.description || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- Project Details -->
                        <div class="form-section">
                            <h4><i class="fas fa-cog"></i> Project Details</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="project-type">Type *</label>
                                    <select id="project-type" name="type" required>
                                        ${Object.entries(this.projectTypes).map(([key, type]) => `
                                            <option value="${key}" ${projectData?.type === key ? 'selected' : ''}>
                                                ${type.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-priority">Priority *</label>
                                    <select id="project-priority" name="priority" required>
                                        ${Object.entries(this.priorities).map(([key, p]) => `
                                            <option value="${key}" ${projectData?.priority === key ? 'selected' : ''}>
                                                ${p.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-portfolio">Portfolio</label>
                                    <select id="project-portfolio" name="portfolioId">
                                        <option value="">None</option>
                                        ${Array.from(this.portfolios.values()).map(p => `
                                            <option value="${p.id}" ${projectData?.portfolioId === p.id ? 'selected' : ''}>
                                                ${this.escapeHtml(p.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="project-start-date">Start Date *</label>
                                    <input type="date" id="project-start-date" name="startDate" 
                                           value="${projectData?.startDate || ''}" required>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-end-date">End Date *</label>
                                    <input type="date" id="project-end-date" name="endDate" 
                                           value="${projectData?.endDate || ''}" required>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-status">Status</label>
                                    <select id="project-status" name="status">
                                        ${Object.entries(this.statuses).map(([key, status]) => `
                                            <option value="${key}" ${projectData?.status === key ? 'selected' : ''}>
                                                ${status.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Budget & Finance -->
                        <div class="form-section">
                            <h4><i class="fas fa-rupee-sign"></i> Budget & Finance</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="project-budget-type">Budget Type</label>
                                    <select id="project-budget-type" name="budgetType">
                                        ${Object.entries(this.budgetTypes).map(([key, type]) => `
                                            <option value="${key}" ${projectData?.budgetType === key ? 'selected' : ''}>
                                                ${type.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-budget">Budget Amount *</label>
                                    <div class="input-with-prefix">
                                        <span class="prefix">₹</span>
                                        <input type="number" id="project-budget" name="budget" 
                                               value="${projectData?.budget || ''}" min="0" step="0.01" required>
                                    </div>
                                </div>
                                <div class="form-group col-4">
                                    <label for="project-currency">Currency</label>
                                    <select id="project-currency" name="currency">
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Client Information -->
                        <div class="form-section">
                            <h4><i class="fas fa-building"></i> Client Information</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="project-client">Client</label>
                                    <select id="project-client" name="clientId">
                                        <option value="">Internal Project</option>
                                        <!-- Dynamically loaded -->
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="project-stakeholder">Stakeholder</label>
                                    <input type="text" id="project-stakeholder" name="stakeholder" 
                                           value="${projectData?.stakeholder || ''}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Team -->
                        <div class="form-section">
                            <h4><i class="fas fa-users"></i> Project Team</h4>
                            <div class="form-group">
                                <label for="project-manager">Project Manager *</label>
                                <select id="project-manager" name="managerId" required>
                                    <option value="">Select Manager</option>
                                    <!-- Dynamically loaded -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Team Members</label>
                                <div class="team-selector" id="team-selector">
                                    <!-- Multi-select team members -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> ${isEditing ? 'Update Project' : 'Create Project'}
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
                    this.selectedProjectId = null;
                }
            });
            
            modal.open();
            
            // Set up form handlers
            setTimeout(() => {
                this.setupProjectForm(isEditing);
            }, 100);
            
        } catch (error) {
            console.error('[Projects] Create form open failed:', error);
            Toast.show('Failed to open project form', 'error');
        }
    }
    
    /**
     * Generate project code
     */
    generateProjectCode() {
        const year = new Date().getFullYear().toString().slice(-2);
        const seq = String(this.projects.size + 1).padStart(4, '0');
        return `PRJ-${year}-${seq}`;
    }
    
    /**
     * Calculate project progress
     */
    calculateProgress(project) {
        if (!project.tasks || project.tasks.length === 0) return 0;
        const completed = project.tasks.filter(t => t.status === 'done').length;
        return Math.round((completed / project.tasks.length) * 100);
    }
    
    /**
     * Check if project is overdue
     */
    isProjectOverdue(project) {
        if (!project.endDate || project.status === 'completed' || project.status === 'cancelled') return false;
        return new Date(project.endDate) < new Date();
    }
    
    /**
     * Calculate days remaining
     */
    calculateDaysRemaining(project) {
        if (!project.endDate) return 0;
        const end = new Date(project.endDate);
        const now = new Date();
        const diff = end - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    
    /**
     * Calculate project duration in days
     */
    calculateDuration(project) {
        if (!project.startDate || !project.endDate) return 0;
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Calculate budget utilization percentage
     */
    calculateBudgetUtilization(project) {
        if (!project.budget || project.budget === 0) return 0;
        return Math.round(((project.spent || 0) / project.budget) * 100);
    }
    
    /**
     * Calculate project health score (0-100)
     */
    calculateHealthScore(project) {
        try {
            let score = 100;
            
            // Deduct for overdue
            if (project.isOverdue) {
                const daysOverdue = Math.abs(this.calculateDaysRemaining(project));
                score -= Math.min(daysOverdue * 2, 30);
            }
            
            // Deduct for budget overrun
            const budgetUtilization = this.calculateBudgetUtilization(project);
            if (budgetUtilization > 90) {
                score -= (budgetUtilization - 90) * 2;
            }
            
            // Deduct for low progress near deadline
            if (project.daysRemaining < 7 && project.progress < 80) {
                score -= (80 - project.progress) * 0.5;
            }
            
            // Bonus for completed milestones
            if (project.totalMilestones > 0) {
                const milestoneCompletion = (project.completedMilestones / project.totalMilestones) * 100;
                score += Math.min(milestoneCompletion * 0.2, 10);
            }
            
            return Math.max(0, Math.min(100, Math.round(score)));
            
        } catch (error) {
            return 50;
        }
    }
    
    /**
     * Get color for health score
     */
    getHealthColor(score) {
        if (score >= 80) return '#10B981';
        if (score >= 60) return '#F59E0B';
        if (score >= 40) return '#F97316';
        return '#DC2626';
    }
    
    /**
     * Check if project needs attention
     */
    checkNeedsAttention(project) {
        return project.isOverdue || 
               this.calculateBudgetUtilization(project) > 90 || 
               project.healthScore < 60 ||
               (project.daysRemaining < 7 && project.progress < 60);
    }
    
    /**
     * Lighten a color for progress bars
     */
    lightenColor(hex, percent) {
        try {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = Math.min(255, (num >> 16) + amt);
            const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
            const B = Math.min(255, (num & 0x0000FF) + amt);
            return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
        } catch (error) {
            return hex;
        }
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalProjects = 0;
            let activeProjects = 0;
            let atRiskProjects = 0;
            let completedThisMonth = 0;
            let totalBudget = 0;
            let totalSpent = 0;
            let onTimeDelivery = 0;
            let completedCount = 0;
            
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            
            this.projects.forEach(project => {
                totalProjects++;
                
                if (project.status === 'active') activeProjects++;
                if (project.status === 'at_risk' || project.needsAttention) atRiskProjects++;
                
                totalBudget += project.budget || 0;
                totalSpent += project.spent || 0;
                
                if (project.status === 'completed') {
                    completedCount++;
                    if (project.completedAt && new Date(project.completedAt) >= monthStart) {
                        completedThisMonth++;
                    }
                    if (project.endDate && project.completedAt && 
                        new Date(project.completedAt) <= new Date(project.endDate)) {
                        onTimeDelivery++;
                    }
                }
            });
            
            this.metrics.totalProjects = totalProjects;
            this.metrics.activeProjects = activeProjects;
            this.metrics.atRiskProjects = atRiskProjects;
            this.metrics.completedThisMonth = completedThisMonth;
            this.metrics.totalBudget = totalBudget;
            this.metrics.totalSpent = totalSpent;
            this.metrics.onTimeDelivery = completedCount > 0 ? 
                Math.round((onTimeDelivery / completedCount) * 100) : 0;
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Projects] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Create project via API
     */
    async createProject(projectData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/create`, projectData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            await Cache.delete(`${this.cachePrefix}list`);
            EventBus.emit('project:created', response.data);
            
            return response.data;
            
        } catch (error) {
            console.error('[Projects] Create failed:', error);
            throw error;
        }
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <h3>No Projects Found</h3>
                <p>Create your first project to get started</p>
                <button class="btn btn-primary" onclick="window.Global.Projects.openCreateProject()">
                    <i class="fas fa-plus"></i> Create Project
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
                    onclick="window.Global.Projects.loadProjects(${this.pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `
                    <button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                            onclick="window.Global.Projects.loadProjects(${i})">${i}</button>
                `;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        // Next
        html += `
            <button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                    onclick="window.Global.Projects.loadProjects(${this.pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Are default filters active
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.type === 'all' &&
               this.filters.priority === 'all' &&
               this.filters.client === 'all' &&
               this.filters.portfolio === 'all' &&
               !this.filters.search;
    }
    
    /**
     * Switch view
     */
    async switchView(view) {
        this.currentView = view;
        await this.render();
    }
    
    /**
     * Set up auto-refresh
     */
    setupAutoRefresh() {
        setInterval(async () => {
            await this.loadProjects();
            this.calculateMetrics();
        }, 120000); // Every 2 minutes
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
        EventBus.off('project:create');
        EventBus.off('project:update');
        EventBus.off('project:delete');
        
        console.log('[Projects] Module destroyed');
    }
}

// Singleton
const projects = new ProjectsModule();

// Exports
export { projects, ProjectsModule };
export default projects;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Projects = projects;
}
