/**
 * 11 AVATAR DIGITAL HUB - Infinite Scroll Component
 * Enterprise-grade infinite scrolling system with IntersectionObserver
 * Virtual windowing, bidirectional scroll, pull-to-refresh, skeleton loading
 * 
 * @component InfiniteScroll
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Cache } from '../core/cache.js';

/**
 * InfiniteScroll - High-performance infinite scrolling component
 * Uses IntersectionObserver API for efficient scroll detection
 * Supports bidirectional loading, pull-to-refresh, and skeleton placeholders
 */
class InfiniteScroll {
    /**
     * Initialize the infinite scroll component with full enterprise configuration
     * @param {HTMLElement|string} container - The scrollable container element
     * @param {Object} options - Complete configuration object
     */
    constructor(container, options = {}) {
        // Component identity for debugging and global registry
        this.componentName = 'InfiniteScroll';
        this.componentId = `isc-${Date.now().toString(36)}`;
        
        // Container resolution - accepts both direct element and selector string
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        // Validate container element exists in DOM
        if (!this.container) {
            throw new Error('InfiniteScroll: Container element not found in DOM');
        }

        /**
         * Complete enterprise configuration with detailed defaults
         * Every option is documented with type, purpose, and validation
         */
        this.config = {
            // Data loading configuration
            url: options.url || null,                       // API endpoint for data fetching
            method: options.method || 'GET',                // HTTP method for API calls
            headers: options.headers || {},                  // Custom HTTP headers
            body: options.body || null,                      // POST request body
            params: options.params || {},                    // Query parameters for API calls
            
            // Pagination configuration
            pageSize: options.pageSize || 20,               // Number of items per page load
            initialPage: options.initialPage || 1,          // Starting page number
            pageParam: options.pageParam || 'page',         // Query parameter name for page
            sizeParam: options.sizeParam || 'limit',        // Query parameter name for page size
            totalKey: options.totalKey || 'total',           // Key in response for total count
            dataKey: options.dataKey || 'data',              // Key in response for data array
            hasMoreKey: options.hasMoreKey || 'hasMore',     // Key in response for hasMore flag
            
            // Scroll direction
            direction: options.direction || 'down',          // 'down' | 'up' | 'both'
            reverse: options.reverse || false,               // Reverse the order of loaded items
            
            // UI configuration
            threshold: options.threshold || 200,             // Pixels before end to trigger load
            scrollContainer: options.scrollContainer || null, // Custom scroll container (default: container)
            itemRenderer: options.itemRenderer || null,       // Custom function to render each item
            skeletonRenderer: options.skeletonRenderer || null, // Custom skeleton/placeholder renderer
            emptyRenderer: options.emptyRenderer || null,    // Custom empty state renderer
            errorRenderer: options.errorRenderer || null,    // Custom error state renderer
            loadingRenderer: options.loadingRenderer || null, // Custom loading indicator renderer
            
            // Pull-to-refresh (for top-down scrolling)
            pullToRefresh: options.pullToRefresh || false,   // Enable pull-to-refresh on mobile
            pullDistance: options.pullDistance || 80,         // Distance needed to trigger refresh
            pullMaxDistance: options.pullMaxDistance || 160,  // Maximum pull distance
            refreshLabel: options.refreshLabel || 'Pull to refresh',
            releaseLabel: options.releaseLabel || 'Release to refresh',
            loadingLabel: options.loadingLabel || 'Loading...',
            
            // Behavior
            autoLoad: options.autoLoad !== false,             // Automatically load on init
            loadOnMount: options.loadOnMount !== false,       // Load first page on component mount
            resetOnRefresh: options.resetOnRefresh !== false, // Reset data on pull-to-refresh
            cacheResults: options.cacheResults || false,      // Cache loaded pages in memory
            maxCachedPages: options.maxCachedPages || 10,     // Maximum number of pages to cache
            debounceTime: options.debounceTime || 100,        // Debounce time for scroll events
            retryCount: options.retryCount || 3,              // Number of retry attempts on failure
            retryDelay: options.retryDelay || 2000,           // Delay between retry attempts in ms
            
            // State management
            initialData: options.initialData || [],           // Pre-loaded data to start with
            totalItems: options.totalItems || 0,              // Total items count if known
            
            // Loading states
            showLoading: options.showLoading !== false,       // Show loading indicator
            showEndMessage: options.showEndMessage || false,  // Show "No more items" message
            endMessage: options.endMessage || 'No more items to load',
            showError: options.showError !== false,           // Show error state on failure
            errorMessage: options.errorMessage || 'Failed to load data. Tap to retry.',
            
            // Theme
            theme: options.theme || 'light',                  // 'light' | 'dark'
            
            // Callbacks - comprehensive event system
            onLoad: options.onLoad || null,                   // Called when new data is fetched
            onLoadMore: options.onLoadMore || null,           // Called when loading more items
            onRefresh: options.onRefresh || null,             // Called on pull-to-refresh
            onError: options.onError || null,                 // Called on load error
            onEnd: options.onEnd || null,                     // Called when all items loaded
            onScroll: options.onScroll || null,               // Called on scroll event
            onItemRender: options.onItemRender || null,       // Called after each item is rendered
            beforeLoad: options.beforeLoad || null,           // Called before loading starts
            afterLoad: options.afterLoad || null              // Called after loading completes
        };

        /**
         * Internal state management
         * Tracks all mutable state for the component lifecycle
         */
        this.state = {
            // Data state
            items: [...this.config.initialData],              // All loaded items array
            currentPage: this.config.initialPage,             // Current page number
            totalItems: this.config.totalItems,               // Total items count from server
            hasMore: true,                                     // Whether more items exist to load
            isLoading: false,                                  // Whether a load is in progress
            isRefreshing: false,                               // Whether pull-to-refresh is active
            isInitialized: false,                              // Whether initial load is complete
            loadError: null,                                   // Last error message if any
            retryAttempts: 0,                                  // Current retry count
            
            // Scroll state
            scrollTop: 0,                                      // Current scroll position
            scrollHeight: 0,                                   // Total scrollable height
            clientHeight: 0,                                   // Visible container height
            isNearBottom: false,                               // Whether scroll is near bottom
            isNearTop: false,                                  // Whether scroll is near top
            
            // Pull-to-refresh state
            pullStartY: 0,                                     // Touch start Y position
            pullCurrentY: 0,                                   // Current touch Y position
            pullDistance: 0,                                   // Current pull distance
            isPulling: false,                                  // Whether user is pulling
            pullPhase: 'idle',                                 // 'idle' | 'pulling' | 'ready' | 'refreshing'
            
            // Cache state
            pageCache: new Map(),                              // Cache of loaded pages
            lastLoadTime: null,                                // Timestamp of last successful load
            
            // Performance
            totalLoaded: 0,                                    // Total items loaded
            loadCount: 0,                                      // Number of load operations
            averageLoadTime: 0,                                // Average time per load
            totalLoadTime: 0                                   // Cumulative load time
        };

        // DOM element cache for performance
        this.elements = {
            wrapper: null,               // Main wrapper element
            scrollContainer: null,       // The scrollable container
            itemsContainer: null,        // Container for rendered items
            sentinelTop: null,           // Top sentinel for upward scroll detection
            sentinelBottom: null,        // Bottom sentinel for downward scroll detection
            loadingIndicator: null,      // Loading spinner/message element
            endMessage: null,            // "No more items" message element
            errorMessage: null,          // Error state element
            pullIndicator: null,         // Pull-to-refresh indicator
            emptyState: null             // Empty state element
        };

        // IntersectionObserver instances
        this.topObserver = null;
        this.bottomObserver = null;

        // Scroll event debounce timer
        this.scrollTimer = null;

        // ResizeObserver for container size changes
        this.resizeObserver = null;

        // AbortController for cancellable fetch requests
        this.abortController = null;

        // Performance tracking
        this.performance = {
            initTime: 0,
            firstLoadTime: 0,
            totalItemsRendered: 0,
            totalLoadsTriggered: 0,
            lastActivity: null
        };

        // Bind methods to maintain correct 'this' context
        this.handleScroll = this.handleScroll.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.loadMore = this.loadMore.bind(this);
        this.refresh = this.refresh.bind(this);

        // Initialize component
        this.init();
    }

