/**
 * 11 AVATAR DIGITAL HUB - Chart Component
 * Enterprise-grade reusable charting & visualization component
 * Multi-type charts, real-time updates, animations, exports, responsive
 * 
 * @component Chart
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Formatters } from '../utils/formatters.js';

/**
 * Chart - Universal charting component with multiple renderers
 * Supports: Chart.js, fallback SVG rendering, real-time data
 */
class ChartComponent {
    constructor(container, options = {}) {
        // Component identity
        this.componentName = 'Chart';
        this.componentId = `chart-${Date.now().toString(36)}`;
        
        // Container
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('Chart: Container element not found');
        }
        
        // Configuration
        this.config = {
            // Chart type
            type: options.type || 'bar',
            
            // Data
            labels: options.labels || [],
            datasets: options.datasets || [],
            
            // Display options
            title: options.title || '',
            subtitle: options.subtitle || '',
            height: options.height || 400,
            width: options.width || '100%',
            
            // Chart options
            responsive: options.responsive !== false,
            maintainAspectRatio: options.maintainAspectRatio !== false,
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 1000,
            
            // Styling
            theme: options.theme || 'light',
            colors: options.colors || this.getDefaultColors(),
            backgroundColor: options.backgroundColor || 'transparent',
            
            // Axes
            xAxis: options.xAxis || {},
            yAxis: options.yAxis || {},
            showGrid: options.showGrid !== false,
            showLegend: options.showLegend !== false,
            legendPosition: options.legendPosition || 'top',
            
            // Tooltips
            showTooltips: options.showTooltips !== false,
            tooltipFormat: options.tooltipFormat || null,
            
            // Data labels
            showDataLabels: options.showDataLabels || false,
            dataLabelFormat: options.dataLabelFormat || null,
            
            // Interactivity
            onClick: options.onClick || null,
            onHover: options.onHover || null,
            
            // Export
            exportable: options.exportable !== false,
            
            // Real-time
            realtime: options.realtime || false,
            updateInterval: options.updateInterval || 5000,
            maxDataPoints: options.maxDataPoints || 50,
            
            // Fallback
            useFallback: options.useFallback || false
        };
        
        // Internal state
        this.chartInstance = null;
        this.fallbackRenderer = null;
        this.realtimeInterval = null;
        this.isRendered = false;
        this.isDestroyed = false;
        
