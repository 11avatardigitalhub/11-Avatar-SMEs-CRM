/**
 * @fileoverview 11 Avatar SMEs CRM - Login Page Controller
 * @description Enterprise-grade login page handler with form validation,
 *              error management, loading states, Google OAuth, lockout timer,
 *              CSRF protection, and session-aware redirects.
 *              Works in harmony with AuthManager (auth.js) for state management.
 * @module auth/login
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires AuthManager (window.auth / window.AuthManager)
 * @requires FirebaseService (window.FirebaseService)
 * @requires Constants (window.Constants)
 *
 * @exports window.LoginController - Global namespace
 */

'use strict';

// =============================================================================
// LOGIN CONTROLLER - Self-executing IIFE
// =============================================================================
const LoginController = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: PRIVATE STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} DOM element references */
    let elements = {};
    
    /** @type {Object} Controller state */
    const state = {
        /** @type {boolean} Whether a login request is in progress */
        isSubmitting: false,
        
        /** @type {boolean} Whether Firebase services are ready */
        isFirebaseReady: false,
        
        /** @type {number} Count of failed login attempts in this session */
        failedAttempts: 0,
        
        /** @type {number|null} Timestamp when lockout ends */
        lockoutUntil: null,
        
        /** @type {number|null} Lockout timer interval ID */
        lockoutTimerInterval: null,
        
        /** @type {boolean} Whether password is visible */
        isPasswordVisible: false,
        
        /** @type {string} CSRF token for this session */
        csrfToken: '',
        
        /** @type {boolean} Whether controller is initialized */
        isInitialized: false,
    };
    
    /** @type {Object} Error message mappings for Firebase auth codes */
    const ERROR_MESSAGES = Object.freeze({
        'auth/user-not-found': 'No account found with this email address. Please check or register.',
        'auth/wrong-password': 'Incorrect password. Please try again or use forgot password.',
        'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-disabled': 'This account has been disabled. Please contact support@11avatardigitalhub.cloud.',
        'auth/too-many-requests': 'Too many login attempts. Please wait and try again.',
        'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled. Please try again.',
        'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups for this site.',
        'auth/cancelled-popup-request': 'Sign-in cancelled. Please try again.',
        'auth/operation-not-allowed': 'Email/Password sign-in is not enabled. Please contact support.',
        'auth/requires-recent-login': 'For security, please sign in again.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
        'default': 'Login failed. Please check your credentials and try again.',
    });
    
    /** @type {Object} Redirect URL mappings for post-login navigation */
    const REDIRECT_MAP = Object.freeze({
        'dashboard': 'dashboard.html',
        'leads': 'leads.html',
        'clients': 'clients.html',
        'pipeline': 'pipeline.html',
        'invoices': 'invoices.html',
        'payments': 'payments.html',
        'tasks': 'tasks.html',
        'projects': 'projects.html',
        'whatsapp': 'whatsapp.html',
        'settings': 'settings.html',
        'default': 'dashboard.html',
    });

    // -------------------------------------------------------------------------
    // SECTION 2: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Generate a cryptographically secure CSRF token
     * @returns {string} 64-character hex token
     */
    function generateCSRFToken() {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const array = new Uint32Array(8);
                crypto.getRandomValues(array);
                return Array.from(array, function(dec) {
                    return ('00000000' + dec.toString(16)).slice(-8);
                }).join('');
            }
        } catch (error) {
            // Fallback for older browsers
        }
        // Fallback: timestamp + random
        return Date.now().toString(36) + 
               Math.random().toString(36).substr(2, 15) + 
               Math.random().toString(36).substr(2, 15);
    }
    
    /**
     * Get human-readable error message from Firebase error code
     * @param {Error|Object} error - Firebase error object
     * @returns {string} User-friendly error message
     */
    function getErrorMessage(error) {
        try {
            if (!error) return ERROR_MESSAGES['default'];
            
            const code = error.code || '';
            const message = error.message || '';
            
            // Check known error codes
            if (code && ERROR_MESSAGES[code]) {
                return ERROR_MESSAGES[code];
            }
            
            // Check message for common patterns
            if (message.includes('user-not-found')) return ERROR_MESSAGES['auth/user-not-found'];
            if (message.includes('wrong-password')) return ERROR_MESSAGES['auth/wrong-password'];
            if (message.includes('invalid-credential')) return ERROR_MESSAGES['auth/invalid-credential'];
            if (message.includes('too-many-requests')) return ERROR_MESSAGES['auth/too-many-requests'];
            if (message.includes('network')) return ERROR_MESSAGES['auth/network-request-failed'];
            
            return ERROR_MESSAGES['default'];
        } catch (e) {
            return ERROR_MESSAGES['default'];
        }
    }
    
    /**
     * Check if Firebase services are available
     * @returns {boolean} True if Firebase is ready
     */
    function isFirebaseAvailable() {
        try {
            return typeof firebase !== 'undefined' &&
                   typeof firebase.auth === 'function' &&
                   typeof window.FirebaseService !== 'undefined' &&
                   window.FirebaseService.isServiceReady &&
                   window.FirebaseService.isServiceReady();
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Parse URL hash parameters
     * @returns {URLSearchParams} Parsed parameters
     */
    function getHashParams() {
        try {
            const hash = window.location.hash;
            const queryIndex = hash.indexOf('?');
            if (queryIndex > -1) {
                return new URLSearchParams(hash.substring(queryIndex + 1));
            }
            return new URLSearchParams();
        } catch (error) {
            return new URLSearchParams();
        }
    }
    
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {Object} { valid: boolean, message: string }
     */
    function validateEmail(email) {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return { valid: false, message: 'Email address is required.' };
        }
        
        const trimmed = email.trim();
        
        if (trimmed.length > 254) {
            return { valid: false, message: 'Email address is too long.' };
        }
        
        // RFC 5322 compliant email regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        
        return { valid: true, message: '' };
    }
    
    /**
     * Validate password
     * @param {string} password - Password to validate
     * @returns {Object} { valid: boolean, message: string }
     */
    function validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, message: 'Password is required.' };
        }
        
        if (password.length < 6) {
            return { valid: false, message: 'Password must be at least 6 characters.' };
        }
        
        if (password.length > 128) {
            return { valid: false, message: 'Password is too long.' };
        }
        
        return { valid: true, message: '' };
    }

    // -------------------------------------------------------------------------
    // SECTION 3: DOM MANIPULATION
    // -------------------------------------------------------------------------
    
    /**
     * Cache all DOM elements needed by the controller
     * @returns {boolean} True if all required elements found
     */
    function cacheElements() {
        try {
            elements = {
                form: document.getElementById('login-form'),
                email: document.getElementById('login-email'),
                password: document.getElementById('login-password'),
                remember: document.getElementById('login-remember'),
                submitBtn: document.getElementById('login-submit'),
                submitText: document.querySelector('#login-submit .btn-text'),
                submitSpinner: document.querySelector('#login-submit .spinner'),
                googleBtn: document.getElementById('login-google'),
                toggleBtn: document.getElementById('password-toggle'),
                errorContainer: document.getElementById('login-error'),
                errorMessage: document.getElementById('login-error-message'),
                lockoutContainer: document.getElementById('login-lockout'),
                lockoutMessage: document.getElementById('login-lockout-message'),
                lockoutTimer: document.getElementById('login-lockout-timer'),
                notification: document.getElementById('login-notification'),
                csrfInput: document.getElementById('login-csrf'),
                loadingOverlay: document.getElementById('login-loading-overlay'),
                card: document.querySelector('.auth-card'),
            };
            
            // Check if we're on the login page
            if (!elements.form) {
                console.log('[LoginController] Not on login page - skipping initialization');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('[LoginController] Error caching elements:', error);
            return false;
        }
    }
    
    /**
     * Show error message in the error container
     * @param {string} message - Error message to display
     */
    function showError(message) {
        try {
            // Hide other notifications first
            hideNotification();
            hideLockout();
            
            if (!elements.errorContainer || !elements.errorMessage) return;
            
            elements.errorMessage.textContent = message;
            elements.errorContainer.classList.add('show');
            
            // Trigger reflow for animation
            elements.errorContainer.style.animation = 'none';
            void elements.errorContainer.offsetHeight;
            elements.errorContainer.style.animation = '';
            
            // Set ARIA attributes
            elements.errorContainer.setAttribute('aria-live', 'assertive');
            
            // Auto-hide after 12 seconds
            clearTimeout(elements._errorTimeout);
            elements._errorTimeout = setTimeout(hideError, 12000);
            
        } catch (error) {
            console.error('[LoginController] Error showing error:', error);
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
     * Show lockout message with countdown timer
     * @param {number} remainingSeconds - Seconds remaining in lockout
     */
    function showLockout(remainingSeconds) {
        try {
            hideError();
            hideNotification();
            
            if (!elements.lockoutContainer) return;
            
            elements.lockoutContainer.classList.add('show');
            
            // Update timer display
            updateLockoutTimer(remainingSeconds);
            
            // Start countdown
            clearInterval(state.lockoutTimerInterval);
            state.lockoutTimerInterval = setInterval(function() {
                remainingSeconds--;
                if (remainingSeconds <= 0) {
                    clearInterval(state.lockoutTimerInterval);
                    state.lockoutTimerInterval = null;
                    hideLockout();
                    state.failedAttempts = 0;
                    state.lockoutUntil = null;
                    enableForm();
                } else {
                    updateLockoutTimer(remainingSeconds);
                }
            }, 1000);
            
        } catch (error) {
            console.error('[LoginController] Error showing lockout:', error);
        }
    }
    
    /**
     * Update the lockout timer display
     * @param {number} seconds - Seconds remaining
     */
    function updateLockoutTimer(seconds) {
        try {
            if (!elements.lockoutTimer) return;
            
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            const display = minutes > 0 
                ? minutes + ' minute' + (minutes !== 1 ? 's' : '') + ' ' + secs + ' second' + (secs !== 1 ? 's' : '')
                : secs + ' second' + (secs !== 1 ? 's' : '');
            
            elements.lockoutTimer.textContent = display;
            
            if (elements.lockoutMessage) {
                elements.lockoutMessage.textContent = '⏳ Too many failed attempts. Please wait ';
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Hide the lockout container
     */
    function hideLockout() {
        try {
            if (elements.lockoutContainer) {
                elements.lockoutContainer.classList.remove('show');
            }
            clearInterval(state.lockoutTimerInterval);
            state.lockoutTimerInterval = null;
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Show notification (success/info/warning)
     * @param {string} message - Notification message
     * @param {string} [type='info'] - 'success', 'info', 'warning'
     */
    function showNotification(message, type) {
        try {
            hideError();
            hideLockout();
            
            if (!elements.notification) return;
            
            // Remove old type classes
            elements.notification.classList.remove('notification-success', 'notification-info', 'notification-warning');
            
            // Add type class
            const typeClass = 'notification-' + (type || 'info');
            elements.notification.classList.add(typeClass);
            elements.notification.classList.add('show');
            
            // Set message
            elements.notification.textContent = message;
            
            // Trigger animation
            elements.notification.style.animation = 'none';
            void elements.notification.offsetHeight;
            elements.notification.style.animation = '';
            
            // Auto-hide after 8 seconds
            clearTimeout(elements._notificationTimeout);
            elements._notificationTimeout = setTimeout(hideNotification, 8000);
            
        } catch (error) {
            console.error('[LoginController] Error showing notification:', error);
        }
    }
    
    /**
     * Hide the notification container
     */
    function hideNotification() {
        try {
            if (elements.notification) {
                elements.notification.classList.remove('show', 'notification-success', 'notification-info', 'notification-warning');
            }
            clearTimeout(elements._notificationTimeout);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Show field-level validation error
     * @param {HTMLElement} inputElement - The input element
     * @param {string} message - Error message
     */
    function showFieldError(inputElement, message) {
        try {
            if (!inputElement) return;
            
            // Add error class to input
            inputElement.classList.add('input-error');
            inputElement.setAttribute('aria-invalid', 'true');
            
            // Find or create error element
            const errorId = inputElement.id + '-error';
            let errorElement = document.getElementById(errorId);
            
            if (errorElement) {
                errorElement.textContent = message;
            } else {
                // Create if doesn't exist
                errorElement = document.createElement('div');
                errorElement.id = errorId;
                errorElement.className = 'field-error';
                errorElement.setAttribute('role', 'alert');
                errorElement.setAttribute('aria-live', 'polite');
                errorElement.textContent = message;
                inputElement.parentElement.appendChild(errorElement);
            }
            
            // Link input to error via aria-describedby
            const describedBy = inputElement.getAttribute('aria-describedby') || '';
            if (!describedBy.includes(errorId)) {
                inputElement.setAttribute('aria-describedby', 
                    describedBy ? describedBy + ' ' + errorId : errorId);
            }
            
        } catch (error) {
            console.error('[LoginController] Error showing field error:', error);
        }
    }
    
    /**
     * Clear a specific field error
     * @param {HTMLElement} inputElement - The input element
     */
    function clearFieldError(inputElement) {
        try {
            if (!inputElement) return;
            
            inputElement.classList.remove('input-error');
            inputElement.removeAttribute('aria-invalid');
            
            const errorId = inputElement.id + '-error';
            const errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.textContent = '';
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Clear all field errors
     */
    function clearAllFieldErrors() {
        try {
            if (elements.email) clearFieldError(elements.email);
            if (elements.password) clearFieldError(elements.password);
            
            // Also clear any orphaned error elements
            const allErrors = document.querySelectorAll('.field-error');
            allErrors.forEach(function(el) {
                el.textContent = '';
            });
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Set the loading state of the form
     * @param {boolean} isLoading - Whether form is loading
     */
    function setLoading(isLoading) {
        try {
            state.isSubmitting = isLoading;
            
            if (isLoading) {
                // Disable inputs
                if (elements.email) elements.email.disabled = true;
                if (elements.password) elements.password.disabled = true;
                if (elements.remember) elements.remember.disabled = true;
                if (elements.toggleBtn) elements.toggleBtn.disabled = true;
                
                // Update submit button
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = true;
                    elements.submitBtn.setAttribute('aria-busy', 'true');
                    elements.submitBtn.classList.add('loading');
                }
                
                // Disable Google button
                if (elements.googleBtn) {
                    elements.googleBtn.disabled = true;
                }
                
                // Show loading overlay
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'flex';
                    elements.loadingOverlay.setAttribute('aria-busy', 'true');
                }
                
            } else {
                // Enable inputs
                if (elements.email) elements.email.disabled = false;
                if (elements.password) elements.password.disabled = false;
                if (elements.remember) elements.remember.disabled = false;
                if (elements.toggleBtn) elements.toggleBtn.disabled = false;
                
                // Reset submit button
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = false;
                    elements.submitBtn.removeAttribute('aria-busy');
                    elements.submitBtn.classList.remove('loading');
                }
                
                // Enable Google button
                if (elements.googleBtn) {
                    elements.googleBtn.disabled = false;
                }
                
                // Hide loading overlay
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'none';
                    elements.loadingOverlay.removeAttribute('aria-busy');
                }
            }
        } catch (error) {
            console.error('[LoginController] Error setting loading state:', error);
        }
    }
    
    /**
     * Disable the entire form (for lockout)
     */
    function disableForm() {
        try {
            if (elements.email) elements.email.disabled = true;
            if (elements.password) elements.password.disabled = true;
            if (elements.remember) elements.remember.disabled = true;
            if (elements.toggleBtn) elements.toggleBtn.disabled = true;
            if (elements.submitBtn) elements.submitBtn.disabled = true;
            if (elements.googleBtn) elements.googleBtn.disabled = true;
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Enable the form after lockout
     */
    function enableForm() {
        try {
            if (elements.email) elements.email.disabled = false;
            if (elements.password) elements.password.disabled = false;
            if (elements.remember) elements.remember.disabled = false;
            if (elements.toggleBtn) elements.toggleBtn.disabled = false;
            if (elements.submitBtn) elements.submitBtn.disabled = false;
            if (elements.googleBtn) elements.googleBtn.disabled = false;
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Apply shake animation to the card
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
    // SECTION 4: AUTHENTICATION HANDLERS
    // -------------------------------------------------------------------------
    
    /**
     * Handle email/password login form submission
     * @param {Event} event - Form submit event
     * @returns {Promise<void>}
     */
    async function handleEmailLogin(event) {
        event.preventDefault();
        
        try {
            // Prevent double submission
            if (state.isSubmitting) return;
            
            // Clear previous messages
            hideError();
            hideLockout();
            hideNotification();
            clearAllFieldErrors();
            
            // Check if locked out
            if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
                const remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
                showLockout(remaining);
                disableForm();
                return;
            }
            
            // Get form values
            const email = elements.email ? elements.email.value.trim() : '';
            const password = elements.password ? elements.password.value : '';
            const rememberMe = elements.remember ? elements.remember.checked : false;
            
            // Validate email
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                showFieldError(elements.email, emailValidation.message);
                elements.email.focus();
                return;
            }
            
            // Validate password
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showFieldError(elements.password, passwordValidation.message);
                elements.password.focus();
                return;
            }
            
            // Validate CSRF token
            if (elements.csrfInput && !elements.csrfInput.value) {
                showError('Security token missing. Please refresh the page and try again.');
                return;
            }
            
            // Check Firebase availability
            if (!isFirebaseAvailable()) {
                showError('Authentication service is initializing. Please wait a moment and try again.');
                // Retry after 2 seconds
                setTimeout(function() {
                    if (isFirebaseAvailable()) {
                        hideError();
                    }
                }, 2000);
                return;
            }
            
            // Set loading state
            setLoading(true);
            
            // Attempt login via AuthManager
            let result;
            
            if (window.AuthManager && typeof window.AuthManager.login === 'function') {
                // Use AuthManager (preferred)
                result = await window.AuthManager.login({
                    email: email,
                    password: password,
                    rememberMe: rememberMe,
                });
            } else if (window.auth && typeof window.auth.login === 'function') {
                // Fallback to auth alias
                result = await window.auth.login({
                    email: email,
                    password: password,
                    rememberMe: rememberMe,
                });
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                // Direct Firebase fallback
                const persistence = rememberMe
                    ? firebase.auth.Auth.Persistence.LOCAL
                    : firebase.auth.Auth.Persistence.SESSION;
                
                await firebase.auth().setPersistence(persistence);
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                result = {
                    success: true,
                    user: {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email,
                        displayName: userCredential.user.displayName,
                    },
                };
            } else {
                throw new Error('No authentication service available');
            }
            
            // Reset failed attempts on success
            state.failedAttempts = 0;
            state.lockoutUntil = null;
            
            // Log success
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log('[LoginController] Login successful:', email);
            }
            
            // Redirect to dashboard or custom redirect
            redirectAfterLogin();
            
        } catch (error) {
            // Increment failed attempts
            state.failedAttempts++;
            
            // Check if should lockout (after 5 failed attempts)
            if (state.failedAttempts >= 5) {
                const lockoutSeconds = Math.min(state.failedAttempts * 30, 900); // Max 15 minutes
                state.lockoutUntil = Date.now() + (lockoutSeconds * 1000);
                showLockout(lockoutSeconds);
                disableForm();
            } else {
                // Show error message
                const message = getErrorMessage(error);
                showError(message);
                shakeCard();
                
                // Focus appropriate field
                const errorCode = error.code || '';
                if (errorCode.includes('password') || errorCode.includes('credential')) {
                    if (elements.password) {
                        elements.password.focus();
                        elements.password.select();
                    }
                } else if (errorCode.includes('user') || errorCode.includes('email')) {
                    if (elements.email) {
                        elements.email.focus();
                        elements.email.select();
                    }
                }
            }
            
            // Log error in debug mode
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.error('[LoginController] Login failed:', error.code, error.message);
            }
            
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Handle Google OAuth login
     * @param {Event} event - Click event
     * @returns {Promise<void>}
     */
    async function handleGoogleLogin(event) {
        event.preventDefault();
        
        try {
            // Prevent double submission
            if (state.isSubmitting) return;
            
            // Check lockout
            if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
                const remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
                showLockout(remaining);
                return;
            }
            
            hideError();
            hideNotification();
            
            // Check Firebase
            if (!isFirebaseAvailable()) {
                showError('Authentication service is initializing. Please try again.');
                return;
            }
            
            setLoading(true);
            
            let result;
            
            if (window.AuthManager && typeof window.AuthManager.loginWithGoogle === 'function') {
                result = await window.AuthManager.loginWithGoogle();
            } else if (window.auth && typeof window.auth.loginWithGoogle === 'function') {
                result = await window.auth.loginWithGoogle();
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('profile');
                provider.addScope('email');
                provider.setCustomParameters({ prompt: 'select_account' });
                
                const userCredential = await firebase.auth().signInWithPopup(provider);
                result = {
                    success: true,
                    user: {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email,
                        displayName: userCredential.user.displayName,
                    },
                };
            } else {
                throw new Error('No authentication service available');
            }
            
            // Success
            state.failedAttempts = 0;
            state.lockoutUntil = null;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log('[LoginController] Google login successful');
            }
            
            redirectAfterLogin();
            
        } catch (error) {
            // Don't show error for user-cancelled popups
            const code = error.code || '';
            if (code === 'auth/popup-closed-by-user' || 
                code === 'auth/cancelled-popup-request' ||
                code === 'POPUP_CLOSED' ||
                code === 'POPUP_CANCELLED') {
                // User cancelled - no error message needed
                return;
            }
            
            const message = getErrorMessage(error);
            showError(message);
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.error('[LoginController] Google login failed:', error.code, error.message);
            }
            
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Toggle password visibility
     */
    function handlePasswordToggle() {
        try {
            if (!elements.password) return;
            
            state.isPasswordVisible = !state.isPasswordVisible;
            
            elements.password.type = state.isPasswordVisible ? 'text' : 'password';
            
            // Update button aria-label
            if (elements.toggleBtn) {
                elements.toggleBtn.setAttribute('aria-label', 
                    state.isPasswordVisible ? 'Hide password' : 'Show password');
            }
            
            // Maintain focus on password field
            elements.password.focus();
            
        } catch (error) {
            console.error('[LoginController] Error toggling password:', error);
        }
    }
    
    /**
     * Redirect user after successful login
     */
    function redirectAfterLogin() {
        try {
            // Check for stored redirect
            let redirectUrl = sessionStorage.getItem('login_redirect');
            sessionStorage.removeItem('login_redirect');
            
            // Check URL hash for redirect parameter
            if (!redirectUrl) {
                const params = getHashParams();
                const redirectParam = params.get('redirect');
                
                if (redirectParam && REDIRECT_MAP[redirectParam]) {
                    redirectUrl = REDIRECT_MAP[redirectParam];
                }
            }
            
            // Default to dashboard
            if (!redirectUrl) {
                redirectUrl = REDIRECT_MAP['default'];
            }
            
            // Ensure .html extension for GitHub Pages
            if (!redirectUrl.endsWith('.html') && !redirectUrl.startsWith('http')) {
                redirectUrl += '.html';
            }
            
            // Show brief success before redirect
            showNotification('✅ Login successful! Redirecting...', 'success');
            
            // Redirect after short delay for UX
            setTimeout(function() {
                window.location.href = redirectUrl;
            }, 800);
            
        } catch (error) {
            // Fallback: direct redirect
            window.location.href = 'dashboard.html';
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: EVENT LISTENERS SETUP
    // -------------------------------------------------------------------------
    
    /**
     * Attach all event listeners to DOM elements
     */
    function attachEventListeners() {
        try {
            // Form submission
            if (elements.form) {
                elements.form.addEventListener('submit', handleEmailLogin);
                
                // Prevent Enter key on non-submit elements from triggering
                elements.form.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' && event.target.tagName !== 'INPUT') {
                        event.preventDefault();
                    }
                });
            }
            
            // Google login button
            if (elements.googleBtn) {
                elements.googleBtn.addEventListener('click', handleGoogleLogin);
            }
            
            // Password visibility toggle
            if (elements.toggleBtn) {
                elements.toggleBtn.addEventListener('click', handlePasswordToggle);
            }
            
            // Real-time field validation on blur
            if (elements.email) {
                elements.email.addEventListener('blur', function() {
                    const value = elements.email.value.trim();
                    if (value) {
                        const validation = validateEmail(value);
                        if (!validation.valid) {
                            showFieldError(elements.email, validation.message);
                        }
                    }
                });
                
                // Clear error on input
                elements.email.addEventListener('input', function() {
                    clearFieldError(elements.email);
                    hideError();
                });
            }
            
            if (elements.password) {
                elements.password.addEventListener('blur', function() {
                    const value = elements.password.value;
                    if (value) {
                        const validation = validatePassword(value);
                        if (!validation.valid) {
                            showFieldError(elements.password, validation.message);
                        }
                    }
                });
                
                // Clear error on input
                elements.password.addEventListener('input', function() {
                    clearFieldError(elements.password);
                    hideError();
                });
                
                // Enter key submits form
                elements.password.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' && elements.form) {
                        event.preventDefault();
                        elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                });
            }
            
            // Handle back/forward cache (bfcache)
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    // Page was restored from bfcache
                    setLoading(false);
                    hideError();
                    hideLockout();
                    state.isSubmitting = false;
                }
            });
            
            // Handle online/offline status
            window.addEventListener('online', function() {
                hideError();
                hideLockout();
                enableForm();
            });
            
            window.addEventListener('offline', function() {
                showError('⚠️ You are offline. Please check your internet connection.');
                disableForm();
            });
            
            // Check initial online status
            if (!navigator.onLine) {
                showError('⚠️ You are offline. Please check your internet connection.');
                disableForm();
            }
            
        } catch (error) {
            console.error('[LoginController] Error attaching event listeners:', error);
        }
    }
    
    /**
     * Remove all event listeners (for cleanup)
     */
    function detachEventListeners() {
        try {
            if (elements.form) {
                elements.form.removeEventListener('submit', handleEmailLogin);
            }
            if (elements.googleBtn) {
                elements.googleBtn.removeEventListener('click', handleGoogleLogin);
            }
            if (elements.toggleBtn) {
                elements.toggleBtn.removeEventListener('click', handlePasswordToggle);
            }
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: INITIALIZATION
    // -------------------------------------------------------------------------
    
    /**
     * Check and handle URL parameters for post-action messages
     */
    function handleURLParams() {
        try {
            const params = getHashParams();
            const reason = params.get('reason');
            
            if (!reason) return;
            
            // Small delay for DOM to be ready
            setTimeout(function() {
                switch (reason) {
                    case 'session_expired':
                        showError('⏰ Your session has expired. Please sign in again to continue.');
                        break;
                    case 'logout':
                        showNotification('✅ You have been logged out successfully.', 'success');
                        break;
                    case 'password_reset':
                        showNotification('✅ Your password has been reset successfully. Please sign in with your new password.', 'success');
                        break;
                    case 'email_verified':
                        showNotification('✅ Your email has been verified. You can now sign in.', 'success');
                        break;
                    case 'registration_success':
                        showNotification('🎉 Account created successfully! Please sign in to continue.', 'success');
                        break;
                    default:
                        break;
                }
            }, 500);
            
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Set CSRF token in the form
     */
    function setCSRFToken() {
        try {
            state.csrfToken = generateCSRFToken();
            if (elements.csrfInput) {
                elements.csrfInput.value = state.csrfToken;
            }
            
            // Also store in session for verification
            sessionStorage.setItem('csrf_token', state.csrfToken);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Restore saved email from localStorage
     */
    function restoreSavedEmail() {
        try {
            const savedEmail = localStorage.getItem('11avatar_last_email');
            if (savedEmail && elements.email && !elements.email.value) {
                elements.email.value = savedEmail;
                
                // Also check remember me
                const rememberMe = localStorage.getItem('11avatar_remember_me');
                if (rememberMe === 'true' && elements.remember) {
                    elements.remember.checked = true;
                }
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Save email for future logins
     * @param {string} email - Email to save
     */
    function saveEmailForFuture(email) {
        try {
            if (email) {
                localStorage.setItem('11avatar_last_email', email);
                
                if (elements.remember) {
                    localStorage.setItem('11avatar_remember_me', elements.remember.checked ? 'true' : 'false');
                }
            }
        } catch (error) {
            // Silent - storage may be full or unavailable
        }
    }
    
    /**
     * Wait for Firebase services to be ready
     * @param {number} [timeout=10000] - Max wait time in ms
     * @returns {Promise<boolean>} True if Firebase became ready
     */
    async function waitForFirebase(timeout) {
        const maxWait = timeout || 10000;
        const startTime = Date.now();
        
        return new Promise(function(resolve) {
            function check() {
                if (isFirebaseAvailable()) {
                    state.isFirebaseReady = true;
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= maxWait) {
                    console.warn('[LoginController] Firebase not ready after ' + maxWait + 'ms');
                    resolve(false);
                    return;
                }
                
                setTimeout(check, 500);
            }
            
            check();
        });
    }
    
    /**
     * Initialize the Login Controller
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async function init() {
        try {
            // Don't re-initialize
            if (state.isInitialized) return true;
            
            // Cache DOM elements
            if (!cacheElements()) {
                return false; // Not on login page
            }
            
            // Set CSRF token
            setCSRFToken();
            
            // Restore saved email
            restoreSavedEmail();
            
            // Handle URL parameters
            handleURLParams();
            
            // Attach event listeners
            attachEventListeners();
            
            // Wait for Firebase (non-blocking)
            waitForFirebase(8000).then(function(ready) {
                if (ready) {
                    if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                        console.log('[LoginController] Firebase services ready');
                    }
                } else {
                    console.warn('[LoginController] Firebase services not ready - will retry on submit');
                }
            });
            
            // Focus email field
            if (elements.email) {
                setTimeout(function() {
                    elements.email.focus();
                }, 800);
            }
            
            state.isInitialized = true;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log(
                    '%c[LoginController] %cInitialized %cv3.0.0',
                    'color: #FFD700; font-weight: bold;',
                    'color: #10B981;',
                    'color: #888;'
                );
            }
            
            return true;
            
        } catch (error) {
            console.error('[LoginController] Initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Destroy the controller and clean up
     */
    function destroy() {
        try {
            detachEventListeners();
            hideError();
            hideLockout();
            hideNotification();
            clearAllFieldErrors();
            setLoading(false);
            clearInterval(state.lockoutTimerInterval);
            state.isInitialized = false;
            elements = {};
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log('[LoginController] Destroyed');
            }
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public methods exposed by LoginController */
    const publicAPI = Object.freeze({
        /** Initialize the controller */
        init: init,
        
        /** Destroy and clean up */
        destroy: destroy,
        
        /** Get current state */
        getState: function() {
            return {
                isSubmitting: state.isSubmitting,
                isFirebaseReady: state.isFirebaseReady,
                failedAttempts: state.failedAttempts,
                isLockedOut: !!(state.lockoutUntil && Date.now() < state.lockoutUntil),
                isInitialized: state.isInitialized,
            };
        },
        
        /** Check if controller is initialized */
        isInitialized: function() {
            return state.isInitialized;
        },
        
        /** Manually trigger login with credentials */
        login: async function(credentials) {
            if (elements.email) elements.email.value = credentials.email || '';
            if (elements.password) elements.password.value = credentials.password || '';
            if (elements.form) {
                elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        },
    });
    
    return publicAPI;
    
})(); // End of LoginController IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            LoginController.init().catch(function(error) {
                console.error('[LoginController] Auto-init failed:', error);
            });
        });
    } else {
        // DOM already loaded
        LoginController.init().catch(function(error) {
            console.error('[LoginController] Auto-init failed:', error);
        });
    }
}

// =============================================================================
// EXPORTS - Dual export strategy (Global + ES Module)
// =============================================================================

// Global namespace export
if (typeof window !== 'undefined') {
    window.LoginController = LoginController;
    window.Global = window.Global || {};
    window.Global.LoginController = LoginController;
}

// ES Module export (for bundlers)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginController;
}
