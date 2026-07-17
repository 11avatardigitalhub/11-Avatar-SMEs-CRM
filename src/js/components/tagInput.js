/**
 * 11 AVATAR DIGITAL HUB - Tag Input Component
 * Enterprise-grade tag/token input system
 * Autocomplete, validation, drag-sort, color tags, batch operations
 * 
 * @component TagInput
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Validators } from '../utils/validators.js';

/**
 * TagInput - Professional tag/token entry component
 * Multi-value input with autocomplete, validation, drag-reorder
 */
class TagInput {
    constructor(container, options = {}) {
        this.componentName = 'TagInput';
        this.componentId = `ti-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('TagInput: Container not found');

        this.config = {
            value: options.value || [],
            placeholder: options.placeholder || 'Type and press Enter to add tags...',
            maxTags: options.maxTags || 0,
            maxTagLength: options.maxTagLength || 50,
            minTagLength: options.minTagLength || 1,
            allowDuplicates: options.allowDuplicates || false,
            caseSensitive: options.caseSensitive || false,
            separator: options.separator || ['Enter', ',', 'Tab'],
            allowedChars: options.allowedChars || /^[a-zA-Z0-9\s\-_.@#$%&()+]+$/,
            transform: options.transform || 'none',
            suggestions: options.suggestions || [],
            autocomplete: options.autocomplete !== false,
            autocompleteMinChars: options.autocompleteMinChars || 1,
            autocompleteDelay: options.autocompleteDelay || 200,
            validate: options.validate || null,
            onValidate: options.onValidate || null,
            theme: options.theme || 'light',
            size: options.size || 'md',
            colorMap: options.colorMap || null,
            defaultColor: options.defaultColor || '#3B82F6',
            showColors: options.showColors !== false,
            editable: options.editable !== false,
            sortable: options.sortable || false,
            readonly: options.readonly || false,
            disabled: options.disabled || false,
            name: options.name || '',
            required: options.required || false,
            onChange: options.onChange || null,
            onAdd: options.onAdd || null,
            onRemove: options.onRemove || null,
            onInvalid: options.onInvalid || null,
            onMaxReached: options.onMaxReached || null,
            onFocus: options.onFocus || null,
            onBlur: options.onBlur || null
        };

        this.state = {
            tags: [...this.config.value],
            inputValue: '',
            isFocused: false,
            isComposing: false,
            suggestions: [],
            showSuggestions: false,
            selectedSuggestionIndex: -1,
            filteredSuggestions: [],
            draggedTagIndex: -1,
            dropTargetIndex: -1,
            isValid: true,
            errors: []
        };

        this.elements = {
            wrapper: null, input: null, tagsContainer: null,
            suggestionsDropdown: null, hiddenInput: null
        };

        this.autocompleteTimer = null;
        this.lastInputTime = 0;

        this.init();
    }

    init() {
        try {
            console.log(`[TagInput] Initializing: ${this.componentId}`);
            this.render();
            this.bindEvents();
            console.log('[TagInput] Initialized');
        } catch (error) {
            console.error('[TagInput] Init failed:', error);
            this.container.innerHTML = '<div class="ti-error">Failed to load tag input</div>';
        }
    }

    render() {
        const sizeClass = `ti-size-${this.config.size}`;
        const themeClass = `ti-theme-${this.config.theme}`;
        const readonlyClass = this.config.readonly ? 'ti-readonly' : '';
        const disabledClass = this.config.disabled ? 'ti-disabled' : '';
        const focusedClass = this.state.isFocused ? 'ti-focused' : '';
        const errorClass = !this.state.isValid ? 'ti-error' : '';

        const html = `
            <div class="ti-wrapper ${sizeClass} ${themeClass} ${readonlyClass} ${disabledClass} ${focusedClass} ${errorClass}" 
                 id="${this.componentId}">
                <div class="ti-tags-container" id="${this.componentId}-tags">
                    ${this.state.tags.map((tag, index) => this.renderTag(tag, index)).join('')}
                    <input type="text" 
                           class="ti-input" 
                           id="${this.componentId}-input"
                           value="${this.escapeHtml(this.state.inputValue)}"
                           placeholder="${this.state.tags.length === 0 ? this.config.placeholder : ''}"
                           ${this.config.readonly ? 'readonly' : ''}
                           ${this.config.disabled ? 'disabled' : ''}
                           autocomplete="off"
                           spellcheck="false"
                           aria-label="Add tags">
                </div>
                <div class="ti-suggestions" id="${this.componentId}-suggestions" style="display:none;"></div>
                ${this.config.name ? `<input type="hidden" name="${this.config.name}" id="${this.componentId}-hidden" value="${this.getTagsString()}">` : ''}
            </div>`;

        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderTag(tag, index) {
        const color = this.getTagColor(tag, index);
        const isDragged = this.state.draggedTagIndex === index;
        
        return `
            <span class="ti-tag ${isDragged ? 'ti-dragging' : ''}" 
                  data-index="${index}" 
                  data-value="${this.escapeHtml(String(tag))}"
                  style="background: ${color}20; border-color: ${color}; color: ${color};"
                  ${this.config.sortable ? 'draggable="true"' : ''}>
                ${this.config.showColors ? `<span class="ti-tag-dot" style="background:${color};"></span>` : ''}
                <span class="ti-tag-text">${this.escapeHtml(String(tag))}</span>
                ${!this.config.readonly ? `
                    <button class="ti-tag-remove" data-index="${index}" aria-label="Remove ${tag}" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </span>`;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.input = document.getElementById(`${this.componentId}-input`);
        this.elements.tagsContainer = document.getElementById(`${this.componentId}-tags`);
        this.elements.suggestionsDropdown = document.getElementById(`${this.componentId}-suggestions`);
        this.elements.hiddenInput = document.getElementById(`${this.componentId}-hidden`);
    }

    getTagColor(tag, index) {
        if (this.config.colorMap && this.config.colorMap[tag]) {
            return this.config.colorMap[tag];
        }
        const colors = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#D4AF37','#DC2626'];
        return colors[index % colors.length];
    }

    bindEvents() {
        if (this.elements.input) {
            this.elements.input.addEventListener('focus', () => {
                this.state.isFocused = true;
                this.elements.wrapper?.classList.add('ti-focused');
                if (this.config.onFocus) this.config.onFocus();
                if (this.config.autocomplete && this.config.suggestions.length > 0) {
                    this.showSuggestions();
                }
            });

            this.elements.input.addEventListener('blur', (e) => {
                setTimeout(() => {
                    if (!this.container.contains(document.activeElement)) {
                        this.state.isFocused = false;
                        this.elements.wrapper?.classList.remove('ti-focused');
                        this.state.showSuggestions = false;
                        this.updateSuggestionsDisplay();
                        this.addTagFromInput();
                        if (this.config.onBlur) this.config.onBlur();
                    }
                }, 150);
            });

            this.elements.input.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });

            this.elements.input.addEventListener('input', (e) => {
                this.state.inputValue = e.target.value;
                this.lastInputTime = Date.now();
                this.handleAutocomplete();
            });

            this.elements.input.addEventListener('compositionstart', () => {
                this.state.isComposing = true;
            });

            this.elements.input.addEventListener('compositionend', (e) => {
                this.state.isComposing = false;
                this.state.inputValue = e.target.value;
                this.handleAutocomplete();
            });
        }

