/* ==========================================
   11 AVATAR DIGITAL HUB
   Application Constants & Configuration
   Version: 2.0 Enterprise
   ==========================================
   Contents:
   - App Metadata
   - API Endpoints
   - Role Definitions
   - Permission Matrix
   - Lead Status Stages
   - Revenue Types
   - Business Rules
   - Validation Rules
   - Default Settings
   - Feature Flags
   ========================================== */

// ==========================================
// APP METADATA
// ==========================================
const APP = {
    name: '11 Avatar Digital Hub',
    shortName: '11Avatar Hub',
    version: '2.0.0',
    build: 'enterprise',
    description: 'Master Revenue CRM - Leads to Revenue to Retention',
    tagline: 'Leads → Conversations → Deals → Revenue → Retention',
    author: '11 Avatar Digital Hub',
    email: '11avatardigitalhub@gmail.com',

    website: 'https://11avatardigitalhub.github.io/lead2revenue',

    apiEndpoint: 'https://11avatar-api.11avatardigitalhub.workers.dev',
    copyright: `© ${new Date().getFullYear()} 11 Avatar Digital Hub. All rights reserved.`
};

// ==========================================
// API ENDPOINTS
// ==========================================
const API = {
    base: APP.apiEndpoint,
    health: '/api/health',
    auth: {
        login: '/api/auth/login',
        register: '/api/auth/register',
        forgotPassword: '/api/auth/forgot-password',
        resetPassword: '/api/auth/reset-password',
        verifyEmail: '/api/auth/verify-email',
        refreshToken: '/api/auth/refresh-token'
    },
    leads: '/api/leads',
    clients: '/api/clients',
    contacts: '/api/contacts',
    revenue: '/api/revenue',
    projects: '/api/projects',
    retainers: '/api/retainers',
    invoices: '/api/invoices',
    payments: '/api/payments',
    tasks: '/api/tasks',
    appointments: '/api/appointments',
    campaigns: '/api/campaigns',
    trainings: '/api/trainings',
    referrals: '/api/referrals',
    reports: '/api/reports',
    audit: '/api/audit',
    proposals: '/api/proposals',
    settings: '/api/settings',
    backup: '/api/backup',
    whatsapp: {
        webhook: '/api/whatsapp/webhook',
        send: '/api/whatsapp/send',
        templates: '/api/whatsapp/templates'
    }
};

// ==========================================
// ROLE DEFINITIONS (8-Level Hierarchy)
// ==========================================
const ROLES = {
    PLATFORM_OWNER: 'platform_owner',
    PLATFORM_SUPER_ADMIN: 'platform_super_admin',
    PLATFORM_ADMIN: 'admin',
    CLIENT_OWNER: 'client_owner',
    CLIENT_ADMIN: 'client_admin',
    MANAGER: 'manager',
    EXECUTIVE: 'executive',
    VIEWER: 'viewer'
};

const ROLE_HIERARCHY = {
    [ROLES.PLATFORM_OWNER]: {
        level: 0,
        label: 'Platform Owner',
        icon: '👑',
        color: '#D4AF37',
        description: 'Full platform control',
        access: 'all',
        clientId: null,
        canManagePlatform: true,
        canManageClients: true,
        canManageBilling: true,
        canViewAllData: true,
        maxUsers: Infinity
    },
    [ROLES.PLATFORM_SUPER_ADMIN]: {
        level: 1,
        label: 'Super Admin',
        icon: '🛡️',
        color: '#E8C95A',
        description: 'Platform management',
        access: 'platform',
        clientId: null,
        canManagePlatform: true,
        canManageClients: true,
        canManageBilling: false,
        canViewAllData: true,
        maxUsers: 5
    },
    [ROLES.PLATFORM_ADMIN]: {
        level: 1.5,
        label: 'Admin',
        icon: '⚙️',
        color: '#B8960F',
        description: 'Day-to-day operations',
        access: 'platform',
        clientId: null,
        canManagePlatform: false,
        canManageClients: true,
        canManageBilling: false,
        canViewAllData: true,
        maxUsers: 10
    },
    [ROLES.CLIENT_OWNER]: {
        level: 2,
        label: 'Client Owner',
        icon: '🏢',
        color: '#10B981',
        description: 'Own company CRM',
        access: 'client',
        clientId: 'required',
        canManagePlatform: false,
        canManageClients: false,
        canManageBilling: false,
        canViewAllData: false,
        maxUsers: 1
    },
    [ROLES.CLIENT_ADMIN]: {
        level: 3,
        label: 'Client Admin',
        icon: '👨‍💼',
        color: '#3B82F6',
        description: 'Team management',
        access: 'client',
        clientId: 'required',
        canManagePlatform: false,
        canManageClients: false,
        canManageBilling: false,
        canViewAllData: false,
        maxUsers: 3
    },
    [ROLES.MANAGER]: {
        level: 4,
        label: 'Manager',
        icon: '👤',
        color: '#8B5CF6',
        description: 'Team lead management',
        access: 'client',
        clientId: 'required',
        canManagePlatform: false,
        canManageClients: false,
        canManageBilling: false,
        canViewAllData: false,
        maxUsers: 10
    },
    [ROLES.EXECUTIVE]: {
        level: 5,
        label: 'Executive',
        icon: '💼',
        color: '#F59E0B',
        description: 'Basic operations',
        access: 'client',
        clientId: 'required',
        canManagePlatform: false,
        canManageClients: false,
        canManageBilling: false,
        canViewAllData: false,
        maxUsers: 50
    },
    [ROLES.VIEWER]: {
        level: 6,
        label: 'Viewer',
        icon: '👁️',
        color: '#6B7280',
        description: 'Read-only access',
        access: 'client',
        clientId: 'required',
        canManagePlatform: false,
        canManageClients: false,
        canManageBilling: false,
        canViewAllData: false,
        maxUsers: Infinity
    }
};

