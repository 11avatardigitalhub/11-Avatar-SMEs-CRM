/**
 * 11 AVATAR DIGITAL HUB - Calendar Integration Module
 * Enterprise-grade calendar synchronization system
 * Google Calendar, Outlook, iCal integration with 2-way sync, meeting scheduling
 * 
 * @module CalendarIntegration
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
 * Calendar Integration - Handles all calendar provider integrations
 * Supports Google Calendar, Microsoft Outlook, Apple iCal with 2-way sync
 */
class CalendarIntegration {
    constructor() {
        // Module identity
        this.moduleName = 'calendar';
        this.apiEndpoint = '/api/calendar';
        this.cachePrefix = 'cal_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Calendar providers
        this.providers = {
            'google': {
                label: 'Google Calendar',
                icon: 'fa-google',
                color: '#4285F4',
                authURL: 'https://accounts.google.com/o/oauth2/auth',
                tokenURL: 'https://oauth2.googleapis.com/token',
                apiURL: 'https://www.googleapis.com/calendar/v3',
                scopes: [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/calendar.events'
                ],
                clientId: null, // Set from config
                enabled: true
            },
            'outlook': {
                label: 'Microsoft Outlook',
                icon: 'fa-microsoft',
                color: '#0078D4',
                authURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                apiURL: 'https://graph.microsoft.com/v1.0/me',
                scopes: [
                    'Calendars.ReadWrite',
                    'Calendars.ReadWrite.Shared',
                    'OnlineMeetings.ReadWrite'
                ],
                clientId: null,
                enabled: true
            },
            'apple': {
                label: 'Apple iCal',
                icon: 'fa-apple',
                color: '#555555',
                enabled: false,
                protocol: 'caldav'
            }
        };
        
        // Event types
        this.eventTypes = {
            'meeting': { label: 'Meeting', icon: 'fa-users', color: '#3B82F6' },
            'call': { label: 'Call', icon: 'fa-phone', color: '#10B981' },
            'follow_up': { label: 'Follow Up', icon: 'fa-undo', color: '#F59E0B' },
            'deadline': { label: 'Deadline', icon: 'fa-clock', color: '#DC2626' },
            'reminder': { label: 'Reminder', icon: 'fa-bell', color: '#8B5CF6' },
            'task': { label: 'Task Due', icon: 'fa-tasks', color: '#EC4899' },
            'personal': { label: 'Personal', icon: 'fa-user', color: '#6B7280' },
            'appointment': { label: 'Appointment', icon: 'fa-calendar-check', color: '#14B8A6' }
        };
        
        // Event status
        this.eventStatuses = {
            'confirmed': { label: 'Confirmed', color: '#10B981' },
            'tentative': { label: 'Tentative', color: '#F59E0B' },
            'cancelled': { label: 'Cancelled', color: '#DC2626' },
            'completed': { label: 'Completed', color: '#8B5CF6' }
        };
        
        // Recurrence patterns
        this.recurrencePatterns = {
            'none': { label: 'Does not repeat' },
            'daily': { label: 'Daily' },
            'weekly': { label: 'Weekly' },
            'biweekly': { label: 'Every 2 weeks' },
            'monthly': { label: 'Monthly' },
            'quarterly': { label: 'Quarterly' },
            'yearly': { label: 'Yearly' },
            'custom': { label: 'Custom...' }
        };
        
        // Module state
        this.connectedProviders = new Map();
        this.calendars = new Map(); // provider -> [calendars]
        this.events = new Map();
        this.selectedEventId = null;
        
        // Sync state
        this.syncState = {
            isSyncing: false,
            lastSyncTime: null,
            syncInterval: null,
            syncFrequency: 5 * 60 * 1000, // 5 minutes
            pendingChanges: [],
            conflictResolution: 'last_write_wins' // last_write_wins, manual
        };
        
        // Current view
        this.currentView = 'month'; // month, week, day, agenda, year
        this.currentDate = new Date();
        this.selectedDate = new Date();
        
        // Filters
        this.filters = {
            calendars: [], // selected calendar IDs
            eventTypes: [],
            search: '',
            dateRange: null,
            showCancelled: false,
            showCompleted: false
        };
        
        // Meeting scheduler
        this.meetingScheduler = {
            isOpen: false,
            duration: 30, // default 30 minutes
            bufferTime: 15, // 15 minutes buffer
            workingHours: {
                start: '09:00',
                end: '18:00'
            },
            workingDays: [1, 2, 3, 4, 5] // Mon-Fri
        };
        
        // Reminder defaults
        this.defaultReminders = [
            { type: 'email', minutes: 30 },
            { type: 'notification', minutes: 10 }
        ];
        
        // DOM references
        this.elements = {
            container: null,
            calendarGrid: null,
            eventList: null,
            eventModal: null,
            schedulerModal: null,
            providerList: null,
            syncStatus: null,
            dateNavigator: null
        };
        
        // Performance
        this.metrics = {
            totalEvents: 0,
            syncedEvents: 0,
            totalProviders: 0,
            lastSyncDuration: 0,
            syncErrors: 0
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize calendar integration
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Calendar] Initializing calendar integration...');
            
            // Check permissions
            const canAccess = await Permissions.check('calendar', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Calendar requires permissions', 'error');
                return;
            }
            
            // Load connected providers
            await this.loadProviders();
            
            // Load calendars
            await this.loadCalendars();
            
            // Load events
            await this.loadEvents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up auto-sync
            this.setupAutoSync();
            
            // Render if container exists
            if (document.getElementById('calendar-container')) {
                await this.render();
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`[Calendar] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('calendar:ready', {
                providers: this.connectedProviders.size,
                events: this.events.size
            });
            
        } catch (error) {
            console.error('[Calendar] Initialization failed:', error);
        }
    }
    
    /**
     * Load connected providers
     */
    async loadProviders() {
        try {
            const response = await API.get(`${this.apiEndpoint}/providers`);
            
            if (response.success && response.data) {
                this.connectedProviders.clear();
                response.data.forEach(provider => {
                    this.connectedProviders.set(provider.name, {
                        ...provider,
                        providerInfo: this.providers[provider.name],
                        connected: true,
                        connectedSince: Formatters.date(provider.connectedAt),
                        calendarsCount: provider.calendars?.length || 0
                    });
                });
                
                this.metrics.totalProviders = this.connectedProviders.size;
                console.log(`[Calendar] Loaded ${this.connectedProviders.size} providers`);
            }
            
        } catch (error) {
            console.error('[Calendar] Providers load failed:', error);
        }
    }
    
    /**
     * Load calendars from connected providers
     */
    async loadCalendars() {
        try {
            this.calendars.clear();
            
            for (const [providerName, provider] of this.connectedProviders) {
                const response = await API.get(`${this.apiEndpoint}/${providerName}/calendars`);
                
                if (response.success && response.data) {
                    this.calendars.set(providerName, response.data.map(cal => ({
                        ...cal,
                        providerName,
                        providerColor: this.providers[providerName]?.color,
                        selected: true
                    })));
                }
            }
            
            console.log(`[Calendar] Loaded calendars from ${this.calendars.size} providers`);
            
        } catch (error) {
            console.error('[Calendar] Calendars load failed:', error);
        }
    }
    
    /**
     * Load events
     */
    async loadEvents(dateRange = null) {
        try {
            const params = new URLSearchParams();
            
            if (dateRange) {
                params.set('start', dateRange.start.toISOString());
                params.set('end', dateRange.end.toISOString());
            } else {
                // Default: current month
                const start = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
                const end = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
                params.set('start', start.toISOString());
                params.set('end', end.toISOString());
            }
            
            // Add selected calendars
            const selectedCalendars = this.getSelectedCalendarIds();
            if (selectedCalendars.length > 0) {
                params.set('calendars', selectedCalendars.join(','));
            }
            
            const response = await API.get(`${this.apiEndpoint}/events?${params.toString()}`);
            
            if (response.success && response.data) {
                this.events.clear();
                
                response.data.forEach(event => {
                    this.events.set(event.id, {
                        ...event,
                        startDate: new Date(event.start),
                        endDate: new Date(event.end),
                        formattedStart: Formatters.date(event.start),
                        formattedStartTime: Formatters.time(event.start),
                        formattedEndTime: Formatters.time(event.end),
                        isAllDay: event.isAllDay || false,
                        isMultiDay: this.isMultiDayEvent(event),
                        isRecurring: !!event.recurrence,
                        eventTypeInfo: this.eventTypes[event.type] || this.eventTypes.meeting,
                        statusInfo: this.eventStatuses[event.status] || this.eventStatuses.confirmed,
                        providerInfo: this.providers[event.provider],
                        canEdit: event.provider !== 'apple' || event.isOwner,
                        canDelete: event.status !== 'cancelled'
                    });
                });
                
                this.metrics.totalEvents = this.events.size;
                this.metrics.syncedEvents = response.data.filter(e => e.synced).length;
                
                console.log(`[Calendar] Loaded ${this.events.size} events`);
            }
            
        } catch (error) {
            console.error('[Calendar] Events load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('calendar:connect-provider', this.connectProvider.bind(this));
            EventBus.on('calendar:disconnect-provider', this.disconnectProvider.bind(this));
            EventBus.on('calendar:create-event', this.createEvent.bind(this));
            EventBus.on('calendar:update-event', this.updateEvent.bind(this));
            EventBus.on('calendar:delete-event', this.deleteEvent.bind(this));
            EventBus.on('calendar:sync', this.syncAll.bind(this));
            EventBus.on('calendar:schedule-meeting', this.openMeetingScheduler.bind(this));
            
            // Listen for related CRM events
            EventBus.on('task:created', (task) => {
                if (task.dueDate) {
                    this.createEventFromTask(task);
                }
            });
            
            EventBus.on('deal:stage-changed', (data) => {
                if (data.newStage === 'qualified') {
                    this.suggestFollowUpMeeting(data);
                }
            });
            
            console.log('[Calendar] Event listeners initialized');
            
        } catch (error) {
            console.error('[Calendar] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up auto-sync
     */
    setupAutoSync() {
        if (this.syncState.syncInterval) {
            clearInterval(this.syncState.syncInterval);
        }
        
        this.syncState.syncInterval = setInterval(async () => {
            await this.syncAll();
        }, this.syncState.syncFrequency);
        
        console.log('[Calendar] Auto-sync configured (5 min interval)');
    }
    
    /**
     * Connect to a calendar provider
     */
    async connectProvider(providerName) {
        try {
            const provider = this.providers[providerName];
            if (!provider) throw new Error('Unknown provider');
            
            if (!provider.enabled) {
                Toast.show(`${provider.label} integration is not available`, 'warning');
                return;
            }
            
            Toast.show(`Connecting to ${provider.label}...`, 'info');
            
            // For OAuth providers, open auth window
            if (providerName === 'google' || providerName === 'outlook') {
                await this.oauthConnect(providerName);
            } else if (providerName === 'apple') {
                await this.caldavConnect();
            }
            
        } catch (error) {
            console.error('[Calendar] Provider connection failed:', error);
            Toast.show('Connection failed: ' + error.message, 'error');
        }
    }
    
    /**
     * OAuth connection flow
     */
    async oauthConnect(providerName) {
        try {
            const provider = this.providers[providerName];
            
            // Get auth URL from server
            const response = await API.get(`${this.apiEndpoint}/auth-url`, {
                provider: providerName
            });
            
            if (!response.success) throw new Error('Failed to get auth URL');
            
            // Open OAuth popup
            const width = 600;
            const height = 700;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            const popup = window.open(
                response.data.url,
                'CalendarAuth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Listen for auth completion
            const authPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Authentication timed out'));
                }, 120000); // 2 minutes
                
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'calendar-auth-success') {
                        clearTimeout(timeout);
                        resolve(event.data);
                    } else if (event.data.type === 'calendar-auth-error') {
                        clearTimeout(timeout);
                        reject(new Error(event.data.error));
                    }
                });
            });
            
            const authResult = await authPromise;
            
            // Save provider connection
            await API.post(`${this.apiEndpoint}/connect`, {
                provider: providerName,
                code: authResult.code
            });
            
            // Reload providers and calendars
            await this.loadProviders();
            await this.loadCalendars();
            
            Toast.show(`${provider.label} connected successfully`, 'success');
            
            // Initial sync
            await this.syncAll();
            
        } catch (error) {
            console.error('[Calendar] OAuth connection failed:', error);
            throw error;
        }
    }
    
    /**
     * CalDAV connection for Apple Calendar
     */
    async caldavConnect() {
        try {
            const formHtml = `
                <div class="caldav-form">
                    <form id="caldav-connect-form">
                        <div class="form-group">
                            <label>CalDAV Server URL</label>
                            <input type="url" name="serverUrl" placeholder="https://caldav.icloud.com" required>
                        </div>
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>App-Specific Password</label>
                            <input type="password" name="password" required>
                            <small>Use an app-specific password for security</small>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Connect</button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Connect Apple Calendar',
                content: formHtml,
                size: 'medium'
            });
            
