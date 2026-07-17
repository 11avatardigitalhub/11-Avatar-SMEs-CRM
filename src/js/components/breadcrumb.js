/**
 * 11 AVATAR DIGITAL HUB - Breadcrumb Component
 * Enterprise-grade breadcrumb navigation system
 * Dynamic paths, dropdown folders, history tracking, responsive collapse
 * 
 * @component Breadcrumb
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';

/**
 * Breadcrumb - Universal breadcrumb navigation component
 * Auto-collapse, history, dropdown, responsive
 */
class Breadcrumb {
    constructor(container, options = {}) {
        this.componentName = 'Breadcrumb';
        this.componentId = `bc-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('Breadcrumb: Container not found');

        this.config = {
            items: options.items || [],
            separator: options.separator || 'chevron',
            maxVisible: options.maxVisible || 4,
            collapseFrom: options.collapseFrom || 'start',
            homeIcon: options.homeIcon || 'fa-home',
            homeLabel: options.homeLabel || 'Home',
            homeUrl: options.homeUrl || '/',
            showHome: options.showHome !== false,
            showIcons: options.showIcons !== false,
            enableDropdown: options.enableDropdown !== false,
            enableHistory: options.enableHistory || false,
            maxHistory: options.maxHistory || 10,
            linkClass: options.linkClass || '',
            activeClass: options.activeClass || 'active',
            theme: options.theme || 'light',
            size: options.size || 'md',
            onClick: options.onClick || null,
            onHistoryChange: options.onHistoryChange || null
        };

        this.state = {
            items: [...this.config.items],
            collapsed: false,
            expanded: false,
            history: []
        };

        this.loadHistory();
        this.render();
        this.bindEvents();
        console.log(`[Breadcrumb] Initialized: ${this.componentId}`);
    }

    loadHistory() {
        try {
            const stored = sessionStorage.getItem(`breadcrumb_history_${this.componentId}`);
            if (stored) {
                this.state.history = JSON.parse(stored).slice(0, this.config.maxHistory);
            }
        } catch (e) { this.state.history = []; }
    }

    saveHistory() {
        try {
            sessionStorage.setItem(
                `breadcrumb_history_${this.componentId}`,
                JSON.stringify(this.state.history.slice(0, this.config.maxHistory))
            );
        } catch (e) {}
    }

    render() {
        const items = this.getVisibleItems();
        const separatorHTML = this.getSeparatorHTML();
        const sizeClass = `bc-size-${this.config.size}`;
        const themeClass = `bc-theme-${this.config.theme}`;

        let html = `<nav class="bc-nav ${sizeClass} ${themeClass}" id="${this.componentId}" aria-label="Breadcrumb" role="navigation">`;
        html += '<ol class="bc-list" itemscope itemtype="https://schema.org/BreadcrumbList">';

        // Home item
        if (this.config.showHome) {
            html += this.renderHomeItem(0, separatorHTML);
        }

        // Collapsed indicator
        if (this.state.collapsed && items.length > 0) {
            html += this.renderCollapseTrigger(separatorHTML);
        }

        // Visible items
        items.forEach((item, index) => {
            const isLast = index === items.length - 1 && !this.state.collapsed;
            const position = this.config.showHome ? index + (this.state.collapsed ? 2 : 1) : index;
            html += this.renderItem(item, position, isLast, separatorHTML);
        });

        html += '</ol></nav>';
        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderHomeItem(position, separator) {
        return `
            <li class="bc-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                <a href="${this.config.homeUrl}" class="bc-link bc-home ${this.config.linkClass}" itemprop="item" 
                   onclick="return window.Global.Breadcrumb.getInstance('${this.componentId}').handleClick(event, '${this.config.homeUrl}', '${this.config.homeLabel}')">
                    ${this.config.showIcons ? `<i class="fas ${this.config.homeIcon} bc-icon"></i>` : ''}
                    <span itemprop="name">${this.escapeHtml(this.config.homeLabel)}</span>
                </a>
                <meta itemprop="position" content="${position + 1}">
                ${separator}
            </li>`;
    }

    renderCollapseTrigger(separator) {
        return `
            <li class="bc-item bc-collapsed">
                <button class="bc-collapse-btn" onclick="window.Global.Breadcrumb.getInstance('${this.componentId}').toggleCollapse()" 
                        aria-label="Show more breadcrumbs" title="Show more">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                ${separator}
            </li>`;
    }

    renderItem(item, position, isLast, separator) {
        if (isLast) {
            return `
                <li class="bc-item bc-current ${this.config.activeClass}" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"
                    aria-current="page">
                    <span class="bc-link bc-current-link" itemprop="name">
                        ${this.config.showIcons && item.icon ? `<i class="fas ${item.icon} bc-icon"></i>` : ''}
                        ${this.escapeHtml(item.label || item.text || '')}
                    </span>
                    <meta itemprop="position" content="${position + 1}">
                </li>`;
        }

        return `
            <li class="bc-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                <a href="${item.url || '#'}" class="bc-link ${this.config.linkClass}" itemprop="item"
                   onclick="return window.Global.Breadcrumb.getInstance('${this.componentId}').handleClick(event, '${item.url}', '${item.label}')">
                    ${this.config.showIcons && item.icon ? `<i class="fas ${item.icon} bc-icon"></i>` : ''}
                    <span itemprop="name">${this.escapeHtml(item.label || item.text || '')}</span>
                </a>
                <meta itemprop="position" content="${position + 1}">
                ${isLast ? '' : separator}
            </li>`;
    }

    getVisibleItems() {
        let items = this.state.items;
        const maxVis = this.config.maxVisible;

        if (items.length <= maxVis) {
            this.state.collapsed = false;
            return items;
        }

        this.state.collapsed = true;

        if (this.config.collapseFrom === 'start') {
            return items.slice(-(maxVis - 1));
        } else if (this.config.collapseFrom === 'end') {
            return items.slice(0, maxVis - 1);
        } else {
            const half = Math.floor((maxVis - 1) / 2);
            const first = items.slice(0, half);
            const last = items.slice(-half);
            return [...first, ...last];
        }
    }

    getSeparatorHTML() {
        switch (this.config.separator) {
            case 'slash': return '<span class="bc-separator" aria-hidden="true">/</span>';
            case 'arrow': return '<span class="bc-separator" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>';
            case 'dot': return '<span class="bc-separator" aria-hidden="true">•</span>';
            case 'chevron':
            default: return '<span class="bc-separator" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>';
        }
    }

    handleClick(event, url, label) {
        event.preventDefault();
        
        if (this.config.enableHistory) {
            this.state.history.push({ url, label, timestamp: Date.now() });
            if (this.state.history.length > this.config.maxHistory) {
                this.state.history.shift();
            }
            this.saveHistory();
            if (this.config.onHistoryChange) {
                this.config.onHistoryChange(this.state.history);
            }
        }

        if (this.config.onClick) {
            this.config.onClick({ url, label, event });
        }

        if (url && url !== '#') {
            EventBus.emit('breadcrumb:navigate', { url, label });
        }

        return false;
    }

    toggleCollapse() {
        this.state.expanded = !this.state.expanded;
        
        if (this.state.expanded) {
            this.state.collapsed = false;
        }
        
        this.render();
        this.bindEvents();
    }

    setItems(items) {
        this.state.items = [...items];
        this.state.collapsed = false;
        this.state.expanded = false;
        this.render();
        this.bindEvents();
    }

    addItem(item, index = -1) {
        if (index >= 0) {
            this.state.items.splice(index, 0, item);
        } else {
            this.state.items.push(item);
        }
        this.render();
        this.bindEvents();
    }

    removeItem(index) {
        this.state.items.splice(index, 1);
        this.render();
        this.bindEvents();
    }

    updateItem(index, updates) {
        if (this.state.items[index]) {
            Object.assign(this.state.items[index], updates);
            this.render();
            this.bindEvents();
        }
    }

    getHistory() {
        return [...this.state.history];
    }

    clearHistory() {
        this.state.history = [];
        this.saveHistory();
    }

    cacheElements() {}

    bindEvents() {
        const collapseBtn = this.container.querySelector('.bc-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => this.toggleCollapse());
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.clearHistory();
        if (this.container) this.container.innerHTML = '';
        console.log('[Breadcrumb] Component destroyed');
    }

    static getInstance(componentId) {
        return window.Global?.Breadcrumb?.instances?.get(componentId);
    }
}

export { Breadcrumb };
export default Breadcrumb;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Breadcrumb = window.Global.Breadcrumb || {};
    window.Global.Breadcrumb.instances = window.Global.Breadcrumb.instances || new Map();
    window.Global.Breadcrumb.Breadcrumb = Breadcrumb;
}

