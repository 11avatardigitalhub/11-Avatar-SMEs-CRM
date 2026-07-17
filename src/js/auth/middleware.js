/* ==========================================
   11 AVATAR DIGITAL HUB
   Auth Middleware - Route Protection & Access Control
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Route protection (auth required)
   - Role-based access control
   - Permission checking middleware
   - Redirect unauthorized users
   - Session validation
   - Email verification check
   - Onboarding status check
   - Subscription status check
   - Maintenance mode check
   - Rate limiting per route
   - Audit logging for access attempts
   ==========================================
   Middleware Chain:
   Request → Auth Check → Role Check → Permission Check → Page
   ========================================== */

// ==========================================
// MIDDLEWARE MANAGER CLASS
// ==========================================
class MiddlewareManager {
    
    /**
     * Initialize the Middleware Manager
     */
    constructor() {
        // Configuration
        this.config = {
            redirectToLogin: '/login',
            redirectToDashboard: '/dashboard',
            redirectToOnboarding: '/onboarding',
            redirectToVerifyEmail: '/verify-email',
            redirectToMaintenance: '/maintenance',
            redirectToSubscription: '/subscription',
            redirectToUnauthorized: '/unauthorized',
            
            // Checks to perform
            checks: {
                auth: true,
                emailVerification: true,
                onboarding: false,
                subscription: false,
                maintenance: false,
                rateLimit: false
            },
            
            // Rate limiting
            rateLimit: {
                enabled: false,
                maxRequests: 100,
                windowMs: 60000 // 1 minute
            }
        };
        
        // State
        this.state = {
            middlewareStack: [],
            accessLog: [],
            blockedRoutes: new Set(),
            rateLimitMap: new Map()
        };
        
        // Bind methods
        this._handleNavigation = this._handleNavigation.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the middleware manager
     * @private
     */
    _init() {
        console.log('🛡️ Initializing Auth Middleware...');
        
        // Register default middleware
        this._registerDefaultMiddleware();
        
        // Listen for navigation events
        window.EventBus?.on('navigation:change', this._handleNavigation);
        
        // Listen for auth changes
        window.EventBus?.on('auth:login', () => {
            this.state.blockedRoutes.clear();
        });
        
        window.EventBus?.on('auth:logout', () => {
            this.state.accessLog = [];
        });
        
        console.log('✅ Auth Middleware initialized');
        console.log('🛡️ Middleware stack:', this.state.middlewareStack.length, 'layers');
    }
    
    /**
     * Register default middleware layers
     * @private
     */
    _registerDefaultMiddleware() {
        // Layer 1: Maintenance Mode Check
        if (this.config.checks.maintenance) {
            this.use(this._maintenanceCheck.bind(this));
        }
        
        // Layer 2: Authentication Check
        if (this.config.checks.auth) {
            this.use(this._authCheck.bind(this));
        }
        
        // Layer 3: Email Verification Check
        if (this.config.checks.emailVerification) {
            this.use(this._emailVerificationCheck.bind(this));
        }
        
        // Layer 4: Onboarding Check
        if (this.config.checks.onboarding) {
            this.use(this._onboardingCheck.bind(this));
        }
        
        // Layer 5: Subscription Check
        if (this.config.checks.subscription) {
            this.use(this._subscriptionCheck.bind(this));
        }
        
        // Layer 6: Role & Permission Check
        this.use(this._permissionCheck.bind(this));
        
        // Layer 7: Rate Limit Check
        if (this.config.rateLimit.enabled) {
            this.use(this._rateLimitCheck.bind(this));
        }
    }
    
    /**
     * Add middleware to the stack
     * @param {Function} middleware - Middleware function
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.state.middlewareStack.push(middleware);
        
        console.log('🛡️ Middleware registered:', middleware.name || 'anonymous');
    }
    
    /**
     * Remove middleware from the stack
     * @param {string} name - Middleware name to remove
     */
    remove(name) {
        const index = this.state.middlewareStack.findIndex(m => m.name === name);
        
        if (index > -1) {
            this.state.middlewareStack.splice(index, 1);
            console.log('🛡️ Middleware removed:', name);
        }
    }
    
    /**
     * Handle navigation event
     * @private
     */
    async _handleNavigation(data) {
        const { page, params } = data;
        
        console.log('🛡️ Middleware: Checking access to', page);
        
        try {
            // Run middleware stack
            const result = await this._runMiddleware(page, params);
            
            if (!result.allowed) {
                console.warn('🛡️ Access denied to', page, ':', result.reason);
                
                // Block the route
                this.state.blockedRoutes.add(page);
                
                // Log access attempt
                this._logAccess(page, false, result.reason);
                
                // Redirect
                this._redirect(result.redirectTo, {
                    originalRoute: page,
                    reason: result.reason
                });
                
                return false;
            }
            
            // Access granted
            this.state.blockedRoutes.delete(page);
            this._logAccess(page, true);
            
            return true;
            
        } catch (error) {
            console.error('❌ Middleware error:', error);
            return false;
        }
    }
    
    /**
     * Run the middleware stack
     * @private
     */
    async _runMiddleware(route, params = {}) {
        let context = {
            route,
            params,
            allowed: true,
            redirectTo: null,
            reason: null,
            user: window.auth?.state?.user || null,
            isAuthenticated: window.auth?.state?.isAuthenticated || false,
            userProfile: window.auth?.state?.userProfile || null,
            role: window.permissions?.state?.currentRole || null,
            permissions: window.permissions?.state?.currentPermissions || []
        };
        
        // Run each middleware in sequence
        for (const middleware of this.state.middlewareStack) {
            try {
                const result = await middleware(context);
                
                // If middleware returns false, stop the chain
                if (result === false) {
                    context.allowed = false;
                    break;
                }
                
                // If middleware returns redirect info
                if (result && result.redirectTo) {
                    context.allowed = false;
                    context.redirectTo = result.redirectTo;
                    context.reason = result.reason || 'Access denied by middleware';
                    break;
                }
                
            } catch (error) {
                console.error('❌ Middleware execution error:', error);
                context.allowed = false;
                context.reason = 'Middleware error';
                context.redirectTo = '/error';
                break;
            }
        }
        
        return context;
    }
    
    // ==========================================
    // MIDDLEWARE LAYERS
    // ==========================================
    
    /**
     * Maintenance Mode Check
     * @private
     */
    async _maintenanceCheck(context) {
        const maintenanceMode = window.StateManager?.get('system.maintenanceMode');
        
        if (maintenanceMode && context.role !== 'platform_owner') {
            return {
                redirectTo: this.config.redirectToMaintenance,
                reason: 'System is under maintenance'
            };
        }
        
        return true;
    }
    
    /**
     * Authentication Check
     * @private
     */
    async _authCheck(context) {
        // Get route info
        const route = window.RoutesConfig?.getRoute(context.route);
        
        // Public routes don't require authentication
        if (route && route.access === null) {
            return true;
        }
        
        // Check if user is authenticated
        if (!context.isAuthenticated) {
            return {
                redirectTo: this.config.redirectToLogin,
                reason: 'Authentication required'
            };
        }
        
        return true;
    }
    
    /**
     * Email Verification Check
     * @private
     */
    async _emailVerificationCheck(context) {
        // Skip for public routes
        const route = window.RoutesConfig?.getRoute(context.route);
        if (route && route.access === null) return true;
        
        // Skip if user is not authenticated
        if (!context.isAuthenticated) return true;
        
        // Check if email is verified
        const isVerified = window.auth?.state?.isEmailVerified;
        
        if (!isVerified) {
            // Allow access to verification page and settings
            const allowedRoutes = ['verify-email', 'settings', 'profile', 'logout'];
            
            if (!allowedRoutes.includes(context.route)) {
                return {
                    redirectTo: this.config.redirectToVerifyEmail,
                    reason: 'Email verification required'
                };
            }
        }
        
        return true;
    }
    
    /**
     * Onboarding Check
     * @private
     */
    async _onboardingCheck(context) {
        // Skip if not required
        if (!this.config.checks.onboarding) return true;
        
        // Skip for public routes
        const route = window.RoutesConfig?.getRoute(context.route);
        if (route && route.access === null) return true;
        
        // Skip if user is not authenticated
        if (!context.isAuthenticated) return true;
        
        // Check onboarding status
        const onboardingComplete = window.auth?.state?.userProfile?.onboardingComplete;
        
        if (!onboardingComplete) {
            // Allow access to onboarding page only
            if (context.route !== 'onboarding') {
                return {
                    redirectTo: this.config.redirectToOnboarding,
                    reason: 'Onboarding not completed'
                };
            }
        }
        
        return true;
    }
    
    /**
     * Subscription Check
     * @private
     */
    async _subscriptionCheck(context) {
        // Skip if not required
        if (!this.config.checks.subscription) return true;
        
        // Skip for platform users
        if (window.permissions?.isPlatformUser()) return true;
        
        // Skip for public routes
        const route = window.RoutesConfig?.getRoute(context.route);
        if (route && route.access === null) return true;
        
        // Check subscription status
        const subscriptionStatus = context.userProfile?.subscriptionStatus || 'active';
        
        if (subscriptionStatus !== 'active') {
            return {
                redirectTo: this.config.redirectToSubscription,
                reason: 'Subscription inactive'
            };
        }
        
        return true;
    }
    
    /**
     * Permission Check
     * @private
     */
    async _permissionCheck(context) {
        // Get route info
        const route = window.RoutesConfig?.getRoute(context.route);
        
        // Public routes are accessible to all
        if (route && route.access === null) return true;
        
        // Routes accessible to all authenticated users
        if (route && route.access === 'all') return true;
        
        // Check specific permission
        if (route && route.access) {
            const hasAccess = window.permissions?.can(route.access);
            
            if (!hasAccess) {
                return {
                    redirectTo: this.config.redirectToUnauthorized,
                    reason: `Permission denied: ${route.access}`
                };
            }
        }
        
        return true;
    }
    
    /**
     * Rate Limit Check
     * @private
     */
    async _rateLimitCheck(context) {
        if (!this.config.rateLimit.enabled) return true;
        
        const key = `${context.route}_${context.user?.uid || 'anonymous'}`;
        const now = Date.now();
        
        // Get or create rate limit entry
        if (!this.state.rateLimitMap.has(key)) {
            this.state.rateLimitMap.set(key, {
                count: 0,
                resetTime: now + this.config.rateLimit.windowMs
            });
        }
        
        const entry = this.state.rateLimitMap.get(key);
        
        // Reset if window has passed
        if (now > entry.resetTime) {
            entry.count = 0;
            entry.resetTime = now + this.config.rateLimit.windowMs;
        }
        
        // Increment counter
        entry.count++;
        
        // Check if over limit
        if (entry.count > this.config.rateLimit.maxRequests) {
            return {
                redirectTo: '/rate-limited',
                reason: 'Rate limit exceeded'
            };
        }
        
        return true;
    }
    
    // ==========================================
    // ROUTE PROTECTION
    // ==========================================
    
    /**
     * Protect a route with specific checks
     * @param {string} routeId - Route to protect
     * @param {Object} options - Protection options
     * @returns {Function} Middleware function
     */
    protect(routeId, options = {}) {
        const {
            requireAuth = true,
            requireRole = null,
            requirePermission = null,
            requireEmailVerified = false,
            requireOnboarding = false,
            requireSubscription = false
        } = options;
        
        return async (context) => {
            // Only apply to specific route
            if (context.route !== routeId) return true;
            
            // Auth check
            if (requireAuth && !context.isAuthenticated) {
                return {
                    redirectTo: this.config.redirectToLogin,
                    reason: 'Authentication required for this route'
                };
            }
            
            // Role check
            if (requireRole) {
                const roles = Array.isArray(requireRole) ? requireRole : [requireRole];
                
                if (!roles.includes(context.role)) {
                    return {
                        redirectTo: this.config.redirectToUnauthorized,
                        reason: `Role required: ${roles.join(' or ')}`
                    };
                }
            }
            
            // Permission check
            if (requirePermission) {
                const hasPermission = window.permissions?.can(requirePermission);
                
                if (!hasPermission) {
                    return {
                        redirectTo: this.config.redirectToUnauthorized,
                        reason: `Permission required: ${requirePermission}`
                    };
                }
            }
            
            // Email verification check
            if (requireEmailVerified && !window.auth?.state?.isEmailVerified) {
                return {
                    redirectTo: this.config.redirectToVerifyEmail,
                    reason: 'Email verification required'
                };
            }
            
            // Onboarding check
            if (requireOnboarding && !context.userProfile?.onboardingComplete) {
                return {
                    redirectTo: this.config.redirectToOnboarding,
                    reason: 'Onboarding required'
                };
            }
            
            // Subscription check
            if (requireSubscription) {
                const status = context.userProfile?.subscriptionStatus;
                
                if (status !== 'active') {
                    return {
                        redirectTo: this.config.redirectToSubscription,
                        reason: 'Active subscription required'
                    };
                }
            }
            
            return true;
        };
    }
    
    /**
     * Protect admin routes
     */
    protectAdminRoutes() {
        const adminRoutes = ['admin', 'settings', 'audit'];
        
        adminRoutes.forEach(route => {
            this.use(this.protect(route, {
                requireRole: ['platform_owner', 'platform_super_admin', 'admin'],
                requireEmailVerified: true
            }));
        });
        
        console.log('🛡️ Admin routes protected');
    }
    
    /**
     * Protect client routes
     */
    protectClientRoutes() {
        const clientRoutes = ['dashboard', 'leads', 'pipeline', 'clients', 'revenue', 'projects'];
        
        clientRoutes.forEach(route => {
            this.use(this.protect(route, {
                requireAuth: true,
                requireEmailVerified: true
            }));
        });
        
        console.log('🛡️ Client routes protected');
    }
    
    // ==========================================
    // ACCESS LOGGING
    // ==========================================
    
    /**
     * Log access attempt
     * @private
     */
    _logAccess(route, allowed, reason = null) {
        const logEntry = {
            route,
            allowed,
            reason,
            user: window.auth?.state?.user?.uid || 'anonymous',
            role: window.permissions?.state?.currentRole || 'none',
            timestamp: new Date().toISOString()
        };
        
        this.state.accessLog.push(logEntry);
        
        // Keep only last 100 entries
        if (this.state.accessLog.length > 100) {
            this.state.accessLog = this.state.accessLog.slice(-100);
        }
        
        // Save to Firestore for audit (async, don't block)
        if (allowed === false) {
            FirebaseService.createDocument('activityLogs', {
                type: 'access_denied',
                ...logEntry
            }).catch(() => {});
        }
        
        if (!allowed) {
            console.warn('🛡️ Access denied:', logEntry);
        }
    }
    
    // ==========================================
    // REDIRECT
    // ==========================================
    
    /**
     * Redirect user
     * @private
     */
    _redirect(path, params = {}) {
        // Build query string
        const queryParams = new URLSearchParams();
        
        if (params.originalRoute) {
            queryParams.set('redirect', params.originalRoute);
        }
        
        if (params.reason) {
            queryParams.set('reason', params.reason);
        }
        
        const queryString = queryParams.toString();
        const fullPath = queryString ? `${path}?${queryString}` : path;
        
        // Use router if available
        if (window.Router) {
            const routeId = window.Router.pathToRouteId(path.replace(/^\//, ''));
            
            if (routeId) {
                window.Router.navigateTo(routeId);
                return;
            }
        }
        
        // Fallback: direct navigation
        window.location.href = '#' + fullPath;
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Check if a route is accessible
     * @param {string} route - Route to check
     * @returns {Promise<boolean>}
     */
    async canAccess(route) {
        const result = await this._runMiddleware(route);
        return result.allowed;
    }
    
    /**
     * Check if current route is blocked
     * @returns {boolean}
     */
    isBlocked() {
        const currentRoute = window.Router?.currentRoute;
        return currentRoute ? this.state.blockedRoutes.has(currentRoute) : false;
    }
    
    /**
     * Get access log
     * @param {Object} filters - Filter options
     * @returns {Array}
     */
    getAccessLog(filters = {}) {
        let log = [...this.state.accessLog];
        
        if (filters.route) {
            log = log.filter(entry => entry.route === filters.route);
        }
        
        if (filters.user) {
            log = log.filter(entry => entry.user === filters.user);
        }
        
        if (filters.allowed !== undefined) {
            log = log.filter(entry => entry.allowed === filters.allowed);
        }
        
        return log.slice(-50);
    }
    
    /**
     * Get blocked routes
     * @returns {string[]}
     */
    getBlockedRoutes() {
        return Array.from(this.state.blockedRoutes);
    }
    
    /**
     * Clear access log
     */
    clearAccessLog() {
        this.state.accessLog = [];
        console.log('🛡️ Access log cleared');
    }
    
    /**
     * Get middleware status
     * @returns {Object}
     */
    getStatus() {
        return {
            stackSize: this.state.middlewareStack.length,
            blockedRoutes: this.state.blockedRoutes.size,
            accessLogEntries: this.state.accessLog.length,
            deniedToday: this.state.accessLog.filter(
                e => !e.allowed && e.timestamp?.startsWith(new Date().toISOString().slice(0, 10))
            ).length,
            checks: this.config.checks,
            rateLimitEnabled: this.config.rateLimit.enabled
        };
    }
    
    /**
     * Debug
     */
    debug() {
        console.group('🛡️ Middleware Manager Debug');
        console.log('Status:', this.getStatus());
        console.log('Stack:', this.state.middlewareStack.map(m => m.name || 'anonymous'));
        console.log('Blocked Routes:', Array.from(this.state.blockedRoutes));
        console.log('Recent Log:', this.state.accessLog.slice(-5));
        console.groupEnd();
    }
    
    /**
     * Destroy
     */
    destroy() {
        window.EventBus?.off('navigation:change', this._handleNavigation);
        
        this.state.middlewareStack = [];
        this.state.accessLog = [];
        this.state.blockedRoutes.clear();
        this.state.rateLimitMap.clear();
        
        console.log('🛡️ Auth Middleware destroyed');
    }
}

// ==========================================
// CREATE & EXPORT
// ==========================================
const middlewareManager = new MiddlewareManager();

// Protect default routes
middlewareManager.protectAdminRoutes();
middlewareManager.protectClientRoutes();

window.MiddlewareManager = middlewareManager;
window.middleware = middlewareManager;

export default middlewareManager;

console.log('🛡️ Auth Middleware ready');
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
