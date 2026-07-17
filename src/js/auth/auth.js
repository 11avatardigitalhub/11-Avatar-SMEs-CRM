/**
 * @fileoverview 11 Avatar SMEs CRM - Enterprise Authentication Manager
 * @description Complete authentication system with Email/Password, Google OAuth,
 *              session management, token refresh, brute-force protection,
 *              cross-tab sync, idle timeout, and role-based access control.
 *              Integrates with FirebaseService and Constants modules.
 * @module auth/auth
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires FirebaseService (window.FirebaseService)
 * @requires Constants (window.Constants)
 *
 * @exports window.AuthManager - Global namespace
 * @exports window.auth - Convenience alias
 */

'use strict';

// =============================================================================
// AUTH MANAGER - Self-executing IIFE
// =============================================================================
const AuthManager = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: CONFIGURATION
    // -------------------------------------------------------------------------
    
    /** @constant {Object} DEFAULT_CONFIG - Auth system configuration */
    const DEFAULT_CONFIG = Object.freeze({
        // Login security
        maxLoginAttempts: 5,
        loginLockoutDuration: 15 * 60 * 1000, // 15 minutes
        
        // Session
        sessionTimeout: 30 * 60 * 1000,       // 30 minutes idle
        rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
        tokenRefreshBuffer: 5 * 60 * 1000,    // Refresh 5 min before expiry
        
        // Password policy
        minPasswordLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        
        // Providers
        providers: {
            email: true,
            google: true,
            phone: false,
        },
        
        // Verification
        emailVerificationRequired: true,
        verificationLinkExpiry: 24 * 60 * 60 * 1000, // 24 hours
        
        // Security
        twoFactorEnabled: false,
        forceLogoutOnPasswordChange: true,
        idleTimeoutWarning: 60 * 1000, // Warn 1 minute before timeout
    });
    
    /** @type {Object} Active configuration (can be modified at runtime) */
    let config = Object.assign({}, DEFAULT_CONFIG);

    // -------------------------------------------------------------------------
    // SECTION 2: STATE
    // -------------------------------------------------------------------------
    
    /** @type {Object} Internal state */
    const state = {
        /** @type {firebase.User|null} Current Firebase user */
        user: null,
        
        /** @type {Object|null} User profile from Firestore */
        userProfile: null,
        
        /** @type {boolean} Whether user is authenticated */
        isAuthenticated: false,
        
        /** @type {boolean} Whether email is verified */
        isEmailVerified: false,
        
        /** @type {boolean} Whether auth is still loading */
        authLoading: true,
        
        /** @type {string|null} Last auth error message */
        authError: null,
        
        /** @type {number} Consecutive failed login attempts */
        loginAttempts: 0,
        
        /** @type {number|null} Timestamp of last failed attempt */
        lastLoginAttempt: null,
        
        /** @type {number|null} Timestamp when lockout ends */
        lockoutUntil: null,
        
        /** @type {number|null} Session start timestamp */
        sessionStartTime: null,
        
        /** @type {number} Last user activity timestamp */
        lastActivityTime: Date.now(),
        
        /** @type {boolean} Whether remember me is active */
        rememberMe: false,
        
        /** @type {string|null} Current tenant ID */
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
     * Get current timestamp as ISO string (fallback if Firebase is unavailable)
     * @returns {string} ISO 8601 timestamp
     */
    function getTimestamp() {
        try {
            // Try Firebase server timestamp first
            if (typeof firebase !== 'undefined' && 
                firebase.firestore && 
                firebase.firestore.FieldValue &&
                firebase.firestore.FieldValue.serverTimestamp) {
                return firebase.firestore.FieldValue.serverTimestamp();
            }
        } catch (error) {
            // Fallback
        }
        return new Date().toISOString();
    }
    
    /**
     * Generate a unique ID (fallback if Firebase unavailable)
     * @returns {string} Unique identifier
     */
    function generateId() {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
        } catch (error) {
            // Fallback
        }
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Get default user preferences
     * @returns {Object} Default preferences object
     */
    function getDefaultPreferences() {
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
    }
    
    /**
     * Get default role-based permissions
     * @param {string} role - Role short name
     * @returns {Array<string>} Array of permission strings
     */
    function getDefaultPermissions(role) {
        const permissionsMap = {
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
    }
    
    /**
     * Check if FirebaseService has a specific method
     * @param {string} methodName - Method name to check
     * @returns {boolean} True if method exists
     */
    function hasFirebaseMethod(methodName) {
        try {
            return window.FirebaseService && 
                   typeof window.FirebaseService[methodName] === 'function';
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Safely emit an event via EventBus if available
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    function emitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit(eventName, data);
            }
            // Also dispatch as DOM custom event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
            }
        } catch (error) {
            // Silent - events are non-critical
        }
    }
    
    /**
     * Log message with module prefix
     * @param {string} level - 'log', 'warn', 'error'
     * @param {string} message - Log message
     * @param {*} [data] - Optional data
     */
    function log(level, message, data) {
        try {
            const isDebug = window.Constants && 
                           window.Constants.APP && 
                           window.Constants.APP.DEBUG;
            
            if (!isDebug && level === 'log') return;
            
            const prefix = '[AuthManager]';
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
            // Silent
        }
    }
    
    /**
     * Normalize Firebase error into standardized format
     * @param {Error|Object} error - Raw error object
     * @returns {Error} Standardized error
     */
    function normalizeError(error) {
        const errorMap = {
            'auth/email-already-in-use': { code: 'EMAIL_EXISTS', message: 'This email is already registered. Please login instead.' },
            'auth/invalid-email': { code: 'INVALID_EMAIL', message: 'Please enter a valid email address.' },
            'auth/operation-not-allowed': { code: 'DISABLED', message: 'This login method is not currently enabled.' },
            'auth/weak-password': { code: 'WEAK_PASSWORD', message: 'Password is too weak. Please use a stronger password.' },
            'auth/user-disabled': { code: 'USER_DISABLED', message: 'This account has been disabled. Please contact support@11avatardigitalhub.cloud.' },
            'auth/user-not-found': { code: 'USER_NOT_FOUND', message: 'No account found with this email. Please register first.' },
            'auth/wrong-password': { code: 'WRONG_PASSWORD', message: 'Incorrect password. Please try again.' },
            'auth/invalid-credential': { code: 'INVALID_CREDENTIAL', message: 'Invalid email or password. Please try again.' },
            'auth/too-many-requests': { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please wait and try again.' },
            'auth/network-request-failed': { code: 'NETWORK_ERROR', message: 'Network error. Please check your internet connection.' },
            'auth/popup-closed-by-user': { code: 'POPUP_CLOSED', message: 'Sign-in popup was closed.' },
            'auth/cancelled-popup-request': { code: 'POPUP_CANCELLED', message: 'Sign-in cancelled.' },
            'auth/popup-blocked': { code: 'POPUP_BLOCKED', message: 'Pop-up was blocked. Please allow popups for this site.' },
            'auth/requires-recent-login': { code: 'REAUTH_REQUIRED', message: 'Please re-enter your password to continue.' },
            'auth/account-exists-with-different-credential': { code: 'CREDENTIAL_CONFLICT', message: 'An account already exists with this email using a different sign-in method.' },
        };
        
        const mapped = errorMap[error.code];
        if (mapped) {
            const normalized = new Error(mapped.message);
            normalized.code = mapped.code;
            normalized.originalCode = error.code;
            normalized.timestamp = new Date().toISOString();
            return normalized;
        }
        
        const fallback = new Error(error.message || 'An unexpected authentication error occurred.');
        fallback.code = error.code || 'AUTH_ERROR';
        fallback.originalCode = error.code;
        fallback.timestamp = new Date().toISOString();
        return fallback;
    }
    
    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} { valid: boolean, message: string, strength: string }
     */
    function validatePasswordStrength(password) {
        const { minPasswordLength, requireUppercase, requireLowercase, requireNumber, requireSpecialChar } = config;
        
        if (!password || typeof password !== 'string') {
            return { valid: false, message: 'Password is required.', strength: 'none' };
        }
        
        if (password.length < minPasswordLength) {
            return { valid: false, message: 'Password must be at least ' + minPasswordLength + ' characters.', strength: 'weak' };
        }
        
        if (requireUppercase && !/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter.', strength: 'weak' };
        }
        
        if (requireLowercase && !/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter.', strength: 'weak' };
        }
        
        if (requireNumber && !/[0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one number.', strength: 'weak' };
        }
        
        if (requireSpecialChar && !/[!@#$%^&*()_,.?":{}|<>]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one special character.', strength: 'weak' };
        }
        
        // Calculate strength score
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        let strength = 'weak';
        if (score >= 5) strength = 'medium';
        if (score >= 6) strength = 'strong';
        
        return { valid: true, message: '', strength: strength };
    }
    
    /**
     * Check if user is currently locked out
     * @returns {boolean} True if locked out
     */
    function isLockedOut() {
        if (!state.lockoutUntil) return false;
        
        if (Date.now() >= state.lockoutUntil) {
            // Lockout expired
            state.lockoutUntil = null;
            state.loginAttempts = 0;
            saveStateToStorage();
            return false;
        }
        
        return true;
    }

    // -------------------------------------------------------------------------
    // SECTION 4: FIRESTORE USER PROFILE
    // -------------------------------------------------------------------------
    
    /**
     * Fetch user profile from Firestore
     * @param {string} uid - User ID
     * @returns {Promise<Object|null>} User profile or null
     */
    async function fetchUserProfile(uid) {
        try {
            if (!uid) return null;
            
            // Try FirebaseService first
            if (hasFirebaseMethod('getDocument')) {
                const profile = await window.FirebaseService.getDocument('users', uid);
                return profile;
            }
            
            // Direct Firestore fallback
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const doc = await firebase.firestore().collection('users').doc(uid).get();
                if (doc.exists) {
                    return { id: doc.id, ...doc.data() };
                }
            }
            
            return null;
        } catch (error) {
            log('error', 'Failed to fetch user profile:', error);
            return null;
        }
    }
    
    /**
     * Create user profile in Firestore
     * @param {string} uid - User ID
     * @param {Object} profileData - Profile data
     * @returns {Promise<Object>} Created profile
     */
    async function createUserProfile(uid, profileData) {
        try {
            const data = {
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
            
            // Try FirebaseService first
            if (hasFirebaseMethod('createDocument')) {
                return await window.FirebaseService.createDocument('users', data, uid);
            }
            
            // Direct Firestore fallback
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                await firebase.firestore().collection('users').doc(uid).set(data);
                return { id: uid, ...data };
            }
            
            throw new Error('No Firestore service available');
        } catch (error) {
            log('error', 'Failed to create user profile:', error);
            throw error;
        }
    }
    
    /**
     * Update user profile in Firestore
     * @param {string} uid - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async function updateUserProfile(uid, updates) {
        try {
            const data = {
                ...updates,
                updatedAt: getTimestamp(),
            };
            
            if (hasFirebaseMethod('updateDocument')) {
                await window.FirebaseService.updateDocument('users', uid, data);
                return;
            }
            
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                await firebase.firestore().collection('users').doc(uid).update(data);
                return;
            }
        } catch (error) {
            log('error', 'Failed to update user profile:', error);
        }
    }
    
    /**
     * Update last login timestamp
     * @param {string} uid - User ID
     */
    async function updateLastLogin(uid) {
        try {
            const updates = { lastLogin: getTimestamp() };
            
            // Increment login count if available
            if (typeof firebase !== 'undefined' && 
                firebase.firestore && 
                firebase.firestore.FieldValue &&
                firebase.firestore.FieldValue.increment) {
                updates.loginCount = firebase.firestore.FieldValue.increment(1);
            }
            
            if (hasFirebaseMethod('updateDocument')) {
                await window.FirebaseService.updateDocument('users', uid, updates);
            } else if (typeof firebase !== 'undefined' && firebase.firestore) {
                await firebase.firestore().collection('users').doc(uid).update(updates);
            }
        } catch (error) {
            // Non-critical - silent fail
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: AUTH STATE HANDLER
    // -------------------------------------------------------------------------
    
    /**
     * Handle Firebase auth state changes
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
                
                // Fetch or create profile
                let profile = await fetchUserProfile(user.uid);
                
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
                
                // Update last login
                await updateLastLogin(user.uid);
                
                // Start session timers
                startSessionTimeout();
                startActivityTracking();
                
                // Schedule token refresh
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
                
                log('log', 'User authenticated:', user.email, 'Role:', profile?.role);
                
            } else {
                // USER SIGNED OUT
                const wasAuthenticated = state.isAuthenticated;
                
                state.user = null;
                state.userProfile = null;
                state.isAuthenticated = false;
                state.isEmailVerified = false;
                state.sessionStartTime = null;
                state.tenantId = null;
                
                // Clear timers
                stopSessionTimeout();
                stopActivityTracking();
                clearTokenRefresh();
                clearIdleWarning();
                
                // Clear session storage
                clearSession();
                
                // Emit logout event
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
     * Schedule proactive token refresh
     * @param {firebase.User} user - Firebase user
     */
    function scheduleTokenRefresh(user) {
        clearTokenRefresh();
        
        user.getIdTokenResult()
            .then(function(idTokenResult) {
                const expirationTime = new Date(idTokenResult.expirationTime).getTime();
                const refreshTime = expirationTime - config.tokenRefreshBuffer;
                const delay = Math.max(0, refreshTime - Date.now());
                
                log('log', 'Token refresh scheduled in', Math.round(delay / 1000), 'seconds');
                
                tokenRefreshTimeout = setTimeout(async function() {
                    try {
                        if (state.user) {
                            const newToken = await state.user.getIdToken(true);
                            log('log', 'Token refreshed proactively');
                            
                            // Schedule next refresh
                            scheduleTokenRefresh(state.user);
                        }
                    } catch (error) {
                        log('warn', 'Proactive token refresh failed:', error);
                    }
                }, delay);
            })
            .catch(function(error) {
                log('warn', 'Failed to get token expiry:', error);
            });
    }
    
    /**
     * Clear token refresh timeout
     */
    function clearTokenRefresh() {
        if (tokenRefreshTimeout) {
            clearTimeout(tokenRefreshTimeout);
            tokenRefreshTimeout = null;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 6: REGISTRATION
    // -------------------------------------------------------------------------
    
    /**
     * Register a new user
     * @param {Object} userData - Registration data
     * @returns {Promise<Object>} Registration result
     */
    async function register(userData) {
        const { email, password, confirmPassword, displayName, phone, role, clientId, acceptTerms } = userData;
        
        // Validate required fields
        if (!email || !password || !displayName) {
            throw normalizeError({ code: '', message: 'All required fields must be filled.' });
        }
        
        // Validate email format
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(email)) {
            throw normalizeError({ code: 'auth/invalid-email', message: 'Please enter a valid email address.' });
        }
        
        // Validate password
        const passwordValidation = validatePasswordStrength(password);
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
        
        // Check terms
        if (!acceptTerms) {
            throw normalizeError({ code: '', message: 'You must accept the Terms of Service and Privacy Policy.' });
        }
        
        try {
            // Check Firebase auth availability
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            // Create Firebase auth user
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Update display name
            await user.updateProfile({ displayName: displayName });
            
            // Create Firestore profile
            await createUserProfile(user.uid, {
                email: email,
                displayName: displayName,
                phone: phone || '',
                role: role || 'viewer',
                clientId: clientId || null,
                photoURL: '',
                emailVerified: false,
                provider: 'email',
            });
            
            // Send verification email
            if (config.emailVerificationRequired) {
                await user.sendEmailVerification().catch(function(err) {
                    log('warn', 'Failed to send verification email:', err);
                });
            }
            
            log('log', 'User registered:', email);
            
            emitEvent('auth:register', {
                user: { uid: user.uid, email, displayName },
                role: role || 'viewer',
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

    // -------------------------------------------------------------------------
    // SECTION 7: LOGIN
    // -------------------------------------------------------------------------
    
    /**
     * Login with email and password
     * @param {Object} credentials - { email, password, rememberMe }
     * @returns {Promise<Object>} Login result
     */
    async function login(credentials) {
        const { email, password, rememberMe = false } = credentials || {};
        
        // Validate inputs
        if (!email || !password) {
            throw normalizeError({ code: '', message: 'Email and password are required.' });
        }
        
        // Check lockout
        if (isLockedOut()) {
            const remainingMinutes = Math.ceil((state.lockoutUntil - Date.now()) / 60000);
            throw normalizeError({ 
                code: '', 
                message: 'Too many login attempts. Please try again in ' + remainingMinutes + ' minute(s).' 
            });
        }
        
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            // Set persistence
            const persistence = rememberMe
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION;
            
            await firebase.auth().setPersistence(persistence);
            
            // Sign in
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Reset attempts on success
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
            
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            provider.setCustomParameters({ prompt: 'select_account' });
            
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            const isNewUser = result.additionalUserInfo?.isNewUser || false;
            
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
            
            state.rememberMe = true; // Google sign-in persists
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

    // -------------------------------------------------------------------------
    // SECTION 8: EMAIL VERIFICATION
    // -------------------------------------------------------------------------
    
    /**
     * Send email verification
     * @returns {Promise<Object>}
     */
    async function sendVerificationEmail() {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
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
     * Check if email is verified
     * @returns {Promise<boolean>}
     */
    async function checkEmailVerification() {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) return false;
            
            await user.reload();
            state.isEmailVerified = user.emailVerified;
            notifyListeners();
            
            return user.emailVerified;
            
        } catch (error) {
            log('error', 'Failed to check email verification:', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 9: PASSWORD MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Send password reset email
     * @param {string} email - User email
     * @returns {Promise<Object>}
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
     * Confirm password reset with code
     * @param {string} code - Verification code from email
     * @param {string} newPassword - New password
     * @returns {Promise<Object>}
     */
    async function resetPassword(code, newPassword) {
        try {
            const validation = validatePasswordStrength(newPassword);
            if (!validation.valid) {
                throw normalizeError({ code: '', message: validation.message });
            }
            
            if (typeof firebase === 'undefined' || !firebase.auth) {
                throw new Error('Authentication service is not available.');
            }
            
            await firebase.auth().confirmPasswordReset(code, newPassword);
            
            log('log', 'Password reset successful');
            
            return { success: true };
            
        } catch (error) {
            log('error', 'Password reset failed:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Change password (when logged in)
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>}
     */
    async function changePassword(currentPassword, newPassword) {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) {
                throw normalizeError({ code: '', message: 'No user is currently signed in.' });
            }
            
            const validation = validatePasswordStrength(newPassword);
            if (!validation.valid) {
                throw normalizeError({ code: '', message: validation.message });
            }
            
            // Re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);
            
            // Update password
            await user.updatePassword(newPassword);
            
            log('log', 'Password changed successfully');
            
            return { success: true };
            
        } catch (error) {
            log('error', 'Password change failed:', error);
            throw normalizeError(error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 10: SESSION MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Start session timeout monitoring
     */
    function startSessionTimeout() {
        stopSessionTimeout();
        
        // Check every 30 seconds
        sessionTimer = setInterval(checkSessionTimeout, 30000);
    }
    
    /**
     * Stop session timeout monitoring
     */
    function stopSessionTimeout() {
        if (sessionTimer) {
            clearInterval(sessionTimer);
            sessionTimer = null;
        }
    }
    
    /**
     * Check if session has timed out due to inactivity
     */
    function checkSessionTimeout() {
        if (!state.isAuthenticated) return;
        if (state.rememberMe) return; // Remember me bypasses timeout
        
        const idleTime = Date.now() - state.lastActivityTime;
        
        // Show warning before timeout
        if (idleTime >= (config.sessionTimeout - config.idleTimeoutWarning) && 
            idleTime < config.sessionTimeout) {
            if (!idleWarningTimeout) {
                emitEvent('auth:idleWarning', {
                    message: 'Your session will expire soon due to inactivity.',
                    remainingSeconds: Math.ceil((config.sessionTimeout - idleTime) / 1000),
                });
            }
        }
        
        // Force logout on timeout
        if (idleTime >= config.sessionTimeout) {
            log('warn', 'Session timeout - logging out due to inactivity');
            logout('session_timeout');
        }
    }
    
    /**
     * Clear idle warning
     */
    function clearIdleWarning() {
        idleWarningTimeout = null;
    }
    
    /**
     * Start activity tracking for idle detection
     */
    function startActivityTracking() {
        stopActivityTracking();
        
        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
        
        activityEvents.forEach(function(eventName) {
            document.addEventListener(eventName, handleUserActivity, { passive: true });
        });
        
        // Also track visibility change
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    /**
     * Stop activity tracking
     */
    function stopActivityTracking() {
        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
        
        activityEvents.forEach(function(eventName) {
            document.removeEventListener(eventName, handleUserActivity);
        });
        
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    
    /**
     * Handle user activity - update last activity timestamp
     */
    function handleUserActivity() {
        state.lastActivityTime = Date.now();
        clearIdleWarning();
    }
    
    /**
     * Handle page visibility change
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            state.lastActivityTime = Date.now();
            // Refresh token when user returns
            if (state.user) {
                state.user.getIdToken(true).catch(function() {
                    // Silent
                });
            }
        }
    }
    
    /**
     * Save session data to storage
     */
    function saveSession(user, token) {
        try {
            if (!state.rememberMe) return;
            
            const session = {
                uid: user.uid,
                email: user.email,
                token: token,
                timestamp: Date.now(),
            };
            
            localStorage.setItem('11avatar_session', JSON.stringify(session));
        } catch (error) {
            // Storage may be full
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
            // Silent
        }
    }
    
    /**
     * Save state to storage for cross-tab sync
     */
    function saveStateToStorage() {
        try {
            const data = {
                loginAttempts: state.loginAttempts,
                lastLoginAttempt: state.lastLoginAttempt,
                lockoutUntil: state.lockoutUntil,
                rememberMe: state.rememberMe,
                tenantId: state.tenantId,
            };
            
            sessionStorage.setItem('11avatar_auth_state', JSON.stringify(data));
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Load state from storage
     */
    function loadStateFromStorage() {
        try {
            const saved = sessionStorage.getItem('11avatar_auth_state');
            if (saved) {
                const data = JSON.parse(saved);
                state.loginAttempts = data.loginAttempts || 0;
                state.lastLoginAttempt = data.lastLoginAttempt || null;
                state.lockoutUntil = data.lockoutUntil || null;
                state.rememberMe = data.rememberMe || false;
                state.tenantId = data.tenantId || null;
            }
        } catch (error) {
            // Silent
        }
    }
    
    /**
     * Setup cross-tab synchronization
     */
    function setupCrossTabSync() {
        window.addEventListener('storage', function(event) {
            if (event.key === '11avatar_session') {
                try {
                    const sessionData = JSON.parse(event.newValue);
                    if (sessionData && sessionData.uid) {
                        log('log', 'Session restored from another tab');
                    }
                } catch (error) {
                    // Silent
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // SECTION 11: LOGOUT
    // -------------------------------------------------------------------------
    
    /**
     * Logout current user
     * @param {string} [reason='user_initiated'] - Reason for logout
     * @returns {Promise<void>}
     */
    async function logout(reason) {
        const logoutReason = reason || 'user_initiated';
        
        try {
            log('log', 'Logging out, reason:', logoutReason);
            
            // Stop all timers
            stopSessionTimeout();
            stopActivityTracking();
            clearTokenRefresh();
            clearIdleWarning();
            
            // Clear session
            clearSession();
            
            // Sign out from Firebase
            if (typeof firebase !== 'undefined' && firebase.auth) {
                await firebase.auth().signOut();
            }
            
            // Also try FirebaseService
            if (hasFirebaseMethod('signOut')) {
                await window.FirebaseService.signOut().catch(function() {
                    // Silent
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
    // SECTION 12: PROFILE MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Update user profile
     * @param {Object} profileData - Fields to update
     * @returns {Promise<Object>}
     */
    async function updateProfile(profileData) {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) {
                throw normalizeError({ code: '', message: 'No user is currently signed in.' });
            }
            
            const { displayName, photoURL, phone } = profileData;
            
            // Update Firebase auth profile
            const authUpdates = {};
            if (displayName !== undefined) authUpdates.displayName = displayName;
            if (photoURL !== undefined) authUpdates.photoURL = photoURL;
            
            if (Object.keys(authUpdates).length > 0) {
                await user.updateProfile(authUpdates);
            }
            
            // Update Firestore profile
            const firestoreUpdates = {};
            if (displayName !== undefined) firestoreUpdates.displayName = displayName;
            if (photoURL !== undefined) firestoreUpdates.photoURL = photoURL;
            if (phone !== undefined) firestoreUpdates.phone = phone;
            
            if (Object.keys(firestoreUpdates).length > 0) {
                await updateUserProfile(user.uid, firestoreUpdates);
            }
            
            // Refresh local profile
            state.userProfile = await fetchUserProfile(user.uid);
            notifyListeners();
            
            log('log', 'Profile updated');
            
            return { success: true };
            
        } catch (error) {
            log('error', 'Profile update failed:', error);
            throw normalizeError(error);
        }
    }
    
    /**
     * Upload profile photo
     * @param {File} file - Image file
     * @returns {Promise<Object>}
     */
    async function uploadProfilePhoto(file) {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) {
                throw normalizeError({ code: '', message: 'No user is currently signed in.' });
            }
            
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                throw normalizeError({ code: '', message: 'Please upload a valid image (JPEG, PNG, WebP, GIF).' });
            }
            
            // Validate size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                throw normalizeError({ code: '', message: 'Profile photo must be less than 2MB.' });
            }
            
            // Upload to storage
            const path = 'avatars/' + user.uid + '/' + Date.now() + '_' + file.name;
            
            let downloadURL;
            
            if (hasFirebaseMethod('uploadFile')) {
                downloadURL = await window.FirebaseService.uploadFile(path, file);
            } else if (typeof firebase !== 'undefined' && firebase.storage) {
                const storageRef = firebase.storage().ref().child(path);
                const snapshot = await storageRef.put(file);
                downloadURL = await snapshot.ref.getDownloadURL();
            } else {
                throw new Error('Storage service not available.');
            }
            
            // Update profile with new photo URL
            await updateProfile({ photoURL: downloadURL });
            
            log('log', 'Profile photo uploaded');
            
            return { success: true, photoURL: downloadURL };
            
        } catch (error) {
            log('error', 'Profile photo upload failed:', error);
            throw normalizeError(error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 13: ACCOUNT MANAGEMENT
    // -------------------------------------------------------------------------
    
    /**
     * Delete user account
     * @param {string} [password] - Current password for re-authentication
     * @returns {Promise<Object>}
     */
    async function deleteAccount(password) {
        try {
            const user = state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
            
            if (!user) {
                throw normalizeError({ code: '', message: 'No user is currently signed in.' });
            }
            
            // Re-authenticate if password provided
            if (password && user.email) {
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(credential);
            }
            
            // Delete Firestore profile
            if (hasFirebaseMethod('deleteDocument')) {
                await window.FirebaseService.deleteDocument('users', user.uid);
            } else if (typeof firebase !== 'undefined' && firebase.firestore) {
                await firebase.firestore().collection('users').doc(user.uid).delete();
            }
            
            // Delete auth user
            await user.delete();
            
            log('log', 'Account deleted');
            
            return { success: true };
            
        } catch (error) {
            log('error', 'Account deletion failed:', error);
            throw normalizeError(error);
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 14: LISTENERS & NOTIFICATIONS
    // -------------------------------------------------------------------------
    
    /**
     * Register auth state change listener
     * @param {Function} listener - Callback receiving state object
     * @returns {Function} Unsubscribe function
     */
    function onAuthStateChange(listener) {
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
            const index = authListeners.indexOf(listener);
            if (index > -1) {
                authListeners.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify all registered listeners of state change
     */
    function notifyListeners() {
        const currentState = getState();
        
        authListeners.forEach(function(listener) {
            try {
                listener(currentState);
            } catch (error) {
                log('error', 'Error in auth listener:', error);
            }
        });
        
        // Save state for cross-tab sync
        saveStateToStorage();
    }

    // -------------------------------------------------------------------------
    // SECTION 15: PUBLIC GETTERS
    // -------------------------------------------------------------------------
    
    /**
     * Get current auth state
     * @returns {Object} Current state snapshot
     */
    function getState() {
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
    }
    
    /**
     * Get current user
     * @returns {firebase.User|null}
     */
    function getCurrentUser() {
        return state.user || (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || null;
    }
    
    /**
     * Get current user profile
     * @returns {Object|null}
     */
    function getCurrentUserProfile() {
        return state.userProfile;
    }
    
    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean}
     */
    function hasRole(role) {
        return state.userProfile?.role === role;
    }
    
    /**
     * Check if user has specific permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    function hasPermission(permission) {
        if (!state.userProfile?.permissions) return false;
        const permissions = state.userProfile.permissions;
        return permissions.includes(permission) || permissions.includes('*') || permissions.includes('all');
    }
    
    /**
     * Get authentication status summary
     * @returns {Object}
     */
    function getStatus() {
        return {
            isAuthenticated: state.isAuthenticated,
            isLoading: state.authLoading,
            isEmailVerified: state.isEmailVerified,
            user: state.user ? {
                uid: state.user.uid,
                email: state.user.email,
                displayName: state.user.displayName,
            } : null,
            role: state.userProfile?.role || null,
            loginAttempts: state.loginAttempts,
            isLockedOut: isLockedOut(),
        };
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
    
    /**
     * Debug - print current state to console
     */
    function debug() {
        console.group('🔐 Auth Manager Debug');
        console.log('State:', getStatus());
        console.log('Config:', Object.assign({}, config));
        console.log('Listeners:', authListeners.length);
        console.log('Session Timer Active:', !!sessionTimer);
        console.log('Token Refresh Scheduled:', !!tokenRefreshTimeout);
        console.groupEnd();
    }

    // -------------------------------------------------------------------------
    // SECTION 16: INITIALIZATION & DESTRUCTION
    // -------------------------------------------------------------------------
    
    /**
     * Initialize the Auth Manager
     * @returns {Promise<void>}
     */
    async function init() {
        try {
            log('log', 'Initializing Auth Manager...');
            
            // Load saved state
            loadStateFromStorage();
            
            // Setup cross-tab sync
            setupCrossTabSync();
            
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
                log('warn', 'Firebase Auth not available - waiting for SDK');
                // Retry after delay
                setTimeout(function() {
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        unsubscribeAuth = firebase.auth().onAuthStateChanged(handleAuthStateChange);
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
            clearIdleWarning();
            
            authListeners.length = 0;
            
            log('log', 'Auth Manager destroyed');
        } catch (error) {
            // Silent during cleanup
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 17: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface */
    const publicAPI = Object.freeze({
        // Configuration
        config: config,
        updateConfig: updateConfig,
        
        // Initialization
        init: init,
        destroy: destroy,
        
        // Authentication
        register: register,
        login: login,
        loginWithGoogle: loginWithGoogle,
        logout: logout,
        
        // Email verification
        sendVerificationEmail: sendVerificationEmail,
        checkEmailVerification: checkEmailVerification,
        
        // Password management
        forgotPassword: forgotPassword,
        resetPassword: resetPassword,
        changePassword: changePassword,
        validatePasswordStrength: validatePasswordStrength,
        
        // Profile
        updateProfile: updateProfile,
        uploadProfilePhoto: uploadProfilePhoto,
        deleteAccount: deleteAccount,
        
        // State & listeners
        getState: getState,
        getStatus: getStatus,
        getCurrentUser: getCurrentUser,
        getCurrentUserProfile: getCurrentUserProfile,
        onAuthStateChange: onAuthStateChange,
        
        // Role & permissions
        hasRole: hasRole,
        hasPermission: hasPermission,
        
        // Lockout
        isLockedOut: isLockedOut,
        
        // Debug
        debug: debug,
    });
    
    return publicAPI;
    
})(); // End of AuthManager IIFE

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

if (typeof window !== 'undefined') {
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            AuthManager.init().catch(function(error) {
                console.error('[AuthManager] Auto-init failed:', error);
            });
        });
    } else {
        AuthManager.init().catch(function(error) {
            console.error('[AuthManager] Auto-init failed:', error);
        });
    }
}

// =============================================================================
// EXPORTS
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

export {
    AuthManager as default,
    AuthManager,
};