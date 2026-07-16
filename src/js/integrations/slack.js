/**
 * 11 AVATAR DIGITAL HUB - Slack Integration Module
 * Enterprise-grade Slack workspace integration
 * Notifications, slash commands, interactive messages, channel management
 * 
 * @module SlackIntegration
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
 * Slack Integration - Complete Slack workspace management
 * OAuth, notifications, slash commands, channels, messages
 */
class SlackIntegration {
    constructor() {
        this.moduleName = 'slack';
        this.apiEndpoint = '/api/slack';
        this.cachePrefix = 'slack_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.connectionStatus = {
            'disconnected': { label: 'Disconnected', color: '#6B7280', icon: 'fa-circle' },
            'connecting': { label: 'Connecting', color: '#F59E0B', icon: 'fa-spinner' },
            'connected': { label: 'Connected', color: '#10B981', icon: 'fa-check-circle' },
            'error': { label: 'Error', color: '#DC2626', icon: 'fa-times-circle' }
        };

        this.messageTypes = {
            'notification': { label: 'Notification', icon: 'fa-bell', color: '#3B82F6' },
            'alert': { label: 'Alert', icon: 'fa-exclamation-triangle', color: '#DC2626' },
            'report': { label: 'Report', icon: 'fa-chart-bar', color: '#8B5CF6' },
            'reminder': { label: 'Reminder', icon: 'fa-clock', color: '#F59E0B' },
            'approval': { label: 'Approval', icon: 'fa-check-circle', color: '#10B981' }
        };

        this.workspace = null;
        this.channels = new Map();
        this.users = new Map();
        this.messages = new Map();
        this.slashCommands = new Map();

        this.config = {
            clientId: null,
            clientSecret: null,
            signingSecret: null,
            botToken: null,
            defaultChannel: '#general',
            notifyOn: ['deal.won', 'payment.completed', 'task.completed', 'lead.created']
        };

        this.filters = { channel: 'all', type: 'all', search: '' };
        this.currentView = 'channels';

        this.metrics = {
            totalMessages: 0, messagesSent: 0, messagesReceived: 0,
            activeChannels: 0, connectedUsers: 0, lastActivity: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Slack] Initializing Slack integration...');
            const canAccess = await Permissions.check('slack', 'read');
            if (!canAccess) { console.warn('[Slack] Access denied'); return; }

            await this.loadConfiguration();
            await this.loadChannels();
            await this.loadUsers();
            this.setupEventListeners();

