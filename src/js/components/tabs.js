/**
 * 11 AVATAR DIGITAL HUB - Tabs Component
 * Enterprise-grade tabbed interface system
 * Dynamic tabs, lazy loading, drag-reorder, keyboard nav, responsive accordion fallback
 * 
 * @component Tabs
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';

/**
 * Tabs - Universal tabbed interface component
 * Supports: basic tabs, pills, vertical tabs, accordion fallback, lazy panels
 */
class Tabs {
    /**
     * Initialize tabs component
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} options - Configuration options
     */
    constructor(container, options = {}) {
        // Component identity
        this.componentName = 'Tabs';
        this.componentId = `tabs-${Date.now().toString(36)}`;
        
        // Container resolution - accept string selector or direct element
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        // Validate container exists
        if (!this.container) {
            throw new Error(`Tabs: Container not found - "${container}"`);
        }

        /**
         * Full configuration with enterprise defaults
         * Every option documented and validated
         */
        this.config = {
            // Tab definitions - array of tab objects
            tabs: options.tabs || [],
            
            // Active tab - index or tab id
            activeTab: options.activeTab || 0,
            
            // Display mode
            mode: options.mode || 'tabs', // tabs, pills, vertical, accordion
            
            // Visual style
            style: options.style || 'default', // default, bordered, elevated, minimal
            theme: options.theme || 'light', // light, dark
            size: options.size || 'md', // sm, md, lg
            
            // Tab features
            showIcons: options.showIcons !== false,
            showBadges: options.showBadges !== false,
            showCloseButton: options.showCloseButton || false,
            closableTabs: options.closableTabs || [],
            
            // Navigation
            scrollable: options.scrollable !== false,
            showScrollButtons: options.showScrollButtons !== false,
            scrollAmount: options.scrollAmount || 200,
            
            // Panel features
            lazyLoad: options.lazyLoad || false,
            cachePanels: options.cachePanels !== false,
            animatePanels: options.animatePanels !== false,
            animationDuration: options.animationDuration || 300,
            
            // Responsive
            accordionOnMobile: options.accordionOnMobile !== false,
            mobileBreakpoint: options.mobileBreakpoint || 768,
            
            // Drag & Drop
            sortable: options.sortable || false,
            dragHandle: options.dragHandle || '.tab-label',
            
            // Keyboard
            keyboardNavigation: options.keyboardNavigation !== false,
            
            // Persistence
            persistActiveTab: options.persistActiveTab || false,
            persistenceKey: options.persistenceKey || `tabs_active_${this.componentId}`,
            
            // Accessibility
            ariaLabel: options.ariaLabel || 'Tab Navigation',
            ariaLabelledBy: options.ariaLabelledBy || null,
            
            // Panel rendering
            panelRenderer: options.panelRenderer || null,
            tabRenderer: options.tabRenderer || null,
            
            // Events - comprehensive callback system
            onTabClick: options.onTabClick || null,
            onTabChange: options.onTabChange || null,
            onTabClose: options.onTabClose || null,
            onTabAdd: options.onTabAdd || null,
            onTabRemove: options.onTabRemove || null,
            onTabReorder: options.onTabReorder || null,
            onPanelLoad: options.onPanelLoad || null,
            onPanelError: options.onPanelError || null,
            onBeforeChange: options.onBeforeChange || null,
            onAfterChange: options.onAfterChange || null
        };

        /**
         * Internal state management
         * Tracks all mutable state with deep initialization
         */
        this.state = {
            // Active tab tracking
            activeIndex: -1,
            activeTabId: null,
            previousIndex: -1,
            
            // Tab management
            tabs: [...this.config.tabs],
            tabElements: [], // DOM references
            panelElements: [], // Panel DOM references
            
            // UI state
            isDragging: false,
            dragStartIndex: -1,
            dragOverIndex: -1,
            isScrolling: false,
            scrollPosition: 0,
            maxScroll: 0,
            
            // Responsive state
            isMobile: false,
            isAccordionMode: false,
            
            // Loading state
            loadingTabs: new Set(),
            loadedPanels: new Set(),
            panelCache: new Map(),
            
            // Panel visibility
            visiblePanelIndex: -1,
            
            // Animation state
            isAnimating: false,
            animationQueue: [],
            
            // Performance tracking
            renderCount: 0,
            lastInteraction: null,
            interactionCount: 0
        };

        // DOM element cache - avoids repeated querySelector calls
        this.elements = {
            wrapper: null,
            tabList: null,
            tabItems: [],
            scrollPrev: null,
            scrollNext: null,
            panelsContainer: null,
            panels: [],
            dragGhost: null,
            addButton: null
        };

        // Touch/swipe state
        this.touchState = {
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isSwiping: false,
            swipeDirection: null
        };

        // Resize observer for responsive behavior
        this.resizeObserver = null;
        
        // Mutation observer for dynamic tab changes
        this.mutationObserver = null;

        // Performance metrics
        this.performance = {
            initTime: 0,
            renderTime: 0,
            switchCount: 0,
            averageSwitchTime: 0,
            totalSwitchTime: 0,
            lastSwitchTime: 0
        };

        // Initialize the component
        this.init();
    }

