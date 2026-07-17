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
 * @requires AuthManager (window.auth / window.AuthManager) - Auth operations
 * @requires FirebaseService (window.FirebaseService) - Database operations
 * @requires Constants (window.Constants) - App constants & debug mode
 *
 * @exports window.RegisterController - Global namespace for registration
 */

'use strict';

// =============================================================================
// REGISTER CONTROLLER - Self-executing IIFE with full encapsulation
// =============================================================================
const RegisterController = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: PRIVATE STATE
    // -------------------------------------------------------------------------
    
    /**
     * DOM element references - cached on initialization
     * @type {Object}
     */
    let elements = {};
    
    /**
     * Controller state object
     * @type {Object}
     * @property {boolean} isSubmitting - Whether a registration request is in progress
     * @property {boolean} isFirebaseReady - Whether Firebase services are available
     * @property {number} currentStep - Current step index (0=Account, 1=Profile, 2=Review)
     * @property {number} totalSteps - Total number of registration steps (3)
     * @property {boolean} isPasswordVisible1 - Whether password field 1 is visible
     * @property {boolean} isPasswordVisible2 - Whether password field 2 is visible
     * @property {string} csrfToken - CSRF protection token
     * @property {boolean} isInitialized - Whether controller is initialized
     * @property {boolean} isRegistrationComplete - Whether registration succeeded
     */
    const state = {
        isSubmitting: false,
        isFirebaseReady: false,
        currentStep: 0,
        totalSteps: 3,
        isPasswordVisible1: false,
        isPasswordVisible2: false,
        csrfToken: '',
        isInitialized: false,
        isRegistrationComplete: false,
    };
    
    /**
     * Error message mappings for Firebase auth error codes
     * @constant {Object}
     */
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
    
    /**
     * Password requirement definitions with test functions
     * @constant {Object}
     */
    const PASSWORD_REQUIREMENTS = Object.freeze({
        length: {
            min: 8,
            label: 'At least 8 characters',
            test: function(v) { return v.length >= 8; }
        },
        uppercase: {
            label: 'One uppercase letter',
            test: function(v) { return /[A-Z]/.test(v); }
        },
        lowercase: {
            label: 'One lowercase letter',
            test: function(v) { return /[a-z]/.test(v); }
        },
        number: {
            label: 'One number',
            test: function(v) { return /[0-9]/.test(v); }
        },
        special: {
            label: 'One special character',
            test: function(v) { return /[!@#$%^&*()_,.?\":{}|<>]/.test(v); }
        },
    });

    // -------------------------------------------------------------------------
    // SECTION 2: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Generate cryptographically secure CSRF token
     * Uses Web Crypto API with Math.random fallback for older browsers
     * @returns {string} 64-character hexadecimal token
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
        } catch (error) {
            // Fallback for browsers without Web Crypto API
        }
        // Math.random fallback - less secure but functional
        return Date.now().toString(36) + 
               Math.random().toString(36).substr(2, 15) + 
               Math.random().toString(36).substr(2, 15);
    }
    
    /**
     * Get human-readable error message from error object
     * @param {Error|Object} error - Error object with optional code property
     * @returns {string} HTML-safe error message
     */
    function getErrorMessage(error) {
        try {
            if (!error) {
                return ERROR_MESSAGES['default'];
            }
            
            var code = error.code || '';
            
            // Check known error codes first
            if (code && ERROR_MESSAGES[code]) {
                return ERROR_MESSAGES[code];
            }
            
            // Fallback to error message if available
            if (error.message) {
                return error.message;
            }
            
            return ERROR_MESSAGES['default'];
        } catch (e) {
            return ERROR_MESSAGES['default'];
        }
    }
    
    /**
     * Check if Firebase services are available for authentication
     * @returns {boolean} True if Firebase Auth and FirebaseService are loaded
     */
    function isFirebaseAvailable() {
        try {
            return typeof firebase !== 'undefined' &&
                   typeof firebase.auth === 'function' &&
                   typeof window.FirebaseService !== 'undefined';
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Parse URL hash parameters for query string values
     * @returns {URLSearchParams} Parsed parameters from hash fragment
     */
    function getHashParams() {
        try {
            var hash = window.location.hash;
            var queryIndex = hash.indexOf('?');
            
            if (queryIndex > -1) {
                return new URLSearchParams(hash.substring(queryIndex + 1));
            }
            
            return new URLSearchParams();
        } catch (error) {
            return new URLSearchParams();
        }
    }
    
    /**
     * Validate email address format using RFC 5322 compliant regex
     * @param {string} email - Email address to validate
     * @returns {Object} { valid: boolean, message: string }
     */
    function validateEmail(email) {
        try {
            if (!email || typeof email !== 'string' || !email.trim()) {
                return { valid: false, message: 'Email address is required.' };
            }
            
            var trimmed = email.trim();
            
            if (trimmed.length > 254) {
                return { valid: false, message: 'Email address is too long.' };
            }
            
            // RFC 5322 compliant email pattern
            var regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            
            if (!regex.test(trimmed)) {
                return { valid: false, message: 'Please enter a valid email address.' };
            }
            
            return { valid: true, message: '' };
        } catch (error) {
            return { valid: false, message: 'Email validation error.' };
        }
    }
    
    /**
     * Validate password using AuthManager's validator with fallback
     * @param {string} password - Password to validate
     * @returns {Object} { valid: boolean, message: string, strength: string }
     */
    function validatePassword(password) {
        try {
            if (!password || typeof password !== 'string') {
                return { valid: false, message: 'Password is required.', strength: 'none' };
            }
            
            // Use AuthManager's enterprise validator if available
            if (window.AuthManager && typeof window.AuthManager.validatePasswordStrength === 'function') {
                return window.AuthManager.validatePasswordStrength(password);
            }
            
            // Fallback validation with basic rules
            if (password.length < 8) {
                return { 
                    valid: false, 
                    message: 'Password must be at least 8 characters.', 
                    strength: 'weak' 
                };
            }
            
            var score = 0;
            if (/[A-Z]/.test(password)) score++;
            if (/[a-z]/.test(password)) score++;
            if (/[0-9]/.test(password)) score++;
            if (/[^A-Za-z0-9]/.test(password)) score++;
            
            if (score < 3) {
                return { 
                    valid: false, 
                    message: 'Password must include uppercase, lowercase, number, and special character.', 
                    strength: 'weak' 
                };
            }
            
            var strength = score >= 4 ? 'strong' : 'medium';
            return { valid: true, message: '', strength: strength };
        } catch (error) {
            return { valid: false, message: 'Password validation error.', strength: 'none' };
        }
    }
    
    /**
     * Calculate password strength score and visual classification
     * @param {string} password - Password to evaluate
     * @returns {Object} { score: number, label: string, cssClass: string }
     */
    function calculatePasswordStrength(password) {
        try {
            if (!password) {
                return { score: 0, label: '', cssClass: '' };
            }
            
            var score = 0;
            
            // Length scoring
            if (password.length >= 8) score += 20;
            if (password.length >= 12) score += 10;
            if (password.length >= 16) score += 10;
            
            // Character variety scoring
            if (/[A-Z]/.test(password)) score += 15;
            if (/[a-z]/.test(password)) score += 10;
            if (/[0-9]/.test(password)) score += 15;
            if (/[^A-Za-z0-9]/.test(password)) score += 20;
            
            // Cap at 100
            score = Math.min(score, 100);
            
            // Classify strength
            var label, cssClass;
            
            if (score <= 35) {
                label = 'Weak password';
                cssClass = 'weak';
            } else if (score <= 65) {
                label = 'Medium password';
                cssClass = 'medium';
            } else {
                label = 'Strong password';
                cssClass = 'strong';
            }
            
            return { score: score, label: label, cssClass: cssClass };
        } catch (error) {
            return { score: 0, label: 'Error', cssClass: '' };
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 3: DOM MANIPULATION FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Cache all required DOM elements for the registration form
     * @returns {boolean} True if registration form exists on page
     */
    function cacheElements() {
        try {
            elements = {
                // Form and step containers
                form: document.getElementById('register-form'),
                step1: document.getElementById('step-1'),
                step2: document.getElementById('step-2'),
                step3: document.getElementById('step-3'),
                
                // Step indicator dots
                stepDot1: document.getElementById('step-dot-1'),
                stepDot2: document.getElementById('step-dot-2'),
                stepDot3: document.getElementById('step-dot-3'),
                
                // Step 1: Account fields
                email: document.getElementById('register-email'),
                password: document.getElementById('register-password'),
                confirmPassword: document.getElementById('register-confirm-password'),
                passwordStrengthBar: document.getElementById('password-strength-bar'),
                passwordStrengthText: document.getElementById('password-strength-text'),
                passwordRequirements: document.getElementById('password-requirements'),
                
                // Step 2: Profile fields
                displayName: document.getElementById('register-display-name'),
                phone: document.getElementById('register-phone'),
                company: document.getElementById('register-company'),
                
                // Step 3: Agreements & Summary
                acceptTerms: document.getElementById('register-accept-terms'),
                acceptMarketing: document.getElementById('register-accept-marketing'),
                summaryEmail: document.getElementById('summary-email'),
                summaryName: document.getElementById('summary-name'),
                summaryCompany: document.getElementById('summary-company'),
                summaryCompanyRow: document.getElementById('summary-company-row'),
                
                // Navigation buttons
                step1Next: document.getElementById('step-1-next'),
                step2Prev: document.getElementById('step-2-prev'),
                step2Next: document.getElementById('step-2-next'),
                step3Prev: document.getElementById('step-3-prev'),
                
                // Submit and Google buttons
                submitBtn: document.getElementById('register-submit'),
                submitText: document.querySelector('#register-submit .btn-text'),
                submitSpinner: document.querySelector('#register-submit .spinner'),
                googleBtn: document.getElementById('register-google'),
                
                // Password toggle buttons
                toggleBtn1: document.getElementById('password-toggle-1'),
                toggleBtn2: document.getElementById('password-toggle-2'),
                
                // Message containers
                errorContainer: document.getElementById('register-error'),
                errorMessage: document.getElementById('register-error-message'),
                successContainer: document.getElementById('register-success'),
                successMessage: document.getElementById('register-success-message'),
                notification: document.getElementById('register-notification'),
                
                // Security and overlay
                csrfInput: document.getElementById('register-csrf'),
                loadingOverlay: document.getElementById('register-loading-overlay'),
                card: document.querySelector('.register-card'),
            };
            
            // Check if we are on the registration page
            if (!elements.form) {
                console.log('[RegisterController] Not on registration page - skipping initialization');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('[RegisterController] Error caching DOM elements:', error);
            return false;
        }
    }
    
    /**
     * Show a specific registration step with animation and ARIA updates
     * @param {number} stepIndex - 0-based step index (0, 1, or 2)
     */
    function showStep(stepIndex) {
        try {
            if (stepIndex < 0 || stepIndex >= state.totalSteps) {
                return;
            }
            
            state.currentStep = stepIndex;
            
            // Hide all steps first
            if (elements.step1) elements.step1.style.display = 'none';
            if (elements.step2) elements.step2.style.display = 'none';
            if (elements.step3) elements.step3.style.display = 'none';
            
            // Show the target step with fade animation
            var targetStep = [elements.step1, elements.step2, elements.step3][stepIndex];
            
            if (targetStep) {
                targetStep.style.display = 'block';
                // Reset and trigger animation
                targetStep.style.animation = 'none';
                void targetStep.offsetHeight;
                targetStep.style.animation = 'cardIn 0.4s ease';
            }
            
            // Update step indicator dots with ARIA states
            var dots = [elements.stepDot1, elements.stepDot2, elements.stepDot3];
            
            dots.forEach(function(dot, i) {
                if (!dot) return;
                
                dot.classList.remove('active', 'completed');
                
                if (i < stepIndex) {
                    dot.classList.add('completed');
                }
                if (i === stepIndex) {
                    dot.classList.add('active');
                    dot.setAttribute('aria-current', 'step');
                } else {
                    dot.removeAttribute('aria-current');
                }
            });
            
            // Update ARIA labels for screen readers
            var stepLabels = ['Account details', 'Profile information', 'Review and submit'];
            
            dots.forEach(function(dot, i) {
                if (!dot) return;
                
                var label = 'Step ' + (i + 1) + ': ' + stepLabels[i];
                if (i < stepIndex) label += ' - Completed';
                if (i === stepIndex) label += ' - Current step';
                
                dot.setAttribute('aria-label', label);
            });
            
            // Populate summary fields when reaching step 3
            if (stepIndex === 2) {
                populateSummary();
            }
            
            // Focus first input of current step after animation
            setTimeout(function() {
                var firstInput = targetStep ? 
                    targetStep.querySelector('input:not([type="hidden"]):not([disabled])') : 
                    null;
                if (firstInput) firstInput.focus();
            }, 450);
            
            // Smooth scroll card into view
            if (elements.card) {
                elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
        } catch (error) {
            console.error('[RegisterController] Error showing step:', error);
        }
    }
    
    /**
     * Populate summary fields on Step 3 (Review)
     */
    function populateSummary() {
        try {
            var email = elements.email ? elements.email.value.trim() : '';
            var name = elements.displayName ? elements.displayName.value.trim() : '';
            var company = elements.company ? elements.company.value.trim() : '';
            
            if (elements.summaryEmail) {
                elements.summaryEmail.textContent = '📧 ' + (email || 'Not provided');
            }
            if (elements.summaryName) {
                elements.summaryName.textContent = '👤 ' + (name || 'Not provided');
            }
            
            // Show/hide company row based on data
            if (elements.summaryCompanyRow && elements.summaryCompany) {
                if (company) {
                    elements.summaryCompanyRow.style.display = 'flex';
                    elements.summaryCompany.textContent = '🏢 ' + company;
                } else {
                    elements.summaryCompanyRow.style.display = 'none';
                }
            }
        } catch (error) {
            // Silent - summary population is non-critical
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: UI FEEDBACK FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Show error message in the error container
     * @param {string} message - Error message (supports HTML)
     */
    function showError(message) {
        try {
            hideNotification();
            hideSuccess();
            
            if (!elements.errorContainer || !elements.errorMessage) return;
            
            elements.errorMessage.innerHTML = message;
            elements.errorContainer.classList.add('show');
            
            // Reset animation for re-trigger
            elements.errorContainer.style.animation = 'none';
            void elements.errorContainer.offsetHeight;
            elements.errorContainer.style.animation = '';
            
            // Auto-hide after 12 seconds
            clearTimeout(elements._errorTimeout);
            elements._errorTimeout = setTimeout(hideError, 12000);
        } catch (error) {
            // Silent - error display should not cause additional errors
        }
    }
    
    /**
     * Hide the error container
     */
    function hideError() {
        try {
            if (elements.errorContainer) {
                elements.errorContainer.classList.remove('show');
            }
            clearTimeout(elements._errorTimeout);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Show success message in the success container
     * @param {string} message - Success message (supports HTML)
     */
    function showSuccess(message) {
        try {
            hideError();
            hideNotification();
            
            if (!elements.successContainer || !elements.successMessage) return;
            
            elements.successMessage.innerHTML = message;
            elements.successContainer.classList.add('show');
            
            // Reset animation for re-trigger
            elements.successContainer.style.animation = 'none';
            void elements.successContainer.offsetHeight;
            elements.successContainer.style.animation = '';
            
            // Scroll to success message
            if (elements.card) {
                elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Hide the success container
     */
    function hideSuccess() {
        try {
            if (elements.successContainer) {
                elements.successContainer.classList.remove('show');
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Show temporary notification banner
     * @param {string} message - Notification message
     * @param {string} [type='info'] - 'info', 'success', or 'error'
     */
    function showNotification(message, type) {
        try {
            hideError();
            hideSuccess();
            
            if (!elements.notification) return;
            
            elements.notification.className = 'auth-notification notification-' + (type || 'info') + ' show';
            elements.notification.textContent = message;
            
            // Auto-hide after 8 seconds
            clearTimeout(elements._notifTimeout);
            elements._notifTimeout = setTimeout(function() {
                elements.notification.classList.remove('show');
            }, 8000);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Hide the notification banner
     */
    function hideNotification() {
        try {
            if (elements.notification) {
                elements.notification.classList.remove('show');
            }
            clearTimeout(elements._notifTimeout);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Show field-level validation error below an input
     * @param {HTMLElement} inputElement - The invalid input element
     * @param {string} message - Error message to display
     */
    function showFieldError(inputElement, message) {
        try {
            if (!inputElement) return;
            
            // Mark input as invalid
            inputElement.classList.add('input-error');
            inputElement.setAttribute('aria-invalid', 'true');
            
            // Find or use existing error element
            var errorId = inputElement.id + '-error';
            var errorElement = document.getElementById(errorId);
            
            if (errorElement) {
                errorElement.textContent = message;
            }
            
            // Link input to error via aria-describedby
            var describedBy = inputElement.getAttribute('aria-describedby') || '';
            if (describedBy.indexOf(errorId) === -1) {
                inputElement.setAttribute('aria-describedby', 
                    describedBy ? describedBy + ' ' + errorId : errorId);
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Clear field-level error for an input
     * @param {HTMLElement} inputElement - The input to clear
     */
    function clearFieldError(inputElement) {
        try {
            if (!inputElement) return;
            
            inputElement.classList.remove('input-error');
            inputElement.removeAttribute('aria-invalid');
            
            var errorId = inputElement.id + '-error';
            var errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.textContent = '';
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Clear all field-level errors
     */
    function clearAllFieldErrors() {
        try {
            var fields = [elements.email, elements.password, elements.confirmPassword, 
                         elements.displayName, elements.phone];
            fields.forEach(function(field) {
                clearFieldError(field);
            });
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Update the password strength visual indicator
     * @param {string} password - Current password value
     */
    function updatePasswordStrengthUI(password) {
        try {
            var result = calculatePasswordStrength(password);
            
            // Update progress bar
            if (elements.passwordStrengthBar) {
                elements.passwordStrengthBar.style.width = result.score + '%';
                elements.passwordStrengthBar.className = 'strength-bar-fill ' + result.cssClass;
                elements.passwordStrengthBar.setAttribute('aria-valuenow', result.score);
            }
            
            // Update strength label text
            if (elements.passwordStrengthText) {
                elements.passwordStrengthText.textContent = result.label;
                elements.passwordStrengthText.className = 'strength-text ' + result.cssClass;
            }
            
            // Update requirement checklist
            updatePasswordRequirements(password);
        } catch (error) {
            // Silent - strength indicator is non-critical
        }
    }
    
    /**
     * Update password requirement checklist indicators
     * @param {string} password - Current password value
     */
    function updatePasswordRequirements(password) {
        try {
            if (!elements.passwordRequirements) return;
            
            var requirementItems = elements.passwordRequirements.querySelectorAll('.requirement-item');
            
            requirementItems.forEach(function(item) {
                var requirementKey = item.getAttribute('data-req');
                
                if (!requirementKey || !PASSWORD_REQUIREMENTS[requirementKey]) return;
                
                var isMet = PASSWORD_REQUIREMENTS[requirementKey].test(password || '');
                
                item.classList.remove('met', 'unmet');
                item.classList.add(isMet ? 'met' : 'unmet');
                
                var iconElement = item.querySelector('.req-icon');
                if (iconElement) {
                    iconElement.textContent = isMet ? '✓' : '○';
                }
            });
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Set loading state - disable/enable all form elements
     * @param {boolean} isLoading - Whether form is in loading state
     */
    function setLoading(isLoading) {
        try {
            state.isSubmitting = isLoading;
            
            // Form fields
            var fields = [elements.email, elements.password, elements.confirmPassword,
                         elements.displayName, elements.phone, elements.company,
                         elements.acceptTerms, elements.acceptMarketing];
            
            // Navigation buttons
            var buttons = [elements.step1Next, elements.step2Prev, elements.step2Next, elements.step3Prev];
            
            if (isLoading) {
                // Disable all fields and buttons
                fields.forEach(function(field) { if (field) field.disabled = true; });
                buttons.forEach(function(btn) { if (btn) btn.disabled = true; });
                
                // Update submit button state
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = true;
                    elements.submitBtn.setAttribute('aria-busy', 'true');
                    elements.submitBtn.classList.add('loading');
                }
                
                // Disable Google and toggle buttons
                if (elements.googleBtn) elements.googleBtn.disabled = true;
                if (elements.toggleBtn1) elements.toggleBtn1.disabled = true;
                if (elements.toggleBtn2) elements.toggleBtn2.disabled = true;
                
                // Show loading overlay
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'flex';
                }
            } else {
                // Enable all fields and buttons
                fields.forEach(function(field) { if (field) field.disabled = false; });
                buttons.forEach(function(btn) { if (btn) btn.disabled = false; });
                
                // Reset submit button
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = false;
                    elements.submitBtn.removeAttribute('aria-busy');
                    elements.submitBtn.classList.remove('loading');
                }
                
                // Enable Google and toggle buttons
                if (elements.googleBtn) elements.googleBtn.disabled = false;
                if (elements.toggleBtn1) elements.toggleBtn1.disabled = false;
                if (elements.toggleBtn2) elements.toggleBtn2.disabled = false;
                
                // Hide loading overlay
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('[RegisterController] Error setting loading state:', error);
        }
    }
    
    /**
     * Apply shake animation to the registration card on error
     */
    function shakeCard() {
        try {
            if (!elements.card) return;
            
            elements.card.classList.add('shake');
            
            setTimeout(function() {
                elements.card.classList.remove('shake');
            }, 600);
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: STEP VALIDATION FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Validate Step 1 - Account credentials (email, password, confirm password)
     * @returns {boolean} True if all Step 1 fields are valid
     */
    function validateStep1() {
        try {
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
            
            // Validate confirm password matches
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
        } catch (error) {
            console.error('[RegisterController] Step 1 validation error:', error);
            return false;
        }
    }
    
    /**
     * Validate Step 2 - Profile details (display name required)
     * @returns {boolean} True if Step 2 fields are valid
     */
    function validateStep2() {
        try {
            clearAllFieldErrors();
            
            var name = elements.displayName ? elements.displayName.value.trim() : '';
            
            if (!name || name.length < 2) {
                showFieldError(elements.displayName, 'Full name is required (minimum 2 characters).');
                if (elements.displayName) elements.displayName.focus();
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Validate Step 3 - Terms acceptance
     * @returns {boolean} True if terms are accepted
     */
    function validateStep3() {
        try {
            hideError();
            
            if (elements.acceptTerms && !elements.acceptTerms.checked) {
                showError('⚠️ Please accept the Terms of Service and Privacy Policy to continue.');
                if (elements.acceptTerms) elements.acceptTerms.focus();
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: EVENT HANDLERS
    // -------------------------------------------------------------------------
    
    /**
     * Handle Step 1 "Continue" button click
     */
    function handleStep1Next() {
        try {
            hideError();
            hideNotification();
            
            if (validateStep1()) {
                showStep(1);
            }
        } catch (error) {
            console.error('[RegisterController] Step 1 next handler error:', error);
        }
    }
    
    /**
     * Handle Step 2 "Back" button click
     */
    function handleStep2Prev() {
        try {
            hideError();
            hideNotification();
            showStep(0);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Handle Step 2 "Continue" button click
     */
    function handleStep2Next() {
        try {
            hideError();
            hideNotification();
            
            if (validateStep2()) {
                showStep(2);
            }
        } catch (error) {
            console.error('[RegisterController] Step 2 next handler error:', error);
        }
    }
    
    /**
     * Handle Step 3 "Back" button click
     */
    function handleStep3Prev() {
        try {
            hideError();
            hideNotification();
            showStep(1);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Handle registration form submission
     * @param {Event} event - Form submit event
     * @returns {Promise<void>}
     */
    async function handleSubmit(event) {
        event.preventDefault();
        
        try {
            // Prevent double submission
            if (state.isSubmitting) return;
            if (state.isRegistrationComplete) return;
            
            // Clear all messages
            hideError();
            hideNotification();
            hideSuccess();
            
            // Validate all steps
            if (!validateStep3()) return;
            if (!validateStep1()) { showStep(0); return; }
            if (!validateStep2()) { showStep(1); return; }
            
            // Verify CSRF token
            if (elements.csrfInput && !elements.csrfInput.value) {
                showError('Security token missing. Please refresh the page and try again.');
                return;
            }
            
            // Set loading state
            setLoading(true);
            
            // Collect form data
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
                
                // Show verification email sent message
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
                    
                    // Hide form, show success
                    if (elements.form) elements.form.style.display = 'none';
                    
                    // Mark all steps as completed                    if (elements.stepDot1) elements.stepDot1.classList.add('completed');
                    if (elements.stepDot2) elements.stepDot2.classList.add('completed');
                    if (elements.stepDot3) elements.stepDot3.classList.add('completed');
                } else {
                    showSuccess('🎉 <strong>Account created successfully!</strong><br>Redirecting to dashboard...');
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                // Direct Firebase fallback when AuthManager not available
                var userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: displayName });
                
                // Save profile to Firestore if available
                if (window.FirebaseService && typeof window.FirebaseService.createDocument === 'function') {
                    await window.FirebaseService.createDocument('users', {
                        uid: userCredential.user.uid,
                        email: email,
                        displayName: displayName,
                        phone: phone,
                        company: company,
                        role: 'viewer',
                        clientId: null,
                        status: 'active',
                        createdAt: new Date().toISOString(),
                    }, userCredential.user.uid).catch(function() {
                        // Profile creation is best-effort
                    });
                }
                
                state.isRegistrationComplete = true;
                
                // Send verification email
                await userCredential.user.sendEmailVerification().catch(function() {
                    // Best-effort
                });
                
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
                try {
                    localStorage.setItem('11avatar_marketing_optin', 'true');
                } catch (storageError) {
                    // Storage may be full
                }
            }
            
        } catch (error) {
            var message = getErrorMessage(error);
            showError(message);
            shakeCard();
            
            // Scroll to show error
            if (elements.card) {
                elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Handle Google OAuth registration button click
     * @returns {Promise<void>}
     */
    async function handleGoogleRegister() {
        try {
            if (state.isSubmitting) return;
            
            hideError();
            hideNotification();
            setLoading(true);
            
            // Try AuthManager first
            if (window.AuthManager && typeof window.AuthManager.loginWithGoogle === 'function') {
                var result = await window.AuthManager.loginWithGoogle();
                
                if (result && result.success) {
                    showSuccess('🎉 <strong>Account created!</strong><br>Redirecting...');
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                // Direct Firebase fallback
                var provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('profile');
                provider.addScope('email');
                provider.setCustomParameters({ prompt: 'select_account' });
                
                var userResult = await firebase.auth().signInWithPopup(provider);
                
                // Create profile for new Google users
                if (userResult.additionalUserInfo && 
                    userResult.additionalUserInfo.isNewUser && 
                    window.FirebaseService) {
                    await window.FirebaseService.createDocument('users', {
                        uid: userResult.user.uid,
                        email: userResult.user.email,
                        displayName: userResult.user.displayName || '',
                        photoURL: userResult.user.photoURL || '',
                        role: 'viewer',
                        status: 'active',
                        provider: 'google',
                        createdAt: new Date().toISOString(),
                    }, userResult.user.uid).catch(function() {
                        // Best-effort profile creation
                    });
                }
                
                window.location.href = 'dashboard.html';
            } else {
                throw new Error('No authentication service available.');
            }
        } catch (error) {
            // Don't show error for user-cancelled popups
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
     * Handle password visibility toggle
     * @param {string} fieldId - ID of password field to toggle
     * @param {number} toggleNum - 1 for password, 2 for confirm password
     */
    function handlePasswordToggle(fieldId, toggleNum) {
        try {
            var input = document.getElementById(fieldId);
            if (!input) return;
            
            var isVisible = toggleNum === 1 ? state.isPasswordVisible1 : state.isPasswordVisible2;
            var newVisible = !isVisible;
            
            // Toggle input type
            input.type = newVisible ? 'text' : 'password';
            
            // Update state
            if (toggleNum === 1) {
                state.isPasswordVisible1 = newVisible;
            } else {
                state.isPasswordVisible2 = newVisible;
            }
            
            // Update button ARIA label
            var btn = toggleNum === 1 ? elements.toggleBtn1 : elements.toggleBtn2;
            if (btn) {
                btn.setAttribute('aria-label', newVisible ? 'Hide password' : 'Show password');
            }
            
            // Keep focus on the password field
            input.focus();
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: EVENT LISTENER MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Attach all event listeners to DOM elements
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
            
            // Google registration button
            if (elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleRegister);
            
            // Password visibility toggle buttons
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
            
            // Real-time password strength meter
            if (elements.password) {
                elements.password.addEventListener('input', function() {
                    updatePasswordStrengthUI(this.value);
                    clearFieldError(this);
                    hideError();
                });
                
                elements.password.addEventListener('blur', function() {
                    var value = this.value;
                    if (value) {
                        var result = validatePassword(value);
                        if (!result.valid) {
                            showFieldError(this, result.message);
                        }
                    }
                });
            }
            
            // Confirm password match check
            if (elements.confirmPassword) {
                elements.confirmPassword.addEventListener('input', function() {
                    clearFieldError(this);
                });
                
                elements.confirmPassword.addEventListener('blur', function() {
                    var password = elements.password ? elements.password.value : '';
                    var confirm = this.value;
                    if (confirm && password !== confirm) {
                        showFieldError(this, 'Passwords do not match.');
                    }
                });
            }
            
            // Email real-time validation
            if (elements.email) {
                elements.email.addEventListener('input', function() {
                    clearFieldError(this);
                    hideError();
                });
                
                elements.email.addEventListener('blur', function() {
                    var value = this.value.trim();
                    if (value) {
                        var result = validateEmail(value);
                        if (!result.valid) {
                            showFieldError(this, result.message);
                        }
                    }
                });
            }
            
            // Display name input tracking
            if (elements.displayName) {
                elements.displayName.addEventListener('input', function() {
                    clearFieldError(this);
                    hideError();
                });
            }
            
            // Enter key advances to next step
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
            
            // Handle back/forward browser cache
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    // Page was restored from bfcache - reset loading state
                    setLoading(false);
                    state.isSubmitting = false;
                }
            });
            
            // Online/offline detection
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
            
            // Check initial online status
            if (!navigator.onLine) {
                showError('⚠️ You are offline. Please check your internet connection.');
                if (elements.submitBtn) elements.submitBtn.disabled = true;
                if (elements.googleBtn) elements.googleBtn.disabled = true;
            }
            
        } catch (error) {
            console.error('[RegisterController] Error attaching event listeners:', error);
        }
    }
    
    /**
     * Remove all event listeners (for cleanup on page navigation)
     */
    function detachEventListeners() {
        try {
            if (elements.step1Next) elements.step1Next.removeEventListener('click', handleStep1Next);
            if (elements.step2Prev) elements.step2Prev.removeEventListener('click', handleStep2Prev);
            if (elements.step2Next) elements.step2Next.removeEventListener('click', handleStep2Next);
            if (elements.step3Prev) elements.step3Prev.removeEventListener('click', handleStep3Prev);
            if (elements.form) elements.form.removeEventListener('submit', handleSubmit);
            if (elements.googleBtn) elements.googleBtn.removeEventListener('click', handleGoogleRegister);
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 8: INITIALIZATION & DESTRUCTION
    // -------------------------------------------------------------------------
    
    /**
     * Set CSRF protection token in hidden form field
     */
    function setCSRFToken() {
        try {
            state.csrfToken = generateCSRFToken();
            
            if (elements.csrfInput) {
                elements.csrfInput.value = state.csrfToken;
            }
            
            // Store in session for server-side verification
            sessionStorage.setItem('register_csrf', state.csrfToken);
        } catch (error) {
            // Silent - CSRF is best-effort protection
        }
    }
    
    /**
     * Check URL for invitation parameters and pre-fill email
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
        } catch (error) {
            // Silent - invite params are optional
        }
    }
    
    /**
     * Initialize the registration controller
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async function init() {
        try {
            // Prevent double initialization
            if (state.isInitialized) {
                return true;
            }
            
            // Cache DOM elements - exit if not on registration page
            if (!cacheElements()) {
                return false;
            }
            
            // Set security token
            setCSRFToken();
            
            // Check for invitation parameters
            handleInviteParams();
            
            // Attach all event listeners
            attachEventListeners();
            
            // Show the first step
            showStep(0);
            
            // Focus email field after animation completes
            if (elements.email) {
                setTimeout(function() {
                    elements.email.focus();
                }, 800);
            }
            
            state.isInitialized = true;
            
            // Log initialization in debug mode
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log(
                    '%c[RegisterController] %cInitialized %cv3.0.0',
                    'color: #FFD700; font-weight: bold;',
                    'color: #10B981;',
                    'color: #888;'
                );
            }
            
            return true;
        } catch (error) {
            console.error('[RegisterController] Initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Destroy the controller and clean up all resources
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
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface - frozen to prevent modification */
    const publicAPI = Object.freeze({
        // Lifecycle methods
        init: init,
        destroy: destroy,
        
        // State access
        getState: function() {
            return {
                currentStep: state.currentStep,
                totalSteps: state.totalSteps,
                isSubmitting: state.isSubmitting,
                isInitialized: state.isInitialized,
                isRegistrationComplete: state.isRegistrationComplete,
            };
        },
        
        // Step navigation
        goToStep: function(stepIndex) {
            if (stepIndex >= 0 && stepIndex < state.totalSteps) {
                showStep(stepIndex);
            }
        },
        
        // Status check
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
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            RegisterController.init().catch(function(error) {
                console.error('[RegisterController] Auto-initialization failed:', error);
            });
        });
    } else {
        // DOM already loaded - initialize immediately
        RegisterController.init().catch(function(error) {
            console.error('[RegisterController] Auto-initialization failed:', error);
        });
    }
}

// =============================================================================
// EXPORTS - Global namespace + CommonJS (NO ES Module export)
// =============================================================================

if (typeof window !== 'undefined') {
    window.RegisterController = RegisterController;
    window.Global = window.Global || {};
    window.Global.RegisterController = RegisterController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegisterController;
}