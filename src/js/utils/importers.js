/**
 * 11 AVATAR DIGITAL HUB - Import Utilities
 * Enterprise-grade data import engine
 * CSV, Excel, JSON parsing with validation, mapping, error handling, bulk operations
 * 
 * @module Importers
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
import { Modal } from '../components/modal.js';

/**
 * Import Utilities - Handles all data import operations
 * Supports CSV, Excel, JSON with validation, mapping, and preview
 */
class ImportersUtil {
    constructor() {
        // Module identity
        this.moduleName = 'importers';
        
        // Supported import formats
        this.formats = {
            csv: {
                extension: '.csv',
                mimeTypes: ['text/csv', 'text/plain', 'application/csv'],
                label: 'CSV',
                icon: 'fa-file-csv',
                maxSize: 50 * 1024 * 1024, // 50MB
                encoding: ['utf-8', 'latin1', 'utf-16'],
                delimiter: [',', ';', '\t', '|']
            },
            excel: {
                extension: '.xlsx',
                mimeTypes: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ],
                label: 'Excel',
                icon: 'fa-file-excel',
                maxSize: 25 * 1024 * 1024, // 25MB
                supportsMultipleSheets: true
            },
            json: {
                extension: '.json',
                mimeTypes: ['application/json'],
                label: 'JSON',
                icon: 'fa-code',
                maxSize: 10 * 1024 * 1024 // 10MB
            }
        };
        
