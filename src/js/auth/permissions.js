/* ==========================================
   11 AVATAR DIGITAL HUB
   Permissions System - Complete RBAC Authorization
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Role-Based Access Control (RBAC)
   - Permission checking & enforcement
   - Route access control
   - Module access control
   - Feature access control
   - Data-level access control (clientId scoping)
   - UI element visibility based on permissions
   - Permission inheritance
   - Permission caching
   - Audit logging for permission checks
   ==========================================
   Permission Hierarchy:
   
   Platform Level (clientId = null):
   - platform_owner (Level 0)
   - platform_super_admin (Level 1)
   - platform_admin (Level 1.5)
   
   Client Level (clientId = required):
   - client_owner (Level 2)
   - client_admin (Level 3)
   - manager (Level 4)
   - executive (Level 5)
   - viewer (Level 6)
   ========================================== */

// ==========================================
// PERMISSIONS MANAGER CLASS
// ==========================================
class PermissionsManager {
    
    /**
     * Initialize the Permissions Manager
     */
    constructor() {
        // Configuration
        this.config = {
            cacheEnabled: true,
            cacheDuration: 5 * 60 * 1000, // 5 minutes
            strictMode: true, // Deny by default if no permission defined
            auditLog: false, // Log permission checks
            autoRefresh: true // Refresh permissions on role change
        };
        
        // State
        this.state = {
            initialized: false,
            currentUser: null,
            currentRole: null,
            currentPermissions: [],
            clientId: null,
            isPlatformUser: false,
            permissionCache: new Map()
        };
        
        // Bind methods
        this._handleAuthChange = this._handleAuthChange.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the permissions manager
     * @private
     */
    async _init() {
        console.log('🔑 Initializing Permissions Manager...');
        
        // Listen for auth changes
        window.EventBus?.on('auth:login', this._handleAuthChange);
        window.EventBus?.on('auth:logout', this._handleAuthChange);
        window.EventBus?.on('auth:profileUpdated', this._handleAuthChange);
        
        // Load initial permissions
        await this._loadPermissions();
        
        this.state.initialized = true;
        
        console.log('✅ Permissions Manager initialized');
        console.log('🔑 Role:', this.state.currentRole || 'Not authenticated');
        console.log('🔑 Platform User:', this.state.isPlatformUser);
        console.log('🔑 Permissions:', this.state.currentPermissions.length);
    }
    
    /**
     * Handle authentication state changes
     * @private
     */
    async _handleAuthChange(data) {
        console.log('🔑 Auth state changed, refreshing permissions...');
        await this._loadPermissions();
    }
    
    /**
     * Load permissions for current user
     * @private
     */
    async _loadPermissions() {
        try {
            const user = FirebaseService.getCurrentUser();
            
            if (!user) {
                // Not authenticated
                this.state.currentUser = null;
                this.state.currentRole = null;
                this.state.currentPermissions = [];
                this.state.clientId = null;
                this.state.isPlatformUser = false;
                return;
            }
            
            // Get user profile from Firestore
            const profile = await FirebaseService.getCurrentUserProfile();
            
            if (!profile) {
                console.warn('⚠️ User profile not found');
                return;
            }
            
            // Set state
            this.state.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName
            };
            
            this.state.currentRole = profile.role || null;
            this.state.clientId = profile.clientId || null;
            this.state.isPlatformUser = this._isPlatformRole(this.state.currentRole);
            
            // Get permissions based on role
            this.state.currentPermissions = this._getPermissionsForRole(this.state.currentRole);
            
            // Check for custom permissions in profile
            if (profile.permissions && Array.isArray(profile.permissions)) {
                // Merge with role-based permissions
                const mergedPermissions = new Set([
                    ...this.state.currentPermissions,
                    ...profile.permissions
                ]);
                this.state.currentPermissions = Array.from(mergedPermissions);
            }
            
            // Clear permission cache
            this.state.permissionCache.clear();
            
            console.log('🔑 Permissions loaded for:', profile.role);
            
            // Emit event
            window.EventBus?.emit('permissions:updated', {
                role: this.state.currentRole,
                permissions: this.state.currentPermissions,
                clientId: this.state.clientId
            });
            
        } catch (error) {
            console.error('❌ Failed to load permissions:', error);
        }
    }
    
