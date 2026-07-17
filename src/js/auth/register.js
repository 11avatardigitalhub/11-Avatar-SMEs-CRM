/* ==========================================
   11 AVATAR DIGITAL HUB
   Registration Page Handler - Complete Registration Logic
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Registration form handling
   - Multi-step registration wizard
   - Real-time password strength meter
   - Email verification flow
   - Terms acceptance
   - Company/client setup during registration
   - Role selection for platform users
   - Form validation with error messages
   - Loading states
   - Redirect after registration
   ========================================== */

// ==========================================
// REGISTRATION CONTROLLER
// ==========================================
class RegisterController {
    
    /**
     * Initialize the Registration Controller
     */
    constructor() {
        // Configuration
        this.config = {
            redirectAfterRegister: '/dashboard',
            redirectIfAuthenticated: true,
            steps: ['account', 'details', 'verify'], // Multi-step wizard
            currentStep: 0,
            animationDuration: 300,
            passwordStrengthEnabled: true,
            termsRequired: true,
            emailVerificationEnabled: true
        };
        
        // State
        this.state = {
            loading: false,
            error: null,
            currentStep: 0,
            // Account fields
            email: '',
            password: '',
            confirmPassword: '',
            // Profile fields
            displayName: '',
            phone: '',
            companyName: '',
            role: 'client_owner',
            // Agreements
            acceptTerms: false,
            acceptMarketing: false,
            // Validation
            validationErrors: {},
            passwordStrength: null,
            // UI
            showPassword: false,
            showConfirmPassword: false
        };
        
        // DOM Elements
        this.elements = {};
        
        // Bind methods
        this._handleSubmit = this._handleSubmit.bind(this);
        this._handleGoogleRegister = this._handleGoogleRegister.bind(this);
        this._handleNextStep = this._handleNextStep.bind(this);
        this._handlePrevStep = this._handlePrevStep.bind(this);
        this._checkPasswordStrength = this._checkPasswordStrength.bind(this);
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    /**
     * Initialize the registration page
     */
    init() {
        console.log('📝 Initializing Registration Page...');
        
        // Check if already authenticated
        if (this.config.redirectIfAuthenticated && window.auth?.state?.isAuthenticated) {
            this._redirectAfterRegister();
            return;
        }
        
        // Cache DOM elements
        this._cacheElements();
        
        // If elements not found, this page doesn't have registration form
        if (!this.elements.form) {
            console.log('📝 Registration form not found on this page');
            return;
        }
        
        // Setup event listeners
        this._setupEventListeners();
        
        // Show first step
        this._showStep(0);
        
        // Check for invitation parameters
        this._checkInvitationParams();
        
        console.log('✅ Registration Page initialized');
    }
    
    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        this.elements = {
            // Form
            form: document.getElementById('register-form'),
            
            // Step indicators
            steps: document.querySelectorAll('.register-step'),
            stepIndicators: document.querySelectorAll('.step-indicator'),
            
            // Step 1: Account
            stepAccount: document.getElementById('step-account'),
            email: document.getElementById('register-email'),
            password: document.getElementById('register-password'),
            confirmPassword: document.getElementById('register-confirm-password'),
            passwordToggle: document.getElementById('password-toggle'),
            confirmPasswordToggle: document.getElementById('confirm-password-toggle'),
            passwordStrengthBar: document.getElementById('password-strength-bar'),
            passwordStrengthText: document.getElementById('password-strength-text'),
            passwordRequirements: document.getElementById('password-requirements'),
            nextStepBtn: document.getElementById('next-step-btn'),
            
            // Step 2: Details
            stepDetails: document.getElementById('step-details'),
            displayName: document.getElementById('register-display-name'),
            phone: document.getElementById('register-phone'),
            companyName: document.getElementById('register-company'),
            role: document.getElementById('register-role'),
            prevStepBtn: document.getElementById('prev-step-btn'),
            
            // Step 3: Agreements & Submit
            stepAgreements: document.getElementById('step-agreements'),
            acceptTerms: document.getElementById('register-accept-terms'),
            acceptMarketing: document.getElementById('register-accept-marketing'),
            
            // Buttons
            submitBtn: document.getElementById('register-submit'),
            googleBtn: document.getElementById('register-google'),
            
            // Error & Messages
            errorContainer: document.getElementById('register-error'),
            errorMessage: document.getElementById('register-error-message'),
            successContainer: document.getElementById('register-success'),
            successMessage: document.getElementById('register-success-message'),
            loadingOverlay: document.getElementById('register-loading'),
            
            // Links
            loginLink: document.getElementById('login-link'),
            resendVerificationBtn: document.getElementById('resend-verification-btn')
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
        
        // Google registration
        if (this.elements.googleBtn) {
            this.elements.googleBtn.addEventListener('click', this._handleGoogleRegister);
        }
        
        // Step navigation
        if (this.elements.nextStepBtn) {
            this.elements.nextStepBtn.addEventListener('click', this._handleNextStep);
        }
        
        if (this.elements.prevStepBtn) {
            this.elements.prevStepBtn.addEventListener('click', this._handlePrevStep);
        }
        
        // Password strength
        if (this.elements.password) {
            this.elements.password.addEventListener('input', (e) => {
                this.state.password = e.target.value;
                this._checkPasswordStrength(e.target.value);
                this._clearFieldError('password');
            });
        }
        
        // Confirm password match
        if (this.elements.confirmPassword) {
            this.elements.confirmPassword.addEventListener('input', (e) => {
                this.state.confirmPassword = e.target.value;
                this._clearFieldError('confirmPassword');
            });
            
            this.elements.confirmPassword.addEventListener('blur', () => {
                this._validateConfirmPassword();
            });
        }
        
        // Real-time validation on blur
        if (this.elements.email) {
            this.elements.email.addEventListener('input', (e) => {
                this.state.email = e.target.value;
                this._clearFieldError('email');
            });
            
            this.elements.email.addEventListener('blur', () => {
                this._validateEmail();
            });
        }
        
        if (this.elements.displayName) {
            this.elements.displayName.addEventListener('input', (e) => {
                this.state.displayName = e.target.value;
                this._clearFieldError('displayName');
            });
        }
        
        // Password toggles
        if (this.elements.passwordToggle) {
            this.elements.passwordToggle.addEventListener('click', () => {
                this.state.showPassword = !this.state.showPassword;
                this.elements.password.type = this.state.showPassword ? 'text' : 'password';
                this.elements.passwordToggle.textContent = this.state.showPassword ? '🙈' : '👁️';
            });
        }
        
        if (this.elements.confirmPasswordToggle) {
            this.elements.confirmPasswordToggle.addEventListener('click', () => {
                this.state.showConfirmPassword = !this.state.showConfirmPassword;
                this.elements.confirmPassword.type = this.state.showConfirmPassword ? 'text' : 'password';
                this.elements.confirmPasswordToggle.textContent = this.state.showConfirmPassword ? '🙈' : '👁️';
            });
        }
        
        // Resend verification
        if (this.elements.resendVerificationBtn) {
            this.elements.resendVerificationBtn.addEventListener('click', async () => {
                try {
                    await window.auth.sendVerificationEmail();
                    this._showSuccess('Verification email resent! Please check your inbox.');
                } catch (error) {
                    this._showError(error.message);
                }
            });
        }
    }
    
    // ==========================================
    // STEP NAVIGATION
    // ==========================================
    
    /**
     * Show a specific step
     * @private
     */
    _showStep(stepIndex) {
        this.state.currentStep = stepIndex;
        
        // Hide all steps
        [this.elements.stepAccount, this.elements.stepDetails, this.elements.stepAgreements]
            .forEach(step => {
                if (step) step.style.display = 'none';
            });
        
        // Show current step with animation
        const currentStepElement = [this.elements.stepAccount, this.elements.stepDetails, this.elements.stepAgreements][stepIndex];
        
        if (currentStepElement) {
            currentStepElement.style.display = 'block';
            currentStepElement.style.animation = 'fadeUp 0.3s ease';
        }
        
        // Update step indicators
        if (this.elements.stepIndicators) {
            this.elements.stepIndicators.forEach((indicator, index) => {
                indicator.classList.remove('active', 'completed');
                
                if (index < stepIndex) {
                    indicator.classList.add('completed');
                } else if (index === stepIndex) {
                    indicator.classList.add('active');
                }
            });
        }
        
        // Update buttons
        if (this.elements.prevStepBtn) {
            this.elements.prevStepBtn.style.display = stepIndex === 0 ? 'none' : 'inline-flex';
        }
        
        if (this.elements.nextStepBtn) {
            this.elements.nextStepBtn.style.display = stepIndex === 2 ? 'none' : 'inline-flex';
        }
        
        if (this.elements.submitBtn) {
            this.elements.submitBtn.style.display = stepIndex === 2 ? 'inline-flex' : 'none';
        }
        
        // Focus first input of current step
        setTimeout(() => {
            const firstInput = currentStepElement?.querySelector('input:not([type="hidden"])');
            if (firstInput) firstInput.focus();
        }, 350);
        
        // Scroll to form top
        this.elements.form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Handle next step button
     * @private
     */
    _handleNextStep(event) {
        event.preventDefault();
        
        // Validate current step
        if (this.state.currentStep === 0) {
            if (!this._validateStep1()) return;
        } else if (this.state.currentStep === 1) {
            if (!this._validateStep2()) return;
        }
        
        // Move to next step
        this._showStep(this.state.currentStep + 1);
    }
    
    /**
     * Handle previous step button
     * @private
     */
    _handlePrevStep(event) {
        event.preventDefault();
        
        if (this.state.currentStep > 0) {
            this._showStep(this.state.currentStep - 1);
        }
    }
    
    /**
     * Validate Step 1 (Account)
     * @private
     */
    _validateStep1() {
        const isEmailValid = this._validateEmail();
        const isPasswordValid = this._validatePassword();
        const isConfirmValid = this._validateConfirmPassword();
        
        return isEmailValid && isPasswordValid && isConfirmValid;
    }
    
    /**
     * Validate Step 2 (Details)
     * @private
     */
    _validateStep2() {
        const displayName = this.elements.displayName?.value?.trim() || '';
        
        if (!displayName || displayName.length < 2) {
            this._showFieldError('displayName', 'Full name must be at least 2 characters');
            return false;
        }
        
        return true;
    }
    
    // ==========================================
    // FORM SUBMISSION
    // ==========================================
    
    /**
     * Handle form submission
     * @private
     */
    async _handleSubmit(event) {
        event.preventDefault();
        
        if (this.state.loading) return;
        
        this._clearErrors();
        
        // Final validation
        if (!this._validateStep1() || !this._validateStep2()) {
            this._showStep(0);
            return;
        }
        
        // Check terms
        if (this.config.termsRequired && !this.elements.acceptTerms?.checked) {
            this._showError('You must accept the Terms of Service and Privacy Policy');
            return;
        }
        
        // Show loading
        this._showLoading();
        
        try {
            const result = await window.auth.register({
                email: this.elements.email?.value?.trim() || '',
                password: this.elements.password?.value || '',
                confirmPassword: this.elements.confirmPassword?.value || '',
                displayName: this.elements.displayName?.value?.trim() || '',
                phone: this.elements.phone?.value?.trim() || '',
                role: this.elements.role?.value || 'client_owner',
                acceptTerms: this.elements.acceptTerms?.checked || false
            });
            
            console.log('✅ Registration successful');
            
            if (result.verificationSent) {
                // Show verification step
                this._showVerificationSent();
            } else {
                // Show success and redirect
                this._showSuccess('Registration successful! Redirecting...');
                setTimeout(() => this._redirectAfterRegister(), 1500);
            }
            
        } catch (error) {
            console.error('❌ Registration failed:', error);
            this._showError(error.message);
            this._shakeForm();
        } finally {
            this._hideLoading();
        }
    }
    
    /**
     * Handle Google registration
     * @private
     */
    async _handleGoogleRegister(event) {
        event.preventDefault();
        
        if (this.state.loading) return;
        
        this._clearErrors();
        this._showLoading();
        
        try {
            const result = await window.auth.loginWithGoogle();
            
            console.log('✅ Google registration successful');
            
            this._showSuccess('Account created! Redirecting...');
            setTimeout(() => this._redirectAfterRegister(), 1500);
            
        } catch (error) {
            if (error.code !== 'POPUP_CLOSED' && error.code !== 'POPUP_CANCELLED') {
                this._showError(error.message);
            }
        } finally {
            this._hideLoading();
        }
    }
    
    // ==========================================
    // VALIDATION
    // ==========================================
    
    /**
     * Validate email
     * @private
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
     * Validate password
     * @private
     */
    _validatePassword() {
        const password = this.elements.password?.value || '';
        
        if (!password) {
            this._showFieldError('password', 'Password is required');
            return false;
        }
        
        const validation = window.auth?._validatePassword(password);
        
        if (validation && !validation.valid) {
            this._showFieldError('password', validation.message);
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate confirm password
     * @private
     */
    _validateConfirmPassword() {
        const password = this.elements.password?.value || '';
        const confirmPassword = this.elements.confirmPassword?.value || '';
        
        if (!confirmPassword) {
            this._showFieldError('confirmPassword', 'Please confirm your password');
            return false;
        }
        
        if (password !== confirmPassword) {
            this._showFieldError('confirmPassword', 'Passwords do not match');
            return false;
        }
        
        return true;
    }
    
    /**
     * Check password strength in real-time
     * @private
     */
    _checkPasswordStrength(password) {
        if (!this.config.passwordStrengthEnabled) return;
        
        if (!password) {
            this._updatePasswordStrengthUI(null);
            return;
        }
        
        const strength = window.auth?._calculatePasswordStrength(password) || 'weak';
        this.state.passwordStrength = strength;
        this._updatePasswordStrengthUI(strength, password);
    }
    
    /**
     * Update password strength UI
     * @private
     */
    _updatePasswordStrengthUI(strength, password = '') {
        // Update strength bar
        if (this.elements.passwordStrengthBar) {
            const bar = this.elements.passwordStrengthBar;
            
            if (!strength) {
                bar.style.width = '0%';
                bar.className = '';
                return;
            }
            
            switch (strength) {
                case 'weak':
                    bar.style.width = '33%';
                    bar.className = 'strength-weak';
                    break;
                case 'medium':
                    bar.style.width = '66%';
                    bar.className = 'strength-medium';
                    break;
                case 'strong':
                    bar.style.width = '100%';
                    bar.className = 'strength-strong';
                    break;
            }
        }
        
        // Update strength text
        if (this.elements.passwordStrengthText) {
            if (!strength) {
                this.elements.passwordStrengthText.textContent = '';
                return;
            }
            
            const labels = {
                weak: 'Weak password',
                medium: 'Medium password',
                strong: 'Strong password'
            };
            
            this.elements.passwordStrengthText.textContent = labels[strength] || '';
            this.elements.passwordStrengthText.className = `strength-text-${strength}`;
        }
        
        // Update requirement indicators
        if (this.elements.passwordRequirements && password) {
            this._updatePasswordRequirements(password);
        }
    }
    
    /**
     * Update password requirement indicators
     * @private
     */
    _updatePasswordRequirements(password) {
        const requirements = [
            { test: password.length >= 8, text: 'At least 8 characters' },
            { test: /[A-Z]/.test(password), text: 'One uppercase letter' },
            { test: /[a-z]/.test(password), text: 'One lowercase letter' },
            { test: /[0-9]/.test(password), text: 'One number' },
            { test: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'One special character' }
        ];
        
        if (this.elements.passwordRequirements) {
            this.elements.passwordRequirements.innerHTML = requirements.map(req => `
                <div class="requirement-item ${req.test ? 'met' : 'unmet'}">
                    <span class="requirement-icon">${req.test ? '✅' : '❌'}</span>
                    <span>${req.text}</span>
                </div>
            `).join('');
        }
    }
    
    // ==========================================
    // VERIFICATION
    // ==========================================
    
    /**
     * Show verification sent screen
     * @private
     */
    _showVerificationSent() {
        // Hide all steps
        [this.elements.stepAccount, this.elements.stepDetails, this.elements.stepAgreements]
            .forEach(step => {
                if (step) step.style.display = 'none';
            });
        
        // Hide navigation buttons
        if (this.elements.nextStepBtn) this.elements.nextStepBtn.style.display = 'none';
        if (this.elements.prevStepBtn) this.elements.prevStepBtn.style.display = 'none';
        if (this.elements.submitBtn) this.elements.submitBtn.style.display = 'none';
        
        // Show success message
        const email = this.elements.email?.value || '';
        this._showSuccess(`
            🎉 Account created successfully!
            We've sent a verification email to <strong>${email}</strong>.
            Please check your inbox and click the verification link to continue.
        `);
        
        // Show resend button
        if (this.elements.resendVerificationBtn) {
            this.elements.resendVerificationBtn.style.display = 'inline-flex';
        }
    }
    
    // ==========================================
    // UI HELPERS
    // ==========================================
    
    /**
     * Show error
     * @private
     */
    _showError(message) {
        this.state.error = message;
        
        if (this.elements.errorContainer && this.elements.errorMessage) {
            this.elements.errorContainer.style.display = 'block';
            this.elements.errorMessage.innerHTML = message;
            this.elements.errorContainer.style.animation = 'fadeUp 0.3s ease';
        }
        
        if (this.elements.successContainer) {
            this.elements.successContainer.style.display = 'none';
        }
    }
    
    /**
     * Show success
     * @private
     */
    _showSuccess(message) {
        if (this.elements.successContainer && this.elements.successMessage) {
            this.elements.successContainer.style.display = 'block';
            this.elements.successMessage.innerHTML = message;
            this.elements.successContainer.style.animation = 'fadeUp 0.3s ease';
        }
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.style.display = 'none';
        }
    }
    
    /**
     * Show field error
     * @private
     */
    _showFieldError(fieldName, message) {
        this.state.validationErrors[fieldName] = message;
        
        const field = this.elements[fieldName];
        if (!field) return;
        
        field.classList.add('input-error');
        field.setAttribute('aria-invalid', 'true');
        
        let errorEl = field.parentElement.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'field-error';
            errorEl.style.cssText = 'display:block;color:var(--danger);font-size:0.75rem;margin-top:4px;';
            field.parentElement.appendChild(errorEl);
        }
        
        errorEl.textContent = message;
        field.focus();
    }
    
    /**
     * Clear field error
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
     * Clear all errors
     * @private
     */
    _clearErrors() {
        this.state.error = null;
        this.state.validationErrors = {};
        
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
            el.removeAttribute('aria-invalid');
        });
        
        if (this.elements.errorContainer) this.elements.errorContainer.style.display = 'none';
        if (this.elements.successContainer) this.elements.successContainer.style.display = 'none';
    }
    
