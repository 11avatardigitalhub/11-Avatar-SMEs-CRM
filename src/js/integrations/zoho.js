/**
 * 11 AVATAR DIGITAL HUB - Zoho Integration Module
 * Enterprise-grade Zoho One/CRM/Books integration
 * Bidirectional sync with Zoho CRM, Books, Desk, Analytics
 * 
 * @module ZohoIntegration
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
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Zoho Integration - Complete Zoho suite integration
 * Zoho CRM, Books, Desk, Analytics, Creator sync
 */
class ZohoIntegration {
    constructor() {
        this.moduleName = 'zoho';
        this.apiEndpoint = '/api/zoho';
        this.cachePrefix = 'zoho_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.zohoApps = {
            'crm': { label: 'Zoho CRM', icon: 'fa-users', color: '#E42527', modules: ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Notes'] },
            'books': { label: 'Zoho Books', icon: 'fa-book', color: '#2E86AB', modules: ['Invoices', 'Payments', 'CreditNotes', 'ChartOfAccounts', 'Items'] },
            'desk': { label: 'Zoho Desk', icon: 'fa-headset', color: '#F5A623', modules: ['Tickets', 'Contacts', 'Accounts', 'Agents'] },
            'analytics': { label: 'Zoho Analytics', icon: 'fa-chart-bar', color: '#50C878', modules: ['Reports', 'Dashboards', 'Datasets'] },
            'creator': { label: 'Zoho Creator', icon: 'fa-cogs', color: '#7B68EE', modules: ['Applications', 'Forms', 'Reports'] }
        };

        this.syncMappings = {
            'lead_to_lead': { from: 'crm.Leads', to: 'leads', label: 'Zoho Leads ↔ CRM Leads', bidirectional: true },
            'contact_to_contact': { from: 'crm.Contacts', to: 'contacts', label: 'Zoho Contacts ↔ CRM Contacts', bidirectional: true },
            'account_to_client': { from: 'crm.Accounts', to: 'clients', label: 'Zoho Accounts ↔ CRM Clients', bidirectional: true },
            'deal_to_deal': { from: 'crm.Deals', to: 'deals', label: 'Zoho Deals ↔ CRM Deals', bidirectional: true },
            'invoice_to_invoice': { from: 'books.Invoices', to: 'invoices', label: 'Zoho Invoices ↔ CRM Invoices', bidirectional: true },
            'payment_to_payment': { from: 'books.Payments', to: 'payments', label: 'Zoho Payments ↔ CRM Payments', bidirectional: true },
            'ticket_to_task': { from: 'desk.Tickets', to: 'tasks', label: 'Zoho Tickets → CRM Tasks', bidirectional: false }
        };

        this.syncStatuses = {
            'not_synced': { label: 'Not Synced', color: '#6B7280', icon: 'fa-circle' },
            'syncing': { label: 'Syncing', color: '#3B82F6', icon: 'fa-spinner' },
            'synced': { label: 'Synced', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'partial': { label: 'Partial', color: '#F59E0B', icon: 'fa-adjust' }
        };

        this.connectionConfig = {
            clientId: null,
            clientSecret: null,
            refreshToken: null,
            accessToken: null,
            tokenExpiry: null,
            orgId: null,
            domain: 'zoho.in',
            isConnected: false,
            connectedApps: [],
            apiDomain: 'https://www.zohoapis.in'
        };

        this.activeMappings = new Map();
        this.syncHistory = new Map();
        this.fieldMappings = new Map();
        this.isSyncing = false;

        this.syncSchedule = {
            enabled: true,
            frequency: 'every_hour',
            autoSyncOnSave: true,
            conflictResolution: 'crm_wins'
        };

        this.filters = { app: 'all', mapping: 'all', status: 'all', search: '' };
        this.currentView = 'dashboard';

        this.metrics = {
            totalSyncs: 0, recordsSynced: 0, recordsFailed: 0,
            lastFullSync: null, activeMappings: 0, apiCallsToday: 0
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Zoho] Initializing Zoho integration...');
            const canAccess = await Permissions.check('zoho', 'read');
            if (!canAccess) { console.warn('[Zoho] Access denied'); return; }

            await this.loadConfiguration();
            await this.loadMappings();
            await this.loadSyncHistory();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('zoho-container')) await this.render();
            console.log('[Zoho] Initialized');
            EventBus.emit('zoho:ready', { connected: this.connectionConfig.isConnected });
        } catch (error) {
            console.error('[Zoho] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.connectionConfig = { ...this.connectionConfig, ...response.data };
                this.syncSchedule = { ...this.syncSchedule, ...response.data.schedule };
            }
        } catch (error) { console.error('[Zoho] Config load failed:', error); }
    }

    async loadMappings() {
        try {
            const response = await API.get(`${this.apiEndpoint}/mappings`);
            if (response.success && response.data) {
                this.activeMappings.clear();
                response.data.forEach(mapping => {
                    this.activeMappings.set(mapping.id, {
                        ...mapping, mappingInfo: this.syncMappings[mapping.mappingKey],
                        statusInfo: this.syncStatuses[mapping.status || 'not_synced'],
                        lastSyncFormatted: mapping.lastSync ? Formatters.relativeTime(mapping.lastSync) : 'Never'
                    });
                });
                this.metrics.activeMappings = this.activeMappings.size;
            }
        } catch (error) { console.error('[Zoho] Mappings load failed:', error); }
    }

    async loadSyncHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history?limit=100`);
            if (response.success && response.data) {
                this.syncHistory.clear();
                response.data.logs?.forEach(log => {
                    this.syncHistory.set(log.id, {
                        ...log, formattedDate: Formatters.date(log.syncedAt),
                        mappingLabel: this.syncMappings[log.mappingKey]?.label || log.mappingKey,
                        statusInfo: this.syncStatuses[log.status] || this.syncStatuses.not_synced
                    });
                });
                this.metrics.totalSyncs = this.syncHistory.size;
            }
        } catch (error) { console.error('[Zoho] History load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('zoho:connect', this.connect.bind(this));
        EventBus.on('zoho:disconnect', this.disconnect.bind(this));
        EventBus.on('zoho:sync-all', this.syncAll.bind(this));
        EventBus.on('zoho:sync-mapping', this.syncMapping.bind(this));
        EventBus.on('zoho:create-mapping', this.createMapping.bind(this));
        EventBus.on('zoho:delete-mapping', this.deleteMapping.bind(this));
        EventBus.on('zoho:field-map', this.updateFieldMapping.bind(this));
        EventBus.on('zoho:import-zoho', this.importFromZoho.bind(this));
        EventBus.on('zoho:export-to-zoho', this.exportToZoho.bind(this));

        EventBus.on('lead:created', (lead) => {
            if (this.syncSchedule.autoSyncOnSave && this.isMappingActive('lead_to_lead')) {
                this.exportToZoho('lead_to_lead', lead);
            }
        });

        console.log('[Zoho] Event listeners initialized');
    }

    async connect() {
        try {
            const response = await API.get(`${this.apiEndpoint}/auth-url`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 700;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'ZohoAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 180000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'zoho-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'zoho-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code });
            await this.loadConfiguration();
            Toast.show('Zoho connected!', 'success');
            EventBus.emit('zoho:connected');
            await this.render();
        } catch (error) {
            console.error('[Zoho] Connection failed:', error);
            Toast.show('Zoho connection failed: ' + error.message, 'error');
        }
    }

    async disconnect() {
        try {
            const confirmed = await this.confirmDialog('Disconnect Zoho', 'Disconnect all Zoho integrations? Active sync mappings will be paused.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.connectionConfig.isConnected = false;
            this.activeMappings.clear();
            Toast.show('Zoho disconnected', 'info');
            await this.render();
        } catch (error) {
            console.error('[Zoho] Disconnect failed:', error);
        }
    }

    async syncAll() {
        if (this.isSyncing) { Toast.show('Sync already in progress', 'warning'); return; }
        try {
            this.isSyncing = true;
            const startTime = performance.now();
            Toast.show('Starting full Zoho sync...', 'info');
            let synced = 0, failed = 0;

            for (const [id, mapping] of this.activeMappings) {
                if (!mapping.enabled) continue;
                const result = await this.syncMapping(id);
                if (result?.success) synced += result.count || 0;
                else failed++;
            }

            const duration = ((performance.now() - startTime) / 1000).toFixed(1);
            this.metrics.recordsSynced += synced;
            this.metrics.recordsFailed += failed;
            this.metrics.lastFullSync = new Date();

            Toast.show(`Zoho sync complete! ${synced} records in ${duration}s`, 'success');
            await this.loadSyncHistory();
            await this.render();
        } catch (error) {
            console.error('[Zoho] Sync all failed:', error);
            Toast.show('Sync failed: ' + error.message, 'error');
        } finally {
            this.isSyncing = false;
        }
    }

    async syncMapping(mappingId) {
        try {
            const mapping = this.activeMappings.get(mappingId);
            if (!mapping) throw new Error('Mapping not found');
            Toast.show(`Syncing ${mapping.mappingInfo?.label || 'mapping'}...`, 'info');

            const response = await API.post(`${this.apiEndpoint}/sync/${mappingId}`);
            if (response.success) {
                mapping.status = 'synced';
                mapping.statusInfo = this.syncStatuses.synced;
                mapping.lastSync = new Date().toISOString();
                mapping.lastSyncFormatted = 'Just now';
                mapping.recordsCount = response.data.count || 0;
                this.activeMappings.set(mappingId, mapping);
                return response.data;
            } else {
                mapping.status = 'failed';
                mapping.statusInfo = this.syncStatuses.failed;
                this.activeMappings.set(mappingId, mapping);
                return null;
            }
        } catch (error) {
            console.error('[Zoho] Sync mapping failed:', error);
            return null;
        }
    }

    async createMapping(mappingKey) {
        try {
            const mappingInfo = this.syncMappings[mappingKey];
            if (!mappingInfo) throw new Error('Invalid mapping key');

            const response = await API.post(`${this.apiEndpoint}/mappings`, {
                mappingKey, fromApp: mappingInfo.from, toEntity: mappingInfo.to, bidirectional: mappingInfo.bidirectional
            });
            if (!response.success) throw new Error(response.error);
            await this.loadMappings();
            Toast.show(`Mapping "${mappingInfo.label}" created`, 'success');
            await this.render();
            return response.data;
        } catch (error) {
            console.error('[Zoho] Create mapping failed:', error);
            Toast.show('Failed to create mapping', 'error');
            return null;
        }
    }

    async deleteMapping(mappingId) {
        try {
            const mapping = this.activeMappings.get(mappingId);
            if (!mapping) throw new Error('Mapping not found');
            const confirmed = await this.confirmDialog('Delete Mapping', `Delete "${mapping.mappingInfo?.label}" mapping?`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/mappings/${mappingId}`);
            this.activeMappings.delete(mappingId);
            Toast.show('Mapping deleted', 'info');
            await this.render();
        } catch (error) {
            console.error('[Zoho] Delete mapping failed:', error);
        }
    }

    async updateFieldMapping(mappingId, fieldMappings) {
        try {
            const response = await API.put(`${this.apiEndpoint}/mappings/${mappingId}/fields`, { mappings: fieldMappings });
            if (response.success) {
                this.fieldMappings.set(mappingId, fieldMappings);
                Toast.show('Field mappings updated', 'success');
            }
            return response;
        } catch (error) {
            console.error('[Zoho] Field mapping update failed:', error);
            return null;
        }
    }

    async importFromZoho(mappingKey) {
        try {
            Toast.show('Importing from Zoho...', 'info');
            const response = await API.post(`${this.apiEndpoint}/import/${mappingKey}`);
            if (response.success) {
                Toast.show(`Imported ${response.data.count || 0} records from Zoho`, 'success');
                this.metrics.recordsSynced += response.data.count || 0;
                await this.loadSyncHistory();
                await this.render();
            }
            return response;
        } catch (error) {
            console.error('[Zoho] Import failed:', error);
            Toast.show('Import failed', 'error');
            return null;
        }
    }

    async exportToZoho(mappingKey, data) {
        try {
            const response = await API.post(`${this.apiEndpoint}/export/${mappingKey}`, { data });
            if (response.success) {
                console.log(`[Zoho] Exported to Zoho: ${mappingKey}`);
                this.metrics.recordsSynced++;
            }
            return response;
        } catch (error) {
            console.error('[Zoho] Export failed:', error);
            return null;
        }
    }

    isMappingActive(mappingKey) {
        return Array.from(this.activeMappings.values()).some(m => m.mappingKey === mappingKey && m.enabled);
    }

    openMappingWizard() {
        const availableMappings = Object.entries(this.syncMappings).filter(([key]) => 
            !Array.from(this.activeMappings.values()).some(m => m.mappingKey === key)
        );

        const wizardHtml = `
            <div class="mapping-wizard">
                <h4>Create Sync Mapping</h4>
                <p>Select entities to sync between Zoho and CRM</p>
                <div class="mappings-grid">
                    ${availableMappings.map(([key, mapping]) => `
                        <div class="mapping-option" onclick="window.Global.Zoho.createMapping('${key}');window.Global.Modal.close();" style="cursor:pointer;">
                            <div class="mapping-flow">
                                <span class="zoho-badge">${mapping.from}</span>
                                <i class="fas fa-exchange-alt"></i>
                                <span class="crm-badge">${mapping.to}</span>
                            </div>
                            <strong>${mapping.label}</strong>
                            <small>${mapping.bidirectional ? 'Bidirectional sync' : 'One-way sync'}</small>
                        </div>
                    `).join('')}
                </div>
                ${availableMappings.length === 0 ? '<p>All mappings are already configured</p>' : ''}
            </div>`;

        new Modal({ title: 'Add Zoho Mapping', content: wizardHtml, size: 'large' }).open();
    }

    calculateMetrics() {
        this.metrics.activeMappings = this.activeMappings.size;
        this.metrics.totalSyncs = this.syncHistory.size;
    }

    async render(container = null) {
        const target = container || document.getElementById('zoho-container');
        if (!target) return;

        const html = `
            <div class="zoho-container">
                <div class="zoho-header">
                    <h3><img src="/assets/zoho-logo.png" alt="" style="height:24px;vertical-align:middle;"> Zoho Integration</h3>
                    <div class="header-actions">
                        ${this.connectionConfig.isConnected ? `
                            <button class="btn btn-outline" onclick="window.Global.Zoho.openMappingWizard()"><i class="fas fa-plus"></i> Add Mapping</button>
                            <button class="btn btn-primary" onclick="window.Global.Zoho.syncAll()" ${this.isSyncing ? 'disabled' : ''}><i class="fas fa-sync ${this.isSyncing ? 'fa-spin' : ''}"></i> Sync All</button>
                            <button class="btn btn-outline" onclick="window.Global.Zoho.disconnect()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.Zoho.connect()"><i class="fas fa-plug"></i> Connect Zoho</button>
                        `}
                    </div>
                </div>

                <div class="connection-bar">
                    <span style="color:${this.connectionConfig.isConnected ? '#10B981' : '#F59E0B'}">
                        <i class="fas fa-circle"></i> ${this.connectionConfig.isConnected ? 'Connected to Zoho' : 'Not Connected'}
                    </span>
                    ${this.metrics.lastFullSync ? `<span>| Last full sync: ${Formatters.relativeTime(this.metrics.lastFullSync)}</span>` : ''}
                    <span>| API calls today: ${this.metrics.apiCallsToday}</span>
                </div>

                <div class="zoho-metrics">
                    <div class="metric-card"><i class="fas fa-random"></i><span>${this.metrics.activeMappings}</span><small>Active Mappings</small></div>
                    <div class="metric-card"><i class="fas fa-cloud-upload-alt"></i><span>${this.metrics.recordsSynced}</span><small>Records Synced</small></div>
                    <div class="metric-card"><i class="fas fa-times-circle"></i><span>${this.metrics.recordsFailed}</span><small>Failed</small></div>
                </div>

                <div class="zoho-apps">
                    <h4>Zoho Applications</h4>
                    <div class="apps-grid">
                        ${Object.entries(this.zohoApps).map(([key, app]) => `
                            <div class="app-card ${this.connectionConfig.connectedApps?.includes(key) ? 'connected' : ''}">
                                <i class="fas ${app.icon}" style="color:${app.color};font-size:24px;"></i>
                                <strong>${app.label}</strong>
                                <small>${app.modules.length} modules</small>
                                ${this.connectionConfig.connectedApps?.includes(key) ? '<span class="connected-badge">Connected</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="active-mappings">
                    <h4>Sync Mappings</h4>
                    ${Array.from(this.activeMappings.values()).map(mapping => `
                        <div class="mapping-card" style="border-left:3px solid ${mapping.enabled ? '#10B981' : '#6B7280'}">
                            <div class="mapping-header">
                                <strong>${mapping.mappingInfo?.label || mapping.mappingKey}</strong>
                                <span class="status-badge" style="background:${mapping.statusInfo.color}20;color:${mapping.statusInfo.color}">${mapping.statusInfo.label}</span>
                            </div>
                            <div class="mapping-info">
                                <span><i class="fas fa-exchange-alt"></i> ${mapping.mappingInfo?.bidirectional ? 'Bidirectional' : 'One-way'}</span>
                                <span><i class="fas fa-clock"></i> Last: ${mapping.lastSyncFormatted}</span>
                                <span><i class="fas fa-database"></i> ${mapping.recordsCount || 0} records</span>
                            </div>
                            <div class="mapping-actions">
                                <button class="btn btn-sm btn-primary" onclick="window.Global.Zoho.syncMapping('${mapping.id}')"><i class="fas fa-sync"></i> Sync</button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Zoho.deleteMapping('${mapping.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state"><i class="fas fa-random"></i><p>No sync mappings configured</p></div>'}
                </div>
            </div>`;

        target.innerHTML = html;
    }

    confirmDialog(title, message) {
        return new Promise(resolve => {
            const modal = new Modal({ title, content: `<p>${message}</p><div class="modal-actions"><button class="btn btn-secondary cancel-btn">Cancel</button><button class="btn btn-primary confirm-btn">Confirm</button></div>`, size: 'small', onClose: () => resolve(false) });
            modal.open();
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => { modal.close(); resolve(false); });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => { modal.close(); resolve(true); });
            }, 100);
        });
    }

    escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; }

    destroy() {
        EventBus.off('zoho:connect'); EventBus.off('zoho:disconnect'); EventBus.off('zoho:sync-all');
        EventBus.off('zoho:sync-mapping'); EventBus.off('zoho:create-mapping');
        console.log('[Zoho] Module destroyed');
    }
}

const zohoIntegration = new ZohoIntegration();
export { zohoIntegration, ZohoIntegration };
export default zohoIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Zoho = zohoIntegration; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
