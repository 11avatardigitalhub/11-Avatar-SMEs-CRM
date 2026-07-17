/**
 * 11 AVATAR DIGITAL HUB - Kanban Board Component
 * Enterprise-grade reusable drag-and-drop Kanban board
 * Multi-view, touch-optimized, 3D effects, real-time collaboration
 * 
 * @component KanbanBoard
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Toast } from './toast.js';

/**
 * KanbanBoard - Universal drag-drop Kanban component
 * Used by: Pipeline, Tasks, Projects, Leads modules
 */
class KanbanBoard {
    constructor(container, options = {}) {
        // Component identity
        this.componentName = 'KanbanBoard';
        this.componentId = `kanban-${Date.now().toString(36)}`;
        
        // Container
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('KanbanBoard: Container element not found');
        }
        
        // Configuration
        this.config = {
            // Column definitions
            columns: options.columns || [],
            
            // Card data
            cards: options.cards || [],
            
            // Display options
            columnKey: options.columnKey || 'status',
            cardIdKey: options.cardIdKey || 'id',
            cardTitleKey: options.cardTitleKey || 'title',
            groupBy: options.groupBy || null,
            
            // Features
            draggable: options.draggable !== false,
            sortable: options.sortable !== false,
            collapsible: options.collapsible || false,
            searchable: options.searchable || false,
            filterable: options.filterable || false,
            
            // Card limits
            maxCardsPerColumn: options.maxCardsPerColumn || 0,
            wipLimit: options.wipLimit || 0,
            
            // UI Options
            showCardCount: options.showCardCount !== false,
            showColumnMenu: options.showColumnMenu !== false,
            showAddCard: options.showAddCard !== false,
            compact: options.compact || false,
            horizontalScroll: options.horizontalScroll !== false,
            
            // Card rendering
            cardRenderer: options.cardRenderer || null,
            columnRenderer: options.columnRenderer || null,
            emptyRenderer: options.emptyRenderer || null,
            
            // Events
            onCardClick: options.onCardClick || null,
            onCardDoubleClick: options.onCardDoubleClick || null,
            onCardDragStart: options.onCardDragStart || null,
            onCardDragEnd: options.onCardDragEnd || null,
            onCardDrop: options.onCardDrop || null,
            onCardAdd: options.onCardAdd || null,
            onColumnAdd: options.onColumnAdd || null,
            onColumnEdit: options.onColumnEdit || null,
            onColumnDelete: options.onColumnDelete || null,
            onSearch: options.onSearch || null,
            onFilter: options.onFilter || null,
            
            // Styling
            theme: options.theme || 'light',
            cardColors: options.cardColors || {},
            columnColors: options.columnColors || {},
            
            // Accessibility
            ariaLabel: options.ariaLabel || 'Kanban Board',
            keyboardNavigation: options.keyboardNavigation !== false
        };
        
        // Internal state
        this.columns = new Map();
        this.cards = new Map();
        this.activeDragCard = null;
        this.activeDragSourceColumn = null;
        this.activeDragTargetColumn = null;
        this.isDragging = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchTimeout = null;
        this.longPressTimer = null;
        
        // UI State
        this.searchQuery = '';
        this.activeFilters = new Map();
        this.collapsedColumns = new Set();
        this.expandedCards = new Set();
        
        // DOM references
        this.elements = {
            board: null,
            columns: new Map(),
            cards: new Map(),
            searchInput: null,
            filterBar: null,
            ghostCard: null
        };
        
