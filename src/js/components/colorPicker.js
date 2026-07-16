/**
 * 11 AVATAR DIGITAL HUB - Color Picker Component
 * Enterprise-grade color selection system
 * Spectrum, swatches, gradients, opacity, color history, eyedropper
 * 
 * @component ColorPicker
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Cache } from '../core/cache.js';
import { Formatters } from '../utils/formatters.js';

/**
 * ColorPicker - Professional color selection component
 * HSL/RGB/HEX, alpha channel, swatches, palettes, accessibility checker
 */
class ColorPicker {
    constructor(container, options = {}) {
        this.componentName = 'ColorPicker';
        this.componentId = `cp-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('ColorPicker: Container element not found');
        }

        // Full configuration with deep defaults
        this.config = {
            // Color value
            value: options.value || '#D4AF37',
            defaultValue: options.defaultValue || '#000000',
            format: options.format || 'hex', // hex, rgb, hsl, rgba, hsla
            
            // Picker modes
            mode: options.mode || 'full', // full, compact, swatches, gradient
            pickerTypes: options.pickerTypes || ['spectrum', 'swatches', 'gradient'],
            enableAlpha: options.enableAlpha !== false,
            enableSpectrum: options.enableSpectrum !== false,
            enableSwatches: options.enableSwatches !== false,
            enableGradient: options.enableGradient || false,
            enableEyedropper: options.enableEyedropper || false,
            enableHistory: options.enableHistory !== false,
            
            // Spectrum options
            spectrumWidth: options.spectrumWidth || 280,
            spectrumHeight: options.spectrumHeight || 180,
            hueWidth: options.hueWidth || 20,
            hueHeight: options.hueHeight || 180,
            alphaWidth: options.alphaWidth || 20,
            alphaHeight: options.alphaHeight || 180,
            
            // Swatches
            swatches: options.swatches || null,
            swatchesPerRow: options.swatchesPerRow || 8,
            enableCustomSwatches: options.enableCustomSwatches !== false,
            maxCustomSwatches: options.maxCustomSwatches || 32,
            
            // Gradient
            gradientType: options.gradientType || 'linear',
            gradientDirection: options.gradientDirection || 'to right',
            gradientStops: options.gradientStops || [
                { color: '#ffffff', position: 0 },
                { color: '#000000', position: 100 }
            ],
            
            // History
            historyLimit: options.historyLimit || 20,
            historyColors: options.historyColors || [],
            
            // Input
            showInput: options.showInput !== false,
            showPreview: options.showPreview !== false,
            showClear: options.showClear || false,
            clearLabel: options.clearLabel || 'Clear',
            
            // Accessibility
            showAccessibility: options.showAccessibility || false,
            wcagLevel: options.wcagLevel || 'AA',
            
            // UI
            theme: options.theme || 'light',
            position: options.position || 'bottom-left',
            offset: options.offset || 8,
            inline: options.inline || false,
            size: options.size || 'md',
            
            // Events
            onChange: options.onChange || null,
            onConfirm: options.onConfirm || null,
            onCancel: options.onCancel || null,
            onClear: options.onClear || null,
            onFormatChange: options.onFormatChange || null
        };

        // Internal state with full initialization
        this.state = {
            // Current color in all formats
            color: this.parseColor(this.config.value),
            
            // Picker state
            isOpen: false,
            isDragging: false,
            activePicker: 'spectrum',
            hue: 0,
            saturation: 100,
            lightness: 50,
            alpha: 1,
            
            // Spectrum drag state
            spectrumX: 0,
            spectrumY: 0,
            hueY: 0,
            alphaY: 0,
            
            // Gradient state
            gradientStops: [...this.config.gradientStops],
            selectedStopIndex: 0,
            gradientAngle: 90,
            
            // History
            history: [...this.config.historyColors],
            
            // Eyedropper
            eyeDropperActive: false,
            
            // UI state
            format: this.config.format,
            inputValue: this.config.value,
            contrastRatio: 0,
            wcagPass: false
        };

        // DOM element cache
        this.elements = {
            wrapper: null,
            trigger: null,
            preview: null,
            panel: null,
            spectrum: null,
            spectrumCursor: null,
            hueSlider: null,
            hueCursor: null,
            alphaSlider: null,
            alphaCursor: null,
            gradientCanvas: null,
            gradientStopsContainer: null,
            swatchesContainer: null,
            historyContainer: null,
            colorInput: null,
            formatToggle: null,
            hexInput: null,
            rgbInput: null,
            hslInput: null,
            contrastInfo: null,
            confirmBtn: null,
            cancelBtn: null,
            clearBtn: null,
            eyeDropperBtn: null
        };

        // Color presets
        this.palette = {
            'Material Colors': [
                '#F44336', '#E91E63', '#9C27B0', '#673AB7',
                '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
                '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
                '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
                '#795548', '#607D8B', '#9E9E9E', '#000000'
            ],
            'Flat UI': [
                '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6',
                '#34495E', '#16A085', '#27AE60', '#2980B9',
                '#8E44AD', '#2C3E50', '#F1C40F', '#E67E22',
                '#E74C3C', '#ECF0F1', '#95A5A6', '#7F8C8D'
            ],
            'Brand Colors': [
                '#D4AF37', '#1DA1F2', '#1877F2', '#E4405F',
                '#0A66C2', '#FF0000', '#25D366', '#0088CC',
                '#EA4335', '#4285F4', '#34A853', '#FBBC05'
            ]
        };

        // Performance tracking
        this.performance = {
            renderTime: 0,
            updateCount: 0,
            lastUpdate: null
        };

        // Initialize
        this.init();
    }

    /**
     * Initialize color picker
     */
    async init() {
        try {
            const startTime = performance.now();
            console.log(`[ColorPicker] Initializing: ${this.componentId}`);

            // Load color history from cache
            await this.loadHistory();

            // Parse initial color
            this.state.color = this.parseColor(this.config.value);
            this.extractHSL(this.state.color);

            // Render component
            this.render();

            // Set up event handlers
            this.setupEventHandlers();

            // Update performance
            this.performance.renderTime = performance.now() - startTime;
            
            console.log(`[ColorPicker] Initialized in ${this.performance.renderTime.toFixed(2)}ms`);

            // Emit ready event
            EventBus.emit('colorpicker:ready', {
                componentId: this.componentId,
                value: this.getColor('hex')
            });

        } catch (error) {
            console.error('[ColorPicker] Initialization failed:', error);
            this.container.innerHTML = '<div class="cp-error">Failed to load color picker</div>';
        }
    }

    /**
     * Parse color string to standardized object
     */
    parseColor(colorStr) {
        if (!colorStr) return { r: 0, g: 0, b: 0, a: 1, hex: '#000000' };

        // Handle named colors
        const namedColors = {
            'transparent': { r: 0, g: 0, b: 0, a: 0 },
            'white': { r: 255, g: 255, b: 255, a: 1 },
            'black': { r: 0, g: 0, b: 0, a: 1 },
            'gold': { r: 212, g: 175, b: 55, a: 1 },
            'red': { r: 255, g: 0, b: 0, a: 1 },
            'green': { r: 0, g: 128, b: 0, a: 1 },
            'blue': { r: 0, g: 0, b: 255, a: 1 }
        };

        const str = (colorStr || '').toString().trim().toLowerCase();
        
        if (namedColors[str]) {
            const nc = namedColors[str];
            return { ...nc, hex: this.rgbToHex(nc.r, nc.g, nc.b), alpha: nc.a };
        }

        try {
            // HEX format
            if (str.startsWith('#')) {
                let hex = str.replace('#', '');
                
                // Handle shorthand (#RGB → #RRGGBB)
                if (hex.length === 3) {
                    hex = hex.split('').map(c => c + c).join('');
                }
                
                // Handle 8-digit hex (#RRGGBBAA)
                if (hex.length === 8) {
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const a = Math.round((parseInt(hex.substring(6, 8), 16) / 255) * 100) / 100;
                    return { r, g, b, a, hex: `#${hex.substring(0, 6)}`, alpha: a };
                }
                
