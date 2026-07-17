/**
 * @fileoverview 11 Avatar SMEs CRM - Registration Page Controller
 * @description Enterprise-grade multi-step registration handler with real-time
 *              password strength validation, field-level error management,
 *              Google OAuth registration, CSRF protection, and invite support.
 *              Works with AuthManager (auth.js) for authentication operations.
 * @module auth/register
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires AuthManager (window.auth / window.AuthManager)
 * @requires FirebaseService (window.FirebaseService)
 * @requires Constants (window.Constants)
 *
 * @exports window.RegisterController - Global namespace
 */

'use strict';

// =============================================================================
// REGISTER CONTROLLER - Self-executing IIFE
// =============================================================================
const RegisterController = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: PRIVATE STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} DOM element references */
    let elements = {};
    
    /** @type {Object} Controller state */
    const state = {
        /** @type {boolean} Whether a registration request is in progress */
        isSubmitting: false,
        
        /** @type {boolean} Whether Firebase services are ready */
        isFirebaseReady: false,
        
        /** @type {number} Current step index (0-based: 0=Account, 1=Profile, 2=Review) */
        currentStep: 0,
        
        /** @type {number} Total number of steps */
        totalSteps: 3,
        
        /** @type {boolean} Whether password is visible (field 1) */
        isPasswordVisible1: false,
        
        /** @type {boolean} Whether confirm password is visible (field 2) */
        isPasswordVisible2: false,
        
        /** @type {string} CSRF token for this session */
        csrfToken: '',
        
        /** @type {boolean} Whether controller is initialized */
        isInitialized: false,
        
        /** @type {boolean} Whether registration was successful */
        isRegistrationComplete: false,
    };
    
    /** @type {Object} Error message mappings for Firebase auth codes */
    const ERROR_MESSAGES = Object.freeze({
        'auth/email-already-in-use': 'This email is already registered. Please <a href="login.html">sign in</a> instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email/Password registration is not currently enabled. Please contact support@11avatardigitalhub.cloud.',
        'auth/weak-password': 'Password is too weak. Please use a stronger password with at least 8 characters, uppercase, lowercase, number, and special character.',
        'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
        'auth/too-many-requests': 'Too many registration attempts. Please wait a moment and try again.',
        'auth/popup-closed-by-user': 'Google sign-up was cancelled. Please try again.',
        'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups for this site.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method. Please sign in with that method.',
        'EMAIL_EXISTS': 'This email is already registered. Please <a href="login.html">sign in</a> instead.',
        'WEAK_PASSWORD': 'Password is too weak. Please follow the password requirements.',
        'NETWORK_ERROR': 'Network error. Please check your internet connection.',
        'default': 'Registration failed. Please check your information and try again.',
    });
    
    /** @type {Object} Password requirement configuration */
    const PASSWORD_REQUIREMENTS = Object.freeze({
        length: { min: 8, label: 'At least 8 characters', test: function(v) { return v.length >= 8; } },
        uppercase: { label: 'One uppercase letter', test: function(v) { return /[A-Z]/.test(v); } },
        lowercase: { label: 'One lowercase letter', test: function(v) { return /[a-z]/.test(v); } },
        number: { label: 'One number', test: function(v) { return /[0-9]/.test(v); } },
        special: { label: 'One special character', test: function(v) { return /[!@#$%^&*()_,.?\":{}|<>]/.test(v); } },
    });

    // -------------------------------------------------------------------------
    // SECTION 2: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Generate CSRF token
     * @returns {string} Hex token
     */
    function generateCSRFToken() {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                var array = new Uint32Array(8);
                crypto.getRandomValues(array);
                return Array.from(array, function(dec) {
                    return ('00000000' + dec.toString(16)).slice(-8);
                }).join('');
            }
        } catch (e) {}
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
    }
    
    /**
     * Get human-readable error message
     * @param {Error|Object} error - Error object
     * @returns {string} HTML-safe message
     */
    function getErrorMessage(error) {
        try {
            if (!error) return ERROR_MESSAGES['default'];
            var code = error.code || '';
            if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
            if (error.message) return error.message;
            return ERROR_MESSAGES['default'];
        } catch (e) {
            return ERROR_MESSAGES['default'];
        }
    }
    
    /**
     * Check if Firebase is available
     * @returns {boolean}
     */
    function isFirebaseAvailable() {
        try {
            return typeof firebase !== 'undefined' &&
                   typeof firebase.auth === 'function' &&
                   typeof window.FirebaseService !== 'undefined';
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Get hash params from URL
     * @returns {URLSearchParams}
     */
    function getHashParams() {
        try {
            var hash = window.location.hash;
            var idx = hash.indexOf('?');
            return idx > -1 ? new URLSearchParams(hash.substring(idx + 1)) : new URLSearchParams();
        } catch (e) {
            return new URLSearchParams();
        }
    }
    
    /**
     * Validate email format
     * @param {string} email
     * @returns {Object} { valid, message }
     */
    function validateEmail(email) {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return { valid: false, message: 'Email address is required.' };
        }
        var trimmed = email.trim();
        if (trimmed.length > 254) {
            return { valid: false, message: 'Email address is too long.' };
        }
        var regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!regex.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        return { valid: true, message: '' };
    }
    
    /**
     * Validate password using AuthManager if available
     * @param {string} password
     * @returns {Object} { valid, message, strength }
     */
    function validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, message: 'Password is required.', strength: 'none' };
        }
        // Use AuthManager's validator if available
        if (window.AuthManager && typeof window.AuthManager.validatePasswordStrength === 'function') {
            return window.AuthManager.validatePasswordStrength(password);
        }
        // Fallback validation
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters.', strength: 'weak' };
        }
        var score = 0;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        if (score < 3) {
            return { valid: false, message: 'Password must include uppercase, lowercase, number, and special character.', strength: 'weak' };
        }
        var strength = score >= 4 ? 'strong' : 'medium';
        return { valid: true, message: '', strength: strength };
    }
    
    /**
     * Calculate password strength score (0-100)
     * @param {string} password
     * @returns {Object} { score, label, cssClass }
     */
    function calculatePasswordStrength(password) {
        if (!password) return { score: 0, label: '', cssClass: '' };
        var score = 0;
        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 10;
        if (password.length >= 16) score += 10;
        if (/[A-Z]/.test(password)) score += 15;
        if (/[a-z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 15;
        if (/[^A-Za-z0-9]/.test(password)) score += 20;
        score = Math.min(score, 100);
        var label, cssClass;
        if (score <= 35) { label = 'Weak password'; cssClass = 'weak'; }
        else if (score <= 65) { label = 'Medium password'; cssClass = 'medium'; }
        else { label = 'Strong password'; cssClass = 'strong'; }
        return { score: score, label: label, cssClass: cssClass };
    }

    // -------------------------------------------------------------------------
    // SECTION 3: DOM MANIPULATION
    // -------------------------------------------------------------------------
    
    /**
     * Cache all DOM elements
     * @returns {boolean} True if on register page
     */
    function cacheElements() {
        try {
            elements = {
                form: document.getElementById('register-form'),
                // Step containers
                step1: document.getElementById('step-1'),
                step2: document.getElementById('step-2'),
                step3: document.getElementById('step-3'),
                // Step dots
                stepDot1: document.getElementById('step-dot-1'),
                stepDot2: document.getElementById('step-dot-2'),
                stepDot3: document.getElementById('step-dot-3'),
                // Step 1 fields
                email: document.getElementById('register-email'),
                password: document.getElementById('register-password'),
                confirmPassword: document.getElementById('register-confirm-password'),
                passwordStrengthBar: document.getElementById('password-strength-bar'),
                passwordStrengthText: document.getElementById('password-strength-text'),
                passwordRequirements: document.getElementById('password-requirements'),
                // Step 2 fields
                displayName: document.getElementById('register-display-name'),
                phone: document.getElementById('register-phone'),
                company: document.getElementById('register-company'),
                // Step 3 fields
                acceptTerms: document.getElementById('register-accept-terms'),
                acceptMarketing: document.getElementById('register-accept-marketing'),
                summaryEmail: document.getElementById('summary-email'),
                summaryName: document.getElementById('summary-name'),
                summaryCompany: document.getElementById('summary-company'),
                summaryCompanyRow: document.getElementById('summary-company-row'),
                // Buttons
                step1Next: document.getElementById('step-1-next'),
                step2Prev: document.getElementById('step-2-prev'),
                step2Next: document.getElementById('step-2-next'),
                step3Prev: document.getElementById('step-3-prev'),
                submitBtn: document.getElementById('register-submit'),
                submitText: document.querySelector('#register-submit .btn-text'),
                submitSpinner: document.querySelector('#register-submit .spinner'),
                googleBtn: document.getElementById('register-google'),
                // Toggle buttons
                toggleBtn1: document.getElementById('password-toggle-1'),
                toggleBtn2: document.getElementById('password-toggle-2'),
                // Messages
                errorContainer: document.getElementById('register-error'),
                errorMessage: document.getElementById('register-error-message'),
                successContainer: document.getElementById('register-success'),
                successMessage: document.getElementById('register-success-message'),
                notification: document.getElementById('register-notification'),
                // Other
                csrfInput: document.getElementById('register-csrf'),
                loadingOverlay: document.getElementById('register-loading-overlay'),
                card: document.querySelector('.register-card'),
            };
            if (!elements.form) {
                console.log('[RegisterController] Not on registration page - skipping');
                return false;
            }
            return true;
        } catch (e) {
            console.error('[RegisterController] Error caching elements:', e);
            return false;
        }
    }
    
    /**
     * Show a specific step
     * @param {number} stepIndex - 0-based index (0, 1, 2)
     */
    function showStep(stepIndex) {
        try {
            if (stepIndex < 0 || stepIndex >= state.totalSteps) return;
            state.currentStep = stepIndex;
            
            // Hide all steps
            if (elements.step1) elements.step1.style.display = 'none';
            if (elements.step2) elements.step2.style.display = 'none';
            if (elements.step3) elements.step3.style.display = 'none';
            
            // Show target step
            var targetStep = [elements.step1, elements.step2, elements.step3][stepIndex];
            if (targetStep) {
                targetStep.style.display = 'block';
                targetStep.style.animation = 'none';
                void targetStep.offsetHeight;
                targetStep.style.animation = 'cardIn 0.4s ease';
            }
            
            // Update step dots
            var dots = [elements.stepDot1, elements.stepDot2, elements.stepDot3];
            dots.forEach(function(dot, i) {
                if (!dot) return;
                dot.classList.remove('active', 'completed');
                if (i < stepIndex) dot.classList.add('completed');
                if (i === stepIndex) {
                    dot.classList.add('active');
                    dot.setAttribute('aria-current', 'step');
                } else {
                    dot.removeAttribute('aria-current');
                }
            });
            
            // Update step dots ARIA labels
            var stepLabels = ['Account details', 'Profile information', 'Review and submit'];
            dots.forEach(function(dot, i) {
                if (!dot) return;
                var label = 'Step ' + (i + 1) + ': ' + stepLabels[i];
                if (i < stepIndex) label += ' - Completed';
                if (i === stepIndex) label += ' - Current step';
                dot.setAttribute('aria-label', label);
            });
            
            // Populate summary on step 3
            if (stepIndex === 2) {
                populateSummary();
            }
            
            // Focus first input of current step
            setTimeout(function() {
                var firstInput = targetStep ? targetStep.querySelector('input:not([type="hidden"]):not([disabled])') : null;
                if (firstInput) firstInput.focus();
            }, 450);
            
            // Scroll card into view
            if (elements.card) {
                elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
        } catch (e) {
            console.error('[RegisterController] Error showing step:', e);
        }
    }
    
    /**
     * Populate summary fields on step 3
     */
    function populateSummary() {
        try {
            var email = elements.email ? elements.email.value.trim() : '';
            var name = elements.displayName ? elements.displayName.value.trim() : '';
            var company = elements.company ? elements.company.value.trim() : '';
            
            if (elements.summaryEmail) elements.summaryEmail.textContent = '📧 ' + (email || 'Not provided');
            if (elements.summaryName) elements.summaryName.textContent = '👤 ' + (name || 'Not provided');
            
            if (elements.summaryCompanyRow && elements.summaryCompany) {
                if (company) {
                    elements.summaryCompanyRow.style.display = 'flex';
                    elements.summaryCompany.textContent = '🏢 ' + company;
                } else {
                    elements.summaryCompanyRow.style.display = 'none';
                }
            }
        } catch (e) {
            // Silent
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message (can contain HTML)
     */
    function showError(message) {
        try {
            hideNotification();
            hideSuccess();
            if (!elements.errorContainer || !elements.errorMessage) return;
            elements.errorMessage.innerHTML = message;
            elements.errorContainer.classList.add('show');
            elements.errorContainer.style.animation = 'none';
            void elements.errorContainer.offsetHeight;
            elements.errorContainer.style.animation = '';
            clearTimeout(elements._errorTimeout);
            elements._errorTimeout = setTimeout(hideError, 12000);
        } catch (e) {}
    }
    
    /**
     * Hide error container
     */
    function hideError() {
        try {
            if (elements.errorContainer) elements.errorContainer.classList.remove('show');
            clearTimeout(elements._errorTimeout);
        } catch (e) {}
    }
    
    /**
     * Show success message
     * @param {string} message - Success message (can contain HTML)
     */
    function showSuccess(message) {
        try {
            hideError();
            hideNotification();
            if (!elements.successContainer || !elements.successMessage) return;
            elements.successMessage.innerHTML = message;
            elements.successContainer.classList.add('show');
            elements.successContainer.style.animation = 'none';
            void elements.successContainer.offsetHeight;
            elements.successContainer.style.animation = '';
            if (elements.card) elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
    }
    
    /**
     * Hide success container
     */
    function hideSuccess() {
        try {
            if (elements.successContainer) elements.successContainer.classList.remove('show');
        } catch (e) {}
    }
    
    /**
     * Show notification
     * @param {string} message
     * @param {string} [type='info']
     */
    function showNotification(message, type) {
        try {
            hideError();
            hideSuccess();
            if (!elements.notification) return;
            elements.notification.className = 'auth-notification notification-' + (type || 'info') + ' show';
            elements.notification.textContent = message;
            clearTimeout(elements._notifTimeout);
            elements._notifTimeout = setTimeout(function() {
                elements.notification.classList.remove('show');
            }, 8000);
        } catch (e) {}
    }
    
    /**
     * Hide notification
     */
    function hideNotification() {
        try {
            if (elements.notification) elements.notification.classList.remove('show');
            clearTimeout(elements._notifTimeout);
        } catch (e) {}
    }
    
    /**
     * Show field-level error
     * @param {HTMLElement} inputEl
     * @param {string} message
     */
    function showFieldError(inputEl, message) {
        try {
            if (!inputEl) return;
            inputEl.classList.add('input-error');
            inputEl.setAttribute('aria-invalid', 'true');
            var errorId = inputEl.id + '-error';
            var errorEl = document.getElementById(errorId);
            if (errorEl) {
                errorEl.textContent = message;
            }
            var describedBy = inputEl.getAttribute('aria-describedby') || '';
            if (describedBy.indexOf(errorId) === -1) {
                inputEl.setAttribute('aria-describedby', describedBy ? describedBy + ' ' + errorId : errorId);
            }
        } catch (e) {}
    }
    
    /**
     * Clear field error
     * @param {HTMLElement} inputEl
     */
    function clearFieldError(inputEl) {
        try {
            if (!inputEl) return;
            inputEl.classList.remove('input-error');
            inputEl.removeAttribute('aria-invalid');
            var errorId = inputEl.id + '-error';
            var errorEl = document.getElementById(errorId);
            if (errorEl) errorEl.textContent = '';
        } catch (e) {}
    }
    
    /**
     * Clear all field errors
     */
    function clearAllFieldErrors() {
        try {
            [elements.email, elements.password, elements.confirmPassword, elements.displayName, elements.phone].forEach(function(el) {
                clearFieldError(el);
            });
        } catch (e) {}
    }
    
    /**
     * Update password strength UI
     * @param {string} password
     */
    function updatePasswordStrengthUI(password) {
        try {
            var result = calculatePasswordStrength(password);
            // Update bar
            if (elements.passwordStrengthBar) {
                elements.passwordStrengthBar.style.width = result.score + '%';
                elements.passwordStrengthBar.className = 'strength-bar-fill ' + result.cssClass;
                elements.passwordStrengthBar.setAttribute('aria-valuenow', result.score);
            }
            // Update text
            if (elements.passwordStrengthText) {
                elements.passwordStrengthText.textContent = result.label;
                elements.passwordStrengthText.className = 'strength-text ' + result.cssClass;
            }
            // Update requirements
            updatePasswordRequirements(password);
        } catch (e) {}
    }
    
    /**
     * Update password requirement indicators
     * @param {string} password
     */
    function updatePasswordRequirements(password) {
        try {
            if (!elements.passwordRequirements) return;
            var reqs = elements.passwordRequirements.querySelectorAll('.requirement-item');
            reqs.forEach(function(item) {
                var key = item.getAttribute('data-req');
                if (!key || !PASSWORD_REQUIREMENTS[key]) return;
                var isMet = PASSWORD_REQUIREMENTS[key].test(password || '');
                item.classList.remove('met', 'unmet');
                item.classList.add(isMet ? 'met' : 'unmet');
                var icon = item.querySelector('.req-icon');
                if (icon) icon.textContent = isMet ? '✓' : '○';
            });
        } catch (e) {}
    }
    
    /**
     * Set loading state
     * @param {boolean} isLoading
     */
    function setLoading(isLoading) {
        try {
            state.isSubmitting = isLoading;
            if (isLoading) {
                if (elements.email) elements.email.disabled = true;
                if (elements.password) elements.password.disabled = true;
                if (elements.confirmPassword) elements.confirmPassword.disabled = true;
                if (elements.displayName) elements.displayName.disabled = true;
                if (elements.phone) elements.phone.disabled = true;
                if (elements.company) elements.company.disabled = true;
                if (elements.acceptTerms) elements.acceptTerms.disabled = true;
                if (elements.acceptMarketing) elements.acceptMarketing.disabled = true;
                if (elements.step1Next) elements.step1Next.disabled = true;
                if (elements.step2Prev) elements.step2Prev.disabled = true;
                if (elements.step2Next) elements.step2Next.disabled = true;
                if (elements.step3Prev) elements.step3Prev.disabled = true;
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = true;
                    elements.submitBtn.setAttribute('aria-busy', 'true');
                    elements.submitBtn.classList.add('loading');
                }
                if (elements.googleBtn) elements.googleBtn.disabled = true;
                if (elements.toggleBtn1) elements.toggleBtn1.disabled = true;
                if (elements.toggleBtn2) elements.toggleBtn2.disabled = true;
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'flex';
                }
            } else {
                if (elements.email) elements.email.disabled = false;
                if (elements.password) elements.password.disabled = false;
                if (elements.confirmPassword) elements.confirmPassword.disabled = false;
                if (elements.displayName) elements.displayName.disabled = false;
                if (elements.phone) elements.phone.disabled = false;
                if (elements.company) elements.company.disabled = false;
                if (elements.acceptTerms) elements.acceptTerms.disabled = false;
                if (elements.acceptMarketing) elements.acceptMarketing.disabled = false;
                if (elements.step1Next) elements.step1Next.disabled = false;
                if (elements.step2Prev) elements.step2Prev.disabled = false;
                if (elements.step2Next) elements.step2Next.disabled = false;
                if (elements.step3Prev) elements.step3Prev.disabled = false;
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = false;
                    elements.submitBtn.removeAttribute('aria-busy');
                    elements.submitBtn.classList.remove('loading');
                }
                if (elements.googleBtn) elements.googleBtn.disabled = false;
                if (elements.toggleBtn1) elements.toggleBtn1.disabled = false;
                if (elements.toggleBtn2) elements.toggleBtn2.disabled = false;
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('[RegisterController] Error setting loading:', e);
        }
    }
    
    /**
     * Shake the card on error
     */
    function shakeCard() {
        try {
            if (!elements.card) return;
            elements.card.classList.add('shake');
            setTimeout(function() {
                elements.card.classList.remove('shake');
            }, 600);
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // SECTION 4: STEP VALIDATION
    // -------------------------------------------------------------------------
    
    /**
     * Validate Step 1 (Account credentials)
     * @returns {boolean} True if valid
     */
    function validateStep1() {
        var isValid = true;
        clearAllFieldErrors();
        
        // Validate email
        var email = elements.email ? elements.email.value.trim() : '';
        var emailResult = validateEmail(email);
        if (!emailResult.valid) {
            showFieldError(elements.email, emailResult.message);
            if (elements.email) elements.email.focus();
            isValid = false;
        }
        
        // Validate password
        var password = elements.password ? elements.password.value : '';
        var passResult = validatePassword(password);
        if (!passResult.valid) {
            showFieldError(elements.password, passResult.message);
            if (isValid && elements.password) elements.password.focus();
            isValid = false;
        }
        
        // Validate confirm password
        var confirm = elements.confirmPassword ? elements.confirmPassword.value : '';
        if (!confirm) {
            showFieldError(elements.confirmPassword, 'Please confirm your password.');
            if (isValid && elements.confirmPassword) elements.confirmPassword.focus();
            isValid = false;
        } else if (password !== confirm) {
            showFieldError(elements.confirmPassword, 'Passwords do not match.');
            if (isValid && elements.confirmPassword) elements.confirmPassword.focus();
            isValid = false;
        }
        
        return isValid;
    }
    
    /**
     * Validate Step 2 (Profile details)
     * @returns {boolean} True if valid
     */
    function validateStep2() {
        clearAllFieldErrors();
        var name = elements.displayName ? elements.displayName.value.trim() : '';
        if (!name || name.length < 2) {
            showFieldError(elements.displayName, 'Full name is required (minimum 2 characters).');
            if (elements.displayName) elements.displayName.focus();
            return false;
        }
        return true;
    }
    
    /**
     * Validate Step 3 (Agreements)
     * @returns {boolean} True if valid
     */
    function validateStep3() {
        hideError();
        if (elements.acceptTerms && !elements.acceptTerms.checked) {
            showError('⚠️ Please accept the Terms of Service and Privacy Policy to continue.');
            if (elements.acceptTerms) elements.acceptTerms.focus();
            return false;
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // SECTION 5: FORM HANDLERS
    // -------------------------------------------------------------------------
    
    /**
     * Handle Step 1 → Step 2
     */
    function handleStep1Next() {
        try {
            hideError();
            hideNotification();
            if (validateStep1()) {
                showStep(1);
            }
        } catch (e) {
            console.error('[RegisterController] Step 1 next error:', e);
        }
    }
    
    /**
     * Handle Step 2 → Step 1 (back)
     */
    function handleStep2Prev() {
        try {
            hideError();
            hideNotification();
            showStep(0);
        } catch (e) {}
    }
    
    /**
     * Handle Step 2 → Step 3
     */
    function handleStep2Next() {
        try {
            hideError();
            hideNotification();
            if (validateStep2()) {
                showStep(2);
            }
        } catch (e) {
            console.error('[RegisterController] Step 2 next error:', e);
        }
    }
    
    /**
     * Handle Step 3 → Step 2 (back)
     */
    function handleStep3Prev() {
        try {
            hideError();
            hideNotification();
            showStep(1);
        } catch (e) {}
    }
    
    /**
     * Handle form submission (Step 3)
     * @param {Event} event
     */
    async function handleSubmit(event) {
        event.preventDefault();
        try {
            if (state.isSubmitting) return;
            if (state.isRegistrationComplete) return;
            
            hideError();
            hideNotification();
            hideSuccess();
            
            // Validate step 3
            if (!validateStep3()) return;
            
            // Also re-validate steps 1 & 2
            if (!validateStep1()) { showStep(0); return; }
            if (!validateStep2()) { showStep(1); return; }
            
            // Check CSRF
            if (elements.csrfInput && !elements.csrfInput.value) {
                showError('Security token missing. Please refresh the page and try again.');
                return;
            }
            
            setLoading(true);
            
            var email = elements.email.value.trim();
            var password = elements.password.value;
            var displayName = elements.displayName.value.trim();
            var phone = elements.phone ? elements.phone.value.trim() : '';
            var company = elements.company ? elements.company.value.trim() : '';
            var acceptMarketing = elements.acceptMarketing ? elements.acceptMarketing.checked : false;
            
            // Attempt registration via AuthManager
            if (window.AuthManager && typeof window.AuthManager.register === 'function') {
                var result = await window.AuthManager.register({
                    email: email,
                    password: password,
                    confirmPassword: password,
                    displayName: displayName,
                    phone: phone,
                    role: 'viewer',
                    acceptTerms: true,
                });
                
                state.isRegistrationComplete = true;
                
                if (result.verificationSent) {
                    showSuccess(
                        '<div class="success-state">' +
                        '<div class="success-icon">📧</div>' +
                        '<h2 class="success-title">Verify Your Email</h2>' +
                        '<p class="success-message">We\'ve sent a verification email to <strong>' + email + '</strong>.' +
                        ' Please check your inbox and click the verification link to activate your account.</p>' +
                        '<p class="success-message" style="font-size:0.85rem;color:#888;">Didn\'t receive it? Check spam folder or contact support@11avatardigitalhub.cloud</p>' +
                        '</div>'
                    );
                    // Hide form, show only success
                    if (elements.form) elements.form.style.display = 'none';
                    if (elements.stepDot1 && elements.stepDot2 && elements.stepDot3) {
                        elements.stepDot1.classList.add('completed');
                        elements.stepDot2.classList.add('completed');
                        elements.stepDot3.classList.add('completed');
                    }
                } else {
                    showSuccess('🎉 <strong>Account created successfully!</strong><br>Redirecting to dashboard...');
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                // Direct Firebase fallback
                var cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: displayName });
                
                // Save profile if FirebaseService available
                if (window.FirebaseService && typeof window.FirebaseService.createDocument === 'function') {
                    await window.FirebaseService.createDocument('users', {
                        uid: cred.user.uid,
                        email: email,
                        displayName: displayName,
                        phone: phone,
                        company: company,
                        role: 'viewer',
                        clientId: null,
                        status: 'active',
                        createdAt: new Date().toISOString(),
                    }, cred.user.uid).catch(function() {});
                }
                
                state.isRegistrationComplete = true;
                await cred.user.sendEmailVerification().catch(function() {});
                
                showSuccess(
                    '<div class="success-state">' +
                    '<div class="success-icon">📧</div>' +
                    '<h2 class="success-title">Verify Your Email</h2>' +
                    '<p class="success-message">We\'ve sent a verification email to <strong>' + email + '</strong>.</p>' +
                    '</div>'
                );
                if (elements.form) elements.form.style.display = 'none';
            } else {
                throw new Error('No authentication service available.');
            }
            
            // Save marketing preference
            if (acceptMarketing) {
                try { localStorage.setItem('11avatar_marketing_optin', 'true'); } catch (e) {}
            }
            
        } catch (error) {
            var message = getErrorMessage(error);
            showError(message);
            shakeCard();
            if (elements.card) elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Handle Google registration
     */
    async function handleGoogleRegister() {
        try {
            if (state.isSubmitting) return;
            hideError();
            hideNotification();
            setLoading(true);
            
            if (window.AuthManager && typeof window.AuthManager.loginWithGoogle === 'function') {
                var result = await window.AuthManager.loginWithGoogle();
                if (result.success) {
                    showSuccess('🎉 <strong>Account created!</strong><br>Redirecting...');
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                var provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('profile');
                provider.addScope('email');
                provider.setCustomParameters({ prompt: 'select_account' });
                var userResult = await firebase.auth().signInWithPopup(provider);
                if (userResult.additionalUserInfo && userResult.additionalUserInfo.isNewUser && window.FirebaseService) {
                    await window.FirebaseService.createDocument('users', {
                        uid: userResult.user.uid,
                        email: userResult.user.email,
                        displayName: userResult.user.displayName || '',
                        photoURL: userResult.user.photoURL || '',
                        role: 'viewer',
                        status: 'active',
                        provider: 'google',
                        createdAt: new Date().toISOString(),
                    }, userResult.user.uid).catch(function() {});
                }
                window.location.href = 'dashboard.html';
            } else {
                throw new Error('No authentication service available.');
            }
        } catch (error) {
            var code = error.code || '';
            if (code !== 'auth/popup-closed-by-user' && 
                code !== 'auth/cancelled-popup-request' &&
                code !== 'POPUP_CLOSED' &&
                code !== 'POPUP_CANCELLED') {
                showError(getErrorMessage(error));
            }
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Handle password toggle
     * @param {string} fieldId - 'register-password' or 'register-confirm-password'
     * @param {number} toggleNum - 1 or 2
     */
    function handlePasswordToggle(fieldId, toggleNum) {
        try {
            var input = document.getElementById(fieldId);
            if (!input) return;
            var isVisible = toggleNum === 1 ? state.isPasswordVisible1 : state.isPasswordVisible2;
            var newVisible = !isVisible;
            input.type = newVisible ? 'text' : 'password';
            if (toggleNum === 1) state.isPasswordVisible1 = newVisible;
            else state.isPasswordVisible2 = newVisible;
            var btn = toggleNum === 1 ? elements.toggleBtn1 : elements.toggleBtn2;
            if (btn) btn.setAttribute('aria-label', newVisible ? 'Hide password' : 'Show password');
            input.focus();
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // SECTION 6: EVENT LISTENERS
    // -------------------------------------------------------------------------
    
    /**
     * Attach all event listeners
     */
    function attachEventListeners() {
        try {
            // Step navigation buttons
            if (elements.step1Next) elements.step1Next.addEventListener('click', handleStep1Next);
            if (elements.step2Prev) elements.step2Prev.addEventListener('click', handleStep2Prev);
            if (elements.step2Next) elements.step2Next.addEventListener('click', handleStep2Next);
            if (elements.step3Prev) elements.step3Prev.addEventListener('click', handleStep3Prev);
            
            // Form submission
            if (elements.form) elements.form.addEventListener('submit', handleSubmit);
            
            // Google registration
            if (elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleRegister);
            
            // Password toggle buttons
            if (elements.toggleBtn1) {
                elements.toggleBtn1.addEventListener('click', function() {
                    handlePasswordToggle('register-password', 1);
                });
            }
            if (elements.toggleBtn2) {
                elements.toggleBtn2.addEventListener('click', function() {
                    handlePasswordToggle('register-confirm-password', 2);
                });
            }
            
            // Password strength live update
            if (elements.password) {
                elements.password.addEventListener('input', function() {
                    updatePasswordStrengthUI(this.value);
                    clearFieldError(this);
                    hideError();
                });
                elements.password.addEventListener('blur', function() {
                    var val = this.value;
                    if (val) {
                        var result = validatePassword(val);
                        if (!result.valid) showFieldError(this, result.message);
                    }
                });
            }
            
            // Confirm password match check
            if (elements.confirmPassword) {
                elements.confirmPassword.addEventListener('input', function() {
                    clearFieldError(this);
                });
                elements.confirmPassword.addEventListener('blur', function() {
                    var pass = elements.password ? elements.password.value : '';
                    var confirm = this.value;
                    if (confirm && pass !== confirm) {
                        showFieldError(this, 'Passwords do not match.');
                    }
                });
            }
            
            // Email validation on blur
            if (elements.email) {
                elements.email.addEventListener('input', function() {
                    clearFieldError(this);
                    hideError();
                });
                elements.email.addEventListener('blur', function() {
                    var val = this.value.trim();
                    if (val) {
                        var result = validateEmail(val);
                        if (!result.valid) showFieldError(this, result.message);
                    }
                });
            }
            
            // Display name validation
            if (elements.displayName) {
                elements.displayName.addEventListener('input', function() {
                    clearFieldError(this);
                    hideError();
                });
            }
            
            // Enter key on password/confirm submits or advances
            if (elements.password) {
                elements.password.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStep1Next();
                    }
                });
            }
            if (elements.confirmPassword) {
                elements.confirmPassword.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStep1Next();
                    }
                });
            }
            if (elements.displayName) {
                elements.displayName.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStep2Next();
                    }
                });
            }
            
            // bfcache handling
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    setLoading(false);
                    state.isSubmitting = false;
                }
            });
            
            // Online/offline
            window.addEventListener('online', function() {
                hideError();
                if (elements.submitBtn) elements.submitBtn.disabled = false;
                if (elements.googleBtn) elements.googleBtn.disabled = false;
            });
            window.addEventListener('offline', function() {
                showError('⚠️ You are offline. Please check your internet connection.');
                if (elements.submitBtn) elements.submitBtn.disabled = true;
                if (elements.googleBtn) elements.googleBtn.disabled = true;
            });
            
            if (!navigator.onLine) {
                showError('⚠️ You are offline. Please check your internet connection.');
                if (elements.submitBtn) elements.submitBtn.disabled = true;
                if (elements.googleBtn) elements.googleBtn.disabled = true;
            }
            
        } catch (e) {
            console.error('[RegisterController] Error attaching listeners:', e);
        }
    }
    
    /**
     * Remove event listeners
     */
    function detachEventListeners() {
        try {
            if (elements.step1Next) elements.step1Next.removeEventListener('click', handleStep1Next);
            if (elements.step2Prev) elements.step2Prev.removeEventListener('click', handleStep2Prev);
            if (elements.step2Next) elements.step2Next.removeEventListener('click', handleStep2Next);
            if (elements.step3Prev) elements.step3Prev.removeEventListener('click', handleStep3Prev);
            if (elements.form) elements.form.removeEventListener('submit', handleSubmit);
            if (elements.googleBtn) elements.googleBtn.removeEventListener('click', handleGoogleRegister);
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // SECTION 7: INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Set CSRF token
     */
    function setCSRFToken() {
        try {
            state.csrfToken = generateCSRFToken();
            if (elements.csrfInput) elements.csrfInput.value = state.csrfToken;
            sessionStorage.setItem('register_csrf', state.csrfToken);
        } catch (e) {}
    }
    
    /**
     * Handle invite parameters from URL
     */
    function handleInviteParams() {
        try {
            var params = getHashParams();
            var inviteEmail = params.get('email');
            var inviteRole = params.get('role');
            if (inviteEmail && elements.email) {
                elements.email.value = inviteEmail;
                elements.email.readOnly = true;
                setTimeout(function() {
                    showNotification('📨 You\'ve been invited! Complete your registration below.', 'info');
                }, 600);
            }
        } catch (e) {}
    }
    
    /**
     * Initialize the controller
     * @returns {Promise<boolean>}
     */
    async function init() {
        try {
            if (state.isInitialized) return true;
            if (!cacheElements()) return false;
            
            setCSRFToken();
            handleInviteParams();
            attachEventListeners();
            showStep(0);
            
            // Focus email after animation
            if (elements.email) {
                setTimeout(function() {
                    elements.email.focus();
                }, 800);
            }
            
            state.isInitialized = true;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log(
                    '%c[RegisterController] %cInitialized %cv3.0.0',
                    'color: #FFD700; font-weight: bold;',
                    'color: #10B981;',
                    'color: #888;'
                );
            }
            return true;
        } catch (e) {
            console.error('[RegisterController] Init failed:', e);
            return false;
        }
    }
    
    /**
     * Destroy controller
     */
    function destroy() {
        try {
            detachEventListeners();
            hideError();
            hideSuccess();
            hideNotification();
            setLoading(false);
            clearAllFieldErrors();
            state.isInitialized = false;
            elements = {};
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // SECTION 8: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API */
    const publicAPI = Object.freeze({
        init: init,
        destroy: destroy,
        getState: function() {
            return {
                currentStep: state.currentStep,
                totalSteps: state.totalSteps,
                isSubmitting: state.isSubmitting,
                isInitialized: state.isInitialized,
                isRegistrationComplete: state.isRegistrationComplete,
            };
        },
        goToStep: function(stepIndex) {
            if (stepIndex >= 0 && stepIndex < state.totalSteps) {
                showStep(stepIndex);
            }
        },
        isInitialized: function() {
            return state.isInitialized;
        },
    });
    
    return publicAPI;
    
})(); // End of RegisterController IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            RegisterController.init().catch(function(e) {
                console.error('[RegisterController] Auto-init failed:', e);
            });
        });
    } else {
        RegisterController.init().catch(function(e) {
            console.error('[RegisterController] Auto-init failed:', e);
        });
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.RegisterController = RegisterController;
    window.Global = window.Global || {};
    window.Global.RegisterController = RegisterController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegisterController;
}

export {
    RegisterController as default,
    RegisterController,
};