    /**
     * Get permissions for a specific role
     * @private
     */
    _getPermissionsForRole(role) {
        if (!role) return [];
        
        // Get from Constants
        const permissions = Constants.ROLE_PERMISSIONS[role];
        
        if (permissions) {
            return [...permissions];
        }
        
        // Fallback: derive from role hierarchy
        return this._derivePermissions(role);
    }
    
    /**
     * Derive permissions from role hierarchy
     * @private
     */
    _derivePermissions(role) {
        const roleInfo = Constants.ROLE_HIERARCHY[role];
        
        if (!roleInfo) return [];
        
        // Platform owners and super admins get all permissions
        if (role === 'platform_owner' || role === 'platform_super_admin') {
            return Object.values(Constants.PERMISSIONS);
        }
        
        // Platform admins get most permissions except billing
        if (role === 'admin') {
            return Object.values(Constants.PERMISSIONS).filter(
                p => !p.startsWith('billing:')
            );
        }
        
        // Client roles
        const clientPermissions = [
            Constants.PERMISSIONS.LEADS_VIEW,
            Constants.PERMISSIONS.LEADS_CREATE,
            Constants.PERMISSIONS.LEADS_EDIT,
            Constants.PERMISSIONS.CLIENTS_VIEW,
            Constants.PERMISSIONS.PIPELINE_VIEW,
            Constants.PERMISSIONS.REVENUE_VIEW,
            Constants.PERMISSIONS.REPORTS_VIEW
        ];
        
        if (role === 'client_owner' || role === 'client_admin') {
            clientPermissions.push(
                Constants.PERMISSIONS.LEADS_DELETE,
                Constants.PERMISSIONS.LEADS_EXPORT,
                Constants.PERMISSIONS.LEADS_IMPORT,
                Constants.PERMISSIONS.CLIENTS_CREATE,
                Constants.PERMISSIONS.CLIENTS_EDIT,
                Constants.PERMISSIONS.PIPELINE_MANAGE,
                Constants.PERMISSIONS.REVENUE_ADD,
                Constants.PERMISSIONS.REVENUE_EDIT,
                Constants.PERMISSIONS.REPORTS_EXPORT,
                Constants.PERMISSIONS.SETTINGS_VIEW,
                Constants.PERMISSIONS.USERS_VIEW
            );
        }
        
        if (role === 'client_owner') {
            clientPermissions.push(
                Constants.PERMISSIONS.CLIENTS_DELETE,
                Constants.PERMISSIONS.REVENUE_DELETE,
                Constants.PERMISSIONS.SETTINGS_EDIT,
                Constants.PERMISSIONS.USERS_CREATE,
                Constants.PERMISSIONS.USERS_EDIT,
                Constants.PERMISSIONS.USERS_DELETE,
                Constants.PERMISSIONS.BACKUP_CREATE,
                Constants.PERMISSIONS.BACKUP_RESTORE
            );
        }
        
        return clientPermissions;
    }
    
    /**
     * Check if a role is a platform-level role
     * @private
     */
    _isPlatformRole(role) {
        if (!role) return false;
        return ['platform_owner', 'platform_super_admin', 'admin'].includes(role);
    }
    
    // ==========================================
    // PERMISSION CHECKING
    // ==========================================
    
    /**
     * Check if current user has a specific permission
     * @param {string} permission - Permission to check
     * @param {Object} options - Check options
     * @returns {boolean} Whether user has permission
     * 
     * @example
     * permissions.can('leads:create')
     * permissions.can('revenue:delete')
     * permissions.can('users:manage')
     */
    can(permission, options = {}) {
        const {
            auditLog = this.config.auditLog,
            useCache = this.config.cacheEnabled,
            throwError = false
        } = options;
        
        // If not initialized, deny in strict mode
        if (!this.state.initialized) {
            if (this.config.strictMode) {
                if (throwError) throw new Error('Permissions not initialized');
                return false;
            }
            return true; // Allow in non-strict mode
        }
        
        // Platform owners can do everything
        if (this.state.currentRole === 'platform_owner') {
            return true;
        }
        
        // Check cache
        if (useCache) {
            const cached = this.state.permissionCache.get(permission);
            if (cached !== undefined && (Date.now() - cached.timestamp < this.config.cacheDuration)) {
                return cached.result;
            }
        }
        
        // Check permission
        const result = this._checkPermission(permission);
        
        // Cache result
        if (useCache) {
            this.state.permissionCache.set(permission, {
                result,
                timestamp: Date.now()
            });
        }
        
        // Audit log
        if (auditLog) {
            console.log(`🔑 [Permission Check] ${permission}: ${result ? '✅' : '❌'}`);
        }
        
        // Throw error if required
        if (!result && throwError) {
            throw new Error(`Permission denied: ${permission}`);
        }
        
        return result;
    }
    