// ==========================================
// PERMISSION MATRIX
// ==========================================
const PERMISSIONS = {
    LEADS_VIEW: 'leads:view',
    LEADS_CREATE: 'leads:create',
    LEADS_EDIT: 'leads:edit',
    LEADS_DELETE: 'leads:delete',
    LEADS_EXPORT: 'leads:export',
    LEADS_IMPORT: 'leads:import',
    
    CLIENTS_VIEW: 'clients:view',
    CLIENTS_CREATE: 'clients:create',
    CLIENTS_EDIT: 'clients:edit',
    CLIENTS_DELETE: 'clients:delete',
    
    PIPELINE_VIEW: 'pipeline:view',
    PIPELINE_MANAGE: 'pipeline:manage',
    
    REVENUE_VIEW: 'revenue:view',
    REVENUE_ADD: 'revenue:add',
    REVENUE_EDIT: 'revenue:edit',
    REVENUE_DELETE: 'revenue:delete',
    
    REPORTS_VIEW: 'reports:view',
    REPORTS_EXPORT: 'reports:export',
    
    SETTINGS_VIEW: 'settings:view',
    SETTINGS_EDIT: 'settings:edit',
    
    USERS_VIEW: 'users:view',
    USERS_CREATE: 'users:create',
    USERS_EDIT: 'users:edit',
    USERS_DELETE: 'users:delete',
    
    BACKUP_CREATE: 'backup:create',
    BACKUP_RESTORE: 'backup:restore',
    
    BILLING_VIEW: 'billing:view',
    BILLING_MANAGE: 'billing:manage',
    
    PLATFORM_MANAGE: 'platform:manage',
    CLIENT_MANAGE: 'client:manage'
};

const ROLE_PERMISSIONS = {
    [ROLES.PLATFORM_OWNER]: Object.values(PERMISSIONS),
    [ROLES.PLATFORM_SUPER_ADMIN]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT,
        PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_CREATE, PERMISSIONS.CLIENTS_EDIT,
        PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PIPELINE_MANAGE,
        PERMISSIONS.REVENUE_VIEW, PERMISSIONS.REVENUE_ADD,
        PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
        PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT,
        PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT,
        PERMISSIONS.BACKUP_CREATE, PERMISSIONS.BACKUP_RESTORE,
        PERMISSIONS.CLIENT_MANAGE
    ],
    [ROLES.PLATFORM_ADMIN]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.CLIENTS_VIEW,
        PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.REVENUE_VIEW,
        PERMISSIONS.REPORTS_VIEW, PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.USERS_VIEW, PERMISSIONS.CLIENT_MANAGE
    ],
    [ROLES.CLIENT_OWNER]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT, PERMISSIONS.LEADS_DELETE,
        PERMISSIONS.LEADS_EXPORT, PERMISSIONS.LEADS_IMPORT,
        PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_CREATE, PERMISSIONS.CLIENTS_EDIT,
        PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PIPELINE_MANAGE,
        PERMISSIONS.REVENUE_VIEW, PERMISSIONS.REVENUE_ADD, PERMISSIONS.REVENUE_EDIT,
        PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
        PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT,
        PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_DELETE,
        PERMISSIONS.BACKUP_CREATE, PERMISSIONS.BACKUP_RESTORE
    ],
    [ROLES.CLIENT_ADMIN]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT,
        PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_CREATE, PERMISSIONS.CLIENTS_EDIT,
        PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PIPELINE_MANAGE,
        PERMISSIONS.REVENUE_VIEW, PERMISSIONS.REVENUE_ADD,
        PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
        PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT
    ],
    [ROLES.MANAGER]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT,
        PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.PIPELINE_VIEW,
        PERMISSIONS.REVENUE_VIEW, PERMISSIONS.REPORTS_VIEW
    ],
    [ROLES.EXECUTIVE]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT,
        PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.PIPELINE_VIEW
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.LEADS_VIEW, PERMISSIONS.CLIENTS_VIEW,
        PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.REVENUE_VIEW, PERMISSIONS.REPORTS_VIEW
    ]
};

