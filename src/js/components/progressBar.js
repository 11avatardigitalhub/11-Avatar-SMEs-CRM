/**
 * 11 AVATAR DIGITAL HUB - Progress Bar Component
 * Enterprise-grade progress/loading bar with multiple variants
 * Linear, circular, steps, indeterminate, buffer, multi-segment
 * 
 * @component ProgressBar
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

class ProgressBar {
    constructor(container, options = {}) {
        this.componentName = 'ProgressBar';
        this.componentId = `pb-${Date.now().toString(36)}`;
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('ProgressBar: Container not found');

        this.config = {
            value: options.value || 0,
            min: options.min || 0,
            max: options.max || 100,
            type: options.type || 'linear',
            variant: options.variant || 'default',
            size: options.size || 'md',
            color: options.color || '#3B82F6',
            trackColor: options.trackColor || '#E5E7EB',
            bufferValue: options.bufferValue || 0,
            segments: options.segments || [],
            showLabel: options.showLabel !== false,
            showPercentage: options.showPercentage !== false,
            labelPosition: options.labelPosition || 'right',
            formatLabel: options.formatLabel || null,
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 600,
            indeterminate: options.indeterminate || false,
            striped: options.striped || false,
            stripedAnimation: options.stripedAnimation !== false,
            steps: options.steps || 0,
            stepLabels: options.stepLabels || [],
            thickness: options.thickness || 8,
            theme: options.theme || 'light',
            onChange: options.onChange || null,
            onComplete: options.onComplete || null
        };

        this.state = {
            currentValue: this.config.indeterminate ? 0 : this.config.value,
            isComplete: false,
            isIndeterminate: this.config.indeterminate,
            animationFrame: null
        };

        this.sizeMap = { sm: 4, md: 8, lg: 12, xl: 16 };
        this.circleSizeMap = { sm: 60, md: 100, lg: 140, xl: 180 };

        this.render();
        if (this.config.indeterminate) this.startIndeterminate();
    }

    getPercentage() {
        if (this.config.max === this.config.min) return 0;
        return Math.round(((this.state.currentValue - this.config.min) / (this.config.max - this.config.min)) * 100);
    }

    getClampedPercentage() {
        return Math.max(0, Math.min(100, this.getPercentage()));
    }

    render() {
        const pct = this.getClampedPercentage();
        const size = this.sizeMap[this.config.size] || 8;
        const circleSize = this.circleSizeMap[this.config.size] || 100;

        const html = this.config.type === 'circular' ? this.renderCircular(pct, circleSize) :
                     this.config.type === 'steps' ? this.renderSteps(pct) :
                     this.renderLinear(pct, size);
        
        this.container.innerHTML = html;
        this.elements = {
            wrapper: document.getElementById(this.componentId),
            fill: document.getElementById(`${this.componentId}-fill`),
            label: document.getElementById(`${this.componentId}-label`),
            percentage: document.getElementById(`${this.componentId}-percentage`)
        };
    }

    renderLinear(pct, size) {
        const bufferPct = this.config.bufferValue > 0 ? 
            Math.min(100, (this.config.bufferValue / this.config.max) * 100) : 0;
        const hasSegments = this.config.segments.length > 0;
        const labelHtml = this.getLabelHtml(pct);

        return `
            <div class="pb-wrapper pb-linear pb-theme-${this.config.theme} pb-size-${this.config.size}" id="${this.componentId}" role="progressbar" aria-valuenow="${this.state.currentValue}" aria-valuemin="${this.config.min}" aria-valuemax="${this.config.max}" aria-label="Progress">
                ${this.config.showLabel && this.config.labelPosition === 'top' ? labelHtml : ''}
                <div class="pb-track" style="height:${size}px;background:${this.config.trackColor};border-radius:${size}px;">
                    ${bufferPct > 0 ? `<div class="pb-buffer" style="width:${bufferPct}%;background:${this.config.trackColor};opacity:0.5;height:${size}px;position:absolute;border-radius:${size}px;"></div>` : ''}
                    ${hasSegments ? this.config.segments.map(seg => {
                        const segPct = ((seg.value - this.config.min) / (this.config.max - this.config.min)) * 100;
                        return `<div class="pb-segment" style="left:${seg.start || 0}%;width:${segPct}%;background:${seg.color || this.config.color};height:${size}px;position:absolute;border-radius:${size}px;"></div>`;
                    }).join('') : `
                        <div class="pb-fill ${this.config.striped ? 'pb-striped' : ''} ${this.config.stripedAnimation ? 'pb-striped-animated' : ''} ${this.config.indeterminate ? 'pb-indeterminate' : ''}" 
                             id="${this.componentId}-fill"
                             style="width:${pct}%;background:${this.getFillColor(pct)};height:${size}px;border-radius:${size}px;transition:width ${this.config.animationDuration}ms ease;">
                        </div>
                    `}
                </div>
                ${this.config.showLabel && this.config.labelPosition !== 'top' ? labelHtml : ''}
            </div>`;
    }

    renderCircular(pct, size) {
        const radius = (size - 8) / 2;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (pct / 100) * circumference;
        const labelHtml = this.getLabelHtml(pct);

        return `
            <div class="pb-wrapper pb-circular pb-theme-${this.config.theme}" id="${this.componentId}" role="progressbar" aria-valuenow="${this.state.currentValue}" aria-valuemin="${this.config.min}" aria-valuemax="${this.config.max}" style="width:${size}px;height:${size}px;">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${this.config.trackColor}" stroke-width="6" />
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${this.getFillColor(pct)}" stroke-width="6" 
                            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}"
                            transform="rotate(-90 ${size/2} ${size/2})" 
                            style="transition:stroke-dashoffset ${this.config.animationDuration}ms ease;" id="${this.componentId}-fill" />
                </svg>
                <div class="pb-circular-label">${labelHtml}</div>
            </div>`;
    }

    renderSteps(pct) {
        const totalSteps = this.config.steps || this.config.stepLabels.length || 0;
        if (totalSteps === 0) return this.renderLinear(pct, 8);
        const activeStep = Math.floor((pct / 100) * totalSteps);

        return `
            <div class="pb-wrapper pb-steps pb-theme-${this.config.theme}" id="${this.componentId}">
                <div class="pb-steps-container">
                    ${Array.from({ length: totalSteps }, (_, i) => `
                        <div class="pb-step ${i <= activeStep ? 'active' : ''} ${i === activeStep ? 'current' : ''}" style="flex:1;">
                            <div class="pb-step-indicator" style="background:${i <= activeStep ? this.getFillColor((i/totalSteps)*100) : this.config.trackColor};">
                                ${i < activeStep ? '<i class="fas fa-check"></i>' : `<span>${i + 1}</span>`}
                            </div>
                            ${this.config.stepLabels[i] ? `<span class="pb-step-label">${this.escapeHtml(this.config.stepLabels[i])}</span>` : ''}
                            ${i < totalSteps - 1 ? `<div class="pb-step-connector" style="background:${i < activeStep ? this.getFillColor((i/totalSteps)*100) : this.config.trackColor};"></div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    getLabelHtml(pct) {
        if (!this.config.showLabel && !this.config.showPercentage) return '';
        let labelText = '';
        if (this.config.formatLabel) {
            labelText = this.config.formatLabel(this.state.currentValue, pct);
        } else if (this.config.showLabel && this.config.showPercentage) {
            labelText = `${this.state.currentValue}/${this.config.max} (${pct}%)`;
        } else if (this.config.showPercentage) {
            labelText = `${pct}%`;
        } else {
            labelText = `${this.state.currentValue}/${this.config.max}`;
        }
        return `<div class="pb-label pb-label-${this.config.labelPosition}" id="${this.componentId}-label"><span id="${this.componentId}-percentage">${labelText}</span></div>`;
    }

    getFillColor(pct) {
        if (this.config.color && typeof this.config.color === 'object') {
            if (pct >= 100) return this.config.color.complete || '#10B981';
            if (pct >= 75) return this.config.color.high || '#3B82F6';
            if (pct >= 50) return this.config.color.medium || '#F59E0B';
            if (pct >= 25) return this.config.color.low || '#F97316';
            return this.config.color.start || '#DC2626';
        }
        return this.config.color;
    }

    startIndeterminate() {
        this.state.isIndeterminate = true;
        const animate = () => {
            if (!this.state.isIndeterminate) return;
            this.state.currentValue = (this.state.currentValue + 2) % 100;
            this.updateUI();
            this.state.animationFrame = requestAnimationFrame(() => setTimeout(animate, 50));
        };
        animate();
    }

    stopIndeterminate() {
        this.state.isIndeterminate = false;
        if (this.state.animationFrame) cancelAnimationFrame(this.state.animationFrame);
    }

    setValue(value) {
        if (this.state.isIndeterminate) this.stopIndeterminate();
        this.state.currentValue = Math.max(this.config.min, Math.min(this.config.max, value));
        this.updateUI();
        if (this.state.currentValue >= this.config.max && !this.state.isComplete) {
            this.state.isComplete = true;
            if (this.config.onComplete) this.config.onComplete();
            EventBus.emit('progress:complete', { componentId: this.componentId, value: this.state.currentValue });
        }
        if (this.config.onChange) this.config.onChange(this.state.currentValue, this.getPercentage());
    }

    increment(amount = 1) { this.setValue(this.state.currentValue + amount); }
    decrement(amount = 1) { this.setValue(this.state.currentValue - amount); }
    reset() { this.state.isComplete = false; this.setValue(this.config.min); }
    complete() { this.setValue(this.config.max); }

    updateUI() {
        const pct = this.getClampedPercentage();
        if (this.elements.fill) {
            if (this.config.type === 'circular') {
                const size = this.circleSizeMap[this.config.size] || 100;
                const radius = (size - 8) / 2;
                const circumference = 2 * Math.PI * radius;
                this.elements.fill.style.strokeDashoffset = circumference - (pct / 100) * circumference;
                this.elements.fill.style.stroke = this.getFillColor(pct);
            } else {
                this.elements.fill.style.width = `${pct}%`;
                this.elements.fill.style.background = this.getFillColor(pct);
            }
        }
        if (this.elements.percentage) {
            if (this.config.formatLabel) {
                this.elements.percentage.textContent = this.config.formatLabel(this.state.currentValue, pct);
            } else {
                this.elements.percentage.textContent = `${pct}%`;
            }
        }
    }

    setSegments(segments) { this.config.segments = segments; this.render(); }
    setBuffer(value) { this.config.bufferValue = value; this.render(); }
    getValue() { return this.state.currentValue; }
    isComplete() { return this.state.isComplete; }

    escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML; }

    destroy() {
        this.stopIndeterminate();
        if (this.container) this.container.innerHTML = '';
    }

    static create(container, options) {
        const instance = new ProgressBar(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.ProgressBar) window.Global.ProgressBar = {};
        if (!window.Global.ProgressBar.instances) window.Global.ProgressBar.instances = new Map();
        window.Global.ProgressBar.instances.set(instance.componentId, instance);
        return instance;
    }
}

export { ProgressBar };
export default ProgressBar;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.ProgressBar = window.Global.ProgressBar || {}; window.Global.ProgressBar.instances = window.Global.ProgressBar.instances || new Map(); window.Global.ProgressBar.ProgressBar = ProgressBar; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
