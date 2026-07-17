/**
 * 11 AVATAR DIGITAL HUB - Star Rating Component
 * Enterprise-grade interactive rating system
 * Stars, emoji, numeric, read-only, fractional, hover effects, accessibility
 * 
 * @component Rating
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Validators } from '../utils/validators.js';

/**
 * Rating - Universal star/emoji/numeric rating component
 * Interactive selection, read-only display, fractional support, tooltips
 */
class Rating {
    /**
     * Initialize rating component with full enterprise configuration
     * @param {HTMLElement|string} container - Container element or selector string
     * @param {Object} options - Complete configuration object with all options documented
     */
    constructor(container, options = {}) {
        // Component identity for debugging and global registry
        this.componentName = 'Rating';
        this.componentId = `rtg-${Date.now().toString(36)}`;
        
        // Container resolution - supports both direct element and selector string
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        // Validate container element exists in DOM
        if (!this.container) {
            throw new Error('Rating: Container element not found in DOM');
        }

        /**
         * Complete configuration with enterprise-grade defaults
         * Every option is documented with type, purpose, and validation rules
         */
        this.config = {
            // Core value configuration
            value: options.value || 0,                    // Current rating value (0 to max)
            max: options.max || 5,                        // Maximum rating value (number of stars)
            step: options.step || 1,                      // Step increment (1 = whole, 0.5 = half)
            precision: options.precision || 1,             // Decimal precision for display
            
            // Display mode
            mode: options.mode || 'stars',                // 'stars' | 'emoji' | 'numeric' | 'hearts' | 'thumbs'
            size: options.size || 'md',                   // 'sm' | 'md' | 'lg' | 'xl' | custom number
            color: options.color || '#F59E0B',             // Active/filled star color
            inactiveColor: options.inactiveColor || '#D1D5DB', // Empty/unfilled color
            hoverColor: options.hoverColor || '#FBBF24',   // Hover highlight color
            
            // Display options
            showValue: options.showValue !== false,        // Show numeric value next to stars
            showTooltip: options.showTooltip !== false,    // Show tooltip on hover with label
            showCount: options.showCount || false,         // Show total vote count
            count: options.count || 0,                     // Number of ratings received
            
            // Labels & tooltips
            labels: options.labels || [                    // Custom labels per rating level
                'Poor', 'Below Average', 'Average', 'Good', 'Excellent'
            ],
            tooltipLabels: options.tooltipLabels || null,  // Custom tooltip text per level
            
            // Interaction
            interactive: options.interactive !== false,    // Allow user to change rating
            readOnly: options.readOnly || false,           // Display only, no interaction
            disabled: options.disabled || false,           // Visually disabled state
            clearable: options.clearable || false,         // Allow clearing rating on re-click
            allowHalf: options.allowHalf || false,         // Allow half-star selection
            hoverPreview: options.hoverPreview !== false,  // Show preview on hover
            
            // Character/icons
            icon: options.icon || 'fa-star',               // Font Awesome icon for active state
            emptyIcon: options.emptyIcon || 'fa-star',     // Font Awesome icon for inactive state
            halfIcon: options.halfIcon || 'fa-star-half-alt', // Icon for half state
            emojiSet: options.emojiSet || null,            // Custom emoji set ['😡','😟','😐','😊','😍']
            
            // Animation
            animation: options.animation !== false,        // Enable selection animation
            animationDuration: options.animationDuration || 300, // Animation duration in ms
            animateOnHover: options.animateOnHover !== false, // Bounce effect on hover
            
            // Accessibility
            ariaLabel: options.ariaLabel || 'Rating',      // ARIA label for screen readers
            ariaLabels: options.ariaLabels || null,         // Individual star aria labels
            
            // Theme
            theme: options.theme || 'light',               // 'light' | 'dark'
            
            // Callbacks
            onChange: options.onChange || null,            // Called when rating changes
            onHover: options.onHover || null,              // Called when hovering over a value
            onSubmit: options.onSubmit || null,            // Called when rating is submitted
            onClear: options.onClear || null               // Called when rating is cleared
        };

        /**
         * Internal state management with complete initialization
         * All mutable state tracked here for proper reactivity
         */
        this.state = {
            currentValue: this.config.value,               // Currently selected/displayed value
            hoverValue: null,                              // Value being hovered (null = not hovering)
            isHovering: false,                              // Whether mouse is over component
            isSubmitting: false,                            // Whether rating submission is in progress
            hasRated: this.config.value > 0,               // Whether user has already rated
            animationPlaying: false,                        // Whether animation is active
            touchStartX: 0,                                 // Touch start X position
            touchCurrentX: 0,                               // Current touch X position
            isTouching: false                               // Whether touch interaction is active
        };

        // Size mapping in pixels for consistent sizing across modes
        this.sizeMap = { 
            sm: 20, md: 28, lg: 36, xl: 48 
        };

        // Default emoji sets for different modes
        this.emojiSets = {
            stars: null,
            hearts: ['🤍', '❤️'],
            emoji: ['😡', '😟', '😐', '😊', '😍'],
            thumbs: ['👎', '👍']
        };

        // DOM element cache for performance
        this.elements = {
            wrapper: null,           // Main wrapper div
            itemsContainer: null,    // Container for rating items
            items: [],               // Individual rating item elements
            valueDisplay: null,      // Numeric value display span
            countDisplay: null,      // Vote count display span
            tooltip: null,           // Tooltip element
            hiddenInput: null        // Hidden input for form submission
        };

        // Performance tracking for enterprise monitoring
        this.performance = {
            initTime: 0,
            renderTime: 0,
            interactionCount: 0,
            lastInteraction: null,
            averageResponseTime: 0,
            totalResponseTime: 0
        };

        // Bind methods to maintain correct 'this' context
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

        // Initialize the component
        this.init();
    }

