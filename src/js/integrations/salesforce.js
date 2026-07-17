/**
 * 11 AVATAR DIGITAL HUB - Salesforce Integration Module
 * Enterprise-grade Salesforce CRM integration
 * Objects, fields, workflows, reports, bidirectional sync engine
 * 
 * @module SalesforceIntegration
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
 * Salesforce Integration - Complete Salesforce CRM sync
 * REST API, Bulk API, Streaming API, Metadata API
 */
class SalesforceIntegration {
    constructor() {
        this.moduleName = 'salesforce';
        this.apiEndpoint = '/api/salesforce';
        this.cachePrefix = 'sf_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.salesforceObjects = {
            'Lead': { label: 'Leads', icon: 'fa-user-plus', color: '#00A1E0', crmEntity: 'leads' },
            'Contact': { label: 'Contacts', icon: 'fa-address-card', color: '#032D60', crmEntity: 'contacts' },
            'Account': { label: 'Accounts', icon: 'fa-building', color: '#0070D2', crmEntity: 'clients' },
            'Opportunity': { label: 'Opportunities', icon: 'fa-star', color: '#2E8446', crmEntity: 'deals' },
            'Case': { label: 'Cases', icon: 'fa-headset', color: '#C23934', crmEntity: 'tasks' },
            'Task': { label: 'Tasks', icon: 'fa-tasks', color: '#5C5C5C', crmEntity: 'tasks' },
            'Event': { label: 'Events', icon: 'fa-calendar', color: '#4A90D9', crmEntity: 'activities' },
            'Contract': { label: 'Contracts', icon: 'fa-file-contract', color: '#7C3AED', crmEntity: 'retainers' },
            'Product2': { label: 'Products', icon: 'fa-box', color: '#EC4899', crmEntity: 'products' },
            'PricebookEntry': { label: 'Price Book', icon: 'fa-tags', color: '#F59E0B', crmEntity: 'products' },
            'Order': { label: 'Orders', icon: 'fa-shopping-cart', color: '#14B8A6', crmEntity: 'invoices' },
            'Campaign': { label: 'Campaigns', icon: 'fa-bullhorn', color: '#F97316', crmEntity: 'campaigns' }
        };

        this.syncModes = {
            'rest_api': { label: 'REST API', icon: 'fa-cloud', color: '#3B82F6', description: 'Real-time single record sync', speed: 'real-time' },
            'bulk_api': { label: 'Bulk API', icon: 'fa-database', color: '#10B981', description: 'Large volume batch processing', speed: 'batch', maxRecords: 10000 },
            'streaming_api': { label: 'Streaming API', icon: 'fa-broadcast-tower', color: '#8B5CF6', description: 'PushTopic real-time events', speed: 'real-time' },
            'metadata_api': { label: 'Metadata API', icon: 'fa-cogs', color: '#F59E0B', description: 'Custom objects & fields sync', speed: 'on-demand' }
        };

        this.syncStatuses = {
            'not_configured': { label: 'Not Configured', color: '#6B7280', icon: 'fa-circle' },
            'initial_sync': { label: 'Initial Sync', color: '#3B82F6', icon: 'fa-sync' },
            'in_sync': { label: 'In Sync', color: '#10B981', icon: 'fa-check-circle' },
            'partial_sync': { label: 'Partial', color: '#F59E0B', icon: 'fa-adjust' },
            'error': { label: 'Error', color: '#DC2626', icon: 'fa-times-circle' },
            'paused': { label: 'Paused', color: '#9CA3AF', icon: 'fa-pause-circle' }
        };

        this.connectionConfig = {
            instanceUrl: null,
            clientId: null,
            clientSecret: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            username: null,
            orgId: null,
            orgName: null,
            apiVersion: '58.0',
            isConnected: false,
            isSandbox: false,
            sandboxName: null
        };

        this.syncMappings = new Map();
        this.fieldMappings = new Map();
        this.syncHistory = new Map();
        this.pushTopics = new Map();
        this.isSyncing = false;

        this.syncConfig = {
            mode: 'rest_api',
            conflictResolution: 'crm_wins',
            batchSize: 200,
            autoSyncOnSave: true,
            realTimeEnabled: false,
            scheduleEnabled: true,
            scheduleFrequency: 'every_hour'
        };

