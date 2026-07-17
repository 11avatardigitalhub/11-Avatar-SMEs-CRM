/* ==========================================
   11 AVATAR DIGITAL HUB
   Dashboard Module
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Dashboard data loading & refresh
   - KPI calculations
   - Revenue goal tracking
   - Activity feed management
   - Task list management
   - Quick action handlers
   - Chart data preparation
   - Auto-refresh on data changes
   - Welcome message personalization
   ========================================== */

const DashboardModule = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _state: {
        loaded: false,
        loading: false,
        data: {
            leads: [],
            clients: [],
            revenue: [],
            tasks: [],
            history: []
        },
        stats: {
            totalLeads: 0,
            activeLeads: 0,
            wonLeads: 0,
            totalClients: 0,
            activeClients: 0,
            totalRevenue: 0,
            monthlyGoal: 70000,
            collectedRevenue: 0,
            remainingRevenue: 0,
            revenuePercent: 0,
            pendingTasks: 0,
            todayTasks: 0,
            overdueTasks: 0,
            todayCalls: 0,
            todayFollowups: 0,
            todayMeetings: 0,
            forecastRevenue: 0
        },
        refreshInterval: null
    },
    
    _config: {
        autoRefresh: true,
        refreshInterval: 60000, // 1 minute
        animateCharts: true,
        showWelcome: true,
        activityLimit: 10,
        taskLimit: 5
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    /**
     * Initialize dashboard module
     * @param {Object} config - Configuration options
     */
    init(config = {}) {
        Object.assign(this._config, config);
        
        this._setupEventListeners();
        this.loadDashboard();
        
        // Auto-refresh
        if (this._config.autoRefresh) {
            this._state.refreshInterval = setInterval(() => {
                this.refreshDashboard();
            }, this._config.refreshInterval);
        }
        
        console.log('📊 Dashboard module initialized');
    },
    
    /**
     * Setup event listeners for real-time updates
     * @private
     */
    _setupEventListeners() {
        if (!window.EventBus) return;
        
        // Refresh on data changes
        window.EventBus.on('lead:created', () => this.refreshDashboard());
        window.EventBus.on('lead:updated', () => this.refreshDashboard());
        window.EventBus.on('lead:deleted', () => this.refreshDashboard());
        window.EventBus.on('client:created', () => this.refreshDashboard());
        window.EventBus.on('revenue:added', () => this.refreshDashboard());
        window.EventBus.on('revenue:updated', () => this.refreshDashboard());
        window.EventBus.on('task:created', () => this.refreshDashboard());
        window.EventBus.on('task:completed', () => this.refreshDashboard());
        window.EventBus.on('data:imported', () => this.refreshDashboard());
        window.EventBus.on('data:synced', () => this.refreshDashboard());
    },
    
    // ==========================================
    // DATA LOADING
    // ==========================================
    
    /**
     * Load all dashboard data
     */
    async loadDashboard() {
        if (this._state.loading) return;
        
        this._state.loading = true;
        this._showLoading(true);
        
        try {
            // Load data from StateManager or localStorage
            this._loadFromState();
            
            // Calculate statistics
            this._calculateStats();
            
            // Render all components
            this._renderAll();
            
            this._state.loaded = true;
            this._state.loading = false;
            
            console.log('📊 Dashboard loaded:', this._state.stats);
            
        } catch (error) {
            console.error('❌ Dashboard load failed:', error);
            this._showError('Failed to load dashboard data');
        } finally {
            this._showLoading(false);
        }
    },
    
    /**
     * Refresh dashboard data silently
     */
    async refreshDashboard() {
        if (this._state.loading) return;
        
        try {
            this._loadFromState();
            this._calculateStats();
            this._updateDisplay();
        } catch (error) {
            console.error('❌ Dashboard refresh failed:', error);
        }
    },
    
    /**
     * Load data from StateManager or localStorage
     * @private
     */
    _loadFromState() {
        // Try StateManager first
        if (window.StateManager) {
            this._state.data.leads = window.StateManager.get('data.leads') || [];
            this._state.data.clients = window.StateManager.get('data.clients') || [];
            this._state.data.revenue = window.StateManager.get('data.revenueEntries') || [];
            this._state.data.tasks = window.StateManager.get('data.tasks') || [];
            this._state.data.history = window.StateManager.get('data.history') || [];
        } else {
            // Fallback to localStorage
            try {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                this._state.data.leads = saved.leads || [];
                this._state.data.clients = saved.clients || [];
                this._state.data.revenue = saved.revenueEntries || [];
                this._state.data.tasks = saved.tasks || [];
                this._state.data.history = saved.history || [];
            } catch (e) {
                // Keep empty defaults
            }
        }
        
        // Get monthly goal
        const settings = window.StateManager?.get('settings') || 
                        JSON.parse(localStorage.getItem('mrcrm_state') || '{}')?.settings || {};
        this._state.stats.monthlyGoal = settings.goal || 70000;
    },
    
    // ==========================================
    // CALCULATIONS
    // ==========================================
    
    /**
     * Calculate all dashboard statistics
     * @private
     */
    _calculateStats() {
        const { leads, clients, revenue, tasks } = this._state.data;
        const today = new Date().toISOString().slice(0, 10);
        
        // Lead stats
        this._state.stats.totalLeads = leads.length;
        this._state.stats.activeLeads = leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').length;
        this._state.stats.wonLeads = leads.filter(l => l.status === 'Won').length;
        
        // Client stats
        this._state.stats.totalClients = clients.length;
        this._state.stats.activeClients = clients.filter(c => c.status === 'Active').length;
        
        // Revenue stats
        this._state.stats.totalRevenue = revenue.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        this._state.stats.collectedRevenue = this._state.stats.totalRevenue;
        this._state.stats.remainingRevenue = Math.max(0, this._state.stats.monthlyGoal - this._state.stats.totalRevenue);
        this._state.stats.revenuePercent = this._state.stats.monthlyGoal > 0 
            ? Math.min(100, Math.round((this._state.stats.totalRevenue / this._state.stats.monthlyGoal) * 100))
            : 0;
        
        // Revenue forecast (won deals + 30% of pipeline)
        const pipelineValue = leads
            .filter(l => l.status !== 'Won' && l.status !== 'Lost')
            .reduce((sum, l) => sum + (parseFloat(l.dealValue) || 0), 0);
        const wonValue = leads
            .filter(l => l.status === 'Won')
            .reduce((sum, l) => sum + (parseFloat(l.dealValue) || 0), 0);
        this._state.stats.forecastRevenue = wonValue + (pipelineValue * 0.3);
        
        // Task stats
        this._state.stats.pendingTasks = tasks.filter(t => t.status !== 'Completed').length;
        this._state.stats.todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'Completed').length;
        this._state.stats.overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Completed').length;
        
        // Today's activity
        const todayHistory = Array.isArray(this._state.data.history) 
            ? this._state.data.history.filter(h => h.date === today)
            : [];
        this._state.stats.todayCalls = todayHistory.filter(h => h.type === 'call').length;
        this._state.stats.todayFollowups = todayHistory.filter(h => h.type === 'followup').length;
        this._state.stats.todayMeetings = todayHistory.filter(h => h.type === 'meeting').length;
        
        // Required per day
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
        this._state.stats.requiredPerDay = Math.round(this._state.stats.remainingRevenue / daysLeft);
    },
    
    // ==========================================
    // RENDERING
    // ==========================================
    
    /**
     * Render all dashboard components
     * @private
     */
    _renderAll() {
        this._renderWelcome();
        this._renderStatCards();
        this._renderRevenueGoal();
        this._renderActivityFeed();
        this._renderTaskList();
        this._renderQuickActions();
    },
    
    /**
     * Update display values only (no re-render)
     * @private
     */
    _updateDisplay() {
        this._updateStatCards();
        this._updateRevenueGoal();
        this._updateActivityFeed();
        this._updateTaskList();
    },
    
    /**
     * Render welcome section
     * @private
     */
    _renderWelcome() {
        // Set user name
        const userName = window.auth?.state?.userProfile?.displayName || 
                        window.auth?.state?.user?.displayName || 
                        'User';
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = userName;
        
        // Set date
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateEl = document.getElementById('welcome-date');
        if (dateEl) {
            dateEl.textContent = `Here's what's happening with your business today — ${now.toLocaleDateString('en-IN', options)}`;
        }
    },
    
    /**
     * Render stat cards
     * @private
     */
    _renderStatCards() {
        const stats = this._state.stats;
        
        this._setElementText('stat-revenue', Formatters.currency(stats.collectedRevenue));
        this._setElementText('stat-leads', stats.activeLeads.toString());
        this._setElementText('stat-clients', stats.totalClients.toString());
        this._setElementText('stat-tasks', stats.pendingTasks.toString());
        
        // Change indicators
        this._setElementText('stat-revenue-change', `📊 ${stats.revenuePercent}% of goal`);
        this._setElementText('stat-leads-change', `🏆 ${stats.wonLeads} won`);
        this._setElementText('stat-clients-change', `✅ ${stats.activeClients} active`);
        this._setElementText('stat-tasks-change', `⚠️ ${stats.overdueTasks} overdue`);
    },
    
    /**
     * Update stat card values
     * @private
     */
    _updateStatCards() {
        this._renderStatCards();
    },
    
    /**
     * Render revenue goal section
     * @private
     */
    _renderRevenueGoal() {
        const stats = this._state.stats;
        
        this._setElementText('revenue-goal-text', Formatters.currency(stats.monthlyGoal));
        this._setElementText('revenue-collected-label', `Collected: ${Formatters.currency(stats.collectedRevenue)}`);
        this._setElementText('revenue-percent-label', `${stats.revenuePercent}%`);
        this._setElementText('revenue-remaining-label', `Remaining: ${Formatters.currency(stats.remainingRevenue)}`);
        this._setElementText('revenue-daily-label', `Required/day: ${Formatters.currency(stats.requiredPerDay)}`);
        
        // Progress bar
        const progressBar = document.getElementById('revenue-bar-fill');
        if (progressBar) {
            progressBar.style.width = stats.revenuePercent + '%';
        }
        
        // Forecast
        this._setElementText('forecast-value', Formatters.currency(stats.forecastRevenue));
    },
    
    /**
     * Update revenue goal display
     * @private
     */
    _updateRevenueGoal() {
        this._renderRevenueGoal();
    },
    
    /**
     * Render activity feed
     * @private
     */
    _renderActivityFeed() {
        const container = document.getElementById('activity-list');
        if (!container) return;
        
        const history = Array.isArray(this._state.data.history) 
            ? this._state.data.history.slice(0, this._config.activityLimit)
            : [];
        
        if (history.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#999">
                    <div style="font-size:2.5rem;margin-bottom:8px">📜</div>
                    <p style="font-weight:500">No recent activity</p>
                    <p style="font-size:0.85rem">Your activity will appear here</p>
                </div>
            `;
            return;
        }
        
        const iconMap = {
            call: '📞', whatsapp: '💬', meeting: '📅', lead: '📋',
            won: '🏆', lost: '❌', revenue: '💰', followup: '🔄',
            update: '✏️', create: '➕', delete: '🗑️'
        };
        
        const dotClassMap = {
            call: 'call', whatsapp: 'whatsapp', meeting: 'meeting',
            lead: 'lead', won: 'won', lost: 'lost', revenue: 'revenue'
        };
        
        container.innerHTML = history.map(h => {
            const icon = iconMap[h.type] || '📌';
            const dotClass = dotClassMap[h.type] || 'lead';
            const time = Formatters.relativeTime(h.timestamp);
            
            return `
                <div class="activity-item">
                    <div class="activity-dot ${dotClass}"></div>
                    <div class="activity-content">
                        <div class="activity-text">${icon} ${h.desc || 'Activity'}</div>
                        <div class="activity-meta">${time}${h.leadName ? ' · ' + h.leadName : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * Update activity feed
     * @private
     */
    _updateActivityFeed() {
        this._renderActivityFeed();
    },
    
    /**
     * Render task list
     * @private
     */
    _renderTaskList() {
        const container = document.getElementById('tasks-list');
        if (!container) return;
        
        const tasks = this._state.data.tasks || [];
        const today = new Date().toISOString().slice(0, 10);
        
        // Get today's and overdue tasks
        const relevantTasks = tasks
            .filter(t => t.status !== 'Completed')
            .filter(t => t.dueDate && t.dueDate <= today)
            .slice(0, this._config.taskLimit);
        
        if (relevantTasks.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#999">
                    <div style="font-size:2.5rem;margin-bottom:8px">🎉</div>
                    <p style="font-weight:500">No pending tasks for today!</p>
                    <p style="font-size:0.85rem">Great job staying on top of things.</p>
                </div>
            `;
            return;
        }
        
        const priorityColors = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981' };
        
        container.innerHTML = relevantTasks.map(task => {
            const isOverdue = task.dueDate && task.dueDate < today;
            const priorityColor = priorityColors[task.priority] || '#888';
            
            return `
                <div class="task-item ${isOverdue ? 'overdue' : ''}" 
                     onclick="DashboardModule.openTask('${task.id}')"
                     style="padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.04);margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:12px;${isOverdue ? 'border-left:4px solid #EF4444;background:rgba(239,68,68,0.02)' : ''}">
                    <div class="task-checkbox" onclick="event.stopPropagation();DashboardModule.toggleTask('${task.id}')" style="width:22px;height:22px;border-radius:8px;border:2px solid rgba(0,0,0,0.15);cursor:pointer;flex-shrink:0"></div>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:0.9rem;color:#333">${task.title || 'Untitled Task'}</div>
                        <div style="font-size:0.78rem;color:#999">
                            ${isOverdue ? '⚠️ Overdue' : '📅 Due today'} 
                            ${task.priority ? `· <span style="color:${priorityColor};font-weight:500">${task.priority}</span>` : ''}
                            ${task.relatedName ? `· ${task.relatedName}` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation();DashboardModule.completeTask('${task.id}')" title="Complete">✅</button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * Update task list
     * @private
     */
    _updateTaskList() {
        this._renderTaskList();
    },
    
    /**
     * Render quick actions
     * @private
     */
    _renderQuickActions() {
        // Quick actions are static - no dynamic rendering needed
        // But we can update counts if needed
    },
    
    // ==========================================
    // ACTIONS
    // ==========================================
    
    /**
     * Toggle task completion
     * @param {string} taskId - Task ID
     */
    toggleTask(taskId) {
        const tasks = this._state.data.tasks;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
        
        // Save
        if (window.StateManager) {
            window.StateManager.set('data.tasks', tasks);
        }
        
        if (window.EventBus) {
            window.EventBus.emit('task:updated', { task });
        }
        
        this._updateTaskList();
    },
    
    /**
     * Complete a task
     * @param {string} taskId - Task ID
     */
    completeTask(taskId) {
        const tasks = this._state.data.tasks;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.status = 'Completed';
        task.completedAt = new Date().toISOString();
        
        // Save
        if (window.StateManager) {
            window.StateManager.set('data.tasks', tasks);
        }
        
        if (window.EventBus) {
            window.EventBus.emit('task:completed', { task });
        }
        
        // Show toast
        if (window.Toast) {
            window.Toast.success('Task completed! ✅');
        }
        
        this._updateTaskList();
    },
    
    /**
     * Open task details
     * @param {string} taskId - Task ID
     */
    openTask(taskId) {
        // Navigate to task
        if (window.Router) {
            window.Router.navigateTo('tasks');
        }
    },
    
    // ==========================================
    // UI HELPERS
    // ==========================================
    
    /**
     * Set element text content safely
     * @param {string} id - Element ID
     * @param {string} text - Text content
     * @private
     */
    _setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },
    
    /**
     * Show/hide loading state
     * @param {boolean} show - Show loading
     * @private
     */
    _showLoading(show) {
        // Could add skeleton loading here
    },
    
    /**
     * Show error message
     * @param {string} message - Error message
     * @private
     */
    _showError(message) {
        if (window.Toast) {
            window.Toast.error(message);
        }
        console.error(message);
    },
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /**
     * Get dashboard statistics
     * @returns {Object} Dashboard stats
     */
    getStats() {
        return { ...this._state.stats };
    },
    
    /**
     * Get raw dashboard data
     * @returns {Object} Dashboard data
     */
    getData() {
        return { ...this._state.data };
    },
    
    /**
     * Force refresh dashboard
     */
    refresh() {
        return this.loadDashboard();
    },
    
    /**
     * Destroy dashboard module
     */
    destroy() {
        if (this._state.refreshInterval) {
            clearInterval(this._state.refreshInterval);
        }
        
        if (window.EventBus) {
            window.EventBus.off('lead:created');
            window.EventBus.off('lead:updated');
            window.EventBus.off('client:created');
            window.EventBus.off('revenue:added');
            window.EventBus.off('task:completed');
        }
        
        console.log('📊 Dashboard module destroyed');
    }
};

// ==========================================
// AUTO-INITIALIZE ON DASHBOARD PAGE
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Check if we're on dashboard page
        if (document.querySelector('.dashboard-container') || 
            document.getElementById('stat-revenue')) {
            DashboardModule.init();
        }
    });
} else {
    if (document.querySelector('.dashboard-container') || 
        document.getElementById('stat-revenue')) {
        DashboardModule.init();
    }
}

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.DashboardModule = DashboardModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardModule;
}

// ==========================================
// END OF DASHBOARD MODULE
// ==========================================


