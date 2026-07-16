/* ==========================================
   11 AVATAR DIGITAL HUB
   Modal Dialog Component
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Reusable modal dialog system
   - Alert, Confirm, Prompt dialogs
   - Form modals
   - Full-screen modals
   - Stacked modals
   - Animated transitions
   - Keyboard navigation (Escape, Tab trap)
   - Focus management
   - Backdrop click handling
   - Scroll locking
   - ARIA accessibility
   ========================================== */

const Modal = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _modals: [],
    _activeModal: null,
    _originalFocus: null,
    _overlay: null,
    _isOpen: false,
    _config: {
        closeOnEscape: true,
        closeOnBackdrop: true,
        showCloseButton: true,
        animation: true,
        animationDuration: 300,
        trapFocus: true,
        lockScroll: true,
        aria: true
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    /**
     * Initialize modal system
     */
    init() {
        // Create overlay element if not exists
        if (!this._overlay) {
            this._overlay = document.createElement('div');
            this._overlay.className = 'modal-overlay';
            this._overlay.setAttribute('aria-hidden', 'true');
            this._overlay.setAttribute('role', 'dialog');
            this._overlay.style.display = 'none';
            document.body.appendChild(this._overlay);
            
            // Click backdrop to close
            this._overlay.addEventListener('click', (e) => {
                if (e.target === this._overlay && this._config.closeOnBackdrop) {
                    this.close();
                }
            });
        }
        
        // Global Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen && this._config.closeOnEscape) {
                const topModal = this._modals[this._modals.length - 1];
                if (topModal && topModal.options.closeOnEscape !== false) {
                    this.close();
                }
            }
            
            // Tab trap
            if (e.key === 'Tab' && this._isOpen && this._config.trapFocus) {
                this._trapFocus(e);
            }
        });
        
        console.log('🪟 Modal system initialized');
    },
    
    // ==========================================
    // OPEN MODAL
    // ==========================================
    
    /**
     * Open a modal dialog
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string|Element} options.content - HTML content or DOM element
     * @param {string} options.size - Modal size ('sm', 'md', 'lg', 'xl', 'full')
     * @param {boolean} options.closeOnEscape - Close on Escape key
     * @param {boolean} options.closeOnBackdrop - Close on backdrop click
     * @param {boolean} options.showCloseButton - Show close button
     * @param {Function} options.onOpen - Callback when modal opens
     * @param {Function} options.onClose - Callback when modal closes
     * @param {Object} options.data - Custom data to pass
     * @returns {HTMLElement} Modal element
     */
    open(options = {}) {
        const {
            title = '',
            content = '',
            size = 'md',
            closeOnEscape = true,
            closeOnBackdrop = true,
            showCloseButton = true,
            onOpen = null,
            onClose = null,
            data = null,
            footer = null,
            className = ''
        } = options;
        
        // Save original focus
        this._originalFocus = document.activeElement;
        
        // Lock scroll
        if (this._config.lockScroll) {
            document.body.style.overflow = 'hidden';
        }
        
        // Build modal HTML
        const modalElement = this._buildModal({
            title,
            content,
            size,
            showCloseButton,
            footer,
            className
        });
        
        // Set overlay content
        this._overlay.innerHTML = '';
        this._overlay.appendChild(modalElement);
        
        // Show overlay
        this._overlay.style.display = 'flex';
        this._overlay.setAttribute('aria-hidden', 'false');
        
        // Add to stack
        this._modals.push({
            element: modalElement,
            options: options
        });
        
        // Set active
        this._activeModal = modalElement;
        this._isOpen = true;
        
        // Animate in
        if (this._config.animation) {
            requestAnimationFrame(() => {
                this._overlay.style.opacity = '1';
            });
        }
        
        // Focus first focusable element
        setTimeout(() => {
            this._focusFirstElement(modalElement);
        }, 100);
        
        // Call onOpen callback
        if (typeof onOpen === 'function') {
            onOpen(modalElement, data);
        }
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('modal:open', { element: modalElement, data });
        }
        
        console.log('🪟 Modal opened:', title || 'Untitled');
        
        return modalElement;
    },
    
    // ==========================================
    // CLOSE MODAL
    // ==========================================
    
    /**
     * Close the topmost modal
     * @param {*} result - Result data to pass to onClose
     */
    close(result = null) {
        if (!this._isOpen || this._modals.length === 0) return;
        
        const modalInfo = this._modals.pop();
        const { element, options } = modalInfo;
        
        // Animate out
        if (this._config.animation) {
            this._overlay.style.opacity = '0';
        }
        
        // Remove after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            
            // If no more modals, hide overlay
            if (this._modals.length === 0) {
                this._overlay.style.display = 'none';
                this._overlay.setAttribute('aria-hidden', 'true');
                this._isOpen = false;
                this._activeModal = null;
                
                // Unlock scroll
                if (this._config.lockScroll) {
                    document.body.style.overflow = '';
                }
                
                // Restore focus
                if (this._originalFocus && typeof this._originalFocus.focus === 'function') {
                    this._originalFocus.focus();
                }
            } else {
                // Focus previous modal
                const prevModal = this._modals[this._modals.length - 1];
                this._activeModal = prevModal.element;
                this._focusFirstElement(prevModal.element);
            }
        }, this._config.animation ? this._config.animationDuration : 0);
        
        // Call onClose callback
        if (typeof options.onClose === 'function') {
            options.onClose(result);
        }
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('modal:close', { result });
        }
        
        console.log('🪟 Modal closed');
    },
    
    /**
     * Close all open modals
     */
    closeAll() {
        while (this._modals.length > 0) {
            this.close();
        }
    },
    
    // ==========================================
    // CONVENIENCE METHODS
    // ==========================================
    
    /**
     * Show an alert dialog
     * @param {string} message - Alert message
     * @param {Object} options - Modal options
     * @returns {Promise} Resolves when dismissed
     */
    alert(message, options = {}) {
        return new Promise((resolve) => {
            const content = `
                <div style="text-align:center;padding:20px 0">
                    <p style="font-size:1.05rem;color:var(--text-secondary,#333);line-height:1.7;margin-bottom:24px">${message}</p>
                </div>
            `;
            
            const footer = `
                <button class="btn btn-primary" id="modal-alert-ok" style="min-width:120px">OK</button>
            `;
            
            this.open({
                title: options.title || 'Alert',
                content: content,
                size: 'sm',
                footer: footer,
                closeOnBackdrop: false,
                closeOnEscape: false,
                onOpen: (modal) => {
                    const okBtn = modal.querySelector('#modal-alert-ok');
                    if (okBtn) {
                        okBtn.addEventListener('click', () => {
                            this.close();
                            resolve(true);
                        });
                        okBtn.focus();
                    }
                },
                onClose: () => resolve(true)
            });
        });
    },
    
    /**
     * Show a confirm dialog
     * @param {string} message - Confirm message
     * @param {Object} options - Modal options
     * @returns {Promise<boolean>} Resolves true/false
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const content = `
                <div style="text-align:center;padding:20px 0">
                    <p style="font-size:1.05rem;color:var(--text-secondary,#333);line-height:1.7;margin-bottom:24px">${message}</p>
                </div>
            `;
            
            const footer = `
                <button class="btn btn-outline" id="modal-confirm-cancel" style="min-width:100px">Cancel</button>
                <button class="btn btn-primary" id="modal-confirm-ok" style="min-width:100px">Confirm</button>
            `;
            
            this.open({
                title: options.title || 'Confirm',
                content: content,
                size: 'sm',
                footer: footer,
                closeOnBackdrop: false,
                closeOnEscape: false,
                onOpen: (modal) => {
                    const okBtn = modal.querySelector('#modal-confirm-ok');
                    const cancelBtn = modal.querySelector('#modal-confirm-cancel');
                    
                    okBtn?.addEventListener('click', () => {
                        this.close();
                        resolve(true);
                    });
                    
                    cancelBtn?.addEventListener('click', () => {
                        this.close();
                        resolve(false);
                    });
                    
                    cancelBtn?.focus();
                },
                onClose: () => resolve(false)
            });
        });
    },
    
    /**
     * Show a prompt dialog
     * @param {string} message - Prompt message
     * @param {Object} options - Modal options
     * @returns {Promise<string|null>} Resolves with input value or null
     */
    prompt(message, options = {}) {
        return new Promise((resolve) => {
            const content = `
                <div style="padding:10px 0">
                    <p style="font-size:1rem;color:var(--text-secondary,#333);margin-bottom:16px">${message}</p>
                    <input type="text" id="modal-prompt-input" class="form-control" 
                           placeholder="${options.placeholder || ''}" 
                           value="${options.defaultValue || ''}"
                           style="width:100%;padding:12px 16px;border:1.5px solid rgba(0,0,0,0.1);border-radius:12px;font-size:1rem;min-height:48px" />
                </div>
            `;
            
            const footer = `
                <button class="btn btn-outline" id="modal-prompt-cancel" style="min-width:100px">Cancel</button>
                <button class="btn btn-primary" id="modal-prompt-ok" style="min-width:100px">OK</button>
            `;
            
            this.open({
                title: options.title || 'Input Required',
                content: content,
                size: 'sm',
                footer: footer,
                closeOnBackdrop: false,
                closeOnEscape: false,
                onOpen: (modal) => {
                    const input = modal.querySelector('#modal-prompt-input');
                    const okBtn = modal.querySelector('#modal-prompt-ok');
                    const cancelBtn = modal.querySelector('#modal-prompt-cancel');
                    
                    okBtn?.addEventListener('click', () => {
                        const value = input?.value || '';
                        this.close();
                        resolve(value);
                    });
                    
                    cancelBtn?.addEventListener('click', () => {
                        this.close();
                        resolve(null);
                    });
                    
                    // Submit on Enter
                    input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            okBtn?.click();
                        }
                    });
                    
                    setTimeout(() => input?.focus(), 150);
                },
                onClose: () => resolve(null)
            });
        });
    },
    
    /**
     * Show a form modal
     * @param {Object} options - Modal options with form config
     * @returns {Promise<Object|null>} Resolves with form data or null
     */
    form(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Form',
                fields = [],
                submitLabel = 'Submit',
                cancelLabel = 'Cancel',
                initialData = {}
            } = options;
            
            // Build form fields HTML
            const fieldsHTML = fields.map(field => {
                const value = initialData[field.name] || field.value || '';
                
                if (field.type === 'textarea') {
                    return `
                        <div class="form-group-3d">
                            <label>${field.label} ${field.required ? '<span style="color:#EF4444">*</span>' : ''}</label>
                            <textarea id="field-${field.name}" 
                                      placeholder="${field.placeholder || ''}" 
                                      rows="${field.rows || 3}"
                                      ${field.required ? 'required' : ''}
                                      style="width:100%;padding:12px 16px;border:1.5px solid rgba(0,0,0,0.1);border-radius:12px;font-size:0.95rem;min-height:48px;background:#FAFAFA">${value}</textarea>
                        </div>
                    `;
                }
                
                if (field.type === 'select') {
                    const optionsHTML = (field.options || []).map(opt => 
                        `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    
                    return `
                        <div class="form-group-3d">
                            <label>${field.label} ${field.required ? '<span style="color:#EF4444">*</span>' : ''}</label>
                            <select id="field-${field.name}" 
                                    ${field.required ? 'required' : ''}
                                    style="width:100%;padding:12px 16px;border:1.5px solid rgba(0,0,0,0.1);border-radius:12px;font-size:0.95rem;min-height:48px;background:#FAFAFA">
                                ${optionsHTML}
                            </select>
                        </div>
                    `;
                }
                
                return `
                    <div class="form-group-3d">
                        <label>${field.label} ${field.required ? '<span style="color:#EF4444">*</span>' : ''}</label>
                        <input type="${field.type || 'text'}" 
                               id="field-${field.name}" 
                               placeholder="${field.placeholder || ''}" 
                               value="${value}"
                               ${field.required ? 'required' : ''}
                               ${field.min ? `min="${field.min}"` : ''}
                               ${field.max ? `max="${field.max}"` : ''}
                               style="width:100%;padding:12px 16px;border:1.5px solid rgba(0,0,0,0.1);border-radius:12px;font-size:0.95rem;min-height:48px;background:#FAFAFA" />
                    </div>
                `;
            }).join('');
            
            const content = `
                <div style="max-height:60vh;overflow-y:auto;padding-right:4px">
                    ${fieldsHTML}
                </div>
            `;
            
            const footer = `
                <button class="btn btn-outline" id="modal-form-cancel" style="min-width:100px">${cancelLabel}</button>
                <button class="btn btn-primary" id="modal-form-submit" style="min-width:120px">${submitLabel}</button>
            `;
            
            this.open({
                title: title,
                content: content,
                size: 'md',
                footer: footer,
                closeOnBackdrop: false,
                closeOnEscape: true,
                onOpen: (modal) => {
                    const submitBtn = modal.querySelector('#modal-form-submit');
                    const cancelBtn = modal.querySelector('#modal-form-cancel');
                    
                    submitBtn?.addEventListener('click', () => {
                        const formData = {};
                        let isValid = true;
                        
                        fields.forEach(field => {
                            const input = modal.querySelector(`#field-${field.name}`);
                            if (input) {
                                formData[field.name] = input.value;
                                
                                if (field.required && !input.value.trim()) {
                                    input.style.borderColor = '#EF4444';
                                    isValid = false;
                                }
                            }
                        });
                        
                        if (isValid) {
                            this.close();
                            resolve(formData);
                        }
                    });
                    
                    cancelBtn?.addEventListener('click', () => {
                        this.close();
                        resolve(null);
                    });
                    
                    // Focus first field
                    const firstField = modal.querySelector('input, select, textarea');
                    setTimeout(() => firstField?.focus(), 150);
                },
                onClose: () => resolve(null)
            });
        });
    },
    
    // ==========================================
    // INTERNAL METHODS
    // ==========================================
    
    /**
     * Build modal DOM element
     * @private
     */
    _buildModal(options) {
        const {
            title,
            content,
            size,
            showCloseButton,
            footer,
            className
        } = options;
        
        const modal = document.createElement('div');
        modal.className = `modal modal-${size} ${className}`.trim();
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');
        
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'modal-title';
        titleEl.id = 'modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
        
        if (showCloseButton) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.innerHTML = '✕';
            closeBtn.setAttribute('aria-label', 'Close modal');
            closeBtn.addEventListener('click', () => this.close());
            header.appendChild(closeBtn);
        }
        
        modal.appendChild(header);
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof Element) {
            body.appendChild(content);
        }
        modal.appendChild(body);
        
        // Footer
        if (footer) {
            const footerEl = document.createElement('div');
            footerEl.className = 'modal-footer';
            if (typeof footer === 'string') {
                footerEl.innerHTML = footer;
            } else if (footer instanceof Element) {
                footerEl.appendChild(footer);
            }
            modal.appendChild(footerEl);
        }
        
        return modal;
    },
    
    /**
     * Focus first focusable element in modal
     * @private
     */
    _focusFirstElement(modal) {
        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = modal.querySelectorAll(focusableSelector);
        
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    },
    
    /**
     * Trap focus within modal (Tab key)
     * @private
     */
    _trapFocus(event) {
        if (!this._activeModal) return;
        
        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = this._activeModal.querySelectorAll(focusableSelector);
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    },
    
    // ==========================================
    // STATE METHODS
    // ==========================================
    
    /**
     * Check if any modal is open
     * @returns {boolean}
     */
    isOpen() {
        return this._isOpen;
    },
    
    /**
     * Get currently active modal element
     * @returns {HTMLElement|null}
     */
    getActive() {
        return this._activeModal;
    },
    
    /**
     * Get number of open modals
     * @returns {number}
     */
    getCount() {
        return this._modals.length;
    },
    
    /**
     * Update modal content dynamically
     * @param {string|Element} content - New content
     */
    updateContent(content) {
        if (!this._activeModal) return;
        
        const body = this._activeModal.querySelector('.modal-body');
        if (body) {
            if (typeof content === 'string') {
                body.innerHTML = content;
            } else if (content instanceof Element) {
                body.innerHTML = '';
                body.appendChild(content);
            }
        }
    },
    
    /**
     * Update modal title
     * @param {string} title - New title
     */
    updateTitle(title) {
        if (!this._activeModal) return;
        
        const titleEl = this._activeModal.querySelector('.modal-title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }
};

// ==========================================
// AUTO-INITIALIZE
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Modal.init());
} else {
    Modal.init();
}

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Modal = Modal;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modal;
}

// ==========================================
// END OF MODAL COMPONENT
// ==========================================