    /**
     * Show/hide loading
     * @private
     */
    _showLoading() {
        this.state.loading = true;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = true;
            this.elements.submitBtn.setAttribute('aria-busy', 'true');
            this._submitOriginalText = this.elements.submitBtn.textContent;
            this.elements.submitBtn.textContent = 'Creating account...';
        }
    }
    
    _hideLoading() {
        this.state.loading = false;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.removeAttribute('aria-busy');
            if (this._submitOriginalText) this.elements.submitBtn.textContent = this._submitOriginalText;
        }
    }
    
    /**
     * Shake form
     * @private
     */
    _shakeForm() {
        if (!this.elements.form) return;
        this.elements.form.style.animation = 'none';
        this.elements.form.offsetHeight;
        this.elements.form.style.animation = 'shake 0.5s ease';
    }
    
    // ==========================================
    // NAVIGATION
    // ==========================================
    
    _redirectAfterRegister() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || this.config.redirectAfterRegister;
        
        if (window.Router) {
            const routeId = window.Router.pathToRouteId(redirectTo);
            if (routeId) { window.Router.navigateTo(routeId); return; }
        }
        
        window.location.href = redirectTo;
    }
    
    _checkInvitationParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const invitedEmail = urlParams.get('email');
        const invitedRole = urlParams.get('role');
        const invitedClientId = urlParams.get('clientId');
        
        if (invitedEmail && this.elements.email) {
            this.elements.email.value = invitedEmail;
            this.state.email = invitedEmail;
        }
        
        if (invitedRole && this.elements.role) {
            this.elements.role.value = invitedRole;
        }
    }
    
    destroy() {
        if (this.elements.form) this.elements.form.removeEventListener('submit', this._handleSubmit);
        if (this.elements.googleBtn) this.elements.googleBtn.removeEventListener('click', this._handleGoogleRegister);
        console.log('📝 Register Controller destroyed');
    }
}

