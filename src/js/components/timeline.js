/**
 * 11 AVATAR DIGITAL HUB - Timeline Component
 * Enterprise-grade vertical/horizontal timeline visualization
 * Activity feeds, project timelines, audit trails, event sequences
 * 
 * @component Timeline
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Formatters } from '../utils/formatters.js';

/**
 * Timeline - Universal timeline visualization component
 * Activity logs, history tracking, process flows, event sequences
 */
class Timeline {
    /**
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration options
     */
    constructor(container, options = {}) {
        this.componentName = 'Timeline';
        this.componentId = `tl-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('Timeline: Container not found');

        this.config = {
            events: options.events || [],
            orientation: options.orientation || 'vertical',
            alignment: options.alignment || 'alternating',
            showIcons: options.showIcons !== false,
            showDates: options.showDates !== false,
            showTimes: options.showTimes !== false,
            showDescriptions: options.showDescriptions !== false,
            dateFormat: options.dateFormat || 'DD MMM YYYY',
            timeFormat: options.timeFormat || 'hh:mm A',
            groupBy: options.groupBy || null,
            groupByFormat: options.groupByFormat || 'DD MMM YYYY',
            sortOrder: options.sortOrder || 'desc',
            maxEvents: options.maxEvents || 0,
            animateItems: options.animateItems !== false,
            animationDelay: options.animationDelay || 80,
            enableInfiniteScroll: options.enableInfiniteScroll || false,
            infiniteScrollThreshold: options.infiniteScrollThreshold || 200,
            pageSize: options.pageSize || 20,
            theme: options.theme || 'light',
            size: options.size || 'md',
            itemRenderer: options.itemRenderer || null,
            groupRenderer: options.groupRenderer || null,
            emptyRenderer: options.emptyRenderer || null,
            onClick: options.onClick || null,
            onLoadMore: options.onLoadMore || null,
            onEventRender: options.onEventRender || null
        };

        this.state = {
            events: [...this.config.events],
            groupedEvents: {},
            visibleCount: this.config.maxEvents || this.config.events.length,
            isLoadingMore: false,
            hasMore: this.config.enableInfiniteScroll && 
                    this.config.events.length > this.config.pageSize,
            currentPage: 1,
            hoveredEventId: null,
            selectedEventId: null
        };

        this.elements = {
            wrapper: null,
            timelineList: null,
            loadMoreBtn: null,
            loadingIndicator: null
        };

        this.intersectionObserver = null;
        this.performance = {
            renderTime: 0,
            eventCount: 0
        };

        this.init();
    }

    async init() {
        try {
            const startTime = performance.now();
            console.log(`[Timeline] Initializing: ${this.componentId}`);

            this.processEvents();
            this.render();
            this.bindEvents();
            this.setupIntersectionObserver();

            this.performance.renderTime = performance.now() - startTime;
            console.log(`[Timeline] Initialized in ${this.performance.renderTime.toFixed(2)}ms`);
            
            EventBus.emit('timeline:ready', {
                componentId: this.componentId,
                eventCount: this.state.events.length
            });
        } catch (error) {
            console.error('[Timeline] Init failed:', error);
            this.container.innerHTML = `<div class="tl-error" role="alert">Failed to load timeline: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    processEvents() {
        if (this.config.sortOrder === 'desc') {
            this.state.events.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
        } else {
            this.state.events.sort((a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date));
        }

        if (this.config.groupBy) {
            this.state.groupedEvents = {};
            this.state.events.forEach(event => {
                const groupKey = this.getGroupKey(event);
                if (!this.state.groupedEvents[groupKey]) {
                    this.state.groupedEvents[groupKey] = [];
                }
                this.state.groupedEvents[groupKey].push(event);
            });
        }

        this.performance.eventCount = this.state.events.length;
    }

    getGroupKey(event) {
        const date = new Date(event.timestamp || event.date);
        
        switch (this.config.groupBy) {
            case 'day':
                return date.toISOString().split('T')[0];
            case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                return weekStart.toISOString().split('T')[0];
            case 'month':
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            case 'year':
                return String(date.getFullYear());
            default:
                return date.toISOString().split('T')[0];
        }
    }

    formatGroupLabel(groupKey) {
        const [year, month, day] = groupKey.split('-');
        const date = new Date(parseInt(year), (parseInt(month) || 1) - 1, parseInt(day) || 1);
        return Formatters.date(date, this.config.groupByFormat);
    }

    render() {
        try {
            const renderStart = performance.now();
            const orientationClass = `tl-${this.config.orientation}`;
            const alignmentClass = `tl-${this.config.alignment}`;
            const themeClass = `tl-theme-${this.config.theme}`;
            const sizeClass = `tl-size-${this.config.size}`;
            const animClass = this.config.animateItems ? 'tl-animated' : '';

            const visibleEvents = this.getVisibleEvents();

            const html = `
                <div class="tl-wrapper ${orientationClass} ${alignmentClass} ${themeClass} ${sizeClass} ${animClass}" 
                     id="${this.componentId}" role="list" aria-label="Timeline">
                    
                    <div class="tl-list" id="${this.componentId}-list">
                        ${this.config.groupBy ? this.renderGroupedTimeline(visibleEvents) : this.renderFlatTimeline(visibleEvents)}
                    </div>

                    ${this.state.hasMore ? this.renderLoadMore() : ''}
                    ${this.state.isLoadingMore ? '<div class="tl-loading" id="tl-loading"><i class="fas fa-spinner fa-spin"></i> Loading more...</div>' : ''}
                    
                    ${this.state.events.length === 0 ? this.renderEmptyState() : ''}
                </div>
            `;

            this.container.innerHTML = html;
            this.cacheElements();
            
            console.log(`[Timeline] Rendered in ${(performance.now() - renderStart).toFixed(2)}ms`);
        } catch (error) {
            console.error('[Timeline] Render failed:', error);
        }
    }

    getVisibleEvents() {
        const limit = this.config.maxEvents || this.state.visibleCount;
        return this.state.events.slice(0, limit);
    }

    renderFlatTimeline(events) {
        return events.map((event, index) => this.renderTimelineItem(event, index)).join('');
    }

    renderGroupedTimeline(events) {
        const grouped = {};
        events.forEach(event => {
            const key = this.getGroupKey(event);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(event);
        });

        return Object.entries(grouped).map(([groupKey, groupEvents]) => {
            const groupLabel = this.formatGroupLabel(groupKey);
            
            return `
                <div class="tl-group">
                    ${this.config.groupRenderer ? 
                        this.config.groupRenderer(groupKey, groupLabel, groupEvents) :
                        `<div class="tl-group-label">
                            <span class="tl-group-line"></span>
                            <span class="tl-group-text">${this.escapeHtml(groupLabel)}</span>
                        </div>`
                    }
                    <div class="tl-group-items">
                        ${groupEvents.map((event, index) => this.renderTimelineItem(event, index)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTimelineItem(event, index) {
        if (this.config.itemRenderer) {
            const customHTML = this.config.itemRenderer(event, index);
            if (customHTML) return customHTML;
        }

        if (this.config.onEventRender) {
            this.config.onEventRender(event, index);
        }

        const date = new Date(event.timestamp || event.date || Date.now());
        const formattedDate = this.config.showDates ? Formatters.date(date, this.config.dateFormat) : '';
        const formattedTime = this.config.showTimes ? Formatters.time(date, this.config.timeFormat) : '';
        const isHovered = this.state.hoveredEventId === event.id;
        const isSelected = this.state.selectedEventId === event.id;
        const animationDelay = this.config.animateItems ? index * this.config.animationDelay : 0;

        const typeClasses = [];
        if (event.type) typeClasses.push(`tl-type-${event.type}`);
        if (event.status) typeClasses.push(`tl-status-${event.status}`);
        if (event.priority) typeClasses.push(`tl-priority-${event.priority}`);
        if (isHovered) typeClasses.push('tl-hovered');
        if (isSelected) typeClasses.push('tl-selected');

        return `
            <div class="tl-item ${typeClasses.join(' ')}" 
                 id="${this.componentId}-item-${index}"
                 data-event-id="${event.id || index}"
                 data-index="${index}"
                 role="listitem"
                 style="animation-delay: ${animationDelay}ms;"
                 onclick="window.Global.Timeline.instances.get('${this.componentId}').handleItemClick('${event.id || index}', ${index})"
                 onmouseenter="window.Global.Timeline.instances.get('${this.componentId}').handleItemHover('${event.id || index}', true)"
                 onmouseleave="window.Global.Timeline.instances.get('${this.componentId}').handleItemHover('${event.id || index}', false)">
                
                <div class="tl-item-marker">
                    <div class="tl-item-dot" style="background: ${event.color || event.iconColor || '#3B82F6'};">
                        ${this.config.showIcons && event.icon ? 
                            `<i class="fas ${event.icon}"></i>` : 
                            `<span class="tl-item-dot-inner"></span>`
                        }
                    </div>
                    ${index < this.getVisibleEvents().length - 1 ? '<div class="tl-item-line"></div>' : ''}
                </div>

                <div class="tl-item-content">
                    <div class="tl-item-header">
                        ${formattedDate || formattedTime ? `
                            <span class="tl-item-date">
                                ${this.config.showDates ? `<span class="tl-date">${formattedDate}</span>` : ''}
                                ${this.config.showTimes ? `<span class="tl-time">${formattedTime}</span>` : ''}
                            </span>
                        ` : ''}
                        
                        ${event.badge ? `
                            <span class="tl-item-badge" style="background:${event.badgeColor || '#3B82F6'}15;color:${event.badgeColor || '#3B82F6'}">
                                ${this.escapeHtml(String(event.badge))}
                            </span>
                        ` : ''}
                    </div>

                    <h4 class="tl-item-title">
                        ${event.titleLink ? 
                            `<a href="${event.titleLink}" class="tl-title-link">${this.escapeHtml(event.title || event.label || '')}</a>` :
                            this.escapeHtml(event.title || event.label || '')
                        }
                    </h4>

                    ${this.config.showDescriptions && event.description ? `
                        <p class="tl-item-description">${this.escapeHtml(event.description)}</p>
                    ` : ''}

                    <div class="tl-item-meta">
                        ${event.user ? `
                            <span class="tl-meta-item">
                                ${event.userAvatar ? `<img src="${event.userAvatar}" alt="${this.escapeHtml(event.user)}" class="tl-avatar">` : ''}
                                <span>${this.escapeHtml(event.user)}</span>
                            </span>
                        ` : ''}
                        
                        ${event.tags && event.tags.length > 0 ? `
                            <span class="tl-meta-tags">
                                ${event.tags.slice(0, 3).map(tag => `
                                    <span class="tl-tag">${this.escapeHtml(tag)}</span>
                                `).join('')}
                            </span>
                        ` : ''}

                        ${event.actions && event.actions.length > 0 ? `
                            <span class="tl-item-actions" onclick="event.stopPropagation();">
                                ${event.actions.map(action => `
                                    <button class="tl-action-btn" 
                                            onclick="window.Global.Timeline.instances.get('${this.componentId}').handleAction('${event.id}', '${action.id}')"
                                            title="${this.escapeHtml(action.label || '')}">
                                        ${action.icon ? `<i class="fas ${action.icon}"></i>` : ''}
                                        ${action.label ? this.escapeHtml(action.label) : ''}
                                    </button>
                                `).join('')}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderLoadMore() {
        return `
            <div class="tl-load-more-container">
                <button class="tl-load-more-btn" id="${this.componentId}-load-more" type="button">
                    <i class="fas fa-chevron-down"></i> Load More Events
                </button>
            </div>
        `;
    }

    renderEmptyState() {
        const defaultEmpty = `
            <div class="tl-empty">
                <div class="tl-empty-icon"><i class="fas fa-history"></i></div>
                <h4>No Events Yet</h4>
                <p>Events will appear here as they occur</p>
            </div>
        `;

        if (this.config.emptyRenderer) {
            return this.config.emptyRenderer() || defaultEmpty;
        }
        return defaultEmpty;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.timelineList = document.getElementById(`${this.componentId}-list`);
        this.elements.loadMoreBtn = document.getElementById(`${this.componentId}-load-more`);
        this.elements.loadingIndicator = document.getElementById('tl-loading');
    }

    bindEvents() {
        try {
            if (this.elements.loadMoreBtn) {
                this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
            }

            if (this.elements.wrapper) {
                this.elements.wrapper.addEventListener('keydown', (e) => {
                    const item = document.activeElement?.closest('.tl-item');
                    if (!item) return;

                    const items = Array.from(this.elements.timelineList?.querySelectorAll('.tl-item') || []);
                    const currentIndex = items.indexOf(item);

                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            if (currentIndex < items.length - 1) items[currentIndex + 1].focus();
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            if (currentIndex > 0) items[currentIndex - 1].focus();
                            break;
                        case 'Enter':
                        case ' ':
                            e.preventDefault();
                            item.click();
                            break;
                    }
                });
            }

            console.log('[Timeline] Events bound');
        } catch (error) {
            console.error('[Timeline] Event binding failed:', error);
        }
    }

    setupIntersectionObserver() {
        if (!this.config.enableInfiniteScroll) return;
        if (typeof IntersectionObserver === 'undefined') return;

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.state.hasMore && !this.state.isLoadingMore) {
                    this.loadMore();
                }
            });
        }, {
            root: this.elements.timelineList,
            threshold: 0.1
        });

        const sentinel = document.createElement('div');
        sentinel.className = 'tl-scroll-sentinel';
        sentinel.style.height = '1px';
        this.elements.timelineList?.appendChild(sentinel);
        this.intersectionObserver.observe(sentinel);
    }

    async loadMore() {
        if (this.state.isLoadingMore) return;

        try {
            this.state.isLoadingMore = true;
            this.render();

            if (this.config.onLoadMore) {
                const newEvents = await this.config.onLoadMore({
                    currentPage: this.state.currentPage,
                    pageSize: this.config.pageSize,
                    loadedCount: this.state.visibleCount
                });

                if (newEvents && newEvents.length > 0) {
                    this.state.events.push(...newEvents);
                    this.state.visibleCount += newEvents.length;
                    this.state.currentPage++;
                    this.state.hasMore = newEvents.length >= this.config.pageSize;
                } else {
                    this.state.hasMore = false;
                }

                this.processEvents();
            } else {
                this.state.visibleCount += this.config.pageSize;
                this.state.hasMore = this.state.visibleCount < this.state.events.length;
                this.state.currentPage++;
            }
        } catch (error) {
            console.error('[Timeline] Load more failed:', error);
        } finally {
            this.state.isLoadingMore = false;
            this.render();
            this.bindEvents();
        }
    }

    handleItemClick(eventId, index) {
        this.state.selectedEventId = this.state.selectedEventId === eventId ? null : eventId;
        this.render();
        this.bindEvents();

        const event = this.state.events.find(e => (e.id || '') === eventId) || this.state.events[index];
        
        if (this.config.onClick && event) {
            this.config.onClick(event, index);
        }

        EventBus.emit('timeline:item-clicked', {
            componentId: this.componentId,
            eventId,
            index,
            event
        });
    }

    handleItemHover(eventId, isHovered) {
        this.state.hoveredEventId = isHovered ? eventId : null;
        const item = document.getElementById(`${this.componentId}-item-${eventId}`);
        if (item) {
            item.classList.toggle('tl-hovered', isHovered);
        }
    }

    handleAction(eventId, actionId) {
        const event = this.state.events.find(e => (e.id || '') === eventId);
        const action = event?.actions?.find(a => a.id === actionId);
        
        if (action && action.callback) {
            action.callback(event);
        }

        EventBus.emit('timeline:action-clicked', {
            componentId: this.componentId,
            eventId,
            actionId,
            event
        });
    }

    addEvent(event, prepend = true) {
        const newEvent = {
            id: event.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: event.timestamp || new Date().toISOString(),
            ...event
        };

        if (prepend) {
            this.state.events.unshift(newEvent);
        } else {
            this.state.events.push(newEvent);
        }

        this.processEvents();
        this.render();
        this.bindEvents();
    }

    updateEvent(eventId, updates) {
        const index = this.state.events.findIndex(e => (e.id || '') === eventId);
        if (index >= 0) {
            this.state.events[index] = { ...this.state.events[index], ...updates };
            this.render();
            this.bindEvents();
        }
    }

    removeEvent(eventId) {
        this.state.events = this.state.events.filter(e => (e.id || '') !== eventId);
        this.processEvents();
        this.render();
        this.bindEvents();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        if (this.container) this.container.innerHTML = '';
        console.log('[Timeline] Component destroyed');
    }

    static create(container, options) {
        const instance = new Timeline(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.Timeline) window.Global.Timeline = {};
        if (!window.Global.Timeline.instances) window.Global.Timeline.instances = new Map();
        window.Global.Timeline.instances.set(instance.componentId, instance);
        return instance;
    }

    static getInstance(componentId) {
        return window.Global?.Timeline?.instances?.get(componentId) || null;
    }
}

export { Timeline };
export default Timeline;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Timeline = window.Global.Timeline || {};
    window.Global.Timeline.instances = window.Global.Timeline.instances || new Map();
    window.Global.Timeline.Timeline = Timeline;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
