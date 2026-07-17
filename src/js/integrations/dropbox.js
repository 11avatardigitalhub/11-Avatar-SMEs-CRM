/**
 * 11 AVATAR DIGITAL HUB - Dropbox Integration Module
 * Enterprise-grade Dropbox cloud storage integration
 * File sync, sharing, team folders, paper docs, backup storage
 * 
 * @module DropboxIntegration
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
 * Dropbox Integration - Complete Dropbox cloud storage management
 * OAuth, file CRUD, folder sync, sharing, team management
 */
class DropboxIntegration {
    constructor() {
        this.moduleName = 'dropbox';
        this.apiEndpoint = '/api/dropbox';
        this.cachePrefix = 'dbx_';
        this.cacheTimeout = 5 * 60 * 1000;

        this.connectionStatus = {
            'disconnected': { label: 'Disconnected', color: '#6B7280', icon: 'fa-circle' },
            'connected': { label: 'Connected', color: '#10B981', icon: 'fa-check-circle' },
            'error': { label: 'Token Error', color: '#DC2626', icon: 'fa-exclamation-circle' }
        };

        this.sharingAccess = {
            'viewer': { label: 'Can View', icon: 'fa-eye', color: '#6B7280' },
            'editor': { label: 'Can Edit', icon: 'fa-edit', color: '#3B82F6' }
        };

        this.files = new Map();
        this.folders = new Map();
        this.sharedLinks = new Map();
        this.currentPath = '';
        this.selectedFileId = null;

        this.config = {
            appKey: null,
            appSecret: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            accountEmail: null,
            accountName: null,
            accountType: null,
            spaceUsed: 0,
            spaceAllocated: 0,
            rootNamespaceId: null,
            autoSync: false
        };

        this.filters = { type: 'all', search: '', path: '' };
        this.pagination = { page: 1, limit: 50, total: 0, hasMore: false, cursor: null };
        this.uploadProgress = new Map();
        this.transferSpeed = 0;

        this.metrics = {
            totalFiles: 0, totalFolders: 0, totalSize: 0,
            spaceUsedPercent: 0, recentFiles: 0, lastSync: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Dropbox] Initializing Dropbox integration...');
            const canAccess = await Permissions.check('dropbox', 'read');
            if (!canAccess) { console.warn('[Dropbox] Access denied'); return; }

            await this.loadConfiguration();
            if (this.config.accessToken) await this.loadFiles('');
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('dropbox-container')) await this.render();
            console.log('[Dropbox] Initialized');
            EventBus.emit('dropbox:ready', { connected: !!this.config.accessToken });
        } catch (error) {
            console.error('[Dropbox] Init failed:', error);
        }
    }

    async loadConfiguration() {
        try {
            const response = await API.get(`${this.apiEndpoint}/config`);
            if (response.success && response.data) {
                this.config = { ...this.config, ...response.data };
            }
        } catch (error) { console.error('[Dropbox] Config load failed:', error); }
    }

    async loadFiles(path = '', page = 1) {
        try {
            if (!this.config.accessToken) return;
            this.currentPath = path;
            this.pagination.page = page;

            const params = new URLSearchParams({ path, page: page.toString(), limit: this.pagination.limit.toString() });
            if (this.filters.search) params.set('search', this.filters.search);

            const response = await API.get(`${this.apiEndpoint}/files?${params.toString()}`);
            if (response.success && response.data) {
                if (page === 1) { this.files.clear(); this.folders.clear(); }

                response.data.entries?.forEach(entry => {
                    const processed = {
                        ...entry,
                        formattedSize: this.formatFileSize(entry.size || 0),
                        formattedModified: Formatters.relativeTime(entry.server_modified || entry.client_modified),
                        isFolder: entry['.tag'] === 'folder',
                        fileType: this.getFileType(entry.name || ''),
                        thumbnailUrl: entry.thumbnail || null,
                        isShared: entry.sharing_info?.read_only !== undefined,
                        sharingInfo: entry.sharing_info || null
                    };

                    if (processed.isFolder) {
                        this.folders.set(entry.id || entry.path_lower, processed);
                    } else {
                        this.files.set(entry.id || entry.path_lower, processed);
                    }
                });

                this.pagination.total = response.data.total || 0;
                this.pagination.hasMore = response.data.has_more || false;
                this.pagination.cursor = response.data.cursor || null;
                this.metrics.totalFiles = this.files.size;
                this.metrics.totalFolders = this.folders.size;
            }
        } catch (error) { console.error('[Dropbox] Files load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('dropbox:connect', this.connect.bind(this));
        EventBus.on('dropbox:disconnect', this.disconnect.bind(this));
        EventBus.on('dropbox:upload', this.uploadFile.bind(this));
        EventBus.on('dropbox:download', this.downloadFile.bind(this));
        EventBus.on('dropbox:delete', this.deleteFile.bind(this));
        EventBus.on('dropbox:create-folder', this.createFolder.bind(this));
        EventBus.on('dropbox:share', this.createSharedLink.bind(this));
        EventBus.on('dropbox:search', this.searchFiles.bind(this));
        EventBus.on('dropbox:move', this.moveFile.bind(this));
        EventBus.on('dropbox:copy', this.copyFile.bind(this));
        console.log('[Dropbox] Event listeners initialized');
    }

    async connect() {
        try {
            const response = await API.get(`${this.apiEndpoint}/auth-url`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 650;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'DropboxAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 120000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'dropbox-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'dropbox-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { code: authResult.code });
            await this.loadConfiguration();
            await this.loadFiles('');
            Toast.show('Dropbox connected!', 'success');
            EventBus.emit('dropbox:connected', this.config);
            await this.render();
        } catch (error) {
            console.error('[Dropbox] Connection failed:', error);
            Toast.show('Connection failed: ' + error.message, 'error');
        }
    }

    async disconnect() {
        try {
            const confirmed = await this.confirmDialog('Disconnect Dropbox', 'Disconnect your Dropbox account? Files will not be deleted.');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/disconnect`);
            this.config.accessToken = null;
            this.files.clear();
            this.folders.clear();
            Toast.show('Dropbox disconnected', 'info');
            await this.render();
        } catch (error) {
            console.error('[Dropbox] Disconnect failed:', error);
        }
    }

    async uploadFile(file, targetPath = '') {
        try {
            const uploadPath = targetPath || this.currentPath;
            Toast.show(`Uploading ${file.name}...`, 'info');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', `${uploadPath}/${file.name}`);
            formData.append('mode', 'add');
            formData.append('autorename', 'true');

            const xhr = new XMLHttpRequest();
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        this.uploadProgress.set(file.name, percent);
                        EventBus.emit('dropbox:upload-progress', { file: file.name, progress: percent });
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error')));
            });

            xhr.open('POST', `${this.apiEndpoint}/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${this.config.accessToken}`);
            xhr.send(formData);

            const result = await uploadPromise;
            this.uploadProgress.delete(file.name);
            Toast.show(`${file.name} uploaded!`, 'success');
            await this.loadFiles(this.currentPath);
            return result;
        } catch (error) {
            console.error('[Dropbox] Upload failed:', error);
            Toast.show('Upload failed: ' + error.message, 'error');
            return null;
        }
    }

    async downloadFile(fileId) {
        try {
            const file = this.files.get(fileId);
            if (!file) throw new Error('File not found');

            Toast.show('Downloading...', 'info');
            const response = await API.get(`${this.apiEndpoint}/download/${encodeURIComponent(file.path_lower || fileId)}`, { responseType: 'blob' });

            if (response.data) {
                const url = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                Toast.show('Download complete', 'success');
            }
        } catch (error) {
            console.error('[Dropbox] Download failed:', error);
            Toast.show('Download failed', 'error');
        }
    }

    async deleteFile(fileId) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');
            const confirmed = await this.confirmDialog('Delete', `Delete "${file.name}"? This cannot be undone.`);
            if (!confirmed) return;

            await API.delete(`${this.apiEndpoint}/files/${encodeURIComponent(file.path_lower || fileId)}`);
            this.files.delete(fileId);
            this.folders.delete(fileId);
            Toast.show('Deleted', 'info');
            await this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('[Dropbox] Delete failed:', error);
        }
    }

    async createFolder(folderName) {
        try {
            const path = `${this.currentPath}/${folderName}`;
            const response = await API.post(`${this.apiEndpoint}/folders`, { path, autorename: true });
            if (!response.success) throw new Error(response.error);
            Toast.show(`Folder "${folderName}" created`, 'success');
            await this.loadFiles(this.currentPath);
            return response.data;
        } catch (error) {
            console.error('[Dropbox] Folder creation failed:', error);
            Toast.show('Failed to create folder', 'error');
            return null;
        }
    }

    async createSharedLink(fileId) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');

            const shareHtml = `
                <div class="share-form">
                    <p>Create shared link for: <strong>${this.escapeHtml(file.name)}</strong></p>
                    <div class="form-group">
                        <label>Access Level</label>
                        <select name="access" id="share-access">
                            ${Object.entries(this.sharingAccess).map(([key, acc]) => `
                                <option value="${key}">${acc.label}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="requirePassword"> Require password
                        </label>
                    </div>
                    <div class="form-group" id="password-field" style="display:none;">
                        <label>Password</label>
                        <input type="text" name="password" placeholder="Enter password">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="expires"> Set expiry date
                        </label>
                    </div>
                    <div class="form-group" id="expiry-field" style="display:none;">
                        <label>Expires On</label>
                        <input type="date" name="expiryDate">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-link"></i> Create Link</button>
                    </div>
                </div>`;

            const modal = new Modal({ title: 'Create Shared Link', content: shareHtml, size: 'medium' });
            modal.open();

            setTimeout(() => {
                document.querySelector('[name="requirePassword"]')?.addEventListener('change', function() {
                    document.getElementById('password-field').style.display = this.checked ? 'block' : 'none';
                });
                document.querySelector('[name="expires"]')?.addEventListener('change', function() {
                    document.getElementById('expiry-field').style.display = this.checked ? 'block' : 'none';
                });
            }, 100);
        } catch (error) {
            console.error('[Dropbox] Share failed:', error);
        }
    }

    async moveFile(fileId, newPath) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');
            const response = await API.post(`${this.apiEndpoint}/move`, {
                fromPath: file.path_lower || fileId,
                toPath: `${newPath}/${file.name}`
            });
            if (!response.success) throw new Error(response.error);
            Toast.show('File moved', 'success');
            await this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('[Dropbox] Move failed:', error);
        }
    }

    async copyFile(fileId, newPath) {
        try {
            const file = this.files.get(fileId) || this.folders.get(fileId);
            if (!file) throw new Error('File not found');
            const response = await API.post(`${this.apiEndpoint}/copy`, {
                fromPath: file.path_lower || fileId,
                toPath: `${newPath}/${file.name} (Copy)`
            });
            if (!response.success) throw new Error(response.error);
            Toast.show('File copied', 'success');
            await this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('[Dropbox] Copy failed:', error);
        }
    }

    async searchFiles(query) {
        this.filters.search = query;
        await this.loadFiles(this.currentPath);
        await this.render();
    }

    getFileType(filename) {
        const ext = (filename || '').split('.').pop()?.toLowerCase();
        const typeMap = {
            'jpg': { icon: 'fa-image', color: '#8B5CF6' }, 'jpeg': { icon: 'fa-image', color: '#8B5CF6' },
            'png': { icon: 'fa-image', color: '#8B5CF6' }, 'gif': { icon: 'fa-image', color: '#8B5CF6' },
            'pdf': { icon: 'fa-file-pdf', color: '#DC2626' },
            'doc': { icon: 'fa-file-word', color: '#3B82F6' }, 'docx': { icon: 'fa-file-word', color: '#3B82F6' },
            'xls': { icon: 'fa-file-excel', color: '#10B981' }, 'xlsx': { icon: 'fa-file-excel', color: '#10B981' },
            'ppt': { icon: 'fa-file-powerpoint', color: '#F97316' }, 'pptx': { icon: 'fa-file-powerpoint', color: '#F97316' },
            'zip': { icon: 'fa-file-archive', color: '#6B7280' }, 'rar': { icon: 'fa-file-archive', color: '#6B7280' },
            'mp4': { icon: 'fa-video', color: '#EC4899' }, 'mov': { icon: 'fa-video', color: '#EC4899' },
            'mp3': { icon: 'fa-music', color: '#14B8A6' }, 'wav': { icon: 'fa-music', color: '#14B8A6' }
        };
        return typeMap[ext] || { icon: 'fa-file', color: '#9CA3AF' };
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
        this.metrics.spaceUsedPercent = this.config.spaceAllocated > 0 ?
            Math.round((this.config.spaceUsed / this.config.spaceAllocated) * 100) : 0;
        this.metrics.lastSync = new Date();
    }

    async render(container = null) {
        const target = container || document.getElementById('dropbox-container');
        if (!target) return;

        const isConnected = !!this.config.accessToken;
        const connStatus = this.connectionStatus[isConnected ? 'connected' : 'disconnected'];

        const html = `
            <div class="dropbox-container">
                <div class="dropbox-header">
                    <h3><i class="fab fa-dropbox"></i> Dropbox</h3>
                    <div class="header-actions">
                        ${isConnected ? `
                            <button class="btn btn-outline" onclick="window.Global.Dropbox.createFolder(prompt('Folder name:'))"><i class="fas fa-folder-plus"></i> New Folder</button>
                            <button class="btn btn-primary" onclick="document.getElementById('dropbox-file-input').click()"><i class="fas fa-upload"></i> Upload</button>
                            <input type="file" id="dropbox-file-input" style="display:none" onchange="window.Global.Dropbox.uploadFile(this.files[0])">
                            <button class="btn btn-outline" onclick="window.Global.Dropbox.disconnect()">Disconnect</button>
                        ` : `
                            <button class="btn btn-primary" onclick="window.Global.Dropbox.connect()"><i class="fab fa-dropbox"></i> Connect Dropbox</button>
                        `}
                    </div>
                </div>

                <div class="connection-bar" style="background:${connStatus.color}15;color:${connStatus.color}">
                    <i class="fas ${connStatus.icon}"></i> ${connStatus.label}
                    ${isConnected ? `<span>| ${this.config.accountEmail}</span>` : ''}
                    ${this.metrics.spaceUsedPercent > 0 ? `
                        <div class="space-bar"><div class="space-fill" style="width:${this.metrics.spaceUsedPercent}%"></div></div>
                        <small>${this.formatFileSize(this.config.spaceUsed)} / ${this.formatFileSize(this.config.spaceAllocated)}</small>
                    ` : ''}
                </div>

                ${isConnected ? `
                    <div class="breadcrumb">
                        <button class="btn btn-sm" onclick="window.Global.Dropbox.navigateTo('')"><i class="fas fa-home"></i> Home</button>
                        ${this.currentPath ? this.currentPath.split('/').filter(Boolean).map((part, i, arr) => `
                            <span>/</span>
                            <button class="btn btn-sm" onclick="window.Global.Dropbox.navigateTo('/${arr.slice(0, i + 1).join('/')}')">${this.escapeHtml(part)}</button>
                        `).join('') : ''}
                    </div>

                    <div class="search-bar">
                        <input type="text" placeholder="Search Dropbox..." oninput="window.Global.Dropbox.searchFiles(this.value)">
                    </div>

                    <div class="files-grid">
                        ${Array.from(this.folders.values()).map(folder => `
                            <div class="file-item folder" ondblclick="window.Global.Dropbox.navigateTo('${folder.path_lower || folder.id}')">
                                <i class="fas fa-folder" style="color:#0061FF;font-size:40px;"></i>
                                <span>${this.escapeHtml(folder.name)}</span>
                            </div>
                        `).join('')}
                        ${Array.from(this.files.values()).map(file => `
                            <div class="file-item">
                                <i class="fas ${file.fileType.icon}" style="color:${file.fileType.color};font-size:40px;"></i>
                                <span title="${this.escapeHtml(file.name)}">${this.escapeHtml((file.name || '').substring(0, 28))}${(file.name || '').length > 28 ? '...' : ''}</span>
                                <small>${file.formattedSize}</small>
                                <div class="actions">
                                    <button class="btn-icon" onclick="window.Global.Dropbox.downloadFile('${file.id || file.path_lower}')" title="Download"><i class="fas fa-download"></i></button>
                                    <button class="btn-icon" onclick="window.Global.Dropbox.createSharedLink('${file.id || file.path_lower}')" title="Share"><i class="fas fa-share-alt"></i></button>
                                    <button class="btn-icon" onclick="window.Global.Dropbox.deleteFile('${file.id || file.path_lower}')" title="Delete"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${this.files.size === 0 && this.folders.size === 0 ? '<div class="empty-state"><i class="fab fa-dropbox"></i><p>Empty folder</p></div>' : ''}
                ` : `
                    <div class="connect-prompt">
                        <i class="fab fa-dropbox"></i>
                        <h4>Connect Dropbox</h4>
                        <p>Access, upload, and manage your Dropbox files directly from the CRM</p>
                        <button class="btn btn-primary" onclick="window.Global.Dropbox.connect()"><i class="fab fa-dropbox"></i> Connect Dropbox</button>
                    </div>
                `}
            </div>`;

        target.innerHTML = html;
    }

    async navigateTo(path) {
        await this.loadFiles(path);
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
        EventBus.off('dropbox:connect'); EventBus.off('dropbox:disconnect'); EventBus.off('dropbox:upload');
        EventBus.off('dropbox:download'); EventBus.off('dropbox:delete'); EventBus.off('dropbox:share');
        console.log('[Dropbox] Module destroyed');
    }
}

const dropboxIntegration = new DropboxIntegration();
export { dropboxIntegration, DropboxIntegration };
export default dropboxIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Dropbox = dropboxIntegration; }


