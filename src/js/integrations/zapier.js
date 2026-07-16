/**
 * 11 AVATAR DIGITAL HUB - Zapier Integration Module
 * Enterprise-grade Zapier/NoCode automation platform integration
 * Triggers, actions, Zaps management, webhook endpoints for automation
 * 
 * @module ZapierIntegration
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
 * Zapier Integration - Complete no-code automation platform
 * Triggers, actions, Zaps, webhook endpoints, automation recipes
 */
class ZapierIntegration {
    constructor() {
        this.moduleName = 'zapier';
        this.apiEndpoint = '/api/zapier';
        this.cachePrefix = 'zap_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.triggers = {
            'lead.created': { label: 'New Lead Created', category: 'CRM', description: 'Triggers when a new lead is added', sampleData: { id: 'lead-123', name: 'John Doe', email: 'john@example.com', phone: '9876543210', source: 'website', status: 'new' } },
            'lead.converted': { label: 'Lead Converted', category: 'CRM', description: 'Triggers when a lead is converted to client', sampleData: { id: 'lead-123', name: 'John Doe', convertedAt: '2026-07-16T10:30:00Z', clientId: 'client-456' } },
            'deal.won': { label: 'Deal Won', category: 'CRM', description: 'Triggers when a deal is marked as won', sampleData: { id: 'deal-789', title: 'Enterprise Deal', value: 500000, clientName: 'Acme Corp', wonAt: '2026-07-16T10:30:00Z' } },
            'deal.stage_changed': { label: 'Deal Stage Changed', category: 'CRM', description: 'Triggers when deal moves to new stage', sampleData: { id: 'deal-789', title: 'Enterprise Deal', oldStage: 'proposal', newStage: 'negotiation' } },
            'client.created': { label: 'New Client Created', category: 'CRM', description: 'Triggers when a new client is onboarded', sampleData: { id: 'client-456', company: 'Acme Corp', email: 'info@acme.com', gstin: '27AABCG2194N1Z1' } },
            'invoice.paid': { label: 'Invoice Paid', category: 'Finance', description: 'Triggers when an invoice is fully paid', sampleData: { id: 'inv-001', invoiceNumber: 'INV-26-0001', amount: 50000, clientName: 'Acme Corp', paidAt: '2026-07-16T10:30:00Z' } },
            'invoice.overdue': { label: 'Invoice Overdue', category: 'Finance', description: 'Triggers when invoice crosses due date', sampleData: { id: 'inv-001', invoiceNumber: 'INV-26-0001', amount: 50000, dueDate: '2026-07-01', daysOverdue: 15 } },
            'payment.completed': { label: 'Payment Completed', category: 'Finance', description: 'Triggers when payment is received', sampleData: { id: 'pay-001', amount: 50000, method: 'upi', clientName: 'Acme Corp', paymentDate: '2026-07-16' } },
            'task.completed': { label: 'Task Completed', category: 'Projects', description: 'Triggers when a task is marked done', sampleData: { id: 'task-001', title: 'Send Proposal', assignee: 'John', completedAt: '2026-07-16T10:30:00Z' } },
            'whatsapp.message_received': { label: 'WhatsApp Message Received', category: 'Communication', description: 'Triggers on incoming WhatsApp message', sampleData: { from: '919876543210', content: 'Hi, interested in your services', timestamp: '2026-07-16T10:30:00Z' } }
        };

        this.actions = {
            'create_lead': { label: 'Create Lead', category: 'CRM', description: 'Create a new lead in CRM', inputFields: ['name', 'email', 'phone', 'source', 'notes'] },
            'create_client': { label: 'Create Client', category: 'CRM', description: 'Create a new client', inputFields: ['companyName', 'email', 'phone', 'gstin', 'address'] },
            'create_invoice': { label: 'Create Invoice', category: 'Finance', description: 'Generate a new invoice', inputFields: ['clientId', 'amount', 'description', 'dueDate'] },
            'create_task': { label: 'Create Task', category: 'Projects', description: 'Add a new task', inputFields: ['title', 'description', 'assignee', 'priority', 'dueDate'] },
            'send_whatsapp': { label: 'Send WhatsApp Message', category: 'Communication', description: 'Send WhatsApp via CloudWA', inputFields: ['phone', 'message', 'templateName'] },
            'send_email': { label: 'Send Email', category: 'Communication', description: 'Send transactional email', inputFields: ['to', 'subject', 'body', 'templateId'] },
            'send_sms': { label: 'Send SMS', category: 'Communication', description: 'Send SMS notification', inputFields: ['phone', 'message', 'templateId'] },
            'update_deal': { label: 'Update Deal Stage', category: 'CRM', description: 'Move deal to new stage', inputFields: ['dealId', 'stage', 'notes'] },
            'add_contact': { label: 'Add Contact', category: 'CRM', description: 'Add contact to client', inputFields: ['clientId', 'name', 'email', 'phone', 'designation'] },
            'log_activity': { label: 'Log Activity', category: 'CRM', description: 'Log an activity/note', inputFields: ['entityType', 'entityId', 'subject', 'description'] }
        };

