/**
 * 11 AVATAR DIGITAL HUB - Webhook Manager Integration
 * Enterprise-grade webhook management & event system
 * Webhook CRUD, event triggers, retry logic, security, logging
 * 
 * @module WebhookIntegration
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
 * Webhook Manager - Complete webhook lifecycle management
 * Event-driven webhooks with retry, security, logging
 */
class WebhookIntegration {
    constructor() {
        this.moduleName = 'webhook';
        this.apiEndpoint = '/api/webhooks';
        this.cachePrefix = 'wh_';
        this.cacheTimeout = 5 * 60 * 1000;

        this.eventTypes = {
            'lead.created': { label: 'Lead Created', category: 'crm', icon: 'fa-user-plus', color: '#3B82F6' },
            'lead.updated': { label: 'Lead Updated', category: 'crm', icon: 'fa-user-edit', color: '#3B82F6' },
            'lead.converted': { label: 'Lead Converted', category: 'crm', icon: 'fa-exchange-alt', color: '#10B981' },
            'client.created': { label: 'Client Created', category: 'crm', icon: 'fa-building', color: '#8B5CF6' },
            'client.updated': { label: 'Client Updated', category: 'crm', icon: 'fa-building', color: '#8B5CF6' },
            'deal.created': { label: 'Deal Created', category: 'crm', icon: 'fa-handshake', color: '#F59E0B' },
            'deal.stage_changed': { label: 'Deal Stage Changed', category: 'crm', icon: 'fa-arrow-right', color: '#F59E0B' },
            'deal.won': { label: 'Deal Won', category: 'crm', icon: 'fa-trophy', color: '#10B981' },
            'deal.lost': { label: 'Deal Lost', category: 'crm', icon: 'fa-times-circle', color: '#DC2626' },
            'invoice.created': { label: 'Invoice Created', category: 'finance', icon: 'fa-file-invoice', color: '#6366F1' },
            'invoice.sent': { label: 'Invoice Sent', category: 'finance', icon: 'fa-paper-plane', color: '#6366F1' },
            'invoice.paid': { label: 'Invoice Paid', category: 'finance', icon: 'fa-check-circle', color: '#10B981' },
            'invoice.overdue': { label: 'Invoice Overdue', category: 'finance', icon: 'fa-exclamation-triangle', color: '#DC2626' },
            'payment.completed': { label: 'Payment Completed', category: 'finance', icon: 'fa-rupee-sign', color: '#10B981' },
            'payment.failed': { label: 'Payment Failed', category: 'finance', icon: 'fa-times', color: '#DC2626' },
            'payment.refunded': { label: 'Payment Refunded', category: 'finance', icon: 'fa-undo', color: '#8B5CF6' },
            'task.created': { label: 'Task Created', category: 'projects', icon: 'fa-tasks', color: '#EC4899' },
            'task.completed': { label: 'Task Completed', category: 'projects', icon: 'fa-check', color: '#10B981' },
            'project.created': { label: 'Project Created', category: 'projects', icon: 'fa-project-diagram', color: '#14B8A6' },
            'project.completed': { label: 'Project Completed', category: 'projects', icon: 'fa-flag-checkered', color: '#10B981' },
            'whatsapp.message_received': { label: 'WhatsApp Message Received', category: 'communication', icon: 'fa-whatsapp', color: '#25D366' },
            'whatsapp.message_sent': { label: 'WhatsApp Message Sent', category: 'communication', icon: 'fa-whatsapp', color: '#25D366' },
            'email.sent': { label: 'Email Sent', category: 'communication', icon: 'fa-envelope', color: '#EC4899' },
            'email.opened': { label: 'Email Opened', category: 'communication', icon: 'fa-envelope-open', color: '#EC4899' },
            'email.clicked': { label: 'Email Clicked', category: 'communication', icon: 'fa-mouse-pointer', color: '#EC4899' },
            'sms.sent': { label: 'SMS Sent', category: 'communication', icon: 'fa-sms', color: '#10B981' },
            'sms.delivered': { label: 'SMS Delivered', category: 'communication', icon: 'fa-check', color: '#10B981' }
        };

        this.webhookStatuses = {
            'active': { label: 'Active', color: '#10B981', icon: 'fa-check-circle' },
            'paused': { label: 'Paused', color: '#F59E0B', icon: 'fa-pause-circle' },
            'failing': { label: 'Failing', color: '#F97316', icon: 'fa-exclamation-triangle' },
            'disabled': { label: 'Disabled', color: '#DC2626', icon: 'fa-ban' }
        };

        this.deliveryStatuses = {
            'pending': { label: 'Pending', color: '#F59E0B' },
            'delivered': { label: 'Delivered', color: '#10B981' },
            'failed': { label: 'Failed', color: '#DC2626' },
            'retrying': { label: 'Retrying', color: '#3B82F6' }
        };

        this.webhooks = new Map();
        this.deliveryLogs = new Map();
        this.selectedWebhookId = null;

        this.filters = { status: 'all', category: 'all', search: '' };
        this.pagination = { page: 1, limit: 25, total: 0, totalPages: 0 };

        this.metrics = {
            totalWebhooks: 0, activeWebhooks: 0,
            totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0,
            successRate: 0, averageResponseTime: 0, lastUpdated: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Webhook] Initializing webhook manager...');
            const canAccess = await Permissions.check('webhooks', 'read');
            if (!canAccess) { console.warn('[Webhook] Access denied'); return; }

            await this.loadWebhooks();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('webhook-container')) await this.render();
            console.log('[Webhook] Initialized');
            EventBus.emit('webhook:ready', { webhooks: this.webhooks.size });
        } catch (error) {
            console.error('[Webhook] Init failed:', error);
        }
    }

    async loadWebhooks(page = 1) {
        try {
            this.pagination.page = page;
            const params = new URLSearchParams({ page: page.toString(), limit: this.pagination.limit.toString() });
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.search) params.set('search', this.filters.search);

            const response = await API.get(`${this.apiEndpoint}/list?${params.toString()}`);
            if (response.success && response.data) {
                this.webhooks.clear();
                response.data.webhooks?.forEach(wh => {
                    this.webhooks.set(wh.id, {
                        ...wh,
                        formattedCreated: Formatters.date(wh.createdAt),
                        formattedUpdated: Formatters.relativeTime(wh.updatedAt),
                        statusInfo: this.webhookStatuses[wh.status] || this.webhookStatuses.active,
                        eventCount: wh.events?.length || 0,
                        eventsList: wh.events?.map(e => this.eventTypes[e]?.label || e).join(', ') || 'All',
                        lastDelivery: wh.lastDeliveryAt ? Formatters.relativeTime(wh.lastDeliveryAt) : 'Never',
                        hasSecret: !!wh.secret,
                        deliveryStats: {
                            total: wh.totalDeliveries || 0,
                            success: wh.successfulDeliveries || 0,
                            failed: wh.failedDeliveries || 0,
                            successRate: wh.totalDeliveries > 0 ? Math.round((wh.successfulDeliveries / wh.totalDeliveries) * 100) : 0
                        }
                    });
                });
                if (response.data.pagination) {
                    this.pagination.total = response.data.pagination.total || 0;
                    this.pagination.totalPages = response.data.pagination.totalPages || 1;
                }
                this.metrics.totalWebhooks = this.webhooks.size;
            }
        } catch (error) { console.error('[Webhook] Load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('webhook:create', this.createWebhook.bind(this));
        EventBus.on('webhook:update', this.updateWebhook.bind(this));
        EventBus.on('webhook:delete', this.deleteWebhook.bind(this));
        EventBus.on('webhook:test', this.testWebhook.bind(this));
        EventBus.on('webhook:pause', this.toggleWebhook.bind(this));
        EventBus.on('webhook:view-logs', this.viewDeliveryLogs.bind(this));
        EventBus.on('webhook:retry', this.retryDelivery.bind(this));
        console.log('[Webhook] Event listeners initialized');
    }

    async createWebhook(webhookData) {
        try {
            if (!webhookData.url) throw new Error('Webhook URL is required');
            if (!Validators.isURL(webhookData.url)) throw new Error('Invalid URL format');
            if (!webhookData.events || webhookData.events.length === 0) throw new Error('At least one event required');

            const response = await API.post(`${this.apiEndpoint}/create`, {
                name: webhookData.name || 'Untitled Webhook',
                url: webhookData.url,
                events: webhookData.events,
                secret: webhookData.secret || this.generateSecret(),
                description: webhookData.description || '',
                headers: webhookData.headers || {},
                retryCount: webhookData.retryCount || 3,
                retryDelay: webhookData.retryDelay || 5000,
                status: 'active'
            });

            if (!response.success) throw new Error(response.error);
            Toast.show('Webhook created successfully', 'success');
            await this.loadWebhooks();
            EventBus.emit('webhook:created', response.data);
            return response.data;
        } catch (error) {
            console.error('[Webhook] Create failed:', error);
            Toast.show('Failed to create webhook: ' + error.message, 'error');
            return null;
        }
    }

    async updateWebhook(webhookId, updates) {
        try {
            const response = await API.put(`${this.apiEndpoint}/${webhookId}`, updates);
            if (!response.success) throw new Error(response.error);
            const webhook = this.webhooks.get(webhookId);
            if (webhook) Object.assign(webhook, response.data);
            Toast.show('Webhook updated', 'success');
            return response.data;
        } catch (error) {
            console.error('[Webhook] Update failed:', error);
            Toast.show('Update failed', 'error');
            return null;
        }
    }

    async deleteWebhook(webhookId) {
        try {
            const wh = this.webhooks.get(webhookId);
            if (!wh) throw new Error('Webhook not found');
            const confirmed = await this.confirmDialog('Delete Webhook', `Delete webhook "${wh.name}"? This cannot be undone.`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/${webhookId}`);
            this.webhooks.delete(webhookId);
            Toast.show('Webhook deleted', 'info');
            await this.loadWebhooks();
        } catch (error) {
            console.error('[Webhook] Delete failed:', error);
            Toast.show('Delete failed', 'error');
        }
    }

    async toggleWebhook(webhookId) {
        try {
            const wh = this.webhooks.get(webhookId);
            if (!wh) throw new Error('Webhook not found');
            const newStatus = wh.status === 'active' ? 'paused' : 'active';
            await this.updateWebhook(webhookId, { status: newStatus });
            Toast.show(`Webhook ${newStatus === 'active' ? 'resumed' : 'paused'}`, 'info');
        } catch (error) {
            console.error('[Webhook] Toggle failed:', error);
        }
    }

    async testWebhook(webhookId) {
        try {
            const wh = this.webhooks.get(webhookId);
            if (!wh) throw new Error('Webhook not found');
            Toast.show('Sending test payload...', 'info');

            const response = await API.post(`${this.apiEndpoint}/${webhookId}/test`, {
                event: 'test',
                payload: { test: true, timestamp: new Date().toISOString(), message: 'This is a test webhook from 11 Avatar Digital Hub' }
            });

            if (response.success) {
                const status = response.data.statusCode;
                const icon = status >= 200 && status < 300 ? '✅' : '❌';
                Toast.show(`${icon} Test delivered! Status: ${status} (${response.data.duration}ms)`, status < 300 ? 'success' : 'error');
            }
            return response.data;
        } catch (error) {
            console.error('[Webhook] Test failed:', error);
            Toast.show('Test failed: ' + error.message, 'error');
            return null;
        }
    }

    async viewDeliveryLogs(webhookId) {
        try {
            const response = await API.get(`${this.apiEndpoint}/${webhookId}/logs?limit=50`);
            if (response.success && response.data) {
                this.deliveryLogs.set(webhookId, response.data.logs || []);
                const logs = response.data.logs || [];
                const logsHtml = logs.length === 0 ? '<p>No delivery logs yet</p>' : `
                    <div class="delivery-logs-list">
                        ${logs.slice(0, 20).map(log => `
                            <div class="log-item">
                                <span class="status-code ${log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'error'}">${log.statusCode}</span>
                                <span>${log.event}</span>
                                <span>${Formatters.relativeTime(log.deliveredAt)}</span>
                                <span>${log.duration}ms</span>
                                ${log.error ? `<span class="error-message">${this.escapeHtml(log.error)}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>`;
                new Modal({ title: 'Delivery Logs', content: logsHtml, size: 'large' }).open();
            }
        } catch (error) { console.error('[Webhook] Logs failed:', error); }
    }

    async retryDelivery(webhookId, deliveryId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/${webhookId}/retry/${deliveryId}`);
            if (response.success) {
                Toast.show('Retry queued', 'success');
                return response.data;
            }
        } catch (error) { console.error('[Webhook] Retry failed:', error); return null; }
    }

    openCreateWebhook(webhookData = null) {
        const isEditing = !!webhookData;
        const eventCategories = {};
        Object.entries(this.eventTypes).forEach(([key, evt]) => {
            if (!eventCategories[evt.category]) eventCategories[evt.category] = [];
            eventCategories[evt.category].push({ key, ...evt });
        });

        const formHtml = `
            <div class="webhook-form">
                <form id="webhook-form">
                    <div class="form-group">
                        <label for="wh-name">Webhook Name *</label>
                        <input type="text" id="wh-name" name="name" required value="${webhookData?.name || ''}" placeholder="My Webhook">
                    </div>
                    <div class="form-group">
                        <label for="wh-url">Endpoint URL *</label>
                        <input type="url" id="wh-url" name="url" required value="${webhookData?.url || ''}" placeholder="https://your-server.com/webhook">
                    </div>
                    <div class="form-group">
                        <label for="wh-description">Description</label>
                        <textarea id="wh-description" name="description" rows="2">${webhookData?.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Events *</label>
                        <div class="events-selector">
                            ${Object.entries(eventCategories).map(([cat, events]) => `
                                <div class="event-category">
                                    <h5 style="color:${events[0].color}"><i class="fas fa-folder"></i> ${cat.toUpperCase()}</h5>
                                    ${events.map(evt => `
                                        <label class="event-checkbox">
                                            <input type="checkbox" name="events" value="${evt.key}" 
                                                ${webhookData?.events?.includes(evt.key) ? 'checked' : ''}>
                                            <i class="fas ${evt.icon}" style="color:${evt.color}"></i> ${evt.label}
                                        </label>
                                    `).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label for="wh-secret">Secret Key</label>
                            <div class="input-with-btn">
                                <input type="text" id="wh-secret" name="secret" value="${webhookData?.secret || this.generateSecret()}">
                                <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('wh-secret').value = window.Global.Webhook.generateSecret()">Generate</button>
                            </div>
                        </div>
                        <div class="form-group col-3">
                            <label for="wh-retries">Max Retries</label>
                            <input type="number" id="wh-retries" name="retryCount" value="${webhookData?.retryCount || 3}" min="0" max="10">
                        </div>
                        <div class="form-group col-3">
                            <label for="wh-delay">Retry Delay (ms)</label>
                            <input type="number" id="wh-delay" name="retryDelay" value="${webhookData?.retryDelay || 5000}" min="1000" step="1000">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${isEditing ? 'Update' : 'Create'} Webhook</button>
                    </div>
                </form>
            </div>`;

        const modal = new Modal({ title: isEditing ? 'Edit Webhook' : 'Create Webhook', content: formHtml, size: 'xlarge' });
        modal.open();

        setTimeout(() => {
            const form = document.getElementById('webhook-form');
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = {
                    name: formData.get('name'), url: formData.get('url'),
                    description: formData.get('description'), secret: formData.get('secret'),
                    events: formData.getAll('events'), retryCount: parseInt(formData.get('retryCount')),
                    retryDelay: parseInt(formData.get('retryDelay'))
                };
                try {
                    const result = isEditing ? await this.updateWebhook(webhookData.id, data) : await this.createWebhook(data);
                    if (result) { Modal.close(); await this.loadWebhooks(); await this.render(); }
                } catch (error) { Toast.show('Failed: ' + error.message, 'error'); }
            });
        }, 100);
    }

    generateSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return 'whsec_' + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    calculateMetrics() {
        let active = 0, totalDel = 0, successDel = 0, failedDel = 0;
        this.webhooks.forEach(wh => {
            if (wh.status === 'active') active++;
            totalDel += wh.deliveryStats?.total || 0;
            successDel += wh.deliveryStats?.success || 0;
            failedDel += wh.deliveryStats?.failed || 0;
        });
        this.metrics.activeWebhooks = active;
        this.metrics.totalDeliveries = totalDel;
        this.metrics.successfulDeliveries = successDel;
        this.metrics.failedDeliveries = failedDel;
        this.metrics.successRate = totalDel > 0 ? Math.round((successDel / totalDel) * 100) : 0;
    }

    async render(container = null) {
        const target = container || document.getElementById('webhook-container');
        if (!target) return;
        const html = `
            <div class="webhook-container">
                <div class="webhook-header">
                    <h3><i class="fas fa-broadcast-tower"></i> Webhooks</h3>
                    <button class="btn btn-primary" onclick="window.Global.Webhook.openCreateWebhook()"><i class="fas fa-plus"></i> Add Webhook</button>
                </div>
                <div class="webhook-metrics">
                    <div class="metric-card"><span>${this.metrics.activeWebhooks}</span><small>Active</small></div>
                    <div class="metric-card"><span>${this.metrics.totalDeliveries}</span><small>Deliveries</small></div>
                    <div class="metric-card"><span>${this.metrics.successRate}%</span><small>Success Rate</small></div>
                    <div class="metric-card"><span>${this.metrics.failedDeliveries}</span><small>Failed</small></div>
                </div>
                <div class="webhook-list">
                    ${Array.from(this.webhooks.values()).map(wh => `
                        <div class="webhook-card" style="border-left:4px solid ${wh.statusInfo.color}">
                            <div class="wh-header">
                                <strong>${this.escapeHtml(wh.name)}</strong>
                                <span class="status-badge" style="background:${wh.statusInfo.color}20;color:${wh.statusInfo.color}">${wh.statusInfo.label}</span>
                            </div>
                            <div class="wh-url"><code>${this.escapeHtml(wh.url)}</code></div>
                            <div class="wh-events">${wh.eventsList}</div>
                            <div class="wh-stats">
                                <span>${wh.deliveryStats.success}/${wh.deliveryStats.total} delivered</span>
                                <span>${wh.deliveryStats.successRate}%</span>
                            </div>
                            <div class="wh-actions">
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Webhook.testWebhook('${wh.id}')"><i class="fas fa-flask"></i> Test</button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Webhook.viewDeliveryLogs('${wh.id}')"><i class="fas fa-list"></i> Logs</button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Webhook.toggleWebhook('${wh.id}')"><i class="fas fa-${wh.status === 'active' ? 'pause' : 'play'}"></i></button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Webhook.openCreateWebhook(${JSON.stringify(wh).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state"><i class="fas fa-broadcast-tower"></i><p>No webhooks configured</p></div>'}
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
        EventBus.off('webhook:create'); EventBus.off('webhook:update'); EventBus.off('webhook:delete');
        EventBus.off('webhook:test'); EventBus.off('webhook:pause'); EventBus.off('webhook:view-logs');
        console.log('[Webhook] Module destroyed');
    }
}

const webhookIntegration = new WebhookIntegration();
export { webhookIntegration, WebhookIntegration };
export default webhookIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Webhook = webhookIntegration; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
