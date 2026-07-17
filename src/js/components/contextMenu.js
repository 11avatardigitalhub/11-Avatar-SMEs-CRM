/**
 * 11 AVATAR DIGITAL HUB - Context Menu Component
 * Enterprise-grade right-click context menu system
 * Dynamic menus, submenus, keyboard shortcuts, positioning engine
 * 
 * @component ContextMenu
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

class ContextMenu {
    constructor(options = {}) {
        this.componentName = 'ContextMenu';
        this.componentId = `ctx-${Date.now().toString(36)}`;
        this.menuElement = null;
        this.submenuElement = null;
        this.isVisible = false;
        this.activeSubmenu = null;
        this.menuItems = [];
        this.targetElement = null;
        this.targetData = null;

        this.config = {
            items: options.items || [],
            trigger: options.trigger || 'right-click',
            position: options.position || 'auto',
            offset: options.offset || { x: 0, y: 0 },
            minWidth: options.minWidth || 180,
            maxWidth: options.maxWidth || 300,
            maxHeight: options.maxHeight || 400,
            zIndex: options.zIndex || 10000,
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 150,
            theme: options.theme || 'light',
            showIcons: options.showIcons !== false,
            showShortcuts: options.showShortcuts !== false,
            showDividers: options.showDividers !== false,
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            onSelect: options.onSelect || null,
            closeOnClick: options.closeOnClick !== false,
            closeOnScroll: options.closeOnScroll !== false,
            closeOnResize: options.closeOnResize !== false,
            closeOnEscape: options.closeOnEscape !== false,
            parent: options.parent || document.body
        };

        this.state = {
            activeSubmenuId: null,
            searchQuery: '',
            filteredItems: []
        };

        this.init();
    }

    init() {
        this.buildMenu();
        this.bindEvents();
        console.log(`[ContextMenu] Initialized: ${this.componentId}`);
    }

    buildMenu() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = this.componentId;
        this.menuElement.className = `ctx-menu ctx-theme-${this.config.theme}`;
        this.menuElement.setAttribute('role', 'menu');
        this.menuElement.setAttribute('aria-orientation', 'vertical');
        this.menuElement.setAttribute('tabindex', '-1');
        this.menuElement.style.cssText = `
            display: none; position: fixed; z-index: ${this.config.zIndex};
            min-width: ${this.config.minWidth}px; max-width: ${this.config.maxWidth}px;
            max-height: ${this.config.maxHeight}px; overflow-y: auto;
            border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            padding: 6px 0; font-size: 13px; font-family: 'Inter', sans-serif;
            background: ${this.config.theme === 'dark' ? '#1E1E1E' : '#FFFFFF'};
            color: ${this.config.theme === 'dark' ? '#E5E5E5' : '#0A0A0A'};
            border: 1px solid ${this.config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
        `;

        this.renderMenuItems();
        this.config.parent.appendChild(this.menuElement);
    }

    renderMenuItems(items = null) {
        const menuItems = items || this.config.items;
        this.menuElement.innerHTML = '';
        this.menuItems = [];

        menuItems.forEach((item, index) => {
            if (item.type === 'divider') {
                if (this.config.showDividers) {
                    const divider = document.createElement('div');
                    divider.className = 'ctx-divider';
                    divider.setAttribute('role', 'separator');
                    divider.style.cssText = `height:1px;margin:4px 8px;background:${this.config.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};`;
                    this.menuElement.appendChild(divider);
                }
                return;
            }

            if (item.type === 'label') {
                const label = document.createElement('div');
                label.className = 'ctx-label';
                label.textContent = item.text || '';
                label.style.cssText = `padding:4px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${this.config.theme === 'dark' ? '#888' : '#999'};font-weight:600;`;
                this.menuElement.appendChild(label);
                return;
            }

            const menuItem = this.createMenuItem(item, index);
            this.menuElement.appendChild(menuItem);
            this.menuItems.push({ element: menuItem, data: item });
        });
    }

    createMenuItem(item, index) {
        const el = document.createElement('div');
        el.className = `ctx-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${item.active ? 'active' : ''}`;
        el.setAttribute('role', 'menuitem');
        el.setAttribute('tabindex', item.disabled ? '-1' : '0');
        el.setAttribute('data-index', index);
        if (item.id) el.setAttribute('data-id', item.id);

        el.style.cssText = `
            padding: 8px 14px; cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
            display: flex; align-items: center; gap: 10px;
            opacity: ${item.disabled ? '0.4' : '1'};
            transition: background 0.12s ease;
            ${item.danger ? `color: #DC2626;` : ''}
        `;

        if (this.config.showIcons && item.icon) {
            const icon = document.createElement('span');
            icon.className = 'ctx-icon';
            icon.innerHTML = `<i class="fas ${item.icon}" style="width:16px;text-align:center;${item.iconColor ? `color:${item.iconColor}` : ''}"></i>`;
            el.appendChild(icon);
        } else if (this.config.showIcons) {
            const spacer = document.createElement('span');
            spacer.style.width = '16px';
            el.appendChild(spacer);
        }

        const text = document.createElement('span');
        text.className = 'ctx-text';
        text.textContent = item.text || item.label || '';
        text.style.flex = '1';
        el.appendChild(text);

        if (item.shortcut && this.config.showShortcuts) {
            const shortcut = document.createElement('span');
            shortcut.className = 'ctx-shortcut';
            shortcut.innerHTML = this.formatShortcut(item.shortcut);
            shortcut.style.cssText = `font-size:11px;color:${this.config.theme === 'dark' ? '#888' : '#999'};margin-left:auto;padding-left:20px;`;
            el.appendChild(shortcut);
        }

        if (item.children && item.children.length > 0) {
            const arrow = document.createElement('span');
            arrow.className = 'ctx-arrow';
            arrow.innerHTML = '<i class="fas fa-chevron-right" style="font-size:10px;"></i>';
            arrow.style.marginLeft = 'auto';
            el.appendChild(arrow);
        }

        if (!item.disabled) {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.children && item.children.length > 0) {
                    this.toggleSubmenu(el, item, e);
                } else {
                    this.executeAction(item);
                }
            });

            el.addEventListener('mouseenter', (e) => {
                this.clearItemHighlight();
                el.style.background = this.config.theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                
                if (item.children && item.children.length > 0) {
                    this.showSubmenu(el, item);
                } else {
                    this.hideSubmenu();
                }
            });

            el.addEventListener('mouseleave', () => {
                el.style.background = '';
            });
        }

        return el;
    }

    showSubmenu(parentEl, item) {
        this.hideSubmenu();
        
        this.submenuElement = document.createElement('div');
        this.submenuElement.className = `ctx-submenu ctx-theme-${this.config.theme}`;
        this.submenuElement.setAttribute('role', 'menu');
        this.submenuElement.style.cssText = `
            position: fixed; z-index: ${this.config.zIndex + 1};
            min-width: ${this.config.minWidth}px; max-width: ${this.config.maxWidth}px;
            max-height: ${this.config.maxHeight}px; overflow-y: auto;
            border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.22);
            padding: 6px 0; font-size: 13px;
            background: ${this.config.theme === 'dark' ? '#1E1E1E' : '#FFFFFF'};
            color: ${this.config.theme === 'dark' ? '#E5E5E5' : '#0A0A0A'};
            border: 1px solid ${this.config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
        `;

        const parentRect = parentEl.getBoundingClientRect();
        let left = parentRect.right + 4;
        let top = parentRect.top;

        if (left + this.config.minWidth > window.innerWidth) {
            left = parentRect.left - this.config.minWidth - 4;
        }
        if (top + 200 > window.innerHeight) {
            top = window.innerHeight - 250;
        }

        this.submenuElement.style.left = left + 'px';
        this.submenuElement.style.top = top + 'px';

        item.children.forEach(child => {
            const childEl = this.createMenuItem(child, -1);
            this.submenuElement.appendChild(childEl);
        });

        document.body.appendChild(this.submenuElement);
        this.state.activeSubmenuId = item.id || 'submenu';

        setTimeout(() => {
            this.submenuElement.style.opacity = '1';
            this.submenuElement.style.transform = 'scale(1)';
        }, 10);
    }

    hideSubmenu() {
        if (this.submenuElement) {
            this.submenuElement.remove();
            this.submenuElement = null;
            this.state.activeSubmenuId = null;
        }
    }

    toggleSubmenu(parentEl, item, e) {
        if (this.state.activeSubmenuId === (item.id || 'submenu')) {
            this.hideSubmenu();
        } else {
            this.showSubmenu(parentEl, item);
        }
    }

    executeAction(item) {
        if (item.disabled) return;
        
        if (item.action && typeof item.action === 'function') {
            item.action(this.targetData, this.targetElement);
        }

        if (item.event) {
            EventBus.emit(item.event, { data: this.targetData, element: this.targetElement, item });
        }

        if (this.config.onSelect) {
            this.config.onSelect(item, this.targetData);
        }

        if (this.config.closeOnClick) {
            this.hide();
        }
    }

    show(x, y, targetElement = null, targetData = null) {
        if (this.isVisible) this.hide();

        this.targetElement = targetElement;
        this.targetData = targetData;

        if (this.config.onOpen) {
            this.config.onOpen(targetData, targetElement);
        }

        this.menuElement.style.display = 'block';

        const menuRect = this.menuElement.getBoundingClientRect();
        let left = x;
        let top = y;

        if (left + menuRect.width > window.innerWidth) {
            left = window.innerWidth - menuRect.width - 8;
        }
        if (top + menuRect.height > window.innerHeight) {
            top = window.innerHeight - menuRect.height - 8;
        }
        if (left < 0) left = 8;
        if (top < 0) top = 8;

        this.menuElement.style.left = left + 'px';
        this.menuElement.style.top = top + 'px';

        if (this.config.animation) {
            this.menuElement.style.opacity = '0';
            this.menuElement.style.transform = 'scale(0.92)';
            this.menuElement.style.transformOrigin = 'top left';
            this.menuElement.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;

            requestAnimationFrame(() => {
                this.menuElement.style.opacity = '1';
                this.menuElement.style.transform = 'scale(1)';
            });
        }

        this.isVisible = true;

        setTimeout(() => {
            const firstItem = this.menuElement.querySelector('.ctx-item:not(.disabled)');
            if (firstItem) firstItem.focus();
        }, 50);
    }

    hide() {
        if (!this.isVisible) return;

        if (this.config.animation) {
            this.menuElement.style.opacity = '0';
            this.menuElement.style.transform = 'scale(0.92)';
            
            setTimeout(() => {
                this.menuElement.style.display = 'none';
                this.menuElement.style.opacity = '1';
                this.menuElement.style.transform = 'scale(1)';
            }, this.config.animationDuration);
        } else {
            this.menuElement.style.display = 'none';
        }

        this.hideSubmenu();
        this.clearItemHighlight();
        this.isVisible = false;

        if (this.config.onClose) {
            this.config.onClose();
        }
    }

    toggle(x, y, targetElement, targetData) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(x, y, targetElement, targetData);
        }
    }

    setItems(items) {
        this.config.items = items;
        this.renderMenuItems();
    }

    addItem(item, index = -1) {
        if (index >= 0) {
            this.config.items.splice(index, 0, item);
        } else {
            this.config.items.push(item);
        }
        this.renderMenuItems();
    }

    removeItem(itemId) {
        this.config.items = this.config.items.filter(item => item.id !== itemId);
        this.renderMenuItems();
    }

    updateItem(itemId, updates) {
        const item = this.config.items.find(i => i.id === itemId);
        if (item) Object.assign(item, updates);
        this.renderMenuItems();
    }

    clearItemHighlight() {
        const items = this.menuElement?.querySelectorAll('.ctx-item');
        items?.forEach(item => { item.style.background = ''; });
    }

    formatShortcut(shortcut) {
        if (!shortcut) return '';
        return shortcut
            .replace(/Ctrl/g, '⌘')
            .replace(/Shift/g, '⇧')
            .replace(/Alt/g, '⌥')
            .replace(/\+/g, '')
            .split(' ')
            .map(k => `<kbd style="padding:1px 5px;border-radius:3px;font-size:10px;background:${this.config.theme==='dark'?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.06)'};">${k}</kbd>`)
            .join('');
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menuElement.contains(e.target) && 
                !this.submenuElement?.contains(e.target)) {
                this.hide();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    if (this.state.activeSubmenuId) {
                        this.hideSubmenu();
                    } else {
                        this.hide();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateItems(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateItems(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.openFocusedSubmenu();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (this.state.activeSubmenuId) {
                        this.hideSubmenu();
                    }
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.clickFocusedItem();
                    break;
            }
        });

        if (this.config.closeOnScroll) {
            window.addEventListener('scroll', () => { if (this.isVisible) this.hide(); }, true);
        }
        if (this.config.closeOnResize) {
            window.addEventListener('resize', () => { if (this.isVisible) this.hide(); });
        }

        if (this.config.trigger === 'right-click') {
            document.addEventListener('contextmenu', (e) => {
                const target = e.target.closest('[data-context-menu]');
                if (target && target.dataset.contextMenu === this.componentId) {
                    e.preventDefault();
                    const data = this.parseTargetData(target);
                    this.show(e.clientX, e.clientY, target, data);
                }
            });
        }
    }

    navigateItems(direction) {
        const items = Array.from(this.menuElement.querySelectorAll('.ctx-item:not(.disabled)'));
        if (items.length === 0) return;

        const currentIndex = items.findIndex(item => item === document.activeElement);
        let nextIndex = currentIndex + direction;

        if (nextIndex >= items.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = items.length - 1;

        items[nextIndex].focus();
        items[nextIndex].style.background = this.config.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    }

    openFocusedSubmenu() {
        const focused = document.activeElement;
        if (!focused || !focused.classList.contains('ctx-item')) return;
        
        const itemData = this.menuItems.find(m => m.element === focused)?.data;
        if (itemData?.children && itemData.children.length > 0) {
            this.showSubmenu(focused, itemData);
        }
    }

    clickFocusedItem() {
        const focused = document.activeElement;
        if (!focused || !focused.classList.contains('ctx-item')) return;
        focused.click();
    }

    parseTargetData(element) {
        try {
            const jsonData = element.dataset.contextData;
            return jsonData ? JSON.parse(jsonData) : null;
        } catch {
            return element.dataset.contextData || null;
        }
    }

    attachTo(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.setAttribute('data-context-menu', this.componentId);
            el.style.cursor = 'context-menu';
        });
    }

    destroy() {
        this.hide();
        this.hideSubmenu();
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
        console.log('[ContextMenu] Component destroyed');
    }

    static create(options) {
        return new ContextMenu(options);
    }
}

export { ContextMenu };
export default ContextMenu;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.ContextMenu = ContextMenu;
}