// ==========================================
// LEAD STATUS STAGES (12-Stage Pipeline)
// ==========================================
const LEAD_STAGES = [
    { id: 'new', label: 'New', icon: '🆕', color: '#3B82F6', order: 0 },
    { id: 'attempting_contact', label: 'Attempting Contact', icon: '📞', color: '#6366F1', order: 1 },
    { id: 'connected', label: 'Connected', icon: '🔗', color: '#8B5CF6', order: 2 },
    { id: 'qualified', label: 'Qualified', icon: '✅', color: '#10B981', order: 3 },
    { id: 'discovery_booked', label: 'Discovery Call Booked', icon: '📅', color: '#F59E0B', order: 4 },
    { id: 'discovery_completed', label: 'Discovery Call Completed', icon: '🎯', color: '#D4AF37', order: 5 },
    { id: 'proposal_sent', label: 'Proposal Sent', icon: '📄', color: '#E8C95A', order: 6 },
    { id: 'negotiation', label: 'Negotiation', icon: '🤝', color: '#F97316', order: 7 },
    { id: 'verbal_yes', label: 'Verbal Yes', icon: '👍', color: '#22C55E', order: 8 },
    { id: 'invoice_sent', label: 'Invoice Sent', icon: '🧾', color: '#06B6D4', order: 9 },
    { id: 'won', label: 'Won', icon: '🏆', color: '#059669', order: 10 },
    { id: 'lost', label: 'Lost', icon: '❌', color: '#EF4444', order: 11 }
];

// ==========================================
// REVENUE TYPES
// ==========================================
const REVENUE_TYPES = {
    PAYMENT: 'Payment',
    RETAINER: 'Retainer',
    PROJECT: 'Project',
    INVOICE: 'Invoice',
    REFUND: 'Refund'
};

const REVENUE_SOURCES = {
    CLIENT: 'Client',
    TRAINING: 'Training',
    REFERRAL: 'Referral',
    PROJECT: 'Project',
    RETAINER: 'Retainer',
    CONSULTING: 'Consulting'
};

// ==========================================
// PROJECT STATUSES
// ==========================================
const PROJECT_STATUSES = [
    { id: 'planning', label: 'Planning', icon: '📋', color: '#3B82F6' },
    { id: 'in_progress', label: 'In Progress', icon: '🚀', color: '#F59E0B' },
    { id: 'review', label: 'Review', icon: '🔍', color: '#8B5CF6' },
    { id: 'completed', label: 'Completed', icon: '✅', color: '#10B981' },
    { id: 'on_hold', label: 'On Hold', icon: '⏸️', color: '#EF4444' }
];

// ==========================================
// CLIENT STATUSES
// ==========================================
const CLIENT_STATUSES = {
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    ENDED: 'Ended',
    ONBOARDING: 'Onboarding'
};

// ==========================================
// RETAINER STATUSES
// ==========================================
const RETAINER_STATUSES = {
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    ENDED: 'Ended',
    PENDING: 'Pending'
};

// ==========================================
// BUSINESS RULES
// ==========================================
const BUSINESS_RULES = {
    mobileLength: 10,
    minDealValue: 1000,
    maxDealValue: 10000000,
    followupDaysDefault: 2,
    maxFollowupDays: 30,
    leadScoreMax: 100,
    revenueForecastWeight: 0.3, // 30% probability for pipeline deals
    historyMaxEntries: 500,
    backupRetentionDays: 90,
    maxFileUploadSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xlsx', 'csv', 'json'],
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    otpExpiryMinutes: 10
};

// ==========================================
// VALIDATION RULES
// ==========================================
const VALIDATION = {
    mobile: {
        pattern: /^[6-9]\d{9}$/,
        message: 'Mobile must be 10 digits starting with 6-9'
    },
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email address'
    },
    name: {
        minLength: 2,
        maxLength: 100,
        message: 'Name must be 2-100 characters'
    },
    business: {
        maxLength: 200,
        message: 'Business name must be under 200 characters'
    },
    pincode: {
        pattern: /^\d{6}$/,
        message: 'Pincode must be 6 digits'
    },
    gstin: {
        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        message: 'Please enter a valid GSTIN'
    },
    pan: {
        pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
        message: 'Please enter a valid PAN number'
    },
    amount: {
        min: 0,
        max: 100000000,
        message: 'Amount must be between 0 and 10,00,00,000'
    },
    url: {
        pattern: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
        message: 'Please enter a valid URL'
    }
};

