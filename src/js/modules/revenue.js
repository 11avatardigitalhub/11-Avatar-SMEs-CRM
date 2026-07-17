/* ==========================================
   11 AVATAR DIGITAL HUB
   Revenue Tracking Module
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Revenue entry CRUD operations
   - Revenue filtering & search
   - Monthly goal tracking
   - Revenue forecasting
   - Revenue by type/source analysis
   - Payment collection tracking
   - Daily required calculation
   - Import/Export
   - Data validation
   ========================================== */

const RevenueModule = {
    
    // ==========================================
    // STATE
    // ==========================================
    
    _state: {
        entries: [],
        filteredEntries: [],
        loading: false,
        filters: {
            search: '',
            type: '',
            source: '',
            client: '',
            dateFrom: '',
            dateTo: ''
        },
        sort: {
            field: 'date',
            direction: 'desc'
        },
        pagination: {
            page: 1,
            pageSize: 25,
            total: 0
        },
        goal: 70000
    },
    
    _config: {
        enableAutoSave: true,
        defaultCurrency: '₹',
        types: ['Payment', 'Retainer', 'Project', 'Invoice', 'Refund', 'Commission'],
        sources: ['Client', 'Training', 'Referral', 'Project', 'Retainer', 'Consulting'],
        forecastWeight: 0.3
    },
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    init(config = {}) {
        Object.assign(this._config, config);
        this._loadGoal();
        this._setupEventListeners();
        this.loadEntries();
        console.log('💰 Revenue module initialized');
    },
    
    _setupEventListeners() {
        if (!window.EventBus) return;
        
        window.EventBus.on('revenue:added', (data) => {
            this._state.entries.unshift(data.entry);
            this._applyFilters();
            this._updateDisplay();
        });
        
        window.EventBus.on('revenue:updated', (data) => {
            const index = this._state.entries.findIndex(r => r.id === data.entry.id);
            if (index > -1) {
                this._state.entries[index] = { ...this._state.entries[index], ...data.entry };
            }
            this._applyFilters();
            this._updateDisplay();
        });
        
        window.EventBus.on('revenue:deleted', (data) => {
            this._state.entries = this._state.entries.filter(r => r.id !== data.entryId);
            this._applyFilters();
            this._updateDisplay();
        });
        
        window.EventBus.on('settings:updated', () => this._loadGoal());
    },
    
    // ==========================================
    // DATA LOADING
    // ==========================================
    
    loadEntries() {
        this._state.loading = true;
        
        try {
            if (window.StateManager) {
                this._state.entries = window.StateManager.get('data.revenueEntries') || [];
            } else {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                this._state.entries = saved.revenueEntries || [];
            }
            
            this._applyFilters();
            this._updateDisplay();
        } catch (error) {
            console.error('❌ Failed to load revenue:', error);
            if (window.Toast) window.Toast.error('Failed to load revenue data');
        } finally {
            this._state.loading = false;
        }
    },
    
    _loadGoal() {
        try {
            const settings = window.StateManager?.get('settings') || 
                           JSON.parse(localStorage.getItem('mrcrm_state') || '{}')?.settings || {};
            this._state.goal = settings.goal || 70000;
        } catch {
            this._state.goal = 70000;
        }
    },
    
    _saveEntries() {
        if (!this._config.enableAutoSave) return;
        
        try {
            if (window.StateManager) {
                window.StateManager.set('data.revenueEntries', this._state.entries);
            } else {
                const saved = JSON.parse(localStorage.getItem('mrcrm_state') || '{}');
                saved.revenueEntries = this._state.entries;
                localStorage.setItem('mrcrm_state', JSON.stringify(saved));
            }
        } catch (error) {
            console.error('❌ Failed to save revenue:', error);
        }
    },
    
    // ==========================================
    // CRUD OPERATIONS
    // ==========================================
    
    addEntry(entryData) {
        if (!entryData.client || !entryData.client.trim()) {
            throw new Error('Client name is required');
        }
        
        const amount = parseFloat(entryData.amount);
        if (!amount || amount <= 0) {
            throw new Error('Valid amount is required');
        }
        
        if (!entryData.date) {
            throw new Error('Date is required');
        }
        
        const now = new Date().toISOString();
        
        const entry = {
            id: 'REV' + Date.now().toString(36).toUpperCase(),
            client: entryData.client.trim(),
            amount: amount,
            date: entryData.date,
            type: entryData.type || 'Payment',
            source: entryData.source || 'Client',
            invoiceId: entryData.invoiceId || '',
            notes: (entryData.notes || '').trim(),
            createdAt: now,
            updatedAt: now
        };
        
        this._state.entries.unshift(entry);
        this._saveEntries();
        this._applyFilters();
        this._updateDisplay();
        
        if (window.EventBus) {
            window.EventBus.emit('revenue:added', { entry });
        }
        
        if (window.Toast) {
            window.Toast.success(`Revenue of ${Formatters.currency(amount)} added from ${entry.client}!`);
        }
        
        return entry;
    },
    
    updateEntry(entryId, entryData) {
        const index = this._state.entries.findIndex(r => r.id === entryId);
        if (index === -1) throw new Error('Revenue entry not found');
        
        const updatedEntry = {
            ...this._state.entries[index],
            ...entryData,
            id: entryId,
            amount: parseFloat(entryData.amount) || this._state.entries[index].amount,
            updatedAt: new Date().toISOString()
        };
        
        this._state.entries[index] = updatedEntry;
        this._saveEntries();
        this._applyFilters();
        this._updateDisplay();
        
        if (window.EventBus) {
            window.EventBus.emit('revenue:updated', { entry: updatedEntry });
        }
        
        if (window.Toast) {
            window.Toast.success('Revenue entry updated!');
        }
        
        return updatedEntry;
    },
    
    deleteEntry(entryId) {
        const entry = this._state.entries.find(r => r.id === entryId);
        if (!entry) throw new Error('Revenue entry not found');
        
        this._state.entries = this._state.entries.filter(r => r.id !== entryId);
        this._saveEntries();
        this._applyFilters();
        this._updateDisplay();
        
        if (window.EventBus) {
            window.EventBus.emit('revenue:deleted', { entryId, entryName: entry.client });
        }
        
        if (window.Toast) {
            window.Toast.info('Revenue entry deleted');
        }
        
        return true;
    },
    
    getEntry(entryId) {
        return this._state.entries.find(r => r.id === entryId) || null;
    },
    
    getAllEntries() {
        return [...this._state.entries];
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
            search: '', type: '', source: '', client: '',
            dateFrom: '', dateTo: ''
        };
        this._state.pagination.page = 1;
        this._applyFilters();
    },
    
    _applyFilters() {
        let filtered = [...this._state.entries];
        const f = this._state.filters;
        
        if (f.search) {
            const s = f.search.toLowerCase();
            filtered = filtered.filter(r =>
                (r.client && r.client.toLowerCase().includes(s)) ||
                (r.notes && r.notes.toLowerCase().includes(s))
            );
        }
        
        if (f.type) filtered = filtered.filter(r => r.type === f.type);
        if (f.source) filtered = filtered.filter(r => r.source === f.source);
        if (f.client) filtered = filtered.filter(r => r.client === f.client);
        if (f.dateFrom) filtered = filtered.filter(r => r.date >= f.dateFrom);
        if (f.dateTo) filtered = filtered.filter(r => r.date <= f.dateTo);
        
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
        this._state.filteredEntries = filtered.slice(start, start + this._state.pagination.pageSize);
        
        this._renderTable();
    },
    
    // ==========================================
    // CALCULATIONS
    // ==========================================
    
    getTotalCollected(entries = null) {
        const data = entries || this._state.entries;
        return data.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    },
    
    getCollectedByType(type) {
        return this._state.entries
            .filter(r => r.type === type)
            .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    },
    
    getCollectedBySource(source) {
        return this._state.entries
            .filter(r => r.source === source)
            .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    },
    
    getMonthlyCollected(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return this._state.entries
            .filter(r => r.date && r.date.startsWith(prefix))
            .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    },
    
    getCurrentMonthCollected() {
        const now = new Date();
        return this.getMonthlyCollected(now.getFullYear(), now.getMonth() + 1);
    },
    
    getForecast() {
        const collected = this.getTotalCollected();
        
        if (window.StateManager) {
            const leads = window.StateManager.get('data.leads') || [];
            const pipelineValue = leads
                .filter(l => l.status !== 'Won' && l.status !== 'Lost')
                .reduce((sum, l) => sum + (parseFloat(l.dealValue) || 0), 0);
            
            return collected + (pipelineValue * this._config.forecastWeight);
        }
        
        return collected;
    },
    
    getRemaining() {
        return Math.max(0, this._state.goal - this.getTotalCollected());
    },
    
    getRequiredPerDay() {
        const remaining = this.getRemaining();
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
        return Math.round(remaining / daysLeft);
    },
    
    getRevenuePercent() {
        if (this._state.goal <= 0) return 0;
        return Math.min(100, Math.round((this.getTotalCollected() / this._state.goal) * 100));
    },
    
    // ==========================================
    // GOAL MANAGEMENT
    // ==========================================
    
    setGoal(amount) {
        const goal = parseFloat(amount);
        if (!goal || goal <= 0) throw new Error('Invalid goal amount');
        
        this._state.goal = goal;
        
        if (window.StateManager) {
            const settings = window.StateManager.get('settings') || {};
            settings.goal = goal;
            window.StateManager.set('settings', settings);
        }
        
        this._updateDisplay();
        
        if (window.EventBus) {
            window.EventBus.emit('settings:updated', { goal });
        }
        
        return goal;
    },
    
    getGoal() {
        return this._state.goal;
    },
    
    // ==========================================
    // BULK OPERATIONS
    // ==========================================
    
    exportEntries() {
        const data = JSON.stringify(this._state.entries, null, 2);
        const filename = `revenue_export_${new Date().toISOString().slice(0, 10)}.json`;
        if (window.Helpers) window.Helpers.downloadFile(data, filename, 'application/json');
        return data;
    },
    
    importEntries(entriesData) {
        if (!Array.isArray(entriesData) || entriesData.length === 0) {
            throw new Error('No valid revenue data');
        }
        
        let imported = 0;
        entriesData.forEach(data => {
            if (!data.client || !data.amount) return;
            
            const entry = {
                ...data,
                id: data.id || 'REV' + Date.now().toString(36).toUpperCase() + imported,
                amount: parseFloat(data.amount) || 0,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this._state.entries.unshift(entry);
            imported++;
        });
        
        if (imported > 0) {
            this._saveEntries();
            this._applyFilters();
            this._updateDisplay();
        }
        
        return { imported };
    },
    
    // ==========================================
    // DISPLAY
    // ==========================================
    
    _updateDisplay() {
        const total = this.getTotalCollected();
        const remaining = this.getRemaining();
        const percent = this.getRevenuePercent();
        const requiredPerDay = this.getRequiredPerDay();
        const forecast = this.getForecast();
        
        this._setText('revGoal', Formatters.currency(this._state.goal));
        this._setText('revCollected', Formatters.currency(total));
        this._setText('revRemaining', Formatters.currency(remaining));
        this._setText('revRequiredDay', Formatters.currency(requiredPerDay));
        this._setText('revPercent', percent + '%');
        
        const progressBar = document.getElementById('revProgressBar');
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        
        const forecastEl = document.getElementById('revForecast');
        if (forecastEl) {
            forecastEl.textContent = Formatters.currency(forecast);
        }
    },
    
    _renderTable() {
        const tbody = document.getElementById('revenueTableBody');
        if (!tbody) return;
        
        const entries = this._state.filteredEntries;
        
        if (entries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#999">No revenue entries found</td></tr>`;
            return;
        }
        
        const typeBadgeMap = {
            Payment: 'badge-success',
            Retainer: 'badge-purple',
            Project: 'badge-info',
            Invoice: 'badge-warning',
            Refund: 'badge-danger'
        };
        
        tbody.innerHTML = entries.map(r => `
            <tr>
                <td>${Formatters.date(r.date)}</td>
                <td><strong>${r.client || '-'}</strong></td>
                <td class="amount-cell" style="font-weight:700;color:#059669;font-family:'Poppins',sans-serif">${Formatters.currency(r.amount)}</td>
                <td><span class="badge ${typeBadgeMap[r.type] || 'badge-neutral'}">${r.type || 'Payment'}</span></td>
                <td>${r.source || 'Client'}</td>
                <td>
                    <div style="display:flex;gap:6px">
                        <button class="icon-btn-3d" onclick="RevenueModule.editEntryPrompt('${r.id}')" title="Edit">✏️</button>
                        <button class="icon-btn-3d" onclick="RevenueModule.deleteEntryPrompt('${r.id}')" title="Delete" style="color:#EF4444">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    getStats() {
        return {
            total: this.getTotalCollected(),
            goal: this._state.goal,
            remaining: this.getRemaining(),
            percent: this.getRevenuePercent(),
            requiredPerDay: this.getRequiredPerDay(),
            forecast: this.getForecast(),
            entries: this._state.entries.length
        };
    },
    
    refresh() { return this.loadEntries(); },
    
    destroy() {
        if (window.EventBus) {
            window.EventBus.off('revenue:added');
            window.EventBus.off('revenue:updated');
            window.EventBus.off('revenue:deleted');
        }
        console.log('💰 Revenue module destroyed');
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.RevenueModule = RevenueModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RevenueModule;
}

// ==========================================
// END OF REVENUE MODULE
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
