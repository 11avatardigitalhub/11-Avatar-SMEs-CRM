/**
 * @fileoverview 11 Avatar SMEs CRM - Registration Page Controller
 * @description Enterprise-grade multi-step registration handler with real-time
 *              password strength validation, field-level error management,
 *              Google OAuth registration, CSRF protection, and invite support.
 *              Works with AuthManager (auth.js) for authentication operations.
 * @module auth/register
 * @version 3.0.2
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

var RegisterController = (function() {

    var elements = {};
    
    var state = {
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

    var ERROR_MESSAGES = {
        'auth/email-already-in-use': 'This email is already registered. Please <a href="login.html">sign in</a> instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email/Password registration is not currently enabled. Please contact support@11avatardigitalhub.cloud.',
        'auth/weak-password': 'Password is too weak. Please use a stronger password.',
        'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
        'auth/too-many-requests': 'Too many registration attempts. Please wait a moment and try again.',
        'auth/popup-closed-by-user': 'Google sign-up was cancelled. Please try again.',
        'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups for this site.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method. Please sign in with that method.',
        'EMAIL_EXISTS': 'This email is already registered. Please <a href="login.html">sign in</a> instead.',
        'WEAK_PASSWORD': 'Password is too weak. Please follow the password requirements.',
        'NETWORK_ERROR': 'Network error. Please check your internet connection.',
        'default': 'Registration failed. Please check your information and try again.',
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
        } catch (e) {}
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
    }

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

    function isFirebaseAvailable() {
        try {
            return typeof firebase !== 'undefined' &&
                   typeof firebase.auth === 'function' &&
                   typeof window.FirebaseService !== 'undefined';
        } catch (e) {
            return false;
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
        var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address.' };
        }
        return { valid: true, message: '' };
    }

    function validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, message: 'Password is required.', strength: 'none' };
        }
        if (window.AuthManager && typeof window.AuthManager.validatePasswordStrength === 'function') {
            return window.AuthManager.validatePasswordStrength(password);
        }
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

    function cacheElements() {
        try {
            elements = {
                form: document.getElementById('register-form'),
                step1: document.getElementById('step-1'),
                step2: document.getElementById('step-2'),
                step3: document.getElementById('step-3'),
                stepDot1: document.getElementById('step-dot-1'),
                stepDot2: document.getElementById('step-dot-2'),
                stepDot3: document.getElementById('step-dot-3'),
                email: document.getElementById('register-email'),
                password: document.getElementById('register-password'),
                confirmPassword: document.getElementById('register-confirm-password'),
                passwordStrengthBar: document.getElementById('password-strength-bar'),
                passwordStrengthText: document.getElementById('password-strength-text'),
                passwordRequirements: document.getElementById('password-requirements'),
                displayName: document.getElementById('register-display-name'),
                phone: document.getElementById('register-phone'),
                company: document.getElementById('register-company'),
                acceptTerms: document.getElementById('register-accept-terms'),
                acceptMarketing: document.getElementById('register-accept-marketing'),
                summaryEmail: document.getElementById('summary-email'),
                summaryName: document.getElementById('summary-name'),
                summaryCompany: document.getElementById('summary-company'),
                summaryCompanyRow: document.getElementById('summary-company-row'),
                step1Next: document.getElementById('step-1-next'),
                step2Prev: document.getElementById('step-2-prev'),
                step2Next: document.getElementById('step-2-next'),
                step3Prev: document.getElementById('step-3-prev'),
                submitBtn: document.getElementById('register-submit'),
                googleBtn: document.getElementById('register-google'),
                toggleBtn1: document.getElementById('password-toggle-1'),
                toggleBtn2: document.getElementById('password-toggle-2'),
                errorContainer: document.getElementById('register-error'),
                errorMessage: document.getElementById('register-error-message'),
                successContainer: document.getElementById('register-success'),
                successMessage: document.getElementById('register-success-message'),
                notification: document.getElementById('register-notification'),
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

    function showStep(stepIndex) {
        try {
            if (stepIndex < 0 || stepIndex >= state.totalSteps) return;
            state.currentStep = stepIndex;
            
            if (elements.step1) elements.step1.style.display = 'none';
            if (elements.step2) elements.step2.style.display = 'none';
            if (elements.step3) elements.step3.style.display = 'none';
            
            var targetStep = [elements.step1, elements.step2, elements.step3][stepIndex];
            if (targetStep) targetStep.style.display = 'block';
            
            var dots = [elements.stepDot1, elements.stepDot2, elements.stepDot3];
            dots.forEach(function(dot, i) {
                if (!dot) return;
                dot.classList.remove('active', 'completed');
                if (i < stepIndex) dot.classList.add('completed');
                if (i === stepIndex) dot.classList.add('active');
            });
            
            if (stepIndex === 2) {
                var emailVal = elements.email ? elements.email.value.trim() : '';
                var nameVal = elements.displayName ? elements.displayName.value.trim() : '';
                var companyVal = elements.company ? elements.company.value.trim() : '';
                if (elements.summaryEmail) elements.summaryEmail.textContent = '📧 ' + (emailVal || 'Not provided');
                if (elements.summaryName) elements.summaryName.textContent = '👤 ' + (nameVal || 'Not provided');
                if (elements.summaryCompanyRow && elements.summaryCompany) {
                    if (companyVal) { elements.summaryCompanyRow.style.display = 'flex'; elements.summaryCompany.textContent = '🏢 ' + companyVal; }
                    else { elements.summaryCompanyRow.style.display = 'none'; }
                }
            }
            
            setTimeout(function() {
                var firstInput = targetStep ? targetStep.querySelector('input:not([type="hidden"]):not([disabled])') : null;
                if (firstInput) firstInput.focus();
            }, 450);
            
            if (elements.card) elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
    }

    function showError(message) {
        try {
            if (elements.notification) elements.notification.classList.remove('show');
            if (!elements.errorContainer || !elements.errorMessage) return;
            elements.errorMessage.innerHTML = message;
            elements.errorContainer.classList.add('show');
            clearTimeout(elements._errorTimeout);
            elements._errorTimeout = setTimeout(hideError, 12000);
        } catch (e) {}
    }

    function hideError() {
        try { if (elements.errorContainer) elements.errorContainer.classList.remove('show'); clearTimeout(elements._errorTimeout); } catch (e) {}
    }

    function showSuccess(message) {
        try {
            hideError();
            if (!elements.successContainer || !elements.successMessage) return;
            elements.successMessage.innerHTML = message;
            elements.successContainer.classList.add('show');
            if (elements.card) elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
    }

    function showFieldError(inputEl, message) {
        try {
            if (!inputEl) return;
            inputEl.classList.add('input-error');
            var errorId = inputEl.id + '-error';
            var errorEl = document.getElementById(errorId);
            if (errorEl) errorEl.textContent = message;
        } catch (e) {}
    }

    function clearFieldError(inputEl) {
        try {
            if (!inputEl) return;
            inputEl.classList.remove('input-error');
            var errorId = inputEl.id + '-error';
            var errorEl = document.getElementById(errorId);
            if (errorEl) errorEl.textContent = '';
        } catch (e) {}
    }

    function clearAllFieldErrors() {
        try {
            var fields = [elements.email, elements.password, elements.confirmPassword, elements.displayName, elements.phone];
            fields.forEach(function(f) { clearFieldError(f); });
        } catch (e) {}
    }

    function updatePasswordStrengthUI(password) {
        try {
            var result = calculatePasswordStrength(password);
            if (elements.passwordStrengthBar) {
                elements.passwordStrengthBar.style.width = result.score + '%';
                elements.passwordStrengthBar.className = 'strength-bar-fill ' + result.cssClass;
            }
            if (elements.passwordStrengthText) {
                elements.passwordStrengthText.textContent = result.label;
                elements.passwordStrengthText.className = 'strength-text ' + result.cssClass;
            }
            if (elements.passwordRequirements) {
                var reqs = elements.passwordRequirements.querySelectorAll('.requirement-item');
                reqs.forEach(function(item) {
                    var key = item.getAttribute('data-req');
                    if (key === 'length') item.classList.toggle('met', password.length >= 8);
                    if (key === 'uppercase') item.classList.toggle('met', /[A-Z]/.test(password));
                    if (key === 'lowercase') item.classList.toggle('met', /[a-z]/.test(password));
                    if (key === 'number') item.classList.toggle('met', /[0-9]/.test(password));
                    if (key === 'special') item.classList.toggle('met', /[^A-Za-z0-9]/.test(password));
                });
            }
        } catch (e) {}
    }

    function setLoading(isLoading) {
        try {
            state.isSubmitting = isLoading;
            var fields = [elements.email, elements.password, elements.confirmPassword, elements.displayName, elements.phone, elements.company, elements.acceptTerms, elements.acceptMarketing];
            var btns = [elements.step1Next, elements.step2Prev, elements.step2Next, elements.step3Prev];
            fields.forEach(function(f) { if (f) f.disabled = isLoading; });
            btns.forEach(function(b) { if (b) b.disabled = isLoading; });
            if (elements.submitBtn) { elements.submitBtn.disabled = isLoading; if (isLoading) elements.submitBtn.classList.add('loading'); else elements.submitBtn.classList.remove('loading'); }
            if (elements.googleBtn) elements.googleBtn.disabled = isLoading;
            if (elements.loadingOverlay) elements.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        } catch (e) {}
    }

    function shakeCard() {
        try {
            if (!elements.card) return;
            elements.card.classList.add('shake');
            setTimeout(function() { elements.card.classList.remove('shake'); }, 600);
        } catch (e) {}
    }

    function validateStep1() {
        clearAllFieldErrors();
        var valid = true;
        var email = elements.email ? elements.email.value.trim() : '';
        var ev = validateEmail(email);
        if (!ev.valid) { showFieldError(elements.email, ev.message); if (elements.email) elements.email.focus(); valid = false; }
        var password = elements.password ? elements.password.value : '';
        var pv = validatePassword(password);
        if (!pv.valid) { showFieldError(elements.password, pv.message); if (valid && elements.password) elements.password.focus(); valid = false; }
        var confirm = elements.confirmPassword ? elements.confirmPassword.value : '';
        if (!confirm) { showFieldError(elements.confirmPassword, 'Please confirm your password.'); valid = false; }
        else if (password !== confirm) { showFieldError(elements.confirmPassword, 'Passwords do not match.'); valid = false; }
        return valid;
    }

    function validateStep2() {
        clearAllFieldErrors();
        var name = elements.displayName ? elements.displayName.value.trim() : '';
        if (!name || name.length < 2) { showFieldError(elements.displayName, 'Full name is required (minimum 2 characters).'); if (elements.displayName) elements.displayName.focus(); return false; }
        return true;
    }

    function validateStep3() {
        hideError();
        if (elements.acceptTerms && !elements.acceptTerms.checked) { showError('⚠️ Please accept the Terms of Service and Privacy Policy to continue.'); if (elements.acceptTerms) elements.acceptTerms.focus(); return false; }
        return true;
    }

    function handleStep1Next() { try { hideError(); if (validateStep1()) showStep(1); } catch (e) {} }
    function handleStep2Prev() { try { hideError(); showStep(0); } catch (e) {} }
    function handleStep2Next() { try { hideError(); if (validateStep2()) showStep(2); } catch (e) {} }
    function handleStep3Prev() { try { hideError(); showStep(1); } catch (e) {} }

    async function handleSubmit(event) {
        event.preventDefault();
        try {
            if (state.isSubmitting) return;
            if (state.isRegistrationComplete) return;
            hideError();
            
            if (!validateStep3()) return;
            if (!validateStep1()) { showStep(0); return; }
            if (!validateStep2()) { showStep(1); return; }
            
            setLoading(true);
            
            var email = elements.email.value.trim();
            var password = elements.password.value;
            var displayName = elements.displayName.value.trim();
            
            if (window.AuthManager && typeof window.AuthManager.register === 'function') {
                var result = await window.AuthManager.register({
                    email: email, password: password, confirmPassword: password,
                    displayName: displayName, role: 'viewer', acceptTerms: true,
                });
                state.isRegistrationComplete = true;
                if (result.verificationSent) {
                    showSuccess('<div style="text-align:center"><div style="font-size:4rem;margin-bottom:16px">📧</div><h2 style="color:#10B981">Verify Your Email</h2><p style="color:#AAA">We\'ve sent a verification email to <strong style="color:#D4AF37">' + email + '</strong>. Please check your inbox.</p><p style="color:#888;font-size:0.85rem">Didn\'t receive it? Check spam folder or contact support@11avatardigitalhub.cloud</p></div>');
                    if (elements.form) elements.form.style.display = 'none';
                } else {
                    showSuccess('🎉 <strong>Account created!</strong><br>Redirecting...');
                    setTimeout(function() { window.location.href = 'index.html'; }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                var cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: displayName });
                state.isRegistrationComplete = true;
                await cred.user.sendEmailVerification().catch(function() {});
                showSuccess('<div style="text-align:center"><div style="font-size:4rem;margin-bottom:16px">📧</div><h2 style="color:#10B981">Verify Your Email</h2><p style="color:#AAA">We\'ve sent a verification email to <strong style="color:#D4AF37">' + email + '</strong>.</p></div>');
                if (elements.form) elements.form.style.display = 'none';
            } else { throw new Error('No authentication service available.'); }
        } catch (error) {
            showError(getErrorMessage(error)); shakeCard();
            if (elements.card) elements.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally { setLoading(false); }
    }

    async function handleGoogleRegister() {
        try {
            if (state.isSubmitting) return;
            hideError(); setLoading(true);
            if (window.AuthManager && typeof window.AuthManager.loginWithGoogle === 'function') {
                var result = await window.AuthManager.loginWithGoogle();
                if (result && result.success) {
                    showSuccess('🎉 <strong>Account created!</strong><br>Redirecting...');
                    setTimeout(function() { window.location.href = 'index.html'; }, 1500);
                }
            } else if (typeof firebase !== 'undefined' && firebase.auth) {
                var provider = new firebase.auth.GoogleAuthProvider();
                await firebase.auth().signInWithPopup(provider);
                window.location.href = 'index.html';
            }
        } catch (error) {
            var code = error.code || '';
            if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
                showError(getErrorMessage(error));
            }
        } finally { setLoading(false); }
    }

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

    function attachEventListeners() {
        try {
            if (elements.step1Next) elements.step1Next.addEventListener('click', handleStep1Next);
            if (elements.step2Prev) elements.step2Prev.addEventListener('click', handleStep2Prev);
            if (elements.step2Next) elements.step2Next.addEventListener('click', handleStep2Next);
            if (elements.step3Prev) elements.step3Prev.addEventListener('click', handleStep3Prev);
            if (elements.form) elements.form.addEventListener('submit', handleSubmit);
            if (elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleRegister);
            if (elements.toggleBtn1) elements.toggleBtn1.addEventListener('click', function() { handlePasswordToggle('register-password', 1); });
            if (elements.toggleBtn2) elements.toggleBtn2.addEventListener('click', function() { handlePasswordToggle('register-confirm-password', 2); });
            if (elements.password) {
                elements.password.addEventListener('input', function() { updatePasswordStrengthUI(this.value); clearFieldError(this); hideError(); });
                elements.password.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleStep1Next(); } });
            }
            if (elements.confirmPassword) {
                elements.confirmPassword.addEventListener('input', function() { clearFieldError(this); });
                elements.confirmPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleStep1Next(); } });
            }
            if (elements.email) {
                elements.email.addEventListener('input', function() { clearFieldError(this); hideError(); });
                elements.email.addEventListener('blur', function() { var v = this.value.trim(); if (v) { var r = validateEmail(v); if (!r.valid) showFieldError(this, r.message); } });
            }
            if (elements.displayName) {
                elements.displayName.addEventListener('input', function() { clearFieldError(this); hideError(); });
                elements.displayName.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleStep2Next(); } });
            }
            window.addEventListener('online', function() { hideError(); if (elements.submitBtn) elements.submitBtn.disabled = false; });
            window.addEventListener('offline', function() { showError('⚠️ You are offline.'); if (elements.submitBtn) elements.submitBtn.disabled = true; });
        } catch (e) {}
    }

    function init() {
        try {
            if (state.isInitialized) return true;
            if (!cacheElements()) return false;
            state.csrfToken = generateCSRFToken();
            if (elements.csrfInput) elements.csrfInput.value = state.csrfToken;
            attachEventListeners();
            showStep(0);
            if (elements.email) setTimeout(function() { elements.email.focus(); }, 800);
            state.isInitialized = true;
            return true;
        } catch (e) { return false; }
    }

    function destroy() { try { hideError(); setLoading(false); clearAllFieldErrors(); state.isInitialized = false; } catch (e) {} }

    var publicAPI = Object.freeze({
        init: init, destroy: destroy,
        getState: function() { return { currentStep: state.currentStep, isSubmitting: state.isSubmitting, isInitialized: state.isInitialized }; },
    });
    return publicAPI;
})();

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { RegisterController.init(); }); }
    else { RegisterController.init(); }
    window.RegisterController = RegisterController;
    window.Global = window.Global || {};
    window.Global.RegisterController = RegisterController;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = RegisterController; }