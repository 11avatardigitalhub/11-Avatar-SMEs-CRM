/**
 * 11 AVATAR DIGITAL HUB - Google Drive Integration Module
 * Enterprise-grade Google Drive cloud storage integration
 * File management, folder sync, permissions, Drive Picker, shared drives
 * 
 * @module GoogleDriveIntegration
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Google Drive Integration - Complete cloud storage management
 * OAuth, file CRUD, folder sync, sharing, Drive Picker API
 */
class GoogleDriveIntegration {
    constructor() {
        this.moduleName = 'googleDrive';
        this.apiEndpoint = '/api/drive';
        this.cachePrefix = 'gdrive_';
        this.cacheTimeout = 5 * 60 * 1000;

        this.fileTypes = {
            'folder': { label: 'Folder', icon: 'fa-folder', color: '#F59E0B' },
            'document': { label: 'Google Doc', icon: 'fa-file-alt', color: '#3B82F6' },
            'spreadsheet': { label: 'Google Sheet', icon: 'fa-file-excel', color: '#10B981' },
            'presentation': { label: 'Google Slide', icon: 'fa-file-powerpoint', color: '#F97316' },
            'pdf': { label: 'PDF', icon: 'fa-file-pdf', color: '#DC2626' },
            'image': { label: 'Image', icon: 'fa-image', color: '#8B5CF6' },
            'video': { label: 'Video', icon: 'fa-video', color: '#EC4899' },
            'archive': { label: 'Archive', icon: 'fa-file-archive', color: '#6B7280' },
            'other': { label: 'Other', icon: 'fa-file', color: '#9CA3AF' }
        };

        this.permissionRoles = {
            'owner': { label: 'Owner', icon: 'fa-crown', color: '#F59E0B' },
            'organizer': { label: 'Organizer', icon: 'fa-sitemap', color: '#8B5CF6' },
            'fileOrganizer': { label: 'File Organizer', icon: 'fa-folder-open', color: '#3B82F6' },
            'writer': { label: 'Editor', icon: 'fa-edit', color: '#10B981' },
            'commenter': { label: 'Commenter', icon: 'fa-comment', color: '#6366F1' },
            'reader': { label: 'Viewer', icon: 'fa-eye', color: '#6B7280' }
        };

        this.connectionStatus = {
            'disconnected': { label: 'Disconnected', color: '#6B7280' },
            'connected': { label: 'Connected', color: '#10B981' },
            'error': { label: 'Token Expired', color: '#DC2626' }
        };

        this.files = new Map();
        this.folders = new Map();
        this.sharedDrives = new Map();
        this.currentFolderId = 'root';
        this.selectedFileId = null;

        this.config = {
            clientId: null,
            apiKey: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            connectedEmail: null,
            storageUsed: 0,
            storageLimit: 0,
            rootFolderId: 'root',
            autoSync: false,
            syncFolder: null
        };

        this.filters = { type: 'all', search: '', parentFolder: 'root' };
        this.pagination = { page: 1, limit: 50, total: 0, nextPageToken: null };
        this.currentView = 'files';

        this.metrics = {
            totalFiles: 0, totalFolders: 0, totalSize: 0,
            storageUsedPercent: 0, recentlyModified: 0, lastSync: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[GoogleDrive] Initializing Google Drive integration...');
            const canAccess = await Permissions.check('drive', 'read');
            if (!canAccess) { console.warn('[GoogleDrive] Access denied'); return; }

            await this.loadConfiguration();
            if (this.config.accessToken) {
                await this.loadFiles();
                await this.loadSharedDrives();
            }
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('drive-container')) await this.render();
            console.log('[GoogleDrive] Initialized');
            EventBus.emit('drive:ready', { connected: !!this.config.accessToken });
        } catch (error) {
            console.error('[GoogleDrive] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.config = { ...this.config, ...response.data };
            }
        } catch (error) { console.error('[GoogleDrive] Config load failed:', error); }
    }

    async loadFiles(folderId = 'root', page = 1) {
        try {
            if (!this.config.accessToken) return;
            this.currentFolderId = folderId;
            this.pagination.page = page;

            const params = new URLSearchParams({
                folderId, page: page.toString(), limit: this.pagination.limit.toString()
            });
            if (this.filters.search) params.set('search', this.filters.search);
            if (this.filters.type !== 'all') params.set('type', this.filters.type);

            const response = await API.get(`${this.apiEndpoint}/files?${params.toString()}`);
            if (response.success && response.data) {
                if (page === 1) { this.files.clear(); this.folders.clear(); }
                
                response.data.files?.forEach(file => {
                    const processed = {
                        ...file,
                        formattedSize: this.formatFileSize(file.size || 0),
                        formattedModified: Formatters.relativeTime(file.modifiedTime),
                        typeInfo: this.getFileTypeInfo(file),
                        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
                        thumbnailUrl: file.thumbnailLink || this.getFileIcon(file),
                        webViewLink: file.webViewLink || '',
                        permissions: file.permissions || [],
                        isStarred: file.starred || false,
                        isShared: file.shared || false
                    };

                    if (processed.isFolder) {
                        this.folders.set(file.id, processed);
                    } else {
                        this.files.set(file.id, processed);
                    }
                });

                this.pagination.total = response.data.total || 0;
                this.pagination.nextPageToken = response.data.nextPageToken || null;
                this.metrics.totalFiles = this.files.size;
                this.metrics.totalFolders = this.folders.size;
            }
        } catch (error) { console.error('[GoogleDrive] Files load failed:', error); }
    }

    async loadSharedDrives() {
        try {
            const response = await API.get(`${this.apiEndpoint}/shared-drives`);
            if (response.success && response.data) {
                this.sharedDrives.clear();
                response.data.drives?.forEach(drive => {
                    this.sharedDrives.set(drive.id, {
                        ...drive, memberCount: drive.memberCount || 0
                    });
                });
            }
        } catch (error) { console.error('[GoogleDrive] Shared drives load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('drive:connect', this.connect.bind(this));
        EventBus.on('drive:disconnect', this.disconnect.bind(this));
        EventBus.on('drive:upload', this.uploadFile.bind(this));
        EventBus.on('drive:download', this.downloadFile.bind(this));
        EventBus.on('drive:delete', this.deleteFile.bind(this));
        EventBus.on('drive:create-folder', this.createFolder.bind(this));
        EventBus.on('drive:share', this.shareFile.bind(this));
        EventBus.on('drive:search', this.searchFiles.bind(this));
        EventBus.on('drive:open-picker', this.openDrivePicker.bind(this));
        console.log('[GoogleDrive] Event listeners initialized');
    }

    async connect() {
        try {
            const response = await API.get(`${this.apiEndpoint}/auth-url`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 700;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'DriveAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 120000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'drive-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'drive-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code });
            await this.loadConfiguration();
            await this.loadFiles();
            await this.loadSharedDrives();
            Toast.show('Google Drive connected!', 'success');
            EventBus.emit('drive:connected');
        } catch (error) {
            console.error('[GoogleDrive] Connection failed:', error);
            Toast.show('Connection failed: ' + error.message, 'error');
        }
    }

    async disconnect() {
        try {
            const confirmed = await this.confirmDialog('Disconnect Drive', 'Disconnect Google Drive? Files will not be deleted.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.config.accessToken = null;
            this.files.clear();
            this.folders.clear();
            this.sharedDrives.clear();
            Toast.show('Google Drive disconnected', 'info');
            await this.render();
        } catch (error) {
            console.error('[GoogleDrive] Disconnect failed:', error);
        }
    }

    async uploadFile(file) {
        try {
            Toast.show('Uploading...', 'info');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folderId', this.currentFolderId);
            formData.append('metadata', JSON.stringify({
                name: file.name,
                mimeType: file.type,
                parents: [this.currentFolderId]
            }));

            const response = await API.upload(`${this.apiEndpoint}/upload`, formData);
            if (!response.success) throw new Error(response.error);
            Toast.show('File uploaded!', 'success');
            await this.loadFiles(this.currentFolderId);
            return response.data;
        } catch (error) {
            console.error('[GoogleDrive] Upload failed:', error);
            Toast.show('Upload failed', 'error');
            return null;
        }
    }

    async downloadFile(fileId) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');
            
            const response = await API.get(`${this.apiEndpoint}/download/${fileId}`, { responseType: 'blob' });
            if (response.data) {
                const url = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('[GoogleDrive] Download failed:', error);
            Toast.show('Download failed', 'error');
        }
    }

    async deleteFile(fileId) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');
            const confirmed = await this.confirmDialog('Delete', `Delete "${file.name}"? This moves it to Drive trash.`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/files/${fileId}`);
            this.files.delete(fileId);
            this.folders.delete(fileId);
            Toast.show('Moved to trash', 'info');
            await this.loadFiles(this.currentFolderId);
        } catch (error) {
            console.error('[GoogleDrive] Delete failed:', error);
        }
    }

    async createFolder(folderName) {
        try {
            const response = await API.post(`${this.apiEndpoint}/folders`, {
                name: folderName,
                parentId: this.currentFolderId
            });
            if (!response.success) throw new Error(response.error);
            Toast.show(`Folder "${folderName}" created`, 'success');
            await this.loadFiles(this.currentFolderId);
            return response.data;
        } catch (error) {
            console.error('[GoogleDrive] Folder creation failed:', error);
            return null;
        }
    }

    async shareFile(fileId) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');

            const shareHtml = `
                <div class="share-form">
                    <form id="share-form">
                        <p>Sharing: <strong>${this.escapeHtml(file.name)}</strong></p>
                        <div class="form-group">
                            <label>Email Address *</label>
                            <input type="email" name="email" required placeholder="colleague@example.com">
                        </div>
                        <div class="form-group">
                            <label>Permission *</label>
                            <select name="role" required>
                                ${Object.entries(this.permissionRoles).filter(([k]) => !['owner'].includes(k)).map(([key, role]) => `
                                    <option value="${key}">${role.label} - ${key === 'writer' ? 'Can edit' : key === 'commenter' ? 'Can comment' : 'Can view'}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="notify" checked> Notify person via email
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="share-message">Message (optional)</label>
                            <textarea name="message" rows="2" placeholder="Add a note..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                            <button type="submit" class="btn btn-primary"><i class="fas fa-share"></i> Share</button>
                        </div>
                    </form>
                </div>`;

            const modal = new Modal({ title: 'Share File', content: shareHtml, size: 'medium' });
            modal.open();

            setTimeout(() => {
                document.getElementById('share-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const result = await API.post(`${this.apiEndpoint}/files/${fileId}/share`, {
                        email: formData.get('email'), role: formData.get('role'),
                        message: formData.get('message'), notify: formData.get('notify') === 'on'
                    });
                    if (result.success) { Modal.close(); Toast.show('File shared!', 'success'); }
                });
            }, 100);
        } catch (error) {
            console.error('[GoogleDrive] Share failed:', error);
        }
    }

    async searchFiles(query) {
        this.filters.search = query;
        await this.loadFiles(this.currentFolderId);
        await this.render();
    }

    async openDrivePicker() {
        if (!this.config.accessToken) {
            Toast.show('Connect Google Drive first', 'warning');
            return;
        }
        // Google Picker API integration
        Toast.show('Drive Picker opening...', 'info');
        // In production: load Google Picker API and handle OAuth token
        EventBus.emit('drive:picker-opened');
    }

    getFileTypeInfo(file) {
        const mimeType = file.mimeType || '';
        if (mimeType.includes('folder')) return this.fileTypes.folder;
        if (mimeType.includes('document')) return this.fileTypes.document;
        if (mimeType.includes('spreadsheet')) return this.fileTypes.spreadsheet;
        if (mimeType.includes('presentation')) return this.fileTypes.presentation;
        if (mimeType.includes('pdf')) return this.fileTypes.pdf;
        if (mimeType.includes('image')) return this.fileTypes.image;
        if (mimeType.includes('video')) return this.fileTypes.video;
        if (mimeType.includes('zip') || mimeType.includes('rar')) return this.fileTypes.archive;
        return this.fileTypes.other;
    }

    getFileIcon(file) {
        const typeInfo = this.getFileTypeInfo(file);
        return `<i class="fas ${typeInfo.icon}" style="color:${typeInfo.color}"></i>`;
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    calculateMetrics() {
        let totalSize = 0;
        this.files.forEach(f => { totalSize += f.size || 0; });
        this.metrics.totalSize = totalSize;
        this.metrics.storageUsedPercent = this.config.storageLimit > 0 ? 
            Math.round((this.config.storageUsed / this.config.storageLimit) * 100) : 0;
        this.metrics.lastSync = new Date();
    }

    async render(container = null) {
        const target = container || document.getElementById('drive-container');
        if (!target) return;

        const isConnected = !!this.config.accessToken;
        const connStatus = this.connectionStatus[isConnected ? 'connected' : 'disconnected'];

        const html = `
            <div class="drive-container">
                <div class="drive-header">
                    <h3><i class="fab fa-google-drive"></i> Google Drive</h3>
                    <div class="header-actions">
                        ${isConnected ? `
                            <button class="btn btn-outline" onclick="window.Global.Drive.createFolder(prompt('Folder name:'))"><i class="fas fa-folder-plus"></i> New Folder</button>
                            <button class="btn btn-primary" onclick="document.getElementById('drive-file-input').click()"><i class="fas fa-upload"></i> Upload</button>
                            <input type="file" id="drive-file-input" style="display:none" onchange="window.Global.Drive.uploadFile(this.files[0])">
                            <button class="btn btn-outline" onclick="window.Global.Drive.disconnect()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.Drive.connect()"><i class="fab fa-google"></i> Connect Drive</button>
                        `}
                    </div>
                </div>

                <div class="drive-status" style="background:${connStatus.color}15;color:${connStatus.color}">
                    <span>${connStatus.label}</span>
                    ${isConnected ? `<span>| ${this.config.connectedEmail}</span>` : ''}
                    ${this.metrics.storageUsedPercent > 0 ? `
                        <div class="storage-bar">
                            <div class="storage-fill" style="width:${this.metrics.storageUsedPercent}%"></div>
                        </div>
                        <small>${this.formatFileSize(this.config.storageUsed)} / ${this.formatFileSize(this.config.storageLimit)}</small>
                    ` : ''}
                </div>

                ${isConnected ? `
                    <div class="drive-breadcrumb">
                        <button class="btn btn-sm btn-outline" onclick="window.Global.Drive.navigateTo('root')"><i class="fas fa-hdd"></i> My Drive</button>
                        ${Array.from(this.sharedDrives.values()).map(drive => `
                            <button class="btn btn-sm btn-outline" onclick="window.Global.Drive.navigateTo('${drive.id}')"><i class="fas fa-users"></i> ${this.escapeHtml(drive.name)}</button>
                        `).join('')}
                    </div>

                    <div class="drive-search">
                        <input type="text" placeholder="Search files..." oninput="window.Global.Drive.searchFiles(this.value)">
                    </div>

                    <div class="drive-files">
                        <div class="files-grid">
                            ${Array.from(this.folders.values()).map(folder => `
                                <div class="file-card folder" ondblclick="window.Global.Drive.navigateTo('${folder.id}')">
                                    <i class="fas fa-folder" style="color:#F59E0B;font-size:36px;"></i>
                                    <span class="file-name">${this.escapeHtml(folder.name)}</span>
                                </div>
                            `).join('')}
                            ${Array.from(this.files.values()).map(file => `
                                <div class="file-card">
                                    <i class="fas ${file.typeInfo.icon}" style="color:${file.typeInfo.color};font-size:36px;"></i>
                                    <span class="file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name.substring(0, 25))}${file.name.length > 25 ? '...' : ''}</span>
                                    <small>${file.formattedSize}</small>
                                    <div class="file-actions">
                                        <button class="btn-icon" onclick="window.Global.Drive.downloadFile('${file.id}')" title="Download"><i class="fas fa-download"></i></button>
                                        <button class="btn-icon" onclick="window.Global.Drive.shareFile('${file.id}')" title="Share"><i class="fas fa-share"></i></button>
                                        <button class="btn-icon" onclick="window.Global.Drive.deleteFile('${file.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ${this.files.size === 0 && this.folders.size === 0 ? '<div class="empty-state"><i class="fab fa-google-drive"></i><p>This folder is empty</p></div>' : ''}
                    </div>
                ` : `
                    <div class="connect-prompt">
                        <i class="fab fa-google-drive"></i>
                        <h4>Connect Google Drive</h4>
                        <p>Access, upload, and manage your Drive files directly from the CRM</p>
                        <button class="btn btn-primary" onclick="window.Global.Drive.connect()"><i class="fab fa-google"></i> Connect Google Drive</button>
                    </div>
                `}
            </div>`;

        target.innerHTML = html;
    }

    async navigateTo(folderId) {
        await this.loadFiles(folderId);
        await this.render();
    }

    confirmDialog(title, message) {
        return new Promise(resolve => {
            const modal = new Modal({ title, content: `<p>${message}</p><div class="modal-actions"><button class="btn btn-secondary cancel-btn">Cancel</button><button class="btn btn-primary confirm-btn">Confirm</button></div>`, size: 'small', onClose: () => resolve(false) });
            modal.open();
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => { modal.close(); resolve(false); });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => { modal.close(); resolve(true); });
            }, 100);
        });
    }

    escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; }

    destroy() {
        EventBus.off('drive:connect'); EventBus.off('drive:disconnect'); EventBus.off('drive:upload');
        EventBus.off('drive:download'); EventBus.off('drive:delete'); EventBus.off('drive:share');
        console.log('[GoogleDrive] Module destroyed');
    }
}

const googleDriveIntegration = new GoogleDriveIntegration();
export { googleDriveIntegration, GoogleDriveIntegration };
export default googleDriveIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Drive = googleDriveIntegration; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
