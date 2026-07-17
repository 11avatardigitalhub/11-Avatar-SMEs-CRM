/**
 * 11 AVATAR DIGITAL HUB - Drawer Component
 * Enterprise-grade slide-out panel/drawer system
 * Left/right/top/bottom, nested drawers, resize handle, backdrop, keyboard trap
 * 
 * @component Drawer
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

/**
 * Drawer - Universal slide-out panel component
 * Multi-directional, nested, resizable, with full accessibility
 */
class Drawer {
    /**
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Component identity
        this.componentName = 'Drawer';
        this.componentId = `drw-${Date.now().toString(36)}`;

        /**
         * Full configuration with enterprise defaults
         * Every option documented with type and default value
         */
        this.config = {
            // Content - can be HTML string, element, or URL to fetch
            content: options.content || '',
            contentUrl: options.contentUrl || null,
            
            // Position & size
            position: options.position || 'right', // right, left, top, bottom
            size: options.size || 'md',            // sm, md, lg, xl, full, or pixel value
            minWidth: options.minWidth || 280,
            maxWidth: options.maxWidth || 800,
            minHeight: options.minHeight || 200,
            maxHeight: options.maxHeight || '90vh',
            
            // Title & header
            title: options.title || '',
            subtitle: options.subtitle || '',
            showHeader: options.showHeader !== false,
            showCloseButton: options.showCloseButton !== false,
            closeButtonLabel: options.closeButtonLabel || 'Close drawer',
            
            // Footer
            showFooter: options.showFooter || false,
            footerContent: options.footerContent || '',
            
            // Behavior
            open: options.open || false,
            closable: options.closable !== false,
            closeOnBackdrop: options.closeOnBackdrop !== false,
            closeOnEscape: options.closeOnEscape !== false,
            trapFocus: options.trapFocus !== false,
            lockScroll: options.lockScroll !== false,
            
            // Backdrop
            backdrop: options.backdrop !== false,
            backdropOpacity: options.backdropOpacity || 0.4,
            backdropBlur: options.backdropBlur || false,
            
            // Nested drawers
            nested: options.nested || false,
            parentDrawer: options.parentDrawer || null,
            
            // Resize
            resizable: options.resizable || false,
            resizeHandleSize: options.resizeHandleSize || 6,
            resizeMinSize: options.resizeMinSize || 200,
            resizeMaxSize: options.resizeMaxSize || 1200,
            
            // Animation
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 300,
            animationEasing: options.animationEasing || 'cubic-bezier(0.4, 0, 0.2, 1)',
            
            // Theme
            theme: options.theme || 'light',
            
            // Events
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            onBeforeOpen: options.onBeforeOpen || null,
            onBeforeClose: options.onBeforeClose || null,
            onContentLoad: options.onContentLoad || null,
            onResize: options.onResize || null,
            onResizeStart: options.onResizeStart || null,
            onResizeEnd: options.onResizeEnd || null
        };

        // Size presets in pixels
        this.sizePresets = {
            sm: { right: 320, left: 320, top: 250, bottom: 250 },
            md: { right: 480, left: 480, top: 350, bottom: 350 },
            lg: { right: 640, left: 640, top: 500, bottom: 500 },
            xl: { right: 800, left: 800, top: 650, bottom: 650 },
            full: { right: '100vw', left: '100vw', top: '100vh', bottom: '100vh' }
        };

        /**
         * Internal state management
         */
        this.state = {
            isOpen: this.config.open,
            isAnimating: false,
            isDragging: false,
            contentLoaded: false,
            contentLoading: false,
            resizeStartSize: 0,
            resizeStartPosition: { x: 0, y: 0 },
            currentSize: 0,
            parentDrawerInstance: null,
            previousFocusElement: null
        };

        // DOM element cache
        this.elements = {
            overlay: null,
            drawer: null,
            header: null,
            titleEl: null,
            closeBtn: null,
            body: null,
            footer: null,
            resizeHandle: null,
            contentContainer: null
        };

