/* ==========================================
   11 AVATAR DIGITAL HUB
   Clients Management Module
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Client CRUD operations
   - Client filtering & search
   - Client status management
   - MRR & revenue tracking per client
   - Client health scoring
   - Related projects & retainers
   - Contact history
   - WhatsApp integration
   - Import/Export
   - Data validation
   ========================================== */

const ClientsModule = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _state: {
        clients: [],
        filteredClients: [],
        selectedClient: null,
        loading: false,
        filters: {
            search: '',
            status: '',
            city: '',
            minDealValue: '',
            maxDealValue: ''
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
        statuses: ['Active', 'Paused', 'Ended', 'Onboarding'],
        healthThresholds: {
            excellent: 90,
            good: 70,
            fair: 50,
            poor: 30,
            critical: 0
        }
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    init(config = {}) {
        Object.assign(this._config, config);
        this._setupEventListeners();
        this.loadClients();
        console.log('👥 Clients module initialized');
    },
    
    _setupEventListeners() {
        if (!window.EventBus) return;
        
        window.EventBus.on('client:created', (data) => {
            this._state.clients.unshift(data.client);
            this._applyFilters();
            this._updateStats();
        });
        
        window.EventBus.on('client:updated', (data) => {
            const index = this._state.clients.findIndex(c => c.id === data.client.id);
            if (index > -1) {
                this._state.clients[index] = { ...this._state.clients[index], ...data.client };
            }
            this._applyFilters();
            this._updateStats();
        });
        
        window.EventBus.on('client:deleted', (data) => {
            this._state.clients = this._state.clients.filter(c => c.id !== data.clientId);
            this._applyFilters();
            this._updateStats();
        });
    },
    
    // ==========================================
    // DATA LOADING
    // ==========================================
    
    loadClients() {
        this._state.loading = true;
        
        try {
            if (window.StateManager) {
                this._state.clients = window.StateManager.get('data.clients') || [];
            } else {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                this._state.clients = saved.clients || [];
            }
            
            this._applyFilters();
            this._updateStats();
        } catch (error) {
            console.error('❌ Failed to load clients:', error);
            if (window.Toast) window.Toast.error('Failed to load clients');
        } finally {
            this._state.loading = false;
        }
    },
    
    _saveClients() {
        if (!this._config.enableAutoSave) return;
        
        try {
            if (window.StateManager) {
                window.StateManager.set('data.clients', this._state.clients);
            } else {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                saved.clients = this._state.clients;
                localStorage.setItem('mrcrm_state', JSON.stringify(saved));
            }
        } catch (error) {
            console.error('❌ Failed to save clients:', error);
        }
    },
    
    // ==========================================
    // CRUD OPERATIONS
    // ==========================================
    
    createClient(clientData) {
        if (!clientData.name || !clientData.name.trim()) {
            throw new Error('Client name is required');
        }
        
        const now = new Date().toISOString();
        
        const client = {
            id: 'CL' + Date.now().toString(36).toUpperCase(),
            name: clientData.name.trim(),
            business: (clientData.business || '').trim(),
            mobile: (clientData.mobile || '').replace(/\D/g, ''),
            email: (clientData.email || '').trim(),
            city: (clientData.city || '').trim(),
            dealValue: parseFloat(clientData.dealValue) || 0,
            status: clientData.status || 'Active',
            mrr: parseFloat(clientData.mrr) || 0,
            renewalDate: clientData.renewalDate || '',
            notes: (clientData.notes || '').trim(),
            leadId: clientData.leadId || '',
            healthScore: 100,
            createdDate: now.slice(0, 10),
            createdAt: now,
            updatedAt: now
        };
        
        this._state.clients.unshift(client);
        this._saveClients();
        this._applyFilters();
        this._updateStats();
        
        if (window.EventBus) {
            window.EventBus.emit('client:created', { client });
        }
        
        if (window.Toast) {
            window.Toast.success(`Client "${client.name}" created!`);
        }
        
        return client;
    },
    
    updateClient(clientId, clientData) {
        const index = this._state.clients.findIndex(c => c.id === clientId);
        if (index === -1) throw new Error('Client not found');
        
        const updatedClient = {
            ...this._state.clients[index],
            ...clientData,
            id: clientId,
            updatedAt: new Date().toISOString()
        };
        
        this._state.clients[index] = updatedClient;
        this._saveClients();
        this._applyFilters();
        this._updateStats();
        
        if (window.EventBus) {
            window.EventBus.emit('client:updated', { client: updatedClient });
        }
        
        if (window.Toast) {
            window.Toast.success(`Client "${updatedClient.name}" updated!`);
        }
        
        return updatedClient;
    },
    
    deleteClient(clientId) {
        const client = this._state.clients.find(c => c.id === clientId);
        if (!client) throw new Error('Client not found');
        
        this._state.clients = this._state.clients.filter(c => c.id !== clientId);
        this._saveClients();
        this._applyFilters();
        this._updateStats();
        
        if (window.EventBus) {
            window.EventBus.emit('client:deleted', { clientId, clientName: client.name });
        }
        
        if (window.Toast) {
            window.Toast.info(`Client "${client.name}" deleted`);
        }
        
        return true;
    },
    
    getClient(clientId) {
        return this._state.clients.find(c => c.id === clientId) || null;
    },
    
    getAllClients() {
        return [...this._state.clients];
    },
    
    getFilteredClients() {
        return [...this._state.filteredClients];
    },
    
    // ==========================================
    // BULK OPERATIONS
    // ==========================================
    
    bulkUpdateStatus(clientIds, status) {
        if (!clientIds || clientIds.length === 0) return 0;
        
        let updated = 0;
        clientIds.forEach(id => {
            const client = this._state.clients.find(c => c.id === id);
            if (client) {
                client.status = status;
                client.updatedAt = new Date().toISOString();
                updated++;
            }
        });
        
        if (updated > 0) {
            this._saveClients();
            this._applyFilters();
            this._updateStats();
        }
        
        return updated;
    },
    
    exportClients() {
        const data = JSON.stringify(this._state.clients, null, 2);
        const filename = `clients_export_${new Date().toISOString().slice(0, 10)}.json`;
        if (window.Helpers) window.Helpers.downloadFile(data, filename, 'application/json');
        return data;
    },
    
    importClients(clientsData) {
        if (!Array.isArray(clientsData) || clientsData.length === 0) {
            throw new Error('No valid clients data');
        }
        
        let imported = 0;
        clientsData.forEach(data => {
            if (!data.name) return;
            
            const client = {
                ...data,
                id: data.id || 'CL' + Date.now().toString(36).toUpperCase() + imported,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this._state.clients.unshift(client);
            imported++;
        });
        
        if (imported > 0) {
            this._saveClients();
            this._applyFilters();
            this._updateStats();
        }
        
        return { imported };
    },
    
    // ==========================================
    // FILTERING
    // ==========================================
    
    setFilter(key, value) {
        this._state.filters[key] = value;
        this._state.pagination.page = 1;
        this._applyFilters();
    },
    
    clearFilters() {
        this._state.filters = {
            search: '', status: '', city: '',
            minDealValue: '', maxDealValue: ''
        };
        this._state.pagination.page = 1;
        this._applyFilters();
    },
    
    _applyFilters() {
        let filtered = [...this._state.clients];
        const f = this._state.filters;
        
        if (f.search) {
            const s = f.search.toLowerCase();
            filtered = filtered.filter(c =>
                (c.name && c.name.toLowerCase().includes(s)) ||
                (c.business && c.business.toLowerCase().includes(s)) ||
                (c.mobile && c.mobile.includes(s)) ||
                (c.email && c.email.toLowerCase().includes(s))
            );
        }
        
        if (f.status) filtered = filtered.filter(c => c.status === f.status);
        if (f.city) filtered = filtered.filter(c => c.city === f.city);
        if (f.minDealValue) filtered = filtered.filter(c => (parseFloat(c.dealValue) || 0) >= parseFloat(f.minDealValue));
        if (f.maxDealValue) filtered = filtered.filter(c => (parseFloat(c.dealValue) || 0) <= parseFloat(f.maxDealValue));
        
        const sort = this._state.sort;
        filtered.sort((a, b) => {
            const va = a[sort.field] || '';
            const vb = b[sort.field] || '';
            if (va < vb) return sort.direction === 'asc' ? -1 : 1;
            if (va > vb) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        this._state.pagination.total = filtered.length;
        const start = (this._state.pagination.page - 1) * this._state.pagination.pageSize;
        this._state.filteredClients = filtered.slice(start, start + this._state.pagination.pageSize);
        
        this._renderClientList();
    },
    
    // ==========================================
    // STATISTICS & HEALTH
    // ==========================================
    
    _updateStats() {
        const clients = this._state.clients;
        const stats = {
            total: clients.length,
            active: clients.filter(c => c.status === 'Active').length,
            paused: clients.filter(c => c.status === 'Paused').length,
            ended: clients.filter(c => c.status === 'Ended').length,
            totalMRR: clients.reduce((s, c) => s + (parseFloat(c.mrr) || 0), 0),
            totalDealValue: clients.reduce((s, c) => s + (parseFloat(c.dealValue) || 0), 0),
            avgHealthScore: clients.length > 0 
                ? Math.round(clients.reduce((s, c) => s + (c.healthScore || 100), 0) / clients.length)
                : 0
        };
        
        this._renderStats(stats);
        return stats;
    },
    
    getClientHealth(clientId) {
        const client = this._state.clients.find(c => c.id === clientId);
        if (!client) return null;
        
        let score = 100;
        
        // Reduce score for paused/ended
        if (client.status === 'Paused') score -= 40;
        if (client.status === 'Ended') score -= 80;
        
        // Reduce if no recent activity
        if (client.renewalDate) {
            const renewal = new Date(client.renewalDate);
            const now = new Date();
            const daysToRenewal = Math.ceil((renewal - now) / (1000 * 60 * 60 * 24));
            if (daysToRenewal < 30) score -= 20;
            if (daysToRenewal < 0) score -= 40;
        }
        
        // Reduce if no MRR
        if (!client.mrr || parseFloat(client.mrr) === 0) score -= 15;
        
        score = Math.max(0, Math.min(100, score));
        
        let level;
        const t = this._config.healthThresholds;
        if (score >= t.excellent) level = 'Excellent';
        else if (score >= t.good) level = 'Good';
        else if (score >= t.fair) level = 'Fair';
        else if (score >= t.poor) level = 'Poor';
        else level = 'Critical';
        
        return { score, level, client };
    },
    
    // ==========================================
    // CLIENT RELATIONS
    // ==========================================
    
    getClientProjects(clientId) {
        if (!window.StateManager) return [];
        const projects = window.StateManager.get('data.projects') || [];
        return projects.filter(p => p.clientId === clientId || p.clientName === this.getClient(clientId)?.name);
    },
    
    getClientRetainers(clientId) {
        if (!window.StateManager) return [];
        const retainers = window.StateManager.get('data.retainers') || [];
        return retainers.filter(r => r.clientId === clientId || r.clientName === this.getClient(clientId)?.name);
    },
    
    getClientRevenue(clientId) {
        if (!window.StateManager) return [];
        const revenue = window.StateManager.get('data.revenueEntries') || [];
        const client = this.getClient(clientId);
        return client ? revenue.filter(r => r.client === client.name) : [];
    },
    
    openWhatsApp(clientId) {
        const client = this._state.clients.find(c => c.id === clientId);
        if (!client || !client.mobile || client.mobile.length !== 10) return;
        window.open(`https://wa.me/91${client.mobile}`, '_blank');
    },
    
    callClient(clientId) {
        const client = this._state.clients.find(c => c.id === clientId);
        if (!client || !client.mobile) return;
        window.location.href = `tel:${client.mobile}`;
    },
    
    // ==========================================
    // RENDERING
    // ==========================================
    
    _renderClientList() {
        const container = document.getElementById('clients-grid');
        if (!container) return;
        
        const clients = this._state.filteredClients;
        
        if (clients.length === 0) {
            container.innerHTML = `
                <div class="empty-state-3d" style="grid-column:1/-1">
                    <div class="empty-icon-3d">👤</div>
                    <h3>No clients found</h3>
                    <p style="color:#999">${this._state.filters.search || this._state.filters.status ? 'Try adjusting filters' : 'Won deals will appear here'}</p>
                </div>
            `;
            return;
        }
        
        if (typeof window.renderClientCards === 'function') {
            window.renderClientCards(clients);
        }
    },
    
    _renderStats(stats) {
        this._setText('stat-total', stats.total);
        this._setText('stat-active', stats.active);
        this._setText('stat-revenue', Formatters.currency(stats.totalDealValue));
        this._setText('stat-mrr', Formatters.currency(stats.totalMRR));
    },
    
    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    getStats() { return this._updateStats(); },
    refresh() { return this.loadClients(); },
    
    destroy() {
        if (window.EventBus) {
            window.EventBus.off('client:created');
            window.EventBus.off('client:updated');
            window.EventBus.off('client:deleted');
        }
        console.log('👥 Clients module destroyed');
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.ClientsModule = ClientsModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientsModule;
}

// ==========================================
// END OF CLIENTS MODULE
// ==========================================