// ==========================================
// DEFAULT SETTINGS
// ==========================================
const DEFAULT_SETTINGS = {
    goal: 70000,
    currency: '₹',
    currencySymbol: '₹',
    tax: 5, // GST %
    serviceFee: 20,
    discount: 0,
    roundUp: true,
    callTarget: 30,
    followupTarget: 10,
    meetingTarget: 2,
    followupDays: 2,
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    language: 'en-IN',
    notifications: {
        email: true,
        sms: false,
        push: true,
        whatsapp: false
    },
    autoBackup: true,
    backupFrequency: 'daily', // daily, weekly, monthly
    theme: 'light', // light, dark
    sidebarCollapsed: false
};

// ==========================================
// FEATURE FLAGS
// ==========================================
const FEATURES = {
    WHATSAPP_INTEGRATION: true,
    EMAIL_INTEGRATION: false,
    SMS_INTEGRATION: false,
    GST_INVOICES: true,
    PAYMENT_GATEWAY: false,
    AI_SCORING: false,
    AI_CHATBOT: false,
    GOOGLE_CALENDAR: false,
    GOOGLE_MAPS: false,
    MULTI_LANGUAGE: false,
    DARK_MODE: true,
    EXPORT_PDF: true,
    EXPORT_CSV: true,
    EXPORT_EXCEL: true,
    IMPORT_CSV: true,
    IMPORT_EXCEL: false
};

// ==========================================
// UI CONSTANTS
// ==========================================
const UI = {
    pageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    dateFormat: 'DD MMM YYYY',
    dateTimeFormat: 'DD MMM YYYY, hh:mm A',
    currencyLocale: 'en-IN',
    toastDuration: 3000,
    modalAnimationDuration: 300,
    sidebarWidth: 280,
    sidebarCollapsedWidth: 72,
    headerHeight: 64,
    headerHeightMobile: 56,
    mobileBreakpoint: 768,
    tabletBreakpoint: 1024,
    desktopBreakpoint: 1280
};

// ==========================================
// ERROR MESSAGES
// ==========================================
const ERRORS = {
    NETWORK: 'Network error. Please check your internet connection.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION: 'Please check the form for errors.',
    DUPLICATE: 'This record already exists.',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit of 10MB.',
    FILE_TYPE: 'File type not allowed.',
    BACKUP_FAILED: 'Backup failed. Please try again.',
    RESTORE_FAILED: 'Restore failed. The backup file may be corrupted.',
    PERMISSION_DENIED: 'You do not have permission to access this resource.'
};

// ==========================================
// SUCCESS MESSAGES
// ==========================================
const SUCCESS = {
    SAVED: 'Saved successfully!',
    UPDATED: 'Updated successfully!',
    DELETED: 'Deleted successfully!',
    EXPORTED: 'Exported successfully!',
    IMPORTED: 'Imported successfully!',
    BACKUP_CREATED: 'Backup created successfully!',
    RESTORE_COMPLETE: 'Data restored successfully!',
    LOGIN: 'Welcome back!',
    LOGOUT: 'Logged out successfully!',
    REGISTER: 'Account created successfully!'
};

// ==========================================
// EXPORT ALL CONSTANTS
// ==========================================
const Constants = {
    APP,
    API,
    ROLES,
    ROLE_HIERARCHY,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    LEAD_STAGES,
    REVENUE_TYPES,
    REVENUE_SOURCES,
    PROJECT_STATUSES,
    CLIENT_STATUSES,
    RETAINER_STATUSES,
    BUSINESS_RULES,
    VALIDATION,
    DEFAULT_SETTINGS,
    FEATURES,
    UI,
    ERRORS,
    SUCCESS
};

// Freeze to prevent modifications
Object.freeze(Constants);
Object.freeze(ROLES);
Object.freeze(PERMISSIONS);
Object.freeze(LEAD_STAGES);
Object.freeze(BUSINESS_RULES);
Object.freeze(VALIDATION);
Object.freeze(DEFAULT_SETTINGS);

// Make available globally
window.Constants = Constants;

console.log('📋 Constants loaded:', {
    roles: Object.keys(ROLES).length,
    permissions: Object.keys(PERMISSIONS).length,
    leadStages: LEAD_STAGES.length,
    features: Object.keys(FEATURES).filter(k => FEATURES[k]).length + ' enabled'
});

// ==========================================
// END OF CONSTANTS
// ==========================================