            modal.open();
            
            setTimeout(() => {
                const form = document.getElementById('caldav-connect-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const formData = new FormData(form);
                        
                        await API.post(`${this.apiEndpoint}/connect`, {
                            provider: 'apple',
                            serverUrl: formData.get('serverUrl'),
                            username: formData.get('username'),
                            password: formData.get('password')
                        });
                        
                        Modal.close();
                        Toast.show('Apple Calendar connected', 'success');
                        await this.loadProviders();
                        await this.loadCalendars();
                        await this.syncAll();
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('[Calendar] CalDAV connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Disconnect a calendar provider
     */
    async disconnectProvider(providerName) {
        try {
            const confirmed = await this.confirmDialog(
                'Disconnect Calendar',
                `Are you sure you want to disconnect ${this.providers[providerName]?.label}?`
            );
            
            if (!confirmed) return;
            
            await API.delete(`${this.apiEndpoint}/providers/${providerName}`);
            
            this.connectedProviders.delete(providerName);
            this.calendars.delete(providerName);
            
            // Remove events from this provider
            for (const [eventId, event] of this.events) {
                if (event.provider === providerName) {
                    this.events.delete(eventId);
                }
            }
            
            Toast.show('Calendar disconnected', 'info');
            
            EventBus.emit('calendar:provider-disconnected', { provider: providerName });
            
        } catch (error) {
            console.error('[Calendar] Disconnect failed:', error);
            Toast.show('Failed to disconnect', 'error');
        }
    }
    
    /**
     * Create a calendar event
     */
    async createEvent(eventData) {
        try {
            const event = {
                title: eventData.title,
                description: eventData.description || '',
                start: eventData.start,
                end: eventData.end,
                isAllDay: eventData.isAllDay || false,
                location: eventData.location || '',
                type: eventData.type || 'meeting',
                status: eventData.status || 'confirmed',
                attendees: eventData.attendees || [],
                reminders: eventData.reminders || this.defaultReminders,
                recurrence: eventData.recurrence || null,
                calendarId: eventData.calendarId,
                provider: eventData.provider,
                color: eventData.color || '#3B82F6',
                linkedEntity: eventData.linkedEntity || null, // { type: 'deal'|'task'|'client', id: '' }
                notes: eventData.notes || ''
            };
            
            const response = await API.post(`${this.apiEndpoint}/events`, event);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to create event');
            }
            
            // Add to local store
            const newEvent = {
                ...response.data,
                startDate: new Date(response.data.start),
                endDate: new Date(response.data.end),
                formattedStart: Formatters.date(response.data.start),
                formattedStartTime: Formatters.time(response.data.start),
                formattedEndTime: Formatters.time(response.data.end),
                eventTypeInfo: this.eventTypes[event.type],
                statusInfo: this.eventStatuses[event.status],
                canEdit: true,
                canDelete: true
            };
            
            this.events.set(newEvent.id, newEvent);
            
            // Send notifications if attendees
            if (event.attendees.length > 0) {
                EventBus.emit('notification:send', {
                    category: 'system',
                    priority: 'normal',
                    title: 'New Meeting: ' + event.title,
                    message: `Scheduled for ${newEvent.formattedStart} at ${newEvent.formattedStartTime}`,
                    channels: ['email']
                });
            }
            
            EventBus.emit('calendar:event-created', newEvent);
            
            return newEvent;
            
        } catch (error) {
            console.error('[Calendar] Event creation failed:', error);
            Toast.show('Failed to create event', 'error');
            return null;
        }
    }
    
    /**
     * Update an existing event
     */
    async updateEvent(eventId, updates) {
        try {
            const event = this.events.get(eventId);
            if (!event) throw new Error('Event not found');
            
            const response = await API.put(`${this.apiEndpoint}/events/${eventId}`, updates);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Update local store
            const updatedEvent = { ...event, ...response.data };
            this.events.set(eventId, updatedEvent);
            
            EventBus.emit('calendar:event-updated', updatedEvent);
            
            return updatedEvent;
            
        } catch (error) {
            console.error('[Calendar] Event update failed:', error);
            Toast.show('Failed to update event', 'error');
            return null;
        }
    }
    
    /**
     * Delete an event
     */
    async deleteEvent(eventId) {
        try {
            const event = this.events.get(eventId);
            if (!event) throw new Error('Event not found');
            
            const confirmed = await this.confirmDialog(
                'Delete Event',
                `Delete "${event.title}"? This cannot be undone.`
            );
            
            if (!confirmed) return;
            
            await API.delete(`${this.apiEndpoint}/events/${eventId}`);
            
            this.events.delete(eventId);
            
            Toast.show('Event deleted', 'info');
            EventBus.emit('calendar:event-deleted', { eventId });
            
        } catch (error) {
            console.error('[Calendar] Event deletion failed:', error);
            Toast.show('Failed to delete event', 'error');
        }
    }
    
    /**
     * Sync all calendars
     */
    async syncAll() {
        if (this.syncState.isSyncing) return;
        
        try {
            this.syncState.isSyncing = true;
            const startTime = performance.now();
            
            console.log('[Calendar] Starting sync...');
            
            const response = await API.post(`${this.apiEndpoint}/sync`);
            
            if (response.success) {
                this.syncState.lastSyncTime = new Date();
                this.metrics.lastSyncDuration = performance.now() - startTime;
                this.metrics.syncErrors = response.data.errors || 0;
                
                console.log(`[Calendar] Sync completed in ${this.metrics.lastSyncDuration}ms`);
                
                // Reload events if changes detected
                if (response.data.changes > 0) {
                    await this.loadEvents();
                }
            }
            
        } catch (error) {
            console.error('[Calendar] Sync failed:', error);
            this.metrics.syncErrors++;
        } finally {
            this.syncState.isSyncing = false;
        }
    }
    
    /**
     * Open meeting scheduler
     */
    async openMeetingScheduler(options = {}) {
        try {
            const schedulerHtml = `
                <div class="meeting-scheduler">
                    <div class="scheduler-header">
                        <h4><i class="fas fa-calendar-plus"></i> Schedule Meeting</h4>
                    </div>
                    
                    <form id="meeting-scheduler-form">
                        <div class="form-row">
                            <div class="form-group col-8">
                                <label for="meeting-title">Meeting Title *</label>
                                <input type="text" id="meeting-title" name="title" required 
                                       value="${options.title || ''}" placeholder="Enter meeting title">
                            </div>
                            <div class="form-group col-4">
                                <label for="meeting-duration">Duration (minutes)</label>
                                <select id="meeting-duration" name="duration">
                                    <option value="15">15 min</option>
                                    <option value="30" selected>30 min</option>
                                    <option value="45">45 min</option>
                                    <option value="60">1 hour</option>
                                    <option value="90">1.5 hours</option>
                                    <option value="120">2 hours</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label for="meeting-date">Date *</label>
                                <input type="date" id="meeting-date" name="date" required 
                                       value="${options.date || Formatters.dateInput(new Date())}">
                            </div>
                            <div class="form-group col-3">
                                <label for="meeting-start">Start Time *</label>
                                <input type="time" id="meeting-start" name="startTime" required value="10:00">
                            </div>
                            <div class="form-group col-3">
                                <label for="meeting-end">End Time</label>
                                <input type="time" id="meeting-end" name="endTime" readonly>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="meeting-attendees">Attendees (email)</label>
                            <input type="text" id="meeting-attendees" name="attendees" 
                                   placeholder="email1@example.com, email2@example.com"
                                   value="${options.attendees || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="meeting-location">Location / Video Link</label>
                            <input type="text" id="meeting-location" name="location" 
                                   placeholder="Physical location or video conference link"
                                   value="${options.location || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="meeting-description">Description</label>
                            <textarea id="meeting-description" name="description" rows="3" 
                                      placeholder="Meeting agenda...">${options.description || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label for="meeting-type">Meeting Type</label>
                                <select id="meeting-type" name="type">
                                    ${Object.entries(this.eventTypes).map(([key, type]) => `
                                        <option value="${key}">${type.label}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group col-6">
                                <label>Reminders</label>
                                <label class="toggle-check">
                                    <input type="checkbox" name="emailReminder" checked>
                                    Email reminder (30 min before)
                                </label>
                                <label class="toggle-check">
                                    <input type="checkbox" name="pushReminder" checked>
                                    Push notification (10 min before)
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-check"></i> Schedule Meeting
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Schedule Meeting',
                content: schedulerHtml,
                size: 'large'
            });
            
            modal.open();
            
            // Set up form handlers
            setTimeout(() => {
                this.setupSchedulerForm(options);
            }, 100);
            
        } catch (error) {
            console.error('[Calendar] Scheduler open failed:', error);
        }
    }
    
    /**
     * Set up scheduler form handlers
     */
    setupSchedulerForm(options = {}) {
        const form = document.getElementById('meeting-scheduler-form');
        if (!form) return;
        
        // Update end time when start time or duration changes
        const startInput = document.getElementById('meeting-start');
        const durationSelect = document.getElementById('meeting-duration');
        const endInput = document.getElementById('meeting-end');
        
        const updateEndTime = () => {
            const start = startInput?.value;
            const duration = parseInt(durationSelect?.value) || 30;
            
            if (start && endInput) {
                const [hours, minutes] = start.split(':').map(Number);
                const totalMinutes = hours * 60 + minutes + duration;
                const endHours = Math.floor(totalMinutes / 60) % 24;
                const endMinutes = totalMinutes % 60;
                
                endInput.value = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
            }
        };
        
        startInput?.addEventListener('change', updateEndTime);
        durationSelect?.addEventListener('change', updateEndTime);
        
        // Initial update
        updateEndTime();
        
        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const date = formData.get('date');
            const startTime = formData.get('startTime');
            const endTime = formData.get('endTime');
            
            const eventData = {
                title: formData.get('title'),
                start: new Date(`${date}T${startTime}:00`).toISOString(),
                end: new Date(`${date}T${endTime}:00`).toISOString(),
                duration: parseInt(formData.get('duration')),
                attendees: formData.get('attendees').split(',').map(e => e.trim()).filter(Boolean),
                location: formData.get('location'),
                description: formData.get('description'),
                type: formData.get('type'),
                reminders: []
            };
            
            if (formData.get('emailReminder') === 'on') {
                eventData.reminders.push({ type: 'email', minutes: 30 });
            }
            if (formData.get('pushReminder') === 'on') {
                eventData.reminders.push({ type: 'notification', minutes: 10 });
            }
            
            // Add linked entity if available
            if (options.linkedEntity) {
                eventData.linkedEntity = options.linkedEntity;
            }
            
            const result = await this.createEvent(eventData);
            
            if (result) {
                Modal.close();
                Toast.show('Meeting scheduled successfully', 'success');
            }
        });
    }
    
    /**
     * Create calendar event from task
     */
    async createEventFromTask(task) {
        try {
            const eventData = {
                title: `Task Due: ${task.title}`,
                description: task.description || '',
                start: new Date(task.dueDate + 'T09:00:00').toISOString(),
                end: new Date(task.dueDate + 'T10:00:00').toISOString(),
                type: 'task',
                linkedEntity: { type: 'task', id: task.id },
                notes: `Priority: ${task.priority}`
            };
            
            await this.createEvent(eventData);
            
        } catch (error) {
            console.error('[Calendar] Task event creation failed:', error);
        }
    }
    
    /**
     * Suggest follow-up meeting when deal stage changes
     */
    async suggestFollowUpMeeting(data) {
        try {
            const today = new Date();
            const suggestedDate = new Date(today);
            suggestedDate.setDate(suggestedDate.getDate() + 2); // 2 days from now
            
            Toast.show('Schedule a follow-up meeting for this deal?', 'info', {
                action: 'Schedule',
                callback: () => {
                    this.openMeetingScheduler({
                        title: `Follow Up: ${data.dealName}`,
                        date: Formatters.dateInput(suggestedDate),
                        linkedEntity: { type: 'deal', id: data.dealId }
                    });
                }
            });
            
        } catch (error) {
            console.error('[Calendar] Follow-up suggestion failed:', error);
        }
    }
    
    /**
     * Get selected calendar IDs
     */
    getSelectedCalendarIds() {
        const ids = [];
        
        for (const [providerName, calendars] of this.calendars) {
            calendars.forEach(cal => {
                if (cal.selected) {
                    ids.push(cal.id);
                }
            });
        }
        
        return ids;
    }
    
    /**
     * Check if event spans multiple days
     */
    isMultiDayEvent(event) {
        if (!event.start || !event.end) return false;
        
        const start = new Date(event.start);
        const end = new Date(event.end);
        
        return start.toDateString() !== end.toDateString();
    }
    
    /**
     * Render calendar UI
     */
    async render(container = null) {
        try {
            const targetContainer = container || document.getElementById('calendar-container');
            if (!targetContainer) return;
            
            const html = `
                <div class="calendar-container">
                    <!-- Calendar Header -->
                    <div class="calendar-header">
                        <div class="header-left">
                            <h3><i class="fas fa-calendar-alt"></i> Calendar</h3>
                            <div class="date-navigator">
                                <button class="btn-icon" onclick="window.Global.Calendar.navigatePrevious()">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <span class="current-date">${this.getCurrentDateLabel()}</span>
                                <button class="btn-icon" onclick="window.Global.Calendar.navigateNext()">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Calendar.goToToday()">
                                    Today
                                </button>
                            </div>
                        </div>
                        <div class="header-right">
                            <div class="view-toggles">
                                ${['month', 'week', 'day', 'agenda'].map(view => `
                                    <button class="view-toggle ${this.currentView === view ? 'active' : ''}"
                                            onclick="window.Global.Calendar.switchView('${view}')">
                                        ${view.charAt(0).toUpperCase() + view.slice(1)}
                                    </button>
                                `).join('')}
                            </div>
                            <button class="btn btn-primary" onclick="window.Global.Calendar.openMeetingScheduler()">
                                <i class="fas fa-plus"></i> New Event
                            </button>
                        </div>
                    </div>
                    
                    <!-- Sync Status -->
                    <div class="sync-status-bar">
                        <span class="sync-indicator ${this.syncState.isSyncing ? 'syncing' : 'synced'}">
                            <i class="fas fa-sync ${this.syncState.isSyncing ? 'fa-spin' : ''}"></i>
                            ${this.syncState.isSyncing ? 'Syncing...' : 
                              this.syncState.lastSyncTime ? 
                              `Last synced: ${Formatters.relativeTime(this.syncState.lastSyncTime)}` : 
                              'Not synced'}
                        </span>
                        ${this.metrics.syncErrors > 0 ? `
                            <span class="sync-errors">
                                <i class="fas fa-exclamation-triangle"></i>
                                ${this.metrics.syncErrors} sync errors
                            </span>
                        ` : ''}
                    </div>
                    
                    <!-- Provider List -->
                    <div class="provider-list">
                        ${this.renderProviderList()}
                    </div>
                    
                    <!-- Calendar Grid -->
                    <div class="calendar-grid" id="calendar-grid">
                        ${this.renderCalendarGrid()}
                    </div>
                    
                    <!-- Event List (Agenda View) -->
                    ${this.currentView === 'agenda' ? `
                        <div class="event-list" id="event-list">
                            ${this.renderEventList()}
                        </div>
                    ` : ''}
                </div>
            `;
            
            targetContainer.innerHTML = html;
            
            console.log('[Calendar] UI rendered');
            
        } catch (error) {
            console.error('[Calendar] Render failed:', error);
        }
    }
    
    /**
     * Render provider list
     */
    renderProviderList() {
        return Object.entries(this.providers).map(([key, provider]) => {
            const isConnected = this.connectedProviders.has(key);
            
            return `
                <div class="provider-item ${isConnected ? 'connected' : ''}">
                    <i class="fab ${provider.icon}" style="color: ${provider.color}"></i>
                    <span>${provider.label}</span>
                    ${isConnected ? `
                        <span class="connected-badge">Connected</span>
                        <button class="btn-icon" onclick="window.Global.Calendar.disconnectProvider('${key}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Calendar.connectProvider('${key}')">
                            Connect
                        </button>
                    `}
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render calendar grid (simplified month view)
     */
    renderCalendarGrid() {
        if (this.currentView === 'agenda') return '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay(); // 0 = Sunday
        
        const daysInMonth = lastDay.getDate();
        const today = new Date();
        
        let html = '<div class="calendar-month-grid">';
        
        // Day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = date.toDateString() === this.selectedDate.toDateString();
            
            // Get events for this day
            const dayEvents = [];
            this.events.forEach(event => {
                const eventDate = new Date(event.start);
                if (eventDate.toDateString() === date.toDateString()) {
                    dayEvents.push(event);
                }
            });
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
                     onclick="window.Global.Calendar.selectDate('${dateStr}')">
                    <span class="day-number">${day}</span>
                    <div class="day-events">
                        ${dayEvents.slice(0, 3).map(event => `
                            <div class="day-event" style="background: ${event.eventTypeInfo.color}"
                                 onclick="event.stopPropagation(); window.Global.Calendar.openEventDetail('${event.id}')"
                                 title="${this.escapeHtml(event.title)}">
                                ${event.formattedStartTime} ${this.escapeHtml(event.title.substring(0, 20))}
                            </div>
                        `).join('')}
                        ${dayEvents.length > 3 ? `
                            <div class="more-events">+${dayEvents.length - 3} more</div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Render event list (agenda view)
     */
    renderEventList() {
        if (this.events.size === 0) {
            return '<div class="no-events">No events found</div>';
        }
        
        // Sort events by date
        const sortedEvents = Array.from(this.events.values())
            .sort((a, b) => new Date(a.start) - new Date(b.start));
        
        // Group by date
        const grouped = {};
        sortedEvents.forEach(event => {
            const dateKey = event.startDate.toDateString();
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(event);
        });
        
        return Object.entries(grouped).map(([dateKey, events]) => `
            <div class="event-group">
                <div class="event-group-date">${Formatters.date(events[0].start)}</div>
                ${events.map(event => `
                    <div class="event-item" onclick="window.Global.Calendar.openEventDetail('${event.id}')">
                        <div class="event-color-bar" style="background: ${event.eventTypeInfo.color}"></div>
                        <div class="event-time">
                            ${event.isAllDay ? 'All Day' : `${event.formattedStartTime} - ${event.formattedEndTime}`}
                        </div>
                        <div class="event-content">
                            <strong>${this.escapeHtml(event.title)}</strong>
                            ${event.location ? `
                                <small><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(event.location)}</small>
                            ` : ''}
                            ${event.attendees?.length > 0 ? `
                                <small><i class="fas fa-users"></i> ${event.attendees.length} attendees</small>
                            ` : ''}
                        </div>
                        <div class="event-type">
                            <span class="type-badge" style="background: ${event.eventTypeInfo.color}20; color: ${event.eventTypeInfo.color}">
                                ${event.eventTypeInfo.label}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }
    
    /**
     * Get current date label for header
     */
    getCurrentDateLabel() {
        const options = { month: 'long', year: 'numeric' };
        return this.currentDate.toLocaleDateString('en-US', options);
    }
    
    /**
     * Navigate to previous period
     */
    async navigatePrevious() {
        switch (this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() - 7);
                break;
            case 'day':
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                break;
        }
        
        await this.loadEvents();
        await this.render();
    }
    
    /**
     * Navigate to next period
     */
    async navigateNext() {
        switch (this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() + 7);
                break;
            case 'day':
                this.currentDate.setDate(this.currentDate.getDate() + 1);
                break;
        }
        
        await this.loadEvents();
        await this.render();
    }
    
    /**
     * Go to today
     */
    async goToToday() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        await this.loadEvents();
        await this.render();
    }
    
    /**
     * Switch view
     */
    async switchView(view) {
        this.currentView = view;
        await this.render();
    }
    
    /**
     * Select a date
     */
    selectDate(dateStr) {
        this.selectedDate = new Date(dateStr);
        this.render();
    }
    
    /**
     * Open event detail
     */
    openEventDetail(eventId) {
        const event = this.events.get(eventId);
        if (!event) return;
        
        // Emit event to open detail modal
        EventBus.emit('modal:open', {
            title: event.title,
            content: this.renderEventDetail(event),
            size: 'medium'
        });
    }
    
    /**
     * Render event detail HTML
     */
    renderEventDetail(event) {
        return `
            <div class="event-detail">
                <div class="event-header" style="border-left: 4px solid ${event.eventTypeInfo.color}">
                    <h4>${this.escapeHtml(event.title)}</h4>
                    <span class="type-badge" style="background: ${event.eventTypeInfo.color}20; color: ${event.eventTypeInfo.color}">
                        ${event.eventTypeInfo.label}
                    </span>
                </div>
                
                <div class="event-info-grid">
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <div>
                            <label>Date & Time</label>
                            <span>${event.formattedStart} ${event.formattedStartTime} - ${event.formattedEndTime}</span>
                        </div>
                    </div>
                    
                    ${event.location ? `
                        <div class="info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <div>
                                <label>Location</label>
                                <span>${this.escapeHtml(event.location)}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${event.attendees?.length > 0 ? `
                        <div class="info-item">
                            <i class="fas fa-users"></i>
                            <div>
                                <label>Attendees</label>
                                <span>${event.attendees.map(a => this.escapeHtml(a.email || a)).join(', ')}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${event.description ? `
                        <div class="info-item full-width">
                            <i class="fas fa-align-left"></i>
                            <div>
                                <label>Description</label>
                                <p>${this.escapeHtml(event.description)}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="event-actions">
                    ${event.canEdit ? `
                        <button class="btn btn-primary" onclick="window.Global.Calendar.editEvent('${event.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    ` : ''}
                    ${event.canDelete ? `
                        <button class="btn btn-danger" onclick="window.Global.Calendar.deleteEvent('${event.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Confirm dialog
     */
    confirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title,
                content: `
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary confirm-btn">Confirm</button>
                    </div>
                `,
                size: 'small',
                onClose: () => resolve(false)
            });
            
            modal.open();
            
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(false);
                });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(true);
                });
            }, 100);
        });
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
     * Clean up
     */
    destroy() {
        if (this.syncState.syncInterval) {
            clearInterval(this.syncState.syncInterval);
        }
        
        EventBus.off('calendar:connect-provider');
        EventBus.off('calendar:disconnect-provider');
        EventBus.off('calendar:create-event');
        EventBus.off('calendar:update-event');
        EventBus.off('calendar:delete-event');
        EventBus.off('calendar:sync');
        
        console.log('[Calendar] Module destroyed');
    }
}

// Singleton
const calendarIntegration = new CalendarIntegration();

// Exports
export { calendarIntegration, CalendarIntegration };
export default calendarIntegration;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Calendar = calendarIntegration;
}

