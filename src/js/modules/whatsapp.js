/**
 * 11 AVATAR DIGITAL HUB - WhatsApp Integration Module
 * Enterprise-grade WhatsApp Business API integration
 * Integrates with existing CloudWA SaaS CRM (cloudwa.11avatardigitalhub.cloud)
 * Same Firebase project: avatar-wa-dual-crm
 * 
 * @module WhatsApp
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
 * WhatsApp Integration Module
 * Seamless bridge between 11-Avatar-SMEs-CRM CRM and CloudWA SaaS
 * Unified messaging, template management, automation workflows
 */
class WhatsAppModule {
    constructor() {
        // Module identity
        this.moduleName = 'whatsapp';
        this.apiEndpoint = '/api/whatsapp';
        this.cachePrefix = 'wa_';
        this.cacheTimeout = 3 * 60 * 1000; // 3 minutes (messages update frequently)
        
        // CloudWA Integration Configuration
        this.cloudWAConfig = {
            baseURL: 'https://cloudwa.11avatardigitalhub.cloud',
            apiEndpoint: 'https://cloudwa.11avatardigitalhub.cloud/api',
            loginURL: 'https://cloudwa.11avatardigitalhub.cloud/login',
            webhookURL: 'https://11avatar-api.11avatardigitalhub.workers.dev/webhooks/whatsapp',
            
            // Same Firebase project
            firebaseProjectId: 'avatar-wa-dual-crm',
            firebaseAppId: '1:946959261009:web:175f5390d63715f1f8c770',
            
            // API version
            apiVersion: 'v2',
            
            // WebSocket for real-time
            wsEndpoint: 'wss://cloudwa.11avatardigitalhub.cloud/ws',
            
            // SSO Integration (shared auth)
            ssoEnabled: true,
            sharedAuthDomain: '11avatardigitalhub.cloud'
        };
        
        // WhatsApp Business API Configuration
        this.wabaConfig = {
            phoneNumberId: null,
            businessAccountId: null,
            accessToken: null,
            webhookVerifyToken: null,
            displayName: null,
            status: 'disconnected', // disconnected, connecting, connected, error
            qrCode: null,
            lastSeen: null
        };
        
        // Connection State
        this.connectionState = {
            isConnected: false,
            isAuthenticated: false,
            isSyncing: false,
            lastSyncTimestamp: null,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 3000, // 3 seconds base delay
            websocket: null,
            syncInProgress: false
        };
        
        // Message Store
        this.messages = new Map();
        this.activeChats = new Map();
        this.templates = [];
        this.quickReplies = [];
        
        // Chat State
        this.activeChatId = null;
        this.unreadCount = 0;
        this.isTyping = false;
        this.typingTimeout = null;
        
        // Message Queue (offline support)
        this.messageQueue = [];
        this.queueProcessing = false;
        
        // Templates & Automation
        this.messageTemplates = [];
        this.automationRules = [];
        this.broadcastLists = [];
        
        // Pagination
        this.pagination = {
            chatsPage: 1,
            chatsLimit: 30,
            messagesPage: 1,
            messagesLimit: 50,
            hasMore: true
        };
        
        // Filters
        this.filters = {
            chatType: 'all', // all, unread, archived, starred
            search: '',
            dateRange: null,
            tags: [],
            assignedTo: 'all'
        };
        
        // Performance
        this.performance = {
            messageCount: 0,
            messagesSent: 0,
            messagesReceived: 0,
            averageResponseTime: 0,
            lastActivity: null
        };
        
        // DOM References
        this.elements = {
            container: null,
            chatList: null,
            chatWindow: null,
            messageInput: null,
            sendButton: null,
            templateButton: null,
            attachmentButton: null,
            searchChats: null,
            filterTabs: null,
            connectionStatus: null,
            qrScanner: null,
            syncIndicator: null
        };
        
        // Audio notifications
        this.sounds = {
            messageReceived: null,
            messageSent: null
        };
        
        // Initialize module
        this.init();
    }
    