        this.recipes = {
            'lead_to_slack': { label: 'New Lead → Slack Notification', trigger: 'lead.created', action: 'send_slack', description: 'Post new lead details to Slack channel', popularity: 'high' },
            'deal_to_whatsapp': { label: 'Deal Won → WhatsApp Celebrations', trigger: 'deal.won', action: 'send_whatsapp', description: 'Send WhatsApp message when deal is won', popularity: 'high' },
            'invoice_to_email': { label: 'Invoice Created → Email Client', trigger: 'invoice.created', action: 'send_email', description: 'Auto-email invoice to client', popularity: 'high' },
            'payment_to_sms': { label: 'Payment Received → SMS Receipt', trigger: 'payment.completed', action: 'send_sms', description: 'Send SMS receipt on payment', popularity: 'medium' },
            'task_to_google': { label: 'Task Created → Google Calendar', trigger: 'task.created', action: 'create_calendar_event', description: 'Add task as calendar event', popularity: 'medium' },
            'lead_to_sheets': { label: 'New Lead → Google Sheets Row', trigger: 'lead.created', action: 'add_sheet_row', description: 'Log leads to Google Sheets', popularity: 'high' },
            'whatsapp_to_lead': { label: 'WhatsApp → Create Lead', trigger: 'whatsapp.message_received', action: 'create_lead', description: 'Auto-create lead from WhatsApp message', popularity: 'high' },
            'client_to_mailchimp': { label: 'New Client → Mailchimp List', trigger: 'client.created', action: 'add_to_mailchimp', description: 'Add new clients to email list', popularity: 'medium' }
        };

        this.activeZaps = new Map();
        this.zapHistory = new Map();
        this.webhookEndpoints = new Map();

        this.filters = { status: 'all', category: 'all', search: '' };
        this.currentView = 'dashboard';

        this.metrics = {
            totalZaps: 0, activeZaps: 0, pausedZaps: 0,
            totalRuns: 0, successfulRuns: 0, failedRuns: 0,
            successRate: 0, lastRun: null, lastUpdated: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Zapier] Initializing Zapier integration...');
            const canAccess = await Permissions.check('zapier', 'read');
            if (!canAccess) { console.warn('[Zapier] Access denied'); return; }

