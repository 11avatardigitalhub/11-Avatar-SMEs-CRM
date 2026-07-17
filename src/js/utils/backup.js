/**
 * 11 AVATAR DIGITAL HUB - Backup & Restore Utility
 * Enterprise-grade data backup, restore & disaster recovery system
 * Automated backups, versioning, encryption, cloud sync, point-in-time recovery
 * 
 * @module Backup
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from './formatters.js';
import { Validators } from './validators.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

/**
 * Backup Utility - Complete data protection & recovery
 * Handles automated backups, manual exports, restore, verification
 */
class BackupUtil {
    constructor() {
        // Module identity
        this.moduleName = 'backup';
        this.apiEndpoint = '/api/backup';
        this.cachePrefix = 'backup_';
        
        // Backup types
        this.backupTypes = {
            'full': {
                label: 'Full Backup',
                icon: 'fa-database',
                color: '#3B82F6',
                description: 'Complete system backup including all data, files, and settings',
                includesAll: true
            },
            'incremental': {
                label: 'Incremental',
                icon: 'fa-plus-circle',
                color: '#10B981',
                description: 'Only changes since last backup',
                dependsOn: 'full'
            },
            'differential': {
                label: 'Differential',
                icon: 'fa-layer-group',
                color: '#F59E0B',
                description: 'All changes since last full backup',
                dependsOn: 'full'
            },
            'config': {
                label: 'Configuration Only',
                icon: 'fa-cog',
                color: '#8B5CF6',
                description: 'Settings, preferences, and configurations only',
                entities: ['settings', 'preferences', 'integrations']
            },
            'data': {
                label: 'Data Only',
                icon: 'fa-table',
                color: '#EC4899',
                description: 'Business data without configurations',
                entities: ['leads', 'clients', 'deals', 'invoices', 'payments', 'tasks', 'projects']
            },
            'files': {
                label: 'Files & Media',
                icon: 'fa-file-archive',
                color: '#14B8A6',
                description: 'Uploaded files, documents, and media assets'
            }
        };
        
        // Backup status
        this.backupStatuses = {
            'pending': { label: 'Pending', color: '#F59E0B', icon: 'fa-clock' },
            'in_progress': { label: 'In Progress', color: '#3B82F6', icon: 'fa-spinner' },
            'completed': { label: 'Completed', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'restoring': { label: 'Restoring', color: '#8B5CF6', icon: 'fa-sync' },
            'verified': { label: 'Verified', color: '#6366F1', icon: 'fa-shield-check' }
        };
        
        // Backup schedule
        this.schedules = {
            'manual': { label: 'Manual Only', cron: null },
            'hourly': { label: 'Every Hour', cron: '0 * * * *' },
            'daily': { label: 'Daily', cron: '0 2 * * *' },
            'weekly': { label: 'Weekly', cron: '0 2 * * 0' },
            'monthly': { label: 'Monthly', cron: '0 2 1 * *' }
        };
        
        // Retention policies
        this.retentionPolicies = {
            '7days': { label: '7 Days', days: 7, maxBackups: 7 },
            '30days': { label: '30 Days', days: 30, maxBackups: 30 },
            '90days': { label: '90 Days', days: 90, maxBackups: 90 },
            '1year': { label: '1 Year', days: 365, maxBackups: 52 },
            'unlimited': { label: 'Unlimited', days: 0, maxBackups: 0 }
        };
        
        // Storage providers
        this.storageProviders = {
            'firebase': {
                label: 'Firebase Storage',
                icon: 'fa-database',
                color: '#FFA000',
                enabled: true,
                bucket: 'avatar-wa-dual-crm.appspot.com'
            },
            'local': {
                label: 'Local Download',
                icon: 'fa-hdd',
                color: '#6B7280',
                enabled: true,
                maxSize: 500 * 1024 * 1024 // 500MB
            },
            'google_drive': {
                label: 'Google Drive',
                icon: 'fa-google-drive',
                color: '#4285F4',
                enabled: false,
                requiresAuth: true
            },
            'dropbox': {
                label: 'Dropbox',
                icon: 'fa-dropbox',
                color: '#0061FF',
                enabled: false,
                requiresAuth: true
            }
        };
        
        // Current backup state
        this.backups = new Map();
        this.activeBackupId = null;
        this.isBackingUp = false;
        this.isRestoring = false;
        
        // Backup configuration
        this.config = {
            autoBackup: true,
            schedule: 'daily',
            type: 'incremental',
            retention: '30days',
            encrypt: true,
            compress: true,
            verifyAfterBackup: true,
            includeFiles: true,
            excludeEntities: [],
            notificationEmail: '',
            storageProvider: 'firebase'
        };
        
        // Backup statistics
        this.stats = {
            totalBackups: 0,
            lastBackupDate: null,
            lastBackupSize: 0,
            totalSize: 0,
            averageSize: 0,
            averageDuration: 0,
            successRate: 100
        };
        
        // Restore state
        this.restoreState = {
            backupId: null,
            pointInTime: null,
            entities: [],
            progress: 0,
            status: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            backupList: null,
            backupProgress: null,
            scheduleConfig: null,
            storageConfig: null
        };
        
        // Auto-backup timer
        this.autoBackupTimer = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize backup utility
     */
    async init() {
        try {
            console.log('[Backup] Initializing backup & restore utility...');
            
            // Check permissions (admin only)
            const canAccess = await Permissions.check('backup', 'admin');
            if (!canAccess) {
                console.warn('[Backup] Limited access - admin permissions required');
            }
            
            // Load configuration
            await this.loadConfiguration();
            
            // Load backup history
            await this.loadBackupHistory();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start auto-backup if configured
            if (this.config.autoBackup) {
                this.scheduleAutoBackup();
            }
            
            console.log('[Backup] Backup utility ready');
            
        } catch (error) {
            console.error('[Backup] Initialization failed:', error);
        }
    }
    
    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const cached = await Cache.get(`${this.cachePrefix}config`);
            if (cached && cached.data) {
                this.config = { ...this.config, ...cached.data };
                return;
            }
            
            const response = await API.get(`${this.apiEndpoint}/config`);
            
            if (response.success && response.data) {
                this.config = { ...this.config, ...response.data };
                await Cache.set(`${this.cachePrefix}config`, this.config, 3600000);
            }
            
        } catch (error) {
            console.error('[Backup] Config load failed:', error);
        }
    }
    