        this.filters = { object: 'all', status: 'all', search: '' };
        this.currentView = 'dashboard';

        this.metrics = {
            totalMappings: 0, recordsInSync: 0, recordsPending: 0,
            lastFullSync: null, apiCallsUsed: 0, apiCallsLimit: 0,
            storageUsed: 0, storageLimit: 0
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Salesforce] Initializing Salesforce integration...');
            const canAccess = await Permissions.check('salesforce', 'read');
            if (!canAccess) { console.warn('[Salesforce] Access denied'); return; }

            await this.loadConfiguration();
            await this.loadSyncMappings();
            await this.loadSyncHistory();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('salesforce-container')) await this.render();
            console.log('[Salesforce] Initialized');
            EventBus.emit('salesforce:ready', { connected: this.connectionConfig.isConnected });
        } catch (error) {
            console.error('[Salesforce] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.connectionConfig = { ...this.connectionConfig, ...response.data };
                this.syncConfig = { ...this.syncConfig, ...response.data.syncConfig };
            }
        } catch (error) { console.error('[Salesforce] Config load failed:', error); }
    }

    async loadSyncMappings() {
        try {
            const response = await API.get(`${this.apiEndpoint}/mappings`);
            if (response.success && response.data) {
                this.syncMappings.clear();
                response.data.forEach(mapping => {
                    this.syncMappings.set(mapping.id, {
                        ...mapping,
                        objectInfo: this.salesforceObjects[mapping.sfObject],
                        statusInfo: this.syncStatuses[mapping.status || 'not_configured'],
                        lastSyncFormatted: mapping.lastSyncAt ? Formatters.relativeTime(mapping.lastSyncAt) : 'Never',
                        modeInfo: this.syncModes[mapping.mode || 'rest_api']
                    });
                });
                this.metrics.totalMappings = this.syncMappings.size;
            }
        } catch (error) { console.error('[Salesforce] Mappings load failed:', error); }
    }

    async loadSyncHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history?limit=100`);
            if (response.success && response.data) {
                this.syncHistory.clear();
                response.data.logs?.forEach(log => {
                    this.syncHistory.set(log.id, {
                        ...log, formattedDate: Formatters.date(log.syncedAt),
                        objectLabel: this.salesforceObjects[log.sfObject]?.label || log.sfObject,
                        statusInfo: this.syncStatuses[log.status] || this.syncStatuses.not_configured
                    });
                });
            }
        } catch (error) { console.error('[Salesforce] History load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('salesforce:connect', this.connect.bind(this));
        EventBus.on('salesforce:disconnect', this.disconnect.bind(this));
        EventBus.on('salesforce:sync-all', this.syncAll.bind(this));
        EventBus.on('salesforce:sync-object', this.syncObject.bind(this));
        EventBus.on('salesforce:create-mapping', this.createMapping.bind(this));
        EventBus.on('salesforce:delete-mapping', this.deleteMapping.bind(this));
        EventBus.on('salesforce:import', this.importFromSalesforce.bind(this));
        EventBus.on('salesforce:export', this.exportToSalesforce.bind(this));
        EventBus.on('salesforce:map-fields', this.mapFields.bind(this));
        EventBus.on('salesforce:subscribe-push', this.subscribePushTopic.bind(this));
        EventBus.on('salesforce:bulk-sync', this.bulkSync.bind(this));

        EventBus.on('deal:stage_changed', (data) => {
            if (this.syncConfig.autoSyncOnSave && this.isObjectMapped('Opportunity')) {
                this.exportToSalesforce('Opportunity', data);
            }
        });

        EventBus.on('client:created', (client) => {
            if (this.syncConfig.autoSyncOnSave && this.isObjectMapped('Account')) {
                this.exportToSalesforce('Account', client);
            }
        });

        console.log('[Salesforce] Event listeners initialized');
    }

    async connect() {
        try {
            const isSandbox = confirm('Connect to Salesforce sandbox?\n\nClick OK for Sandbox, Cancel for Production.');
            const response = await API.get(`${this.apiEndpoint}/auth-url?sandbox=${isSandbox}`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 700, height = 750;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'SalesforceAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 180000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'sf-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'sf-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code, sandbox: isSandbox });
            await this.loadConfiguration();
            Toast.show(`Salesforce ${isSandbox ? 'Sandbox' : 'Production'} connected!`, 'success');
            EventBus.emit('salesforce:connected', this.connectionConfig);
            await this.render();
        } catch (error) {
            console.error('[Salesforce] Connection failed:', error);
            Toast.show('Salesforce connection failed: ' + error.message, 'error');
        }
    }

    async disconnect() {
        try {
            const confirmed = await this.confirmDialog('Disconnect Salesforce', 'Disconnect Salesforce? All sync mappings will be paused.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.connectionConfig.isConnected = false;
            this.syncMappings.clear();
            Toast.show('Salesforce disconnected', 'info');
            await this.render();
        } catch (error) { console.error('[Salesforce] Disconnect failed:', error); }
    }

    async syncAll() {
        if (this.isSyncing) { Toast.show('Sync already in progress', 'warning'); return; }
        try {
            this.isSyncing = true;
            const startTime = performance.now();
            Toast.show('Starting Salesforce sync...', 'info');
            let synced = 0, failed = 0;

            for (const [id, mapping] of this.syncMappings) {
                if (!mapping.enabled) continue;
                const result = await this.syncObject(mapping.sfObject);
                if (result?.success) synced += result.count || 0;
                else failed++;
            }

            const duration = ((performance.now() - startTime) / 1000).toFixed(1);
            this.metrics.recordsInSync += synced;
            this.metrics.recordsPending = failed;
            this.metrics.lastFullSync = new Date();

            Toast.show(`Salesforce sync complete! ${synced} records in ${duration}s`, 'success');
            await this.loadSyncHistory();
            await this.render();
        } catch (error) {
            console.error('[Salesforce] Sync all failed:', error);
            Toast.show('Sync failed: ' + error.message, 'error');
        } finally { this.isSyncing = false; }
    }

    async syncObject(sfObject) {
        try {
            const objInfo = this.salesforceObjects[sfObject];
            Toast.show(`Syncing ${objInfo?.label || sfObject}...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/sync/${sfObject}`);
            if (response.success) {
                this.metrics.recordsInSync += response.data.count || 0;
                this.metrics.apiCallsUsed = response.data.apiCallsUsed || this.metrics.apiCallsUsed;
                return response.data;
            } else {
                this.metrics.recordsPending++;
                return null;
            }
        } catch (error) {
            console.error(`[Salesforce] Sync ${sfObject} failed:`, error);
            this.metrics.recordsPending++;
            return null;
        }
    }

    async bulkSync(sfObject) {
        try {
            const objInfo = this.salesforceObjects[sfObject];
            Toast.show(`Starting bulk sync for ${objInfo?.label}...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/bulk-sync/${sfObject}`);
            if (response.success) {
                Toast.show(`Bulk sync job created: ${response.data.jobId}`, 'success');
                this.metrics.apiCallsUsed = response.data.apiCallsUsed || this.metrics.apiCallsUsed;
            }
            return response;
        } catch (error) {
            console.error('[Salesforce] Bulk sync failed:', error);
            return null;
        }
    }

    async createMapping(mappingData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/mappings`, mappingData);
            if (!response.success) throw new Error(response.error);
            await this.loadSyncMappings();
            Toast.show('Sync mapping created', 'success');
            await this.render();
            return response.data;
        } catch (error) {
            console.error('[Salesforce] Create mapping failed:', error);
            Toast.show('Failed to create mapping', 'error');
            return null;
        }
    }

    async deleteMapping(mappingId) {
        try {
            const mapping = this.syncMappings.get(mappingId);
            if (!mapping) throw new Error('Mapping not found');
            const confirmed = await this.confirmDialog('Delete Mapping', `Delete mapping for ${mapping.objectInfo?.label}?`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/mappings/${mappingId}`);
            this.syncMappings.delete(mappingId);
            Toast.show('Mapping deleted', 'info');
            await this.render();
        } catch (error) { console.error('[Salesforce] Delete mapping failed:', error); }
    }

    async importFromSalesforce(sfObject) {
        try {
            Toast.show(`Importing from Salesforce...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/import/${sfObject}`);
            if (response.success) {
                Toast.show(`Imported ${response.data.count || 0} records`, 'success');
                await this.loadSyncHistory();
                await this.render();
            }
            return response;
        } catch (error) {
            console.error('[Salesforce] Import failed:', error);
            return null;
        }
    }

    async exportToSalesforce(sfObject, data) {
        try {
            const response = await API.post(`${this.apiEndpoint}/export/${sfObject}`, { data });
            if (response.success) {
                console.log(`[Salesforce] Exported: ${sfObject}`);
                this.metrics.recordsInSync++;
            }
            return response;
        } catch (error) {
            console.error('[Salesforce] Export failed:', error);
            return null;
        }
    }

    async mapFields(mappingId, fieldMappings) {
        try {
            const response = await API.put(`${this.apiEndpoint}/mappings/${mappingId}/fields`, { mappings: fieldMappings });
            if (response.success) {
                this.fieldMappings.set(mappingId, fieldMappings);
                Toast.show('Field mappings updated', 'success');
            }
            return response;
        } catch (error) {
            console.error('[Salesforce] Field mapping failed:', error);
            return null;
        }
    }

    async subscribePushTopic(sfObject) {
        try {
            const response = await API.post(`${this.apiEndpoint}/push-topics/${sfObject}`);
            if (response.success) {
                this.pushTopics.set(sfObject, response.data);
                Toast.show(`Push topic subscribed for ${this.salesforceObjects[sfObject]?.label}`, 'success');
            }
            return response;
        } catch (error) {
            console.error('[Salesforce] Push topic subscription failed:', error);
            return null;
        }
    }

    isObjectMapped(sfObject) {
        return Array.from(this.syncMappings.values()).some(m => m.sfObject === sfObject && m.enabled);
    }

    openMappingWizard() {
        const mappedObjects = Array.from(this.syncMappings.values()).map(m => m.sfObject);
        const available = Object.entries(this.salesforceObjects).filter(([key]) => !mappedObjects.includes(key));

        const wizardHtml = `
            <div class="sf-mapping-wizard">
                <h4>Create Salesforce Sync Mapping</h4>
                <p>Select Salesforce objects to sync with CRM</p>
                <div class="sf-objects-grid">
                    ${available.map(([key, obj]) => `
                        <div class="sf-object-card" onclick="window.Global.Salesforce.createMapping({sfObject:'${key}',mode:'rest_api',enabled:true});window.Global.Modal.close();" style="cursor:pointer;border-top:3px solid ${obj.color};">
                            <i class="fas ${obj.icon}" style="color:${obj.color};font-size:28px;"></i>
                            <strong>${obj.label}</strong>
                            <small>SF: ${key} → CRM: ${obj.crmEntity}</small>
                        </div>
                    `).join('')}
                    ${available.length === 0 ? '<p>All Salesforce objects are mapped</p>' : ''}
                </div>
            </div>`;

        new Modal({ title: 'Add Salesforce Mapping', content: wizardHtml, size: 'large' }).open();
    }

    calculateMetrics() {
        this.metrics.totalMappings = this.syncMappings.size;
        this.metrics.recordsInSync = Array.from(this.syncMappings.values()).reduce((sum, m) => sum + (m.recordCount || 0), 0);
    }

    async render(container = null) {
        const target = container || document.getElementById('salesforce-container');
        if (!target) return;

        const html = `
            <div class="salesforce-container">
                <div class="sf-header">
                    <h3><i class="fab fa-salesforce"></i> Salesforce Integration</h3>
                    <div class="header-actions">
                        ${this.connectionConfig.isConnected ? `
                            <span class="org-badge">${this.connectionConfig.isSandbox ? '🏖️ Sandbox' : '🏢 Production'} | ${this.connectionConfig.orgName || 'Unknown Org'}</span>
                            <button class="btn btn-outline" onclick="window.Global.Salesforce.openMappingWizard()"><i class="fas fa-plus"></i> Add Mapping</button>
                            <button class="btn btn-primary" onclick="window.Global.Salesforce.syncAll()"><i class="fas fa-sync ${this.isSyncing ? 'fa-spin' : ''}"></i> Sync All</button>
                            <button class="btn btn-outline" onclick="window.Global.Salesforce.disconnect()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.Salesforce.connect()"><i class="fab fa-salesforce"></i> Connect Salesforce</button>
                        `}
                    </div>
                </div>

                <div class="connection-bar" style="background:${this.connectionConfig.isConnected ? '#10B98115' : '#F59E0B15'};border:1px solid ${this.connectionConfig.isConnected ? '#10B98130' : '#F59E0B30'}">
                    <span style="color:${this.connectionConfig.isConnected ? '#10B981' : '#F59E0B'}"><i class="fas fa-circle"></i> ${this.connectionConfig.isConnected ? 'Connected' : 'Not Connected'}</span>
                    ${this.connectionConfig.isConnected ? `<span>| API v${this.connectionConfig.apiVersion}</span>` : ''}
                    ${this.metrics.lastFullSync ? `<span>| Last sync: ${Formatters.relativeTime(this.metrics.lastFullSync)}</span>` : ''}
                </div>

                <div class="sf-metrics">
                    <div class="metric-card"><i class="fas fa-random"></i><span>${this.metrics.totalMappings}</span><small>Mappings</small></div>
                    <div class="metric-card"><i class="fas fa-check-circle"></i><span>${this.metrics.recordsInSync.toLocaleString()}</span><small>In Sync</small></div>
                    <div class="metric-card"><i class="fas fa-clock"></i><span>${this.metrics.recordsPending}</span><small>Pending</small></div>
                    <div class="metric-card"><i class="fas fa-chart-line"></i><span>${this.metrics.apiCallsUsed}/${this.metrics.apiCallsLimit}</span><small>API Calls</small></div>
                </div>

                <div class="sf-objects-section">
                    <h4>Salesforce Objects</h4>
                    <div class="sf-objects-grid">
                        ${Object.entries(this.salesforceObjects).map(([key, obj]) => {
                            const mapping = Array.from(this.syncMappings.values()).find(m => m.sfObject === key);
                            return `
                                <div class="sf-object-card ${mapping ? 'mapped' : ''}" style="border-top:3px solid ${obj.color}">
                                    <i class="fas ${obj.icon}" style="color:${obj.color};font-size:24px;"></i>
                                    <strong>${obj.label}</strong>
                                    <small>${key}</small>
                                    ${mapping ? `
                                        <span class="status-badge" style="background:${mapping.statusInfo.color}20;color:${mapping.statusInfo.color}">${mapping.statusInfo.label}</span>
                                        <div class="object-actions">
                                            <button class="btn btn-sm btn-primary" onclick="window.Global.Salesforce.syncObject('${key}')"><i class="fas fa-sync"></i> Sync</button>
                                            <button class="btn btn-sm btn-outline" onclick="window.Global.Salesforce.bulkSync('${key}')"><i class="fas fa-database"></i> Bulk</button>
                                            <button class="btn btn-sm btn-outline" onclick="window.Global.Salesforce.deleteMapping('${mapping.id}')"><i class="fas fa-trash"></i></button>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="sync-modes-section">
                    <h4>Sync Modes</h4>
                    <div class="modes-grid">
                        ${Object.entries(this.syncModes).map(([key, mode]) => `
                            <div class="mode-card ${this.syncConfig.mode === key ? 'active' : ''}" style="border-left:3px solid ${mode.color}">
                                <i class="fas ${mode.icon}" style="color:${mode.color}"></i>
                                <strong>${mode.label}</strong>
                                <small>${mode.description}</small>
                                <span class="speed-badge">${mode.speed}</span>
                            </div>
                        `).join('')}
                    </div>
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
        EventBus.off('salesforce:connect'); EventBus.off('salesforce:disconnect'); EventBus.off('salesforce:sync-all');
        EventBus.off('salesforce:sync-object'); EventBus.off('salesforce:create-mapping');
        console.log('[Salesforce] Module destroyed');
    }
}

const salesforceIntegration = new SalesforceIntegration();
export { salesforceIntegration, SalesforceIntegration };
export default salesforceIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Salesforce = salesforceIntegration; }