    /**
     * Initialize rating component
     * Sets up DOM, binds events, renders initial state
     * @async
     */
    async init() {
        try {
            // Start performance timer for monitoring
            const initStart = performance.now();
            
            console.log(`[Rating] Initializing component: ${this.componentId}`);
            console.log(`[Rating] Config: mode=${this.config.mode}, max=${this.config.max}, value=${this.config.value}`);

            // Validate configuration before proceeding
            this.validateConfig();

            // Set default emoji set based on mode if not provided
            if (!this.config.emojiSet && this.emojiSets[this.config.mode]) {
                this.config.emojiSet = this.emojiSets[this.config.mode];
            }

            // Render the complete component
            await this.render();

            // Bind all event handlers
            this.bindEvents();

            // Calculate and log performance metrics
            this.performance.initTime = performance.now() - initStart;
            console.log(`[Rating] Initialized successfully in ${this.performance.initTime.toFixed(2)}ms`);

            // Emit ready event for external listeners
            EventBus.emit('rating:ready', {
                componentId: this.componentId,
                value: this.state.currentValue,
                max: this.config.max,
                mode: this.config.mode
            });

        } catch (error) {
            // Comprehensive error handling with user feedback
            console.error('[Rating] Initialization failed:', error);
            
            // Display error state in container
            if (this.container) {
                this.container.innerHTML = `
                    <div class="rtg-error" role="alert" style="color:#DC2626;padding:8px;font-size:14px;">
                        <i class="fas fa-exclamation-circle"></i> 
                        Failed to load rating: ${this.escapeHtml(error.message)}
                    </div>
                `;
            }

            // Emit error event for monitoring
            EventBus.emit('rating:error', {
                componentId: this.componentId,
                error: error.message,
                phase: 'initialization'
            });
        }
    }

    /**
     * Validate configuration and apply constraints
     * Ensures all values are within acceptable ranges
     */
    validateConfig() {
        // Ensure max is a positive integer
        if (!Number.isInteger(this.config.max) || this.config.max < 1) {
            console.warn('[Rating] Invalid max value, defaulting to 5');
            this.config.max = 5;
        }

        // Clamp max to reasonable range (1-10)
        if (this.config.max > 10) {
            console.warn('[Rating] Max value exceeds 10, clamping to 10');
            this.config.max = 10;
        }

        // Ensure value is within valid range
        if (this.config.value < 0) {
            this.config.value = 0;
        }
        if (this.config.value > this.config.max) {
            this.config.value = this.config.max;
        }

        // Round value to nearest valid step
        if (this.config.step > 0) {
            this.config.value = Math.round(this.config.value / this.config.step) * this.config.step;
        }

        // Sync state with validated config
        this.state.currentValue = this.config.value;

        // Ensure valid mode
        const validModes = ['stars', 'emoji', 'numeric', 'hearts', 'thumbs'];
        if (!validModes.includes(this.config.mode)) {
            console.warn(`[Rating] Invalid mode "${this.config.mode}", defaulting to "stars"`);
            this.config.mode = 'stars';
        }

        // Adjust step based on mode
        if (this.config.mode === 'thumbs') {
            this.config.max = 2;
            this.config.step = 1;
            this.config.allowHalf = false;
        }

        console.log('[Rating] Configuration validated successfully');
    }

