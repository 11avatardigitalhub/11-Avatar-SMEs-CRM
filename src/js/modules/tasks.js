/**
 * 11 AVATAR DIGITAL HUB - Tasks Module
 * Enterprise-grade task & project management system
 * Kanban, List, Calendar views with dependencies, subtasks, time tracking
 * 
 * @module Tasks
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
 * Tasks Module - Complete task lifecycle management
 * Handles creation, assignment, tracking, dependencies, time logging
 */
class TasksModule {
    constructor() {
        // Module identity
        this.moduleName = 'tasks';
        this.apiEndpoint = '/api/tasks';
        this.cachePrefix = 'task_';
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Task priority definitions
        this.priorities = {
            'critical': { 
                label: 'Critical', 
                color: '#DC2626', 
                icon: 'fa-exclamation-circle',
                weight: 5,
                sla: 4 // hours
            },
            'high': { 
                label: 'High', 
                color: '#F97316', 
                icon: 'fa-arrow-up',
                weight: 4,
                sla: 8
            },
            'medium': { 
                label: 'Medium', 
                color: '#F59E0B', 
                icon: 'fa-minus',
                weight: 3,
                sla: 24
            },
            'low': { 
                label: 'Low', 
                color: '#3B82F6', 
                icon: 'fa-arrow-down',
                weight: 2,
                sla: 48
            },
            'optional': { 
                label: 'Optional', 
                color: '#6B7280', 
                icon: 'fa-ellipsis-h',
                weight: 1,
                sla: 72
            }
        };
        
        // Task status definitions with workflow
        this.statuses = {
            'backlog': { 
                label: 'Backlog', 
                color: '#6B7280', 
                icon: 'fa-inbox',
                order: 1,
                allowedTransitions: ['todo']
            },
            'todo': { 
                label: 'To Do', 
                color: '#3B82F6', 
                icon: 'fa-clipboard-list',
                order: 2,
                allowedTransitions: ['in_progress', 'backlog']
            },
            'in_progress': { 
                label: 'In Progress', 
                color: '#F59E0B', 
                icon: 'fa-spinner',
                order: 3,
                allowedTransitions: ['review', 'blocked', 'todo']
            },
            'review': { 
                label: 'In Review', 
                color: '#8B5CF6', 
                icon: 'fa-search',
                order: 4,
                allowedTransitions: ['done', 'in_progress']
            },
            'blocked': { 
                label: 'Blocked', 
                color: '#DC2626', 
                icon: 'fa-lock',
                order: 5,
                allowedTransitions: ['in_progress', 'todo']
            },
            'done': { 
                label: 'Done', 
                color: '#10B981', 
                icon: 'fa-check-circle',
                order: 6,
                allowedTransitions: ['review']
            },
            'cancelled': { 
                label: 'Cancelled', 
                color: '#9CA3AF', 
                icon: 'fa-times-circle',
                order: 7,
                allowedTransitions: ['backlog']
            }
        };
        
        // Task types
        this.taskTypes = {
            'feature': { label: 'Feature', icon: 'fa-star', color: '#8B5CF6' },
            'bug': { label: 'Bug', icon: 'fa-bug', color: '#DC2626' },
            'improvement': { label: 'Improvement', icon: 'fa-arrow-up', color: '#3B82F6' },
            'task': { label: 'Task', icon: 'fa-check', color: '#10B981' },
            'subtask': { label: 'Subtask', icon: 'fa-level-down-alt', color: '#6B7280' },
            'meeting': { label: 'Meeting', icon: 'fa-calendar', color: '#F59E0B' },
            'follow_up': { label: 'Follow Up', icon: 'fa-phone', color: '#EC4899' },
            'documentation': { label: 'Documentation', icon: 'fa-file-alt', color: '#14B8A6' }
        };
        
        // Task state
        this.tasks = new Map();
        this.selectedTaskId = null;
        this.parentTasks = new Map();
        this.subtasks = new Map(); // parentId -> [childTasks]
        this.dependencies = new Map(); // taskId -> [dependentTaskIds]
        
        // Filters
        this.filters = {
            status: 'all',
            priority: 'all',
            type: 'all',
            assignee: 'all',
            project: 'all',
            search: '',
            dateRange: null,
            tags: [],
            showSubtasks: true
        };
        
        // Sort configuration
        this.sortConfig = {
            field: 'priority',
            order: 'desc'
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0
        };
        
        // View state
        this.currentView = 'kanban'; // kanban, list, calendar, timeline, gantt
        this.groupBy = 'status'; // status, priority, assignee, project
        this.expandedTasks = new Set();
        
        // Time tracking
        this.timeTracking = {
            activeTimer: null, // taskId currently being timed
            startTime: null,
            elapsedSeconds: 0,
            timerInterval: null,
            sessions: new Map() // taskId -> [timeSessions]
        };
        
        // UI State
        this.isDragging = false;
        this.dragTask = null;
        this.bulkSelected = new Set();
        this.undoStack = [];
        this.redoStack = [];
        
        // Performance
        this.metrics = {
            totalTasks: 0,
            completedToday: 0,
            overdue: 0,
            averageCompletionTime: 0,
            lastCalculated: null
        };
        
        // DOM cache
        this.elements = {
            container: null,
            kanbanBoard: null,
            taskList: null,
            calendarView: null,
            taskDetail: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            bulkActions: null,
            timeTracker: null
        };
        
        // Quick add state
        this.quickAddOpen = false;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize tasks module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Tasks] Initializing task management module...');
            