    /**
     * Initialize tabs component
     * Sets up DOM, loads persisted state, renders, binds events
     * @async
     */
    async init() {
        try {
            // Start performance timer
            const initStart = performance.now();
            
            console.log(`[Tabs] Initializing tabs component: ${this.componentId}`);

            // Validate configuration
            this.validateConfig();

            // Load persisted active tab if enabled
            if (this.config.persistActiveTab) {
                await this.loadPersistedState();
            }

            // Set initial active tab
            this.setInitialActiveTab();

            // Check if mobile/accordion mode
            this.checkResponsiveMode();

            // Render the component
            await this.render();

            // Bind all event handlers
            this.bindEvents();

            // Set up observers
            this.setupObservers();

            // Update scroll state
            this.updateScrollState();

            // Calculate performance
            this.performance.initTime = performance.now() - initStart;
            
            console.log(`[Tabs] Initialized in ${this.performance.initTime.toFixed(2)}ms`);
            console.log(`[Tabs] Mode: ${this.state.isAccordionMode ? 'accordion' : this.config.mode}`);
            console.log(`[Tabs] Active tab: ${this.state.activeIndex} (${this.state.activeTabId})`);

            // Emit ready event with component data
            EventBus.emit('tabs:ready', {
                componentId: this.componentId,
                tabCount: this.state.tabs.length,
                activeIndex: this.state.activeIndex,
                mode: this.state.isAccordionMode ? 'accordion' : this.config.mode
            });

        } catch (error) {
            console.error('[Tabs] Initialization failed:', error);
            
            // Graceful fallback - show error in container
            if (this.container) {
                this.container.innerHTML = `
                    <div class="tabs-error" role="alert">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to initialize tabs: ${this.escapeHtml(error.message)}</p>
                        <button class="btn btn-sm btn-outline" onclick="this.parentElement.remove()">
                            Dismiss
                        </button>
                    </div>
                `;
            }
            
            // Emit error event
            EventBus.emit('tabs:error', {
                componentId: this.componentId,
                error: error.message,
                phase: 'initialization'
            });
        }
    }

    /**
     * Validate configuration and set defaults
     * Ensures all required options have valid values
     * @throws {Error} If critical configuration is invalid
     */
    validateConfig() {
        // Validate tabs array
        if (!Array.isArray(this.config.tabs)) {
            console.warn('[Tabs] Invalid tabs configuration, using empty array');
            this.config.tabs = [];
        }

        // Validate each tab object has required fields
        this.config.tabs = this.config.tabs.map((tab, index) => ({
            id: tab.id || `tab-${index}-${Date.now()}`,
            label: tab.label || tab.title || `Tab ${index + 1}`,
            icon: tab.icon || null,
            badge: tab.badge || null,
            badgeColor: tab.badgeColor || '#3B82F6',
            content: tab.content || '',
            panelId: tab.panelId || `panel-${index}-${Date.now()}`,
            disabled: tab.disabled || false,
            closable: tab.closable || false,
            loading: tab.loading || false,
            visible: tab.visible !== false,
            metadata: tab.metadata || {},
            // Panel loading options
            loadURL: tab.loadURL || null,
            loadMethod: tab.loadMethod || 'GET',
            loadHeaders: tab.loadHeaders || {},
            loadCache: tab.loadCache !== false
        }));

        // Update state tabs reference
        this.state.tabs = [...this.config.tabs];

        // Validate active tab index
        if (typeof this.config.activeTab === 'string') {
            // Find by ID
            const foundIndex = this.state.tabs.findIndex(t => t.id === this.config.activeTab);
            this.config.activeTab = foundIndex >= 0 ? foundIndex : 0;
        }

        // Ensure active tab is within bounds
        if (this.config.activeTab < 0 || this.config.activeTab >= this.state.tabs.length) {
            this.config.activeTab = 0;
        }

        // Validate animation duration
        if (this.config.animationDuration < 0) {
            this.config.animationDuration = 0;
        }
        if (this.config.animationDuration > 2000) {
            this.config.animationDuration = 2000;
        }

        console.log('[Tabs] Configuration validated:', {
            tabCount: this.state.tabs.length,
            activeTab: this.config.activeTab,
            mode: this.config.mode,
            style: this.config.style
        });
    }

    /**
     * Set initial active tab based on configuration
     * Handles string ID or numeric index
     */
    setInitialActiveTab() {
        let targetIndex = this.config.activeTab;

        // Find first non-disabled, visible tab if target is invalid
        if (this.state.tabs[targetIndex]?.disabled || !this.state.tabs[targetIndex]?.visible) {
            targetIndex = this.state.tabs.findIndex(t => !t.disabled && t.visible);
            if (targetIndex < 0) targetIndex = 0;
        }

        this.state.activeIndex = targetIndex;
        this.state.activeTabId = this.state.tabs[targetIndex]?.id || null;
        this.state.previousIndex = -1;
    }

    /**
     * Check if device is in mobile/accordion mode
     */
    checkResponsiveMode() {
        if (!this.config.accordionOnMobile) {
            this.state.isMobile = false;
            this.state.isAccordionMode = false;
            return;
        }

        const width = window.innerWidth;
        this.state.isMobile = width <= this.config.mobileBreakpoint;
        this.state.isAccordionMode = this.state.isMobile;
        
        console.log(`[Tabs] Responsive check: ${width}px, Accordion: ${this.state.isAccordionMode}`);
    }

    /**
     * Load persisted active tab state from cache
     * @async
     */
    async loadPersistedState() {
        try {
            const cached = await Cache.get(this.config.persistenceKey);
            
            if (cached && cached.data && cached.data.activeTabId) {
                const foundIndex = this.state.tabs.findIndex(t => t.id === cached.data.activeTabId);
                
                if (foundIndex >= 0 && !this.state.tabs[foundIndex].disabled) {
                    this.config.activeTab = foundIndex;
                    console.log(`[Tabs] Restored persisted tab: ${cached.data.activeTabId}`);
                }
            }
        } catch (error) {
            console.warn('[Tabs] Failed to load persisted state:', error.message);
            // Continue with default - not critical
        }
    }

    /**
     * Save active tab state to cache
     * @async
     */
    async savePersistedState() {
        if (!this.config.persistActiveTab) return;
        
        try {
            await Cache.set(this.config.persistenceKey, {
                activeTabId: this.state.activeTabId,
                activeIndex: this.state.activeIndex,
                timestamp: Date.now()
            }, 7 * 24 * 3600000); // 7 days persistence
            
            console.log(`[Tabs] Persisted tab: ${this.state.activeTabId}`);
        } catch (error) {
            console.warn('[Tabs] Failed to persist state:', error.message);
        }
    }

