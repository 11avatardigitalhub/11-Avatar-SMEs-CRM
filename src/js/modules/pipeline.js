/**
 * 11 AVATAR DIGITAL HUB - Pipeline/Kanban Module
 * Enterprise-grade sales pipeline management with Kanban board
 * Multi-tenant RBAC, real-time updates, drag-drop, 3D effects
 * 
 * @module Pipeline
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
 * Pipeline Module - Manages entire sales pipeline lifecycle
 * Handles stages, deals, drag-drop, filtering, analytics
 */
class PipelineModule {
    constructor() {
        // Module configuration
        this.moduleName = 'pipeline';
        this.apiEndpoint = '/api/pipeline';
        this.cachePrefix = 'pipeline_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        
        // Pipeline state
        this.pipelineId = null;
        this.stages = [];
        this.deals = new Map();
        this.filters = {
            search: '',
            stage: 'all',
            owner: 'all',
            value: 'all',
            probability: 'all',
            dateRange: null,
            tags: []
        };
        
        // UI state
        this.currentView = 'kanban'; // kanban | list | analytics
        this.selectedDealId = null;
        this.isDragging = false;
        this.dragDeal = null;
        this.dragSourceStage = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.scrollPosition = 0;
        
        // Real-time listeners
        this.unsubscribeFirestore = null;
        this.realtimeEnabled = false;
        
        // Performance tracking
        this.performanceMetrics = {
            loadTime: 0,
            renderTime: 0,
            lastUpdate: null,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // DOM element references (cached for performance)
        this.elements = {
            container: null,
            kanbanBoard: null,
            listView: null,
            analyticsView: null,
            searchInput: null,
            filterBar: null,
            stageColumns: new Map(),
            dealCards: new Map(),
            fabButton: null,
            contextMenu: null
        };
        
        // Initialize the module
        this.init();
    }
    
    /**
     * Initialize pipeline module
     * Sets up event listeners, loads initial data, renders UI
     */
    async init() {
        try {
            // Start performance timer
            const startTime = performance.now();
            
            console.log(`[Pipeline] Initializing pipeline module...`);
            
            // Check user permissions
            const canAccess = await Permissions.check('pipeline', 'read');
            if (!canAccess) {
                Toast.show('You do not have permission to access pipeline', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load pipeline configuration
            await this.loadPipelineConfig();
            
            // Load stages and deals
            await this.loadStages();
            await this.loadDeals();
            
            // Set up real-time listeners
            this.setupRealtimeListeners();
            
            // Render the appropriate view
            await this.renderPipeline();
            
            // Calculate performance metrics
            this.performanceMetrics.loadTime = performance.now() - startTime;
            
            console.log(`[Pipeline] Initialization complete in ${this.performanceMetrics.loadTime.toFixed(2)}ms`);
            
            // Emit ready event
            EventBus.emit('pipeline:ready', {
                pipelineId: this.pipelineId,
                stageCount: this.stages.length,
                dealCount: this.deals.size
            });
            
        } catch (error) {
            console.error('[Pipeline] Initialization failed:', error);
            Toast.show('Failed to load pipeline. Please try again.', 'error');
            EventBus.emit('pipeline:error', error);
        }
    }
    
    /**
     * Cache DOM element references for performance
     */
    cacheElements() {
        try {
            this.elements.container = document.getElementById('pipeline-container');
            this.elements.kanbanBoard = document.getElementById('kanban-board');
            this.elements.listView = document.getElementById('list-view');
            this.elements.analyticsView = document.getElementById('analytics-view');
            this.elements.searchInput = document.getElementById('pipeline-search');
            this.elements.filterBar = document.getElementById('pipeline-filters');
            this.elements.fabButton = document.getElementById('pipeline-fab');
            
            console.log('[Pipeline] DOM elements cached successfully');
        } catch (error) {
            console.error('[Pipeline] Failed to cache DOM elements:', error);
            throw new Error('Required DOM elements not found');
        }
    }
    
    /**
     * Set up all event listeners for the pipeline module
     */
    setupEventListeners() {
        try {
            // Search functionality with debounce
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', 
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            // Filter changes
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            // FAB button for new deal
            if (this.elements.fabButton) {
                this.elements.fabButton.addEventListener('click', () => {
                    this.openDealModal();
                });
            }
            
            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
            
            // Event bus listeners
            EventBus.on('pipeline:deal:create', this.createDeal.bind(this));
            EventBus.on('pipeline:deal:update', this.updateDeal.bind(this));
            EventBus.on('pipeline:deal:delete', this.deleteDeal.bind(this));
            EventBus.on('pipeline:deal:move', this.moveDeal.bind(this));
            EventBus.on('pipeline:stage:create', this.createStage.bind(this));
            EventBus.on('pipeline:stage:update', this.updateStage.bind(this));
            EventBus.on('pipeline:stage:delete', this.deleteStage.bind(this));
            EventBus.on('pipeline:refresh', this.refreshPipeline.bind(this));
            
            // Window resize handler for responsive adjustments
            window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 150));
            
            // Offline/online handlers
            window.addEventListener('offline', () => {
                Toast.show('You are offline. Changes will sync when connected.', 'warning');
            });
            window.addEventListener('online', () => {
                Toast.show('Back online! Syncing changes...', 'success');
                this.syncOfflineChanges();
            });
            
            console.log('[Pipeline] Event listeners set up successfully');
        } catch (error) {
            console.error('[Pipeline] Failed to set up event listeners:', error);
        }
    }
    
    /**
     * Load pipeline configuration from API or cache
     */
    async loadPipelineConfig() {
        try {
            // Check cache first
            const cachedConfig = await Cache.get(`${this.cachePrefix}config`);
            if (cachedConfig && Date.now() - cachedConfig.timestamp < this.cacheTimeout) {
                this.pipelineId = cachedConfig.data.pipelineId;
                this.performanceMetrics.cacheHits++;
                console.log('[Pipeline] Loaded configuration from cache');
                return;
            }
            
            // Fetch from API
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to load pipeline configuration');
            }
            
            // Store configuration
            this.pipelineId = response.data.pipelineId;
            
            // Cache the configuration
            await Cache.set(`${this.cachePrefix}config`, {
                pipelineId: this.pipelineId,
                ...response.data
            }, this.cacheTimeout);
            
            this.performanceMetrics.cacheMisses++;
            console.log('[Pipeline] Configuration loaded from API:', this.pipelineId);
            
        } catch (error) {
            console.error('[Pipeline] Failed to load configuration:', error);
            
            // Fall back to creating a new pipeline
            await this.createDefaultPipeline();
        }
    }
    
