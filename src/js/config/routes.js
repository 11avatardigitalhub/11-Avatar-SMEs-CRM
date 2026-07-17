/* ==========================================
   11 AVATAR DIGITAL HUB
   Route Configuration & Navigation Map
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Define all application routes
   - Page metadata (title, icon, theme, access)
   - Sub-menu configurations per page
   - Route guards & middleware
   - Breadcrumb generation
   - Dynamic route matching
   ========================================== */

// ==========================================
// ROUTE DEFINITIONS
// ==========================================

/**
 * Main Application Routes
 * 
 * Each route defines:
 * - path: URL path for the route
 * - page: HTML file to load
 * - title: Page title for browser tab
 * - icon: Display icon for navigation
 * - theme: 'public' or 'internal'
 * - access: Minimum role required (null = public)
 * - module: Module name for lazy loading
 * - submenu: Array of sub-navigation buttons for this page
 * - description: Page description for SEO
 */
const ROUTES = {
    
    // ==========================================
    // PUBLIC ROUTES (No Authentication Required)
    // ==========================================
    
    landing: {
        path: '/',
        page: 'index.html',
        title: '11 Avatar Digital Hub - Master Revenue CRM',
        icon: '🏠',
        theme: 'public',
        access: null,
        module: null,
        description: 'Complete CRM solution for Indian SMEs - Leads to Revenue to Retention',
        submenu: [
            { id: 'hero', label: 'Home', icon: '🏠' },
            { id: 'features', label: 'Features', icon: '⭐' },
            { id: 'pricing', label: 'Pricing', icon: '💰' },
            { id: 'testimonials', label: 'Testimonials', icon: '💬' },
            { id: 'faq', label: 'FAQ', icon: '❓' },
            { id: 'contact', label: 'Contact', icon: '📧' }
        ]
    },
    
    login: {
        path: '/login',
        page: 'login.html',
        title: 'Login - 11 Avatar Digital Hub',
        icon: '🔐',
        theme: 'public',
        access: null,
        module: null,
        description: 'Login to your 11 Avatar CRM account',
        submenu: []
    },
    
    register: {
        path: '/register',
        page: 'register.html',
        title: 'Register - 11 Avatar Digital Hub',
        icon: '📝',
        theme: 'public',
        access: null,
        module: null,
        description: 'Create your free 11 Avatar CRM account',
        submenu: []
    },
    
    forgotPassword: {
        path: '/forgot-password',
        page: 'forgot-password.html',
        title: 'Forgot Password - 11 Avatar Digital Hub',
        icon: '🔑',
        theme: 'public',
        access: null,
        module: null,
        description: 'Reset your password',
        submenu: []
    },
    
    notFound: {
        path: '/404',
        page: '404.html',
        title: 'Page Not Found - 11 Avatar Digital Hub',
        icon: '❓',
        theme: 'public',
        access: null,
        module: null,
        description: 'The page you are looking for does not exist',
        submenu: []
    },
    
    offline: {
        path: '/offline',
        page: 'offline.html',
        title: 'You are Offline - 11 Avatar Digital Hub',
        icon: '📡',
        theme: 'public',
        access: null,
        module: null,
        description: 'Please check your internet connection',
        submenu: []
    },
    
    error: {
        path: '/error',
        page: 'error.html',
        title: 'Error - 11 Avatar Digital Hub',
        icon: '⚠️',
        theme: 'internal',
        access: null,
        module: null,
        description: 'Something went wrong',
        submenu: []
    },
    
    // ==========================================
    // AUTHENTICATED ROUTES (Internal Pages)
    // ==========================================
    
    dashboard: {
        path: '/dashboard',
        page: 'src/pages/dashboard.html',
        title: 'Dashboard - 11 Avatar Digital Hub',
        icon: '📊',
        theme: 'internal',
        access: 'all',
        module: 'dashboard',
        description: 'Your business at a glance',
        submenu: [
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'today-tasks', label: "Today's Tasks", icon: '📋' },
            { id: 'revenue-stats', label: 'Revenue Stats', icon: '💰' },
            { id: 'quick-actions', label: 'Quick Actions', icon: '⚡' },
            { id: 'recent-activity', label: 'Recent Activity', icon: '🕐' }
        ]
    },
    
    leads: {
        path: '/leads',
        page: 'src/pages/leads.html',
        title: 'Leads Management - 11 Avatar Digital Hub',
        icon: '📋',
        theme: 'internal',
        access: 'all',
        module: 'leads',
        description: 'Manage, track, and convert your leads',
        submenu: [
            { id: 'all-leads', label: 'All Leads', icon: '📇', badge: null },
            { id: 'new-lead', label: 'New Lead', icon: '➕', badge: null },
            { id: 'import-export', label: 'Import / Export', icon: '📤', badge: null },
            { id: 'kanban-view', label: 'Kanban View', icon: '📊', badge: null },
            { id: 'lead-stats', label: 'Lead Stats', icon: '📈', badge: null }
        ]
    },
    
    pipeline: {
        path: '/pipeline',
        page: 'src/pages/pipeline.html',
        title: 'Sales Pipeline - 11 Avatar Digital Hub',
        icon: '🔄',
        theme: 'internal',
        access: 'all',
        module: 'pipeline',
        description: 'Track deals through your sales pipeline',
        submenu: [
            { id: 'all-stages', label: 'All Stages', icon: '📊' },
            { id: 'new', label: 'New', icon: '🆕' },
            { id: 'in-progress', label: 'In Progress', icon: '⏳' },
            { id: 'won', label: 'Won', icon: '🏆' },
            { id: 'lost', label: 'Lost', icon: '❌' }
        ]
    },
    
    clients: {
        path: '/clients',
        page: 'src/pages/clients.html',
        title: 'Clients - 11 Avatar Digital Hub',
        icon: '👥',
        theme: 'internal',
        access: 'all',
        module: 'clients',
        description: 'Manage your client relationships',
        submenu: [
            { id: 'active', label: 'Active', icon: '✅', badge: null },
            { id: 'paused', label: 'Paused', icon: '⏸️', badge: null },
            { id: 'ended', label: 'Ended', icon: '🏁', badge: null },
            { id: 'all-clients', label: 'All Clients', icon: '👥', badge: null },
            { id: 'add-client', label: 'Add Client', icon: '➕', badge: null }
        ]
    },
    
    contacts: {
        path: '/contacts',
        page: 'src/pages/contacts.html',
        title: 'Contacts - 11 Avatar Digital Hub',
        icon: '📞',
        theme: 'internal',
        access: 'all',
        module: 'contacts',
        description: 'Manage all your contacts in one place',
        submenu: [
            { id: 'all-contacts', label: 'All Contacts', icon: '👤' },
            { id: 'add-contact', label: 'Add Contact', icon: '➕' },
            { id: 'import', label: 'Import', icon: '📥' },
            { id: 'export', label: 'Export', icon: '📤' }
        ]
    },
    
    revenue: {
        path: '/revenue',
        page: 'src/pages/revenue.html',
        title: 'Revenue Tracking - 11 Avatar Digital Hub',
        icon: '💰',
        theme: 'internal',
        access: 'all',
        module: 'revenue',
        description: 'Track your revenue, goals, and collections',
        submenu: [
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'add-entry', label: 'Add Entry', icon: '➕' },
            { id: 'filters', label: 'Filters', icon: '🔍' },
            { id: 'reports', label: 'Reports', icon: '📄' },
            { id: 'export', label: 'Export', icon: '📤' }
        ]
    },
    
    invoices: {
        path: '/invoices',
        page: 'src/pages/invoices.html',
        title: 'GST Invoices - 11 Avatar Digital Hub',
        icon: '🧾',
        theme: 'internal',
        access: 'all',
        module: 'invoices',
        description: 'Create and manage GST-compliant invoices',
        submenu: [
            { id: 'all-invoices', label: 'All Invoices', icon: '📋' },
            { id: 'create', label: 'Create Invoice', icon: '➕' },
            { id: 'paid', label: 'Paid', icon: '✅' },
            { id: 'pending', label: 'Pending', icon: '⏳' },
            { id: 'overdue', label: 'Overdue', icon: '⚠️' }
        ]
    },
    
    payments: {
        path: '/payments',
        page: 'src/pages/payments.html',
        title: 'Payments - 11 Avatar Digital Hub',
        icon: '💳',
        theme: 'internal',
        access: 'all',
        module: 'payments',
        description: 'Track all incoming and outgoing payments',
        submenu: [
            { id: 'all-payments', label: 'All Payments', icon: '💰' },
            { id: 'received', label: 'Received', icon: '📥' },
            { id: 'pending', label: 'Pending', icon: '⏳' },
            { id: 'refunds', label: 'Refunds', icon: '↩️' }
        ]
    },
    
    projects: {
        path: '/projects',
        page: 'src/pages/projects.html',
        title: 'Projects - 11 Avatar Digital Hub',
        icon: '🚀',
        theme: 'internal',
        access: 'all',
        module: 'projects',
        description: 'Manage your client projects',
        submenu: [
            { id: 'all-projects', label: 'All Projects', icon: '📋' },
            { id: 'planning', label: 'Planning', icon: '📝' },
            { id: 'in-progress', label: 'In Progress', icon: '⏳' },
            { id: 'review', label: 'Review', icon: '🔍' },
            { id: 'completed', label: 'Completed', icon: '✅' }
        ]
    },
    
    retainers: {
        path: '/retainers',
        page: 'src/pages/retainers.html',
        title: 'Retainers - 11 Avatar Digital Hub',
        icon: '🔄',
        theme: 'internal',
        access: 'all',
        module: 'retainers',
        description: 'Manage recurring retainer agreements',
        submenu: [
            { id: 'active', label: 'Active', icon: '✅' },
            { id: 'paused', label: 'Paused', icon: '⏸️' },
            { id: 'ended', label: 'Ended', icon: '🏁' },
            { id: 'create', label: 'Create Retainer', icon: '➕' }
        ]
    },
    
    whatsapp: {
        path: '/whatsapp',
        page: 'src/pages/whatsapp.html',
        title: 'WhatsApp Integration - 11 Avatar Digital Hub',
        icon: '💬',
        theme: 'internal',
        access: 'all',
        module: 'whatsapp',
        description: 'WhatsApp Business API integration',
        submenu: [
            { id: 'chat', label: 'Chat', icon: '💬' },
            { id: 'templates', label: 'Templates', icon: '📝' },
            { id: 'contacts', label: 'Contacts', icon: '👤' },
            { id: 'broadcast', label: 'Broadcast', icon: '📢' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
        ]
    },
    
    inbox: {
        path: '/inbox',
        page: 'src/pages/inbox.html',
        title: 'Omnichannel Inbox - 11 Avatar Digital Hub',
        icon: '📥',
        theme: 'internal',
        access: 'all',
        module: 'inbox',
        description: 'Unified inbox for all communication channels',
        submenu: [
            { id: 'all', label: 'All Messages', icon: '📋' },
            { id: 'unread', label: 'Unread', icon: '🔵' },
            { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
            { id: 'email', label: 'Email', icon: '📧' },
            { id: 'sms', label: 'SMS', icon: '📱' }
        ]
    },
    
    tasks: {
        path: '/tasks',
        page: 'src/pages/tasks.html',
        title: 'Tasks - 11 Avatar Digital Hub',
        icon: '✅',
        theme: 'internal',
        access: 'all',
        module: 'tasks',
        description: 'Manage your daily tasks and to-dos',
        submenu: [
            { id: 'today', label: 'Today', icon: '📅' },
            { id: 'upcoming', label: 'Upcoming', icon: '🔮' },
            { id: 'overdue', label: 'Overdue', icon: '⚠️' },
            { id: 'completed', label: 'Completed', icon: '✅' },
            { id: 'create', label: 'Create Task', icon: '➕' }
        ]
    },
    
    appointments: {
        path: '/appointments',
        page: 'src/pages/appointments.html',
        title: 'Appointments - 11 Avatar Digital Hub',
        icon: '📅',
        theme: 'internal',
        access: 'all',
        module: 'appointments',
        description: 'Schedule and manage appointments',
        submenu: [
            { id: 'calendar', label: 'Calendar', icon: '🗓️' },
            { id: 'today', label: 'Today', icon: '📅' },
            { id: 'upcoming', label: 'Upcoming', icon: '📆' },
            { id: 'schedule', label: 'Schedule New', icon: '➕' }
        ]
    },
    
    campaigns: {
        path: '/campaigns',
        page: 'src/pages/campaigns.html',
        title: 'Campaigns - 11 Avatar Digital Hub',
        icon: '📢',
        theme: 'internal',
        access: 'all',
        module: 'campaigns',
        description: 'Create and manage marketing campaigns',
        submenu: [
            { id: 'active', label: 'Active', icon: '🟢' },
            { id: 'scheduled', label: 'Scheduled', icon: '📅' },
            { id: 'completed', label: 'Completed', icon: '✅' },
            { id: 'create', label: 'Create Campaign', icon: '➕' }
        ]
    },
    
    reports: {
        path: '/reports',
        page: 'src/pages/reports.html',
        title: 'Reports & Analytics - 11 Avatar Digital Hub',
        icon: '📈',
        theme: 'internal',
        access: 'all',
        module: 'reports',
        description: 'Comprehensive reports and analytics',
        submenu: [
            { id: 'revenue', label: 'Revenue Report', icon: '💰' },
            { id: 'leads', label: 'Leads Report', icon: '📋' },
            { id: 'clients', label: 'Clients Report', icon: '👥' },
            { id: 'performance', label: 'Team Performance', icon: '📊' },
            { id: 'export', label: 'Export Reports', icon: '📤' }
        ]
    },
    
    audit: {
        path: '/audit',
        page: 'src/pages/audit.html',
        title: 'Audit Trail - 11 Avatar Digital Hub',
        icon: '🔍',
        theme: 'internal',
        access: 'all',
        module: 'audit',
        description: 'Complete audit log of all activities',
        submenu: [
            { id: 'all-logs', label: 'All Logs', icon: '📋' },
            { id: 'user-activity', label: 'User Activity', icon: '👤' },
            { id: 'data-changes', label: 'Data Changes', icon: '✏️' },
            { id: 'login-history', label: 'Login History', icon: '🔐' }
        ]
    },
    
    proposals: {
        path: '/proposals',
        page: 'src/pages/proposals.html',
        title: 'Proposals - 11 Avatar Digital Hub',
        icon: '📄',
        theme: 'internal',
        access: 'all',
        module: 'proposals',
        description: 'Generate and manage business proposals',
        submenu: [
            { id: 'all', label: 'All Proposals', icon: '📋' },
            { id: 'sent', label: 'Sent', icon: '📤' },
            { id: 'accepted', label: 'Accepted', icon: '✅' },
            { id: 'generate', label: 'Generate New', icon: '➕' }
        ]
    },
    
    training: {
        path: '/training',
        page: 'src/pages/training.html',
        title: 'Training & Coaching - 11 Avatar Digital Hub',
        icon: '🎓',
        theme: 'internal',
        access: 'all',
        module: 'training',
        description: 'Track training attendees and sessions',
        submenu: [
            { id: 'sessions', label: 'Sessions', icon: '📅' },
            { id: 'attendees', label: 'Attendees', icon: '👥' },
            { id: 'add-session', label: 'Add Session', icon: '➕' },
            { id: 'reports', label: 'Reports', icon: '📊' }
        ]
    },
    
    referrals: {
        path: '/referrals',
        page: 'src/pages/referrals.html',
        title: 'Referrals - 11 Avatar Digital Hub',
        icon: '🔗',
        theme: 'internal',
        access: 'all',
        module: 'referrals',
        description: 'Track client referrals and rewards',
        submenu: [
            { id: 'all', label: 'All Referrals', icon: '📋' },
            { id: 'add', label: 'Add Referral', icon: '➕' },
            { id: 'rewards', label: 'Rewards', icon: '🎁' }
        ]
    },
    
    history: {
        path: '/history',
        page: 'src/pages/history.html',
        title: 'Activity History - 11 Avatar Digital Hub',
        icon: '📜',
        theme: 'internal',
        access: 'all',
        module: 'history',
        description: 'Complete history of all activities',
        submenu: [
            { id: 'today', label: 'Today', icon: '📅' },
            { id: 'yesterday', label: 'Yesterday', icon: '📆' },
            { id: 'this-week', label: 'This Week', icon: '📊' },
            { id: 'this-month', label: 'This Month', icon: '🗓️' },
            { id: 'all', label: 'All Time', icon: '📚' }
        ]
    },
    
    settings: {
        path: '/settings',
        page: 'src/pages/settings.html',
        title: 'Settings - 11 Avatar Digital Hub',
        icon: '⚙️',
        theme: 'internal',
        access: 'all',
        module: 'settings',
        description: 'Configure your CRM settings',
        submenu: [
            { id: 'profile', label: 'Profile', icon: '👤' },
            { id: 'business', label: 'Business', icon: '🏢' },
            { id: 'billing', label: 'Billing', icon: '💳' },
            { id: 'backup', label: 'Backup', icon: '💾' },
            { id: 'users', label: 'Users & Roles', icon: '👥' },
            { id: 'integrations', label: 'Integrations', icon: '🔌' },
            { id: 'security', label: 'Security', icon: '🔒' }
        ]
    },
    
    admin: {
        path: '/admin',
        page: 'src/pages/admin.html',
        title: 'Admin Panel - 11 Avatar Digital Hub',
        icon: '🛡️',
        theme: 'internal',
        access: 'platform_admin',
        module: 'admin',
        description: 'Platform administration panel',
        submenu: [
            { id: 'clients', label: 'Manage Clients', icon: '🏢' },
            { id: 'users', label: 'All Users', icon: '👥' },
            { id: 'roles', label: 'Roles & Permissions', icon: '🔑' },
            { id: 'audit', label: 'Audit Log', icon: '🔍' },
            { id: 'system', label: 'System Health', icon: '💻' }
        ]
    },
    
    profile: {
        path: '/profile',
        page: 'src/pages/profile.html',
        title: 'My Profile - 11 Avatar Digital Hub',
        icon: '👤',
        theme: 'internal',
        access: 'all',
        module: 'settings',
        description: 'Manage your personal profile',
        submenu: [
            { id: 'personal', label: 'Personal Info', icon: '👤' },
            { id: 'password', label: 'Change Password', icon: '🔑' },
            { id: 'preferences', label: 'Preferences', icon: '⚙️' },
            { id: 'sessions', label: 'Active Sessions', icon: '🖥️' }
        ]
    }
};

// ==========================================
// HEADER NAVIGATION ITEMS
// ==========================================

/**
 * Main navigation items displayed in the header
 * These are the primary navigation links visible to all authenticated users
 */
const HEADER_NAV = [
    { id: 'dashboard', label: 'Dashboard', route: 'dashboard' },
    { id: 'leads', label: 'Leads', route: 'leads' },
    { id: 'pipeline', label: 'Pipeline', route: 'pipeline' },
    { id: 'clients', label: 'Clients', route: 'clients' },
    { id: 'revenue', label: 'Revenue', route: 'revenue' },
    { id: 'projects', label: 'Projects', route: 'projects' },
    { id: 'whatsapp', label: 'WhatsApp', route: 'whatsapp' },
    { id: 'reports', label: 'Reports', route: 'reports' }
];

/**
 * Secondary navigation items (shown in dropdown or "More" menu)
 */
const HEADER_SECONDARY_NAV = [
    { id: 'invoices', label: 'Invoices', route: 'invoices' },
    { id: 'payments', label: 'Payments', route: 'payments' },
    { id: 'tasks', label: 'Tasks', route: 'tasks' },
    { id: 'appointments', label: 'Appointments', route: 'appointments' },
    { id: 'campaigns', label: 'Campaigns', route: 'campaigns' },
    { id: 'inbox', label: 'Inbox', route: 'inbox' },
    { id: 'contacts', label: 'Contacts', route: 'contacts' },
    { id: 'retainers', label: 'Retainers', route: 'retainers' },
    { id: 'training', label: 'Training', route: 'training' },
    { id: 'referrals', label: 'Referrals', route: 'referrals' },
    { id: 'audit', label: 'Audit', route: 'audit' },
    { id: 'proposals', label: 'Proposals', route: 'proposals' },
    { id: 'history', label: 'History', route: 'history' }
];

/**
 * Admin-only navigation items
 */
const HEADER_ADMIN_NAV = [
    { id: 'admin', label: 'Admin', route: 'admin' },
    { id: 'settings', label: 'Settings', route: 'settings' }
];

// ==========================================
// ROUTE HELPER FUNCTIONS
// ==========================================

/**
 * Get route configuration by route ID
 * @param {string} routeId - The route identifier
 * @returns {Object|null} Route configuration or null if not found
 */
function getRoute(routeId) {
    return ROUTES[routeId] || null;
}

/**
 * Get route configuration by URL path
 * @param {string} path - The URL path to match
 * @returns {Object|null} Route configuration or null if not found
 */
function getRouteByPath(path) {
    // Normalize path
    const normalizedPath = path.replace(/\/$/, '') || '/';
    
    // Search through all routes
    for (const [id, route] of Object.entries(ROUTES)) {
        if (route.path === normalizedPath) {
            return { id, ...route };
        }
    }
    
    return null;
}

/**
 * Get submenu configuration for a specific route
 * @param {string} routeId - The route identifier
 * @returns {Array} Array of submenu items
 */
function getSubmenu(routeId) {
    const route = ROUTES[routeId];
    if (!route || !route.submenu) {
        return [];
    }
    return route.submenu;
}

/**
 * Get all routes accessible by a specific role
 * @param {string} role - User role
 * @returns {Array} Array of accessible route objects
 */
function getAccessibleRoutes(role) {
    if (!role) {
        // Return only public routes
        return Object.entries(ROUTES)
            .filter(([id, route]) => route.access === null && route.theme === 'public')
            .map(([id, route]) => ({ id, ...route }));
    }
    
    // Platform roles have access to everything
    if (['platform_owner', 'platform_super_admin', 'admin'].includes(role)) {
        return Object.entries(ROUTES)
            .filter(([id, route]) => route.theme === 'internal')
            .map(([id, route]) => ({ id, ...route }));
    }
    
    // Client roles have limited access
    const rolePermissions = Constants.ROLE_PERMISSIONS[role] || [];
    
    return Object.entries(ROUTES)
        .filter(([id, route]) => {
            if (route.access === null || route.theme === 'public') return false;
            if (route.access === 'all') return true;
            return rolePermissions.includes(route.access);
        })
        .map(([id, route]) => ({ id, ...route }));
}

/**
 * Check if a user can access a specific route
 * @param {string} routeId - Route identifier
 * @param {Object} user - User object with role
 * @returns {boolean} Whether access is allowed
 */
function canAccessRoute(routeId, user) {
    const route = ROUTES[routeId];
    
    // Route doesn't exist
    if (!route) return false;
    
    // Public route - anyone can access
    if (route.access === null) return true;
    
    // User not authenticated
    if (!user || !user.role) return false;
    
    // Platform roles can access everything
    if (['platform_owner', 'platform_super_admin', 'admin'].includes(user.role)) {
        return true;
    }
    
    // Route allows all authenticated users
    if (route.access === 'all') return true;
    
    // Check specific permission
    const permissions = Constants.ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(route.access);
}

/**
 * Generate breadcrumb trail for a route
 * @param {string} routeId - Current route identifier
 * @returns {Array} Breadcrumb items [{label, path}]
 */
function getBreadcrumb(routeId) {
    const breadcrumbs = [
        { label: 'Home', path: '/', icon: '🏠' }
    ];
    
    const route = ROUTES[routeId];
    if (route && routeId !== 'landing') {
        breadcrumbs.push({
            label: route.title?.replace(' - 11 Avatar Digital Hub', '') || routeId,
            path: route.path,
            icon: route.icon
        });
    }
    
    return breadcrumbs;
}

/**
 * Get page title for a route
 * @param {string} routeId - Route identifier
 * @returns {string} Page title
 */
function getPageTitle(routeId) {
    const route = ROUTES[routeId];
    return route ? route.title : '11 Avatar Digital Hub';
}

/**
 * Get theme for a route
 * @param {string} routeId - Route identifier
 * @returns {string} 'public' or 'internal'
 */
function getRouteTheme(routeId) {
    const route = ROUTES[routeId];
    return route ? route.theme : 'internal';
}

/**
 * Get all header navigation items for a user
 * @param {Object} user - User object
 * @returns {Object} { primary, secondary, admin }
 */
function getHeaderNav(user) {
    const nav = {
        primary: HEADER_NAV.filter(item => canAccessRoute(item.route, user)),
        secondary: HEADER_SECONDARY_NAV.filter(item => canAccessRoute(item.route, user)),
        admin: HEADER_ADMIN_NAV.filter(item => canAccessRoute(item.route, user))
    };
    
    return nav;
}

/**
 * Find active submenu item based on URL hash
 * @param {string} routeId - Current route
 * @param {string} hash - URL hash (without #)
 * @returns {string|null} Active submenu item ID
 */
function getActiveSubmenu(routeId, hash) {
    if (!hash) {
        const submenu = ROUTES[routeId]?.submenu;
        return submenu && submenu.length > 0 ? submenu[0].id : null;
    }
    
    const submenu = ROUTES[routeId]?.submenu || [];
    const match = submenu.find(item => item.id === hash);
    return match ? match.id : (submenu.length > 0 ? submenu[0].id : null);
}

// ==========================================
// EXPORT ALL ROUTE CONFIGURATIONS
// ==========================================
const RoutesConfig = {
    ROUTES,
    HEADER_NAV,
    HEADER_SECONDARY_NAV,
    HEADER_ADMIN_NAV,
    getRoute,
    getRouteByPath,
    getSubmenu,
    getAccessibleRoutes,
    canAccessRoute,
    getBreadcrumb,
    getPageTitle,
    getRouteTheme,
    getHeaderNav,
    getActiveSubmenu
};

// Freeze to prevent modifications
Object.freeze(ROUTES);
Object.freeze(HEADER_NAV);
Object.freeze(HEADER_SECONDARY_NAV);
Object.freeze(HEADER_ADMIN_NAV);

// Make available globally
window.RoutesConfig = RoutesConfig;
window.ROUTES = ROUTES;

console.log('🗺️ Routes loaded:', {
    total: Object.keys(ROUTES).length,
    public: Object.values(ROUTES).filter(r => r.theme === 'public').length,
    internal: Object.values(ROUTES).filter(r => r.theme === 'internal').length,
    withSubmenu: Object.values(ROUTES).filter(r => r.submenu && r.submenu.length > 0).length
});

// ==========================================
// END OF ROUTE CONFIGURATION
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