    /**
     * Check multiple permissions (ALL must be true)
     * @param {string[]} permissions - Permissions to check
     * @param {Object} options - Check options
     * @returns {boolean}
     * 
     * @example
     * permissions.canAll(['leads:view', 'leads:create', 'leads:edit'])
     */
    canAll(permissions, options = {}) {
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return true;
        }
        
        return permissions.every(permission => this.can(permission, options));
    }
    
    /**
     * Check multiple permissions (ANY must be true)
     * @param {string[]} permissions - Permissions to check
     * @param {Object} options - Check options
     * @returns {boolean}
     * 
     * @example
     * permissions.canAny(['leads:create', 'leads:import'])
     */
    canAny(permissions, options = {}) {
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return true;
        }
        
        return permissions.some(permission => this.can(permission, options));
    }
    
    /**
     * Actual permission check logic
     * @private
     */
    _checkPermission(permission) {
        // No user = no permissions
        if (!this.state.currentRole) {
            return false;
        }
        
        // Platform roles have all permissions (except billing for super admin)
        if (this.state.isPlatformUser) {
            if (this.state.currentRole === 'platform_owner') {
                return true;
            }
            
            if (this.state.currentRole === 'platform_super_admin') {
                return !permission.startsWith('billing:');
            }
            
            if (this.state.currentRole === 'admin') {
                const adminDenied = ['billing:', 'platform:manage', 'backup:restore'];
                return !adminDenied.some(denied => permission.startsWith(denied));
            }
        }
        
        // Check in current permissions list
        if (this.state.currentPermissions.includes(permission)) {
            return true;
        }
        
        // Check for wildcard permissions
        if (this.state.currentPermissions.includes('all')) {
            return true;
        }
        
        // Check for category wildcards
        const category = permission.split(':')[0] + ':*';
        if (this.state.currentPermissions.includes(category)) {
            return true;
        }
        
        // Deny by default
        return false;
    }
    
    // ==========================================
    // ROLE CHECKS
    // ==========================================
    
    /**
     * Check if current user has a specific role
     * @param {string|string[]} roles - Role(s) to check
     * @returns {boolean}
     */
    hasRole(roles) {
        if (!this.state.currentRole) return false;
        
        if (Array.isArray(roles)) {
            return roles.includes(this.state.currentRole);
        }
        
        return this.state.currentRole === roles;
    }
    
    /**
     * Check if user is a platform-level user
     * @returns {boolean}
     */
    isPlatformUser() {
        return this.state.isPlatformUser;
    }
    
    /**
     * Check if user is a client-level user
     * @returns {boolean}
     */
    isClientUser() {
        return !this.state.isPlatformUser && !!this.state.currentRole;
    }
    
    /**
     * Get current user's role level
     * @returns {number}
     */
    getRoleLevel() {
        if (!this.state.currentRole) return -1;
        
        const roleInfo = Constants.ROLE_HIERARCHY[this.state.currentRole];
        return roleInfo ? roleInfo.level : -1;
    }
    
    /**
     * Check if current user's role is higher than given role
     * @param {string} role - Role to compare
     * @returns {boolean}
     */
    isHigherRoleThan(role) {
        const currentLevel = this.getRoleLevel();
        const compareLevel = Constants.ROLE_HIERARCHY[role]?.level || -1;
        return currentLevel < compareLevel; // Lower number = higher role
    }
    
    // ==========================================
    // DATA ACCESS CONTROL
    // ==========================================
    
    /**
     * Get client ID for data scoping
     * @returns {string|null}
     */
    getClientId() {
        return this.state.clientId;
    }
    
    /**
     * Check if user can access data belonging to a specific client
     * @param {string} dataClientId - Client ID on the data
     * @returns {boolean}
     */
    canAccessClientData(dataClientId) {
        // Platform users can access all client data
        if (this.state.isPlatformUser) {
            return true;
        }
        
        // Client users can only access their own client's data
        return this.state.clientId === dataClientId;
    }
    
    /**
     * Build Firestore query conditions for data scoping
     * @returns {Array} Query conditions
     */
    getDataScopeConditions() {
        // Platform users can see all data
        if (this.state.isPlatformUser) {
            return [];
        }
        
        // Client users are scoped to their clientId
        if (this.state.clientId) {
            return [['clientId', '==', this.state.clientId]];
        }
        
        // No scope = no data
        return [['clientId', '==', '__no_access__']];
    }
    
    // ==========================================
    // ROUTE ACCESS
    // ==========================================
    
    /**
     * Check if user can access a specific route
     * @param {string} routeId - Route identifier
     * @returns {boolean}
     */
    canAccessRoute(routeId) {
        if (!window.RoutesConfig) return false;
        
        const route = window.RoutesConfig.getRoute(routeId);
        
        if (!route) return false;
        
        // Public routes are accessible to all
        if (route.access === null) return true;
        
        // Check authentication
        if (!this.state.currentRole) return false;
        
        // Platform users can access all routes
        if (this.state.isPlatformUser) return true;
        
        // Route accessible to all authenticated users
        if (route.access === 'all') return true;
        
        // Check specific permission
        return this.can(route.access);
    }
    
    /**
     * Get all routes accessible to current user
     * @returns {Array}
     */
    getAccessibleRoutes() {
        if (!window.RoutesConfig) return [];
        
        return window.RoutesConfig.getAccessibleRoutes(this.state.currentRole);
    }
    
    // ==========================================
    // UI ELEMENT CONTROL
    // ==========================================
    
    /**
     * Apply visibility to DOM elements based on permissions
     * Hides elements that user doesn't have permission for
     * 
     * @example
     * <button data-permission="leads:create">New Lead</button>
     * <div data-permission="revenue:delete">Delete Revenue</div>
     * <a data-permission-any="leads:export,leads:import">Export/Import</a>
     */
    applyUIElementVisibility(container = document) {
        // Single permission elements
        const permissionElements = container.querySelectorAll('[data-permission]');
        
        permissionElements.forEach(element => {
            const permission = element.getAttribute('data-permission');
            
            if (permission && !this.can(permission)) {
                this._hideElement(element);
            } else {
                this._showElement(element);
            }
        });
        
        // All permissions required
        const allPermissionElements = container.querySelectorAll('[data-permission-all]');
        
        allPermissionElements.forEach(element => {
            const permissions = element.getAttribute('data-permission-all').split(',');
            
            if (!this.canAll(permissions)) {
                this._hideElement(element);
            } else {
                this._showElement(element);
            }
        });
        
        // Any permission required
        const anyPermissionElements = container.querySelectorAll('[data-permission-any]');
        
        anyPermissionElements.forEach(element => {
            const permissions = element.getAttribute('data-permission-any').split(',');
            
            if (!this.canAny(permissions)) {
                this._hideElement(element);
            } else {
                this._showElement(element);
            }
        });
        
        // Role-based elements
        const roleElements = container.querySelectorAll('[data-role]');
        
        roleElements.forEach(element => {
            const roles = element.getAttribute('data-role').split(',');
            
            if (!this.hasRole(roles)) {
                this._hideElement(element);
            } else {
                this._showElement(element);
            }
        });
    }
    
    /**
     * Hide a DOM element
     * @private
     */
    _hideElement(element) {
        // Store original display value
        if (!element.hasAttribute('data-original-display')) {
            const computedStyle = window.getComputedStyle(element);
            element.setAttribute('data-original-display', computedStyle.display);
        }
        
        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
    }
    
    /**
     * Show a DOM element
     * @private
     */
    _showElement(element) {
        const originalDisplay = element.getAttribute('data-original-display');
        
        if (originalDisplay) {
            element.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
        } else {
            element.style.display = '';
        }
        
        element.removeAttribute('aria-hidden');
    }
    
    // ==========================================
    // PERMISSION MANAGEMENT (ADMIN)
    // ==========================================
    
    /**
     * Grant a permission to a user
     * @param {string} userId - User ID
     * @param {string} permission - Permission to grant
     */
    async grantPermission(userId, permission) {
        if (!this.can('users:edit')) {
            throw new Error('Permission denied: Cannot grant permissions');
        }
        
        try {
            const userDoc = await FirebaseService.getDocument('users', userId);
            
            if (!userDoc) {
                throw new Error('User not found');
            }
            
            const currentPermissions = userDoc.permissions || [];
            
            if (currentPermissions.includes(permission)) {
                return { success: true, message: 'Permission already granted' };
            }
            
            const updatedPermissions = [...currentPermissions, permission];
            
            await FirebaseService.updateDocument('users', userId, {
                permissions: updatedPermissions
            });
            
            console.log('✅ Permission granted:', permission, 'to user:', userId);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to grant permission:', error);
            throw error;
        }
    }
    
    /**
     * Revoke a permission from a user
     * @param {string} userId - User ID
     * @param {string} permission - Permission to revoke
     */
    async revokePermission(userId, permission) {
        if (!this.can('users:edit')) {
            throw new Error('Permission denied: Cannot revoke permissions');
        }
        
        try {
            const userDoc = await FirebaseService.getDocument('users', userId);
            
            if (!userDoc) {
                throw new Error('User not found');
            }
            
            const currentPermissions = userDoc.permissions || [];
            const updatedPermissions = currentPermissions.filter(p => p !== permission);
            
            await FirebaseService.updateDocument('users', userId, {
                permissions: updatedPermissions
            });
            
            console.log('✅ Permission revoked:', permission, 'from user:', userId);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to revoke permission:', error);
            throw error;
        }
    }
    
    /**
     * Set a user's role
     * @param {string} userId - User ID
     * @param {string} role - New role
     */
    async setUserRole(userId, role) {
        if (!this.can('users:edit')) {
            throw new Error('Permission denied: Cannot change user roles');
        }
        
        if (!Constants.ROLES[Object.keys(Constants.ROLES).find(k => Constants.ROLES[k] === role)]) {
            throw new Error('Invalid role: ' + role);
        }
        
        try {
            const newPermissions = this._getPermissionsForRole(role);
            
            await FirebaseService.updateDocument('users', userId, {
                role: role,
                permissions: newPermissions
            });
            
            console.log('✅ Role updated:', role, 'for user:', userId);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to set user role:', error);
            throw error;
        }
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Get current permissions list
     * @returns {string[]}
     */
    getPermissions() {
        return [...this.state.currentPermissions];
    }
    
    /**
     * Get current role information
     * @returns {Object|null}
     */
    getRoleInfo() {
        if (!this.state.currentRole) return null;
        
        const roleInfo = Constants.ROLE_HIERARCHY[this.state.currentRole];
        
        return roleInfo ? {
            role: this.state.currentRole,
            label: roleInfo.label,
            icon: roleInfo.icon,
            level: roleInfo.level,
            description: roleInfo.description,
            isPlatform: this.state.isPlatformUser,
            clientId: this.state.clientId
        } : null;
    }
    
    /**
     * Get all available permissions
     * @returns {Object}
     */
    getAllPermissions() {
        return { ...Constants.PERMISSIONS };
    }
    
    /**
     * Get all available roles
     * @returns {Object}
     */
    getAllRoles() {
        return { ...Constants.ROLES };
    }
    
    /**
     * Get detailed status
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this.state.initialized,
            authenticated: !!this.state.currentUser,
            role: this.state.currentRole,
            roleInfo: this.getRoleInfo(),
            permissions: this.state.currentPermissions,
            permissionCount: this.state.currentPermissions.length,
            clientId: this.state.clientId,
            isPlatformUser: this.state.isPlatformUser,
            cacheSize: this.state.permissionCache.size
        };
    }
    
    /**
     * Debug: Print permissions state
     */
    debug() {
        console.group('🔑 Permissions Manager Debug');
        console.log('Status:', this.getStatus());
        console.log('All Permissions:', this.getAllPermissions());
        console.log('All Roles:', this.getAllRoles());
        console.groupEnd();
    }
    
    /**
     * Destroy the permissions manager
     */
    destroy() {
        window.EventBus?.off('auth:login', this._handleAuthChange);
        window.EventBus?.off('auth:logout', this._handleAuthChange);
        window.EventBus?.off('auth:profileUpdated', this._handleAuthChange);
        
        this.state.permissionCache.clear();
        
        console.log('🔑 Permissions Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT PERMISSIONS MANAGER INSTANCE
// ==========================================
const permissionsManager = new PermissionsManager();

// Make available globally
window.PermissionsManager = permissionsManager;
window.permissions = permissionsManager; // Convenience alias

// Export for module usage
export default permissionsManager;

console.log('🔑 Permissions Manager ready');

// ==========================================
// END OF PERMISSIONS MANAGER
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