            if (document.getElementById('slack-container')) await this.render();
            console.log('[Slack] Initialized');
            EventBus.emit('slack:ready', { connected: !!this.config.botToken });
        } catch (error) {
            console.error('[Slack] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.config = { ...this.config, ...response.data };
                if (response.data.workspace) this.workspace = response.data.workspace;
            }
        } catch (error) { console.error('[Slack] Config load failed:', error); }
    }

    async loadChannels() {
        try {
            if (!this.config.botToken) return;
            const response = await API.get(`${this.apiEndpoint}/channels`);
            if (response.success && response.data) {
                this.channels.clear();
                response.data.forEach(ch => {
                    this.channels.set(ch.id, {
                        ...ch, memberCount: ch.members || 0,
                        isPrivate: ch.is_private || false,
                        topic: ch.topic?.value || ''
                    });
                });
                this.metrics.activeChannels = this.channels.size;
            }
        } catch (error) { console.error('[Slack] Channels load failed:', error); }
    }

    async loadUsers() {
        try {
            if (!this.config.botToken) return;
            const response = await API.get(`${this.apiEndpoint}/users`);
            if (response.success && response.data) {
                this.users.clear();
                response.data.forEach(user => {
                    this.users.set(user.id, {
                        ...user, displayName: user.real_name || user.name,
                        isBot: user.is_bot || false, isAdmin: user.is_admin || false
                    });
                });
                this.metrics.connectedUsers = this.users.size;
            }
        } catch (error) { console.error('[Slack] Users load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('slack:connect', this.connectWorkspace.bind(this));
        EventBus.on('slack:disconnect', this.disconnectWorkspace.bind(this));
        EventBus.on('slack:send-message', this.sendMessage.bind(this));
        EventBus.on('slack:send-notification', this.sendNotification.bind(this));
        EventBus.on('slack:register-command', this.registerSlashCommand.bind(this));
        EventBus.on('slack:create-channel', this.createChannel.bind(this));

        // Auto-notify on key events
        EventBus.on('deal:won', (data) => {
            if (this.config.notifyOn.includes('deal.won')) {
                this.sendNotification({
                    type: 'notification',
                    title: '🎉 Deal Won!',
                    message: `*${data.dealName}* worth ${Formatters.currency(data.value)} has been won by ${data.owner || 'team'}!`,
                    color: '#10B981'
                });
            }
        });

        EventBus.on('payment:completed', (data) => {
            if (this.config.notifyOn.includes('payment.completed')) {
                this.sendNotification({
                    type: 'notification',
                    title: '💰 Payment Received',
                    message: `Payment of *${Formatters.currency(data.amount)}* received from *${data.clientName}* for invoice #${data.invoiceNumber}`,
                    color: '#3B82F6'
                });
            }
        });

        console.log('[Slack] Event listeners initialized');
    }

    async connectWorkspace() {
        try {
            const response = await API.get(`${this.apiEndpoint}/auth-url`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 700;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'SlackAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 120000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'slack-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'slack-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code });
            await this.loadConfiguration();
            await this.loadChannels();
            await this.loadUsers();
            Toast.show('Slack workspace connected!', 'success');
            EventBus.emit('slack:connected', this.workspace);
        } catch (error) {
            console.error('[Slack] Connection failed:', error);
            Toast.show('Slack connection failed: ' + error.message, 'error');
        }
    }

    async disconnectWorkspace() {
        try {
            const confirmed = await this.confirmDialog('Disconnect Slack', 'Disconnect Slack workspace? This will stop all notifications.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.workspace = null;
            this.config.botToken = null;
            this.channels.clear();
            this.users.clear();
            Toast.show('Slack workspace disconnected', 'info');
        } catch (error) {
            console.error('[Slack] Disconnect failed:', error);
            Toast.show('Failed to disconnect', 'error');
        }
    }

    async sendMessage(messageData) {
        try {
            if (!this.config.botToken) throw new Error('Slack not connected');

            const payload = {
                channel: messageData.channel || this.config.defaultChannel,
                text: messageData.text || '',
                blocks: messageData.blocks || null,
                attachments: messageData.attachments || [],
                thread_ts: messageData.threadTs || null
            };

            const response = await API.post(`${this.apiEndpoint}/send-message`, payload);
            if (!response.success) throw new Error(response.error);

            this.messages.set(response.data.ts, {
                ...response.data, formattedTime: Formatters.relativeTime(new Date()),
                channel: payload.channel, type: messageData.type || 'notification'
            });
            this.metrics.totalMessages++;
            this.metrics.messagesSent++;
            this.metrics.lastActivity = new Date();

            return response.data;
        } catch (error) {
            console.error('[Slack] Send failed:', error);
            Toast.show('Failed to send Slack message', 'error');
            return null;
        }
    }

    async sendNotification(notifData) {
        const attachment = {
            color: notifData.color || '#3B82F6',
            title: notifData.title || 'Notification',
            text: notifData.message || '',
            fields: notifData.fields || [],
            footer: '11 Avatar Digital Hub CRM',
            ts: Math.floor(Date.now() / 1000)
        };

        if (notifData.actionUrl) {
            attachment.actions = [{
                type: 'button', text: notifData.actionLabel || 'View Details',
                url: notifData.actionUrl, style: 'primary'
            }];
        }

        return await this.sendMessage({
            channel: notifData.channel || this.config.defaultChannel,
            text: `${notifData.title}\n${notifData.message}`,
            attachments: [attachment],
            type: notifData.type || 'notification'
        });
    }

    async registerSlashCommand(commandData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/commands`, {
                command: commandData.command,
                description: commandData.description,
                usage: commandData.usage || '',
                handler: commandData.handler || 'default'
            });
            if (!response.success) throw new Error(response.error);
            this.slashCommands.set(commandData.command, response.data);
            Toast.show(`Slash command /${commandData.command} registered`, 'success');
            return response.data;
        } catch (error) {
            console.error('[Slack] Command registration failed:', error);
            return null;
        }
    }

    async createChannel(channelData) {
        try {
            const response = await API.post(`${this.apiEndpoint}/channels`, {
                name: channelData.name, isPrivate: channelData.isPrivate || false,
                members: channelData.members || []
            });
            if (!response.success) throw new Error(response.error);
            Toast.show(`Channel #${channelData.name} created`, 'success');
            await this.loadChannels();
            return response.data;
        } catch (error) {
            console.error('[Slack] Channel creation failed:', error);
            return null;
        }
    }

    openSlackComposer() {
        if (!this.config.botToken) {
            Toast.show('Connect Slack workspace first', 'warning');
            return;
        }

        const composerHtml = `
            <div class="slack-composer">
                <form id="slack-message-form">
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Channel *</label>
                            <select name="channel" required>
                                ${Array.from(this.channels.values()).map(ch => `
                                    <option value="${ch.id}">#${ch.name} ${ch.isPrivate ? '🔒' : ''}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group col-6">
                            <label>Message Type</label>
                            <select name="type">
                                ${Object.entries(this.messageTypes).map(([key, t]) => `
                                    <option value="${key}">${t.label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" name="title" placeholder="Notification title">
                    </div>
                    <div class="form-group">
                        <label>Message *</label>
                        <textarea name="message" rows="5" required placeholder="Type your message... Markdown supported"></textarea>
                        <small>Supports Slack markdown: *bold*, _italic_, ~strikethrough~, `code`, ```code block```</small>
                    </div>
                    <div class="form-group">
                        <label>Action Button URL (optional)</label>
                        <input type="url" name="actionUrl" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label>Action Button Label</label>
                        <input type="text" name="actionLabel" placeholder="View Details">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="fab fa-slack"></i> Send to Slack</button>
                    </div>
                </form>
            </div>`;

        const modal = new Modal({ title: 'Send Slack Message', content: composerHtml, size: 'large' });
        modal.open();

        setTimeout(() => {
            const form = document.getElementById('slack-message-form');
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const result = await this.sendNotification({
                    channel: formData.get('channel'),
                    type: formData.get('type'),
                    title: formData.get('title'),
                    message: formData.get('message'),
                    actionUrl: formData.get('actionUrl'),
                    actionLabel: formData.get('actionLabel') || 'View Details'
                });
                if (result) { Modal.close(); Toast.show('Message sent to Slack!', 'success'); }
            });
        }, 100);
    }

    async render(container = null) {
        const target = container || document.getElementById('slack-container');
        if (!target) return;

        const isConnected = !!this.config.botToken;
        const connectionInfo = this.connectionStatus[isConnected ? 'connected' : 'disconnected'];

        const html = `
            <div class="slack-container">
                <div class="slack-header">
                    <h3><i class="fab fa-slack"></i> Slack Integration</h3>
                    <div class="header-actions">
                        ${isConnected ? `
                            <button class="btn btn-primary" onclick="window.Global.Slack.openSlackComposer()"><i class="fas fa-paper-plane"></i> Send Message</button>
                            <button class="btn btn-outline" onclick="window.Global.Slack.disconnectWorkspace()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.Slack.connectWorkspace()"><i class="fab fa-slack"></i> Connect Workspace</button>
                        `}
                    </div>
                </div>

                <div class="connection-status-bar" style="background:${connectionInfo.color}15;color:${connectionInfo.color};border:1px solid ${connectionInfo.color}30;">
                    <i class="fas ${connectionInfo.icon}"></i>
                    <span>${connectionInfo.label}</span>
                    ${this.workspace ? `<span>| Workspace: <strong>${this.escapeHtml(this.workspace.name)}</strong></span>` : ''}
                </div>

                ${isConnected ? `
                    <div class="slack-metrics">
                        <div class="metric-card"><i class="fas fa-hashtag"></i><span>${this.metrics.activeChannels}</span><small>Channels</small></div>
                        <div class="metric-card"><i class="fas fa-users"></i><span>${this.metrics.connectedUsers}</span><small>Users</small></div>
                        <div class="metric-card"><i class="fas fa-paper-plane"></i><span>${this.metrics.messagesSent}</span><small>Sent</small></div>
                        <div class="metric-card"><i class="fas fa-inbox"></i><span>${this.metrics.messagesReceived}</span><small>Received</small></div>
                    </div>

                    <div class="slack-channels">
                        <h4><i class="fas fa-hashtag"></i> Channels</h4>
                        <div class="channels-grid">
                            ${Array.from(this.channels.values()).slice(0, 12).map(ch => `
                                <div class="channel-card" style="border-left:3px solid ${ch.isPrivate ? '#F59E0B' : '#3B82F6'}">
                                    <span>#${this.escapeHtml(ch.name)} ${ch.isPrivate ? '🔒' : ''}</span>
                                    <small>${ch.memberCount} members</small>
                                    ${ch.topic ? `<small class="topic">${this.escapeHtml(ch.topic.substring(0, 50))}</small>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="notification-settings">
                        <h4><i class="fas fa-bell"></i> Auto-Notifications</h4>
                        <div class="notify-events">
                            ${['deal.won', 'payment.completed', 'task.completed', 'lead.created'].map(event => `
                                <label class="notify-checkbox">
                                    <input type="checkbox" ${this.config.notifyOn.includes(event) ? 'checked' : ''} 
                                           onchange="window.Global.Slack.toggleNotifyEvent('${event}', this.checked)">
                                    ${this.formatEventName(event)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="connect-prompt">
                        <i class="fab fa-slack"></i>
                        <h4>Connect your Slack workspace</h4>
                        <p>Send notifications, reports, and updates directly to Slack channels</p>
                        <button class="btn btn-primary" onclick="window.Global.Slack.connectWorkspace()">
                            <i class="fab fa-slack"></i> Connect Slack
                        </button>
                    </div>
                `}
            </div>`;

        target.innerHTML = html;
    }

    toggleNotifyEvent(event, enabled) {
        if (enabled) {
            if (!this.config.notifyOn.includes(event)) this.config.notifyOn.push(event);
        } else {
            this.config.notifyOn = this.config.notifyOn.filter(e => e !== event);
        }
        API.put(`${this.apiEndpoint}/config`, { notifyOn: this.config.notifyOn });
    }

    formatEventName(event) {
        return event.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
        EventBus.off('slack:connect'); EventBus.off('slack:disconnect'); EventBus.off('slack:send-message');
        EventBus.off('slack:send-notification'); EventBus.off('slack:register-command');
        console.log('[Slack] Module destroyed');
    }
}

const slackIntegration = new SlackIntegration();
export { slackIntegration, SlackIntegration };
export default slackIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Slack = slackIntegration; }
