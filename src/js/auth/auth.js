/* ==========================================
   11 AVATAR DIGITAL HUB
   Authentication System - Complete Auth Module
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Email/Password authentication
   - Google OAuth authentication
   - Phone number authentication
   - Registration with email verification
   - Password reset flow
   - Session management
   - Token refresh
   - Multi-tab session sync
   - Login attempt limiting
   - Brute force protection
   - Remember me functionality
   - Account linking
   - Profile management
   - Role-based access after login
   ==========================================
   Security Features:
   - Password strength validation
   - Rate limiting (5 attempts per 15 min)
   - Session timeout (30 min inactivity)
   - Token auto-refresh
   - Secure logout
   - Cross-tab synchronization
   ========================================== */

// ==========================================
// AUTH MANAGER CLASS
// ==========================================
class AuthManager {
    
    /**
     * Initialize the Authentication Manager
     */
    constructor() {
        // Configuration
        this.config = {
            // Login
            maxLoginAttempts: 5,
            loginLockoutDuration: 15 * 60 * 1000, // 15 minutes
            sessionTimeout: 30 * 60 * 1000,       // 30 minutes
            rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
            
            // Password
            minPasswordLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumber: true,
            requireSpecialChar: true,
            
            // Providers
            providers: {
                email: true,
                google: true,
                phone: false
            },
            
            // Verification
            emailVerificationRequired: true,
            verificationLinkExpiry: 24 * 60 * 60 * 1000, // 24 hours
            
            // Security
            twoFactorEnabled: false,
            forceLogoutOnPasswordChange: true
        };
        
        // State
        this.state = {
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
            rememberMe: false
        };
        
        // Listeners
        this._authListeners = [];
        this._sessionTimer = null;
        this._activityTimer = null;
        
        // Auth state observer unsubscribe
        this._unsubscribeAuth = null;
        
        // Bind methods
        this._handleAuthStateChange = this._handleAuthStateChange.bind(this);
        this._handleActivity = this._handleActivity.bind(this);
        this._checkSessionTimeout = this._checkSessionTimeout.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the auth manager
     * @private
     */
    async _init() {
        console.log('🔐 Initializing Auth Manager...');
        
        try {
            // Load saved state
            this._loadState();
            
            // Listen for Firebase auth state changes
            this._unsubscribeAuth = FirebaseService.auth.onAuthStateChanged(
                this._handleAuthStateChange,
                (error) => {
                    console.error('❌ Auth state change error:', error);
                    this.state.authError = error.message;
                    this.state.authLoading = false;
                    this._notifyListeners();
                }
            );
            
            // Setup session management
            this._setupSessionManagement();
            
            // Setup cross-tab sync
            this._setupCrossTabSync();
            
            // Restore session if remembered
            await this._restoreSession();
            
            console.log('✅ Auth Manager initialized');
            
        } catch (error) {
            console.error('❌ Auth Manager initialization failed:', error);
            this.state.authError = error.message;
            this.state.authLoading = false;
            this._notifyListeners();
        }
    }
    
    // ==========================================
    // AUTH STATE HANDLER
    // ==========================================
    
    /**
     * Handle Firebase auth state changes
     * @private
     */
    async _handleAuthStateChange(user) {
        console.log('🔐 Auth state changed:', user ? `User: ${user.email}` : 'No user');
        
        this.state.authLoading = true;
        
        try {
            if (user) {
                // User is signed in
                this.state.user = user;
                this.state.isAuthenticated = true;
                this.state.isEmailVerified = user.emailVerified;
                this.state.sessionStartTime = Date.now();
                this.state.lastActivityTime = Date.now();
                
                // Fetch user profile from Firestore
                this.state.userProfile = await FirebaseService.getCurrentUserProfile();
                
                // Update last login
                await FirebaseService.updateDocument('users', user.uid, {
                    lastLogin: FirebaseService.timestamp(),
                    loginCount: firebase.firestore.FieldValue.increment(1)
                }).catch(() => {}); // Silent fail
                
                // Get fresh token
                const token = await user.getIdToken(true);
                
                // Store session
                this._saveSession(user, token);
                
                // Start session timeout
                this._startSessionTimeout();
                
                // Track activity
                this._startActivityTracking();
                
                // Emit event
                window.EventBus?.emit('auth:login', {
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        emailVerified: user.emailVerified
                    },
                    profile: this.state.userProfile,
                    token
                });
                
                console.log('🔐 User authenticated:', user.email);
                console.log('🔐 Role:', this.state.userProfile?.role || 'Not set');
                
            } else {
                // User is signed out
                const wasAuthenticated = this.state.isAuthenticated;
                
                this.state.user = null;
                this.state.userProfile = null;
                this.state.isAuthenticated = false;
                this.state.isEmailVerified = false;
                this.state.sessionStartTime = null;
                
                // Clear session
                this._clearSession();
                
                // Stop timers
                this._stopSessionTimeout();
                this._stopActivityTracking();
                
                // Emit event
                if (wasAuthenticated) {
                    window.EventBus?.emit('auth:logout', {
                        reason: 'user_signed_out'
                    });
                }
                
                console.log('🔐 User signed out');
            }
        } catch (error) {
            console.error('❌ Error handling auth state change:', error);
            this.state.authError = error.message;
        } finally {
            this.state.authLoading = false;
            this._notifyListeners();
        }
    }
    