    /**
     * Get the pixel size for the current size setting
     * @returns {number} Size in pixels
     */
    getPixelSize() {
        if (typeof this.config.size === 'number') {
            return this.config.size;
        }
        return this.sizeMap[this.config.size] || this.sizeMap.md;
    }

    /**
     * Get display value (current or hover)
     * @returns {number} Display value
     */
    getDisplayValue() {
        if (this.state.isHovering && this.state.hoverValue !== null) {
            return this.state.hoverValue;
        }
        return this.state.currentValue;
    }

    /**
     * Get tooltip text for a given rating value
     * @param {number} value - Rating value
     * @returns {string} Tooltip text
     */
    getTooltipText(value) {
        // Use custom tooltip labels if provided
        if (this.config.tooltipLabels && this.config.tooltipLabels[value - 1]) {
            return this.config.tooltipLabels[value - 1];
        }

        // Use standard labels array
        const labelIndex = Math.min(Math.ceil(value) - 1, this.config.labels.length - 1);
        if (labelIndex >= 0 && this.config.labels[labelIndex]) {
            return this.config.labels[labelIndex];
        }

        // Fallback
        return `${value} / ${this.config.max}`;
    }

    /**
     * Render the complete rating component
     * Builds full DOM structure with all elements
     */
    render() {
        try {
            const renderStart = performance.now();

            // Calculate CSS classes based on configuration
            const pixelSize = this.getPixelSize();
            const modeClass = `rtg-mode-${this.config.mode}`;
            const sizeClass = `rtg-size-${this.config.size}`;
            const themeClass = `rtg-theme-${this.config.theme}`;
            const interactiveClass = this.config.interactive && !this.config.readOnly ? 'rtg-interactive' : '';
            const disabledClass = this.config.disabled ? 'rtg-disabled' : '';
            const readOnlyClass = this.config.readOnly ? 'rtg-readonly' : '';

            // Build rating items based on mode
            const itemsHtml = this.renderRatingItems();

            // Build the complete component HTML
            const html = `
                <div class="rtg-wrapper ${modeClass} ${sizeClass} ${themeClass} ${interactiveClass} ${disabledClass} ${readOnlyClass}" 
                     id="${this.componentId}"
                     role="group"
                     aria-label="${this.config.ariaLabel}"
                     style="font-size:${pixelSize}px;"
                     tabindex="${this.config.interactive && !this.config.readOnly ? '0' : '-1'}">
                    
                    <!-- Rating Items Container -->
                    <div class="rtg-items" 
                         id="${this.componentId}-items"
                         role="radiogroup"
                         aria-label="${this.config.ariaLabel}">
                        ${itemsHtml}
                    </div>

                    <!-- Value Display -->
                    ${this.config.showValue ? `
                        <span class="rtg-value" 
                              id="${this.componentId}-value"
                              aria-live="polite"
                              aria-atomic="true">
                            ${this.getDisplayValue().toFixed(this.config.precision)}
                        </span>
                    ` : ''}

                    <!-- Vote Count Display -->
                    ${this.config.showCount && this.config.count > 0 ? `
                        <span class="rtg-count" id="${this.componentId}-count">
                            (${this.formatCount(this.config.count)})
                        </span>
                    ` : ''}

                    <!-- Hidden input for form submission -->
                    <input type="hidden" 
                           id="${this.componentId}-hidden"
                           value="${this.state.currentValue}"
                           aria-hidden="true">
                </div>
            `;

            // Set container HTML
            this.container.innerHTML = html;

            // Cache DOM element references for performance
            this.cacheElements();

            // Update visual state
            this.updateDisplay();

            // Track performance
            this.performance.renderTime = performance.now() - renderStart;
            console.log(`[Rating] Rendered in ${this.performance.renderTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('[Rating] Render failed:', error);
            throw error;
        }
    }

    /**
     * Render individual rating items based on mode
     * @returns {string} HTML string of rating items
     */
    renderRatingItems() {
        let items = '';

        switch (this.config.mode) {
            case 'numeric':
                // Numeric mode: show clickable numbers
                for (let i = 1; i <= this.config.max; i++) {
                    items += `
                        <button class="rtg-item rtg-numeric-item" 
                                data-value="${i}"
                                role="radio"
                                aria-checked="${i === Math.round(this.state.currentValue)}"
                                aria-label="${this.config.ariaLabels ? this.config.ariaLabels[i-1] : `${i} out of ${this.config.max}`}"
                                type="button"
                                ${this.config.disabled ? 'disabled' : ''}>
                            ${i}
                        </button>
                    `;
                }
                break;

            case 'thumbs':
                // Thumbs mode: up/down voting
                items = `
                    <button class="rtg-item rtg-thumb-item" 
                            data-value="1"
                            role="radio"
                            aria-checked="${this.state.currentValue >= 1}"
                            aria-label="Dislike"
                            type="button"
                            ${this.config.disabled ? 'disabled' : ''}>
                        ${this.config.emojiSet ? this.config.emojiSet[0] : '👎'}
                    </button>
                    <button class="rtg-item rtg-thumb-item" 
                            data-value="2"
                            role="radio"
                            aria-checked="${this.state.currentValue >= 2}"
                            aria-label="Like"
                            type="button"
                            ${this.config.disabled ? 'disabled' : ''}>
                        ${this.config.emojiSet ? this.config.emojiSet[1] : '👍'}
                    </button>
                `;
                break;

            case 'emoji':
            case 'hearts':
                // Emoji/Hearts mode: show emoji characters
                for (let i = 1; i <= this.config.max; i++) {
                    const emoji = this.config.emojiSet ? 
                        this.config.emojiSet[Math.min(i - 1, this.config.emojiSet.length - 1)] : 
                        (this.config.mode === 'hearts' ? '❤️' : '⭐');
                    
                    items += `
                        <button class="rtg-item rtg-emoji-item" 
                                data-value="${i}"
                                role="radio"
                                aria-checked="${i <= Math.ceil(this.state.currentValue)}"
                                aria-label="${i} out of ${this.config.max}"
                                type="button"
                                ${this.config.disabled ? 'disabled' : ''}>
                            <span class="rtg-emoji">${emoji}</span>
                        </button>
                    `;
                }
                break;

            case 'stars':
            default:
                // Default stars mode with half-star support
                for (let i = 1; i <= this.config.max; i++) {
                    items += `
                        <button class="rtg-item rtg-star-item" 
                                data-value="${i}"
                                role="radio"
                                aria-checked="${i <= Math.ceil(this.state.currentValue)}"
                                aria-label="${this.config.ariaLabels ? this.config.ariaLabels[i-1] : `${i} star${i !== 1 ? 's' : ''} out of ${this.config.max}`}"
                                type="button"
                                ${this.config.disabled ? 'disabled' : ''}>
                            <i class="fas ${this.config.emptyIcon} rtg-star-empty" 
                               aria-hidden="true"></i>
                            <i class="fas ${this.config.icon} rtg-star-filled" 
                               aria-hidden="true"></i>
                        </button>
                    `;
                }
                break;
        }

        return items;
    }

    /**
     * Cache all DOM element references after render
     * Avoids repeated querySelector calls for performance
     */
    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.itemsContainer = document.getElementById(`${this.componentId}-items`);
        this.elements.items = Array.from(
            this.elements.itemsContainer?.querySelectorAll('.rtg-item') || []
        );
        this.elements.valueDisplay = document.getElementById(`${this.componentId}-value`);
        this.elements.countDisplay = document.getElementById(`${this.componentId}-count`);
        this.elements.hiddenInput = document.getElementById(`${this.componentId}-hidden`);
    }

    /**
     * Update the visual display of all rating items
     * Handles fill states, hover states, and animations
     */
    updateDisplay() {
        if (!this.elements.items.length) return;

        const displayValue = this.getDisplayValue();

        this.elements.items.forEach((item, index) => {
            const itemValue = parseInt(item.dataset.value) || (index + 1);
            
            // Reset all state classes
            item.classList.remove('rtg-filled', 'rtg-half', 'rtg-hovered', 'rtg-active');

            if (this.config.mode === 'stars') {
                // Star mode: handle full, half, and empty states
                const filledIcon = item.querySelector('.rtg-star-filled');
                const emptyIcon = item.querySelector('.rtg-star-empty');

                if (filledIcon && emptyIcon) {
                    if (itemValue <= Math.floor(displayValue)) {
                        // Fully filled star
                        filledIcon.style.opacity = '1';
                        filledIcon.style.color = this.state.isHovering ? this.config.hoverColor : this.config.color;
                        emptyIcon.style.opacity = '0';
                        item.classList.add('rtg-filled');
                    } else if (this.config.allowHalf && itemValue === Math.ceil(displayValue) && displayValue % 1 !== 0) {
                        // Half-filled star
                        filledIcon.style.opacity = '0.5';
                        filledIcon.style.color = this.state.isHovering ? this.config.hoverColor : this.config.color;
                        emptyIcon.style.opacity = '0.5';
                        item.classList.add('rtg-half');
                    } else {
                        // Empty star
                        filledIcon.style.opacity = '0';
                        emptyIcon.style.opacity = '1';
                        emptyIcon.style.color = this.config.inactiveColor;
                    }
                }
            } else if (this.config.mode === 'emoji' || this.config.mode === 'hearts') {
                // Emoji/Hearts mode
                if (itemValue <= Math.ceil(displayValue)) {
                    item.classList.add('rtg-filled');
                    item.style.opacity = itemValue <= Math.floor(displayValue) ? '1' : 
                        (this.config.allowHalf && itemValue === Math.ceil(displayValue) && displayValue % 1 !== 0 ? '0.5' : '1');
                } else {
                    item.classList.remove('rtg-filled');
                    item.style.opacity = '0.35';
                }
            } else if (this.config.mode === 'numeric') {
                // Numeric mode
                if (itemValue <= Math.round(displayValue)) {
                    item.classList.add('rtg-filled');
                } else {
                    item.classList.remove('rtg-filled');
                }
            } else if (this.config.mode === 'thumbs') {
                // Thumbs mode
                if (itemValue <= displayValue) {
                    item.classList.add('rtg-filled');
                } else {
                    item.classList.remove('rtg-filled');
                }
            }

            // Add hovered class for items at or below hover value
            if (this.state.isHovering && this.state.hoverValue !== null) {
                if (itemValue <= this.state.hoverValue) {
                    item.classList.add('rtg-hovered');
                }
            }

            // Update ARIA checked state
            item.setAttribute('aria-checked', 
                (itemValue <= Math.ceil(displayValue)).toString()
            );
        });

        // Update value display text
        if (this.elements.valueDisplay) {
            this.elements.valueDisplay.textContent = displayValue.toFixed(this.config.precision);
        }

        // Update hidden input value
        if (this.elements.hiddenInput) {
            this.elements.hiddenInput.value = this.state.currentValue;
        }
    }

    /**
     * Set the rating value programmatically
     * @param {number} value - New rating value
     * @param {boolean} [silent=false] - If true, don't trigger callbacks
     */
    setValue(value, silent = false) {
        // Validate and clamp value
        let newValue = parseFloat(value) || 0;
        newValue = Math.max(0, Math.min(this.config.max, newValue));
        
        // Round to nearest valid step
        if (this.config.step > 0) {
            newValue = Math.round(newValue / this.config.step) * this.config.step;
        }

        // Check if value actually changed
        if (newValue === this.state.currentValue) return;

        // Update state
        const oldValue = this.state.currentValue;
        this.state.currentValue = newValue;
        this.state.hasRated = newValue > 0;

        // Update visual display
        this.updateDisplay();

        // Track performance
        this.performance.interactionCount++;
        this.performance.lastInteraction = new Date();

        // Fire change callback if not silent
        if (!silent && this.config.onChange) {
            this.config.onChange({
                value: newValue,
                oldValue: oldValue,
                max: this.config.max,
                componentId: this.componentId
            });
        }

        // Emit event
        EventBus.emit('rating:changed', {
            componentId: this.componentId,
            value: newValue,
            oldValue: oldValue,
            max: this.config.max
        });

        console.log(`[Rating] Value changed: ${oldValue} → ${newValue}`);
    }

    /**
     * Clear/reset the rating to zero
     */
    clear() {
        const oldValue = this.state.currentValue;
        this.state.currentValue = 0;
        this.state.hasRated = false;
        this.state.hoverValue = null;
        this.state.isHovering = false;

        this.updateDisplay();

        if (this.config.onClear) {
            this.config.onClear({ oldValue, componentId: this.componentId });
        }

        if (this.config.onChange) {
            this.config.onChange({
                value: 0, oldValue, max: this.config.max,
                cleared: true, componentId: this.componentId
            });
        }

        EventBus.emit('rating:cleared', {
            componentId: this.componentId,
            oldValue
        });
    }

    /**
     * Submit the current rating to the server
     * @async
     */
    async submit() {
        if (this.state.isSubmitting) return;

        try {
            this.state.isSubmitting = true;
            
            // Update UI to show submitting state
            this.elements.wrapper?.classList.add('rtg-submitting');

            if (this.config.onSubmit) {
                await this.config.onSubmit({
                    value: this.state.currentValue,
                    max: this.config.max,
                    componentId: this.componentId
                });
            }

            console.log(`[Rating] Submitted value: ${this.state.currentValue}`);

            EventBus.emit('rating:submitted', {
                componentId: this.componentId,
                value: this.state.currentValue
            });

        } catch (error) {
            console.error('[Rating] Submit failed:', error);
        } finally {
            this.state.isSubmitting = false;
            this.elements.wrapper?.classList.remove('rtg-submitting');
        }
    }

    /**
     * Get the current rating value
     * @returns {number} Current rating value
     */
    getValue() {
        return this.state.currentValue;
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    /**
     * Handle mouse movement over rating items
     * Calculates precise value based on mouse position for half-star support
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        if (!this.config.interactive || this.config.readOnly || this.config.disabled) return;

        const item = e.target.closest('.rtg-item');
        if (!item) return;

        const itemValue = parseInt(item.dataset.value) || 1;
        let preciseValue = itemValue;

        // Handle half-star precision based on mouse position within the item
        if (this.config.allowHalf && this.config.mode === 'stars') {
            const rect = item.getBoundingClientRect();
            const xPosition = e.clientX - rect.left;
            const isLeftHalf = xPosition < rect.width / 2;
            
            if (isLeftHalf) {
                preciseValue = itemValue - 0.5;
            }
        }

        // Only update if value changed
        if (preciseValue !== this.state.hoverValue) {
            this.state.hoverValue = preciseValue;
            this.state.isHovering = true;
            this.updateDisplay();

            // Show tooltip
            if (this.config.showTooltip) {
                this.showTooltip(e, preciseValue);
            }

            // Fire hover callback
            if (this.config.onHover) {
                this.config.onHover({
                    value: preciseValue,
                    componentId: this.componentId
                });
            }
        }
    }

    /**
     * Handle mouse leaving the rating component
     * Resets hover state and hides tooltip
     */
    handleMouseLeave() {
        if (!this.config.interactive || this.config.readOnly || this.config.disabled) return;

        this.state.isHovering = false;
        this.state.hoverValue = null;
        this.updateDisplay();
        this.hideTooltip();
    }

    /**
     * Handle click on a rating item
     * Sets the final rating value
     * @param {MouseEvent} e - Click event
     */
    handleClick(e) {
        if (!this.config.interactive || this.config.readOnly || this.config.disabled) return;

        const item = e.target.closest('.rtg-item');
        if (!item) return;

        const itemValue = parseInt(item.dataset.value) || 1;
        let finalValue = itemValue;

        // Handle half-star click precision
        if (this.config.allowHalf && this.config.mode === 'stars') {
            const rect = item.getBoundingClientRect();
            const xPosition = e.clientX - rect.left;
            const isLeftHalf = xPosition < rect.width / 2;
            
            if (isLeftHalf) {
                finalValue = itemValue - 0.5;
            }
        }

        // Handle clearable: clicking same value again clears it
        if (this.config.clearable && finalValue === this.state.currentValue) {
            this.clear();
            return;
        }

        // Set the new value
        this.setValue(finalValue);

        // Trigger animation on the selected item
        if (this.config.animation && item) {
            this.animateSelection(item);
        }
    }

    /**
     * Handle keyboard navigation for accessibility
     * Supports Arrow keys, Home, End, and number keys
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        if (!this.config.interactive || this.config.readOnly || this.config.disabled) return;

        let newValue = this.state.currentValue;
        const step = this.config.allowHalf ? 0.5 : 1;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                newValue = Math.min(this.config.max, newValue + step);
                break;

            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                newValue = Math.max(0, newValue - step);
                break;

            case 'Home':
                e.preventDefault();
                newValue = 0;
                break;

            case 'End':
                e.preventDefault();
                newValue = this.config.max;
                break;

            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9': case '0':
                e.preventDefault();
                const numValue = parseInt(e.key);
                if (numValue >= 0 && numValue <= this.config.max) {
                    newValue = numValue === 0 ? this.config.max : numValue;
                }
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                this.submit();
                return;

            case 'Escape':
                e.preventDefault();
                this.clear();
                return;

            default:
                return;
        }

        // Apply the new value
        if (newValue !== this.state.currentValue) {
            this.setValue(newValue);
        }
    }

    /**
     * Handle touch start for mobile devices
     * @param {TouchEvent} e - Touch event
     */
    handleTouchStart(e) {
        if (!this.config.interactive || this.config.readOnly || this.config.disabled) return;

        this.state.isTouching = true;
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchCurrentX = this.state.touchStartX;

        // Process initial touch position
        this.processTouchPosition(e.touches[0].clientX);
    }

    /**
     * Handle touch move for mobile drag selection
     * @param {TouchEvent} e - Touch event
     */
    handleTouchMove(e) {
        if (!this.state.isTouching) return;
        e.preventDefault();

        this.state.touchCurrentX = e.touches[0].clientX;
        this.processTouchPosition(e.touches[0].clientX);
    }

    /**
     * Handle touch end
     * Finalizes the rating selection
     */
    handleTouchEnd() {
        if (!this.state.isTouching) return;

        this.state.isTouching = false;

        // Set final value from hover state
        if (this.state.hoverValue !== null) {
            this.setValue(this.state.hoverValue);
        }

        this.state.isHovering = false;
        this.state.hoverValue = null;
        this.updateDisplay();
        this.hideTooltip();
    }

    /**
     * Process touch position to determine rating value
     * @param {number} clientX - X position of touch
     */
    processTouchPosition(clientX) {
        const itemsContainer = this.elements.itemsContainer;
        if (!itemsContainer) return;

        const containerRect = itemsContainer.getBoundingClientRect();
        const relativeX = clientX - containerRect.left;
        const itemWidth = containerRect.offsetWidth / this.config.max;
        
        let value = Math.ceil(relativeX / itemWidth);
        value = Math.max(0, Math.min(this.config.max, value));

        // Handle half-star for touch
        if (this.config.allowHalf && this.config.mode === 'stars') {
            const positionInItem = relativeX % itemWidth;
            if (positionInItem < itemWidth / 2 && value > 0) {
                value = value - 0.5;
            }
        }

        if (value !== this.state.hoverValue) {
            this.state.hoverValue = value;
            this.state.isHovering = true;
            this.updateDisplay();
        }
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    /**
     * Show tooltip with rating label
     * @param {MouseEvent} e - Mouse event for positioning
     * @param {number} value - Rating value for tooltip text
     */
    showTooltip(e, value) {
        // Remove existing tooltip
        this.hideTooltip();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = `${this.componentId}-tooltip`;
        tooltip.className = 'rtg-tooltip';
        tooltip.textContent = this.getTooltipText(value);
        tooltip.setAttribute('role', 'tooltip');

        // Position tooltip near the mouse cursor
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 40}px`;

        // Add to DOM
        document.body.appendChild(tooltip);
        this.elements.tooltip = tooltip;
    }

    /**
     * Hide and remove the tooltip element
     */
    hideTooltip() {
        if (this.elements.tooltip) {
            this.elements.tooltip.remove();
            this.elements.tooltip = null;
        }
    }

    /**
     * Animate a rating item on selection
     * Creates a brief scale/bounce effect
     * @param {HTMLElement} item - The rating item to animate
     */
    animateSelection(item) {
        if (this.state.animationPlaying) return;

        this.state.animationPlaying = true;

        // Add animation class
        item.classList.add('rtg-animate-select');

        // Remove animation class after completion
        setTimeout(() => {
            item.classList.remove('rtg-animate-select');
            this.state.animationPlaying = false;
        }, this.config.animationDuration);
    }

    /**
     * Format large count numbers for display
     * @param {number} count - The count to format
     * @returns {string} Formatted count string
     */
    formatCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        }
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }

