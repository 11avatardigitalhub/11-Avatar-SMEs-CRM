/* ==========================================
   11 AVATAR DIGITAL HUB
   Login Page Handler - Complete Login Logic
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Login form handling
   - Form validation
   - Error display
   - Loading states
   - Remember me
   - Google login
   - Redirect after login
   - Session restoration
   - Password visibility toggle
   ========================================== */

// ==========================================
// LOGIN PAGE CONTROLLER
// ==========================================
class LoginController {
    
    /**
     * Initialize the Login Controller
     */
    constructor() {
        // Configuration
        this.config = {
            redirectAfterLogin: '/dashboard',
            redirectIfAuthenticated: true,
            animationDuration: 300,
            autoFocus: true,
            showPasswordToggle: true,
            rememberMeDefault: false
        };
        
        // State
        this.state = {
            loading: false,
            error: null,
            email: '',
            password: '',
            rememberMe: false,
            showPassword: false,
            validationErrors: {}
        };
        
        // DOM Elements (populated on init)
        this.elements = {};
        
        // Bind methods
        this._handleSubmit = this._handleSubmit.bind(this);
        this._handleGoogleLogin = this._handleGoogleLogin.bind(this);
        this._handleInputChange = this._handleInputChange.bind(this);
        this._togglePasswordVisibility = this._togglePasswordVisibility.bind(this);
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    /**
     * Initialize the login page
     */
    init() {
        console.log('🔐 Initializing Login Page...');
        
        // Check if already authenticated
        if (this.config.redirectIfAuthenticated && window.auth?.state?.isAuthenticated) {
            this._redirectAfterLogin();
            return;
        }
        
        // Cache DOM elements
        this._cacheElements();
        
        // If elements not found, this page doesn't have login form
        if (!this.elements.form) {
            console.log('🔐 Login form not found on this page');
            return;
        }
        
        // Setup event listeners
        this._setupEventListeners();
        
        // Load saved email (if any)
        this._loadSavedEmail();
        
        // Auto-focus email field
        if (this.config.autoFocus && this.elements.email) {
            setTimeout(() => this.elements.email.focus(), 500);
        }
        
        // Check for redirect parameter
        this._checkRedirectParam();
        
        console.log('✅ Login Page initialized');
    }
    
    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        this.elements = {
            form: document.getElementById('login-form'),
            email: document.getElementById('login-email'),
            password: document.getElementById('login-password'),
            rememberMe: document.getElementById('login-remember'),
            submitBtn: document.getElementById('login-submit'),
            googleBtn: document.getElementById('login-google'),
            errorContainer: document.getElementById('login-error'),
            errorMessage: document.getElementById('login-error-message'),
            loadingOverlay: document.getElementById('login-loading'),
            passwordToggle: document.getElementById('password-toggle'),
            forgotPasswordLink: document.getElementById('forgot-password-link'),
            registerLink: document.getElementById('register-link')
        };
    }
    
    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Form submission
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', this._handleSubmit);
        }
        
        // Google login button
        if (this.elements.googleBtn) {
            this.elements.googleBtn.addEventListener('click', this._handleGoogleLogin);
        }
        
        // Input changes for real-time validation
        if (this.elements.email) {
            this.elements.email.addEventListener('input', (e) => {
                this.state.email = e.target.value;
                this._clearFieldError('email');
            });
            
            this.elements.email.addEventListener('blur', () => {
                this._validateEmail();
            });
        }
        
        if (this.elements.password) {
            this.elements.password.addEventListener('input', (e) => {
                this.state.password = e.target.value;
                this._clearFieldError('password');
            });
        }
        
        // Remember me checkbox
        if (this.elements.rememberMe) {
            this.elements.rememberMe.addEventListener('change', (e) => {
                this.state.rememberMe = e.target.checked;
            });
        }
        
        // Password visibility toggle
        if (this.elements.passwordToggle) {
            this.elements.passwordToggle.addEventListener('click', this._togglePasswordVisibility);
        }
        
        // Enter key on password field submits form
        if (this.elements.password) {
            this.elements.password.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.elements.form?.dispatchEvent(new Event('submit'));
                }
            });
        }
        
        // Prevent multiple rapid submissions
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', () => {
                if (this.state.loading) {
                    // Already submitting
                }
            });
        }
    }
    
    /**
     * Handle form submission
     * @private
     */
    async _handleSubmit(event) {
        event.preventDefault();
        
        // Prevent double submission
        if (this.state.loading) return;
        
        // Clear previous errors
        this._clearErrors();
        
        // Validate form
        if (!this._validateForm()) {
            return;
        }
        
        // Get form values
        const email = this.elements.email?.value?.trim() || '';
        const password = this.elements.password?.value || '';
        const rememberMe = this.elements.rememberMe?.checked || false;
        
        // Show loading state
        this._showLoading();
        
        try {
            // Attempt login
            const result = await window.auth.login({
                email,
                password,
                rememberMe
            });
            
            console.log('✅ Login successful:', email);
            
            // Save email for next time
            this._saveEmail(email);
            
            // Show success briefly
            this._showSuccess('Login successful! Redirecting...');
            
            // Redirect after short delay
            setTimeout(() => {
                this._redirectAfterLogin();
            }, 500);
            
        } catch (error) {
            console.error('❌ Login failed:', error);
            
            // Show error
            this._showError(error.message);
            
            // Shake the form
            this._shakeForm();
            
            // Focus on the appropriate field
            if (error.code === 'USER_NOT_FOUND' || error.code === 'INVALID_EMAIL') {
                this.elements.email?.focus();
            } else if (error.code === 'WRONG_PASSWORD' || error.code === 'INVALID_CREDENTIAL') {
                this.elements.password?.focus();
                this.elements.password?.select();
            }
            
        } finally {
            // Hide loading
            this._hideLoading();
        }
    }
    
    /**
     * Handle Google login
     * @private
     */
    async _handleGoogleLogin(event) {
        event.preventDefault();
        
        if (this.state.loading) return;
        
        this._clearErrors();
        this._showLoading();
        
        try {
            const result = await window.auth.loginWithGoogle();
            
            console.log('✅ Google login successful:', result.user.email);
            
            this._showSuccess('Login successful! Redirecting...');
            
            setTimeout(() => {
                this._redirectAfterLogin();
            }, 500);
            
        } catch (error) {
            console.error('❌ Google login failed:', error);
            
            // Don't show error for popup closed
            if (error.code !== 'POPUP_CLOSED' && error.code !== 'POPUP_CANCELLED') {
                this._showError(error.message);
            }
            
        } finally {
            this._hideLoading();
        }
    }
    
    /**
     * Handle input change
     * @private
     */
    _handleInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        
        this.state[field] = value;
        this._clearFieldError(field);
    }
    
    /**
     * Toggle password visibility
     * @private
     */
    _togglePasswordVisibility() {
        this.state.showPassword = !this.state.showPassword;
        
        if (this.elements.password) {
            this.elements.password.type = this.state.showPassword ? 'text' : 'password';
        }
        
        // Update toggle icon
        if (this.elements.passwordToggle) {
            this.elements.passwordToggle.textContent = this.state.showPassword ? '🙈' : '👁️';
        }
    }
    
    // ==========================================
    // VALIDATION
    // ==========================================
    
    /**
     * Validate entire form
     * @private
     * @returns {boolean} Is form valid
     */
    _validateForm() {
        const isEmailValid = this._validateEmail();
        const isPasswordValid = this._validatePassword();
        
        return isEmailValid && isPasswordValid;
    }
    
    /**
     * Validate email field
     * @private
     * @returns {boolean}
     */
    _validateEmail() {
        const email = this.elements.email?.value?.trim() || '';
        
        if (!email) {
            this._showFieldError('email', 'Email address is required');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this._showFieldError('email', 'Please enter a valid email address');
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate password field
     * @private
     * @returns {boolean}
     */
    _validatePassword() {
        const password = this.elements.password?.value || '';
        
        if (!password) {
            this._showFieldError('password', 'Password is required');
            return false;
        }
        
        if (password.length < 6) {
            this._showFieldError('password', 'Password must be at least 6 characters');
            return false;
        }
        
        return true;
    }
    
    // ==========================================
    // UI HELPERS
    // ==========================================
    
    /**
     * Show error message
     * @private
     */
    _showError(message) {
        this.state.error = message;
        
        if (this.elements.errorContainer && this.elements.errorMessage) {
            this.elements.errorContainer.style.display = 'block';
            this.elements.errorMessage.textContent = message;
            
            // Animate in
            this.elements.errorContainer.style.animation = 'none';
            this.elements.errorContainer.offsetHeight; // Trigger reflow
            this.elements.errorContainer.style.animation = 'fadeUp 0.3s ease';
        }
        
        // Also show toast if available
        if (window.App?.toast) {
            window.App.toast(message, 'error');
        }
    }
    
    /**
     * Show success message
     * @private
     */
    _showSuccess(message) {
        if (this.elements.errorContainer && this.elements.errorMessage) {
            this.elements.errorContainer.style.display = 'block';
            this.elements.errorContainer.style.borderLeftColor = 'var(--success)';
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.style.color = 'var(--success)';
        }
    }
    
    /**
     * Show field-level error
     * @private
     */
    _showFieldError(fieldName, message) {
        this.state.validationErrors[fieldName] = message;
        
        const field = this.elements[fieldName];
        if (!field) return;
        
        // Add error class to field
        field.classList.add('input-error');
        field.setAttribute('aria-invalid', 'true');
        
        // Create or update error message element
        let errorEl = field.parentElement.querySelector('.field-error');
        
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'field-error';
            errorEl.style.cssText = `
                display: block;
                color: var(--danger);
                font-size: 0.75rem;
                margin-top: 4px;
                animation: fadeUp 0.2s ease;
            `;
            field.parentElement.appendChild(errorEl);
        }
        
        errorEl.textContent = message;
        
        // Focus the field
        field.focus();
    }
    
    /**
     * Clear all errors
     * @private
     */
    _clearErrors() {
        this.state.error = null;
        this.state.validationErrors = {};
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.style.display = 'none';
            this.elements.errorContainer.style.borderLeftColor = 'var(--danger)';
        }
        
        // Clear field errors
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
            el.removeAttribute('aria-invalid');
        });
    }
    
    /**
     * Clear specific field error
     * @private
     */
    _clearFieldError(fieldName) {
        delete this.state.validationErrors[fieldName];
        
        const field = this.elements[fieldName];
        if (!field) return;
        
        field.classList.remove('input-error');
        field.removeAttribute('aria-invalid');
        
        const errorEl = field.parentElement.querySelector('.field-error');
        if (errorEl) errorEl.remove();
    }
    
    /**
     * Show loading state
     * @private
     */
    _showLoading() {
        this.state.loading = true;
        
        // Disable submit button
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = true;
            this.elements.submitBtn.setAttribute('aria-busy', 'true');
            
            // Save original text
            this._originalSubmitText = this.elements.submitBtn.textContent;
            this.elements.submitBtn.textContent = 'Signing in...';
        }
        
        // Disable Google button
        if (this.elements.googleBtn) {
            this.elements.googleBtn.disabled = true;
        }
        
        // Disable form inputs
        if (this.elements.form) {
            const inputs = this.elements.form.querySelectorAll('input, button');
            inputs.forEach(input => {
                if (input !== this.elements.submitBtn && input !== this.elements.googleBtn) {
                    input.disabled = true;
                }
            });
        }
        
        // Show loading overlay if exists
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'flex';
        }
    }
    
    /**
     * Hide loading state
     * @private
     */
    _hideLoading() {
        this.state.loading = false;
        
        // Enable submit button
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.removeAttribute('aria-busy');
            
            if (this._originalSubmitText) {
                this.elements.submitBtn.textContent = this._originalSubmitText;
            }
        }
        
        // Enable Google button
        if (this.elements.googleBtn) {
            this.elements.googleBtn.disabled = false;
        }
        
        // Enable form inputs
        if (this.elements.form) {
            const inputs = this.elements.form.querySelectorAll('input, button');
            inputs.forEach(input => {
                input.disabled = false;
            });
        }
        
        // Hide loading overlay
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    }
    
    /**
     * Shake the form to indicate error
     * @private
     */
    _shakeForm() {
        if (!this.elements.form) return;
        
        this.elements.form.style.animation = 'none';
        this.elements.form.offsetHeight; // Trigger reflow
        this.elements.form.style.animation = 'shake 0.5s ease';
    }
    
    // ==========================================
    // NAVIGATION
    // ==========================================
    
    /**
     * Redirect after successful login
     * @private
     */
    _redirectAfterLogin() {
        // Check for redirect parameter
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || this.config.redirectAfterLogin;
        
        // Navigate using router if available
        if (window.Router) {
            const routeId = window.Router.pathToRouteId(redirectTo);
            if (routeId) {
                window.Router.navigateTo(routeId);
                return;
            }
        }
        
        // Fallback: direct navigation
        window.location.href = redirectTo;
    }
    
    /**
     * Check for redirect parameter in URL
     * @private
     */
    _checkRedirectParam() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect');
        const reason = urlParams.get('reason');
        
        if (reason === 'session_expired') {
            this._showError('Your session has expired. Please login again.');
        } else if (reason === 'logout') {
            // Show subtle message
            this._showSuccess('You have been logged out successfully.');
        }
        
        if (redirectTo) {
            this.config.redirectAfterLogin = redirectTo;
        }
    }
    
    // ==========================================
    // PERSISTENCE
    // ==========================================
    
    /**
     * Save email for next login
     * @private
     */
    _saveEmail(email) {
        try {
            const saved = JSON.parse(localStorage.getItem('11avatar_saved_emails') || '[]');
            
            // Add to beginning, remove duplicates
            const updated = [email, ...saved.filter(e => e !== email)].slice(0, 3);
            
            localStorage.setItem('11avatar_saved_emails', JSON.stringify(updated));
        } catch {}
    }
    
    /**
     * Load saved email
     * @private
     */
    _loadSavedEmail() {
        try {
            const saved = JSON.parse(localStorage.getItem('11avatar_saved_emails') || '[]');
            
            if (saved.length > 0 && this.elements.email && !this.elements.email.value) {
                this.elements.email.value = saved[0];
                this.state.email = saved[0];
            }
        } catch {}
    }
    
    /**
     * Clean up the controller
     */
    destroy() {
        if (this.elements.form) {
            this.elements.form.removeEventListener('submit', this._handleSubmit);
        }
        
        if (this.elements.googleBtn) {
            this.elements.googleBtn.removeEventListener('click', this._handleGoogleLogin);
        }
        
        if (this.elements.passwordToggle) {
            this.elements.passwordToggle.removeEventListener('click', this._togglePasswordVisibility);
        }
        
        console.log('🔐 Login Controller destroyed');
    }
}

// ==========================================
// CREATE & EXPORT LOGIN CONTROLLER INSTANCE
// ==========================================
const loginController = new LoginController();

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
        20%, 40%, 60%, 80% { transform: translateX(6px); }
    }
    
    .input-error {
        border-color: var(--danger) !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }
    
    #login-loading {
        display: none;
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        align-items: center;
        justify-content: center;
        border-radius: inherit;
        z-index: 10;
    }
    
    #login-error {
        display: none;
        padding: 12px 16px;
        border-radius: var(--radius);
        background: rgba(239, 68, 68, 0.08);
        border-left: 3px solid var(--danger);
        margin-bottom: 16px;
        font-size: 0.875rem;
        color: var(--danger);
    }
`;
document.head.appendChild(shakeStyle);

// Export for module usage
export default loginController;

console.log('🔐 Login Controller ready');

// ==========================================
// END OF LOGIN CONTROLLER
// ==========================================


