/* ==========================================
   11 AVATAR DIGITAL HUB
   Session Management System
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Session lifecycle management
   - Token refresh & rotation
   - Multi-tab session sync
   - Session timeout & renewal
   - Idle detection
   - Session persistence (remember me)
   - Session security (force logout)
   - Active session tracking
   - Session audit logging
   - Device & browser fingerprinting
   ========================================== */

// ==========================================
// SESSION MANAGER CLASS
// ==========================================
class SessionManager {
    
    /**
     * Initialize the Session Manager
     */
    constructor() {
        // Configuration
        this.config = {
            // Timeouts
            sessionTimeout: 30 * 60 * 1000,        // 30 minutes idle timeout
            absoluteTimeout: 8 * 60 * 60 * 1000,    // 8 hours absolute max
            rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
            
            // Token refresh
            tokenRefreshInterval: 50 * 60 * 1000,   // Refresh token every 50 minutes
            tokenRefreshBuffer: 5 * 60 * 1000,      // Refresh 5 minutes before expiry
            
            // Idle detection
            idleThreshold: 5 * 60 * 1000,           // 5 minutes of no activity = idle
            idleCheckInterval: 30 * 1000,            // Check every 30 seconds
            
            // Security
            forceLogoutOnTokenExpiry: true,
            forceLogoutOnPasswordChange: true,
            maxConcurrentSessions: 5,
            
            // Persistence
            saveSessionData: true,
            sessionStorageKey: '11avatar_session',
            
            // Warnings
            showTimeoutWarning: true,
            warningBeforeTimeout: 2 * 60 * 1000     // Show warning 2 minutes before
        };
        
        // State
        this.state = {
            sessionId: null,
            sessionStart: null,
            lastActivity: Date.now(),
            lastTokenRefresh: null,
            tokenExpiry: null,
            isIdle: false,
            isExpired: false,
            rememberMe: false,
            activeTab: true,
            warningShown: false
        };
        
        // Timers
        this._timers = {
            idle: null,
            refresh: null,
            warning: null,
            absolute: null
        };
        
        // Bind methods
        this._handleActivity = this._handleActivity.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._handleStorageChange = this._handleStorageChange.bind(this);
        this._checkIdle = this._checkIdle.bind(this);
        this._refreshToken = this._refreshToken.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the session manager
     * @private
     */
    async _init() {
        console.log('⏱️ Initializing Session Manager...');
        
        // Listen for auth changes
        window.EventBus?.on('auth:login', (data) => {
            this._startSession(data);
        });
        
        window.EventBus?.on('auth:logout', () => {
            this._endSession('user_logout');
        });
        
        // Setup activity tracking
        this._setupActivityTracking();
        
        // Setup visibility tracking
        this._setupVisibilityTracking();
        
        // Setup cross-tab sync
        this._setupCrossTabSync();
        
        // Restore session if exists
        await this._restoreSession();
        
        // If already authenticated, start session
        if (window.auth?.state?.isAuthenticated) {
            this._startSession({
                user: window.auth.state.user,
                rememberMe: window.auth.state.rememberMe
            });
        }
        
        console.log('✅ Session Manager initialized');
    }
    
    // ==========================================
    // SESSION LIFECYCLE
    // ==========================================
    
    /**
     * Start a new session
     * @private
     */
    _startSession(data = {}) {
        const { user, rememberMe = false } = data;
        
        if (!user) {
            console.warn('⚠️ Cannot start session without user');
            return;
        }
        
        console.log('⏱️ Starting new session...');
        
        // Generate session ID
        this.state.sessionId = this._generateSessionId();
        this.state.sessionStart = Date.now();
        this.state.lastActivity = Date.now();
        this.state.rememberMe = rememberMe;
        this.state.isExpired = false;
        this.state.warningShown = false;
        
        // Save session to storage
        if (this.config.saveSessionData) {
            this._saveSessionData();
        }
        
        // Start timers
        this._startAllTimers();
        
        // Save session to Firestore (for tracking)
        this._saveSessionToFirestore(user);
        
        console.log('✅ Session started:', this.state.sessionId);
        console.log('⏱️ Session duration:', rememberMe ? '30 days (remember me)' : '30 minutes (idle timeout)');
    }
    
    /**
     * End the current session
     * @private
     */
    _endSession(reason = 'unknown') {
        console.log('⏱️ Ending session... Reason:', reason);
        
        // Stop all timers
        this._stopAllTimers();
        
        // Clear session data
        if (this.config.saveSessionData) {
            this._clearSessionData();
        }
        
        // Reset state
        this.state.sessionId = null;
        this.state.sessionStart = null;
        this.state.lastActivity = Date.now();
        this.state.lastTokenRefresh = null;
        this.state.tokenExpiry = null;
        this.state.isIdle = false;
        this.state.isExpired = true;
        this.state.rememberMe = false;
        this.state.warningShown = false;
        
        console.log('✅ Session ended');
    }
    
    /**
     * Renew the current session
     */
    renewSession() {
        if (!this.state.sessionId) {
            console.warn('⚠️ No active session to renew');
            return;
        }
        
        console.log('⏱️ Renewing session...');
        
        this.state.lastActivity = Date.now();
        this.state.isIdle = false;
        this.state.isExpired = false;
        this.state.warningShown = false;
        
        // Reset idle timer
        this._resetIdleTimer();
        
        // Reset absolute timer
        this._resetAbsoluteTimer();
        
        // Save updated session
        if (this.config.saveSessionData) {
            this._saveSessionData();
        }
        
        // Emit event
        window.EventBus?.emit('session:renewed', {
            sessionId: this.state.sessionId
        });
        
        console.log('✅ Session renewed');
    }
    
    /**
     * Extend session (update last activity)
     */
    extendSession() {
        this.state.lastActivity = Date.now();
        this.state.isIdle = false;
        this.state.warningShown = false;
        
        // Reset idle timer
        this._resetIdleTimer();
    }
    
    // ==========================================
    // ACTIVITY TRACKING
    // ==========================================
    
    /**
     * Setup activity tracking
     * @private
     */
    _setupActivityTracking() {
        const events = [
            'mousedown', 'mousemove',
            'keydown', 'keypress',
            'touchstart', 'touchmove',
            'scroll', 'wheel',
            'click', 'focus'
        ];
        
        events.forEach(eventName => {
            document.addEventListener(eventName, this._handleActivity, { passive: true });
        });
        
        console.log('👆 Activity tracking setup with', events.length, 'events');
    }
    
    /**
     * Handle user activity
     * @private
     */
    _handleActivity() {
        this.extendSession();
    }
    
    /**
     * Setup visibility tracking
     * @private
     */
    _setupVisibilityTracking() {
        document.addEventListener('visibilitychange', this._handleVisibilityChange);
    }
    
    /**
     * Handle visibility change (tab switch)
     * @private
     */
    _handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.state.activeTab = true;
            this.extendSession();
            console.log('👁️ Tab active');
        } else {
            this.state.activeTab = false;
            console.log('👁️ Tab hidden');
        }
    }
    
    /**
     * Setup cross-tab synchronization
     * @private
     */
    _setupCrossTabSync() {
        window.addEventListener('storage', this._handleStorageChange);
    }
    
    /**
     * Handle storage changes from other tabs
     * @private
     */
    _handleStorageChange(event) {
        if (event.key === this.config.sessionStorageKey) {
            try {
                const newSession = JSON.parse(event.newValue);
                
                if (newSession && newSession.sessionId !== this.state.sessionId) {
                    console.log('🔄 Session changed in another tab');
                    
                    if (newSession.isExpired) {
                        // Another tab logged out
                        this._endSession('other_tab_logout');
                        window.EventBus?.emit('auth:logout', { reason: 'other_tab' });
                    }
                }
            } catch (error) {
                console.warn('⚠️ Failed to parse session data from storage');
            }
        }
    }
    
    // ==========================================
    // TIMER MANAGEMENT
    // ==========================================
    
    /**
     * Start all session timers
     * @private
     */
    _startAllTimers() {
        this._resetIdleTimer();
        this._startTokenRefreshTimer();
        this._startAbsoluteTimer();
    }
    
    /**
     * Stop all session timers
     * @private
     */
    _stopAllTimers() {
        if (this._timers.idle) clearInterval(this._timers.idle);
        if (this._timers.refresh) clearInterval(this._timers.refresh);
        if (this._timers.warning) clearTimeout(this._timers.warning);
        if (this._timers.absolute) clearTimeout(this._timers.absolute);
        
        this._timers.idle = null;
        this._timers.refresh = null;
        this._timers.warning = null;
        this._timers.absolute = null;
    }
    
    /**
     * Reset idle timer
     * @private
     */
    _resetIdleTimer() {
        if (this._timers.idle) {
            clearInterval(this._timers.idle);
        }
        
        this._timers.idle = setInterval(this._checkIdle, this.config.idleCheckInterval);
    }
    
    /**
     * Check if user is idle
     * @private
     */
    _checkIdle() {
        if (!this.state.sessionId) return;
        
        const idleTime = Date.now() - this.state.lastActivity;
        
        // Check if idle
        if (idleTime >= this.config.idleThreshold) {
            if (!this.state.isIdle) {
                this.state.isIdle = true;
                console.log('💤 User became idle');
                window.EventBus?.emit('session:idle', { idleTime });
            }
        }
        
        // Check if session expired
        if (!this.state.rememberMe) {
            if (idleTime >= this.config.sessionTimeout) {
                this._handleSessionTimeout();
            } else if (idleTime >= (this.config.sessionTimeout - this.config.warningBeforeTimeout)) {
                this._showTimeoutWarning();
            }
        }
    }
    
    /**
     * Start token refresh timer
     * @private
     */
    _startTokenRefreshTimer() {
        if (this._timers.refresh) {
            clearInterval(this._timers.refresh);
        }
        
        this._timers.refresh = setInterval(this._refreshToken, this.config.tokenRefreshInterval);
    }
    
    /**
     * Refresh auth token
     * @private
     */
    async _refreshToken() {
        if (!window.auth?.state?.isAuthenticated) return;
        
        try {
            const user = FirebaseService.getCurrentUser();
            if (!user) return;
            
            const token = await user.getIdToken(true);
            
            this.state.lastTokenRefresh = Date.now();
            
            // Decode token to get expiry
            const payload = this._decodeToken(token);
            if (payload && payload.exp) {
                this.state.tokenExpiry = payload.exp * 1000;
            }
            
            console.log('🔑 Token refreshed');
            
            window.EventBus?.emit('session:tokenRefreshed', {
                expiry: this.state.tokenExpiry
            });
            
        } catch (error) {
            console.error('❌ Token refresh failed:', error);
            
            if (this.config.forceLogoutOnTokenExpiry) {
                this._handleSessionTimeout();
            }
        }
    }
    
    /**
     * Start absolute session timeout
     * @private
     */
    _startAbsoluteTimer() {
        if (this._timers.absolute) {
            clearTimeout(this._timers.absolute);
        }
        
        if (!this.state.rememberMe) {
            this._timers.absolute = setTimeout(() => {
                console.log('⏰ Absolute session timeout reached');
                this._handleSessionTimeout();
            }, this.config.absoluteTimeout);
        }
    }
    
    /**
     * Reset absolute timeout
     * @private
     */
    _resetAbsoluteTimer() {
        if (this._timers.absolute) {
            clearTimeout(this._timers.absolute);
        }
        this._startAbsoluteTimer();
    }
    
    /**
     * Handle session timeout
     * @private
     */
    async _handleSessionTimeout() {
        console.warn('⏰ Session timed out');
        
        this.state.isExpired = true;
        
        // Stop all timers
        this._stopAllTimers();
        
        // Clear session data
        if (this.config.saveSessionData) {
            this._clearSessionData();
        }
        
        // Emit event
        window.EventBus?.emit('session:expired', {
            reason: 'timeout',
            idleTime: Date.now() - this.state.lastActivity
        });
        
        // Force logout
        if (this.config.forceLogoutOnTokenExpiry && window.auth) {
            await window.auth.logout('session_timeout');
        }
        
        // Show message
        if (window.App?.toast) {
            window.App.toast('Session expired. Please login again.', 'warning', 8000);
        }
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = '#/login?reason=session_expired';
        }, 1500);
    }
    
    /**
     * Show timeout warning
     * @private
     */
    _showTimeoutWarning() {
        if (this.state.warningShown) return;
        
        this.state.warningShown = true;
        
        const remainingMinutes = Math.ceil(
            (this.config.sessionTimeout - (Date.now() - this.state.lastActivity)) / 60000
        );
        
        console.warn('⏰ Session timeout warning:', remainingMinutes, 'minutes remaining');
        
        window.EventBus?.emit('session:timeoutWarning', {
            remainingMinutes,
            remainingMs: this.config.sessionTimeout - (Date.now() - this.state.lastActivity)
        });
        
        // Show warning toast
        if (window.App?.toast && this.config.showTimeoutWarning) {
            window.App.toast(
                `Your session will expire in ${remainingMinutes} minute(s). Click anywhere to stay signed in.`,
                'warning',
                10000
            );
        }
    }
    
    // ==========================================
    // SESSION PERSISTENCE
    // ==========================================
    
    /**
     * Save session data to localStorage
     * @private
     */
    _saveSessionData() {
        if (!this.config.saveSessionData) return;
        
        try {
            const sessionData = {
                sessionId: this.state.sessionId,
                sessionStart: this.state.sessionStart,
                lastActivity: this.state.lastActivity,
                rememberMe: this.state.rememberMe,
                isExpired: this.state.isExpired,
                timestamp: Date.now()
            };
            
            localStorage.setItem(
                this.config.sessionStorageKey,
                JSON.stringify(sessionData)
            );
        } catch (error) {
            console.warn('⚠️ Failed to save session data:', error.message);
        }
    }
    
    /**
     * Clear session data from localStorage
     * @private
     */
    _clearSessionData() {
        try {
            localStorage.removeItem(this.config.sessionStorageKey);
        } catch (error) {
            console.warn('⚠️ Failed to clear session data:', error.message);
        }
    }
    
    /**
     * Restore session from localStorage
     * @private
     */
    async _restoreSession() {
        try {
            const saved = localStorage.getItem(this.config.sessionStorageKey);
            
            if (!saved) return;
            
            const sessionData = JSON.parse(saved);
            
            // Check if session is still valid
            if (sessionData.isExpired) {
                this._clearSessionData();
                return;
            }
            
            // Check if remember me session is within duration
            if (sessionData.rememberMe) {
                const age = Date.now() - sessionData.sessionStart;
                if (age > this.config.rememberMeDuration) {
                    this._clearSessionData();
                    return;
                }
            } else {
                // Non-remember me sessions don't persist across browser restarts
                this._clearSessionData();
                return;
            }
            
            console.log('🔄 Session restored from storage');
            
            // Restore state
            this.state.sessionId = sessionData.sessionId;
            this.state.sessionStart = sessionData.sessionStart;
            this.state.lastActivity = Date.now();
            this.state.rememberMe = sessionData.rememberMe;
            this.state.isExpired = false;
            
            // Restart timers
            this._startAllTimers();
            
        } catch (error) {
            console.warn('⚠️ Failed to restore session:', error.message);
            this._clearSessionData();
        }
    }
    
    /**
     * Save session to Firestore for audit
     * @private
     */
    async _saveSessionToFirestore(user) {
        try {
            const sessionInfo = {
                userId: user.uid,
                sessionId: this.state.sessionId,
                ip: 'client-side',
                userAgent: navigator.userAgent,
                browser: this._getBrowserInfo(),
                device: this._getDeviceInfo(),
                os: this._getOSInfo(),
                startTime: new Date().toISOString(),
                rememberMe: this.state.rememberMe
            };
            
            await FirebaseService.createDocument('sessions', sessionInfo);
            
            console.log('📝 Session logged to Firestore');
            
        } catch (error) {
            console.warn('⚠️ Failed to save session to Firestore:', error.message);
        }
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Generate unique session ID
     * @private
     */
    _generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    }
    
    /**
     * Decode JWT token payload
     * @private
     */
    _decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64).split('').map(c => 
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join('')
            );
            return JSON.parse(jsonPayload);
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Get browser information
     * @private
     */
    _getBrowserInfo() {
        const ua = navigator.userAgent;
        
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        if (ua.includes('Opera')) return 'Opera';
        
        return 'Unknown';
    }
    
    /**
     * Get device information
     * @private
     */
    _getDeviceInfo() {
        if (window.innerWidth <= 768) return 'Mobile';
        if (window.innerWidth <= 1024) return 'Tablet';
        return 'Desktop';
    }
    
    /**
     * Get OS information
     * @private
     */
    _getOSInfo() {
        const ua = navigator.userAgent;
        
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        
        return 'Unknown';
    }
    
    /**
     * Get session status
     * @returns {Object}
     */
    getStatus() {
        const now = Date.now();
        const sessionAge = this.state.sessionStart ? now - this.state.sessionStart : 0;
        const idleTime = now - this.state.lastActivity;
        const remainingTime = this.state.rememberMe ? 
            this.config.rememberMeDuration - sessionAge :
            this.config.sessionTimeout - idleTime;
        
        return {
            active: !!this.state.sessionId && !this.state.isExpired,
            sessionId: this.state.sessionId,
            sessionAge: Math.floor(sessionAge / 1000),
            idleTime: Math.floor(idleTime / 1000),
            remainingTime: Math.floor(remainingTime / 1000),
            isIdle: this.state.isIdle,
            isExpired: this.state.isExpired,
            rememberMe: this.state.rememberMe,
            activeTab: this.state.activeTab,
            warningShown: this.state.warningShown
        };
    }
    
    /**
     * Debug
     */
    debug() {
        console.group('⏱️ Session Manager Debug');
        console.log('Status:', this.getStatus());
        console.log('Config:', this.config);
        console.log('Timers:', Object.keys(this._timers).filter(k => this._timers[k]));
        console.groupEnd();
    }
    
    /**
     * Destroy
     */
    destroy() {
        this._stopAllTimers();
        
        const events = ['mousedown', 'mousemove', 'keydown', 'keypress', 'touchstart', 'touchmove', 'scroll', 'wheel', 'click', 'focus'];
        events.forEach(eventName => {
            document.removeEventListener(eventName, this._handleActivity);
        });
        
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
        window.removeEventListener('storage', this._handleStorageChange);
        
        window.EventBus?.off('auth:login');
        window.EventBus?.off('auth:logout');
        
        console.log('⏱️ Session Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT
// ==========================================
const sessionManager = new SessionManager();

window.SessionManager = sessionManager;
window.session = sessionManager;

export default sessionManager;

console.log('⏱️ Session Manager ready');