                if (hex.length === 6) {
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    return { r, g, b, a: 1, hex: `#${hex}`, alpha: 1 };
                }
            }

            // RGB/RGBA format
            const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);
                const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
                return { r, g, b, a, hex: this.rgbToHex(r, g, b), alpha: a };
            }

            // HSL/HSLA format
            const hslMatch = str.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([\d.]+))?\s*\)/);
            if (hslMatch) {
                const h = parseInt(hslMatch[1]) / 360;
                const s = parseInt(hslMatch[2]) / 100;
                const l = parseInt(hslMatch[3]) / 100;
                const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
                const rgb = this.hslToRgb(h, s, l);
                return { ...rgb, a, hex: this.rgbToHex(rgb.r, rgb.g, rgb.b), alpha: a };
            }
        } catch (error) {
            console.error('[ColorPicker] Color parse error:', error);
        }

        // Fallback to black
        return { r: 0, g: 0, b: 0, a: 1, hex: '#000000', alpha: 1 };
    }

    /**
     * Extract HSL values from RGB color
     */
    extractHSL(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        this.state.lightness = Math.round(((max + min) / 2) * 100);
        
        if (delta === 0) {
            this.state.hue = 0;
            this.state.saturation = 0;
        } else {
            this.state.saturation = Math.round((delta / (1 - Math.abs(2 * ((max + min) / 2) - 1))) * 100);
            
            let hue = 0;
            if (max === r) {
                hue = ((g - b) / delta) % 6;
            } else if (max === g) {
                hue = (b - r) / delta + 2;
            } else {
                hue = (r - g) / delta + 4;
            }
            
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;
            this.state.hue = hue;
        }

        this.state.alpha = color.a !== undefined ? color.a : 1;
    }

    /**
     * Color space conversions
     */
    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    /**
     * Get color in specified format
     */
    getColor(format = 'hex') {
        const { r, g, b, a } = this.state.color;

        switch (format) {
            case 'hex':
                return this.rgbToHex(r, g, b);
            
            case 'hexa':
                const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
                return this.rgbToHex(r, g, b) + alphaHex;
            
            case 'rgb':
                return `rgb(${r}, ${g}, ${b})`;
            
            case 'rgba':
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            
            case 'hsl':
                const hsl = this.rgbToHsl(r, g, b);
                return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
            
            case 'hsla':
                const hsla = this.rgbToHsl(r, g, b);
                return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${a})`;
            
            case 'object':
                return { r, g, b, a, hex: this.rgbToHex(r, g, b) };
            
            default:
                return this.rgbToHex(r, g, b);
        }
    }

    /**
     * Set color from any format
     */
    setColor(colorStr) {
        const parsed = this.parseColor(colorStr);
        this.state.color = parsed;
        this.extractHSL(parsed);
        this.state.inputValue = this.getColor(this.state.format);
        this.updateUI();
        this.addToHistory(this.getColor('hex'));
        
        if (this.config.onChange) {
            this.config.onChange(this.getColor(this.state.format), this.getColor('object'));
        }
        
        this.performance.updateCount++;
        this.performance.lastUpdate = new Date();
    }

    /**
     * Update color from spectrum position
     */
    updateColorFromSpectrum(x, y, width, height) {
        const saturation = Math.max(0, Math.min(100, Math.round((x / width) * 100)));
        const lightness = Math.max(0, Math.min(100, Math.round(100 - (y / height) * 100)));
        
        const rgb = this.hslToRgb(this.state.hue / 360, saturation / 100, lightness / 100);
        
        this.state.color = {
            r: rgb.r, g: rgb.g, b: rgb.b,
            a: this.state.alpha,
            hex: this.rgbToHex(rgb.r, rgb.g, rgb.b)
        };
        
        this.state.saturation = saturation;
        this.state.lightness = lightness;
        
        this.state.inputValue = this.getColor(this.state.format);
        this.updateUI();
        
        if (this.config.onChange) {
            this.config.onChange(this.getColor(this.state.format), this.getColor('object'));
        }
    }

    /**
     * Update color from hue slider
     */
    updateColorFromHue(y, height) {
        const hue = Math.max(0, Math.min(360, Math.round((y / height) * 360)));
        this.state.hue = hue;
        
        const rgb = this.hslToRgb(hue / 360, this.state.saturation / 100, this.state.lightness / 100);
        
        this.state.color = {
            r: rgb.r, g: rgb.g, b: rgb.b,
            a: this.state.alpha,
            hex: this.rgbToHex(rgb.r, rgb.g, rgb.b)
        };
        
        this.state.inputValue = this.getColor(this.state.format);
        this.updateUI();
        
        if (this.config.onChange) {
            this.config.onChange(this.getColor(this.state.format), this.getColor('object'));
        }
    }

    /**
     * Update alpha value
     */
    updateAlpha(y, height) {
        this.state.alpha = Math.max(0, Math.min(1, Math.round((1 - y / height) * 100) / 100));
        this.state.color.a = this.state.alpha;
        this.state.color.alpha = this.state.alpha;
        
        this.state.inputValue = this.getColor(this.state.format);
        this.updateUI();
    }

    /**
     * Add color to history
     */
    addToHistory(hexColor) {
        if (!this.config.enableHistory) return;
        
        // Remove duplicate
        this.state.history = this.state.history.filter(c => c !== hexColor);
        
        // Add to front
        this.state.history.unshift(hexColor);
        
        // Limit
        if (this.state.history.length > this.config.historyLimit) {
            this.state.history = this.state.history.slice(0, this.config.historyLimit);
        }
        
        // Save
        this.saveHistory();
    }

    /**
     * Load history from cache
     */
    async loadHistory() {
        try {
            const cached = await Cache.get(`colorpicker_history_${this.componentId}`);
            if (cached && cached.data && Array.isArray(cached.data)) {
                this.state.history = cached.data.slice(0, this.config.historyLimit);
            }
        } catch (error) {
            console.error('[ColorPicker] History load failed:', error);
        }
    }

    /**
     * Save history to cache
     */
    async saveHistory() {
        try {
            await Cache.set(
                `colorpicker_history_${this.componentId}`,
                this.state.history,
                30 * 24 * 3600000 // 30 days
            );
        } catch (error) {
            console.error('[ColorPicker] History save failed:', error);
        }
    }

    /**
     * Check WCAG contrast ratio
     */
    checkContrast(foreground, background = '#FFFFFF') {
        const fg = this.parseColor(foreground);
        const bg = this.parseColor(background);
        
        const getLuminance = (color) => {
            const rsrgb = color.r / 255;
            const gsrgb = color.g / 255;
            const bsrgb = color.b / 255;
            
            const r = rsrgb <= 0.03928 ? rsrgb / 12.92 : Math.pow((rsrgb + 0.055) / 1.055, 2.4);
            const g = gsrgb <= 0.03928 ? gsrgb / 12.92 : Math.pow((gsrgb + 0.055) / 1.055, 2.4);
            const b = bsrgb <= 0.03928 ? bsrgb / 12.92 : Math.pow((bsrgb + 0.055) / 1.055, 2.4);
            
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        
        const l1 = getLuminance(fg);
        const l2 = getLuminance(bg);
        
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        
        const ratio = (lighter + 0.05) / (darker + 0.05);
        
        this.state.contrastRatio = Math.round(ratio * 100) / 100;
        this.state.wcagPass = this.state.contrastRatio >= (this.config.wcagLevel === 'AAA' ? 7 : 4.5);
        
        return {
            ratio: this.state.contrastRatio,
            pass: this.state.wcagPass,
            level: this.config.wcagLevel,
            recommendation: this.state.contrastRatio < 3 ? 'Poor - Do not use' :
                          this.state.contrastRatio < 4.5 ? 'Moderate - Large text only' :
                          this.state.contrastRatio < 7 ? 'Good - Passes AA' : 'Excellent - Passes AAA'
        };
    }

    /**
     * Render the complete color picker
     */
    render() {
        try {
            const sizeClass = `cp-size-${this.config.size}`;
            const themeClass = `cp-theme-${this.config.theme}`;
            const inlineClass = this.config.inline ? 'cp-inline' : '';
            const openClass = this.state.isOpen ? 'cp-open' : '';

            const html = `
                <div class="cp-wrapper ${sizeClass} ${themeClass} ${inlineClass} ${openClass}" id="${this.componentId}">
                    <!-- Trigger / Preview -->
                    ${!this.config.inline ? `
                        <div class="cp-trigger" id="${this.componentId}-trigger" role="button" tabindex="0" aria-label="Open color picker">
                            ${this.config.showPreview ? `
                                <span class="cp-preview-swatch" id="${this.componentId}-preview" 
                                      style="background: ${this.getColor('rgba')};" 
                                      aria-label="Current color: ${this.getColor('hex')}"></span>
                            ` : ''}
                            <span class="cp-value-text" id="${this.componentId}-value-text">${this.state.inputValue}</span>
                            <i class="fas fa-chevron-down cp-arrow"></i>
                        </div>
                    ` : ''}

                    <!-- Picker Panel -->
                    <div class="cp-panel" id="${this.componentId}-panel" 
                         style="display: ${this.state.isOpen || this.config.inline ? 'block' : 'none'};">
                        
                        <!-- Picker Type Tabs -->
                        ${this.config.pickerTypes.length > 1 ? `
                            <div class="cp-tabs">
                                ${this.config.pickerTypes.includes('spectrum') ? `
                                    <button class="cp-tab ${this.state.activePicker === 'spectrum' ? 'active' : ''}" 
                                            data-picker="spectrum" onclick="window.Global.ColorPicker.instances.get('${this.componentId}').switchPicker('spectrum')">
                                        <i class="fas fa-palette"></i>
                                    </button>
                                ` : ''}
                                ${this.config.pickerTypes.includes('swatches') ? `
                                    <button class="cp-tab ${this.state.activePicker === 'swatches' ? 'active' : ''}" 
                                            data-picker="swatches" onclick="window.Global.ColorPicker.instances.get('${this.componentId}').switchPicker('swatches')">
                                        <i class="fas fa-th"></i>
                                    </button>
                                ` : ''}
                                ${this.config.pickerTypes.includes('gradient') ? `
                                    <button class="cp-tab ${this.state.activePicker === 'gradient' ? 'active' : ''}" 
                                            data-picker="gradient" onclick="window.Global.ColorPicker.instances.get('${this.componentId}').switchPicker('gradient')">
                                        <i class="fas fa-fill-drip"></i>
                                    </button>
                                ` : ''}
                            </div>
                        ` : ''}

                        <!-- Spectrum Picker -->
                        <div class="cp-spectrum-section" style="display: ${this.state.activePicker === 'spectrum' ? 'block' : 'none'};">
                            ${this.renderSpectrum()}
                        </div>

                        <!-- Swatches -->
                        <div class="cp-swatches-section" style="display: ${this.state.activePicker === 'swatches' ? 'block' : 'none'};">
                            ${this.renderSwatches()}
                        </div>

                        <!-- Gradient Picker -->
                        ${this.config.enableGradient ? `
                            <div class="cp-gradient-section" style="display: ${this.state.activePicker === 'gradient' ? 'block' : 'none'};">
                                ${this.renderGradientPicker()}
                            </div>
                        ` : ''}

                        <!-- Color Input Fields -->
                        ${this.config.showInput ? this.renderInputFields() : ''}

                        <!-- Accessibility Check -->
                        ${this.config.showAccessibility ? this.renderAccessibilityCheck() : ''}

                        <!-- Color History -->
                        ${this.config.enableHistory ? this.renderHistory() : ''}

                        <!-- Action Buttons -->
                        ${!this.config.inline ? this.renderActions() : ''}
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
            this.cacheElements();
            this.updateUI();

            console.log('[ColorPicker] Rendered');
        } catch (error) {
            console.error('[ColorPicker] Render failed:', error);
        }
    }

    /**
     * Render spectrum picker with canvas
     */
    renderSpectrum() {
        return `
            <div class="cp-spectrum">
                <div class="cp-spectrum-area">
                    <canvas id="${this.componentId}-spectrum-canvas" 
                            width="${this.config.spectrumWidth}" 
                            height="${this.config.spectrumHeight}"
                            class="cp-spectrum-canvas"
                            aria-label="Color spectrum"></canvas>
                    <div class="cp-spectrum-cursor" id="${this.componentId}-spectrum-cursor"
                         style="left: ${this.state.saturation * this.config.spectrumWidth / 100}px; 
                                top: ${(100 - this.state.lightness) * this.config.spectrumHeight / 100}px;"></div>
                </div>
                <div class="cp-hue-slider">
                    <canvas id="${this.componentId}-hue-canvas" 
                            width="${this.config.hueWidth}" 
                            height="${this.config.hueHeight}"
                            class="cp-hue-canvas"
                            aria-label="Hue slider"></canvas>
                    <div class="cp-hue-cursor" id="${this.componentId}-hue-cursor"
                         style="top: ${this.state.hue * this.config.hueHeight / 360}px;"></div>
                </div>
                ${this.config.enableAlpha ? `
                    <div class="cp-alpha-slider">
                        <canvas id="${this.componentId}-alpha-canvas" 
                                width="${this.config.alphaWidth}" 
                                height="${this.config.alphaHeight}"
                                class="cp-alpha-canvas"
                                aria-label="Alpha slider"></canvas>
                        <div class="cp-alpha-cursor" id="${this.componentId}-alpha-cursor"
                             style="top: ${(1 - this.state.alpha) * this.config.alphaHeight}px;"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render swatches grid
     */
    renderSwatches() {
        const swatches = this.config.swatches || this.palette;
        const paletteNames = Object.keys(swatches);

        return `
            <div class="cp-swatches">
                ${paletteNames.map(name => `
                    <div class="cp-swatch-group">
                        <div class="cp-swatch-group-name">${this.escapeHtml(name)}</div>
                        <div class="cp-swatch-grid" style="grid-template-columns: repeat(${this.config.swatchesPerRow}, 1fr);">
                            ${(Array.isArray(swatches[name]) ? swatches[name] : swatches[name]).map(color => `
                                <button class="cp-swatch-btn ${this.getColor('hex').toUpperCase() === color.toUpperCase() ? 'active' : ''}"
                                        style="background: ${color};"
                                        onclick="window.Global.ColorPicker.instances.get('${this.componentId}').setColor('${color}')"
                                        title="${color}"
                                        aria-label="Select color ${color}"></button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render gradient picker
     */
    renderGradientPicker() {
        return `
            <div class="cp-gradient">
                <div class="cp-gradient-preview" id="${this.componentId}-gradient-preview"
                     style="background: linear-gradient(${this.config.gradientDirection}, 
                         ${this.state.gradientStops.map(s => `${s.color} ${s.position}%`).join(', ')});">
                </div>
                <div class="cp-gradient-stops" id="${this.componentId}-gradient-stops">
                    ${this.state.gradientStops.map((stop, index) => `
                        <div class="cp-gradient-stop ${index === this.state.selectedStopIndex ? 'active' : ''}"
                             style="left: ${stop.position}%;"
                             data-index="${index}"
                             onclick="window.Global.ColorPicker.instances.get('${this.componentId}').selectGradientStop(${index})">
                            <div class="cp-gradient-stop-color" style="background: ${stop.color};"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="cp-gradient-actions">
                    <button class="btn btn-sm btn-outline" onclick="window.Global.ColorPicker.instances.get('${this.componentId}').addGradientStop()">
                        <i class="fas fa-plus"></i> Add Stop
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="window.Global.ColorPicker.instances.get('${this.componentId}').removeGradientStop()"
                            ${this.state.gradientStops.length <= 2 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render input fields
     */
    renderInputFields() {
        return `
            <div class="cp-inputs">
                <div class="cp-input-row">
                    <div class="cp-input-group">
                        <label class="cp-input-label">HEX</label>
                        <input type="text" class="cp-hex-input" id="${this.componentId}-hex-input"
                               value="${this.getColor('hex')}" 
                               onchange="window.Global.ColorPicker.instances.get('${this.componentId}').setColor(this.value)"
                               spellcheck="false">
                    </div>
                    <button class="cp-format-toggle" id="${this.componentId}-format-toggle"
                            onclick="window.Global.ColorPicker.instances.get('${this.componentId}').toggleFormat()"
                            title="Toggle format">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </div>
                ${this.state.format === 'rgb' || this.state.format === 'rgba' ? `
                    <div class="cp-input-row cp-rgb-inputs">
                        <div class="cp-input-group"><label>R</label>
                            <input type="number" value="${this.state.color.r}" min="0" max="255" 
                                   onchange="window.Global.ColorPicker.instances.get('${this.componentId}').setColor(\`rgb(\${document.getElementById('cp-r').value},\${document.getElementById('cp-g').value},\${document.getElementById('cp-b').value})\`)"></div>
                        <div class="cp-input-group"><label>G</label>
                            <input type="number" value="${this.state.color.g}" min="0" max="255"></div>
                        <div class="cp-input-group"><label>B</label>
                            <input type="number" value="${this.state.color.b}" min="0" max="255"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render accessibility checker
     */
    renderAccessibilityCheck() {
        const contrast = this.checkContrast(this.getColor('hex'));
        
        return `
            <div class="cp-accessibility">
                <div class="cp-contrast-info">
                    <span>Contrast Ratio: <strong>${contrast.ratio}:1</strong></span>
                    <span class="cp-contrast-badge ${contrast.pass ? 'pass' : 'fail'}">
                        ${contrast.pass ? `✓ WCAG ${this.config.wcagLevel}` : `✗ WCAG ${this.config.wcagLevel}`}
                    </span>
                </div>
                <div class="cp-contrast-preview" style="background: #FFFFFF;">
                    <span style="color: ${this.getColor('hex')};">Sample Text Preview</span>
                </div>
            </div>
        `;
    }

    /**
     * Render color history
     */
    renderHistory() {
        if (this.state.history.length === 0) return '';

        return `
            <div class="cp-history">
                <div class="cp-history-label">Recently Used</div>
                <div class="cp-history-grid">
                    ${this.state.history.slice(0, 12).map(color => `
                        <button class="cp-history-btn ${this.getColor('hex').toUpperCase() === color.toUpperCase() ? 'active' : ''}"
                                style="background: ${color};"
                                onclick="window.Global.ColorPicker.instances.get('${this.componentId}').setColor('${color}')"
                                title="${color}"
                                aria-label="Select recent color ${color}"></button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render action buttons
     */
    renderActions() {
        return `
            <div class="cp-actions">
                ${this.config.showClear ? `
                    <button class="btn btn-sm btn-outline cp-clear-btn" id="${this.componentId}-clear-btn">
                        ${this.config.clearLabel}
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-secondary cp-cancel-btn" id="${this.componentId}-cancel-btn">
                    Cancel
                </button>
                <button class="btn btn-sm btn-primary cp-confirm-btn" id="${this.componentId}-confirm-btn">
                    Confirm
                </button>
            </div>
        `;
    }

    /**
     * Cache DOM elements after render
     */
    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.trigger = document.getElementById(`${this.componentId}-trigger`);
        this.elements.preview = document.getElementById(`${this.componentId}-preview`);
        this.elements.panel = document.getElementById(`${this.componentId}-panel`);
        this.elements.spectrum = document.getElementById(`${this.componentId}-spectrum-canvas`);
        this.elements.spectrumCursor = document.getElementById(`${this.componentId}-spectrum-cursor`);
        this.elements.hueSlider = document.getElementById(`${this.componentId}-hue-canvas`);
        this.elements.hueCursor = document.getElementById(`${this.componentId}-hue-cursor`);
        this.elements.alphaSlider = document.getElementById(`${this.componentId}-alpha-canvas`);
        this.elements.alphaCursor = document.getElementById(`${this.componentId}-alpha-cursor`);
        this.elements.colorInput = document.getElementById(`${this.componentId}-hex-input`);
        this.elements.confirmBtn = document.getElementById(`${this.componentId}-confirm-btn`);
        this.elements.cancelBtn = document.getElementById(`${this.componentId}-cancel-btn`);
        this.elements.clearBtn = document.getElementById(`${this.componentId}-clear-btn`);
        
        // Draw canvases after caching
        this.drawSpectrumCanvas();
        this.drawHueCanvas();
        if (this.config.enableAlpha) this.drawAlphaCanvas();
    }

    /**
     * Draw spectrum canvas
     */
    drawSpectrumCanvas() {
        const canvas = this.elements.spectrum;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = this.config.spectrumWidth;
        const height = this.config.spectrumHeight;

        // Draw white-to-color gradient (horizontal)
        const gradientH = ctx.createLinearGradient(0, 0, width, 0);
        gradientH.addColorStop(0, '#FFFFFF');
        gradientH.addColorStop(1, `hsl(${this.state.hue}, 100%, 50%)`);
        ctx.fillStyle = gradientH;
        ctx.fillRect(0, 0, width, height);

        // Draw black-to-transparent gradient (vertical)
        const gradientV = ctx.createLinearGradient(0, 0, 0, height);
        gradientV.addColorStop(0, 'rgba(0,0,0,0)');
        gradientV.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gradientV;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Draw hue canvas
     */
    drawHueCanvas() {
        const canvas = this.elements.hueSlider;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = this.config.hueWidth;
        const height = this.config.hueHeight;

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        for (let i = 0; i <= 360; i += 30) {
            gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Draw alpha canvas
     */
    drawAlphaCanvas() {
        const canvas = this.elements.alphaSlider;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = this.config.alphaWidth;
        const height = this.config.alphaHeight;

        // Checkerboard pattern for transparency
        const checkerSize = 6;
        for (let y = 0; y < height; y += checkerSize) {
            for (let x = 0; x < width; x += checkerSize) {
                ctx.fillStyle = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0 ? '#FFFFFF' : '#CCCCCC';
                ctx.fillRect(x, y, checkerSize, checkerSize);
            }
        }

        // Alpha gradient
        const rgbColor = `rgb(${this.state.color.r}, ${this.state.color.g}, ${this.state.color.b})`;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, rgbColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        // Update preview
        if (this.elements.preview) {
            this.elements.preview.style.background = this.getColor('rgba');
        }

        // Update value text
        const valueText = document.getElementById(`${this.componentId}-value-text`);
        if (valueText) {
            valueText.textContent = this.state.inputValue;
        }

        // Update hex input
        if (this.elements.colorInput) {
            this.elements.colorInput.value = this.getColor('hex');
        }

        // Update spectrum cursor position
        if (this.elements.spectrumCursor) {
            this.elements.spectrumCursor.style.left = `${this.state.saturation * this.config.spectrumWidth / 100}px`;
            this.elements.spectrumCursor.style.top = `${(100 - this.state.lightness) * this.config.spectrumHeight / 100}px`;
        }

        // Update hue cursor
        if (this.elements.hueCursor) {
            this.elements.hueCursor.style.top = `${this.state.hue * this.config.hueHeight / 360}px`;
        }

        // Update alpha cursor
        if (this.elements.alphaCursor && this.config.enableAlpha) {
            this.elements.alphaCursor.style.top = `${(1 - this.state.alpha) * this.config.alphaHeight}px`;
        }

        // Redraw canvases
        this.drawSpectrumCanvas();
        if (this.config.enableAlpha) this.drawAlphaCanvas();
    }

    /**
     * Set up all event handlers
     */
    setupEventHandlers() {
        try {
            // Trigger click
            if (this.elements.trigger) {
                this.elements.trigger.addEventListener('click', () => this.toggle());
            }

            // Spectrum canvas mouse events
            if (this.elements.spectrum) {
                this.elements.spectrum.addEventListener('mousedown', (e) => {
                    this.state.isDragging = true;
                    this.handleSpectrumMouse(e);
                });
            }

            // Hue canvas mouse events
            if (this.elements.hueSlider) {
                this.elements.hueSlider.addEventListener('mousedown', (e) => {
                    this.state.isDragging = true;
                    this.handleHueMouse(e);
                });
            }

            // Alpha canvas mouse events
            if (this.elements.alphaSlider) {
                this.elements.alphaSlider.addEventListener('mousedown', (e) => {
                    this.state.isDragging = true;
                    this.handleAlphaMouse(e);
                });
            }

            // Global mouse events for drag
            document.addEventListener('mousemove', (e) => {
                if (!this.state.isDragging) return;

                const spectrumRect = this.elements.spectrum?.getBoundingClientRect();
                const hueRect = this.elements.hueSlider?.getBoundingClientRect();
                const alphaRect = this.elements.alphaSlider?.getBoundingClientRect();

                if (spectrumRect && this.isInsideRect(e, spectrumRect)) {
                    this.handleSpectrumMouse(e);
                } else if (hueRect && this.isInsideRect(e, hueRect)) {
                    this.handleHueMouse(e);
                } else if (alphaRect && this.isInsideRect(e, alphaRect)) {
                    this.handleAlphaMouse(e);
                }
            });

            document.addEventListener('mouseup', () => {
                this.state.isDragging = false;
            });

            // Confirm button
            if (this.elements.confirmBtn) {
                this.elements.confirmBtn.addEventListener('click', () => {
                    this.confirm();
                });
            }

            // Cancel button
            if (this.elements.cancelBtn) {
                this.elements.cancelBtn.addEventListener('click', () => {
                    this.cancel();
                });
            }

            // Clear button
            if (this.elements.clearBtn) {
                this.elements.clearBtn.addEventListener('click', () => {
                    this.clear();
                });
            }

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (this.state.isOpen && !this.config.inline &&
                    !this.container.contains(e.target)) {
                    this.close();
                }
            });

            // Keyboard events
            document.addEventListener('keydown', (e) => {
                if (!this.state.isOpen) return;
                if (e.key === 'Escape') {
                    this.close();
                }
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.confirm();
                }
            });

            console.log('[ColorPicker] Event handlers set up');
        } catch (error) {
            console.error('[ColorPicker] Event handler setup failed:', error);
        }
    }

    /**
     * Handle spectrum mouse interaction
     */
    handleSpectrumMouse(e) {
        const rect = this.elements.spectrum.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.updateColorFromSpectrum(x, y, rect.width, rect.height);
    }

    /**
     * Handle hue slider mouse interaction
     */
    handleHueMouse(e) {
        const rect = this.elements.hueSlider.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        this.updateColorFromHue(y, rect.height);
    }

    /**
     * Handle alpha slider mouse interaction
     */
    handleAlphaMouse(e) {
        const rect = this.elements.alphaSlider.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        this.updateAlpha(y, rect.height);
    }

    /**
     * Check if point is inside rectangle
     */
    isInsideRect(e, rect) {
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    /**
     * Switch active picker type
     */
    switchPicker(picker) {
        this.state.activePicker = picker;
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
    }

    /**
     * Toggle format between HEX, RGB, HSL
     */
    toggleFormat() {
        const formats = ['hex', 'rgb', 'hsl'];
        const currentIndex = formats.indexOf(this.state.format);
        this.state.format = formats[(currentIndex + 1) % formats.length];
        this.state.inputValue = this.getColor(this.state.format);
        
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
        
        if (this.config.onFormatChange) {
            this.config.onFormatChange(this.state.format);
        }
    }

    /**
     * Gradient stop management
     */
    selectGradientStop(index) {
        this.state.selectedStopIndex = index;
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
    }

    addGradientStop() {
        const lastStop = this.state.gradientStops[this.state.gradientStops.length - 1];
        const newPosition = Math.min((lastStop.position + 10), 100);
        
        this.state.gradientStops.push({
            color: '#808080',
            position: newPosition
        });
        
        this.state.gradientStops.sort((a, b) => a.position - b.position);
        this.state.selectedStopIndex = this.state.gradientStops.length - 1;
        
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
    }

    removeGradientStop() {
        if (this.state.gradientStops.length <= 2) return;
        
        this.state.gradientStops.splice(this.state.selectedStopIndex, 1);
        this.state.selectedStopIndex = Math.max(0, this.state.selectedStopIndex - 1);
        
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
    }

    /**
     * Open/close toggle
     */
    toggle() {
        if (this.state.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.state.isOpen = true;
        this.state.color = this.parseColor(this.config.value);
        this.extractHSL(this.state.color);
        
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
        this.updateUI();
    }

    close() {
        this.state.isOpen = false;
        this.render();
        this.cacheElements();
        this.setupEventHandlers();
    }

    /**
     * Confirm color selection
     */
    confirm() {
        const colorValue = this.getColor(this.state.format);
        const colorObject = this.getColor('object');
        
        this.addToHistory(colorObject.hex);
        
        if (this.config.onConfirm) {
            this.config.onConfirm(colorValue, colorObject);
        }
        
        EventBus.emit('colorpicker:confirmed', {
            componentId: this.componentId,
            value: colorValue,
            color: colorObject
        });
        
        this.close();
    }

    /**
     * Cancel color selection
     */
    cancel() {
        this.setColor(this.config.value);
        
        if (this.config.onCancel) {
            this.config.onCancel();
        }
        
        this.close();
    }

    /**
     * Clear color
     */
    clear() {
        this.setColor('transparent');
        
        if (this.config.onClear) {
            this.config.onClear();
        }
        
        this.close();
    }

    /**
     * Escape HTML helper
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Destroy component
     */
    destroy() {
        this.close();
        if (this.container) this.container.innerHTML = '';
        console.log('[ColorPicker] Component destroyed');
    }

    /**
     * Static factory method
     */
    static create(container, options) {
        const instance = new ColorPicker(container, options);
        
        if (!window.Global?.ColorPicker?.instances) {
            if (!window.Global) window.Global = {};
            if (!window.Global.ColorPicker) window.Global.ColorPicker = {};
            if (!window.Global.ColorPicker.instances) window.Global.ColorPicker.instances = new Map();
        }
        
        window.Global.ColorPicker.instances.set(instance.componentId, instance);
        return instance;
    }
}

// Export
export { ColorPicker };
export default ColorPicker;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.ColorPicker = window.Global.ColorPicker || {};
    window.Global.ColorPicker.instances = window.Global.ColorPicker.instances || new Map();
    window.Global.ColorPicker.ColorPicker = ColorPicker;
}