    /**
     * Create a default pipeline if none exists
     */
    async createDefaultPipeline() {
        try {
            console.log('[Pipeline] Creating default pipeline...');
            
            const defaultStages = [
                { name: 'Lead', order: 1, color: '#6B7280', icon: 'user-plus' },
                { name: 'Contacted', order: 2, color: '#3B82F6', icon: 'phone' },
                { name: 'Qualified', order: 3, color: '#8B5CF6', icon: 'check-circle' },
                { name: 'Proposal', order: 4, color: '#F59E0B', icon: 'file-text' },
                { name: 'Negotiation', order: 5, color: '#EF4444', icon: 'message-square' },
                { name: 'Won', order: 6, color: '#10B981', icon: 'trophy' },
                { name: 'Lost', order: 7, color: '#DC2626', icon: 'x-circle' }
            ];
            
            const response = await API.post(`${this.apiEndpoint}/create`, {
                name: 'Sales Pipeline',
                stages: defaultStages
            });
            
            if (response.success) {
                this.pipelineId = response.data.pipelineId;
                Toast.show('Default pipeline created successfully', 'success');
            } else {
                throw new Error(response.error || 'Failed to create pipeline');
            }
            
        } catch (error) {
            console.error('[Pipeline] Failed to create default pipeline:', error);
            Toast.show('Could not create pipeline. Please contact support.', 'error');
        }
    }
    
    /**
     * Load pipeline stages
     */
    async loadStages() {
        try {
            if (!this.pipelineId) {
                console.warn('[Pipeline] No pipeline ID available for loading stages');
                return;
            }
            
            // Check cache
            const cachedStages = await Cache.get(`${this.cachePrefix}stages_${this.pipelineId}`);
            if (cachedStages && Date.now() - cachedStages.timestamp < this.cacheTimeout) {
                this.stages = cachedStages.data;
                this.performanceMetrics.cacheHits++;
                console.log(`[Pipeline] Loaded ${this.stages.length} stages from cache`);
                return;
            }
            
            // Fetch from API
            const response = await API.get(`${this.apiEndpoint}/${this.pipelineId}/stages`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to load stages');
            }
            
            // Sort stages by order
            this.stages = response.data.sort((a, b) => a.order - b.order);
            
            // Cache stages
            await Cache.set(
                `${this.cachePrefix}stages_${this.pipelineId}`,
                this.stages,
                this.cacheTimeout
            );
            
            this.performanceMetrics.cacheMisses++;
            console.log(`[Pipeline] Loaded ${this.stages.length} stages from API`);
            
        } catch (error) {
            console.error('[Pipeline] Failed to load stages:', error);
            Toast.show('Failed to load pipeline stages', 'error');
        }
    }
    
