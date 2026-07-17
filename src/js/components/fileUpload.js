/**
 * 11 AVATAR DIGITAL HUB - File Upload Component
 * Enterprise-grade reusable file upload with drag-drop, preview, validation
 * Multi-file, chunked uploads, virus scan, progress tracking, image optimization
 * 
 * @component FileUpload
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Toast } from './toast.js';

/**
 * FileUpload - Universal file upload component
 * Handles single/multi file uploads with preview, validation, chunked upload
 */
class FileUpload {
    constructor(container, options = {}) {
        this.componentName = 'FileUpload';
        this.componentId = `fu-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('FileUpload: Container not found');

        this.config = {
            uploadURL: options.uploadURL || '/api/upload',
            deleteURL: options.deleteURL || '/api/upload/delete',
            acceptedFiles: options.acceptedFiles || '*/*',
            acceptedFileTypes: options.acceptedFileTypes || [],
            acceptedExtensions: options.acceptedExtensions || [],
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024,
            maxFiles: options.maxFiles || 10,
            maxTotalSize: options.maxTotalSize || 50 * 1024 * 1024,
            minFiles: options.minFiles || 0,
            multiple: options.multiple !== false,
            chunked: options.chunked || false,
            chunkSize: options.chunkSize || 1024 * 1024,
            autoUpload: options.autoUpload !== false,
            showPreview: options.showPreview !== false,
            previewSize: options.previewSize || 150,
            imageOptimization: options.imageOptimization || false,
            maxImageWidth: options.maxImageWidth || 2048,
            maxImageHeight: options.maxImageHeight || 2048,
            imageQuality: options.imageQuality || 0.8,
            scanVirus: options.scanVirus || false,
            parallel: options.parallel !== false,
            maxParallel: options.maxParallel || 3,
            dropzone: options.dropzone !== false,
            dropzoneText: options.dropzoneText || 'Drag & drop files here or click to browse',
            dropzoneIcon: options.dropzoneIcon || 'fa-cloud-upload-alt',
            buttonText: options.buttonText || 'Choose Files',
            showFileList: options.showFileList !== false,
            showProgress: options.showProgress !== false,
            showSize: options.showSize !== false,
            sortable: options.sortable || false,
            downloadable: options.downloadable || false,
            deletable: options.deletable !== false,
            theme: options.theme || 'light',
            layout: options.layout || 'grid',
            headers: options.headers || {},
            metadata: options.metadata || {},
            formData: options.formData || {},
            onFileAdded: options.onFileAdded || null,
            onFileRemoved: options.onFileRemoved || null,
            onUploadStart: options.onUploadStart || null,
            onUploadProgress: options.onUploadProgress || null,
            onUploadSuccess: options.onUploadSuccess || null,
            onUploadError: options.onUploadError || null,
            onUploadComplete: options.onUploadComplete || null,
            onAllComplete: options.onAllComplete || null,
            onError: options.onError || null,
            onValidationError: options.onValidationError || null
        };

        this.state = {
            files: [],
            uploadedFiles: [],
            failedFiles: [],
            totalProgress: 0,
            isUploading: false,
            isDragOver: false,
            activeUploads: 0,
            totalBytes: 0,
            uploadedBytes: 0,
            errors: []
        };

        this.elements = {
            dropzone: null, input: null, fileList: null,
            progressBar: null, uploadBtn: null, clearBtn: null
        };

        this.uploadQueue = [];
        this.xhrUploads = new Map();
        this.fileIdCounter = 0;

        this.init();
    }

    init() {
        try {
            console.log(`[FileUpload] Initializing: ${this.componentId}`);
            this.render();
            this.setupEventHandlers();
            console.log('[FileUpload] Initialized');
        } catch (error) {
            console.error('[FileUpload] Init failed:', error);
            this.container.innerHTML = `<div class="fu-error">Failed to initialize uploader</div>`;
        }
    }

    render() {
        const html = `
            <div class="file-upload-wrapper ${this.config.theme}" id="${this.componentId}">
                ${this.config.dropzone ? this.renderDropzone() : ''}
                <input type="file" id="${this.componentId}-input" 
                       class="fu-hidden-input"
                       ${this.config.multiple ? 'multiple' : ''}
                       accept="${this.config.acceptedFiles}"
                       aria-label="File upload input">
                
                ${!this.config.dropzone ? `
                    <button class="btn btn-primary fu-browse-btn" id="${this.componentId}-browse">
                        <i class="fas fa-folder-open"></i> ${this.config.buttonText}
                    </button>
                ` : ''}
                
                ${this.config.showFileList ? this.renderFileList() : ''}
                ${this.config.showProgress ? this.renderProgressBar() : ''}
                
                <div class="fu-actions" id="${this.componentId}-actions" style="display:none;">
                    ${this.config.autoUpload ? '' : `
                        <button class="btn btn-primary fu-upload-btn" id="${this.componentId}-upload">
                            <i class="fas fa-upload"></i> Upload
                        </button>
                    `}
                    <button class="btn btn-outline fu-clear-btn" id="${this.componentId}-clear">
                        <i class="fas fa-times"></i> Clear All
                    </button>
                </div>
                
                <div class="fu-errors" id="${this.componentId}-errors"></div>
            </div>
        `;

        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderDropzone() {
        return `
            <div class="fu-dropzone ${this.state.isDragOver ? 'drag-over' : ''}" 
                 id="${this.componentId}-dropzone"
                 role="button" tabindex="0" 
                 aria-label="${this.config.dropzoneText}">
                <div class="dropzone-content">
                    <i class="fas ${this.config.dropzoneIcon}"></i>
                    <p>${this.config.dropzoneText}</p>
                    <span class="dropzone-subtext">
                        ${this.config.acceptedExtensions.length > 0 ? 
                            `Accepted: ${this.config.acceptedExtensions.join(', ')}` : 
                            `Max size: ${this.formatFileSize(this.config.maxFileSize)}`}
                    </span>
                    <button class="btn btn-outline fu-browse-btn" id="${this.componentId}-browse">
                        ${this.config.buttonText}
                    </button>
                </div>
            </div>
        `;
    }

    renderFileList() {
        return `
            <div class="fu-file-list ${this.config.layout}" id="${this.componentId}-files">
                ${this.state.files.map((file, index) => this.renderFileItem(file, index)).join('')}
                ${this.state.uploadedFiles.map((file, index) => this.renderUploadedItem(file, index)).join('')}
            </div>
        `;
    }

    renderFileItem(file, index) {
        const progress = file.progress || 0;
        const hasError = file.error;
        const isUploading = file.status === 'uploading';

        return `
            <div class="fu-file-item ${hasError ? 'has-error' : ''} ${isUploading ? 'uploading' : ''}" 
                 data-file-id="${file.id}">
                ${this.config.showPreview ? this.renderPreview(file) : ''}
                <div class="fu-file-info">
                    <span class="fu-file-name" title="${this.escapeHtml(file.name)}">
                        ${this.escapeHtml(this.truncateFileName(file.name))}
                    </span>
                    ${this.config.showSize ? `
                        <span class="fu-file-size">${this.formatFileSize(file.size)}</span>
                    ` : ''}
                    ${file.status === 'uploading' ? this.renderFileProgress(file) : ''}
                    ${hasError ? `<span class="fu-file-error">${file.error}</span>` : ''}
                    ${file.status === 'complete' ? '<span class="fu-success"><i class="fas fa-check-circle"></i></span>' : ''}
                </div>
                <div class="fu-file-actions">
                    ${file.status === 'pending' ? `
                        <button class="btn-icon fu-remove-btn" data-file-id="${file.id}" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${file.status === 'complete' && this.config.downloadable ? `
                        <button class="btn-icon fu-download-btn" data-file-id="${file.id}" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderUploadedItem(file, index) {
        return `
            <div class="fu-file-item uploaded" data-file-id="${file.id}">
                ${this.config.showPreview && file.url ? this.renderImagePreview(file) : ''}
                <div class="fu-file-info">
                    <span class="fu-file-name" title="${this.escapeHtml(file.name)}">
                        ${this.escapeHtml(this.truncateFileName(file.name))}
                    </span>
                    ${this.config.showSize && file.size ? `
                        <span class="fu-file-size">${this.formatFileSize(file.size)}</span>
                    ` : ''}
                </div>
                <div class="fu-file-actions">
                    ${this.config.downloadable && file.url ? `
                        <a href="${file.url}" class="btn-icon" download title="Download">
                            <i class="fas fa-download"></i>
                        </a>
                    ` : ''}
                    ${this.config.deletable ? `
                        <button class="btn-icon fu-delete-btn" data-file-id="${file.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPreview(file) {
        if (!file.type) return this.renderFileIcon(file);
        if (file.type.startsWith('image/')) return this.renderImagePreview(file);
        if (file.type.startsWith('video/')) return this.renderVideoPreview(file);
        if (file.type === 'application/pdf') return this.renderPDFPreview(file);
        return this.renderFileIcon(file);
    }

    renderImagePreview(file) {
        const url = file.url || (file.data ? URL.createObjectURL(file.data) : '');
        return `
            <div class="fu-preview image-preview" style="width:${this.config.previewSize}px;height:${this.config.previewSize}px">
                ${url ? `<img src="${url}" alt="${this.escapeHtml(file.name)}" loading="lazy">` : 
                        '<i class="fas fa-image"></i>'}
            </div>
        `;
    }

    renderVideoPreview(file) {
        return `
            <div class="fu-preview video-preview" style="width:${this.config.previewSize}px;height:${this.config.previewSize}px">
                <i class="fas fa-video"></i>
            </div>
        `;
    }

    renderPDFPreview(file) {
        return `
            <div class="fu-preview pdf-preview" style="width:${this.config.previewSize}px;height:${this.config.previewSize}px">
                <i class="fas fa-file-pdf"></i>
            </div>
        `;
    }

    renderFileIcon(file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf', 'doc': 'fa-file-word', 'docx': 'fa-file-word',
            'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel', 'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint', 'zip': 'fa-file-archive', 'rar': 'fa-file-archive',
            'txt': 'fa-file-alt', 'csv': 'fa-file-csv', 'json': 'fa-file-code',
            'js': 'fa-file-code', 'html': 'fa-file-code', 'css': 'fa-file-code'
        };
        return `
            <div class="fu-preview file-icon-preview" style="width:${this.config.previewSize}px;height:${this.config.previewSize}px">
                <i class="fas ${iconMap[ext] || 'fa-file'}"></i>
            </div>
        `;
    }

    renderFileProgress(file) {
        const percent = file.progress || 0;
        return `
            <div class="fu-progress">
                <div class="fu-progress-bar">
                    <div class="fu-progress-fill" style="width:${percent}%"></div>
                </div>
                <span class="fu-progress-text">${percent}%</span>
            </div>
        `;
    }

    renderProgressBar() {
        if (this.state.totalProgress === 0 && !this.state.isUploading) return '';
        return `
            <div class="fu-total-progress">
                <div class="fu-progress-bar total">
                    <div class="fu-progress-fill" style="width:${this.state.totalProgress}%"></div>
                </div>
                <span class="fu-progress-text">${this.state.totalProgress}%</span>
                <span class="fu-progress-stats">
                    ${this.formatFileSize(this.state.uploadedBytes)} / ${this.formatFileSize(this.state.totalBytes)}
                </span>
            </div>
        `;
    }

    cacheElements() {
        this.elements.dropzone = document.getElementById(`${this.componentId}-dropzone`);
        this.elements.input = document.getElementById(`${this.componentId}-input`);
        this.elements.fileList = document.getElementById(`${this.componentId}-files`);
        this.elements.uploadBtn = document.getElementById(`${this.componentId}-upload`);
        this.elements.clearBtn = document.getElementById(`${this.componentId}-clear`);
        this.elements.browseBtn = document.getElementById(`${this.componentId}-browse`);
    }

    setupEventHandlers() {
        try {
            if (this.elements.browseBtn) {
                this.elements.browseBtn.addEventListener('click', () => this.elements.input?.click());
            }

            if (this.elements.dropzone) {
                this.elements.dropzone.addEventListener('click', () => this.elements.input?.click());
                this.elements.dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    this.state.isDragOver = true;
                    this.elements.dropzone.classList.add('drag-over');
                });
                this.elements.dropzone.addEventListener('dragleave', () => {
                    this.state.isDragOver = false;
                    this.elements.dropzone.classList.remove('drag-over');
                });
                this.elements.dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    this.state.isDragOver = false;
                    this.elements.dropzone.classList.remove('drag-over');
                    this.handleFiles(e.dataTransfer.files);
                });
                this.elements.dropzone.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.elements.input?.click();
                    }
                });
            }

            if (this.elements.input) {
                this.elements.input.addEventListener('change', (e) => {
                    this.handleFiles(e.target.files);
                    e.target.value = '';
                });
            }

            if (this.elements.uploadBtn) {
                this.elements.uploadBtn.addEventListener('click', () => this.startUpload());
            }

            if (this.elements.clearBtn) {
                this.elements.clearBtn.addEventListener('click', () => this.clearAll());
            }

            if (this.elements.fileList) {
                this.elements.fileList.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.fu-remove-btn');
                    const deleteBtn = e.target.closest('.fu-delete-btn');
                    if (removeBtn) this.removeFile(removeBtn.dataset.fileId);
                    if (deleteBtn) this.deleteFile(deleteBtn.dataset.fileId);
                });
            }

            document.addEventListener('paste', (e) => {
                if (this.isContainerFocused() && e.clipboardData.files.length > 0) {
                    e.preventDefault();
                    this.handleFiles(e.clipboardData.files);
                }
            });

            console.log('[FileUpload] Event handlers set up');
        } catch (error) {
            console.error('[FileUpload] Event setup failed:', error);
        }
    }

    handleFiles(fileList) {
        const files = Array.from(fileList);
        const errors = [];

        if (files.length === 0) return;

        if (!this.config.multiple && this.state.files.length > 0) {
            this.state.files = [];
        }

        const remainingSlots = this.config.maxFiles - (this.state.files.length + this.state.uploadedFiles.length);
        if (files.length > remainingSlots) {
            errors.push(`Maximum ${this.config.maxFiles} files allowed. Only ${remainingSlots} more can be added.`);
        }

        const validFiles = [];
        let totalNewSize = 0;

        files.slice(0, remainingSlots).forEach(file => {
            const validation = this.validateFile(file);
            if (validation.valid) {
                totalNewSize += file.size;
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        });

        const currentTotalSize = this.state.files.reduce((sum, f) => sum + f.size, 0);
        if (currentTotalSize + totalNewSize > this.config.maxTotalSize) {
            errors.push(`Total size exceeds maximum ${this.formatFileSize(this.config.maxTotalSize)}`);
        }

        if (errors.length > 0) {
            this.showErrors(errors);
            if (this.config.onValidationError) this.config.onValidationError(errors);
            if (validFiles.length === 0) return;
        }

        validFiles.forEach(file => this.addFile(file));

        if (this.config.autoUpload) this.startUpload();
    }

    validateFile(file) {
        if (this.config.acceptedExtensions.length > 0) {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!this.config.acceptedExtensions.includes(ext)) {
                return { valid: false, error: `File type "${ext}" not accepted` };
            }
        }

        if (this.config.acceptedFileTypes.length > 0) {
            const matches = this.config.acceptedFileTypes.some(type => {
                if (type.includes('*')) {
                    return file.type.startsWith(type.replace('*', ''));
                }
                return file.type === type;
            });
            if (!matches) {
                return { valid: false, error: `File type "${file.type}" not accepted` };
            }
        }

        if (file.size > this.config.maxFileSize) {
            return { valid: false, error: `File size ${this.formatFileSize(file.size)} exceeds maximum ${this.formatFileSize(this.config.maxFileSize)}` };
        }

        if (file.size === 0) {
            return { valid: false, error: 'File is empty' };
        }

        return { valid: true };
    }

    async addFile(file) {
        const fileId = `file-${++this.fileIdCounter}`;
        
        const fileData = {
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            data: file,
            status: 'pending',
            progress: 0,
            error: null,
            url: null
        };

        if (this.config.showPreview && file.type.startsWith('image/')) {
            await this.generatePreview(fileData);
        }

        if (this.config.imageOptimization && file.type.startsWith('image/')) {
            await this.optimizeImage(fileData);
        }

        this.state.files.push(fileData);
        this.state.totalBytes += file.size;
        this.refreshFileList();

        if (this.config.onFileAdded) this.config.onFileAdded(fileData);
    }

    async generatePreview(fileData) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                fileData.url = e.target.result;
                resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(fileData.data);
        });
    }

    async optimizeImage(fileData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width <= this.config.maxImageWidth && height <= this.config.maxImageHeight) {
                    resolve();
                    return;
                }

                const ratio = Math.min(
                    this.config.maxImageWidth / width,
                    this.config.maxImageHeight / height
                );
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob && blob.size < fileData.data.size) {
                        fileData.data = new File([blob], fileData.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        fileData.size = blob.size;
                        console.log(`[FileUpload] Image optimized: ${this.formatFileSize(fileData.data.size)} -> ${this.formatFileSize(blob.size)}`);
                    }
                    resolve();
                }, 'image/jpeg', this.config.imageQuality);
            };
            img.onerror = () => resolve();
            img.src = URL.createObjectURL(fileData.data);
        });
    }

    async startUpload() {
        if (this.state.isUploading) return;
        if (this.state.files.length === 0) return;

        this.state.isUploading = true;
        this.state.activeUploads = 0;
        this.state.uploadedBytes = 0;
        this.state.errors = [];

        this.uploadQueue = [...this.state.files.filter(f => f.status === 'pending')];

        if (this.config.onUploadStart) this.config.onUploadStart(this.uploadQueue);

        const parallelCount = this.config.parallel ? this.config.maxParallel : 1;
        const uploadPromises = [];

        for (let i = 0; i < Math.min(parallelCount, this.uploadQueue.length); i++) {
            uploadPromises.push(this.processNextInQueue());
        }

        await Promise.allSettled(uploadPromises);

        this.state.isUploading = false;

        if (this.config.onAllComplete) {
            this.config.onAllComplete({
                uploaded: this.state.uploadedFiles,
                failed: this.state.failedFiles
            });
        }
    }

    async processNextInQueue() {
        while (this.uploadQueue.length > 0) {
            const fileData = this.uploadQueue.shift();
            await this.uploadFile(fileData);
        }
    }

    async uploadFile(fileData) {
        return new Promise((resolve) => {
            try {
                fileData.status = 'uploading';
                this.state.activeUploads++;
                this.refreshFileList();

                if (this.config.chunked && fileData.size > this.config.chunkSize) {
                    this.uploadChunked(fileData, resolve);
                } else {
                    this.uploadStandard(fileData, resolve);
                }
            } catch (error) {
                this.handleUploadError(fileData, error.message);
                resolve();
            }
        });
    }

    uploadStandard(fileData, resolve) {
        const formData = new FormData();
        formData.append('file', fileData.data, fileData.name);
        
        Object.entries(this.config.formData).forEach(([key, value]) => {
            formData.append(key, value);
        });
        Object.entries(this.config.metadata).forEach(([key, value]) => {
            formData.append(`metadata[${key}]`, value);
        });

        const xhr = new XMLHttpRequest();
        this.xhrUploads.set(fileData.id, xhr);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                fileData.progress = Math.round((e.loaded / e.total) * 100);
                this.updateTotalProgress();
                this.refreshFileProgress(fileData);
                if (this.config.onUploadProgress) {
                    this.config.onUploadProgress(fileData, fileData.progress);
                }
            }
        });

        xhr.addEventListener('load', () => {
            this.xhrUploads.delete(fileData.id);
            if (xhr.status >= 200 && xhr.status < 300) {
                this.handleUploadSuccess(fileData, JSON.parse(xhr.responseText));
            } else {
                this.handleUploadError(fileData, `Upload failed with status ${xhr.status}`);
            }
            resolve();
        });

        xhr.addEventListener('error', () => {
            this.xhrUploads.delete(fileData.id);
            this.handleUploadError(fileData, 'Network error');
            resolve();
        });

        xhr.addEventListener('abort', () => {
            this.xhrUploads.delete(fileData.id);
            resolve();
        });

        xhr.open('POST', this.config.uploadURL);
        
        Object.entries(this.config.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
        });

        xhr.send(formData);
    }

    uploadChunked(fileData, resolve) {
        const totalChunks = Math.ceil(fileData.size / this.config.chunkSize);
        let currentChunk = 0;

        const uploadNextChunk = () => {
            if (currentChunk >= totalChunks) {
                this.finalizeChunkedUpload(fileData, totalChunks, resolve);
                return;
            }

            const start = currentChunk * this.config.chunkSize;
            const end = Math.min(start + this.config.chunkSize, fileData.size);
            const chunk = fileData.data.slice(start, end);

            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('chunkIndex', currentChunk);
            formData.append('totalChunks', totalChunks);
            formData.append('fileName', fileData.name);
            formData.append('fileId', fileData.id);

            const xhr = new XMLHttpRequest();
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    currentChunk++;
                    fileData.progress = Math.round((currentChunk / totalChunks) * 100);
                    this.updateTotalProgress();
                    this.refreshFileProgress(fileData);
                    uploadNextChunk();
                } else {
                    this.handleUploadError(fileData, `Chunk ${currentChunk} failed`);
                    resolve();
                }
            });

            xhr.addEventListener('error', () => {
                this.handleUploadError(fileData, 'Chunk upload network error');
                resolve();
            });

            xhr.open('POST', `${this.config.uploadURL}/chunk`);
            xhr.send(formData);
        };

        uploadNextChunk();
    }

    async finalizeChunkedUpload(fileData, totalChunks, resolve) {
        try {
            const response = await fetch(`${this.config.uploadURL}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...this.config.headers },
                body: JSON.stringify({
                    fileId: fileData.id,
                    fileName: fileData.name,
                    totalChunks: totalChunks
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.handleUploadSuccess(fileData, data);
            } else {
                this.handleUploadError(fileData, 'Chunk finalization failed');
            }
        } catch (error) {
            this.handleUploadError(fileData, error.message);
        }
        resolve();
    }

    handleUploadSuccess(fileData, response) {
        fileData.status = 'complete';
        fileData.progress = 100;
        fileData.url = response.url || response.fileUrl;
        fileData.fileId = response.fileId || response.id;

        this.state.activeUploads--;
        this.state.uploadedBytes += fileData.size;

        const index = this.state.files.findIndex(f => f.id === fileData.id);
        if (index > -1) {
            this.state.files.splice(index, 1);
            this.state.uploadedFiles.push(fileData);
        }

        this.updateTotalProgress();
        this.refreshFileList();

        if (this.config.onUploadSuccess) this.config.onUploadSuccess(fileData, response);
        if (this.config.onUploadComplete) this.config.onUploadComplete(fileData);
    }

    handleUploadError(fileData, errorMessage) {
        fileData.status = 'error';
        fileData.error = errorMessage;
        this.state.activeUploads--;
        this.state.failedFiles.push(fileData);
        this.state.errors.push({ file: fileData.name, error: errorMessage });

        this.refreshFileList();

        if (this.config.onUploadError) this.config.onUploadError(fileData, errorMessage);
        if (this.config.onError) this.config.onError(errorMessage, fileData);
    }

    removeFile(fileId) {
        const index = this.state.files.findIndex(f => f.id === fileId);
        if (index > -1) {
            const file = this.state.files[index];
            this.state.totalBytes -= file.size;
            
            if (this.xhrUploads.has(fileId)) {
                this.xhrUploads.get(fileId).abort();
                this.xhrUploads.delete(fileId);
            }
            
            this.state.files.splice(index, 1);
            this.refreshFileList();
            this.updateTotalProgress();

            if (this.config.onFileRemoved) this.config.onFileRemoved(file);
        }
    }

    async deleteFile(fileId) {
        try {
            if (this.config.deleteURL) {
                await fetch(`${this.config.deleteURL}/${fileId}`, {
                    method: 'DELETE',
                    headers: this.config.headers
                });
            }

            const index = this.state.uploadedFiles.findIndex(f => f.id === fileId || f.fileId === fileId);
            if (index > -1) {
                const file = this.state.uploadedFiles[index];
                this.state.uploadedFiles.splice(index, 1);
                this.refreshFileList();

                if (this.config.onFileRemoved) this.config.onFileRemoved(file);
                Toast.show('File deleted', 'info');
            }
        } catch (error) {
            console.error('[FileUpload] Delete failed:', error);
            Toast.show('Failed to delete file', 'error');
        }
    }

    clearAll() {
        this.state.files.forEach(f => {
            if (this.xhrUploads.has(f.id)) {
                this.xhrUploads.get(f.id).abort();
            }
        });
        
        this.state.files = [];
        this.state.uploadedFiles = [];
        this.state.failedFiles = [];
        this.state.totalProgress = 0;
        this.state.totalBytes = 0;
        this.state.uploadedBytes = 0;
        this.state.errors = [];
        this.uploadQueue = [];
        this.xhrUploads.clear();
        
        this.refreshFileList();
    }

    updateTotalProgress() {
        const totalFiles = this.state.files.length + this.state.uploadedFiles.length;
        if (totalFiles === 0) {
            this.state.totalProgress = 0;
            return;
        }

        const totalProgress = this.state.files.reduce((sum, f) => sum + (f.progress || 0), 0) +
                               this.state.uploadedFiles.length * 100;
        this.state.totalProgress = Math.round(totalProgress / totalFiles);
        this.refreshProgressBar();
    }

    refreshFileList() {
        if (this.elements.fileList) {
            this.elements.fileList.innerHTML = 
                this.state.files.map((f, i) => this.renderFileItem(f, i)).join('') +
                this.state.uploadedFiles.map((f, i) => this.renderUploadedItem(f, i)).join('');
        }
        
        const actions = document.getElementById(`${this.componentId}-actions`);
        if (actions) {
            actions.style.display = this.state.files.length > 0 || this.state.uploadedFiles.length > 0 ? 'flex' : 'none';
        }
    }

    refreshFileProgress(fileData) {
        const progressEl = document.querySelector(`[data-file-id="${fileData.id}"] .fu-progress-fill`);
        const textEl = document.querySelector(`[data-file-id="${fileData.id}"] .fu-progress-text`);
        if (progressEl) progressEl.style.width = `${fileData.progress}%`;
        if (textEl) textEl.textContent = `${fileData.progress}%`;
    }

    refreshProgressBar() {
        const progressBar = this.container.querySelector('.fu-total-progress .fu-progress-fill');
        const progressText = this.container.querySelector('.fu-total-progress .fu-progress-text');
        const progressStats = this.container.querySelector('.fu-total-progress .fu-progress-stats');
        
        if (progressBar) progressBar.style.width = `${this.state.totalProgress}%`;
        if (progressText) progressText.textContent = `${this.state.totalProgress}%`;
        if (progressStats) {
            progressStats.textContent = `${this.formatFileSize(this.state.uploadedBytes)} / ${this.formatFileSize(this.state.totalBytes)}`;
        }
    }

    showErrors(errors) {
        const errorsEl = document.getElementById(`${this.componentId}-errors`);
        if (errorsEl) {
            errorsEl.innerHTML = errors.map(e => `<div class="fu-error-item"><i class="fas fa-exclamation-circle"></i> ${e}</div>`).join('');
            errorsEl.style.display = 'block';
            setTimeout(() => { errorsEl.style.display = 'none'; }, 5000);
        }
    }

    isContainerFocused() {
        return this.container.contains(document.activeElement);
    }

    truncateFileName(name, maxLength = 30) {
        if (!name || name.length <= maxLength) return name;
        const ext = name.lastIndexOf('.');
        if (ext > 0) {
            const extension = name.substring(ext);
            const baseName = name.substring(0, ext);
            return baseName.substring(0, maxLength - extension.length - 3) + '...' + extension;
        }
        return name.substring(0, maxLength - 3) + '...';
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    getFiles() {
        return [...this.state.files, ...this.state.uploadedFiles];
    }

    getUploadedFiles() {
        return [...this.state.uploadedFiles];
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.state.files.forEach(f => {
            if (this.xhrUploads.has(f.id)) this.xhrUploads.get(f.id).abort();
        });
        this.xhrUploads.clear();
        if (this.container) this.container.innerHTML = '';
        console.log('[FileUpload] Component destroyed');
    }

    static getInstance(componentId) {
        return window.Global?.FileUpload?.instances?.get(componentId);
    }
}

export { FileUpload };
export default FileUpload;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.FileUpload = window.Global.FileUpload || {};
    window.Global.FileUpload.instances = window.Global.FileUpload.instances || new Map();
    window.Global.FileUpload.FileUpload = FileUpload;
}