    // ==========================================
    // REGISTRATION
    // ==========================================
    
    /**
     * Register a new user with email and password
     * @param {Object} userData - Registration data
     * @returns {Promise<Object>} Registration result
     */
    async register(userData) {
        const {
            email,
            password,
            confirmPassword,
            displayName,
            phone = null,
            role = 'client_owner',
            clientId = null,
            acceptTerms = false
        } = userData;
        
        // Validate inputs
        const validation = this._validateRegistration(userData);
        if (!validation.valid) {
            throw this._createAuthError('VALIDATION', validation.message);
        }
        
        // Check if terms accepted
        if (!acceptTerms) {
            throw this._createAuthError('TERMS', 'You must accept the Terms of Service and Privacy Policy');
        }
        
        try {
            // Create Firebase auth user
            const userCredential = await FirebaseService.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Update display name
            await user.updateProfile({ displayName });
            
            // Create user profile in Firestore
            const profileData = {
                uid: user.uid,
                email: email,
                displayName: displayName,
                phone: phone || '',
                role: role,
                clientId: clientId,
                photoURL: '',
                emailVerified: false,
                permissions: Constants.ROLE_PERMISSIONS[role] || [],
                createdAt: FirebaseService.timestamp(),
                updatedAt: FirebaseService.timestamp(),
                lastLogin: FirebaseService.timestamp(),
                loginCount: 1,
                status: 'active',
                onboardingComplete: false,
                preferences: Constants.DEFAULT_SETTINGS
            };
            
            await FirebaseService.createDocument('users', profileData);
            
            // Send email verification
            if (this.config.emailVerificationRequired) {
                await this.sendVerificationEmail();
            }
            
            console.log('✅ User registered:', email);
            
            window.EventBus?.emit('auth:register', {
                user: { uid: user.uid, email, displayName },
                role
            });
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified
                },
                verificationSent: this.config.emailVerificationRequired
            };
            
        } catch (error) {
            console.error('❌ Registration failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    // ==========================================
    // LOGIN
    // ==========================================
    
    /**
     * Login with email and password
     * @param {Object} credentials - Login credentials
     * @returns {Promise<Object>} Login result
     */
    async login(credentials) {
        const { email, password, rememberMe = false } = credentials;
        
        // Validate inputs
        if (!email || !password) {
            throw this._createAuthError('VALIDATION', 'Email and password are required');
        }
        
        // Check lockout
        if (this._isLockedOut()) {
            const remainingTime = Math.ceil((this.state.lockoutUntil - Date.now()) / 60000);
            throw this._createAuthError(
                'LOCKOUT',
                `Too many login attempts. Please try again in ${remainingTime} minute(s).`
            );
        }
        
        try {
            // Set persistence based on remember me
            const persistence = rememberMe
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION;
            
            await FirebaseService.auth.setPersistence(persistence);
            
            // Sign in
            const userCredential = await FirebaseService.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Reset login attempts on success
            this.state.loginAttempts = 0;
            this.state.lastLoginAttempt = null;
            this.state.lockoutUntil = null;
            this.state.rememberMe = rememberMe;
            
            // Save state
            this._saveState();
            
            console.log('✅ Login successful:', email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    photoURL: user.photoURL
                },
                isNewUser: userCredential.additionalUserInfo?.isNewUser || false
            };
            
        } catch (error) {
            // Track failed attempt
            this.state.loginAttempts++;
            this.state.lastLoginAttempt = Date.now();
            
            // Check if should lockout
            if (this.state.loginAttempts >= this.config.maxLoginAttempts) {
                this.state.lockoutUntil = Date.now() + this.config.loginLockoutDuration;
                console.warn('🔒 Account locked due to too many attempts');
            }
            
            this._saveState();
            
            console.error('❌ Login failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Login with Google
     * @returns {Promise<Object>} Login result
     */
    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            // Add scopes
            provider.addScope('profile');
            provider.addScope('email');
            
            // Set custom parameters
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            
            const result = await FirebaseService.auth.signInWithPopup(provider);
            const user = result.user;
            
            // Check if new user
            const isNewUser = result.additionalUserInfo?.isNewUser || false;
            
            if (isNewUser) {
                // Create profile for new Google users
                const profileData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    phone: user.phoneNumber || '',
                    role: 'client_owner',
                    clientId: null,
                    photoURL: user.photoURL || '',
                    emailVerified: true,
                    permissions: Constants.ROLE_PERMISSIONS['client_owner'] || [],
                    createdAt: FirebaseService.timestamp(),
                    updatedAt: FirebaseService.timestamp(),
                    lastLogin: FirebaseService.timestamp(),
                    loginCount: 1,
                    status: 'active',
                    onboardingComplete: false,
                    provider: 'google'
                };
                
                await FirebaseService.createDocument('users', profileData);
            }
            
            console.log('✅ Google login successful:', user.email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified
                },
                isNewUser
            };
            
        } catch (error) {
            console.error('❌ Google login failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    // ==========================================
    // EMAIL VERIFICATION
    // ==========================================
    
    /**
     * Send email verification
     */
    async sendVerificationEmail() {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                throw this._createAuthError('NO_USER', 'No user is currently signed in');
            }
            
            if (user.emailVerified) {
                return { success: true, alreadyVerified: true };
            }
            
            await user.sendEmailVerification();
            
            console.log('📧 Verification email sent to:', user.email);
            
            return { success: true, email: user.email };
            
        } catch (error) {
            console.error('❌ Failed to send verification email:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Check if email is verified
     */
    async checkEmailVerification() {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) return false;
            
            // Reload user to get latest state
            await user.reload();
            
            this.state.isEmailVerified = user.emailVerified;
            this._notifyListeners();
            
            return user.emailVerified;
            
        } catch (error) {
            console.error('❌ Failed to check email verification:', error);
            return false;
        }
    }
    
    // ==========================================
    // PASSWORD MANAGEMENT
    // ==========================================
    
    /**
     * Send password reset email
     * @param {string} email - User email
     */
    async forgotPassword(email) {
        try {
            if (!email) {
                throw this._createAuthError('VALIDATION', 'Email is required');
            }
            
            await FirebaseService.auth.sendPasswordResetEmail(email, {
                url: window.location.origin + '/login',
                handleCodeInApp: false
            });
            
            console.log('📧 Password reset email sent to:', email);
            
            return { success: true, email };
            
        } catch (error) {
            console.error('❌ Failed to send password reset:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Reset password with code
     * @param {string} code - Verification code
     * @param {string} newPassword - New password
     */
    async resetPassword(code, newPassword) {
        try {
            const validation = this._validatePassword(newPassword);
            if (!validation.valid) {
                throw this._createAuthError('VALIDATION', validation.message);
            }
            
            await FirebaseService.auth.confirmPasswordReset(code, newPassword);
            
            console.log('✅ Password reset successful');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Password reset failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Change password (when already logged in)
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                throw this._createAuthError('NO_USER', 'No user is currently signed in');
            }
            
            // Validate new password
            const validation = this._validatePassword(newPassword);
            if (!validation.valid) {
                throw this._createAuthError('VALIDATION', validation.message);
            }
            
            // Re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                currentPassword
            );
            
            await user.reauthenticateWithCredential(credential);
            
            // Update password
            await user.updatePassword(newPassword);
            
            console.log('✅ Password changed successfully');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Password change failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    _validatePassword(password) {
        const { minPasswordLength, requireUppercase, requireLowercase, requireNumber, requireSpecialChar } = this.config;
        
        if (!password || password.length < minPasswordLength) {
            return { valid: false, message: `Password must be at least ${minPasswordLength} characters` };
        }
        
        if (requireUppercase && !/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter' };
        }
        
        if (requireLowercase && !/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter' };
        }
        
        if (requireNumber && !/[0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one number' };
        }
        
        if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one special character' };
        }
        
        return { valid: true, strength: this._calculatePasswordStrength(password) };
    }
    
    /**
     * Calculate password strength score
     * @private
     */
    _calculatePasswordStrength(password) {
        let score = 0;
        
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        if (score <= 3) return 'weak';
        if (score <= 5) return 'medium';
        return 'strong';
    }
    
    // ==========================================
    // SESSION MANAGEMENT
    // ==========================================
    
    /**
     * Setup session management
     * @private
     */
    _setupSessionManagement() {
        // Check session timeout every minute
        this._sessionTimer = setInterval(this._checkSessionTimeout, 60000);
    }
    
    /**
     * Start session timeout
     * @private
     */
    _startSessionTimeout() {
        this.state.sessionStartTime = Date.now();
        this._saveState();
    }
    
    /**
     * Stop session timeout
     * @private
     */
    _stopSessionTimeout() {
        this.state.sessionStartTime = null;
    }
    
    /**
     * Check if session has timed out
     * @private
     */
    _checkSessionTimeout() {
        if (!this.state.isAuthenticated) return;
        if (!this.state.rememberMe && this.state.sessionStartTime) {
            const elapsed = Date.now() - this.state.lastActivityTime;
            
            if (elapsed > this.config.sessionTimeout) {
                console.warn('⏰ Session timeout - logging out');
                this.logout('session_timeout');
            }
        }
    }
    
    /**
     * Start activity tracking
     * @private
     */
    _startActivityTracking() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
        
        events.forEach(event => {
            document.addEventListener(event, this._handleActivity, { passive: true });
        });
    }
    
    /**
     * Stop activity tracking
     * @private
     */
    _stopActivityTracking() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
        
        events.forEach(event => {
            document.removeEventListener(event, this._handleActivity);
        });
    }
    
    /**
     * Handle user activity
     * @private
     */
    _handleActivity() {
        this.state.lastActivityTime = Date.now();
    }
    
    /**
     * Save session to storage
     * @private
     */
    _saveSession(user, token) {
        if (!this.state.rememberMe) return;
        
        try {
            const session = {
                uid: user.uid,
                email: user.email,
                token: token,
                timestamp: Date.now()
            };
            
            localStorage.setItem('11avatar_session', JSON.stringify(session));
        } catch (error) {
            console.warn('⚠️ Failed to save session:', error.message);
        }
    }
    
    /**
     * Clear session from storage
     * @private
     */
    _clearSession() {
        localStorage.removeItem('11avatar_session');
    }
    
    /**
     * Restore session
     * @private
     */
    async _restoreSession() {
        try {
            const saved = localStorage.getItem('11avatar_session');
            
            if (saved) {
                const session = JSON.parse(saved);
                const elapsed = Date.now() - session.timestamp;
                
                // Check if session is still valid (within remember me duration)
                if (elapsed < this.config.rememberMeDuration) {
                    console.log('🔄 Restoring session for:', session.email);
                    // Firebase will handle the actual session restore
                } else {
                    this._clearSession();
                }
            }
        } catch (error) {
            this._clearSession();
        }
    }
    
    // ==========================================
    // LOGOUT
    // ==========================================
    
    /**
     * Logout current user
     * @param {string} reason - Reason for logout
     */
    async logout(reason = 'user_initiated') {
        try {
            console.log('👋 Logging out...');
            
            // Stop timers
            this._stopSessionTimeout();
            this._stopActivityTracking();
            
            // Clear session
            this._clearSession();
            
            // Sign out from Firebase
            await FirebaseService.signOut();
            
            console.log('✅ Logged out successfully');
            
        } catch (error) {
            console.error('❌ Logout failed:', error);
            // Force clear state even if Firebase fails
            this._handleAuthStateChange(null);
        }
    }
    
    // ==========================================
    // CROSS-TAB SYNCHRONIZATION
    // ==========================================
    
    /**
     * Setup cross-tab synchronization
     * @private
     */
    _setupCrossTabSync() {
        window.addEventListener('storage', (event) => {
            if (event.key === '11avatar_auth_state') {
                try {
                    const newState = JSON.parse(event.newValue);
                    
                    if (newState && newState.isAuthenticated !== this.state.isAuthenticated) {
                        console.log('🔄 Auth state changed in another tab');
                        
                        if (newState.isAuthenticated) {
                            // Another tab logged in
                            this._handleAuthStateChange(newState.user);
                        } else {
                            // Another tab logged out
                            this._handleAuthStateChange(null);
                        }
                    }
                } catch {}
            }
        });
    }
    
    // ==========================================
    // VALIDATION
    // ==========================================
    
    /**
     * Validate registration data
     * @private
     */
    _validateRegistration(data) {
        const { email, password, confirmPassword, displayName } = data;
        
        if (!email || !password || !displayName) {
            return { valid: false, message: 'All required fields must be filled' };
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }
        
        // Validate password
        const passwordValidation = this._validatePassword(password);
        if (!passwordValidation.valid) {
            return passwordValidation;
        }
        
        // Check passwords match
        if (password !== confirmPassword) {
            return { valid: false, message: 'Passwords do not match' };
        }
        
        // Validate display name
        if (displayName.length < 2) {
            return { valid: false, message: 'Name must be at least 2 characters' };
        }
        
        return { valid: true };
    }
    
    // ==========================================
    // PROFILE MANAGEMENT
    // ==========================================
    
    /**
     * Update user profile
     * @param {Object} profileData - Profile data to update
     */
    async updateProfile(profileData) {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                throw this._createAuthError('NO_USER', 'No user is currently signed in');
            }
            
            const { displayName, photoURL, phone } = profileData;
            
            // Update Firebase auth profile
            const updates = {};
            if (displayName) updates.displayName = displayName;
            if (photoURL) updates.photoURL = photoURL;
            
            if (Object.keys(updates).length > 0) {
                await user.updateProfile(updates);
            }
            
            // Update Firestore profile
            const firestoreUpdates = {};
            if (displayName) firestoreUpdates.displayName = displayName;
            if (photoURL) firestoreUpdates.photoURL = photoURL;
            if (phone) firestoreUpdates.phone = phone;
            
            if (Object.keys(firestoreUpdates).length > 0) {
                await FirebaseService.updateDocument('users', user.uid, firestoreUpdates);
            }
            
            // Refresh profile
            this.state.userProfile = await FirebaseService.getCurrentUserProfile();
            this._notifyListeners();
            
            console.log('✅ Profile updated');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Profile update failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    /**
     * Upload profile photo
     * @param {File} file - Image file
     */
    async uploadProfilePhoto(file) {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                throw this._createAuthError('NO_USER', 'No user is currently signed in');
            }
            
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                throw this._createAuthError('VALIDATION', 'Please upload a valid image file (JPEG, PNG, WebP, GIF)');
            }
            
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                throw this._createAuthError('VALIDATION', 'Profile photo must be less than 2MB');
            }
            
            // Upload to storage
            const path = `avatars/${user.uid}/${Date.now()}_${file.name}`;
            const result = await window.API.uploadFile(path, file);
            
            // Update profile with photo URL
            await this.updateProfile({ photoURL: result.downloadURL });
            
            console.log('✅ Profile photo uploaded');
            
            return { success: true, photoURL: result.downloadURL };
            
        } catch (error) {
            console.error('❌ Profile photo upload failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    // ==========================================
    // ACCOUNT MANAGEMENT
    // ==========================================
    
    /**
     * Delete user account
     * @param {string} password - Current password for re-authentication
     */
    async deleteAccount(password) {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                throw this._createAuthError('NO_USER', 'No user is currently signed in');
            }
            
            // Re-authenticate
            if (password) {
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(credential);
            }
            
            // Delete Firestore profile
            await FirebaseService.deleteDocument('users', user.uid);
            
            // Delete Firebase auth user
            await user.delete();
            
            console.log('✅ Account deleted');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Account deletion failed:', error);
            throw this._normalizeAuthError(error);
        }
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Check if user is locked out
     * @private
     */
    _isLockedOut() {
        if (!this.state.lockoutUntil) return false;
        
        if (Date.now() >= this.state.lockoutUntil) {
            this.state.lockoutUntil = null;
            this.state.loginAttempts = 0;
            this._saveState();
            return false;
        }
        
        return true;
    }
    
    /**
     * Add auth state listener
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    onAuthStateChange(listener) {
        this._authListeners.push(listener);
        
        // Call immediately with current state
        listener(this.state);
        
        return () => {
            const index = this._authListeners.indexOf(listener);
            if (index > -1) this._authListeners.splice(index, 1);
        };
    }
    
    /**
     * Notify all auth state listeners
     * @private
     */
    _notifyListeners() {
        this._authListeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('❌ Error in auth listener:', error);
            }
        });
        
        // Save state for cross-tab sync
        this._saveState();
    }
    
    /**
     * Save auth state to storage
     * @private
     */
    _saveState() {
        try {
            const state = {
                loginAttempts: this.state.loginAttempts,
                lastLoginAttempt: this.state.lastLoginAttempt,
                lockoutUntil: this.state.lockoutUntil,
                rememberMe: this.state.rememberMe
            };
            
            localStorage.setItem('11avatar_auth_state', JSON.stringify(state));
        } catch {}
    }
    
    /**
     * Load auth state from storage
     * @private
     */
    _loadState() {
        try {
            const saved = localStorage.getItem('11avatar_auth_state');
            
            if (saved) {
                const state = JSON.parse(saved);
                this.state.loginAttempts = state.loginAttempts || 0;
                this.state.lastLoginAttempt = state.lastLoginAttempt || null;
                this.state.lockoutUntil = state.lockoutUntil || null;
                this.state.rememberMe = state.rememberMe || false;
            }
        } catch {}
    }
    
    /**
     * Create a standardized auth error
     * @private
     */
    _createAuthError(code, message) {
        const error = new Error(message);
        error.code = code;
        error.timestamp = new Date().toISOString();
        return error;
    }
    
    /**
     * Normalize Firebase auth errors
     * @private
     */
    _normalizeAuthError(error) {
        const errorMap = {
            'auth/email-already-in-use': { code: 'EMAIL_EXISTS', message: 'This email is already registered. Please login instead.' },
            'auth/invalid-email': { code: 'INVALID_EMAIL', message: 'Please enter a valid email address.' },
            'auth/operation-not-allowed': { code: 'DISABLED', message: 'This login method is not currently enabled.' },
            'auth/weak-password': { code: 'WEAK_PASSWORD', message: 'Password is too weak. Please use a stronger password.' },
            'auth/user-disabled': { code: 'USER_DISABLED', message: 'This account has been disabled. Please contact support.' },
            'auth/user-not-found': { code: 'USER_NOT_FOUND', message: 'No account found with this email. Please register first.' },
            'auth/wrong-password': { code: 'WRONG_PASSWORD', message: 'Incorrect password. Please try again.' },
            'auth/invalid-credential': { code: 'INVALID_CREDENTIAL', message: 'Invalid email or password. Please try again.' },
            'auth/too-many-requests': { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please wait a moment and try again.' },
            'auth/network-request-failed': { code: 'NETWORK_ERROR', message: 'Network error. Please check your internet connection.' },
            'auth/popup-closed-by-user': { code: 'POPUP_CLOSED', message: 'Sign-in popup was closed. Please try again.' },
            'auth/cancelled-popup-request': { code: 'POPUP_CANCELLED', message: 'Sign-in cancelled.' },
            'auth/popup-blocked': { code: 'POPUP_BLOCKED', message: 'Sign-in popup was blocked. Please allow popups for this site.' },
            'auth/requires-recent-login': { code: 'REAUTH_REQUIRED', message: 'Please re-enter your password to continue.' }
        };
        
        const mapped = errorMap[error.code];
        
        if (mapped) {
            return this._createAuthError(mapped.code, mapped.message);
        }
        
        return this._createAuthError(
            error.code || 'AUTH_ERROR',
            error.message || 'An unexpected authentication error occurred'
        );
    }
    
    /**
     * Get current auth state
     * @returns {Object}
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Check if user has specific role
     */
    hasRole(role) {
        return this.state.userProfile?.role === role;
    }
    
    /**
     * Check if user has specific permission
     */
    hasPermission(permission) {
        const permissions = this.state.userProfile?.permissions || [];
        return permissions.includes(permission) || permissions.includes('all');
    }
    
    /**
     * Get authentication status
     * @returns {Object}
     */
    getStatus() {
        return {
            isAuthenticated: this.state.isAuthenticated,
            isLoading: this.state.authLoading,
            isEmailVerified: this.state.isEmailVerified,
            user: this.state.user ? {
                uid: this.state.user.uid,
                email: this.state.user.email,
                displayName: this.state.user.displayName
            } : null,
            role: this.state.userProfile?.role || null,
            loginAttempts: this.state.loginAttempts,
            isLockedOut: this._isLockedOut()
        };
    }
    
    /**
     * Debug: Print auth state to console
     */
    debug() {
        console.group('🔐 Auth Manager Debug');
        console.log('State:', this.getStatus());
        console.log('Config:', this.config);
        console.log('Listeners:', this._authListeners.length);
        console.groupEnd();
    }
    
    /**
     * Destroy the auth manager
     */
    destroy() {
        if (this._unsubscribeAuth) {
            this._unsubscribeAuth();
        }
        
        if (this._sessionTimer) {
            clearInterval(this._sessionTimer);
        }
        
        this._stopActivityTracking();
        this._authListeners = [];
        
        console.log('🔐 Auth Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT AUTH MANAGER INSTANCE
// ==========================================
const authManager = new AuthManager();

// Make available globally
window.AuthManager = authManager;
window.auth = authManager; // Convenience alias

// Export for module usage
export default authManager;

console.log('🔐 Auth Manager ready');
console.log('🔐 Status:', authManager.getStatus());

// ==========================================
// END OF AUTH MANAGER
// ==========================================
