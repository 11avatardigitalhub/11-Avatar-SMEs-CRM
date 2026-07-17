/**
 * 11 AVATAR DIGITAL HUB - Notifications Module
 * Enterprise-grade notification management system
 * Push, email, SMS, in-app, WhatsApp notifications with preference management
 * 
 * @module Notifications
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';
import { Validators } from '../utils/validators.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Notifications Module - Complete notification lifecycle
 * Handles all notification channels, preferences, templates, delivery tracking
 */
class NotificationsModule {
    constructor() {
        // Module identity
        this.moduleName = 'notifications';
        this.apiEndpoint = '/api/notifications';
        this.cachePrefix = 'notif_';
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
        
        // Notification channels
        this.channels = {
            'in_app': {
                label: 'In-App',
                icon: 'fa-bell',
                color: '#3B82F6',
                enabled: true,
                realtime: true
            },
            'email': {
                label: 'Email',
                icon: 'fa-envelope',
                color: '#EC4899',
                enabled: true,
                realtime: false
            },
            'sms': {
                label: 'SMS',
                icon: 'fa-sms',
                color: '#10B981',
                enabled: true,
                realtime: false,
                costPerMessage: 0.15
            },
            'push': {
                label: 'Push Notification',
                icon: 'fa-mobile-alt',
                color: '#8B5CF6',
                enabled: true,
                realtime: true,
                requiresPermission: true
            },
            'whatsapp': {
                label: 'WhatsApp',
                icon: 'fa-whatsapp',
                color: '#25D366',
                enabled: true,
                realtime: false,
                requiresCloudWA: true
            },
            'desktop': {
                label: 'Desktop Alert',
                icon: 'fa-desktop',
                color: '#F59E0B',
                enabled: true,
                realtime: true,
                requiresPermission: true
            }
        };
        
        // Notification priorities
        this.priorities = {
            'urgent': {
                label: 'Urgent',
                color: '#DC2626',
                icon: 'fa-exclamation-circle',
                sound: 'urgent.mp3',
                vibrate: true,
                retryCount: 5
            },
            'high': {
                label: 'High',
                color: '#F97316',
                icon: 'fa-arrow-up',
                sound: 'high.mp3',
                vibrate: true,
                retryCount: 3
            },
            'normal': {
                label: 'Normal',
                color: '#3B82F6',
                icon: 'fa-bell',
                sound: 'normal.mp3',
                vibrate: false,
                retryCount: 1
            },
            'low': {
                label: 'Low',
                color: '#6B7280',
                icon: 'fa-chevron-down',
                sound: null,
                vibrate: false,
                retryCount: 0
            }
        };
        
        // Notification categories/types
        this.categories = {
            'deal': { label: 'Deals', icon: 'fa-handshake', color: '#3B82F6' },
            'task': { label: 'Tasks', icon: 'fa-tasks', color: '#F59E0B' },
            'payment': { label: 'Payments', icon: 'fa-rupee-sign', color: '#10B981' },
            'invoice': { label: 'Invoices', icon: 'fa-file-invoice', color: '#8B5CF6' },
            'lead': { label: 'Leads', icon: 'fa-user-plus', color: '#EC4899' },
            'project': { label: 'Projects', icon: 'fa-project-diagram', color: '#14B8A6' },
            'retainer': { label: 'Retainers', icon: 'fa-hand-holding-usd', color: '#F97316' },
            'whatsapp': { label: 'WhatsApp', icon: 'fa-whatsapp', color: '#25D366' },
            'training': { label: 'Training', icon: 'fa-graduation-cap', color: '#DC2626' },
            'system': { label: 'System', icon: 'fa-cog', color: '#6B7280' },
            'reminder': { label: 'Reminders', icon: 'fa-clock', color: '#6366F1' },
            'alert': { label: 'Alerts', icon: 'fa-exclamation-triangle', color: '#EF4444' }
        };
        
        // Notification statuses
        this.statuses = {
            'pending': { label: 'Pending', color: '#F59E0B' },
            'sent': { label: 'Sent', color: '#3B82F6' },
            'delivered': { label: 'Delivered', color: '#10B981' },
            'read': { label: 'Read', color: '#8B5CF6' },
            'failed': { label: 'Failed', color: '#DC2626' },
            'dismissed': { label: 'Dismissed', color: '#6B7280' }
        };
        
        // Module state
        this.notifications = new Map();
        this.unreadCount = 0;
        this.unreadByCategory = new Map();
        
        // User preferences
        this.preferences = {
            channels: {
                in_app: true,
                email: true,
                sms: false,
                push: true,
                whatsapp: false,
                desktop: true
            },
            categories: {},
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
            },
            digest: {
                enabled: false,
                frequency: 'daily', // daily, weekly
                time: '09:00'
            },
            sound: true,
            vibrate: true,
            badge: true,
            preview: true
        };
        
