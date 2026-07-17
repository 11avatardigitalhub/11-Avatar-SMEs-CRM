/**
 * 11 AVATAR DIGITAL HUB - Avatar Stack Component
 * Enterprise-grade avatar grouping with overflow, tooltips, online indicators
 * 
 * @component AvatarStack
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

class AvatarStack {
    constructor(container, options = {}) {
        this.componentName = 'AvatarStack';
        this.componentId = `avs-${Date.now().toString(36)}`;
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('AvatarStack: Container not found');

        this.config = {
            users: options.users || [],
            maxVisible: options.maxVisible || 5,
            size: options.size || 'md',
            shape: options.shape || 'circle',
            showTooltip: options.showTooltip !== false,
            showOnlineIndicator: options.showOnlineIndicator !== false,
            showOverflowCount: options.showOverflowCount !== false,
            overlapAmount: options.overlapAmount || 12,
            borderColor: options.borderColor || '#FFFFFF',
            borderWidth: options.borderWidth || 2,
            theme: options.theme || 'light',
            onClick: options.onClick || null,
            onOverflowClick: options.onOverflowClick || null
        };

        this.state = { hoveredIndex: -1, tooltipVisible: false };

        this.sizeMap = { xs: 24, sm: 32, md: 40, lg: 48, xl: 56, xxl: 64 };
        this.pixelSize = this.sizeMap[this.config.size] || 40;

        this.render();
        this.bindEvents();
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }

    getColorFromName(name) {
        const colors = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#D4AF37','#DC2626'];
        let hash = 0;
        for (let i = 0; i < (name || '?').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }

    renderAvatar(user, index) {
        const size = this.pixelSize;
        const overlap = index > 0 ? `margin-left: -${this.config.overlapAmount}px;` : '';
        const zIndex = this.config.users.length - index;
        const bgColor = user.color || this.getColorFromName(user.name || user.email || '');
        const isHovered = this.state.hoveredIndex === index;

        return `
            <div class="avs-avatar-wrapper" 
                 style="z-index:${zIndex};${overlap}transition:transform 0.2s ease;${isHovered ? 'transform:translateY(-4px);' : ''}"
                 onmouseenter="window.Global.AvatarStack.instances.get('${this.componentId}').showTooltip(event, ${index})"
                 onmouseleave="window.Global.AvatarStack.instances.get('${this.componentId}').hideTooltip()"
                 onclick="window.Global.AvatarStack.instances.get('${this.componentId}').handleClick(${index})">
                
                ${user.image || user.avatar || user.photoURL ? `
                    <img src="${user.image || user.avatar || user.photoURL}" 
                         alt="${this.escapeHtml(user.name || user.email || 'User')}"
                         class="avs-avatar avs-${this.config.shape}"
                         style="width:${size}px;height:${size}px;border:${this.config.borderWidth}px solid ${this.config.borderColor};"
                         loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div class="avs-avatar avs-fallback avs-${this.config.shape}" 
                         style="width:${size}px;height:${size}px;background:${bgColor};display:none;border:${this.config.borderWidth}px solid ${this.config.borderColor};">
                        <span style="font-size:${size * 0.38}px;">${this.getInitials(user.name || user.email || '')}</span>
                    </div>
                ` : `
                    <div class="avs-avatar avs-${this.config.shape}" 
                         style="width:${size}px;height:${size}px;background:${bgColor};border:${this.config.borderWidth}px solid ${this.config.borderColor};">
                        <span style="font-size:${size * 0.38}px;">${this.getInitials(user.name || user.email || '')}</span>
                    </div>
                `}
                
                ${this.config.showOnlineIndicator && user.online !== undefined ? `
                    <span class="avs-indicator ${user.online ? 'online' : 'offline'}" 
                          style="width:${size * 0.3}px;height:${size * 0.3}px;border:${this.config.borderWidth}px solid ${this.config.borderColor};"
                          title="${user.online ? 'Online' : 'Offline'}"></span>
                ` : ''}
            </div>`;
    }

    renderTooltip(user) {
        return `
            <div class="avs-tooltip">
                <strong>${this.escapeHtml(user.name || 'Unknown')}</strong>
                ${user.email ? `<span>${this.escapeHtml(user.email)}</span>` : ''}
                ${user.role ? `<span class="avs-tooltip-role">${this.escapeHtml(user.role)}</span>` : ''}
                ${user.online !== undefined ? `<span class="avs-tooltip-status ${user.online ? 'online' : 'offline'}">${user.online ? '● Online' : '○ Offline'}</span>` : ''}
            </div>`;
    }

    render() {
        const visibleUsers = this.config.users.slice(0, this.config.maxVisible);
        const overflowCount = this.config.users.length - this.config.maxVisible;
        const size = this.pixelSize;

        const html = `
            <div class="avs-container" id="${this.componentId}" role="group" aria-label="User avatars">
                <div class="avs-stack">
                    ${visibleUsers.map((user, i) => this.renderAvatar(user, i)).join('')}
                    
                    ${overflowCount > 0 && this.config.showOverflowCount ? `
                        <div class="avs-avatar-wrapper" style="z-index:0;margin-left:-${this.config.overlapAmount}px;"
                             onclick="window.Global.AvatarStack.instances.get('${this.componentId}').handleOverflowClick()">
                            <div class="avs-avatar avs-overflow avs-${this.config.shape}" 
                                 style="width:${size}px;height:${size}px;background:#6B7280;border:${this.config.borderWidth}px solid ${this.config.borderColor};cursor:pointer;">
                                <span style="font-size:${size * 0.32}px;">+${overflowCount > 99 ? '99' : overflowCount}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>`;

        this.container.innerHTML = html;
        this.elements = { container: document.getElementById(this.componentId) };
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) this.hideTooltip();
        });
    }

    showTooltip(event, index) {
        this.state.hoveredIndex = index;
        const user = this.config.users[index];
        if (!user || !this.config.showTooltip) return;

        let tooltip = document.getElementById(`${this.componentId}-tooltip`);
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = `${this.componentId}-tooltip`;
            tooltip.className = 'avs-tooltip-container';
            document.body.appendChild(tooltip);
        }
        tooltip.innerHTML = this.renderTooltip(user);
        tooltip.style.display = 'block';
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        tooltip.style.transform = 'translateX(-50%)';
        this.state.tooltipVisible = true;
    }

    hideTooltip() {
        this.state.hoveredIndex = -1;
        this.state.tooltipVisible = false;
        const tooltip = document.getElementById(`${this.componentId}-tooltip`);
        if (tooltip) tooltip.style.display = 'none';
    }

    handleClick(index) {
        const user = this.config.users[index];
        if (user && this.config.onClick) this.config.onClick(user, index);
        EventBus.emit('avatarstack:clicked', { componentId: this.componentId, user, index });
    }

    handleOverflowClick() {
        const hiddenUsers = this.config.users.slice(this.config.maxVisible);
        if (this.config.onOverflowClick) this.config.onOverflowClick(hiddenUsers);
        EventBus.emit('avatarstack:overflow-clicked', { componentId: this.componentId, users: hiddenUsers });
    }

    addUser(user, position = -1) {
        const idx = position >= 0 ? position : this.config.users.length;
        this.config.users.splice(idx, 0, user);
        this.render();
        this.bindEvents();
    }

    removeUser(userId) {
        this.config.users = this.config.users.filter(u => (u.id || u.email) !== userId);
        this.render();
        this.bindEvents();
    }

    updateUser(userId, updates) {
        const user = this.config.users.find(u => (u.id || u.email) === userId);
        if (user) { Object.assign(user, updates); this.render(); this.bindEvents(); }
    }

    setUsers(users) { this.config.users = [...users]; this.render(); this.bindEvents(); }
    getUsers() { return [...this.config.users]; }
    getVisibleCount() { return Math.min(this.config.users.length, this.config.maxVisible); }
    getOverflowCount() { return Math.max(0, this.config.users.length - this.config.maxVisible); }

    escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML; }

    destroy() {
        this.hideTooltip();
        const tooltip = document.getElementById(`${this.componentId}-tooltip`);
        if (tooltip) tooltip.remove();
        if (this.container) this.container.innerHTML = '';
    }

    static create(container, options) {
        const instance = new AvatarStack(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.AvatarStack) window.Global.AvatarStack = {};
        if (!window.Global.AvatarStack.instances) window.Global.AvatarStack.instances = new Map();
        window.Global.AvatarStack.instances.set(instance.componentId, instance);
        return instance;
    }
}

export { AvatarStack };
export default AvatarStack;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.AvatarStack = window.Global.AvatarStack || {}; window.Global.AvatarStack.instances = window.Global.AvatarStack.instances || new Map(); window.Global.AvatarStack.AvatarStack = AvatarStack; }