    /**
     * Render the complete tabs component
     * Builds tab list, panels, scroll buttons, and handles all visual modes
     * @async
     */
    async render() {
        try {
            const renderStart = performance.now();
            
            // Build CSS classes
            const modeClass = `tabs-mode-${this.state.isAccordionMode ? 'accordion' : this.config.mode}`;
            const styleClass = `tabs-style-${this.config.style}`;
            const themeClass = `tabs-theme-${this.config.theme}`;
            const sizeClass = `tabs-size-${this.config.size}`;
            const scrollClass = this.config.scrollable ? 'tabs-scrollable' : '';
            
            // Filter visible tabs
            const visibleTabs = this.state.tabs.filter(t => t.visible);

            // Build the complete HTML structure
            const html = `
                <div class="tabs-wrapper ${modeClass} ${styleClass} ${themeClass} ${sizeClass} ${scrollClass}" 
                     id="${this.componentId}"
                     role="region"
                     aria-label="${this.config.ariaLabel}"
                     ${this.config.ariaLabelledBy ? `aria-labelledby="${this.config.ariaLabelledBy}"` : ''}>
                    
                    <!-- Tab Navigation Bar -->
                    <div class="tabs-navbar">
                        <!-- Scroll Previous Button -->
                        ${this.config.showScrollButtons && this.config.scrollable ? `
                            <button class="tabs-scroll-btn tabs-scroll-prev" 
                                    id="${this.componentId}-scroll-prev"
                                    aria-label="Scroll tabs left"
                                    title="Previous tabs"
                                    type="button"
                                    style="display: none;">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                        ` : ''}

                        <!-- Tab List -->
                        <div class="tabs-list" 
                             id="${this.componentId}-list"
                             role="tablist"
                             aria-orientation="${this.config.mode === 'vertical' ? 'vertical' : 'horizontal'}">
                            
                            ${visibleTabs.map((tab, index) => {
                                const actualIndex = this.state.tabs.indexOf(tab);
                                const isActive = actualIndex === this.state.activeIndex;
                                const isDisabled = tab.disabled;
                                const isClosable = tab.closable || this.config.closableTabs.includes(tab.id);
                                const isLoading = this.state.loadingTabs.has(tab.id);
                                
                                // Use custom renderer or default
                                if (this.config.tabRenderer) {
                                    return this.config.tabRenderer(tab, actualIndex, isActive);
                                }

                                return `
                                    <button class="tabs-tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${isLoading ? 'loading' : ''}"
                                            id="${this.componentId}-tab-${actualIndex}"
                                            role="tab"
                                            aria-selected="${isActive}"
                                            aria-controls="${this.componentId}-panel-${actualIndex}"
                                            aria-disabled="${isDisabled}"
                                            tabindex="${isActive ? '0' : '-1'}"
                                            data-index="${actualIndex}"
                                            data-tab-id="${tab.id}"
                                            ${isDisabled ? 'disabled' : ''}
                                            ${this.config.sortable ? 'draggable="true"' : ''}>
                                        
                                        <!-- Tab Icon -->
                                        ${this.config.showIcons && tab.icon ? `
                                            <span class="tabs-icon" aria-hidden="true">
                                                <i class="fas ${tab.icon}"></i>
                                            </span>
                                        ` : ''}
                                        
                                        <!-- Tab Label -->
                                        <span class="tabs-label">${this.escapeHtml(tab.label)}</span>
                                        
                                        <!-- Loading Spinner -->
                                        ${isLoading ? `
                                            <span class="tabs-spinner" aria-label="Loading">
                                                <i class="fas fa-spinner fa-spin"></i>
                                            </span>
                                        ` : ''}
                                        
                                        <!-- Badge -->
                                        ${this.config.showBadges && tab.badge !== null && tab.badge !== undefined ? `
                                            <span class="tabs-badge" style="background: ${tab.badgeColor};" aria-label="${tab.badge} notifications">
                                                ${tab.badge > 99 ? '99+' : tab.badge}
                                            </span>
                                        ` : ''}
                                        
                                        <!-- Close Button -->
                                        ${this.config.showCloseButton && isClosable ? `
                                            <span class="tabs-close" 
                                                  role="button"
                                                  aria-label="Close ${tab.label} tab"
                                                  title="Close tab"
                                                  onclick="event.stopPropagation(); window.Global.Tabs.instances.get('${this.componentId}').closeTab(${actualIndex})">
                                                <i class="fas fa-times"></i>
                                            </span>
                                        ` : ''}
                                    </button>
                                `;
                            }).join('')}

                            <!-- Add Tab Button -->
                            ${this.config.onTabAdd ? `
                                <button class="tabs-add-btn" 
                                        id="${this.componentId}-add-btn"
                                        aria-label="Add new tab"
                                        title="Add tab"
                                        type="button">
                                    <i class="fas fa-plus"></i>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Scroll Next Button -->
                        ${this.config.showScrollButtons && this.config.scrollable ? `
                            <button class="tabs-scroll-btn tabs-scroll-next" 
                                    id="${this.componentId}-scroll-next"
                                    aria-label="Scroll tabs right"
                                    title="Next tabs"
                                    type="button"
                                    style="display: none;">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Panels Container -->
                    <div class="tabs-panels" 
                         id="${this.componentId}-panels">
                        
                        ${visibleTabs.map((tab, index) => {
                            const actualIndex = this.state.tabs.indexOf(tab);
                            const isActive = actualIndex === this.state.activeIndex;
                            const isLoaded = this.state.loadedPanels.has(tab.id);
                            const shouldLazyLoad = this.config.lazyLoad && !isLoaded && !isActive;
                            
                            // Use custom panel renderer or default
                            if (this.config.panelRenderer && isActive) {
                                return this.config.panelRenderer(tab, actualIndex, isActive);
                            }

                            return `
                                <div class="tabs-panel ${isActive ? 'active' : ''}"
                                     id="${this.componentId}-panel-${actualIndex}"
                                     role="tabpanel"
                                     aria-labelledby="${this.componentId}-tab-${actualIndex}"
                                     aria-hidden="${!isActive}"
                                     data-panel-index="${actualIndex}"
                                     data-tab-id="${tab.id}"
                                     ${!isActive ? 'hidden' : ''}>
                                    
                                    ${shouldLazyLoad ? `
                                        <div class="tabs-panel-placeholder">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>Loading...</span>
                                        </div>
                                    ` : `
                                        ${tab.content || ''}
                                    `}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            // Set the HTML
            this.container.innerHTML = html;
            
            // Cache all DOM elements for performance
            this.cacheElements();
            
            // Load lazy panels if needed
            if (!this.config.lazyLoad) {
                this.state.tabs.forEach((tab, index) => {
                    this.state.loadedPanels.add(tab.id);
                });
            } else {
                // Load active panel immediately
                const activeTab = this.state.tabs[this.state.activeIndex];
                if (activeTab) {
                    this.loadPanelContent(activeTab, this.state.activeIndex);
                }
            }

            // Update performance metrics
            this.performance.renderTime = performance.now() - renderStart;
            this.state.renderCount++;
            
            console.log(`[Tabs] Rendered in ${this.performance.renderTime.toFixed(2)}ms (render #${this.state.renderCount})`);

        } catch (error) {
            console.error('[Tabs] Render failed:', error);
            
            // Show error state in container
            this.container.innerHTML = `
                <div class="tabs-error" role="alert">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to render tabs: ${this.escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }

    /**
     * Cache DOM element references after render
     * Avoids repeated querySelector calls for better performance
     */
    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.tabList = document.getElementById(`${this.componentId}-list`);
        this.elements.scrollPrev = document.getElementById(`${this.componentId}-scroll-prev`);
        this.elements.scrollNext = document.getElementById(`${this.componentId}-scroll-next`);
        this.elements.panelsContainer = document.getElementById(`${this.componentId}-panels`);
        this.elements.addButton = document.getElementById(`${this.componentId}-add-btn`);
        
        // Cache individual tab elements
        this.elements.tabItems = [];
        this.elements.panels = [];
        
        this.state.tabs.forEach((tab, index) => {
            const tabEl = document.getElementById(`${this.componentId}-tab-${index}`);
            const panelEl = document.getElementById(`${this.componentId}-panel-${index}`);
            
            if (tabEl) this.elements.tabItems[index] = tabEl;
            if (panelEl) this.elements.panels[index] = panelEl;
        });
        
        console.log(`[Tabs] Cached ${this.elements.tabItems.length} tab elements and ${this.elements.panels.length} panels`);
    }

    /**
     * Load panel content dynamically
     * Supports URL loading with caching
     * @param {Object} tab - Tab configuration object
     * @param {number} index - Tab index
     * @async
     */
    async loadPanelContent(tab, index) {
        // Skip if already loaded or no URL
        if (this.state.loadedPanels.has(tab.id) || !tab.loadURL) {
            return;
        }

        // Skip if already loading
        if (this.state.loadingTabs.has(tab.id)) {
            return;
        }

        try {
            // Mark as loading
            this.state.loadingTabs.add(tab.id);
            
            // Check cache first
            if (tab.loadCache && this.state.panelCache.has(tab.id)) {
                const cachedContent = this.state.panelCache.get(tab.id);
                this.updatePanelContent(index, cachedContent);
                this.state.loadedPanels.add(tab.id);
                this.state.loadingTabs.delete(tab.id);
                return;
            }

            console.log(`[Tabs] Loading panel content for: ${tab.label} (${tab.loadURL})`);

            // Fetch content from URL
            const response = await fetch(tab.loadURL, {
                method: tab.loadMethod || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...tab.loadHeaders
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            let content;
            
            // Check content type
            const contentType = response.headers.get('Content-Type') || '';
            
            if (contentType.includes('application/json')) {
                const json = await response.json();
                content = json.content || json.html || JSON.stringify(json);
            } else {
                content = await response.text();
            }

            // Update panel with loaded content
            this.updatePanelContent(index, content);
            
            // Cache if enabled
            if (tab.loadCache) {
                this.state.panelCache.set(tab.id, content);
            }
            
            // Mark as loaded
            this.state.loadedPanels.add(tab.id);
            
            // Emit load event
            if (this.config.onPanelLoad) {
                this.config.onPanelLoad({ tab, index, content });
            }
            
            console.log(`[Tabs] Panel loaded: ${tab.label} (${content.length} chars)`);

        } catch (error) {
            console.error(`[Tabs] Panel load failed for ${tab.label}:`, error);
            
            // Show error in panel
            this.updatePanelContent(index, `
                <div class="tabs-panel-error" role="alert">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load content: ${this.escapeHtml(error.message)}</p>
                    <button class="btn btn-sm btn-outline" 
                            onclick="window.Global.Tabs.instances.get('${this.componentId}').loadPanelContent(
                                window.Global.Tabs.instances.get('${this.componentId}').state.tabs[${index}], ${index})">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `);
            
            // Emit error event
            if (this.config.onPanelError) {
                this.config.onPanelError({ tab, index, error: error.message });
            }
        } finally {
            // Clear loading state
            this.state.loadingTabs.delete(tab.id);
        }
    }