            // Check permissions
            const canAccess = await Permissions.check('tasks', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Task module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load tasks
            await this.loadTasks();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Restore time tracking state
            await this.restoreTimeTracking();
            
            // Render
            await this.render();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Tasks] Initialized in ${loadTime.toFixed(2)}ms`);
            
            // Notify
            EventBus.emit('tasks:ready', {
                count: this.tasks.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Tasks] Initialization failed:', error);
            Toast.show('Failed to load tasks module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#tasks-container',
                kanbanBoard: '#tasks-kanban',
                taskList: '#tasks-list',
                calendarView: '#tasks-calendar',
                taskDetail: '#task-detail',
                filterBar: '#tasks-filters',
                searchInput: '#tasks-search',
                createButton: '#task-create-btn',
                bulkActions: '#tasks-bulk-actions',
                timeTracker: '#time-tracker'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Tasks] DOM elements cached');
            
        } catch (error) {
            console.error('[Tasks] DOM cache failed:', error);
        }
    }
    
    /**
     * Load tasks from API
     */
    async loadTasks(page = 1) {
        try {
            this.pagination.page = page;
            
            // Build query
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order,
                groupBy: this.groupBy
            });
            
            // Add filters
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.priority !== 'all') params.set('priority', this.filters.priority);
            if (this.filters.type !== 'all') params.set('type', this.filters.type);
            if (this.filters.assignee !== 'all') params.set('assignee', this.filters.assignee);
            if (this.filters.project !== 'all') params.set('project', this.filters.project);
            if (this.filters.search) params.set('search', this.filters.search);
            
            // Check cache for default filters
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}list`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processTasksData(cached.data);
                    console.log('[Tasks] Loaded from cache');
                    return;
                }
            }
            
            // API call
            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load tasks');
            }
            
            // Process tasks
            this.processTasksData(response.data);
            
            // Cache if default filters
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}list`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Tasks] Loaded ${this.tasks.size} tasks`);
            
        } catch (error) {
            console.error('[Tasks] Load failed:', error);
            Toast.show('Failed to load tasks', 'error');
        }
    }
    
    /**
     * Process and enrich task data
     */
    processTasksData(data) {
        try {
            this.tasks.clear();
            this.subtasks.clear();
            this.dependencies.clear();
            
            if (data.tasks && Array.isArray(data.tasks)) {
                data.tasks.forEach(task => {
                    // Enrich task
                    const processed = {
                        ...task,
                        // Format fields
                        formattedCreated: Formatters.date(task.createdAt),
                        formattedDue: Formatters.date(task.dueDate),
                        formattedUpdated: Formatters.relativeTime(task.updatedAt),
                        
                        // Priority info
                        priorityInfo: this.priorities[task.priority] || this.priorities.medium,
                        
                        // Status info
                        statusInfo: this.statuses[task.status] || this.statuses.todo,
                        
                        // Type info
                        typeInfo: this.taskTypes[task.type] || this.taskTypes.task,
                        
                        // Derived fields
                        isOverdue: this.isTaskOverdue(task),
                        daysOverdue: this.getDaysOverdue(task),
                        isDueToday: this.isDueToday(task),
                        isDueThisWeek: this.isDueThisWeek(task),
                        completionPercentage: this.calculateCompletion(task),
                        
                        // Assignment
                        assigneeName: task.assignee?.name || 'Unassigned',
                        assigneeAvatar: task.assignee?.avatar || null,
                        
                        // Time tracking
                        totalTimeSpent: this.formatTimeSpent(task.timeSpent || 0),
                        estimatedTime: task.estimatedHours ? `${task.estimatedHours}h` : null,
                        
                        // Subtask summary
                        subtaskCount: task.subtasks?.length || 0,
                        completedSubtaskCount: task.subtasks?.filter(st => st.status === 'done').length || 0,
                        
                        // Dependencies
                        hasDependencies: task.dependencies?.length > 0,
                        dependencyCount: task.dependencies?.length || 0,
                        isBlocked: task.status === 'blocked' || 
                                   (task.dependencies?.some(depId => {
                                       const dep = this.tasks.get(depId);
                                       return dep && dep.status !== 'done';
                                   })),
                        
                        // Permissions
                        canEdit: true, // Will be filtered by RBAC
                        canDelete: task.status !== 'done',
                        canStartTimer: task.status === 'in_progress',
                        canComplete: task.status === 'review'
                    };
                    
                    this.tasks.set(task.id, processed);
                    
                    // Build subtask map
                    if (task.parentId) {
                        if (!this.subtasks.has(task.parentId)) {
                            this.subtasks.set(task.parentId, []);
                        }
                        this.subtasks.get(task.parentId).push(task.id);
                    }
                    
                    // Build dependency map
                    if (task.dependencies) {
                        this.dependencies.set(task.id, task.dependencies);
                    }
                });
            }
            
            // Update pagination
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
        } catch (error) {
            console.error('[Tasks] Data processing failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            // Search with debounce
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            // Filter changes
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            // Create task button
            if (this.elements.createButton) {
                this.elements.createButton.addEventListener('click', () => {
                    this.openCreateTask();
                });
            }
            
            // Keyboard shortcut for quick add
            document.addEventListener('keydown', (e) => {
                // Ctrl+Shift+N for quick add task
                if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                    e.preventDefault();
                    this.openQuickAdd();
                }
            });
            
            // Event bus
            EventBus.on('task:create', this.createTask.bind(this));
            EventBus.on('task:update', this.updateTask.bind(this));
            EventBus.on('task:delete', this.deleteTask.bind(this));
            EventBus.on('task:move', this.moveTask.bind(this));
            EventBus.on('task:assign', this.assignTask.bind(this));
            EventBus.on('task:start-timer', this.startTimeTracking.bind(this));
            EventBus.on('task:stop-timer', this.stopTimeTracking.bind(this));
            EventBus.on('task:add-subtask', this.addSubtask.bind(this));
            EventBus.on('task:add-dependency', this.addDependency.bind(this));
            
            // Online/offline
            window.addEventListener('online', () => {
                this.syncOfflineChanges();
            });
            
            // Before unload - warn if timer running
            window.addEventListener('beforeunload', (e) => {
                if (this.timeTracking.activeTimer) {
                    e.preventDefault();
                    e.returnValue = 'Time tracking is active. Are you sure you want to leave?';
                }
            });
            
            console.log('[Tasks] Event listeners initialized');
            
        } catch (error) {
            console.error('[Tasks] Event listener setup failed:', error);
        }
    }
    
    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        try {
            document.addEventListener('keydown', (e) => {
                // Only if tasks container is visible
                if (!document.getElementById('tasks-container')) return;
                
                switch (e.key) {
                    case 'n':
                        if (e.ctrlKey && !e.shiftKey) {
                            e.preventDefault();
                            this.openCreateTask();
                        }
                        break;
                        
                    case 'f':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.elements.searchInput?.focus();
                        }
                        break;
                        
                    case 'Escape':
                        this.clearFilters();
                        break;
                        
                    case '1': case '2': case '3': case '4':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            const views = ['kanban', 'list', 'calendar', 'timeline'];
                            const index = parseInt(e.key) - 1;
                            if (views[index]) this.switchView(views[index]);
                        }
                        break;
                        
                    case 'z':
                        if (e.ctrlKey && !e.shiftKey) {
                            e.preventDefault();
                            this.undo();
                        }
                        break;
                        
                    case 'y':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.redo();
                        }
                        break;
                }
            });
            
            console.log('[Tasks] Keyboard shortcuts set up');
            
        } catch (error) {
            console.error('[Tasks] Shortcut setup failed:', error);
        }
    }
    
    /**
     * Restore time tracking state
     */
    async restoreTimeTracking() {
        try {
            const saved = await Cache.get(`${this.cachePrefix}timer_state`);
            if (saved && saved.data) {
                const { taskId, startTime } = saved.data;
                
                // Resume timer if less than 24 hours
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed < 86400 && this.tasks.has(taskId)) { // 24 hours
                    this.timeTracking.activeTimer = taskId;
                    this.timeTracking.startTime = startTime;
                    this.timeTracking.elapsedSeconds = elapsed;
                    
                    // Start interval
                    this.startTimerInterval();
                    
                    console.log('[Tasks] Time tracking restored');
                }
            }
        } catch (error) {
            console.error('[Tasks] Timer restore failed:', error);
        }
    }
    
    /**
     * Start time tracking for a task
     */
    async startTimeTracking(taskId) {
        try {
            // Stop existing timer if any
            if (this.timeTracking.activeTimer) {
                await this.stopTimeTracking();
            }
            
            // Check task exists
            const task = this.tasks.get(taskId);
            if (!task) throw new Error('Task not found');
            
            // Update task status to in_progress if not already
            if (task.status !== 'in_progress') {
                await this.updateTaskStatus(taskId, 'in_progress');
            }
            
            // Start timer
            this.timeTracking.activeTimer = taskId;
            this.timeTracking.startTime = Date.now();
            this.timeTracking.elapsedSeconds = 0;
            
            // Start interval
            this.startTimerInterval();
            
            // Save state
            await this.saveTimerState();
            
            // Update UI
            this.updateTimerDisplay();
            
            Toast.show(`Timer started for: ${task.title}`, 'info');
            
            EventBus.emit('task:timer:started', { taskId });
            
        } catch (error) {
            console.error('[Tasks] Timer start failed:', error);
            Toast.show('Failed to start timer', 'error');
        }
    }
    
    /**
     * Start timer interval for UI updates
     */
    startTimerInterval() {
        if (this.timeTracking.timerInterval) {
            clearInterval(this.timeTracking.timerInterval);
        }
        
        this.timeTracking.timerInterval = setInterval(() => {
            this.timeTracking.elapsedSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    }
    
    /**
     * Stop time tracking
     */
    async stopTimeTracking(taskId = null) {
        try {
            const stopTaskId = taskId || this.timeTracking.activeTimer;
            
            if (!stopTaskId) return;
            
            // Calculate time spent
            const elapsedSeconds = this.timeTracking.elapsedSeconds;
            const elapsedMinutes = Math.round(elapsedSeconds / 60);
            
            // Save time session
            const session = {
                taskId: stopTaskId,
                startTime: new Date(this.timeTracking.startTime).toISOString(),
                endTime: new Date().toISOString(),
                durationSeconds: elapsedSeconds,
                durationMinutes: elapsedMinutes
            };
            
            // Add to sessions
            if (!this.timeTracking.sessions.has(stopTaskId)) {
                this.timeTracking.sessions.set(stopTaskId, []);
            }
            this.timeTracking.sessions.get(stopTaskId).push(session);
            
            // Update task's total time
            const task = this.tasks.get(stopTaskId);
            if (task) {
                task.timeSpent = (task.timeSpent || 0) + elapsedMinutes;
                task.totalTimeSpent = this.formatTimeSpent(task.timeSpent);
                this.tasks.set(stopTaskId, task);
            }
            
            // Save to API
            await API.post(`${this.apiEndpoint}/${stopTaskId}/time-log`, {
                session: session
            });
            
            // Clear timer
            this.timeTracking.activeTimer = null;
            this.timeTracking.startTime = null;
            this.timeTracking.elapsedSeconds = 0;
            
            // Clear interval
            if (this.timeTracking.timerInterval) {
                clearInterval(this.timeTracking.timerInterval);
                this.timeTracking.timerInterval = null;
            }
            
            // Clear saved state
            await Cache.delete(`${this.cachePrefix}timer_state`);
            
            // Update UI
            this.updateTimerDisplay();
            
            Toast.show(`Time logged: ${this.formatTimeSpent(elapsedMinutes)}`, 'success');
            
            EventBus.emit('task:timer:stopped', { taskId: stopTaskId, session });
            
        } catch (error) {
            console.error('[Tasks] Timer stop failed:', error);
        }
    }
    
    /**
     * Save timer state to cache
     */
    async saveTimerState() {
        try {
            if (this.timeTracking.activeTimer) {
                await Cache.set(`${this.cachePrefix}timer_state`, {
                    taskId: this.timeTracking.activeTimer,
                    startTime: this.timeTracking.startTime
                }, 24 * 60 * 60 * 1000); // 24 hours
            }
        } catch (error) {
            console.error('[Tasks] Timer state save failed:', error);
        }
    }
    
    /**
     * Update timer display in UI
     */
    updateTimerDisplay() {
        try {
            const display = document.getElementById('timer-display');
            if (!display) return;
            
            if (this.timeTracking.activeTimer) {
                const task = this.tasks.get(this.timeTracking.activeTimer);
                const elapsed = this.formatTimeSpent(Math.round(this.timeTracking.elapsedSeconds / 60));
                
                display.innerHTML = `
                    <div class="timer-active">
                        <span class="timer-dot"></span>
                        <span class="timer-task">${this.escapeHtml(task?.title || 'Unknown')}</span>
                        <span class="timer-time">${elapsed}</span>
                        <button class="btn-icon stop-timer" onclick="window.Global.Tasks.stopTimeTracking()">
                            <i class="fas fa-stop"></i>
                        </button>
                    </div>
                `;
                display.style.display = 'block';
            } else {
                display.style.display = 'none';
            }
            
        } catch (error) {
            console.error('[Tasks] Timer display update failed:', error);
        }
    }
    
    /**
     * Format time spent
     */
    formatTimeSpent(minutes) {
        if (!minutes || minutes === 0) return '0m';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}m`;
    }
    
    /**
     * Render tasks view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            switch (this.currentView) {
                case 'kanban':
                    await this.renderKanbanView();
                    break;
                case 'list':
                    await this.renderListView();
                    break;
                case 'calendar':
                    await this.renderCalendarView();
                    break;
                case 'timeline':
                    await this.renderTimelineView();
                    break;
                default:
                    await this.renderKanbanView();
            }
            
            // Update timer display
            this.updateTimerDisplay();
            
        } catch (error) {
            console.error('[Tasks] Render failed:', error);
        }
    }
    
    /**
     * Render Kanban board view
     */
    async renderKanbanView() {
        try {
            let html = `
                <div class="tasks-kanban-container">
                    <!-- Kanban Header with Metrics -->
                    <div class="kanban-metrics">
                        <div class="metric-card">
                            <span class="metric-value">${this.metrics.totalTasks}</span>
                            <span class="metric-label">Total Tasks</span>
                        </div>
                        <div class="metric-card overdue">
                            <span class="metric-value">${this.metrics.overdue}</span>
                            <span class="metric-label">Overdue</span>
                        </div>
                        <div class="metric-card completed">
                            <span class="metric-value">${this.metrics.completedToday}</span>
                            <span class="metric-label">Done Today</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-value">${this.metrics.averageCompletionTime}h</span>
                            <span class="metric-label">Avg Time</span>
                        </div>
                    </div>
                    
                    <!-- Timer Display -->
                    <div id="timer-display" class="timer-display" style="display: none;"></div>
                    
                    <!-- Kanban Board -->
                    <div class="kanban-board" id="tasks-kanban">
                        ${this.renderKanbanColumns()}
                    </div>
                    
                    <!-- Quick Add Button -->
                    <button class="fab-button" onclick="window.Global.Tasks.openQuickAdd()" 
                            title="Quick Add Task (Ctrl+Shift+N)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            // Set up drag and drop
            this.setupDragAndDrop();
            
            // Set up column scroll
            this.setupColumnScroll();
            
            console.log('[Tasks] Kanban view rendered');
            
        } catch (error) {
            console.error('[Tasks] Kanban render failed:', error);
        }
    }
    
    /**
     * Render Kanban columns by status
     */
    renderKanbanColumns() {
        try {
            const statusOrder = Object.entries(this.statuses)
                .sort((a, b) => a[1].order - b[1].order);
            
            let columns = '';
            
            statusOrder.forEach(([statusKey, statusInfo]) => {
                // Filter tasks for this status
                const statusTasks = [];
                this.tasks.forEach(task => {
                    if (task.status === statusKey) {
                        statusTasks.push(task);
                    }
                });
                
                columns += `
                    <div class="kanban-column" data-status="${statusKey}">
                        <div class="column-header" style="border-top: 3px solid ${statusInfo.color}">
                            <div class="column-title">
                                <i class="fas ${statusInfo.icon}" style="color: ${statusInfo.color}"></i>
                                <span>${statusInfo.label}</span>
                                <span class="column-count" style="background: ${statusInfo.color}20; color: ${statusInfo.color}">
                                    ${statusTasks.length}
                                </span>
                            </div>
                            <button class="btn-icon column-menu" onclick="window.Global.Tasks.showColumnMenu(event, '${statusKey}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                        
                        <div class="column-tasks" data-status="${statusKey}">
                            ${statusTasks.map(task => this.renderTaskCard(task)).join('')}
                        </div>
                        
                        <button class="add-task-btn" onclick="window.Global.Tasks.openCreateTask('${statusKey}')">
                            <i class="fas fa-plus"></i> Add Task
                        </button>
                    </div>
                `;
            });
            
            return columns;
            
        } catch (error) {
            console.error('[Tasks] Column render failed:', error);
            return '<div class="error-message">Failed to render board</div>';
        }
    }
    
    /**
     * Render individual task card
     */
    renderTaskCard(task) {
        try {
            const priorityInfo = task.priorityInfo;
            const typeInfo = task.typeInfo;
            const isOverdue = task.isOverdue;
            
            return `
                <div class="task-card ${isOverdue ? 'overdue' : ''} ${task.isBlocked ? 'blocked' : ''}" 
                     id="task-${task.id}"
                     data-task-id="${task.id}"
                     data-status="${task.status}"
                     draggable="true"
                     onclick="window.Global.Tasks.openTaskDetail('${task.id}')">
                    
                    <!-- Priority indicator -->
                    <div class="task-priority-bar" style="background: ${priorityInfo.color}"></div>
                    
                    <!-- Task header -->
                    <div class="task-header">
                        <span class="task-type-badge" style="background: ${typeInfo.color}20; color: ${typeInfo.color}">
                            <i class="fas ${typeInfo.icon}"></i>
                            ${typeInfo.label}
                        </span>
                        ${task.isBlocked ? `
                            <span class="blocked-badge">
                                <i class="fas fa-lock"></i>
                            </span>
                        ` : ''}
                    </div>
                    
                    <!-- Task title -->
                    <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                    
                    <!-- Task description preview -->
                    ${task.description ? `
                        <p class="task-description">${this.escapeHtml(task.description.substring(0, 80))}${task.description.length > 80 ? '...' : ''}</p>
                    ` : ''}
                    
                    <!-- Task meta -->
                    <div class="task-meta">
                        ${task.assignee ? `
                            <div class="task-assignee">
                                <img src="${task.assigneeAvatar || '/assets/default-avatar.png'}" 
                                     alt="${this.escapeHtml(task.assigneeName)}"
                                     title="${this.escapeHtml(task.assigneeName)}">
                            </div>
                        ` : ''}
                        
                        ${task.dueDate ? `
                            <div class="task-due ${isOverdue ? 'overdue-text' : ''}">
                                <i class="fas fa-calendar-alt"></i>
                                ${task.formattedDue}
                            </div>
                        ` : ''}
                        
                        ${task.subtaskCount > 0 ? `
                            <div class="task-subtasks">
                                <i class="fas fa-tasks"></i>
                                ${task.completedSubtaskCount}/${task.subtaskCount}
                            </div>
                        ` : ''}
                        
                        ${task.totalTimeSpent !== '0m' ? `
                            <div class="task-time">
                                <i class="fas fa-clock"></i>
                                ${task.totalTimeSpent}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Tags -->
                    ${task.tags?.length > 0 ? `
                        <div class="task-tags">
                            ${task.tags.map(tag => `
                                <span class="tag">${this.escapeHtml(tag)}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <!-- Progress bar for subtasks -->
                    ${task.subtaskCount > 0 ? `
                        <div class="task-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(task.completedSubtaskCount / task.subtaskCount) * 100}%"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
        } catch (error) {
            console.error('[Tasks] Card render failed:', error);
            return '';
        }
    }
    
    /**
     * Open task detail modal
     */
    async openTaskDetail(taskId) {
        try {
            const task = this.tasks.get(taskId);
            if (!task) {
                Toast.show('Task not found', 'error');
                return;
            }
            
            this.selectedTaskId = taskId;
            
            // Get subtasks
            const subtaskIds = this.subtasks.get(taskId) || [];
            const subtasks = subtaskIds.map(id => this.tasks.get(id)).filter(Boolean);
            
            // Get dependencies
            const dependencyIds = this.dependencies.get(taskId) || [];
            const dependencies = dependencyIds.map(id => this.tasks.get(id)).filter(Boolean);
            
            // Get time sessions
            const timeSessions = this.timeTracking.sessions.get(taskId) || [];
            const totalTime = task.timeSpent || 0;
            
            const detailHtml = `
                <div class="task-detail-container">
                    <!-- Task Header -->
                    <div class="detail-header">
                        <div class="task-id">#${task.id.substring(0, 8)}</div>
                        <div class="header-actions">
                            ${task.canEdit ? `
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Tasks.editTask('${taskId}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                            ` : ''}
                            ${task.canDelete ? `
                                <button class="btn btn-sm btn-danger" onclick="window.Global.Tasks.confirmDeleteTask('${taskId}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                            ${task.canStartTimer ? `
                                <button class="btn btn-sm btn-success" onclick="window.Global.Tasks.startTimeTracking('${taskId}')">
                                    <i class="fas fa-play"></i> Start Timer
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline" onclick="window.Global.Modal.close()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Task Title -->
                    <div class="detail-title-section">
                        <span class="priority-indicator" style="background: ${task.priorityInfo.color}"></span>
                        <h2>${this.escapeHtml(task.title)}</h2>
                    </div>
                    
                    <!-- Task Meta Grid -->
                    <div class="detail-meta-grid">
                        <div class="meta-item">
                            <label>Status</label>
                            <select onchange="window.Global.Tasks.updateTaskStatus('${taskId}', this.value)">
                                ${Object.entries(this.statuses).map(([key, status]) => `
                                    <option value="${key}" ${task.status === key ? 'selected' : ''}
                                        ${!task.statusInfo.allowedTransitions.includes(key) ? 'disabled' : ''}>
                                        ${status.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="meta-item">
                            <label>Priority</label>
                            <span class="priority-badge" style="background: ${task.priorityInfo.color}20; color: ${task.priorityInfo.color}">
                                <i class="fas ${task.priorityInfo.icon}"></i>
                                ${task.priorityInfo.label}
                            </span>
                        </div>
                        
                        <div class="meta-item">
                            <label>Type</label>
                            <span class="type-badge" style="background: ${task.typeInfo.color}20; color: ${task.typeInfo.color}">
                                <i class="fas ${task.typeInfo.icon}"></i>
                                ${task.typeInfo.label}
                            </span>
                        </div>
                        
                        <div class="meta-item">
                            <label>Assignee</label>
                            <div class="assignee-display">
                                ${task.assigneeAvatar ? `
                                    <img src="${task.assigneeAvatar}" alt="${this.escapeHtml(task.assigneeName)}">
                                ` : ''}
                                <span>${this.escapeHtml(task.assigneeName)}</span>
                            </div>
                        </div>
                        
                        <div class="meta-item">
                            <label>Due Date</label>
                            <span class="${task.isOverdue ? 'overdue-text' : ''}">
                                <i class="fas fa-calendar"></i>
                                ${task.formattedDue || 'No due date'}
                                ${task.isOverdue ? `<span class="overdue-badge">${task.daysOverdue}d overdue</span>` : ''}
                            </span>
                        </div>
                        
                        <div class="meta-item">
                            <label>Time Spent</label>
                            <span>
                                <i class="fas fa-clock"></i>
                                ${task.totalTimeSpent}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Description -->
                    ${task.description ? `
                        <div class="detail-section">
                            <h4>Description</h4>
                            <div class="task-description-full">
                                ${this.escapeHtml(task.description)}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Subtasks -->
                    <div class="detail-section">
                        <h4>Subtasks (${subtasks.length})</h4>
                        <div class="subtasks-list">
                            ${subtasks.map(subtask => `
                                <div class="subtask-item ${subtask.status === 'done' ? 'completed' : ''}">
                                    <input type="checkbox" 
                                           ${subtask.status === 'done' ? 'checked' : ''}
                                           onchange="window.Global.Tasks.toggleSubtask('${subtask.id}')">
                                    <span class="subtask-title">${this.escapeHtml(subtask.title)}</span>
                                    <span class="subtask-status">${subtask.statusInfo.label}</span>
                                </div>
                            `).join('')}
                            <button class="btn btn-sm btn-outline add-subtask-btn" 
                                    onclick="window.Global.Tasks.addSubtask('${taskId}')">
                                <i class="fas fa-plus"></i> Add Subtask
                            </button>
                        </div>
                    </div>
                    
                    <!-- Dependencies -->
                    <div class="detail-section">
                        <h4>Dependencies (${dependencies.length})</h4>
                        <div class="dependencies-list">
                            ${dependencies.map(dep => `
                                <div class="dependency-item">
                                    <span class="dep-status" style="background: ${dep.statusInfo.color}"></span>
                                    <span>${this.escapeHtml(dep.title)}</span>
                                </div>
                            `).join('')}
                            <button class="btn btn-sm btn-outline" 
                                    onclick="window.Global.Tasks.addDependency('${taskId}')">
                                <i class="fas fa-link"></i> Add Dependency
                            </button>
                        </div>
                    </div>
                    
                    <!-- Time Tracking -->
                    <div class="detail-section">
                        <h4>Time Tracking</h4>
                        <div class="time-summary">
                            <div class="time-stat">
                                <span class="stat-label">Total Time</span>
                                <span class="stat-value">${this.formatTimeSpent(totalTime)}</span>
                            </div>
                            <div class="time-stat">
                                <span class="stat-label">Sessions</span>
                                <span class="stat-value">${timeSessions.length}</span>
                            </div>
                        </div>
                        ${timeSessions.length > 0 ? `
                            <div class="time-sessions-list">
                                ${timeSessions.slice(0, 5).map(session => `
                                    <div class="time-session-item">
                                        <span>${Formatters.date(session.startTime)}</span>
                                        <span>${this.formatTimeSpent(session.durationMinutes)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Comments Section -->
                    <div class="detail-section">
                        <h4>Comments</h4>
                        <div class="comments-section" id="task-comments">
                            <!-- Loaded dynamically -->
                        </div>
                        <div class="comment-input">
                            <textarea placeholder="Add a comment..." rows="2"></textarea>
                            <button class="btn btn-sm btn-primary" 
                                    onclick="window.Global.Tasks.addComment('${taskId}')">
                                Comment
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const modal = new Modal({
                title: '',
                content: detailHtml,
                size: 'xlarge',
                customClass: 'task-detail-modal',
                onClose: () => {
                    this.selectedTaskId = null;
                }
            });
            
            modal.open();
            
            // Load comments after render
            setTimeout(() => {
                this.loadComments(taskId);
            }, 100);
            
        } catch (error) {
            console.error('[Tasks] Detail open failed:', error);
            Toast.show('Failed to open task details', 'error');
        }
    }
    
    /**
     * Open quick add task dialog
     */
    openQuickAdd() {
        try {
            if (this.quickAddOpen) return;
            this.quickAddOpen = true;
            
            const quickAddHtml = `
                <div class="quick-add-overlay" onclick="window.Global.Tasks.closeQuickAdd()">
                    <div class="quick-add-dialog" onclick="event.stopPropagation()">
                        <input type="text" id="quick-add-input" 
                               placeholder="What needs to be done? (Press Enter to add)"
                               onkeydown="window.Global.Tasks.handleQuickAdd(event)">
                        <div class="quick-add-actions">
                            <select id="quick-add-priority">
                                ${Object.entries(this.priorities).map(([key, p]) => `
                                    <option value="${key}">${p.label}</option>
                                `).join('')}
                            </select>
                            <select id="quick-add-status">
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="backlog">Backlog</option>
                            </select>
                            <button class="btn btn-sm btn-primary" onclick="window.Global.Tasks.submitQuickAdd()">
                                Add Task
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Append to body
            const overlay = document.createElement('div');
            overlay.id = 'quick-add-overlay';
            overlay.innerHTML = quickAddHtml;
            document.body.appendChild(overlay);
            
            // Focus input
            setTimeout(() => {
                const input = document.getElementById('quick-add-input');
                if (input) input.focus();
            }, 100);
            
        } catch (error) {
            console.error('[Tasks] Quick add failed:', error);
            this.quickAddOpen = false;
        }
    }
    
    /**
     * Handle quick add keyboard event
     */
    async handleQuickAdd(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            await this.submitQuickAdd();
        } else if (event.key === 'Escape') {
            this.closeQuickAdd();
        }
    }
    
    /**
     * Submit quick add task
     */
    async submitQuickAdd() {
        try {
            const input = document.getElementById('quick-add-input');
            const prioritySelect = document.getElementById('quick-add-priority');
            const statusSelect = document.getElementById('quick-add-status');
            
            const title = input?.value?.trim();
            if (!title) {
                Toast.show('Please enter a task title', 'warning');
                return;
            }
            
            const taskData = {
                title: title,
                priority: prioritySelect?.value || 'medium',
                status: statusSelect?.value || 'todo',
                type: 'task'
            };
            
            // Create task
            await this.createTask(taskData);
            
            // Close quick add
            this.closeQuickAdd();
            
            // Refresh
            await this.loadTasks();
            await this.render();
            
            Toast.show('Task added successfully', 'success');
            
        } catch (error) {
            console.error('[Tasks] Quick add submit failed:', error);
            Toast.show('Failed to add task', 'error');
        }
    }
    
    /**
     * Close quick add dialog
     */
    closeQuickAdd() {
        const overlay = document.getElementById('quick-add-overlay');
        if (overlay) {
            overlay.remove();
        }
        this.quickAddOpen = false;
    }
    
    /**
     * Create a new task
     */
    async createTask(taskData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/create`, taskData);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Clear cache
            await Cache.delete(`${this.cachePrefix}list`);
            
            EventBus.emit('task:created', response.data);
            
            return response.data;
            
        } catch (error) {
            console.error('[Tasks] Create failed:', error);
            throw error;
        }
    }
    
    /**
     * Update task status
     */
    async updateTaskStatus(taskId, newStatus) {
        try {
            // Validate transition
            const task = this.tasks.get(taskId);
            if (!task) throw new Error('Task not found');
            
            const allowedTransitions = this.statuses[task.status]?.allowedTransitions || [];
            if (!allowedTransitions.includes(newStatus)) {
                Toast.show(`Cannot move from ${task.status} to ${newStatus}`, 'warning');
                return;
            }
            
            // Save to undo stack
            this.undoStack.push({
                action: 'status_change',
                taskId: taskId,
                oldStatus: task.status,
                newStatus: newStatus
            });
            
            // Update
            task.status = newStatus;
            task.statusInfo = this.statuses[newStatus];
            
            if (newStatus === 'done') {
                task.completedAt = new Date().toISOString();
            }
            
            this.tasks.set(taskId, task);
            
            // Save to API
            await API.put(`${this.apiEndpoint}/${taskId}`, {
                status: newStatus,
                completedAt: task.completedAt
            });
            
            // Update UI
            await this.render();
            
            EventBus.emit('task:status:changed', { taskId, oldStatus: this.undoStack[this.undoStack.length - 1].oldStatus, newStatus });
            
        } catch (error) {
            console.error('[Tasks] Status update failed:', error);
            Toast.show('Failed to update status', 'error');
        }
    }
    
    /**
     * Add subtask
     */
    async addSubtask(parentId) {
        try {
            const title = prompt('Enter subtask title:');
            if (!title || !title.trim()) return;
            
            const subtaskData = {
                title: title.trim(),
                parentId: parentId,
                type: 'subtask',
                status: 'todo',
                priority: 'medium'
            };
            
            await this.createTask(subtaskData);
            
            // Refresh
            await this.loadTasks();
            await this.openTaskDetail(parentId); // Reopen detail
            
            Toast.show('Subtask added', 'success');
            
        } catch (error) {
            console.error('[Tasks] Subtask add failed:', error);
            Toast.show('Failed to add subtask', 'error');
        }
    }
    
    /**
     * Add dependency
     */
    async addDependency(taskId) {
        try {
            // Open task selector
            const availableTasks = [];
            this.tasks.forEach((task, id) => {
                if (id !== taskId) {
                    availableTasks.push(task);
                }
            });
            
            const selectorHtml = `
                <div class="task-selector">
                    <input type="text" placeholder="Search tasks..." oninput="window.Global.Tasks.filterTaskSelector(this.value)">
                    <div class="task-selector-list">
                        ${availableTasks.map(task => `
                            <div class="task-selector-item" 
                                 onclick="window.Global.Tasks.selectDependency('${taskId}', '${task.id}')">
                                <span class="task-selector-status" style="background: ${task.statusInfo.color}"></span>
                                <span>${this.escapeHtml(task.title)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Add Dependency',
                content: selectorHtml,
                size: 'medium'
            });
            
            modal.open();
            
        } catch (error) {
            console.error('[Tasks] Dependency add failed:', error);
        }
    }
    
    /**
     * Select dependency task
     */
    async selectDependency(taskId, dependencyId) {
        try {
            await API.post(`${this.apiEndpoint}/${taskId}/dependencies`, {
                dependencyId: dependencyId
            });
            
            // Update local state
            if (!this.dependencies.has(taskId)) {
                this.dependencies.set(taskId, []);
            }
            this.dependencies.get(taskId).push(dependencyId);
            
            Modal.close();
            Toast.show('Dependency added', 'success');
            
        } catch (error) {
            console.error('[Tasks] Dependency select failed:', error);
            Toast.show('Failed to add dependency', 'error');
        }
    }
    
    /**
     * Undo last action
     */
    async undo() {
        try {
            if (this.undoStack.length === 0) {
                Toast.show('Nothing to undo', 'info');
                return;
            }
            
            const action = this.undoStack.pop();
            this.redoStack.push(action);
            
            switch (action.action) {
                case 'status_change':
                    await this.updateTaskStatus(action.taskId, action.oldStatus);
                    break;
                case 'delete':
                    // Restore task
                    await this.createTask(action.taskData);
                    break;
            }
            
            Toast.show('Undo successful', 'success');
            
        } catch (error) {
            console.error('[Tasks] Undo failed:', error);
        }
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalTasks = 0;
            let completedToday = 0;
            let overdue = 0;
            let totalCompletionTime = 0;
            let completedTasks = 0;
            
            const today = new Date().toISOString().split('T')[0];
            
            this.tasks.forEach(task => {
                totalTasks++;
                
                if (task.isOverdue && task.status !== 'done' && task.status !== 'cancelled') {
                    overdue++;
                }
                
                if (task.status === 'done') {
                    if (task.completedAt && task.completedAt.startsWith(today)) {
                        completedToday++;
                    }
                    
                    completedTasks++;
                    if (task.timeSpent) {
                        totalCompletionTime += task.timeSpent;
                    }
                }
            });
            
            this.metrics.totalTasks = totalTasks;
            this.metrics.completedToday = completedToday;
            this.metrics.overdue = overdue;
            this.metrics.averageCompletionTime = completedTasks > 0 ? 
                Math.round(totalCompletionTime / completedTasks) : 0;
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Tasks] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Check if task is overdue
     */
    isTaskOverdue(task) {
        if (!task.dueDate || task.status === 'done' || task.status === 'cancelled') return false;
        return new Date(task.dueDate) < new Date();
    }
    
    /**
     * Get days overdue
     */
    getDaysOverdue(task) {
        if (!task.dueDate) return 0;
        const due = new Date(task.dueDate);
        const now = new Date();
        const diff = now - due;
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }
    
    /**
     * Check if task is due today
     */
    isDueToday(task) {
        if (!task.dueDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return task.dueDate === today;
    }
    
    /**
     * Check if task is due this week
     */
    isDueThisWeek(task) {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + (7 - now.getDay()));
        return due >= now && due <= weekEnd;
    }
    
    /**
     * Calculate completion percentage based on subtasks
     */
    calculateCompletion(task) {
        if (!task.subtaskCount) {
            return task.status === 'done' ? 100 : 0;
        }
        return Math.round((task.completedSubtaskCount / task.subtaskCount) * 100);
    }
    
    /**
     * Are default filters active
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.priority === 'all' &&
               this.filters.type === 'all' &&
               this.filters.assignee === 'all' &&
               this.filters.project === 'all' &&
               !this.filters.search;
    }
    
    /**
     * Switch view
     */
    async switchView(view) {
        this.currentView = view;
        await this.render();
    }
    
    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        setInterval(async () => {
            await this.loadTasks();
            this.calculateMetrics();
        }, 60000); // Refresh every minute
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
     * Debounce utility
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Clean up
     */
    destroy() {
        // Stop timer
        if (this.timeTracking.activeTimer) {
            this.stopTimeTracking();
        }
        
        // Clear intervals
        if (this.timeTracking.timerInterval) {
            clearInterval(this.timeTracking.timerInterval);
        }
        
        // Remove event listeners
        EventBus.off('task:create');
        EventBus.off('task:update');
        EventBus.off('task:delete');
        
        console.log('[Tasks] Module destroyed');
    }
}

// Singleton
const tasks = new TasksModule();

// Exports
export { tasks, TasksModule };
export default tasks;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Tasks = tasks;
}
