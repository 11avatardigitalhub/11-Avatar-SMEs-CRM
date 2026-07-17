/**
 * @fileoverview 11 Avatar SMEs CRM - Landing Page Controller
 * @description Handles all landing page interactivity: navigation scroll spy,
 *              mobile drawer, FAQ accordion, PWA install banner, smooth scroll,
 *              submenu active tracking, stats counter animation, and more.
 *              Designed for index.html (public landing page).
 * @module index
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires Constants (window.Constants) - optional
 *
 * @exports window.LandingController - Global namespace
 */

'use strict';

// =============================================================================
// LANDING PAGE CONTROLLER - Self-executing IIFE
// =============================================================================
const LandingController = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} DOM element cache */
    const elements = {};
    
    /** @type {Object} Controller state */
    const state = {
        /** @type {boolean} Whether controller is initialized */
        isInitialized: false,
        
        /** @type {boolean} Whether mobile drawer is open */
        isDrawerOpen: false,
        
        /** @type {Object|null} PWA install deferred prompt */
        deferredPrompt: null,
        
        /** @type {number} Scroll event throttle timer */
        scrollThrottleTimer: null,
        
        /** @type {number} Scroll throttle delay in ms */
        scrollThrottleDelay: 100,
    };
    
    /** @type {Object} Animation frame IDs for cleanup */
    const animationFrames = {};

    // -------------------------------------------------------------------------
    // SECTION 2: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Log message in debug mode
     * @param {string} message - Log message
     * @param {string} [level='log'] - Console method
     */
    function debugLog(message, level) {
        try {
            var isDebug = window.Constants && 
                         window.Constants.APP && 
                         window.Constants.APP.DEBUG;
            if (!isDebug) return;
            
            var method = level || 'log';
            if (console[method]) {
                console[method]('%c[LandingController] %c' + message,
                    'color: #FFD700; font-weight: bold;', 'color: #888;');
            }
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Check if element exists
     * @param {string} id - Element ID
     * @returns {boolean}
     */
    function hasElement(id) {
        return !!document.getElementById(id);
    }
    
    /**
     * Throttle function for scroll events
     * @param {Function} fn - Function to throttle
     * @param {number} delay - Delay in ms
     * @returns {Function} Throttled function
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

    // -------------------------------------------------------------------------
    // SECTION 3: MOBILE DRAWER
    // -------------------------------------------------------------------------
    
    /**
     * Initialize mobile drawer functionality
     */
    function initMobileDrawer() {
        try {
            elements.menuToggle = document.getElementById('menu-toggle');
            elements.mobileDrawer = document.getElementById('mobile-drawer');
            elements.drawerBackdrop = document.getElementById('drawer-backdrop');
            elements.drawerClose = document.getElementById('drawer-close');
            
            if (!elements.mobileDrawer) return;
            
            // Open drawer
            if (elements.menuToggle) {
                elements.menuToggle.addEventListener('click', openDrawer);
            }
            
            // Close drawer
            if (elements.drawerClose) {
                elements.drawerClose.addEventListener('click', closeDrawer);
            }
            if (elements.drawerBackdrop) {
                elements.drawerBackdrop.addEventListener('click', closeDrawer);
            }
            
            // Close on Escape key
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && state.isDrawerOpen) {
                    closeDrawer();
                }
            });
            
            // Close when clicking nav links inside drawer
            if (elements.mobileDrawer) {
                var drawerLinks = elements.mobileDrawer.querySelectorAll('.mobile-link, .btn');
                drawerLinks.forEach(function(link) {
                    link.addEventListener('click', function() {
                        // Small delay to allow hash navigation
                        setTimeout(closeDrawer, 150);
                    });
                });
            }
            
            debugLog('Mobile drawer initialized');
        } catch (error) {
            console.error('[LandingController] Mobile drawer init failed:', error);
        }
    }
    
    /**
     * Open mobile drawer
     */
    function openDrawer() {
        try {
            if (!elements.mobileDrawer) return;
            
            elements.mobileDrawer.classList.add('open');
            if (elements.drawerBackdrop) {
                elements.drawerBackdrop.classList.add('open');
            }
            if (elements.menuToggle) {
                elements.menuToggle.setAttribute('aria-expanded', 'true');
            }
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            state.isDrawerOpen = true;
            
            // Focus first link in drawer
            setTimeout(function() {
                var firstLink = elements.mobileDrawer.querySelector('.mobile-link');
                if (firstLink) firstLink.focus();
            }, 350);
            
        } catch (error) {
            console.error('[LandingController] Open drawer failed:', error);
        }
    }
    
    /**
     * Close mobile drawer
     */
    function closeDrawer() {
        try {
            if (!elements.mobileDrawer) return;
            
            elements.mobileDrawer.classList.remove('open');
            if (elements.drawerBackdrop) {
                elements.drawerBackdrop.classList.remove('open');
            }
            if (elements.menuToggle) {
                elements.menuToggle.setAttribute('aria-expanded', 'false');
            }
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            state.isDrawerOpen = false;
            
            // Return focus to toggle button
            if (elements.menuToggle) {
                elements.menuToggle.focus();
            }
            
        } catch (error) {
            console.error('[LandingController] Close drawer failed:', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: SUBMENU & SCROLL SPY
    // -------------------------------------------------------------------------
    
    /**
     * Initialize submenu scroll spy
     * Highlights active submenu button based on scroll position
     */
    function initSubmenuScrollSpy() {
        try {
            var submenuNav = document.getElementById('submenu-nav');
            if (!submenuNav) return;
            
            var submenuBtns = submenuNav.querySelectorAll('.submenu-btn');
            if (!submenuBtns.length) return;
            
            // Collect all section IDs from submenu links
            var sectionIds = [];
            submenuBtns.forEach(function(btn) {
                var href = btn.getAttribute('href');
                if (href && href.startsWith('#')) {
                    sectionIds.push(href.substring(1));
                }
            });
            
            // Throttled scroll handler
            var handleScroll = throttle(function() {
                updateActiveSubmenu(submenuBtns, sectionIds);
            }, state.scrollThrottleDelay);
            
            window.addEventListener('scroll', handleScroll, { passive: true });
            
            // Initial check
            updateActiveSubmenu(submenuBtns, sectionIds);
            
            debugLog('Submenu scroll spy initialized');
        } catch (error) {
            console.error('[LandingController] Submenu scroll spy failed:', error);
        }
    }
    
    /**
     * Update which submenu button is active
     * @param {NodeList} buttons - Submenu button elements
     * @param {Array<string>} sectionIds - Section IDs to track
     */
    function updateActiveSubmenu(buttons, sectionIds) {
        try {
            var currentSection = '';
            var scrollOffset = window.innerHeight * 0.3; // 30% from top
            
            for (var i = 0; i < sectionIds.length; i++) {
                var section = document.getElementById(sectionIds[i]);
                if (!section) continue;
                
                var sectionTop = section.offsetTop;
                var sectionHeight = section.offsetHeight;
                var scrollBottom = window.scrollY + scrollOffset;
                
                if (scrollBottom >= sectionTop && 
                    scrollBottom < sectionTop + sectionHeight) {
                    currentSection = sectionIds[i];
                    break;
                }
            }
            
            // If no section matched and we're near top, use first
            if (!currentSection && window.scrollY < 200 && sectionIds.length > 0) {
                currentSection = sectionIds[0];
            }
            
            // Update button states
            buttons.forEach(function(btn) {
                var href = btn.getAttribute('href');
                var sectionId = href ? href.substring(1) : '';
                
                if (sectionId === currentSection) {
                    btn.classList.add('active');
                    btn.setAttribute('aria-current', 'true');
                } else {
                    btn.classList.remove('active');
                    btn.removeAttribute('aria-current');
                }
            });
            
        } catch (error) {
            // Silent - non-critical
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: SMOOTH SCROLL
    // -------------------------------------------------------------------------
    
    /**
     * Initialize smooth scroll for all hash links
     */
    function initSmoothScroll() {
        try {
            // Delegate click on all internal hash links
            document.addEventListener('click', function(event) {
                var link = event.target.closest('a[href^="#"]');
                if (!link) return;
                
                var href = link.getAttribute('href');
                if (!href || href === '#') return;
                
                // Skip details/summary elements
                if (link.closest('details')) return;
                
                // Skip if modifier keys pressed
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                
                var targetId = href.substring(1);
                var target = document.getElementById(targetId);
                
                if (target) {
                    event.preventDefault();
                    
                    // Close mobile drawer first
                    if (state.isDrawerOpen) {
                        closeDrawer();
                    }
                    
                    // Calculate offset for fixed header + submenu
                    var headerHeight = 64; // var(--header-h)
                    var submenuHeight = 48; // var(--submenu-h)
                    var offset = headerHeight + submenuHeight + 16;
                    
                    var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth',
                    });
                    
                    // Update URL hash without jumping
                    if (history.pushState) {
                        history.pushState(null, null, '#' + targetId);
                    }
                }
            });
            
            debugLog('Smooth scroll initialized');
        } catch (error) {
            console.error('[LandingController] Smooth scroll init failed:', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: FAQ ACCORDION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize FAQ accordion toggle icons
     */
    function initFAQ() {
        try {
            var detailsElements = document.querySelectorAll('details');
            if (!detailsElements.length) return;
            
            detailsElements.forEach(function(detail) {
                detail.addEventListener('toggle', function() {
                    var summary = this.querySelector('summary');
                    if (!summary) return;
                    
                    var indicator = summary.querySelector('span:last-child');
                    if (indicator) {
                        indicator.textContent = this.open ? '−' : '+';
                    }
                    
                    // Update ARIA
                    summary.setAttribute('aria-expanded', String(this.open));
                });
                
                // Set initial ARIA state
                var summary = detail.querySelector('summary');
                if (summary) {
                    summary.setAttribute('aria-expanded', String(detail.open));
                }
            });
            
            debugLog('FAQ accordion initialized');
        } catch (error) {
            console.error('[LandingController] FAQ init failed:', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: PWA INSTALL BANNER
    // -------------------------------------------------------------------------
    
    /**
     * Initialize PWA install banner
     */
    function initPWAInstall() {
        try {
            elements.installBanner = document.getElementById('install-banner');
            elements.installBtn = document.getElementById('install-btn');
            elements.dismissBtn = document.getElementById('dismiss-install');
            
            // Listen for install prompt
            window.addEventListener('beforeinstallprompt', function(event) {
                // Prevent Chrome's default mini-infobar
                event.preventDefault();
                
                // Store the prompt
                state.deferredPrompt = event;
                
                // Show install banner
                if (elements.installBanner) {
                    elements.installBanner.style.display = 'flex';
                    elements.installBanner.setAttribute('role', 'dialog');
                    elements.installBanner.setAttribute('aria-label', 'Install 11 Avatar Hub app');
                }
                
                debugLog('PWA install prompt captured');
            });
            
            // Handle install button click
            if (elements.installBtn) {
                elements.installBtn.addEventListener('click', async function() {
                    if (!state.deferredPrompt) {
                        debugLog('No deferred prompt available', 'warn');
                        return;
                    }
                    
                    try {
                        // Show the install prompt
                        state.deferredPrompt.prompt();
                        
                        // Wait for user response
                        var result = await state.deferredPrompt.userChoice;
                        
                        debugLog('PWA install result: ' + result.outcome);
                        
                        // Clear the prompt
                        state.deferredPrompt = null;
                        
                        // Hide banner
                        if (elements.installBanner) {
                            elements.installBanner.style.display = 'none';
                        }
                        
                    } catch (error) {
                        console.error('[LandingController] PWA install failed:', error);
                    }
                });
            }
            
            // Handle dismiss button
            if (elements.dismissBtn) {
                elements.dismissBtn.addEventListener('click', function() {
                    if (elements.installBanner) {
                        elements.installBanner.style.display = 'none';
                    }
                    // Store dismissal preference (show again after 7 days)
                    try {
                        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
                    } catch (e) {
                        // Storage may be full
                    }
                });
            }
            
            // Check if user previously dismissed (show after 7 days)
            checkInstallDismissal();
            
            // Hide banner if app is already installed
            if (window.matchMedia('(display-mode: standalone)').matches) {
                if (elements.installBanner) {
                    elements.installBanner.style.display = 'none';
                }
                debugLog('App already installed - hiding banner');
            }
            
            debugLog('PWA install banner initialized');
        } catch (error) {
            console.error('[LandingController] PWA install init failed:', error);
        }
    }
    
    /**
     * Check if install banner was previously dismissed
     */
    function checkInstallDismissal() {
        try {
            var dismissed = localStorage.getItem('pwa_install_dismissed');
            if (dismissed) {
                var dismissedTime = parseInt(dismissed, 10);
                var sevenDays = 7 * 24 * 60 * 60 * 1000;
                
                if (Date.now() - dismissedTime < sevenDays) {
                    // Still within 7 days - don't show
                    if (elements.installBanner) {
                        elements.installBanner.style.display = 'none';
                    }
                } else {
                    // Clear old dismissal
                    localStorage.removeItem('pwa_install_dismissed');
                }
            }
        } catch (e) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 8: STATS COUNTER ANIMATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize animated stat counters
     * Animates numbers when they scroll into view
     */
    function initStatsCounter() {
        try {
            var statsSection = document.getElementById('stats');
            if (!statsSection) return;
            
            var statValues = statsSection.querySelectorAll('.stat-value, [data-count]');
            if (!statValues.length) {
                // Try finding the stat numbers in the stats section
                var statDivs = statsSection.querySelectorAll('.grid-4 > div > div:first-child');
                if (!statDivs.length) return;
                statValues = statDivs;
            }
            
            var hasAnimated = false;
            
            // Use IntersectionObserver if available
            if ('IntersectionObserver' in window) {
                var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting && !hasAnimated) {
                            hasAnimated = true;
                            animateStatNumbers();
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.3 });
                
                observer.observe(statsSection);
            } else {
                // Fallback: animate on first scroll near section
                var scrollHandler = throttle(function() {
                    if (hasAnimated) return;
                    
                    var sectionTop = statsSection.offsetTop;
                    var sectionHeight = statsSection.offsetHeight;
                    var scrollBottom = window.scrollY + window.innerHeight;
                    
                    if (scrollBottom > sectionTop + sectionHeight * 0.3) {
                        hasAnimated = true;
                        animateStatNumbers();
                        window.removeEventListener('scroll', scrollHandler);
                    }
                }, 200);
                
                window.addEventListener('scroll', scrollHandler, { passive: true });
            }
            
            debugLog('Stats counter initialized');
        } catch (error) {
            console.error('[LandingController] Stats counter init failed:', error);
        }
    }
    
    /**
     * Animate stat numbers with counting effect
     */
    function animateStatNumbers() {
        try {
            var statsSection = document.getElementById('stats');
            if (!statsSection) return;
            
            // Find all number displays in stats section
            var numberElements = statsSection.querySelectorAll('.grid-4 > div > div:first-child');
            
            numberElements.forEach(function(el) {
                var text = el.textContent || '';
                // Extract number and suffix (e.g., "50K+" → number=50, suffix="K+")
                var match = text.match(/^([\d.]+)(.*)$/);
                if (!match) return;
                
                var targetNumber = parseFloat(match[1]);
                var suffix = match[2] || '';
                var duration = 2000; // 2 seconds
                var startTime = null;
                
                function animateStep(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = Math.min((timestamp - startTime) / duration, 1);
                    
                    // Ease-out cubic
                    var eased = 1 - Math.pow(1 - progress, 3);
                    var current = Math.round(targetNumber * eased);
                    
                    el.textContent = current + suffix;
                    
                    if (progress < 1) {
                        requestAnimationFrame(animateStep);
                    } else {
                        el.textContent = targetNumber + suffix; // Final exact value
                    }
                }
                
                requestAnimationFrame(animateStep);
            });
            
            debugLog('Stat numbers animated');
        } catch (error) {
            // Silent - non-critical visual enhancement
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: HEADER SCROLL EFFECT
    // -------------------------------------------------------------------------
    
    /**
     * Initialize header shadow on scroll
     */
    function initHeaderScrollEffect() {
        try {
            var header = document.querySelector('.header');
            if (!header) return;
            
            var handleScroll = throttle(function() {
                if (window.scrollY > 10) {
                    header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                } else {
                    header.style.boxShadow = '';
                }
            }, 150);
            
            window.addEventListener('scroll', handleScroll, { passive: true });
            
            debugLog('Header scroll effect initialized');
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 10: DYNAMIC COPYRIGHT YEAR
    // -------------------------------------------------------------------------
    
    /**
     * Set current year in copyright elements
     */
    function initCopyrightYear() {
        try {
            var yearElements = document.querySelectorAll('#current-year, .current-year, [data-year]');
            var currentYear = new Date().getFullYear().toString();
            
            yearElements.forEach(function(el) {
                el.textContent = currentYear;
            });
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 11: KEYBOARD NAVIGATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize keyboard shortcuts for landing page
     */
    function initKeyboardNav() {
        try {
            document.addEventListener('keydown', function(event) {
                // Escape - close drawer
                if (event.key === 'Escape' && state.isDrawerOpen) {
                    closeDrawer();
                }
                
                // 'H' - scroll to hero/top
                if (event.key === 'h' && !event.ctrlKey && !event.metaKey && 
                    document.activeElement === document.body) {
                    var hero = document.getElementById('hero');
                    if (hero) {
                        hero.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            });
            
            debugLog('Keyboard navigation initialized');
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 12: INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize all landing page features
     * @returns {boolean} True if initialization succeeded
     */
    function init() {
        try {
            if (state.isInitialized) {
                debugLog('Already initialized', 'warn');
                return true;
            }
            
            // Mark body as loaded (removes anti-flicker)
            document.body.classList.add('loaded');
            
            // Initialize all modules
            initMobileDrawer();
            initSubmenuScrollSpy();
            initSmoothScroll();
            initFAQ();
            initPWAInstall();
            initStatsCounter();
            initHeaderScrollEffect();
            initCopyrightYear();
            initKeyboardNav();
            
            state.isInitialized = true;
            
            debugLog('Landing page initialized v3.0.0');
            
            if (window.Constants && window.Constants.APP) {
                console.log(
                    '%c[11 Avatar Hub] %cLanding Page Ready %cv' + window.Constants.APP.VERSION,
                    'color: #FFD700; font-weight: bold; font-size: 1.1em;',
                    'color: #10B981;',
                    'color: #888; font-size: 0.9em;'
                );
            }
            
            return true;
            
        } catch (error) {
            console.error('[LandingController] Initialization failed:', error);
            // Still mark body as loaded even on error
            document.body.classList.add('loaded');
            return false;
        }
    }
    
    /**
     * Destroy controller and clean up
     */
    function destroy() {
        try {
            closeDrawer();
            
            // Clear all properties
            for (var key in elements) {
                if (elements.hasOwnProperty(key)) {
                    delete elements[key];
                }
            }
            
            // Cancel animation frames
            for (var id in animationFrames) {
                if (animationFrames.hasOwnProperty(id)) {
                    cancelAnimationFrame(animationFrames[id]);
                }
            }
            
            state.isInitialized = false;
            state.deferredPrompt = null;
            
            debugLog('Landing controller destroyed');
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 13: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API */
    const publicAPI = Object.freeze({
        init: init,
        destroy: destroy,
        openDrawer: openDrawer,
        closeDrawer: closeDrawer,
        getState: function() {
            return {
                isInitialized: state.isInitialized,
                isDrawerOpen: state.isDrawerOpen,
                hasInstallPrompt: !!state.deferredPrompt,
            };
        },
        isInitialized: function() {
            return state.isInitialized;
        },
    });
    
    return publicAPI;
    
})(); // End of LandingController IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            LandingController.init();
        });
    } else {
        // DOM already loaded
        LandingController.init();
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.LandingController = LandingController;
    window.Global = window.Global || {};
    window.Global.LandingController = LandingController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LandingController;
}

export {
    LandingController as default,
    LandingController,
};