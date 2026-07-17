/* ==========================================
   11 AVATAR DIGITAL HUB
   Navigation Bar Component
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Header navigation bar management
   - Mobile drawer toggle
   - Active route highlighting
   - Dropdown menus
   - Search bar integration
   - Notification bell
   - User profile menu
   - Scroll-aware behavior
   - Submenu generation
   - Breadcrumb updates
   ========================================== */

const Navbar = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _state: {
        mobileOpen: false,
        currentRoute: null,
        searchOpen: false,
        notifications: [],
        unreadCount: 0,
        scrolled: false
    },
    
    _config: {
        scrollThreshold: 50,
        enableSearch: true,
        enableNotifications: true,
        enableDarkMode: true,
        enableMobileDrawer: true,
        mobileBreakpoint: 1024,
        brandName: '11 Avatar Hub',
        brandLink: '/',
        logoHTML: null
    },
    
    _elements: {},
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    /**
     * Initialize the navbar
     * @param {Object} config - Configuration options
     */
    init(config = {}) {
        Object.assign(this._config, config);
        
        this._cacheElements();
        this._setupEventListeners();
        this._setupScrollDetection();
        this._updateActiveRoute();
        this._loadUnreadNotifications();
        
        console.log('🧭 Navbar initialized');
    },
    
    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        this._elements = {
            header: document.querySelector('.header'),
            brand: document.querySelector('.header-brand'),
            nav: document.querySelector('.header-nav'),
            links: document.querySelectorAll('.header-link'),
            actions: document.querySelector('.header-actions'),
            toggle: document.querySelector('.header-toggle'),
            mobileDrawer: document.querySelector('.mobile-drawer'),
            mobileBackdrop: document.querySelector('.mobile-drawer-backdrop'),
            mobileLinks: document.querySelectorAll('.mobile-link'),
            mobileClose: document.querySelector('.mobile-drawer-close'),
            submenu: document.getElementById('submenu-nav'),
            searchBtn: document.querySelector('.search-toggle'),
            searchBar: document.querySelector('.search-bar'),
            notificationBtn: document.querySelector('.notification-btn'),
            notificationBadge: document.querySelector('.notification-badge'),
            notificationDropdown: document.querySelector('.notification-dropdown'),
            userMenuBtn: document.querySelector('.user-menu-btn'),
            userDropdown: document.querySelector('.user-dropdown'),
            darkModeBtn: document.querySelector('.dark-mode-toggle'),
            breadcrumb: document.querySelector('.breadcrumb')
        };
    },
    
    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Mobile toggle
        this._elements.toggle?.addEventListener('click', () => this.toggleMobile());
        
        // Mobile backdrop click
        this._elements.mobileBackdrop?.addEventListener('click', () => this.closeMobile());
        
        // Mobile close button
        this._elements.mobileClose?.addEventListener('click', () => this.closeMobile());
        
        // Mobile links - close drawer on click
        this._elements.mobileLinks?.forEach(link => {
            link.addEventListener('click', () => this.closeMobile());
        });
        
        // Search toggle
        this._elements.searchBtn?.addEventListener('click', () => this.toggleSearch());
        
        // Notification toggle
        this._elements.notificationBtn?.addEventListener('click', () => this.toggleNotifications());
        
        // User menu toggle
        this._elements.userMenuBtn?.addEventListener('click', () => this.toggleUserMenu());
        
        // Dark mode toggle
        this._elements.darkModeBtn?.addEventListener('click', () => this.toggleDarkMode());
        
        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-btn') && !e.target.closest('.notification-dropdown')) {
                this._closeDropdown('notificationDropdown');
            }
            if (!e.target.closest('.user-menu-btn') && !e.target.closest('.user-dropdown')) {
                this._closeDropdown('userDropdown');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleSearch();
            }
            if (e.key === 'Escape') {
                this.closeMobile();
                this._closeDropdown('notificationDropdown');
                this._closeDropdown('userDropdown');
            }
        });
        
        // Listen for route changes
        if (window.EventBus) {
            window.EventBus.on('navigation:change', (data) => {
                this.setActiveRoute(data.page);
            });
            
            window.EventBus.on('notification:received', () => {
                this._loadUnreadNotifications();
            });
        }
        
        // Resize handler
        window.addEventListener('resize', () => {
            if (window.innerWidth >= this._config.mobileBreakpoint) {
                this.closeMobile();
            }
        });
    },
    
    /**
     * Setup scroll detection
     * @private
     */
    _setupScrollDetection() {
        let lastScroll = 0;
        let scrollTimer;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            
            const currentScroll = window.scrollY;
            
            if (currentScroll > this._config.scrollThreshold) {
                this._state.scrolled = true;
                this._elements.header?.classList.add('scrolled');
            } else {
                this._state.scrolled = false;
                this._elements.header?.classList.remove('scrolled');
            }
            
            lastScroll = currentScroll;
            
            scrollTimer = setTimeout(() => {
                // Scroll ended
            }, 150);
        }, { passive: true });
    },
    
    // ==========================================
    // MOBILE DRAWER
    // ==========================================
    
    /**
     * Toggle mobile drawer
     */
    toggleMobile() {
        if (this._state.mobileOpen) {
            this.closeMobile();
        } else {
            this.openMobile();
        }
    },
    
    /**
     * Open mobile drawer
     */
    openMobile() {
        this._state.mobileOpen = true;
        this._elements.mobileDrawer?.classList.add('open');
        this._elements.mobileBackdrop?.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // Focus first link
        setTimeout(() => {
            const firstLink = this._elements.mobileDrawer?.querySelector('.mobile-link');
            firstLink?.focus();
        }, 350);
    },
    
    /**
     * Close mobile drawer
     */
    closeMobile() {
        this._state.mobileOpen = false;
        this._elements.mobileDrawer?.classList.remove('open');
        this._elements.mobileBackdrop?.classList.remove('open');
        document.body.style.overflow = '';
        
        // Return focus to toggle button
        this._elements.toggle?.focus();
    },
    
    // ==========================================
    // ACTIVE ROUTE
    // ==========================================
    
    /**
     * Set active route in navigation
     * @param {string} routeId - Route identifier
     */
    setActiveRoute(routeId) {
        this._state.currentRoute = routeId;
        this._updateActiveRoute();
        this._updateSubmenu(routeId);
        this._updateBreadcrumb(routeId);
    },
    
    /**
     * Update active state on all nav links
     * @private
     */
    _updateActiveRoute() {
        const routeId = this._state.currentRoute;
        
        // Header links
        this._elements.links?.forEach(link => {
            const linkRoute = link.getAttribute('href')?.replace('#/', '');
            const isActive = linkRoute === routeId || 
                           (routeId === 'dashboard' && linkRoute === 'dashboard') ||
                           link.getAttribute('data-route') === routeId;
            
            link.classList.toggle('active', isActive);
        });
        
        // Mobile links
        this._elements.mobileLinks?.forEach(link => {
            const linkRoute = link.getAttribute('href')?.replace('#/', '');
            const isActive = linkRoute === routeId || link.getAttribute('data-route') === routeId;
            
            link.classList.toggle('active', isActive);
        });
    },
    
    /**
     * Update submenu navigation for current route
     * @param {string} routeId - Route identifier
     * @private
     */
    _updateSubmenu(routeId) {
        if (!window.RoutesConfig) return;
        
        const submenu = window.RoutesConfig.getSubmenu(routeId);
        const container = this._elements.submenu;
        
        if (!container) return;
        
        if (!submenu || submenu.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        container.innerHTML = '';
        
        submenu.forEach((item, index) => {
            const btn = document.createElement('a');
            btn.className = 'submenu-btn';
            btn.href = '#' + item.id;
            btn.setAttribute('data-section', item.id);
            btn.innerHTML = `${item.icon || ''} ${item.label}`;
            
            if (item.badge) {
                const badge = document.createElement('span');
                badge.className = 'badge badge-gold';
                badge.textContent = item.badge;
                badge.style.cssText = 'font-size:0.6rem;margin-left:4px';
                btn.appendChild(badge);
            }
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update active state
                container.querySelectorAll('.submenu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Scroll to section
                const target = document.getElementById(item.id);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            container.appendChild(btn);
        });
    },
    
    /**
     * Update breadcrumb navigation
     * @param {string} routeId - Route identifier
     * @private
     */
    _updateBreadcrumb(routeId) {
        if (!window.RoutesConfig || !this._elements.breadcrumb) return;
        
        const breadcrumbs = window.RoutesConfig.getBreadcrumb(routeId);
        const container = this._elements.breadcrumb;
        
        container.innerHTML = breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            if (isLast) {
                return `<span class="current">${crumb.icon ? crumb.icon + ' ' : ''}${crumb.label}</span>`;
            }
            
            return `
                <a href="#${crumb.path}">${crumb.icon ? crumb.icon + ' ' : ''}${crumb.label}</a>
                <span class="separator">›</span>
            `;
        }).join('');
    },
    
    // ==========================================
    // SEARCH
    // ==========================================
    
    /**
     * Toggle search bar
     */
    toggleSearch() {
        this._state.searchOpen = !this._state.searchOpen;
        
        const searchBar = this._elements.searchBar;
        if (!searchBar) return;
        
        if (this._state.searchOpen) {
            searchBar.style.display = 'flex';
            const input = searchBar.querySelector('input');
            setTimeout(() => input?.focus(), 100);
        } else {
            searchBar.style.display = 'none';
        }
    },
    
    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    
    /**
     * Toggle notification dropdown
     */
    toggleNotifications() {
        const dropdown = this._elements.notificationDropdown;
        if (!dropdown) return;
        
        const isOpen = dropdown.classList.contains('show');
        
        if (isOpen) {
            this._closeDropdown('notificationDropdown');
        } else {
            this._closeDropdown('userDropdown');
            dropdown.classList.add('show');
            this._loadNotifications();
        }
    },
    
    /**
     * Load unread notification count
     * @private
     */
    async _loadUnreadNotifications() {
        try {
            // Try to get from StateManager or API
            const notifications = window.StateManager?.get('data.notifications') || [];
            const unread = notifications.filter(n => !n.read).length;
            
            this._state.unreadCount = unread;
            
            const badge = this._elements.notificationBadge;
            if (badge) {
                if (unread > 0) {
                    badge.textContent = unread > 99 ? '99+' : unread;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {
            // Silently fail
        }
    },
    
    /**
     * Load notification list
     * @private
     */
    async _loadNotifications() {
        const dropdown = this._elements.notificationDropdown;
        if (!dropdown) return;
        
        try {
            const notifications = window.StateManager?.get('data.notifications') || [];
            const recent = notifications.slice(0, 5);
            
            if (recent.length === 0) {
                dropdown.innerHTML = `
                    <div style="padding:20px;text-align:center;color:#999">
                        <div style="font-size:2rem;margin-bottom:8px">🔔</div>
                        <p style="font-size:0.85rem">No notifications</p>
                    </div>
                `;
                return;
            }
            
            dropdown.innerHTML = recent.map(n => `
                <div class="dropdown-item" style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px">
                    <span style="font-size:1.2rem">${n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:0.85rem;color:#333">${n.title}</div>
                        <div style="font-size:0.78rem;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.message}</div>
                    </div>
                    ${!n.read ? '<div style="width:8px;height:8px;border-radius:50%;background:#8B5CF6;flex-shrink:0;margin-top:6px"></div>' : ''}
                </div>
            `).join('');
            
            // View all link
            dropdown.innerHTML += `
                <div class="dropdown-divider"></div>
                <a href="#/notifications" class="dropdown-item" style="justify-content:center;color:#D4AF37;font-weight:600">
                    View All Notifications →
                </a>
            `;
            
        } catch (e) {
            dropdown.innerHTML = '<div style="padding:20px;text-align:center;color:#999">Failed to load</div>';
        }
    },
    
    // ==========================================
    // USER MENU
    // ==========================================
    
    /**
     * Toggle user dropdown menu
     */
    toggleUserMenu() {
        const dropdown = this._elements.userDropdown;
        if (!dropdown) return;
        
        const isOpen = dropdown.classList.contains('show');
        
        if (isOpen) {
            this._closeDropdown('userDropdown');
        } else {
            this._closeDropdown('notificationDropdown');
            dropdown.classList.add('show');
        }
    },
    
    // ==========================================
    // DARK MODE
    // ==========================================
    
    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        if (window.App && window.App.toggleDarkMode) {
            window.App.toggleDarkMode();
        } else {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            document.documentElement.setAttribute('data-theme', isDark ? 'internal' : 'dark');
            localStorage.setItem('11avatar_darkMode', !isDark);
            
            const btn = this._elements.darkModeBtn;
            if (btn) {
                btn.textContent = !isDark ? '☀️' : '🌙';
            }
        }
    },
    
    // ==========================================
    // DROPDOWN HELPERS
    // ==========================================
    
    /**
     * Close a specific dropdown
     * @param {string} name - Dropdown element name
     * @private
     */
    _closeDropdown(name) {
        const dropdown = this._elements[name];
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    },
    
    // ==========================================
    // RENDER
    // ==========================================
    
    /**
     * Render navigation items from routes config
     * @param {Array} items - Navigation items
     */
    renderNav(items) {
        const container = this._elements.nav;
        if (!container || !items) return;
        
        container.innerHTML = items.map(item => `
            <a href="#/${item.route}" class="header-link" data-route="${item.route}">
                ${item.icon ? `<span class="nav-icon">${item.icon}</span>` : ''}
                <span>${item.label}</span>
            </a>
        `).join('');
        
        // Re-cache links
        this._elements.links = document.querySelectorAll('.header-link');
        
        // Re-attach click handlers
        this._elements.links.forEach(link => {
            link.addEventListener('click', (e) => {
                const route = link.dataset.route;
                if (route && window.Router) {
                    e.preventDefault();
                    window.Router.navigateTo(route);
                }
                this.closeMobile();
            });
        });
        
        this._updateActiveRoute();
    },
    
    /**
     * Update brand/logo
     * @param {string} name - Brand name
     * @param {string} link - Brand link
     */
    setBrand(name, link) {
        this._config.brandName = name;
        this._config.brandLink = link;
        
        const brand = this._elements.brand;
        if (brand) {
            brand.href = link;
            const span = brand.querySelector('span');
            if (span) span.textContent = name;
        }
    },
    
    /**
     * Set notification count
     * @param {number} count - Unread count
     */
    setNotificationCount(count) {
        this._state.unreadCount = count;
        
        const badge = this._elements.notificationBadge;
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    },
    
    // ==========================================
    // UTILITY
    // ==========================================
    
    /**
     * Check if mobile drawer is open
     * @returns {boolean}
     */
    isMobileOpen() {
        return this._state.mobileOpen;
    },
    
    /**
     * Get current route
     * @returns {string|null}
     */
    getCurrentRoute() {
        return this._state.currentRoute;
    },
    
    /**
     * Refresh the navbar
     */
    refresh() {
        this._updateActiveRoute();
        this._loadUnreadNotifications();
    },
    
    /**
     * Destroy the navbar
     */
    destroy() {
        // Remove event listeners
        this._elements.toggle?.removeEventListener('click', this.toggleMobile);
        this._elements.mobileBackdrop?.removeEventListener('click', this.closeMobile);
        this._elements.mobileClose?.removeEventListener('click', this.closeMobile);
        
        if (window.EventBus) {
            window.EventBus.off('navigation:change');
            window.EventBus.off('notification:received');
        }
        
        console.log('🧭 Navbar destroyed');
    }
};

// ==========================================
// AUTO-INITIALIZE
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Navbar.init());
} else {
    // Defer to allow other components to load first
    setTimeout(() => Navbar.init(), 100);
}

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Navbar = Navbar;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navbar;
}

// ==========================================
// END OF NAVBAR COMPONENT
// ==========================================