        // Import entity types with field mappings
        this.entityTypes = {
            'leads': {
                label: 'Leads',
                icon: 'fa-user-plus',
                color: '#3B82F6',
                requiredFields: ['name', 'phone'],
                optionalFields: ['email', 'company', 'source', 'status', 'notes', 'city', 'state'],
                validators: {
                    phone: Validators.isPhone,
                    email: Validators.isEmail
                }
            },
            'clients': {
                label: 'Clients',
                icon: 'fa-building',
                color: '#10B981',
                requiredFields: ['name', 'email'],
                optionalFields: ['phone', 'company', 'gstin', 'address', 'city', 'state', 'pincode'],
                validators: {
                    email: Validators.isEmail,
                    phone: Validators.isPhone,
                    gstin: Validators.isGSTIN
                }
            },
            'contacts': {
                label: 'Contacts',
                icon: 'fa-address-book',
                color: '#8B5CF6',
                requiredFields: ['name'],
                optionalFields: ['email', 'phone', 'designation', 'department', 'clientId'],
                validators: {
                    email: Validators.isEmail,
                    phone: Validators.isPhone
                }
            },
            'deals': {
                label: 'Deals/Pipeline',
                icon: 'fa-handshake',
                color: '#F59E0B',
                requiredFields: ['title', 'value'],
                optionalFields: ['stage', 'probability', 'clientId', 'contactId', 'expectedCloseDate'],
                validators: {
                    value: (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0
                }
            },
            'tasks': {
                label: 'Tasks',
                icon: 'fa-tasks',
                color: '#EC4899',
                requiredFields: ['title'],
                optionalFields: ['description', 'priority', 'status', 'assignee', 'dueDate'],
                validators: {
                    dueDate: Validators.isDate
                }
            },
            'products': {
                label: 'Products/Services',
                icon: 'fa-box',
                color: '#14B8A6',
                requiredFields: ['name', 'price'],
                optionalFields: ['description', 'hsnSac', 'gstRate', 'category', 'sku'],
                validators: {
                    price: (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0
                }
            }
        };
        
        // Import state
        this.currentImport = {
            file: null,
            format: null,
            entityType: null,
            rawData: null,
            parsedData: [],
            headers: [],
            mappedFields: {},
            validationErrors: [],
            duplicates: [],
            totalRows: 0,
            validRows: 0,
            errorRows: 0
        };
        
        // Import job tracking
        this.importJobs = new Map();
        this.activeJobId = null;
        
        // Import history
        this.importHistory = [];
        this.maxHistoryItems = 50;
        
        // Performance
        this.metrics = {
            totalImports: 0,
            totalRows: 0,
            successRows: 0,
            errorRows: 0,
            averageSpeed: 0,
            lastImport: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize importers
     */
    async init() {
        try {
            console.log('[Importers] Initializing import utilities...');
            
            // Load import history
            await this.loadImportHistory();
            
            // Set up event listeners
            this.setupEventListeners();
            
            console.log('[Importers] Import utilities ready');
            
        } catch (error) {
            console.error('[Importers] Initialization failed:', error);
        }
    }
    
    /**
     * Load import history
     */
    async loadImportHistory() {
        try {
            const cached = await Cache.get('import_history');
            if (cached && cached.data) {
                this.importHistory = cached.data.slice(0, this.maxHistoryItems);
            }
        } catch (error) {
            console.error('[Importers] History load failed:', error);
        }
    }
    
    /**
     * Save import history
     */
    async saveImportHistory() {
        try {
            if (this.importHistory.length > this.maxHistoryItems) {
                this.importHistory = this.importHistory.slice(0, this.maxHistoryItems);
            }
            await Cache.set('import_history', this.importHistory, 86400000);
        } catch (error) {
            console.error('[Importers] History save failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('import:file', this.handleFileImport.bind(this));
            EventBus.on('import:validate', this.validateImport.bind(this));
            EventBus.on('import:execute', this.executeImport.bind(this));
            EventBus.on('import:preview', this.previewImport.bind(this));
            
            console.log('[Importers] Event listeners initialized');
            
        } catch (error) {
            console.error('[Importers] Event listener setup failed:', error);
        }
    }
    
    /**
     * Open import wizard modal
     */
    async openImportWizard(entityType = null) {
        try {
            const wizardHtml = this.renderImportWizard(entityType);
            
            const modal = new Modal({
                title: 'Import Data',
                content: wizardHtml,
                size: 'xlarge',
                customClass: 'import-wizard-modal',
                onClose: () => {
                    this.resetCurrentImport();
                }
            });
            
            modal.open();
            
            // Set up wizard step handlers
            setTimeout(() => {
                this.setupWizardHandlers(entityType);
            }, 200);
            
        } catch (error) {
            console.error('[Importers] Wizard open failed:', error);
            Toast.show('Failed to open import wizard', 'error');
        }
    }
    
    /**
     * Render import wizard HTML
     */
    renderImportWizard(entityType = null) {
        return `
            <div class="import-wizard">
                <!-- Wizard Steps Indicator -->
                <div class="wizard-steps">
                    <div class="wizard-step active" data-step="1">
                        <span class="step-number">1</span>
                        <span class="step-label">Select File</span>
                    </div>
                    <div class="wizard-step" data-step="2">
                        <span class="step-number">2</span>
                        <span class="step-label">Map Fields</span>
                    </div>
                    <div class="wizard-step" data-step="3">
                        <span class="step-number">3</span>
                        <span class="step-label">Validate</span>
                    </div>
                    <div class="wizard-step" data-step="4">
                        <span class="step-number">4</span>
                        <span class="step-label">Import</span>
                    </div>
                </div>
                
                <!-- Step Content -->
                <div class="wizard-content" id="wizard-content">
                    ${this.renderStep1(entityType)}
                </div>
                
                <!-- Wizard Actions -->
                <div class="wizard-actions">
                    <button class="btn btn-secondary" id="wizard-back" style="display: none;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <button class="btn btn-primary" id="wizard-next" disabled>
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Render Step 1 - File Selection
     */
    renderStep1(entityType = null) {
        return `
            <div class="import-step step-1">
                <div class="step-header">
                    <h4><i class="fas fa-file-upload"></i> Select File to Import</h4>
                    <p>Choose a file and entity type for import</p>
                </div>
                
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label for="import-entity">Import Type *</label>
                            <select id="import-entity" class="form-control">
                                <option value="">Select what to import...</option>
                                ${Object.entries(this.entityTypes).map(([key, entity]) => `
                                    <option value="${key}" ${entityType === key ? 'selected' : ''}>
                                        ${entity.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group col-6">
                            <label for="import-format">File Format</label>
                            <select id="import-format" class="form-control">
                                ${Object.entries(this.formats).map(([key, format]) => `
                                    <option value="${key}">${format.label} (${format.extension})</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="file-drop-zone" id="file-drop-zone">
                    <div class="drop-content">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <h5>Drag & Drop File Here</h5>
                        <p>or</p>
                        <button class="btn btn-outline" id="browse-file-btn">
                            <i class="fas fa-folder-open"></i> Browse Files
                        </button>
                        <input type="file" id="import-file-input" style="display: none;" 
                               accept="${Object.values(this.formats).map(f => f.extension).join(',')}">
                        <p class="file-limits">
                            Supported: CSV, Excel (.xlsx), JSON
                            <br>Max size: 50MB
                        </p>
                    </div>
                </div>
                
                <div class="file-info" id="file-info" style="display: none;">
                    <div class="selected-file">
                        <i class="fas fa-file"></i>
                        <div class="file-details">
                            <strong id="file-name"></strong>
                            <span id="file-size"></span>
                        </div>
                        <button class="btn-icon remove-file" id="remove-file">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="import-templates">
                    <h5>Quick Templates</h5>
                    <p>Download sample files with correct format</p>
                    <div class="template-buttons">
                        ${Object.entries(this.entityTypes).map(([key, entity]) => `
                            <button class="btn btn-sm btn-outline" 
                                    onclick="window.Global.Importers.downloadTemplate('${key}')">
                                <i class="fas fa-download"></i> ${entity.label} Template
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render Step 2 - Field Mapping
     */
    renderStep2() {
        const headers = this.currentImport.headers;
        const entityType = this.currentImport.entityType;
        const entityFields = this.entityTypes[entityType];
        
        if (!headers.length || !entityType) {
            return '<div class="error-message">No data to map</div>';
        }
        
        const allFields = [...entityFields.requiredFields, ...entityFields.optionalFields];
        
        return `
            <div class="import-step step-2">
                <div class="step-header">
                    <h4><i class="fas fa-random"></i> Map Fields</h4>
                    <p>Match file columns to ${entityFields.label} fields</p>
                </div>
                
                <div class="mapping-preview">
                    <div class="preview-info">
                        <span><strong>File:</strong> ${this.currentImport.file?.name || 'Unknown'}</span>
                        <span><strong>Rows:</strong> ${this.currentImport.totalRows}</span>
                        <span><strong>Columns:</strong> ${headers.length}</span>
                    </div>
                    
                    <table class="mapping-table">
                        <thead>
                            <tr>
                                <th>File Column</th>
                                <th>Sample Data</th>
                                <th>Map To Field</th>
                                <th>Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${headers.map((header, index) => {
                                const sampleValue = this.currentImport.parsedData[0]?.[header] || '';
                                const autoMapped = this.autoMapField(header, allFields);
                                
                                return `
                                    <tr>
                                        <td>
                                            <strong>${this.escapeHtml(header)}</strong>
                                        </td>
                                        <td class="sample-cell">
                                            <code>${this.escapeHtml(String(sampleValue).substring(0, 50))}</code>
                                        </td>
                                        <td>
                                            <select class="field-mapping" data-column="${this.escapeHtml(header)}">
                                                <option value="">-- Skip Column --</option>
                                                ${allFields.map(field => `
                                                    <option value="${field}" 
                                                            ${autoMapped === field ? 'selected' : ''}
                                                            ${entityFields.requiredFields.includes(field) ? 'class="required-field"' : ''}>
                                                        ${this.formatFieldName(field)}
                                                        ${entityFields.requiredFields.includes(field) ? ' *' : ''}
                                                    </option>
                                                `).join('')}
                                            </select>
                                        </td>
                                        <td>
                                            ${entityFields.requiredFields.includes(autoMapped) ? 
                                                '<span class="required-badge">Required</span>' : 
                                                '<span class="optional-badge">Optional</span>'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="mapping-options">
                    <label>
                        <input type="checkbox" id="skip-first-row" checked>
                        First row contains headers
                    </label>
                    <label>
                        <input type="checkbox" id="auto-detect-types">
                        Auto-detect data types
                    </label>
                </div>
            </div>
        `;
    }
    
    /**
     * Render Step 3 - Validation Results
     */
    renderStep3() {
        const errors = this.currentImport.validationErrors;
        const totalRows = this.currentImport.totalRows;
        const validRows = this.currentImport.validRows;
        const errorRows = this.currentImport.errorRows;
        
        return `
            <div class="import-step step-3">
                <div class="step-header">
                    <h4><i class="fas fa-check-circle"></i> Validate Data</h4>
                    <p>Review validation results before importing</p>
                </div>
                
                <div class="validation-summary">
                    <div class="summary-card total">
                        <span class="count">${totalRows}</span>
                        <span class="label">Total Rows</span>
                    </div>
                    <div class="summary-card valid">
                        <span class="count">${validRows}</span>
                        <span class="label">Valid</span>
                    </div>
                    <div class="summary-card errors">
                        <span class="count">${errorRows}</span>
                        <span class="label">With Errors</span>
                    </div>
                    <div class="summary-card duplicates">
                        <span class="count">${this.currentImport.duplicates.length}</span>
                        <span class="label">Duplicates</span>
                    </div>
                </div>
                
                ${errors.length > 0 ? `
                    <div class="validation-errors">
                        <h5>Validation Errors (${errors.length})</h5>
                        <div class="errors-table-container">
                            <table class="errors-table">
                                <thead>
                                    <tr>
                                        <th>Row #</th>
                                        <th>Field</th>
                                        <th>Value</th>
                                        <th>Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${errors.slice(0, 20).map(error => `
                                        <tr>
                                            <td>${error.row}</td>
                                            <td>${this.escapeHtml(error.field)}</td>
                                            <td><code>${this.escapeHtml(String(error.value).substring(0, 40))}</code></td>
                                            <td class="error-message">${this.escapeHtml(error.message)}</td>
                                        </tr>
                                    `).join('')}
                                    ${errors.length > 20 ? `
                                        <tr>
                                            <td colspan="4" class="text-center">
                                                ... and ${errors.length - 20} more errors
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : `
                    <div class="validation-success">
                        <i class="fas fa-check-circle"></i>
                        <h5>All rows validated successfully!</h5>
                        <p>Ready to import ${validRows} rows</p>
                    </div>
                `}
                
                <div class="import-options">
                    <h5>Import Options</h5>
                    <label>
                        <input type="checkbox" id="skip-errors" checked>
                        Skip rows with errors
                    </label>
                    <label>
                        <input type="checkbox" id="skip-duplicates" checked>
                        Skip duplicate entries
                    </label>
                    <label>
                        <input type="checkbox" id="send-notifications">
                        Send welcome notifications (if applicable)
                    </label>
                </div>
            </div>
        `;
    }
    
    /**
     * Render Step 4 - Import Progress
     */
    renderStep4() {
        return `
            <div class="import-step step-4">
                <div class="step-header">
                    <h4><i class="fas fa-upload"></i> Importing Data</h4>
                    <p>Please wait while your data is being imported...</p>
                </div>
                
                <div class="import-progress-container">
                    <div class="progress-ring">
                        <svg class="progress-ring-svg" width="120" height="120">
                            <circle class="progress-ring-bg" cx="60" cy="60" r="50"></circle>
                            <circle class="progress-ring-fill" cx="60" cy="60" r="50" 
                                    stroke-dasharray="314" stroke-dashoffset="314"></circle>
                        </svg>
                        <div class="progress-percentage">0%</div>
                    </div>
                    
                    <div class="progress-stats">
                        <div class="stat">
                            <span id="imported-count">0</span>
                            <span>Imported</span>
                        </div>
                        <div class="stat">
                            <span id="skipped-count">0</span>
                            <span>Skipped</span>
                        </div>
                        <div class="stat">
                            <span id="failed-count">0</span>
                            <span>Failed</span>
                        </div>
                    </div>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="import-progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                    
                    <div class="progress-log" id="progress-log">
                        <!-- Real-time log entries -->
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Set up wizard step handlers
     */
    setupWizardHandlers(entityType = null) {
        try {
            let currentStep = 1;
            
            // File drop zone
            const dropZone = document.getElementById('file-drop-zone');
            const fileInput = document.getElementById('import-file-input');
            const browseBtn = document.getElementById('browse-file-btn');
            
            if (dropZone && fileInput) {
                // Click to browse
                browseBtn?.addEventListener('click', () => fileInput.click());
                dropZone.addEventListener('click', () => fileInput.click());
                
                // Drag and drop
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.classList.add('drag-over');
                });
                
                dropZone.addEventListener('dragleave', () => {
                    dropZone.classList.remove('drag-over');
                });
                
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        this.handleFileSelection(files[0]);
                    }
                });
                
                // File input change
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        this.handleFileSelection(e.target.files[0]);
                    }
                });
            }
            
            // Remove file button
            const removeBtn = document.getElementById('remove-file');
            removeBtn?.addEventListener('click', () => {
                this.resetCurrentImport();
                this.updateFileInfoDisplay();
            });
            
            // Next button
            const nextBtn = document.getElementById('wizard-next');
            const backBtn = document.getElementById('wizard-back');
            
            nextBtn?.addEventListener('click', async () => {
                switch (currentStep) {
                    case 1:
                        if (await this.validateStep1()) {
                            currentStep = 2;
                            await this.loadStep2();
                        }
                        break;
                    case 2:
                        if (await this.validateStep2()) {
                            currentStep = 3;
                            await this.loadStep3();
                        }
                        break;
                    case 3:
                        currentStep = 4;
                        await this.loadStep4();
                        await this.executeImport();
                        break;
                }
                
                this.updateWizardNavigation(currentStep);
            });
            
            backBtn?.addEventListener('click', () => {
                if (currentStep > 1) {
                    currentStep--;
                    this.updateWizardNavigation(currentStep);
                    
                    switch (currentStep) {
                        case 1: this.renderStepContent(this.renderStep1()); break;
                        case 2: this.renderStepContent(this.renderStep2()); break;
                        case 3: this.renderStepContent(this.renderStep3()); break;
                    }
                }
            });
            
        } catch (error) {
            console.error('[Importers] Wizard handler setup failed:', error);
        }
    }
    
    /**
     * Handle file selection
     */
    async handleFileSelection(file) {
        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                Toast.show(validation.error, 'error');
                return;
            }
            
            // Store file
            this.currentImport.file = file;
            this.currentImport.format = validation.format;
            
            // Update display
            this.updateFileInfoDisplay();
            
            // Parse file
            await this.parseFile(file, validation.format);
            
            // Enable next button
            const nextBtn = document.getElementById('wizard-next');
            const entitySelect = document.getElementById('import-entity');
            
            if (nextBtn && entitySelect?.value) {
                nextBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('[Importers] File selection failed:', error);
            Toast.show('Failed to process file: ' + error.message, 'error');
        }
    }
    
    /**
     * Validate file
     */
    validateFile(file) {
        if (!file) {
            return { valid: false, error: 'No file selected' };
        }
        
        // Detect format from extension
        const name = file.name.toLowerCase();
        let detectedFormat = null;
        
        for (const [key, format] of Object.entries(this.formats)) {
            if (name.endsWith(format.extension)) {
                detectedFormat = key;
                break;
            }
        }
        
        if (!detectedFormat) {
            return { valid: false, error: 'Unsupported file format. Please use CSV, Excel, or JSON.' };
        }
        
        // Check file size
        const maxSize = this.formats[detectedFormat].maxSize;
        if (file.size > maxSize) {
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
            return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` };
        }
        
        return { valid: true, format: detectedFormat };
    }
    
    /**
     * Parse file based on format
     */
    async parseFile(file, format) {
        try {
            const content = await this.readFileContent(file);
            
            switch (format) {
                case 'csv':
                    await this.parseCSV(content);
                    break;
                case 'excel':
                    await this.parseExcel(content);
                    break;
                case 'json':
                    await this.parseJSON(content);
                    break;
            }
            
            console.log(`[Importers] Parsed ${this.currentImport.totalRows} rows`);
            
        } catch (error) {
            console.error('[Importers] File parse failed:', error);
            throw error;
        }
    }
    
    /**
     * Read file content
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            
            if (file.name.endsWith('.xlsx')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file, 'utf-8');
            }
        });
    }
    
    /**
     * Parse CSV content
     */
    async parseCSV(content) {
        try {
            // Detect delimiter
            const delimiter = this.detectDelimiter(content);
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('CSV file is empty');
            }
            
            // Parse headers
            const headers = this.parseCSVLine(lines[0], delimiter);
            this.currentImport.headers = headers.map(h => h.trim().replace(/^"|"$/g, ''));
            
            // Parse data rows
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i], delimiter);
                const row = {};
                
                this.currentImport.headers.forEach((header, index) => {
                    row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
                });
                
                // Add row number
                row['_rowNumber'] = i;
                data.push(row);
            }
            
            this.currentImport.parsedData = data;
            this.currentImport.totalRows = data.length;
            this.currentImport.validRows = data.length;
            
        } catch (error) {
            console.error('[Importers] CSV parse failed:', error);
            throw error;
        }
    }
    
    /**
     * Parse Excel content
     */
    async parseExcel(content) {
        try {
            // Check if XLSX library is available
            if (typeof XLSX === 'undefined') {
                throw new Error('Excel parser not available. Please install SheetJS library.');
            }
            
            const workbook = XLSX.read(content, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            if (!firstSheet) {
                throw new Error('Excel file has no sheets');
            }
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            
            if (jsonData.length === 0) {
                throw new Error('Excel sheet is empty');
            }
            
            this.currentImport.headers = Object.keys(jsonData[0]);
            this.currentImport.parsedData = jsonData.map((row, index) => ({
                ...row,
                '_rowNumber': index + 2 // +2 for header row and 1-based
            }));
            this.currentImport.totalRows = jsonData.length;
            this.currentImport.validRows = jsonData.length;
            
        } catch (error) {
            console.error('[Importers] Excel parse failed:', error);
            throw error;
        }
    }
    
    /**
     * Parse JSON content
     */
    async parseJSON(content) {
        try {
            const parsed = JSON.parse(content);
            
            // Handle array
            let data = [];
            if (Array.isArray(parsed)) {
                data = parsed;
            } else if (parsed.data && Array.isArray(parsed.data)) {
                data = parsed.data;
            } else if (typeof parsed === 'object') {
                data = [parsed];
            }
            
            if (data.length === 0) {
                throw new Error('JSON data is empty');
            }
            
            this.currentImport.headers = Object.keys(data[0]).filter(k => k !== '_rowNumber');
            this.currentImport.parsedData = data.map((row, index) => ({
                ...row,
                '_rowNumber': index + 1
            }));
            this.currentImport.totalRows = data.length;
            this.currentImport.validRows = data.length;
            
        } catch (error) {
            console.error('[Importers] JSON parse failed:', error);
            throw new Error('Invalid JSON format: ' + error.message);
        }
    }
    
    /**
     * Detect CSV delimiter
     */
    detectDelimiter(content) {
        const firstLine = content.split('\n')[0] || '';
        const delimiters = this.formats.csv.delimiter;
        
        let bestDelimiter = ',';
        let maxCount = 0;
        
        delimiters.forEach(delimiter => {
            const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delimiter;
            }
        });
        
        return bestDelimiter;
    }
    
    /**
     * Parse CSV line handling quoted fields
     */
    parseCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }
    
    /**
     * Auto-map file column to entity field
     */
    autoMapField(columnName, availableFields) {
        const normalized = columnName.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
        
        // Direct match
        for (const field of availableFields) {
            const fieldNormalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalized === fieldNormalized) {
                return field;
            }
        }
        
        // Partial match
        for (const field of availableFields) {
            const fieldNormalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalized.includes(fieldNormalized) || fieldNormalized.includes(normalized)) {
                return field;
            }
        }
        
        return null;
    }
    
    /**
     * Validate import data
     */
    async validateImport() {
        try {
            const entityType = this.currentImport.entityType;
            const entityConfig = this.entityTypes[entityType];
            
            if (!entityConfig) throw new Error('Invalid entity type');
            
            const errors = [];
            const duplicates = [];
            const mappedFields = this.currentImport.mappedFields;
            const requiredFields = entityConfig.requiredFields;
            const validators = entityConfig.validators || {};
            
            // Get mapped required fields
            const mappedRequired = requiredFields.filter(f => 
                Object.values(mappedFields).includes(f)
            );
            
            // Check missing required mappings
            if (mappedRequired.length < requiredFields.length) {
                const missing = requiredFields.filter(f => !mappedRequired.includes(f));
                errors.push({
                    row: 'N/A',
                    field: 'Mapping',
                    value: '',
                    message: `Missing required field mapping: ${missing.join(', ')}`
                });
            }
            
            // Validate each row
            const validRows = [];
            
            this.currentImport.parsedData.forEach((row, index) => {
                const rowErrors = [];
                
                // Check required fields
                Object.entries(mappedFields).forEach(([fileColumn, entityField]) => {
                    if (!entityField) return; // Skip unmapped
                    
                    const value = row[fileColumn];
                    
                    // Required check
                    if (requiredFields.includes(entityField) && (!value || String(value).trim() === '')) {
                        rowErrors.push({
                            row: row._rowNumber || index + 1,
                            field: entityField,
                            value: value,
                            message: `${this.formatFieldName(entityField)} is required`
                        });
                    }
                    
                    // Validator check
                    if (value && validators[entityField]) {
                        const validatorFn = validators[entityField];
                        if (!validatorFn(value)) {
                            rowErrors.push({
                                row: row._rowNumber || index + 1,
                                field: entityField,
                                value: value,
                                message: `Invalid ${this.formatFieldName(entityField)} format`
                            });
                        }
                    }
                });
                
                if (rowErrors.length === 0) {
                    validRows.push(row);
                } else {
                    errors.push(...rowErrors);
                }
            });
            
            // Check duplicates (based on email/phone)
            this.currentImport.parsedData.forEach((row, index) => {
                const email = row['email'] || row['Email'] || '';
                const phone = row['phone'] || row['Phone'] || row['mobile'] || '';
                
                if (email) {
                    const duplicate = this.currentImport.parsedData.find((r, i) => 
                        i !== index && (r['email'] === email || r['Email'] === email)
                    );
                    if (duplicate) {
                        duplicates.push({
                            row: row._rowNumber,
                            field: 'email',
                            value: email,
                            message: 'Duplicate email found'
                        });
                    }
                }
            });
            
            // Update state
            this.currentImport.validationErrors = errors;
            this.currentImport.duplicates = duplicates;
            this.currentImport.validRows = validRows.length;
            this.currentImport.errorRows = errors.length > 0 ? 
                new Set(errors.map(e => e.row)).size : 0;
            
            return {
                valid: errors.length === 0,
                errors,
                duplicates,
                validRows: validRows.length,
                totalRows: this.currentImport.totalRows
            };
            
        } catch (error) {
            console.error('[Importers] Validation failed:', error);
            throw error;
        }
    }
    
    /**
     * Execute the actual import
     */
    async executeImport() {
        try {
            const startTime = performance.now();
            const skipErrors = document.getElementById('skip-errors')?.checked ?? true;
            const skipDuplicates = document.getElementById('skip-duplicates')?.checked ?? true;
            
            // Prepare data
            const mappedFields = this.currentImport.mappedFields;
            const importData = [];
            
            this.currentImport.parsedData.forEach((row) => {
                const mappedRow = {};
                
                Object.entries(mappedFields).forEach(([fileColumn, entityField]) => {
                    if (entityField) {
                        mappedRow[entityField] = row[fileColumn] || '';
                    }
                });
                
                // Skip if has errors
                if (skipErrors) {
                    const rowHasError = this.currentImport.validationErrors.some(
                        e => e.row === row._rowNumber
                    );
                    if (rowHasError) return;
                }
                
                importData.push(mappedRow);
            });
            
            // Create import job
            const jobId = `import-${Date.now()}`;
            this.activeJobId = jobId;
            
            this.importJobs.set(jobId, {
                id: jobId,
                entityType: this.currentImport.entityType,
                totalRows: importData.length,
                importedRows: 0,
                failedRows: 0,
                skippedRows: this.currentImport.totalRows - importData.length,
                status: 'in_progress',
                startTime: new Date().toISOString()
            });
            
            // Send to API in batches
            const batchSize = 100;
            let imported = 0;
            let failed = 0;
            
            for (let i = 0; i < importData.length; i += batchSize) {
                const batch = importData.slice(i, i + batchSize);
                
                try {
                    const response = await API.post(
                        `/api/import/${this.currentImport.entityType}`,
                        { data: batch, skipDuplicates }
                    );
                    
                    if (response.success) {
                        imported += response.data.imported || batch.length;
                        failed += response.data.failed || 0;
                    } else {
                        failed += batch.length;
                    }
                    
                } catch (error) {
                    console.error(`[Importers] Batch ${i / batchSize + 1} failed:`, error);
                    failed += batch.length;
                }
                
                // Update progress
                const progress = Math.round(((i + batch.length) / importData.length) * 100);
                this.updateImportProgress(progress, imported, failed);
                
                // Small delay between batches
                await this.delay(100);
            }
            
            // Update job status
            const job = this.importJobs.get(jobId);
            if (job) {
                job.status = 'completed';
                job.importedRows = imported;
                job.failedRows = failed;
                job.endTime = new Date().toISOString();
                job.duration = performance.now() - startTime;
            }
            
            // Track metrics
            this.trackImportMetrics(imported, failed, performance.now() - startTime);
            
            // Update history
            this.importHistory.unshift({
                id: jobId,
                entityType: this.currentImport.entityType,
                entityLabel: this.entityTypes[this.currentImport.entityType]?.label,
                fileName: this.currentImport.file?.name,
                totalRows: importData.length,
                importedRows: imported,
                failedRows: failed,
                timestamp: new Date().toISOString()
            });
            
            await this.saveImportHistory();
            
            // Show completion
            this.showImportComplete(imported, failed);
            
            // Emit event
            EventBus.emit('import:completed', {
                jobId,
                entityType: this.currentImport.entityType,
                imported,
                failed
            });
            
        } catch (error) {
            console.error('[Importers] Import execution failed:', error);
            Toast.show('Import failed: ' + error.message, 'error');
            
            if (this.activeJobId) {
                const job = this.importJobs.get(this.activeJobId);
                if (job) job.status = 'failed';
            }
        }
    }
    
    /**
     * Update import progress UI
     */
    updateImportProgress(progress, imported, failed) {
        try {
            const progressFill = document.querySelector('.progress-fill');
            const percentageEl = document.querySelector('.progress-percentage');
            const importedEl = document.getElementById('imported-count');
            const failedEl = document.getElementById('failed-count');
            
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (percentageEl) percentageEl.textContent = `${progress}%`;
            if (importedEl) importedEl.textContent = imported;
            if (failedEl) failedEl.textContent = failed;
            
            // Update progress ring
            const ringFill = document.querySelector('.progress-ring-fill');
            if (ringFill) {
                const circumference = 314;
                const offset = circumference - (progress / 100) * circumference;
                ringFill.style.strokeDashoffset = offset;
            }
            
        } catch (error) {
            console.error('[Importers] Progress update failed:', error);
        }
    }
    
    /**
     * Show import complete message
     */
    showImportComplete(imported, failed) {
        try {
            const content = document.querySelector('.import-progress-container');
            if (content) {
                content.innerHTML = `
                    <div class="import-complete">
                        <div class="complete-icon success">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h4>Import Complete!</h4>
                        <div class="complete-stats">
                            <div class="stat-item">
                                <span class="stat-value success">${imported}</span>
                                <span class="stat-label">Successfully Imported</span>
                            </div>
                            ${failed > 0 ? `
                                <div class="stat-item">
                                    <span class="stat-value error">${failed}</span>
                                    <span class="stat-label">Failed</span>
                                </div>
                            ` : ''}
                        </div>
                        <button class="btn btn-primary" onclick="window.Global.Modal.close(); window.Global.EventBus.emit('data:refresh')">
                            <i class="fas fa-check"></i> Done
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('[Importers] Complete display failed:', error);
        }
    }
    
    /**
     * Track import metrics
     */
    trackImportMetrics(imported, failed, duration) {
        this.metrics.totalImports++;
        this.metrics.totalRows += imported + failed;
        this.metrics.successRows += imported;
        this.metrics.errorRows += failed;
        this.metrics.averageSpeed = Math.round((imported + failed) / (duration / 1000));
        this.metrics.lastImport = new Date();
    }
    
    /**
     * Download import template
     */
    async downloadTemplate(entityType) {
        try {
            const entityConfig = this.entityTypes[entityType];
            if (!entityConfig) {
                Toast.show('Unknown entity type', 'error');
                return;
            }
            
            // Create sample data
            const allFields = [...entityConfig.requiredFields, ...entityConfig.optionalFields];
            const sampleRow = {};
            allFields.forEach(field => {
                sampleRow[field] = this.getSampleValue(field);
            });
            
            // Export as CSV
            const { exporters } = await import('./exporters.js');
            await exporters.exportCSV([sampleRow], {
                filename: `${entityType}-import-template`,
                columns: allFields
            });
            
            Toast.show(`${entityConfig.label} template downloaded`, 'success');
            
        } catch (error) {
            console.error('[Importers] Template download failed:', error);
            Toast.show('Failed to download template', 'error');
        }
    }
    
    /**
     * Get sample value for field
     */
    getSampleValue(field) {
        const samples = {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '9876543210',
            company: 'Acme Corp',
            title: 'New Deal',
            value: '50000',
            price: '999',
            source: 'Website',
            status: 'active',
            gstin: '27AABCG2194N1Z1',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            description: 'Sample description',
            priority: 'medium',
            stage: 'lead',
            hsnSac: '998311'
        };
        
        return samples[field] || `Sample ${field}`;
    }
    
    /**
     * Format field name for display
     */
    formatFieldName(field) {
        return field
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    /**
     * Update file info display
     */
    updateFileInfoDisplay() {
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const dropZone = document.getElementById('file-drop-zone');
        
        if (this.currentImport.file) {
            if (fileInfo) fileInfo.style.display = 'block';
            if (dropZone) dropZone.style.display = 'none';
            if (fileName) fileName.textContent = this.currentImport.file.name;
            if (fileSize) fileSize.textContent = this.formatFileSize(this.currentImport.file.size);
        } else {
            if (fileInfo) fileInfo.style.display = 'none';
            if (dropZone) dropZone.style.display = 'flex';
        }
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    /**
     * Update wizard navigation
     */
    updateWizardNavigation(currentStep) {
        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');
            
            if (stepNum === currentStep) step.classList.add('active');
            if (stepNum < currentStep) step.classList.add('completed');
        });
        
        // Update buttons
        const backBtn = document.getElementById('wizard-back');
        const nextBtn = document.getElementById('wizard-next');
        
        if (backBtn) backBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
        if (nextBtn) {
            if (currentStep === 4) {
                nextBtn.style.display = 'none';
            } else {
                nextBtn.style.display = 'inline-flex';
                nextBtn.innerHTML = currentStep === 3 ? 
                    '<i class="fas fa-upload"></i> Start Import' : 
                    'Next <i class="fas fa-arrow-right"></i>';
            }
        }
    }
    
    /**
     * Render step content
     */
    renderStepContent(html) {
        const content = document.getElementById('wizard-content');
        if (content) content.innerHTML = html;
    }
    
    /**
     * Reset current import state
     */
    resetCurrentImport() {
        this.currentImport = {
            file: null,
            format: null,
            entityType: null,
            rawData: null,
            parsedData: [],
            headers: [],
            mappedFields: {},
            validationErrors: [],
            duplicates: [],
            totalRows: 0,
            validRows: 0,
            errorRows: 0
        };
    }
    
    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
     * Get import history
     */
    getImportHistory(limit = 10) {
        return this.importHistory.slice(0, limit);
    }
    
    /**
     * Get metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    
    /**
     * Clean up
     */
    destroy() {
        EventBus.off('import:file');
        EventBus.off('import:validate');
        EventBus.off('import:execute');
        EventBus.off('import:preview');
        
        console.log('[Importers] Module destroyed');
    }
}

// Singleton
const importers = new ImportersUtil();

// Exports
export { importers, ImportersUtil };
export default importers;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Importers = importers;
}