    /**
     * Load all deals for the pipeline
     */
    async loadDeals(filters = {}) {
        try {
            if (!this.pipelineId) {
                console.warn('[Pipeline] No pipeline ID available for loading deals');
                return;
            }
            
            // Apply current filters
            const activeFilters = { ...this.filters, ...filters };
            
            // Check cache (only if no filters applied)
            const isDefaultFilters = Object.values(activeFilters).every(v => 
                v === null || v === '' || v === 'all' || (Array.isArray(v) && v.length === 0)
            );
            
            if (isDefaultFilters) {
                const cachedDeals = await Cache.get(`${this.cachePrefix}deals_${this.pipelineId}`);
                if (cachedDeals && Date.now() - cachedDeals.timestamp < this.cacheTimeout) {
                    this.deals = new Map(Object.entries(cachedDeals.data));
                    this.performanceMetrics.cacheHits++;
                    console.log(`[Pipeline] Loaded ${this.deals.size} deals from cache`);
                    return;
                }
            }
            
            // Build query parameters
            const queryParams = new URLSearchParams();
            if (activeFilters.stage && activeFilters.stage !== 'all') {
                queryParams.set('stage', activeFilters.stage);
            }
            if (activeFilters.owner && activeFilters.owner !== 'all') {
                queryParams.set('owner', activeFilters.owner);
            }
            if (activeFilters.search) {
                queryParams.set('search', activeFilters.search);
            }
            
            // Fetch from API
            const response = await API.get(
                `${this.apiEndpoint}/${this.pipelineId}/deals?${queryParams.toString()}`
            );
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load deals');
            }
            
            // Process deals and group by stage
            const dealsMap = new Map();
            response.data.forEach(deal => {
                dealsMap.set(deal.id, {
                    ...deal,
                    formattedValue: Formatters.currency(deal.value, deal.currency || 'INR'),
                    formattedDate: Formatters.date(deal.createdAt),
                    probabilityPercentage: `${deal.probability}%`,
                    ageInDays: this.calculateDealAge(deal.createdAt),
                    tags: deal.tags || []
                });
            });
            
            this.deals = dealsMap;
            
            // Cache deals if using default filters
            if (isDefaultFilters) {
                const dealsObject = Object.fromEntries(dealsMap);
                await Cache.set(
                    `${this.cachePrefix}deals_${this.pipelineId}`,
                    dealsObject,
                    this.cacheTimeout
                );
            }
            
            this.performanceMetrics.cacheMisses++;
            console.log(`[Pipeline] Loaded ${this.deals.size} deals from API`);
            
        } catch (error) {
            console.error('[Pipeline] Failed to load deals:', error);
            Toast.show('Failed to load deals', 'error');
        }
    }
    
    /**
     * Set up real-time Firestore listeners for live updates
     */
    setupRealtimeListeners() {
        try {
            // Only set up if Firebase is available and user is online
            if (!window.firebase || !navigator.onLine) {
                console.log('[Pipeline] Real-time updates not available');
                return;
            }
            
            const db = window.firebase.firestore();
            
            // Listen for deal changes
            this.unsubscribeFirestore = db
                .collection('pipelines')
                .doc(this.pipelineId)
                .collection('deals')
                .onSnapshot(
                    (snapshot) => {
                        this.handleRealtimeUpdate(snapshot);
                    },
                    (error) => {
                        console.error('[Pipeline] Real-time listener error:', error);
                        this.realtimeEnabled = false;
                    }
                );
            
            this.realtimeEnabled = true;
            console.log('[Pipeline] Real-time listeners set up successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to set up real-time listeners:', error);
            this.realtimeEnabled = false;
        }
    }
    
    /**
     * Handle real-time updates from Firestore
     */
    handleRealtimeUpdate(snapshot) {
        try {
            console.log('[Pipeline] Received real-time update');
            
            snapshot.docChanges().forEach((change) => {
                const dealData = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                
                switch (change.type) {
                    case 'added':
                        this.deals.set(dealData.id, dealData);
                        this.renderDealCard(dealData);
                        break;
                        
                    case 'modified':
                        this.deals.set(dealData.id, dealData);
                        this.updateDealCard(dealData);
                        break;
                        
                    case 'removed':
                        this.deals.delete(dealData.id);
                        this.removeDealCard(dealData.id);
                        break;
                }
            });
            
            // Update analytics if visible
            if (this.currentView === 'analytics') {
                this.updateAnalytics();
            }
            
            this.performanceMetrics.lastUpdate = new Date();
            
        } catch (error) {
            console.error('[Pipeline] Failed to handle real-time update:', error);
        }
    }
    
    /**
     * Render the pipeline based on current view
     */
    async renderPipeline() {
        try {
            const renderStart = performance.now();
            
            console.log(`[Pipeline] Rendering ${this.currentView} view...`);
            
            switch (this.currentView) {
                case 'kanban':
                    await this.renderKanbanBoard();
                    break;
                    
                case 'list':
                    await this.renderListView();
                    break;
                    
                case 'analytics':
                    await this.renderAnalyticsView();
                    break;
                    
                default:
                    await this.renderKanbanBoard();
            }
            
            this.performanceMetrics.renderTime = performance.now() - renderStart;
            
            console.log(`[Pipeline] Render complete in ${this.performanceMetrics.renderTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('[Pipeline] Failed to render pipeline:', error);
            Toast.show('Failed to render pipeline view', 'error');
        }
    }
    
    /**
     * Render the Kanban board view
     */
    async renderKanbanBoard() {
        try {
            if (!this.elements.kanbanBoard) {
                console.error('[Pipeline] Kanban board element not found');
                return;
            }
            
            // Clear existing content
            this.elements.kanbanBoard.innerHTML = '';
            this.elements.stageColumns.clear();
            this.elements.dealCards.clear();
            
            // Create stage columns
            this.stages.forEach(stage => {
                const columnElement = this.createStageColumn(stage);
                this.elements.kanbanBoard.appendChild(columnElement);
                this.elements.stageColumns.set(stage.id, columnElement);
            });
            
            // Add deals to appropriate columns
            this.deals.forEach(deal => {
                const stageId = deal.stageId || deal.stage;
                const column = this.elements.stageColumns.get(stageId);
                if (column) {
                    const dealList = column.querySelector('.kanban-deals');
                    const dealCard = this.createDealCard(deal);
                    dealList.appendChild(dealCard);
                    this.elements.dealCards.set(deal.id, dealCard);
                }
            });
            
            // Add stage totals
            this.updateStageTotals();
            
            // Set up drag and drop
            this.setupDragAndDrop();
            
            // Set up touch scrolling for mobile
            this.setupTouchScroll();
            
            console.log('[Pipeline] Kanban board rendered successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to render Kanban board:', error);
        }
    }
    
    /**
     * Create a stage column element
     */
    createStageColumn(stage) {
        try {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.id = `stage-${stage.id}`;
            column.dataset.stageId = stage.id;
            
            // Stage header
            const header = document.createElement('div');
            header.className = 'kanban-column-header';
            header.innerHTML = `
                <div class="stage-header-content">
                    <span class="stage-indicator" style="background-color: ${stage.color || '#D4AF37'}"></span>
                    <h3 class="stage-name">${this.escapeHtml(stage.name)}</h3>
                    <span class="stage-count" id="count-${stage.id}">0</span>
                </div>
                <div class="stage-actions">
                    <button class="btn-icon stage-menu-btn" aria-label="Stage options" data-stage-id="${stage.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            `;
            
            // Add click handler for stage menu
            const menuBtn = header.querySelector('.stage-menu-btn');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showStageContextMenu(stage, menuBtn);
            });
            
            // Deals container
            const dealsContainer = document.createElement('div');
            dealsContainer.className = 'kanban-deals';
            dealsContainer.dataset.stageId = stage.id;
            
            // Add deal button
            const addDealBtn = document.createElement('button');
            addDealBtn.className = 'kanban-add-deal';
            addDealBtn.innerHTML = `
                <i class="fas fa-plus"></i>
                <span>Add Deal</span>
            `;
            addDealBtn.addEventListener('click', () => {
                this.openDealModal(stage.id);
            });
            
            // Assemble column
            column.appendChild(header);
            column.appendChild(dealsContainer);
            column.appendChild(addDealBtn);
            
            return column;
            
        } catch (error) {
            console.error('[Pipeline] Failed to create stage column:', error);
            return document.createElement('div');
        }
    }
    
    /**
     * Create a deal card element with 3D effects
     */
    createDealCard(deal) {
        try {
            const card = document.createElement('div');
            card.className = 'deal-card glass-card-3d';
            card.id = `deal-${deal.id}`;
            card.dataset.dealId = deal.id;
            card.draggable = true;
            
            // Calculate card border color based on value or priority
            const borderColor = this.getDealBorderColor(deal);
            card.style.borderLeft = `4px solid ${borderColor}`;
            
            // Card content
            card.innerHTML = `
                <div class="deal-card-header">
                    <h4 class="deal-title">${this.escapeHtml(deal.title || deal.name)}</h4>
                    <div class="deal-actions">
                        <button class="btn-icon deal-menu-btn" aria-label="Deal options">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
                
                <div class="deal-card-body">
                    ${deal.company ? `
                        <div class="deal-company">
                            <i class="fas fa-building"></i>
                            <span>${this.escapeHtml(deal.company)}</span>
                        </div>
                    ` : ''}
                    
                    ${deal.contact ? `
                        <div class="deal-contact">
                            <i class="fas fa-user"></i>
                            <span>${this.escapeHtml(deal.contact)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="deal-value">
                        <i class="fas fa-rupee-sign"></i>
                        <strong>${deal.formattedValue || Formatters.currency(deal.value)}</strong>
                    </div>
                    
                    ${deal.probability ? `
                        <div class="deal-probability">
                            <div class="probability-bar">
                                <div class="probability-fill" style="width: ${deal.probability}%"></div>
                            </div>
                            <span class="probability-text">${deal.probability}%</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="deal-card-footer">
                    <div class="deal-meta">
                        ${deal.owner ? `
                            <span class="deal-owner" title="${this.escapeHtml(deal.owner)}">
                                <i class="fas fa-user-circle"></i>
                                ${this.escapeHtml(this.getInitials(deal.owner))}
                            </span>
                        ` : ''}
                        
                        <span class="deal-age" title="Created ${deal.formattedDate}">
                            <i class="fas fa-clock"></i>
                            ${deal.ageInDays}d
                        </span>
                    </div>
                    
                    ${deal.tags && deal.tags.length > 0 ? `
                        <div class="deal-tags">
                            ${deal.tags.slice(0, 2).map(tag => `
                                <span class="tag">${this.escapeHtml(tag)}</span>
                            `).join('')}
                            ${deal.tags.length > 2 ? `
                                <span class="tag tag-more">+${deal.tags.length - 2}</span>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Add event listeners
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.deal-menu-btn')) {
                    this.openDealDetail(deal);
                }
            });
            
            // Menu button
            const menuBtn = card.querySelector('.deal-menu-btn');
            if (menuBtn) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showDealContextMenu(deal, menuBtn);
                });
            }
            
            // Drag events
            card.addEventListener('dragstart', (e) => this.handleDragStart(e, deal));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            // Touch events for mobile
            card.addEventListener('touchstart', (e) => this.handleTouchStart(e, deal), { passive: true });
            card.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            
            // 3D tilt effect on hover
            card.addEventListener('mousemove', (e) => this.handleCardTilt(e, card));
            card.addEventListener('mouseleave', () => this.resetCardTilt(card));
            
            return card;
            
        } catch (error) {
            console.error('[Pipeline] Failed to create deal card:', error);
            return document.createElement('div');
        }
    }
    
    /**
     * Handle 3D card tilt effect on mouse move
     */
    handleCardTilt(event, card) {
        try {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `
                perspective(1000px) 
                rotateX(${rotateX}deg) 
                rotateY(${rotateY}deg) 
                scale3d(1.02, 1.02, 1.02)
            `;
            
        } catch (error) {
            console.error('[Pipeline] Error in card tilt effect:', error);
        }
    }
    
    /**
     * Reset card tilt on mouse leave
     */
    resetCardTilt(card) {
        try {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
            card.style.transition = 'transform 0.3s ease';
        } catch (error) {
            console.error('[Pipeline] Error resetting card tilt:', error);
        }
    }
    
    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop() {
        try {
            const columns = document.querySelectorAll('.kanban-deals');
            
            columns.forEach(column => {
                column.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    column.classList.add('drag-over');
                });
                
                column.addEventListener('dragleave', () => {
                    column.classList.remove('drag-over');
                });
                
                column.addEventListener('drop', (e) => {
                    e.preventDefault();
                    column.classList.remove('drag-over');
                    
                    if (this.dragDeal) {
                        const targetStageId = column.dataset.stageId;
                        this.handleDealDrop(this.dragDeal, this.dragSourceStage, targetStageId);
                    }
                });
            });
            
            console.log('[Pipeline] Drag and drop set up successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to set up drag and drop:', error);
        }
    }
    
    /**
     * Handle drag start event
     */
    handleDragStart(event, deal) {
        try {
            this.isDragging = true;
            this.dragDeal = deal;
            this.dragSourceStage = deal.stageId || deal.stage;
            
            event.target.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', deal.id);
            
            // Set drag image (optional)
            const dragImage = event.target.cloneNode(true);
            dragImage.style.opacity = '0.8';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-9999px';
            document.body.appendChild(dragImage);
            event.dataTransfer.setDragImage(dragImage, 50, 50);
            
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
            
        } catch (error) {
            console.error('[Pipeline] Error in drag start:', error);
        }
    }
    
    /**
     * Handle drag end event
     */
    handleDragEnd(event) {
        try {
            this.isDragging = false;
            event.target.classList.remove('dragging');
            
            // Clear drag data
            this.dragDeal = null;
            this.dragSourceStage = null;
            
        } catch (error) {
            console.error('[Pipeline] Error in drag end:', error);
        }
    }
    
    /**
     * Handle deal drop on a stage
     */
    async handleDealDrop(deal, sourceStageId, targetStageId) {
        try {
            // Validate drop
            if (sourceStageId === targetStageId) {
                console.log('[Pipeline] Deal dropped on same stage, no action needed');
                return;
            }
            
            // Check permissions
            const canMove = await Permissions.check('pipeline', 'update');
            if (!canMove) {
                Toast.show('You do not have permission to move deals', 'error');
                return;
            }
            
            console.log(`[Pipeline] Moving deal ${deal.id} from stage ${sourceStageId} to ${targetStageId}`);
            
            // Update deal stage
            const updatedDeal = {
                ...deal,
                stageId: targetStageId,
                stage: targetStageId,
                updatedAt: new Date().toISOString(),
                movedAt: new Date().toISOString()
            };
            
            // Save to API
            const response = await API.put(
                `${this.apiEndpoint}/${this.pipelineId}/deals/${deal.id}`,
                updatedDeal
            );
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to move deal');
            }
            
            // Update local state
            this.deals.set(deal.id, updatedDeal);
            
            // Update UI
            await this.renderKanbanBoard();
            
            // Track analytics event
            this.trackDealMovement(deal, sourceStageId, targetStageId);
            
            // Show success message
            const sourceStage = this.stages.find(s => s.id === sourceStageId);
            const targetStage = this.stages.find(s => s.id === targetStageId);
            
            Toast.show(
                `Deal moved from ${sourceStage?.name} to ${targetStage?.name}`,
                'success'
            );
            
            // Emit event
            EventBus.emit('pipeline:deal:moved', {
                deal,
                sourceStageId,
                targetStageId
            });
            
        } catch (error) {
            console.error('[Pipeline] Failed to move deal:', error);
            Toast.show('Failed to move deal. Please try again.', 'error');
        }
    }
    
    /**
     * Set up touch scrolling for mobile devices
     */
    setupTouchScroll() {
        try {
            const board = this.elements.kanbanBoard;
            if (!board) return;
            
            let isDown = false;
            let startX;
            let scrollLeft;
            
            board.addEventListener('mousedown', (e) => {
                if (e.target === board || e.target.classList.contains('kanban-deals')) {
                    isDown = true;
                    board.classList.add('active-scroll');
                    startX = e.pageX - board.offsetLeft;
                    scrollLeft = board.scrollLeft;
                }
            });
            
            board.addEventListener('mouseleave', () => {
                isDown = false;
                board.classList.remove('active-scroll');
            });
            
            board.addEventListener('mouseup', () => {
                isDown = false;
                board.classList.remove('active-scroll');
            });
            
            board.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - board.offsetLeft;
                const walk = (x - startX) * 2;
                board.scrollLeft = scrollLeft - walk;
            });
            
            console.log('[Pipeline] Touch scroll set up successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to set up touch scroll:', error);
        }
    }
    
    /**
     * Render the list view
     */
    async renderListView() {
        try {
            if (!this.elements.listView) {
                console.error('[Pipeline] List view element not found');
                return;
            }
            
            this.elements.listView.innerHTML = '';
            
            // Create table
            const table = document.createElement('table');
            table.className = 'pipeline-table';
            table.setAttribute('role', 'grid');
            table.setAttribute('aria-label', 'Pipeline deals list');
            
            // Table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th scope="col"><input type="checkbox" id="select-all-deals" aria-label="Select all deals"></th>
                    <th scope="col">Deal</th>
                    <th scope="col">Company</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Value</th>
                    <th scope="col">Probability</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Age</th>
                    <th scope="col">Actions</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // Table body
            const tbody = document.createElement('tbody');
            
            this.deals.forEach(deal => {
                const row = document.createElement('tr');
                row.className = 'deal-row';
                row.dataset.dealId = deal.id;
                
                const stage = this.stages.find(s => s.id === (deal.stageId || deal.stage));
                const stageColor = stage?.color || '#D4AF37';
                
                row.innerHTML = `
                    <td>
                        <input type="checkbox" class="deal-select" data-deal-id="${deal.id}" aria-label="Select deal">
                    </td>
                    <td class="deal-name-cell">
                        <span class="deal-status-indicator" style="background-color: ${stageColor}"></span>
                        <span class="deal-name">${this.escapeHtml(deal.title || deal.name)}</span>
                    </td>
                    <td>${this.escapeHtml(deal.company || '-')}</td>
                    <td>${this.escapeHtml(deal.contact || '-')}</td>
                    <td>
                        <span class="stage-badge" style="background-color: ${stageColor}20; color: ${stageColor}">
                            ${stage?.name || 'Unknown'}
                        </span>
                    </td>
                    <td class="text-right">${deal.formattedValue || Formatters.currency(deal.value)}</td>
                    <td>
                        <div class="probability-cell">
                            <div class="probability-bar small">
                                <div class="probability-fill" style="width: ${deal.probability || 0}%"></div>
                            </div>
                            <span>${deal.probability || 0}%</span>
                        </div>
                    </td>
                    <td>${this.escapeHtml(deal.owner || '-')}</td>
                    <td>${deal.ageInDays}d</td>
                    <td class="actions-cell">
                        <button class="btn-icon edit-deal" title="Edit deal">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-deal" title="Delete deal">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                // Add event listeners
                row.addEventListener('click', () => this.openDealDetail(deal));
                
                const editBtn = row.querySelector('.edit-deal');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openDealModal(null, deal);
                });
                
                const deleteBtn = row.querySelector('.delete-deal');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.confirmDeleteDeal(deal);
                });
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            this.elements.listView.appendChild(table);
            
            // Select all functionality
            const selectAll = document.getElementById('select-all-deals');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    const checkboxes = document.querySelectorAll('.deal-select');
                    checkboxes.forEach(cb => cb.checked = e.target.checked);
                });
            }
            
            console.log('[Pipeline] List view rendered successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to render list view:', error);
        }
    }
    
    /**
     * Render analytics view with charts
     */
    async renderAnalyticsView() {
        try {
            if (!this.elements.analyticsView) {
                console.error('[Pipeline] Analytics view element not found');
                return;
            }
            
            // Calculate analytics data
            const analytics = this.calculatePipelineAnalytics();
            
            this.elements.analyticsView.innerHTML = `
                <div class="analytics-grid">
                    <!-- Summary Cards -->
                    <div class="analytics-summary">
                        <div class="analytics-card">
                            <div class="analytics-icon" style="background: linear-gradient(135deg, #3B82F6, #2563EB)">
                                <i class="fas fa-briefcase"></i>
                            </div>
                            <div class="analytics-data">
                                <h4>Total Deals</h4>
                                <div class="analytics-value">${analytics.totalDeals}</div>
                            </div>
                        </div>
                        
                        <div class="analytics-card">
                            <div class="analytics-icon" style="background: linear-gradient(135deg, #10B981, #059669)">
                                <i class="fas fa-rupee-sign"></i>
                            </div>
                            <div class="analytics-data">
                                <h4>Pipeline Value</h4>
                                <div class="analytics-value">${Formatters.currency(analytics.totalValue)}</div>
                            </div>
                        </div>
                        
                        <div class="analytics-card">
                            <div class="analytics-icon" style="background: linear-gradient(135deg, #F59E0B, #D97706)">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="analytics-data">
                                <h4>Weighted Value</h4>
                                <div class="analytics-value">${Formatters.currency(analytics.weightedValue)}</div>
                            </div>
                        </div>
                        
                        <div class="analytics-card">
                            <div class="analytics-icon" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED)">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div class="analytics-data">
                                <h4>Win Rate</h4>
                                <div class="analytics-value">${analytics.winRate.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Stage Distribution Chart -->
                    <div class="analytics-chart">
                        <h3>Stage Distribution</h3>
                        <div class="chart-container" id="stage-distribution-chart">
                            ${this.renderStageDistribution(analytics.stageDistribution)}
                        </div>
                    </div>
                    
                    <!-- Value by Stage -->
                    <div class="analytics-chart">
                        <h3>Value by Stage</h3>
                        <div class="chart-container" id="value-by-stage-chart">
                            ${this.renderValueByStage(analytics.valueByStage)}
                        </div>
                    </div>
                    
                    <!-- Recent Activity -->
                    <div class="analytics-activity">
                        <h3>Recent Activity</h3>
                        <div class="activity-list">
                            ${this.renderRecentActivity(analytics.recentActivity)}
                        </div>
                    </div>
                    
                    <!-- Conversion Funnel -->
                    <div class="analytics-funnel">
                        <h3>Conversion Funnel</h3>
                        <div class="funnel-container">
                            ${this.renderConversionFunnel(analytics.funnelData)}
                        </div>
                    </div>
                </div>
            `;
            
            console.log('[Pipeline] Analytics view rendered successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to render analytics view:', error);
        }
    }
    
    /**
     * Calculate pipeline analytics data
     */
    calculatePipelineAnalytics() {
        try {
            const analytics = {
                totalDeals: this.deals.size,
                totalValue: 0,
                weightedValue: 0,
                winRate: 0,
                stageDistribution: {},
                valueByStage: {},
                recentActivity: [],
                funnelData: []
            };
            
            let wonDeals = 0;
            let lostDeals = 0;
            
            // Initialize stage data
            this.stages.forEach(stage => {
                analytics.stageDistribution[stage.id] = {
                    name: stage.name,
                    count: 0,
                    color: stage.color
                };
                analytics.valueByStage[stage.id] = {
                    name: stage.name,
                    value: 0,
                    color: stage.color
                };
            });
            
            // Calculate metrics
            this.deals.forEach(deal => {
                const stageId = deal.stageId || deal.stage;
                const value = parseFloat(deal.value) || 0;
                const probability = parseFloat(deal.probability) || 0;
                
                analytics.totalValue += value;
                analytics.weightedValue += (value * probability / 100);
                
                // Stage distribution
                if (analytics.stageDistribution[stageId]) {
                    analytics.stageDistribution[stageId].count++;
                    analytics.valueByStage[stageId].value += value;
                }
                
                // Win/loss tracking
                const stage = this.stages.find(s => s.id === stageId);
                if (stage?.name.toLowerCase() === 'won') wonDeals++;
                if (stage?.name.toLowerCase() === 'lost') lostDeals++;
                
                // Recent activity
                if (deal.updatedAt) {
                    analytics.recentActivity.push({
                        dealId: deal.id,
                        dealName: deal.title || deal.name,
                        action: 'updated',
                        timestamp: deal.updatedAt,
                        formattedTime: Formatters.relativeTime(deal.updatedAt)
                    });
                }
            });
            
            // Calculate win rate
            const totalClosed = wonDeals + lostDeals;
            analytics.winRate = totalClosed > 0 ? (wonDeals / totalClosed * 100) : 0;
            
            // Sort recent activity by timestamp
            analytics.recentActivity.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            analytics.recentActivity = analytics.recentActivity.slice(0, 10);
            
            // Calculate funnel data
            this.stages.forEach(stage => {
                if (analytics.stageDistribution[stage.id]) {
                    analytics.funnelData.push({
                        stage: stage.name,
                        count: analytics.stageDistribution[stage.id].count,
                        value: analytics.valueByStage[stage.id].value,
                        color: stage.color
                    });
                }
            });
            
            return analytics;
            
        } catch (error) {
            console.error('[Pipeline] Failed to calculate analytics:', error);
            return {
                totalDeals: 0,
                totalValue: 0,
                weightedValue: 0,
                winRate: 0,
                stageDistribution: {},
                valueByStage: {},
                recentActivity: [],
                funnelData: []
            };
        }
    }
    
    /**
     * Render stage distribution chart (horizontal bars)
     */
    renderStageDistribution(distribution) {
        try {
            const maxCount = Math.max(...Object.values(distribution).map(d => d.count), 1);
            
            let html = '<div class="horizontal-bars">';
            
            Object.entries(distribution).forEach(([stageId, data]) => {
                const percentage = (data.count / maxCount * 100);
                html += `
                    <div class="bar-item">
                        <div class="bar-label">
                            <span class="bar-name">${this.escapeHtml(data.name)}</span>
                            <span class="bar-count">${data.count}</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${percentage}%; background-color: ${data.color}">
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
            
        } catch (error) {
            console.error('[Pipeline] Failed to render stage distribution:', error);
            return '<p>Failed to load chart</p>';
        }
    }
    
    /**
     * Open deal creation/edit modal
     */
    async openDealModal(stageId = null, existingDeal = null) {
        try {
            // Check permissions
            const action = existingDeal ? 'update' : 'create';
            const canModify = await Permissions.check('pipeline', action);
            if (!canModify) {
                Toast.show(`You do not have permission to ${action} deals`, 'error');
                return;
            }
            
            const isEditing = !!existingDeal;
            const title = isEditing ? 'Edit Deal' : 'Create New Deal';
            
            // Build form HTML
            const formHtml = `
                <form id="deal-form" class="deal-form">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label for="deal-title">Deal Title *</label>
                            <input type="text" id="deal-title" name="title" 
                                   value="${isEditing ? this.escapeHtml(existingDeal.title || existingDeal.name) : ''}"
                                   placeholder="Enter deal title" required maxlength="200">
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-company">Company</label>
                            <input type="text" id="deal-company" name="company" 
                                   value="${isEditing ? this.escapeHtml(existingDeal.company || '') : ''}"
                                   placeholder="Company name">
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-contact">Contact</label>
                            <input type="text" id="deal-contact" name="contact" 
                                   value="${isEditing ? this.escapeHtml(existingDeal.contact || '') : ''}"
                                   placeholder="Contact person">
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-value">Deal Value *</label>
                            <div class="input-with-prefix">
                                <span class="prefix">₹</span>
                                <input type="number" id="deal-value" name="value" 
                                       value="${isEditing ? (existingDeal.value || '') : ''}"
                                       placeholder="0.00" required min="0" step="0.01">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-currency">Currency</label>
                            <select id="deal-currency" name="currency">
                                <option value="INR" ${isEditing && existingDeal.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
                                <option value="USD" ${isEditing && existingDeal.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                <option value="EUR" ${isEditing && existingDeal.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                                <option value="GBP" ${isEditing && existingDeal.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-stage">Stage *</label>
                            <select id="deal-stage" name="stageId" required>
                                ${this.stages.map(stage => `
                                    <option value="${stage.id}" 
                                        ${isEditing && (existingDeal.stageId || existingDeal.stage) === stage.id ? 'selected' : ''}
                                        ${!isEditing && stageId === stage.id ? 'selected' : ''}>
                                        ${this.escapeHtml(stage.name)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-probability">Probability (%)</label>
                            <input type="range" id="deal-probability" name="probability" 
                                   value="${isEditing ? (existingDeal.probability || 50) : 50}"
                                   min="0" max="100" step="5">
                            <output for="deal-probability" id="probability-output">
                                ${isEditing ? (existingDeal.probability || 50) : 50}%
                            </output>
                        </div>
                        
                        <div class="form-group">
                            <label for="deal-owner">Owner</label>
                            <select id="deal-owner" name="owner">
                                <option value="">Select owner</option>
                                <!-- Populated dynamically -->
                            </select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="deal-description">Description</label>
                            <textarea id="deal-description" name="description" rows="3" 
                                      placeholder="Describe the deal...">${isEditing ? this.escapeHtml(existingDeal.description || '') : ''}</textarea>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>Tags</label>
                            <div class="tags-input" id="deal-tags-input">
                                <input type="text" id="tag-input" placeholder="Type and press Enter to add tag">
                                <div class="tags-list" id="tags-list"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-deal">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            ${isEditing ? 'Update Deal' : 'Create Deal'}
                        </button>
                    </div>
                </form>
            `;
            
            // Open modal
            const modal = new Modal({
                title: title,
                content: formHtml,
                size: 'large',
                onClose: () => {
                    // Clean up event listeners
                    const form = document.getElementById('deal-form');
                    if (form) {
                        form.removeEventListener('submit', this.handleDealFormSubmit);
                    }
                }
            });
            
            modal.open();
            
            // Set up form after modal is rendered
            setTimeout(() => {
                this.setupDealForm(isEditing, existingDeal);
            }, 100);
            
        } catch (error) {
            console.error('[Pipeline] Failed to open deal modal:', error);
            Toast.show('Failed to open deal form', 'error');
        }
    }
    
    /**
     * Handle deal form submission
     */
    async handleDealFormSubmit(event, isEditing, dealId) {
        try {
            event.preventDefault();
            
            const form = event.target;
            const formData = new FormData(form);
            
            // Validate required fields
            const title = formData.get('title').trim();
            const value = parseFloat(formData.get('value'));
            
            if (!title) {
                Toast.show('Please enter a deal title', 'warning');
                return;
            }
            
            if (isNaN(value) || value < 0) {
                Toast.show('Please enter a valid deal value', 'warning');
                return;
            }
            
            // Build deal object
            const dealData = {
                title: title,
                company: formData.get('company').trim(),
                contact: formData.get('contact').trim(),
                value: value,
                currency: formData.get('currency'),
                stageId: formData.get('stageId'),
                probability: parseInt(formData.get('probability')),
                owner: formData.get('owner'),
                description: formData.get('description').trim(),
                tags: this.getTagsFromInput(),
                updatedAt: new Date().toISOString()
            };
            
            // Add created date for new deals
            if (!isEditing) {
                dealData.createdAt = new Date().toISOString();
                dealData.createdBy = State.getCurrentUser()?.id || 'system';
            }
            
            // Save deal
            if (isEditing) {
                await this.updateDeal({ id: dealId, ...dealData });
            } else {
                await this.createDeal(dealData);
            }
            
            // Close modal
            Modal.close();
            
            // Refresh pipeline
            await this.loadDeals();
            await this.renderPipeline();
            
        } catch (error) {
            console.error('[Pipeline] Failed to handle form submission:', error);
            Toast.show('Failed to save deal', 'error');
        }
    }
    
    /**
     * Create a new deal
     */
    async createDeal(dealData) {
        try {
            // Add pipeline ID
            dealData.pipelineId = this.pipelineId;
            
            // Save to API
            const response = await API.post(`${this.apiEndpoint}/${this.pipelineId}/deals`, dealData);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to create deal');
            }
            
            // Add to local state
            const newDeal = {
                id: response.data.id,
                ...dealData,
                formattedValue: Formatters.currency(dealData.value, dealData.currency),
                formattedDate: Formatters.date(dealData.createdAt),
                probabilityPercentage: `${dealData.probability}%`,
                ageInDays: 0,
                tags: dealData.tags || []
            };
            
            this.deals.set(newDeal.id, newDeal);
            
            // Clear cache
            await Cache.delete(`${this.cachePrefix}deals_${this.pipelineId}`);
            
            // Show success
            Toast.show('Deal created successfully', 'success');
            
            // Emit event
            EventBus.emit('pipeline:deal:created', newDeal);
            
            return newDeal;
            
        } catch (error) {
            console.error('[Pipeline] Failed to create deal:', error);
            Toast.show('Failed to create deal. Please try again.', 'error');
            return null;
        }
    }
    
    /**
     * Update an existing deal
     */
    async updateDeal(dealData) {
        try {
            const dealId = dealData.id;
            if (!dealId) {
                throw new Error('Deal ID is required for update');
            }
            
            // Save to API
            const response = await API.put(
                `${this.apiEndpoint}/${this.pipelineId}/deals/${dealId}`,
                dealData
            );
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to update deal');
            }
            
            // Update local state
            const existingDeal = this.deals.get(dealId);
            if (existingDeal) {
                const updatedDeal = {
                    ...existingDeal,
                    ...dealData,
                    formattedValue: Formatters.currency(
                        dealData.value || existingDeal.value,
                        dealData.currency || existingDeal.currency
                    ),
                    probabilityPercentage: `${dealData.probability || existingDeal.probability}%`
                };
                
                this.deals.set(dealId, updatedDeal);
            }
            
            // Clear cache
            await Cache.delete(`${this.cachePrefix}deals_${this.pipelineId}`);
            
            // Show success
            Toast.show('Deal updated successfully', 'success');
            
            // Emit event
            EventBus.emit('pipeline:deal:updated', dealData);
            
        } catch (error) {
            console.error('[Pipeline] Failed to update deal:', error);
            Toast.show('Failed to update deal. Please try again.', 'error');
        }
    }
    
    /**
     * Delete a deal with confirmation
     */
    async deleteDeal(dealId) {
        try {
            const deal = this.deals.get(dealId);
            if (!deal) {
                throw new Error('Deal not found');
            }
            
            // Confirm deletion
            const confirmed = await this.confirmAction(
                'Delete Deal',
                `Are you sure you want to delete "${deal.title || deal.name}"? This action cannot be undone.`
            );
            
            if (!confirmed) return;
            
            // Delete from API
            const response = await API.delete(
                `${this.apiEndpoint}/${this.pipelineId}/deals/${dealId}`
            );
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to delete deal');
            }
            
            // Remove from local state
            this.deals.delete(dealId);
            
            // Remove from UI
            this.removeDealCard(dealId);
            
            // Clear cache
            await Cache.delete(`${this.cachePrefix}deals_${this.pipelineId}`);
            
            // Show success
            Toast.show('Deal deleted successfully', 'success');
            
            // Emit event
            EventBus.emit('pipeline:deal:deleted', { dealId, deal });
            
            // Update totals
            this.updateStageTotals();
            
        } catch (error) {
            console.error('[Pipeline] Failed to delete deal:', error);
            Toast.show('Failed to delete deal. Please try again.', 'error');
        }
    }
    
    /**
     * Show confirmation dialog
     */
    async confirmAction(title, message) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title: title,
                content: `
                    <div class="confirm-dialog">
                        <p>${message}</p>
                        <div class="confirm-actions">
                            <button class="btn btn-secondary confirm-cancel">Cancel</button>
                            <button class="btn btn-danger confirm-ok">Delete</button>
                        </div>
                    </div>
                `,
                size: 'small',
                onClose: () => resolve(false)
            });
            
            modal.open();
            
            // Add event listeners after render
            setTimeout(() => {
                const cancelBtn = document.querySelector('.confirm-cancel');
                const okBtn = document.querySelector('.confirm-ok');
                
                cancelBtn?.addEventListener('click', () => {
                    modal.close();
                    resolve(false);
                });
                
                okBtn?.addEventListener('click', () => {
                    modal.close();
                    resolve(true);
                });
            }, 100);
        });
    }
    
    /**
     * Update stage deal counts
     */
    updateStageTotals() {
        try {
            const counts = new Map();
            
            // Count deals per stage
            this.deals.forEach(deal => {
                const stageId = deal.stageId || deal.stage;
                counts.set(stageId, (counts.get(stageId) || 0) + 1);
            });
            
            // Update UI
            this.stages.forEach(stage => {
                const countElement = document.getElementById(`count-${stage.id}`);
                if (countElement) {
                    countElement.textContent = counts.get(stage.id) || 0;
                }
            });
            
        } catch (error) {
            console.error('[Pipeline] Failed to update stage totals:', error);
        }
    }
    
    /**
     * Track deal movement for analytics
     */
    async trackDealMovement(deal, fromStageId, toStageId) {
        try {
            const eventData = {
                dealId: deal.id,
                dealName: deal.title || deal.name,
                fromStage: fromStageId,
                toStage: toStageId,
                value: deal.value,
                timestamp: new Date().toISOString(),
                userId: State.getCurrentUser()?.id
            };
            
            // Log to analytics
            await API.post('/api/analytics/events', {
                event: 'deal_moved',
                data: eventData
            });
            
            console.log('[Pipeline] Deal movement tracked:', eventData);
            
        } catch (error) {
            console.error('[Pipeline] Failed to track deal movement:', error);
            // Non-critical, don't show error to user
        }
    }
    
    /**
     * Calculate deal age in days
     */
    calculateDealAge(createdAt) {
        try {
            if (!createdAt) return 0;
            
            const created = new Date(createdAt);
            const now = new Date();
            const diffTime = Math.abs(now - created);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
            
        } catch (error) {
            console.error('[Pipeline] Failed to calculate deal age:', error);
            return 0;
        }
    }
    
    /**
     * Get border color based on deal properties
     */
    getDealBorderColor(deal) {
        try {
            // Color based on probability
            const probability = parseInt(deal.probability) || 0;
            
            if (probability >= 80) return '#10B981'; // Green - Hot
            if (probability >= 60) return '#3B82F6'; // Blue - Warm
            if (probability >= 40) return '#F59E0B'; // Yellow - Lukewarm
            if (probability >= 20) return '#F97316'; // Orange - Cool
            return '#6B7280'; // Gray - Cold
            
        } catch (error) {
            console.error('[Pipeline] Failed to get border color:', error);
            return '#D4AF37'; // Default gold
        }
    }
    
    /**
     * Get initials from name
     */
    getInitials(name) {
        try {
            if (!name) return '?';
            
            return name
                .split(' ')
                .map(part => part.charAt(0))
                .join('')
                .toUpperCase()
                .substring(0, 2);
                
        } catch (error) {
            return '?';
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Debounce helper function
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
     * Sync offline changes
     */
    async syncOfflineChanges() {
        try {
            const offlineChanges = await Cache.get('pipeline_offline_changes');
            if (!offlineChanges || !offlineChanges.data || offlineChanges.data.length === 0) {
                console.log('[Pipeline] No offline changes to sync');
                return;
            }
            
            console.log(`[Pipeline] Syncing ${offlineChanges.data.length} offline changes...`);
            
            let syncedCount = 0;
            
            for (const change of offlineChanges.data) {
                try {
                    switch (change.type) {
                        case 'create':
                            await this.createDeal(change.data);
                            break;
                        case 'update':
                            await this.updateDeal(change.data);
                            break;
                        case 'delete':
                            await this.deleteDeal(change.dealId);
                            break;
                    }
                    syncedCount++;
                } catch (error) {
                    console.error(`[Pipeline] Failed to sync change:`, error);
                }
            }
            
            // Clear synced changes
            await Cache.delete('pipeline_offline_changes');
            
            Toast.show(`Synced ${syncedCount} offline changes`, 'success');
            console.log(`[Pipeline] Synced ${syncedCount} changes successfully`);
            
        } catch (error) {
            console.error('[Pipeline] Failed to sync offline changes:', error);
            Toast.show('Failed to sync some offline changes', 'warning');
        }
    }
    
    /**
     * Refresh entire pipeline
     */
    async refreshPipeline() {
        try {
            console.log('[Pipeline] Refreshing pipeline...');
            
            await this.loadStages();
            await this.loadDeals();
            await this.renderPipeline();
            
            Toast.show('Pipeline refreshed', 'info');
            
        } catch (error) {
            console.error('[Pipeline] Failed to refresh pipeline:', error);
            Toast.show('Failed to refresh pipeline', 'error');
        }
    }
    
    /**
     * Handle window resize for responsive layout
     */
    handleResize() {
        try {
            // Adjust Kanban board scroll position
            if (this.currentView === 'kanban' && this.elements.kanbanBoard) {
                const boardWidth = this.elements.kanbanBoard.scrollWidth;
                const viewportWidth = window.innerWidth;
                
                // Center the board if it's smaller than viewport
                if (boardWidth < viewportWidth) {
                    this.elements.kanbanBoard.style.justifyContent = 'center';
                } else {
                    this.elements.kanbanBoard.style.justifyContent = 'flex-start';
                }
            }
            
        } catch (error) {
            console.error('[Pipeline] Failed to handle resize:', error);
        }
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        try {
            // Only handle if pipeline is active
            if (!document.getElementById('pipeline-container')) return;
            
            // Ctrl/Cmd + N - New deal
            if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
                event.preventDefault();
                this.openDealModal();
            }
            
            // Ctrl/Cmd + F - Focus search
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                this.elements.searchInput?.focus();
            }
            
            // Escape - Clear search/filters
            if (event.key === 'Escape') {
                this.clearFilters();
            }
            
        } catch (error) {
            console.error('[Pipeline] Failed to handle keyboard shortcut:', error);
        }
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        try {
            this.filters = {
                search: '',
                stage: 'all',
                owner: 'all',
                value: 'all',
                probability: 'all',
                dateRange: null,
                tags: []
            };
            
            // Reset search input
            if (this.elements.searchInput) {
                this.elements.searchInput.value = '';
            }
            
            // Reset filter selects
            if (this.elements.filterBar) {
                const selects = this.elements.filterBar.querySelectorAll('select');
                selects.forEach(select => select.value = 'all');
            }
            
            // Reload deals with cleared filters
            this.loadDeals().then(() => this.renderPipeline());
            
            Toast.show('Filters cleared', 'info');
            
        } catch (error) {
            console.error('[Pipeline] Failed to clear filters:', error);
        }
    }
    
    /**
     * Clean up module resources
     */
    destroy() {
        try {
            console.log('[Pipeline] Destroying pipeline module...');
            
            // Unsubscribe from real-time listeners
            if (this.unsubscribeFirestore) {
                this.unsubscribeFirestore();
                console.log('[Pipeline] Unsubscribed from Firestore');
            }
            
            // Remove event bus listeners
            EventBus.off('pipeline:deal:create');
            EventBus.off('pipeline:deal:update');
            EventBus.off('pipeline:deal:delete');
            EventBus.off('pipeline:deal:move');
            EventBus.off('pipeline:stage:create');
            EventBus.off('pipeline:stage:update');
            EventBus.off('pipeline:stage:delete');
            EventBus.off('pipeline:refresh');
            
            // Remove window listeners
            window.removeEventListener('resize', this.handleResize);
            window.removeEventListener('offline', () => {});
            window.removeEventListener('online', () => {});
            
            // Clear DOM references
            this.elements.container = null;
            this.elements.kanbanBoard = null;
            this.elements.stageColumns.clear();
            this.elements.dealCards.clear();
            
            // Clear state
            this.stages = [];
            this.deals.clear();
            
            console.log('[Pipeline] Module destroyed successfully');
            
        } catch (error) {
            console.error('[Pipeline] Failed to destroy module:', error);
        }
    }
}

// Export as singleton instance
const pipeline = new PipelineModule();

// Export for use in other modules
export { pipeline, PipelineModule };

// Export to global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Pipeline = pipeline;
    window.Global.PipelineModule = PipelineModule;
}

// Default export
export default pipeline;
