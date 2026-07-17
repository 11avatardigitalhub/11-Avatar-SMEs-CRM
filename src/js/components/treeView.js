/**
 * 11 AVATAR DIGITAL HUB - Tree View Component
 * Enterprise-grade hierarchical tree visualization
 * Expand/collapse, lazy loading, checkboxes, drag-drop, virtual scroll, search
 * 
 * @component TreeView
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';

/**
 * TreeView - Complete hierarchical tree component
 * File browsers, org charts, category trees, folder structures
 */
class TreeView {
    /**
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration
     */
    constructor(container, options = {}) {
        this.componentName = 'TreeView';
        this.componentId = `tv-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('TreeView: Container not found');

        this.config = {
            data: options.data || [],
            dataUrl: options.dataUrl || null,
            idKey: options.idKey || 'id',
            labelKey: options.labelKey || 'label',
            childrenKey: options.childrenKey || 'children',
            hasChildrenKey: options.hasChildrenKey || 'hasChildren',
            expandedKey: options.expandedKey || 'expanded',
            selectedKey: options.selectedKey || 'selected',
            checkedKey: options.checkedKey || 'checked',
            iconKey: options.iconKey || 'icon',
            disabledKey: options.disabledKey || 'disabled',
            lazyLoad: options.lazyLoad || false,
            lazyLoadUrl: options.lazyLoadUrl || null,
            showIcons: options.showIcons !== false,
            showLines: options.showLines !== false,
            showConnectors: options.showConnectors !== false,
            showCheckboxes: options.showCheckboxes || false,
            checkOnSelect: options.checkOnSelect || false,
            cascadeCheck: options.cascadeCheck || false,
            multiSelect: options.multiSelect !== false,
            expandOnClick: options.expandOnClick !== false,
            expandOnDoubleClick: options.expandOnDoubleClick || false,
            collapseSiblings: options.collapseSiblings || false,
            animateExpand: options.animateExpand !== false,
            animationDuration: options.animationDuration || 250,
            searchable: options.searchable || false,
            searchPlaceholder: options.searchPlaceholder || 'Search tree...',
            searchMinChars: options.searchMinChars || 1,
            searchDebounce: options.searchDebounce || 300,
            draggable: options.draggable || false,
            droppable: options.droppable || false,
            sortable: options.sortable || false,
            sortComparator: options.sortComparator || null,
            virtualScroll: options.virtualScroll || false,
            virtualItemHeight: options.virtualItemHeight || 36,
            virtualOverscan: options.virtualOverscan || 10,
            maxHeight: options.maxHeight || 0,
            theme: options.theme || 'light',
            size: options.size || 'md',
            nodeRenderer: options.nodeRenderer || null,
            onToggle: options.onToggle || null,
            onSelect: options.onSelect || null,
            onCheck: options.onCheck || null,
            onExpand: options.onExpand || null,
            onCollapse: options.onCollapse || null,
            onDrop: options.onDrop || null,
            onSearch: options.onSearch || null,
            onLazyLoad: options.onLazyLoad || null
        };

        this.state = {
            nodes: [],
            flattenedNodes: [],
            expandedIds: new Set(),
            selectedIds: new Set(),
            checkedIds: new Set(),
            disabledIds: new Set(),
            searchQuery: '',
            searchResults: [],
            isSearching: false,
            isLoading: false,
            draggedNodeId: null,
            dropTargetId: null,
            dropPosition: null
        };

        this.elements = {
            wrapper: null,
            searchInput: null,
            treeList: null,
            dragGhost: null
        };

        this.virtualState = {
            scrollTop: 0,
            startIndex: 0,
            endIndex: 0,
            totalHeight: 0
        };

        this.searchTimer = null;
        this.performance = {
            initTime: 0,
            renderTime: 0,
            nodeCount: 0
        };

        this.init();
    }

    async init() {
        try {
            const startTime = performance.now();
            console.log(`[TreeView] Initializing: ${this.componentId}`);

            if (this.config.dataUrl) {
                await this.loadData();
            } else {
                this.processNodes(this.config.data);
            }

            this.render();
            this.bindEvents();

            this.performance.initTime = performance.now() - startTime;
            console.log(`[TreeView] Initialized in ${this.performance.initTime.toFixed(2)}ms`);
            
            EventBus.emit('treeview:ready', {
                componentId: this.componentId,
                nodeCount: this.state.nodes.length
            });
        } catch (error) {
            console.error('[TreeView] Init failed:', error);
            this.container.innerHTML = `<div class="tv-error" role="alert">Failed to load tree: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    async loadData() {
        try {
            this.state.isLoading = true;
            this.render();
            
            const response = await fetch(this.config.dataUrl);
            const data = await response.json();
            const nodes = data.nodes || data.data || data;
            
            this.processNodes(nodes);
            this.state.isLoading = false;
        } catch (error) {
            console.error('[TreeView] Data load failed:', error);
            this.state.isLoading = false;
            throw error;
        }
    }

    processNodes(nodes, parentId = null, level = 0) {
        if (!Array.isArray(nodes)) return [];

        return nodes.map((node, index) => {
            const processedNode = {
                ...node,
                _id: node[this.config.idKey] || `node-${level}-${index}-${Date.now()}`,
                _label: node[this.config.labelKey] || 'Untitled',
                _children: node[this.config.childrenKey] || [],
                _hasChildren: node[this.config.hasChildrenKey] || 
                             (node[this.config.childrenKey] && node[this.config.childrenKey].length > 0),
                _expanded: node[this.config.expandedKey] || this.state.expandedIds.has(node[this.config.idKey]),
                _selected: node[this.config.selectedKey] || this.state.selectedIds.has(node[this.config.idKey]),
                _checked: node[this.config.checkedKey] || this.state.checkedIds.has(node[this.config.idKey]),
                _icon: node[this.config.iconKey] || null,
                _disabled: node[this.config.disabledKey] || false,
                _level: level,
                _parentId: parentId,
                _index: index,
                _path: parentId ? `${parentId}/${node[this.config.idKey] || index}` : `${node[this.config.idKey] || index}`
            };

            if (processedNode._expanded) {
                this.state.expandedIds.add(processedNode._id);
            }
            if (processedNode._selected) {
                this.state.selectedIds.add(processedNode._id);
            }
            if (processedNode._checked) {
                this.state.checkedIds.add(processedNode._id);
            }
            if (processedNode._disabled) {
                this.state.disabledIds.add(processedNode._id);
            }

            if (processedNode._children && processedNode._children.length > 0) {
                processedNode._children = this.processNodes(
                    processedNode._children, 
                    processedNode._id, 
                    level + 1
                );
            }

            return processedNode;
        });
    }

    flattenNodes(nodes, result = []) {
        nodes.forEach(node => {
            result.push(node);
            if (node._expanded && node._children && node._children.length > 0) {
                this.flattenNodes(node._children, result);
            }
        });
        return result;
    }

    render() {
        try {
            const renderStart = performance.now();
            const themeClass = `tv-theme-${this.config.theme}`;
            const sizeClass = `tv-size-${this.config.size}`;
            const linesClass = this.config.showLines ? 'tv-show-lines' : '';
            const connectorsClass = this.config.showConnectors ? 'tv-show-connectors' : '';

            this.state.flattenedNodes = this.state.isSearching ? 
                this.state.searchResults : 
                this.flattenNodes(this.state.nodes);
            
            this.performance.nodeCount = this.state.nodes.length;

            const html = `
                <div class="tv-wrapper ${themeClass} ${sizeClass} ${linesClass} ${connectorsClass}" 
                     id="${this.componentId}" role="tree" aria-label="Tree view">
                    
                    ${this.config.searchable ? `
                        <div class="tv-search">
                            <i class="fas fa-search"></i>
                            <input type="text" 
                                   class="tv-search-input" 
                                   id="${this.componentId}-search"
                                   placeholder="${this.config.searchPlaceholder}"
                                   autocomplete="off"
                                   aria-label="Search tree">
                            ${this.state.isSearching ? `
                                <button class="tv-search-clear" id="${this.componentId}-search-clear" aria-label="Clear search">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}

                    ${this.state.isLoading ? `
                        <div class="tv-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading...
                        </div>
                    ` : `
                        <div class="tv-list" 
                             id="${this.componentId}-list"
                             style="${this.config.maxHeight > 0 ? `max-height:${this.config.maxHeight}px;overflow-y:auto;` : ''}">
                            ${this.state.flattenedNodes.length > 0 ? 
                                this.renderNodes(this.state.nodes) : 
                                this.renderEmptyState()
                            }
                        </div>
                    `}
                </div>
            `;

            this.container.innerHTML = html;
            this.cacheElements();
            
            this.performance.renderTime = performance.now() - renderStart;
            console.log(`[TreeView] Rendered in ${this.performance.renderTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('[TreeView] Render failed:', error);
        }
    }

    renderNodes(nodes) {
        return nodes.map(node => this.renderNode(node)).join('');
    }

    renderNode(node) {
        const hasChildren = node._children && node._children.length > 0;
        const isExpanded = this.state.expandedIds.has(node._id);
        const isSelected = this.state.selectedIds.has(node._id);
        const isChecked = this.state.checkedIds.has(node._id);
        const isDisabled = node._disabled || this.state.disabledIds.has(node._id);
        const level = node._level || 0;

        const stateClasses = [];
        if (isExpanded) stateClasses.push('tv-expanded');
        if (isSelected) stateClasses.push('tv-selected');
        if (isDisabled) stateClasses.push('tv-disabled');
        if (hasChildren) stateClasses.push('tv-has-children');
        if (!hasChildren) stateClasses.push('tv-leaf');

        return `
            <div class="tv-node ${stateClasses.join(' ')}" 
                 id="${this.componentId}-node-${node._id}"
                 data-node-id="${node._id}"
                 data-level="${level}"
                 role="treeitem"
                 aria-expanded="${hasChildren ? isExpanded : undefined}"
                 aria-selected="${isSelected}"
                 aria-disabled="${isDisabled}"
                 aria-level="${level + 1}"
                 ${this.config.draggable && !isDisabled ? 'draggable="true"' : ''}>
                
                <div class="tv-node-content" 
                     style="padding-left: ${level * 24 + 8}px;"
                     onclick="window.Global.TreeView.instances.get('${this.componentId}').handleNodeClick('${node._id}')"
                     ondblclick="window.Global.TreeView.instances.get('${this.componentId}').handleNodeDoubleClick('${node._id}')">
                    
                    <span class="tv-node-toggle">
                        ${hasChildren ? `
                            <button class="tv-toggle-btn" 
                                    onclick="event.stopPropagation(); window.Global.TreeView.instances.get('${this.componentId}').toggleNode('${node._id}')"
                                    aria-label="${isExpanded ? 'Collapse' : 'Expand'}">
                                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                            </button>
                        ` : `<span class="tv-toggle-spacer"></span>`}
                    </span>

                    ${this.config.showCheckboxes ? `
                        <span class="tv-node-checkbox">
                            <input type="checkbox" 
                                   ${isChecked ? 'checked' : ''} 
                                   ${isDisabled ? 'disabled' : ''}
                                   onclick="event.stopPropagation(); window.Global.TreeView.instances.get('${this.componentId}').toggleCheck('${node._id}', this.checked)"
                                   aria-label="Check ${node._label}">
                        </span>
                    ` : ''}

                    ${this.config.showIcons ? `
                        <span class="tv-node-icon">
                            <i class="fas ${node._icon || (hasChildren ? 'fa-folder' : 'fa-file')}"></i>
                        </span>
                    ` : ''}

                    <span class="tv-node-label">${this.escapeHtml(node._label)}</span>

                    ${node.badge ? `
                        <span class="tv-node-badge" style="background:${node.badgeColor || '#3B82F6'}15;color:${node.badgeColor || '#3B82F6'}">
                            ${node.badge}
                        </span>
                    ` : ''}

                    ${node.actions && node.actions.length > 0 ? `
                        <span class="tv-node-actions" onclick="event.stopPropagation();">
                            ${node.actions.map(action => `
                                <button class="tv-action-btn" 
                                        onclick="window.Global.TreeView.instances.get('${this.componentId}').handleNodeAction('${node._id}', '${action.id}')"
                                        title="${this.escapeHtml(action.label || '')}">
                                    <i class="fas ${action.icon || 'fa-ellipsis-v'}"></i>
                                </button>
                            `).join('')}
                        </span>
                    ` : ''}
                </div>

                ${hasChildren ? `
                    <div class="tv-node-children" 
                         style="display: ${isExpanded ? 'block' : 'none'};">
                        ${this.renderNodes(node._children)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="tv-empty">
                <i class="fas fa-sitemap"></i>
                <p>${this.state.isSearching ? 'No matching nodes found' : 'No items to display'}</p>
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.searchInput = document.getElementById(`${this.componentId}-search`);
        this.elements.treeList = document.getElementById(`${this.componentId}-list`);
    }

    bindEvents() {
        try {
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', (e) => {
                    clearTimeout(this.searchTimer);
                    this.searchTimer = setTimeout(() => {
                        this.searchNodes(e.target.value);
                    }, this.config.searchDebounce);
                });
            }

            const searchClear = document.getElementById(`${this.componentId}-search-clear`);
            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    this.clearSearch();
                });
            }

            if (this.elements.treeList && this.config.draggable) {
                this.elements.treeList.addEventListener('dragstart', (e) => {
                    const nodeEl = e.target.closest('.tv-node');
                    if (!nodeEl) return;
                    this.state.draggedNodeId = nodeEl.dataset.nodeId;
                    e.dataTransfer.effectAllowed = 'move';
                });

                this.elements.treeList.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const nodeEl = e.target.closest('.tv-node');
                    if (nodeEl && nodeEl.dataset.nodeId !== this.state.draggedNodeId) {
                        this.state.dropTargetId = nodeEl.dataset.nodeId;
                        nodeEl.classList.add('tv-drop-target');
                    }
                });

                this.elements.treeList.addEventListener('dragleave', (e) => {
                    const nodeEl = e.target.closest('.tv-node');
                    if (nodeEl) nodeEl.classList.remove('tv-drop-target');
                });

                this.elements.treeList.addEventListener('drop', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.tv-drop-target').forEach(el => el.classList.remove('tv-drop-target'));
                    
                    if (this.state.draggedNodeId && this.state.dropTargetId &&
                        this.state.draggedNodeId !== this.state.dropTargetId) {
                        this.handleDrop(this.state.draggedNodeId, this.state.dropTargetId);
                    }
                    
                    this.state.draggedNodeId = null;
                    this.state.dropTargetId = null;
                });
            }

            if (this.elements.treeList && this.config.maxHeight > 0 && this.config.virtualScroll) {
                this.elements.treeList.addEventListener('scroll', () => {
                    this.virtualState.scrollTop = this.elements.treeList.scrollTop;
                });
            }

            console.log('[TreeView] Events bound');
        } catch (error) {
            console.error('[TreeView] Event binding failed:', error);
        }
    }

    findNode(nodeId, nodes = null) {
        const searchNodes = nodes || this.state.nodes;
        
        for (const node of searchNodes) {
            if (node._id === nodeId) return node;
            if (node._children && node._children.length > 0) {
                const found = this.findNode(nodeId, node._children);
                if (found) return found;
            }
        }
        return null;
    }

    findParentNode(nodeId, nodes = null, parent = null) {
        const searchNodes = nodes || this.state.nodes;
        
        for (const node of searchNodes) {
            if (node._id === nodeId) return parent;
            if (node._children && node._children.length > 0) {
                const found = this.findParentNode(nodeId, node._children, node);
                if (found) return found;
            }
        }
        return null;
    }

    toggleNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node._disabled) return;

        if (this.state.expandedIds.has(nodeId)) {
            this.collapseNode(nodeId);
        } else {
            this.expandNode(nodeId);
        }
    }

    async expandNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node) return;

        // Collapse siblings if configured
        if (this.config.collapseSiblings) {
            const parent = this.findParentNode(nodeId);
            if (parent && parent._children) {
                parent._children.forEach(child => {
                    if (child._id !== nodeId) {
                        this.state.expandedIds.delete(child._id);
                    }
                });
            }
        }

        // Lazy load children if needed
        if (this.config.lazyLoad && !node._children && node._hasChildren) {
            await this.lazyLoadChildren(node);
        }

        this.state.expandedIds.add(nodeId);
        node._expanded = true;
        this.render();
        this.bindEvents();

        if (this.config.onExpand) this.config.onExpand(node);
        if (this.config.onToggle) this.config.onToggle(node, true);

        EventBus.emit('treeview:node-expanded', {
            componentId: this.componentId,
            nodeId,
            node
        });
    }

    collapseNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node) return;

        this.state.expandedIds.delete(nodeId);
        node._expanded = false;
        this.render();
        this.bindEvents();

        if (this.config.onCollapse) this.config.onCollapse(node);
        if (this.config.onToggle) this.config.onToggle(node, false);

        EventBus.emit('treeview:node-collapsed', {
            componentId: this.componentId,
            nodeId,
            node
        });
    }

    async lazyLoadChildren(node) {
        try {
            const url = `${this.config.lazyLoadUrl}?parentId=${node._id}`;
            const response = await fetch(url);
            const data = await response.json();
            const children = data.children || data.nodes || data;

            node._children = this.processNodes(children, node._id, (node._level || 0) + 1);
            node._hasChildren = node._children.length > 0;

            if (this.config.onLazyLoad) {
                this.config.onLazyLoad(node, node._children);
            }
        } catch (error) {
            console.error('[TreeView] Lazy load failed:', error);
            node._children = [];
        }
    }

    handleNodeClick(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node._disabled) return;

        // Select node
        if (!this.config.multiSelect) {
            this.state.selectedIds.clear();
        }

        if (this.state.selectedIds.has(nodeId)) {
            this.state.selectedIds.delete(nodeId);
            node._selected = false;
        } else {
            this.state.selectedIds.add(nodeId);
            node._selected = true;
        }

        // Check on select
        if (this.config.checkOnSelect) {
            this.toggleCheck(nodeId, !this.state.checkedIds.has(nodeId));
        }

        // Expand on click
        if (this.config.expandOnClick && node._hasChildren) {
            this.toggleNode(nodeId);
        }

        this.render();
        this.bindEvents();

        if (this.config.onSelect) this.config.onSelect(node, this.state.selectedIds);

        EventBus.emit('treeview:node-selected', {
            componentId: this.componentId,
            nodeId,
            node,
            selectedIds: Array.from(this.state.selectedIds)
        });
    }

    handleNodeDoubleClick(nodeId) {
        if (this.config.expandOnDoubleClick) {
            this.toggleNode(nodeId);
        }
    }

    toggleCheck(nodeId, checked) {
        const node = this.findNode(nodeId);
        if (!node || node._disabled) return;

        if (checked) {
            this.state.checkedIds.add(nodeId);
            node._checked = true;
        } else {
            this.state.checkedIds.delete(nodeId);
            node._checked = false;
        }

        // Cascade check
        if (this.config.cascadeCheck) {
            this.cascadeCheckToChildren(node, checked);
            this.cascadeCheckToParent(nodeId, checked);
        }

        this.render();
        this.bindEvents();

        if (this.config.onCheck) {
            this.config.onCheck(node, checked, Array.from(this.state.checkedIds));
        }

        EventBus.emit('treeview:node-checked', {
            componentId: this.componentId,
            nodeId,
            node,
            checked,
            checkedIds: Array.from(this.state.checkedIds)
        });
    }

    cascadeCheckToChildren(node, checked) {
        if (!node._children) return;
        
        node._children.forEach(child => {
            if (checked) {
                this.state.checkedIds.add(child._id);
                child._checked = true;
            } else {
                this.state.checkedIds.delete(child._id);
                child._checked = false;
            }
            this.cascadeCheckToChildren(child, checked);
        });
    }

    cascadeCheckToParent(nodeId, checked) {
        const parent = this.findParentNode(nodeId);
        if (!parent || !parent._children) return;

        if (checked) {
            const allChecked = parent._children.every(child => this.state.checkedIds.has(child._id));
            if (allChecked) {
                this.state.checkedIds.add(parent._id);
                parent._checked = true;
                this.cascadeCheckToParent(parent._id, true);
            }
        } else {
            this.state.checkedIds.delete(parent._id);
            parent._checked = false;
            this.cascadeCheckToParent(parent._id, false);
        }
    }

    handleNodeAction(nodeId, actionId) {
        const node = this.findNode(nodeId);
        if (!node) return;

        const action = node.actions?.find(a => a.id === actionId);
        if (action && action.callback) {
            action.callback(node);
        }

        EventBus.emit('treeview:action-clicked', {
            componentId: this.componentId,
            nodeId,
            node,
            actionId
        });
    }

    handleDrop(draggedId, targetId) {
        const draggedNode = this.findNode(draggedId);
        const targetNode = this.findNode(targetId);
        
        if (!draggedNode || !targetNode) return;

        // Remove from old position
        this.removeNodeFromParent(draggedId);

        // Add to new parent
        if (!targetNode._children) targetNode._children = [];
        targetNode._children.push(draggedNode);
        draggedNode._parentId = targetId;
        draggedNode._level = (targetNode._level || 0) + 1;

        // Expand target
        this.state.expandedIds.add(targetId);
        targetNode._expanded = true;

        this.render();
        this.bindEvents();

        if (this.config.onDrop) {
            this.config.onDrop(draggedNode, targetNode);
        }

        EventBus.emit('treeview:node-dropped', {
            componentId: this.componentId,
            draggedNode,
            targetNode
        });
    }

    removeNodeFromParent(nodeId) {
        const parent = this.findParentNode(nodeId);
        if (parent && parent._children) {
            parent._children = parent._children.filter(child => child._id !== nodeId);
            if (parent._children.length === 0) {
                parent._hasChildren = false;
            }
        }
    }

    searchNodes(query) {
        if (!query || query.length < this.config.searchMinChars) {
            this.state.isSearching = false;
            this.state.searchQuery = '';
            this.state.searchResults = [];
            this.render();
            this.bindEvents();
            return;
        }

        this.state.isSearching = true;
        this.state.searchQuery = query;
        this.state.searchResults = [];

        const lowerQuery = query.toLowerCase();
        this.searchInNodes(this.state.nodes, lowerQuery);

        // Expand all parents of search results
        this.state.searchResults.forEach(node => {
            let parent = this.findParentNode(node._id);
            while (parent) {
                this.state.expandedIds.add(parent._id);
                parent._expanded = true;
                parent = this.findParentNode(parent._id);
            }
        });

        this.render();
        this.bindEvents();

        if (this.config.onSearch) {
            this.config.onSearch(query, this.state.searchResults);
        }
    }

    searchInNodes(nodes, query) {
        nodes.forEach(node => {
            const labelMatch = node._label.toLowerCase().includes(query);
            if (labelMatch) {
                this.state.searchResults.push(node);
            }
            if (node._children && node._children.length > 0) {
                this.searchInNodes(node._children, query);
            }
        });
    }

    clearSearch() {
        this.state.isSearching = false;
        this.state.searchQuery = '';
        this.state.searchResults = [];
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        this.render();
        this.bindEvents();
    }

    getCheckedNodes() {
        const checkedNodes = [];
        const findChecked = (nodes) => {
            nodes.forEach(node => {
                if (this.state.checkedIds.has(node._id)) {
                    checkedNodes.push(node);
                }
                if (node._children) findChecked(node._children);
            });
        };
        findChecked(this.state.nodes);
        return checkedNodes;
    }

    getSelectedNodes() {
        const selectedNodes = [];
        const findSelected = (nodes) => {
            nodes.forEach(node => {
                if (this.state.selectedIds.has(node._id)) {
                    selectedNodes.push(node);
                }
                if (node._children) findSelected(node._children);
            });
        };
        findSelected(this.state.nodes);
        return selectedNodes;
    }

    addNode(parentId, newNode) {
        const parent = parentId ? this.findNode(parentId) : null;
        const processedNode = this.processNodes([newNode], parentId, (parent?._level || 0) + 1)[0];

        if (parent) {
            if (!parent._children) parent._children = [];
            parent._children.push(processedNode);
            parent._hasChildren = true;
        } else {
            this.state.nodes.push(processedNode);
        }

        if (parentId) {
            this.state.expandedIds.add(parentId);
        }

        this.render();
        this.bindEvents();
    }

    updateNode(nodeId, updates) {
        const node = this.findNode(nodeId);
        if (node) {
            Object.assign(node, updates);
            if (updates[this.config.labelKey]) {
                node._label = updates[this.config.labelKey];
            }
            this.render();
            this.bindEvents();
        }
    }

    removeNode(nodeId) {
        this.removeNodeFromParent(nodeId);
        this.state.expandedIds.delete(nodeId);
        this.state.selectedIds.delete(nodeId);
        this.state.checkedIds.delete(nodeId);
        this.render();
        this.bindEvents();
    }

    expandAll() {
        const expandRecursive = (nodes) => {
            nodes.forEach(node => {
                if (node._hasChildren || (node._children && node._children.length > 0)) {
                    this.state.expandedIds.add(node._id);
                    node._expanded = true;
                    if (node._children) expandRecursive(node._children);
                }
            });
        };
        expandRecursive(this.state.nodes);
        this.render();
        this.bindEvents();
    }

    collapseAll() {
        this.state.expandedIds.clear();
        this.state.nodes.forEach(node => { node._expanded = false; });
        this.render();
        this.bindEvents();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        if (this.container) this.container.innerHTML = '';
        console.log('[TreeView] Component destroyed');
    }

    static create(container, options) {
        const instance = new TreeView(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.TreeView) window.Global.TreeView = {};
        if (!window.Global.TreeView.instances) window.Global.TreeView.instances = new Map();
        window.Global.TreeView.instances.set(instance.componentId, instance);
        return instance;
    }

    static getInstance(componentId) {
        return window.Global?.TreeView?.instances?.get(componentId) || null;
    }
}

export { TreeView };
export default TreeView;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.TreeView = window.Global.TreeView || {};
    window.Global.TreeView.instances = window.Global.TreeView.instances || new Map();
    window.Global.TreeView.TreeView = TreeView;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