    /**
     * Update panel content after dynamic load
     * @param {number} index - Panel index
     * @param {string} content - HTML content
     */
    updatePanelContent(index, content) {
        const panel = this.elements.panels[index];
        if (panel) {
            panel.innerHTML = content;
        }
    }

    /**
     * Switch to a specific tab
     * Handles validation, lazy loading, animations, and callbacks
     * @param {number|string} tabIdentifier - Tab index or tab ID
     * @param {boolean} [silent=false] - If true, skip callbacks
     * @returns {boolean} - Success status
     * @async
     */
    async switchTab(tabIdentifier, silent = false) {
        try {
            // Resolve tab index
            let targetIndex = -1;
            
            if (typeof tabIdentifier === 'string') {
                targetIndex = this.state.tabs.findIndex(t => t.id === tabIdentifier);
            } else if (typeof tabIdentifier === 'number') {
                targetIndex = tabIdentifier;
            }
            
            // Validate index
            if (targetIndex < 0 || targetIndex >= this.state.tabs.length) {
                console.warn(`[Tabs] Invalid tab index: ${tabIdentifier}`);
                return false;
            }
            
            // Check if already active
            if (targetIndex === this.state.activeIndex) {
                return true;
            }
            
            // Get target tab
            const targetTab = this.state.tabs[targetIndex];
            
            // Check if tab is disabled
            if (targetTab.disabled) {
                console.warn(`[Tabs] Cannot switch to disabled tab: ${targetTab.label}`);
                return false;
            }
            
            // Check if tab is visible
            if (!targetTab.visible) {
                console.warn(`[Tabs] Cannot switch to hidden tab: ${targetTab.label}`);
                return false;
            }
            
            // Fire before change callback
            if (!silent && this.config.onBeforeChange) {
                const allowChange = this.config.onBeforeChange({
                    fromIndex: this.state.activeIndex,
                    toIndex: targetIndex,
                    fromTab: this.state.tabs[this.state.activeIndex],
                    toTab: targetTab
                });
                
                // Allow callback to cancel the switch by returning false
                if (allowChange === false) {
                    console.log('[Tabs] Tab change cancelled by onBeforeChange callback');
                    return false;
                }
            }
            
            // If animating, queue the switch
            if (this.state.isAnimating && this.config.animatePanels) {
                this.state.animationQueue.push({ targetIndex, silent });
                return false;
            }

            // Start performance timer
            const switchStart = performance.now();
            
            // Store previous state
            this.state.previousIndex = this.state.activeIndex;
            const previousTab = this.state.tabs[this.state.previousIndex];
            
            // Update state
            this.state.activeIndex = targetIndex;
            this.state.activeTabId = targetTab.id;
            
            console.log(`[Tabs] Switching to tab: ${targetTab.label} (index: ${targetIndex})`);

            // Lazy load panel content if needed
            if (this.config.lazyLoad && !this.state.loadedPanels.has(targetTab.id)) {
                await this.loadPanelContent(targetTab, targetIndex);
            }

            // Update tab elements visually
            this.updateActiveTabUI();
            
            // Handle panel animation
            if (this.config.animatePanels && previousTab) {
                await this.animatePanelSwitch(this.state.previousIndex, targetIndex);
            } else {
                this.updateActivePanelUI();
            }

            // Scroll tab into view if scrollable
            if (this.config.scrollable) {
                this.scrollToTab(targetIndex);
            }

            // Update scroll buttons
            this.updateScrollButtons();

            // Save persisted state
            await this.savePersistedState();

            // Update performance metrics
            this.performance.switchCount++;
            this.performance.lastSwitchTime = performance.now() - switchStart;
            this.performance.totalSwitchTime += this.performance.lastSwitchTime;
            this.performance.averageSwitchTime = 
                this.performance.totalSwitchTime / this.performance.switchCount;
            
            this.state.lastInteraction = new Date();
            this.state.interactionCount++;

            // Fire change callbacks
            if (!silent) {
                // Main change callback
                if (this.config.onTabChange) {
                    this.config.onTabChange({
                        fromIndex: this.state.previousIndex,
                        toIndex: targetIndex,
                        fromTab: previousTab || null,
                        toTab: targetTab,
                        componentId: this.componentId
                    });
                }
                
                // After change callback
                if (this.config.onAfterChange) {
                    this.config.onAfterChange({
                        activeIndex: targetIndex,
                        activeTab: targetTab,
                        previousIndex: this.state.previousIndex,
                        previousTab: previousTab || null
                    });
                }
            }

            // Emit event bus event
            EventBus.emit('tabs:changed', {
                componentId: this.componentId,
                activeIndex: targetIndex,
                activeTabId: targetTab.id,
                previousIndex: this.state.previousIndex,
                activeTab: targetTab,
                previousTab: previousTab || null
            });

            // Process animation queue
            if (this.state.animationQueue.length > 0) {
                const nextSwitch = this.state.animationQueue.shift();
                await this.switchTab(nextSwitch.targetIndex, nextSwitch.silent);
            }

            return true;

        } catch (error) {
            console.error('[Tabs] Tab switch failed:', error);
            
            // Attempt to revert to previous tab
            if (this.state.previousIndex >= 0) {
                this.state.activeIndex = this.state.previousIndex;
                this.state.activeTabId = this.state.tabs[this.state.previousIndex]?.id || null;
                this.updateActiveTabUI();
                this.updateActivePanelUI();
            }
            
            return false;
        }
    }

