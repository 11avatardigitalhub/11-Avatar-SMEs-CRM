/* ==========================================
   11 AVATAR DIGITAL HUB
   Toast Notification Component
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Non-blocking toast notifications
   - Success, Error, Warning, Info types
   - Auto-dismiss with configurable duration
   - Stackable toasts (multiple visible)
   - Custom actions within toasts
   - Progress bar indicator
   - Pause on hover
   - Swipe to dismiss (mobile)
   - Sound alerts
   - Queue management
   - Position configuration
   ========================================== */

const Toast = {
    
    // ==========================================
    // CONFIGURATION
    // ==========================================
    
    _config: {
        position: 'bottom-right',
        maxVisible: 5,
        duration: 4000,
        animationDuration: 350,
        showProgress: true,
        pauseOnHover: true,
        showCloseButton: true,
        showIcon: true,
        sound: false,
        swipeToDismiss: true,
        container: null
    },
    
    _queue: [],
    _activeToasts: [],
    _container: null,
    _counter: 0,
    
    // ==========================================
    // POSITION PRESETS
    // ==========================================
    
    _positions: {
        'top-left': { top: '24px', left: '24px', flexDirection: 'column' },
        'top-center': { top: '24px', left: '50%', transform: 'translateX(-50%)', flexDirection: 'column' },
        'top-right': { top: '24px', right: '24px', flexDirection: 'column' },
        'bottom-left': { bottom: '24px', left: '24px', flexDirection: 'column-reverse' },
        'bottom-center': { bottom: '24px', left: '50%', transform: 'translateX(-50%)', flexDirection: 'column-reverse' },
        'bottom-right': { bottom: '24px', right: '24px', flexDirection: 'column-reverse' }
    },
    
    // ==========================================
    // ICONS & COLORS
    // ==========================================
    
    _typeConfig: {
        success: {
            icon: '✅',
            borderColor: '#10B981',
            bgColor: 'rgba(16,185,129,0.06)',
            textColor: '#059669',
            sound: 'success'
        },
        error: {
            icon: '❌',
            borderColor: '#EF4444',
            bgColor: 'rgba(239,68,68,0.06)',
            textColor: '#DC2626',
            sound: 'error'
        },
        warning: {
            icon: '⚠️',
            borderColor: '#F59E0B',
            bgColor: 'rgba(245,158,11,0.06)',
            textColor: '#D97706',
            sound: 'warning'
        },
        info: {
            icon: 'ℹ️',
            borderColor: '#D4AF37',
            bgColor: 'rgba(212,175,55,0.06)',
            textColor: '#B8960F',
            sound: 'info'
        },
        loading: {
            icon: '⏳',
            borderColor: '#3B82F6',
            bgColor: 'rgba(59,130,246,0.06)',
            textColor: '#2563EB',
            sound: null
        }
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    /**
     * Initialize toast system
     * @param {Object} config - Configuration overrides
     */
    init(config = {}) {
        Object.assign(this._config, config);
        
        // Create container
        this._createContainer();
        
        // Add global styles
        this._injectStyles();
        
        console.log('🔔 Toast system initialized');
    },
    
    /**
     * Create toast container element
     * @private
     */
    _createContainer() {
        if (this._container) return;
        
        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        this._container.setAttribute('aria-live', 'polite');
        this._container.setAttribute('aria-atomic', 'false');
        this._container.setAttribute('role', 'status');
        
        this._applyPosition();
        
        document.body.appendChild(this._container);
    },
    
    /**
     * Apply position styles to container
     * @private
     */
    _applyPosition() {
        const pos = this._positions[this._config.position] || this._positions['bottom-right'];
        Object.assign(this._container.style, {
            position: 'fixed',
            zIndex: '9999',
            display: 'flex',
            gap: '10px',
            maxWidth: '420px',
            width: 'calc(100% - 48px)',
            pointerEvents: 'none',
            ...pos
        });
    },
    
    /**
     * Inject required CSS styles
     * @private
     */
    _injectStyles() {
        if (document.getElementById('toast-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast-item {
                background: #FFFFFF;
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                font-size: 0.9rem;
                font-weight: 500;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                pointer-events: auto;
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                animation: toastSlideIn 0.35s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                position: relative;
                overflow: hidden;
                cursor: pointer;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            .toast-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 36px rgba(0,0,0,0.16);
            }
            .toast-item.removing {
                animation: toastSlideOut 0.3s ease forwards;
            }
            .toast-icon {
                font-size: 1.3rem;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .toast-content {
                flex: 1;
                min-width: 0;
                line-height: 1.5;
            }
            .toast-title {
                font-weight: 600;
                font-size: 0.9rem;
                margin-bottom: 2px;
            }
            .toast-message {
                font-size: 0.85rem;
                color: #666;
            }
            .toast-close {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: none;
                background: rgba(0,0,0,0.05);
                cursor: pointer;
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #999;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }
            .toast-close:hover {
                background: rgba(0,0,0,0.1);
                color: #666;
            }
            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                border-radius: 0 0 0 16px;
                transition: width 0.1s linear;
            }
            .toast-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }
            .toast-action-btn {
                padding: 6px 14px;
                border-radius: 20px;
                border: 1px solid rgba(0,0,0,0.1);
                background: transparent;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .toast-action-btn:hover {
                background: rgba(0,0,0,0.04);
            }
            @keyframes toastSlideIn {
                from { opacity: 0; transform: translateX(30px) scale(0.9); }
                to { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes toastSlideOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(50px); }
            }
            @keyframes toastSlideInTop {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(styles);
    },
    
    // ==========================================
    // SHOW TOAST
    // ==========================================
    
    /**
     * Show a success toast
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    },
    
    /**
     * Show an error toast
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    },
    
    /**
     * Show a warning toast
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    },
    
    /**
     * Show an info toast
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    },
    
    /**
     * Show a loading toast (no auto-dismiss)
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    loading(message, options = {}) {
        return this.show(message, { ...options, type: 'loading', duration: 0 });
    },
    
    /**
     * Main show method
     * @param {string} message - Toast message
     * @param {Object} options - Toast options
     * @returns {string} Toast ID
     */
    show(message, options = {}) {
        const {
            type = 'info',
            title = '',
            duration = this._config.duration,
            showProgress = this._config.showProgress,
            showCloseButton = this._config.showCloseButton,
            showIcon = this._config.showIcon,
            pauseOnHover = this._config.pauseOnHover,
            actions = [],
            onClick = null,
            onClose = null,
            id = null
        } = options;
        
        const toastId = id || `toast_${++this._counter}_${Date.now()}`;
        const typeConfig = this._typeConfig[type] || this._typeConfig.info;
        
        // Check max visible limit
        if (this._activeToasts.length >= this._config.maxVisible) {
            const oldest = this._activeToasts.shift();
            this._dismissToast(oldest.id, true);
        }
        
        // Build toast element
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.style.borderLeft = `4px solid ${typeConfig.borderColor}`;
        toast.style.background = typeConfig.bgColor;
        
        // Icon
        let iconHTML = '';
        if (showIcon && typeConfig.icon) {
            iconHTML = `<span class="toast-icon">${typeConfig.icon}</span>`;
        }
        
        // Title
        let titleHTML = '';
        if (title) {
            titleHTML = `<div class="toast-title" style="color:${typeConfig.textColor}">${title}</div>`;
        }
        
        // Actions
        let actionsHTML = '';
        if (actions.length > 0) {
            actionsHTML = `
                <div class="toast-actions">
                    ${actions.map((action, i) => `
                        <button class="toast-action-btn" data-action-index="${i}" style="color:${typeConfig.textColor};border-color:${typeConfig.borderColor}">
                            ${action.label}
                        </button>
                    `).join('')}
                </div>
            `;
        }
        
        toast.innerHTML = `
            ${iconHTML}
            <div class="toast-content">
                ${titleHTML}
                <div class="toast-message">${message}</div>
                ${actionsHTML}
            </div>
            ${showCloseButton ? '<button class="toast-close" aria-label="Dismiss">✕</button>' : ''}
            ${showProgress && duration > 0 ? '<div class="toast-progress" style="background:' + typeConfig.borderColor + ';width:100%"></div>' : ''}
        `;
        
        // Append to container
        this._container.appendChild(toast);
        
        // Store toast info
        const toastInfo = {
            id: toastId,
            element: toast,
            type,
            duration,
            timer: null,
            progressTimer: null,
            remaining: duration,
            startTime: Date.now(),
            paused: false,
            onClose
        };
        
        this._activeToasts.push(toastInfo);
        
        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._dismissToast(toastId);
        });
        
        // Click handler
        if (onClick) {
            toast.addEventListener('click', () => onClick(toastId));
        }
        
        // Action buttons
        const actionBtns = toast.querySelectorAll('.toast-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.actionIndex);
                if (actions[index] && actions[index].onClick) {
                    actions[index].onClick(toastId);
                }
                if (actions[index] && actions[index].closeOnAction !== false) {
                    this._dismissToast(toastId);
                }
            });
        });
        
        // Pause on hover
        if (pauseOnHover) {
            toast.addEventListener('mouseenter', () => this._pauseToast(toastId));
            toast.addEventListener('mouseleave', () => this._resumeToast(toastId));
        }
        
        // Swipe to dismiss (mobile)
        if (this._config.swipeToDismiss) {
            this._addSwipeSupport(toast, toastId);
        }
        
        // Auto-dismiss timer
        if (duration > 0) {
            this._startTimer(toastId, duration);
        }
        
        // Play sound
        if (this._config.sound && typeConfig.sound) {
            this._playSound(typeConfig.sound);
        }
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('toast:show', { id: toastId, type, message });
        }
        
        return toastId;
    },
    
    // ==========================================
    // DISMISS TOAST
    // ==========================================
    
    /**
     * Dismiss a specific toast
     * @param {string} toastId - Toast ID
     * @param {boolean} immediate - Skip animation
     */
    dismiss(toastId, immediate = false) {
        this._dismissToast(toastId, immediate);
    },
    
    /**
     * Dismiss all toasts
     */
    dismissAll() {
        const ids = this._activeToasts.map(t => t.id);
        ids.forEach(id => this._dismissToast(id, true));
    },
    
    /**
     * Internal dismiss method
     * @private
     */
    _dismissToast(toastId, immediate = false) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo) return;
        
        // Clear timers
        this._clearTimers(toastId);
        
        // Remove from active list
        this._activeToasts = this._activeToasts.filter(t => t.id !== toastId);
        
        const { element, onClose } = toastInfo;
        
        if (immediate) {
            element.remove();
        } else {
            element.classList.add('removing');
            setTimeout(() => {
                if (element.parentNode) {
                    element.remove();
                }
            }, this._config.animationDuration);
        }
        
        // Callback
        if (typeof onClose === 'function') {
            onClose(toastId);
        }
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('toast:dismiss', { id: toastId });
        }
    },
    
    // ==========================================
    // TIMER MANAGEMENT
    // ==========================================
    
    /**
     * Start auto-dismiss timer
     * @private
     */
    _startTimer(toastId, duration) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo) return;
        
        // Progress bar animation
        const progressBar = toastInfo.element.querySelector('.toast-progress');
        if (progressBar) {
            const updateInterval = 50;
            const totalSteps = duration / updateInterval;
            let currentStep = 0;
            
            toastInfo.progressTimer = setInterval(() => {
                currentStep++;
                const percent = 100 - (currentStep / totalSteps * 100);
                progressBar.style.width = percent + '%';
            }, updateInterval);
        }
        
        // Dismiss timer
        toastInfo.timer = setTimeout(() => {
            this._dismissToast(toastId);
        }, duration);
    },
    
    /**
     * Pause toast timer (on hover)
     * @private
     */
    _pauseToast(toastId) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo || toastInfo.paused) return;
        
        toastInfo.paused = true;
        
        // Clear timers
        this._clearTimers(toastId);
        
        // Calculate remaining time
        const elapsed = Date.now() - toastInfo.startTime;
        toastInfo.remaining = Math.max(0, toastInfo.duration - elapsed);
        
        // Pause progress bar
        const progressBar = toastInfo.element.querySelector('.toast-progress');
        if (progressBar) {
            progressBar.style.animationPlayState = 'paused';
        }
    },
    
    /**
     * Resume toast timer (mouse leave)
     * @private
     */
    _resumeToast(toastId) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo || !toastInfo.paused) return;
        
        toastInfo.paused = false;
        toastInfo.startTime = Date.now();
        
        // Restart timer with remaining time
        if (toastInfo.remaining > 0) {
            this._startTimer(toastId, toastInfo.remaining);
        }
    },
    
    /**
     * Clear all timers for a toast
     * @private
     */
    _clearTimers(toastId) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo) return;
        
        if (toastInfo.timer) {
            clearTimeout(toastInfo.timer);
            toastInfo.timer = null;
        }
        
        if (toastInfo.progressTimer) {
            clearInterval(toastInfo.progressTimer);
            toastInfo.progressTimer = null;
        }
    },
    
    // ==========================================
    // SWIPE SUPPORT
    // ==========================================
    
    /**
     * Add swipe to dismiss for mobile
     * @private
     */
    _addSwipeSupport(element, toastId) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        element.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            
            if (Math.abs(diffX) > 10) {
                element.style.transform = `translateX(${diffX}px)`;
                element.style.opacity = `${1 - Math.abs(diffX) / 200}`;
            }
        }, { passive: true });
        
        element.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diffX = currentX - startX;
            
            if (Math.abs(diffX) > 100) {
                this._dismissToast(toastId, true);
            } else {
                element.style.transform = '';
                element.style.opacity = '';
            }
        });
    },
    
    // ==========================================
    // SOUND
    // ==========================================
    
    /**
     * Play notification sound
     * @private
     */
    _playSound(type) {
        // Web Audio API for simple beep sounds
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Different frequencies for different types
            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 1000
            };
            
            oscillator.frequency.value = frequencies[type] || 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            oscillator.stop(ctx.currentTime + 0.3);
        } catch (e) {
            // Silently fail - sound is optional
        }
    },
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Update an existing toast
     * @param {string} toastId - Toast ID
     * @param {string} message - New message
     * @param {string} type - New type
     */
    update(toastId, message, type = null) {
        const toastInfo = this._activeToasts.find(t => t.id === toastId);
        if (!toastInfo) return;
        
        const msgEl = toastInfo.element.querySelector('.toast-message');
        if (msgEl) {
            msgEl.textContent = message;
        }
        
        if (type) {
            const typeConfig = this._typeConfig[type];
            if (typeConfig) {
                toastInfo.element.style.borderLeft = `4px solid ${typeConfig.borderColor}`;
                toastInfo.element.style.background = typeConfig.bgColor;
                
                const iconEl = toastInfo.element.querySelector('.toast-icon');
                if (iconEl) {
                    iconEl.textContent = typeConfig.icon;
                }
            }
        }
    },
    
    /**
     * Check if toast exists
     * @param {string} toastId - Toast ID
     * @returns {boolean}
     */
    exists(toastId) {
        return this._activeToasts.some(t => t.id === toastId);
    },
    
    /**
     * Get count of active toasts
     * @returns {number}
     */
    getCount() {
        return this._activeToasts.length;
    },
    
    /**
     * Set global configuration
     * @param {Object} config - New configuration
     */
    configure(config = {}) {
        Object.assign(this._config, config);
        
        if (config.position) {
            this._applyPosition();
        }
    },
    
    /**
     * Destroy toast system
     */
    destroy() {
        this.dismissAll();
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._container = null;
        this._activeToasts = [];
        this._queue = [];
    }
};

// ==========================================
// SHORTCUT GLOBAL FUNCTION
// ==========================================
if (typeof window !== 'undefined') {
    window.toast = function(message, type = 'info', options = {}) {
        return Toast.show(message, { ...options, type });
    };
    window.toast.success = Toast.success.bind(Toast);
    window.toast.error = Toast.error.bind(Toast);
    window.toast.warning = Toast.warning.bind(Toast);
    window.toast.info = Toast.info.bind(Toast);
}

// ==========================================
// AUTO-INITIALIZE
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Toast.init());
} else {
    Toast.init();
}

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Toast = Toast;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}

// ==========================================
// END OF TOAST COMPONENT
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