    /**
     * Initialize WhatsApp module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[WhatsApp] Initializing WhatsApp integration module...');
            console.log('[WhatsApp] CloudWA URL:', this.cloudWAConfig.baseURL);
            console.log('[WhatsApp] Firebase Project:', this.cloudWAConfig.firebaseProjectId);
            
            // Check permissions
            const canAccess = await Permissions.check('whatsapp', 'read');
            if (!canAccess) {
                Toast.show('Access denied: WhatsApp module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM elements
            this.cacheDOM();
            
            // Initialize audio
            this.initAudio();
            
            // Load CloudWA configuration
            await this.loadCloudWAConfig();
            
            // Authenticate with CloudWA
            await this.authenticateWithCloudWA();
            
            // Connect to WhatsApp
            await this.connectWhatsApp();
            
            // Load templates
            await this.loadTemplates();
            
            // Load automation rules
            await this.loadAutomationRules();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up WebSocket connection
            this.setupWebSocket();
            
            // Load initial chats
            await this.loadChats();
            
            // Render UI
            await this.render();
            
            // Start sync interval
            this.startSyncInterval();
            
            const loadTime = performance.now() - startTime;
            console.log(`[WhatsApp] Initialized in ${loadTime.toFixed(2)}ms`);
            
            // Emit ready event
            EventBus.emit('whatsapp:ready', {
                connected: this.connectionState.isConnected,
                wabaStatus: this.wabaConfig.status
            });
            
        } catch (error) {
            console.error('[WhatsApp] Initialization failed:', error);
            Toast.show('WhatsApp connection failed. Check CloudWA settings.', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#whatsapp-container',
                chatList: '#wa-chat-list',
                chatWindow: '#wa-chat-window',
                messageInput: '#wa-message-input',
                sendButton: '#wa-send-btn',
                templateButton: '#wa-template-btn',
                attachmentButton: '#wa-attachment-btn',
                searchChats: '#wa-search-chats',
                filterTabs: '#wa-filter-tabs',
                connectionStatus: '#wa-connection-status',
                qrScanner: '#wa-qr-scanner',
                syncIndicator: '#wa-sync-indicator'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[WhatsApp] DOM elements cached');
            
        } catch (error) {
            console.error('[WhatsApp] DOM cache failed:', error);
        }
    }
    
    /**
     * Initialize audio notifications
     */
    initAudio() {
        try {
            this.sounds.messageReceived = new Audio('/sounds/message-received.mp3');
            this.sounds.messageSent = new Audio('/sounds/message-sent.mp3');
            
            // Preload sounds
            this.sounds.messageReceived.load();
            this.sounds.messageSent.load();
            
        } catch (error) {
            console.warn('[WhatsApp] Audio initialization failed:', error);
        }
    }
    