// ==========================================
// CREATE & EXPORT
// ==========================================
const registerController = new RegisterController();

// Add required styles
const registerStyles = document.createElement('style');
registerStyles.textContent = `
    @keyframes shake {
        0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-6px)}20%,40%,60%,80%{transform:translateX(6px)}
    }
    .input-error{border-color:var(--danger)!important;box-shadow:0 0 0 3px rgba(239,68,68,0.1)!important}
    
    .step-indicator{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-radius:2rem;font-size:0.875rem;font-weight:500;transition:all 0.3s ease}
    .step-indicator.active{background:var(--gold);color:var(--black)}
    .step-indicator.completed{background:var(--success);color:white}
    
    .strength-weak{background:var(--danger)!important}.strength-medium{background:var(--warning)!important}.strength-strong{background:var(--success)!important}
    .strength-text-weak{color:var(--danger)}.strength-text-medium{color:var(--warning)}.strength-text-strong{color:var(--success)}
    
    .requirement-item{display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;padding:0.25rem 0;transition:all 0.3s ease}
    .requirement-item.met{color:var(--success)}.requirement-item.unmet{color:var(--text-muted)}
    .requirement-icon{font-size:0.75rem;width:16px;text-align:center}
`;
document.head.appendChild(registerStyles);

export default registerController;
console.log('📝 Register Controller ready');
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
