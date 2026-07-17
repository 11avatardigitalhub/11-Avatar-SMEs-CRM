/**
 * 11 AVATAR DIGITAL HUB - Search Bar Component
 * Enterprise-grade reusable search with autocomplete, filters, voice, recent searches
 * Global search, command palette, advanced filters, search history
 * 
 * @component SearchBar
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';

/**
 * SearchBar - Universal search component with autocomplete
 * Global search, command palette, filters, voice input, history
 */
class SearchBar {
    constructor(container, options = {}) {
        this.componentName = 'SearchBar';
        this.componentId = `sb-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('SearchBar: Container not found');

        this.config = {
            mode: options.mode || 'global',
            placeholder: options.placeholder || 'Search...',
            searchEndpoint: options.searchEndpoint || '/api/search',
            autocompleteEndpoint: options.autocompleteEndpoint || '/api/search/autocomplete',
            minChars: options.minChars || 2,
            debounceTime: options.debounceTime || 300,
            maxResults: options.maxResults || 10,
            maxHistory: options.maxHistory || 20,
            maxSuggestions: options.maxSuggestions || 8,
            categories: options.categories || [],
            showCategories: options.showCategories !== false,
            showFilters: options.showFilters || false,
            filters: options.filters || [],
            showVoice: options.showVoice || false,
            showClear: options.showClear !== false,
            showIcon: options.showIcon !== false,
            showShortcut: options.showShortcut || false,
            shortcutKey: options.shortcutKey || '/',
            searchOnEnter: options.searchOnEnter !== false,
            searchOnType: options.searchOnType || false,
            autoFocus: options.autoFocus || false,
            expandOnFocus: options.expandOnFocus || false,
            fullWidth: options.fullWidth || false,
            size: options.size || 'md',
            theme: options.theme || 'light',
            layout: options.layout || 'default',
            enableHistory: options.enableHistory !== false,
            enableAutocomplete: options.enableAutocomplete !== false,
            enableCommandPalette: options.enableCommandPalette || false,
            commands: options.commands || [],
            onSearch: options.onSearch || null,
            onClear: options.onClear || null,
            onSelect: options.onSelect || null,
            onFocus: options.onFocus || null,
            onBlur: options.onBlur || null,
            onVoiceResult: options.onVoiceResult || null,
            onFilterChange: options.onFilterChange || null
        };

        this.state = {
            query: '',
            isFocused: false,
            isOpen: false,
            isLoading: false,
            results: [],
            suggestions: [],
            history: [],
            selectedIndex: -1,
            activeFilters: new Map(),
            showFilters: false,
            showCommands: false,
            voiceListening: false
        };

        this.elements = {
            wrapper: null, input: null, dropdown: null,
            icon: null, clearBtn: null, voiceBtn: null,
            shortcut: null, filterBar: null, commandPalette: null
        };

        this.searchTimeout = null;
        this.voiceRecognition = null;

        this.init();
    }

    async init() {
        try {
            console.log(`[SearchBar] Initializing: ${this.componentId}`);
            await this.loadHistory();
            this.render();
            this.setupEventHandlers();
            if (this.config.autoFocus) this.focus();
            if (this.config.showVoice) this.setupVoiceRecognition();
            console.log('[SearchBar] Initialized');
        } catch (error) {
            console.error('[SearchBar] Init failed:', error);
        }
    }

    render() {
        const sizeClass = `search-size-${this.config.size}`;
        const expandClass = this.config.expandOnFocus ? 'expand-on-focus' : '';
        
        const html = `
            <div class="searchbar-wrapper ${sizeClass} ${expandClass} ${this.config.theme} ${this.config.layout}" 
                 id="${this.componentId}">
                <div class="searchbar-input-group ${this.state.isFocused ? 'focused' : ''}">
                    ${this.config.showIcon ? `
                        <span class="searchbar-icon">
                            <i class="fas fa-search"></i>
                        </span>
                    ` : ''}
                    
                    <input type="text" 
                           class="searchbar-input" 
                           id="${this.componentId}-input"
                           value="${this.escapeHtml(this.state.query)}"
                           placeholder="${this.config.placeholder}"
                           aria-label="Search"
                           aria-autocomplete="list"
                           aria-expanded="${this.state.isOpen}"
                           aria-controls="${this.componentId}-dropdown"
                           autocomplete="off"
                           spellcheck="false">
                    
                    <div class="searchbar-input-actions">
                        ${this.state.isLoading ? `
                            <span class="searchbar-loading">
                                <i class="fas fa-spinner fa-spin"></i>
                            </span>
                        ` : ''}
                        
                        ${this.config.showVoice ? `
                            <button class="searchbar-voice-btn ${this.state.voiceListening ? 'listening' : ''}" 
                                    id="${this.componentId}-voice" 
                                    aria-label="Voice search"
                                    title="Voice search">
                                <i class="fas fa-microphone"></i>
                            </button>
                        ` : ''}
                        
                        ${this.config.showClear && this.state.query ? `
                            <button class="searchbar-clear-btn" id="${this.componentId}-clear" 
                                    aria-label="Clear search">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        
                        ${this.config.showShortcut ? `
                            <kbd class="searchbar-shortcut" id="${this.componentId}-shortcut">
                                ${this.formatShortcut()}
                            </kbd>
                        ` : ''}
                    </div>
                </div>

                ${this.config.showFilters ? this.renderFilterBar() : ''}
                
                <div class="searchbar-dropdown ${this.state.isOpen ? 'open' : ''}" 
                     id="${this.componentId}-dropdown"
                     role="listbox"
                     aria-label="Search results">
                    ${this.renderDropdown()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderFilterBar() {
        if (!this.state.showFilters) return '';
        
        return `
            <div class="searchbar-filter-bar" id="${this.componentId}-filters">
                ${this.config.filters.map(filter => `
                    <div class="searchbar-filter">
                        <select class="filter-select" data-filter="${filter.field}" 
                                aria-label="Filter by ${filter.label}">
                            <option value="">${filter.label}</option>
                            ${filter.options.map(opt => `
                                <option value="${opt.value}" ${this.state.activeFilters.get(filter.field) === opt.value ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `).join('')}
                ${this.state.activeFilters.size > 0 ? `
                    <button class="btn btn-sm btn-outline clear-filters-btn">
                        <i class="fas fa-times"></i> Clear Filters
                    </button>
                ` : ''}
            </div>
        `;
    }

    renderDropdown() {
        if (!this.state.isOpen) return '';
        
        const hasContent = this.state.results.length > 0 || 
                          this.state.suggestions.length > 0 || 
                          this.state.history.length > 0;

        if (!hasContent && !this.state.isLoading) {
            if (this.state.query.length >= this.config.minChars) {
                return `
                    <div class="searchbar-no-results">
                        <i class="fas fa-search"></i>
                        <p>No results found for "${this.escapeHtml(this.state.query)}"</p>
                    </div>
                `;
            }
            return '';
        }

        return `
            ${this.state.history.length > 0 && !this.state.query ? this.renderHistory() : ''}
            ${this.state.suggestions.length > 0 ? this.renderSuggestions() : ''}
            ${this.state.results.length > 0 ? this.renderResults() : ''}
            ${this.config.enableCommandPalette ? this.renderCommands() : ''}
            <div class="searchbar-dropdown-footer">
                <span>Press <kbd>↑↓</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close</span>
            </div>
        `;
    }

    renderHistory() {
        return `
            <div class="searchbar-section">
                <div class="searchbar-section-header">
                    <span><i class="fas fa-history"></i> Recent Searches</span>
                    <button class="clear-history-btn" id="${this.componentId}-clear-history">
                        Clear History
                    </button>
                </div>
                ${this.state.history.slice(0, 5).map((item, index) => `
                    <div class="searchbar-item history-item ${index === this.state.selectedIndex ? 'selected' : ''}" 
                         data-query="${this.escapeHtml(item)}"
                         role="option" aria-selected="${index === this.state.selectedIndex}">
                        <i class="fas fa-history"></i>
                        <span>${this.escapeHtml(item)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSuggestions() {
        return `
            <div class="searchbar-section">
                <div class="searchbar-section-header">
                    <span><i class="fas fa-lightbulb"></i> Suggestions</span>
                </div>
                ${this.state.suggestions.map((suggestion, index) => `
                    <div class="searchbar-item suggestion-item ${index === this.state.selectedIndex ? 'selected' : ''}" 
                         data-query="${this.escapeHtml(suggestion.text || suggestion)}"
                         role="option" aria-selected="${index === this.state.selectedIndex}">
                        <i class="fas fa-search"></i>
                        <span>${this.highlightMatch(suggestion.text || suggestion, this.state.query)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderResults() {
        const groupedResults = this.groupResultsByCategory();
        
        return Object.entries(groupedResults).map(([category, results]) => `
            <div class="searchbar-section">
                ${this.config.showCategories && category !== 'other' ? `
                    <div class="searchbar-section-header">
                        <span>${this.getCategoryIcon(category)} ${category}</span>
                        <span class="result-count">${results.length}</span>
                    </div>
                ` : ''}
                ${results.map((result, index) => `
                    <div class="searchbar-item result-item ${index === this.state.selectedIndex ? 'selected' : ''}" 
                         data-id="${result.id}" data-category="${category}"
                         role="option" aria-selected="${index === this.state.selectedIndex}">
                        ${result.icon ? `<i class="fas ${result.icon}"></i>` : ''}
                        <div class="result-content">
                            <span class="result-title">${this.highlightMatch(result.title || result.name, this.state.query)}</span>
                            ${result.subtitle ? `
                                <span class="result-subtitle">${result.subtitle}</span>
                            ` : ''}
                        </div>
                        ${result.badge ? `
                            <span class="result-badge" style="background:${result.badgeColor || '#3B82F6'}20;color:${result.badgeColor || '#3B82F6'}">
                                ${result.badge}
                            </span>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    renderCommands() {
        if (!this.state.showCommands) return '';
        
        return `
            <div class="searchbar-section">
                <div class="searchbar-section-header">
                    <span><i class="fas fa-terminal"></i> Commands</span>
                </div>
                ${this.config.commands.filter(cmd => 
                    !this.state.query || cmd.name.toLowerCase().includes(this.state.query.toLowerCase())
                ).map(cmd => `
                    <div class="searchbar-item command-item" data-command="${cmd.name}">
                        <i class="fas ${cmd.icon || 'fa-chevron-right'}"></i>
                        <div class="command-content">
                            <span>${cmd.name}</span>
                            <span class="command-description">${cmd.description || ''}</span>
                        </div>
                        ${cmd.shortcut ? `<kbd>${cmd.shortcut}</kbd>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.input = document.getElementById(`${this.componentId}-input`);
        this.elements.dropdown = document.getElementById(`${this.componentId}-dropdown`);
        this.elements.clearBtn = document.getElementById(`${this.componentId}-clear`);
        this.elements.voiceBtn = document.getElementById(`${this.componentId}-voice`);
        this.elements.filterBar = document.getElementById(`${this.componentId}-filters`);
    }

    setupEventHandlers() {
        try {
            if (this.elements.input) {
                this.elements.input.addEventListener('focus', () => {
                    this.state.isFocused = true;
                    this.open();
                    if (this.config.onFocus) this.config.onFocus();
                });

                this.elements.input.addEventListener('blur', (e) => {
                    setTimeout(() => {
                        if (!this.container.contains(document.activeElement)) {
                            this.state.isFocused = false;
                            this.close();
                            if (this.config.onBlur) this.config.onBlur();
                        }
                    }, 200);
                });

                this.elements.input.addEventListener('input', (e) => {
                    this.state.query = e.target.value;
                    this.state.selectedIndex = -1;

                    if (this.state.query.length >= this.config.minChars) {
                        if (this.config.searchOnType) {
                            this.performSearch();
                        } else {
                            this.fetchAutocomplete();
                        }
                    } else {
                        this.state.results = [];
                        this.state.suggestions = [];
                        this.updateDropdown();
                    }
                });

                this.elements.input.addEventListener('keydown', (e) => {
                    this.handleKeyboardNavigation(e);
                });
            }

            if (this.elements.dropdown) {
                this.elements.dropdown.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    
                    const item = e.target.closest('.searchbar-item');
                    if (!item) return;

                    if (item.classList.contains('history-item') || item.classList.contains('suggestion-item')) {
                        this.state.query = item.dataset.query;
                        this.elements.input.value = this.state.query;
                        this.performSearch();
                    } else if (item.classList.contains('result-item')) {
                        this.selectResult(item.dataset.id, item.dataset.category);
                    } else if (item.classList.contains('command-item')) {
                        this.executeCommand(item.dataset.command);
                    }
                });
            }

            if (this.elements.clearBtn) {
                this.elements.clearBtn.addEventListener('click', () => this.clear());
            }

            if (this.config.showFilters && this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.classList.contains('filter-select')) {
                        const field = e.target.dataset.filter;
                        const value = e.target.value;
                        
                        if (value) {
                            this.state.activeFilters.set(field, value);
                        } else {
                            this.state.activeFilters.delete(field);
                        }
                        
                        if (this.config.onFilterChange) {
                            this.config.onFilterChange(field, value, this.state.activeFilters);
                        }
                        
                        if (this.state.query.length >= this.config.minChars) {
                            this.performSearch();
                        }
                    }
                });

                const clearFiltersBtn = this.elements.filterBar.querySelector('.clear-filters-btn');
                if (clearFiltersBtn) {
                    clearFiltersBtn.addEventListener('click', () => {
                        this.state.activeFilters.clear();
                        this.render();
                        this.setupEventHandlers();
                    });
                }
            }

            if (this.config.showShortcut) {
                document.addEventListener('keydown', (e) => {
                    if (e.key === this.config.shortcutKey && 
                        !e.target.closest('input') && 
                        !e.target.closest('textarea') &&
                        !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.focus();
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (!this.container.contains(e.target)) {
                    this.close();
                }
            });

            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    this.focus();
                }
            });

            console.log('[SearchBar] Event handlers set up');
        } catch (error) {
            console.error('[SearchBar] Event setup failed:', error);
        }
    }

    handleKeyboardNavigation(e) {
        const items = this.elements.dropdown?.querySelectorAll('.searchbar-item');
        if (!items || items.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.state.selectedIndex = Math.min(this.state.selectedIndex + 1, items.length - 1);
                this.updateDropdownSelection(items);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.state.selectedIndex = Math.max(this.state.selectedIndex - 1, -1);
                this.updateDropdownSelection(items);
                break;

            case 'Enter':
                e.preventDefault();
                if (this.state.selectedIndex >= 0) {
                    const selectedItem = items[this.state.selectedIndex];
                    if (selectedItem) {
                        if (selectedItem.classList.contains('result-item')) {
                            this.selectResult(selectedItem.dataset.id, selectedItem.dataset.category);
                        } else {
                            const query = selectedItem.dataset.query;
                            if (query) {
                                this.state.query = query;
                                this.elements.input.value = query;
                                this.performSearch();
                            }
                        }
                    }
                } else if (this.config.searchOnEnter) {
                    this.performSearch();
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.close();
                this.elements.input?.blur();
                break;
        }
    }

    updateDropdownSelection(items) {
        items.forEach((item, index) => {
            if (index === this.state.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    async performSearch() {
        if (this.state.query.length < this.config.minChars) return;

        try {
            this.state.isLoading = true;
            this.updateInputState();

            const params = new URLSearchParams({
                q: this.state.query,
                limit: this.config.maxResults
            });

            this.state.activeFilters.forEach((value, key) => {
                params.set(`filter_${key}`, value);
            });

            const response = await fetch(`${this.config.searchEndpoint}?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                this.state.results = data.results || [];
                this.addToHistory(this.state.query);
            }

            if (this.config.onSearch) {
                this.config.onSearch(this.state.query, this.state.results, this.state.activeFilters);
            }

        } catch (error) {
            console.error('[SearchBar] Search failed:', error);
            this.state.results = [];
        } finally {
            this.state.isLoading = false;
            this.updateDropdown();
            this.updateInputState();
        }
    }

    async fetchAutocomplete() {
        if (!this.config.enableAutocomplete) return;
        if (this.state.query.length < this.config.minChars) return;

        try {
            const response = await fetch(
                `${this.config.autocompleteEndpoint}?q=${encodeURIComponent(this.state.query)}&limit=${this.config.maxSuggestions}`
            );
            const data = await response.json();

            if (data.success) {
                this.state.suggestions = data.suggestions || [];
                this.updateDropdown();
            }
        } catch (error) {
            console.error('[SearchBar] Autocomplete failed:', error);
        }
    }

    selectResult(id, category) {
        this.close();
        
        const result = this.state.results.find(r => r.id === id);
        if (result && this.config.onSelect) {
            this.config.onSelect(result, category);
        }
        
        EventBus.emit('search:result-selected', { id, category, result });
    }

    executeCommand(commandName) {
        this.close();
        this.clear();
        
        const command = this.config.commands.find(c => c.name === commandName);
        if (command && command.action) {
            command.action();
        }
        
        EventBus.emit('search:command-executed', { command: commandName });
    }

    open() {
        if (this.state.isOpen) return;
        this.state.isOpen = true;
        
        if (!this.state.query && this.config.enableHistory) {
            this.state.history = this.getHistory();
        }
        
        if (this.config.enableCommandPalette && this.state.query.startsWith('>')) {
            this.state.showCommands = true;
        }
        
        this.updateDropdown();
    }

    close() {
        this.state.isOpen = false;
        this.state.selectedIndex = -1;
        this.state.showCommands = false;
        this.updateDropdown();
    }

    focus() {
        this.elements.input?.focus();
    }

    clear() {
        this.state.query = '';
        this.state.results = [];
        this.state.suggestions = [];
        this.state.selectedIndex = -1;
        this.state.showCommands = false;
        
        if (this.elements.input) this.elements.input.value = '';
        
        this.updateDropdown();
        
        if (this.config.onClear) this.config.onClear();
    }

    updateInputState() {
        if (this.elements.wrapper) {
            if (this.state.isLoading) {
                this.elements.wrapper.classList.add('loading');
            } else {
                this.elements.wrapper.classList.remove('loading');
            }
        }
    }

    updateDropdown() {
        if (this.elements.dropdown) {
            this.elements.dropdown.innerHTML = this.renderDropdown();
            this.elements.dropdown.style.display = this.state.isOpen ? 'block' : 'none';
        }
    }

    addToHistory(query) {
        if (!this.config.enableHistory || !query.trim()) return;
        
        this.state.history = this.state.history.filter(h => h !== query);
        this.state.history.unshift(query);
        
        if (this.state.history.length > this.config.maxHistory) {
            this.state.history = this.state.history.slice(0, this.config.maxHistory);
        }
        
        this.saveHistory();
    }

    getHistory() {
        return [...this.state.history];
    }

    async loadHistory() {
        try {
            const cached = await Cache.get(`searchbar_history_${this.componentId}`);
            if (cached && cached.data) {
                this.state.history = cached.data;
            }
        } catch (error) {
            console.error('[SearchBar] History load failed:', error);
        }
    }

    async saveHistory() {
        try {
            await Cache.set(`searchbar_history_${this.componentId}`, 
                this.state.history, 30 * 24 * 3600000);
        } catch (error) {
            console.error('[SearchBar] History save failed:', error);
        }
    }

    async clearHistory() {
        this.state.history = [];
        await Cache.delete(`searchbar_history_${this.componentId}`);
        this.updateDropdown();
    }

    setupVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('[SearchBar] Voice recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.voiceRecognition = new SpeechRecognition();
        this.voiceRecognition.lang = 'en-IN';
        this.voiceRecognition.interimResults = false;
        this.voiceRecognition.maxAlternatives = 1;

        this.voiceRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.state.query = transcript;
            if (this.elements.input) this.elements.input.value = transcript;
            this.state.voiceListening = false;
            
            if (this.config.onVoiceResult) this.config.onVoiceResult(transcript);
            
            if (transcript.length >= this.config.minChars) {
                this.performSearch();
            }
        };

        this.voiceRecognition.onerror = () => {
            this.state.voiceListening = false;
        };

        this.voiceRecognition.onend = () => {
            this.state.voiceListening = false;
        };

        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.addEventListener('click', () => {
                if (this.state.voiceListening) {
                    this.voiceRecognition.stop();
                    this.state.voiceListening = false;
                } else {
                    this.voiceRecognition.start();
                    this.state.voiceListening = true;
                }
            });
        }
    }

    groupResultsByCategory() {
        const grouped = {};
        
        this.state.results.forEach(result => {
            const category = result.category || result.type || 'other';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(result);
        });
        
        return grouped;
    }

    getCategoryIcon(category) {
        const icons = {
            'clients': 'fa-building',
            'leads': 'fa-user-plus',
            'deals': 'fa-handshake',
            'invoices': 'fa-file-invoice',
            'payments': 'fa-rupee-sign',
            'tasks': 'fa-tasks',
            'projects': 'fa-project-diagram',
            'contacts': 'fa-address-book',
            'products': 'fa-box'
        };
        return `<i class="fas ${icons[category.toLowerCase()] || 'fa-circle'}"></i>`;
    }

    highlightMatch(text, query) {
        if (!text || !query) return this.escapeHtml(text);
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatShortcut() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        return isMac ? '⌘K' : 'Ctrl+K';
    }

    getValue() {
        return {
            query: this.state.query,
            filters: Object.fromEntries(this.state.activeFilters)
        };
    }

    setValue(query) {
        this.state.query = query || '';
        if (this.elements.input) this.elements.input.value = this.state.query;
        if (query && query.length >= this.config.minChars) this.performSearch();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        if (this.voiceRecognition) {
            this.voiceRecognition.stop();
            this.voiceRecognition = null;
        }
        if (this.container) this.container.innerHTML = '';
        console.log('[SearchBar] Component destroyed');
    }

    static getInstance(componentId) {
        return window.Global?.SearchBar?.instances?.get(componentId);
    }
}

export { SearchBar };
export default SearchBar;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.SearchBar = window.Global.SearchBar || {};
    window.Global.SearchBar.instances = window.Global.SearchBar.instances || new Map();
    window.Global.SearchBar.SearchBar = SearchBar;
}

