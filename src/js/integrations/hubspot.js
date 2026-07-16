/**
 * 11 AVATAR DIGITAL HUB - HubSpot Integration Module
 * Enterprise-grade HubSpot CRM integration
 * Contacts, Deals, Companies, Tickets, Marketing, pipeline sync
 * 
 * @module HubSpotIntegration
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
 * HubSpot Integration - Complete HubSpot CRM sync
 * Objects, properties, pipelines, associations, workflows
 */
class HubSpotIntegration {
    constructor() {
        this.moduleName = 'hubspot';
        this.apiEndpoint = '/api/hubspot';
        this.cachePrefix = 'hs_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.hubSpotObjects = {
            'contacts': { label: 'Contacts', icon: 'fa-address-book', color: '#FF7A59', crmEntity: 'contacts' },
            'companies': { label: 'Companies', icon: 'fa-building', color: '#33475B', crmEntity: 'clients' },
            'deals': { label: 'Deals', icon: 'fa-handshake', color: '#00BDA5', crmEntity: 'deals' },
            'tickets': { label: 'Tickets', icon: 'fa-ticket-alt', color: '#6A78D1', crmEntity: 'tasks' },
            'products': { label: 'Products', icon: 'fa-box', color: '#F5A623', crmEntity: 'products' },
            'owners': { label: 'Owners', icon: 'fa-user-tie', color: '#516F90', crmEntity: 'users' },
            'engagements': { label: 'Engagements', icon: 'fa-comments', color: '#E85D3F', crmEntity: 'activities' }
        };

        this.syncDirections = {
            'bidirectional': { label: 'Two-Way Sync', icon: 'fa-exchange-alt', color: '#3B82F6' },
            'hubspot_to_crm': { label: 'HubSpot → CRM', icon: 'fa-arrow-right', color: '#FF7A59' },
            'crm_to_hubspot': { label: 'CRM → HubSpot', icon: 'fa-arrow-left', color: '#10B981' }
        };

        this.syncStatuses = {
            'not_synced': { label: 'Not Synced', color: '#6B7280' },
            'syncing': { label: 'Syncing', color: '#3B82F6' },
            'in_sync': { label: 'In Sync', color: '#10B981' },
            'out_of_sync': { label: 'Out of Sync', color: '#F59E0B' },
            'error': { label: 'Error', color: '#DC2626' }
        };

        this.connectionConfig = {
            appId: null,
            clientId: null,
            clientSecret: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            portalId: null,
            hubDomain: null,
            isConnected: false,
            scopes: []
        };

        this.syncMappings = new Map();
        this.syncHistory = new Map();
        this.propertyMappings = new Map();
        this.pipelineMappings = new Map();
        this.webhookSubscriptions = new Map();
        this.isSyncing = false;

        this.syncSchedule = {
            enabled: true,
            frequency: 'every_15_minutes',
            objects: ['contacts', 'companies', 'deals'],
            realTimeEnabled: true
        };

        this.filters = { object: 'all', status: 'all', search: '' };
        this.currentView = 'dashboard';

        this.metrics = {
            totalContacts: 0, totalCompanies: 0, totalDeals: 0,
            recordsInSync: 0, recordsOutOfSync: 0, lastFullSync: null,
            apiCallsRemaining: 0, apiCallsLimit: 0
        };