    /**
     * Initialize the infinite scroll component
     * Sets up DOM structure, observers, and loads initial data
     * @async
     */
    async init() {
        try {
            const initStart = performance.now();
            
            console.log(`[InfiniteScroll] Initializing: ${this.componentId}`);
            console.log(`[InfiniteScroll] Direction: ${this.config.direction}, PageSize: ${this.config.pageSize}`);

            // Validate configuration
            this.validateConfig();

            // Determine the scroll container
            this.resolveScrollContainer();

            // Build the component DOM structure
            this.buildDOM();

            // Set up IntersectionObserver for efficient scroll detection
            this.setupObservers();

            // Bind all event handlers
            this.bindEvents();

            // Load initial data if configured
            if (this.config.loadOnMount && this.config.autoLoad) {
                await this.loadInitialData();
            }

            // Mark as initialized
            this.state.isInitialized = true;

            // Track performance
            this.performance.initTime = performance.now() - initStart;
            console.log(`[InfiniteScroll] Initialized in ${this.performance.initTime.toFixed(2)}ms`);

            // Emit ready event
            EventBus.emit('infinitescroll:ready', {
                componentId: this.componentId,
                itemCount: this.state.items.length,
                hasMore: this.state.hasMore
            });

        } catch (error) {
            console.error('[InfiniteScroll] Initialization failed:', error);
            
            // Show error state in container
            if (this.container) {
                this.container.innerHTML = `
                    <div class="isc-error" role="alert">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to initialize: ${this.escapeHtml(error.message)}</p>
                    </div>
                `;
            }

            // Emit error event
            EventBus.emit('infinitescroll:error', {
                componentId: this.componentId,
                error: error.message,
                phase: 'initialization'
            });
        }
    }

