/**
 * 11 AVATAR DIGITAL HUB - Skeleton Loader Component
 * Enterprise-grade content placeholder/loading skeleton system
 * Text, card, avatar, table, list, dashboard skeletons with shimmer animation
 * 
 * @component Skeleton
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

class Skeleton {
    constructor(container, options = {}) {
        this.componentName = 'Skeleton';
        this.componentId = `sk-${Date.now().toString(36)}`;
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('Skeleton: Container not found');

        this.config = {
            type: options.type || 'card',
            count: options.count || 1,
            width: options.width || '100%',
            height: options.height || 'auto',
            animation: options.animation !== false,
            animationType: options.animationType || 'shimmer',
            speed: options.speed || 'normal',
            theme: options.theme || 'light',
            borderRadius: options.borderRadius || 8,
            gap: options.gap || 16,
            lines: options.lines || 3,
            showAvatar: options.showAvatar || false,
            avatarSize: options.avatarSize || 40,
            avatarShape: options.avatarShape || 'circle',
            showImage: options.showImage || false,
            imageHeight: options.imageHeight || 200,
            columns: options.columns || 1,
            rows: options.rows || 3,
            headerRows: options.headerRows || 1,
            dense: options.dense || false
        };

        this.speedMap = { slow: '2s', normal: '1.5s', fast: '1s' };
        this.render();
    }

    render() {
        const speed = this.speedMap[this.config.speed] || '1.5s';
        const themeClass = `sk-theme-${this.config.theme}`;
        const animClass = this.config.animation ? `sk-animated sk-${this.config.animationType}` : '';
        const html = `
            <div class="sk-wrapper ${themeClass} ${animClass}" id="${this.componentId}" style="gap:${this.config.gap}px;" aria-busy="true" aria-label="Loading content">
                <style>
                    .sk-animated.sk-shimmer .sk-block{background:linear-gradient(90deg,${this.config.theme==='dark'?'#1e1e1e':'#f0f0f0'} 25%,${this.config.theme==='dark'?'#2a2a2a':'#e0e0e0'} 50%,${this.config.theme==='dark'?'#1e1e1e':'#f0f0f0'} 75%);background-size:200% 100%;animation:sk-shimmer ${speed} infinite;}
                    .sk-animated.sk-pulse .sk-block{animation:sk-pulse ${speed} infinite;}
                    @keyframes sk-shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
                    @keyframes sk-pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
                    .sk-block{border-radius:${this.config.borderRadius}px;overflow:hidden;}
                </style>
                ${this.renderByType()}
            </div>`;
        this.container.innerHTML = html;
    }

    renderByType() {
        switch (this.config.type) {
            case 'text': return this.renderText();
            case 'card': return this.renderCard();
            case 'avatar': return this.renderAvatar();
            case 'table': return this.renderTable();
            case 'list': return this.renderList();
            case 'dashboard': return this.renderDashboard();
            case 'detail': return this.renderDetail();
            default: return this.renderCard();
        }
    }

    renderText() {
        let html = '';
        for (let i = 0; i < this.config.count; i++) {
            html += `<div class="sk-text-block" style="margin-bottom:${this.config.gap}px;">`;
            for (let l = 0; l < this.config.lines; l++) {
                const isLast = l === this.config.lines - 1;
                const lineWidth = isLast ? '60%' : (90 - l * 5) + '%';
                html += `<div class="sk-block sk-line" style="width:${lineWidth};height:${this.config.dense ? '10px' : '14px'};margin-bottom:8px;"></div>`;
            }
            html += `</div>`;
        }
        return html;
    }

    renderCard() {
        let html = '';
        for (let c = 0; c < this.config.count; c++) {
            html += `<div class="sk-card" style="margin-bottom:${this.config.gap}px;">`;
            if (this.config.showImage) {
                html += `<div class="sk-block sk-image" style="width:100%;height:${this.config.imageHeight}px;margin-bottom:12px;"></div>`;
            }
            if (this.config.showAvatar) {
                html += `<div class="sk-block sk-avatar sk-${this.config.avatarShape}" style="width:${this.config.avatarSize}px;height:${this.config.avatarSize}px;margin-bottom:12px;"></div>`;
            }
            for (let l = 0; l < this.config.lines; l++) {
                const isLast = l === this.config.lines - 1;
                html += `<div class="sk-block sk-line" style="width:${isLast ? '55%' : '90%'};height:12px;margin-bottom:8px;"></div>`;
            }
            html += `</div>`;
        }
        return html;
    }

    renderAvatar() {
        let html = '';
        for (let i = 0; i < this.config.count; i++) {
            html += `<div class="sk-avatar-row" style="display:flex;align-items:center;gap:12px;margin-bottom:${this.config.gap}px;">`;
            html += `<div class="sk-block sk-${this.config.avatarShape}" style="width:${this.config.avatarSize}px;height:${this.config.avatarSize}px;flex-shrink:0;"></div>`;
            html += `<div style="flex:1;">`;
            html += `<div class="sk-block sk-line" style="width:60%;height:12px;margin-bottom:6px;"></div>`;
            html += `<div class="sk-block sk-line" style="width:40%;height:10px;"></div>`;
            html += `</div></div>`;
        }
        return html;
    }

    renderTable() {
        let html = '<div class="sk-table" style="width:100%;">';
        for (let r = 0; r < this.config.rows + this.config.headerRows; r++) {
            html += '<div class="sk-table-row" style="display:flex;gap:16px;margin-bottom:12px;">';
            for (let c = 0; c < this.config.columns; c++) {
                const isHeader = r < this.config.headerRows;
                html += `<div class="sk-block sk-cell" style="flex:1;height:${isHeader ? '16px' : '12px'};"></div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    renderList() {
        let html = '';
        for (let i = 0; i < this.config.count; i++) {
            html += `<div class="sk-list-item" style="display:flex;align-items:center;gap:12px;margin-bottom:${this.config.gap}px;padding-bottom:${this.config.gap}px;border-bottom:1px solid ${this.config.theme==='dark'?'#2a2a2a':'#f0f0f0'};">`;
            html += `<div class="sk-block" style="width:${this.config.avatarSize}px;height:${this.config.avatarSize}px;border-radius:${this.config.avatarShape==='circle'?'50%':'8px'};flex-shrink:0;"></div>`;
            html += `<div style="flex:1;"><div class="sk-block sk-line" style="width:70%;height:12px;margin-bottom:6px;"></div><div class="sk-block sk-line" style="width:50%;height:10px;"></div></div>`;
            html += `<div class="sk-block" style="width:60px;height:12px;"></div>`;
            html += `</div>`;
        }
        return html;
    }

    renderDashboard() {
        let html = '<div class="sk-dashboard" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">';
        const cardCount = this.config.count || 4;
        for (let i = 0; i < cardCount; i++) {
            html += `<div class="sk-block" style="height:100px;padding:16px;">`;
            html += `<div class="sk-block sk-line" style="width:50%;height:10px;margin-bottom:12px;background:rgba(255,255,255,0.1);"></div>`;
            html += `<div class="sk-block sk-line" style="width:70%;height:24px;margin-bottom:8px;background:rgba(255,255,255,0.1);"></div>`;
            html += `<div class="sk-block sk-line" style="width:40%;height:10px;background:rgba(255,255,255,0.1);"></div>`;
            html += `</div>`;
        }
        html += '</div>';
        html += '<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:16px;">';
        html += `<div class="sk-block" style="height:300px;"></div>`;
        html += `<div class="sk-block" style="height:300px;"></div>`;
        html += '</div>';
        return html;
    }

    renderDetail() {
        let html = '<div class="sk-detail" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
        html += `<div class="sk-block" style="height:250px;grid-column:1/-1;"></div>`;
        for (let i = 0; i < 6; i++) {
            html += `<div><div class="sk-block sk-line" style="width:30%;height:10px;margin-bottom:6px;"></div><div class="sk-block sk-line" style="width:80%;height:14px;"></div></div>`;
        }
        html += '</div>';
        return html;
    }

    destroy() { if (this.container) this.container.innerHTML = ''; }

    static create(container, options) {
        return new Skeleton(container, options);
    }
}

export { Skeleton };
export default Skeleton;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Skeleton = Skeleton; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