            await this.loadActiveZaps();
            await this.loadZapHistory();
            await this.loadWebhookEndpoints();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('zapier-container')) await this.render();
            console.log('[Zapier] Initialized');
            EventBus.emit('zapier:ready', { zaps: this.activeZaps.size });
        } catch (error) {
            console.error('[Zapier] Init failed:', error);
        }
    }

    async loadActiveZaps() {
        try {
            const response = await API.get(`${this.apiEndpoint}/zaps`);
            if (response.success && response.data) {
                this.activeZaps.clear();
                response.data.forEach(zap => {
                    this.activeZaps.set(zap.id, {
                        ...zap, formattedCreated: Formatters.date(zap.createdAt),
                        formattedUpdated: Formatters.relativeTime(zap.updatedAt),
                        triggerInfo: this.triggers[zap.trigger] || { label: zap.trigger },
                        actionInfo: this.actions[zap.action] || { label: zap.action },
                        isActive: zap.status === 'active',
                        runStats: { total: zap.totalRuns || 0, success: zap.successfulRuns || 0, failed: zap.failedRuns || 0, lastRun: zap.lastRunAt ? Formatters.relativeTime(zap.lastRunAt) : 'Never' }
                    });
                });
                this.metrics.totalZaps = this.activeZaps.size;
            }
        } catch (error) { console.error('[Zapier] Zaps load failed:', error); }
    }

    async loadZapHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history?limit=50`);
            if (response.success && response.data) {
                this.zapHistory.clear();
                response.data.logs?.forEach(log => {
                    this.zapHistory.set(log.id, {
                        ...log, formattedTime: Formatters.relativeTime(log.executedAt),
                        isSuccess: log.status === 'success',
                        duration: log.duration || 0
                    });
                });
            }
        } catch (error) { console.error('[Zapier] History load failed:', error); }
    }

    async loadWebhookEndpoints() {
        try {
            const response = await API.get(`${this.apiEndpoint}/webhooks`);
            if (response.success && response.data) {
                this.webhookEndpoints.clear();
                response.data.forEach(wh => {
                    this.webhookEndpoints.set(wh.id, {
                        ...wh, webhookUrl: `${API.baseURL}/api/zapier/webhook/${wh.id}`,
                        formattedCreated: Formatters.date(wh.createdAt)
                    });
                });
            }
        } catch (error) { console.error('[Zapier] Webhooks load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('zapier:create-zap', this.createZap.bind(this));
        EventBus.on('zapier:update-zap', this.updateZap.bind(this));
        EventBus.on('zapier:delete-zap', this.deleteZap.bind(this));
        EventBus.on('zapier:toggle-zap', this.toggleZap.bind(this));
        EventBus.on('zapier:test-zap', this.testZap.bind(this));
        EventBus.on('zapier:generate-webhook', this.generateWebhook.bind(this));
        EventBus.on('zapier:use-recipe', this.useRecipe.bind(this));
        console.log('[Zapier] Event listeners initialized');
    }

    async createZap(zapData) {
        try {
            if (!zapData.trigger) throw new Error('Trigger is required');
            if (!zapData.action) throw new Error('Action is required');

            const response = await API.post(`${this.apiEndpoint}/zaps`, {
                name: zapData.name || 'Untitled Zap',
                trigger: zapData.trigger,
                action: zapData.action,
                actionConfig: zapData.actionConfig || {},
                filters: zapData.filters || {},
                status: zapData.status || 'active'
            });

            if (!response.success) throw new Error(response.error);
            Toast.show('Zap created successfully!', 'success');
            await this.loadActiveZaps();
            EventBus.emit('zapier:zap-created', response.data);
            return response.data;
        } catch (error) {
            console.error('[Zapier] Zap creation failed:', error);
            Toast.show('Failed to create Zap: ' + error.message, 'error');
            return null;
        }
    }

    async updateZap(zapId, updates) {
        try {
            const response = await API.put(`${this.apiEndpoint}/zaps/${zapId}`, updates);
            if (!response.success) throw new Error(response.error);
            Toast.show('Zap updated', 'success');
            await this.loadActiveZaps();
            return response.data;
        } catch (error) {
            console.error('[Zapier] Update failed:', error);
            return null;
        }
    }

    async deleteZap(zapId) {
        try {
            const zap = this.activeZaps.get(zapId);
            if (!zap) throw new Error('Zap not found');
            const confirmed = await this.confirmDialog('Delete Zap', `Delete "${zap.name}"? This cannot be undone.`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/zaps/${zapId}`);
            this.activeZaps.delete(zapId);
            Toast.show('Zap deleted', 'info');
            await this.loadActiveZaps();
        } catch (error) {
            console.error('[Zapier] Delete failed:', error);
        }
    }

    async toggleZap(zapId) {
        try {
            const zap = this.activeZaps.get(zapId);
            if (!zap) throw new Error('Zap not found');
            const newStatus = zap.status === 'active' ? 'paused' : 'active';
            await this.updateZap(zapId, { status: newStatus });
            Toast.show(`Zap ${newStatus === 'active' ? 'activated' : 'paused'}`, 'info');
        } catch (error) {
            console.error('[Zapier] Toggle failed:', error);
        }
    }

    async testZap(zapId) {
        try {
            const zap = this.activeZaps.get(zapId);
            if (!zap) throw new Error('Zap not found');

            Toast.show('Testing Zap...', 'info');
            const triggerData = this.triggers[zap.trigger]?.sampleData || { test: true };

            const response = await API.post(`${this.apiEndpoint}/zaps/${zapId}/test`, {
                trigger: zap.trigger,
                payload: triggerData
            });

            if (response.success) {
                const icon = response.data.status === 'success' ? '✅' : '❌';
                Toast.show(`${icon} Zap test ${response.data.status}! (${response.data.duration}ms)`, response.data.status === 'success' ? 'success' : 'error');
            }
            return response.data;
        } catch (error) {
            console.error('[Zapier] Test failed:', error);
            Toast.show('Test failed: ' + error.message, 'error');
            return null;
        }
    }

    async generateWebhook() {
        try {
            const response = await API.post(`${this.apiEndpoint}/webhooks`, {
                name: `Webhook-${Date.now()}`,
                events: ['*']
            });
            if (!response.success) throw new Error(response.error);
            await this.loadWebhookEndpoints();
            Toast.show('Webhook endpoint generated!', 'success');
            return response.data;
        } catch (error) {
            console.error('[Zapier] Webhook generation failed:', error);
            return null;
        }
    }

    async useRecipe(recipeKey) {
        const recipe = this.recipes[recipeKey];
        if (!recipe) { Toast.show('Recipe not found', 'error'); return; }
        this.openZapCreator({ trigger: recipe.trigger, action: recipe.action, name: recipe.label });
    }

    openZapCreator(prefill = {}) {
        const triggerOptions = Object.entries(this.triggers).map(([key, t]) => `<option value="${key}" ${prefill.trigger === key ? 'selected' : ''}>${t.label} - ${t.category}</option>`).join('');
        const actionOptions = Object.entries(this.actions).map(([key, a]) => `<option value="${key}" ${prefill.action === key ? 'selected' : ''}>${a.label} - ${a.category}</option>`).join('');

        const formHtml = `
            <div class="zap-creator">
                <form id="zap-form">
                    <div class="form-group">
                        <label for="zap-name">Zap Name *</label>
                        <input type="text" id="zap-name" name="name" required value="${prefill.name || ''}" placeholder="e.g., Lead to Slack Notification">
                    </div>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Trigger (When) *</label>
                            <select name="trigger" id="zap-trigger" required onchange="window.Global.Zapier.showTriggerPreview(this.value)">
                                <option value="">Select trigger...</option>
                                ${triggerOptions}
                            </select>
                            <div id="trigger-preview" class="preview-box" style="margin-top:8px;"></div>
                        </div>
                        <div class="form-group col-6">
                            <label>Action (Do) *</label>
                            <select name="action" id="zap-action" required onchange="window.Global.Zapier.showActionFields(this.value)">
                                <option value="">Select action...</option>
                                ${actionOptions}
                            </select>
                            <div id="action-fields" style="margin-top:8px;"></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-bolt"></i> Create Zap</button>
                    </div>
                </form>
            </div>`;

        const modal = new Modal({ title: 'Create New Zap', content: formHtml, size: 'large' });
        modal.open();

        setTimeout(() => {
            const form = document.getElementById('zap-form');
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const result = await this.createZap({
                    name: formData.get('name'),
                    trigger: formData.get('trigger'),
                    action: formData.get('action')
                });
                if (result) { Modal.close(); await this.render(); }
            });
        }, 100);
    }

    showTriggerPreview(triggerKey) {
        const trigger = this.triggers[triggerKey];
        const preview = document.getElementById('trigger-preview');
        if (preview && trigger) {
            preview.innerHTML = `<div class="sample-data"><small>Sample payload:</small><pre>${JSON.stringify(trigger.sampleData, null, 2)}</pre></div>`;
        }
    }

    showActionFields(actionKey) {
        const action = this.actions[actionKey];
        const fieldsDiv = document.getElementById('action-fields');
        if (fieldsDiv && action && action.inputFields) {
            fieldsDiv.innerHTML = action.inputFields.map(field => `
                <div class="form-group" style="margin-bottom:6px;">
                    <label>${field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                    <input type="text" name="action_${field}" placeholder="{{${field}}}" class="form-control-sm">
                </div>
            `).join('');
        }
    }

    openRecipeBrowser() {
        const recipeHtml = Object.entries(this.recipes).map(([key, recipe]) => `
            <div class="recipe-card" onclick="window.Global.Zapier.useRecipe('${key}');window.Global.Modal.close();" style="cursor:pointer;">
                <div class="recipe-header">
                    <strong>${recipe.label}</strong>
                    <span class="popularity-badge">${recipe.popularity === 'high' ? '⭐ Popular' : ''}</span>
                </div>
                <p>${recipe.description}</p>
                <div class="recipe-flow">
                    <span class="trigger-badge"><i class="fas fa-bolt"></i> ${this.triggers[recipe.trigger]?.label || recipe.trigger}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="action-badge"><i class="fas fa-cog"></i> ${this.actions[recipe.action]?.label || recipe.action}</span>
                </div>
            </div>
        `).join('');

        new Modal({ title: 'Automation Recipes', content: `<div class="recipes-grid">${recipeHtml}</div>`, size: 'large' }).open();
    }

    calculateMetrics() {
        let active = 0, paused = 0, totalRuns = 0, successRuns = 0, failedRuns = 0;
        this.activeZaps.forEach(zap => {
            if (zap.status === 'active') active++; else paused++;
            totalRuns += zap.runStats?.total || 0;
            successRuns += zap.runStats?.success || 0;
            failedRuns += zap.runStats?.failed || 0;
        });
        this.metrics.activeZaps = active;
        this.metrics.pausedZaps = paused;
        this.metrics.totalRuns = totalRuns;
        this.metrics.successfulRuns = successRuns;
        this.metrics.failedRuns = failedRuns;
        this.metrics.successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
    }

    async render(container = null) {
        const target = container || document.getElementById('zapier-container');
        if (!target) return;

        const html = `
            <div class="zapier-container">
                <div class="zapier-header">
                    <h3><i class="fas fa-bolt"></i> Zapier Integration</h3>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="window.Global.Zapier.openRecipeBrowser()"><i class="fas fa-book"></i> Recipes</button>
                        <button class="btn btn-outline" onclick="window.Global.Zapier.generateWebhook()"><i class="fas fa-link"></i> Webhook URL</button>
                        <button class="btn btn-primary" onclick="window.Global.Zapier.openZapCreator()"><i class="fas fa-plus"></i> Create Zap</button>
                    </div>
                </div>

                <div class="zapier-metrics">
                    <div class="metric-card"><i class="fas fa-bolt"></i><span>${this.metrics.activeZaps}</span><small>Active Zaps</small></div>
                    <div class="metric-card"><i class="fas fa-play-circle"></i><span>${this.metrics.totalRuns}</span><small>Total Runs</small></div>
                    <div class="metric-card"><i class="fas fa-check-circle"></i><span>${this.metrics.successRate}%</span><small>Success Rate</small></div>
                    <div class="metric-card"><i class="fas fa-times-circle"></i><span>${this.metrics.failedRuns}</span><small>Failed</small></div>
                </div>

                <div class="zaps-list">
                    <h4>Active Zaps</h4>
                    ${Array.from(this.activeZaps.values()).map(zap => `
                        <div class="zap-card ${zap.isActive ? 'active' : 'paused'}">
                            <div class="zap-status">
                                <span class="status-dot" style="background:${zap.isActive ? '#10B981' : '#F59E0B'}"></span>
                                <strong>${this.escapeHtml(zap.name)}</strong>
                            </div>
                            <div class="zap-flow">
                                <span class="badge"><i class="fas fa-bolt"></i> ${zap.triggerInfo.label}</span>
                                <i class="fas fa-arrow-right"></i>
                                <span class="badge"><i class="fas fa-cog"></i> ${zap.actionInfo.label}</span>
                            </div>
                            <div class="zap-stats">
                                <span>${zap.runStats.success}/${zap.runStats.total} runs</span>
                                <span>Last: ${zap.runStats.lastRun}</span>
                            </div>
                            <div class="zap-actions">
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Zapier.testZap('${zap.id}')"><i class="fas fa-flask"></i> Test</button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Zapier.toggleZap('${zap.id}')"><i class="fas fa-${zap.isActive ? 'pause' : 'play'}"></i></button>
                                <button class="btn btn-sm btn-outline" onclick="window.Global.Zapier.deleteZap('${zap.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state"><i class="fas fa-bolt"></i><p>No Zaps created yet</p></div>'}
                </div>

                <div class="webhook-endpoints">
                    <h4>Webhook Endpoints</h4>
                    ${Array.from(this.webhookEndpoints.values()).map(wh => `
                        <div class="webhook-item">
                            <code>${wh.webhookUrl}</code>
                            <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${wh.webhookUrl}');window.Global.Toast.show('Copied!','success')"><i class="fas fa-copy"></i></button>
                        </div>
                    `).join('') || '<p>No webhook endpoints generated</p>'}
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
        EventBus.off('zapier:create-zap'); EventBus.off('zapier:update-zap'); EventBus.off('zapier:delete-zap');
        EventBus.off('zapier:toggle-zap'); EventBus.off('zapier:test-zap');
        console.log('[Zapier] Module destroyed');
    }
}

const zapierIntegration = new ZapierIntegration();
export { zapierIntegration, ZapierIntegration };
export default zapierIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Zapier = zapierIntegration; }