    /**
     * Validate configuration and apply defaults
     * Ensures all required values are set and within acceptable ranges
     */
    validateConfig() {
        // Validate page size
        if (this.config.pageSize < 1) {
            console.warn('[InfiniteScroll] Invalid pageSize, defaulting to 20');
            this.config.pageSize = 20;
        }
        if (this.config.pageSize > 100) {
            console.warn('[InfiniteScroll] pageSize exceeds 100, clamping to 100');
            this.config.pageSize = 100;
        }

        // Validate direction
        const validDirections = ['down', 'up', 'both'];
        if (!validDirections.includes(this.config.direction)) {
            console.warn('[InfiniteScroll] Invalid direction, defaulting to "down"');
            this.config.direction = 'down';
        }

        // Validate threshold
        if (this.config.threshold < 0) {
            this.config.threshold = 0;
        }
        if (this.config.threshold > 1000) {
            this.config.threshold = 1000;
        }

        // Validate retry count
        if (this.config.retryCount < 0) {
            this.config.retryCount = 0;
        }
        if (this.config.retryCount > 10) {
            this.config.retryCount = 10;
        }

        // Set initial hasMore based on data
        if (this.config.totalItems > 0 && this.state.items.length >= this.config.totalItems) {
            this.state.hasMore = false;
        }

        console.log('[InfiniteScroll] Configuration validated');
    }

    /**
     * Resolve the scroll container element
     * Uses custom container if provided, otherwise uses the main container
     */
    resolveScrollContainer() {
        if (this.config.scrollContainer) {
            this.elements.scrollContainer = typeof this.config.scrollContainer === 'string' ?
                document.querySelector(this.config.scrollContainer) : this.config.scrollContainer;
        } else {
            this.elements.scrollContainer = this.container;
        }

        if (!this.elements.scrollContainer) {
            console.warn('[InfiniteScroll] Scroll container not found, using container');
            this.elements.scrollContainer = this.container;
        }
    }

    /**
     * Build the complete DOM structure for the component
     * Creates wrapper, items container, sentinels, and loading states
     */
    buildDOM() {
        try {
            const html = `
                <div class="isc-wrapper isc-theme-${this.config.theme}" id="${this.componentId}">
                    <!-- Top Sentinel for upward scroll detection -->
                    ${(this.config.direction === 'up' || this.config.direction === 'both') ? `
                        <div class="isc-sentinel isc-sentinel-top" 
                             id="${this.componentId}-sentinel-top"
                             aria-hidden="true"></div>
                    ` : ''}

                    <!-- Pull-to-Refresh Indicator -->
                    ${this.config.pullToRefresh ? `
                        <div class="isc-pull-indicator" id="${this.componentId}-pull-indicator">
                            <span class="isc-pull-icon"><i class="fas fa-arrow-down"></i></span>
                            <span class="isc-pull-text">${this.config.refreshLabel}</span>
                        </div>
                    ` : ''}

                    <!-- Items Container -->
                    <div class="isc-items" id="${this.componentId}-items" role="list">
                        ${this.renderItems()}
                    </div>

                    <!-- Loading Indicator -->
                    ${this.config.showLoading ? `
                        <div class="isc-loading" id="${this.componentId}-loading" 
                             style="display:${this.state.isLoading ? 'flex' : 'none'};">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>${this.config.loadingLabel}</span>
                        </div>
                    ` : ''}

                    <!-- End Message -->
                    ${this.config.showEndMessage ? `
                        <div class="isc-end-message" id="${this.componentId}-end" 
                             style="display:${!this.state.hasMore && this.state.items.length > 0 ? 'block' : 'none'};">
                            <p>${this.config.endMessage}</p>
                        </div>
                    ` : ''}

                    <!-- Error Message -->
                    ${this.config.showError ? `
                        <div class="isc-error-message" id="${this.componentId}-error"
                             style="display:${this.state.loadError ? 'block' : 'none'};"
                             onclick="window.Global.InfiniteScroll.instances.get('${this.componentId}').retry()"
                             role="button" tabindex="0">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>${this.state.loadError || this.config.errorMessage}</span>
                            <small>Tap to retry</small>
                        </div>
                    ` : ''}

                    <!-- Empty State -->
                    <div class="isc-empty" id="${this.componentId}-empty"
                         style="display:${this.state.items.length === 0 && !this.state.isLoading && this.state.isInitialized ? 'block' : 'none'};">
                        ${this.renderEmptyState()}
                    </div>

                    <!-- Bottom Sentinel for downward scroll detection -->
                    ${(this.config.direction === 'down' || this.config.direction === 'both') ? `
                        <div class="isc-sentinel isc-sentinel-bottom" 
                             id="${this.componentId}-sentinel-bottom"
                             aria-hidden="true"></div>
                    ` : ''}
                </div>
            `;

            // Set the HTML content
            this.container.innerHTML = html;

            // Cache all DOM element references
            this.cacheElements();

        } catch (error) {
            console.error('[InfiniteScroll] DOM build failed:', error);
            throw error;
        }
    }