        // Performance
        this.performance = {
            renderTime: 0,
            cardCount: 0,
            columnCount: 0,
            lastUpdate: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize Kanban board
     */
    init() {
        try {
            console.log(`[KanbanBoard] Initializing: ${this.componentId}`);
            
            const startTime = performance.now();
            
            // Build columns from config
            this.buildColumns();
            
            // Process cards
            this.processCards();
            
            // Render board
            this.render();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Set up drag and drop
            if (this.config.draggable) {
                this.setupDragAndDrop();
            }
            
            // Set up touch support
            this.setupTouchSupport();
            
            // Set up keyboard navigation
            if (this.config.keyboardNavigation) {
                this.setupKeyboardNavigation();
            }
            
            this.performance.renderTime = performance.now() - startTime;
            this.performance.columnCount = this.columns.size;
            this.performance.cardCount = this.cards.size;
            
            console.log(`[KanbanBoard] Initialized in ${this.performance.renderTime.toFixed(2)}ms`);
            
            // Emit ready event
            EventBus.emit('kanban:ready', {
                componentId: this.componentId,
                columns: this.columns.size,
                cards: this.cards.size
            });
            
        } catch (error) {
            console.error('[KanbanBoard] Initialization failed:', error);
            this.container.innerHTML = `<div class="kanban-error">Failed to initialize Kanban board: ${error.message}</div>`;
        }
    }
    
    /**
     * Build columns from configuration
     */
    buildColumns() {
        try {
            this.columns.clear();
            
            if (this.config.columns.length === 0) {
                // Default columns
                const defaultColumns = [
                    { id: 'todo', title: 'To Do', color: '#6B7280', icon: 'fa-clipboard-list' },
                    { id: 'in_progress', title: 'In Progress', color: '#3B82F6', icon: 'fa-spinner' },
                    { id: 'review', title: 'Review', color: '#F59E0B', icon: 'fa-search' },
                    { id: 'done', title: 'Done', color: '#10B981', icon: 'fa-check-circle' }
                ];
                
                defaultColumns.forEach(col => {
                    this.columns.set(col.id, {
                        ...col,
                        cards: [],
                        wipLimit: this.config.wipLimit,
                        maxCards: this.config.maxCardsPerColumn,
                        isCollapsed: false
                    });
                });
                
                return;
            }
            
            // Build from config
            this.config.columns.forEach((col, index) => {
                this.columns.set(col.id || `col-${index}`, {
                    id: col.id || `col-${index}`,
                    title: col.title || col.label || `Column ${index + 1}`,
                    color: col.color || this.getDefaultColumnColor(index),
                    icon: col.icon || 'fa-list',
                    order: col.order || index,
                    cards: [],
                    wipLimit: col.wipLimit || this.config.wipLimit,
                    maxCards: col.maxCards || this.config.maxCardsPerColumn,
                    isCollapsed: false,
                    metadata: col.metadata || {},
                    allowedTransitions: col.allowedTransitions || null
                });
            });
            
        } catch (error) {
            console.error('[KanbanBoard] Column build failed:', error);
        }
    }
    
    /**
     * Process cards and assign to columns
     */
    processCards() {
        try {
            this.cards.clear();
            
            // Clear cards from columns
            this.columns.forEach(column => {
                column.cards = [];
            });
            
            if (!this.config.cards || this.config.cards.length === 0) return;
            
            this.config.cards.forEach(cardData => {
                const card = {
                    id: cardData[this.config.cardIdKey] || `card-${Date.now()}`,
                    title: cardData[this.config.cardTitleKey] || 'Untitled',
                    data: { ...cardData },
                    color: cardData.color || this.config.cardColors[cardData.priority] || null,
                    priority: cardData.priority || 'normal',
                    tags: cardData.tags || [],
                    assignee: cardData.assignee || null,
                    dueDate: cardData.dueDate || null,
                    metadata: cardData.metadata || {}
                };
                
                // Add to cards map
                this.cards.set(card.id, card);
                
                // Assign to column
                const columnKey = card.data[this.config.columnKey];
                const column = this.columns.get(columnKey);
                
                if (column) {
                    column.cards.push(card.id);
                } else {
                    // Assign to first column if no match
                    const firstColumn = this.columns.values().next().value;
                    if (firstColumn) {
                        card.data[this.config.columnKey] = firstColumn.id;
                        firstColumn.cards.push(card.id);
                    }
                }
            });
            
        } catch (error) {
            console.error('[KanbanBoard] Card processing failed:', error);
        }
    }
    
    /**
     * Render the entire Kanban board
     */
    render() {
        try {
            if (!this.container) return;
            
            const startTime = performance.now();
            
            // Build board HTML
            const html = `
                <div class="kanban-board-wrapper ${this.config.compact ? 'compact' : ''} ${this.config.horizontalScroll ? 'horizontal-scroll' : ''}"
                     id="${this.componentId}"
                     role="application"
                     aria-label="${this.config.ariaLabel}">
                    
                    <!-- Search Bar (if enabled) -->
                    ${this.config.searchable ? this.renderSearchBar() : ''}
                    
                    <!-- Filter Bar (if enabled) -->
                    ${this.config.filterable ? this.renderFilterBar() : ''}
                    
                    <!-- Board Columns -->
                    <div class="kanban-board" 
                         id="${this.componentId}-board"
                         role="list"
                         aria-label="Kanban columns">
                        ${this.renderColumns()}
                    </div>
                    
                    <!-- Add Column Button -->
                    ${this.config.onColumnAdd ? `
                        <div class="kanban-add-column">
                            <button class="add-column-btn" onclick="window.Global.Kanban.getInstance('${this.componentId}').addColumn()"
                                    aria-label="Add new column">
                                <i class="fas fa-plus"></i>
                                <span>Add Column</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
            
            this.container.innerHTML = html;
            
            // Cache board element
            this.elements.board = document.getElementById(`${this.componentId}-board`);
            
            // Cache column elements
            this.columns.forEach((column, columnId) => {
                const columnEl = document.getElementById(`${this.componentId}-col-${columnId}`);
                if (columnEl) {
                    this.elements.columns.set(columnId, columnEl);
                }
                
                // Cache card elements
                column.cards.forEach(cardId => {
                    const cardEl = document.getElementById(`${this.componentId}-card-${cardId}`);
                    if (cardEl) {
                        this.elements.cards.set(cardId, cardEl);
                    }
                });
            });
            
            // Cache search input
            if (this.config.searchable) {
                this.elements.searchInput = document.getElementById(`${this.componentId}-search`);
            }
            
            this.performance.lastUpdate = new Date();
            
            console.log(`[KanbanBoard] Rendered in ${(performance.now() - startTime).toFixed(2)}ms`);
            
        } catch (error) {
            console.error('[KanbanBoard] Render failed:', error);
        }
    }
    
    /**
     * Render search bar
     */
    renderSearchBar() {
        return `
            <div class="kanban-search-bar">
                <div class="search-input-wrapper">
                    <i class="fas fa-search"></i>
                    <input type="text" 
                           id="${this.componentId}-search"
                           placeholder="Search cards..."
                           value="${this.searchQuery}"
                           aria-label="Search kanban cards">
                    ${this.searchQuery ? `
                        <button class="clear-search" onclick="window.Global.Kanban.getInstance('${this.componentId}').clearSearch()"
                                aria-label="Clear search">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Render filter bar
     */
    renderFilterBar() {
        return `
            <div class="kanban-filter-bar">
                <div class="filter-chips">
                    ${Array.from(this.activeFilters.entries()).map(([key, value]) => `
                        <span class="filter-chip">
                            ${key}: ${value}
                            <button onclick="window.Global.Kanban.getInstance('${this.componentId}').removeFilter('${key}')"
                                    aria-label="Remove ${key} filter">
                                <i class="fas fa-times"></i>
                            </button>
                        </span>
                    `).join('')}
                </div>
                <button class="btn btn-sm btn-outline add-filter-btn"
                        onclick="window.Global.Kanban.getInstance('${this.componentId}').showFilterMenu()">
                    <i class="fas fa-filter"></i> Filter
                </button>
            </div>
        `;
    }
    
    /**
     * Render all columns
     */
    renderColumns() {
        if (this.columns.size === 0) {
            return this.renderEmptyBoard();
        }
        
        // Sort columns by order
        const sortedColumns = Array.from(this.columns.entries())
            .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
        
        return sortedColumns.map(([columnId, column]) => this.renderColumn(columnId, column)).join('');
    }
    
    /**
     * Render single column
     */
    renderColumn(columnId, column) {
        const isCollapsed = this.collapsedColumns.has(columnId);
        const cardCount = column.cards.length;
        const isOverWIP = column.wipLimit > 0 && cardCount > column.wipLimit;
        const isMaxReached = column.maxCards > 0 && cardCount >= column.maxCards;
        
        // Custom column renderer
        if (this.config.columnRenderer) {
            return this.config.columnRenderer(columnId, column, this);
        }
        
        return `
            <div class="kanban-column ${isCollapsed ? 'collapsed' : ''} ${isOverWIP ? 'over-wip' : ''}" 
                 id="${this.componentId}-col-${columnId}"
                 data-column-id="${columnId}"
                 role="listitem"
                 aria-label="${column.title} column, ${cardCount} cards">
                
                <!-- Column Header -->
                <div class="column-header" style="border-top: 4px solid ${column.color || '#3B82F6'}">
                    <div class="column-header-left" 
                         onclick="window.Global.Kanban.getInstance('${this.componentId}').toggleColumn('${columnId}')">
                        ${this.config.collapsible ? `
                            <button class="collapse-btn" aria-label="${isCollapsed ? 'Expand' : 'Collapse'} column">
                                <i class="fas fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                            </button>
                        ` : ''}
                        <span class="column-icon" style="color: ${column.color}">
                            <i class="fas ${column.icon || 'fa-list'}"></i>
                        </span>
                        <h3 class="column-title">${this.escapeHtml(column.title)}</h3>
                        ${this.config.showCardCount ? `
                            <span class="column-count ${isOverWIP ? 'over-limit' : ''}" 
                                  style="background: ${column.color}20; color: ${column.color}">
                                ${cardCount}${column.wipLimit > 0 ? `/${column.wipLimit}` : ''}
                            </span>
                        ` : ''}
                    </div>
                    
                    ${this.config.showColumnMenu ? `
                        <div class="column-header-right">
                            <button class="column-menu-btn" 
                                    onclick="event.stopPropagation(); window.Global.Kanban.getInstance('${this.componentId}').showColumnMenu('${columnId}')"
                                    aria-label="Column menu">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Column Cards -->
                <div class="column-cards ${isCollapsed ? 'hidden' : ''}" 
                     id="${this.componentId}-cards-${columnId}"
                     data-column-id="${columnId}"
                     role="list"
                     aria-label="Cards in ${column.title}">
                    ${this.renderColumnCards(columnId, column)}
                </div>
                
                <!-- Add Card Button -->
                ${this.config.showAddCard && !isMaxReached ? `
                    <div class="column-footer">
                        <button class="add-card-btn" 
                                onclick="window.Global.Kanban.getInstance('${this.componentId}').addCard('${columnId}')"
                                aria-label="Add card to ${column.title}">
                            <i class="fas fa-plus"></i>
                            <span>Add Card</span>
                        </button>
                    </div>
                ` : ''}
                
                ${isMaxReached ? `
                    <div class="column-footer max-reached">
                        <span><i class="fas fa-exclamation-circle"></i> Maximum cards reached</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Render cards within a column
     */
    renderColumnCards(columnId, column) {
        if (column.cards.length === 0) {
            if (this.config.emptyRenderer) {
                return this.config.emptyRenderer(columnId, column);
            }
            
            return `
                <div class="column-empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No cards</p>
                </div>
            `;
        }
        
        // Filter cards based on search
        let visibleCards = column.cards;
        
        if (this.searchQuery) {
            visibleCards = column.cards.filter(cardId => {
                const card = this.cards.get(cardId);
                return card && card.title.toLowerCase().includes(this.searchQuery.toLowerCase());
            });
        }
        
        return visibleCards.map(cardId => {
            const card = this.cards.get(cardId);
            if (!card) return '';
            
            return this.renderCard(cardId, card, columnId);
        }).join('');
    }
    
    /**
     * Render single card
     */
    renderCard(cardId, card, columnId) {
        // Custom card renderer
        if (this.config.cardRenderer) {
            return this.config.cardRenderer(cardId, card, columnId, this);
        }
        
        const isExpanded = this.expandedCards.has(cardId);
        
        return `
            <div class="kanban-card glass-card-3d ${isExpanded ? 'expanded' : ''}" 
                 id="${this.componentId}-card-${cardId}"
                 data-card-id="${cardId}"
                 data-column-id="${columnId}"
                 ${this.config.draggable ? 'draggable="true"' : ''}
                 role="listitem"
                 tabindex="0"
                 aria-label="${card.title}"
                 ${card.color ? `style="border-left: 4px solid ${card.color}"` : ''}>
                
                <!-- Card Priority Indicator -->
                ${card.priority ? `
                    <div class="card-priority-indicator priority-${card.priority}"></div>
                ` : ''}
                
                <!-- Card Header -->
                <div class="card-header">
                    <h4 class="card-title">${this.escapeHtml(card.title)}</h4>
                    <div class="card-actions">
                        <button class="card-menu-btn" 
                                onclick="event.stopPropagation(); window.Global.Kanban.getInstance('${this.componentId}').showCardMenu('${cardId}')"
                                aria-label="Card menu">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Card Body -->
                ${isExpanded && card.data.description ? `
                    <div class="card-body">
                        <p class="card-description">${this.escapeHtml(card.data.description?.substring(0, 150) || '')}</p>
                    </div>
                ` : ''}
                
                <!-- Card Footer -->
                <div class="card-footer">
                    ${card.tags.length > 0 ? `
                        <div class="card-tags">
                            ${card.tags.slice(0, 3).map(tag => `
                                <span class="tag">${this.escapeHtml(tag)}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="card-meta">
                        ${card.assignee ? `
                            <span class="card-assignee" title="${this.escapeHtml(card.assignee)}">
                                <i class="fas fa-user-circle"></i>
                            </span>
                        ` : ''}
                        ${card.dueDate ? `
                            <span class="card-due-date">
                                <i class="fas fa-calendar-alt"></i>
                                ${card.dueDate}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render empty board
     */
    renderEmptyBoard() {
        return `
            <div class="kanban-empty-board">
                <div class="empty-icon">
                    <i class="fas fa-columns"></i>
                </div>
                <h3>No Columns Defined</h3>
                <p>Add columns to start organizing your workflow</p>
                ${this.config.onColumnAdd ? `
                    <button class="btn btn-primary" onclick="window.Global.Kanban.getInstance('${this.componentId}').addColumn()">
                        <i class="fas fa-plus"></i> Add First Column
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Set up all event handlers
     */
    setupEventHandlers() {
        try {
            // Search input
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', 
                    this.debounce((e) => {
                        this.searchQuery = e.target.value;
                        this.handleSearch(this.searchQuery);
                    }, 300)
                );
            }
            
            // Card click events (event delegation)
            if (this.elements.board) {
                this.elements.board.addEventListener('click', (e) => {
                    const cardEl = e.target.closest('.kanban-card');
                    
                    if (cardEl && !e.target.closest('.card-menu-btn')) {
                        const cardId = cardEl.dataset.cardId;
                        const card = this.cards.get(cardId);
                        
                        if (card && this.config.onCardClick) {
                            this.config.onCardClick(card, cardEl);
                        }
                    }
                });
                
                // Card double click
                this.elements.board.addEventListener('dblclick', (e) => {
                    const cardEl = e.target.closest('.kanban-card');
                    
                    if (cardEl) {
                        const cardId = cardEl.dataset.cardId;
                        const card = this.cards.get(cardId);
                        
                        if (card && this.config.onCardDoubleClick) {
                            this.config.onCardDoubleClick(card, cardEl);
                        }
                        
                        // Toggle expand
                        this.toggleCardExpand(cardId);
                    }
                });
            }
            
            console.log('[KanbanBoard] Event handlers set up');
            
        } catch (error) {
            console.error('[KanbanBoard] Event handler setup failed:', error);
        }
    }
    
    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop() {
        try {
            if (!this.elements.board) return;
            
            // Create ghost card element
            this.elements.ghostCard = document.createElement('div');
            this.elements.ghostCard.className = 'kanban-card-ghost';
            this.elements.ghostCard.style.display = 'none';
            document.body.appendChild(this.elements.ghostCard);
            
            // Drag start (event delegation)
            this.elements.board.addEventListener('dragstart', (e) => {
                const cardEl = e.target.closest('.kanban-card');
                if (!cardEl) return;
                
                const cardId = cardEl.dataset.cardId;
                const columnId = cardEl.dataset.columnId;
                const card = this.cards.get(cardId);
                
                if (!card) return;
                
                this.activeDragCard = card;
                this.activeDragSourceColumn = columnId;
                this.isDragging = true;
                
                // Set drag data
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', cardId);
                
                // Style the dragged card
                setTimeout(() => {
                    cardEl.classList.add('dragging');
                }, 0);
                
                // Set ghost image
                const ghost = cardEl.cloneNode(true);
                ghost.style.position = 'absolute';
                ghost.style.top = '-9999px';
                ghost.style.opacity = '0.8';
                ghost.style.width = cardEl.offsetWidth + 'px';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 50, 50);
                
                setTimeout(() => {
                    document.body.removeChild(ghost);
                }, 0);
                
                // Callback
                if (this.config.onCardDragStart) {
                    this.config.onCardDragStart(card, columnId);
                }
            });
            
            // Drag over columns
            this.elements.board.addEventListener('dragover', (e) => {
                e.preventDefault();
                
                const columnCards = e.target.closest('.column-cards');
                
                if (columnCards) {
                    const columnId = columnCards.dataset.columnId;
                    columnCards.classList.add('drag-over');
                    this.activeDragTargetColumn = columnId;
                }
            });
            
            // Drag leave columns
            this.elements.board.addEventListener('dragleave', (e) => {
                const columnCards = e.target.closest('.column-cards');
                
                if (columnCards) {
                    columnCards.classList.remove('drag-over');
                }
            });
            
            // Drop on column
            this.elements.board.addEventListener('drop', (e) => {
                e.preventDefault();
                
                // Remove all drag-over classes
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
                
                const columnCards = e.target.closest('.column-cards');
                
                if (columnCards && this.activeDragCard) {
                    const targetColumnId = columnCards.dataset.columnId;
                    const cardId = e.dataTransfer.getData('text/plain');
                    
                    this.moveCard(cardId, this.activeDragSourceColumn, targetColumnId);
                }
                
                // Clean up
                document.querySelectorAll('.dragging').forEach(el => {
                    el.classList.remove('dragging');
                });
                
                this.isDragging = false;
                this.activeDragCard = null;
                this.activeDragSourceColumn = null;
                this.activeDragTargetColumn = null;
            });
            
            // Drag end
            this.elements.board.addEventListener('dragend', (e) => {
                document.querySelectorAll('.dragging').forEach(el => {
                    el.classList.remove('dragging');
                });
                
                if (this.config.onCardDragEnd) {
                    this.config.onCardDragEnd(this.activeDragCard, this.activeDragTargetColumn);
                }
                
                this.isDragging = false;
                this.activeDragCard = null;
            });
            
            console.log('[KanbanBoard] Drag and drop set up');
            
        } catch (error) {
            console.error('[KanbanBoard] Drag-drop setup failed:', error);
        }
    }
    
    /**
     * Set up touch support for mobile
     */
    setupTouchSupport() {
        try {
            if (!this.elements.board) return;
            
            let touchCard = null;
            let touchStartColumn = null;
            let touchClone = null;
            let touchOffsetX = 0;
            let touchOffsetY = 0;
            let isTouchDragging = false;
            
            this.elements.board.addEventListener('touchstart', (e) => {
                const cardEl = e.target.closest('.kanban-card');
                if (!cardEl || !this.config.draggable) return;
                
                const touch = e.touches[0];
                touchCard = cardEl;
                touchStartColumn = cardEl.dataset.columnId;
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
                
                // Long press to start drag
                this.longPressTimer = setTimeout(() => {
                    isTouchDragging = true;
                    
                    // Create clone
                    touchClone = cardEl.cloneNode(true);
                    touchClone.classList.add('touch-dragging');
                    touchClone.style.position = 'fixed';
                    touchClone.style.zIndex = '9999';
                    touchClone.style.opacity = '0.9';
                    touchClone.style.width = cardEl.offsetWidth + 'px';
                    touchClone.style.pointerEvents = 'none';
                    
                    const rect = cardEl.getBoundingClientRect();
                    touchOffsetX = touch.clientX - rect.left;
                    touchOffsetY = touch.clientY - rect.top;
                    
                    touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
                    touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';
                    
                    document.body.appendChild(touchClone);
                    
                    cardEl.classList.add('dragging');
                }, 500); // 500ms long press
            }, { passive: true });
            
            this.elements.board.addEventListener('touchmove', (e) => {
                if (!isTouchDragging || !touchClone) return;
                
                e.preventDefault();
                
                const touch = e.touches[0];
                touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
                touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';
                
                // Highlight target column
                const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetColumn = elementUnderTouch?.closest('.column-cards');
                
                document.querySelectorAll('.touch-drag-over').forEach(el => {
                    el.classList.remove('touch-drag-over');
                });
                
                if (targetColumn) {
                    targetColumn.classList.add('touch-drag-over');
                }
            }, { passive: false });
            
            this.elements.board.addEventListener('touchend', (e) => {
                clearTimeout(this.longPressTimer);
                
                if (isTouchDragging && touchClone && touchCard) {
                    const touch = e.changedTouches[0];
                    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                    const targetColumn = elementUnderTouch?.closest('.column-cards');
                    
                    if (targetColumn) {
                        const targetColumnId = targetColumn.dataset.columnId;
                        const cardId = touchCard.dataset.cardId;
                        
                        if (targetColumnId !== touchStartColumn) {
                            this.moveCard(cardId, touchStartColumn, targetColumnId);
                        }
                    }
                    
                    // Clean up
                    document.body.removeChild(touchClone);
                    touchCard.classList.remove('dragging');
                    
                    document.querySelectorAll('.touch-drag-over').forEach(el => {
                        el.classList.remove('touch-drag-over');
                    });
                }
                
                isTouchDragging = false;
                touchCard = null;
                touchClone = null;
                touchStartColumn = null;
            });
            
            console.log('[KanbanBoard] Touch support set up');
            
        } catch (error) {
            console.error('[KanbanBoard] Touch setup failed:', error);
        }
    }
    
    /**
     * Set up keyboard navigation
     */
    setupKeyboardNavigation() {
        try {
            if (!this.elements.board) return;
            
            this.elements.board.addEventListener('keydown', (e) => {
                const cardEl = document.activeElement?.closest('.kanban-card');
                if (!cardEl) return;
                
                const cardId = cardEl.dataset.cardId;
                const columnId = cardEl.dataset.columnId;
                
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.moveCardToAdjacentColumn(cardId, columnId, 'left');
                        break;
                        
                    case 'ArrowRight':
                        e.preventDefault();
                        this.moveCardToAdjacentColumn(cardId, columnId, 'right');
                        break;
                        
                    case 'ArrowUp':
                        e.preventDefault();
                        this.focusAdjacentCard(cardId, columnId, 'up');
                        break;
                        
                    case 'ArrowDown':
                        e.preventDefault();
                        this.focusAdjacentCard(cardId, columnId, 'down');
                        break;
                        
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        if (this.config.onCardClick) {
                            const card = this.cards.get(cardId);
                            this.config.onCardClick(card, cardEl);
                        }
                        break;
                }
            });
            
            console.log('[KanbanBoard] Keyboard navigation set up');
            
        } catch (error) {
            console.error('[KanbanBoard] Keyboard setup failed:', error);
        }
    }
    
    /**
     * Move a card between columns
     */
    moveCard(cardId, sourceColumnId, targetColumnId) {
        try {
            if (sourceColumnId === targetColumnId) return;
            
            const sourceColumn = this.columns.get(sourceColumnId);
            const targetColumn = this.columns.get(targetColumnId);
            const card = this.cards.get(cardId);
            
            if (!sourceColumn || !targetColumn || !card) return;
            
            // Check WIP limit
            if (targetColumn.wipLimit > 0 && targetColumn.cards.length >= targetColumn.wipLimit) {
                Toast.show(`WIP limit reached for "${targetColumn.title}"`, 'warning');
                return;
            }
            
            // Check max cards
            if (targetColumn.maxCards > 0 && targetColumn.cards.length >= targetColumn.maxCards) {
                Toast.show(`Maximum cards reached for "${targetColumn.title}"`, 'warning');
                return;
            }
            
            // Check allowed transitions
            if (sourceColumn.allowedTransitions && 
                !sourceColumn.allowedTransitions.includes(targetColumnId)) {
                Toast.show('This transition is not allowed', 'warning');
                return;
            }
            
            // Remove from source
            sourceColumn.cards = sourceColumn.cards.filter(id => id !== cardId);
            
            // Add to target
            targetColumn.cards.push(cardId);
            
            // Update card data
            card.data[this.config.columnKey] = targetColumnId;
            
            // Re-render the affected columns
            this.renderColumnCardsOnly(sourceColumnId);
            this.renderColumnCardsOnly(targetColumnId);
            
            // Update column counts
            this.updateColumnCount(sourceColumnId);
            this.updateColumnCount(targetColumnId);
            
            // Callback
            if (this.config.onCardDrop) {
                this.config.onCardDrop(card, sourceColumnId, targetColumnId);
            }
            
            // Emit event
            EventBus.emit('kanban:card-moved', {
                componentId: this.componentId,
                cardId,
                sourceColumnId,
                targetColumnId,
                card
            });
            
        } catch (error) {
            console.error('[KanbanBoard] Card move failed:', error);
        }
    }
    
    /**
     * Move card to adjacent column via keyboard
     */
    moveCardToAdjacentColumn(cardId, currentColumnId, direction) {
        const sortedColumns = Array.from(this.columns.keys());
        const currentIndex = sortedColumns.indexOf(currentColumnId);
        
        if (currentIndex === -1) return;
        
        const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
        
        if (targetIndex >= 0 && targetIndex < sortedColumns.length) {
            this.moveCard(cardId, currentColumnId, sortedColumns[targetIndex]);
            
            // Focus the card in new column
            setTimeout(() => {
                const cardEl = document.getElementById(`${this.componentId}-card-${cardId}`);
                if (cardEl) cardEl.focus();
            }, 100);
        }
    }
    
    /**
     * Focus adjacent card via keyboard
     */
    focusAdjacentCard(cardId, columnId, direction) {
        const column = this.columns.get(columnId);
        if (!column) return;
        
        const cardIndex = column.cards.indexOf(cardId);
        if (cardIndex === -1) return;
        
        const targetIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
        
        if (targetIndex >= 0 && targetIndex < column.cards.length) {
            const targetCardId = column.cards[targetIndex];
            const cardEl = document.getElementById(`${this.componentId}-card-${targetCardId}`);
            if (cardEl) cardEl.focus();
        }
    }
    
    /**
     * Render only the cards within a column (partial update)
     */
    renderColumnCardsOnly(columnId) {
        try {
            const cardsContainer = document.getElementById(`${this.componentId}-cards-${columnId}`);
            const column = this.columns.get(columnId);
            
            if (!cardsContainer || !column) return;
            
            cardsContainer.innerHTML = this.renderColumnCards(columnId, column);
            
            // Re-cache card elements
            column.cards.forEach(cardId => {
                const cardEl = document.getElementById(`${this.componentId}-card-${cardId}`);
                if (cardEl) {
                    this.elements.cards.set(cardId, cardEl);
                }
            });
            
        } catch (error) {
            console.error('[KanbanBoard] Partial render failed:', error);
        }
    }
    
    /**
     * Update column card count display
     */
    updateColumnCount(columnId) {
        try {
            const column = this.columns.get(columnId);
            const countEl = document.querySelector(`#${this.componentId}-col-${columnId} .column-count`);
            
            if (countEl && column) {
                countEl.textContent = column.wipLimit > 0 ? 
                    `${column.cards.length}/${column.wipLimit}` : 
                    column.cards.length;
                    
                if (column.wipLimit > 0 && column.cards.length > column.wipLimit) {
                    countEl.classList.add('over-limit');
                } else {
                    countEl.classList.remove('over-limit');
                }
            }
        } catch (error) {
            console.error('[KanbanBoard] Count update failed:', error);
        }
    }
    
    /**
     * Add a new card to a column
     */
    addCard(columnId) {
        try {
            if (this.config.onCardAdd) {
                this.config.onCardAdd(columnId);
            } else {
                // Default: prompt for card title
                const title = prompt('Enter card title:');
                if (!title || !title.trim()) return;
                
                const column = this.columns.get(columnId);
                if (!column) return;
                
                const cardId = `card-${Date.now()}`;
                const card = {
                    id: cardId,
                    title: title.trim(),
                    data: { 
                        id: cardId, 
                        title: title.trim(), 
                        [this.config.columnKey]: columnId 
                    },
                    priority: 'normal',
                    tags: [],
                    assignee: null,
                    dueDate: null
                };
                
                this.cards.set(cardId, card);
                column.cards.push(cardId);
                
                // Re-render column
                this.renderColumnCardsOnly(columnId);
                this.updateColumnCount(columnId);
                this.performance.cardCount = this.cards.size;
                
                // Focus new card
                setTimeout(() => {
                    const cardEl = document.getElementById(`${this.componentId}-card-${cardId}`);
                    if (cardEl) cardEl.focus();
                }, 100);
            }
        } catch (error) {
            console.error('[KanbanBoard] Add card failed:', error);
        }
    }
    
    /**
     * Add a new column
     */
    addColumn() {
        try {
            if (this.config.onColumnAdd) {
                this.config.onColumnAdd();
            } else {
                const title = prompt('Enter column name:');
                if (!title || !title.trim()) return;
                
                const columnId = `col-${Date.now()}`;
                const column = {
                    id: columnId,
                    title: title.trim(),
                    color: this.getDefaultColumnColor(this.columns.size),
                    icon: 'fa-list',
                    order: this.columns.size,
                    cards: [],
                    wipLimit: this.config.wipLimit,
                    maxCards: this.config.maxCardsPerColumn
                };
                
                this.columns.set(columnId, column);
                this.performance.columnCount = this.columns.size;
                
                // Full re-render
                this.render();
                this.setupEventHandlers();
                if (this.config.draggable) this.setupDragAndDrop();
            }
        } catch (error) {
            console.error('[KanbanBoard] Add column failed:', error);
        }
    }
    
    /**
     * Toggle column collapse
     */
    toggleColumn(columnId) {
        if (!this.config.collapsible) return;
        
        if (this.collapsedColumns.has(columnId)) {
            this.collapsedColumns.delete(columnId);
        } else {
            this.collapsedColumns.add(columnId);
        }
        
        const columnEl = document.getElementById(`${this.componentId}-col-${columnId}`);
        const cardsEl = document.getElementById(`${this.componentId}-cards-${columnId}`);
        
        if (columnEl) {
            columnEl.classList.toggle('collapsed');
        }
        if (cardsEl) {
            cardsEl.classList.toggle('hidden');
        }
    }
    
    /**
     * Toggle card expand
     */
    toggleCardExpand(cardId) {
        if (this.expandedCards.has(cardId)) {
            this.expandedCards.delete(cardId);
        } else {
            this.expandedCards.add(cardId);
        }
        
        const cardEl = document.getElementById(`${this.componentId}-card-${cardId}`);
        if (cardEl) {
            cardEl.classList.toggle('expanded');
        }
    }
    
    /**
     * Show column context menu
     */
    showColumnMenu(columnId) {
        if (this.config.onColumnEdit) {
            this.config.onColumnEdit(columnId, this.columns.get(columnId));
        }
    }
    
    /**
     * Show card context menu
     */
    showCardMenu(cardId) {
        // Emit event for external handling
        EventBus.emit('kanban:card-menu', {
            componentId: this.componentId,
            cardId,
            card: this.cards.get(cardId)
        });
    }
    
    /**
     * Handle search
     */
    handleSearch(query) {
        this.searchQuery = query;
        
        // Re-render all columns
        this.columns.forEach((column, columnId) => {
            this.renderColumnCardsOnly(columnId);
        });
        
        if (this.config.onSearch) {
            this.config.onSearch(query);
        }
    }
    
    /**
     * Clear search
     */
    clearSearch() {
        this.searchQuery = '';
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        this.handleSearch('');
    }
    
    /**
     * Add filter
     */
    addFilter(key, value) {
        this.activeFilters.set(key, value);
        this.render();
        this.setupEventHandlers();
        
        if (this.config.onFilter) {
            this.config.onFilter(key, value);
        }
    }
    
    /**
     * Remove filter
     */
    removeFilter(key) {
        this.activeFilters.delete(key);
        this.render();
        this.setupEventHandlers();
    }
    
    /**
     * Show filter menu
     */
    showFilterMenu() {
        EventBus.emit('kanban:filter-menu', {
            componentId: this.componentId,
            activeFilters: this.activeFilters
        });
    }
    
    /**
     * Get default column color
     */
    getDefaultColumnColor(index) {
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];
        return colors[index % colors.length];
    }
    
    /**
     * Update board data
     */
    updateData(cards, columns = null) {
        if (columns) {
            this.config.columns = columns;
            this.buildColumns();
        }
        
        this.config.cards = cards;
        this.processCards();
        this.render();
        this.setupEventHandlers();
        if (this.config.draggable) this.setupDragAndDrop();
        
        this.performance.cardCount = this.cards.size;
        this.performance.columnCount = this.columns.size;
        this.performance.lastUpdate = new Date();
    }
    
    /**
     * Get board data
     */
    getData() {
        const columns = Array.from(this.columns.entries()).map(([id, col]) => ({
            id,
            title: col.title,
            color: col.color,
            cards: col.cards
        }));
        
        const cards = Array.from(this.cards.values());
        
        return { columns, cards };
    }
    
    /**
     * Destroy component
     */
    destroy() {
        try {
            // Remove ghost card
            if (this.elements.ghostCard && this.elements.ghostCard.parentNode) {
                this.elements.ghostCard.parentNode.removeChild(this.elements.ghostCard);
            }
            
            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }
            
            // Clear state
            this.columns.clear();
            this.cards.clear();
            this.elements.columns.clear();
            this.elements.cards.clear();
            
            console.log('[KanbanBoard] Component destroyed');
            
        } catch (error) {
            console.error('[KanbanBoard] Destroy failed:', error);
        }
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
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Get instance by ID (static helper)
     */
    static getInstance(componentId) {
        return window.Global?.Kanban?.instances?.get(componentId);
    }
}

// Export
export { KanbanBoard };
export default KanbanBoard;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Kanban = window.Global.Kanban || {};
    window.Global.Kanban.instances = window.Global.Kanban.instances || new Map();
    window.Global.Kanban.KanbanBoard = KanbanBoard;
}


