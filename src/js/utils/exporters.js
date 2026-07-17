/**
 * 11 AVATAR DIGITAL HUB - Export Utilities
 * Enterprise-grade data export engine
 * CSV, Excel, PDF, JSON export with formatting, scheduling, bulk operations
 * 
 * @module Exporters
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Formatters } from './formatters.js';
import { Validators } from './validators.js';
import { Toast } from '../components/toast.js';

/**
 * Export Utilities - Handles all data export operations
 * Supports multiple formats with formatting, compression, and scheduling
 */
class ExportersUtil {
    constructor() {
        // Module identity
        this.moduleName = 'exporters';
        
        // Export format configurations
        this.formats = {
            csv: {
                extension: '.csv',
                mimeType: 'text/csv',
                label: 'CSV',
                icon: 'fa-file-csv',
                color: '#10B981',
                delimiter: ',',
                encoding: 'utf-8',
                includeBOM: true,
                maxRows: 1000000,
                supportsFormatting: false
            },
            excel: {
                extension: '.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                label: 'Excel',
                icon: 'fa-file-excel',
                color: '#059669',
                maxRows: 1048576,
                supportsFormatting: true,
                supportsMultipleSheets: true
            },
            pdf: {
                extension: '.pdf',
                mimeType: 'application/pdf',
                label: 'PDF',
                icon: 'fa-file-pdf',
                color: '#DC2626',
                supportsFormatting: true,
                pageSize: 'A4',
                orientation: 'landscape',
                supportsCharts: true
            },
            json: {
                extension: '.json',
                mimeType: 'application/json',
                label: 'JSON',
                icon: 'fa-code',
                color: '#6366F1',
                prettyPrint: true,
                maxRows: 500000
            }
        };
        
        // Export templates (pre-configured exports)
        this.templates = {
            'invoice_gst': {
                label: 'GST Invoice Export',
                fields: ['invoiceNumber', 'invoiceDate', 'clientName', 'clientGST', 'subtotal', 'cgst', 'sgst', 'igst', 'total'],
                format: 'excel',
                groupBy: 'month'
            },
            'payment_report': {
                label: 'Payment Collection Report',
                fields: ['paymentDate', 'invoiceNumber', 'clientName', 'amount', 'method', 'status', 'utr'],
                format: 'csv',
                groupBy: 'day'
            },
            'pipeline_analysis': {
                label: 'Pipeline Analysis',
                fields: ['dealName', 'stage', 'value', 'probability', 'owner', 'createdAt', 'expectedCloseDate'],
                format: 'excel',
                includeCharts: true
            },
            'client_statement': {
                label: 'Client Account Statement',
                fields: ['date', 'description', 'invoiceNumber', 'debit', 'credit', 'balance'],
                format: 'pdf',
                groupBy: 'client'
            },
            'task_summary': {
                label: 'Task Summary Report',
                fields: ['title', 'status', 'priority', 'assignee', 'dueDate', 'completedAt', 'timeSpent'],
                format: 'excel'
            },
            'revenue_report': {
                label: 'Revenue Analytics',
                fields: ['month', 'revenue', 'expenses', 'profit', 'margin'],
                format: 'excel',
                includeCharts: true
            }
        };
        
        // Export history
        this.exportHistory = [];
        this.maxHistoryItems = 50;
        
        // Active exports
        this.activeExports = new Map();
        
        // Performance metrics
        this.metrics = {
            totalExports: 0,
            totalRows: 0,
            totalSize: 0,
            averageTime: 0,
            lastExport: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize exporters
     */
    async init() {
        try {
            console.log('[Exporters] Initializing export utilities...');
            
            // Load export history from cache
            await this.loadExportHistory();
            
            // Set up event listeners
            this.setupEventListeners();
            
            console.log('[Exporters] Export utilities ready');
            
        } catch (error) {
            console.error('[Exporters] Initialization failed:', error);
        }
    }
    
    /**
     * Load export history from cache
     */
    async loadExportHistory() {
        try {
            const cached = await Cache.get('export_history');
            if (cached && cached.data) {
                this.exportHistory = cached.data.slice(0, this.maxHistoryItems);
            }
        } catch (error) {
            console.error('[Exporters] History load failed:', error);
        }
    }
    
    /**
     * Save export history
     */
    async saveExportHistory() {
        try {
            if (this.exportHistory.length > this.maxHistoryItems) {
                this.exportHistory = this.exportHistory.slice(0, this.maxHistoryItems);
            }
            await Cache.set('export_history', this.exportHistory, 86400000); // 24 hours
        } catch (error) {
            console.error('[Exporters] History save failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('export:csv', this.exportCSV.bind(this));
            EventBus.on('export:excel', this.exportExcel.bind(this));
            EventBus.on('export:pdf', this.exportPDF.bind(this));
            EventBus.on('export:json', this.exportJSON.bind(this));
            EventBus.on('export:template', this.exportWithTemplate.bind(this));
            EventBus.on('export:bulk', this.bulkExport.bind(this));
            
            console.log('[Exporters] Event listeners initialized');
            
        } catch (error) {
            console.error('[Exporters] Event listener setup failed:', error);
        }
    }
    
    /**
     * Export data to CSV format
     */
    async exportCSV(data, options = {}) {
        try {
            const startTime = performance.now();
            
            // Validate data
            if (!data || (Array.isArray(data) && data.length === 0)) {
                Toast.show('No data to export', 'warning');
                return null;
            }
            
            const config = {
                filename: options.filename || `export-${Date.now()}`,
                delimiter: options.delimiter || this.formats.csv.delimiter,
                includeHeaders: options.includeHeaders !== false,
                includeBOM: options.includeBOM !== false,
                encoding: options.encoding || this.formats.csv.encoding,
                columns: options.columns || null,
                columnNames: options.columnNames || null,
                formatters: options.formatters || {}
            };
            
            // Convert data to rows
            const rows = this.normalizeData(data, config.columns);
            
            if (rows.length === 0) {
                Toast.show('No valid rows to export', 'warning');
                return null;
            }
            
            // Build CSV content
            let csvContent = '';
            
            // Add BOM for UTF-8
            if (config.includeBOM) {
                csvContent += '\uFEFF';
            }
            
            // Add headers
            if (config.includeHeaders) {
                const headers = config.columnNames || Object.keys(rows[0]);
                csvContent += headers.map(h => this.escapeCSVField(h, config.delimiter)).join(config.delimiter);
                csvContent += '\n';
            }
            
            // Add data rows
            rows.forEach(row => {
                const values = Object.values(row).map(value => {
                    const formatted = this.formatValueForExport(value, 'csv');
                    return this.escapeCSVField(formatted, config.delimiter);
                });
                csvContent += values.join(config.delimiter) + '\n';
            });
            
            // Create and download file
            const blob = new Blob([csvContent], { type: `${this.formats.csv.mimeType};charset=${config.encoding}` });
            this.downloadFile(blob, config.filename + this.formats.csv.extension);
            
            // Track metrics
            const exportTime = performance.now() - startTime;
            this.trackExport('csv', rows.length, blob.size, exportTime);
            
            Toast.show(`CSV exported: ${rows.length} rows`, 'success');
            
            return { success: true, rows: rows.length, size: blob.size, time: exportTime };
            
        } catch (error) {
            console.error('[Exporters] CSV export failed:', error);
            Toast.show('CSV export failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Export data to Excel format
     */
    async exportExcel(data, options = {}) {
        try {
            const startTime = performance.now();
            
            if (!data || (Array.isArray(data) && data.length === 0)) {
                Toast.show('No data to export', 'warning');
                return null;
            }
            
            const config = {
                filename: options.filename || `export-${Date.now()}`,
                sheetName: options.sheetName || 'Sheet1',
                includeHeaders: options.includeHeaders !== false,
                columns: options.columns || null,
                columnNames: options.columnNames || null,
                columnWidths: options.columnWidths || {},
                formatters: options.formatters || {},
                includeCharts: options.includeCharts || false,
                chartConfig: options.chartConfig || null,
                multipleSheets: options.multipleSheets || false,
                sheets: options.sheets || []
            };
            
            // Check if we have the Excel library
            if (typeof XLSX === 'undefined') {
                // Fallback: Use API endpoint for Excel generation
                return await this.exportExcelViaAPI(data, config);
            }
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            if (config.multipleSheets && config.sheets.length > 0) {
                // Multiple sheets
                config.sheets.forEach(sheet => {
                    const sheetData = this.normalizeData(sheet.data, sheet.columns);
                    const ws = XLSX.utils.json_to_sheet(sheetData, {
                        header: sheet.columns || Object.keys(sheetData[0] || {})
                    });
                    
                    // Set column widths
                    if (sheet.columnWidths) {
                        ws['!cols'] = Object.values(sheet.columnWidths).map(width => ({ width }));
                    }
                    
                    XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet');
                });
            } else {
                // Single sheet
                const rows = this.normalizeData(data, config.columns);
                const ws = XLSX.utils.json_to_sheet(rows, {
                    header: config.columns || Object.keys(rows[0] || {})
                });
                
                // Set column widths
                if (Object.keys(config.columnWidths).length > 0) {
                    ws['!cols'] = Object.values(config.columnWidths).map(width => ({ width }));
                }
                
                XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
            }
            
            // Generate Excel file
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: this.formats.excel.mimeType });
            
            this.downloadFile(blob, config.filename + this.formats.excel.extension);
            
            // Track
            const exportTime = performance.now() - startTime;
            const totalRows = config.multipleSheets ? 
                config.sheets.reduce((sum, s) => sum + (s.data?.length || 0), 0) : 
                data.length;
            
            this.trackExport('excel', totalRows, blob.size, exportTime);
            
            Toast.show(`Excel exported: ${totalRows} rows`, 'success');
            
            return { success: true, rows: totalRows, size: blob.size, time: exportTime };
            
        } catch (error) {
            console.error('[Exporters] Excel export failed:', error);
            Toast.show('Excel export failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Export Excel via API (fallback)
     */
    async exportExcelViaAPI(data, config) {
        try {
            const response = await API.post('/api/export/excel', {
                data: data,
                config: config
            }, { responseType: 'blob' });
            
            if (response.data) {
                this.downloadFile(response.data, config.filename + '.xlsx');
                Toast.show('Excel exported successfully', 'success');
                return { success: true };
            }
            
        } catch (error) {
            console.error('[Exporters] API Excel export failed:', error);
            throw error;
        }
    }
    
    /**
     * Export data to PDF format
     */
    async exportPDF(data, options = {}) {
        try {
            const startTime = performance.now();
            
            if (!data || (Array.isArray(data) && data.length === 0)) {
                Toast.show('No data to export', 'warning');
                return null;
            }
            
            const config = {
                filename: options.filename || `report-${Date.now()}`,
                title: options.title || 'Report',
                subtitle: options.subtitle || '',
                pageSize: options.pageSize || this.formats.pdf.pageSize,
                orientation: options.orientation || this.formats.pdf.orientation,
                includeHeaders: options.includeHeaders !== false,
                columns: options.columns || null,
                columnNames: options.columnNames || null,
                includeFooter: options.includeFooter !== false,
                footerText: options.footerText || 'Generated by 11 Avatar Digital Hub',
                includeLogo: options.includeLogo !== false,
                logoUrl: options.logoUrl || null,
                includePageNumbers: options.includePageNumbers !== false,
                includeTimestamp: options.includeTimestamp !== false,
                includeCharts: options.includeCharts || false,
                chartConfig: options.chartConfig || null,
                summary: options.summary || null,
                styles: options.styles || {}
            };
            
            // For PDF, use API endpoint which has full PDF generation capability
            const response = await API.post('/api/export/pdf', {
                data: this.normalizeData(data, config.columns),
                config: config
            }, { responseType: 'blob' });
            
            if (response.data) {
                this.downloadFile(response.data, config.filename + '.pdf');
                
                const exportTime = performance.now() - startTime;
                this.trackExport('pdf', data.length, response.data.size, exportTime);
                
                Toast.show('PDF exported successfully', 'success');
                return { success: true };
            }
            
        } catch (error) {
            console.error('[Exporters] PDF export failed:', error);
            
            // Fallback: Generate simple PDF-like HTML
            try {
                const htmlContent = this.generatePrintableHTML(data, options);
                const blob = new Blob([htmlContent], { type: 'text/html' });
                this.downloadFile(blob, (options.filename || 'report') + '.html');
                Toast.show('Report exported as HTML (PDF unavailable)', 'warning');
            } catch (fallbackError) {
                Toast.show('PDF export failed: ' + error.message, 'error');
            }
            
            return null;
        }
    }
    
    /**
     * Generate printable HTML as PDF fallback
     */
    generatePrintableHTML(data, options = {}) {
        const rows = this.normalizeData(data, options.columns);
        const headers = options.columnNames || Object.keys(rows[0] || {});
        const title = options.title || 'Report';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${this.escapeHtml(title)}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #0A0A0A; margin-bottom: 5px; }
                    .header p { color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #D4AF37; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${this.escapeHtml(title)}</h1>
                    <p>Generated: ${new Date().toLocaleString('en-IN')}</p>
                </div>
                <table>
                    <thead>
                        <tr>${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>${Object.values(row).map(v => `<td>${this.escapeHtml(String(v))}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Generated by 11 Avatar Digital Hub CRM</p>
                </div>
            </body>
            </html>
        `;
    }
    
    /**
     * Export data to JSON format
     */
    async exportJSON(data, options = {}) {
        try {
            const startTime = performance.now();
            
            if (!data) {
                Toast.show('No data to export', 'warning');
                return null;
            }
            
            const config = {
                filename: options.filename || `data-${Date.now()}`,
                prettyPrint: options.prettyPrint !== false,
                includeMetadata: options.includeMetadata !== false,
                metadata: options.metadata || {}
            };
            
            // Build JSON structure
            const exportData = {
                exportedAt: new Date().toISOString(),
                exportedBy: State.getCurrentUser()?.email || 'system',
                recordCount: Array.isArray(data) ? data.length : 1,
                ...config.metadata,
                data: data
            };
            
            // Convert to JSON string
            const jsonString = config.prettyPrint ? 
                JSON.stringify(exportData, null, 2) : 
                JSON.stringify(exportData);
            
            // Create blob
            const blob = new Blob([jsonString], { type: this.formats.json.mimeType });
            
            this.downloadFile(blob, config.filename + this.formats.json.extension);
            
            const exportTime = performance.now() - startTime;
            this.trackExport('json', exportData.recordCount, blob.size, exportTime);
            
            Toast.show(`JSON exported: ${exportData.recordCount} records`, 'success');
            
            return { success: true, records: exportData.recordCount, size: blob.size, time: exportTime };
            
        } catch (error) {
            console.error('[Exporters] JSON export failed:', error);
            Toast.show('JSON export failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Export using a predefined template
     */
    async exportWithTemplate(templateName, data, options = {}) {
        try {
            const template = this.templates[templateName];
            
            if (!template) {
                throw new Error(`Template "${templateName}" not found`);
            }
            
            const config = {
                ...options,
                columns: template.fields,
                format: template.format
            };
            
            if (template.includeCharts) {
                config.includeCharts = true;
            }
            
            switch (template.format) {
                case 'csv':
                    return await this.exportCSV(data, config);
                case 'excel':
                    return await this.exportExcel(data, config);
                case 'pdf':
                    return await this.exportPDF(data, config);
                case 'json':
                    return await this.exportJSON(data, config);
                default:
                    return await this.exportCSV(data, config);
            }
            
        } catch (error) {
            console.error('[Exporters] Template export failed:', error);
            Toast.show('Template export failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Bulk export multiple datasets
     */
    async bulkExport(datasets, options = {}) {
        try {
            const format = options.format || 'excel';
            const filename = options.filename || `bulk-export-${Date.now()}`;
            
            if (format === 'excel' && datasets.length > 1) {
                // Export as multiple sheets in single Excel
                const sheets = datasets.map((ds, index) => ({
                    name: ds.name || `Sheet${index + 1}`,
                    data: ds.data,
                    columns: ds.columns
                }));
                
                return await this.exportExcel(null, {
                    filename,
                    multipleSheets: true,
                    sheets
                });
            } else {
                // Export as ZIP if multiple datasets
                Toast.show('Bulk export with ZIP not yet implemented', 'info');
                
                // Export individually
                const results = [];
                for (const ds of datasets) {
                    const result = await this.exportCSV(ds.data, {
                        filename: `${filename}-${ds.name || 'data'}`,
                        columns: ds.columns
                    });
                    results.push(result);
                }
                
                return results;
            }
            
        } catch (error) {
            console.error('[Exporters] Bulk export failed:', error);
            Toast.show('Bulk export failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Normalize data to array of objects
     */
    normalizeData(data, columns = null) {
        try {
            // Already an array of objects
            if (Array.isArray(data)) {
                if (data.length === 0) return [];
                
                // If objects, filter columns if specified
                if (typeof data[0] === 'object' && data[0] !== null) {
                    if (columns && columns.length > 0) {
                        return data.map(row => {
                            const filtered = {};
                            columns.forEach(col => {
                                filtered[col] = row[col] !== undefined ? row[col] : '';
                            });
                            return filtered;
                        });
                    }
                    return data;
                }
                
                // If primitive array, wrap in objects
                return data.map((value, index) => ({ index: index + 1, value }));
            }
            
            // Single object
            if (typeof data === 'object' && data !== null) {
                return [data];
            }
            
            return [];
            
        } catch (error) {
            console.error('[Exporters] Data normalization failed:', error);
            return [];
        }
    }
    
    /**
     * Format value for export
     */
    formatValueForExport(value, format) {
        if (value === null || value === undefined) return '';
        
        if (value instanceof Date) {
            return Formatters.date(value);
        }
        
        if (typeof value === 'number') {
            if (format === 'csv') {
                return value.toString();
            }
            return value;
        }
        
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        
        return String(value);
    }
    
    /**
     * Escape CSV field
     */
    escapeCSVField(field, delimiter) {
        if (field === null || field === undefined) return '';
        
        const stringField = String(field);
        
        // If field contains delimiter, quotes, or newlines, wrap in quotes
        if (stringField.includes(delimiter) || 
            stringField.includes('"') || 
            stringField.includes('\n') || 
            stringField.includes('\r')) {
            return '"' + stringField.replace(/"/g, '""') + '"';
        }
        
        return stringField;
    }
    
    /**
     * Download file to user's device
     */
    downloadFile(blob, filename) {
        try {
            // Create download URL
            const url = window.URL.createObjectURL(blob);
            
            // Create temporary link
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`[Exporters] File downloaded: ${filename}`);
            
        } catch (error) {
            console.error('[Exporters] Download failed:', error);
            
            // Fallback: Open in new tab
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        }
    }
    
    /**
     * Track export metrics
     */
    trackExport(format, rows, size, time) {
        try {
            // Update metrics
            this.metrics.totalExports++;
            this.metrics.totalRows += rows;
            this.metrics.totalSize += size;
            this.metrics.averageTime = 
                ((this.metrics.averageTime * (this.metrics.totalExports - 1)) + time) / 
                this.metrics.totalExports;
            this.metrics.lastExport = new Date();
            
            // Add to history
            this.exportHistory.unshift({
                id: Date.now().toString(36),
                format,
                rows,
                size: this.formatFileSize(size),
                time: time.toFixed(0),
                timestamp: new Date().toISOString(),
                formattedTime: Formatters.relativeTime(new Date())
            });
            
            // Save history
            this.saveExportHistory();
            
        } catch (error) {
            console.error('[Exporters] Metrics tracking failed:', error);
        }
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    /**
     * Get export history
     */
    getExportHistory(limit = 10) {
        return this.exportHistory.slice(0, limit);
    }
    
    /**
     * Clear export history
     */
    async clearExportHistory() {
        this.exportHistory = [];
        await Cache.delete('export_history');
        Toast.show('Export history cleared', 'info');
    }
    
    /**
     * Get export templates
     */
    getTemplates() {
        return Object.entries(this.templates).map(([key, template]) => ({
            id: key,
            ...template
        }));
    }
    
    /**
     * Get metrics
     */
    getMetrics() {
        return { ...this.metrics };
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
     * Clean up
     */
    destroy() {
        EventBus.off('export:csv');
        EventBus.off('export:excel');
        EventBus.off('export:pdf');
        EventBus.off('export:json');
        EventBus.off('export:template');
        EventBus.off('export:bulk');
        
        console.log('[Exporters] Module destroyed');
    }
}

// Singleton
const exporters = new ExportersUtil();

// Exports
export { exporters, ExportersUtil };
export default exporters;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Exporters = exporters;
}

