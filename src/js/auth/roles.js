/* ==========================================
   11 AVATAR DIGITAL HUB
   Role Management System - Complete Role Administration
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Role CRUD operations
   - Role assignment & management
   - Role-based UI rendering
   - Role switching (admin impersonation)
   - Role validation
   - Role audit trail
   - Default role assignment
   - Role hierarchy enforcement
   - Custom role creation (future)
   - Role statistics & reporting
   ========================================== */

// ==========================================
// ROLE MANAGER CLASS
// ==========================================
class RoleManager {
    
    /**
     * Initialize the Role Manager
     */
    constructor() {
        // Configuration
        this.config = {
            allowRoleSwitching: true,
            allowSelfRoleChange: false,
            maxRoleAssignmentsPerDay: 100,
            auditRoleChanges: true,
            defaultClientRole: 'client_owner',
            defaultExecutiveRole: 'executive',
            defaultViewerRole: 'viewer'
        };
        
        // State
        this.state = {
            roles: {},
            roleHierarchy: {},
            roleAssignments: {},
            roleChangeHistory: [],
            roleStats: {},
            lastUpdated: null
        };
        
        // Bind methods
        this._handleAuthChange = this._handleAuthChange.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the role manager
     * @private
     */
    async _init() {
        console.log('👥 Initializing Role Manager...');
        
        // Load roles from constants
        this._loadRolesFromConstants();
        
        // Listen for auth changes
        window.EventBus?.on('auth:login', this._handleAuthChange);
        window.EventBus?.on('auth:logout', this._handleAuthChange);
        
        // Load role statistics
        await this._loadRoleStats();
        
        console.log('✅ Role Manager initialized');
        console.log('👥 Available Roles:', Object.keys(this.state.roles).length);
    }
    
    /**
     * Load roles from constants
     * @private
     */
    _loadRolesFromConstants() {
        if (!window.Constants || !window.Constants.ROLES) {
            console.error('❌ Constants not available');
            return;
        }
        
        this.state.roles = { ...window.Constants.ROLES };
        this.state.roleHierarchy = { ...window.Constants.ROLE_HIERARCHY };
    }
    
    /**
     * Handle auth state changes
     * @private
     */
    async _handleAuthChange() {
        await this._loadRoleStats();
    }
    
    /**
     * Load role statistics
     * @private
     */
    async _loadRoleStats() {
        try {
            const users = await FirebaseService.queryDocuments('users', [], { limit: 1000 });
            
            const stats = {};
            
            users.forEach(user => {
                const role = user.role || 'unknown';
                stats[role] = (stats[role] || 0) + 1;
            });
            
            this.state.roleStats = stats;
            this.state.lastUpdated = new Date().toISOString();
            
        } catch (error) {
            console.warn('⚠️ Failed to load role stats:', error.message);
        }
    }
    
    // ==========================================
    // ROLE INFORMATION
    // ==========================================
    
    /**
     * Get all available roles
     * @param {Object} options - Filter options
     * @returns {Object} Roles object
     */
    getRoles(options = {}) {
        const {
            platform = null,    // true = platform roles, false = client roles, null = all
            accessible = false  // Only roles current user can assign
        } = options;
        
        let roles = { ...this.state.roles };
        
        // Filter by platform/client
        if (platform === true) {
            roles = Object.fromEntries(
                Object.entries(roles).filter(([key, value]) => 
                    ['platform_owner', 'platform_super_admin', 'admin'].includes(value)
                )
            );
        } else if (platform === false) {
            roles = Object.fromEntries(
                Object.entries(roles).filter(([key, value]) => 
                    ['client_owner', 'client_admin', 'manager', 'executive', 'viewer'].includes(value)
                )
            );
        }
        
        // Filter by assignable roles
        if (accessible && window.permissions) {
            const currentRole = window.permissions.state?.currentRole;
            
            if (currentRole) {
                roles = Object.fromEntries(
                    Object.entries(roles).filter(([key, value]) => 
                        this.canAssignRole(currentRole, value)
                    )
                );
            }
        }
        
        return roles;
    }
    
    /**
     * Get role details
     * @param {string} roleId - Role identifier
     * @returns {Object|null} Role details
     */
    getRoleDetails(roleId) {
        const roleValue = this.state.roles[roleId] || roleId;
        const hierarchyInfo = this.state.roleHierarchy[roleValue];
        
        if (!hierarchyInfo) return null;
        
        return {
            id: roleId,
            value: roleValue,
            label: hierarchyInfo.label,
            icon: hierarchyInfo.icon,
            color: hierarchyInfo.color,
            description: hierarchyInfo.description,
            level: hierarchyInfo.level,
            access: hierarchyInfo.access,
            clientIdRequired: hierarchyInfo.clientId === 'required',
            canManagePlatform: hierarchyInfo.canManagePlatform,
            canManageClients: hierarchyInfo.canManageClients,
            canManageBilling: hierarchyInfo.canManageBilling,
            canViewAllData: hierarchyInfo.canViewAllData,
            maxUsers: hierarchyInfo.maxUsers,
            permissions: Constants.ROLE_PERMISSIONS[roleValue] || [],
            userCount: this.state.roleStats[roleValue] || 0
        };
    }
    
    /**
     * Get all platform roles
     * @returns {Object}
     */
    getPlatformRoles() {
        return this.getRoles({ platform: true });
    }
    
    /**
     * Get all client roles
     * @returns {Object}
     */
    getClientRoles() {
        return this.getRoles({ platform: false });
    }
    
    /**
     * Get role hierarchy information
     * @returns {Object}
     */
    getHierarchy() {
        return { ...this.state.roleHierarchy };
    }
    
    // ==========================================
    // ROLE ASSIGNMENT
    // ==========================================
    
    /**
     * Assign a role to a user
     * @param {string} userId - User ID
     * @param {string} role - Role to assign
     * @param {Object} options - Assignment options
     * @returns {Promise<Object>} Result
     */
    async assignRole(userId, role, options = {}) {
        const {
            clientId = null,
            notifyUser = true,
            reason = ''
        } = options;
        
        // Validate inputs
        if (!userId) throw new Error('User ID is required');
        if (!role) throw new Error('Role is required');
        
        // Validate role exists
        const roleValue = this.state.roles[role] || role;
        const roleInfo = this.state.roleHierarchy[roleValue];
        
        if (!roleInfo) {
            throw new Error(`Invalid role: ${role}`);
        }
        
        // Check permissions
        if (window.permissions && !window.permissions.can('users:edit')) {
            throw new Error('You do not have permission to assign roles');
        }
        
        // Check if current user can assign this role
        if (window.permissions) {
            const currentRole = window.permissions.state?.currentRole;
            
            if (currentRole && !this.canAssignRole(currentRole, roleValue)) {
                throw new Error('You cannot assign this role to users');
            }
        }
        
        // Check rate limiting
        const todayAssignments = this.state.roleChangeHistory.filter(
            h => h.date === new Date().toISOString().slice(0, 10)
        ).length;
        
        if (todayAssignments >= this.config.maxRoleAssignmentsPerDay) {
            throw new Error('Daily role assignment limit reached');
        }
        
        // Check role limit
        if (roleInfo.maxUsers && roleInfo.maxUsers !== Infinity) {
            const currentCount = this.state.roleStats[roleValue] || 0;
            
            if (currentCount >= roleInfo.maxUsers) {
                throw new Error(`Maximum number of ${roleInfo.label} users reached (${roleInfo.maxUsers})`);
            }
        }
        
        try {
            // Get current user data
            const userDoc = await FirebaseService.getDocument('users', userId);
            
            if (!userDoc) {
                throw new Error('User not found');
            }
            
            const previousRole = userDoc.role;
            
            // Validate client ID requirement
            if (roleInfo.clientId === 'required' && !clientId && !userDoc.clientId) {
                throw new Error('Client ID is required for this role');
            }
            
            // Prepare update data
            const updateData = {
                role: roleValue,
                roleUpdatedAt: FirebaseService.timestamp(),
                roleUpdatedBy: FirebaseService.getCurrentUser()?.uid || 'system'
            };
            
            if (clientId) {
                updateData.clientId = clientId;
            }
            
            // Get permissions for this role
            const permissions = Constants.ROLE_PERMISSIONS[roleValue] || [];
            updateData.permissions = permissions;
            
            // Update user document
            await FirebaseService.updateDocument('users', userId, updateData);
            
            // Log role change
            this._logRoleChange(userId, previousRole, roleValue, reason);
            
            // Update stats
            if (previousRole) {
                this.state.roleStats[previousRole] = Math.max(0, (this.state.roleStats[previousRole] || 1) - 1);
            }
            this.state.roleStats[roleValue] = (this.state.roleStats[roleValue] || 0) + 1;
            
            // Emit event
            window.EventBus?.emit('role:assigned', {
                userId,
                previousRole,
                newRole: roleValue,
                assignedBy: FirebaseService.getCurrentUser()?.uid
            });
            
            // Notify user if requested
            if (notifyUser && userDoc.email) {
                // Future: Send email notification
                console.log(`📧 Notification would be sent to ${userDoc.email}`);
            }
            
            console.log('✅ Role assigned:', roleValue, 'to user:', userId);
            
            return {
                success: true,
                userId,
                previousRole,
                newRole: roleValue,
                permissions
            };
            
        } catch (error) {
            console.error('❌ Failed to assign role:', error);
            throw error;
        }
    }
    
    /**
     * Remove a role from a user (set to default viewer)
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async removeRole(userId) {
        return this.assignRole(userId, 'viewer', {
            reason: 'Role removed by administrator'
        });
    }
    
    /**
     * Assign default role for new client owner
     * @param {string} userId - User ID
     * @param {string} clientId - Client ID
     * @returns {Promise<Object>}
     */
    async assignDefaultClientOwnerRole(userId, clientId) {
        return this.assignRole(userId, this.config.defaultClientRole, {
            clientId,
            reason: 'Default role for new client owner'
        });
    }
    
    /**
     * Assign default role for new executive
     * @param {string} userId - User ID
     * @param {string} clientId - Client ID
     * @returns {Promise<Object>}
     */
    async assignDefaultExecutiveRole(userId, clientId) {
        return this.assignRole(userId, this.config.defaultExecutiveRole, {
            clientId,
            reason: 'Default role for new executive'
        });
    }
    
    // ==========================================
    // ROLE VALIDATION
    // ==========================================
    
    /**
     * Check if a user can assign a specific role
     * @param {string} assignerRole - Role of the user assigning
     * @param {string} targetRole - Role to be assigned
     * @returns {boolean}
     */
    canAssignRole(assignerRole, targetRole) {
        // Platform owner can assign any role
        if (assignerRole === 'platform_owner') return true;
        
        // Can't assign platform_owner role
        if (targetRole === 'platform_owner') return false;
        
        // Platform super admin can assign anything except owner
        if (assignerRole === 'platform_super_admin') {
            return targetRole !== 'platform_owner';
        }
        
        // Platform admin can assign client roles only
        if (assignerRole === 'admin') {
            return ['client_owner', 'client_admin', 'manager', 'executive', 'viewer'].includes(targetRole);
        }
        
        // Client owner can assign roles within their own client
        if (assignerRole === 'client_owner') {
            return ['client_admin', 'manager', 'executive', 'viewer'].includes(targetRole);
        }
        
        // Client admin can assign lower roles
        if (assignerRole === 'client_admin') {
            return ['manager', 'executive', 'viewer'].includes(targetRole);
        }
        
        // Others cannot assign roles
        return false;
    }
    
    /**
     * Validate a role value
     * @param {string} role - Role to validate
     * @returns {Object} Validation result
     */
    validateRole(role) {
        const roleValue = this.state.roles[role] || role;
        const roleInfo = this.state.roleHierarchy[roleValue];
        
        if (!roleInfo) {
            return {
                valid: false,
                message: `Invalid role: ${role}`,
                suggestion: Object.keys(this.state.roles).join(', ')
            };
        }
        
        return {
            valid: true,
            role: roleValue,
            info: roleInfo
        };
    }
    
    /**
     * Suggest appropriate roles for a new user
     * @param {Object} userContext - Context about the new user
     * @returns {string[]} Suggested roles
     */
    suggestRoles(userContext = {}) {
        const suggestions = [];
        
        // If creating for a client, suggest client roles
        if (userContext.clientId) {
            suggestions.push('executive', 'manager');
        } else {
            // Platform roles
            suggestions.push('admin');
        }
        
        // Always suggest viewer as minimal access
        suggestions.push('viewer');
        
        return suggestions;
    }
    
    // ==========================================
    // ROLE SWITCHING (ADMIN FEATURE)
    // ==========================================
    
    /**
     * Switch to a different role (admin impersonation)
     * @param {string} targetRole - Role to switch to
     * @returns {Promise<Object>}
     */
    async switchRole(targetRole) {
        if (!this.config.allowRoleSwitching) {
            throw new Error('Role switching is not enabled');
        }
        
        // Only platform users can switch roles
        if (!window.permissions?.isPlatformUser()) {
            throw new Error('Only platform administrators can switch roles');
        }
        
        const validation = this.validateRole(targetRole);
        if (!validation.valid) {
            throw new Error(validation.message);
        }
        
        // Store original role
        const originalRole = window.permissions.state?.currentRole;
        
        // Temporarily change role in state
        if (window.permissions) {
            window.permissions.state.currentRole = targetRole;
            window.permissions.state.currentPermissions = 
                Constants.ROLE_PERMISSIONS[targetRole] || [];
        }
        
        console.log('🔄 Role switched to:', targetRole, '(Original:', originalRole, ')');
        
        // Emit event
        window.EventBus?.emit('role:switched', {
            from: originalRole,
            to: targetRole
        });
        
        return {
            success: true,
            switchedRole: targetRole,
            originalRole
        };
    }
    
    /**
     * Restore original role after switching
     * @returns {Promise<Object>}
     */
    async restoreRole() {
        // Reload permissions from server
        if (window.permissions) {
            await window.permissions._loadPermissions();
        }
        
        const currentRole = window.permissions?.state?.currentRole;
        
        console.log('🔄 Role restored to:', currentRole);
        
        window.EventBus?.emit('role:restored', {
            role: currentRole
        });
        
        return {
            success: true,
            role: currentRole
        };
    }
    
    // ==========================================
    // ROLE STATISTICS
    // ==========================================
    
    /**
     * Get role distribution statistics
     * @returns {Object}
     */
    getRoleStats() {
        const stats = {
            total: 0,
            platform: {},
            client: {},
            distribution: []
        };
        
        Object.entries(this.state.roleHierarchy).forEach(([roleValue, roleInfo]) => {
            const count = this.state.roleStats[roleValue] || 0;
            
            if (roleInfo.access === 'platform') {
                stats.platform[roleValue] = count;
            } else {
                stats.client[roleValue] = count;
            }
            
            stats.total += count;
            
            stats.distribution.push({
                role: roleValue,
                label: roleInfo.label,
                icon: roleInfo.icon,
                count,
                percentage: stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0
            });
        });
        
        return stats;
    }
    
    /**
     * Get users by role
     * @param {string} role - Role to filter by
     * @returns {Promise<Array>}
     */
    async getUsersByRole(role) {
        try {
            const conditions = [['role', '==', role]];
            return await FirebaseService.queryDocuments('users', conditions, { limit: 100 });
        } catch (error) {
            console.error('❌ Failed to get users by role:', error);
            return [];
        }
    }
    
    // ==========================================
    // AUDIT & LOGGING
    // ==========================================
    
    /**
     * Log a role change
     * @private
     */
    _logRoleChange(userId, fromRole, toRole, reason = '') {
        const logEntry = {
            userId,
            fromRole: fromRole || 'none',
            toRole,
            reason,
            changedBy: FirebaseService.getCurrentUser()?.uid || 'system',
            date: new Date().toISOString().slice(0, 10),
            timestamp: new Date().toISOString()
        };
        
        this.state.roleChangeHistory.push(logEntry);
        
        // Keep only last 100 entries
        if (this.state.roleChangeHistory.length > 100) {
            this.state.roleChangeHistory = this.state.roleChangeHistory.slice(-100);
        }
        
        // Save to Firestore if audit enabled
        if (this.config.auditRoleChanges) {
            FirebaseService.createDocument('history', {
                type: 'role_change',
                desc: `Role changed from ${fromRole || 'none'} to ${toRole} for user ${userId}`,
                ...logEntry
            }).catch(() => {});
        }
    }
    
    /**
     * Get role change history
     * @param {Object} filters - Filter options
     * @returns {Array}
     */
    getRoleChangeHistory(filters = {}) {
        let history = [...this.state.roleChangeHistory];
        
        if (filters.userId) {
            history = history.filter(h => h.userId === filters.userId);
        }
        
        if (filters.role) {
            history = history.filter(h => h.toRole === filters.role);
        }
        
        if (filters.date) {
            history = history.filter(h => h.date === filters.date);
        }
        
        return history.slice(-50);
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Get role display label
     * @param {string} role - Role value
     * @returns {string}
     */
    getRoleLabel(role) {
        const roleInfo = this.state.roleHierarchy[role];
        return roleInfo ? roleInfo.label : role || 'Unknown';
    }
    
    /**
     * Get role icon
     * @param {string} role - Role value
     * @returns {string}
     */
    getRoleIcon(role) {
        const roleInfo = this.state.roleHierarchy[role];
        return roleInfo ? roleInfo.icon : '👤';
    }
    
    /**
     * Get role color
     * @param {string} role - Role value
     * @returns {string}
     */
    getRoleColor(role) {
        const roleInfo = this.state.roleHierarchy[role];
        return roleInfo ? roleInfo.color : '#888888';
    }
    
    /**
     * Compare two roles
     * @param {string} role1 - First role
     * @param {string} role2 - Second role
     * @returns {number} -1 if role1 higher, 1 if role2 higher, 0 if same
     */
    compareRoles(role1, role2) {
        const level1 = this.state.roleHierarchy[role1]?.level || 99;
        const level2 = this.state.roleHierarchy[role2]?.level || 99;
        
        if (level1 < level2) return -1;
        if (level1 > level2) return 1;
        return 0;
    }
    
    /**
     * Check if role1 is higher than role2
     * @param {string} role1 - First role
     * @param {string} role2 - Second role
     * @returns {boolean}
     */
    isHigherRole(role1, role2) {
        return this.compareRoles(role1, role2) < 0;
    }
    
    /**
     * Get status
     * @returns {Object}
     */
    getStatus() {
        return {
            availableRoles: Object.keys(this.state.roles).length,
            stats: this.getRoleStats(),
            lastUpdated: this.state.lastUpdated,
            recentChanges: this.state.roleChangeHistory.slice(-5)
        };
    }
    
    /**
     * Debug
     */
    debug() {
        console.group('👥 Role Manager Debug');
        console.log('Status:', this.getStatus());
        console.log('Roles:', this.state.roles);
        console.log('Hierarchy:', this.state.roleHierarchy);
        console.groupEnd();
    }
    
    /**
     * Destroy
     */
    destroy() {
        window.EventBus?.off('auth:login', this._handleAuthChange);
        window.EventBus?.off('auth:logout', this._handleAuthChange);
        console.log('👥 Role Manager destroyed');
    }
}

// ==========================================
// CREATE & EXPORT
// ==========================================
const roleManager = new RoleManager();

window.RoleManager = roleManager;
window.roles = roleManager;

export default roleManager;

console.log('👥 Role Manager ready');
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