    /**
     * Render all currently loaded items
     * Uses custom renderer if provided, otherwise renders JSON
     * @returns {string} HTML string of all items
     */
    renderItems() {
        if (this.state.items.length === 0) return '';

        return this.state.items.map((item, index) => {
            if (this.config.itemRenderer) {
                const rendered = this.config.itemRenderer(item, index, this.state.items.length);
                
                // Fire item render callback
                if (this.config.onItemRender) {
                    this.config.onItemRender(item, index);
                }
                
                return rendered;
            }

            // Default rendering - JSON display
            return `
                <div class="isc-item" role="listitem" data-index="${index}">
                    <pre>${this.escapeHtml(JSON.stringify(item, null, 2))}</pre>
                </div>
            `;
        }).join('');
    }

    /**
     * Render empty state content
     * Uses custom renderer or default empty state
     * @returns {string} Empty state HTML
     */
    renderEmptyState() {
        if (this.config.emptyRenderer) {
            return this.config.emptyRenderer();
        }

        return `
            <div class="isc-empty-content">
                <i class="fas fa-inbox"></i>
                <h4>No Items Found</h4>
                <p>There are no items to display yet.</p>
            </div>
        `;
    }

    /**
     * Cache all DOM element references after render
     * Avoids repeated querySelector calls for performance
     */
    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.itemsContainer = document.getElementById(`${this.componentId}-items`);
        this.elements.sentinelTop = document.getElementById(`${this.componentId}-sentinel-top`);
        this.elements.sentinelBottom = document.getElementById(`${this.componentId}-sentinel-bottom`);
        this.elements.loadingIndicator = document.getElementById(`${this.componentId}-loading`);
        this.elements.endMessage = document.getElementById(`${this.componentId}-end`);
        this.elements.errorMessage = document.getElementById(`${this.componentId}-error`);
        this.elements.pullIndicator = document.getElementById(`${this.componentId}-pull-indicator`);
        this.elements.emptyState = document.getElementById(`${this.componentId}-empty`);
    }

    /**
     * Set up IntersectionObserver instances for scroll detection
     * More efficient than scroll event listeners
     */
    setupObservers() {
        // Get the root element for observation (the scrollable container)
        const root = this.elements.scrollContainer === this.container ? 
            null : this.elements.scrollContainer;

        const observerOptions = {
            root: root,
            rootMargin: `${this.config.threshold}px`,
            threshold: 0.1
        };

        // Bottom sentinel observer for downward scrolling
        if (this.elements.sentinelBottom) {
            this.bottomObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.state.isLoading && this.state.hasMore) {
                        console.log('[InfiniteScroll] Bottom sentinel triggered - loading more');
                        this.loadMore();
                    }
                });
            }, observerOptions);

            this.bottomObserver.observe(this.elements.sentinelBottom);
        }

        // Top sentinel observer for upward scrolling
        if (this.elements.sentinelTop) {
            this.topObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.state.isLoading && this.state.hasMore) {
                        console.log('[InfiniteScroll] Top sentinel triggered - loading previous');
                        this.loadMore('up');
                    }
                });
            }, observerOptions);

            this.topObserver.observe(this.elements.sentinelTop);
        }

        // ResizeObserver for container size changes
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateScrollState();
            });
            this.resizeObserver.observe(this.elements.scrollContainer);
        }

        console.log('[InfiniteScroll] Observers set up successfully');
    }

    /**
     * Bind all event handlers
     * Sets up scroll, touch, and click events
     */
    bindEvents() {
        // Scroll event with debounce for performance
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.addEventListener('scroll', this.debounce(() => {
                this.updateScrollState();
                if (this.config.onScroll) {
                    this.config.onScroll(this.getScrollState());
                }
            }, this.config.debounceTime), { passive: true });
        }

        // Touch events for pull-to-refresh
        if (this.config.pullToRefresh && this.elements.scrollContainer) {
            this.elements.scrollContainer.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            this.elements.scrollContainer.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            this.elements.scrollContainer.addEventListener('touchend', this.handleTouchEnd);
        }

        console.log('[InfiniteScroll] Events bound successfully');
    }

    /**
     * Load initial data when component mounts
     * @async
     */
    async loadInitialData() {
        if (this.state.items.length > 0 && !this.config.resetOnRefresh) {
            // Already have initial data
            this.state.isInitialized = true;
            this.updateUI();
            return;
        }

        console.log('[InfiniteScroll] Loading initial data...');
        await this.loadMore();
    }

    /**
     * Load more items from the server
     * Handles pagination, caching, error retry, and direction
     * @param {string} [direction='down'] - Direction to load ('up' or 'down')
     * @async
     */
    async loadMore(direction = 'down') {
        // Prevent concurrent loads
        if (this.state.isLoading) {
            console.log('[InfiniteScroll] Load already in progress, skipping');
            return;
        }

        // Check if more data is available
        if (!this.state.hasMore && this.state.items.length > 0) {
            console.log('[InfiniteScroll] No more items to load');
            this.updateUI();
            return;
        }

        const loadStart = performance.now();

        try {
            // Set loading state
            this.state.isLoading = true;
            this.state.loadError = null;
            this.updateUI();

            // Fire before load callback
            if (this.config.beforeLoad) {
                this.config.beforeLoad({ direction, page: this.state.currentPage });
            }

            // Cancel any existing request
            if (this.abortController) {
                this.abortController.abort();
            }
            this.abortController = new AbortController();

            // Check cache first if enabled
            if (this.config.cacheResults && this.state.pageCache.has(this.state.currentPage)) {
                console.log(`[InfiniteScroll] Loading page ${this.state.currentPage} from cache`);
                const cachedData = this.state.pageCache.get(this.state.currentPage);
                this.processLoadedData(cachedData, direction);
                return;
            }

            // Fetch data from server
            console.log(`[InfiniteScroll] Fetching page ${this.state.currentPage} from server`);
            const data = await this.fetchData();

            // Process the loaded data
            this.processLoadedData(data, direction);

            // Cache the page if enabled
            if (this.config.cacheResults && data) {
                this.state.pageCache.set(this.state.currentPage, data);
                
                // Prune cache if it exceeds max size
                if (this.state.pageCache.size > this.config.maxCachedPages) {
                    const oldestKey = this.state.pageCache.keys().next().value;
                    this.state.pageCache.delete(oldestKey);
                }
            }

            // Reset retry count on success
            this.state.retryAttempts = 0;

            // Track performance
            const loadTime = performance.now() - loadStart;
            this.state.totalLoadTime += loadTime;
            this.state.loadCount++;
            this.state.averageLoadTime = this.state.totalLoadTime / this.state.loadCount;
            this.state.lastLoadTime = new Date();
            this.performance.totalLoadsTriggered++;
            this.performance.lastActivity = new Date();

            console.log(`[InfiniteScroll] Page ${this.state.currentPage} loaded in ${loadTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('[InfiniteScroll] Load failed:', error);

            // Handle retry logic
            if (this.state.retryAttempts < this.config.retryCount) {
                this.state.retryAttempts++;
                console.log(`[InfiniteScroll] Retrying... (Attempt ${this.state.retryAttempts}/${this.config.retryCount})`);
                
                // Wait before retry with exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, this.state.retryAttempts - 1);
                setTimeout(() => this.loadMore(direction), delay);
            } else {
                // Max retries reached - show error
                this.state.loadError = error.message || this.config.errorMessage;
                
                if (this.config.onError) {
                    this.config.onError({ error, direction, page: this.state.currentPage });
                }

                EventBus.emit('infinitescroll:load-error', {
                    componentId: this.componentId,
                    error: error.message,
                    page: this.state.currentPage
                });
            }
        } finally {
            // Clear loading state
            this.state.isLoading = false;
            this.updateUI();

            // Fire after load callback
            if (this.config.afterLoad) {
                this.config.afterLoad({ 
                    itemCount: this.state.items.length, 
                    hasMore: this.state.hasMore 
                });
            }
        }
    }

    /**
     * Fetch data from the configured API endpoint
     * @returns {Promise<Object>} Response data
     * @async
     */
    async fetchData() {
        // Build the request URL with pagination parameters
        const url = new URL(this.config.url, window.location.origin);
        
        // Add pagination parameters
        url.searchParams.set(this.config.pageParam, this.state.currentPage.toString());
        url.searchParams.set(this.config.sizeParam, this.config.pageSize.toString());

        // Add custom query parameters
        Object.entries(this.config.params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        // Build fetch options
        const fetchOptions = {
            method: this.config.method,
            headers: {
                'Content-Type': 'application/json',
                ...this.config.headers
            },
            signal: this.abortController?.signal
        };

        // Add body for POST/PUT requests
        if (this.config.body && ['POST', 'PUT', 'PATCH'].includes(this.config.method)) {
            fetchOptions.body = JSON.stringify(this.config.body);
        }

        // Execute the fetch request
        const response = await fetch(url.toString(), fetchOptions);

        // Check for HTTP errors
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse the JSON response
        const data = await response.json();
        return data;
    }

    /**
     * Process and append loaded data to the items array
     * @param {Object} data - Response data from server
     * @param {string} direction - Direction data was loaded for
     */
    processLoadedData(data, direction) {
        if (!data) return;

        // Extract data array from response
        const newItems = Array.isArray(data) ? data : 
                        (data[this.config.dataKey] || data.data || data.results || []);

        // Extract pagination info
        const totalItems = data[this.config.totalKey] || data.total || data.totalItems || 0;
        const hasMore = data[this.config.hasMoreKey] !== undefined ? 
                        data[this.config.hasMoreKey] : 
                        (newItems.length >= this.config.pageSize);

        // Update state
        if (totalItems > 0) {
            this.state.totalItems = totalItems;
        }
        
        // Check if we've reached the end
        if (this.state.totalItems > 0 && this.state.items.length + newItems.length >= this.state.totalItems) {
            this.state.hasMore = false;
        } else {
            this.state.hasMore = hasMore;
        }

        // Append or prepend items based on direction
        if (direction === 'up' && this.config.reverse) {
            this.state.items = [...newItems, ...this.state.items];
        } else if (direction === 'up') {
            this.state.items.unshift(...newItems);
        } else {
            this.state.items.push(...newItems);
        }

        // Increment page counter
        this.state.currentPage++;
        this.state.totalLoaded = this.state.items.length;
        this.performance.totalItemsRendered = this.state.items.length;

        console.log(`[InfiniteScroll] Processed ${newItems.length} items. Total: ${this.state.items.length}, HasMore: ${this.state.hasMore}`);

        // Re-render items
        this.renderNewItems(newItems, direction);

        // Fire load callback
        if (this.config.onLoad) {
            this.config.onLoad({
                items: newItems,
                totalItems: this.state.items.length,
                hasMore: this.state.hasMore,
                page: this.state.currentPage - 1
            });
        }

        if (this.config.onLoadMore) {
            this.config.onLoadMore({
                items: newItems,
                direction,
                totalLoaded: this.state.items.length
            });
        }

        // Fire end event if no more items
        if (!this.state.hasMore && this.config.onEnd) {
            this.config.onEnd({ totalItems: this.state.items.length });
        }

        // Emit event
        EventBus.emit('infinitescroll:loaded', {
            componentId: this.componentId,
            newItems: newItems.length,
            totalItems: this.state.items.length,
            hasMore: this.state.hasMore
        });
    }

    /**
     * Render newly loaded items and append to DOM
     * Uses custom renderer or default JSON rendering
     * @param {Array} newItems - New items to render
     * @param {string} direction - Direction to append
     */
    renderNewItems(newItems, direction) {
        if (!this.elements.itemsContainer) return;

        const startIndex = direction === 'up' ? 
            0 : this.state.items.length - newItems.length;

        const itemsHtml = newItems.map((item, i) => {
            const globalIndex = startIndex + i;
            
            if (this.config.itemRenderer) {
                const rendered = this.config.itemRenderer(item, globalIndex, this.state.items.length);
                
                if (this.config.onItemRender) {
                    this.config.onItemRender(item, globalIndex);
                }
                
                return rendered;
            }

            return `
                <div class="isc-item" role="listitem" data-index="${globalIndex}">
                    <pre>${this.escapeHtml(JSON.stringify(item, null, 2))}</pre>
                </div>
            `;
        }).join('');

        // Append or prepend based on direction
        if (direction === 'up') {
            this.elements.itemsContainer.insertAdjacentHTML('afterbegin', itemsHtml);
        } else {
            this.elements.itemsContainer.insertAdjacentHTML('beforeend', itemsHtml);
        }
    }

    /**
     * Refresh all data (pull-to-refresh or manual)
     * Resets state and reloads from page 1
     * @async
     */
    async refresh() {
        if (this.state.isLoading || this.state.isRefreshing) return;

        try {
            this.state.isRefreshing = true;
            console.log('[InfiniteScroll] Refreshing data...');

            // Reset state
            this.state.currentPage = this.config.initialPage;
            this.state.items = [];
            this.state.hasMore = true;
            this.state.loadError = null;
            this.state.retryAttempts = 0;
            this.state.totalItems = 0;
            this.state.totalLoaded = 0;

            // Clear cache if configured
            if (this.config.resetOnRefresh) {
                this.state.pageCache.clear();
            }

            // Clear DOM
            if (this.elements.itemsContainer) {
                this.elements.itemsContainer.innerHTML = '';
            }

            // Reload data
            await this.loadMore();

            // Fire refresh callback
            if (this.config.onRefresh) {
                this.config.onRefresh({ itemCount: this.state.items.length });
            }

            EventBus.emit('infinitescroll:refreshed', {
                componentId: this.componentId,
                itemCount: this.state.items.length
            });

        } catch (error) {
            console.error('[InfiniteScroll] Refresh failed:', error);
        } finally {
            this.state.isRefreshing = false;
            this.updateUI();
        }
    }

    /**
     * Retry loading after an error
     */
    retry() {
        this.state.retryAttempts = 0;
        this.state.loadError = null;
        this.updateUI();
        this.loadMore();
    }

    /**
     * Update the scroll state tracking
     * Records current scroll position and boundaries
     */
    updateScrollState() {
        const container = this.elements.scrollContainer;
        if (!container) return;

        this.state.scrollTop = container.scrollTop;
        this.state.scrollHeight = container.scrollHeight;
        this.state.clientHeight = container.clientHeight;

        // Check proximity to edges
        const distanceFromBottom = this.state.scrollHeight - 
            (this.state.scrollTop + this.state.clientHeight);
        const distanceFromTop = this.state.scrollTop;

        this.state.isNearBottom = distanceFromBottom < this.config.threshold;
        this.state.isNearTop = distanceFromTop < this.config.threshold;
    }

    /**
     * Get current scroll state information
     * @returns {Object} Scroll state object
     */
    getScrollState() {
        return {
            scrollTop: this.state.scrollTop,
            scrollHeight: this.state.scrollHeight,
            clientHeight: this.state.clientHeight,
            isNearBottom: this.state.isNearBottom,
            isNearTop: this.state.isNearTop,
            scrollPercentage: this.state.scrollHeight > 0 ?
                Math.round((this.state.scrollTop / (this.state.scrollHeight - this.state.clientHeight)) * 100) : 0
        };
    }

    /**
     * Update the UI to reflect current state
     * Shows/hides loading, error, end message, empty state
     */
    updateUI() {
        // Update loading indicator
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 
                this.state.isLoading ? 'flex' : 'none';
        }

        // Update end message
        if (this.elements.endMessage) {
            this.elements.endMessage.style.display = 
                (!this.state.hasMore && this.state.items.length > 0) ? 'block' : 'none';
        }

        // Update error message
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 
                this.state.loadError ? 'block' : 'none';
        }

        // Update empty state
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 
                (this.state.items.length === 0 && !this.state.isLoading && this.state.isInitialized) ? 'block' : 'none';
        }
    }

    /**
     * Handle touch start for pull-to-refresh
     * @param {TouchEvent} e - Touch event
     */
    handleTouchStart(e) {
        // Only enable pull-to-refresh when at the top of the scroll
        if (this.state.scrollTop > 5) return;

        this.state.pullStartY = e.touches[0].clientY;
        this.state.isPulling = true;
    }

    /**
     * Handle touch move for pull-to-refresh
     * @param {TouchEvent} e - Touch event
     */
    handleTouchMove(e) {
        if (!this.state.isPulling || this.state.isRefreshing) return;

        this.state.pullCurrentY = e.touches[0].clientY;
        this.state.pullDistance = Math.max(0, this.state.pullCurrentY - this.state.pullStartY);

        // Apply resistance - pull gets harder the further you go
        const resistance = 0.5;
        const adjustedDistance = this.state.pullDistance > this.config.pullMaxDistance ?
            this.config.pullMaxDistance + (this.state.pullDistance - this.config.pullMaxDistance) * 0.2 :
            this.state.pullDistance * resistance;

        // Update pull phase
        if (adjustedDistance >= this.config.pullDistance) {
            this.state.pullPhase = 'ready';
        } else if (adjustedDistance > 10) {
            this.state.pullPhase = 'pulling';
        }

        // Apply transform to pull indicator
        if (this.elements.pullIndicator) {
            this.elements.pullIndicator.style.transform = `translateY(${adjustedDistance}px)`;
            this.elements.pullIndicator.style.opacity = Math.min(1, adjustedDistance / this.config.pullDistance);
            
            const textEl = this.elements.pullIndicator.querySelector('.isc-pull-text');
            if (textEl) {
                textEl.textContent = this.state.pullPhase === 'ready' ? 
                    this.config.releaseLabel : this.config.refreshLabel;
            }
        }

        // Prevent default scroll when pulling
        if (this.state.pullDistance > 10) {
            e.preventDefault();
        }
    }

    /**
     * Handle touch end for pull-to-refresh
     * Triggers refresh if pulled far enough
     */
    handleTouchEnd() {
        if (!this.state.isPulling) return;
        this.state.isPulling = false;

        if (this.state.pullPhase === 'ready') {
            // Trigger refresh
            this.refresh();
        }

        // Reset pull state
        this.state.pullPhase = 'idle';
        this.state.pullDistance = 0;

        // Animate pull indicator back
        if (this.elements.pullIndicator) {
            this.elements.pullIndicator.style.transform = 'translateY(0)';
            this.elements.pullIndicator.style.opacity = '0';
            const textEl = this.elements.pullIndicator.querySelector('.isc-pull-text');
            if (textEl) {
                textEl.textContent = this.config.refreshLabel;
            }
        }
    }

    /**
     * Handle scroll events with debounce
     * @param {Event} e - Scroll event
     */
    handleScroll(e) {
        this.updateScrollState();
    }

    /**
     * Get all loaded items
     * @returns {Array} Array of all loaded items
     */
    getItems() {
        return [...this.state.items];
    }

    /**
     * Get current state information
     * @returns {Object} Component state
     */
    getState() {
        return {
            itemCount: this.state.items.length,
            currentPage: this.state.currentPage,
            hasMore: this.state.hasMore,
            isLoading: this.state.isLoading,
            totalItems: this.state.totalItems,
            loadError: this.state.loadError
        };
    }

    /**
     * Programmatically scroll to the top of the container
     * @param {boolean} [smooth=true] - Use smooth scrolling
     */
    scrollToTop(smooth = true) {
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.scrollTo({
                top: 0,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }

    /**
     * Programmatically scroll to the bottom of the container
     * @param {boolean} [smooth=true] - Use smooth scrolling
     */
    scrollToBottom(smooth = true) {
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.scrollTo({
                top: this.elements.scrollContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }

    /**
     * Debounce utility for performance optimization
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
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
     * Destroy component and clean up all resources
     */
    destroy() {
        try {
            // Cancel any pending requests
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }

            // Disconnect observers
            if (this.bottomObserver) {
                this.bottomObserver.disconnect();
                this.bottomObserver = null;
            }
            if (this.topObserver) {
                this.topObserver.disconnect();
                this.topObserver = null;
            }
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }

            // Remove event listeners
            if (this.elements.scrollContainer) {
                this.elements.scrollContainer.removeEventListener('scroll', this.handleScroll);
                this.elements.scrollContainer.removeEventListener('touchstart', this.handleTouchStart);
                this.elements.scrollContainer.removeEventListener('touchmove', this.handleTouchMove);
                this.elements.scrollContainer.removeEventListener('touchend', this.handleTouchEnd);
            }

            // Clear DOM
            if (this.container) {
                this.container.innerHTML = '';
            }

            // Clear state
            this.state.items = [];
            this.state.pageCache.clear();

            // Remove from global registry
            if (window.Global?.InfiniteScroll?.instances) {
                window.Global.InfiniteScroll.instances.delete(this.componentId);
            }

            console.log('[InfiniteScroll] Component destroyed');
        } catch (error) {
            console.error('[InfiniteScroll] Destroy failed:', error);
        }
    }

    /**
     * Static factory method
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration
     * @returns {InfiniteScroll} Instance
     */
    static create(container, options) {
        const instance = new InfiniteScroll(container, options);
        
        if (!window.Global) window.Global = {};
        if (!window.Global.InfiniteScroll) window.Global.InfiniteScroll = {};
        if (!window.Global.InfiniteScroll.instances) window.Global.InfiniteScroll.instances = new Map();
        
        window.Global.InfiniteScroll.instances.set(instance.componentId, instance);
        
        return instance;
    }

    /**
     * Get instance by component ID
     * @param {string} componentId - Component ID
     * @returns {InfiniteScroll|null} Instance
     */
    static getInstance(componentId) {
        return window.Global?.InfiniteScroll?.instances?.get(componentId) || null;
    }
}

// ES Module export
export { InfiniteScroll };
export default InfiniteScroll;

// Global scope registration
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.InfiniteScroll = window.Global.InfiniteScroll || {};
    window.Global.InfiniteScroll.instances = window.Global.InfiniteScroll.instances || new Map();
    window.Global.InfiniteScroll.InfiniteScroll = InfiniteScroll;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