        // Initialize all categories as enabled
        Object.keys(this.categories).forEach(cat => {
            this.preferences.categories[cat] = true;
        });
        
        // Notification queue
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        
        // Active toast/popup notifications
        this.activeToasts = [];
        this.maxToasts = 5;
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 30,
            total: 0,
            totalPages: 0,
            unreadFirst: true
        };
        
        // Filters
        this.filters = {
            category: 'all',
            priority: 'all',
            status: 'all',
            channel: 'all',
            search: '',
            dateRange: null,
            unreadOnly: false
        };
        
        // Performance
        this.metrics = {
            totalSent: 0,
            totalDelivered: 0,
            totalRead: 0,
            deliveryRate: 0,
            readRate: 0,
            averageDeliveryTime: 0,
            lastCalculated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            notificationList: null,
            notificationBell: null,
            unreadBadge: null,
            filterBar: null,
            searchInput: null,
            preferencePanel: null,
            notificationPopup: null,
            markAllReadBtn: null
        };
        
        // WebSocket for real-time notifications
        this.wsConnection = null;
        this.wsReconnectTimer = null;
        
        // Service Worker for push
        this.swRegistration = null;
        this.pushSubscription = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize notifications module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Notifications] Initializing notification system...');
            
            // Check permissions
            const canAccess = await Permissions.check('notifications', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Notifications module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load preferences
            await this.loadPreferences();
            
            // Load notifications
            await this.loadNotifications();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up real-time notifications (WebSocket)
            this.setupRealtimeNotifications();
            
            // Set up push notifications
            await this.setupPushNotifications();
            
            // Set up notification badge
            this.updateNotificationBadge();
            
            // Start queue processor
            this.startQueueProcessor();
            
            // Render
            await this.render();
            
            // Request browser notification permission
            this.requestNotificationPermission();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Notifications] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('notifications:ready', {
                unread: this.unreadCount,
                preferences: this.preferences
            });
            
        } catch (error) {
            console.error('[Notifications] Initialization failed:', error);
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#notifications-container',
                notificationList: '#notification-list',
                notificationBell: '#notification-bell',
                unreadBadge: '#unread-badge',
                filterBar: '#notification-filters',
                searchInput: '#notification-search',
                preferencePanel: '#notification-preferences',
                notificationPopup: '#notification-popup',
                markAllReadBtn: '#mark-all-read'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Notifications] DOM elements cached');
            
        } catch (error) {
            console.error('[Notifications] DOM cache failed:', error);
        }
    }
    
    /**
     * Load user preferences
     */
    async loadPreferences() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}preferences`);
            if (cached && cached.data) {
                this.preferences = { ...this.preferences, ...cached.data };
                return;
            }
            
            const response = await API.get(`${this.apiEndpoint}/preferences`);
            
            if (response.success && response.data) {
                this.preferences = { ...this.preferences, ...response.data };
                await Cache.set(`${this.cachePrefix}preferences`, this.preferences, 3600000); // 1 hour
            }
            
        } catch (error) {
            console.error('[Notifications] Preferences load failed:', error);
        }
    }
    
    /**
     * Load notifications
     */
    async loadNotifications(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                unreadFirst: this.pagination.unreadFirst.toString()
            });
            
            if (this.filters.category !== 'all') params.set('category', this.filters.category);
            if (this.filters.priority !== 'all') params.set('priority', this.filters.priority);
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.unreadOnly) params.set('unreadOnly', 'true');
            if (this.filters.search) params.set('search', this.filters.search);
            
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processNotifications(cached.data);
                    return;
                }
            }
            
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load notifications');
            }
            
            this.processNotifications(response.data);
            
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Notifications] Loaded ${this.notifications.size} notifications`);
            
        } catch (error) {
            console.error('[Notifications] Load failed:', error);
        }
    }
    
    /**
     * Process notifications data
     */
    processNotifications(data) {
        try {
            if (page === 1) {
                this.notifications.clear();
                this.unreadCount = 0;
                this.unreadByCategory.clear();
            }
            
            if (data.notifications && Array.isArray(data.notifications)) {
                data.notifications.forEach(notification => {
                    const processed = {
                        ...notification,
                        formattedTime: Formatters.relativeTime(notification.createdAt),
                        formattedDate: Formatters.date(notification.createdAt),
                        priorityInfo: this.priorities[notification.priority] || this.priorities.normal,
                        categoryInfo: this.categories[notification.category] || this.categories.system,
                        channelInfo: this.channels[notification.channel] || this.channels.in_app,
                        statusInfo: this.statuses[notification.status] || this.statuses.pending,
                        isUnread: notification.status !== 'read' && notification.status !== 'dismissed',
                        hasAction: notification.actionUrl || notification.actions?.length > 0
                    };
                    
                    this.notifications.set(notification.id, processed);
                    
                    // Track unread
                    if (processed.isUnread) {
                        this.unreadCount++;
                        const catCount = this.unreadByCategory.get(notification.category) || 0;
                        this.unreadByCategory.set(notification.category, catCount + 1);
                    }
                });
            }
            
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
            if (data.unreadCount !== undefined) {
                this.unreadCount = data.unreadCount;
            }
            
            // Update badge
            this.updateNotificationBadge();
            
        } catch (error) {
            console.error('[Notifications] Processing failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            // Notification bell click
            if (this.elements.notificationBell) {
                this.elements.notificationBell.addEventListener('click', () => {
                    this.toggleNotificationPopup();
                });
            }
            
            // Mark all read
            if (this.elements.markAllReadBtn) {
                this.elements.markAllReadBtn.addEventListener('click', () => {
                    this.markAllAsRead();
                });
            }
            
            // Search
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            // Filters
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            // Click outside popup to close
            document.addEventListener('click', (e) => {
                if (this.elements.notificationPopup && 
                    !this.elements.notificationPopup.contains(e.target) &&
                    !this.elements.notificationBell?.contains(e.target)) {
                    this.closeNotificationPopup();
                }
            });
            
            // Event bus - global notification sender
            EventBus.on('notification:send', this.sendNotification.bind(this));
            EventBus.on('notification:mark-read', this.markAsRead.bind(this));
            EventBus.on('notification:dismiss', this.dismissNotification.bind(this));
            
            // Listen for key events from other modules
            EventBus.on('deal:won', (data) => {
                this.sendNotification({
                    category: 'deal',
                    priority: 'high',
                    title: 'Deal Won! 🎉',
                    message: `Deal "${data.dealName}" worth ${Formatters.currency(data.value)} has been won!`,
                    actionUrl: `/pipeline/${data.dealId}`,
                    channels: ['in_app', 'email', 'push']
                });
            });
            
            EventBus.on('invoice:paid', (data) => {
                this.sendNotification({
                    category: 'payment',
                    priority: 'normal',
                    title: 'Payment Received',
                    message: `Payment of ${Formatters.currency(data.amount)} received for invoice #${data.invoiceNumber}`,
                    actionUrl: `/payments/${data.paymentId}`,
                    channels: ['in_app', 'email']
                });
            });
            
            EventBus.on('task:overdue', (data) => {
                this.sendNotification({
                    category: 'task',
                    priority: 'urgent',
                    title: 'Task Overdue!',
                    message: `Task "${data.taskTitle}" is overdue by ${data.daysOverdue} days`,
                    actionUrl: `/tasks/${data.taskId}`,
                    channels: ['in_app', 'push', 'email']
                });
            });
            
            console.log('[Notifications] Event listeners initialized');
            
        } catch (error) {
            console.error('[Notifications] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up real-time notifications via WebSocket
     */
    setupRealtimeNotifications() {
        try {
            // Connect to WebSocket for real-time updates
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications`;
            
            const token = State.getAuthToken();
            if (!token) {
                console.warn('[Notifications] No auth token for WebSocket');
                return;
            }
            
            this.wsConnection = new WebSocket(`${wsUrl}?token=${token}`);
            
            this.wsConnection.onopen = () => {
                console.log('[Notifications] WebSocket connected');
                this.processNotificationQueue();
            };
            
            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'notification') {
                        this.handleIncomingNotification(data.notification);
                    } else if (data.type === 'status_update') {
                        this.handleStatusUpdate(data);
                    }
                } catch (error) {
                    console.error('[Notifications] WebSocket message parse error:', error);
                }
            };
            
            this.wsConnection.onclose = () => {
                console.log('[Notifications] WebSocket disconnected');
                this.scheduleReconnect();
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('[Notifications] WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('[Notifications] WebSocket setup failed:', error);
        }
    }
    
    /**
     * Schedule WebSocket reconnection
     */
    scheduleReconnect() {
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
        }
        
        this.wsReconnectTimer = setTimeout(() => {
            console.log('[Notifications] Attempting WebSocket reconnection...');
            this.setupRealtimeNotifications();
        }, 5000);
    }
    
    /**
     * Set up push notifications
     */
    async setupPushNotifications() {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.log('[Notifications] Push notifications not supported');
                return;
            }
            
            // Register service worker if not already
            if (!this.swRegistration) {
                this.swRegistration = await navigator.serviceWorker.ready;
            }
            
            // Check existing subscription
            this.pushSubscription = await this.swRegistration.pushManager.getSubscription();
            
            if (this.pushSubscription && this.preferences.channels.push) {
                console.log('[Notifications] Push subscription active');
            }
            
        } catch (error) {
            console.error('[Notifications] Push setup failed:', error);
        }
    }
    
    /**
     * Request browser notification permission
     */
    async requestNotificationPermission() {
        try {
            if (!('Notification' in window)) return;
            
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    console.log('[Notifications] Browser notification permission granted');
                    await this.subscribeToPush();
                }
            } else if (Notification.permission === 'granted') {
                await this.subscribeToPush();
            }
            
        } catch (error) {
            console.error('[Notifications] Permission request failed:', error);
        }
    }
    
    /**
     * Subscribe to push notifications
     */
    async subscribeToPush() {
        try {
            if (!this.swRegistration || !this.preferences.channels.push) return;
            
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY || '')
            });
            
            // Save subscription to server
            await API.post(`${this.apiEndpoint}/push-subscribe`, subscription);
            
            this.pushSubscription = subscription;
            console.log('[Notifications] Push subscription successful');
            
        } catch (error) {
            console.error('[Notifications] Push subscription failed:', error);
        }
    }
    
    /**
     * Convert base64 to Uint8Array for VAPID
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }
    
    /**
     * Handle incoming real-time notification
     */
    handleIncomingNotification(notification) {
        try {
            // Add to notification store
            this.notifications.set(notification.id, {
                ...notification,
                formattedTime: Formatters.relativeTime(notification.createdAt),
                priorityInfo: this.priorities[notification.priority] || this.priorities.normal,
                categoryInfo: this.categories[notification.category] || this.categories.system,
                isUnread: true
            });
            
            this.unreadCount++;
            
            // Update badge
            this.updateNotificationBadge();
            
            // Show toast for high priority
            if (notification.priority === 'urgent' || notification.priority === 'high') {
                this.showNotificationToast(notification);
            }
            
            // Show desktop notification
            if (this.preferences.channels.desktop && Notification.permission === 'granted') {
                this.showDesktopNotification(notification);
            }
            
            // Play sound
            if (this.preferences.sound && notification.priorityInfo.sound) {
                this.playNotificationSound(notification.priorityInfo.sound);
            }
            
            // Update UI if visible
            this.updateNotificationList();
            
            EventBus.emit('notification:received', notification);
            
        } catch (error) {
            console.error('[Notifications] Incoming handling failed:', error);
        }
    }
    
    /**
     * Show notification toast
     */
    showNotificationToast(notification) {
        try {
            // Remove oldest toast if max reached
            if (this.activeToasts.length >= this.maxToasts) {
                const oldest = this.activeToasts.shift();
                oldest?.remove();
            }
            
            const toast = document.createElement('div');
            toast.className = `notification-toast priority-${notification.priority}`;
            toast.innerHTML = `
                <div class="toast-icon" style="background: ${notification.priorityInfo.color}20; color: ${notification.priorityInfo.color}">
                    <i class="fas ${notification.categoryInfo.icon}"></i>
                </div>
                <div class="toast-content">
                    <strong>${this.escapeHtml(notification.title)}</strong>
                    <p>${this.escapeHtml(notification.message)}</p>
                    <small>${notification.formattedTime}</small>
                </div>
                <button class="toast-close" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
                ${notification.actionUrl ? `
                    <button class="toast-action" onclick="window.location.href='${notification.actionUrl}'">
                        View
                    </button>
                ` : ''}
            `;
            
            document.body.appendChild(toast);
            this.activeToasts.push(toast);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                toast.classList.add('toast-fade-out');
                setTimeout(() => toast.remove(), 300);
            }, 5000);
            
        } catch (error) {
            console.error('[Notifications] Toast display failed:', error);
        }
    }
    
    /**
     * Show desktop notification
     */
    showDesktopNotification(notification) {
        try {
            if (Notification.permission !== 'granted') return;
            
            const desktopNotif = new Notification(notification.title, {
                body: notification.message,
                icon: notification.icon || '/assets/logo-192.png',
                badge: '/assets/badge-72.png',
                tag: notification.id,
                data: {
                    url: notification.actionUrl,
                    notificationId: notification.id
                },
                requireInteraction: notification.priority === 'urgent',
                vibrate: this.preferences.vibrate ? [200, 100, 200] : undefined
            });
            
            desktopNotif.onclick = () => {
                window.focus();
                if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                }
                this.markAsRead(notification.id);
                desktopNotif.close();
            };
            
            // Auto-close after 10 seconds
            setTimeout(() => desktopNotif.close(), 10000);
            
        } catch (error) {
            console.error('[Notifications] Desktop notification failed:', error);
        }
    }
    
    /**
     * Play notification sound
     */
    playNotificationSound(soundFile) {
        try {
            if (!soundFile) return;
            
            const audio = new Audio(`/sounds/${soundFile}`);
            audio.volume = 0.5;
            audio.play().catch(() => {
                // Autoplay blocked - ignore
            });
            
        } catch (error) {
            // Silently fail - sound is non-critical
        }
    }
    
    /**
     * Send notification through specified channels
     */
    async sendNotification(config) {
        try {
            const notification = {
                category: config.category || 'system',
                priority: config.priority || 'normal',
                title: config.title,
                message: config.message,
                channels: config.channels || ['in_app'],
                actionUrl: config.actionUrl || null,
                actions: config.actions || [],
                metadata: config.metadata || {},
                userId: config.userId || State.getCurrentUser()?.id,
                createdAt: new Date().toISOString()
            };
            
            // Add to queue
            this.notificationQueue.push(notification);
            
            // Process immediately if not already processing
            if (!this.isProcessingQueue) {
                this.processNotificationQueue();
            }
            
        } catch (error) {
            console.error('[Notifications] Send failed:', error);
        }
    }
    
    /**
     * Process notification queue
     */
    async processNotificationQueue() {
        if (this.isProcessingQueue || this.notificationQueue.length === 0) return;
        
        try {
            this.isProcessingQueue = true;
            
            while (this.notificationQueue.length > 0) {
                const notification = this.notificationQueue.shift();
                
                // Check user preferences for each channel
                const enabledChannels = notification.channels.filter(channel => {
                    return this.preferences.channels[channel] !== false;
                });
                
                if (enabledChannels.length === 0) continue;
                
                // Check category preference
                if (this.preferences.categories[notification.category] === false) continue;
                
                // Check quiet hours
                if (this.isInQuietHours() && notification.priority !== 'urgent') {
                    // Delay non-urgent notifications
                    this.scheduleForQuietHoursEnd(notification);
                    continue;
                }
                
                // Save to API
                const response = await API.post(`${this.apiEndpoint}/send`, {
                    ...notification,
                    channels: enabledChannels
                });
                
                if (response.success) {
                    // Add to local store
                    const enriched = {
                        ...notification,
                        id: response.data.id,
                        status: 'sent',
                        formattedTime: Formatters.relativeTime(notification.createdAt)
                    };
                    
                    this.notifications.set(enriched.id, enriched);
                    
                    // If in-app is enabled, show it
                    if (enabledChannels.includes('in_app')) {
                        this.handleIncomingNotification(enriched);
                    }
                    
                    this.metrics.totalSent++;
                }
            }
            
        } catch (error) {
            console.error('[Notifications] Queue processing failed:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }
    
    /**
     * Check if current time is in quiet hours
     */
    isInQuietHours() {
        if (!this.preferences.quietHours.enabled) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMin] = this.preferences.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = this.preferences.quietHours.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime < endTime;
        } else {
            // Overnight quiet hours
            return currentTime >= startTime || currentTime < endTime;
        }
    }
    
    /**
     * Schedule notification for quiet hours end
     */
    scheduleForQuietHoursEnd(notification) {
        const [endHour, endMin] = this.preferences.quietHours.end.split(':').map(Number);
        const now = new Date();
        const deliveryTime = new Date(now);
        deliveryTime.setHours(endHour, endMin, 0, 0);
        
        if (deliveryTime <= now) {
            deliveryTime.setDate(deliveryTime.getDate() + 1);
        }
        
        const delay = deliveryTime - now;
        
        setTimeout(() => {
            this.notificationQueue.push(notification);
            this.processNotificationQueue();
        }, delay);
    }
    
    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            const notification = this.notifications.get(notificationId);
            if (!notification) return;
            
            if (notification.isUnread) {
                notification.isUnread = false;
                notification.status = 'read';
                notification.statusInfo = this.statuses.read;
                
                this.notifications.set(notificationId, notification);
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                
                const catCount = this.unreadByCategory.get(notification.category) || 0;
                if (catCount > 0) {
                    this.unreadByCategory.set(notification.category, catCount - 1);
                }
                
                this.updateNotificationBadge();
            }
            
            // Update on server
            await API.put(`${this.apiEndpoint}/${notificationId}/read`);
            
            this.metrics.totalRead++;
            
            EventBus.emit('notification:read', { notificationId });
            
        } catch (error) {
            console.error('[Notifications] Mark read failed:', error);
        }
    }
    
    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            const unreadIds = [];
            
            this.notifications.forEach((notification, id) => {
                if (notification.isUnread) {
                    unreadIds.push(id);
                    notification.isUnread = false;
                    notification.status = 'read';
                }
            });
            
            this.unreadCount = 0;
            this.unreadByCategory.clear();
            
            this.updateNotificationBadge();
            
            // Bulk update on server
            await API.post(`${this.apiEndpoint}/mark-all-read`, { ids: unreadIds });
            
            // Update UI
            this.updateNotificationList();
            
            Toast.show('All notifications marked as read', 'success');
            
        } catch (error) {
            console.error('[Notifications] Mark all read failed:', error);
        }
    }
    
    /**
     * Dismiss notification
     */
    async dismissNotification(notificationId) {
        try {
            const notification = this.notifications.get(notificationId);
            if (!notification) return;
            
            notification.status = 'dismissed';
            notification.statusInfo = this.statuses.dismissed;
            
            if (notification.isUnread) {
                notification.isUnread = false;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
            
            this.notifications.set(notificationId, notification);
            
            await API.put(`${this.apiEndpoint}/${notificationId}/dismiss`);
            
            this.updateNotificationBadge();
            this.updateNotificationList();
            
        } catch (error) {
            console.error('[Notifications] Dismiss failed:', error);
        }
    }
    
    /**
     * Update notification badge
     */
    updateNotificationBadge() {
        try {
            // Update bell badge
            if (this.elements.unreadBadge) {
                if (this.unreadCount > 0) {
                    this.elements.unreadBadge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                    this.elements.unreadBadge.style.display = 'flex';
                } else {
                    this.elements.unreadBadge.style.display = 'none';
                }
            }
            
            // Update document title
            if (this.unreadCount > 0) {
                document.title = `(${this.unreadCount}) ${document.title.replace(/^\(\d+\) /, '')}`;
            } else {
                document.title = document.title.replace(/^\(\d+\) /, '');
            }
            
            // Update favicon badge (if supported)
            if ('setAppBadge' in navigator) {
                navigator.setAppBadge(this.unreadCount).catch(() => {});
            }
            
        } catch (error) {
            console.error('[Notifications] Badge update failed:', error);
        }
    }
    
    /**
     * Toggle notification popup
     */
    toggleNotificationPopup() {
        if (this.elements.notificationPopup) {
            const isVisible = this.elements.notificationPopup.style.display === 'block';
            
            if (isVisible) {
                this.closeNotificationPopup();
            } else {
                this.openNotificationPopup();
            }
        }
    }
    
    /**
     * Open notification popup
     */
    async openNotificationPopup() {
        try {
            if (!this.elements.notificationPopup) return;
            
            // Load latest notifications
            await this.loadNotifications();
            
            // Render popup
            this.elements.notificationPopup.innerHTML = this.renderPopupContent();
            this.elements.notificationPopup.style.display = 'block';
            
        } catch (error) {
            console.error('[Notifications] Popup open failed:', error);
        }
    }
    
    /**
     * Close notification popup
     */
    closeNotificationPopup() {
        if (this.elements.notificationPopup) {
            this.elements.notificationPopup.style.display = 'none';
        }
    }
    
    /**
     * Render popup content
     */
    renderPopupContent() {
        if (this.notifications.size === 0) {
            return `
                <div class="popup-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications</p>
                </div>
            `;
        }
        
        let html = `
            <div class="popup-header">
                <h4>Notifications</h4>
                ${this.unreadCount > 0 ? `
                    <button class="btn-text" onclick="window.Global.Notifications.markAllAsRead()">
                        Mark all read
                    </button>
                ` : ''}
            </div>
            <div class="popup-list">
        `;
        
        // Show latest 10 notifications
        let count = 0;
        this.notifications.forEach((notification) => {
            if (count >= 10) return;
            count++;
            
            const priorityInfo = notification.priorityInfo;
            const categoryInfo = notification.categoryInfo;
            
            html += `
                <div class="popup-item ${notification.isUnread ? 'unread' : ''} priority-${notification.priority}"
                     onclick="window.Global.Notifications.markAsRead('${notification.id}'); ${notification.actionUrl ? `window.location.href='${notification.actionUrl}'` : ''}">
                    <div class="item-icon" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                        <i class="fas ${categoryInfo.icon}"></i>
                    </div>
                    <div class="item-content">
                        <div class="item-header">
                            <strong>${this.escapeHtml(notification.title)}</strong>
                            <span class="priority-dot" style="background: ${priorityInfo.color}" title="${priorityInfo.label}"></span>
                        </div>
                        <p>${this.escapeHtml(notification.message?.substring(0, 100) || '')}</p>
                        <small>${notification.formattedTime}</small>
                    </div>
                    <button class="item-dismiss" onclick="event.stopPropagation(); window.Global.Notifications.dismissNotification('${notification.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="popup-footer">
                <a href="/notifications" onclick="window.Global.Notifications.viewAll()">
                    View All Notifications
                </a>
            </div>
        `;
        
        return html;
    }
    
    /**
     * Update notification list in main view
     */
    updateNotificationList() {
        if (this.elements.notificationPopup?.style.display === 'block') {
            this.openNotificationPopup();
        }
        
        if (this.elements.notificationList) {
            this.render();
        }
    }
    
    /**
     * Render main notifications view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            const html = `
                <div class="notifications-page">
                    <div class="page-header">
                        <h2><i class="fas fa-bell"></i> Notifications</h2>
                        <div class="header-actions">
                            <button class="btn btn-outline" onclick="window.Global.Notifications.openPreferences()">
                                <i class="fas fa-cog"></i> Preferences
                            </button>
                            ${this.unreadCount > 0 ? `
                                <button class="btn btn-primary" onclick="window.Global.Notifications.markAllAsRead()">
                                    <i class="fas fa-check-double"></i> Mark All Read
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Category Quick Filters -->
                    <div class="category-filters">
                        <button class="filter-btn ${this.filters.category === 'all' ? 'active' : ''}"
                                onclick="window.Global.Notifications.filterByCategory('all')">
                            All
                        </button>
                        ${Object.entries(this.categories).map(([key, cat]) => `
                            <button class="filter-btn ${this.filters.category === key ? 'active' : ''}"
                                    onclick="window.Global.Notifications.filterByCategory('${key}')"
                                    style="border-color: ${cat.color}">
                                <i class="fas ${cat.icon}" style="color: ${cat.color}"></i>
                                ${cat.label}
                                ${this.unreadByCategory.get(key) ? `
                                    <span class="cat-count">${this.unreadByCategory.get(key)}</span>
                                ` : ''}
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Notifications List -->
                    <div class="notifications-list" id="notification-list">
                        ${this.renderNotificationList()}
                    </div>
                    
                    ${this.notifications.size === 0 ? this.renderEmptyState() : ''}
                    ${this.renderPagination()}
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Notifications] View rendered');
            
        } catch (error) {
            console.error('[Notifications] Render failed:', error);
        }
    }
    
    /**
     * Render notification list items
     */
    renderNotificationList() {
        if (this.notifications.size === 0) return '';
        
        let html = '';
        
        this.notifications.forEach((notification) => {
            const priorityInfo = notification.priorityInfo;
            const categoryInfo = notification.categoryInfo;
            const channelInfo = notification.channelInfo;
            
            html += `
                <div class="notification-item ${notification.isUnread ? 'unread' : ''} priority-${notification.priority}"
                     data-notification-id="${notification.id}">
                    <div class="item-left">
                        <div class="item-icon" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                            <i class="fas ${categoryInfo.icon}"></i>
                        </div>
                    </div>
                    
                    <div class="item-center" onclick="window.Global.Notifications.handleNotificationClick('${notification.id}')">
                        <div class="item-header">
                            <strong>${this.escapeHtml(notification.title)}</strong>
                            <span class="priority-badge" style="background: ${priorityInfo.color}20; color: ${priorityInfo.color}">
                                ${priorityInfo.label}
                            </span>
                        </div>
                        <p class="item-message">${this.escapeHtml(notification.message)}</p>
                        <div class="item-meta">
                            <span class="channel-badge" style="color: ${channelInfo.color}">
                                <i class="fas ${channelInfo.icon}"></i> ${channelInfo.label}
                            </span>
                            <span class="item-time">${notification.formattedTime}</span>
                        </div>
                    </div>
                    
                    <div class="item-right">
                        ${notification.hasAction ? `
                            <button class="btn btn-sm btn-primary" 
                                    onclick="window.Global.Notifications.handleNotificationAction('${notification.id}')">
                                ${notification.actionLabel || 'View'}
                            </button>
                        ` : ''}
                        <button class="btn-icon" title="Dismiss" 
                                onclick="window.Global.Notifications.dismissNotification('${notification.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Handle notification click
     */
    async handleNotificationClick(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) return;
        
        // Mark as read
        await this.markAsRead(notificationId);
        
        // Navigate to action URL
        if (notification.actionUrl) {
            EventBus.emit('route:navigate', notification.actionUrl);
        }
    }
    
    /**
     * Handle notification action
     */
    handleNotificationAction(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) return;
        
        if (notification.actions?.length > 0) {
            // Show action menu
            this.showActionMenu(notification);
        } else if (notification.actionUrl) {
            EventBus.emit('route:navigate', notification.actionUrl);
        }
    }
    
    /**
     * Open notification preferences
     */
    async openPreferences() {
        try {
            const prefHtml = `
                <div class="preferences-form">
                    <form id="preferences-form">
                        <!-- Channel Preferences -->
                        <div class="pref-section">
                            <h4><i class="fas fa-broadcast-tower"></i> Notification Channels</h4>
                            ${Object.entries(this.channels).map(([key, channel]) => `
                                <div class="pref-item">
                                    <div class="pref-info">
                                        <i class="fas ${channel.icon}" style="color: ${channel.color}"></i>
                                        <div>
                                            <strong>${channel.label}</strong>
                                            <small>${channel.realtime ? 'Real-time' : 'Delayed'} delivery</small>
                                        </div>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" name="channel_${key}" 
                                               ${this.preferences.channels[key] ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Category Preferences -->
                        <div class="pref-section">
                            <h4><i class="fas fa-tags"></i> Notification Categories</h4>
                            ${Object.entries(this.categories).map(([key, cat]) => `
                                <div class="pref-item">
                                    <div class="pref-info">
                                        <i class="fas ${cat.icon}" style="color: ${cat.color}"></i>
                                        <strong>${cat.label}</strong>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" name="category_${key}" 
                                               ${this.preferences.categories[key] !== false ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Quiet Hours -->
                        <div class="pref-section">
                            <h4><i class="fas fa-moon"></i> Quiet Hours</h4>
                            <div class="pref-item">
                                <div class="pref-info">
                                    <strong>Enable Quiet Hours</strong>
                                    <small>Pause non-urgent notifications</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" name="quietHours" 
                                           ${this.preferences.quietHours.enabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>From</label>
                                    <input type="time" name="quietStart" value="${this.preferences.quietHours.start}">
                                </div>
                                <div class="form-group">
                                    <label>To</label>
                                    <input type="time" name="quietEnd" value="${this.preferences.quietHours.end}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Digest Settings -->
                        <div class="pref-section">
                            <h4><i class="fas fa-envelope-open-text"></i> Email Digest</h4>
                            <div class="pref-item">
                                <div class="pref-info">
                                    <strong>Daily Digest</strong>
                                    <small>Receive summary of notifications</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" name="digest" 
                                           ${this.preferences.digest.enabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Save Preferences
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Notification Preferences',
                content: prefHtml,
                size: 'large'
            });
            
            modal.open();
            
            setTimeout(() => {
                const form = document.getElementById('preferences-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        await this.savePreferences(new FormData(form));
                        Modal.close();
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('[Notifications] Preferences open failed:', error);
        }
    }
    
    /**
     * Save notification preferences
     */
    async savePreferences(formData) {
        try {
            const preferences = {
                channels: {},
                categories: {},
                quietHours: {
                    enabled: formData.get('quietHours') === 'on',
                    start: formData.get('quietStart'),
                    end: formData.get('quietEnd')
                },
                digest: {
                    enabled: formData.get('digest') === 'on'
                }
            };
            
            // Extract channel preferences
            Object.keys(this.channels).forEach(key => {
                preferences.channels[key] = formData.get(`channel_${key}`) === 'on';
            });
            
            // Extract category preferences
            Object.keys(this.categories).forEach(key => {
                preferences.categories[key] = formData.get(`category_${key}`) === 'on';
            });
            
            // Save to server
            const response = await API.put(`${this.apiEndpoint}/preferences`, preferences);
            
            if (!response.success) throw new Error(response.error);
            
            // Update local
            this.preferences = { ...this.preferences, ...preferences };
            
            // Update cache
            await Cache.set(`${this.cachePrefix}preferences`, this.preferences, 3600000);
            
            Toast.show('Preferences saved successfully', 'success');
            
        } catch (error) {
            console.error('[Notifications] Preferences save failed:', error);
            Toast.show('Failed to save preferences', 'error');
        }
    }
    
    /**
     * Start queue processor interval
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.notificationQueue.length > 0 && !this.isProcessingQueue) {
                this.processNotificationQueue();
            }
        }, 10000); // Check every 10 seconds
    }
    
    /**
     * Filter by category
     */
    async filterByCategory(category) {
        this.filters.category = category;
        await this.loadNotifications();
        await this.render();
    }
    
    /**
     * View all notifications page
     */
    viewAll() {
        this.closeNotificationPopup();
        EventBus.emit('route:navigate', '/notifications');
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalSent = 0;
            let totalDelivered = 0;
            let totalRead = 0;
            let totalDeliveryTime = 0;
            let deliveredCount = 0;
            
            this.notifications.forEach(notification => {
                totalSent++;
                if (notification.status === 'delivered' || notification.status === 'read') {
                    totalDelivered++;
                }
                if (notification.status === 'read') {
                    totalRead++;
                }
            });
            
            this.metrics.totalSent = totalSent;
            this.metrics.totalDelivered = totalDelivered;
            this.metrics.totalRead = totalRead;
            this.metrics.deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
            this.metrics.readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Notifications] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Are default filters
     */
    areDefaultFilters() {
        return this.filters.category === 'all' &&
               this.filters.priority === 'all' &&
               this.filters.status === 'all' &&
               !this.filters.unreadOnly &&
               !this.filters.search;
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-bell-slash"></i>
                </div>
                <h3>No Notifications</h3>
                <p>You're all caught up!</p>
            </div>
        `;
    }
    
    /**
     * Render pagination
     */
    renderPagination() {
        if (this.pagination.totalPages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        html += `<button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                        onclick="window.Global.Notifications.loadNotifications(${this.pagination.page - 1})">
                    <i class="fas fa-chevron-left"></i></button>`;
        
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `<button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                                onclick="window.Global.Notifications.loadNotifications(${i})">${i}</button>`;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        html += `<button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                        onclick="window.Global.Notifications.loadNotifications(${this.pagination.page + 1})">
                    <i class="fas fa-chevron-right"></i></button>`;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Clean up
     */
    destroy() {
        // Close WebSocket
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        
        // Clear reconnect timer
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
        }
        
        // Remove all toasts
        this.activeToasts.forEach(toast => toast.remove());
        this.activeToasts = [];
        
        EventBus.off('notification:send');
        EventBus.off('notification:mark-read');
        EventBus.off('notification:dismiss');
        
        console.log('[Notifications] Module destroyed');
    }
}

// Singleton
const notifications = new NotificationsModule();

// Exports
export { notifications, NotificationsModule };
export default notifications;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Notifications = notifications;
}

