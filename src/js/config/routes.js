/**
 * @fileoverview 11 Avatar SMEs CRM - Route Configuration & Navigation Map
 * @description Defines all application routes for GitHub Pages static deployment.
 *              Maps `.html` pages to their metadata, access levels, submenu configs,
 *              and navigation items. Designed for multi-page architecture (not SPA).
 * @module config/routes
 * @version 3.0.0
 * @author 11 Avatar Digital Hub
 * @license Proprietary - All Rights Reserved
 * @copyright 2024-2026 11 Avatar Digital Hub
 *
 * @requires Constants (window.Constants) - optional, for role definitions
 *
 * @exports window.RoutesConfig - Global namespace
 * @exports RoutesConfig - ES Module export
 */

'use strict';

// =============================================================================
// ROUTES CONFIGURATION - Self-executing IIFE
// =============================================================================
const RoutesConfig = (function() {

    // -------------------------------------------------------------------------
    // SECTION 1: ROLE-BASED PERMISSIONS (Fallback if Constants not loaded)
    // -------------------------------------------------------------------------
    
    /**
     * Get permissions for a role - uses Constants if available, else fallback
     * @param {string} role - Role short name
     * @returns {Array<string>} Array of permission strings
     */
    function getRolePermissions(role) {
        // Try Constants module first
        try {
            if (window.Constants && window.Constants.ROLES) {
                var roleDef = window.Constants.getRoleByShort(role);
                if (roleDef && roleDef.PERMISSIONS) {
                    return roleDef.PERMISSIONS;
                }
            }
        } catch (e) {
            // Fallback
        }
        
        // Built-in fallback permissions
        var fallback = {
            'super_admin': ['*'],
            'admin': ['manage_users', 'manage_leads', 'manage_clients', 'manage_deals', 'manage_invoices', 'manage_payments', 'manage_tasks', 'manage_projects', 'manage_reports', 'manage_settings', 'manage_whatsapp', 'manage_email', 'manage_gst', 'export_data', 'import_data', 'view_audit_logs', 'manage_billing'],
            'manager': ['manage_leads', 'manage_clients', 'manage_deals', 'view_invoices', 'create_invoices', 'manage_tasks', 'manage_projects', 'view_reports', 'manage_whatsapp', 'manage_email', 'export_data'],
            'sales_lead': ['manage_leads', 'manage_clients', 'manage_deals', 'view_invoices', 'manage_tasks', 'view_reports', 'manage_whatsapp', 'manage_email', 'export_data'],
            'sales_executive': ['view_assigned_leads', 'manage_assigned_leads', 'view_assigned_clients', 'manage_assigned_clients', 'view_assigned_deals', 'manage_assigned_deals', 'manage_tasks', 'manage_whatsapp', 'manage_email'],
            'support_agent': ['view_assigned_clients', 'manage_tasks', 'manage_whatsapp', 'manage_email', 'view_tickets', 'manage_tickets'],
            'accountant': ['view_invoices', 'manage_invoices', 'manage_payments', 'manage_gst', 'view_reports', 'export_data'],
            'viewer': ['view_assigned_leads', 'view_assigned_clients', 'view_assigned_deals', 'view_invoices', 'view_reports', 'view_tasks'],
        };
        
        return fallback[role] || fallback['viewer'];
    }
    
    /**
     * Check if role is a platform-level role (full access)
     * @param {string} role
     * @returns {boolean}
     */
    function isPlatformRole(role) {
        return ['super_admin', 'admin'].indexOf(role) !== -1;
    }

    // -------------------------------------------------------------------------
    // SECTION 2: PUBLIC ROUTES (No Authentication Required)
    // -------------------------------------------------------------------------
    
    /**
     * @constant {Object} PUBLIC_ROUTES - Landing & auth pages
     * @description Routes accessible without login. Dark theme (public).
     */
    const PUBLIC_ROUTES = Object.freeze({
        
        landing: {
            id: 'landing',
            path: '/',
            page: 'index.html',
            title: '11 Avatar Digital Hub - India\'s #1 Revenue Operating System | Free CRM for SMEs',
            icon: '🏠',
            theme: 'public',
            access: null,
            description: 'Complete Revenue Operating System for Indian SMEs - Leads to Revenue to Retention. Start from ₹0.',
            submenu: [
                { id: 'hero', label: 'Overview', icon: '🏠' },
                { id: 'features', label: 'Features', icon: '⭐' },
                { id: 'stats', label: 'Stats', icon: '📊' },
                { id: 'solutions', label: 'Solutions', icon: '🎯' },
                { id: 'how-it-works', label: 'How It Works', icon: '🔄' },
                { id: 'pricing', label: 'Pricing', icon: '💰' },
                { id: 'testimonials', label: 'Reviews', icon: '💬' },
                { id: 'faq', label: 'FAQ', icon: '❓' },
            ],
        },
        
        login: {
            id: 'login',
            path: '/login',
            page: 'login.html',
            title: 'Login - 11 Avatar Digital Hub | Master Revenue CRM',
            icon: '🔐',
            theme: 'public',
            access: null,
            description: 'Sign in to your 11 Avatar CRM account. Access your dashboard, leads, pipeline, and more.',
            submenu: [],
        },
        
        register: {
            id: 'register',
            path: '/register',
            page: 'register.html',
            title: 'Create Free Account - 11 Avatar Digital Hub | Master Revenue CRM',
            icon: '📝',
            theme: 'public',
            access: null,
            description: 'Create your free CRM account. No credit card required. Start in 30 seconds.',
            submenu: [],
        },
        
        forgotPassword: {
            id: 'forgotPassword',
            path: '/forgot-password',
            page: 'forgot-password.html',
            title: 'Forgot Password - 11 Avatar Digital Hub | Master Revenue CRM',
            icon: '🔑',
            theme: 'public',
            access: null,
            description: 'Reset your CRM account password securely. Receive a reset link via email.',
            submenu: [],
        },
        
        about: {
            id: 'about',
            path: '/about',
            page: 'about.html',
            title: 'About Us - 11 Avatar Digital Hub | Our Story & Mission',
            icon: 'ℹ️',
            theme: 'public',
            access: null,
            description: 'Learn about 11 Avatar Digital Hub - our mission, team, and vision for Indian SMEs.',
            submenu: [],
        },
        
        contact: {
            id: 'contact',
            path: '/contact',
            page: 'contact.html',
            title: 'Contact Us - 11 Avatar Digital Hub | Get in Touch',
            icon: '📧',
            theme: 'public',
            access: null,
            description: 'Contact 11 Avatar Digital Hub for support, sales, or partnership inquiries.',
            submenu: [],
        },
        
        pricing: {
            id: 'pricing',
            path: '/pricing',
            page: 'pricing.html',
            title: 'Pricing - 11 Avatar Digital Hub | Free Forever CRM Plans',
            icon: '💰',
            theme: 'public',
            access: null,
            description: 'Explore 11 Avatar CRM pricing plans. Start free, upgrade as you grow.',
            submenu: [],
        },
        
        features: {
            id: 'features',
            path: '/features',
            page: 'features.html',
            title: 'Features - 11 Avatar Digital Hub | 13+ Powerful CRM Modules',
            icon: '⭐',
            theme: 'public',
            access: null,
            description: 'Explore all 13+ CRM modules - Leads, Pipeline, Revenue, GST, WhatsApp & more.',
            submenu: [],
        },
        
        integrations: {
            id: 'integrations',
            path: '/integrations',
            page: 'integrations.html',
            title: 'Integrations - 11 Avatar Digital Hub | Connect Your Tools',
            icon: '🔌',
            theme: 'public',
            access: null,
            description: 'Connect 11 Avatar CRM with WhatsApp, email, SMS, payment gateways, and more.',
            submenu: [],
        },
        
        demo: {
            id: 'demo',
            path: '/demo',
            page: 'demo.html',
            title: 'Request Demo - 11 Avatar Digital Hub | See CRM in Action',
            icon: '🎮',
            theme: 'public',
            access: null,
            description: 'Request a personalized demo of 11 Avatar CRM for your business.',
            submenu: [],
        },
        
        privacy: {
            id: 'privacy',
            path: '/privacy',
            page: 'privacy.html',
            title: 'Privacy Policy - 11 Avatar Digital Hub | Data Protection',
            icon: '🔒',
            theme: 'public',
            access: null,
            description: '11 Avatar Digital Hub Privacy Policy - how we collect, use, and protect your data.',
            submenu: [],
        },
        
        terms: {
            id: 'terms',
            path: '/terms',
            page: 'terms.html',
            title: 'Terms of Service - 11 Avatar Digital Hub | Legal Agreement',
            icon: '📜',
            theme: 'public',
            access: null,
            description: 'Terms of Service for using 11 Avatar Digital Hub CRM platform.',
            submenu: [],
        },
        
        refund: {
            id: 'refund',
            path: '/refund',
            page: 'refund.html',
            title: 'Refund Policy - 11 Avatar Digital Hub | Cancellation & Refunds',
            icon: '↩️',
            theme: 'public',
            access: null,
            description: '11 Avatar Digital Hub refund and cancellation policy.',
            submenu: [],
        },
        
        security: {
            id: 'security',
            path: '/security',
            page: 'security.html',
            title: 'Security - 11 Avatar Digital Hub | Enterprise-Grade Protection',
            icon: '🛡️',
            theme: 'public',
            access: null,
            description: 'How 11 Avatar Digital Hub keeps your data secure with bank-grade encryption.',
            submenu: [],
        },
        
        careers: {
            id: 'careers',
            path: '/careers',
            page: 'careers.html',
            title: 'Careers - 11 Avatar Digital Hub | Join Our Team',
            icon: '💼',
            theme: 'public',
            access: null,
            description: 'Explore career opportunities at 11 Avatar Digital Hub.',
            submenu: [],
        },
        
        partners: {
            id: 'partners',
            path: '/partners',
            page: 'partners.html',
            title: 'Partners - 11 Avatar Digital Hub | Partner Program',
            icon: '🤝',
            theme: 'public',
            access: null,
            description: 'Join the 11 Avatar Digital Hub partner program and grow together.',
            submenu: [],
        },
        
        notFound: {
            id: 'notFound',
            path: '/404',
            page: '404.html',
            title: 'Page Not Found - 11 Avatar Digital Hub',
            icon: '❓',
            theme: 'public',
            access: null,
            description: 'The page you are looking for does not exist.',
            submenu: [],
        },
        
        offline: {
            id: 'offline',
            path: '/offline',
            page: 'offline.html',
            title: 'You are Offline - 11 Avatar Digital Hub',
            icon: '📡',
            theme: 'public',
            access: null,
            description: 'Please check your internet connection.',
            submenu: [],
        },
        
        error: {
            id: 'error',
            path: '/error',
            page: '404.html',
            title: 'Error - 11 Avatar Digital Hub',
            icon: '⚠️',
            theme: 'internal',
            access: null,
            description: 'Something went wrong. Please try again.',
            submenu: [],
        },
    });

    // -------------------------------------------------------------------------
    // SECTION 3: INTERNAL ROUTES (Authentication Required)
    // -------------------------------------------------------------------------
    
    /**
     * @constant {Object} INTERNAL_ROUTES - Dashboard & module pages
     * @description Routes requiring authentication. Light theme (internal).
     */
    const INTERNAL_ROUTES = Object.freeze({
        
        dashboard: {
            id: 'dashboard',
            path: '/dashboard',
            page: 'dashboard.html',
            title: 'Dashboard - 11 Avatar Digital Hub',
            icon: '📊',
            theme: 'internal',
            access: 'all',
            description: 'Your business at a glance - stats, pipeline, tasks, and recent activity.',
            submenu: [
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'today-tasks', label: 'Today\'s Tasks', icon: '📋' },
                { id: 'revenue-stats', label: 'Revenue Stats', icon: '💰' },
                { id: 'quick-actions', label: 'Quick Actions', icon: '⚡' },
                { id: 'recent-activity', label: 'Recent Activity', icon: '🕐' },
            ],
        },
        
        leads: {
            id: 'leads',
            path: '/leads',
            page: 'leads.html',
            title: 'Leads Management - 11 Avatar Digital Hub',
            icon: '📋',
            theme: 'internal',
            access: 'all',
            description: 'Manage, track, score, and convert your leads into deals.',
            submenu: [
                { id: 'all-leads', label: 'All Leads', icon: '📇' },
                { id: 'new-lead', label: 'New Lead', icon: '➕' },
                { id: 'import-export', label: 'Import / Export', icon: '📤' },
                { id: 'kanban-view', label: 'Kanban View', icon: '📊' },
                { id: 'lead-stats', label: 'Lead Stats', icon: '📈' },
            ],
        },
        
        pipeline: {
            id: 'pipeline',
            path: '/pipeline',
            page: 'pipeline.html',
            title: 'Sales Pipeline - 11 Avatar Digital Hub',
            icon: '🔄',
            theme: 'internal',
            access: 'all',
            description: 'Track deals through your 12-stage sales pipeline with Kanban view.',
            submenu: [
                { id: 'all-stages', label: 'All Stages', icon: '📊' },
                { id: 'lead-in', label: 'Lead In', icon: '🆕' },
                { id: 'in-progress', label: 'In Progress', icon: '⏳' },
                { id: 'won', label: 'Won', icon: '🏆' },
                { id: 'lost', label: 'Lost', icon: '❌' },
            ],
        },
        
        clients: {
            id: 'clients',
            path: '/clients',
            page: 'clients.html',
            title: 'Clients - 11 Avatar Digital Hub',
            icon: '👥',
            theme: 'internal',
            access: 'all',
            description: '360° client view - manage relationships, projects, and retainers.',
            submenu: [
                { id: 'active', label: 'Active', icon: '✅' },
                { id: 'all-clients', label: 'All Clients', icon: '👥' },
                { id: 'add-client', label: 'Add Client', icon: '➕' },
            ],
        },
        
        contacts: {
            id: 'contacts',
            path: '/contacts',
            page: 'contacts.html',
            title: 'Contacts - 11 Avatar Digital Hub',
            icon: '📞',
            theme: 'internal',
            access: 'all',
            description: 'Manage all your contacts in one place.',
            submenu: [
                { id: 'all-contacts', label: 'All Contacts', icon: '👤' },
                { id: 'add-contact', label: 'Add Contact', icon: '➕' },
                { id: 'import', label: 'Import', icon: '📥' },
            ],
        },
        
        revenue: {
            id: 'revenue',
            path: '/revenue',
            page: 'revenue.html',
            title: 'Revenue Tracking - 11 Avatar Digital Hub',
            icon: '💰',
            theme: 'internal',
            access: 'all',
            description: 'Track revenue, set goals, monitor collections in real-time.',
            submenu: [
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'add-entry', label: 'Add Entry', icon: '➕' },
                { id: 'reports', label: 'Reports', icon: '📄' },
            ],
        },
        
        invoices: {
            id: 'invoices',
            path: '/invoices',
            page: 'invoices.html',
            title: 'GST Invoices - 11 Avatar Digital Hub',
            icon: '🧾',
            theme: 'internal',
            access: 'all',
            description: 'Create and manage GST-compliant invoices with payment tracking.',
            submenu: [
                { id: 'all-invoices', label: 'All Invoices', icon: '📋' },
                { id: 'create', label: 'Create Invoice', icon: '➕' },
                { id: 'paid', label: 'Paid', icon: '✅' },
                { id: 'overdue', label: 'Overdue', icon: '⚠️' },
            ],
        },
        
        payments: {
            id: 'payments',
            path: '/payments',
            page: 'payments.html',
            title: 'Payments - 11 Avatar Digital Hub',
            icon: '💳',
            theme: 'internal',
            access: 'all',
            description: 'Track all incoming and outgoing payments with reconciliation.',
            submenu: [
                { id: 'all-payments', label: 'All Payments', icon: '💰' },
                { id: 'received', label: 'Received', icon: '📥' },
                { id: 'pending', label: 'Pending', icon: '⏳' },
            ],
        },
        
        projects: {
            id: 'projects',
            path: '/projects',
            page: 'projects.html',
            title: 'Projects - 11 Avatar Digital Hub',
            icon: '🚀',
            theme: 'internal',
            access: 'all',
            description: 'Manage client projects with milestones and timelines.',
            submenu: [
                { id: 'all-projects', label: 'All Projects', icon: '📋' },
                { id: 'planning', label: 'Planning', icon: '📝' },
                { id: 'in-progress', label: 'In Progress', icon: '⏳' },
                { id: 'completed', label: 'Completed', icon: '✅' },
            ],
        },
        
        whatsapp: {
            id: 'whatsapp',
            path: '/whatsapp',
            page: 'whatsapp.html',
            title: 'WhatsApp Integration - 11 Avatar Digital Hub',
            icon: '💬',
            theme: 'internal',
            access: 'all',
            description: 'WhatsApp Business API - send messages, templates, and broadcasts.',
            submenu: [
                { id: 'chat', label: 'Chat', icon: '💬' },
                { id: 'templates', label: 'Templates', icon: '📝' },
                { id: 'broadcast', label: 'Broadcast', icon: '📢' },
            ],
        },
        
        inbox: {
            id: 'inbox',
            path: '/inbox',
            page: 'inbox.html',
            title: 'Omnichannel Inbox - 11 Avatar Digital Hub',
            icon: '📥',
            theme: 'internal',
            access: 'all',
            description: 'Unified inbox for WhatsApp, email, and SMS communications.',
            submenu: [
                { id: 'all', label: 'All Messages', icon: '📋' },
                { id: 'unread', label: 'Unread', icon: '🔵' },
                { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
            ],
        },
        
        tasks: {
            id: 'tasks',
            path: '/tasks',
            page: 'tasks.html',
            title: 'Tasks - 11 Avatar Digital Hub',
            icon: '✅',
            theme: 'internal',
            access: 'all',
            description: 'Manage daily tasks, to-dos, and reminders.',
            submenu: [
                { id: 'today', label: 'Today', icon: '📅' },
                { id: 'upcoming', label: 'Upcoming', icon: '🔮' },
                { id: 'completed', label: 'Completed', icon: '✅' },
            ],
        },
        
        reports: {
            id: 'reports',
            path: '/reports',
            page: 'reports.html',
            title: 'Reports & Analytics - 11 Avatar Digital Hub',
            icon: '📈',
            theme: 'internal',
            access: 'all',
            description: 'Comprehensive reports - revenue, leads, clients, team performance.',
            submenu: [
                { id: 'revenue', label: 'Revenue Report', icon: '💰' },
                { id: 'leads', label: 'Leads Report', icon: '📋' },
                { id: 'clients', label: 'Clients Report', icon: '👥' },
            ],
        },
        
        settings: {
            id: 'settings',
            path: '/settings',
            page: 'settings.html',
            title: 'Settings - 11 Avatar Digital Hub',
            icon: '⚙️',
            theme: 'internal',
            access: 'all',
            description: 'Configure your CRM - profile, business, billing, integrations.',
            submenu: [
                { id: 'profile', label: 'Profile', icon: '👤' },
                { id: 'business', label: 'Business', icon: '🏢' },
                { id: 'billing', label: 'Billing', icon: '💳' },
                { id: 'users', label: 'Users & Roles', icon: '👥' },
                { id: 'integrations', label: 'Integrations', icon: '🔌' },
            ],
        },
        
        profile: {
            id: 'profile',
            path: '/profile',
            page: 'profile.html',
            title: 'My Profile - 11 Avatar Digital Hub',
            icon: '👤',
            theme: 'internal',
            access: 'all',
            description: 'Manage your personal profile, password, and preferences.',
            submenu: [
                { id: 'personal', label: 'Personal Info', icon: '👤' },
                { id: 'password', label: 'Change Password', icon: '🔑' },
                { id: 'preferences', label: 'Preferences', icon: '⚙️' },
            ],
        },
    });

    // -------------------------------------------------------------------------
    // SECTION 4: COMBINED ROUTES
    // -------------------------------------------------------------------------
    
    /** @constant {Object} ALL_ROUTES - Merged public + internal routes */
    const ALL_ROUTES = Object.freeze(Object.assign({}, PUBLIC_ROUTES, INTERNAL_ROUTES));

    // -------------------------------------------------------------------------
    // SECTION 5: NAVIGATION CONFIGURATIONS
    // -------------------------------------------------------------------------
    
    /**
     * @constant {Array} HEADER_NAV - Main header navigation (visible to all authenticated)
     */
    const HEADER_NAV = Object.freeze([
        { id: 'dashboard', label: 'Dashboard', route: 'dashboard' },
        { id: 'leads', label: 'Leads', route: 'leads' },
        { id: 'pipeline', label: 'Pipeline', route: 'pipeline' },
        { id: 'clients', label: 'Clients', route: 'clients' },
        { id: 'revenue', label: 'Revenue', route: 'revenue' },
        { id: 'projects', label: 'Projects', route: 'projects' },
        { id: 'whatsapp', label: 'WhatsApp', route: 'whatsapp' },
        { id: 'reports', label: 'Reports', route: 'reports' },
    ]);
    
    /**
     * @constant {Array} HEADER_SECONDARY_NAV - Secondary nav (shown in dropdown)
     */
    const HEADER_SECONDARY_NAV = Object.freeze([
        { id: 'invoices', label: 'Invoices', route: 'invoices' },
        { id: 'payments', label: 'Payments', route: 'payments' },
        { id: 'tasks', label: 'Tasks', route: 'tasks' },
        { id: 'contacts', label: 'Contacts', route: 'contacts' },
        { id: 'inbox', label: 'Inbox', route: 'inbox' },
    ]);
    
    /**
     * @constant {Array} HEADER_ADMIN_NAV - Admin-only navigation
     */
    const HEADER_ADMIN_NAV = Object.freeze([
        { id: 'admin', label: 'Admin Panel', route: 'admin' },
        { id: 'settings', label: 'Settings', route: 'settings' },
    ]);
    
    /**
     * @constant {Array} PUBLIC_NAV - Navigation for public/landing pages
     */
    const PUBLIC_NAV = Object.freeze([
        { id: 'features', label: 'Features', route: 'features' },
        { id: 'pricing', label: 'Pricing', route: 'pricing' },
        { id: 'integrations', label: 'Integrations', route: 'integrations' },
        { id: 'about', label: 'About', route: 'about' },
        { id: 'contact', label: 'Contact', route: 'contact' },
    ]);
    
    /**
     * @constant {Array} FOOTER_NAV - Footer link groups
     */
    const FOOTER_NAV = Object.freeze({
        product: [
            { label: 'Features', route: 'features' },
            { label: 'Pricing', route: 'pricing' },
            { label: 'Integrations', route: 'integrations' },
            { label: 'Request Demo', route: 'demo' },
            { label: 'Get Started', route: 'register' },
        ],
        company: [
            { label: 'About Us', route: 'about' },
            { label: 'Contact', route: 'contact' },
            { label: 'Careers', route: 'careers' },
            { label: 'Partners', route: 'partners' },
        ],
        legal: [
            { label: 'Privacy Policy', route: 'privacy' },
            { label: 'Terms of Service', route: 'terms' },
            { label: 'Refund Policy', route: 'refund' },
            { label: 'Security', route: 'security' },
        ],
    });

    // -------------------------------------------------------------------------
    // SECTION 6: HELPER FUNCTIONS
    // -------------------------------------------------------------------------
    
    /**
     * Get route configuration by ID
     * @param {string} routeId - Route identifier (e.g., 'dashboard', 'login')
     * @returns {Object|null} Route config object or null
     */
    function getRoute(routeId) {
        return ALL_ROUTES[routeId] || null;
    }
    
    /**
     * Get route ID from a URL path
     * @param {string} path - URL path (e.g., '/dashboard', '/login.html')
     * @returns {string|null} Route ID or null
     */
    function getRouteIdByPath(path) {
        if (!path) return null;
        
        // Normalize: remove .html, remove leading/trailing slashes
        var normalized = path
            .replace(/\.html$/, '')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
        
        if (!normalized || normalized === 'index') return 'landing';
        
        // Search all routes
        for (var id in ALL_ROUTES) {
            if (ALL_ROUTES.hasOwnProperty(id)) {
                var routePath = ALL_ROUTES[id].path
                    .replace(/^\/+/, '')
                    .replace(/\/+$/, '');
                
                if (routePath === normalized) return id;
                // Handle page name matching
                var pageName = ALL_ROUTES[id].page.replace(/\.html$/, '');
                if (pageName === normalized) return id;
            }
        }
        
        return null;
    }
    
    /**
     * Get the .html page file for a route
     * @param {string} routeId - Route identifier
     * @returns {string|null} Page filename or null
     */
    function getPageFile(routeId) {
        var route = ALL_ROUTES[routeId];
        return route ? route.page : null;
    }
    
    /**
     * Get submenu for a route
     * @param {string} routeId - Route identifier
     * @returns {Array} Submenu items array
     */
    function getSubmenu(routeId) {
        var route = ALL_ROUTES[routeId];
        return (route && route.submenu) ? route.submenu.slice() : [];
    }
    
    /**
     * Get all routes accessible by a role
     * @param {string|null} role - User role or null for public only
     * @returns {Array} Array of {id, ...route} objects
     */
    function getAccessibleRoutes(role) {
        var result = [];
        
        for (var id in ALL_ROUTES) {
            if (!ALL_ROUTES.hasOwnProperty(id)) continue;
            var route = ALL_ROUTES[id];
            
            // Public routes always accessible
            if (route.access === null) {
                result.push({ id: id, label: route.title, page: route.page, icon: route.icon, theme: route.theme });
                continue;
            }
            
            // Need authentication
            if (!role) continue;
            
            // Platform roles get everything
            if (isPlatformRole(role)) {
                result.push({ id: id, label: route.title, page: route.page, icon: route.icon, theme: route.theme });
                continue;
            }
            
            // 'all' means any authenticated user
            if (route.access === 'all') {
                result.push({ id: id, label: route.title, page: route.page, icon: route.icon, theme: route.theme });
                continue;
            }
            
            // Check specific permission
            var permissions = getRolePermissions(role);
            if (permissions.indexOf(route.access) !== -1) {
                result.push({ id: id, label: route.title, page: route.page, icon: route.icon, theme: route.theme });
            }
        }
        
        return result;
    }
    
    /**
     * Check if a user can access a route
     * @param {string} routeId - Route identifier
     * @param {Object|null} user - User object with role property
     * @returns {boolean} True if access allowed
     */
    function canAccessRoute(routeId, user) {
        var route = ALL_ROUTES[routeId];
        if (!route) return false;
        
        // Public route
        if (route.access === null) return true;
        
        // Need user
        if (!user || !user.role) return false;
        
        // Platform roles
        if (isPlatformRole(user.role)) return true;
        
        // All authenticated
        if (route.access === 'all') return true;
        
        // Check permission
        var permissions = getRolePermissions(user.role);
        return permissions.indexOf(route.access) !== -1;
    }
    
    /**
     * Get page title for a route
     * @param {string} routeId - Route identifier
     * @returns {string} Page title
     */
    function getPageTitle(routeId) {
        var route = ALL_ROUTES[routeId];
        return route ? route.title : '11 Avatar Digital Hub';
    }
    
    /**
     * Get theme for a route
     * @param {string} routeId - Route identifier
     * @returns {string} 'public' or 'internal'
     */
    function getRouteTheme(routeId) {
        var route = ALL_ROUTES[routeId];
        return route ? route.theme : 'internal';
    }
    
    /**
     * Get description for a route
     * @param {string} routeId - Route identifier
     * @returns {string} Meta description
     */
    function getRouteDescription(routeId) {
        var route = ALL_ROUTES[routeId];
        return route ? route.description : '11 Avatar Digital Hub - Master Revenue CRM';
    }
    
    /**
     * Get header navigation items for a user
     * @param {Object|null} user - User object
     * @returns {Object} { primary, secondary, admin, public }
     */
    function getHeaderNav(user) {
        // If not authenticated, return public nav
        if (!user || !user.role) {
            return {
                primary: [],
                secondary: [],
                admin: [],
                public: PUBLIC_NAV.slice(),
            };
        }
        
        return {
            primary: HEADER_NAV.filter(function(item) {
                return canAccessRoute(item.route, user);
            }),
            secondary: HEADER_SECONDARY_NAV.filter(function(item) {
                return canAccessRoute(item.route, user);
            }),
            admin: HEADER_ADMIN_NAV.filter(function(item) {
                return canAccessRoute(item.route, user);
            }),
            public: [],
        };
    }
    
    /**
     * Get footer navigation groups
     * @returns {Object} Footer nav groups
     */
    function getFooterNav() {
        return {
            product: FOOTER_NAV.product.slice(),
            company: FOOTER_NAV.company.slice(),
            legal: FOOTER_NAV.legal.slice(),
        };
    }
    
    /**
     * Get breadcrumb trail for a route
     * @param {string} routeId - Current route ID
     * @returns {Array} [{ label, path, icon }]
     */
    function getBreadcrumb(routeId) {
        var breadcrumbs = [
            { label: 'Home', path: 'index.html', icon: '🏠' },
        ];
        
        var route = ALL_ROUTES[routeId];
        if (route && routeId !== 'landing') {
            var title = route.title || routeId;
            // Clean up title
            title = title.replace(' - 11 Avatar Digital Hub', '')
                         .replace(' | Master Revenue CRM', '')
                         .replace(' | India\'s #1 Revenue Operating System', '')
                         .replace(' | Free CRM for SMEs', '');
            
            breadcrumbs.push({
                label: title,
                path: route.page,
                icon: route.icon || '',
            });
        }
        
        return breadcrumbs;
    }
    
    /**
     * Find the active submenu item based on hash
     * @param {string} routeId - Current route
     * @param {string} hash - URL hash (without #)
     * @returns {string|null} Active submenu item ID
     */
    function getActiveSubmenu(routeId, hash) {
        var submenu = getSubmenu(routeId);
        
        if (!submenu.length) return null;
        
        if (!hash) return submenu[0].id;
        
        for (var i = 0; i < submenu.length; i++) {
            if (submenu[i].id === hash) return submenu[i].id;
        }
        
        return submenu[0].id;
    }
    
    /**
     * Get total route counts
     * @returns {Object} { total, public, internal }
     */
    function getRouteCounts() {
        var counts = { total: 0, public: 0, internal: 0 };
        
        for (var id in ALL_ROUTES) {
            if (!ALL_ROUTES.hasOwnProperty(id)) continue;
            counts.total++;
            if (ALL_ROUTES[id].theme === 'public') counts.public++;
            else counts.internal++;
        }
        
        return counts;
    }

    // -------------------------------------------------------------------------
    // SECTION 7: PUBLIC API
    // -------------------------------------------------------------------------
    
    /** @type {Object} Public API surface */
    const publicAPI = Object.freeze({
        // Route collections
        ROUTES: ALL_ROUTES,
        PUBLIC_ROUTES: PUBLIC_ROUTES,
        INTERNAL_ROUTES: INTERNAL_ROUTES,
        
        // Navigation configurations
        HEADER_NAV: HEADER_NAV,
        HEADER_SECONDARY_NAV: HEADER_SECONDARY_NAV,
        HEADER_ADMIN_NAV: HEADER_ADMIN_NAV,
        PUBLIC_NAV: PUBLIC_NAV,
        FOOTER_NAV: FOOTER_NAV,
        
        // Helper functions
        getRoute: getRoute,
        getRouteIdByPath: getRouteIdByPath,
        getPageFile: getPageFile,
        getSubmenu: getSubmenu,
        getAccessibleRoutes: getAccessibleRoutes,
        canAccessRoute: canAccessRoute,
        getPageTitle: getPageTitle,
        getRouteTheme: getRouteTheme,
        getRouteDescription: getRouteDescription,
        getHeaderNav: getHeaderNav,
        getFooterNav: getFooterNav,
        getBreadcrumb: getBreadcrumb,
        getActiveSubmenu: getActiveSubmenu,
        getRouteCounts: getRouteCounts,
        
        // Permission helpers
        getRolePermissions: getRolePermissions,
        isPlatformRole: isPlatformRole,
    });
    
    return publicAPI;
    
})(); // End of RoutesConfig IIFE

// =============================================================================
// EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
    window.RoutesConfig = RoutesConfig;
    window.ROUTES = RoutesConfig.ROUTES;
    window.Global = window.Global || {};
    window.Global.RoutesConfig = RoutesConfig;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutesConfig;
}

export {
    RoutesConfig as default,
    RoutesConfig,
};

// Debug log
if (typeof window !== 'undefined' && window.Constants && window.Constants.APP && window.Constants.APP.DEBUG) {
    var counts = RoutesConfig.getRouteCounts();
    console.log(
        '%c[RoutesConfig] %cLoaded %c' + counts.total + ' routes',
        'color: #FFD700; font-weight: bold;',
        'color: #10B981;',
        'color: #888;',
        '(' + counts.public + ' public, ' + counts.internal + ' internal)'
    );
}