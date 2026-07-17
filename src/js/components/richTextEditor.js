/**
 * 11 AVATAR DIGITAL HUB - Rich Text Editor Component
 * Enterprise-grade WYSIWYG editor with toolbar, formatting, media, templates
 * Bold, italic, underline, lists, links, images, tables, code blocks
 * 
 * @component RichTextEditor
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Toast } from './toast.js';

/**
 * RichTextEditor - Universal WYSIWYG editor component
 * Full formatting toolbar, media embedding, templates, markdown support
 */
class RichTextEditor {
    constructor(container, options = {}) {
        this.componentName = 'RichTextEditor';
        this.componentId = `rte-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('RichTextEditor: Container not found');

        this.config = {
            value: options.value || '',
            placeholder: options.placeholder || 'Start typing...',
            minHeight: options.minHeight || 200,
            maxHeight: options.maxHeight || 600,
            readOnly: options.readOnly || false,
            disabled: options.disabled || false,
            spellcheck: options.spellcheck !== false,
            autofocus: options.autofocus || false,
            theme: options.theme || 'light',
            toolbar: options.toolbar || 'full',
            customToolbar: options.customToolbar || null,
            allowHTML: options.allowHTML !== false,
            sanitize: options.sanitize !== false,
            maxLength: options.maxLength || 0,
            charCounter: options.charCounter || false,
            wordCounter: options.wordCounter || false,
            imageUpload: options.imageUpload !== false,
            imageUploadURL: options.imageUploadURL || '/api/upload',
            maxImageSize: options.maxImageSize || 5 * 1024 * 1024,
            allowedImageTypes: options.allowedImageTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            mentionEnabled: options.mentionEnabled || false,
            mentionTrigger: options.mentionTrigger || '@',
            mentionSource: options.mentionSource || null,
            hashtagEnabled: options.hashtagEnabled || false,
            emojiEnabled: options.emojiEnabled || false,
            templateEnabled: options.templateEnabled || false,
            templates: options.templates || [],
            markdownEnabled: options.markdownEnabled || false,
            onChange: options.onChange || null,
            onFocus: options.onFocus || null,
            onBlur: options.onBlur || null,
            onImageUpload: options.onImageUpload || null,
            onMention: options.onMention || null,
            onSave: options.onSave || null,
            name: options.name || '',
            required: options.required || false
        };

        this.state = {
            value: this.config.value,
            isFocused: false,
            isDirty: false,
            history: [],
            historyIndex: -1,
            maxHistory: 100,
            activeFormats: new Set(),
            wordCount: 0,
            charCount: 0,
            showEmojiPicker: false,
            showMentionList: false,
            mentionQuery: '',
            mentionResults: [],
            selectedMentionIndex: 0,
            showTemplateList: false,
            currentTemplate: null
        };

        this.elements = {
            wrapper: null, toolbar: null, editor: null,
            footer: null, charCount: null, wordCount: null,
            emojiPicker: null, mentionList: null, templateList: null
        };

        this.toolbarButtons = this.getToolbarButtons();
        this.emojiList = this.getEmojiList();
        this.savedRange = null;

        this.init();
    }

    init() {
        try {
            console.log(`[RichTextEditor] Initializing: ${this.componentId}`);
            this.render();
            this.setupEventHandlers();
            this.updateCounters();
            if (this.config.autofocus) this.focus();
            console.log('[RichTextEditor] Initialized');
        } catch (error) {
            console.error('[RichTextEditor] Init failed:', error);
        }
    }

    getToolbarButtons() {
        const allButtons = {
            undo: { icon: 'fa-undo', title: 'Undo (Ctrl+Z)', action: 'undo', group: 'history' },
            redo: { icon: 'fa-redo', title: 'Redo (Ctrl+Y)', action: 'redo', group: 'history' },
            bold: { icon: 'fa-bold', title: 'Bold (Ctrl+B)', action: 'bold', group: 'format' },
            italic: { icon: 'fa-italic', title: 'Italic (Ctrl+I)', action: 'italic', group: 'format' },
            underline: { icon: 'fa-underline', title: 'Underline (Ctrl+U)', action: 'underline', group: 'format' },
            strikethrough: { icon: 'fa-strikethrough', title: 'Strikethrough', action: 'strikeThrough', group: 'format' },
            heading1: { icon: 'fa-heading', title: 'Heading 1', action: 'formatBlock', value: 'h1', group: 'heading' },
            heading2: { icon: 'fa-heading', title: 'Heading 2', action: 'formatBlock', value: 'h2', group: 'heading', small: true },
            heading3: { icon: 'fa-heading', title: 'Heading 3', action: 'formatBlock', value: 'h3', group: 'heading', small: true },
            paragraph: { icon: 'fa-paragraph', title: 'Paragraph', action: 'formatBlock', value: 'p', group: 'heading' },
            ul: { icon: 'fa-list-ul', title: 'Bullet List', action: 'insertUnorderedList', group: 'list' },
            ol: { icon: 'fa-list-ol', title: 'Numbered List', action: 'insertOrderedList', group: 'list' },
            indent: { icon: 'fa-indent', title: 'Increase Indent', action: 'indent', group: 'list' },
            outdent: { icon: 'fa-outdent', title: 'Decrease Indent', action: 'outdent', group: 'list' },
            quote: { icon: 'fa-quote-right', title: 'Blockquote', action: 'formatBlock', value: 'blockquote', group: 'block' },
            code: { icon: 'fa-code', title: 'Code Block', action: 'formatBlock', value: 'pre', group: 'block' },
            link: { icon: 'fa-link', title: 'Insert Link (Ctrl+K)', action: 'createLink', group: 'insert' },
            image: { icon: 'fa-image', title: 'Insert Image', action: 'insertImage', group: 'insert' },
            table: { icon: 'fa-table', title: 'Insert Table', action: 'insertTable', group: 'insert' },
            hr: { icon: 'fa-minus', title: 'Horizontal Rule', action: 'insertHorizontalRule', group: 'insert' },
            emoji: { icon: 'fa-smile', title: 'Emoji', action: 'showEmoji', group: 'insert' },
            mention: { icon: 'fa-at', title: 'Mention (@)', action: 'showMention', group: 'insert' },
            template: { icon: 'fa-file-alt', title: 'Templates', action: 'showTemplate', group: 'insert' },
            alignLeft: { icon: 'fa-align-left', title: 'Align Left', action: 'justifyLeft', group: 'align' },
            alignCenter: { icon: 'fa-align-center', title: 'Align Center', action: 'justifyCenter', group: 'align' },
            alignRight: { icon: 'fa-align-right', title: 'Align Right', action: 'justifyRight', group: 'align' },
            alignJustify: { icon: 'fa-align-justify', title: 'Justify', action: 'justifyFull', group: 'align' },
            fontSize: { icon: 'fa-text-height', title: 'Font Size', action: 'fontSize', group: 'style' },
            fontColor: { icon: 'fa-palette', title: 'Text Color', action: 'foreColor', group: 'style' },
            bgColor: { icon: 'fa-fill-drip', title: 'Background Color', action: 'hiliteColor', group: 'style' },
            clearFormat: { icon: 'fa-remove-format', title: 'Clear Formatting', action: 'removeFormat', group: 'style' },
            html: { icon: 'fa-file-code', title: 'View HTML', action: 'viewHTML', group: 'advanced' },
            fullscreen: { icon: 'fa-expand', title: 'Fullscreen', action: 'fullscreen', group: 'advanced' }
        };

        if (this.config.toolbar === 'full') {
            return allButtons;
        }

        if (this.config.toolbar === 'basic') {
            const basic = ['undo', 'redo', 'bold', 'italic', 'underline', 'ul', 'ol', 'link', 'image', 'clearFormat'];
            const filtered = {};
            basic.forEach(key => { if (allButtons[key]) filtered[key] = allButtons[key]; });
            return filtered;
        }

        if (this.config.customToolbar && Array.isArray(this.config.customToolbar)) {
            const filtered = {};
            this.config.customToolbar.forEach(key => { if (allButtons[key]) filtered[key] = allButtons[key]; });
            return filtered;
        }

        return allButtons;
    }

    getEmojiList() {
        return [
            '😀','😂','😍','🤔','😎','👍','❤️','🔥','🎉','✅',
            '⭐','🚀','💡','📝','💰','📧','📞','📍','🗓️','⏰',
            '👋','🙏','💪','🤝','👏','🎯','💼','🏢','📊','📈',
            '😊','🙂','😉','😢','😡','🥳','🤩','😇','🤗','🫡'
        ];
    }

    render() {
        const toolbarButtons = this.config.toolbar !== 'none' ? this.renderToolbar() : '';
        
        const html = `
            <div class="rte-wrapper ${this.config.theme} ${this.config.disabled ? 'disabled' : ''} ${this.state.isFocused ? 'focused' : ''}" 
                 id="${this.componentId}">
                
                ${toolbarButtons}
                
                ${this.state.showEmojiPicker ? this.renderEmojiPicker() : ''}
                ${this.state.showMentionList ? this.renderMentionList() : ''}
                ${this.state.showTemplateList ? this.renderTemplateList() : ''}
                
                <div class="rte-editor-container" style="min-height:${this.config.minHeight}px;max-height:${this.config.maxHeight}px">
                    <div class="rte-editor" 
                         id="${this.componentId}-editor"
                         contenteditable="${!this.config.disabled && !this.config.readOnly}"
                         placeholder="${this.config.placeholder}"
                         spellcheck="${this.config.spellcheck}"
                         role="textbox"
                         aria-multiline="true"
                         aria-label="Rich text editor"
                         ${this.config.name ? `data-name="${this.config.name}"` : ''}>
                        ${this.config.value || ''}
                    </div>
                </div>
                
                ${this.renderFooter()}
                
                <textarea class="rte-hidden-textarea" 
                          id="${this.componentId}-textarea"
                          name="${this.config.name}"
                          style="display:none;"
                          ${this.config.required ? 'required' : ''}></textarea>
            </div>
        `;

        this.container.innerHTML = html;
        this.cacheElements();
        
        if (this.elements.editor && this.config.value) {
            this.elements.editor.innerHTML = this.config.value;
        }
    }

    renderToolbar() {
        const groups = {};
        
        Object.entries(this.toolbarButtons).forEach(([key, btn]) => {
            if (!groups[btn.group]) groups[btn.group] = [];
            groups[btn.group].push({ key, ...btn });
        });

        return `
            <div class="rte-toolbar" id="${this.componentId}-toolbar" role="toolbar" aria-label="Formatting toolbar">
                ${Object.entries(groups).map(([groupName, buttons]) => `
                    <div class="rte-toolbar-group">
                        ${buttons.map(btn => `
                            <button class="rte-toolbar-btn ${this.state.activeFormats.has(btn.key) ? 'active' : ''} ${btn.small ? 'small' : ''}" 
                                    data-action="${btn.action}" 
                                    data-value="${btn.value || ''}"
                                    title="${btn.title}"
                                    aria-label="${btn.title}"
                                    tabindex="-1"
                                    type="button">
                                <i class="fas ${btn.icon}"></i>
                                ${btn.small ? '<span class="small-indicator"></span>' : ''}
                            </button>
                        `).join('')}
                    </div>
                `).join('')}
                ${Object.keys(groups).length > 0 ? '<div class="rte-toolbar-divider"></div>' : ''}
            </div>
        `;
    }

    renderFooter() {
        if (!this.config.charCounter && !this.config.wordCounter && !this.config.maxLength) return '';
        
        return `
            <div class="rte-footer" id="${this.componentId}-footer">
                <div class="rte-footer-left">
                    <span class="rte-saved-status">${this.state.isDirty ? 'Unsaved changes' : 'Saved'}</span>
                </div>
                <div class="rte-footer-right">
                    ${this.config.charCounter ? `
                        <span class="rte-counter" id="${this.componentId}-char-count">
                            ${this.state.charCount} characters
                        </span>
                    ` : ''}
                    ${this.config.wordCounter ? `
                        <span class="rte-counter" id="${this.componentId}-word-count">
                            ${this.state.wordCount} words
                        </span>
                    ` : ''}
                    ${this.config.maxLength > 0 ? `
                        <span class="rte-counter ${this.state.charCount > this.config.maxLength ? 'over-limit' : ''}">
                            ${this.state.charCount}/${this.config.maxLength}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderEmojiPicker() {
        return `
            <div class="rte-emoji-picker" id="${this.componentId}-emoji-picker">
                <div class="emoji-grid">
                    ${this.emojiList.map(emoji => `
                        <button class="emoji-btn" data-emoji="${emoji}" title="${emoji}">${emoji}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderMentionList() {
        if (this.state.mentionResults.length === 0) {
            return `
                <div class="rte-mention-list" id="${this.componentId}-mention-list">
                    <div class="mention-empty">No results found</div>
                </div>
            `;
        }

        return `
            <div class="rte-mention-list" id="${this.componentId}-mention-list">
                ${this.state.mentionResults.map((user, index) => `
                    <div class="mention-item ${index === this.state.selectedMentionIndex ? 'selected' : ''}" 
                         data-id="${user.id}" data-name="${user.name}">
                        ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" class="mention-avatar">` : ''}
                        <div class="mention-info">
                            <span class="mention-name">${this.escapeHtml(user.name)}</span>
                            ${user.email ? `<span class="mention-email">${this.escapeHtml(user.email)}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTemplateList() {
        if (this.config.templates.length === 0) {
            return `
                <div class="rte-template-list" id="${this.componentId}-template-list">
                    <div class="template-empty">No templates available</div>
                </div>
            `;
        }

        return `
            <div class="rte-template-list" id="${this.componentId}-template-list">
                ${this.config.templates.map(template => `
                    <div class="template-item" data-template-id="${template.id}">
                        <div class="template-preview">
                            <strong>${this.escapeHtml(template.name)}</strong>
                            <p>${this.escapeHtml(template.description || '')}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.toolbar = document.getElementById(`${this.componentId}-toolbar`);
        this.elements.editor = document.getElementById(`${this.componentId}-editor`);
        this.elements.footer = document.getElementById(`${this.componentId}-footer`);
        this.elements.charCount = document.getElementById(`${this.componentId}-char-count`);
        this.elements.wordCount = document.getElementById(`${this.componentId}-word-count`);
        this.elements.emojiPicker = document.getElementById(`${this.componentId}-emoji-picker`);
        this.elements.mentionList = document.getElementById(`${this.componentId}-mention-list`);
        this.elements.templateList = document.getElementById(`${this.componentId}-template-list`);
        this.elements.textarea = document.getElementById(`${this.componentId}-textarea`);
    }

    setupEventHandlers() {
        try {
            if (this.elements.toolbar) {
                this.elements.toolbar.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const btn = e.target.closest('.rte-toolbar-btn');
                    if (!btn) return;
                    
                    const action = btn.dataset.action;
                    const value = btn.dataset.value;
                    
                    this.executeAction(action, value);
                });
            }

            if (this.elements.editor) {
                this.elements.editor.addEventListener('focus', () => {
                    this.state.isFocused = true;
                    this.elements.wrapper?.classList.add('focused');
                    if (this.config.onFocus) this.config.onFocus();
                });

                this.elements.editor.addEventListener('blur', () => {
                    this.state.isFocused = false;
                    this.elements.wrapper?.classList.remove('focused');
                    this.updateCounters();
                    if (this.config.onBlur) this.config.onBlur();
                });

                this.elements.editor.addEventListener('input', (e) => {
                    this.handleInput(e);
                });

                this.elements.editor.addEventListener('keydown', (e) => {
                    this.handleKeyDown(e);
                });

                this.elements.editor.addEventListener('paste', (e) => {
                    this.handlePaste(e);
                });

                this.elements.editor.addEventListener('click', () => {
                    this.closeAllPopups();
                });
            }

            if (this.elements.emojiPicker) {
                this.elements.emojiPicker.addEventListener('click', (e) => {
                    const emojiBtn = e.target.closest('.emoji-btn');
                    if (emojiBtn) {
                        this.insertEmoji(emojiBtn.dataset.emoji);
                        this.state.showEmojiPicker = false;
                        this.render();
                        this.setupEventHandlers();
                        this.focus();
                    }
                });
            }

            if (this.elements.mentionList) {
                this.elements.mentionList.addEventListener('click', (e) => {
                    const item = e.target.closest('.mention-item');
                    if (item) {
                        this.insertMention(item.dataset.id, item.dataset.name);
                        this.state.showMentionList = false;
                        this.render();
                        this.setupEventHandlers();
                        this.focus();
                    }
                });
            }

            if (this.elements.templateList) {
                this.elements.templateList.addEventListener('click', (e) => {
                    const item = e.target.closest('.template-item');
                    if (item) {
                        this.insertTemplate(item.dataset.templateId);
                        this.state.showTemplateList = false;
                        this.render();
                        this.setupEventHandlers();
                        this.focus();
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (!this.container.contains(e.target)) {
                    this.closeAllPopups();
                }
            });

            if (this.config.onSave) {
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.state.isFocused) {
                        e.preventDefault();
                        this.config.onSave(this.getValue());
                        this.state.isDirty = false;
                        this.updateFooter();
                    }
                });
            }

            console.log('[RichTextEditor] Event handlers set up');
        } catch (error) {
            console.error('[RichTextEditor] Event setup failed:', error);
        }
    }

    executeAction(action, value) {
        if (!this.elements.editor) return;
        
        this.focus();
        this.saveSelection();

        switch (action) {
            case 'undo':
                document.execCommand('undo', false, null);
                break;
            case 'redo':
                document.execCommand('redo', false, null);
                break;
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strikeThrough':
                document.execCommand(action, false, null);
                this.toggleActiveFormat(action);
                break;
            case 'formatBlock':
                document.execCommand('formatBlock', false, value);
                break;
            case 'insertUnorderedList':
            case 'insertOrderedList':
                document.execCommand(action, false, null);
                break;
            case 'indent':
            case 'outdent':
                document.execCommand(action, false, null);
                break;
            case 'justifyLeft':
            case 'justifyCenter':
            case 'justifyRight':
            case 'justifyFull':
                document.execCommand(action, false, null);
                break;
            case 'insertHorizontalRule':
                document.execCommand('insertHorizontalRule', false, null);
                break;
            case 'removeFormat':
                document.execCommand('removeFormat', false, null);
                break;
            case 'createLink':
                this.insertLink();
                break;
            case 'insertImage':
                this.insertImage();
                break;
            case 'insertTable':
                this.insertTable();
                break;
            case 'showEmoji':
                this.state.showEmojiPicker = !this.state.showEmojiPicker;
                this.state.showMentionList = false;
                this.render();
                this.setupEventHandlers();
                break;
            case 'showMention':
                this.state.showMentionList = !this.state.showMentionList;
                this.state.showEmojiPicker = false;
                if (this.state.showMentionList) this.loadMentions('');
                this.render();
                this.setupEventHandlers();
                break;
            case 'showTemplate':
                this.state.showTemplateList = !this.state.showTemplateList;
                this.render();
                this.setupEventHandlers();
                break;
            case 'viewHTML':
                this.toggleHTMLView();
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
            case 'fontSize':
                this.changeFontSize();
                break;
            case 'foreColor':
            case 'hiliteColor':
                this.changeColor(action);
                break;
        }

        this.elements.editor?.focus();
        this.updateActiveFormats();
        this.handleInput();
    }

    handleInput(e) {
        this.state.isDirty = true;
        this.updateCounters();
        this.updateActiveFormats();
        this.saveToHistory();

        if (this.config.onChange) {
            this.config.onChange(this.getValue(), this.getText());
        }

        if (this.config.mentionEnabled) {
            this.checkForMention();
        }

        if (this.config.hashtagEnabled) {
            this.checkForHashtag();
        }

        this.updateFooter();
    }

    handleKeyDown(e) {
        const ctrlKey = e.ctrlKey || e.metaKey;

        if (ctrlKey && e.key === 'b') { e.preventDefault(); this.executeAction('bold'); }
        else if (ctrlKey && e.key === 'i') { e.preventDefault(); this.executeAction('italic'); }
        else if (ctrlKey && e.key === 'u') { e.preventDefault(); this.executeAction('underline'); }
        else if (ctrlKey && e.key === 'k') { e.preventDefault(); this.insertLink(); }
        else if (ctrlKey && e.key === 'z') { e.preventDefault(); document.execCommand('undo'); }
        else if (ctrlKey && e.key === 'y') { e.preventDefault(); document.execCommand('redo'); }
        else if (e.key === 'Tab') { e.preventDefault(); document.execCommand('indent'); }

        if (this.state.showMentionList) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.state.selectedMentionIndex = Math.min(
                    this.state.selectedMentionIndex + 1, 
                    this.state.mentionResults.length - 1
                );
                this.updateMentionSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.state.selectedMentionIndex = Math.max(0, this.state.selectedMentionIndex - 1);
                this.updateMentionSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = this.state.mentionResults[this.state.selectedMentionIndex];
                if (selected) this.insertMention(selected.id, selected.name);
            } else if (e.key === 'Escape') {
                this.state.showMentionList = false;
                this.render();
                this.setupEventHandlers();
            }
        }
    }

    handlePaste(e) {
        if (!this.config.sanitize) return;
        
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const html = e.clipboardData.getData('text/html');
        
        if (html && this.config.allowHTML) {
            const sanitized = this.sanitizeHTML(html);
            document.execCommand('insertHTML', false, sanitized);
        } else {
            document.execCommand('insertText', false, text);
        }
    }

    insertLink() {
        const url = prompt('Enter URL:', 'https://');
        if (!url) return;
        
        const text = window.getSelection()?.toString() || url;
        const html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        document.execCommand('insertHTML', false, html);
    }

    insertImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.config.allowedImageTypes.join(',');
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > this.config.maxImageSize) {
                Toast.show(`Image too large. Max ${this.formatFileSize(this.config.maxImageSize)}`, 'error');
                return;
            }

            if (this.config.onImageUpload) {
                this.config.onImageUpload(file);
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch(this.config.imageUploadURL, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (data.url) {
                    const html = `<img src="${data.url}" alt="${file.name}" style="max-width:100%;">`;
                    document.execCommand('insertHTML', false, html);
                }
            } catch (error) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const html = `<img src="${e.target.result}" alt="${file.name}" style="max-width:100%;">`;
                    document.execCommand('insertHTML', false, html);
                };
                reader.readAsDataURL(file);
            }
        };
        
        input.click();
    }

    insertTable() {
        const rows = prompt('Number of rows:', '3');
        const cols = prompt('Number of columns:', '3');
        if (!rows || !cols) return;

        let html = '<table style="width:100%;border-collapse:collapse;">';
        for (let i = 0; i < parseInt(rows); i++) {
            html += '<tr>';
            for (let j = 0; j < parseInt(cols); j++) {
                html += '<td style="border:1px solid #ddd;padding:8px;">&nbsp;</td>';
            }
            html += '</tr>';
        }
        html += '</table>';
        
        document.execCommand('insertHTML', false, html);
    }

    insertEmoji(emoji) {
        document.execCommand('insertText', false, emoji);
    }

    insertMention(id, name) {
        const mentionHTML = `<span class="rte-mention" data-user-id="${id}" contenteditable="false">@${name}</span>&nbsp;`;
        document.execCommand('insertHTML', false, mentionHTML);
        this.state.showMentionList = false;
        this.render();
        this.setupEventHandlers();
    }

    insertTemplate(templateId) {
        const template = this.config.templates.find(t => t.id === templateId);
        if (template) {
            this.elements.editor.innerHTML = template.content;
            this.handleInput();
        }
    }

    checkForMention() {
        const text = this.getText();
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        
        if (node.nodeType === 3) {
            const textBefore = node.textContent.substring(0, offset);
            const mentionMatch = textBefore.match(new RegExp(`\\${this.config.mentionTrigger}(\\w*)$`));
            
            if (mentionMatch) {
                this.state.mentionQuery = mentionMatch[1];
                this.state.showMentionList = true;
                this.state.selectedMentionIndex = 0;
                this.loadMentions(this.state.mentionQuery);
                this.render();
                this.setupEventHandlers();
            } else {
                this.state.showMentionList = false;
            }
        }
    }

    async loadMentions(query) {
        if (this.config.mentionSource) {
            const results = await this.config.mentionSource(query);
            this.state.mentionResults = results.slice(0, 8);
        } else {
            try {
                const response = await fetch(`/api/users/search?q=${query}`);
                const data = await response.json();
                this.state.mentionResults = (data.users || []).slice(0, 8);
            } catch (error) {
                this.state.mentionResults = [];
            }
        }
        this.render();
        this.setupEventHandlers();
    }

    updateMentionSelection() {
        const items = this.elements.mentionList?.querySelectorAll('.mention-item');
        items?.forEach((item, index) => {
            item.classList.toggle('selected', index === this.state.selectedMentionIndex);
        });
    }

    toggleHTMLView() {
        if (this.state.view === 'html') {
            this.elements.editor.innerHTML = this.elements.editor.textContent;
            this.elements.editor.contentEditable = 'true';
            this.state.view = 'wysiwyg';
        } else {
            this.elements.editor.textContent = this.elements.editor.innerHTML;
            this.elements.editor.contentEditable = 'false';
            this.state.view = 'html';
        }
    }

    toggleFullscreen() {
        this.elements.wrapper?.classList.toggle('fullscreen');
        if (this.elements.wrapper?.classList.contains('fullscreen')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        this.elements.editor?.focus();
    }

    changeFontSize() {
        const size = prompt('Font size (1-7):', '3');
        if (size) document.execCommand('fontSize', false, size);
    }

    changeColor(action) {
        const color = prompt('Enter color (hex):', '#000000');
        if (color) document.execCommand(action, false, color);
    }

    toggleActiveFormat(format) {
        if (this.state.activeFormats.has(format)) {
            this.state.activeFormats.delete(format);
        } else {
            this.state.activeFormats.add(format);
        }
        this.updateToolbarState();
    }

    updateActiveFormats() {
        this.state.activeFormats.clear();
        
        if (document.queryCommandState('bold')) this.state.activeFormats.add('bold');
        if (document.queryCommandState('italic')) this.state.activeFormats.add('italic');
        if (document.queryCommandState('underline')) this.state.activeFormats.add('underline');
        if (document.queryCommandState('strikeThrough')) this.state.activeFormats.add('strikeThrough');
        
        this.updateToolbarState();
    }

    updateToolbarState() {
        const buttons = this.elements.toolbar?.querySelectorAll('.rte-toolbar-btn');
        buttons?.forEach(btn => {
            const action = btn.dataset.action;
            if (action && this.state.activeFormats.has(action)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    updateCounters() {
        const text = this.getText();
        this.state.charCount = text.length;
        this.state.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        this.updateFooter();
    }

    updateFooter() {
        if (this.elements.charCount) {
            this.elements.charCount.textContent = `${this.state.charCount} characters`;
        }
        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = `${this.state.wordCount} words`;
        }
        if (this.elements.footer) {
            const savedStatus = this.elements.footer.querySelector('.rte-saved-status');
            if (savedStatus) {
                savedStatus.textContent = this.state.isDirty ? 'Unsaved changes' : 'Saved';
            }
        }
        
        if (this.elements.textarea) {
            this.elements.textarea.value = this.getValue();
        }
    }

    saveSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0);
        }
    }

    restoreSelection() {
        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }
    }

    saveToHistory() {
        const value = this.getValue();
        
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }
        
        this.state.history.push(value);
        
        if (this.state.history.length > this.state.maxHistory) {
            this.state.history.shift();
        }
        
        this.state.historyIndex = this.state.history.length - 1;
    }

    sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        const allowedTags = ['p','br','b','i','u','strong','em','a','ul','ol','li',
                            'h1','h2','h3','h4','h5','h6','blockquote','pre','code',
                            'table','thead','tbody','tr','td','th','img','span','div','hr'];
        
        const clean = (node) => {
            if (node.nodeType === 3) return;
            if (node.nodeType === 1) {
                if (!allowedTags.includes(node.tagName.toLowerCase())) {
                    node.replaceWith(...node.childNodes);
                    return;
                }
                
                Array.from(node.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase();
                    if (!['href','src','alt','class','style','target','rel'].includes(name)) {
                        node.removeAttribute(name);
                    }
                });
                
                Array.from(node.childNodes).forEach(clean);
            }
        };
        
        clean(temp);
        return temp.innerHTML;
    }

    closeAllPopups() {
        this.state.showEmojiPicker = false;
        this.state.showMentionList = false;
        this.state.showTemplateList = false;
    }

    getValue() {
        return this.elements.editor ? this.elements.editor.innerHTML : '';
    }

    getText() {
        return this.elements.editor ? this.elements.editor.textContent || '' : '';
    }

    setValue(value) {
        if (this.elements.editor) {
            this.elements.editor.innerHTML = value || '';
            this.handleInput();
        }
    }

    focus() {
        this.elements.editor?.focus();
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.closeAllPopups();
        if (this.container) this.container.innerHTML = '';
        console.log('[RichTextEditor] Component destroyed');
    }

    static getInstance(componentId) {
        return window.Global?.RichTextEditor?.instances?.get(componentId);
    }
}

export { RichTextEditor };
export default RichTextEditor;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.RichTextEditor = window.Global.RichTextEditor || {};
    window.Global.RichTextEditor.instances = window.Global.RichTextEditor.instances || new Map();
    window.Global.RichTextEditor.RichTextEditor = RichTextEditor;
}


