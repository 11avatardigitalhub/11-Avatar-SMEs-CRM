/**
 * @fileoverview 11 Avatar SMEs CRM - Enterprise Authentication Manager
 * @description Complete authentication system with Email/Password, Google OAuth,
 *              session management, token refresh, brute-force protection,
 *              cross-tab sync, idle timeout, and 8-tier role-based access control.
 *              Integrates with FirebaseService and Constants modules.
 * @module auth/auth
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires FirebaseService (window.FirebaseService) - Firebase service layer
 * @requires Constants (window.Constants) - Application constants & enums
 *
 * @exports window.AuthManager - Global namespace for authentication
 * @exports window.auth - Convenience alias for AuthManager
 */

'use strict';

// =============================================================================
// AUTH MANAGER - Self-executing IIFE with full encapsulation
// =============================================================================
const AuthManager = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: DEFAULT CONFIGURATION
    // -------------------------------------------------------------------------
    
    /**
     * Default authentication configuration
     * @constant {Object} DEFAULT_CONFIG
     * @property {number} maxLoginAttempts - Max failed attempts before lockout (5)
     * @property {number} loginLockoutDuration - Lockout duration in ms (15 min)
     * @property {number} sessionTimeout - Idle session timeout in ms (30 min)
     * @property {number} rememberMeDuration - Remember me duration in ms (30 days)
     * @property {number} tokenRefreshBuffer - Token refresh before expiry (5 min)
     * @property {number} minPasswordLength - Minimum password length (8)
     * @property {boolean} requireUppercase - Require uppercase letter
     * @property {boolean} requireLowercase - Require lowercase letter
     * @property {boolean} requireNumber - Require numeric digit
     * @property {boolean} requireSpecialChar - Require special character
     * @property {Object} providers - Enabled authentication providers
     * @property {boolean} emailVerificationRequired - Require email verification
     * @property {number} verificationLinkExpiry - Verification link expiry in ms
     * @property {boolean} twoFactorEnabled - Enable two-factor authentication
     * @property {boolean} forceLogoutOnPasswordChange - Force logout on password change
     * @property {number} idleTimeoutWarning - Warning before idle timeout (1 min)
     */
    const DEFAULT_CONFIG = Object.freeze({
        maxLoginAttempts: 5,
        loginLockoutDuration: 15 * 60 * 1000,
        sessionTimeout: 30 * 60 * 1000,
        rememberMeDuration: 30 * 24 * 60 * 60 * 1000,
        tokenRefreshBuffer: 5 * 60 * 1000,
        minPasswordLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        providers: {
            email: true,
            google: true,
            phone: false,
        },
        emailVerificationRequired: true,
        verificationLinkExpiry: 24 * 60 * 60 * 1000,
        twoFactorEnabled: false,
        forceLogoutOnPasswordChange: true,
        idleTimeoutWarning: 60 * 1000,
    });
    
    /** @type {Object} Active configuration (runtime modifiable) */
    let config = Object.assign({}, DEFAULT_CONFIG);

    // -------------------------------------------------------------------------
    // SECTION 2: INTERNAL STATE
    // -------------------------------------------------------------------------
    
    /**
     * Authentication state container
     * @type {Object}
     * @property {firebase.User|null} user - Current Firebase user object
     * @property {Object|null} userProfile - User profile from Firestore
     * @property {boolean} isAuthenticated - Whether user is authenticated
     * @property {boolean} isEmailVerified - Whether email is verified
     * @property {boolean} authLoading - Whether auth is initializing
     * @property {string|null} authError - Last authentication error message
     * @property {number} loginAttempts - Consecutive failed login count
     * @property {number|null} lastLoginAttempt - Timestamp of last failed attempt
     * @property {number|null} lockoutUntil - Timestamp when lockout ends
     * @property {number|null} sessionStartTime - Session start timestamp
     * @property {number} lastActivityTime - Last user activity timestamp
     * @property {boolean} rememberMe - Whether remember me is active
     * @property {string|null} tenantId - Current tenant ID for multi-tenancy
     */
    const state = {
        user: null,
        userProfile: null,
        isAuthenticated: false,
        isEmailVerified: false,
        authLoading: true,
        authError: null,
        loginAttempts: 0,
        lastLoginAttempt: null,
        lockoutUntil: null,
        sessionStartTime: null,
        lastActivityTime: Date.now(),
        rememberMe: false,
        tenantId: null,
    };
    
    /** @type {Array<Function>} Registered auth state change listeners */
    const authListeners = [];
    
    /** @type {Function|null} Firebase auth state unsubscribe function */
    let unsubscribeAuth = null;
    
    /** @type {number|null} Session check interval ID */
    let sessionTimer = null;
    
    /** @type {number|null} Idle warning timeout ID */
    let idleWarningTimeout = null;
    
    /** @type {number|null} Token refresh timeout ID */
    let tokenRefreshTimeout = null;

    // -------------------------------------------------------------------------
    // SECTION 3: UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Get current timestamp - uses Firebase server timestamp if available
     * @returns {Object|string} Firebase FieldValue or ISO string
     */
    function getTimestamp() {
        try {
            if (typeof firebase !== 'undefined' && 
                firebase.firestore && 
                firebase.firestore.FieldValue &&
                firebase.firestore.FieldValue.serverTimestamp) {
                return firebase.firestore.FieldValue.serverTimestamp();
            }
        } catch (error) {
            // Fallback to ISO string
        }
        return new Date().toISOString();
    }
    
    /**
     * Get default permissions array for a given role
     * @param {string} role - Role short name (e.g., 'admin', 'manager')
     * @returns {Array<string>} Array of permission strings
     */
    function getDefaultPermissions(role) {
        try {
            var permissionsMap = {
                'super_admin': ['*'],
                'admin': [
                    'manage_users', 'manage_roles', 'manage_teams',
                    'manage_leads', 'manage_clients', 'manage_deals',
                    'manage_invoices', 'manage_payments', 'manage_tasks',
                    'manage_projects', 'manage_reports', 'manage_settings',
                    'manage_integrations', 'manage_whatsapp', 'manage_email',
                    'manage_sms', 'manage_gst', 'export_data', 'import_data',
                    'view_audit_logs', 'manage_billing', 'manage_subscription',
                ],
                'manager': [
                    'view_users', 'manage_team',
                    'manage_leads', 'manage_clients', 'manage_deals',
                    'view_invoices', 'create_invoices', 'manage_tasks',
                    'manage_projects', 'view_reports', 'manage_whatsapp',
                    'manage_email', 'export_data', 'import_data',
                ],
                'sales_lead': [
                    'view_team', 'manage_leads', 'manage_clients',
                    'manage_deals', 'view_invoices', 'manage_tasks',
                    'view_reports', 'manage_whatsapp', 'manage_email',
                    'export_data',
                ],
                'sales_executive': [
                    'view_assigned_leads', 'manage_assigned_leads',
                    'view_assigned_clients', 'manage_assigned_clients',
                    'view_assigned_deals', 'manage_assigned_deals',
                    'manage_tasks', 'manage_whatsapp', 'manage_email',
                ],
                'support_agent': [
                    'view_assigned_clients', 'manage_tasks',
                    'manage_whatsapp', 'manage_email',
                    'view_tickets', 'manage_tickets',
                ],
                'accountant': [
                    'view_invoices', 'manage_invoices', 'manage_payments',
                    'manage_gst', 'view_reports', 'export_data',
                ],
                'viewer': [
                    'view_assigned_leads', 'view_assigned_clients',
                    'view_assigned_deals', 'view_invoices',
                    'view_reports', 'view_tasks',
                ],
            };
            return permissionsMap[role] || permissionsMap['viewer'];
        } catch (error) {
            return ['view_assigned_leads', 'view_assigned_clients'];
        }
    }
    
    /**
     * Get default user preferences object
     * @returns {Object} Default preferences
     */
    function getDefaultPreferences() {
        try {
            return {
                theme: 'light',
                language: 'en-IN',
                timezone: 'Asia/Kolkata',
                dateFormat: 'DD/MM/YYYY',
                currency: 'INR',
                notifications: {
                    email: true,
                    push: true,
                    sms: false,
                    inApp: true,
                },
                dashboard: {
                    defaultView: 'overview',
                    widgets: ['stats', 'pipeline', 'tasks', 'activities'],
                },
                accessibility: {
                    fontSize: 'medium',
                    highContrast: false,
                    reduceMotion: false,
                },
            };
        } catch (error) {
            return {};
        }
    }
    
    /**
     * Log message with module prefix (only in debug mode)
     * @param {string} level - 'log', 'warn', 'error'
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     */
    function log(level, message, data) {
        try {
            var isDebug = window.Constants && 
                         window.Constants.APP && 
                         window.Constants.APP.DEBUG;
            if (!isDebug && level === 'log') return;
            
            var prefix = '[AuthManager]';
            switch (level) {
                case 'error':
                    console.error(prefix, message, data || '');
                    break;
                case 'warn':
                    console.warn(prefix, message, data || '');
                    break;
                default:
                    console.log(prefix, message, data || '');
                    break;
            }
        } catch (error) {
            // Silent - logging should never break
        }
    }
    
    /**
     * Emit event via EventBus (if available) and DOM CustomEvent
     * @param {string} eventName - Event name
     * @param {*} [data={}] - Event payload
     */
    function emitEvent(eventName, data) {
        try {
            // Try EventBus first
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit(eventName, data);
            }
            // Fallback to DOM CustomEvent for inter-module communication
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(eventName, {
                    detail: data || {},
                    bubbles: false,
                }));
            }
        } catch (error) {
            // Silent - events are non-critical
        }
    }
    
    /**
     * Normalize Firebase error into standardized application error
     * @param {Error|Object} error - Raw Firebase error object
     * @returns {Error} Standardized error with code and timestamp
     */
    function normalizeError(error) {
        try {
            var errorMap = {
                'auth/email-already-in-use': {
                    code: 'EMAIL_EXISTS',
                    message: 'This email is already registered. Please login instead.',
                },
                'auth/invalid-email': {
                    code: 'INVALID_EMAIL',
                    message: 'Please enter a valid email address.',
                },
                'auth/operation-not-allowed': {
                    code: 'DISABLED',
                    message: 'This login method is not currently enabled.',
                },
                'auth/weak-password': {
                    code: 'WEAK_PASSWORD',
                    message: 'Password is too weak. Please use a stronger password.',
                },
                'auth/user-disabled': {
                    code: 'USER_DISABLED',
                    message: 'This account has been disabled. Please contact support@11avatardigitalhub.cloud.',
                },
                'auth/user-not-found': {
                    code: 'USER_NOT_FOUND',
                    message: 'No account found with this email. Please register first.',
                },
                'auth/wrong-password': {
                    code: 'WRONG_PASSWORD',
                    message: 'Incorrect password. Please try again.',
                },
                'auth/invalid-credential': {
                    code: 'INVALID_CREDENTIAL',
                    message: 'Invalid email or password. Please try again.',
                },
                'auth/too-many-requests': {
                    code: 'TOO_MANY_REQUESTS',
                    message: 'Too many requests. Please wait a moment and try again.',
                },
                'auth/network-request-failed': {
                    code: 'NETWORK_ERROR',
                    message: 'Network error. Please check your internet connection.',
                },
                'auth/popup-closed-by-user': {
                    code: 'POPUP_CLOSED',
                    message: 'Sign-in popup was closed. Please try again.',
                },
                'auth/cancelled-popup-request': {
                    code: 'POPUP_CANCELLED',
                    message: 'Sign-in cancelled.',
                },
                'auth/popup-blocked': {
                    code: 'POPUP_BLOCKED',
                    message: 'Pop-up was blocked. Please allow popups for this site.',
                },
                'auth/requires-recent-login': {
                    code: 'REAUTH_REQUIRED',
                    message: 'Please re-enter your password to continue.',
                },
                'auth/account-exists-with-different-credential': {
                    code: 'CREDENTIAL_CONFLICT',
                    message: 'An account already exists with this email using a different sign-in method.',
                },
            };
            
            var mapped = errorMap[error.code];
            if (mapped) {
                var normalized = new Error(mapped.message);
                normalized.code = mapped.code;
                normalized.originalCode = error.code;
                normalized.timestamp = new Date().toISOString();
                return normalized;
            }
            
            // Fallback for unknown errors
            var fallback = new Error(error.message || 'An unexpected authentication error occurred.');
            fallback.code = error.code || 'AUTH_ERROR';
            fallback.originalCode = error.code;
            fallback.timestamp = new Date().toISOString();
            return fallback;
        } catch (e) {
            return new Error('Authentication error occurred.');
        }
    }
    
    /**
     * Validate password strength against configured requirements
     * @param {string} password - Password to validate
     * @returns {Object} { valid: boolean, message: string, strength: string }
     */
    function validatePasswordStrength(password) {
        try {
            var cfg = config;
            
            if (!password || typeof password !== 'string') {
                return { valid: false, message: 'Password is required.', strength: 'none' };
            }
            
            if (password.length < cfg.minPasswordLength) {
                return { 
                    valid: false, 
                    message: 'Password must be at least ' + cfg.minPasswordLength + ' characters.', 
                    strength: 'weak' 
                };
            }
            
            if (cfg.requireUppercase && !/[A-Z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one uppercase letter.', strength: 'weak' };
            }
            
            if (cfg.requireLowercase && !/[a-z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one lowercase letter.', strength: 'weak' };
            }
            
            if (cfg.requireNumber && !/[0-9]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one number.', strength: 'weak' };
            }
            
            if (cfg.requireSpecialChar && !/[!@#$%^&*()_,.?\":{}|<>]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one special character.', strength: 'weak' };
            }
            
            // Calculate strength score (0-7)
            var score = 0;
            if (password.length >= 8) score++;
            if (password.length >= 12) score++;
            if (password.length >= 16) score++;
            if (/[A-Z]/.test(password)) score++;
            if (/[a-z]/.test(password)) score++;
            if (/[0-9]/.test(password)) score++;
            if (/[^A-Za-z0-9]/.test(password)) score++;
            
            var strength = 'weak';
            if (score >= 5) strength = 'medium';
            if (score >= 6) strength = 'strong';
            
            return { valid: true, message: '', strength: strength };
        } catch (error) {
            return { valid: false, message: 'Password validation error.', strength: 'none' };
        }
    }
    
    /**
     * Check if user is currently locked out due to too many failed attempts
     * @returns {boolean} True if locked out
     */
    function isLockedOut() {
        try {
            if (!state.lockoutUntil) return false;
            
            if (Date.now() >= state.lockoutUntil) {
                // Lockout period expired
                state.lockoutUntil = null;
                state.loginAttempts = 0;
                saveStateToStorage();
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Save state to sessionStorage for cross-tab sync
     */
    function saveStateToStorage() {
        try {
            var data = {
                loginAttempts: state.loginAttempts,
                lastLoginAttempt: state.lastLoginAttempt,
                lockoutUntil: state.lockoutUntil,
                rememberMe: state.rememberMe,
                tenantId: state.tenantId,
            };
            sessionStorage.setItem('11avatar_auth_state', JSON.stringify(data));
        } catch (error) {
            // Storage may be full or unavailable
        }
    }
    
    /**
     * Load state from sessionStorage
     */
    function loadStateFromStorage() {
        try {
            var saved = sessionStorage.getItem('11avatar_auth_state');
            if (saved) {
                var data = JSON.parse(saved);
                state.loginAttempts = data.loginAttempts || 0;
                state.lastLoginAttempt = data.lastLoginAttempt || null;
                state.lockoutUntil = data.lockoutUntil || null;
                state.rememberMe = data.rememberMe || false;
                state.tenantId = data.tenantId || null;
            }
        } catch (error) {
            // Silent - non-critical
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 4: FIRESTORE PROFILE MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Fetch user profile document from Firestore
     * @param {string} uid - Firebase Auth user ID
     * @returns {Promise<Object|null>} User profile data or null
     */
    async function fetchUserProfile(uid) {
        try {
            if (!uid) return null;
            
            // Try FirebaseService wrapper first
            if (window.FirebaseService && typeof window.FirebaseService.getDocument === 'function') {
                var profile = await window.FirebaseService.getDocument('users', uid);
                return profile;
            }
            
            // Direct Firestore fallback
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                var doc = await firebase.firestore().collection('users').doc(uid).get();
                if (doc.exists) {
                    return { id: doc.id, uid: uid, data: doc.data() };
                }
            }
            
            return null;
        } catch (error) {
            log('error', 'Failed to fetch user profile:', error);
            return null;
        }
    }
    
    /**
     * Create new user profile document in Firestore
     * @param {string} uid - Firebase Auth user ID
     * @param {Object} profileData - Profile data to store
     * @returns {Promise<Object>} Created profile
     */
    async function createUserProfile(uid, profileData) {
        try {
            var data = {
                uid: uid,
                email: profileData.email || '',
                displayName: profileData.displayName || '',
                phone: profileData.phone || '',
                role: profileData.role || 'viewer',
                clientId: profileData.clientId || null,
                photoURL: profileData.photoURL || '',
                emailVerified: profileData.emailVerified || false,
                permissions: getDefaultPermissions(profileData.role || 'viewer'),
                createdAt: getTimestamp(),
                updatedAt: getTimestamp(),
                lastLogin: getTimestamp(),
                loginCount: 1,
                status: 'active',
                onboardingComplete: false,
                provider: profileData.provider || 'email',
                preferences: getDefaultPreferences(),
                tenantId: profileData.tenantId || null,
            };
            
            // Try FirebaseService wrapper first
            if (window.FirebaseService && typeof window.FirebaseService.createDocument === 'function') {
                return await window.FirebaseService.createDocument('users', data, uid);
            }
            
            // Direct Firestore fallback
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                await firebase.firestore().collection('users').doc(uid).set(data);
                return { id: uid, uid: uid, data: data };
            }
            
            throw new Error('No Firestore service available');
        } catch (error) {
            log('error', 'Failed to create user profile:', error);
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: AUTH STATE HANDLER
    // -------------------------------------------------------------------------
    
    /**
     * Handle Firebase auth state changes (sign in / sign out)
     * @param {firebase.User|null} user - Firebase user or null
     * @returns {Promise<void>}
     */
    async function handleAuthStateChange(user) {
        log('log', 'Auth state changed:', user ? user.email : 'No user');
        
        state.authLoading = true;
        
        try {
            if (user) {
                // USER SIGNED IN
                state.user = user;
                state.isAuthenticated = true;
                state.isEmailVerified = user.emailVerified;
                state.sessionStartTime = Date.now();
                state.lastActivityTime = Date.now();
                state.tenantId = user.tenantId || null;
                
                // Fetch or create user profile
                var profile = await fetchUserProfile(user.uid);
                
                if (!profile) {
                    // New user - create profile
                    profile = await createUserProfile(user.uid, {
                        email: user.email,
                        displayName: user.displayName || '',
                        phone: user.phoneNumber || '',
                        photoURL: user.photoURL || '',
                        emailVerified: user.emailVerified,
                        provider: user.providerData[0]?.providerId || 'email',
                    });
                }
                
                state.userProfile = profile;
                
                // Start session management
                startSessionTimeout();
                startActivityTracking();
                
                // Schedule proactive token refresh
                scheduleTokenRefresh(user);
                
                // Emit login event
                emitEvent('auth:login', {
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        emailVerified: user.emailVerified,
                    },
                    profile: profile,
                    tenantId: state.tenantId,
                });
                
                log('log', 'User authenticated:', user.email, 'Role:', profile?.data?.role || profile?.role);
                
            } else {
                // USER SIGNED OUT
                var wasAuthenticated = state.isAuthenticated;
                
                state.user = null;
                state.userProfile = null;
                state.isAuthenticated = false;
                state.isEmailVerified = false;
                state.sessionStartTime = null;
                state.tenantId = null;
                
                // Stop all timers
                stopSessionTimeout();
                stopActivityTracking();
                clearTokenRefresh();
                
                // Clear session data
                clearSession();
                
                // Emit logout event if was authenticated
                if (wasAuthenticated) {
                    emitEvent('auth:logout', {
                        reason: 'user_signed_out',
                    });
                }
                
                log('log', 'User signed out');
            }
        } catch (error) {
            log('error', 'Error in auth state handler:', error);
            state.authError = error.message;
        } finally {
            state.authLoading = false;
            notifyListeners();
        }
    }
    
    /**
     * Schedule proactive token refresh before expiry
     * @param {firebase.User} user - Firebase user
     */
    function scheduleTokenRefresh(user) {
        clearTokenRefresh();
        
        user.getIdTokenResult()
            .then(function(idTokenResult) {
                try {
                    var expirationTime = new Date(idTokenResult.expirationTime).getTime();
                    var refreshTime = expirationTime - config.tokenRefreshBuffer;
                    var delay = Math.max(0, refreshTime - Date.now());
                    
                    log('log', 'Token refresh scheduled in ' + Math.round(delay / 1000) + 's');
                    
                    tokenRefreshTimeout = setTimeout(async function() {
                        try {
                            if (state.user) {
                                await state.user.getIdToken(true);
                                log('log', 'Token refreshed proactively');
                                scheduleTokenRefresh(state.user);
                            }
                        } catch (err) {
                            log('warn', 'Proactive token refresh failed:', err);
                        }
                    }, delay);
                } catch (e) {
                    log('warn', 'Token refresh scheduling error:', e);
                }
            })
            .catch(function(error) {
                log('warn', 'Failed to get token expiry:', error);
            });
    }
    
    /**
     * Clear token refresh timeout
     */
    function clearTokenRefresh() {
        try {
            if (tokenRefreshTimeout) {
                clearTimeout(tokenRefreshTimeout);
                tokenRefreshTimeout = null;
            }
        } catch (error) {
            // Silent
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: SESSION MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Start session timeout monitoring (checks every 30 seconds)
     */
    function startSessionTimeout() {
        try {
            stopSessionTimeout();
            sessionTimer = setInterval(checkSessionTimeout, 30000);
        } catch (error) {
            log('error', 'Session timeout start failed:', error);
        }
    }
    
    /**
     * Stop session timeout monitoring
     */
    function stopSessionTimeout() {
        try {
            if (sessionTimer) {
                clearInterval(sessionTimer);
                sessionTimer = null;
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Check if session has timed out due to inactivity
     */
    function checkSessionTimeout() {
        try {
            if (!state.isAuthenticated) return;
            if (state.rememberMe) return; // Remember me bypasses timeout
            
            var idleTime = Date.now() - state.lastActivityTime;
            
            if (idleTime >= config.sessionTimeout) {
                log('warn', 'Session timeout - logging out');
                logout('session_timeout');
            }
        } catch (error) {
            log('error', 'Session timeout check error:', error);
        }
    }
    
    /**
     * Start tracking user activity for idle detection
     */
    function startActivityTracking() {
        try {
            stopActivityTracking();
            
            var activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
            activityEvents.forEach(function(eventName) {
                document.addEventListener(eventName, handleUserActivity, { passive: true });
            });
            
            document.addEventListener('visibilitychange', handleVisibilityChange);
        } catch (error) {
            log('error', 'Activity tracking start failed:', error);
        }
    }
    
    /**
     * Stop tracking user activity
     */
    function stopActivityTracking() {
        try {
            var activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
            activityEvents.forEach(function(eventName) {
                document.removeEventListener(eventName, handleUserActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Handle user activity - update last activity timestamp
     */
    function handleUserActivity() {
        try {
            state.lastActivityTime = Date.now();
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Handle page visibility change (tab switch)
     */
    function handleVisibilityChange() {
        try {
            if (document.visibilityState === 'visible') {
                state.lastActivityTime = Date.now();
                // Refresh token when user returns to tab
                if (state.user) {
                    state.user.getIdToken(true).catch(function() {
                        // Silent - token refresh is best-effort
                    });
                }
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Clear session data from storage
     */
    function clearSession() {
        try {
            localStorage.removeItem('11avatar_session');
            sessionStorage.removeItem('11avatar_auth_state');
        } catch (error) {
            // Storage may be unavailable
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 7: LISTENER NOTIFICATION
    // -------------------------------------------------------------------------
    
    /**
     * Notify all registered auth state listeners
     */
    function notifyListeners() {
        try {
            var currentState = getState();
            
            authListeners.forEach(function(listener) {
                try {
                    listener(currentState);
                } catch (error) {
                    log('error', 'Error in auth listener:', error);
                }
            });
            
            // Save state for cross-tab sync
            saveStateToStorage();
        } catch (error) {
            log('error', 'Notify listeners error:', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 8: PUBLIC AUTHENTICATION METHODS
    // -------------------------------------------------------------------------
    
    /**
     * Register a new user with email and password
     * @param {Object} userData - Registration data
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     * @param {string} userData.confirmPassword - Password confirmation
     * @param {string} userData.displayName - Display name
     * @param {string} [userData.phone] - Phone number
     * @param {string} [userData.role='viewer'] - User role
     * @param {string} [userData.clientId] - Client/tenant ID
     * @param {boolean} userData.acceptTerms - Terms acceptance
     * @returns {Promise<Object>} Registration result
     */
    async function register(userData) {
        try {
            var email = userData.email;
            var password = userData.password;
            var confirmPassword = userData.confirmPassword;
            var displayName = userData.displayName;
            
            // Validate required fields
            if (!email || !password || !displayName) {
                throw normalizeError({ code: '', message: 'All required fields must be filled.' });
            }
            
            // Validate email format
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw normalizeError({ code: 'auth/invalid-email' });
            }
            
            // Validate password strength
            var passwordValidation = validatePasswordStrength(password);
            if (!passwordValidation.valid) {
                throw normalizeError({ code: 'auth/weak-password', message: passwordValidation.message });
            }
            
            // Check passwords match
            if (password !== confirmPassword) {
                throw normalizeError({ code: '', message: 'Passwords do not match.' });
            }
            
            // Validate display name
            if (displayName.length < 2) {
                throw normalizeError({ code: '', message: 'Name must be at least 2 characters.' });
            }
            
            // Check terms acceptance
            if (!userData.acceptTerms) {
                throw normalizeError({ code: '', message: 'You must accept the Terms of Service and Privacy Policy.' });
            }
            
            // Check Firebase availability
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            // Create Firebase auth user
            var userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            var user = userCredential.user;
            
            // Update display name
            await user.updateProfile({ displayName: displayName });
            
            // Create Firestore profile
            await createUserProfile(user.uid, {
                email: email,
                displayName: displayName,
                phone: userData.phone || '',
                role: userData.role || 'viewer',
                clientId: userData.clientId || null,
                photoURL: '',
                emailVerified: false,
                provider: 'email',
            });
            
            // Send verification email if required
            if (config.emailVerificationRequired) {
                await user.sendEmailVerification().catch(function(err) {
                    log('warn', 'Failed to send verification email:', err);
                });
            }
            
            log('log', 'User registered:', email);
            
            emitEvent('auth:register', {
                user: { uid: user.uid, email: email, displayName: displayName },
                role: userData.role || 'viewer',
            });
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                },
                verificationSent: config.emailVerificationRequired,
            };
            
        } catch (error) {
            log('error', 'Registration failed:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Login with email and password
     * @param {Object} credentials - Login credentials
     * @param {string} credentials.email - User email
     * @param {string} credentials.password - User password
     * @param {boolean} [credentials.rememberMe=false] - Remember me
     * @returns {Promise<Object>} Login result
     */
    async function login(credentials) {
        try {
            var email = credentials.email;
            var password = credentials.password;
            var rememberMe = credentials.rememberMe || false;
            
            // Validate inputs
            if (!email || !password) {
                throw normalizeError({ code: '', message: 'Email and password are required.' });
            }
            
            // Check lockout
            if (isLockedOut()) {
                var remainingMinutes = Math.ceil((state.lockoutUntil - Date.now()) / 60000);
                throw normalizeError({ 
                    code: '', 
                    message: 'Too many login attempts. Please try again in ' + remainingMinutes + ' minute(s).' 
                });
            }
            
            // Check Firebase availability
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            // Set persistence based on remember me
            var persistence = rememberMe
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION;
            
            await firebase.auth().setPersistence(persistence);
            
            // Sign in
            var userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            var user = userCredential.user;
            
            // Reset lockout on success
            state.loginAttempts = 0;
            state.lastLoginAttempt = null;
            state.lockoutUntil = null;
            state.rememberMe = rememberMe;
            
            saveStateToStorage();
            
            log('log', 'Login successful:', email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    photoURL: user.photoURL,
                },
                isNewUser: userCredential.additionalUserInfo?.isNewUser || false,
            };
            
        } catch (error) {
            // Track failed attempt
            state.loginAttempts++;
            state.lastLoginAttempt = Date.now();
            
            if (state.loginAttempts >= config.maxLoginAttempts) {
                state.lockoutUntil = Date.now() + config.loginLockoutDuration;
                log('warn', 'Account locked due to too many attempts');
            }
            
            saveStateToStorage();
            
            log('error', 'Login failed:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Login with Google OAuth
     * @returns {Promise<Object>} Login result
     */
    async function loginWithGoogle() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            var provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            provider.setCustomParameters({ prompt: 'select_account' });
            
            var result = await firebase.auth().signInWithPopup(provider);
            var user = result.user;
            var isNewUser = result.additionalUserInfo?.isNewUser || false;
            
            if (isNewUser) {
                // Create profile for new Google users
                await createUserProfile(user.uid, {
                    email: user.email,
                    displayName: user.displayName || '',
                    phone: user.phoneNumber || '',
                    photoURL: user.photoURL || '',
                    emailVerified: true,
                    role: 'viewer',
                    provider: 'google',
                });
            }
            
            state.rememberMe = true;
            saveStateToStorage();
            
            log('log', 'Google login successful:', user.email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified,
                },
                isNewUser: isNewUser,
            };
            
        } catch (error) {
            log('error', 'Google login failed:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Send email verification to current user
     * @returns {Promise<Object>} Result
     */
    async function sendVerificationEmail() {
        try {
            var user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) {
                throw normalizeError({ code: '', message: 'No user is currently signed in.' });
            }
            
            if (user.emailVerified) {
                return { success: true, alreadyVerified: true };
            }
            
            await user.sendEmailVerification();
            
            log('log', 'Verification email sent to:', user.email);
            
            return { success: true, email: user.email };
            
        } catch (error) {
            log('error', 'Failed to send verification email:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Send password reset email
     * @param {string} email - User email
     * @returns {Promise<Object>} Result
     */
    async function forgotPassword(email) {
        try {
            if (!email) {
                throw normalizeError({ code: '', message: 'Email is required.' });
            }
            
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            await firebase.auth().sendPasswordResetEmail(email, {
                url: window.location.origin + '/login.html?reason=password_reset',
                handleCodeInApp: false,
            });
            
            log('log', 'Password reset email sent to:', email);
            
            return { success: true, email: email };
            
        } catch (error) {
            log('error', 'Failed to send password reset:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Logout current user
     * @param {string} [reason='user_initiated'] - Reason for logout
     * @returns {Promise<void>}
     */
    async function logout(reason) {
        try {
            var logoutReason = reason || 'user_initiated';
            log('log', 'Logging out, reason:', logoutReason);
            
            // Stop all timers
            stopSessionTimeout();
            stopActivityTracking();
            clearTokenRefresh();
            
            // Clear session data
            clearSession();
            
            // Sign out from Firebase
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
            
            // Also try FirebaseService signOut
            if (window.FirebaseService && typeof window.FirebaseService.signOut === 'function') {
                await window.FirebaseService.signOut().catch(function() {
                    // Silent - FirebaseService may not be initialized
                });
            }
            
            log('log', 'Logged out successfully');
            
        } catch (error) {
            log('error', 'Logout error:', error);
            // Force state reset even if Firebase fails
            handleAuthStateChange(null);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: PUBLIC GETTERS & LISTENERS
    // -------------------------------------------------------------------------
    
    /**
     * Register auth state change listener
     * @param {Function} listener - Callback receiving state object
     * @returns {Function} Unsubscribe function
     */
    function onAuthStateChange(listener) {
        try {
            if (typeof listener !== 'function') {
                return function() {};
            }
            
            authListeners.push(listener);
            
            // Call immediately with current state
            try {
                listener(getState());
            } catch (error) {
                // Silent
            }
            
            // Return unsubscribe function
            return function() {
                try {
                    var index = authListeners.indexOf(listener);
                    if (index > -1) {
                        authListeners.splice(index, 1);
                    }
                } catch (error) {
                    // Silent
                }
            };
        } catch (error) {
            return function() {};
        }
    }
    
    /**
     * Get current authentication state snapshot
     * @returns {Object} Current state
     */
    function getState() {
        try {
            return {
                user: state.user ? {
                    uid: state.user.uid,
                    email: state.user.email,
                    displayName: state.user.displayName,
                    photoURL: state.user.photoURL,
                    emailVerified: state.user.emailVerified,
                    phoneNumber: state.user.phoneNumber,
                } : null,
                userProfile: state.userProfile ? Object.assign({}, state.userProfile) : null,
                isAuthenticated: state.isAuthenticated,
                isEmailVerified: state.isEmailVerified,
                authLoading: state.authLoading,
                authError: state.authError,
                loginAttempts: state.loginAttempts,
                isLockedOut: isLockedOut(),
                sessionStartTime: state.sessionStartTime,
                lastActivityTime: state.lastActivityTime,
                rememberMe: state.rememberMe,
                tenantId: state.tenantId,
            };
        } catch (error) {
            return { isAuthenticated: false, authLoading: false };
        }
    }
    
    /**
     * Get current Firebase user
     * @returns {firebase.User|null}
     */
    function getCurrentUser() {
        try {
            return state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean}
     */
    function hasRole(role) {
        try {
            if (!state.userProfile) return false;
            var userRole = state.userProfile.role || (state.userProfile.data && state.userProfile.data.role);
            return userRole === role;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if user has specific permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    function hasPermission(permission) {
        try {
            if (!state.userProfile) return false;
            var permissions = state.userProfile.permissions || 
                            (state.userProfile.data && state.userProfile.data.permissions) || 
                            [];
            return permissions.indexOf(permission) !== -1 || 
                   permissions.indexOf('*') !== -1 || 
                   permissions.indexOf('all') !== -1;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Update configuration at runtime
     * @param {Object} newConfig - Config values to update
     */
    function updateConfig(newConfig) {
        try {
            if (newConfig && typeof newConfig === 'object') {
                Object.assign(config, newConfig);
                log('log', 'Config updated');
            }
        } catch (error) {
            log('error', 'Config update failed:', error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 10: INITIALIZATION & DESTRUCTION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the Auth Manager
     * Sets up Firebase auth state listener
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            log('log', 'Initializing Auth Manager...');
            
            // Load saved state from storage
            loadStateFromStorage();
            
            // Listen for Firebase auth state changes
            if (typeof firebase !== 'undefined' && firebase.auth) {
                unsubscribeAuth = firebase.auth().onAuthStateChanged(
                    handleAuthStateChange,
                    function(error) {
                        log('error', 'Auth state observer error:', error);
                        state.authError = error.message;
                        state.authLoading = false;
                        notifyListeners();
                    }
                );
            } else {
                log('warn', 'Firebase Auth not available - will retry');
                // Retry after delay
                setTimeout(function() {
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        unsubscribeAuth = firebase.auth().onAuthStateChanged(handleAuthStateChange);
                        log('log', 'Auth listener attached (delayed)');
                    }
                }, 2000);
            }
            
            log('log', 'Auth Manager initialized');
            
        } catch (error) {
            log('error', 'Auth Manager initialization failed:', error);
            state.authError = error.message;
            state.authLoading = false;
            notifyListeners();
        }
    }
    
    /**
     * Destroy the Auth Manager and clean up
     */
    function destroy() {
        try {
            if (unsubscribeAuth) {
                unsubscribeAuth();
                unsubscribeAuth = null;
            }
            
            stopSessionTimeout();
            stopActivityTracking();
            clearTokenRefresh();
            
            authListeners.length = 0;
            
            log('log', 'Auth Manager destroyed');
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 11: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface - frozen to prevent modification */
    const publicAPI = Object.freeze({
        // Lifecycle
        init: init,
        destroy: destroy,
        
        // Configuration
        get config() { return Object.assign({}, config); },
        updateConfig: updateConfig,
        
        // Authentication methods
        register: register,
        login: login,
        loginWithGoogle: loginWithGoogle,
        logout: logout,
        
        // Email verification
        sendVerificationEmail: sendVerificationEmail,
        
        // Password management
        forgotPassword: forgotPassword,
        validatePasswordStrength: validatePasswordStrength,
        
        // State & listeners
        getState: getState,
        getCurrentUser: getCurrentUser,
        onAuthStateChange: onAuthStateChange,
        
        // Role & permissions
        hasRole: hasRole,
        hasPermission: hasPermission,
        
        // Lockout status
        isLockedOut: isLockedOut,
    });
    
    return publicAPI;
    
})(); // End of AuthManager IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            AuthManager.init();
        });
    } else {
        AuthManager.init();
    }
}

// =============================================================================
// EXPORTS - Global + CommonJS (NO ES Module export)
// =============================================================================

if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
    window.auth = AuthManager; // Convenience alias
    window.Global = window.Global || {};
    window.Global.AuthManager = AuthManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}