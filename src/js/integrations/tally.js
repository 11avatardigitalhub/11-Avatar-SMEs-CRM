/**
 * 11 AVATAR DIGITAL HUB - Tally ERP Integration Module
 * Enterprise-grade Tally Prime/ERP 9 integration
 * Sync invoices, payments, ledgers, inventory, GST reports with Tally
 * 
 * @module TallyIntegration
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
 * Tally Integration - Complete Tally ERP sync engine
 * XML/JSON API, TDL, ODBC, sync scheduler
 */
class TallyIntegration {
    constructor() {
        this.moduleName = 'tally';
        this.apiEndpoint = '/api/tally';
        this.cachePrefix = 'tally_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.connectionModes = {
            'odbc': { label: 'ODBC Connection', icon: 'fa-database', color: '#3B82F6', description: 'Direct database connection via ODBC driver' },
            'xml_api': { label: 'Tally XML API', icon: 'fa-code', color: '#10B981', description: 'HTTP-based XML request/response via Tally Gateway' },
            'tdl': { label: 'TDL (Tally Definition Language)', icon: 'fa-cogs', color: '#8B5CF6', description: 'Custom TDL plugin for deep integration' },
            'export_import': { label: 'File Export/Import', icon: 'fa-file-import', color: '#F59E0B', description: 'XML/JSON file based sync' }
        };

        this.syncEntities = {
            'invoices': { label: 'Sales Invoices', tallyVoucher: 'Sales', icon: 'fa-file-invoice', color: '#3B82F6' },
            'payments': { label: 'Payment Receipts', tallyVoucher: 'Receipt', icon: 'fa-rupee-sign', color: '#10B981' },
            'credit_notes': { label: 'Credit Notes', tallyVoucher: 'Credit Note', icon: 'fa-undo', color: '#F59E0B' },
            'debit_notes': { label: 'Debit Notes', tallyVoucher: 'Debit Note', icon: 'fa-redo', color: '#F97316' },
            'ledgers': { label: 'Ledgers/Masters', tallyVoucher: 'Ledger', icon: 'fa-book', color: '#8B5CF6' },
            'stock_items': { label: 'Stock Items', tallyVoucher: 'StockItem', icon: 'fa-box', color: '#EC4899' },
            'gst_returns': { label: 'GST Returns', tallyVoucher: 'GST', icon: 'fa-file-contract', color: '#DC2626' },
            'purchase_orders': { label: 'Purchase Orders', tallyVoucher: 'Purchase Order', icon: 'fa-shopping-cart', color: '#14B8A6' }
        };