    // ============================================================
    // EVENT BINDING
    // ============================================================

    /**
     * Bind all event handlers to the component
     * Uses both direct element events and event delegation
     */
    bindEvents() {
        try {
            const wrapper = this.elements.wrapper;
            const itemsContainer = this.elements.itemsContainer;

            if (!itemsContainer) {
                console.warn('[Rating] Items container not found for event binding');
                return;
            }

            // Mouse events on items container (event delegation)
            itemsContainer.addEventListener('mousemove', this.handleMouseMove);
            itemsContainer.addEventListener('mouseleave', this.handleMouseLeave);
            itemsContainer.addEventListener('click', this.handleClick);

            // Touch events for mobile support
            if (this.config.interactive && !this.config.readOnly) {
                itemsContainer.addEventListener('touchstart', this.handleTouchStart, { passive: true });
                itemsContainer.addEventListener('touchmove', this.handleTouchMove, { passive: false });
                itemsContainer.addEventListener('touchend', this.handleTouchEnd);
            }

            // Keyboard events on wrapper
            if (wrapper && this.config.interactive && !this.config.readOnly) {
                wrapper.addEventListener('keydown', this.handleKeyDown);
            }

            console.log('[Rating] Event handlers bound successfully');

        } catch (error) {
            console.error('[Rating] Event binding failed:', error);
        }
    }