        this.init();
    }

    async init() {
        try {
            console.log('[HubSpot] Initializing HubSpot integration...');
            const canAccess = await Permissions.check('hubspot', 'read');
            if (!canAccess) { console.warn('[HubSpot] Access denied'); return; }

            await this.loadConfiguration();
            await this.loadSyncMappings();
            await this.loadSyncHistory();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('hubspot-container')) await this.render();
            console.log('[HubSpot] Initialized');
            EventBus.emit('hubspot:ready', { connected: this.connectionConfig.isConnected });
        } catch (error) {
            console.error('[HubSpot] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.connectionConfig = { ...this.connectionConfig, ...response.data };
                this.syncSchedule = { ...this.syncSchedule, ...response.data.schedule };
            }
        } catch (error) { console.error('[HubSpot] Config load failed:', error); }
    }

    async loadSyncMappings() {
        try {
            const response = await API.get(`${this.apiEndpoint}/mappings`);
            if (response.success && response.data) {
                this.syncMappings.clear();
                response.data.forEach(mapping => {
                    this.syncMappings.set(mapping.id, {
                        ...mapping,
                        objectInfo: this.hubSpotObjects[mapping.hsObject],
                        directionInfo: this.syncDirections[mapping.direction],
                        statusInfo: this.syncStatuses[mapping.status || 'not_synced'],
                        lastSyncFormatted: mapping.lastSyncAt ? Formatters.relativeTime(mapping.lastSyncAt) : 'Never',
                        recordCount: mapping.recordCount || 0
                    });
                });
            }
        } catch (error) { console.error('[HubSpot] Mappings load failed:', error); }
    }

    async loadSyncHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history?limit=100`);
            if (response.success && response.data) {
                this.syncHistory.clear();
                response.data.logs?.forEach(log => {
                    this.syncHistory.set(log.id, {
                        ...log, formattedDate: Formatters.date(log.syncedAt),
                        objectLabel: this.hubSpotObjects[log.object]?.label || log.object,
                        statusInfo: this.syncStatuses[log.status] || this.syncStatuses.not_synced
                    });
                });
            }
        } catch (error) { console.error('[HubSpot] History load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('hubspot:connect', this.connect.bind(this));
        EventBus.on('hubspot:disconnect', this.disconnect.bind(this));
        EventBus.on('hubspot:sync-all', this.syncAll.bind(this));
        EventBus.on('hubspot:sync-object', this.syncObject.bind(this));
        EventBus.on('hubspot:create-mapping', this.createMapping.bind(this));
        EventBus.on('hubspot:delete-mapping', this.deleteMapping.bind(this));
        EventBus.on('hubspot:import', this.importFromHubSpot.bind(this));
        EventBus.on('hubspot:export', this.exportToHubSpot.bind(this));
        EventBus.on('hubspot:map-pipeline', this.mapPipelineStages.bind(this));
        EventBus.on('hubspot:register-webhook', this.registerWebhook.bind(this));

        EventBus.on('client:created', (client) => {
            if (this.syncSchedule.realTimeEnabled && this.isObjectMapped('companies')) {
                this.exportToHubSpot('companies', client);
            }
        });
        EventBus.on('deal:won', (deal) => {
            if (this.syncSchedule.realTimeEnabled && this.isObjectMapped('deals')) {
                this.exportToHubSpot('deals', deal);
            }
        });

        console.log('[HubSpot] Event listeners initialized');
    }

    async connect() {
        try {
            const response = await API.get(`${this.apiEndpoint}/auth-url`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 700;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'HubSpotAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 180000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'hubspot-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'hubspot-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code });
            await this.loadConfiguration();
            Toast.show('HubSpot connected!', 'success');
            EventBus.emit('hubspot:connected');
            await this.render();
        } catch (error) {
            console.error('[HubSpot] Connection failed:', error);
            Toast.show('HubSpot connection failed: ' + error.message, 'error');
        }
    }

    async disconnect() {
        try {
            const confirmed = await this.confirmDialog('Disconnect HubSpot', 'Disconnect HubSpot? Sync mappings will be paused.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.connectionConfig.isConnected = false;
            this.syncMappings.clear();
            Toast.show('HubSpot disconnected', 'info');
            await this.render();
        } catch (error) { console.error('[HubSpot] Disconnect failed:', error); }
    }

    async syncAll() {
        if (this.isSyncing) { Toast.show('Sync already in progress', 'warning'); return; }
        try {
            this.isSyncing = true;
            const startTime = performance.now();
            Toast.show('Starting HubSpot sync...', 'info');
            let synced = 0, failed = 0;

            for (const [id, mapping] of this.syncMappings) {
                if (!mapping.enabled) continue;
                const result = await this.syncObject(mapping.hsObject);
                if (result?.success) synced += result.count || 0;
                else failed++;
            }

            const duration = ((performance.now() - startTime) / 1000).toFixed(1);
            this.metrics.recordsInSync += synced;
            this.metrics.recordsOutOfSync += failed;
            this.metrics.lastFullSync = new Date();

            Toast.show(`HubSpot sync complete! ${synced} records in ${duration}s`, 'success');
            await this.loadSyncHistory();
            await this.render();
        } catch (error) {
            console.error('[HubSpot] Sync all failed:', error);
            Toast.show('Sync failed: ' + error.message, 'error');
        } finally { this.isSyncing = false; }
    }

    async syncObject(hsObject) {
        try {
            Toast.show(`Syncing ${this.hubSpotObjects[hsObject]?.label || hsObject}...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/sync/${hsObject}`);
            if (response.success) {
                this.metrics.recordsInSync += response.data.count || 0;
                return response.data;
            } else {
                this.metrics.recordsOutOfSync++;
                return null;
            }
        } catch (error) {
            console.error(`[HubSpot] Sync ${hsObject} failed:`, error);
            this.metrics.recordsOutOfSync++;
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
            console.error('[HubSpot] Create mapping failed:', error);
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
        } catch (error) { console.error('[HubSpot] Delete mapping failed:', error); }
    }

    async importFromHubSpot(hsObject) {
        try {
            Toast.show(`Importing ${this.hubSpotObjects[hsObject]?.label} from HubSpot...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/import/${hsObject}`);
            if (response.success) {
                Toast.show(`Imported ${response.data.count || 0} records`, 'success');
                await this.loadSyncHistory();
                await this.render();
            }
            return response;
        } catch (error) {
            console.error('[HubSpot] Import failed:', error);
            Toast.show('Import failed', 'error');
            return null;
        }
    }

    async exportToHubSpot(hsObject, data) {
        try {
            const response = await API.post(`${this.apiEndpoint}/export/${hsObject}`, { data });
            if (response.success) {
                console.log(`[HubSpot] Exported to HubSpot: ${hsObject}`);
                this.metrics.recordsInSync++;
            }
            return response;
        } catch (error) {
            console.error('[HubSpot] Export failed:', error);
            return null;
        }
    }

    async mapPipelineStages(hubSpotPipelineId, crmPipelineId, stageMappings) {
        try {
            const response = await API.post(`${this.apiEndpoint}/pipeline-mapping`, {
                hubSpotPipelineId, crmPipelineId, stages: stageMappings
            });
            if (response.success) {
                this.pipelineMappings.set(hubSpotPipelineId, stageMappings);
                Toast.show('Pipeline stages mapped', 'success');
            }
            return response;
        } catch (error) {
            console.error('[HubSpot] Pipeline mapping failed:', error);
            return null;
        }
    }

    async registerWebhook(objectType) {
        try {
            const response = await API.post(`${this.apiEndpoint}/webhooks`, { objectType });
            if (response.success) {
                this.webhookSubscriptions.set(objectType, response.data);
                Toast.show(`Webhook registered for ${this.hubSpotObjects[objectType]?.label}`, 'success');
            }
            return response;
        } catch (error) {
            console.error('[HubSpot] Webhook registration failed:', error);
            return null;
        }
    }

    isObjectMapped(hsObject) {
        return Array.from(this.syncMappings.values()).some(m => m.hsObject === hsObject && m.enabled);
    }

    openMappingDialog() {
        const mappedObjects = Array.from(this.syncMappings.values()).map(m => m.hsObject);
        const available = Object.entries(this.hubSpotObjects).filter(([key]) => !mappedObjects.includes(key));

        const dialogHtml = `
            <div class="mapping-dialog">
                <h4>Add HubSpot Sync Mapping</h4>
                <div class="objects-grid">
                    ${available.map(([key, obj]) => `
                        <div class="object-card" onclick="window.Global.HubSpot.showDirectionPicker('${key}')" style="cursor:pointer;">
                            <i class="fas ${obj.icon}" style="color:${obj.color};font-size:28px;"></i>
                            <strong>${obj.label}</strong>
                            <small>Maps to: ${obj.crmEntity}</small>
                        </div>
                    `).join('')}
                    ${available.length === 0 ? '<p>All objects are mapped</p>' : ''}
                </div>
            </div>`;

        const modal = new Modal({ title: 'Add HubSpot Mapping', content: dialogHtml, size: 'large' });
        modal.open();
    }

    showDirectionPicker(hsObject) {
        const obj = this.hubSpotObjects[hsObject];
        const directionHtml = `
            <div class="direction-picker">
                <p>Select sync direction for <strong>${obj.label}</strong></p>
                ${Object.entries(this.syncDirections).map(([key, dir]) => `
                    <button class="btn btn-outline btn-block direction-btn" onclick="window.Global.HubSpot.createMapping({hsObject:'${hsObject}',direction:'${key}',enabled:true});window.Global.Modal.close();">
                        <i class="fas ${dir.icon}" style="color:${dir.color}"></i> ${dir.label}
                    </button>
                `).join('')}
            </div>`;

        new Modal({ title: 'Sync Direction', content: directionHtml, size: 'small' }).open();
    }

    calculateMetrics() {
        let inSync = 0, outOfSync = 0;
        this.syncMappings.forEach(m => {
            if (m.status === 'in_sync') inSync += m.recordCount || 0;
            else if (m.status === 'out_of_sync') outOfSync += m.recordCount || 0;
        });
        this.metrics.recordsInSync = inSync;
        this.metrics.recordsOutOfSync = outOfSync;
    }

    async render(container = null) {
        const target = container || document.getElementById('hubspot-container');
        if (!target) return;

        const html = `
            <div class="hubspot-container">
                <div class="hubspot-header">
                    <h3><i class="fab fa-hubspot"></i> HubSpot Integration</h3>
                    <div class="header-actions">
                        ${this.connectionConfig.isConnected ? `
                            <button class="btn btn-outline" onclick="window.Global.HubSpot.openMappingDialog()"><i class="fas fa-plus"></i> Add Mapping</button>
                            <button class="btn btn-primary" onclick="window.Global.HubSpot.syncAll()"><i class="fas fa-sync ${this.isSyncing ? 'fa-spin' : ''}"></i> Sync All</button>
                            <button class="btn btn-outline" onclick="window.Global.HubSpot.disconnect()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.HubSpot.connect()"><i class="fab fa-hubspot"></i> Connect HubSpot</button>
                        `}
                    </div>
                </div>

                <div class="connection-bar" style="background:${this.connectionConfig.isConnected ? '#10B98115' : '#F59E0B15'};border:1px solid ${this.connectionConfig.isConnected ? '#10B98130' : '#F59E0B30'}">
                    <span style="color:${this.connectionConfig.isConnected ? '#10B981' : '#F59E0B'}"><i class="fas fa-circle"></i> ${this.connectionConfig.isConnected ? 'Connected' : 'Not Connected'}</span>
                    ${this.metrics.lastFullSync ? `<span>| Last sync: ${Formatters.relativeTime(this.metrics.lastFullSync)}</span>` : ''}
                </div>

                <div class="hubspot-metrics">
                    <div class="metric-card"><i class="fas fa-random"></i><span>${this.syncMappings.size}</span><small>Mappings</small></div>
                    <div class="metric-card"><i class="fas fa-check-circle"></i><span>${this.metrics.recordsInSync}</span><small>In Sync</small></div>
                    <div class="metric-card"><i class="fas fa-exclamation-triangle"></i><span>${this.metrics.recordsOutOfSync}</span><small>Out of Sync</small></div>
                </div>

                <div class="hubspot-objects">
                    <h4>HubSpot Objects</h4>
                    <div class="objects-grid">
                        ${Object.entries(this.hubSpotObjects).map(([key, obj]) => {
                            const mapping = Array.from(this.syncMappings.values()).find(m => m.hsObject === key);
                            return `
                                <div class="object-card ${mapping ? 'mapped' : ''}" style="border-top:3px solid ${obj.color}">
                                    <i class="fas ${obj.icon}" style="color:${obj.color};font-size:28px;"></i>
                                    <strong>${obj.label}</strong>
                                    <small>→ ${obj.crmEntity}</small>
                                    ${mapping ? `
                                        <span class="direction-badge" style="color:${mapping.directionInfo?.color}"><i class="fas ${mapping.directionInfo?.icon}"></i> ${mapping.directionInfo?.label}</span>
                                        <div class="object-actions">
                                            <button class="btn btn-sm btn-primary" onclick="window.Global.HubSpot.syncObject('${key}')"><i class="fas fa-sync"></i></button>
                                            <button class="btn btn-sm btn-outline" onclick="window.Global.HubSpot.deleteMapping('${mapping.id}')"><i class="fas fa-trash"></i></button>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
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
        EventBus.off('hubspot:connect'); EventBus.off('hubspot:disconnect'); EventBus.off('hubspot:sync-all');
        EventBus.off('hubspot:sync-object'); EventBus.off('hubspot:create-mapping');
        console.log('[HubSpot] Module destroyed');
    }
}

const hubspotIntegration = new HubSpotIntegration();
export { hubspotIntegration, HubSpotIntegration };
export default hubspotIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.HubSpot = hubspotIntegration; }
