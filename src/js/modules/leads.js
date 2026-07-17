/* ==========================================
   11 AVATAR DIGITAL HUB
   Leads Management Module
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Lead CRUD operations
   - Lead filtering & search
   - Lead status management
   - Lead scoring
   - Bulk operations (import/export)
   - Lead assignment
   - Follow-up scheduling
   - Lead timeline tracking
   - WhatsApp integration
   - Data validation
   ========================================== */

const LeadsModule = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _state: {
        leads: [],
        filteredLeads: [],
        selectedLead: null,
        loading: false,
        filters: {
            search: '',
            status: '',
            source: '',
            service: '',
            assignedTo: '',
            dateFrom: '',
            dateTo: ''
        },
        sort: {
            field: 'createdDate',
            direction: 'desc'
        },
        pagination: {
            page: 1,
            pageSize: 25,
            total: 0
        }
    },
    
    _config: {
        enableAutoSave: true,
        enableRealTime: true,
        defaultFollowupDays: 2,
        maxDealValue: 100000000,
        sources: [
            'Cold Calling', 'WhatsApp', 'Website', 'Referral',
            'Facebook Ads', 'Google Ads', 'Instagram', 'LinkedIn', 'Other'
        ],
        services: [
            'SEO', 'Google Ads', 'Social Media', 'Website',
            'Video Editing', 'CRO', 'Content Writing', 'Other'
        ],
        statuses: [
            'New', 'Attempting Contact', 'Connected', 'Qualified',
            'Discovery Call Booked', 'Discovery Call Completed',
            'Proposal Sent', 'Negotiation', 'Verbal Yes',
            'Invoice Sent', 'Won', 'Lost'
        ]
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    /**
     * Initialize leads module
     * @param {Object} config - Configuration options
     */
    init(config = {}) {
        Object.assign(this._config, config);
        
        this._setupEventListeners();
        this.loadLeads();
        
        console.log('📋 Leads module initialized');
    },
    
    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        if (!window.EventBus) return;
        
        window.EventBus.on('lead:created', (data) => {
            this._state.leads.unshift(data.lead);
            this._applyFilters();
            this._updateStats();
        });
        
        window.EventBus.on('lead:updated', (data) => {
            const index = this._state.leads.findIndex(l => l.id === data.lead.id);
            if (index > -1) {
                this._state.leads[index] = { ...this._state.leads[index], ...data.lead };
            }
            this._applyFilters();
            this._updateStats();
        });
        
        window.EventBus.on('lead:deleted', (data) => {
            this._state.leads = this._state.leads.filter(l => l.id !== data.leadId);
            this._applyFilters();
            this._updateStats();
        });
        
        window.EventBus.on('data:imported', () => this.loadLeads());
    },
    
    // ==========================================
    // DATA LOADING
    // ==========================================
    
    /**
     * Load leads from storage
     */
    loadLeads() {
        this._state.loading = true;
        
        try {
            // Load from StateManager
            if (window.StateManager) {
                this._state.leads = window.StateManager.get('data.leads') || [];
            } else {
                // Fallback to localStorage
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                this._state.leads = saved.leads || [];
            }
            
            this._applyFilters();
            this._updateStats();
            
        } catch (error) {
            console.error('❌ Failed to load leads:', error);
            if (window.Toast) {
                window.Toast.error('Failed to load leads');
            }
        } finally {
            this._state.loading = false;
        }
    },
    
    /**
     * Save leads to storage
     * @private
     */
    _saveLeads() {
        if (!this._config.enableAutoSave) return;
        
        try {
            if (window.StateManager) {
                window.StateManager.set('data.leads', this._state.leads);
            } else {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                saved.leads = this._state.leads;
                localStorage.setItem('mrcrm_state', JSON.stringify(saved));
            }
        } catch (error) {
            console.error('❌ Failed to save leads:', error);
        }
    },
    
    // ==========================================
    // CRUD OPERATIONS
    // ==========================================
    
    /**
     * Create a new lead
     * @param {Object} leadData - Lead data
     * @returns {Object} Created lead
     */
    createLead(leadData) {
        // Validate required fields
        if (!leadData.name || !leadData.name.trim()) {
            throw new Error('Lead name is required');
        }
        
        if (!leadData.mobile || !/^[6-9]\d{9}$/.test(leadData.mobile.replace(/\D/g, ''))) {
            throw new Error('Valid 10-digit mobile number is required');
        }
        
        // Check for duplicate mobile
        const existingMobile = this._state.leads.find(
            l => l.mobile === leadData.mobile && l.status !== 'Lost'
        );
        
        if (existingMobile) {
            throw new Error(`A lead with mobile ${leadData.mobile} already exists (${existingMobile.name})`);
        }
        
        const now = new Date().toISOString();
        const followupDays = this._config.defaultFollowupDays;
        const followupDate = new Date();
        followupDate.setDate(followupDate.getDate() + followupDays);
        
        const lead = {
            id: 'LD' + Date.now().toString(36).toUpperCase(),
            name: leadData.name.trim(),
            mobile: leadData.mobile.replace(/\D/g, ''),
            email: (leadData.email || '').trim(),
            business: (leadData.business || '').trim(),
            website: (leadData.website || '').trim(),
            city: (leadData.city || '').trim(),
            source: leadData.source || 'Direct',
            service: leadData.service || '',
            dealValue: parseFloat(leadData.dealValue) || 0,
            status: leadData.status || 'New',
            notes: (leadData.notes || '').trim(),
            score: this._calculateScore(leadData),
            followupDate: leadData.followupDate || followupDate.toISOString().slice(0, 10),
            followupNotes: (leadData.followupNotes || '').trim(),
            lastContactDate: '',
            closeDate: leadData.closeDate || '',
            assignedTo: leadData.assignedTo || '',
            createdDate: now.slice(0, 10),
            createdAt: now,
            updatedAt: now,
            createdBy: window.auth?.state?.user?.uid || 'anonymous'
        };
        
        // Add to state
        this._state.leads.unshift(lead);
        this._saveLeads();
        this._applyFilters();
        this._updateStats();
        
        // Add to history
        this._addHistory('lead', `Lead created: ${lead.name}`, lead.id, lead.name);
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('lead:created', { lead });
        }
        
        // Show toast
        if (window.Toast) {
            window.Toast.success(`Lead "${lead.name}" created successfully!`);
        }
        
        console.log('📋 Lead created:', lead.id, lead.name);
        
        return lead;
    },
    
    /**
     * Update an existing lead
     * @param {string} leadId - Lead ID
     * @param {Object} leadData - Updated lead data
     * @returns {Object} Updated lead
     */
    updateLead(leadId, leadData) {
        const index = this._state.leads.findIndex(l => l.id === leadId);
        
        if (index === -1) {
            throw new Error('Lead not found');
        }
        
        const existingLead = this._state.leads[index];
        const previousStatus = existingLead.status;
        
        // Update lead
        const updatedLead = {
            ...existingLead,
            ...leadData,
            id: leadId, // Prevent ID change
            updatedAt: new Date().toISOString(),
            score: this._calculateScore({ ...existingLead, ...leadData })
        };
        
        this._state.leads[index] = updatedLead;
        this._saveLeads();
        this._applyFilters();
        this._updateStats();
        
        // Track status change
        if (leadData.status && leadData.status !== previousStatus) {
            this._addHistory(
                'status_change',
                `Lead status changed: ${previousStatus} → ${leadData.status} for ${updatedLead.name}`,
                leadId,
                updatedLead.name
            );
            
            // Auto-create client if won
            if (leadData.status === 'Won') {
                this._convertToClient(updatedLead);
            }
        } else {
            this._addHistory('update', `Lead updated: ${updatedLead.name}`, leadId, updatedLead.name);
        }
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('lead:updated', { lead: updatedLead, previousStatus });
        }
        
        // Show toast
        if (window.Toast) {
            window.Toast.success(`Lead "${updatedLead.name}" updated!`);
        }
        
        console.log('📋 Lead updated:', leadId);
        
        return updatedLead;
    },
    
    /**
     * Delete a lead
     * @param {string} leadId - Lead ID
     * @returns {boolean} Success
     */
    deleteLead(leadId) {
        const lead = this._state.leads.find(l => l.id === leadId);
        
        if (!lead) {
            throw new Error('Lead not found');
        }
        
        this._state.leads = this._state.leads.filter(l => l.id !== leadId);
        this._saveLeads();
        this._applyFilters();
        this._updateStats();
        
        // Add to history
        this._addHistory('delete', `Lead deleted: ${lead.name}`, leadId, lead.name);
        
        // Emit event
        if (window.EventBus) {
            window.EventBus.emit('lead:deleted', { leadId, leadName: lead.name });
        }
        
        // Show toast
        if (window.Toast) {
            window.Toast.info(`Lead "${lead.name}" deleted`);
        }
        
        console.log('📋 Lead deleted:', leadId);
        
        return true;
    },
    
    /**
     * Get a lead by ID
     * @param {string} leadId - Lead ID
     * @returns {Object|null} Lead object
     */
    getLead(leadId) {
        return this._state.leads.find(l => l.id === leadId) || null;
    },
    
    /**
     * Get all leads
     * @returns {Array} All leads
     */
    getAllLeads() {
        return [...this._state.leads];
    },
    
    /**
     * Get filtered leads
     * @returns {Array} Filtered leads
     */
    getFilteredLeads() {
        return [...this._state.filteredLeads];
    },
    
    // ==========================================
    // BULK OPERATIONS
    // ==========================================
    
    /**
     * Bulk update lead status
     * @param {string[]} leadIds - Array of lead IDs
     * @param {string} status - New status
     */
    bulkUpdateStatus(leadIds, status) {
        if (!leadIds || leadIds.length === 0) return;
        
        let updatedCount = 0;
        
        leadIds.forEach(leadId => {
            const lead = this._state.leads.find(l => l.id === leadId);
            if (lead) {
                lead.status = status;
                lead.updatedAt = new Date().toISOString();
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            this._saveLeads();
            this._applyFilters();
            this._updateStats();
            
            if (window.EventBus) {
                window.EventBus.emit('lead:bulkUpdated', { count: updatedCount, status });
            }
        }
        
        return updatedCount;
    },
    
    /**
     * Bulk delete leads
     * @param {string[]} leadIds - Array of lead IDs
     */
    bulkDelete(leadIds) {
        if (!leadIds || leadIds.length === 0) return 0;
        
        const before = this._state.leads.length;
        this._state.leads = this._state.leads.filter(l => !leadIds.includes(l.id));
        const deleted = before - this._state.leads.length;
        
        if (deleted > 0) {
            this._saveLeads();
            this._applyFilters();
            this._updateStats();
        }
        
        return deleted;
    },
    
    /**
     * Export leads to JSON
     * @returns {string} JSON string
     */
    exportLeads() {
        const data = JSON.stringify(this._state.leads, null, 2);
        const filename = `leads_export_${new Date().toISOString().slice(0, 10)}.json`;
        
        if (window.Helpers) {
            window.Helpers.downloadFile(data, filename, 'application/json');
        }
        
        return data;
    },
    
    /**
     * Import leads from JSON array
     * @param {Array} leadsData - Array of lead objects
     * @returns {number} Number of leads imported
     */
    importLeads(leadsData) {
        if (!Array.isArray(leadsData) || leadsData.length === 0) {
            throw new Error('No valid leads data to import');
        }
        
        let imported = 0;
        let skipped = 0;
        
        leadsData.forEach(data => {
            // Basic validation
            if (!data.name || !data.mobile) {
                skipped++;
                return;
            }
            
            // Check for duplicate mobile
            const exists = this._state.leads.find(l => l.mobile === data.mobile);
            if (exists) {
                skipped++;
                return;
            }
            
            // Create lead with import data
            const lead = {
                ...data,
                id: data.id || 'LD' + Date.now().toString(36).toUpperCase() + imported,
                createdDate: data.createdDate || new Date().toISOString().slice(0, 10),
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                score: this._calculateScore(data)
            };
            
            this._state.leads.unshift(lead);
            imported++;
        });
        
        if (imported > 0) {
            this._saveLeads();
            this._applyFilters();
            this._updateStats();
            
            if (window.EventBus) {
                window.EventBus.emit('data:imported', { count: imported, skipped });
            }
        }
        
        return { imported, skipped };
    },
    
    // ==========================================
    // FILTERING & SEARCH
    // ==========================================
    
    /**
     * Set filter value
     * @param {string} key - Filter key
     * @param {string} value - Filter value
     */
    setFilter(key, value) {
        this._state.filters[key] = value;
        this._state.pagination.page = 1;
        this._applyFilters();
    },
    
    /**
     * Clear all filters
     */
    clearFilters() {
        this._state.filters = {
            search: '',
            status: '',
            source: '',
            service: '',
            assignedTo: '',
            dateFrom: '',
            dateTo: ''
        };
        this._state.pagination.page = 1;
        this._applyFilters();
    },
    
    /**
     * Apply filters and sorting to leads
     * @private
     */
    _applyFilters() {
        let filtered = [...this._state.leads];
        const filters = this._state.filters;
        
        // Search filter
        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(l =>
                (l.name && l.name.toLowerCase().includes(search)) ||
                (l.mobile && l.mobile.includes(search)) ||
                (l.email && l.email.toLowerCase().includes(search)) ||
                (l.business && l.business.toLowerCase().includes(search))
            );
        }
        
        // Status filter
        if (filters.status) {
            filtered = filtered.filter(l => l.status === filters.status);
        }
        
        // Source filter
        if (filters.source) {
            filtered = filtered.filter(l => l.source === filters.source);
        }
        
        // Service filter
        if (filters.service) {
            filtered = filtered.filter(l => l.service === filters.service);
        }
        
        // Assigned to filter
        if (filters.assignedTo) {
            filtered = filtered.filter(l => l.assignedTo === filters.assignedTo);
        }
        
        // Date range filter
        if (filters.dateFrom) {
            filtered = filtered.filter(l => l.createdDate >= filters.dateFrom);
        }
        if (filters.dateTo) {
            filtered = filtered.filter(l => l.createdDate <= filters.dateTo);
        }
        
        // Sort
        const sort = this._state.sort;
        filtered.sort((a, b) => {
            const valA = a[sort.field] || '';
            const valB = b[sort.field] || '';
            
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Pagination
        this._state.pagination.total = filtered.length;
        const start = (this._state.pagination.page - 1) * this._state.pagination.pageSize;
        const end = start + this._state.pagination.pageSize;
        
        this._state.filteredLeads = filtered.slice(start, end);
        
        // Update display
        this._renderLeadList();
    },
    
    // ==========================================
    // STATISTICS
    // ==========================================
    
    /**
     * Update lead statistics
     * @private
     */
    _updateStats() {
        const leads = this._state.leads;
        const today = new Date().toISOString().slice(0, 10);
        
        const stats = {
            total: leads.length,
            new: leads.filter(l => l.status === 'New').length,
            active: leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').length,
            won: leads.filter(l => l.status === 'Won').length,
            lost: leads.filter(l => l.status === 'Lost').length,
            todayCreated: leads.filter(l => l.createdDate === today).length,
            pipelineValue: leads
                .filter(l => l.status !== 'Won' && l.status !== 'Lost')
                .reduce((sum, l) => sum + (parseFloat(l.dealValue) || 0), 0),
            wonValue: leads
                .filter(l => l.status === 'Won')
                .reduce((sum, l) => sum + (parseFloat(l.dealValue) || 0), 0),
            needsFollowup: leads.filter(l =>
                l.followupDate && l.followupDate <= today &&
                l.status !== 'Won' && l.status !== 'Lost'
            ).length
        };
        
        // Update stats display
        this._renderStats(stats);
        
        return stats;
    },
    
    /**
     * Get lead statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return this._updateStats();
    },
    
    // ==========================================
    // LEAD SCORING
    // ==========================================
    
    /**
     * Calculate lead score based on data completeness
     * @param {Object} lead - Lead data
     * @returns {number} Score (0-100)
     * @private
     */
    _calculateScore(lead) {
        let score = 0;
        
        if (lead.name) score += 5;
        if (lead.mobile && lead.mobile.length === 10) score += 10;
        if (lead.email && lead.email.includes('@')) score += 8;
        if (lead.business) score += 5;
        if (lead.website) score += 3;
        if (lead.city) score += 2;
        if (lead.source && ['Referral', 'Website'].includes(lead.source)) score += 10;
        if (lead.dealValue && parseFloat(lead.dealValue) > 0) score += 15;
        if (lead.service) score += 5;
        if (lead.notes && lead.notes.length > 20) score += 5;
        
        return Math.min(score, 100);
    },
    
    // ==========================================
    // FOLLOW-UP MANAGEMENT
    // ==========================================
    
    /**
     * Schedule follow-up for a lead
     * @param {string} leadId - Lead ID
     * @param {string} date - Follow-up date (YYYY-MM-DD)
     * @param {string} notes - Follow-up notes
     */
    scheduleFollowup(leadId, date, notes = '') {
        const lead = this._state.leads.find(l => l.id === leadId);
        if (!lead) throw new Error('Lead not found');
        
        lead.followupDate = date;
        lead.followupNotes = notes;
        lead.updatedAt = new Date().toISOString();
        
        this._saveLeads();
        
        this._addHistory(
            'followup',
            `Follow-up scheduled for ${lead.name} on ${date}`,
            leadId,
            lead.name,
            notes
        );
        
        if (window.EventBus) {
            window.EventBus.emit('lead:updated', { lead });
        }
        
        return lead;
    },
    
    /**
     * Get leads needing follow-up today
     * @returns {Array} Leads needing follow-up
     */
    getFollowupLeads() {
        const today = new Date().toISOString().slice(0, 10);
        
        return this._state.leads.filter(l =>
            l.followupDate && l.followupDate <= today &&
            l.status !== 'Won' && l.status !== 'Lost'
        );
    },
    
    // ==========================================
    // WHATSAPP INTEGRATION
    // ==========================================
    
    /**
     * Open WhatsApp chat for a lead
     * @param {string} leadId - Lead ID
     */
    openWhatsApp(leadId) {
        const lead = this._state.leads.find(l => l.id === leadId);
        if (!lead || !lead.mobile) return;
        
        const mobile = lead.mobile.replace(/\D/g, '');
        if (mobile.length === 10) {
            window.open(`https://wa.me/91${mobile}`, '_blank');
            
            // Log activity
            this._addHistory('whatsapp', `WhatsApp opened for ${lead.name}`, leadId, lead.name);
            
            // Update last contact
            lead.lastContactDate = new Date().toISOString().slice(0, 10);
            this._saveLeads();
        }
    },
    
    /**
     * Call a lead
     * @param {string} leadId - Lead ID
     */
    callLead(leadId) {
        const lead = this._state.leads.find(l => l.id === leadId);
        if (!lead || !lead.mobile) return;
        
        window.location.href = `tel:${lead.mobile}`;
        
        // Log activity
        this._addHistory('call', `Called ${lead.name}`, leadId, lead.name);
        
        // Update last contact
        lead.lastContactDate = new Date().toISOString().slice(0, 10);
        this._saveLeads();
    },
    
    // ==========================================
    // AUTO-CONVERSION
    // ==========================================
    
    /**
     * Convert won lead to client
     * @param {Object} lead - Lead object
     * @private
     */
    _convertToClient(lead) {
        const client = {
            id: 'CL' + Date.now().toString(36).toUpperCase(),
            name: lead.name,
            business: lead.business || '',
            mobile: lead.mobile || '',
            email: lead.email || '',
            city: lead.city || '',
            dealValue: parseFloat(lead.dealValue) || 0,
            status: 'Active',
            leadId: lead.id,
            mrr: 0,
            renewalDate: '',
            notes: lead.notes || '',
            createdDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add to clients
        if (window.StateManager) {
            const clients = window.StateManager.get('data.clients') || [];
            clients.unshift(client);
            window.StateManager.set('data.clients', clients);
        }
        
        // Create project if service exists
        if (lead.service && window.StateManager) {
            const project = {
                id: 'PRJ' + Date.now().toString(36).toUpperCase(),
                name: `${lead.service} - ${lead.name}`,
                clientName: lead.name,
                clientId: client.id,
                service: lead.service,
                startDate: new Date().toISOString().slice(0, 10),
                dueDate: '',
                status: 'Planning',
                progress: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const projects = window.StateManager.get('data.projects') || [];
            projects.unshift(project);
            window.StateManager.set('data.projects', projects);
        }
        
        if (window.EventBus) {
            window.EventBus.emit('client:created', { client });
        }
        
        console.log('🏆 Lead converted to client:', lead.name);
    },
    
    // ==========================================
    // HISTORY TRACKING
    // ==========================================
    
    /**
     * Add entry to activity history
     * @param {string} type - Activity type
     * @param {string} desc - Description
     * @param {string} leadId - Lead ID
     * @param {string} leadName - Lead name
     * @param {string} details - Additional details
     * @private
     */
    _addHistory(type, desc, leadId, leadName, details = '') {
        if (window.StateManager) {
            const history = window.StateManager.get('data.history') || [];
            history.unshift({
                id: 'HST' + Date.now().toString(36),
                type,
                desc,
                leadId,
                leadName,
                details,
                date: new Date().toISOString().slice(0, 10),
                timestamp: new Date().toISOString()
            });
            
            // Keep max 500 entries
            if (history.length > 500) {
                history.length = 500;
            }
            
            window.StateManager.set('data.history', history);
        }
    },
    
    // ==========================================
    // RENDERING
    // ==========================================
    
    /**
     * Render lead list in the DOM
     * @private
     */
    _renderLeadList() {
        const container = document.getElementById('leads-grid');
        if (!container) return;
        
        const leads = this._state.filteredLeads;
        
        if (leads.length === 0) {
            container.innerHTML = `
                <div class="empty-state-3d" style="grid-column:1/-1">
                    <div class="empty-icon-3d">📭</div>
                    <h3>No leads found</h3>
                    <p style="color:#999">${this._state.filters.search || this._state.filters.status ? 'Try adjusting your filters' : 'Click "New Lead" to get started'}</p>
                </div>
            `;
            return;
        }
        
        // Delegate to page-specific renderer
        if (typeof window.renderLeadCards === 'function') {
            window.renderLeadCards(leads);
        }
    },
    
    /**
     * Render statistics display
     * @param {Object} stats - Statistics
     * @private
     */
    _renderStats(stats) {
        this._setText('stat-total', stats.total);
        this._setText('stat-active', stats.active);
        this._setText('stat-won', stats.won);
        this._setText('stat-value', Formatters.currency(stats.pipelineValue));
        this._setText('stat-followups', stats.needsFollowup);
    },
    
    /**
     * Set element text safely
     * @param {string} id - Element ID
     * @param {*} value - Value
     * @private
     */
    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    /**
     * Refresh leads data
     */
    refresh() {
        return this.loadLeads();
    },
    
    /**
     * Destroy module
     */
    destroy() {
        if (window.EventBus) {
            window.EventBus.off('lead:created');
            window.EventBus.off('lead:updated');
            window.EventBus.off('lead:deleted');
        }
        
        console.log('📋 Leads module destroyed');
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.LeadsModule = LeadsModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeadsModule;
}

// ==========================================
// END OF LEADS MODULE
// ==========================================