        this.syncStatuses = {
            'pending': { label: 'Pending', color: '#F59E0B', icon: 'fa-clock' },
            'syncing': { label: 'Syncing', color: '#3B82F6', icon: 'fa-spinner' },
            'synced': { label: 'Synced', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'conflict': { label: 'Conflict', color: '#F97316', icon: 'fa-exclamation-triangle' },
            'skipped': { label: 'Skipped', color: '#6B7280', icon: 'fa-forward' }
        };

        this.connectionConfig = {
            mode: 'xml_api',
            host: 'localhost',
            port: 9000,
            companyName: '',
            username: '',
            password: '',
            odbcDriver: 'Tally ODBC Driver 64',
            odbcDSN: '',
            isConnected: false,
            lastConnected: null,
            version: '',
            serialNumber: '',
            licenseType: ''
        };

        this.syncHistory = new Map();
        this.pendingSyncs = new Map();
        this.syncLogs = [];
        this.isSyncing = false;

        this.syncSchedule = {
            enabled: false,
            frequency: 'every_30_minutes',
            lastSync: null,
            nextSync: null,
            entities: ['invoices', 'payments', 'ledgers']
        };

        this.filters = { entity: 'all', status: 'all', search: '', dateRange: null };
        this.pagination = { page: 1, limit: 50, total: 0 };

        this.metrics = {
            totalSynced: 0, pendingSync: 0, failedSync: 0,
            lastSyncTime: null, syncDuration: 0, conflicts: 0
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Tally] Initializing Tally integration...');
            const canAccess = await Permissions.check('tally', 'read');
            if (!canAccess) { console.warn('[Tally] Access denied'); return; }

            await this.loadConfiguration();
            await this.loadSyncHistory();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('tally-container')) await this.render();
            console.log('[Tally] Initialized');
            EventBus.emit('tally:ready', { connected: this.connectionConfig.isConnected });
        } catch (error) {
            console.error('[Tally] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.connectionConfig = { ...this.connectionConfig, ...response.data.connection };
                this.syncSchedule = { ...this.syncSchedule, ...response.data.schedule };
            }
        } catch (error) { console.error('[Tally] Config load failed:', error); }
    }

    async loadSyncHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history?limit=100`);
            if (response.success && response.data) {
                this.syncHistory.clear();
                response.data.logs?.forEach(log => {
                    this.syncHistory.set(log.id, {
                        ...log, formattedDate: Formatters.date(log.syncedAt),
                        formattedTime: Formatters.time(log.syncedAt),
                        entityInfo: this.syncEntities[log.entity] || { label: log.entity },
                        statusInfo: this.syncStatuses[log.status] || this.syncStatuses.pending
                    });
                });
            }
        } catch (error) { console.error('[Tally] History load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('tally:connect', this.testConnection.bind(this));
        EventBus.on('tally:sync-now', this.syncNow.bind(this));
        EventBus.on('tally:sync-entity', this.syncEntity.bind(this));
        EventBus.on('tally:export-xml', this.exportXML.bind(this));
        EventBus.on('tally:import-xml', this.importXML.bind(this));
        EventBus.on('tally:push-invoice', this.pushInvoiceToTally.bind(this));
        EventBus.on('tally:pull-ledgers', this.pullLedgers.bind(this));
        EventBus.on('tally:resolve-conflict', this.resolveConflict.bind(this));
        EventBus.on('tally:schedule-sync', this.updateSyncSchedule.bind(this));

        EventBus.on('invoice:created', (invoice) => {
            if (this.syncSchedule.entities.includes('invoices') && this.connectionConfig.isConnected) {
                this.pushInvoiceToTally(invoice.id);
            }
        });

        console.log('[Tally] Event listeners initialized');
    }

    async testConnection(config = null) {
        try {
            const testConfig = config || this.connectionConfig;
            Toast.show('Testing Tally connection...', 'info');

            const response = await API.post(`${this.apiEndpoint}/test-connection`, testConfig);
            if (response.success) {
                this.connectionConfig.isConnected = true;
                this.connectionConfig.version = response.data.version || '';
                this.connectionConfig.companyName = response.data.company || '';
                this.connectionConfig.lastConnected = new Date().toISOString();
                Toast.show(`Connected to Tally! Company: ${response.data.company}`, 'success');
                await this.saveConfiguration();
            } else {
                this.connectionConfig.isConnected = false;
                Toast.show('Connection failed: ' + (response.error || 'Unknown error'), 'error');
            }
            await this.render();
            return response;
        } catch (error) {
            console.error('[Tally] Connection test failed:', error);
            this.connectionConfig.isConnected = false;
            Toast.show('Connection failed: ' + error.message, 'error');
            return null;
        }
    }

    async syncNow() {
        if (this.isSyncing) { Toast.show('Sync already in progress', 'warning'); return; }
        try {
            this.isSyncing = true;
            const startTime = performance.now();
            Toast.show('Starting sync with Tally...', 'info');

            const entitiesToSync = this.syncSchedule.entities;
            let totalSynced = 0, totalFailed = 0;

            for (const entity of entitiesToSync) {
                const result = await this.syncEntity(entity);
                if (result?.success) totalSynced += result.count || 0;
                else totalFailed++;
            }

            const duration = performance.now() - startTime;
            this.metrics.lastSyncTime = new Date();
            this.metrics.syncDuration = duration;
            this.syncSchedule.lastSync = new Date().toISOString();

            Toast.show(`Sync complete! ${totalSynced} records in ${(duration / 1000).toFixed(1)}s`, 'success');
            await this.loadSyncHistory();
            await this.render();
        } catch (error) {
            console.error('[Tally] Sync failed:', error);
            Toast.show('Sync failed: ' + error.message, 'error');
        } finally {
            this.isSyncing = false;
        }
    }

    async syncEntity(entity) {
        try {
            Toast.show(`Syncing ${this.syncEntities[entity]?.label || entity}...`, 'info');
            const response = await API.post(`${this.apiEndpoint}/sync/${entity}`);
            if (response.success) {
                this.metrics.totalSynced += response.data.count || 0;
                return response.data;
            } else {
                this.metrics.failedSync++;
                return null;
            }
        } catch (error) {
            console.error(`[Tally] Sync ${entity} failed:`, error);
            this.metrics.failedSync++;
            return null;
        }
    }

    async pushInvoiceToTally(invoiceId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/push/invoice/${invoiceId}`);
            if (response.success) {
                Toast.show('Invoice pushed to Tally', 'success');
                this.metrics.totalSynced++;
                EventBus.emit('tally:invoice-pushed', { invoiceId, tallyVoucherNo: response.data.voucherNo });
            } else {
                Toast.show('Push failed: ' + (response.error || 'Error'), 'error');
                this.metrics.failedSync++;
            }
            return response;
        } catch (error) {
            console.error('[Tally] Push invoice failed:', error);
            return null;
        }
    }

    async pullLedgers() {
        try {
            Toast.show('Pulling ledgers from Tally...', 'info');
            const response = await API.get(`${this.apiEndpoint}/pull/ledgers`);
            if (response.success) {
                Toast.show(`Pulled ${response.data.count || 0} ledgers`, 'success');
                this.metrics.totalSynced += response.data.count || 0;
            }
            return response;
        } catch (error) {
            console.error('[Tally] Pull ledgers failed:', error);
            return null;
        }
    }

    async exportXML(entity, dateRange) {
        try {
            const response = await API.post(`${this.apiEndpoint}/export/xml`, { entity, dateRange });
            if (response.success && response.data.xml) {
                const blob = new Blob([response.data.xml], { type: 'application/xml' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `tally-${entity}-${Date.now()}.xml`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                Toast.show('XML exported', 'success');
            }
            return response;
        } catch (error) {
            console.error('[Tally] XML export failed:', error);
            return null;
        }
    }

    async importXML(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            Toast.show('Importing XML...', 'info');
            const response = await API.upload(`${this.apiEndpoint}/import/xml`, formData);
            if (response.success) {
                Toast.show(`Imported ${response.data.count || 0} records`, 'success');
                await this.loadSyncHistory();
                await this.render();
            }
            return response;
        } catch (error) {
            console.error('[Tally] XML import failed:', error);
            Toast.show('Import failed', 'error');
            return null;
        }
    }

    async resolveConflict(syncId, resolution) {
        try {
            const response = await API.post(`${this.apiEndpoint}/resolve-conflict/${syncId}`, resolution);
            if (response.success) {
                Toast.show('Conflict resolved', 'success');
                await this.loadSyncHistory();
            }
            return response;
        } catch (error) {
            console.error('[Tally] Conflict resolution failed:', error);
            return null;
        }
    }

    async updateSyncSchedule(schedule) {
        try {
            const response = await API.put(`${this.apiEndpoint}/schedule`, schedule);
            if (response.success) {
                this.syncSchedule = { ...this.syncSchedule, ...schedule };
                Toast.show('Sync schedule updated', 'success');
                await this.render();
            }
            return response;
        } catch (error) {
            console.error('[Tally] Schedule update failed:', error);
            return null;
        }
    }

    async saveConfiguration() {
        try {
            await API.put(`${this.apiEndpoint}/config`, {
                connection: this.connectionConfig,
                schedule: this.syncSchedule
            });
        } catch (error) { console.error('[Tally] Config save failed:', error); }
    }

    openConnectionSettings() {
        const formHtml = `
            <div class="tally-settings-form">
                <form id="tally-connection-form">
                    <div class="form-group">
                        <label>Connection Mode *</label>
                        <select name="mode" id="conn-mode" onchange="window.Global.Tally.toggleModeFields(this.value)">
                            ${Object.entries(this.connectionModes).map(([key, mode]) => `
                                <option value="${key}" ${this.connectionConfig.mode === key ? 'selected' : ''}>${mode.label} - ${mode.description}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="xml-fields">
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label>Tally Server Host</label>
                                <input type="text" name="host" value="${this.connectionConfig.host}" placeholder="localhost">
                            </div>
                            <div class="form-group col-6">
                                <label>Port</label>
                                <input type="number" name="port" value="${this.connectionConfig.port}" placeholder="9000">
                            </div>
                        </div>
                    </div>
                    <div id="odbc-fields" style="display:${this.connectionConfig.mode === 'odbc' ? 'block' : 'none'}">
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label>ODBC Driver</label>
                                <input type="text" name="odbcDriver" value="${this.connectionConfig.odbcDriver}">
                            </div>
                            <div class="form-group col-6">
                                <label>DSN Name</label>
                                <input type="text" name="odbcDSN" value="${this.connectionConfig.odbcDSN}">
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Tally Company Name</label>
                        <input type="text" name="companyName" value="${this.connectionConfig.companyName}" placeholder="Auto-detected on connect">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="window.Global.Tally.testConnection()"><i class="fas fa-plug"></i> Test Connection</button>
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save & Connect</button>
                    </div>
                </form>
            </div>`;

        const modal = new Modal({ title: 'Tally Connection Settings', content: formHtml, size: 'large' });
        modal.open();

        setTimeout(() => {
            document.getElementById('tally-connection-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                this.connectionConfig = {
                    mode: formData.get('mode'), host: formData.get('host'), port: parseInt(formData.get('port')),
                    companyName: formData.get('companyName'), odbcDriver: formData.get('odbcDriver'), odbcDSN: formData.get('odbcDSN')
                };
                await this.saveConfiguration();
                await this.testConnection();
                Modal.close();
            });
        }, 100);
    }

    toggleModeFields(mode) {
        document.getElementById('xml-fields').style.display = mode === 'xml_api' ? 'block' : 'none';
        document.getElementById('odbc-fields').style.display = mode === 'odbc' ? 'block' : 'none';
    }

    calculateMetrics() {
        let synced = 0, pending = 0, failed = 0, conflicts = 0;
        this.syncHistory.forEach(log => {
            if (log.status === 'synced') synced++;
            else if (log.status === 'pending') pending++;
            else if (log.status === 'failed') failed++;
            else if (log.status === 'conflict') conflicts++;
        });
        this.metrics.totalSynced = synced;
        this.metrics.pendingSync = pending;
        this.metrics.failedSync = failed;
        this.metrics.conflicts = conflicts;
    }

    async render(container = null) {
        const target = container || document.getElementById('tally-container');
        if (!target) return;

        const connMode = this.connectionModes[this.connectionConfig.mode] || this.connectionModes.xml_api;

        const html = `
            <div class="tally-container">
                <div class="tally-header">
                    <h3><i class="fas fa-calculator"></i> Tally ERP Integration</h3>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="window.Global.Tally.openConnectionSettings()"><i class="fas fa-cog"></i> Settings</button>
                        <button class="btn btn-outline" onclick="window.Global.Tally.exportXML('invoices')"><i class="fas fa-download"></i> Export XML</button>
                        <button class="btn btn-primary" onclick="window.Global.Tally.syncNow()" ${!this.connectionConfig.isConnected ? 'disabled' : ''}><i class="fas fa-sync"></i> Sync Now</button>
                    </div>
                </div>

                <div class="connection-status" style="background:${this.connectionConfig.isConnected ? '#10B98115' : '#F59E0B15'};border:1px solid ${this.connectionConfig.isConnected ? '#10B98130' : '#F59E0B30'}">
                    <span style="color:${this.connectionConfig.isConnected ? '#10B981' : '#F59E0B'}">
                        <i class="fas fa-circle"></i> ${this.connectionConfig.isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                    ${this.connectionConfig.isConnected ? `<span>| Mode: ${connMode.label} | Company: ${this.connectionConfig.companyName || 'N/A'}</span>` : ''}
                    ${this.metrics.lastSyncTime ? `<span>| Last Sync: ${Formatters.relativeTime(this.metrics.lastSyncTime)}</span>` : ''}
                </div>

                <div class="tally-metrics">
                    <div class="metric-card"><i class="fas fa-check-circle"></i><span>${this.metrics.totalSynced}</span><small>Synced</small></div>
                    <div class="metric-card"><i class="fas fa-clock"></i><span>${this.metrics.pendingSync}</span><small>Pending</small></div>
                    <div class="metric-card"><i class="fas fa-times-circle"></i><span>${this.metrics.failedSync}</span><small>Failed</small></div>
                    <div class="metric-card"><i class="fas fa-exclamation-triangle"></i><span>${this.metrics.conflicts}</span><small>Conflicts</small></div>
                </div>

                <div class="sync-entities">
                    <h4>Sync Entities</h4>
                    <div class="entities-grid">
                        ${Object.entries(this.syncEntities).map(([key, entity]) => `
                            <div class="entity-card" style="border-left:3px solid ${entity.color}">
                                <i class="fas ${entity.icon}" style="color:${entity.color}"></i>
                                <div>
                                    <strong>${entity.label}</strong>
                                    <small>Tally: ${entity.tallyVoucher}</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" ${this.syncSchedule.entities.includes(key) ? 'checked' : ''} 
                                           onchange="window.Global.Tally.toggleSyncEntity('${key}', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="sync-history">
                    <h4>Sync History</h4>
                    <div class="history-list">
                        ${Array.from(this.syncHistory.values()).slice(0, 20).map(log => `
                            <div class="history-item">
                                <span class="status-badge" style="background:${log.statusInfo.color}20;color:${log.statusInfo.color}"><i class="fas ${log.statusInfo.icon}"></i> ${log.statusInfo.label}</span>
                                <span>${log.entityInfo.label}</span>
                                <span>${log.formattedDate} ${log.formattedTime}</span>
                                <span>${log.count || 0} records</span>
                            </div>
                        `).join('') || '<p>No sync history</p>'}
                    </div>
                </div>
            </div>`;

        target.innerHTML = html;
    }

    toggleSyncEntity(entity, enabled) {
        if (enabled) {
            if (!this.syncSchedule.entities.includes(entity)) this.syncSchedule.entities.push(entity);
        } else {
            this.syncSchedule.entities = this.syncSchedule.entities.filter(e => e !== entity);
        }
        this.saveConfiguration();
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
        EventBus.off('tally:connect'); EventBus.off('tally:sync-now'); EventBus.off('tally:sync-entity');
        EventBus.off('tally:export-xml'); EventBus.off('tally:import-xml'); EventBus.off('tally:push-invoice');
        console.log('[Tally] Module destroyed');
    }
}

const tallyIntegration = new TallyIntegration();
export { tallyIntegration, TallyIntegration };
export default tallyIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Tally = tallyIntegration; }

