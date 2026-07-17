/**
 * @fileoverview 11 Avatar SMEs CRM - Page Navigation Helper
 * @description Lightweight page helper for multi-page architecture.
 *              Detects current page, updates submenu, handles hash scroll,
 *              generates breadcrumbs, and manages page lifecycle events.
 *              NOT an SPA router - browser handles page navigation natively.
 * @module core/router
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires RoutesConfig (window.RoutesConfig) - optional
 * @requires AppCore (window.AppCore) - optional
 *
 * @exports window.PageHelper - Global namespace
 */

'use strict';

// =============================================================================
// PAGE HELPER - Self-executing IIFE
// =============================================================================
const PageHelper = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} Internal state */
    const state = {
        /** @type {string} Current page route ID */
        currentRouteId: null,
        
        /** @type {Object|null} Current route configuration */
        currentRoute: null,
        
        /** @type {string} Previous page route ID */
        previousRouteId: null,
        
        /** @type {number} Page entry timestamp */
        pageEntryTime: Date.now(),
        
        /** @type {boolean} Whether helper is initialized */
        isInitialized: false,
    };

    // -------------------------------------------------------------------------
    // SECTION 2: PAGE DETECTION
    // -------------------------------------------------------------------------
    
    /**
     * Detect current page from URL
     * @returns {string} Route ID
     */
    function detectCurrentPage() {
        try {
            var path = window.location.pathname;
            var filename = path.split('/').pop() || 'index.html';
            var pageName = filename.replace(/\.html$/, '');
            
            if (!pageName || pageName === 'index' || path.endsWith('/')) {
                pageName = 'landing';
            }
            
            // Try RoutesConfig for proper route ID
            if (window.RoutesConfig && typeof window.RoutesConfig.getRouteIdByPath === 'function') {
                var routeId = window.RoutesConfig.getRouteIdByPath(path);
                if (routeId) return routeId;
            }
            
            return pageName;
        } catch (e) {
            return 'unknown';
        }
    }
    
    /**
     * Get route configuration for current page
     * @returns {Object|null} Route config or null
     */
    function getCurrentRoute() {
        try {
            var routeId = state.currentRouteId || detectCurrentPage();
            
            if (window.RoutesConfig && typeof window.RoutesConfig.getRoute === 'function') {
                return window.RoutesConfig.getRoute(routeId);
            }
            
            return null;
        } catch (e) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 3: SUBMENU MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Initialize submenu from route configuration
     */
    function initSubmenu() {
        try {
            var route = getCurrentRoute();
            if (!route || !route.submenu || !route.submenu.length) {
                hideSubmenu();
                return;
            }
            
            var submenuContainer = document.getElementById('submenu-nav');
            if (!submenuContainer) return;
            
            // Build submenu HTML
            var html = '';
            route.submenu.forEach(function(item, index) {
                var isActive = index === 0 ? ' active' : '';
                html += '<a href="#' + item.id + '" class="submenu-btn' + isActive + '" data-section="' + item.id + '">';
                if (item.icon) html += item.icon + ' ';
                html += item.label;
                if (item.badge) html += ' <span class="badge badge-gold">' + item.badge + '</span>';
                html += '</a>';
            });
            
            submenuContainer.innerHTML = html;
            submenuContainer.style.display = 'flex';
            
            // Attach click handlers
            attachSubmenuClickHandlers(submenuContainer);
            
            // Setup scroll spy
            setupSubmenuScrollSpy(submenuContainer, route.submenu);
            
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Hide submenu if no items configured
     */
    function hideSubmenu() {
        try {
            var container = document.getElementById('submenu-nav');
            if (container) {
                container.style.display = 'none';
            }
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Attach click handlers to submenu buttons
     * @param {HTMLElement} container - Submenu container
     */
    function attachSubmenuClickHandlers(container) {
        try {
            var buttons = container.querySelectorAll('.submenu-btn');
            
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function(event) {
                    event.preventDefault();
                    
                    var sectionId = this.getAttribute('data-section');
                    var target = document.getElementById(sectionId);
                    
                    if (target) {
                        // Scroll to section with offset
                        var headerHeight = 64;
                        var submenuHeight = 48;
                        var offset = headerHeight + submenuHeight + 16;
                        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                        
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth',
                        });
                        
                        // Update active state
                        buttons.forEach(function(b) { b.classList.remove('active'); });
                        this.classList.add('active');
                        
                        // Update URL hash
                        if (history.pushState) {
                            history.pushState(null, null, '#' + sectionId);
                        }
                    }
                });
            });
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Setup scroll spy for submenu
     * @param {HTMLElement} container - Submenu container
     * @param {Array} submenuItems - Submenu configuration
     */
    function setupSubmenuScrollSpy(container, submenuItems) {
        try {
            var buttons = container.querySelectorAll('.submenu-btn');
            var sectionIds = submenuItems.map(function(item) { return item.id; });
            
            var scrollHandler = throttle(function() {
                updateActiveSubmenuButton(buttons, sectionIds);
            }, 150);
            
            window.addEventListener('scroll', scrollHandler, { passive: true });
            
            // Initial check
            updateActiveSubmenuButton(buttons, sectionIds);
            
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Update which submenu button is active based on scroll position
     * @param {NodeList} buttons - Submenu buttons
     * @param {Array} sectionIds - Section IDs
     */
    function updateActiveSubmenuButton(buttons, sectionIds) {
        try {
            var currentSection = '';
            var viewportHeight = window.innerHeight;
            
            for (var i = sectionIds.length - 1; i >= 0; i--) {
                var section = document.getElementById(sectionIds[i]);
                if (!section) continue;
                
                var rect = section.getBoundingClientRect();
                if (rect.top <= viewportHeight * 0.4) {
                    currentSection = sectionIds[i];
                    break;
                }
            }
            
            if (!currentSection && sectionIds.length > 0) {
                currentSection = sectionIds[0];
            }
            
            buttons.forEach(function(btn) {
                var sectionId = btn.getAttribute('data-section');
                if (sectionId === currentSection) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: BREADCRUMB GENERATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize breadcrumb navigation
     */
    function initBreadcrumb() {
        try {
            var breadcrumbContainer = document.getElementById('breadcrumb-nav');
            if (!breadcrumbContainer) return;
            
            var route = getCurrentRoute();
            if (!route) {
                breadcrumbContainer.style.display = 'none';
                return;
            }
            
            var breadcrumbs = [];
            
            // Try RoutesConfig breadcrumb
            if (window.RoutesConfig && typeof window.RoutesConfig.getBreadcrumb === 'function') {
                breadcrumbs = window.RoutesConfig.getBreadcrumb(state.currentRouteId);
            } else {
                // Simple breadcrumb
                breadcrumbs = [
                    { label: 'Home', path: 'index.html', icon: '🏠' },
                ];
                
                if (state.currentRouteId !== 'landing') {
                    var title = route.title || state.currentRouteId;
                    title = title.replace(/ - 11 Avatar Digital Hub.*$/, '');
                    breadcrumbs.push({
                        label: title,
                        path: route.page || '#',
                        icon: route.icon || '',
                    });
                }
            }
            
            // Build HTML
            var html = breadcrumbs.map(function(item, index) {
                var isLast = index === breadcrumbs.length - 1;
                if (isLast) {
                    return '<span class="breadcrumb-current" aria-current="page">' + 
                           (item.icon ? item.icon + ' ' : '') + item.label + '</span>';
                }
                return '<a href="' + item.path + '" class="breadcrumb-link">' + 
                       (item.icon ? item.icon + ' ' : '') + item.label + '</a>';
            }).join(' <span class="breadcrumb-separator">›</span> ');
            
            breadcrumbContainer.innerHTML = html;
            breadcrumbContainer.style.display = 'flex';
            
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: PAGE LIFECYCLE
    // -------------------------------------------------------------------------
    
    /**
     * Handle page entry
     */
    function handlePageEnter() {
        try {
            state.pageEntryTime = Date.now();
            
            // Apply page-specific theme
            var route = getCurrentRoute();
            if (route && route.theme) {
                document.documentElement.setAttribute('data-theme', route.theme);
            }
            
            // Update page title if not already set
            if (route && route.title && document.title === '11 Avatar Digital Hub') {
                document.title = route.title;
            }
            
            // Emit page enter event
            if (window.AppCore && typeof window.AppCore.emit === 'function') {
                window.AppCore.emit('page:enter', {
                    routeId: state.currentRouteId,
                    route: route,
                    timestamp: state.pageEntryTime,
                });
            }
            
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Handle page exit (before unload)
     */
    function handlePageExit() {
        try {
            var duration = Date.now() - state.pageEntryTime;
            
            // Emit page exit event
            if (window.AppCore && typeof window.AppCore.emit === 'function') {
                window.AppCore.emit('page:exit', {
                    routeId: state.currentRouteId,
                    duration: duration,
                });
            }
            
            // Save last page for return navigation
            try {
                sessionStorage.setItem('last_page', state.currentRouteId);
            } catch (e) {
                // Storage may be full
            }
            
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Throttle function
     * @param {Function} fn - Function to throttle
     * @param {number} delay - Delay in ms
     * @returns {Function}
     */
    function throttle(fn, delay) {
        var lastCall = 0;
        return function() {
            var now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                fn.apply(this, arguments);
            }
        };
    }
    
    /**
     * Get page info object
     * @returns {Object}
     */
    function getPageInfo() {
        return {
            routeId: state.currentRouteId,
            route: state.currentRoute,
            entryTime: state.pageEntryTime,
            duration: Date.now() - state.pageEntryTime,
            url: window.location.href,
            path: window.location.pathname,
            hash: window.location.hash,
        };
    }
    
    /**
     * Navigate to another page (standard browser navigation)
     * @param {string} routeId - Route ID or page URL
     */
    function navigateTo(routeId) {
        try {
            var url = routeId;
            
            // If it's a route ID, get the page file
            if (window.RoutesConfig && typeof window.RoutesConfig.getPageFile === 'function') {
                var pageFile = window.RoutesConfig.getPageFile(routeId);
                if (pageFile) {
                    url = pageFile;
                }
            }
            
            // If no .html extension, add it
            if (!url.startsWith('http') && !url.endsWith('.html') && url.indexOf('#') === -1) {
                url += '.html';
            }
            
            window.location.href = url;
        } catch (e) {
            // Fallback
            window.location.href = routeId;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the page helper
     * @returns {boolean}
     */
    function init() {
        try {
            if (state.isInitialized) return true;
            
            // Detect current page
            state.currentRouteId = detectCurrentPage();
            state.currentRoute = getCurrentRoute();
            
            // Initialize submenu
            initSubmenu();
            
            // Initialize breadcrumb
            initBreadcrumb();
            
            // Handle page enter
            handlePageEnter();
            
            // Handle page exit on beforeunload
            window.addEventListener('beforeunload', handlePageExit);
            
            // Handle hash change (for in-page navigation)
            window.addEventListener('hashchange', function() {
                var hash = window.location.hash.substring(1);
                if (hash) {
                    var target = document.getElementById(hash);
                    if (target) {
                        setTimeout(function() {
                            var headerHeight = 64;
                            var submenuHeight = 48;
                            var offset = headerHeight + submenuHeight + 16;
                            var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                        }, 100);
                    }
                }
            });
            
            // Handle initial hash (if page loaded with #section)
            var initialHash = window.location.hash.substring(1);
            if (initialHash) {
                setTimeout(function() {
                    var target = document.getElementById(initialHash);
                    if (target) {
                        var headerHeight = 64;
                        var submenuHeight = 48;
                        var offset = headerHeight + submenuHeight + 16;
                        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                        window.scrollTo({ top: targetPosition });
                    }
                }, 300);
            }
            
            state.isInitialized = true;
            
            // Log
            var isDebug = window.Constants && window.Constants.APP && window.Constants.APP.DEBUG;
            if (isDebug) {
                console.log(
                    '%c[PageHelper] %c' + state.currentRouteId + ' %cready',
                    'color: #FFD700; font-weight: bold;',
                    'color: #10B981;',
                    'color: #888;'
                );
            }
            
            return true;
        } catch (e) {
            console.error('[PageHelper] Init failed:', e);
            return false;
        }
    }
    
    /**
     * Destroy and cleanup
     */
    function destroy() {
        try {
            window.removeEventListener('beforeunload', handlePageExit);
            state.isInitialized = false;
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 8: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API */
    const publicAPI = Object.freeze({
        init: init,
        destroy: destroy,
        
        // Page info
        detectCurrentPage: detectCurrentPage,
        getCurrentRoute: getCurrentRoute,
        getPageInfo: getPageInfo,
        
        // Navigation
        navigateTo: navigateTo,
        
        // Submenu
        initSubmenu: initSubmenu,
        hideSubmenu: hideSubmenu,
        
        // Breadcrumb
        initBreadcrumb: initBreadcrumb,
        
        // State
        get currentRouteId() { return state.currentRouteId; },
        get currentRoute() { return state.currentRoute; },
        get isInitialized() { return state.isInitialized; },
    });
    
    return publicAPI;
    
})(); // End of PageHelper IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            PageHelper.init();
        });
    } else {
        PageHelper.init();
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.PageHelper = PageHelper;
    window.Router = PageHelper; // Backward compatibility alias
    window.Global = window.Global || {};
    window.Global.PageHelper = PageHelper;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageHelper;
}

export {
    PageHelper as default,
    PageHelper,
};