    /**
     * Load backup history
     */
    async loadBackupHistory() {
        try {
            const response = await API.get(`${this.apiEndpoint}/history`);
            
            if (response.success && response.data) {
                this.backups.clear();
                
                response.data.forEach(backup => {
                    this.backups.set(backup.id, {
                        ...backup,
                        formattedDate: Formatters.date(backup.createdAt),
                        formattedTime: Formatters.time(backup.createdAt),
                        formattedSize: this.formatFileSize(backup.size),
                        formattedDuration: this.formatDuration(backup.duration),
                        typeInfo: this.backupTypes[backup.type] || this.backupTypes.full,
                        statusInfo: this.backupStatuses[backup.status] || this.backupStatuses.pending,
                        canRestore: backup.status === 'completed' || backup.status === 'verified',
                        canVerify: backup.status === 'completed',
                        canDownload: backup.status === 'completed',
                        canDelete: backup.status !== 'in_progress' && backup.status !== 'restoring'
                    });
                });
                
                // Calculate stats
                this.calculateStats();
                
                console.log(`[Backup] Loaded ${this.backups.size} backups`);
            }
            
        } catch (error) {
            console.error('[Backup] History load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            EventBus.on('backup:create', this.createBackup.bind(this));
            EventBus.on('backup:restore', this.restoreBackup.bind(this));
            EventBus.on('backup:verify', this.verifyBackup.bind(this));
            EventBus.on('backup:delete', this.deleteBackup.bind(this));
            EventBus.on('backup:download', this.downloadBackup.bind(this));
            EventBus.on('backup:schedule', this.updateSchedule.bind(this));
            
            console.log('[Backup] Event listeners initialized');
            
        } catch (error) {
            console.error('[Backup] Event listener setup failed:', error);
        }
    }
    
    /**
     * Schedule auto-backup
     */
    scheduleAutoBackup() {
        try {
            // Clear existing timer
            if (this.autoBackupTimer) {
                clearInterval(this.autoBackupTimer);
            }
            
            if (!this.config.autoBackup || this.config.schedule === 'manual') {
                return;
            }
            
            // Calculate next backup time
            const schedule = this.schedules[this.config.schedule];
            if (!schedule || !schedule.cron) return;
            
            // Simple interval-based scheduling (cron parsing simplified)
            const intervals = {
                'hourly': 3600000,
                'daily': 86400000,
                'weekly': 604800000,
                'monthly': 2592000000
            };
            
            const interval = intervals[this.config.schedule] || 86400000;
            
            this.autoBackupTimer = setInterval(async () => {
                console.log('[Backup] Running scheduled backup...');
                await this.createBackup({
                    type: this.config.type,
                    scheduled: true
                });
            }, interval);
            
            console.log(`[Backup] Auto-backup scheduled: ${schedule.label}`);
            
        } catch (error) {
            console.error('[Backup] Schedule setup failed:', error);
        }
    }
    
    /**
     * Create a new backup
     */
    async createBackup(options = {}) {
        try {
            // Prevent concurrent backups
            if (this.isBackingUp) {
                Toast.show('A backup is already in progress', 'warning');
                return null;
            }
            
            this.isBackingUp = true;
            
            const config = {
                type: options.type || this.config.type,
                encrypt: options.encrypt !== undefined ? options.encrypt : this.config.encrypt,
                compress: options.compress !== undefined ? options.compress : this.config.compress,
                includeFiles: options.includeFiles !== undefined ? options.includeFiles : this.config.includeFiles,
                excludeEntities: options.excludeEntities || this.config.excludeEntities,
                storageProvider: options.storageProvider || this.config.storageProvider,
                scheduled: options.scheduled || false,
                label: options.label || `${this.config.type} backup - ${new Date().toLocaleString('en-IN')}`
            };
            
            Toast.show('Starting backup...', 'info');
            
            const startTime = performance.now();
            
            // Create backup via API
            const response = await API.post(`${this.apiEndpoint}/create`, config);
            
            if (!response.success) {
                throw new Error(response.error || 'Backup creation failed');
            }
            
            const backupData = response.data;
            
            // Add to local store
            const backup = {
                id: backupData.id,
                type: config.type,
                label: config.label,
                size: backupData.size || 0,
                entities: backupData.entities || [],
                status: 'completed',
                createdAt: new Date().toISOString(),
                duration: Math.round(performance.now() - startTime),
                scheduled: config.scheduled,
                storageProvider: config.storageProvider,
                verified: false,
                formattedDate: Formatters.date(new Date()),
                formattedTime: Formatters.time(new Date()),
                formattedSize: this.formatFileSize(backupData.size || 0),
                formattedDuration: this.formatDuration(Math.round(performance.now() - startTime)),
                typeInfo: this.backupTypes[config.type],
                statusInfo: this.backupStatuses.completed,
                canRestore: true,
                canVerify: true,
                canDownload: true,
                canDelete: true
            };
            
            this.backups.set(backup.id, backup);
            
            // Verify if configured
            if (this.config.verifyAfterBackup) {
                await this.verifyBackup(backup.id);
            }
            
            // Calculate stats
            this.calculateStats();
            
            // Update config
            this.config.lastBackupDate = new Date().toISOString();
            
            Toast.show(`Backup completed: ${backup.formattedSize}`, 'success');
            
            // Emit event
            EventBus.emit('backup:created', backup);
            
            return backup;
            
        } catch (error) {
            console.error('[Backup] Creation failed:', error);
            Toast.show('Backup failed: ' + error.message, 'error');
            return null;
        } finally {
            this.isBackingUp = false;
        }
    }
    
    /**
     * Restore from backup
     */
    async restoreBackup(backupId, options = {}) {
        try {
            if (this.isRestoring) {
                Toast.show('A restore is already in progress', 'warning');
                return;
            }
            
            const backup = this.backups.get(backupId);
            if (!backup) {
                throw new Error('Backup not found');
            }
            
            if (!backup.canRestore) {
                throw new Error('This backup cannot be restored');
            }
            
            // Show confirmation dialog
            const confirmed = await this.showRestoreConfirmation(backup, options);
            if (!confirmed) return;
            
            this.isRestoring = true;
            
            // Update restore state
            this.restoreState = {
                backupId: backupId,
                entities: options.entities || backup.entities || [],
                progress: 0,
                status: 'in_progress'
            };
            
            Toast.show('Starting restore...', 'info');
            
            // Call restore API
            const response = await API.post(`${this.apiEndpoint}/${backupId}/restore`, {
                entities: options.entities || [],
                includeFiles: options.includeFiles !== false,
                dryRun: options.dryRun || false
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Restore failed');
            }
            
            // Update progress
            this.restoreState.progress = 100;
            this.restoreState.status = 'completed';
            
            // Mark backup as restoring temporarily
            backup.status = 'completed';
            backup.statusInfo = this.backupStatuses.completed;
            this.backups.set(backupId, backup);
            
            Toast.show('Restore completed successfully', 'success');
            
            // Reload all data
            EventBus.emit('data:refresh');
            
            return response.data;
            
        } catch (error) {
            console.error('[Backup] Restore failed:', error);
            this.restoreState.status = 'failed';
            Toast.show('Restore failed: ' + error.message, 'error');
            return null;
        } finally {
            this.isRestoring = false;
        }
    }
    
    /**
     * Show restore confirmation dialog
     */
    async showRestoreConfirmation(backup, options = {}) {
        return new Promise((resolve) => {
            const content = `
                <div class="restore-confirmation">
                    <div class="warning-banner">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>
                            <strong>Warning!</strong>
                            <p>Restoring will overwrite existing data. This action cannot be undone.</p>
                        </div>
                    </div>
                    
                    <div class="backup-info">
                        <h5>Backup Details</h5>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Date</label>
                                <span>${backup.formattedDate} ${backup.formattedTime}</span>
                            </div>
                            <div class="info-item">
                                <label>Type</label>
                                <span>${backup.typeInfo.label}</span>
                            </div>
                            <div class="info-item">
                                <label>Size</label>
                                <span>${backup.formattedSize}</span>
                            </div>
                            <div class="info-item">
                                <label>Entities</label>
                                <span>${backup.entities?.length || 'All'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="restore-options">
                        <h5>Restore Options</h5>
                        <label>
                            <input type="checkbox" checked>
                            Restore all data
                        </label>
                        <label>
                            <input type="checkbox" checked>
                            Include uploaded files
                        </label>
                        <label>
                            <input type="checkbox">
                            Dry run (preview only)
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>Type "RESTORE" to confirm</label>
                        <input type="text" id="restore-confirm-input" placeholder="RESTORE">
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-danger confirm-btn" disabled>
                            <i class="fas fa-undo"></i> Restore Backup
                        </button>
                    </div>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Restore Backup',
                content,
                size: 'large',
                onClose: () => resolve(false)
            });
            
            modal.open();
            
            // Set up confirmation input
            setTimeout(() => {
                const input = document.getElementById('restore-confirm-input');
                const confirmBtn = document.querySelector('.confirm-btn');
                const cancelBtn = document.querySelector('.cancel-btn');
                
                input?.addEventListener('input', () => {
                    if (confirmBtn) {
                        confirmBtn.disabled = input.value !== 'RESTORE';
                    }
                });
                
                cancelBtn?.addEventListener('click', () => {
                    modal.close();
                    resolve(false);
                });
                
                confirmBtn?.addEventListener('click', () => {
                    modal.close();
                    resolve(true);
                });
            }, 100);
        });
    }
    
    /**
     * Verify backup integrity
     */
    async verifyBackup(backupId) {
        try {
            const backup = this.backups.get(backupId);
            if (!backup) throw new Error('Backup not found');
            
            Toast.show('Verifying backup integrity...', 'info');
            
            // Update status
            backup.status = 'in_progress';
            backup.statusInfo = this.backupStatuses.in_progress;
            
            const response = await API.post(`${this.apiEndpoint}/${backupId}/verify`);
            
            if (!response.success) {
                throw new Error(response.error || 'Verification failed');
            }
            
            // Update backup status
            backup.status = 'verified';
            backup.statusInfo = this.backupStatuses.verified;
            backup.verified = true;
            backup.verifiedAt = new Date().toISOString();
            backup.verificationResult = response.data;
            
            this.backups.set(backupId, backup);
            
            Toast.show('Backup verified successfully', 'success');
            
            return response.data;
            
        } catch (error) {
            console.error('[Backup] Verification failed:', error);
            
            // Update backup as failed
            const backup = this.backups.get(backupId);
            if (backup) {
                backup.status = 'failed';
                backup.statusInfo = this.backupStatuses.failed;
            }
            
            Toast.show('Verification failed: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Download backup locally
     */
    async downloadBackup(backupId) {
        try {
            const backup = this.backups.get(backupId);
            if (!backup) throw new Error('Backup not found');
            
            if (!backup.canDownload) {
                throw new Error('This backup cannot be downloaded');
            }
            
            Toast.show('Preparing download...', 'info');
            
            const response = await API.get(`${this.apiEndpoint}/${backupId}/download`, {
                responseType: 'blob'
            });
            
            if (response.data) {
                // Download file
                const url = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `backup-${backupId}-${backup.createdAt.split('T')[0]}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                Toast.show('Backup downloaded successfully', 'success');
            }
            
        } catch (error) {
            console.error('[Backup] Download failed:', error);
            Toast.show('Download failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Delete a backup
     */
    async deleteBackup(backupId) {
        try {
            const backup = this.backups.get(backupId);
            if (!backup) throw new Error('Backup not found');
            
            const confirmed = await this.confirmDialog(
                'Delete Backup',
                `Are you sure you want to delete backup from ${backup.formattedDate}?`
            );
            
            if (!confirmed) return;
            
            const response = await API.delete(`${this.apiEndpoint}/${backupId}`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            this.backups.delete(backupId);
            
            // Recalculate stats
            this.calculateStats();
            
            Toast.show('Backup deleted', 'info');
            
        } catch (error) {
            console.error('[Backup] Delete failed:', error);
            Toast.show('Failed to delete backup', 'error');
        }
    }
    
    /**
     * Update backup schedule
     */
    async updateSchedule(config) {
        try {
            const response = await API.put(`${this.apiEndpoint}/config`, config);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            this.config = { ...this.config, ...config };
            
            // Update cache
            await Cache.set(`${this.cachePrefix}config`, this.config, 3600000);
            
            // Reschedule
            this.scheduleAutoBackup();
            
            Toast.show('Backup schedule updated', 'success');
            
        } catch (error) {
            console.error('[Backup] Schedule update failed:', error);
            Toast.show('Failed to update schedule', 'error');
        }
    }
    
    /**
     * Calculate backup statistics
     */
    calculateStats() {
        try {
            const backups = Array.from(this.backups.values());
            
            if (backups.length === 0) {
                this.stats = {
                    totalBackups: 0,
                    lastBackupDate: null,
                    lastBackupSize: 0,
                    totalSize: 0,
                    averageSize: 0,
                    averageDuration: 0,
                    successRate: 100
                };
                return;
            }
            
            const completed = backups.filter(b => b.status === 'completed' || b.status === 'verified');
            const successful = completed.length;
            const total = backups.length;
            
            this.stats.totalBackups = total;
            this.stats.lastBackupDate = backups[0]?.createdAt || null;
            this.stats.lastBackupSize = backups[0]?.size || 0;
            this.stats.totalSize = completed.reduce((sum, b) => sum + (b.size || 0), 0);
            this.stats.averageSize = completed.length > 0 ? 
                Math.round(this.stats.totalSize / completed.length) : 0;
            this.stats.averageDuration = completed.length > 0 ?
                Math.round(completed.reduce((sum, b) => sum + (b.duration || 0), 0) / completed.length) : 0;
            this.stats.successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
            
        } catch (error) {
            console.error('[Backup] Stats calculation failed:', error);
        }
    }
    
    /**
     * Render backup management UI
     */
    async render(container) {
        try {
            if (!container) return;
            
            const html = `
                <div class="backup-container">
                    <!-- Stats Bar -->
                    <div class="backup-stats-bar">
                        <div class="stat-item">
                            <i class="fas fa-save"></i>
                            <span>${this.stats.totalBackups} Backups</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-hdd"></i>
                            <span>${this.formatFileSize(this.stats.totalSize)} Total</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-clock"></i>
                            <span>Last: ${this.stats.lastBackupDate ? Formatters.relativeTime(this.stats.lastBackupDate) : 'Never'}</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-check-circle"></i>
                            <span>${this.stats.successRate}% Success</span>
                        </div>
                    </div>
                    
                    <!-- Actions Bar -->
                    <div class="backup-actions-bar">
                        <button class="btn btn-primary" onclick="window.Global.Backup.createBackup()">
                            <i class="fas fa-plus"></i> Create Backup Now
                        </button>
                        <button class="btn btn-outline" onclick="window.Global.Backup.openBackupSettings()">
                            <i class="fas fa-cog"></i> Backup Settings
                        </button>
                        <button class="btn btn-outline" onclick="window.Global.Backup.loadBackupHistory()">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                    </div>
                    
                    <!-- Schedule Info -->
                    <div class="schedule-info">
                        <i class="fas fa-calendar-alt"></i>
                        <span>
                            ${this.config.autoBackup ? 
                                `Auto-backup: ${this.schedules[this.config.schedule]?.label || 'Daily'} • 
                                 Type: ${this.backupTypes[this.config.type]?.label || 'Full'} • 
                                 Retention: ${this.retentionPolicies[this.config.retention]?.label || '30 Days'}` :
                                'Auto-backup is disabled'}
                        </span>
                    </div>
                    
                    <!-- Backups Table -->
                    <div class="backup-list-container">
                        <h4><i class="fas fa-history"></i> Backup History</h4>
                        <div class="table-responsive">
                            <table class="backup-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Label</th>
                                        <th>Type</th>
                                        <th>Size</th>
                                        <th>Duration</th>
                                        <th>Status</th>
                                        <th>Storage</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderBackupRows()}
                                </tbody>
                            </table>
                        </div>
                        
                        ${this.backups.size === 0 ? this.renderEmptyState() : ''}
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            
            console.log('[Backup] UI rendered');
            
        } catch (error) {
            console.error('[Backup] Render failed:', error);
        }
    }
    
    /**
     * Render backup table rows
     */
    renderBackupRows() {
        if (this.backups.size === 0) {
            return '<tr><td colspan="8" class="text-center">No backups found</td></tr>';
        }
        
        return Array.from(this.backups.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(backup => `
                <tr>
                    <td>
                        <div>${backup.formattedDate}</div>
                        <small>${backup.formattedTime}</small>
                        ${backup.scheduled ? '<span class="scheduled-badge">Scheduled</span>' : ''}
                    </td>
                    <td>${this.escapeHtml(backup.label || '')}</td>
                    <td>
                        <span class="type-badge" style="background: ${backup.typeInfo.color}20; color: ${backup.typeInfo.color}">
                            <i class="fas ${backup.typeInfo.icon}"></i>
                            ${backup.typeInfo.label}
                        </span>
                    </td>
                    <td>${backup.formattedSize}</td>
                    <td>${backup.formattedDuration}</td>
                    <td>
                        <span class="status-badge" style="background: ${backup.statusInfo.color}20; color: ${backup.statusInfo.color}">
                            <i class="fas ${backup.statusInfo.icon}"></i>
                            ${backup.statusInfo.label}
                        </span>
                    </td>
                    <td>${this.storageProviders[backup.storageProvider]?.label || 'Firebase'}</td>
                    <td>
                        <div class="action-buttons">
                            ${backup.canRestore ? `
                                <button class="btn btn-sm btn-primary" onclick="window.Global.Backup.restoreBackup('${backup.id}')">
                                    <i class="fas fa-undo"></i> Restore
                                </button>
                            ` : ''}
                            ${backup.canDownload ? `
                                <button class="btn-icon" title="Download" onclick="window.Global.Backup.downloadBackup('${backup.id}')">
                                    <i class="fas fa-download"></i>
                                </button>
                            ` : ''}
                            ${backup.canVerify ? `
                                <button class="btn-icon" title="Verify" onclick="window.Global.Backup.verifyBackup('${backup.id}')">
                                    <i class="fas fa-shield-alt"></i>
                                </button>
                            ` : ''}
                            ${backup.canDelete ? `
                                <button class="btn-icon" title="Delete" onclick="window.Global.Backup.deleteBackup('${backup.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
    }
    
    /**
     * Open backup settings modal
     */
    async openBackupSettings() {
        try {
            const settingsHtml = `
                <div class="backup-settings-form">
                    <form id="backup-settings-form">
                        <div class="form-section">
                            <h4><i class="fas fa-clock"></i> Schedule</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label class="toggle-switch">
                                        <input type="checkbox" name="autoBackup" ${this.config.autoBackup ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                        Enable Auto-Backup
                                    </label>
                                </div>
                                <div class="form-group col-6">
                                    <label>Frequency</label>
                                    <select name="schedule">
                                        ${Object.entries(this.schedules).map(([key, s]) => `
                                            <option value="${key}" ${this.config.schedule === key ? 'selected' : ''}>
                                                ${s.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-cog"></i> Backup Type</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label>Default Type</label>
                                    <select name="type">
                                        ${Object.entries(this.backupTypes).map(([key, type]) => `
                                            <option value="${key}" ${this.config.type === key ? 'selected' : ''}>
                                                ${type.label} - ${type.description}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label>Retention Period</label>
                                    <select name="retention">
                                        ${Object.entries(this.retentionPolicies).map(([key, policy]) => `
                                            <option value="${key}" ${this.config.retention === key ? 'selected' : ''}>
                                                ${policy.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4><i class="fas fa-shield-alt"></i> Security</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label class="toggle-check">
                                        <input type="checkbox" name="encrypt" ${this.config.encrypt ? 'checked' : ''}>
                                        Encrypt backups
                                    </label>
                                </div>
                                <div class="form-group col-4">
                                    <label class="toggle-check">
                                        <input type="checkbox" name="compress" ${this.config.compress ? 'checked' : ''}>
                                        Compress data
                                    </label>
                                </div>
                                <div class="form-group col-4">
                                    <label class="toggle-check">
                                        <input type="checkbox" name="verifyAfterBackup" ${this.config.verifyAfterBackup ? 'checked' : ''}>
                                        Verify after backup
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Save Settings
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: 'Backup Settings',
                content: settingsHtml,
                size: 'large'
            });
            
            modal.open();
            
            setTimeout(() => {
                const form = document.getElementById('backup-settings-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData(form);
                        const config = {
                            autoBackup: formData.get('autoBackup') === 'on',
                            schedule: formData.get('schedule'),
                            type: formData.get('type'),
                            retention: formData.get('retention'),
                            encrypt: formData.get('encrypt') === 'on',
                            compress: formData.get('compress') === 'on',
                            verifyAfterBackup: formData.get('verifyAfterBackup') === 'on'
                        };
                        
                        await this.updateSchedule(config);
                        Modal.close();
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('[Backup] Settings open failed:', error);
        }
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    
    /**
     * Format duration in milliseconds
     */
    formatDuration(ms) {
        if (!ms || ms < 1000) return '< 1s';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-database"></i>
                </div>
                <h3>No Backups Yet</h3>
                <p>Create your first backup to protect your data</p>
                <button class="btn btn-primary" onclick="window.Global.Backup.createBackup()">
                    <i class="fas fa-plus"></i> Create Backup
                </button>
            </div>
        `;
    }
    
    /**
     * Confirm dialog
     */
    confirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title,
                content: `
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary confirm-btn">Confirm</button>
                    </div>
                `,
                size: 'small',
                onClose: () => resolve(false)
            });
            
            modal.open();
            
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(false);
                });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => {
                    modal.close();
                    resolve(true);
                });
            }, 100);
        });
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
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
        }
        
        EventBus.off('backup:create');
        EventBus.off('backup:restore');
        EventBus.off('backup:verify');
        EventBus.off('backup:delete');
        EventBus.off('backup:download');
        EventBus.off('backup:schedule');
        
        console.log('[Backup] Module destroyed');
    }
}

// Singleton
const backup = new BackupUtil();

// Exports
export { backup, BackupUtil };
export default backup;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Backup = backup;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