    /**
     * Unbind all event handlers for cleanup
     */
    unbindEvents() {
        const itemsContainer = this.elements.itemsContainer;
        const wrapper = this.elements.wrapper;

        if (itemsContainer) {
            itemsContainer.removeEventListener('mousemove', this.handleMouseMove);
            itemsContainer.removeEventListener('mouseleave', this.handleMouseLeave);
            itemsContainer.removeEventListener('click', this.handleClick);
            itemsContainer.removeEventListener('touchstart', this.handleTouchStart);
            itemsContainer.removeEventListener('touchmove', this.handleTouchMove);
            itemsContainer.removeEventListener('touchend', this.handleTouchEnd);
        }

        if (wrapper) {
            wrapper.removeEventListener('keydown', this.handleKeyDown);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML-safe text
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
     * Removes event listeners, DOM elements, and tooltips
     */
    destroy() {
        try {
            // Unbind all events
            this.unbindEvents();

            // Remove tooltip if present
            this.hideTooltip();

            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }

            // Clear element references
            this.elements.items = [];
            this.elements.wrapper = null;
            this.elements.itemsContainer = null;
            this.elements.valueDisplay = null;
            this.elements.countDisplay = null;
            this.elements.hiddenInput = null;

            // Remove from global instance registry
            if (window.Global?.Rating?.instances) {
                window.Global.Rating.instances.delete(this.componentId);
            }

            console.log('[Rating] Component destroyed successfully');
        } catch (error) {
            console.error('[Rating] Destroy failed:', error);
        }
    }

    /**
     * Static factory method for creating rating instances
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration options
     * @returns {Rating} New Rating instance
     */
    static create(container, options) {
        const instance = new Rating(container, options);
        
        // Ensure global registry exists
        if (!window.Global) window.Global = {};
        if (!window.Global.Rating) window.Global.Rating = {};
        if (!window.Global.Rating.instances) window.Global.Rating.instances = new Map();
        
        // Register instance
        window.Global.Rating.instances.set(instance.componentId, instance);
        
        return instance;
    }

    /**
     * Get instance by component ID
     * @param {string} componentId - The component ID to find
     * @returns {Rating|null} Found instance or null
     */
    static getInstance(componentId) {
        return window.Global?.Rating?.instances?.get(componentId) || null;
    }
}

// ES Module export
export { Rating };
export default Rating;

// Global scope registration for non-module usage
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Rating = window.Global.Rating || {};
    window.Global.Rating.instances = window.Global.Rating.instances || new Map();
    window.Global.Rating.Rating = Rating;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
