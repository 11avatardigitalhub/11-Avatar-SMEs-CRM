/* ==========================================
   11 AVATAR DIGITAL HUB
   SPA Router - Client-Side Navigation
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Single Page Application routing
   - Hash-based navigation (#/dashboard)
   - Page loading & rendering
   - Route guards (auth, permissions)
   - Browser history management
   - Lazy module loading
   - Page transition animations
   - Scroll restoration
   - Error page fallback
   ==========================================
   Dependencies:
   - RoutesConfig (routes.js)
   - App (app.js)
   - FirebaseService (firebase.js)
   - Constants (constants.js)
   ========================================== */

// ==========================================
// ROUTER CLASS
// ==========================================
class Router {
    
    /**
     * Initialize the router
     * @param {Object} options - Router configuration options
     */
    constructor(options = {}) {
        // Configuration
        this.options = {
            mode: 'hash',             // 'hash' or 'history'
            root: '/',                // Root path
            transitionDuration: 300,  // Page transition animation duration (ms)
            scrollToTop: true,        // Scroll to top on navigation
            saveScrollPosition: true, // Remember scroll positions
            preloadLinks: true,       // Preload linked pages on hover
            maxCacheSize: 20,         // Maximum cached pages
            ...options
        };
        
        // State
        this.currentRoute = null;
        this.previousRoute = null;
        this.isNavigating = false;
        this.navigationHistory = [];
        this.maxHistoryLength = 50;
        
        // Cache
        this.pageCache = new Map();
        this.scrollPositions = new Map();
        
        // Hooks
        this.beforeHooks = [];
        this.afterHooks = [];
        this.errorHooks = [];
        
        // DOM Elements
        this.contentContainer = null;
        this.loadingIndicator = null;
        
        // Bind methods
        this.handleHashChange = this.handleHashChange.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        this.handleLinkClick = this.handleLinkClick.bind(this);
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the router
     */
    init() {
        console.log('🧭 Initializing Router...');
        
        // Find content container
        this.contentContainer = document.getElementById('app-content') || 
                                document.querySelector('.main-content') ||
                                document.body;
        
        // Create loading indicator
        this.createLoadingIndicator();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial route
        this.loadInitialRoute();
        
        console.log('✅ Router initialized');
    }
    
    /**
     * Create loading indicator element
     */
    createLoadingIndicator() {
        // Check if already exists
        if (document.getElementById('router-loading')) return;
        
        const loader = document.createElement('div');
        loader.id = 'router-loading';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            z-index: 9999;
            pointer-events: none;
            display: none;
        `;
        
        const bar = document.createElement('div');
        bar.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, var(--gold, #D4AF37), var(--gold-light, #E8C95A));
            transition: width 0.3s ease;
            border-radius: 0 3px 3px 0;
        `;
        
        loader.appendChild(bar);
        document.body.appendChild(loader);
        this.loadingIndicator = loader;
    }
    
    /**
     * Show loading indicator
     */
    showLoading() {
        if (!this.loadingIndicator) return;
        
        const bar = this.loadingIndicator.querySelector('div');
        this.loadingIndicator.style.display = 'block';
        
        // Animate progress
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 85) {
                clearInterval(interval);
                return;
            }
            width += (85 - width) * 0.1;
            bar.style.width = width + '%';
        }, 50);
        
        this._loadingInterval = interval;
    }
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (!this.loadingIndicator) return;
        
        clearInterval(this._loadingInterval);
        
        const bar = this.loadingIndicator.querySelector('div');
        bar.style.width = '100%';
        
        setTimeout(() => {
            bar.style.width = '0%';
            setTimeout(() => {
                this.loadingIndicator.style.display = 'none';
            }, 200);
        }, 100);
    }
    
    /**
     * Setup event listeners for navigation
     */
    setupEventListeners() {
        // Hash change
        window.addEventListener('hashchange', this.handleHashChange);
        
        // Browser back/forward
        window.addEventListener('popstate', this.handlePopState);
        
        // Click on links (event delegation)
        document.addEventListener('click', this.handleLinkClick);
        
        // Keyboard navigation
        document.addEventListener('keydown', (event) => {
            // Alt + Left Arrow = Back
            if (event.altKey && event.key === 'ArrowLeft') {
                event.preventDefault();
                this.goBack();
            }
            
            // Alt + Right Arrow = Forward
            if (event.altKey && event.key === 'ArrowRight') {
                event.preventDefault();
                this.goForward();
            }
        });
        
        console.log('👂 Router event listeners setup complete');
    }
    
    /**
     * Handle hash change events
     */
    handleHashChange(event) {
        const hash = window.location.hash.slice(1) || '/';
        const routeId = this.pathToRouteId(hash);
        
        if (routeId && routeId !== this.currentRoute) {
            this.navigateTo(routeId, { source: 'hashchange' });
        }
    }
    
    /**
     * Handle browser back/forward
     */
    handlePopState(event) {
        const hash = window.location.hash.slice(1) || '/';
        const routeId = this.pathToRouteId(hash);
        
        if (routeId) {
            this.navigateTo(routeId, { 
                source: 'popstate',
                restoreScroll: true,
                updateHistory: false // Don't push again
            });
        }
    }
    
    /**
     * Handle click on internal links
     */
    handleLinkClick(event) {
        // Find closest anchor tag
        const link = event.target.closest('a');
        if (!link) return;
        
        // Get href
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Skip external links
        if (link.hostname !== window.location.hostname && link.hostname !== '') return;
        
        // Skip if modifier keys are pressed
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        
        // Skip if target="_blank"
        if (link.target === '_blank') return;
        
        // Skip if it's a hash link on the same page (scroll behavior)
        if (href.startsWith('#') && !href.startsWith('#/')) return;
        
        // Handle internal navigation
        event.preventDefault();
        
        const routeId = this.urlToRouteId(href);
        if (routeId) {
            this.navigateTo(routeId, { source: 'click' });
        }
    }
    
    /**
     * Load the initial route on page load
     */
    loadInitialRoute() {
        let routeId = null;
        
        // Check URL hash
        const hash = window.location.hash.slice(1);
        if (hash) {
            routeId = this.pathToRouteId(hash);
        }
        
        // Check session storage for last route
        if (!routeId) {
            const savedRoute = sessionStorage.getItem('lastRoute');
            if (savedRoute) {
                routeId = savedRoute;
            }
        }
        
        // Default to landing or dashboard based on auth
        if (!routeId) {
            const isAuthenticated = window.App?.state?.isAuthenticated || false;
            routeId = isAuthenticated ? 'dashboard' : 'landing';
        }
        
        // Navigate to initial route
        this.navigateTo(routeId, { 
            source: 'initial',
            replaceHistory: true 
        });
    }
    
    /**
     * Main navigation method
     * @param {string} routeId - Route identifier
     * @param {Object} options - Navigation options
     */
    async navigateTo(routeId, options = {}) {
        // Prevent concurrent navigation
        if (this.isNavigating) {
            console.warn('⚠️ Navigation already in progress');
            return false;
        }
        
        // Get route configuration
        const route = RoutesConfig.getRoute(routeId);
        if (!route) {
            console.error('❌ Route not found:', routeId);
            this.navigateTo('notFound', options);
            return false;
        }
        
        // Check authentication
        if (route.access !== null) {
            const isAuthenticated = window.App?.state?.isAuthenticated || false;
            if (!isAuthenticated) {
                console.warn('⚠️ Authentication required for:', routeId);
                this.navigateTo('login', { redirectAfter: routeId });
                return false;
            }
            
            // Check permissions
            const user = window.App?.state?.userProfile;
            if (!RoutesConfig.canAccessRoute(routeId, user)) {
                console.warn('⚠️ Permission denied for:', routeId);
                window.App?.toast?.('You do not have permission to access this page.', 'error');
                return false;
            }
        }
        
        // Run before hooks
        for (const hook of this.beforeHooks) {
            try {
                const result = await hook(routeId, route, options);
                if (result === false) {
                    console.log('🛑 Navigation cancelled by before hook');
                    return false;
                }
            } catch (error) {
                console.error('❌ Error in before hook:', error);
            }
        }
        
        // Start navigation
        this.isNavigating = true;
        this.showLoading();
        
        try {
            // Save current scroll position
            if (this.options.saveScrollPosition && this.currentRoute) {
                this.scrollPositions.set(this.currentRoute, {
                    x: window.scrollX,
                    y: window.scrollY
                });
            }
            
            // Save previous route
            this.previousRoute = this.currentRoute;
            
            // Update current route
            this.currentRoute = routeId;
            
            // Update URL
            this.updateURL(route, options);
            
            // Update browser history
            if (!options.replaceHistory && !options.updateHistory === false) {
                this.addToHistory(routeId, route);
            }
            
            // Save last route
            sessionStorage.setItem('lastRoute', routeId);
            
            // Apply theme
            this.applyTheme(route);
            
            // Update page title
            document.title = route.title || '11 Avatar Digital Hub';
            
            // Update meta description
            this.updateMetaDescription(route);
            
            // Load page content
            await this.loadPage(routeId, route, options);
            
            // Update header active state
            this.updateActiveNav(routeId);
            
            // Update submenu
            this.updateSubmenu(routeId, route);
            
            // Restore scroll position
            if (options.restoreScroll) {
                const savedPosition = this.scrollPositions.get(routeId);
                if (savedPosition) {
                    window.scrollTo(savedPosition.x, savedPosition.y);
                }
            } else if (this.options.scrollToTop) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Dispatch navigation event
            window.dispatchEvent(new CustomEvent('navigation:complete', {
                detail: { routeId, route, previousRoute: this.previousRoute }
            }));
            
            // Run after hooks
            for (const hook of this.afterHooks) {
                try {
                    await hook(routeId, route, options);
                } catch (error) {
                    console.error('❌ Error in after hook:', error);
                }
            }
            
            console.log(`✅ Navigated to: ${routeId}`);
            return true;
            
        } catch (error) {
            console.error('❌ Navigation failed:', error);
            
            // Run error hooks
            for (const hook of this.errorHooks) {
                try {
                    await hook(error, routeId, route, options);
                } catch (hookError) {
                    console.error('❌ Error in error hook:', hookError);
                }
            }
            
            // Navigate to error page
            if (routeId !== 'error') {
                this.navigateTo('error', { error: error.message });
            }
            
            return false;
            
        } finally {
            this.isNavigating = false;
            this.hideLoading();
        }
    }
    
    /**
     * Update browser URL
     */
    updateURL(route, options) {
        const url = '#' + route.path;
        
        if (options.replaceHistory) {
            window.location.replace(url);
        } else if (options.updateHistory !== false) {
            window.location.hash = route.path;
        }
    }
    
    /**
     * Add navigation to history stack
     */
    addToHistory(routeId, route) {
        this.navigationHistory.push({
            routeId,
            path: route.path,
            title: route.title,
            timestamp: new Date().toISOString()
        });
        
        // Trim history
        if (this.navigationHistory.length > this.maxHistoryLength) {
            this.navigationHistory = this.navigationHistory.slice(-this.maxHistoryLength);
        }
    }
    
    /**
     * Load page content
     */
    async loadPage(routeId, route, options) {
        // Check cache first
        if (this.pageCache.has(routeId) && !options.skipCache) {
            const cachedContent = this.pageCache.get(routeId);
            this.renderContent(cachedContent, route);
            console.log(`📄 Loaded from cache: ${routeId}`);
            return;
        }
        
        // Load page HTML
        try {
            const response = await fetch(route.page);
            
            if (!response.ok) {
                throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Cache the content
            this.cachePage(routeId, html);
            
            // Render content
            this.renderContent(html, route);
            
            // Load associated module
            if (route.module) {
                await this.loadModule(routeId, route.module);
            }
            
            console.log(`📄 Loaded page: ${routeId}`);
            
        } catch (error) {
            console.error(`❌ Failed to load page ${routeId}:`, error);
            
            // Try to load from cache as fallback
            if (this.pageCache.has(routeId)) {
                const cachedContent = this.pageCache.get(routeId);
                this.renderContent(cachedContent, route);
                console.warn(`⚠️ Loaded from cache (fallback): ${routeId}`);
                return;
            }
            
            throw error;
        }
    }
    
    /**
     * Render HTML content into the page
     */
    renderContent(html, route) {
        if (!this.contentContainer) {
            console.error('❌ Content container not found');
            return;
        }
        
        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract content
        let content;
        
        // Check for main-content element
        content = doc.querySelector('.main-content');
        if (!content) {
            // Check for body content
            content = doc.querySelector('body');
        }
        
        if (content) {
            // Clear container with fade out
            this.contentContainer.style.opacity = '0';
            
            setTimeout(() => {
                // Replace content
                this.contentContainer.innerHTML = content.innerHTML;
                
                // Execute scripts
                this.executeScripts(this.contentContainer);
                
                // Fade in
                this.contentContainer.style.transition = `opacity ${this.options.transitionDuration}ms ease`;
                this.contentContainer.style.opacity = '1';
                
                // Dispatch content loaded event
                window.dispatchEvent(new CustomEvent('content:loaded', {
                    detail: { route }
                }));
                
            }, 150);
        } else {
            // Fallback: just set innerHTML
            this.contentContainer.innerHTML = html;
            this.executeScripts(this.contentContainer);
        }
    }
    
    /**
     * Execute scripts in the loaded content
     */
    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy content
            newScript.textContent = oldScript.textContent;
            
            // Replace
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }
    
    /**
     * Cache a page for future use
     */
    cachePage(routeId, html) {
        // Enforce cache size limit
        if (this.pageCache.size >= this.options.maxCacheSize) {
            const firstKey = this.pageCache.keys().next().value;
            this.pageCache.delete(firstKey);
        }
        
        this.pageCache.set(routeId, html);
    }
    
    /**
     * Load JavaScript module for a route
     */
    async loadModule(routeId, moduleName) {
        try {
            // Check if module is already loaded
            if (window.App?.state?.modules?.[moduleName]) {
                return;
            }
            
            // Dynamic import
            const module = await import(`../modules/${moduleName}.js`);
            
            // Initialize module if it has an init method
            if (module.default?.init) {
                await module.default.init();
            } else if (module.init) {
                await module.init();
            }
            
            // Mark as loaded
            if (window.App?.state?.modules) {
                window.App.state.modules[moduleName] = true;
            }
            
            console.log(`📦 Module loaded: ${moduleName}`);
            
        } catch (error) {
            console.warn(`⚠️ Module ${moduleName} not loaded:`, error.message);
            // Don't throw - module is optional enhancement
        }
    }
    
    /**
     * Apply theme based on route
     */
    applyTheme(route) {
        const theme = route.theme || 'internal';
        
        if (window.App?.applyTheme) {
            window.App.state.theme = theme;
            window.App.applyTheme();
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }
    
    /**
     * Update meta description for SEO
     */
    updateMetaDescription(route) {
        let metaDesc = document.querySelector('meta[name="description"]');
        
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        
        metaDesc.setAttribute('content', route.description || '11 Avatar Digital Hub - Master Revenue CRM');
    }
    
    /**
     * Update active navigation state
     */
    updateActiveNav(routeId) {
        // Update header links
        document.querySelectorAll('.header-link').forEach(link => {
            const linkRoute = link.dataset.route;
            link.classList.toggle('active', linkRoute === routeId);
        });
        
        // Update mobile nav links
        document.querySelectorAll('.mobile-link').forEach(link => {
            const linkRoute = link.dataset.route;
            link.classList.toggle('active', linkRoute === routeId);
        });
    }
    
    /**
     * Update submenu navigation
     */
    updateSubmenu(routeId, route) {
        const submenuContainer = document.getElementById('submenu-nav');
        if (!submenuContainer) return;
        
        // Get submenu items for this route
        const submenuItems = route.submenu || [];
        
        if (submenuItems.length === 0) {
            submenuContainer.style.display = 'none';
            return;
        }
        
        // Get current hash for active state
        const currentHash = window.location.hash.split('#')[1] || '';
        
        // Generate submenu HTML
        const html = submenuItems.map(item => {
            const isActive = item.id === currentHash || 
                           (!currentHash && submenuItems.indexOf(item) === 0);
            
            return `
                <a href="#${item.id}" 
                   class="submenu-btn ${isActive ? 'active' : ''}" 
                   data-section="${item.id}"
                   aria-label="Navigate to ${item.label} section">
                    ${item.icon || ''} ${item.label}
                    ${item.badge ? `<span class="badge badge-gold">${item.badge}</span>` : ''}
                </a>
            `;
        }).join('');
        
        submenuContainer.innerHTML = html;
        submenuContainer.style.display = 'flex';
        
        // Add click handlers for smooth scroll
        submenuContainer.querySelectorAll('.submenu-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                
                const sectionId = btn.dataset.section;
                const target = document.getElementById(sectionId);
                
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Update active state
                    submenuContainer.querySelectorAll('.submenu-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                }
            });
        });
    }
    
    /**
     * Navigate back in history
     */
    goBack() {
        if (this.navigationHistory.length > 1) {
            // Remove current
            this.navigationHistory.pop();
            
            // Get previous
            const previous = this.navigationHistory[this.navigationHistory.length - 1];
            
            if (previous) {
                this.navigateTo(previous.routeId, { 
                    source: 'back',
                    restoreScroll: true 
                });
            }
        } else {
            window.history.back();
        }
    }
    
    /**
     * Navigate forward in history
     */
    goForward() {
        window.history.forward();
    }
    
    /**
     * Reload current page
     */
    reload() {
        if (this.currentRoute) {
            // Clear cache for current route
            this.pageCache.delete(this.currentRoute);
            
            // Navigate again
            this.navigateTo(this.currentRoute, { 
                source: 'reload',
                skipCache: true 
            });
        }
    }
    
    /**
     * Register a hook that runs before navigation
     * @param {Function} hook - Async function(routeId, route, options)
     * @returns {Function} Unsubscribe function
     */
    beforeEach(hook) {
        this.beforeHooks.push(hook);
        
        return () => {
            const index = this.beforeHooks.indexOf(hook);
            if (index > -1) this.beforeHooks.splice(index, 1);
        };
    }
    
    /**
     * Register a hook that runs after navigation
     * @param {Function} hook - Async function(routeId, route, options)
     * @returns {Function} Unsubscribe function
     */
    afterEach(hook) {
        this.afterHooks.push(hook);
        
        return () => {
            const index = this.afterHooks.indexOf(hook);
            if (index > -1) this.afterHooks.splice(index, 1);
        };
    }
    
    /**
     * Register an error handler
     * @param {Function} hook - Async function(error, routeId, route, options)
     * @returns {Function} Unsubscribe function
     */
    onError(hook) {
        this.errorHooks.push(hook);
        
        return () => {
            const index = this.errorHooks.indexOf(hook);
            if (index > -1) this.errorHooks.splice(index, 1);
        };
    }
    
    /**
     * Preload a page in the background
     * @param {string} routeId - Route to preload
     */
    async preload(routeId) {
        const route = RoutesConfig.getRoute(routeId);
        if (!route || this.pageCache.has(routeId)) return;
        
        try {
            const response = await fetch(route.page);
            if (response.ok) {
                const html = await response.text();
                this.cachePage(routeId, html);
                console.log(`📥 Preloaded: ${routeId}`);
            }
        } catch (error) {
            // Silent fail for preloading
        }
    }
    
    /**
     * Preload all accessible routes for a user
     * @param {Object} user - User object
     */
    preloadAll(user) {
        const routes = RoutesConfig.getAccessibleRoutes(user?.role);
        
        // Preload main routes first
        const mainRoutes = routes.filter(r => 
            ['dashboard', 'leads', 'clients', 'revenue', 'pipeline'].includes(r.id)
        );
        
        mainRoutes.forEach(route => this.preload(route.id));
        
        // Then preload others with delay
        setTimeout(() => {
            const otherRoutes = routes.filter(r => 
                !['dashboard', 'leads', 'clients', 'revenue', 'pipeline'].includes(r.id)
            );
            
            otherRoutes.forEach((route, index) => {
                setTimeout(() => this.preload(route.id), index * 500);
            });
        }, 2000);
    }
    
    /**
     * Convert URL path to route ID
     * @param {string} path - URL path
     * @returns {string|null} Route ID
     */
    pathToRouteId(path) {
        // Remove leading/trailing slashes and hash
        const cleanPath = path.replace(/^#?\/?/, '').replace(/\/$/, '') || '/';
        
        // Search through routes
        for (const [id, route] of Object.entries(RoutesConfig.ROUTES)) {
            const routePath = route.path.replace(/^\//, '').replace(/\/$/, '');
            if (routePath === cleanPath || (cleanPath === '' && routePath === '')) {
                return id;
            }
        }
        
        return null;
    }
    
    /**
     * Convert full URL to route ID
     * @param {string} url - Full URL or path
     * @returns {string|null} Route ID
     */
    urlToRouteId(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            return this.pathToRouteId(urlObj.hash.slice(1) || urlObj.pathname);
        } catch (error) {
            return this.pathToRouteId(url);
        }
    }
    
    /**
     * Get current route information
     * @returns {Object} Current route details
     */
    getCurrentRoute() {
        if (!this.currentRoute) return null;
        
        return {
            id: this.currentRoute,
            ...RoutesConfig.getRoute(this.currentRoute)
        };
    }
    
    /**
     * Get navigation history
     * @returns {Array} Navigation history
     */
    getHistory() {
        return [...this.navigationHistory];
    }
    
    /**
     * Clear all cached pages
     */
    clearCache() {
        this.pageCache.clear();
        console.log('🗑️ Router cache cleared');
    }
    
    /**
     * Destroy the router (cleanup)
     */
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
        window.removeEventListener('popstate', this.handlePopState);
        document.removeEventListener('click', this.handleLinkClick);
        
        this.clearCache();
        this.beforeHooks = [];
        this.afterHooks = [];
        this.errorHooks = [];
        
        console.log('🧭 Router destroyed');
    }
}

// ==========================================
// CREATE & EXPORT ROUTER INSTANCE
// ==========================================
const router = new Router();

// Make available globally
window.Router = router;

// Export for module usage
export default router;

console.log('🧭 Router ready and listening for navigation');

// ==========================================
// END OF ROUTER
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
