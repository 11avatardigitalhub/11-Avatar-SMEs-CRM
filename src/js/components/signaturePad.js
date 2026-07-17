/**
 * 11 AVATAR DIGITAL HUB - Signature Pad Component
 * Enterprise-grade digital signature capture system
 * Canvas-based drawing, pressure sensitivity, export, validation, encryption
 * 
 * @component SignaturePad
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Validators } from '../utils/validators.js';

/**
 * SignaturePad - Complete digital signature capture component
 * HTML5 Canvas based with pressure, velocity, multi-format export
 */
class SignaturePad {
    /**
     * Initialize signature pad with full enterprise configuration
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration options
     */
    constructor(container, options = {}) {
        this.componentName = 'SignaturePad';
        this.componentId = `sig-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('SignaturePad: Container element not found in DOM');
        }

        this.config = {
            // Canvas dimensions
            width: options.width || 600,
            height: options.height || 200,
            responsive: options.responsive !== false,
            maxWidth: options.maxWidth || 800,
            minWidth: options.minWidth || 280,
            aspectRatio: options.aspectRatio || 3,

            // Pen configuration
            penColor: options.penColor || '#000000',
            backgroundColor: options.backgroundColor || '#FFFFFF',
            penWidth: options.penWidth || 2,
            minPenWidth: options.minPenWidth || 1,
            maxPenWidth: options.maxPenWidth || 5,
            velocityFilterWeight: options.velocityFilterWeight || 0.7,

            // Behavior
            disabled: options.disabled || false,
            readOnly: options.readOnly || false,
            clearOnResize: options.clearOnResize || false,
            debounceResize: options.debounceResize || 200,

            // Validation
            required: options.required || false,
            minStrokeCount: options.minStrokeCount || 1,
            minStrokeLength: options.minStrokeLength || 10,

            // Export
            exportFormat: options.exportFormat || 'png',
            exportQuality: options.exportQuality || 0.92,
            includeTimestamp: options.includeTimestamp !== false,
            includeMetadata: options.includeMetadata !== false,
            encryptExport: options.encryptExport || false,

            // UI
            showToolbar: options.showToolbar !== false,
            showClearButton: options.showClearButton !== false,
            showUndoButton: options.showUndoButton !== false,
            showRedoButton: options.showRedoButton || false,
            showPenColorPicker: options.showPenColorPicker || false,
            showPenWidthSlider: options.showPenWidthSlider || false,
            showSaveButton: options.showSaveButton !== false,
            showValidationIndicator: options.showValidationIndicator !== false,
            placeholder: options.placeholder || 'Sign here',
            clearLabel: options.clearLabel || 'Clear',
            undoLabel: options.undoLabel || 'Undo',
            saveLabel: options.saveLabel || 'Save Signature',

            // Theme
            theme: options.theme || 'light',
            borderStyle: options.borderStyle || 'dashed',
            borderRadius: options.borderRadius || 12,

            // Events
            onChange: options.onChange || null,
            onBegin: options.onBegin || null,
            onEnd: options.onEnd || null,
            onSave: options.onSave || null,
            onClear: options.onClear || null,
            onError: options.onError || null,
            onValidate: options.onValidate || null
        };

        this.state = {
            // Drawing state
            isDrawing: false,
            hasDrawn: false,
            strokes: [],
            currentStroke: [],
            undoStack: [],
            redoStack: [],
            lastPoint: null,
            lastVelocity: 0,
            lastWidth: this.config.penWidth,

            // Canvas state
            canvasWidth: this.config.width,
            canvasHeight: this.config.height,
            pixelRatio: window.devicePixelRatio || 1,

            // Validation state
            isValid: !this.config.required,
            strokeCount: 0,
            totalStrokeLength: 0,

            // Touch/Pen state
            isPen: false,
            pressure: 0,
            tiltX: 0,
            tiltY: 0,

            // Performance
            drawCount: 0,
            lastDrawTime: null
        };

        this.elements = {
            wrapper: null,
            canvas: null,
            placeholder: null,
            toolbar: null,
            clearBtn: null,
            undoBtn: null,
            redoBtn: null,
            saveBtn: null,
            colorPicker: null,
            widthSlider: null,
            validationIndicator: null,
            hiddenInput: null
        };

        this.ctx = null;
        this.resizeTimer = null;
        this.performance = {
            initTime: 0,
            renderTime: 0
        };

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleResize = this.debounce(this.handleResize.bind(this), this.config.debounceResize);

        this.init();
    }

    async init() {
        try {
            const initStart = performance.now();
            console.log(`[SignaturePad] Initializing: ${this.componentId}`);

            this.validateConfig();
            this.calculateDimensions();
            this.render();
            this.bindEvents();

            if (this.config.responsive) {
                window.addEventListener('resize', this.handleResize);
            }

            this.performance.initTime = performance.now() - initStart;
            console.log(`[SignaturePad] Initialized in ${this.performance.initTime.toFixed(2)}ms`);

            EventBus.emit('signaturepad:ready', {
                componentId: this.componentId,
                width: this.state.canvasWidth,
                height: this.state.canvasHeight
            });
        } catch (error) {
            console.error('[SignaturePad] Init failed:', error);
            this.container.innerHTML = `<div class="sig-error" role="alert">Failed to load signature pad: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    validateConfig() {
        if (this.config.penWidth < 0.5) this.config.penWidth = 0.5;
        if (this.config.penWidth > 20) this.config.penWidth = 20;
        if (this.config.minPenWidth < 0.5) this.config.minPenWidth = 0.5;
        if (this.config.maxPenWidth > 20) this.config.maxPenWidth = 20;
        if (this.config.minPenWidth > this.config.maxPenWidth) {
            this.config.minPenWidth = this.config.maxPenWidth;
        }
        this.state.lastWidth = this.config.penWidth;
    }

    calculateDimensions() {
        if (this.config.responsive && this.container) {
            const containerWidth = this.container.clientWidth;
            const width = Math.min(
                this.config.maxWidth,
                Math.max(this.config.minWidth, containerWidth - 32)
            );
            this.state.canvasWidth = width;
            this.state.canvasHeight = Math.round(width / this.config.aspectRatio);
        }
    }

    render() {
        try {
            const renderStart = performance.now();
            const themeClass = `sig-theme-${this.config.theme}`;
            const borderClass = `sig-border-${this.config.borderStyle}`;

            const html = `
                <div class="sig-wrapper ${themeClass} ${borderClass}" id="${this.componentId}"
                     style="border-radius:${this.config.borderRadius}px;max-width:${this.state.canvasWidth}px;"
                     role="region" aria-label="Signature Pad">
                    
                    ${this.config.showToolbar ? this.renderToolbar() : ''}

                    <div class="sig-canvas-container" style="position:relative;">
                        <canvas id="${this.componentId}-canvas"
                                width="${this.state.canvasWidth * this.state.pixelRatio}"
                                height="${this.state.canvasHeight * this.state.pixelRatio}"
                                style="width:${this.state.canvasWidth}px;height:${this.state.canvasHeight}px;background:${this.config.backgroundColor};border-radius:${this.config.borderRadius}px;"
                                aria-label="Signature drawing area"
                                tabindex="${this.config.disabled || this.config.readOnly ? '-1' : '0'}"
                                role="img">
                        </canvas>
                        ${!this.state.hasDrawn ? `
                            <div class="sig-placeholder" id="${this.componentId}-placeholder" aria-hidden="true">
                                <i class="fas fa-signature"></i>
                                <span>${this.escapeHtml(this.config.placeholder)}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${this.config.showValidationIndicator ? `
                        <div class="sig-validation" id="${this.componentId}-validation" 
                             style="color:${this.state.isValid ? '#10B981' : '#DC2626'};">
                            ${this.state.isValid ? 
                                '<i class="fas fa-check-circle"></i> Signature valid' : 
                                '<i class="fas fa-exclamation-circle"></i> Signature required'}
                        </div>
                    ` : ''}

                    <input type="hidden" id="${this.componentId}-hidden" name="signature" value="">
                </div>
            `;

            this.container.innerHTML = html;
            this.cacheElements();
            this.initCanvas();

            if (this.state.strokes.length > 0) {
                this.redrawAll();
            }

            this.performance.renderTime = performance.now() - renderStart;
            console.log(`[SignaturePad] Rendered in ${this.performance.renderTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('[SignaturePad] Render failed:', error);
        }
    }

    renderToolbar() {
        return `
            <div class="sig-toolbar" id="${this.componentId}-toolbar" role="toolbar" aria-label="Signature tools">
                <div class="sig-toolbar-left">
                    ${this.config.showPenColorPicker ? `
                        <div class="sig-tool-group">
                            <label class="sig-tool-label">Color</label>
                            <input type="color" id="${this.componentId}-color" 
                                   value="${this.config.penColor}" 
                                   class="sig-color-picker"
                                   aria-label="Pen color"
                                   onchange="window.Global.SignaturePad.instances.get('${this.componentId}').setPenColor(this.value)">
                        </div>
                    ` : ''}
                    ${this.config.showPenWidthSlider ? `
                        <div class="sig-tool-group">
                            <label class="sig-tool-label">Width</label>
                            <input type="range" id="${this.componentId}-width" 
                                   min="${this.config.minPenWidth}" max="${this.config.maxPenWidth}" 
                                   value="${this.config.penWidth}" step="0.5"
                                   class="sig-width-slider"
                                   aria-label="Pen width"
                                   oninput="window.Global.SignaturePad.instances.get('${this.componentId}').setPenWidth(this.value)">
                        </div>
                    ` : ''}
                </div>
                <div class="sig-toolbar-right">
                    ${this.config.showUndoButton ? `
                        <button class="sig-btn sig-undo-btn" id="${this.componentId}-undo" 
                                type="button" title="${this.config.undoLabel}" aria-label="${this.config.undoLabel}"
                                ${this.state.undoStack.length === 0 ? 'disabled' : ''}>
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                    ${this.config.showRedoButton ? `
                        <button class="sig-btn sig-redo-btn" id="${this.componentId}-redo" 
                                type="button" title="Redo" aria-label="Redo"
                                ${this.state.redoStack.length === 0 ? 'disabled' : ''}>
                            <i class="fas fa-redo"></i>
                        </button>
                    ` : ''}
                    ${this.config.showClearButton ? `
                        <button class="sig-btn sig-clear-btn" id="${this.componentId}-clear" 
                                type="button" title="${this.config.clearLabel}" aria-label="${this.config.clearLabel}">
                            <i class="fas fa-eraser"></i>
                        </button>
                    ` : ''}
                    ${this.config.showSaveButton ? `
                        <button class="sig-btn sig-save-btn" id="${this.componentId}-save" 
                                type="button" title="${this.config.saveLabel}" aria-label="${this.config.saveLabel}"
                                ${!this.state.hasDrawn ? 'disabled' : ''}>
                            <i class="fas fa-save"></i> ${this.config.saveLabel}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.canvas = document.getElementById(`${this.componentId}-canvas`);
        this.elements.placeholder = document.getElementById(`${this.componentId}-placeholder`);
        this.elements.toolbar = document.getElementById(`${this.componentId}-toolbar`);
        this.elements.clearBtn = document.getElementById(`${this.componentId}-clear`);
        this.elements.undoBtn = document.getElementById(`${this.componentId}-undo`);
        this.elements.redoBtn = document.getElementById(`${this.componentId}-redo`);
        this.elements.saveBtn = document.getElementById(`${this.componentId}-save`);
        this.elements.colorPicker = document.getElementById(`${this.componentId}-color`);
        this.elements.widthSlider = document.getElementById(`${this.componentId}-width`);
        this.elements.validationIndicator = document.getElementById(`${this.componentId}-validation`);
        this.elements.hiddenInput = document.getElementById(`${this.componentId}-hidden`);
    }

    initCanvas() {
        if (!this.elements.canvas) return;
        
        this.ctx = this.elements.canvas.getContext('2d');
        this.ctx.scale(this.state.pixelRatio, this.state.pixelRatio);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.config.penColor;
        this.ctx.lineWidth = this.config.penWidth;
    }

    bindEvents() {
        if (!this.elements.canvas || this.config.disabled || this.config.readOnly) return;

        const canvas = this.elements.canvas;

        // Mouse events
        canvas.addEventListener('mousedown', this.handleMouseDown);
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mouseup', this.handleMouseUp);
        canvas.addEventListener('mouseleave', this.handleMouseUp);

        // Touch events
        canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd);

        // Pen/stylus events
        canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));

        // Toolbar events
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clear());
        }
        if (this.elements.undoBtn) {
            this.elements.undoBtn.addEventListener('click', () => this.undo());
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.addEventListener('click', () => this.redo());
        }
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => this.save());
        }

        // Keyboard events for accessibility
        canvas.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { this.clear(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) { this.redo(); } else { this.undo(); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.save();
            }
        });

        console.log('[SignaturePad] Events bound');
    }

    // ============================================================
    // DRAWING HANDLERS
    // ============================================================

    handleMouseDown(e) {
        if (this.config.disabled || this.config.readOnly) return;
        e.preventDefault();
        const point = this.getPoint(e);
        this.beginStroke(point);
    }

    handleMouseMove(e) {
        if (!this.state.isDrawing) return;
        e.preventDefault();
        const point = this.getPoint(e);
        this.continueStroke(point);
    }

    handleMouseUp(e) {
        if (!this.state.isDrawing) return;
        const point = this.getPoint(e);
        this.endStroke(point);
    }

    handleTouchStart(e) {
        if (this.config.disabled || this.config.readOnly) return;
        e.preventDefault();
        const touch = e.touches[0];
        const point = this.getTouchPoint(touch);
        this.beginStroke(point);
    }

    handleTouchMove(e) {
        if (!this.state.isDrawing) return;
        e.preventDefault();
        const touch = e.touches[0];
        const point = this.getTouchPoint(touch);
        this.continueStroke(point);
    }

    handleTouchEnd(e) {
        if (!this.state.isDrawing) return;
        const point = this.state.currentStroke.length > 0 ? 
            this.state.currentStroke[this.state.currentStroke.length - 1] : null;
        this.endStroke(point);
    }

    handlePointerDown(e) {
        if (e.pointerType === 'pen') {
            this.state.isPen = true;
            this.state.pressure = e.pressure || 0;
            this.state.tiltX = e.tiltX || 0;
            this.state.tiltY = e.tiltY || 0;
        }
    }

    handlePointerMove(e) {
        if (this.state.isPen && this.state.isDrawing) {
            this.state.pressure = e.pressure || 0;
            this.state.tiltX = e.tiltX || 0;
            this.state.tiltY = e.tiltY || 0;
        }
    }

    // ============================================================
    // STROKE MANAGEMENT
    // ============================================================

    getPoint(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            time: Date.now(),
            pressure: this.state.isPen ? this.state.pressure : 0.5
        };
    }

    getTouchPoint(touch) {
        const rect = this.elements.canvas.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
            time: Date.now(),
            pressure: touch.force || 0.5
        };
    }

    beginStroke(point) {
        this.state.isDrawing = true;
        this.state.currentStroke = [point];
        this.state.lastPoint = point;
        this.state.hasDrawn = true;

        if (this.elements.placeholder) {
            this.elements.placeholder.style.display = 'none';
        }
        if (this.elements.saveBtn) {
            this.elements.saveBtn.disabled = false;
        }

        if (this.config.onBegin) {
            this.config.onBegin({ point });
        }
    }

    continueStroke(point) {
        if (!this.state.isDrawing) return;

        this.state.currentStroke.push(point);

        const points = this.state.currentStroke;
        if (points.length < 2) return;

        const current = point;
        const previous = points[points.length - 2];

        // Calculate velocity for pressure simulation
        const distance = Math.sqrt(
            Math.pow(current.x - previous.x, 2) + 
            Math.pow(current.y - previous.y, 2)
        );
        const timeDiff = current.time - previous.time;
        const velocity = timeDiff > 0 ? distance / timeDiff : 0;

        // Smooth velocity using exponential filter
        this.state.lastVelocity = this.config.velocityFilterWeight * velocity + 
            (1 - this.config.velocityFilterWeight) * this.state.lastVelocity;

        // Calculate line width based on velocity (faster = thinner)
        const baseWidth = this.config.penWidth;
        const widthFromVelocity = Math.max(
            this.config.minPenWidth,
            baseWidth / (this.state.lastVelocity + 1)
        );

        // Blend with pressure if using stylus
        let width = widthFromVelocity;
        if (this.state.isPen) {
            const pressureWidth = this.config.minPenWidth + 
                (this.config.maxPenWidth - this.config.minPenWidth) * this.state.pressure;
            width = (widthFromVelocity + pressureWidth) / 2;
        }

        // Smooth width transition
        this.state.lastWidth = this.config.velocityFilterWeight * width + 
            (1 - this.config.velocityFilterWeight) * this.state.lastWidth;

        // Draw the line segment
        this.drawLine(previous, current, this.state.lastWidth);

        this.state.lastPoint = current;
        this.state.drawCount++;
        this.state.lastDrawTime = Date.now();
    }

    endStroke(point) {
        if (!this.state.isDrawing) return;

        if (point) {
            this.state.currentStroke.push(point);
        }

        // Store completed stroke
        if (this.state.currentStroke.length >= 2) {
            this.state.strokes.push([...this.state.currentStroke]);
            this.state.strokeCount++;
            this.state.totalStrokeLength += this.calculateStrokeLength(this.state.currentStroke);
            this.state.undoStack.push([...this.state.currentStroke]);
            this.state.redoStack = [];
        }

        this.state.isDrawing = false;
        this.state.isPen = false;
        this.state.currentStroke = [];

        // Update toolbar buttons
        this.updateToolbarState();

        // Validate
        this.validate();

        // Fire callbacks
        if (this.config.onEnd) {
            this.config.onEnd({ 
                strokeCount: this.state.strokeCount, 
                totalLength: this.state.totalStrokeLength 
            });
        }
        if (this.config.onChange) {
            this.config.onChange(this.getSignatureData());
        }

        EventBus.emit('signaturepad:changed', {
            componentId: this.componentId,
            strokeCount: this.state.strokeCount,
            hasDrawn: this.state.hasDrawn
        });
    }

    drawLine(from, to, width) {
        if (!this.ctx) return;

        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.strokeStyle = this.config.penColor;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
    }

    calculateStrokeLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    }

    // ============================================================
    // CANVAS OPERATIONS
    // ============================================================

    redrawAll() {
        if (!this.ctx) return;
        this.clearCanvas(false);

        this.state.strokes.forEach(stroke => {
            if (stroke.length < 2) return;
            
            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);
            
            for (let i = 1; i < stroke.length; i++) {
                this.ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            
            this.ctx.strokeStyle = this.config.penColor;
            this.ctx.lineWidth = this.config.penWidth;
            this.ctx.stroke();
        });
    }

    clearCanvas(clearState = true) {
        if (!this.ctx || !this.elements.canvas) return;
        this.ctx.clearRect(0, 0, this.state.canvasWidth, this.state.canvasHeight);

        if (clearState) {
            this.clear(true);
        }
    }

    clear(silent = false) {
        if (this.config.disabled || this.config.readOnly) return;

        this.state.strokes = [];
        this.state.currentStroke = [];
        this.state.undoStack = [];
        this.state.redoStack = [];
        this.state.hasDrawn = false;
        this.state.strokeCount = 0;
        this.state.totalStrokeLength = 0;
        this.state.isValid = !this.config.required;

        if (this.ctx && this.elements.canvas) {
            this.ctx.clearRect(0, 0, this.state.canvasWidth, this.state.canvasHeight);
        }

        if (this.elements.placeholder) {
            this.elements.placeholder.style.display = 'flex';
        }
        if (this.elements.saveBtn) {
            this.elements.saveBtn.disabled = true;
        }

        this.updateToolbarState();
        this.updateValidationUI();
        this.updateHiddenInput();

        if (!silent && this.config.onClear) {
            this.config.onClear();
        }
        if (!silent && this.config.onChange) {
            this.config.onChange(null);
        }

        EventBus.emit('signaturepad:cleared', { componentId: this.componentId });
    }

    undo() {
        if (this.state.undoStack.length === 0) return;

        const lastStroke = this.state.undoStack.pop();
        this.state.redoStack.push(lastStroke);
        this.state.strokes.pop();
        this.state.strokeCount = Math.max(0, this.state.strokeCount - 1);

        if (this.state.strokes.length === 0) {
            this.state.hasDrawn = false;
            if (this.elements.placeholder) {
                this.elements.placeholder.style.display = 'flex';
            }
            if (this.elements.saveBtn) {
                this.elements.saveBtn.disabled = true;
            }
        }

        this.redrawAll();
        this.updateToolbarState();
        this.validate();

        if (this.config.onChange) {
            this.config.onChange(this.getSignatureData());
        }

        EventBus.emit('signaturepad:undone', { componentId: this.componentId });
    }

    redo() {
        if (this.state.redoStack.length === 0) return;

        const stroke = this.state.redoStack.pop();
        this.state.undoStack.push(stroke);
        this.state.strokes.push(stroke);
        this.state.strokeCount++;
        this.state.hasDrawn = true;

        if (this.elements.placeholder) {
            this.elements.placeholder.style.display = 'none';
        }
        if (this.elements.saveBtn) {
            this.elements.saveBtn.disabled = false;
        }

        this.redrawAll();
        this.updateToolbarState();
        this.validate();

        if (this.config.onChange) {
            this.config.onChange(this.getSignatureData());
        }
    }

    // ============================================================
    // VALIDATION
    // ============================================================

    validate() {
        if (!this.config.required) {
            this.state.isValid = true;
            this.updateValidationUI();
            return true;
        }

        const hasEnoughStrokes = this.state.strokeCount >= this.config.minStrokeCount;
        const hasEnoughLength = this.state.totalStrokeLength >= this.config.minStrokeLength;
        this.state.isValid = this.state.hasDrawn && hasEnoughStrokes && hasEnoughLength;

        this.updateValidationUI();

        if (this.config.onValidate) {
            this.config.onValidate({
                valid: this.state.isValid,
                strokeCount: this.state.strokeCount,
                totalLength: this.state.totalStrokeLength
            });
        }

        return this.state.isValid;
    }

    updateValidationUI() {
        if (this.elements.validationIndicator) {
            this.elements.validationIndicator.style.color = this.state.isValid ? '#10B981' : '#DC2626';
            this.elements.validationIndicator.innerHTML = this.state.isValid ?
                '<i class="fas fa-check-circle"></i> Signature valid' :
                '<i class="fas fa-exclamation-circle"></i> Signature required';
        }
    }

    // ============================================================
    // EXPORT & SAVE
    // ============================================================

    getSignatureData() {
        if (!this.state.hasDrawn) return null;

        return {
            dataURL: this.toDataURL(),
            strokes: this.state.strokes,
            strokeCount: this.state.strokeCount,
            totalStrokeLength: this.state.totalStrokeLength,
            width: this.state.canvasWidth,
            height: this.state.canvasHeight,
            timestamp: this.config.includeTimestamp ? new Date().toISOString() : null,
            metadata: this.config.includeMetadata ? {
                penColor: this.config.penColor,
                penWidth: this.config.penWidth,
                platform: navigator.platform,
                userAgent: navigator.userAgent
            } : null
        };
    }

    toDataURL(format = null) {
        if (!this.elements.canvas) return null;

        const fmt = format || this.config.exportFormat;
        const mimeType = fmt === 'jpg' || fmt === 'jpeg' ? 'image/jpeg' :
                        fmt === 'svg' ? 'image/svg+xml' : 'image/png';
        
        return this.elements.canvas.toDataURL(mimeType, this.config.exportQuality);
    }

    toBlob(format = null) {
        return new Promise((resolve, reject) => {
            if (!this.elements.canvas) {
                reject(new Error('Canvas not available'));
                return;
            }

            const fmt = format || this.config.exportFormat;
            const mimeType = fmt === 'jpg' || fmt === 'jpeg' ? 'image/jpeg' : 'image/png';

            this.elements.canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            }, mimeType, this.config.exportQuality);
        });
    }

    async save() {
        if (!this.state.hasDrawn) {
            console.warn('[SignaturePad] No signature to save');
            return null;
        }

        if (!this.validate()) {
            console.warn('[SignaturePad] Signature validation failed');
            if (this.config.onError) {
                this.config.onError({ message: 'Signature validation failed' });
            }
            return null;
        }

        try {
            const signatureData = this.getSignatureData();

            if (this.config.onSave) {
                await this.config.onSave(signatureData);
            }

            this.updateHiddenInput();

            EventBus.emit('signaturepad:saved', {
                componentId: this.componentId,
                signatureData
            });

            console.log('[SignaturePad] Signature saved successfully');
            return signatureData;

        } catch (error) {
            console.error('[SignaturePad] Save failed:', error);
            if (this.config.onError) {
                this.config.onError({ message: error.message });
            }
            return null;
        }
    }

    updateHiddenInput() {
        if (this.elements.hiddenInput) {
            this.elements.hiddenInput.value = this.state.hasDrawn ? this.toDataURL() : '';
        }
    }

    // ============================================================
    // CONFIGURATION SETTERS
    // ============================================================

    setPenColor(color) {
        this.config.penColor = color;
        if (!this.state.isDrawing) {
            this.redrawAll();
        }
    }

    setPenWidth(width) {
        this.config.penWidth = parseFloat(width);
        this.state.lastWidth = this.config.penWidth;
    }

    setDisabled(disabled) {
        this.config.disabled = disabled;
        if (this.elements.canvas) {
            this.elements.canvas.style.pointerEvents = disabled ? 'none' : 'auto';
            this.elements.canvas.style.opacity = disabled ? '0.6' : '1';
        }
    }

    // ============================================================
    // UTILITY METHODS
    // ============================================================

    updateToolbarState() {
        if (this.elements.undoBtn) {
            this.elements.undoBtn.disabled = this.state.undoStack.length === 0;
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.disabled = this.state.redoStack.length === 0;
        }
    }

    handleResize() {
        if (this.state.isDrawing) return;

        const hadSignature = this.state.hasDrawn;
        const savedStrokes = hadSignature && !this.config.clearOnResize ? 
            [...this.state.strokes] : [];

        this.calculateDimensions();
        this.render();
        this.bindEvents();

        if (savedStrokes.length > 0) {
            this.state.strokes = savedStrokes;
            this.state.hasDrawn = true;
            this.redrawAll();
        }
    }

    getState() {
        return {
            hasDrawn: this.state.hasDrawn,
            strokeCount: this.state.strokeCount,
            isValid: this.state.isValid,
            canvasWidth: this.state.canvasWidth,
            canvasHeight: this.state.canvasHeight
        };
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func.apply(this, args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    escapeHtml(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);

        const canvas = this.elements.canvas;
        if (canvas) {
            canvas.removeEventListener('mousedown', this.handleMouseDown);
            canvas.removeEventListener('mousemove', this.handleMouseMove);
            canvas.removeEventListener('mouseup', this.handleMouseUp);
            canvas.removeEventListener('mouseleave', this.handleMouseUp);
            canvas.removeEventListener('touchstart', this.handleTouchStart);
            canvas.removeEventListener('touchmove', this.handleTouchMove);
            canvas.removeEventListener('touchend', this.handleTouchEnd);
        }

        if (this.container) this.container.innerHTML = '';

        if (window.Global?.SignaturePad?.instances) {
            window.Global.SignaturePad.instances.delete(this.componentId);
        }

        console.log('[SignaturePad] Component destroyed');
    }

    static create(container, options) {
        const instance = new SignaturePad(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.SignaturePad) window.Global.SignaturePad = {};
        if (!window.Global.SignaturePad.instances) window.Global.SignaturePad.instances = new Map();
        window.Global.SignaturePad.instances.set(instance.componentId, instance);
        return instance;
    }

    static getInstance(componentId) {
        return window.Global?.SignaturePad?.instances?.get(componentId) || null;
    }
}

export { SignaturePad };
export default SignaturePad;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.SignaturePad = window.Global.SignaturePad || {};
    window.Global.SignaturePad.instances = window.Global.SignaturePad.instances || new Map();
    window.Global.SignaturePad.SignaturePad = SignaturePad;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
