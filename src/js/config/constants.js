/**
 * @fileoverview 11 Avatar SMEs CRM - Application Constants
 * @description Centralized constants, enums, and configuration for the entire CRM application.
 *              Multi-tenant RBAC ready, enterprise-grade constants with full JSDoc documentation.
 * @module config/constants
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 * 
 * @requires N/A - Zero dependency constants module
 * @exports window.Global.Constants - Global namespace export
 * @exports Constants - ES Module export
 */

'use strict';

// =============================================================================
// CONSTANTS MODULE - Self-executing IIFE with full encapsulation
// =============================================================================
const Constants = (function() {
    
    // -------------------------------------------------------------------------
    // SECTION 1: APPLICATION METADATA
    // -------------------------------------------------------------------------
    
    /** @constant {Object} APP - Core application identification and metadata */
    const APP = Object.freeze({
        /** @type {string} Full application name */
        NAME: '11 Avatar SMEs CRM',
        
        /** @type {string} Short application identifier */
        SHORT_NAME: 'AvatarCRM',
        
        /** @type {string} Semantic versioning (Major.Minor.Patch-Build) */
        VERSION: '2.0.0',
        
        /** @type {number} Incremental build number */
        BUILD: 20260717,
        
        /** @type {string} Environment: development, staging, production */
        ENVIRONMENT: (typeof window !== 'undefined' && window.location.hostname === 'localhost') 
            ? 'development' 
            : (typeof window !== 'undefined' && window.location.hostname.includes('staging')) 
                ? 'staging' 
                : 'production',
        
        /** @type {string} Application description for meta tags */
        DESCRIPTION: 'Enterprise SaaS CRM platform for small and medium enterprises with multi-tenant RBAC, WhatsApp integration, GST compliance, and full business automation.',
        
        /** @type {string} Application keywords for SEO */
        KEYWORDS: 'CRM, SaaS, SME, business automation, WhatsApp CRM, GST billing, lead management, pipeline management, Indian SMEs, multi-tenant CRM',
        
        /** @type {string} Primary author/organization */
        AUTHOR: '11 Avatar Digital Hub',
        
        /** @type {string} Copyright string with dynamic year range */
        COPYRIGHT: `© ${new Date().getFullYear()} 11 Avatar Digital Hub. All Rights Reserved.`,
        
        /** @type {string} Repository URL */
        REPO_URL: 'https://github.com/11avatardigitalhub/11-Avatar-SMEs-CRM.git',
        
        /** @type {string} License type */
        LICENSE: 'Proprietary - All Rights Reserved',
        
        /** @type {boolean} Debug mode flag - controls verbose logging */
        DEBUG: (typeof window !== 'undefined' && window.location.hostname === 'localhost'),
        
        /** @type {string} Default language locale */
        LOCALE: 'en-IN',
        
        /** @type {string} Default timezone */
        TIMEZONE: 'Asia/Kolkata',
        
        /** @type {string} Default currency for financial operations */
        CURRENCY: 'INR',
        
        /** @type {string} Currency symbol */
        CURRENCY_SYMBOL: '₹',
        
        /** @type {string} Date format for display */
        DATE_FORMAT: 'DD/MM/YYYY',
        
        /** @type {string} DateTime format for display */
        DATETIME_FORMAT: 'DD/MM/YYYY HH:mm:ss',
        
        /** @type {string} Time format for display */
        TIME_FORMAT: 'HH:mm:ss',
        
        /** @type {boolean} Whether the app is installed as PWA */
        IS_PWA: (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches),
        
        /** @type {string} Application color theme primary */
        PRIMARY_COLOR: '#FFD700',
        
        /** @type {string} Application color theme secondary */
        SECONDARY_COLOR: '#1A1A2E',
        
        /** @type {string} Application color theme accent */
        ACCENT_COLOR: '#E6C200',
    });

    // -------------------------------------------------------------------------
    // SECTION 2: URLS AND ENDPOINTS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} URLS - All application URLs and API endpoints */
    const URLS = Object.freeze({
        /** @type {string} Live production URL */
        LIVE: 'https://11avatardigitalhub.github.io/11-Avatar-SMEs-CRM/',
        
        /** @type {string} CloudWA integration URL */
        CLOUDWA: 'https://cloudwa.11avatardigitalhub.cloud/login',
        
        /** @type {string} API base URL via Cloudflare Workers */
        API_BASE: 'https://11avatar-api.11avatardigitalhub.workers.dev',
        
        /** @type {string} API version prefix */
        API_VERSION: '/v1',
        
        /** @type {string} Full API URL with version */
        API_URL: 'https://11avatar-api.11avatardigitalhub.workers.dev/v1',
        
        /** @type {string} WebSocket endpoint for real-time features */
        WS_URL: 'wss://11avatar-ws.11avatardigitalhub.workers.dev',
        
        /** @type {string} CDN URL for static assets */
        CDN_URL: 'https://cdn.11avatardigitalhub.cloud',
        
        /** @type {string} Documentation URL */
        DOCS_URL: 'https://docs.11avatardigitalhub.cloud',
        
        /** @type {string} Status page URL */
        STATUS_URL: 'https://status.11avatardigitalhub.cloud',
        
        /** @type {string} Blog URL */
        BLOG_URL: 'https://blog.11avatardigitalhub.cloud',
        
        // ---------- API SUB-ENDPOINTS ----------
        
        /** @type {string} Authentication endpoints */
        AUTH: {
            LOGIN: '/auth/login',
            REGISTER: '/auth/register',
            LOGOUT: '/auth/logout',
            REFRESH_TOKEN: '/auth/refresh',
            FORGOT_PASSWORD: '/auth/forgot-password',
            RESET_PASSWORD: '/auth/reset-password',
            VERIFY_EMAIL: '/auth/verify-email',
            VERIFY_PHONE: '/auth/verify-phone',
            MFA_SETUP: '/auth/mfa/setup',
            MFA_VERIFY: '/auth/mfa/verify',
            SSO_GOOGLE: '/auth/sso/google',
            SSO_MICROSOFT: '/auth/sso/microsoft',
        },
        
        /** @type {string} User management endpoints */
        USERS: {
            PROFILE: '/users/profile',
            UPDATE_PROFILE: '/users/profile/update',
            CHANGE_PASSWORD: '/users/change-password',
            AVATAR_UPLOAD: '/users/avatar',
            PREFERENCES: '/users/preferences',
            NOTIFICATIONS: '/users/notifications',
            ACTIVITY_LOG: '/users/activity',
            SESSIONS: '/users/sessions',
        },
        
        /** @type {string} Tenant/Multi-tenant endpoints */
        TENANTS: {
            CREATE: '/tenants',
            GET: '/tenants/:id',
            UPDATE: '/tenants/:id',
            DELETE: '/tenants/:id',
            LIST: '/tenants',
            SETTINGS: '/tenants/:id/settings',
            MEMBERS: '/tenants/:id/members',
            INVITE: '/tenants/:id/invite',
            BILLING: '/tenants/:id/billing',
            USAGE: '/tenants/:id/usage',
        },
        
        /** @type {string} Leads management endpoints */
        LEADS: {
            CREATE: '/leads',
            GET: '/leads/:id',
            UPDATE: '/leads/:id',
            DELETE: '/leads/:id',
            LIST: '/leads',
            BULK_IMPORT: '/leads/bulk-import',
            BULK_EXPORT: '/leads/bulk-export',
            ASSIGN: '/leads/:id/assign',
            CONVERT: '/leads/:id/convert',
            NOTES: '/leads/:id/notes',
            ACTIVITIES: '/leads/:id/activities',
            FILES: '/leads/:id/files',
            MERGE: '/leads/merge',
            DUPLICATE_CHECK: '/leads/duplicate-check',
        },
        
        /** @type {string} Clients/Contacts endpoints */
        CLIENTS: {
            CREATE: '/clients',
            GET: '/clients/:id',
            UPDATE: '/clients/:id',
            DELETE: '/clients/:id',
            LIST: '/clients',
            NOTES: '/clients/:id/notes',
            DOCUMENTS: '/clients/:id/documents',
            TRANSACTIONS: '/clients/:id/transactions',
            COMMUNICATION_LOG: '/clients/:id/communications',
        },
        
        /** @type {string} Sales Pipeline endpoints */
        PIPELINE: {
            STAGES: '/pipeline/stages',
            DEALS: '/pipeline/deals',
            DEAL_DETAIL: '/pipeline/deals/:id',
            MOVE_DEAL: '/pipeline/deals/:id/move',
            DEAL_ACTIVITIES: '/pipeline/deals/:id/activities',
            FORECAST: '/pipeline/forecast',
            ANALYTICS: '/pipeline/analytics',
        },
        
        /** @type {string} Invoicing endpoints */
        INVOICES: {
            CREATE: '/invoices',
            GET: '/invoices/:id',
            UPDATE: '/invoices/:id',
            DELETE: '/invoices/:id',
            LIST: '/invoices',
            SEND: '/invoices/:id/send',
            DOWNLOAD_PDF: '/invoices/:id/pdf',
            MARK_PAID: '/invoices/:id/mark-paid',
            RECURRING: '/invoices/recurring',
            TEMPLATES: '/invoices/templates',
            GST_REPORT: '/invoices/gst-report',
        },
        
        /** @type {string} Payments endpoints */
        PAYMENTS: {
            CREATE: '/payments',
            GET: '/payments/:id',
            LIST: '/payments',
            REFUND: '/payments/:id/refund',
            GATEWAY: '/payments/gateway',
            WEBHOOK: '/payments/webhook',
            RAZORPAY: '/payments/razorpay',
            STRIPE: '/payments/stripe',
            UPI: '/payments/upi',
        },
        
        /** @type {string} Tasks management endpoints */
        TASKS: {
            CREATE: '/tasks',
            GET: '/tasks/:id',
            UPDATE: '/tasks/:id',
            DELETE: '/tasks/:id',
            LIST: '/tasks',
            ASSIGN: '/tasks/:id/assign',
            COMPLETE: '/tasks/:id/complete',
            COMMENTS: '/tasks/:id/comments',
            REMINDERS: '/tasks/:id/reminders',
            CALENDAR: '/tasks/calendar',
            KANBAN: '/tasks/kanban',
        },
        
        /** @type {string} Projects endpoints */
        PROJECTS: {
            CREATE: '/projects',
            GET: '/projects/:id',
            UPDATE: '/projects/:id',
            DELETE: '/projects/:id',
            LIST: '/projects',
            MILESTONES: '/projects/:id/milestones',
            MEMBERS: '/projects/:id/members',
            FILES: '/projects/:id/files',
            TIMELINE: '/projects/:id/timeline',
            GANTT: '/projects/:id/gantt',
        },
        
        /** @type {string} WhatsApp integration endpoints */
        WHATSAPP: {
            SEND: '/whatsapp/send',
            TEMPLATES: '/whatsapp/templates',
            WEBHOOK: '/whatsapp/webhook',
            CHATS: '/whatsapp/chats',
            CHAT_HISTORY: '/whatsapp/chats/:id/history',
            BROADCAST: '/whatsapp/broadcast',
            QR_CODE: '/whatsapp/qr-code',
            STATUS: '/whatsapp/status',
        },
        
        /** @type {string} Email integration endpoints */
        EMAIL: {
            SEND: '/email/send',
            TEMPLATES: '/email/templates',
            TRACKING: '/email/tracking',
            BOUNCE: '/email/bounce',
            SPAM: '/email/spam-report',
            CAMPAIGN: '/email/campaign',
        },
        
        /** @type {string} SMS integration endpoints */
        SMS: {
            SEND: '/sms/send',
            TEMPLATES: '/sms/templates',
            BALANCE: '/sms/balance',
            DELIVERY_STATUS: '/sms/status/:id',
            BULK: '/sms/bulk',
        },
        
        /** @type {string} GST compliance endpoints */
        GST: {
            CALCULATE: '/gst/calculate',
            VALIDATE_GSTIN: '/gst/validate-gstin',
            FILE_RETURN: '/gst/file-return',
            REPORTS: '/gst/reports',
            HSN_CODES: '/gst/hsn-codes',
            E_INVOICE: '/gst/e-invoice',
            E_WAY_BILL: '/gst/e-way-bill',
        },
        
        /** @type {string} Reports & Analytics endpoints */
        REPORTS: {
            DASHBOARD: '/reports/dashboard',
            SALES: '/reports/sales',
            REVENUE: '/reports/revenue',
            LEADS: '/reports/leads',
            CONVERSION: '/reports/conversion',
            EXPORT: '/reports/export',
            CUSTOM: '/reports/custom',
        },
        
        /** @type {string} File storage endpoints */
        STORAGE: {
            UPLOAD: '/storage/upload',
            DOWNLOAD: '/storage/download/:id',
            DELETE: '/storage/:id',
            LIST: '/storage/list',
            SHARE: '/storage/:id/share',
        },
        
        /** @type {string} Integration endpoints */
        INTEGRATIONS: {
            SLACK: '/integrations/slack',
            ZAPIER: '/integrations/zapier',
            CALENDAR: '/integrations/calendar',
            MAPS: '/integrations/maps',
            ZOHO: '/integrations/zoho',
            TALLY: '/integrations/tally',
            QUICKBOOKS: '/integrations/quickbooks',
        },
        
        /** @type {string} Webhook endpoints */
        WEBHOOKS: {
            LIST: '/webhooks',
            CREATE: '/webhooks',
            UPDATE: '/webhooks/:id',
            DELETE: '/webhooks/:id',
            TEST: '/webhooks/:id/test',
            LOGS: '/webhooks/:id/logs',
        },
    });

    // -------------------------------------------------------------------------
    // SECTION 3: FIREBASE CONFIGURATION
    // -------------------------------------------------------------------------
    
    /** @constant {Object} FIREBASE - Firebase project configuration */
    const FIREBASE = Object.freeze({
        /** @type {string} Firebase project ID */
        PROJECT_ID: 'avatar-wa-dual-crm',
        
        /** @type {string} Firebase application ID */
        APP_ID: '1:946959261009:web:175f5390d63715f1f8c770',
        
        /** @type {string} Firebase API key (public, restricted via Firebase Console) */
        API_KEY: 'AIzaSyD-X5hKj4xW36xQq0J9kD_xFxLRx1JPNPk',
        
        /** @type {string} Firebase auth domain */
        AUTH_DOMAIN: 'avatar-wa-dual-crm.firebaseapp.com',
        
        /** @type {string} Firebase project domain */
        PROJECT_DOMAIN: 'avatar-wa-dual-crm.firebaseapp.com',
        
        /** @type {string} Firebase database URL */
        DATABASE_URL: 'https://avatar-wa-dual-crm-default-rtdb.asia-southeast1.firebasedatabase.app',
        
        /** @type {string} Firebase storage bucket */
        STORAGE_BUCKET: 'avatar-wa-dual-crm.appspot.com',
        
        /** @type {string} Firebase messaging sender ID */
        MESSAGING_SENDER_ID: '946959261009',
        
        /** @type {string} Firebase measurement ID (Google Analytics) */
        MEASUREMENT_ID: 'G-XXXXXXXXXX',
        
        /** @type {string} Firebase Cloud Functions region */
        FUNCTIONS_REGION: 'asia-south1',
        
        /** @type {string} Firestore database location */
        FIRESTORE_LOCATION: 'asia-south1',
        
        /** @type {string} Realtime Database location */
        RTDB_LOCATION: 'asia-southeast1',
        
        /** @type {Object} Firebase emulator ports for local development */
        EMULATORS: {
            AUTH: 9099,
            FIRESTORE: 8080,
            DATABASE: 9000,
            STORAGE: 9199,
            FUNCTIONS: 5001,
            PUBSUB: 8085,
            HOSTING: 5000,
        },
        
        /** @type {string[]} Authorized domains for Firebase Auth */
        AUTHORIZED_DOMAINS: [
            'localhost',
            '127.0.0.1',
            '11avatardigitalhub.github.io',
            'avatar-wa-dual-crm.firebaseapp.com',
            'avatar-wa-dual-crm.web.app',
            '11avatardigitalhub.cloud',
            'cloudwa.11avatardigitalhub.cloud',
            'api.11avatardigitalhub.cloud',
        ],
        
        /** @type {Object} Firestore collection names */
        COLLECTIONS: {
            USERS: 'users',
            TENANTS: 'tenants',
            LEADS: 'leads',
            CLIENTS: 'clients',
            DEALS: 'deals',
            INVOICES: 'invoices',
            PAYMENTS: 'payments',
            TASKS: 'tasks',
            PROJECTS: 'projects',
            ACTIVITIES: 'activities',
            NOTIFICATIONS: 'notifications',
            SETTINGS: 'settings',
            AUDIT_LOGS: 'audit_logs',
            WHATSAPP_CHATS: 'whatsapp_chats',
            EMAIL_TEMPLATES: 'email_templates',
            SMS_TEMPLATES: 'sms_templates',
            GST_RECORDS: 'gst_records',
            WORKFLOWS: 'workflows',
            INTEGRATIONS: 'integrations',
            WEBHOOKS: 'webhooks',
            FILES: 'files',
            REPORTS: 'reports',
            BACKUPS: 'backups',
        },
        
        /** @type {Object} Firebase Storage paths */
        STORAGE_PATHS: {
            AVATARS: 'avatars/',
            DOCUMENTS: 'documents/',
            INVOICES: 'invoices/',
            LOGOS: 'logos/',
            IMPORTS: 'imports/',
            EXPORTS: 'exports/',
            BACKUPS: 'backups/',
            TEMP: 'temp/',
            WHATSAPP_MEDIA: 'whatsapp-media/',
            EMAIL_ATTACHMENTS: 'email-attachments/',
            USER_UPLOADS: 'user-uploads/',
        },
        
        /** @type {Object} Firebase indexes for complex queries */
        INDEXES: {
            LEADS_BY_TENANT_STATUS: ['tenantId', 'status', 'createdAt'],
            LEADS_BY_ASSIGNEE: ['assignedTo', 'status', 'createdAt'],
            CLIENTS_BY_TENANT: ['tenantId', 'type', 'createdAt'],
            DEALS_BY_PIPELINE: ['pipelineId', 'stage', 'value'],
            INVOICES_BY_STATUS: ['tenantId', 'status', 'dueDate'],
            TASKS_BY_ASSIGNEE: ['assignedTo', 'status', 'dueDate'],
            ACTIVITIES_BY_ENTITY: ['entityType', 'entityId', 'createdAt'],
        },
    });

    // -------------------------------------------------------------------------
    // SECTION 4: ROLE-BASED ACCESS CONTROL (RBAC)
    // -------------------------------------------------------------------------
    
    /** @constant {Object} ROLES - 8-tier role hierarchy for multi-tenant RBAC */
    const ROLES = Object.freeze({
        /** @type {number} Super Admin - Platform owner, unrestricted access */
        SUPER_ADMIN: {
            LEVEL: 8,
            NAME: 'Super Admin',
            SHORT: 'super_admin',
            ICON: '👑',
            DESCRIPTION: 'Full platform access with system configuration and tenant management capabilities',
            PERMISSIONS: ['*'], // Wildcard - all permissions
            IS_SYSTEM_ROLE: true,
            CAN_MANAGE_TENANTS: true,
            CAN_MANAGE_USERS: true,
            CAN_MANAGE_BILLING: true,
            CAN_ACCESS_AUDIT_LOGS: true,
            CAN_MANAGE_INTEGRATIONS: true,
            CAN_MANAGE_WEBHOOKS: true,
            CAN_EXPORT_ALL_DATA: true,
            CAN_IMPERSONATE: true,
            CAN_MANAGE_SECURITY: true,
            MAX_TENANTS: Infinity,
        },
        
        /** @type {number} Admin - Tenant administrator */
        ADMIN: {
            LEVEL: 7,
            NAME: 'Admin',
            SHORT: 'admin',
            ICON: '⚙️',
            DESCRIPTION: 'Tenant-level administrator with full control over tenant resources and users',
            PERMISSIONS: [
                'manage_users', 'manage_roles', 'manage_teams',
                'manage_leads', 'manage_clients', 'manage_deals',
                'manage_invoices', 'manage_payments', 'manage_tasks',
                'manage_projects', 'manage_reports', 'manage_settings',
                'manage_integrations', 'manage_whatsapp', 'manage_email',
                'manage_sms', 'manage_gst', 'export_data', 'import_data',
                'view_audit_logs', 'manage_billing', 'manage_subscription',
            ],
            IS_SYSTEM_ROLE: false,
            CAN_MANAGE_TENANTS: false,
            CAN_MANAGE_USERS: true,
            CAN_MANAGE_BILLING: true,
            CAN_ACCESS_AUDIT_LOGS: true,
            CAN_MANAGE_INTEGRATIONS: true,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Manager - Department/Team manager */
        MANAGER: {
            LEVEL: 6,
            NAME: 'Manager',
            SHORT: 'manager',
            ICON: '📊',
            DESCRIPTION: 'Team manager with oversight of assigned team members and resources',
            PERMISSIONS: [
                'view_users', 'manage_team',
                'manage_leads', 'manage_clients', 'manage_deals',
                'view_invoices', 'create_invoices', 'manage_tasks',
                'manage_projects', 'view_reports', 'manage_whatsapp',
                'manage_email', 'export_data', 'import_data',
            ],
            IS_SYSTEM_ROLE: false,
            CAN_MANAGE_TENANTS: false,
            CAN_MANAGE_USERS: false,
            CAN_MANAGE_BILLING: false,
            CAN_ACCESS_AUDIT_LOGS: false,
            CAN_MANAGE_INTEGRATIONS: false,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Sales Lead - Sales team leader */
        SALES_LEAD: {
            LEVEL: 5,
            NAME: 'Sales Lead',
            SHORT: 'sales_lead',
            ICON: '🎯',
            DESCRIPTION: 'Sales team lead with focus on pipeline management and conversion optimization',
            PERMISSIONS: [
                'view_team', 'manage_leads', 'manage_clients',
                'manage_deals', 'view_invoices', 'manage_tasks',
                'view_reports', 'manage_whatsapp', 'manage_email',
                'export_data',
            ],
            IS_SYSTEM_ROLE: false,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Sales Executive - Individual sales representative */
        SALES_EXECUTIVE: {
            LEVEL: 4,
            NAME: 'Sales Executive',
            SHORT: 'sales_executive',
            ICON: '💼',
            DESCRIPTION: 'Individual sales representative handling assigned leads and deals',
            PERMISSIONS: [
                'view_assigned_leads', 'manage_assigned_leads',
                'view_assigned_clients', 'manage_assigned_clients',
                'view_assigned_deals', 'manage_assigned_deals',
                'manage_tasks', 'manage_whatsapp', 'manage_email',
            ],
            IS_SYSTEM_ROLE: false,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Support Agent - Customer support representative */
        SUPPORT_AGENT: {
            LEVEL: 3,
            NAME: 'Support Agent',
            SHORT: 'support_agent',
            ICON: '🎧',
            DESCRIPTION: 'Customer support representative handling client inquiries and tickets',
            PERMISSIONS: [
                'view_assigned_clients', 'manage_tasks',
                'manage_whatsapp', 'manage_email',
                'view_tickets', 'manage_tickets',
            ],
            IS_SYSTEM_ROLE: false,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Accountant - Financial operations */
        ACCOUNTANT: {
            LEVEL: 2,
            NAME: 'Accountant',
            SHORT: 'accountant',
            ICON: '🧮',
            DESCRIPTION: 'Financial professional handling invoices, payments, and GST compliance',
            PERMISSIONS: [
                'view_invoices', 'manage_invoices', 'manage_payments',
                'manage_gst', 'view_reports', 'export_data',
            ],
            IS_SYSTEM_ROLE: false,
            MAX_TENANTS: 1,
        },
        
        /** @type {number} Viewer - Read-only access */
        VIEWER: {
            LEVEL: 1,
            NAME: 'Viewer',
            SHORT: 'viewer',
            ICON: '👁️',
            DESCRIPTION: 'Read-only access to assigned data and reports',
            PERMISSIONS: [
                'view_assigned_leads', 'view_assigned_clients',
                'view_assigned_deals', 'view_invoices',
                'view_reports', 'view_tasks',
            ],
            IS_SYSTEM_ROLE: false,
            MAX_TENANTS: 1,
        },
    });
    
    /**
     * Get role definition by short name
     * @param {string} roleShort - Short role identifier (e.g., 'admin', 'manager')
     * @returns {Object|null} Role definition object or null if not found
     */
    function getRoleByShort(roleShort) {
        try {
            const roles = Object.values(ROLES);
            return roles.find(role => role.SHORT === roleShort) || null;
        } catch (error) {
            console.error('[Constants] Error getting role by short name:', error);
            return null;
        }
    }
    
    /**
     * Check if a role level has sufficient privileges
     * @param {number} userLevel - User's role level
     * @param {number} requiredLevel - Required minimum role level
     * @returns {boolean} True if user has sufficient level
     */
    function hasMinimumLevel(userLevel, requiredLevel) {
        try {
            return Number(userLevel) >= Number(requiredLevel);
        } catch (error) {
            console.error('[Constants] Error checking role level:', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 5: ENUMS AND STATUS DEFINITIONS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} LEAD_STATUS - Lead lifecycle statuses */
    const LEAD_STATUS = Object.freeze({
        NEW: 'new',
        CONTACTED: 'contacted',
        QUALIFIED: 'qualified',
        PROPOSAL_SENT: 'proposal_sent',
        NEGOTIATION: 'negotiation',
        WON: 'won',
        LOST: 'lost',
        DISQUALIFIED: 'disqualified',
        ON_HOLD: 'on_hold',
        REOPENED: 'reopened',
    });
    
    /** @constant {Object} LEAD_SOURCE - Lead acquisition sources */
    const LEAD_SOURCE = Object.freeze({
        WEBSITE: 'website',
        REFERRAL: 'referral',
        WHATSAPP: 'whatsapp',
        EMAIL: 'email',
        PHONE: 'phone',
        SOCIAL_MEDIA: 'social_media',
        ADVERTISEMENT: 'advertisement',
        EXHIBITION: 'exhibition',
        COLD_CALL: 'cold_call',
        WALK_IN: 'walk_in',
        PARTNER: 'partner',
        IMPORT: 'import',
        API: 'api',
        OTHER: 'other',
    });
    
    /** @constant {Object} CLIENT_TYPE - Client categorization */
    const CLIENT_TYPE = Object.freeze({
        INDIVIDUAL: 'individual',
        COMPANY: 'company',
        PARTNERSHIP: 'partnership',
        LLP: 'llp',
        PROPRIETORSHIP: 'proprietorship',
        TRUST: 'trust',
        NGO: 'ngo',
        GOVERNMENT: 'government',
        OTHER: 'other',
    });
    
    /** @constant {Object} DEAL_STAGE - Sales pipeline stages */
    const DEAL_STAGE = Object.freeze({
        LEAD_IN: 'lead_in',
        NEEDS_ANALYSIS: 'needs_analysis',
        PROPOSAL: 'proposal',
        NEGOTIATION: 'negotiation',
        CLOSED_WON: 'closed_won',
        CLOSED_LOST: 'closed_lost',
        ON_HOLD: 'on_hold',
    });
    
    /** @constant {Object} INVOICE_STATUS - Invoice lifecycle statuses */
    const INVOICE_STATUS = Object.freeze({
        DRAFT: 'draft',
        SENT: 'sent',
        VIEWED: 'viewed',
        PARTIALLY_PAID: 'partially_paid',
        PAID: 'paid',
        OVERDUE: 'overdue',
        CANCELLED: 'cancelled',
        REFUNDED: 'refunded',
        DISPUTED: 'disputed',
        WRITTEN_OFF: 'written_off',
    });
    
    /** @constant {Object} PAYMENT_STATUS - Payment processing statuses */
    const PAYMENT_STATUS = Object.freeze({
        PENDING: 'pending',
        INITIATED: 'initiated',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        REFUNDED: 'refunded',
        PARTIALLY_REFUNDED: 'partially_refunded',
        CANCELLED: 'cancelled',
        HELD: 'held',
    });
    
    /** @constant {Object} PAYMENT_METHOD - Supported payment methods */
    const PAYMENT_METHOD = Object.freeze({
        UPI: 'upi',
        NET_BANKING: 'net_banking',
        CREDIT_CARD: 'credit_card',
        DEBIT_CARD: 'debit_card',
        RAZORPAY: 'razorpay',
        STRIPE: 'stripe',
        NEFT: 'neft',
        RTGS: 'rtgs',
        IMPS: 'imps',
        CASH: 'cash',
        CHEQUE: 'cheque',
        WALLET: 'wallet',
        EMI: 'emi',
        BNPL: 'bnpl',
    });
    
    /** @constant {Object} TASK_STATUS - Task management statuses */
    const TASK_STATUS = Object.freeze({
        TODO: 'todo',
        IN_PROGRESS: 'in_progress',
        REVIEW: 'review',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        BLOCKED: 'blocked',
        DEFERRED: 'deferred',
    });
    
    /** @constant {Object} TASK_PRIORITY - Task priority levels */
    const TASK_PRIORITY = Object.freeze({
        CRITICAL: 'critical',
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
        NONE: 'none',
    });
    
    /** @constant {Object} PROJECT_STATUS - Project lifecycle statuses */
    const PROJECT_STATUS = Object.freeze({
        PLANNING: 'planning',
        IN_PROGRESS: 'in_progress',
        ON_HOLD: 'on_hold',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        MAINTENANCE: 'maintenance',
    });
    
    /** @constant {Object} GST_RATE - Indian GST tax rates */
    const GST_RATE = Object.freeze({
        ZERO: 0,
        THREE: 3,
        FIVE: 5,
        TWELVE: 12,
        EIGHTEEN: 18,
        TWENTY_EIGHT: 28,
    });
    
    /** @constant {Object} GST_TYPE - GST transaction types */
    const GST_TYPE = Object.freeze({
        INTRA_STATE: 'intra_state',     // CGST + SGST
        INTER_STATE: 'inter_state',     // IGST
        UNION_TERRITORY: 'union_territory', // CGST + UTGST
        EXPORT: 'export',               // Zero-rated
        SEZ: 'sez',                     // Zero-rated
        EXEMPT: 'exempt',              // Nil-rated
    });
    
    /** @constant {Object} NOTIFICATION_TYPE - System notification categories */
    const NOTIFICATION_TYPE = Object.freeze({
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error',
        LEAD_ASSIGNED: 'lead_assigned',
        DEAL_WON: 'deal_won',
        PAYMENT_RECEIVED: 'payment_received',
        INVOICE_OVERDUE: 'invoice_overdue',
        TASK_DUE: 'task_due',
        MENTION: 'mention',
        SYSTEM: 'system',
        WHATSAPP_MESSAGE: 'whatsapp_message',
        EMAIL_RECEIVED: 'email_received',
    });
    
    /** @constant {Object} ACTIVITY_TYPE - User activity tracking types */
    const ACTIVITY_TYPE = Object.freeze({
        LOGIN: 'login',
        LOGOUT: 'logout',
        CREATE: 'create',
        UPDATE: 'update',
        DELETE: 'delete',
        VIEW: 'view',
        EXPORT: 'export',
        IMPORT: 'import',
        SEND: 'send',
        RECEIVE: 'receive',
        ASSIGN: 'assign',
        COMMENT: 'comment',
        UPLOAD: 'upload',
        DOWNLOAD: 'download',
        STATUS_CHANGE: 'status_change',
        PAYMENT: 'payment',
        LOGIN_FAILED: 'login_failed',
        PASSWORD_CHANGE: 'password_change',
        ROLE_CHANGE: 'role_change',
    });

    // -------------------------------------------------------------------------
    // SECTION 6: UI/UX CONSTANTS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} UI - User interface configuration constants */
    const UI = Object.freeze({
        /** @type {string} Application theme - light or dark */
        THEME: {
            DEFAULT: 'light',
            PUBLIC: 'dark',
            INTERNAL: 'light',
        },
        
        /** @type {Object} Color palette */
        COLORS: {
            PRIMARY: '#FFD700',
            PRIMARY_DARK: '#E6C200',
            PRIMARY_LIGHT: '#FFE44D',
            SECONDARY: '#1A1A2E',
            SECONDARY_LIGHT: '#2D2D44',
            BACKGROUND: '#FFFFFF',
            BACKGROUND_DARK: '#0F0F1A',
            SURFACE: '#F8F9FA',
            SURFACE_DARK: '#1A1A2E',
            TEXT: '#1A1A2E',
            TEXT_LIGHT: '#6C757D',
            TEXT_DARK_BG: '#FFFFFF',
            SUCCESS: '#28A745',
            WARNING: '#FFC107',
            ERROR: '#DC3545',
            INFO: '#17A2B8',
            BORDER: '#DEE2E6',
            BORDER_DARK: '#2D2D44',
            GLASS: 'rgba(255, 255, 255, 0.1)',
            GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
            GOLD_GRADIENT: 'linear-gradient(135deg, #FFD700, #FFA500)',
            DARK_GRADIENT: 'linear-gradient(135deg, #1A1A2E, #16213E)',
        },
        
        /** @type {Object} Font configuration */
        FONTS: {
            BODY: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            HEADING: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            MONOSPACE: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            SIZE_BODY: '14px',
            SIZE_SMALL: '12px',
            SIZE_LARGE: '16px',
            SIZE_H1: '2.5rem',
            SIZE_H2: '2rem',
            SIZE_H3: '1.75rem',
            SIZE_H4: '1.5rem',
            SIZE_H5: '1.25rem',
            SIZE_H6: '1rem',
            TOUCH_TARGET: '44px',
        },
        
        /** @type {Object} Spacing scale */
        SPACING: {
            XS: '4px',
            SM: '8px',
            MD: '16px',
            LG: '24px',
            XL: '32px',
            XXL: '48px',
            XXXL: '64px',
        },
        
        /** @type {Object} Border radius */
        BORDER_RADIUS: {
            SM: '4px',
            MD: '8px',
            LG: '12px',
            XL: '16px',
            ROUND: '50%',
            PILL: '9999px',
        },
        
        /** @type {Object} Shadow definitions */
        SHADOWS: {
            SM: '0 1px 3px rgba(0,0,0,0.12)',
            MD: '0 4px 6px rgba(0,0,0,0.1)',
            LG: '0 10px 25px rgba(0,0,0,0.15)',
            XL: '0 20px 50px rgba(0,0,0,0.2)',
            GLASS: '0 8px 32px rgba(0,0,0,0.1)',
            GOLD: '0 4px 15px rgba(255,215,0,0.3)',
            INNER: 'inset 0 2px 4px rgba(0,0,0,0.06)',
        },
        
        /** @type {Object} Transition durations */
        TRANSITIONS: {
            FAST: '150ms',
            NORMAL: '300ms',
            SLOW: '500ms',
            VERY_SLOW: '1000ms',
        },
        
        /** @type {Object} Z-index scale */
        Z_INDEX: {
            DROPDOWN: 1000,
            STICKY: 1020,
            FIXED: 1030,
            MODAL_BACKDROP: 1040,
            MODAL: 1050,
            POPOVER: 1060,
            TOOLTIP: 1070,
            TOAST: 1080,
            LOADING: 1090,
        },
        
        /** @type {Object} Breakpoints for responsive design */
        BREAKPOINTS: {
            XS: '320px',
            SM: '480px',
            MD: '768px',
            LG: '1024px',
            XL: '1280px',
            XXL: '1440px',
            XXXL: '1600px',
            ULTRA: '1920px',
        },
        
        /** @type {number} Maximum content width */
        MAX_CONTENT_WIDTH: '1400px',
        
        /** @type {number} Sidebar width */
        SIDEBAR_WIDTH: '260px',
        
        /** @type {number} Header height */
        HEADER_HEIGHT: '64px',
        
        /** @type {number} Submenu height */
        SUBMENU_HEIGHT: '48px',
        
        /** @type {number} Footer height */
        FOOTER_HEIGHT: '56px',
        
        /** @type {number} Mobile bottom nav height */
        MOBILE_NAV_HEIGHT: '64px',
        
        /** @type {number} Toast notification max width */
        TOAST_MAX_WIDTH: '400px',
        
        /** @type {number} Modal max width */
        MODAL_MAX_WIDTH: '600px',
        
        /** @type {number} Card min width for auto-grid */
        CARD_MIN_WIDTH: '280px',
    });

    // -------------------------------------------------------------------------
    // SECTION 7: PAGINATION & DATA CONSTANTS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} PAGINATION - Default pagination settings */
    const PAGINATION = Object.freeze({
        DEFAULT_PAGE_SIZE: 25,
        PAGE_SIZE_OPTIONS: [10, 25, 50, 100, 250],
        MAX_PAGE_SIZE: 500,
        DEFAULT_SORT_ORDER: 'desc',
        DEFAULT_SORT_FIELD: 'createdAt',
    });
    
    /** @constant {Object} LIMITS - Application usage limits */
    const LIMITS = Object.freeze({
        MAX_FILE_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
        MAX_BULK_IMPORT_ROWS: 10000,
        MAX_WHATSAPP_BROADCAST: 256,
        MAX_EMAIL_RECIPIENTS: 50,
        MAX_SMS_LENGTH: 160,
        MAX_PASSWORD_LENGTH: 128,
        MIN_PASSWORD_LENGTH: 8,
        MAX_NAME_LENGTH: 100,
        MAX_DESCRIPTION_LENGTH: 5000,
        MAX_NOTE_LENGTH: 10000,
        MAX_COMMENT_LENGTH: 2000,
        SESSION_TIMEOUT_MINUTES: 480, // 8 hours
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_DURATION_MINUTES: 30,
        PASSWORD_RESET_EXPIRY_MINUTES: 60,
        VERIFICATION_CODE_EXPIRY_MINUTES: 10,
        OTP_LENGTH: 6,
        MAX_API_CALLS_PER_MINUTE: 60,
        MAX_WHATSAPP_MESSAGES_PER_DAY: 1000,
        MAX_EMAILS_PER_DAY: 500,
        MAX_SMS_PER_DAY: 200,
        CACHE_TTL_SECONDS: 300, // 5 minutes
        OFFLINE_SYNC_INTERVAL: 60000, // 1 minute
        BACKUP_RETENTION_DAYS: 90,
        AUDIT_LOG_RETENTION_DAYS: 365,
        TRASH_RETENTION_DAYS: 30,
    });
    
    /** @constant {Object} TIMING - Application timing constants */
    const TIMING = Object.freeze({
        DEBOUNCE_MS: 300,
        THROTTLE_MS: 100,
        AUTO_SAVE_MS: 30000,
        TOAST_DURATION_MS: 5000,
        LOADING_TIMEOUT_MS: 30000,
        API_TIMEOUT_MS: 15000,
        SEARCH_MIN_CHARS: 2,
        INFINITE_SCROLL_THRESHOLD: 200,
        ANIMATION_FRAME_RATE: 60,
        POLLING_INTERVAL_MS: 30000,
        HEARTBEAT_INTERVAL_MS: 60000,
        RECONNECT_DELAY_MS: 5000,
        MAX_RECONNECT_ATTEMPTS: 10,
    });

    // -------------------------------------------------------------------------
    // SECTION 8: ERROR CODES AND MESSAGES
    // -------------------------------------------------------------------------
    
    /** @constant {Object} ERROR_CODES - Application error codes */
    const ERROR_CODES = Object.freeze({
        // Auth errors (1xxx)
        AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
        AUTH_EMAIL_EXISTS: 'AUTH_1002',
        AUTH_WEAK_PASSWORD: 'AUTH_1003',
        AUTH_INVALID_EMAIL: 'AUTH_1004',
        AUTH_USER_DISABLED: 'AUTH_1005',
        AUTH_TOKEN_EXPIRED: 'AUTH_1006',
        AUTH_INVALID_TOKEN: 'AUTH_1007',
        AUTH_MFA_REQUIRED: 'AUTH_1008',
        AUTH_SESSION_EXPIRED: 'AUTH_1009',
        AUTH_ACCOUNT_LOCKED: 'AUTH_1010',
        AUTH_EMAIL_NOT_VERIFIED: 'AUTH_1011',
        AUTH_PHONE_NOT_VERIFIED: 'AUTH_1012',
        
        // Permission errors (2xxx)
        PERMISSION_DENIED: 'PERM_2001',
        PERMISSION_INSUFFICIENT_ROLE: 'PERM_2002',
        PERMISSION_TENANT_MISMATCH: 'PERM_2003',
        PERMISSION_RESOURCE_NOT_OWNED: 'PERM_2004',
        
        // Validation errors (3xxx)
        VALIDATION_ERROR: 'VAL_3001',
        VALIDATION_REQUIRED_FIELD: 'VAL_3002',
        VALIDATION_INVALID_FORMAT: 'VAL_3003',
        VALIDATION_MAX_LENGTH_EXCEEDED: 'VAL_3004',
        VALIDATION_DUPLICATE_ENTRY: 'VAL_3005',
        VALIDATION_INVALID_GSTIN: 'VAL_3006',
        VALIDATION_INVALID_PAN: 'VAL_3007',
        VALIDATION_INVALID_PHONE: 'VAL_3008',
        
        // Resource errors (4xxx)
        RESOURCE_NOT_FOUND: 'RES_4001',
        RESOURCE_ALREADY_EXISTS: 'RES_4002',
        RESOURCE_DELETED: 'RES_4003',
        RESOURCE_LOCKED: 'RES_4004',
        RESOURCE_CONFLICT: 'RES_4005',
        
        // Server errors (5xxx)
        SERVER_ERROR: 'SRV_5001',
        SERVER_UNAVAILABLE: 'SRV_5002',
        SERVER_TIMEOUT: 'SRV_5003',
        SERVER_OVERLOADED: 'SRV_5004',
        
        // Network errors (6xxx)
        NETWORK_ERROR: 'NET_6001',
        NETWORK_OFFLINE: 'NET_6002',
        NETWORK_TIMEOUT: 'NET_6003',
        NETWORK_RATE_LIMITED: 'NET_6004',
        
        // Data errors (7xxx)
        DATA_CORRUPTED: 'DAT_7001',
        DATA_MIGRATION_FAILED: 'DAT_7002',
        DATA_BACKUP_FAILED: 'DAT_7003',
        DATA_IMPORT_FAILED: 'DAT_7004',
        DATA_EXPORT_FAILED: 'DAT_7005',
        
        // Integration errors (8xxx)
        INTEGRATION_FAILED: 'INT_8001',
        INTEGRATION_CONFIG_ERROR: 'INT_8002',
        WHATSAPP_SEND_FAILED: 'INT_8003',
        EMAIL_SEND_FAILED: 'INT_8004',
        SMS_SEND_FAILED: 'INT_8005',
        PAYMENT_FAILED: 'INT_8006',
        GST_VALIDATION_FAILED: 'INT_8007',
        
        // File errors (9xxx)
        FILE_TOO_LARGE: 'FIL_9001',
        FILE_INVALID_TYPE: 'FIL_9002',
        FILE_UPLOAD_FAILED: 'FIL_9003',
        FILE_DOWNLOAD_FAILED: 'FIL_9004',
        FILE_CORRUPTED: 'FIL_9005',
    });

    // -------------------------------------------------------------------------
    // SECTION 9: REGEX PATTERNS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} REGEX - Commonly used regular expressions */
    const REGEX = Object.freeze({
        EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        PHONE_INDIAN: /^(\+91[\-\s]?)?[6-9]\d{9}$/,
        PHONE_INTERNATIONAL: /^\+[1-9]\d{1,14}$/,
        GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
        PINCODE_INDIAN: /^[1-9][0-9]{5}$/,
        IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
        UPI_ID: /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/,
        URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
        PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        IP_ADDRESS: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    });

    // -------------------------------------------------------------------------
    // SECTION 10: FEATURE FLAGS
    // -------------------------------------------------------------------------
    
    /** @constant {Object} FEATURES - Feature toggle flags */
    const FEATURES = Object.freeze({
        WHATSAPP_INTEGRATION: true,
        EMAIL_INTEGRATION: true,
        SMS_INTEGRATION: true,
        GST_COMPLIANCE: true,
        PAYMENT_GATEWAY: true,
        MULTI_TENANT: true,
        RBAC: true,
        PWA: true,
        OFFLINE_MODE: true,
        DARK_MODE: true,
        AUDIT_LOGGING: true,
        BULK_OPERATIONS: true,
        DATA_EXPORT: true,
        DATA_IMPORT: true,
        API_ACCESS: true,
        WEBHOOKS: true,
        KANBAN_BOARD: true,
        GANTT_CHART: true,
        CALENDAR_INTEGRATION: true,
        DOCUMENT_GENERATION: true,
        E_SIGNATURE: false,
        AI_ASSISTANT: false,
        ADVANCED_ANALYTICS: false,
        WHITE_LABEL: false,
    });

    // -------------------------------------------------------------------------
    // SECTION 11: PUBLIC MODULE API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface of Constants module */
    const publicAPI = Object.freeze({
        // Core constants
        APP,
        URLS,
        FIREBASE,
        ROLES,
        
        // Enums
        LEAD_STATUS,
        LEAD_SOURCE,
        CLIENT_TYPE,
        DEAL_STAGE,
        INVOICE_STATUS,
        PAYMENT_STATUS,
        PAYMENT_METHOD,
        TASK_STATUS,
        TASK_PRIORITY,
        PROJECT_STATUS,
        GST_RATE,
        GST_TYPE,
        NOTIFICATION_TYPE,
        ACTIVITY_TYPE,
        
        // UI/UX
        UI,
        
        // Data & Pagination
        PAGINATION,
        LIMITS,
        TIMING,
        
        // Error handling
        ERROR_CODES,
        
        // Validation
        REGEX,
        
        // Features
        FEATURES,
        
        // Utility functions
        getRoleByShort,
        hasMinimumLevel,
    });
    
    // Freeze the entire API to prevent accidental mutations
    return publicAPI;
    
})(); // End of Constants IIFE

// =============================================================================
// EXPORTS - Dual export strategy (Global + ES Module)
// =============================================================================

// Global namespace export (for non-module scripts and browser console access)
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Constants = Constants;
    window.Constants = Constants;
    
    // Log initialization in development mode
    if (Constants.APP.DEBUG) {
        console.log(
            `%c[${Constants.APP.SHORT_NAME}] v${Constants.APP.VERSION}`,
            'color: #FFD700; font-weight: bold;',
            'Constants module initialized successfully',
            `Environment: ${Constants.APP.ENVIRONMENT}`
        );
    }
}

// ES Module export (for module bundlers and modern imports)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
}

// Named exports for tree-shaking capable bundlers
export {
    Constants as default,
    Constants,
};
export const {
    APP,
    URLS,
    FIREBASE,
    ROLES,
    LEAD_STATUS,
    LEAD_SOURCE,
    CLIENT_TYPE,
    DEAL_STAGE,
    INVOICE_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    TASK_STATUS,
    TASK_PRIORITY,
    PROJECT_STATUS,
    GST_RATE,
    GST_TYPE,
    NOTIFICATION_TYPE,
    ACTIVITY_TYPE,
    UI,
    PAGINATION,
    LIMITS,
    TIMING,
    ERROR_CODES,
    REGEX,
    FEATURES,
    getRoleByShort,
    hasMinimumLevel,
} = Constants;