        // Performance
        this.performance = {
            renderTime: 0,
            dataPoints: 0,
            lastUpdate: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize chart
     */
    init() {
        try {
            console.log(`[Chart] Initializing: ${this.componentId}`);
            
            // Check if Chart.js is available
            if (typeof Chart !== 'undefined' && !this.config.useFallback) {
                this.renderWithChartJS();
            } else {
                this.renderFallback();
            }
            
            // Set up real-time updates
            if (this.config.realtime) {
                this.startRealtimeUpdates();
            }
            
        } catch (error) {
            console.error('[Chart] Initialization failed:', error);
            this.container.innerHTML = `<div class="chart-error">Failed to render chart: ${error.message}</div>`;
        }
    }
    
    /**
     * Render using Chart.js library
     */
    renderWithChartJS() {
        try {
            const startTime = performance.now();
            
            // Create canvas
            const canvasId = `${this.componentId}-canvas`;
            this.container.innerHTML = `
                <div class="chart-wrapper" style="position: relative; height: ${this.config.height}px; width: ${this.config.width};">
                    ${this.config.title ? `
                        <div class="chart-header">
                            <h4 class="chart-title">${this.escapeHtml(this.config.title)}</h4>
                            ${this.config.subtitle ? `<p class="chart-subtitle">${this.escapeHtml(this.config.subtitle)}</p>` : ''}
                        </div>
                    ` : ''}
                    <canvas id="${canvasId}" 
                            role="img" 
                            aria-label="${this.config.title || 'Chart'}"></canvas>
                    ${this.config.exportable ? this.renderExportButton() : ''}
                </div>
            `;
            
            // Get canvas context
            const canvas = document.getElementById(canvasId);
            if (!canvas) throw new Error('Canvas element not found');
            
            const ctx = canvas.getContext('2d');
            
            // Build Chart.js config
            const chartConfig = this.buildChartJSConfig();
            
            // Create chart
            this.chartInstance = new Chart(ctx, chartConfig);
            this.isRendered = true;
            
            this.performance.renderTime = performance.now() - startTime;
            this.performance.dataPoints = this.countDataPoints();
            this.performance.lastUpdate = new Date();
            
            console.log(`[Chart] Rendered with Chart.js in ${this.performance.renderTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('[Chart] Chart.js render failed:', error);
            this.renderFallback();
        }
    }
    
    /**
     * Build Chart.js configuration
     */
    buildChartJSConfig() {
        const isDark = this.config.theme === 'dark';
        const textColor = isDark ? '#FFFFFF' : '#333333';
        const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        
        return {
            type: this.config.type,
            data: {
                labels: this.config.labels,
                datasets: this.config.datasets.map((ds, index) => ({
                    label: ds.label || `Dataset ${index + 1}`,
                    data: ds.data || [],
                    backgroundColor: ds.backgroundColor || this.config.colors[index % this.config.colors.length],
                    borderColor: ds.borderColor || this.config.colors[index % this.config.colors.length],
                    borderWidth: ds.borderWidth || 2,
                    borderRadius: ds.borderRadius || 4,
                    fill: ds.fill || false,
                    tension: ds.tension || 0.4,
                    pointRadius: ds.pointRadius || 3,
                    pointHoverRadius: ds.pointHoverRadius || 5,
                    pointBackgroundColor: ds.pointColor || this.config.colors[index % this.config.colors.length]
                }))
            },
            options: {
                responsive: this.config.responsive,
                maintainAspectRatio: this.config.maintainAspectRatio,
                animation: this.config.animation ? {
                    duration: this.config.animationDuration,
                    easing: 'easeInOutQuart'
                } : false,
                
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                
                plugins: {
                    legend: {
                        display: this.config.showLegend,
                        position: this.config.legendPosition,
                        labels: {
                            color: textColor,
                            padding: 20,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                            font: {
                                size: 12,
                                family: "'Inter', sans-serif"
                            }
                        }
                    },
                    
                    tooltip: {
                        enabled: this.config.showTooltips,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
                        titleColor: isDark ? '#FFFFFF' : '#333333',
                        bodyColor: isDark ? '#CCCCCC' : '#666666',
                        borderColor: isDark ? '#333' : '#E5E7EB',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                if (this.config.tooltipFormat) {
                                    return this.config.tooltipFormat(context);
                                }
                                const value = context.parsed.y;
                                const label = context.dataset.label || '';
                                return `${label}: ${Formatters.currency(value)}`;
                            }
                        }
                    },
                    
                    datalabels: this.config.showDataLabels ? {
                        display: true,
                        color: textColor,
                        anchor: 'end',
                        align: 'top',
                        font: {
                            size: 10,
                            weight: 'bold'
                        },
                        formatter: (value) => {
                            if (this.config.dataLabelFormat) {
                                return this.config.dataLabelFormat(value);
                            }
                            return Formatters.currency(value);
                        }
                    } : false
                },
                
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: this.config.showGrid,
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            ...this.config.xAxis
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            display: this.config.showGrid,
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            callback: (value) => Formatters.currency(value),
                            ...this.config.yAxis
                        }
                    }
                },
                
                onClick: this.config.onClick ? (event, elements) => {
                    if (elements.length > 0 && this.config.onClick) {
                        this.config.onClick(elements[0], event);
                    }
                } : undefined,
                
                onHover: this.config.onHover ? (event, elements) => {
                    if (this.config.onHover) {
                        this.config.onHover(elements, event);
                    }
                } : undefined
            },
            
            plugins: this.config.showDataLabels && typeof ChartDataLabels !== 'undefined' ? 
                [ChartDataLabels] : []
        };
    }
    
    /**
     * Render fallback chart using SVG (no Chart.js dependency)
     */
    renderFallback() {
        try {
            const startTime = performance.now();
            
            const { labels, datasets } = this.config;
            const height = this.config.height;
            const width = 600;
            const padding = { top: 40, right: 30, bottom: 60, left: 80 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            
            // Calculate max value
            const allValues = datasets.flatMap(ds => ds.data || []);
            const maxValue = Math.max(...allValues, 1);
            
            // Build SVG
            let svgContent = '';
            
            // Draw grid lines
            const gridLines = 5;
            for (let i = 0; i <= gridLines; i++) {
                const y = padding.top + (chartHeight / gridLines) * i;
                const value = maxValue - (maxValue / gridLines) * i;
                
                svgContent += `
                    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                          stroke="${this.config.theme === 'dark' ? '#333' : '#E5E7EB'}" stroke-width="1" stroke-dasharray="4,4"/>
                    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" 
                          fill="${this.config.theme === 'dark' ? '#999' : '#666'}" font-size="11">
                        ${Formatters.currency(value)}
                    </text>
                `;
            }
            
            // Draw bars/lines for each dataset
            const barWidth = Math.min(40, chartWidth / labels.length / datasets.length);
            const groupWidth = barWidth * datasets.length;
            const gap = (chartWidth / labels.length - groupWidth) / 2;
            
            labels.forEach((label, labelIndex) => {
                const x = padding.left + (chartWidth / labels.length) * labelIndex + gap;
                
                datasets.forEach((ds, dsIndex) => {
                    const value = ds.data?.[labelIndex] || 0;
                    const barHeight = (value / maxValue) * chartHeight;
                    const barX = x + dsIndex * barWidth;
                    const barY = padding.top + chartHeight - barHeight;
                    
                    svgContent += `
                        <rect x="${barX}" y="${barY}" width="${barWidth - 4}" height="${barHeight}" rx="4"
                              fill="${ds.backgroundColor || this.config.colors[dsIndex]}"
                              opacity="${this.isDragging ? '0.5' : '0.9'}"
                              class="chart-bar"
                              data-index="${labelIndex}"
                              data-dataset="${dsIndex}"
                              data-value="${value}">
                            <title>${label}: ${Formatters.currency(value)}</title>
                        </rect>
                    `;
                    
                    // Data labels
                    if (this.config.showDataLabels) {
                        svgContent += `
                            <text x="${barX + (barWidth - 4) / 2}" y="${barY - 5}" text-anchor="middle" 
                                  fill="${this.config.theme === 'dark' ? '#FFF' : '#333'}" font-size="9" font-weight="bold">
                                ${Formatters.currency(value)}
                            </text>
                        `;
                    }
                });
                
                // X-axis labels
                svgContent += `
                    <text x="${x + groupWidth / 2}" y="${padding.top + chartHeight + 20}" text-anchor="middle" 
                          fill="${this.config.theme === 'dark' ? '#999' : '#666'}" font-size="11">
                        ${label}
                    </text>
                `;
            });
            
            // Build complete SVG
            const svg = `
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" 
                     class="chart-svg ${this.config.theme}">
                    <!-- Title -->
                    ${this.config.title ? `
                        <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold"
                              fill="${this.config.theme === 'dark' ? '#FFF' : '#333'}">
                            ${this.escapeHtml(this.config.title)}
                        </text>
                    ` : ''}
                    
                    <!-- Legend -->
                    ${this.config.showLegend ? datasets.map((ds, i) => {
                        const legendY = 45;
                        const legendX = width / 2 - (datasets.length * 100) / 2 + i * 100;
                        return `
                            <rect x="${legendX}" y="${legendY}" width="12" height="12" rx="2" 
                                  fill="${ds.backgroundColor || this.config.colors[i]}"/>
                            <text x="${legendX + 18}" y="${legendY + 11}" font-size="12" 
                                  fill="${this.config.theme === 'dark' ? '#CCC' : '#666'}">
                                ${this.escapeHtml(ds.label || `Dataset ${i + 1}`)}
                            </text>
                        `;
                    }).join('') : ''}
                    
                    ${svgContent}
                </svg>
            `;
            
            this.container.innerHTML = `
                <div class="chart-wrapper" style="height: ${height}px; width: ${this.config.width}; overflow-x: auto;">
                    ${svg}
                    ${this.config.exportable ? this.renderExportButton() : ''}
                </div>
            `;
            
            this.fallbackRenderer = this.container.querySelector('svg');
            this.isRendered = true;
            
            this.performance.renderTime = performance.now() - startTime;
            this.performance.lastUpdate = new Date();
            
            console.log(`[Chart] Rendered fallback SVG in ${this.performance.renderTime.toFixed(2)}ms`);
            
            // Add interaction handlers
            this.setupFallbackInteractions();
            
        } catch (error) {
            console.error('[Chart] Fallback render failed:', error);
            this.container.innerHTML = '<div class="chart-error">Failed to render chart</div>';
        }
    }
    
    /**
     * Set up interactions on fallback SVG
     */
    setupFallbackInteractions() {
        try {
            const bars = this.container.querySelectorAll('.chart-bar');
            
            bars.forEach(bar => {
                bar.addEventListener('click', () => {
                    if (this.config.onClick) {
                        const index = parseInt(bar.dataset.index);
                        const datasetIndex = parseInt(bar.dataset.dataset);
                        this.config.onClick({ index, datasetIndex, value: parseFloat(bar.dataset.value) });
                    }
                });
                
                bar.addEventListener('mouseenter', () => {
                    bar.setAttribute('opacity', '1');
                    bar.setAttribute('stroke', '#333');
                    bar.setAttribute('stroke-width', '2');
                });
                
                bar.addEventListener('mouseleave', () => {
                    bar.setAttribute('opacity', '0.9');
                    bar.setAttribute('stroke', 'none');
                });
            });
            
        } catch (error) {
            console.error('[Chart] Fallback interactions failed:', error);
        }
    }
    
    /**
     * Render export button
     */
    renderExportButton() {
        return `
            <div class="chart-export-btn">
                <button class="btn btn-sm btn-outline" onclick="window.Global.Chart.getInstance('${this.componentId}').exportChart('png')"
                        title="Download as PNG">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
    }
    
    /**
     * Start real-time updates
     */
    startRealtimeUpdates() {
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
        }
        
        this.realtimeInterval = setInterval(() => {
            // Shift data points if max reached
            if (this.config.labels.length >= this.config.maxDataPoints) {
                this.config.labels.shift();
                this.config.datasets.forEach(ds => {
                    if (ds.data) ds.data.shift();
                });
            }
            
            // Emit event for new data
            EventBus.emit('chart:request-data', {
                componentId: this.componentId,
                callback: (newData) => {
                    if (newData) {
                        this.addDataPoint(newData.label, newData.values);
                    }
                }
            });
            
        }, this.config.updateInterval);
        
        console.log('[Chart] Real-time updates started');
    }
    
    /**
     * Add a data point
     */
    addDataPoint(label, values) {
        try {
            this.config.labels.push(label);
            
            this.config.datasets.forEach((ds, index) => {
                if (!ds.data) ds.data = [];
                ds.data.push(values[index] || 0);
            });
            
            this.update();
            
        } catch (error) {
            console.error('[Chart] Add data point failed:', error);
        }
    }
    
    /**
     * Update chart with new data
     */
    update(newConfig = null) {
        try {
            if (newConfig) {
                if (newConfig.labels) this.config.labels = newConfig.labels;
                if (newConfig.datasets) this.config.datasets = newConfig.datasets;
                if (newConfig.title) this.config.title = newConfig.title;
            }
            
            if (this.chartInstance) {
                // Update Chart.js instance
                this.chartInstance.data.labels = this.config.labels;
                this.chartInstance.data.datasets = this.config.datasets.map((ds, index) => ({
                    ...this.chartInstance.data.datasets[index],
                    data: ds.data || [],
                    label: ds.label || `Dataset ${index + 1}`
                }));
                
                this.chartInstance.update(this.config.animation ? 'active' : 'none');
            } else if (this.fallbackRenderer) {
                // Re-render fallback
                this.renderFallback();
            }
            
            this.performance.dataPoints = this.countDataPoints();
            this.performance.lastUpdate = new Date();
            
        } catch (error) {
            console.error('[Chart] Update failed:', error);
        }
    }
    
    /**
     * Export chart as image
     */
    exportChart(format = 'png') {
        try {
            let dataUrl;
            
            if (this.chartInstance) {
                dataUrl = this.chartInstance.toBase64Image(`image/${format}`, 1.0);
            } else if (this.fallbackRenderer) {
                // SVG to data URL
                const svgString = new XMLSerializer().serializeToString(this.fallbackRenderer);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                dataUrl = URL.createObjectURL(blob);
            }
            
            if (dataUrl) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `chart-${Date.now()}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
        } catch (error) {
            console.error('[Chart] Export failed:', error);
        }
    }
    
    /**
     * Count total data points
     */
    countDataPoints() {
        return this.config.datasets.reduce((total, ds) => {
            return total + (ds.data?.length || 0);
        }, 0);
    }
    
    /**
     * Get default colors
     */
    getDefaultColors() {
        return [
            '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
            '#EC4899', '#14B8A6', '#F97316', '#6366F1',
            '#06B6D4', '#84CC16', '#EF4444', '#8B5CF6',
            '#D4AF37', '#FF6B6B', '#4ECDC4', '#45B7D1'
        ];
    }
    
    /**
     * Get default colors for dark theme
     */
    getDarkColors() {
        return [
            '#60A5FA', '#34D399', '#FBBF24', '#A78BFA',
            '#F472B6', '#2DD4BF', '#FB923C', '#818CF8'
        ];
    }
    
    /**
     * Destroy component
     */
    destroy() {
        try {
            // Destroy Chart.js instance
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
            
            // Clear real-time interval
            if (this.realtimeInterval) {
                clearInterval(this.realtimeInterval);
                this.realtimeInterval = null;
            }
            
            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }
            
            this.isDestroyed = true;
            this.isRendered = false;
            
            console.log('[Chart] Component destroyed');
            
        } catch (error) {
            console.error('[Chart] Destroy failed:', error);
        }
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Static helper - Create chart quickly
     */
    static create(container, config) {
        return new ChartComponent(container, config);
    }
    
    /**
     * Get instance by ID
     */
    static getInstance(componentId) {
        return window.Global?.Chart?.instances?.get(componentId);
    }
}

// Export
export { ChartComponent };
export default ChartComponent;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Chart = window.Global.Chart || {};
    window.Global.Chart.instances = window.Global.Chart.instances || new Map();
    window.Global.Chart.ChartComponent = ChartComponent;
}


