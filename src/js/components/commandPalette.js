/**
 * 11 AVATAR DIGITAL HUB - Command Palette Component
 * Enterprise-grade command palette / quick actions system
 * Spotlight-style search, command execution, keyboard shortcuts, recent items
 * 
 * @component CommandPalette
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';

/**
 * CommandPalette - Professional command palette system
 * Quick actions, navigation, search, command execution
 */
class CommandPalette {
    /**
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Component identity
        this.componentName = 'CommandPalette';
        this.componentId = `cmd-${Date.now().toString(36)}`;

        /**
         * Full configuration with enterprise defaults
         * Every option documented and validated
         */
        this.config = {
            // Command definitions
            commands: options.commands || [],
            
            // Groups for organizing commands
            groups: options.groups || [
                { id: 'navigation', label: 'Navigation', icon: 'fa-compass', order: 1 },
                { id: 'actions', label: 'Actions', icon: 'fa-bolt', order: 2 },
                { id: 'search', label: 'Search', icon: 'fa-search', order: 3 },
                { id: 'settings', label: 'Settings', icon: 'fa-cog', order: 4 },
                { id: 'recent', label: 'Recent', icon: 'fa-history', order: 5 }
            ],
            
            // UI Configuration
            placeholder: options.placeholder || 'Type a command or search...',
            emptyMessage: options.emptyMessage || 'No matching commands found',
            loadingMessage: options.loadingMessage || 'Loading commands...',
            maxResults: options.maxResults || 20,
            maxRecentItems: options.maxRecentItems || 10,
            
            // Keyboard shortcuts
            toggleShortcut: options.toggleShortcut || 'Ctrl+K',
            closeShortcut: options.closeShortcut || 'Escape',
            
            // Display options
            showIcons: options.showIcons !== false,
            showShortcuts: options.showShortcuts !== false,
            showDescriptions: options.showDescriptions !== false,
            showGroups: options.showGroups !== false,
            showBadges: options.showBadges || false,
            
            // Behavior
            closeOnSelect: options.closeOnSelect !== false,
            closeOnBlur: options.closeOnBlur !== false,
            closeOnEscape: options.closeOnEscape !== false,
            persistRecent: options.persistRecent !== false,
            persistenceKey: options.persistenceKey || `cmd_recent_${this.componentId}`,
            
            // Search
            searchAlgorithm: options.searchAlgorithm || 'fuzzy',
            minSearchLength: options.minSearchLength || 0,
            debounceTime: options.debounceTime || 100,
            
            // Animation
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 200,
            backdrop: options.backdrop !== false,
            backdropOpacity: options.backdropOpacity || 0.4,
            
            // Theme
            theme: options.theme || 'light',
            position: options.position || 'center',
            width: options.width || '600px',
            maxHeight: options.maxHeight || '400px',
            
            // Callbacks
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            onSelect: options.onSelect || null,
            onSearch: options.onSearch || null,
            onExecute: options.onExecute || null,
            
            // Integration
            enableGlobalSearch: options.enableGlobalSearch || false,
            globalSearchEndpoint: options.globalSearchEndpoint || '/api/search',
            enableAIAssistant: options.enableAIAssistant || false
        };

        /**
         * Internal state management
         * Tracks all mutable state with deep initialization
         */
        this.state = {
            // Visibility
            isOpen: false,
            isAnimating: false,
            
            // Search state
            searchQuery: '',
            filteredCommands: [],
            selectedIndex: 0,
            
            // Command state
            recentCommands: [],
            isExecuting: false,
            executingCommandId: null,
            
            // UI state
            activeGroup: null,
            showAllGroups: true,
            
            // Performance tracking
            openCount: 0,
            lastOpenedAt: null,
            searchCount: 0
        };

        // DOM element cache
        this.elements = {
            overlay: null,
            palette: null,
            searchInput: null,
            resultsList: null,
            resultItems: [],
            footer: null,
            loadingIndicator: null,
            emptyState: null
        };

        // Search debounce timer
        this.searchTimer = null;
        
        // Bound event handlers for cleanup
        this.boundKeyHandler = null;
        this.boundClickHandler = null;

        // Performance metrics
        this.performance = {
            initTime: 0,
            openTime: 0,
            searchTime: 0,
            renderTime: 0,
            averageSearchTime: 0,
            totalSearches: 0
        };