    /**
     * Load CloudWA configuration
     */
    async loadCloudWAConfig() {
        try {
            // Check cache
            const cached = await Cache.get(`${this.cachePrefix}cloudwa_config`);
            if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                this.wabaConfig = { ...this.wabaConfig, ...cached.data.wabaConfig };
                return;
            }
            
            // Fetch from CloudWA API
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/config`, {
                headers: {
                    'Authorization': `Bearer ${await this.getCloudWAToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`CloudWA config fetch failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.config) {
                this.wabaConfig = {
                    ...this.wabaConfig,
                    phoneNumberId: data.config.phoneNumberId,
                    businessAccountId: data.config.businessAccountId,
                    displayName: data.config.displayName,
                    status: data.config.status || 'disconnected'
                };
                
                // Cache configuration
                await Cache.set(`${this.cachePrefix}cloudwa_config`, {
                    wabaConfig: this.wabaConfig
                }, this.cacheTimeout);
            }
            
            console.log('[WhatsApp] CloudWA config loaded:', this.wabaConfig.displayName);
            
        } catch (error) {
            console.error('[WhatsApp] CloudWA config load failed:', error);
            // Will try to authenticate and get config
        }
    }
    
    /**
     * Get CloudWA authentication token
     * Uses shared Firebase auth from avatar-wa-dual-crm
     */
    async getCloudWAToken() {
        try {
            // Check if we have a cached token
            const cached = await Cache.get(`${this.cachePrefix}auth_token`);
            if (cached && Date.now() - cached.timestamp < 55 * 60 * 1000) { // 55 minutes
                return cached.data.token;
            }
            
            // Get Firebase ID token (shared auth)
            const currentUser = window.firebase?.auth()?.currentUser;
            if (!currentUser) {
                throw new Error('Not authenticated with Firebase');
            }
            
            const firebaseToken = await currentUser.getIdToken(true);
            
            // Exchange Firebase token for CloudWA token (SSO)
            const response = await fetch(`${this.cloudWAConfig.loginURL}/api/sso/exchange`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firebaseToken: firebaseToken,
                    projectId: this.cloudWAConfig.firebaseProjectId,
                    appId: this.cloudWAConfig.firebaseAppId
                })
            });
            
            if (!response.ok) {
                throw new Error('Token exchange failed');
            }
            
            const data = await response.json();
            
            // Cache the token
            await Cache.set(`${this.cachePrefix}auth_token`, {
                token: data.accessToken
            }, 55 * 60 * 1000); // 55 minutes cache
            
            return data.accessToken;
            
        } catch (error) {
            console.error('[WhatsApp] Token retrieval failed:', error);
            
            // Redirect to CloudWA login if needed
            this.redirectToCloudWALogin();
            throw error;
        }
    }
    
    /**
     * Authenticate with CloudWA using SSO
     */
    async authenticateWithCloudWA() {
        try {
            console.log('[WhatsApp] Authenticating with CloudWA via SSO...');
            
            const token = await this.getCloudWAToken();
            
            // Verify authentication
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Authentication verification failed');
            }
            
            const data = await response.json();
            
            if (data.authenticated) {
                this.connectionState.isAuthenticated = true;
                console.log('[WhatsApp] SSO authentication successful');
                console.log('[WhatsApp] CloudWA User:', data.user?.email);
                
                // Update WABA config with authenticated user data
                if (data.wabaConfig) {
                    this.wabaConfig = { ...this.wabaConfig, ...data.wabaConfig };
                }
            } else {
                throw new Error('Not authenticated with CloudWA');
            }
            
        } catch (error) {
            console.error('[WhatsApp] Authentication failed:', error);
            this.connectionState.isAuthenticated = false;
            
            // Show CloudWA login option
            this.showCloudWALoginPrompt();
        }
    }
    
    /**
     * Redirect to CloudWA login
     */
    redirectToCloudWALogin() {
        try {
            const returnUrl = encodeURIComponent(window.location.href);
            const loginUrl = `${this.cloudWAConfig.loginURL}?returnUrl=${returnUrl}&sso=true&projectId=${this.cloudWAConfig.firebaseProjectId}`;
            
            console.log('[WhatsApp] Redirecting to CloudWA login:', loginUrl);
            
            // Show modal with login option
            const modal = new Modal({
                title: 'CloudWA Login Required',
                content: `
                    <div class="cloudwa-login-prompt">
                        <div class="cloudwa-logo">
                            <img src="/assets/cloudwa-logo.png" alt="CloudWA" style="height: 60px;">
                        </div>
                        <h3>Connect Your WhatsApp</h3>
                        <p>You need to login to CloudWA to manage your WhatsApp communications.</p>
                        <p class="text-muted">Your Firebase account will be used for Single Sign-On.</p>
                        <div class="action-buttons">
                            <a href="${loginUrl}" class="btn btn-primary" target="_blank">
                                <i class="fab fa-whatsapp"></i> Login to CloudWA
                            </a>
                            <button class="btn btn-outline" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                        </div>
                    </div>
                `,
                size: 'medium'
            });
            
            modal.open();
            
        } catch (error) {
            console.error('[WhatsApp] Redirect failed:', error);
        }
    }
    
    /**
     * Show CloudWA login prompt
     */
    showCloudWALoginPrompt() {
        this.redirectToCloudWALogin();
    }
    
    /**
     * Connect to WhatsApp via CloudWA
     */
    async connectWhatsApp() {
        try {
            console.log('[WhatsApp] Connecting to WhatsApp...');
            
            this.connectionState.isConnected = false;
            this.wabaConfig.status = 'connecting';
            this.updateConnectionStatus();
            
            const token = await this.getCloudWAToken();
            
            // Request WhatsApp connection via CloudWA
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/whatsapp/connect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumberId: this.wabaConfig.phoneNumberId,
                    webhookURL: this.cloudWAConfig.webhookURL
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // Handle QR code needed
                if (response.status === 428 && errorData.qrCode) {
                    this.wabaConfig.qrCode = errorData.qrCode;
                    this.wabaConfig.status = 'qr_required';
                    this.showQRScanner();
                    return;
                }
                
                throw new Error(errorData.message || 'Connection failed');
            }
            
            const data = await response.json();
            
            if (data.connected) {
                this.connectionState.isConnected = true;
                this.wabaConfig.status = 'connected';
                this.wabaConfig.lastSeen = new Date().toISOString();
                
                console.log('[WhatsApp] Connected successfully');
                Toast.show('WhatsApp connected successfully', 'success');
            }
            
            this.updateConnectionStatus();
            
        } catch (error) {
            console.error('[WhatsApp] Connection failed:', error);
            this.wabaConfig.status = 'error';
            this.updateConnectionStatus();
            
            Toast.show('WhatsApp connection failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Show QR scanner for WhatsApp Web connection
     */
    showQRScanner() {
        try {
            const modal = new Modal({
                title: 'Scan QR Code with WhatsApp',
                content: `
                    <div class="qr-scanner-container">
                        <p>Open WhatsApp on your phone and scan this QR code to connect</p>
                        <div class="qr-code-display">
                            <img src="${this.wabaConfig.qrCode}" alt="WhatsApp QR Code" 
                                 style="max-width: 300px; height: auto;">
                        </div>
                        <p class="text-muted">
                            <i class="fas fa-info-circle"></i> 
                            Go to WhatsApp > Settings > Linked Devices > Link a Device
                        </p>
                        <div class="qr-actions">
                            <button class="btn btn-primary" onclick="window.Global.WhatsApp.checkConnection()">
                                <i class="fas fa-sync"></i> Check Connection
                            </button>
                            <button class="btn btn-outline" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                        </div>
                    </div>
                `,
                size: 'medium',
                onClose: () => {
                    // Start polling for connection status
                    this.pollConnectionStatus();
                }
            });
            
            modal.open();
            
            // Auto-poll for connection
            this.pollConnectionStatus();
            
        } catch (error) {
            console.error('[WhatsApp] QR scanner failed:', error);
        }
    }
    
    /**
     * Poll connection status after QR scan
     */
    async pollConnectionStatus() {
        try {
            const pollInterval = setInterval(async () => {
                const token = await this.getCloudWAToken();
                
                const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/whatsapp/status`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.status === 'connected') {
                        clearInterval(pollInterval);
                        this.connectionState.isConnected = true;
                        this.wabaConfig.status = 'connected';
                        this.updateConnectionStatus();
                        
                        Modal.close();
                        Toast.show('WhatsApp connected!', 'success');
                        
                        // Load chats
                        await this.loadChats();
                        await this.render();
                    }
                }
            }, 3000); // Poll every 3 seconds
            
            // Stop polling after 2 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
            }, 120000);
            
        } catch (error) {
            console.error('[WhatsApp] Connection polling failed:', error);
        }
    }
    
    /**
     * Check connection status manually
     */
    async checkConnection() {
        await this.connectWhatsApp();
    }
    
    /**
     * Set up WebSocket for real-time messaging
     */
    setupWebSocket() {
        try {
            if (!this.connectionState.isConnected) {
                console.log('[WhatsApp] WebSocket not set up - not connected');
                return;
            }
            
            // Close existing connection
            if (this.connectionState.websocket) {
                this.connectionState.websocket.close();
            }
            
            const token = await this.getCloudWAToken();
            const wsURL = `${this.cloudWAConfig.wsEndpoint}?token=${token}`;
            
            console.log('[WhatsApp] Connecting WebSocket:', wsURL);
            
            const ws = new WebSocket(wsURL);
            
            ws.onopen = () => {
                console.log('[WhatsApp] WebSocket connected');
                this.connectionState.reconnectAttempts = 0;
                
                // Send authentication
                ws.send(JSON.stringify({
                    type: 'auth',
                    token: token,
                    projectId: this.cloudWAConfig.firebaseProjectId
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('[WhatsApp] WebSocket message parse error:', error);
                }
            };
            
            ws.onerror = (error) => {
                console.error('[WhatsApp] WebSocket error:', error);
            };
            
            ws.onclose = (event) => {
                console.log('[WhatsApp] WebSocket closed:', event.code, event.reason);
                
                // Attempt reconnection
                if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
                    const delay = this.connectionState.reconnectDelay * 
                                 Math.pow(2, this.connectionState.reconnectAttempts);
                    
                    console.log(`[WhatsApp] Reconnecting in ${delay}ms...`);
                    
                    setTimeout(() => {
                        this.connectionState.reconnectAttempts++;
                        this.setupWebSocket();
                    }, delay);
                }
            };
            
            this.connectionState.websocket = ws;
            
        } catch (error) {
            console.error('[WhatsApp] WebSocket setup failed:', error);
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        try {
            switch (data.type) {
                case 'message':
                    this.handleIncomingMessage(data.message);
                    break;
                    
                case 'status':
                    this.handleMessageStatus(data);
                    break;
                    
                case 'presence':
                    this.handlePresenceUpdate(data);
                    break;
                    
                case 'typing':
                    this.handleTypingIndicator(data);
                    break;
                    
                case 'ack':
                    this.handleAcknowledgement(data);
                    break;
                    
                case 'error':
                    console.error('[WhatsApp] Server error:', data.error);
                    break;
                    
                default:
                    console.log('[WhatsApp] Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('[WhatsApp] Message handling failed:', error);
        }
    }
    
    /**
     * Handle incoming WhatsApp message
     */
    async handleIncomingMessage(message) {
        try {
            console.log('[WhatsApp] New message from:', message.from);
            
            // Format message
            const formattedMessage = {
                ...message,
                timestamp: message.timestamp || new Date().toISOString(),
                formattedTime: Formatters.time(message.timestamp),
                formattedDate: Formatters.date(message.timestamp),
                isOutgoing: false,
                status: 'received'
            };
            
            // Add to messages store
            this.messages.set(message.id, formattedMessage);
            
            // Update chat
            const chatId = message.chatId || message.from;
            if (this.activeChats.has(chatId)) {
                const chat = this.activeChats.get(chatId);
                chat.lastMessage = formattedMessage;
                chat.unreadCount = (chat.unreadCount || 0) + 1;
                chat.updatedAt = new Date().toISOString();
                
                this.activeChats.set(chatId, chat);
            }
            
            // Update performance metrics
            this.performance.messageCount++;
            this.performance.messagesReceived++;
            this.performance.lastActivity = new Date();
            
            // Play sound if not active chat
            if (chatId !== this.activeChatId) {
                this.playNotificationSound('received');
                this.unreadCount++;
            }
            
            // Update UI if this is the active chat
            if (chatId === this.activeChatId) {
                this.appendMessageToChat(formattedMessage);
                this.markChatAsRead(chatId);
            }
            
            // Update chat list
            this.updateChatList();
            
            // Emit event
            EventBus.emit('whatsapp:message:received', formattedMessage);
            
            // Check automation rules
            this.checkAutomationRules(formattedMessage);
            
        } catch (error) {
            console.error('[WhatsApp] Incoming message handling failed:', error);
        }
    }
    
    /**
     * Handle message status updates
     */
    handleMessageStatus(data) {
        try {
            const messageId = data.messageId;
            const status = data.status; // sent, delivered, read, failed
            
            if (this.messages.has(messageId)) {
                const message = this.messages.get(messageId);
                message.status = status;
                this.messages.set(messageId, message);
                
                // Update UI if visible
                this.updateMessageStatus(messageId, status);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Status update handling failed:', error);
        }
    }
    
    /**
     * Handle presence updates (online/offline/typing)
     */
    handlePresenceUpdate(data) {
        try {
            const chatId = data.chatId;
            const presence = data.presence; // online, offline, typing
            
            if (this.activeChats.has(chatId)) {
                const chat = this.activeChats.get(chatId);
                chat.presence = presence;
                chat.lastSeen = data.lastSeen;
                
                this.activeChats.set(chatId, chat);
                
                // Update UI
                this.updateChatPresence(chatId, presence);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Presence update failed:', error);
        }
    }
    
    /**
     * Handle typing indicator
     */
    handleTypingIndicator(data) {
        try {
            const chatId = data.chatId;
            const isTyping = data.typing;
            
            if (chatId === this.activeChatId) {
                this.showTypingIndicator(isTyping, data.displayName);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Typing indicator failed:', error);
        }
    }
    
    /**
     * Load chat list from CloudWA
     */
    async loadChats(page = 1) {
        try {
            console.log('[WhatsApp] Loading chats...');
            
            const token = await this.getCloudWAToken();
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.chatsLimit.toString(),
                filter: this.filters.chatType,
                search: this.filters.search
            });
            
            const response = await fetch(
                `${this.cloudWAConfig.apiEndpoint}/chats?${params.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Failed to load chats: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.chats) {
                this.activeChats.clear();
                
                data.chats.forEach(chat => {
                    const processedChat = {
                        ...chat,
                        lastMessageTime: Formatters.relativeTime(chat.lastMessage?.timestamp),
                        unreadCount: chat.unreadCount || 0,
                        isOnline: chat.presence === 'online',
                        formattedPhone: this.formatPhoneNumber(chat.phoneNumber)
                    };
                    
                    this.activeChats.set(chat.id, processedChat);
                });
                
                this.pagination.hasMore = data.hasMore || false;
                
                console.log(`[WhatsApp] Loaded ${this.activeChats.size} chats`);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Chat load failed:', error);
            Toast.show('Failed to load chats', 'error');
        }
    }
    
    /**
     * Load messages for a specific chat
     */
    async loadMessages(chatId, page = 1) {
        try {
            console.log(`[WhatsApp] Loading messages for chat: ${chatId}`);
            
            const token = await this.getCloudWAToken();
            const params = new URLSearchParams({
                chatId: chatId,
                page: page.toString(),
                limit: this.pagination.messagesLimit.toString()
            });
            
            const response = await fetch(
                `${this.cloudWAConfig.apiEndpoint}/messages?${params.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.messages) {
                // Clear existing messages for this chat if first page
                if (page === 1) {
                    // Remove old messages for this chat
                    for (const [msgId, msg] of this.messages) {
                        if (msg.chatId === chatId) {
                            this.messages.delete(msgId);
                        }
                    }
                }
                
                // Add new messages
                data.messages.forEach(msg => {
                    this.messages.set(msg.id, {
                        ...msg,
                        formattedTime: Formatters.time(msg.timestamp),
                        formattedDate: Formatters.date(msg.timestamp)
                    });
                });
                
                console.log(`[WhatsApp] Loaded ${data.messages.length} messages`);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Messages load failed:', error);
            Toast.show('Failed to load messages', 'error');
        }
    }
    
    /**
     * Send a WhatsApp message via CloudWA
     */
    async sendMessage(chatId, content, options = {}) {
        try {
            if (!this.connectionState.isConnected) {
                Toast.show('WhatsApp not connected', 'error');
                return;
            }
            
            // Prepare message
            const messageData = {
                chatId: chatId,
                content: content,
                type: options.type || 'text',
                timestamp: new Date().toISOString(),
                
                // Optional fields
                caption: options.caption,
                mediaUrl: options.mediaUrl,
                documentUrl: options.documentUrl,
                fileName: options.fileName,
                location: options.location,
                contact: options.contact,
                templateId: options.templateId,
                templateParams: options.templateParams
            };
            
            // If offline, queue message
            if (!navigator.onLine) {
                this.queueMessage(messageData);
                return;
            }
            
            const token = await this.getCloudWAToken();
            
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/messages/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Send failed');
            }
            
            const data = await response.json();
            
            // Add to messages
            const sentMessage = {
                id: data.messageId,
                chatId: chatId,
                content: content,
                type: messageData.type,
                timestamp: messageData.timestamp,
                isOutgoing: true,
                status: 'sent',
                formattedTime: Formatters.time(messageData.timestamp)
            };
            
            this.messages.set(data.messageId, sentMessage);
            
            // Update chat
            if (this.activeChats.has(chatId)) {
                const chat = this.activeChats.get(chatId);
                chat.lastMessage = sentMessage;
                chat.updatedAt = new Date().toISOString();
                this.activeChats.set(chatId, chat);
            }
            
            // Update performance
            this.performance.messageCount++;
            this.performance.messagesSent++;
            this.performance.lastActivity = new Date();
            
            // Play sound
            this.playNotificationSound('sent');
            
            // Update UI
            if (chatId === this.activeChatId) {
                this.appendMessageToChat(sentMessage);
            }
            this.updateChatList();
            
            // Emit event
            EventBus.emit('whatsapp:message:sent', sentMessage);
            
            return sentMessage;
            
        } catch (error) {
            console.error('[WhatsApp] Send failed:', error);
            Toast.show('Failed to send message: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Queue message for offline sending
     */
    queueMessage(messageData) {
        try {
            this.messageQueue.push({
                ...messageData,
                queuedAt: new Date().toISOString()
            });
            
            console.log('[WhatsApp] Message queued. Queue size:', this.messageQueue.length);
            Toast.show('Message queued for sending', 'info');
            
            // Save to persistent storage
            this.saveMessageQueue();
            
        } catch (error) {
            console.error('[WhatsApp] Message queue failed:', error);
        }
    }
    
    /**
     * Process message queue when back online
     */
    async processMessageQueue() {
        if (this.queueProcessing || this.messageQueue.length === 0) return;
        
        try {
            this.queueProcessing = true;
            console.log('[WhatsApp] Processing message queue...');
            
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue[0];
                
                try {
                    await this.sendMessage(message.chatId, message.content, message);
                    this.messageQueue.shift(); // Remove processed message
                } catch (error) {
                    console.error('[WhatsApp] Queue message failed:', error);
                    break; // Stop processing on error
                }
            }
            
            // Save updated queue
            this.saveMessageQueue();
            
            console.log('[WhatsApp] Queue processed. Remaining:', this.messageQueue.length);
            
        } catch (error) {
            console.error('[WhatsApp] Queue processing failed:', error);
        } finally {
            this.queueProcessing = false;
        }
    }
    
    /**
     * Save message queue to persistent storage
     */
    async saveMessageQueue() {
        try {
            await Cache.set(`${this.cachePrefix}message_queue`, {
                queue: this.messageQueue,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[WhatsApp] Queue save failed:', error);
        }
    }
    
    /**
     * Load message queue from storage
     */
    async loadMessageQueue() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}message_queue`);
            if (cached && cached.data && cached.data.queue) {
                this.messageQueue = cached.data.queue;
                console.log('[WhatsApp] Loaded message queue:', this.messageQueue.length);
            }
        } catch (error) {
            console.error('[WhatsApp] Queue load failed:', error);
        }
    }
    
    /**
     * Load message templates from CloudWA
     */
    async loadTemplates() {
        try {
            const token = await this.getCloudWAToken();
            
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load templates');
            }
            
            const data = await response.json();
            
            if (data.success && data.templates) {
                this.messageTemplates = data.templates;
                console.log('[WhatsApp] Loaded templates:', this.messageTemplates.length);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Templates load failed:', error);
        }
    }
    
    /**
     * Send template message
     */
    async sendTemplate(chatId, templateId, params = {}) {
        try {
            const template = this.messageTemplates.find(t => t.id === templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            
            // Replace template variables
            let content = template.content;
            Object.entries(params).forEach(([key, value]) => {
                content = content.replace(`{{${key}}}`, value);
            });
            
            return await this.sendMessage(chatId, content, {
                type: 'template',
                templateId: templateId,
                templateParams: params
            });
            
        } catch (error) {
            console.error('[WhatsApp] Template send failed:', error);
            Toast.show('Failed to send template', 'error');
        }
    }
    
    /**
     * Load automation rules
     */
    async loadAutomationRules() {
        try {
            const token = await this.getCloudWAToken();
            
            const response = await fetch(`${this.cloudWAConfig.apiEndpoint}/automation/rules`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.automationRules = data.rules || [];
                console.log('[WhatsApp] Loaded automation rules:', this.automationRules.length);
            }
            
        } catch (error) {
            console.error('[WhatsApp] Automation rules load failed:', error);
        }
    }
    
    /**
     * Check automation rules against incoming message
     */
    async checkAutomationRules(message) {
        try {
            for (const rule of this.automationRules) {
                if (!rule.enabled) continue;
                
                // Check if rule matches
                let matches = false;
                
                switch (rule.trigger) {
                    case 'keyword':
                        const keywords = rule.keywords || [];
                        matches = keywords.some(kw => 
                            message.content?.toLowerCase().includes(kw.toLowerCase())
                        );
                        break;
                        
                    case 'first_message':
                        matches = message.isFirstMessage;
                        break;
                        
                    case 'always':
                        matches = true;
                        break;
                        
                    case 'time_range':
                        const hour = new Date().getHours();
                        matches = hour >= rule.startHour && hour <= rule.endHour;
                        break;
                }
                
                if (matches) {
                    await this.executeAutomationRule(rule, message);
                }
            }
            
        } catch (error) {
            console.error('[WhatsApp] Automation check failed:', error);
        }
    }
    
    /**
     * Execute automation rule
     */
    async executeAutomationRule(rule, message) {
        try {
            console.log('[WhatsApp] Executing rule:', rule.name);
            
            switch (rule.action) {
                case 'send_template':
                    await this.sendTemplate(message.chatId, rule.templateId, {
                        name: message.senderName || 'there',
                        ...rule.templateParams
                    });
                    break;
                    
                case 'send_message':
                    await this.sendMessage(message.chatId, rule.message);
                    break;
                    
                case 'assign_agent':
                    // Assign chat to specific agent
                    await this.assignChat(message.chatId, rule.agentId);
                    break;
                    
                case 'add_tag':
                    // Add tag to contact
                    await this.addTagToContact(message.from, rule.tag);
                    break;
                    
                case 'create_lead':
                    // Create lead in CRM
                    await this.createLeadFromChat(message);
                    break;
            }
            
        } catch (error) {
            console.error('[WhatsApp] Rule execution failed:', error);
        }
    }
    
    /**
     * Create lead from WhatsApp chat
     */
    async createLeadFromChat(message) {
        try {
            const leadData = {
                source: 'whatsapp',
                phone: message.from,
                name: message.senderName || 'WhatsApp Contact',
                message: message.content,
                chatId: message.chatId,
                timestamp: message.timestamp
            };
            
            EventBus.emit('lead:create', leadData);
            console.log('[WhatsApp] Lead creation triggered');
            
        } catch (error) {
            console.error('[WhatsApp] Lead creation failed:', error);
        }
    }
    
    /**
     * Render WhatsApp interface
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            const html = `
                <div class="whatsapp-container">
                    <!-- Connection Status Bar -->
                    <div class="wa-connection-bar">
                        <div class="connection-status ${this.connectionState.isConnected ? 'connected' : 'disconnected'}">
                            <span class="status-dot"></span>
                            <span class="status-text">
                                ${this.connectionState.isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                            ${this.wabaConfig.displayName ? `
                                <span class="wa-display-name">| ${this.escapeHtml(this.wabaConfig.displayName)}</span>
                            ` : ''}
                        </div>
                        <div class="connection-actions">
                            ${!this.connectionState.isConnected ? `
                                <button class="btn btn-sm btn-primary" onclick="window.Global.WhatsApp.connectWhatsApp()">
                                    <i class="fab fa-whatsapp"></i> Connect
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline" onclick="window.Global.WhatsApp.openCloudWA()">
                                <i class="fas fa-external-link-alt"></i> CloudWA
                            </button>
                        </div>
                    </div>
                    
                    <!-- Main WhatsApp Layout -->
                    <div class="wa-main-layout">
                        <!-- Chat List Sidebar -->
                        <div class="wa-sidebar">
                            <div class="wa-sidebar-header">
                                <div class="wa-search-box">
                                    <i class="fas fa-search"></i>
                                    <input type="text" id="wa-search-chats" placeholder="Search chats..." 
                                           oninput="window.Global.WhatsApp.searchChats(this.value)">
                                </div>
                                <div class="wa-filter-tabs" id="wa-filter-tabs">
                                    <button class="filter-tab active" data-filter="all" 
                                            onclick="window.Global.WhatsApp.filterChats('all')">
                                        All
                                    </button>
                                    <button class="filter-tab" data-filter="unread" 
                                            onclick="window.Global.WhatsApp.filterChats('unread')">
                                        Unread ${this.unreadCount > 0 ? `(${this.unreadCount})` : ''}
                                    </button>
                                    <button class="filter-tab" data-filter="starred" 
                                            onclick="window.Global.WhatsApp.filterChats('starred')">
                                        Starred
                                    </button>
                                </div>
                            </div>
                            
                            <div class="wa-chat-list" id="wa-chat-list">
                                ${this.renderChatList()}
                            </div>
                        </div>
                        
                        <!-- Chat Window -->
                        <div class="wa-chat-window" id="wa-chat-window">
                            ${this.activeChatId ? this.renderActiveChat() : this.renderEmptyChat()}
                        </div>
                    </div>
                    
                    <!-- Template Panel (Slide-out) -->
                    <div class="wa-template-panel" id="wa-template-panel" style="display: none;">
                        <div class="panel-header">
                            <h4>Message Templates</h4>
                            <button onclick="window.Global.WhatsApp.toggleTemplatePanel()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="panel-body">
                            <div class="template-list">
                                ${this.renderTemplateList()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.elements.container.innerHTML = html;
            
            console.log('[WhatsApp] UI rendered');
            
        } catch (error) {
            console.error('[WhatsApp] Render failed:', error);
        }
    }
    
    /**
     * Render chat list
     */
    renderChatList() {
        if (this.activeChats.size === 0) {
            return `
                <div class="empty-chats">
                    <i class="fab fa-whatsapp"></i>
                    <p>No conversations yet</p>
                    ${!this.connectionState.isConnected ? `
                        <button class="btn btn-primary" onclick="window.Global.WhatsApp.connectWhatsApp()">
                            Connect WhatsApp
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        let html = '';
        
        this.activeChats.forEach((chat, chatId) => {
            const isActive = chatId === this.activeChatId;
            const hasUnread = chat.unreadCount > 0;
            
            html += `
                <div class="chat-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}" 
                     data-chat-id="${chatId}"
                     onclick="window.Global.WhatsApp.openChat('${chatId}')">
                    <div class="chat-avatar">
                        <img src="${chat.avatar || '/assets/default-avatar.png'}" alt="${this.escapeHtml(chat.name)}">
                        ${chat.isOnline ? '<span class="online-dot"></span>' : ''}
                    </div>
                    <div class="chat-info">
                        <div class="chat-name-row">
                            <span class="chat-name">${this.escapeHtml(chat.name || chat.formattedPhone)}</span>
                            <span class="chat-time">${chat.lastMessageTime || ''}</span>
                        </div>
                        <div class="chat-preview-row">
                            <span class="chat-preview">${this.escapeHtml(chat.lastMessage?.content?.substring(0, 50) || '')}</span>
                            ${hasUnread ? `
                                <span class="unread-badge">${chat.unreadCount}</span>
                            ` : ''}
                        </div>
                        ${chat.tags?.length > 0 ? `
                            <div class="chat-tags">
                                ${chat.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Open a chat
     */
    async openChat(chatId) {
        try {
            this.activeChatId = chatId;
            
            // Mark as read
            await this.markChatAsRead(chatId);
            
            // Load messages if not loaded
            await this.loadMessages(chatId);
            
            // Update UI
            await this.render();
            
            // Scroll to bottom
            setTimeout(() => {
                this.scrollToBottom();
            }, 100);
            
        } catch (error) {
            console.error('[WhatsApp] Chat open failed:', error);
        }
    }
    
    /**
     * Open CloudWA dashboard in new tab
     */
    openCloudWA() {
        window.open(this.cloudWAConfig.baseURL, '_blank');
    }
    
    /**
     * Play notification sound
     */
    playNotificationSound(type) {
        try {
            const sound = type === 'received' ? 
                this.sounds.messageReceived : 
                this.sounds.messageSent;
            
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(() => {
                    // Browser may block autoplay
                });
            }
        } catch (error) {
            // Silently fail - audio is non-critical
        }
    }
    
    /**
     * Format phone number for display
     */
    formatPhoneNumber(phone) {
        if (!phone) return '';
        
        // Remove non-digits
        const cleaned = phone.replace(/\D/g, '');
        
        // Indian number formatting
        if (cleaned.length === 10) {
            return `+91 ${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
        } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
            return `+91 ${cleaned.substring(2, 7)} ${cleaned.substring(7)}`;
        }
        
        return phone;
    }
    
    /**
     * Start sync interval for real-time updates
     */
    startSyncInterval() {
        setInterval(async () => {
            if (this.connectionState.isConnected && !this.connectionState.isSyncing) {
                this.connectionState.isSyncing = true;
                
                try {
                    await this.loadChats();
                    
                    if (this.activeChatId) {
                        await this.loadMessages(this.activeChatId);
                    }
                    
                    this.updateChatList();
                } catch (error) {
                    console.error('[WhatsApp] Sync failed:', error);
                } finally {
                    this.connectionState.isSyncing = false;
                }
            }
        }, 15000); // Sync every 15 seconds
    }
    
    /**
     * Update connection status indicator
     */
    updateConnectionStatus() {
        const statusElement = document.querySelector('.wa-connection-bar .connection-status');
        if (statusElement) {
            statusElement.className = `connection-status ${this.connectionState.isConnected ? 'connected' : 'disconnected'}`;
            const statusText = statusElement.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = this.connectionState.isConnected ? 'Connected' : 'Disconnected';
            }
        }
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
     * Clean up on destroy
     */
    destroy() {
        // Close WebSocket
        if (this.connectionState.websocket) {
            this.connectionState.websocket.close();
        }
        
        // Clear intervals
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Remove event listeners
        EventBus.off('whatsapp:message:send');
        EventBus.off('whatsapp:template:send');
        
        console.log('[WhatsApp] Module destroyed');
    }
}

// Singleton instance
const whatsapp = new WhatsAppModule();

// Exports
export { whatsapp, WhatsAppModule };
export default whatsapp;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.WhatsApp = whatsapp;
}