        if (this.elements.tagsContainer) {
            this.elements.tagsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.ti-tag-remove');
                if (removeBtn) {
                    e.stopPropagation();
                    const index = parseInt(removeBtn.dataset.index);
                    this.removeTag(index);
                } else {
                    this.elements.input?.focus();
                }
            });

            this.elements.tagsContainer.addEventListener('mousedown', (e) => {
                const tagEl = e.target.closest('.ti-tag');
                if (tagEl && this.config.sortable) {
                    this.startDrag(parseInt(tagEl.dataset.index), e);
                }
            });
        }

        if (this.elements.suggestionsDropdown) {
            this.elements.suggestionsDropdown.addEventListener('click', (e) => {
                const item = e.target.closest('.ti-suggestion-item');
                if (item) {
                    this.selectSuggestion(item.dataset.value);
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.state.showSuggestions = false;
                this.updateSuggestionsDisplay();
            }
        });

        console.log('[TagInput] Events bound');
    }

    handleKeyDown(e) {
        const suggestionsVisible = this.state.showSuggestions && this.state.filteredSuggestions.length > 0;

        if (suggestionsVisible) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.state.selectedSuggestionIndex = Math.min(
                        this.state.selectedSuggestionIndex + 1,
                        this.state.filteredSuggestions.length - 1
                    );
                    this.updateSuggestionsDisplay();
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    this.state.selectedSuggestionIndex = Math.max(-1, this.state.selectedSuggestionIndex - 1);
                    this.updateSuggestionsDisplay();
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    if (this.state.selectedSuggestionIndex >= 0) {
                        const suggestion = this.state.filteredSuggestions[this.state.selectedSuggestionIndex];
                        this.selectSuggestion(suggestion);
                    }
                    return;
                case 'Escape':
                    e.preventDefault();
                    this.state.showSuggestions = false;
                    this.state.selectedSuggestionIndex = -1;
                    this.updateSuggestionsDisplay();
                    return;
            }
        }

        if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
            if (!this.state.isComposing) {
                e.preventDefault();
                this.addTagFromInput();
            }
        } else if (e.key === 'Backspace' && this.state.inputValue === '' && this.state.tags.length > 0) {
            e.preventDefault();
            this.removeTag(this.state.tags.length - 1);
        }
    }

    handleAutocomplete() {
        if (!this.config.autocomplete) return;
        if (this.state.isComposing) return;

        clearTimeout(this.autocompleteTimer);

        const inputValue = this.state.inputValue.trim();
        
        if (inputValue.length < this.config.autocompleteMinChars) {
            this.state.showSuggestions = false;
            this.state.selectedSuggestionIndex = -1;
            this.updateSuggestionsDisplay();
            return;
        }

        this.autocompleteTimer = setTimeout(() => {
            const lowerInput = inputValue.toLowerCase();
            this.state.filteredSuggestions = this.config.suggestions.filter(s => {
                const lowerSuggestion = String(s).toLowerCase();
                return lowerSuggestion.includes(lowerInput) && 
                       !this.state.tags.some(t => 
                           this.config.caseSensitive ? t === s : t.toLowerCase() === lowerSuggestion
                       );
            });

            this.state.showSuggestions = this.state.filteredSuggestions.length > 0;
            this.state.selectedSuggestionIndex = -1;
            this.updateSuggestionsDisplay();
        }, this.config.autocompleteDelay);
    }

    updateSuggestionsDisplay() {
        if (!this.elements.suggestionsDropdown) return;

        if (this.state.showSuggestions && this.state.filteredSuggestions.length > 0) {
            const inputRect = this.elements.input?.getBoundingClientRect();
            
            this.elements.suggestionsDropdown.innerHTML = this.state.filteredSuggestions.map((suggestion, index) => `
                <div class="ti-suggestion-item ${index === this.state.selectedSuggestionIndex ? 'active' : ''}" 
                     data-value="${this.escapeHtml(String(suggestion))}">
                    ${this.escapeHtml(String(suggestion))}
                </div>
            `).join('');
            
            this.elements.suggestionsDropdown.style.display = 'block';
            
            if (inputRect) {
                this.elements.suggestionsDropdown.style.top = `${inputRect.bottom + 4}px`;
                this.elements.suggestionsDropdown.style.left = `${inputRect.left}px`;
                this.elements.suggestionsDropdown.style.width = `${inputRect.width}px`;
            }
        } else {
            this.elements.suggestionsDropdown.style.display = 'none';
        }
    }

    selectSuggestion(value) {
        this.addTag(value);
        this.state.inputValue = '';
        this.state.showSuggestions = false;
        this.state.selectedSuggestionIndex = -1;
        this.updateSuggestionsDisplay();
        
        if (this.elements.input) {
            this.elements.input.value = '';
            this.elements.input.focus();
        }
    }

    addTagFromInput() {
        const value = this.state.inputValue.trim();
        if (value) {
            this.addTag(value);
        }
    }

    addTag(value) {
        try {
            if (!value || typeof value !== 'string') return;
            
            let processedValue = value.trim();

            if (processedValue.length < this.config.minTagLength) {
                this.showError(`Tag must be at least ${this.config.minTagLength} character(s)`);
                return;
            }

            if (processedValue.length > this.config.maxTagLength) {
                this.showError(`Tag cannot exceed ${this.config.maxTagLength} characters`);
                return;
            }

            if (this.config.allowedChars && !this.config.allowedChars.test(processedValue)) {
                this.showError('Tag contains invalid characters');
                return;
            }

            switch (this.config.transform) {
                case 'uppercase': processedValue = processedValue.toUpperCase(); break;
                case 'lowercase': processedValue = processedValue.toLowerCase(); break;
                case 'capitalize': processedValue = processedValue.charAt(0).toUpperCase() + processedValue.slice(1).toLowerCase(); break;
            }

            if (!this.config.allowDuplicates) {
                const isDuplicate = this.state.tags.some(tag => 
                    this.config.caseSensitive ? tag === processedValue : tag.toLowerCase() === processedValue.toLowerCase()
                );
                if (isDuplicate) {
                    this.showError('Duplicate tag');
                    return;
                }
            }

            if (this.config.validate) {
                const validationResult = this.config.validate(processedValue);
                if (validationResult !== true) {
                    this.showError(validationResult || 'Invalid tag');
                    if (this.config.onInvalid) this.config.onInvalid(processedValue, validationResult);
                    return;
                }
            }

            if (this.config.maxTags > 0 && this.state.tags.length >= this.config.maxTags) {
                this.showError(`Maximum ${this.config.maxTags} tags allowed`);
                if (this.config.onMaxReached) this.config.onMaxReached(this.state.tags.length);
                return;
            }

            this.state.tags.push(processedValue);
            this.state.inputValue = '';
            this.state.errors = [];

            if (this.elements.input) {
                this.elements.input.value = '';
                this.elements.input.placeholder = '';
            }

            this.refreshTags();
            this.updateHiddenInput();

            if (this.config.onChange) this.config.onChange([...this.state.tags]);
            if (this.config.onAdd) this.config.onAdd(processedValue, this.state.tags.length - 1);

            EventBus.emit('taginput:tag-added', {
                componentId: this.componentId,
                tag: processedValue,
                index: this.state.tags.length - 1,
                allTags: [...this.state.tags]
            });

            this.state.isValid = true;
            this.elements.wrapper?.classList.remove('ti-error');

        } catch (error) {
            console.error('[TagInput] Add tag failed:', error);
        }
    }

    removeTag(index) {
        try {
            if (index < 0 || index >= this.state.tags.length) return;

            const removedTag = this.state.tags[index];
            this.state.tags.splice(index, 1);

            this.refreshTags();
            this.updateHiddenInput();

            if (this.config.onChange) this.config.onChange([...this.state.tags]);
            if (this.config.onRemove) this.config.onRemove(removedTag, index);

            EventBus.emit('taginput:tag-removed', {
                componentId: this.componentId,
                tag: removedTag,
                index,
                allTags: [...this.state.tags]
            });

            if (this.elements.input) {
                this.elements.input.focus();
            }
        } catch (error) {
            console.error('[TagInput] Remove tag failed:', error);
        }
    }

    refreshTags() {
        if (!this.elements.tagsContainer) return;
        
        const inputEl = this.elements.input;
        const inputHTML = inputEl ? inputEl.outerHTML : '';
        
        this.elements.tagsContainer.innerHTML = 
            this.state.tags.map((tag, index) => this.renderTag(tag, index)).join('') + 
            (inputHTML || '<input type="text" class="ti-input">');
        
        this.cacheElements();
        this.bindEvents();
    }

    updateHiddenInput() {
        if (this.elements.hiddenInput) {
            this.elements.hiddenInput.value = this.state.tags.join(',');
        }
    }

    getTagsString() {
        return this.state.tags.join(',');
    }

    getTags() {
        return [...this.state.tags];
    }

    setTags(tags) {
        this.state.tags = Array.isArray(tags) ? [...tags] : [];
        this.refreshTags();
        this.updateHiddenInput();
        if (this.config.onChange) this.config.onChange([...this.state.tags]);
    }

    clearTags() {
        this.state.tags = [];
        this.refreshTags();
        this.updateHiddenInput();
        if (this.config.onChange) this.config.onChange([]);
    }

    showError(message) {
        this.state.isValid = false;
        this.state.errors.push(message);
        this.elements.wrapper?.classList.add('ti-error');
        if (this.config.onValidate) this.config.onValidate(false, message);
        
        setTimeout(() => {
            if (this.state.errors.length === 0) {
                this.state.isValid = true;
                this.elements.wrapper?.classList.remove('ti-error');
            }
        }, 2000);
    }

    startDrag(index, e) {
        this.state.draggedTagIndex = index;
        this.refreshTags();

        const handleMove = (moveEvent) => {
            const tagEls = this.elements.tagsContainer?.querySelectorAll('.ti-tag');
            if (!tagEls) return;
            
            tagEls.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                if (moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom) {
                    this.state.dropTargetIndex = i;
                }
            });
            this.refreshTags();
        };

        const handleUp = () => {
            if (this.state.draggedTagIndex >= 0 && this.state.dropTargetIndex >= 0 &&
                this.state.draggedTagIndex !== this.state.dropTargetIndex) {
                const draggedTag = this.state.tags.splice(this.state.draggedTagIndex, 1)[0];
                this.state.tags.splice(this.state.dropTargetIndex, 0, draggedTag);
                if (this.config.onChange) this.config.onChange([...this.state.tags]);
            }
            
            this.state.draggedTagIndex = -1;
            this.state.dropTargetIndex = -1;
            this.refreshTags();
            
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        if (this.container) this.container.innerHTML = '';
        console.log('[TagInput] Component destroyed');
    }

    static create(container, options) {
        const instance = new TagInput(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.TagInput) window.Global.TagInput = {};
        if (!window.Global.TagInput.instances) window.Global.TagInput.instances = new Map();
        window.Global.TagInput.instances.set(instance.componentId, instance);
        return instance;
    }
}

export { TagInput };
export default TagInput;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.TagInput = window.Global.TagInput || {};
    window.Global.TagInput.instances = window.Global.TagInput.instances || new Map();
    window.Global.TagInput.TagInput = TagInput;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