        // Initialize the component
        this.init();
    }

    /**
     * Initialize command palette
     * Sets up DOM, loads persisted state, processes commands, binds global events
     * @async
     */
    async init() {
        try {
            const initStart = performance.now();
            console.log(`[CommandPalette] Initializing: ${this.componentId}`);

            // Validate configuration
            this.validateConfig();

            // Process and index commands for fast searching
            this.processCommands();

            // Load recent commands from persistent storage
            if (this.config.persistRecent) {
                await this.loadRecentCommands();
            }

            // Build the palette DOM structure (hidden initially)
            this.buildPalette();

            // Bind global keyboard shortcut and click handler
            this.bindGlobalEvents();

            // Calculate performance
            this.performance.initTime = performance.now() - initStart;
            
            console.log(`[CommandPalette] Initialized in ${this.performance.initTime.toFixed(2)}ms`);
            console.log(`[CommandPalette] Loaded ${this.config.commands.length} commands in ${this.config.groups.length} groups`);

            // Emit ready event
            EventBus.emit('commandpalette:ready', {
                componentId: this.componentId,
                commandCount: this.config.commands.length,
                groupCount: this.config.groups.length
            });

        } catch (error) {
            console.error('[CommandPalette] Initialization failed:', error);
            
            // Emit error event
            EventBus.emit('commandpalette:error', {
                componentId: this.componentId,
                error: error.message,
                phase: 'initialization'
            });
        }
    }

    /**
     * Validate configuration and set defaults
     * Ensures all required options have valid values
     */
    validateConfig() {
        // Ensure commands array exists
        if (!Array.isArray(this.config.commands)) {
            console.warn('[CommandPalette] Invalid commands configuration, using empty array');
            this.config.commands = [];
        }

        // Validate each command has required fields
        this.config.commands = this.config.commands.map((cmd, index) => ({
            id: cmd.id || `cmd-${index}`,
            label: cmd.label || cmd.title || `Command ${index + 1}`,
            description: cmd.description || '',
            icon: cmd.icon || null,
            shortcut: cmd.shortcut || null,
            group: cmd.group || 'actions',
            keywords: cmd.keywords || [],
            badge: cmd.badge || null,
            badgeColor: cmd.badgeColor || '#3B82F6',
            disabled: cmd.disabled || false,
            hidden: cmd.hidden || false,
            action: cmd.action || null,
            url: cmd.url || null,
            metadata: cmd.metadata || {}
        }));

        // Ensure groups array exists
        if (!Array.isArray(this.config.groups)) {
            this.config.groups = [{ id: 'actions', label: 'Actions', icon: 'fa-bolt', order: 1 }];
        }

        // Sort groups by order
        this.config.groups.sort((a, b) => (a.order || 0) - (b.order || 0));

        console.log('[CommandPalette] Configuration validated:', {
            commands: this.config.commands.length,
            groups: this.config.groups.length,
            shortcut: this.config.toggleShortcut
        });
    }

    /**
     * Process and index commands for efficient searching
     * Creates searchable index with normalized text
     */
    processCommands() {
        // Add search index to each command
        this.config.commands.forEach(cmd => {
            // Combine all searchable text
            cmd._searchText = [
                cmd.label,
                cmd.description,
                ...(cmd.keywords || []),
                cmd.group
            ].filter(Boolean).join(' ').toLowerCase();
            
            // Create character index for fuzzy matching
            cmd._charIndex = {};
            cmd._searchText.split('').forEach((char, i) => {
                if (!cmd._charIndex[char]) cmd._charIndex[char] = [];
                cmd._charIndex[char].push(i);
            });
        });

        console.log('[CommandPalette] Commands processed with search index');
    }

    /**
     * Load recent commands from persistent cache
     * @async
     */
    async loadRecentCommands() {
        try {
            const cached = await Cache.get(this.config.persistenceKey);
            
            if (cached && cached.data && Array.isArray(cached.data)) {
                // Filter to only valid command IDs that still exist
                const validIds = new Set(this.config.commands.map(c => c.id));
                this.state.recentCommands = cached.data
                    .filter(id => validIds.has(id))
                    .slice(0, this.config.maxRecentItems);
                
                console.log(`[CommandPalette] Loaded ${this.state.recentCommands.length} recent commands`);
            }
        } catch (error) {
            console.warn('[CommandPalette] Failed to load recent commands:', error.message);
            this.state.recentCommands = [];
        }
    }

    /**
     * Save recent commands to persistent cache
     * @async
     */
    async saveRecentCommands() {
        if (!this.config.persistRecent) return;
        
        try {
            await Cache.set(
                this.config.persistenceKey,
                this.state.recentCommands.slice(0, this.config.maxRecentItems),
                30 * 24 * 3600000 // 30 days persistence
            );
        } catch (error) {
            console.warn('[CommandPalette] Failed to save recent commands:', error.message);
        }
    }

    /**
     * Add command to recent list
     * @param {string} commandId - Command ID to add
     */
    addToRecent(commandId) {
        // Remove if already exists
        this.state.recentCommands = this.state.recentCommands.filter(id => id !== commandId);
        
        // Add to front
        this.state.recentCommands.unshift(commandId);
        
        // Trim to max
        if (this.state.recentCommands.length > this.config.maxRecentItems) {
            this.state.recentCommands = this.state.recentCommands.slice(0, this.config.maxRecentItems);
        }
        
        // Persist
        this.saveRecentCommands();
    }

    /**
     * Build the command palette DOM structure
     * Creates overlay, palette container, search input, and results list
     */
    buildPalette() {
        try {
            // Create overlay element
            this.elements.overlay = document.createElement('div');
            this.elements.overlay.id = `${this.componentId}-overlay`;
            this.elements.overlay.className = `cmd-overlay cmd-theme-${this.config.theme}`;
            this.elements.overlay.style.cssText = `
                display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,${this.config.backdropOpacity});
                z-index: 9998;
                transition: opacity ${this.config.animationDuration}ms ease;
                opacity: 0;
            `;

            // Create palette container
            this.elements.palette = document.createElement('div');
            this.elements.palette.id = `${this.componentId}-palette`;
            this.elements.palette.className = `cmd-palette cmd-theme-${this.config.theme}`;
            this.elements.palette.setAttribute('role', 'dialog');
            this.elements.palette.setAttribute('aria-label', 'Command Palette');
            this.elements.palette.setAttribute('aria-modal', 'true');
            this.elements.palette.style.cssText = `
                display: none; position: fixed; z-index: 9999;
                width: ${this.config.width}; max-height: ${this.config.maxHeight};
                background: ${this.config.theme === 'dark' ? '#1E1E1E' : '#FFFFFF'};
                border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.25);
                overflow: hidden; font-family: 'Inter', sans-serif;
                transition: opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease;
                opacity: 0; transform: scale(0.95) translateY(-10px);
                border: 1px solid ${this.config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
            `;

            // Build internal structure
            this.elements.palette.innerHTML = `
                <div class="cmd-header">
                    <div class="cmd-search-wrapper">
                        <i class="fas fa-search cmd-search-icon"></i>
                        <input type="text" 
                               class="cmd-search-input" 
                               id="${this.componentId}-search"
                               placeholder="${this.config.placeholder}"
                               autocomplete="off"
                               spellcheck="false"
                               aria-label="Search commands">
                        <span class="cmd-shortcut-hint">${this.formatShortcut(this.config.closeShortcut)} to close</span>
                    </div>
                </div>
                <div class="cmd-results" id="${this.componentId}-results" role="listbox" aria-label="Command results">
                    <div class="cmd-loading" id="${this.componentId}-loading" style="display:none;">
                        <i class="fas fa-spinner fa-spin"></i> ${this.config.loadingMessage}
                    </div>
                    <div class="cmd-empty" id="${this.componentId}-empty" style="display:none;">
                        <i class="fas fa-search"></i>
                        <p>${this.config.emptyMessage}</p>
                    </div>
                    <div class="cmd-results-list" id="${this.componentId}-list"></div>
                </div>
                <div class="cmd-footer" id="${this.componentId}-footer">
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>Enter</kbd> Select</span>
                    <span><kbd>Esc</kbd> Close</span>
                </div>
            `;

            // Append to body
            this.elements.overlay.appendChild(this.elements.palette);
            document.body.appendChild(this.elements.overlay);

            // Cache internal elements
            this.elements.searchInput = document.getElementById(`${this.componentId}-search`);
            this.elements.resultsList = document.getElementById(`${this.componentId}-list`);
            this.elements.loadingIndicator = document.getElementById(`${this.componentId}-loading`);
            this.elements.emptyState = document.getElementById(`${this.componentId}-empty`);
            this.elements.footer = document.getElementById(`${this.componentId}-footer`);

            console.log('[CommandPalette] Palette DOM built');
        } catch (error) {
            console.error('[CommandPalette] Build failed:', error);
        }
    }

    /**
     * Bind global keyboard shortcuts and click handlers
     */
    bindGlobalEvents() {
        // Keyboard shortcut to toggle palette
        this.boundKeyHandler = (e) => {
            // Check for toggle shortcut
            const toggleKeys = this.parseShortcut(this.config.toggleShortcut);
            const closeKeys = this.parseShortcut(this.config.closeShortcut);
            
            if (this.matchShortcut(e, toggleKeys)) {
                e.preventDefault();
                this.toggle();
                return;
            }
            
            // Handle escape key separately
            if (e.key === 'Escape' && this.state.isOpen) {
                e.preventDefault();
                this.close();
                return;
            }

            // Handle keyboard navigation within palette
            if (this.state.isOpen) {
                this.handlePaletteKeyboard(e);
            }
        };

        // Click handler to close on outside click
        this.boundClickHandler = (e) => {
            if (this.state.isOpen && 
                !this.elements.palette.contains(e.target) && 
                this.config.closeOnBlur) {
                this.close();
            }
        };

        // Search input handler
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, this.config.debounceTime);
            });
        }

        // Results list click handler (event delegation)
        if (this.elements.resultsList) {
            this.elements.resultsList.addEventListener('click', (e) => {
                const item = e.target.closest('.cmd-item');
                if (item && item.dataset.commandId) {
                    this.executeCommand(item.dataset.commandId);
                }
            });
        }

        // Add global listeners
        document.addEventListener('keydown', this.boundKeyHandler);
        document.addEventListener('click', this.boundClickHandler);

        console.log('[CommandPalette] Global events bound');
    }

    /**
     * Handle keyboard navigation within the palette
     * @param {KeyboardEvent} e - Keyboard event
     */
    handlePaletteKeyboard(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateResults(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateResults(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.selectCurrentResult();
                break;
            case 'Escape':
                if (this.config.closeOnEscape) {
                    e.preventDefault();
                    this.close();
                }
                break;
        }
    }

    /**
     * Open the command palette
     */
    open() {
        if (this.state.isOpen || this.state.isAnimating) return;

        try {
            const openStart = performance.now();
            
            this.state.isOpen = true;
            this.state.isAnimating = true;
            this.state.searchQuery = '';
            this.state.selectedIndex = 0;
            this.state.openCount++;
            this.state.lastOpenedAt = new Date();

            // Show overlay and palette
            this.elements.overlay.style.display = 'block';
            this.elements.palette.style.display = 'block';

            // Position palette
            this.positionPalette();

            // Clear search
            if (this.elements.searchInput) {
                this.elements.searchInput.value = '';
            }

            // Show initial results (recent + all commands)
            this.filterCommands('');

            // Animate in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.elements.overlay.style.opacity = '1';
                    this.elements.palette.style.opacity = '1';
                    this.elements.palette.style.transform = 'scale(1) translateY(0)';
                });
            });

            // Focus search input
            setTimeout(() => {
                this.elements.searchInput?.focus();
                this.state.isAnimating = false;
            }, this.config.animationDuration);

            // Fire callback
            if (this.config.onOpen) {
                this.config.onOpen({ componentId: this.componentId });
            }

            // Emit event
            EventBus.emit('commandpalette:opened', {
                componentId: this.componentId,
                commandCount: this.config.commands.length
            });

            this.performance.openTime = performance.now() - openStart;
            console.log(`[CommandPalette] Opened in ${this.performance.openTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('[CommandPalette] Open failed:', error);
            this.state.isOpen = false;
            this.state.isAnimating = false;
        }
    }

    /**
     * Close the command palette
     */
    close() {
        if (!this.state.isOpen || this.state.isAnimating) return;

        try {
            this.state.isAnimating = true;

            // Animate out
            this.elements.overlay.style.opacity = '0';
            this.elements.palette.style.opacity = '0';
            this.elements.palette.style.transform = 'scale(0.95) translateY(-10px)';

            // Hide after animation
            setTimeout(() => {
                this.elements.overlay.style.display = 'none';
                this.elements.palette.style.display = 'none';
                this.state.isOpen = false;
                this.state.isAnimating = false;
                this.state.searchQuery = '';
                this.state.filteredCommands = [];
                this.state.selectedIndex = 0;
            }, this.config.animationDuration);

            // Fire callback
            if (this.config.onClose) {
                this.config.onClose({ componentId: this.componentId });
            }

            // Emit event
            EventBus.emit('commandpalette:closed', {
                componentId: this.componentId
            });

        } catch (error) {
            console.error('[CommandPalette] Close failed:', error);
            this.state.isOpen = false;
            this.state.isAnimating = false;
        }
    }

    /**
     * Toggle open/close
     */
    toggle() {
        if (this.state.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Position the palette on screen
     */
    positionPalette() {
        const palette = this.elements.palette;
        if (!palette) return;

        switch (this.config.position) {
            case 'top':
                palette.style.top = '10%';
                palette.style.left = '50%';
                palette.style.transform = 'translate(-50%, 0) scale(0.95)';
                break;
            case 'center':
            default:
                palette.style.top = '50%';
                palette.style.left = '50%';
                palette.style.transform = 'translate(-50%, -50%) scale(0.95)';
                break;
        }
    }

    /**
     * Handle search input
     * @param {string} query - Search query
     */
    handleSearch(query) {
        const searchStart = performance.now();
        
        this.state.searchQuery = query;
        this.state.selectedIndex = 0;
        this.state.searchCount++;
        this.performance.totalSearches++;

        // Filter commands based on query
        this.filterCommands(query);

        // Update UI
        this.renderResults();

        // Fire callback
        if (this.config.onSearch) {
            this.config.onSearch(query, this.state.filteredCommands);
        }

        // Update performance
        this.performance.searchTime = performance.now() - searchStart;
        this.performance.averageSearchTime = 
            ((this.performance.averageSearchTime * (this.performance.totalSearches - 1)) + 
             this.performance.searchTime) / this.performance.totalSearches;
    }

    /**
     * Filter commands based on search query
     * @param {string} query - Search query
     */
    filterCommands(query) {
        const trimmedQuery = query.trim().toLowerCase();

        // If no query, show recent commands first, then all
        if (!trimmedQuery || trimmedQuery.length < this.config.minSearchLength) {
            // Show recent commands first
            const recentCmds = this.state.recentCommands
                .map(id => this.config.commands.find(c => c.id === id && !c.hidden))
                .filter(Boolean);

            // Then show remaining commands
            const remainingCmds = this.config.commands
                .filter(c => !c.hidden && !this.state.recentCommands.includes(c.id));

            this.state.filteredCommands = [...recentCmds, ...remainingCmds]
                .slice(0, this.config.maxResults);
            
            this.state.showAllGroups = true;
            return;
        }

        // Filter with fuzzy search
        const results = [];
        const queryChars = trimmedQuery.split('');

        for (const cmd of this.config.commands) {
            if (cmd.hidden) continue;
            if (results.length >= this.config.maxResults) break;

            // Check disabled state
            if (cmd.disabled) continue;

            let score = 0;

            if (this.config.searchAlgorithm === 'fuzzy') {
                score = this.fuzzyMatch(trimmedQuery, cmd._searchText);
            } else {
                // Simple contains match
                score = cmd._searchText.includes(trimmedQuery) ? 1 : 0;
            }

            if (score > 0) {
                results.push({ command: cmd, score });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        this.state.filteredCommands = results.slice(0, this.config.maxResults).map(r => r.command);
        this.state.showAllGroups = false;
    }

    /**
     * Fuzzy match algorithm
     * @param {string} query - Search query
     * @param {string} text - Text to search in
     * @returns {number} Match score (0 = no match)
     */
    fuzzyMatch(query, text) {
        if (!query || !text) return 0;
        
        let score = 0;
        let queryIndex = 0;
        let lastMatchIndex = -1;
        let consecutiveBonus = 0;
        const textLower = text.toLowerCase();
        const queryLower = query.toLowerCase();

        for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
            if (textLower[i] === queryLower[queryIndex]) {
                // Base score for matching character
                score += 1;
                
                // Bonus for consecutive matches
                if (lastMatchIndex === i - 1) {
                    consecutiveBonus += 2;
                    score += consecutiveBonus;
                } else {
                    consecutiveBonus = 0;
                }

                // Bonus for matching at start of word
                if (i === 0 || textLower[i - 1] === ' ') {
                    score += 3;
                }

                // Bonus for matching at start of text
                if (i === 0) {
                    score += 5;
                }

                lastMatchIndex = i;
                queryIndex++;
            }
        }

        // Only return score if all query characters matched
        return queryIndex === queryLower.length ? score : 0;
    }

    /**
     * Render filtered command results
     */
    renderResults() {
        if (!this.elements.resultsList) return;

        const renderStart = performance.now();

        try {
            // Clear current results
            this.elements.resultsList.innerHTML = '';
            this.elements.resultItems = [];

            // Show loading or empty state
            if (this.state.isExecuting) {
                this.elements.loadingIndicator.style.display = 'block';
                this.elements.emptyState.style.display = 'none';
                return;
            }

            if (this.state.filteredCommands.length === 0) {
                this.elements.loadingIndicator.style.display = 'none';
                this.elements.emptyState.style.display = 'block';
                return;
            }

            this.elements.loadingIndicator.style.display = 'none';
            this.elements.emptyState.style.display = 'none';

            // Group commands if showing all groups
            if (this.state.showAllGroups && this.config.showGroups) {
                this.renderGroupedResults();
            } else {
                this.renderFlatResults();
            }

            this.performance.renderTime = performance.now() - renderStart;

        } catch (error) {
            console.error('[CommandPalette] Render results failed:', error);
        }
    }

    /**
     * Render results grouped by category
     */
    renderGroupedResults() {
        const grouped = {};
        
        // Group commands
        this.state.filteredCommands.forEach(cmd => {
            const groupId = cmd.group || 'actions';
            if (!grouped[groupId]) grouped[groupId] = [];
            grouped[groupId].push(cmd);
        });

        // Sort groups by config order
        const sortedGroups = Object.entries(grouped).sort((a, b) => {
            const groupA = this.config.groups.find(g => g.id === a[0]);
            const groupB = this.config.groups.find(g => g.id === b[0]);
            return (groupA?.order || 99) - (groupB?.order || 99);
        });

        // Render each group
        sortedGroups.forEach(([groupId, commands]) => {
            const groupConfig = this.config.groups.find(g => g.id === groupId);
            
            if (groupConfig && this.config.showGroups) {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'cmd-group-header';
                groupHeader.innerHTML = `
                    <i class="fas ${groupConfig.icon || 'fa-folder'}"></i>
                    <span>${this.escapeHtml(groupConfig.label || groupId)}</span>
                    <span class="cmd-group-count">${commands.length}</span>
                `;
                this.elements.resultsList.appendChild(groupHeader);
            }

            // Render commands in group
            commands.forEach((cmd, index) => {
                const globalIndex = this.state.filteredCommands.indexOf(cmd);
                const item = this.createResultItem(cmd, globalIndex);
                this.elements.resultsList.appendChild(item);
            });
        });
    }

    /**
     * Render flat results (no grouping)
     */
    renderFlatResults() {
        this.state.filteredCommands.forEach((cmd, index) => {
            const item = this.createResultItem(cmd, index);
            this.elements.resultsList.appendChild(item);
        });
    }

    /**
     * Create a single result item element
     * @param {Object} cmd - Command object
     * @param {number} index - Index in filtered results
     * @returns {HTMLElement} Result item element
     */
    createResultItem(cmd, index) {
        const item = document.createElement('div');
        item.className = `cmd-item ${index === this.state.selectedIndex ? 'selected' : ''} ${cmd.disabled ? 'disabled' : ''}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', index === this.state.selectedIndex ? 'true' : 'false');
        item.setAttribute('data-command-id', cmd.id);
        item.setAttribute('data-index', index);
        item.tabIndex = -1;

        item.innerHTML = `
            <div class="cmd-item-content">
                ${this.config.showIcons && cmd.icon ? `
                    <span class="cmd-item-icon" style="color:${cmd.iconColor || '#3B82F6'};">
                        <i class="fas ${cmd.icon}"></i>
                    </span>
                ` : ''}
                
                <div class="cmd-item-text">
                    <span class="cmd-item-label">${this.highlightMatch(cmd.label, this.state.searchQuery)}</span>
                    ${this.config.showDescriptions && cmd.description ? `
                        <span class="cmd-item-description">${this.highlightMatch(cmd.description, this.state.searchQuery)}</span>
                    ` : ''}
                </div>

                <div class="cmd-item-right">
                    ${this.config.showBadges && cmd.badge ? `
                        <span class="cmd-item-badge" style="background:${cmd.badgeColor}15;color:${cmd.badgeColor};">
                            ${this.escapeHtml(String(cmd.badge))}
                        </span>
                    ` : ''}
                    ${this.config.showShortcuts && cmd.shortcut ? `
                        <span class="cmd-item-shortcut">${this.formatShortcut(cmd.shortcut)}</span>
                    ` : ''}
                </div>
            </div>
        `;

        // Store reference
        this.elements.resultItems.push(item);

        return item;
    }

    /**
     * Navigate through result items
     * @param {number} direction - 1 for down, -1 for up
     */
    navigateResults(direction) {
        const maxIndex = this.state.filteredCommands.length - 1;
        if (maxIndex < 0) return;

        this.state.selectedIndex += direction;
        
        // Wrap around
        if (this.state.selectedIndex > maxIndex) this.state.selectedIndex = 0;
        if (this.state.selectedIndex < 0) this.state.selectedIndex = maxIndex;

        // Update UI
        this.updateSelectionUI();

        // Scroll selected item into view
        const selectedItem = this.elements.resultItems[this.state.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Update selection visual state
     */
    updateSelectionUI() {
        this.elements.resultItems.forEach((item, index) => {
            const isSelected = index === this.state.selectedIndex;
            item.classList.toggle('selected', isSelected);
            item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    /**
     * Select the currently highlighted result
     */
    selectCurrentResult() {
        const cmd = this.state.filteredCommands[this.state.selectedIndex];
        if (cmd) {
            this.executeCommand(cmd.id);
        }
    }

    /**
     * Execute a command by ID
     * @param {string} commandId - Command ID to execute
     */
    async executeCommand(commandId) {
        try {
            const cmd = this.config.commands.find(c => c.id === commandId);
            if (!cmd || cmd.disabled) return;

            // Set executing state
            this.state.isExecuting = true;
            this.state.executingCommandId = commandId;
            this.renderResults();

            console.log(`[CommandPalette] Executing: ${cmd.label}`);

            // Add to recent
            this.addToRecent(commandId);

            // Execute the command action
            if (cmd.action && typeof cmd.action === 'function') {
                await cmd.action(cmd);
            } else if (cmd.url) {
                // Navigate to URL
                if (cmd.url.startsWith('http')) {
                    window.open(cmd.url, cmd.metadata?.target || '_self');
                } else {
                    EventBus.emit('route:navigate', { path: cmd.url });
                }
            }

            // Fire callback
            if (this.config.onExecute) {
                this.config.onExecute(cmd);
            }

            // Fire select callback
            if (this.config.onSelect) {
                this.config.onSelect(cmd);
            }

            // Emit event
            EventBus.emit('commandpalette:executed', {
                componentId: this.componentId,
                command: cmd,
                commandId: commandId
            });

            // Close if configured
            if (this.config.closeOnSelect) {
                this.close();
            }

        } catch (error) {
            console.error('[CommandPalette] Execution failed:', error);
            
            // Emit error event
            EventBus.emit('commandpalette:execution-error', {
                componentId: this.componentId,
                commandId,
                error: error.message
            });
        } finally {
            this.state.isExecuting = false;
            this.state.executingCommandId = null;
            
            if (this.state.isOpen) {
                this.renderResults();
            }
        }
    }

    /**
     * Add a new command dynamically
     * @param {Object} command - Command to add
     */
    addCommand(command) {
        const newCommand = {
            id: command.id || `cmd-${Date.now()}`,
            label: command.label || 'New Command',
            description: command.description || '',
            icon: command.icon || null,
            shortcut: command.shortcut || null,
            group: command.group || 'actions',
            keywords: command.keywords || [],
            disabled: command.disabled || false,
            hidden: command.hidden || false,
            action: command.action || null,
            url: command.url || null
        };

        this.config.commands.push(newCommand);
        this.processCommands();

        // Refresh if open
        if (this.state.isOpen) {
            this.filterCommands(this.state.searchQuery);
            this.renderResults();
        }

        console.log(`[CommandPalette] Added command: ${newCommand.label}`);
    }

    /**
     * Remove a command by ID
     * @param {string} commandId - Command ID to remove
     */
    removeCommand(commandId) {
        const index = this.config.commands.findIndex(c => c.id === commandId);
        if (index >= 0) {
            this.config.commands.splice(index, 1);
            this.state.recentCommands = this.state.recentCommands.filter(id => id !== commandId);
            this.saveRecentCommands();

            if (this.state.isOpen) {
                this.filterCommands(this.state.searchQuery);
                this.renderResults();
            }
        }
    }

    /**
     * Format keyboard shortcut for display
     * @param {string} shortcut - Shortcut string (e.g., "Ctrl+K")
     * @returns {string} Formatted HTML
     */
    formatShortcut(shortcut) {
        if (!shortcut) return '';
        return shortcut
            .replace(/Ctrl/g, '⌘')
            .replace(/Cmd/g, '⌘')
            .replace(/Shift/g, '⇧')
            .replace(/Alt/g, '⌥')
            .replace(/Esc/g, '⎋')
            .replace(/Enter/g, '↵')
            .replace(/\+/g, '')
            .split(/\s+/)
            .map(k => `<kbd>${k}</kbd>`)
            .join('');
    }

    /**
     * Parse shortcut string to key object
     * @param {string} shortcut - Shortcut string
     * @returns {Object} Parsed keys
     */
    parseShortcut(shortcut) {
        if (!shortcut) return {};
        
        const parts = shortcut.toLowerCase().split('+');
        return {
            ctrl: parts.includes('ctrl') || parts.includes('cmd'),
            shift: parts.includes('shift'),
            alt: parts.includes('alt'),
            key: parts[parts.length - 1]?.toLowerCase()
        };
    }

    /**
     * Match keyboard event against shortcut
     * @param {KeyboardEvent} e - Keyboard event
     * @param {Object} shortcut - Parsed shortcut
     * @returns {boolean} Whether shortcut matches
     */
    matchShortcut(e, shortcut) {
        return e.key?.toLowerCase() === shortcut.key &&
               e.ctrlKey === (shortcut.ctrl || false) &&
               e.shiftKey === (shortcut.shift || false) &&
               e.altKey === (shortcut.alt || false);
    }

    /**
     * Highlight matching text in search results
     * @param {string} text - Text to highlight
     * @param {string} query - Search query
     * @returns {string} HTML with highlighted matches
     */
    highlightMatch(text, query) {
        if (!text || !query || query.length < this.config.minSearchLength) {
            return this.escapeHtml(text);
        }

        const escapedQuery = this.escapeRegex(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return this.escapeHtml(text).replace(
            new RegExp(`(${escapedQuery})`, 'gi'),
            '<mark class="cmd-highlight">$1</mark>'
        );
    }

    /**
     * Escape special regex characters
     * @param {string} string - String to escape
     * @returns {string} Escaped string
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get all commands
     * @returns {Array} Array of commands
     */
    getCommands() {
        return [...this.config.commands];
    }

    /**
     * Check if palette is open
     * @returns {boolean} Open state
     */
    isOpen() {
        return this.state.isOpen;
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
        try {
            // Remove global event listeners
            document.removeEventListener('keydown', this.boundKeyHandler);
            document.removeEventListener('click', this.boundClickHandler);

            // Remove DOM elements
            if (this.elements.overlay && this.elements.overlay.parentNode) {
                this.elements.overlay.parentNode.removeChild(this.elements.overlay);
            }

            // Clear state
            this.state.filteredCommands = [];
            this.state.recentCommands = [];
            this.elements.resultItems = [];

            console.log('[CommandPalette] Component destroyed');
        } catch (error) {
            console.error('[CommandPalette] Destroy failed:', error);
        }
    }

    /**
     * Static factory method
     * @param {Object} options - Configuration
     * @returns {CommandPalette} Instance
     */
    static create(options) {
        const instance = new CommandPalette(options);
        
        if (!window.Global) window.Global = {};
        if (!window.Global.CommandPalette) window.Global.CommandPalette = {};
        if (!window.Global.CommandPalette.instances) window.Global.CommandPalette.instances = new Map();
        
        window.Global.CommandPalette.instances.set(instance.componentId, instance);
        
        return instance;
    }

    /**
     * Get instance by component ID
     * @param {string} componentId - Component ID
     * @returns {CommandPalette|null} Instance
     */
    static getInstance(componentId) {
        return window.Global?.CommandPalette?.instances?.get(componentId) || null;
    }
}

// Export
export { CommandPalette };
export default CommandPalette;

// Global scope
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.CommandPalette = window.Global.CommandPalette || {};
    window.Global.CommandPalette.instances = window.Global.CommandPalette.instances || new Map();
    window.Global.CommandPalette.CommandPalette = CommandPalette;
}


