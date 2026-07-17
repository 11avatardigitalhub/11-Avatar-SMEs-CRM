/**
 * @fileoverview 11 Avatar SMEs CRM - Login Page Controller
 * @description Enterprise-grade login page handler with form validation,
 *              error management, loading states, Google OAuth, lockout timer,
 *              CSRF protection, and session-aware redirects.
 *              Works with AuthManager (auth.js) for state management.
 * @module auth/login
 * @version 3.0.2
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

var LoginController = (function() {

    var elements = {};
    
    var state = {
        isSubmitting: false,
        isFirebaseReady: false,
        failedAttempts: 0,
        lockoutUntil: null,
        lockoutTimerInterval: null,
        isPasswordVisible: false,
        csrfToken: '',
        isInitialized: false,
    };

    var ERROR_MESSAGES = {
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
    };

    var REDIRECT_MAP = {
        'dashboard': 'index.html',
        'leads': 'leads.html',
        'clients': 'clients.html',
        'pipeline': 'pipeline.html',
        'invoices': 'invoices.html',
        'payments': 'payments.html',
        'tasks': 'tasks.html',
        'projects': 'projects.html',
        'whatsapp': 'whatsapp.html',
        'settings': 'settings.html',
        'default': 'index.html',
    };

    function generateCSRFToken() {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                var array = new Uint32Array(8);
                crypto.getRandomValues(array);
                return Array.from(array, function(dec) {
                    return ('00000000' + dec.toString(16)).slice(-8);
                }).join('');
            }
        } catch (error) {}
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
    }

    function getErrorMessage(error) {
        try {
            if (!error) return ERROR_MESSAGES['default'];
            var code = error.code || '';
            var message = error.message || '';
            if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
            if (message.indexOf('user-not-found') !== -1) return ERROR_MESSAGES['auth/user-not-found'];
            if (message.indexOf('wrong-password') !== -1) return ERROR_MESSAGES['auth/wrong-password'];
            if (message.indexOf('invalid-credential') !== -1) return ERROR_MESSAGES['auth/invalid-credential'];
            if (message.indexOf('too-many-requests') !== -1) return ERROR_MESSAGES['auth/too-many-requests'];
            if (message.indexOf('network') !== -1) return ERROR_MESSAGES['auth/network-request-failed'];
            return ERROR_MESSAGES['default'];
        } catch (e) {
            return ERROR_MESSAGES['default'];
        }
    }

    function isFirebaseAvailable() {
        try {
            return typeof firebase !== 'undefined' &&
                   typeof firebase.auth === 'function' &&
                   typeof window.FirebaseService !== 'undefined';
        } catch (error) {
            return false;
        }
    }

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

    function validateEmail(email) {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return { valid: false, message: 'Email address is required.' };
        }
        var trimmed = email.trim();
        if (trimmed.length > 254) {
            return { valid: false, message: 'Email address is too long.' };
        }
        var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        return { valid: true, message: '' };
    }

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

    function showError(message) {
        try {
            hideNotification();
            hideLockout();
            if (!elements.errorContainer || !elements.errorMessage) return;
            elements.errorMessage.textContent = message;
            elements.errorContainer.classList.add('show');
            elements.errorContainer.style.animation = 'none';
            void elements.errorContainer.offsetHeight;
            elements.errorContainer.style.animation = '';
            elements.errorContainer.setAttribute('aria-live', 'assertive');
            clearTimeout(elements._errorTimeout);
            elements._errorTimeout = setTimeout(hideError, 12000);
        } catch (error) {
            console.error('[LoginController] Error showing error:', error);
        }
    }

    function hideError() {
        try {
            if (elements.errorContainer) {
                elements.errorContainer.classList.remove('show');
            }
            clearTimeout(elements._errorTimeout);
        } catch (error) {}
    }

    function showLockout(remainingSeconds) {
        try {
            hideError();
            hideNotification();
            if (!elements.lockoutContainer) return;
            elements.lockoutContainer.classList.add('show');
            updateLockoutTimer(remainingSeconds);
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

    function updateLockoutTimer(seconds) {
        try {
            if (!elements.lockoutTimer) return;
            var minutes = Math.floor(seconds / 60);
            var secs = seconds % 60;
            var display = minutes > 0 
                ? minutes + ' minute' + (minutes !== 1 ? 's' : '') + ' ' + secs + ' second' + (secs !== 1 ? 's' : '')
                : secs + ' second' + (secs !== 1 ? 's' : '');
            elements.lockoutTimer.textContent = display;
            if (elements.lockoutMessage) {
                elements.lockoutMessage.textContent = '⏳ Too many failed attempts. Please wait ';
            }
        } catch (error) {}
    }

    function hideLockout() {
        try {
            if (elements.lockoutContainer) {
                elements.lockoutContainer.classList.remove('show');
            }
            clearInterval(state.lockoutTimerInterval);
            state.lockoutTimerInterval = null;
        } catch (error) {}
    }

    function showNotification(message, type) {
        try {
            hideError();
            hideLockout();
            if (!elements.notification) return;
            elements.notification.classList.remove('notification-success', 'notification-info', 'notification-warning');
            var typeClass = 'notification-' + (type || 'info');
            elements.notification.classList.add(typeClass);
            elements.notification.classList.add('show');
            elements.notification.textContent = message;
            elements.notification.style.animation = 'none';
            void elements.notification.offsetHeight;
            elements.notification.style.animation = '';
            clearTimeout(elements._notificationTimeout);
            elements._notificationTimeout = setTimeout(hideNotification, 8000);
        } catch (error) {
            console.error('[LoginController] Error showing notification:', error);
        }
    }

    function hideNotification() {
        try {
            if (elements.notification) {
                elements.notification.classList.remove('show', 'notification-success', 'notification-info', 'notification-warning');
            }
            clearTimeout(elements._notificationTimeout);
        } catch (error) {}
    }

    function showFieldError(inputElement, message) {
        try {
            if (!inputElement) return;
            inputElement.classList.add('input-error');
            inputElement.setAttribute('aria-invalid', 'true');
            var errorId = inputElement.id + '-error';
            var errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.textContent = message;
            } else {
                errorElement = document.createElement('div');
                errorElement.id = errorId;
                errorElement.className = 'field-error';
                errorElement.setAttribute('role', 'alert');
                errorElement.setAttribute('aria-live', 'polite');
                errorElement.textContent = message;
                inputElement.parentElement.appendChild(errorElement);
            }
            var describedBy = inputElement.getAttribute('aria-describedby') || '';
            if (describedBy.indexOf(errorId) === -1) {
                inputElement.setAttribute('aria-describedby', 
                    describedBy ? describedBy + ' ' + errorId : errorId);
            }
        } catch (error) {
            console.error('[LoginController] Error showing field error:', error);
        }
    }

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
        } catch (error) {}
    }

    function clearAllFieldErrors() {
        try {
            if (elements.email) clearFieldError(elements.email);
            if (elements.password) clearFieldError(elements.password);
            var allErrors = document.querySelectorAll('.field-error');
            allErrors.forEach(function(el) {
                el.textContent = '';
            });
        } catch (error) {}
    }

    function setLoading(isLoading) {
        try {
            state.isSubmitting = isLoading;
            if (isLoading) {
                if (elements.email) elements.email.disabled = true;
                if (elements.password) elements.password.disabled = true;
                if (elements.remember) elements.remember.disabled = true;
                if (elements.toggleBtn) elements.toggleBtn.disabled = true;
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = true;
                    elements.submitBtn.setAttribute('aria-busy', 'true');
                    elements.submitBtn.classList.add('loading');
                }
                if (elements.googleBtn) {
                    elements.googleBtn.disabled = true;
                }
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'flex';
                    elements.loadingOverlay.setAttribute('aria-busy', 'true');
                }
            } else {
                if (elements.email) elements.email.disabled = false;
                if (elements.password) elements.password.disabled = false;
                if (elements.remember) elements.remember.disabled = false;
                if (elements.toggleBtn) elements.toggleBtn.disabled = false;
                if (elements.submitBtn) {
                    elements.submitBtn.disabled = false;
                    elements.submitBtn.removeAttribute('aria-busy');
                    elements.submitBtn.classList.remove('loading');
                }
                if (elements.googleBtn) {
                    elements.googleBtn.disabled = false;
                }
                if (elements.loadingOverlay) {
                    elements.loadingOverlay.style.display = 'none';
                    elements.loadingOverlay.removeAttribute('aria-busy');
                }
            }
        } catch (error) {
            console.error('[LoginController] Error setting loading state:', error);
        }
    }

    function disableForm() {
        try {
            if (elements.email) elements.email.disabled = true;
            if (elements.password) elements.password.disabled = true;
            if (elements.remember) elements.remember.disabled = true;
            if (elements.toggleBtn) elements.toggleBtn.disabled = true;
            if (elements.submitBtn) elements.submitBtn.disabled = true;
            if (elements.googleBtn) elements.googleBtn.disabled = true;
        } catch (error) {}
    }

    function enableForm() {
        try {
            if (elements.email) elements.email.disabled = false;
            if (elements.password) elements.password.disabled = false;
            if (elements.remember) elements.remember.disabled = false;
            if (elements.toggleBtn) elements.toggleBtn.disabled = false;
            if (elements.submitBtn) elements.submitBtn.disabled = false;
            if (elements.googleBtn) elements.googleBtn.disabled = false;
        } catch (error) {}
    }

    function shakeCard() {
        try {
            if (!elements.card) return;
            elements.card.classList.add('shake');
            setTimeout(function() {
                elements.card.classList.remove('shake');
            }, 600);
        } catch (error) {}
    }

    async function handleEmailLogin(event) {
        event.preventDefault();
        try {
            if (state.isSubmitting) return;
            hideError();
            hideLockout();
            hideNotification();
            clearAllFieldErrors();
            
            if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
                var remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
                showLockout(remaining);
                disableForm();
                return;
            }
            
            var email = elements.email ? elements.email.value.trim() : '';
            var password = elements.password ? elements.password.value : '';
            var rememberMe = elements.remember ? elements.remember.checked : false;
            
            var emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                showFieldError(elements.email, emailValidation.message);
                elements.email.focus();
                return;
            }
            
            var passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showFieldError(elements.password, passwordValidation.message);
                elements.password.focus();
                return;
            }
            
            if (elements.csrfInput && !elements.csrfInput.value) {
                showError('Security token missing. Please refresh the page and try again.');
                return;
            }
            
            if (!isFirebaseAvailable()) {
                showError('Authentication service is initializing. Please wait a moment and try again.');
                setTimeout(function() {
                    if (isFirebaseAvailable()) hideError();
                }, 2000);
                return;
            }
            
            setLoading(true);
            
            if (window.AuthManager && typeof window.AuthManager.login === 'function') {
                await window.AuthManager.login({
                    email: email,
                    password: password,
                    rememberMe: rememberMe,
                });
            } else if (window.auth && typeof window.auth.login === 'function') {
                await window.auth.login({
                    email: email,
                    password: password,
                    rememberMe: rememberMe,
                });
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                var persistence = rememberMe
                    ? firebase.auth.Auth.Persistence.LOCAL
                    : firebase.auth.Auth.Persistence.SESSION;
                await firebase.auth().setPersistence(persistence);
                await firebase.auth().signInWithEmailAndPassword(email, password);
            } else {
                throw new Error('No authentication service available');
            }
            
            state.failedAttempts = 0;
            state.lockoutUntil = null;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log('[LoginController] Login successful:', email);
            }
            
            redirectAfterLogin();
            
        } catch (error) {
            state.failedAttempts++;
            
            if (state.failedAttempts >= 5) {
                var lockoutSeconds = Math.min(state.failedAttempts * 30, 900);
                state.lockoutUntil = Date.now() + (lockoutSeconds * 1000);
                showLockout(lockoutSeconds);
                disableForm();
            } else {
                var message = getErrorMessage(error);
                showError(message);
                shakeCard();
                
                var errorCode = error.code || '';
                if (errorCode.indexOf('password') !== -1 || errorCode.indexOf('credential') !== -1) {
                    if (elements.password) {
                        elements.password.focus();
                        elements.password.select();
                    }
                } else if (errorCode.indexOf('user') !== -1 || errorCode.indexOf('email') !== -1) {
                    if (elements.email) {
                        elements.email.focus();
                        elements.email.select();
                    }
                }
            }
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.error('[LoginController] Login failed:', error.code, error.message);
            }
            
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin(event) {
        event.preventDefault();
        try {
            if (state.isSubmitting) return;
            
            if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
                var remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
                showLockout(remaining);
                return;
            }
            
            hideError();
            hideNotification();
            
            if (!isFirebaseAvailable()) {
                showError('Authentication service is initializing. Please try again.');
                return;
            }
            
            setLoading(true);
            
            if (window.AuthManager && typeof window.AuthManager.loginWithGoogle === 'function') {
                await window.AuthManager.loginWithGoogle();
            } else if (window.auth && typeof window.auth.loginWithGoogle === 'function') {
                await window.auth.loginWithGoogle();
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                var provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('profile');
                provider.addScope('email');
                provider.setCustomParameters({ prompt: 'select_account' });
                await firebase.auth().signInWithPopup(provider);
            } else {
                throw new Error('No authentication service available');
            }
            
            state.failedAttempts = 0;
            state.lockoutUntil = null;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log('[LoginController] Google login successful');
            }
            
            redirectAfterLogin();
            
        } catch (error) {
            var code = error.code || '';
            if (code === 'auth/popup-closed-by-user' || 
                code === 'auth/cancelled-popup-request' ||
                code === 'POPUP_CLOSED' ||
                code === 'POPUP_CANCELLED') {
                return;
            }
            
            var message = getErrorMessage(error);
            showError(message);
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.error('[LoginController] Google login failed:', error.code, error.message);
            }
            
        } finally {
            setLoading(false);
        }
    }

    function handlePasswordToggle() {
        try {
            if (!elements.password) return;
            state.isPasswordVisible = !state.isPasswordVisible;
            elements.password.type = state.isPasswordVisible ? 'text' : 'password';
            if (elements.toggleBtn) {
                elements.toggleBtn.setAttribute('aria-label', 
                    state.isPasswordVisible ? 'Hide password' : 'Show password');
            }
            elements.password.focus();
        } catch (error) {
            console.error('[LoginController] Error toggling password:', error);
        }
    }

    function redirectAfterLogin() {
        try {
            var redirectUrl = sessionStorage.getItem('login_redirect');
            sessionStorage.removeItem('login_redirect');
            
            if (!redirectUrl) {
                var params = getHashParams();
                var redirectParam = params.get('redirect');
                if (redirectParam && REDIRECT_MAP[redirectParam]) {
                    redirectUrl = REDIRECT_MAP[redirectParam];
                }
            }
            
            if (!redirectUrl) {
                redirectUrl = REDIRECT_MAP['default'];
            }
            
            if (redirectUrl.indexOf('.html') === -1 && redirectUrl.indexOf('http') === -1) {
                redirectUrl = redirectUrl + '.html';
            }
            
            showNotification('✅ Login successful! Redirecting...', 'success');
            
            setTimeout(function() {
                window.location.href = redirectUrl;
            }, 800);
            
        } catch (error) {
            window.location.href = 'index.html';
        }
    }

    function attachEventListeners() {
        try {
            if (elements.form) {
                elements.form.addEventListener('submit', handleEmailLogin);
                elements.form.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' && event.target.tagName !== 'INPUT') {
                        event.preventDefault();
                    }
                });
            }
            
            if (elements.googleBtn) {
                elements.googleBtn.addEventListener('click', handleGoogleLogin);
            }
            
            if (elements.toggleBtn) {
                elements.toggleBtn.addEventListener('click', handlePasswordToggle);
            }
            
            if (elements.email) {
                elements.email.addEventListener('blur', function() {
                    var value = elements.email.value.trim();
                    if (value) {
                        var validation = validateEmail(value);
                        if (!validation.valid) {
                            showFieldError(elements.email, validation.message);
                        }
                    }
                });
                elements.email.addEventListener('input', function() {
                    clearFieldError(elements.email);
                    hideError();
                });
            }
            
            if (elements.password) {
                elements.password.addEventListener('blur', function() {
                    var value = elements.password.value;
                    if (value) {
                        var validation = validatePassword(value);
                        if (!validation.valid) {
                            showFieldError(elements.password, validation.message);
                        }
                    }
                });
                elements.password.addEventListener('input', function() {
                    clearFieldError(elements.password);
                    hideError();
                });
                elements.password.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter' && elements.form) {
                        event.preventDefault();
                        elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                });
            }
            
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    setLoading(false);
                    hideError();
                    hideLockout();
                    state.isSubmitting = false;
                }
            });
            
            window.addEventListener('online', function() {
                hideError();
                hideLockout();
                enableForm();
            });
            
            window.addEventListener('offline', function() {
                showError('⚠️ You are offline. Please check your internet connection.');
                disableForm();
            });
            
            if (!navigator.onLine) {
                showError('⚠️ You are offline. Please check your internet connection.');
                disableForm();
            }
            
        } catch (error) {
            console.error('[LoginController] Error attaching event listeners:', error);
        }
    }

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
        } catch (error) {}
    }

    function handleURLParams() {
        try {
            var params = getHashParams();
            var reason = params.get('reason');
            if (!reason) return;
            
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
        } catch (error) {}
    }

    function setCSRFToken() {
        try {
            state.csrfToken = generateCSRFToken();
            if (elements.csrfInput) {
                elements.csrfInput.value = state.csrfToken;
            }
            sessionStorage.setItem('csrf_token', state.csrfToken);
        } catch (error) {}
    }

    function restoreSavedEmail() {
        try {
            var savedEmail = localStorage.getItem('11avatar_last_email');
            if (savedEmail && elements.email && !elements.email.value) {
                elements.email.value = savedEmail;
                var rememberMe = localStorage.getItem('11avatar_remember_me');
                if (rememberMe === 'true' && elements.remember) {
                    elements.remember.checked = true;
                }
            }
        } catch (error) {}
    }

    async function waitForFirebase(timeout) {
        var maxWait = timeout || 10000;
        var startTime = Date.now();
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

    async function init() {
        try {
            if (state.isInitialized) return true;
            if (!cacheElements()) return false;
            
            setCSRFToken();
            restoreSavedEmail();
            handleURLParams();
            attachEventListeners();
            
            waitForFirebase(8000).then(function(ready) {
                if (ready) {
                    if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                        console.log('[LoginController] Firebase services ready');
                    }
                } else {
                    console.warn('[LoginController] Firebase services not ready - will retry on submit');
                }
            });
            
            if (elements.email) {
                setTimeout(function() {
                    elements.email.focus();
                }, 800);
            }
            
            state.isInitialized = true;
            
            if (window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
                console.log(
                    '%c[LoginController] %cInitialized %cv3.0.2',
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
        } catch (error) {}
    }

    var publicAPI = Object.freeze({
        init: init,
        destroy: destroy,
        getState: function() {
            return {
                isSubmitting: state.isSubmitting,
                isFirebaseReady: state.isFirebaseReady,
                failedAttempts: state.failedAttempts,
                isLockedOut: !!(state.lockoutUntil && Date.now() < state.lockoutUntil),
                isInitialized: state.isInitialized,
            };
        },
        isInitialized: function() {
            return state.isInitialized;
        },
    });
    
    return publicAPI;
    
})();

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            LoginController.init().catch(function(error) {
                console.error('[LoginController] Auto-init failed:', error);
            });
        });
    } else {
        LoginController.init().catch(function(error) {
            console.error('[LoginController] Auto-init failed:', error);
        });
    }
}

if (typeof window !== 'undefined') {
    window.LoginController = LoginController;
    window.Global = window.Global || {};
    window.Global.LoginController = LoginController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginController;
}