        // Bound event handlers for cleanup
        this.boundKeyHandler = null;
        this.boundResizeMove = null;
        this.boundResizeEnd = null;

        // Performance tracking
        this.performance = {
            initTime: 0,
            openCount: 0,
            lastOpenTime: 0,
            totalOpenTime: 0,
            averageOpenTime: 0
        };

        // Initialize
        this.init();
    }

    /**
     * Initialize drawer component
     * Builds DOM structure, binds events, handles initial open state
     * @async
     */
    async init() {
        try {
            const initStart = performance.now();
            console.log(`[Drawer] Initializing: ${this.componentId} (${this.config.position})`);

            // Validate configuration
            this.validateConfig();

            // Build drawer DOM structure
            this.buildDrawer();

            // Bind events
            this.bindEvents();

            // If parent drawer specified, link nested relationship
            if (this.config.parentDrawer) {
                this.linkParentDrawer();
            }

            // Open initially if configured
            if (this.config.open) {
                await this.open(false); // Don't animate initial open
            }

            // Performance tracking
            this.performance.initTime = performance.now() - initStart;
            console.log(`[Drawer] Initialized in ${this.performance.initTime.toFixed(2)}ms`);

            // Emit ready event
            EventBus.emit('drawer:ready', {
                componentId: this.componentId,
                position: this.config.position,
                isOpen: this.state.isOpen
            });

        } catch (error) {
            console.error('[Drawer] Initialization failed:', error);
            EventBus.emit('drawer:error', {
                componentId: this.componentId,
                error: error.message,
                phase: 'initialization'
            });
        }
    }

    /**
     * Validate configuration and apply defaults
     */
    validateConfig() {
        // Validate position
        const validPositions = ['left', 'right', 'top', 'bottom'];
        if (!validPositions.includes(this.config.position)) {
            console.warn(`[Drawer] Invalid position "${this.config.position}", defaulting to "right"`);
            this.config.position = 'right';
        }

        // Validate size
        const validSizes = ['sm', 'md', 'lg', 'xl', 'full'];
        if (!validSizes.includes(this.config.size) && typeof this.config.size !== 'number') {
            console.warn(`[Drawer] Invalid size "${this.config.size}", defaulting to "md"`);
            this.config.size = 'md';
        }

        // Calculate initial size
        this.state.currentSize = this.getDrawerSize();

        console.log('[Drawer] Configuration validated:', {
            position: this.config.position,
            size: this.config.size,
            computedSize: this.state.currentSize
        });
    }

    /**
     * Get drawer size based on position and configuration
     * @returns {number} Size in pixels
     */
    getDrawerSize() {
        if (typeof this.config.size === 'number') {
            return this.config.size;
        }
        return this.sizePresets[this.config.size]?.[this.config.position] || 480;
    }

    /**
     * Get the dimension property based on position
     * @returns {string} 'width' or 'height'
     */
    getSizeProperty() {
        return (this.config.position === 'left' || this.config.position === 'right') ? 'width' : 'height';
    }

    /**
     * Build the complete drawer DOM structure
     */
    buildDrawer() {
        try {
            const isHorizontal = this.config.position === 'left' || this.config.position === 'right';
            const sizeProperty = this.getSizeProperty();
            const sizeValue = this.state.currentSize;

            // Create overlay element
            this.elements.overlay = document.createElement('div');
            this.elements.overlay.id = `${this.componentId}-overlay`;
            this.elements.overlay.className = `drw-overlay drw-theme-${this.config.theme}`;
            this.elements.overlay.style.cssText = `
                display: ${this.state.isOpen ? 'block' : 'none'};
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, ${this.config.backdropOpacity});
                z-index: 9998;
                opacity: ${this.state.isOpen ? '1' : '0'};
                transition: opacity ${this.config.animationDuration}ms ${this.config.animationEasing};
                ${this.config.backdropBlur ? 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);' : ''}
            `;

            // Create drawer container
            this.elements.drawer = document.createElement('div');
            this.elements.drawer.id = `${this.componentId}-drawer`;
            this.elements.drawer.className = `drw-drawer drw-${this.config.position} drw-theme-${this.config.theme}`;
            this.elements.drawer.setAttribute('role', 'dialog');
            this.elements.drawer.setAttribute('aria-modal', 'true');
            this.elements.drawer.setAttribute('aria-label', this.config.title || 'Drawer');
            this.elements.drawer.style.cssText = `
                position: fixed;
                z-index: 9999;
                background: ${this.config.theme === 'dark' ? '#1E1E1E' : '#FFFFFF'};
                color: ${this.config.theme === 'dark' ? '#E5E5E5' : '#0A0A0A'};
                box-shadow: ${this.getBoxShadow()};
                display: flex;
                flex-direction: column;
                ${sizeProperty}: ${sizeValue}px;
                ${this.getPositionStyles()}
                transform: ${this.getClosedTransform()};
                transition: transform ${this.config.animationDuration}ms ${this.config.animationEasing};
                ${this.config.nested ? 'box-shadow: -8px 0 24px rgba(0,0,0,0.15);' : ''}
            `;

            // Build internal structure
            this.elements.drawer.innerHTML = `
                ${this.config.showHeader ? `
                    <div class="drw-header" id="${this.componentId}-header">
                        <div class="drw-header-content">
                            <h3 class="drw-title" id="${this.componentId}-title">${this.escapeHtml(this.config.title)}</h3>
                            ${this.config.subtitle ? `<p class="drw-subtitle">${this.escapeHtml(this.config.subtitle)}</p>` : ''}
                        </div>
                        ${this.config.showCloseButton ? `
                            <button class="drw-close-btn" id="${this.componentId}-close" 
                                    aria-label="${this.config.closeButtonLabel}" type="button">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="drw-body" id="${this.componentId}-body">
                    <div class="drw-content" id="${this.componentId}-content">
                        ${this.config.contentUrl ? `
                            <div class="drw-loading">
                                <i class="fas fa-spinner fa-spin"></i>
                                <span>Loading content...</span>
                            </div>
                        ` : this.config.content}
                    </div>
                </div>

                ${this.config.showFooter ? `
                    <div class="drw-footer" id="${this.componentId}-footer">
                        ${this.config.footerContent}
                    </div>
                ` : ''}

                ${this.config.resizable ? `
                    <div class="drw-resize-handle drw-resize-${this.config.position}" 
                         id="${this.componentId}-resize"
                         style="${isHorizontal ? 'width' : 'height'}: ${this.config.resizeHandleSize}px;"
                         aria-label="Resize drawer" role="separator" aria-orientation="${isHorizontal ? 'vertical' : 'horizontal'}">
                    </div>
                ` : ''}
            `;

            // Append overlay then drawer to body
            this.elements.overlay.appendChild(this.elements.drawer);
            document.body.appendChild(this.elements.overlay);

            // Cache internal elements
            this.elements.header = document.getElementById(`${this.componentId}-header`);
            this.elements.titleEl = document.getElementById(`${this.componentId}-title`);
            this.elements.closeBtn = document.getElementById(`${this.componentId}-close`);
            this.elements.body = document.getElementById(`${this.componentId}-body`);
            this.elements.contentContainer = document.getElementById(`${this.componentId}-content`);
            this.elements.footer = document.getElementById(`${this.componentId}-footer`);
            this.elements.resizeHandle = document.getElementById(`${this.componentId}-resize`);

            // If open, set open transform immediately (no animation)
            if (this.state.isOpen) {
                this.elements.drawer.style.transform = this.getOpenTransform();
                this.elements.drawer.style.transition = 'none';
                // Force reflow then restore transition
                this.elements.drawer.offsetHeight;
                this.elements.drawer.style.transition = `transform ${this.config.animationDuration}ms ${this.config.animationEasing}`;
            }

            console.log('[Drawer] DOM built');
        } catch (error) {
            console.error('[Drawer] Build failed:', error);
        }
    }

    /**
     * Get CSS position styles based on drawer position
     * @returns {string} CSS position styles
     */
    getPositionStyles() {
        switch (this.config.position) {
            case 'left':
                return 'top: 0; left: 0; bottom: 0;';
            case 'right':
                return 'top: 0; right: 0; bottom: 0;';
            case 'top':
                return 'top: 0; left: 0; right: 0;';
            case 'bottom':
                return 'bottom: 0; left: 0; right: 0;';
            default:
                return 'top: 0; right: 0; bottom: 0;';
        }
    }

    /**
     * Get box shadow based on position
     * @returns {string} Box shadow CSS
     */
    getBoxShadow() {
        switch (this.config.position) {
            case 'left':
                return '4px 0 24px rgba(0, 0, 0, 0.12)';
            case 'right':
                return '-4px 0 24px rgba(0, 0, 0, 0.12)';
            case 'top':
                return '0 4px 24px rgba(0, 0, 0, 0.12)';
            case 'bottom':
                return '0 -4px 24px rgba(0, 0, 0, 0.12)';
            default:
                return '-4px 0 24px rgba(0, 0, 0, 0.12)';
        }
    }

    /**
     * Get the closed/hidden transform value
     * @returns {string} CSS transform value
     */
    getClosedTransform() {
        switch (this.config.position) {
            case 'left':
                return 'translateX(-100%)';
            case 'right':
                return 'translateX(100%)';
            case 'top':
                return 'translateY(-100%)';
            case 'bottom':
                return 'translateY(100%)';
            default:
                return 'translateX(100%)';
        }
    }

    /**
     * Get the open/visible transform value
     * @returns {string} CSS transform value
     */
    getOpenTransform() {
        return 'translate(0, 0)';
    }

    /**
     * Bind all event handlers
     */
    bindEvents() {
        try {
            // Close button click
            if (this.elements.closeBtn) {
                this.elements.closeBtn.addEventListener('click', () => this.close());
            }

            // Backdrop click
            if (this.config.closeOnBackdrop && this.elements.overlay) {
                this.elements.overlay.addEventListener('click', (e) => {
                    // Only close if clicking the overlay itself, not the drawer
                    if (e.target === this.elements.overlay) {
                        this.close();
                    }
                });
            }

            // Keyboard handler
            this.boundKeyHandler = (e) => {
                if (!this.state.isOpen) return;

                // Escape key
                if (e.key === 'Escape' && this.config.closeOnEscape) {
                    // Check if this is the top-most drawer (for nested)
                    if (!this.config.parentDrawer || this.isTopMostNested()) {
                        e.preventDefault();
                        this.close();
                    }
                }

                // Tab key for focus trap
                if (e.key === 'Tab' && this.config.trapFocus && this.state.isOpen) {
                    this.handleFocusTrap(e);
                }
            };

            document.addEventListener('keydown', this.boundKeyHandler);

            // Resize handle events
            if (this.elements.resizeHandle) {
                this.elements.resizeHandle.addEventListener('mousedown', (e) => {
                    this.startResize(e);
                });
                this.elements.resizeHandle.addEventListener('touchstart', (e) => {
                    this.startResize(e.touches[0]);
                }, { passive: true });
            }

            console.log('[Drawer] Events bound');
        } catch (error) {
            console.error('[Drawer] Event binding failed:', error);
        }
    }

    /**
     * Open the drawer
     * @param {boolean} [animate=true] - Whether to animate the opening
     * @returns {Promise<void>}
     */
    async open(animate = true) {
        if (this.state.isOpen || this.state.isAnimating) return;

        try {
            const openStart = performance.now();

            // Fire before-open callback (can cancel by returning false)
            if (this.config.onBeforeOpen) {
                const allowOpen = this.config.onBeforeOpen({ componentId: this.componentId });
                if (allowOpen === false) return;
            }

            this.state.isAnimating = true;
            this.state.isOpen = true;

            // Store previously focused element for restoration on close
            this.state.previousFocusElement = document.activeElement;

            // Show overlay
            this.elements.overlay.style.display = 'block';

            // Load content from URL if needed
            if (this.config.contentUrl && !this.state.contentLoaded) {
                await this.loadContent();
            }

            // Lock body scroll
            if (this.config.lockScroll) {
                document.body.style.overflow = 'hidden';
            }

            // Animate
            if (animate && this.config.animation) {
                // Force reflow
                this.elements.overlay.offsetHeight;
                
                requestAnimationFrame(() => {
                    this.elements.overlay.style.opacity = '1';
                    this.elements.drawer.style.transform = this.getOpenTransform();
                });

                // Wait for animation to complete
                await new Promise(resolve => {
                    setTimeout(resolve, this.config.animationDuration);
                });
            } else {
                // No animation - set immediately
                this.elements.drawer.style.transition = 'none';
                this.elements.overlay.style.opacity = '1';
                this.elements.drawer.style.transform = this.getOpenTransform();
                
                // Force reflow then restore transition
                this.elements.drawer.offsetHeight;
                this.elements.drawer.style.transition = `transform ${this.config.animationDuration}ms ${this.config.animationEasing}`;
            }

            // Focus first focusable element in drawer
            if (this.config.trapFocus) {
                setTimeout(() => this.focusFirstElement(), 100);
            }

            this.state.isAnimating = false;
            this.performance.openCount++;
            this.performance.lastOpenTime = performance.now() - openStart;
            this.performance.totalOpenTime += this.performance.lastOpenTime;
            this.performance.averageOpenTime = this.performance.totalOpenTime / this.performance.openCount;

            // Fire open callback
            if (this.config.onOpen) {
                this.config.onOpen({ componentId: this.componentId });
            }

            // Emit event
            EventBus.emit('drawer:opened', {
                componentId: this.componentId,
                position: this.config.position
            });

            console.log(`[Drawer] Opened in ${this.performance.lastOpenTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('[Drawer] Open failed:', error);
            this.state.isOpen = false;
            this.state.isAnimating = false;
        }
    }

    /**
     * Close the drawer
     * @param {boolean} [animate=true] - Whether to animate the closing
     * @returns {Promise<void>}
     */
    async close(animate = true) {
        if (!this.state.isOpen || this.state.isAnimating) return;

        try {
            // Fire before-close callback (can cancel by returning false)
            if (this.config.onBeforeClose) {
                const allowClose = this.config.onBeforeClose({ componentId: this.componentId });
                if (allowClose === false) return;
            }

            this.state.isAnimating = true;

            // Animate
            if (animate && this.config.animation) {
                this.elements.overlay.style.opacity = '0';
                this.elements.drawer.style.transform = this.getClosedTransform();

                // Wait for animation to complete
                await new Promise(resolve => {
                    setTimeout(resolve, this.config.animationDuration);
                });
            }

            // Hide overlay
            this.elements.overlay.style.display = 'none';

            // Restore body scroll
            if (this.config.lockScroll) {
                document.body.style.overflow = '';
            }

            // Restore focus
            if (this.state.previousFocusElement && typeof this.state.previousFocusElement.focus === 'function') {
                this.state.previousFocusElement.focus();
                this.state.previousFocusElement = null;
            }

            this.state.isOpen = false;
            this.state.isAnimating = false;

            // Fire close callback
            if (this.config.onClose) {
                this.config.onClose({ componentId: this.componentId });
            }

            // Emit event
            EventBus.emit('drawer:closed', {
                componentId: this.componentId
            });

        } catch (error) {
            console.error('[Drawer] Close failed:', error);
            this.state.isAnimating = false;
        }
    }

    /**
     * Toggle open/close state
     */
    toggle() {
        if (this.state.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Load content from URL
     * @async
     */
    async loadContent() {
        if (this.state.contentLoading) return;

        try {
            this.state.contentLoading = true;
            console.log(`[Drawer] Loading content from: ${this.config.contentUrl}`);

            const response = await fetch(this.config.contentUrl, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('Content-Type') || '';
            
            if (contentType.includes('application/json')) {
                const data = await response.json();
                this.setContent(data.content || data.html || JSON.stringify(data));
            } else {
                const html = await response.text();
                this.setContent(html);
            }

            this.state.contentLoaded = true;

            if (this.config.onContentLoad) {
                this.config.onContentLoad({ content: this.config.content });
            }

        } catch (error) {
            console.error('[Drawer] Content load failed:', error);
            this.setContent(`<div class="drw-error"><i class="fas fa-exclamation-circle"></i><p>Failed to load content: ${this.escapeHtml(error.message)}</p></div>`);
        } finally {
            this.state.contentLoading = false;
        }
    }

    /**
     * Set drawer content
     * @param {string} content - HTML content
     */
    setContent(content) {
        this.config.content = content;
        if (this.elements.contentContainer) {
            this.elements.contentContainer.innerHTML = content;
        }
    }

    /**
     * Set drawer title
     * @param {string} title - New title
     */
    setTitle(title) {
        this.config.title = title;
        if (this.elements.titleEl) {
            this.elements.titleEl.textContent = title;
        }
        if (this.elements.drawer) {
            this.elements.drawer.setAttribute('aria-label', title);
        }
    }

    /**
     * Start resize operation
     * @param {MouseEvent|Touch} e - Mouse or touch event
     */
    startResize(e) {
        if (!this.config.resizable) return;
        
        this.state.isDragging = true;
        
        const isHorizontal = this.config.position === 'left' || this.config.position === 'right';
        this.state.resizeStartPosition = { x: e.clientX, y: e.clientY };
        this.state.resizeStartSize = this.state.currentSize;

        // Add document-level move and end handlers
        this.boundResizeMove = (moveEvent) => this.handleResizeMove(moveEvent);
        this.boundResizeEnd = () => this.handleResizeEnd();

        document.addEventListener('mousemove', this.boundResizeMove);
        document.addEventListener('mouseup', this.boundResizeEnd);
        document.addEventListener('touchmove', this.boundResizeMove, { passive: true });
        document.addEventListener('touchend', this.boundResizeEnd);

        // Add resizing class
        document.body.style.cursor = isHorizontal ? 'ew-resize' : 'ns-resize';
        document.body.style.userSelect = 'none';
        this.elements.drawer.style.transition = 'none';

        if (this.config.onResizeStart) {
            this.config.onResizeStart({ size: this.state.currentSize });
        }
    }

    /**
     * Handle resize mouse/touch movement
     * @param {MouseEvent|Touch} e - Movement event
     */
    handleResizeMove(e) {
        if (!this.state.isDragging) return;

        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;

        let delta = 0;
        const isHorizontal = this.config.position === 'left' || this.config.position === 'right';

        if (isHorizontal) {
            delta = clientX - this.state.resizeStartPosition.x;
            // Invert for left position
            if (this.config.position === 'left') delta = -delta;
        } else {
            delta = clientY - this.state.resizeStartPosition.y;
            // Invert for top position
            if (this.config.position === 'top') delta = -delta;
        }

        let newSize = this.state.resizeStartSize + delta;
        
        // Apply constraints
        newSize = Math.max(this.config.resizeMinSize, Math.min(this.config.resizeMaxSize, newSize));
        
        // Update size
        this.state.currentSize = newSize;
        const sizeProperty = this.getSizeProperty();
        this.elements.drawer.style[sizeProperty] = `${newSize}px`;

        if (this.config.onResize) {
            this.config.onResize({ size: newSize, delta });
        }
    }

    /**
     * Handle resize end
     */
    handleResizeEnd() {
        if (!this.state.isDragging) return;

        this.state.isDragging = false;

        // Remove document handlers
        document.removeEventListener('mousemove', this.boundResizeMove);
        document.removeEventListener('mouseup', this.boundResizeEnd);
        document.removeEventListener('touchmove', this.boundResizeMove);
        document.removeEventListener('touchend', this.boundResizeEnd);

        // Restore styles
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.elements.drawer.style.transition = `transform ${this.config.animationDuration}ms ${this.config.animationEasing}`;

        if (this.config.onResizeEnd) {
            this.config.onResizeEnd({ size: this.state.currentSize });
        }

        EventBus.emit('drawer:resized', {
            componentId: this.componentId,
            size: this.state.currentSize
        });
    }

    /**
     * Handle focus trap within drawer
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleFocusTrap(e) {
        if (!this.elements.drawer) return;

        const focusableElements = this.elements.drawer.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }

    /**
     * Focus the first focusable element in the drawer
     */
    focusFirstElement() {
        if (!this.elements.drawer) return;

        const focusableElements = this.elements.drawer.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    /**
     * Link to parent drawer for nested drawer support
     */
    linkParentDrawer() {
        const parentInstance = window.Global?.Drawer?.instances?.get(this.config.parentDrawer);
        if (parentInstance) {
            this.state.parentDrawerInstance = parentInstance;
            console.log(`[Drawer] Linked to parent drawer: ${this.config.parentDrawer}`);
        }
    }

    /**
     * Check if this is the top-most nested drawer
     * @returns {boolean}
     */
    isTopMostNested() {
        // Check all drawer instances to see if any nested drawer is open
        const instances = window.Global?.Drawer?.instances;
        if (!instances) return true;

        for (const [id, instance] of instances) {
            if (instance !== this && instance.state.isOpen && instance.config.parentDrawer === this.componentId) {
                return false; // A child drawer is open
            }
        }
        return true;
    }

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Check if drawer is open
     * @returns {boolean}
     */
    isOpen() {
        return this.state.isOpen;
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
        try {
            // Close first if open
            if (this.state.isOpen) {
                this.close(false);
            }

            // Remove event listeners
            document.removeEventListener('keydown', this.boundKeyHandler);
            
            if (this.boundResizeMove) {
                document.removeEventListener('mousemove', this.boundResizeMove);
                document.removeEventListener('mouseup', this.boundResizeEnd);
            }

            // Remove DOM elements
            if (this.elements.overlay && this.elements.overlay.parentNode) {
                this.elements.overlay.parentNode.removeChild(this.elements.overlay);
            }

            // Restore scroll
            if (this.config.lockScroll) {
                document.body.style.overflow = '';
            }

            console.log('[Drawer] Component destroyed');
        } catch (error) {
            console.error('[Drawer] Destroy failed:', error);
        }
    }

    /**
     * Static factory method
     * @param {Object} options - Configuration
     * @returns {Drawer} Instance
     */
    static create(options) {
        const instance = new Drawer(options);
        
        if (!window.Global) window.Global = {};
        if (!window.Global.Drawer) window.Global.Drawer = {};
        if (!window.Global.Drawer.instances) window.Global.Drawer.instances = new Map();
        
        window.Global.Drawer.instances.set(instance.componentId, instance);
        
        return instance;
    }

    /**
     * Get instance by component ID
     * @param {string} componentId - Component ID
     * @returns {Drawer|null} Instance
     */
    static getInstance(componentId) {
        return window.Global?.Drawer?.instances?.get(componentId) || null;
    }
}

// Export
export { Drawer };
export default Drawer;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Drawer = window.Global.Drawer || {};
    window.Global.Drawer.instances = window.Global.Drawer.instances || new Map();
    window.Global.Drawer.Drawer = Drawer;
}