    /**
     * Update tab button visual states
     */
    updateActiveTabUI() {
        // Remove active class from all tabs
        this.elements.tabItems.forEach((tabEl, index) => {
            if (tabEl) {
                const isActive = index === this.state.activeIndex;
                tabEl.classList.toggle('active', isActive);
                tabEl.setAttribute('aria-selected', isActive.toString());
                tabEl.tabIndex = isActive ? 0 : -1;
            }
        });

        // Focus the active tab
        const activeTabEl = this.elements.tabItems[this.state.activeIndex];
        if (activeTabEl && document.activeElement !== activeTabEl) {
            // Don't steal focus, just make focusable
        }
    }

    /**
     * Update panel visibility
     */
    updateActivePanelUI() {
        this.elements.panels.forEach((panelEl, index) => {
            if (panelEl) {
                const isActive = index === this.state.activeIndex;
                panelEl.classList.toggle('active', isActive);
                panelEl.setAttribute('aria-hidden', (!isActive).toString());
                
                if (isActive) {
                    panelEl.removeAttribute('hidden');
                } else {
                    panelEl.setAttribute('hidden', '');
                }
            }
        });
    }

    /**
     * Animate panel switch with fade effect
     * @param {number} fromIndex - Previous panel index
     * @param {number} toIndex - Target panel index
     * @async
     */
    async animatePanelSwitch(fromIndex, toIndex) {
        return new Promise((resolve) => {
            this.state.isAnimating = true;
            
            const fromPanel = this.elements.panels[fromIndex];
            const toPanel = this.elements.panels[toIndex];
            
            if (!fromPanel || !toPanel) {
                this.updateActivePanelUI();
                this.state.isAnimating = false;
                resolve();
                return;
            }

            // Set initial state for animation
            toPanel.style.opacity = '0';
            toPanel.style.transform = 'translateY(8px)';
            toPanel.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;
            toPanel.removeAttribute('hidden');
            
            // Show target panel
            this.updateActivePanelUI();

            // Trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    fromPanel.style.opacity = '0';
                    fromPanel.style.transform = 'translateY(-8px)';
                    fromPanel.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;
                    
                    toPanel.style.opacity = '1';
                    toPanel.style.transform = 'translateY(0)';
                });
            });

            // Clean up after animation
            setTimeout(() => {
                // Hide old panel completely
                fromPanel.setAttribute('hidden', '');
                fromPanel.style.opacity = '';
                fromPanel.style.transform = '';
                fromPanel.style.transition = '';
                
                // Reset new panel styles
                toPanel.style.opacity = '';
                toPanel.style.transform = '';
                toPanel.style.transition = '';
                
                this.state.isAnimating = false;
                resolve();
            }, this.config.animationDuration);
        });
    }

    /**
     * Scroll tab into view
     * @param {number} index - Tab index to scroll to
     */
    scrollToTab(index) {
        if (!this.elements.tabList) return;
        
        const tabEl = this.elements.tabItems[index];
        if (!tabEl) return;
        
        const tabListRect = this.elements.tabList.getBoundingClientRect();
        const tabRect = tabEl.getBoundingClientRect();
        
        // Check if tab is outside visible area
        if (tabRect.left < tabListRect.left) {
            // Tab is to the left
            this.elements.tabList.scrollBy({
                left: tabRect.left - tabListRect.left - 20,
                behavior: 'smooth'
            });
        } else if (tabRect.right > tabListRect.right) {
            // Tab is to the right
            this.elements.tabList.scrollBy({
                left: tabRect.right - tabListRect.right + 20,
                behavior: 'smooth'
            });
        }
        
        // Update scroll buttons after scroll animation
        setTimeout(() => this.updateScrollButtons(), 350);
    }

    /**
     * Update scroll button visibility
     */
    updateScrollButtons() {
        if (!this.config.showScrollButtons || !this.elements.tabList) return;
        
        const tabList = this.elements.tabList;
        const maxScroll = tabList.scrollWidth - tabList.clientWidth;
        
        // Show/hide previous button
        if (this.elements.scrollPrev) {
            const showPrev = tabList.scrollLeft > 5;
            this.elements.scrollPrev.style.display = showPrev ? 'flex' : 'none';
        }
        
        // Show/hide next button
        if (this.elements.scrollNext) {
            const showNext = tabList.scrollLeft < maxScroll - 5;
            this.elements.scrollNext.style.display = showNext ? 'flex' : 'none';
        }
        
        this.state.scrollPosition = tabList.scrollLeft;
        this.state.maxScroll = maxScroll;
    }

    /**
     * Update scroll state
     */
    updateScrollState() {
        if (!this.elements.tabList) return;
        this.state.scrollPosition = this.elements.tabList.scrollLeft;
        this.state.maxScroll = this.elements.tabList.scrollWidth - this.elements.tabList.clientWidth;
    }

    /**
     * Close a tab by index
     * @param {number} index - Tab index to close
     * @returns {boolean} Success status
     */
    closeTab(index) {
        try {
            const tab = this.state.tabs[index];
            
            if (!tab) {
                console.warn(`[Tabs] Cannot close non-existent tab at index: ${index}`);
                return false;
            }
            
            if (!tab.closable && !this.config.closableTabs.includes(tab.id)) {
                console.warn(`[Tabs] Tab "${tab.label}" is not closable`);
                return false;
            }

            console.log(`[Tabs] Closing tab: ${tab.label}`);

            // Fire before close callback
            if (this.config.onTabClose) {
                const allowClose = this.config.onTabClose({
                    tab,
                    index,
                    componentId: this.componentId
                });
                
                if (allowClose === false) {
                    return false;
                }
            }

            // If closing active tab, switch to adjacent tab first
            if (index === this.state.activeIndex) {
                // Find next non-disabled, visible tab
                let nextIndex = -1;
                
                // Try next tab first
                for (let i = index + 1; i < this.state.tabs.length; i++) {
                    if (!this.state.tabs[i].disabled && this.state.tabs[i].visible && i !== index) {
                        nextIndex = i;
                        break;
                    }
                }
                
                // Try previous tab if no next
                if (nextIndex < 0) {
                    for (let i = index - 1; i >= 0; i--) {
                        if (!this.state.tabs[i].disabled && this.state.tabs[i].visible && i !== index) {
                            nextIndex = i;
                            break;
                        }
                    }
                }
                
                if (nextIndex >= 0) {
                    // Switch silently before removing
                    this.state.activeIndex = nextIndex;
                    this.state.activeTabId = this.state.tabs[nextIndex]?.id || null;
                }
            }

            // Remove tab from state
            this.state.tabs.splice(index, 1);
            
            // Adjust active index if needed
            if (index < this.state.activeIndex) {
                this.state.activeIndex--;
            }

            // Fire remove callback
            if (this.config.onTabRemove) {
                this.config.onTabRemove({
                    tab,
                    index,
                    newActiveIndex: this.state.activeIndex
                });
            }

            // Re-render
            this.render();
            this.bindEvents();
            
            // Emit event
            EventBus.emit('tabs:tab-closed', {
                componentId: this.componentId,
                tab,
                index,
                activeIndex: this.state.activeIndex
            });

            return true;

        } catch (error) {
            console.error('[Tabs] Tab close failed:', error);
            return false;
        }
    }

    /**
     * Add a new tab dynamically
     * @param {Object} tabData - Tab configuration
     * @param {number} [position] - Insert position (default: end)
     * @returns {boolean} Success status
     */
    addTab(tabData, position = -1) {
        try {
            // Create complete tab object with defaults
            const newTab = {
                id: tabData.id || `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                label: tabData.label || tabData.title || 'New Tab',
                icon: tabData.icon || null,
                badge: tabData.badge || null,
                badgeColor: tabData.badgeColor || '#3B82F6',
                content: tabData.content || '',
                panelId: tabData.panelId || `panel-${newTab?.id || Date.now()}`,
                disabled: tabData.disabled || false,
                closable: tabData.closable || false,
                loading: tabData.loading || false,
                visible: tabData.visible !== false,
                metadata: tabData.metadata || {},
                loadURL: tabData.loadURL || null,
                loadMethod: tabData.loadMethod || 'GET',
                loadHeaders: tabData.loadHeaders || {},
                loadCache: tabData.loadCache !== false
            };

            // Fix circular reference - set ID properly
            if (!newTab.id) newTab.id = `tab-${Date.now()}`;

            // Insert at specified position or end
            const insertIndex = position >= 0 && position <= this.state.tabs.length ? 
                position : this.state.tabs.length;

            this.state.tabs.splice(insertIndex, 0, newTab);
            
            console.log(`[Tabs] Added tab: ${newTab.label} at index ${insertIndex}`);

            // Fire add callback
            if (this.config.onTabAdd) {
                this.config.onTabAdd({
                    tab: newTab,
                    index: insertIndex,
                    componentId: this.componentId
                });
            }

            // Re-render
            this.render();
            this.bindEvents();

            // Optionally switch to new tab
            if (tabData.activate !== false) {
                this.switchTab(insertIndex);
            }

            // Emit event
            EventBus.emit('tabs:tab-added', {
                componentId: this.componentId,
                tab: newTab,
                index: insertIndex
            });

            return true;

        } catch (error) {
            console.error('[Tabs] Add tab failed:', error);
            return false;
        }
    }

    /**
     * Update an existing tab
     * @param {number|string} tabIdentifier - Tab index or ID
     * @param {Object} updates - Properties to update
     * @returns {boolean} Success status
     */
    updateTab(tabIdentifier, updates) {
        try {
            let targetIndex = -1;
            
            if (typeof tabIdentifier === 'string') {
                targetIndex = this.state.tabs.findIndex(t => t.id === tabIdentifier);
            } else {
                targetIndex = tabIdentifier;
            }

            if (targetIndex < 0 || targetIndex >= this.state.tabs.length) {
                console.warn(`[Tabs] Invalid tab for update: ${tabIdentifier}`);
                return false;
            }

            // Apply updates
            Object.assign(this.state.tabs[targetIndex], updates);
            
            console.log(`[Tabs] Updated tab at index ${targetIndex}`);
            
            // Re-render
            this.render();
            this.bindEvents();

            return true;

        } catch (error) {
            console.error('[Tabs] Tab update failed:', error);
            return false;
        }
    }

    /**
     * Get current active tab data
     * @returns {Object|null} Active tab object
     */
    getActiveTab() {
        return this.state.tabs[this.state.activeIndex] || null;
    }

    /**
     * Get all tabs data
     * @returns {Array} Array of tab objects
     */
    getTabs() {
        return [...this.state.tabs];
    }

    /**
     * Bind all event handlers
     * Sets up click, keyboard, drag, scroll, resize, and touch events
     */
    bindEvents() {
        try {
            // Tab click events - use event delegation on tab list
            if (this.elements.tabList) {
                // Remove old listener by cloning
                const newList = this.elements.tabList.cloneNode(true);
                this.elements.tabList.parentNode?.replaceChild(newList, this.elements.tabList);
                this.elements.tabList = newList;

                // Re-cache tab elements
                this.elements.tabItems = [];
                this.elements.panels = [];
                this.state.tabs.forEach((tab, index) => {
                    const tabEl = document.getElementById(`${this.componentId}-tab-${index}`);
                    const panelEl = document.getElementById(`${this.componentId}-panel-${index}`);
                    if (tabEl) this.elements.tabItems[index] = tabEl;
                    if (panelEl) this.elements.panels[index] = panelEl;
                });

                // Add click handler via event delegation
                this.elements.tabList.addEventListener('click', (e) => {
                    const tabButton = e.target.closest('.tabs-tab');
                    if (!tabButton) return;
                    
                    // Ignore clicks on close button
                    if (e.target.closest('.tabs-close')) return;
                    
                    // Ignore disabled tabs
                    if (tabButton.disabled || tabButton.classList.contains('disabled')) return;
                    
                    const index = parseInt(tabButton.dataset.index);
                    if (!isNaN(index)) {
                        // Fire tab click callback
                        if (this.config.onTabClick) {
                            this.config.onTabClick({
                                index,
                                tab: this.state.tabs[index],
                                event: e,
                                componentId: this.componentId
                            });
                        }
                        
                        // Switch to tab
                        this.switchTab(index);
                    }
                });

                // Add keyboard navigation
                if (this.config.keyboardNavigation) {
                    this.elements.tabList.addEventListener('keydown', (e) => {
                        this.handleKeyboardNavigation(e);
                    });
                }

                console.log('[Tabs] Tab click and keyboard events bound');
            }

            // Scroll button events
            if (this.elements.scrollPrev) {
                this.elements.scrollPrev.addEventListener('click', () => {
                    this.elements.tabList?.scrollBy({
                        left: -this.config.scrollAmount,
                        behavior: 'smooth'
                    });
                    setTimeout(() => this.updateScrollButtons(), 350);
                });
            }

            if (this.elements.scrollNext) {
                this.elements.scrollNext.addEventListener('click', () => {
                    this.elements.tabList?.scrollBy({
                        left: this.config.scrollAmount,
                        behavior: 'smooth'
                    });
                    setTimeout(() => this.updateScrollButtons(), 350);
                });
            }

            // Tab list scroll event
            if (this.elements.tabList) {
                this.elements.tabList.addEventListener('scroll', () => {
                    this.updateScrollState();
                    this.updateScrollButtons();
                }, { passive: true });
            }

            // Add tab button
            if (this.elements.addButton) {
                this.elements.addButton.addEventListener('click', () => {
                    if (this.config.onTabAdd) {
                        this.config.onTabAdd({
                            componentId: this.componentId,
                            addTab: (tabData) => this.addTab(tabData)
                        });
                    }
                });
            }

            // Window resize for responsive
            window.addEventListener('resize', this.debounce(() => {
                const wasMobile = this.state.isMobile;
                this.checkResponsiveMode();
                
                // Re-render if mobile state changed
                if (wasMobile !== this.state.isMobile) {
                    this.render();
                    this.bindEvents();
                }
                
                this.updateScrollState();
                this.updateScrollButtons();
            }, 200));

            console.log('[Tabs] All events bound successfully');

        } catch (error) {
            console.error('[Tabs] Event binding failed:', error);
        }
    }

    /**
     * Handle keyboard navigation for tabs
     * Implements ARIA tab pattern: Arrow keys, Home, End
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboardNavigation(e) {
        const tabButtons = this.elements.tabItems.filter(el => el && !el.disabled);
        if (tabButtons.length === 0) return;

        const currentIndex = tabButtons.findIndex(el => el === document.activeElement);
        let newIndex = currentIndex;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                newIndex = currentIndex + 1;
                if (newIndex >= tabButtons.length) newIndex = 0;
                break;

            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                newIndex = currentIndex - 1;
                if (newIndex < 0) newIndex = tabButtons.length - 1;
                break;

            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;

            case 'End':
                e.preventDefault();
                newIndex = tabButtons.length - 1;
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                if (currentIndex >= 0) {
                    const actualIndex = parseInt(tabButtons[currentIndex].dataset.index);
                    this.switchTab(actualIndex);
                }
                return;

            default:
                return;
        }

        // Focus the new tab
        if (newIndex >= 0 && newIndex < tabButtons.length) {
            tabButtons[newIndex].focus();
            
            // Scroll into view
            if (this.config.scrollable) {
                this.scrollToTab(parseInt(tabButtons[newIndex].dataset.index));
            }
        }
    }

    /**
     * Set up observers for DOM and resize
     */
    setupObservers() {
        // Resize observer for container size changes
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.debounce((entries) => {
                this.updateScrollState();
                this.updateScrollButtons();
            }, 150));

            if (this.elements.tabList) {
                this.resizeObserver.observe(this.elements.tabList);
            }
        }

        // Mutation observer for tab content changes
        if (typeof MutationObserver !== 'undefined') {
            this.mutationObserver = new MutationObserver((mutations) => {
                let needsUpdate = false;
                
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        needsUpdate = true;
                    }
                });

                if (needsUpdate) {
                    this.updateScrollState();
                    this.updateScrollButtons();
                }
            });

            if (this.elements.tabList) {
                this.mutationObserver.observe(this.elements.tabList, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });
            }
        }

        console.log('[Tabs] Observers set up');
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
        try {
            // Disconnect observers
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }

            // Remove event listeners
            window.removeEventListener('resize', this.updateScrollButtons);

            // Clear cache
            this.state.panelCache.clear();
            this.state.loadedPanels.clear();
            this.state.loadingTabs.clear();

            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }

            // Remove from instance registry
            if (window.Global?.Tabs?.instances) {
                window.Global.Tabs.instances.delete(this.componentId);
            }

            console.log('[Tabs] Component destroyed');
        } catch (error) {
            console.error('[Tabs] Destroy failed:', error);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Debounce utility for performance
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        const debounced = function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
        debounced.cancel = () => clearTimeout(timeout);
        return debounced;
    }

    /**
     * Static factory method
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration
     * @returns {Tabs} Tabs instance
     */
    static create(container, options) {
        const instance = new Tabs(container, options);
        
        // Register in global instance registry
        if (!window.Global) window.Global = {};
        if (!window.Global.Tabs) window.Global.Tabs = {};
        if (!window.Global.Tabs.instances) window.Global.Tabs.instances = new Map();
        
        window.Global.Tabs.instances.set(instance.componentId, instance);
        
        return instance;
    }

    /**
     * Get instance by ID
     * @param {string} componentId - Component ID
     * @returns {Tabs|null} Tabs instance
     */
    static getInstance(componentId) {
        return window.Global?.Tabs?.instances?.get(componentId) || null;
    }
}

// ES Module export
export { Tabs };
export default Tabs;

// Global scope registration
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Tabs = window.Global.Tabs || {};
    window.Global.Tabs.instances = window.Global.Tabs.instances || new Map();
    window.Global.Tabs.Tabs = Tabs;
}


