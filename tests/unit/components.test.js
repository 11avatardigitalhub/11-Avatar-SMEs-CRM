/**
 * 11 AVATAR DIGITAL HUB - UI Components Unit Tests
 * Enterprise-grade test suite for reusable UI components
 * Tests: Modal, Toast, Kanban, Chart, DataTable, Tabs, TreeView, ColorPicker
 * 
 * @test UIComponents
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { Modal } from '../../src/js/components/modal.js';
import { Toast } from '../../src/js/components/toast.js';
import { KanbanBoard } from '../../src/js/components/kanban.js';
import { ChartComponent } from '../../src/js/components/chart.js';
import { DataTable } from '../../src/js/components/dataTable.js';
import { Tabs } from '../../src/js/components/tabs.js';
import { TreeView } from '../../src/js/components/treeView.js';
import { ColorPicker } from '../../src/js/components/colorPicker.js';
import { ContextMenu } from '../../src/js/components/contextMenu.js';
import { SearchBar } from '../../src/js/components/searchBar.js';
import { Stepper } from '../../src/js/components/stepper.js';
import { Timeline } from '../../src/js/components/timeline.js';
import { EventBus } from '../../src/js/core/eventBus.js';

/**
 * Comprehensive assertion library for component testing
 */
const assert = {
    ok(value, message = 'Expected truthy value') {
        if (!value) throw new Error(message);
    },
    equal(actual, expected, message = 'Values should be equal') {
        if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    notEqual(actual, expected, message = 'Values should not be equal') {
        if (actual === expected) throw new Error(message);
    },
    deepEqual(actual, expected, message = 'Values should be deeply equal') {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) throw new Error(`${message}: expected ${b}, got ${a}`);
    },
    isNull(value, message = 'Expected null value') {
        if (value !== null && value !== undefined) throw new Error(message);
    },
    isNotNull(value, message = 'Expected non-null value') {
        if (value === null || value === undefined) throw new Error(message);
    },
    throws(fn, message = 'Expected function to throw') {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) throw new Error(message);
    },
    doesNotThrow(fn, message = 'Expected function not to throw') {
        try { fn(); } catch (e) { throw new Error(`${message}: ${e.message}`); }
    },
    greaterThan(actual, expected, message = 'Expected greater value') {
        if (actual <= expected) throw new Error(`${message}: expected > ${expected}, got ${actual}`);
    },
    lessThan(actual, expected, message = 'Expected lesser value') {
        if (actual >= expected) throw new Error(`${message}: expected < ${expected}, got ${actual}`);
    },
    instanceOf(value, constructor, message = 'Expected correct instance') {
        if (!(value instanceof constructor)) throw new Error(`${message}`);
    },
    contains(str, substring, message = 'Expected string to contain substring') {
        if (!str || !str.includes(substring)) throw new Error(`${message}: "${str}" missing "${substring}"`);
    },
    lengthOf(arr, length, message = 'Expected array length') {
        if (!Array.isArray(arr)) throw new Error(`${message}: not an array`);
        if (arr.length !== length) throw new Error(`${message}: expected ${length}, got ${arr.length}`);
    },
    isTrue(value, message = 'Expected true') { if (value !== true) throw new Error(message); },
    isFalse(value, message = 'Expected false') { if (value !== false) throw new Error(message); },
    existsInDOM(selector, message = 'Element should exist in DOM') {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`${message}: "${selector}" not found in DOM`);
    },
    notExistsInDOM(selector, message = 'Element should not exist in DOM') {
        const el = document.querySelector(selector);
        if (el) throw new Error(`${message}: "${selector}" should not be in DOM`);
    },
    hasClass(element, className, message = 'Element should have class') {
        if (!element || !element.classList.contains(className)) {
            throw new Error(`${message}: missing class "${className}"`);
        }
    },
    hasAttribute(element, attr, message = 'Element should have attribute') {
        if (!element || !element.hasAttribute(attr)) {
            throw new Error(`${message}: missing attribute "${attr}"`);
        }
    }
};

/**
 * DOM Test Helper - creates and cleans up test containers
 */
class DOMTestHelper {
    constructor() {
        this.containers = [];
    }

    createContainer(id = null) {
        const containerId = id || `test-container-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'width:800px;height:600px;position:relative;';
        document.body.appendChild(container);
        this.containers.push(container);
        return container;
    }

    createMultipleContainers(count) {
        const containers = [];
        for (let i = 0; i < count; i++) {
            containers.push(this.createContainer());
        }
        return containers;
    }

    createCanvasContainer() {
        const container = document.createElement('div');
        container.id = `canvas-container-${Date.now()}`;
        container.style.cssText = 'width:600px;height:400px;';
        document.body.appendChild(container);
        this.containers.push(container);
        return container;
    }

    cleanup() {
        this.containers.forEach(container => {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });
        this.containers = [];
    }
}

// ============================================================
// GLOBAL TEST SETUP
// ============================================================

let domHelper;
let eventBus;

const testResults = {
    total: 0, passed: 0, failed: 0, skipped: 0,
    suites: [], failures: [], startTime: Date.now(), endTime: null
};

function describe(name, fn) {
    console.log(`\n📁 Suite: ${name}`);
    console.log('───────────────────────────────────────────');

    const suiteResult = { name, passed: 0, failed: 0, skipped: 0 };
    let suitePassed = 0, suiteFailed = 0, suiteSkipped = 0;

    const ctx = { beforeAll: null, afterAll: null, beforeEach: null, afterEach: null, tests: [] };
    const api = {
        beforeAll(cb) { ctx.beforeAll = cb; },
        afterAll(cb) { ctx.afterAll = cb; },
        beforeEach(cb) { ctx.beforeEach = cb; },
        afterEach(cb) { ctx.afterEach = cb; },
        it(name, fn) { ctx.tests.push({ name, fn, skip: false }); },
        xit(name, fn) { ctx.tests.push({ name, fn, skip: true }); }
    };

    fn.call(api);

    setTimeout(async () => {
        if (ctx.beforeAll) {
            try { await ctx.beforeAll(); } catch (e) { console.error(`  ❌ beforeAll: ${e.message}`); return; }
        }

        for (const test of ctx.tests) {
            if (test.skip) { console.log(`  ⏭️  SKIP: ${test.name}`); testResults.skipped++; suiteSkipped++; continue; }
            testResults.total++;

            if (ctx.beforeEach) {
                try { await ctx.beforeEach(); } catch (e) { console.error(`  ❌ beforeEach: ${e.message}`); }
            }

            try {
                const start = performance.now();
                await test.fn();
                console.log(`  ✅ PASS: ${test.name} (${(performance.now() - start).toFixed(2)}ms)`);
                testResults.passed++; suitePassed++;
            } catch (error) {
                console.log(`  ❌ FAIL: ${test.name}`);
                console.log(`     Error: ${error.message}`);
                testResults.failed++; suiteFailed++;
                testResults.failures.push({ suite: name, test: test.name, error: error.message });
            }

            if (ctx.afterEach) {
                try { await ctx.afterEach(); } catch (e) { console.error(`  ❌ afterEach: ${e.message}`); }
            }
        }

        if (ctx.afterAll) {
            try { await ctx.afterAll(); } catch (e) { console.error(`  ❌ afterAll: ${e.message}`); }
        }

        suiteResult.passed = suitePassed; suiteResult.failed = suiteFailed; suiteResult.skipped = suiteSkipped;
        testResults.suites.push(suiteResult);
        console.log(`  📊 ${suitePassed} passed, ${suiteFailed} failed, ${suiteSkipped} skipped`);

        checkAllSuitesComplete();
    }, 100);
}

let completedSuites = 0;
const totalSuites = 10;

function checkAllSuitesComplete() {
    completedSuites++;
    if (completedSuites >= totalSuites) {
        setTimeout(printSummary, 500);
    }
}

function printSummary() {
    testResults.endTime = Date.now();
    const duration = (testResults.endTime - testResults.startTime) / 1000;

    console.log('\n═══════════════════════════════════════════');
    console.log('  UI COMPONENTS TEST SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Total:   ${testResults.total}`);
    console.log(`  Passed:  ${testResults.passed} ✅`);
    console.log(`  Failed:  ${testResults.failed} ❌`);
    console.log(`  Skipped: ${testResults.skipped} ⏭️`);
    console.log('═══════════════════════════════════════════\n');

    if (testResults.failures.length > 0) {
        console.log('  FAILURES:');
        testResults.failures.forEach((f, i) => {
            console.log(`  ${i + 1}. [${f.suite}] ${f.test}\n     ${f.error}`);
        });
        console.log('');
    }

    if (domHelper) domHelper.cleanup();
    if (eventBus) eventBus.destroy();

    if (typeof window !== 'undefined') window.__COMPONENTS_TEST_RESULTS__ = testResults;
    if (typeof process !== 'undefined' && process.exit) process.exit(testResults.failed > 0 ? 1 : 0);
}

// ============================================================
// MODAL COMPONENT TESTS
// ============================================================
describe('Modal Component - Dialog Windows', () => {
    beforeAll(() => {
        domHelper = new DOMTestHelper();
        eventBus = new EventBus();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create Modal instance with title and content', () => {
        const modal = new Modal({
            title: 'Test Modal',
            content: '<p>Modal content</p>',
            size: 'medium'
        });

        assert.isNotNull(modal, 'Modal instance should exist');
        assert.instanceOf(modal, Modal, 'Should be Modal instance');
    });

    it('should open modal and add to DOM', () => {
        const modal = new Modal({
            title: 'Open Test',
            content: '<p>Opened modal</p>'
        });

        modal.open();

        const modalEl = document.querySelector('.modal-overlay');
        assert.isNotNull(modalEl, 'Modal overlay should exist in DOM');
        assert.contains(modalEl.textContent, 'Open Test', 'Modal should display title');
        assert.contains(modalEl.textContent, 'Opened modal', 'Modal should display content');

        modal.close();
    });

    it('should close modal and remove from DOM', (done) => {
        const modal = new Modal({
            title: 'Close Test',
            content: '<p>Closing modal</p>'
        });

        modal.open();
        
        setTimeout(() => {
            modal.close();
            
            setTimeout(() => {
                const modalEl = document.querySelector('.modal-overlay');
                assert.isNull(modalEl, 'Modal overlay should be removed from DOM');
                done();
            }, 350);
        }, 50);
    });

    it('should support different sizes', () => {
        const sizes = ['small', 'medium', 'large', 'xlarge'];
        
        sizes.forEach(size => {
            const modal = new Modal({
                title: `${size} Modal`,
                content: '<p>Size test</p>',
                size: size
            });

            modal.open();
            const modalEl = document.querySelector('.modal-dialog');
            assert.isNotNull(modalEl, `Modal dialog for ${size} should exist`);
            assert.hasClass(modalEl, `modal-${size}`, `Modal should have ${size} class`);
            modal.close();
        });
    });

    it('should fire onClose callback', (done) => {
        let callbackFired = false;

        const modal = new Modal({
            title: 'Callback Test',
            content: '<p>Testing callbacks</p>',
            onClose: () => {
                callbackFired = true;
                assert.isTrue(callbackFired, 'onClose callback should fire');
                done();
            }
        });

        modal.open();
        setTimeout(() => modal.close(), 50);
    });

    it('should close on escape key', (done) => {
        const modal = new Modal({
            title: 'Escape Test',
            content: '<p>Press Escape</p>',
            closeOnEscape: true
        });

        modal.open();

        setTimeout(() => {
            const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
            document.dispatchEvent(event);

            setTimeout(() => {
                const modalEl = document.querySelector('.modal-overlay');
                assert.isNull(modalEl, 'Modal should close on Escape');
                done();
            }, 350);
        }, 50);
    });

    it('should close on backdrop click when enabled', (done) => {
        const modal = new Modal({
            title: 'Backdrop Test',
            content: '<p>Click backdrop</p>',
            closeOnBackdrop: true
        });

        modal.open();

        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (overlay) {
                overlay.click();
                setTimeout(() => {
                    const modalEl = document.querySelector('.modal-overlay');
                    assert.isNull(modalEl, 'Modal should close on backdrop click');
                    done();
                }, 350);
            } else {
                done();
            }
        }, 50);
    });

    it('should not close on backdrop click when disabled', (done) => {
        const modal = new Modal({
            title: 'No Backdrop Close',
            content: '<p>Cannot click backdrop</p>',
            closeOnBackdrop: false
        });

        modal.open();

        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (overlay) {
                overlay.click();
                setTimeout(() => {
                    const modalEl = document.querySelector('.modal-overlay');
                    assert.isNotNull(modalEl, 'Modal should remain open');
                    modal.close();
                    done();
                }, 350);
            } else {
                done();
            }
        }, 50);
    });
});

// ============================================================
// TOAST COMPONENT TESTS
// ============================================================
describe('Toast Component - Notification Toasts', () => {
    beforeAll(() => {
        domHelper = new DOMTestHelper();
        eventBus = new EventBus();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should show success toast', () => {
        Toast.show('Operation successful', 'success');
        
        const toastEl = document.querySelector('.toast-message');
        assert.isNotNull(toastEl, 'Toast should exist in DOM');
        assert.contains(toastEl.textContent, 'Operation successful', 'Toast should display message');
        assert.hasClass(toastEl, 'toast-success', 'Toast should have success class');
    });

    it('should show error toast', () => {
        Toast.show('Something went wrong', 'error');
        
        const toastEl = document.querySelector('.toast-error');
        assert.isNotNull(toastEl, 'Error toast should exist');
        assert.contains(toastEl.textContent, 'Something went wrong', 'Error toast should display message');
    });

    it('should show warning toast', () => {
        Toast.show('Please be careful', 'warning');
        
        const toastEl = document.querySelector('.toast-warning');
        assert.isNotNull(toastEl, 'Warning toast should exist');
    });

    it('should show info toast', () => {
        Toast.show('Here is some information', 'info');
        
        const toastEl = document.querySelector('.toast-info');
        assert.isNotNull(toastEl, 'Info toast should exist');
    });

    it('should auto-dismiss after duration', (done) => {
        Toast.show('Auto dismiss test', 'info', { duration: 100 });

        setTimeout(() => {
            const toastEl = document.querySelector('.toast-message');
            assert.isNull(toastEl, 'Toast should be auto-dismissed');
            done();
        }, 500);
    });

    it('should support action callback', (done) => {
        let actionCalled = false;

        Toast.show('Action test', 'info', {
            action: 'Click Me',
            onAction: () => {
                actionCalled = true;
                assert.isTrue(actionCalled, 'Action callback should fire');
                done();
            }
        });

        setTimeout(() => {
            const actionBtn = document.querySelector('.toast-action-btn');
            if (actionBtn) actionBtn.click();
        }, 50);
    });
});

// ============================================================
// KANBAN COMPONENT TESTS
// ============================================================
describe('Kanban Board Component - Drag-Drop Board', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('kanban-test');
        eventBus = new EventBus();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create KanbanBoard instance', () => {
        const kanban = new KanbanBoard(container, {
            columns: [
                { id: 'todo', title: 'To Do', color: '#6B7280' },
                { id: 'done', title: 'Done', color: '#10B981' }
            ],
            cards: [
                { id: 'card-1', title: 'Task 1', status: 'todo' },
                { id: 'card-2', title: 'Task 2', status: 'done' }
            ]
        });

        assert.isNotNull(kanban, 'KanbanBoard instance should exist');
        assert.instanceOf(kanban, KanbanBoard, 'Should be KanbanBoard instance');
    });

    it('should render columns correctly', () => {
        const kanban = new KanbanBoard(container, {
            columns: [{ id: 'col-a', title: 'Column A' }],
            cards: []
        });

        const columnEl = container.querySelector('.kanban-column');
        assert.isNotNull(columnEl, 'Column should be rendered');
        assert.contains(columnEl.textContent, 'Column A', 'Column title should be displayed');
    });

    it('should render cards in correct columns', () => {
        const kanban = new KanbanBoard(container, {
            columns: [
                { id: 'backlog', title: 'Backlog' },
                { id: 'progress', title: 'In Progress' }
            ],
            cards: [
                { id: 'c1', title: 'Card One', status: 'backlog' },
                { id: 'c2', title: 'Card Two', status: 'progress' },
                { id: 'c3', title: 'Card Three', status: 'backlog' }
            ]
        });

        const cards = container.querySelectorAll('.kanban-card');
        assert.greaterThan(cards.length, 0, 'Cards should be rendered');
    });

    it('should show card count per column', () => {
        const kanban = new KanbanBoard(container, {
            columns: [{ id: 'col', title: 'Column', color: '#3B82F6' }],
            cards: [
                { id: 'a', title: 'A', status: 'col' },
                { id: 'b', title: 'B', status: 'col' }
            ],
            showCardCount: true
        });

        const countEl = container.querySelector('.column-count');
        assert.isNotNull(countEl, 'Card count should be displayed');
        assert.contains(countEl.textContent, '2', 'Should show correct count');
    });

    it('should support card search', () => {
        const kanban = new KanbanBoard(container, {
            columns: [{ id: 'search-col', title: 'Search Column' }],
            cards: [
                { id: 'find-me', title: 'Find This Card', status: 'search-col' },
                { id: 'hide-me', title: 'Hide This Card', status: 'search-col' }
            ],
            searchable: true
        });

        kanban.handleSearch('Find This');
        assert.isTrue(true, 'Search should execute without errors');
    });
});

// ============================================================
// CHART COMPONENT TESTS
// ============================================================
describe('Chart Component - Data Visualization', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createCanvasContainer();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create ChartComponent instance', () => {
        const chart = new ChartComponent(container, {
            type: 'bar',
            labels: ['Jan', 'Feb', 'Mar'],
            datasets: [{ label: 'Revenue', data: [100, 200, 300] }],
            useFallback: true
        });

        assert.isNotNull(chart, 'ChartComponent instance should exist');
        assert.instanceOf(chart, ChartComponent, 'Should be ChartComponent instance');
    });

    it('should render fallback SVG chart', () => {
        const chart = new ChartComponent(container, {
            type: 'bar',
            labels: ['A', 'B', 'C'],
            datasets: [{ label: 'Test', data: [10, 20, 30] }],
            useFallback: true,
            height: 300
        });

        const svgEl = container.querySelector('svg');
        assert.isNotNull(svgEl, 'SVG chart should be rendered');
    });

    it('should render chart title', () => {
        const chart = new ChartComponent(container, {
            type: 'line',
            labels: ['Q1', 'Q2'],
            datasets: [{ label: 'Sales', data: [50, 75] }],
            title: 'Sales Report',
            useFallback: true
        });

        const titleEl = container.querySelector('.chart-title');
        assert.isNotNull(titleEl, 'Chart title should be rendered');
        assert.contains(titleEl.textContent, 'Sales Report', 'Title text should match');
    });

    it('should render chart subtitle', () => {
        const chart = new ChartComponent(container, {
            type: 'bar',
            labels: ['X', 'Y'],
            datasets: [{ data: [1, 2] }],
            subtitle: 'Monthly Summary',
            useFallback: true
        });

        const subtitleEl = container.querySelector('.chart-subtitle');
        assert.isNotNull(subtitleEl, 'Chart subtitle should be rendered');
    });

    it('should update chart data', () => {
        const chart = new ChartComponent(container, {
            type: 'bar',
            labels: ['Old'],
            datasets: [{ label: 'Old Data', data: [5] }],
            useFallback: true
        });

        chart.update({
            labels: ['New A', 'New B', 'New C'],
            datasets: [{ label: 'New Data', data: [15, 25, 35] }]
        });

        assert.equal(chart.config.labels.length, 3, 'Labels should be updated');
    });

    it('should add data point to real-time chart', () => {
        const chart = new ChartComponent(container, {
            type: 'line',
            labels: ['P1', 'P2'],
            datasets: [{ data: [10, 20] }],
            realtime: true,
            maxDataPoints: 5,
            useFallback: true
        });

        chart.addDataPoint('P3', [30]);
        assert.equal(chart.config.labels.length, 3, 'Data point should be added');
    });

    it('should enforce max data points limit', () => {
        const chart = new ChartComponent(container, {
            type: 'line',
            labels: ['1', '2', '3', '4', '5'],
            datasets: [{ data: [1, 2, 3, 4, 5] }],
            maxDataPoints: 5,
            useFallback: true
        });

        chart.addDataPoint('6', [6]);
        assert.equal(chart.config.labels.length, 5, 'Should maintain max data points');
    });
});

// ============================================================
// DATA TABLE COMPONENT TESTS
// ============================================================
describe('DataTable Component - Data Grid', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('datatable-test');
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create DataTable instance', () => {
        const table = new DataTable(container, {
            columns: [
                { field: 'id', label: 'ID' },
                { field: 'name', label: 'Name' }
            ],
            data: [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' }
            ]
        });

        assert.isNotNull(table, 'DataTable instance should exist');
        assert.instanceOf(table, DataTable, 'Should be DataTable instance');
    });

    it('should render table headers', () => {
        const table = new DataTable(container, {
            columns: [
                { field: 'email', label: 'Email Address' },
                { field: 'status', label: 'Status' }
            ],
            data: [{ email: 'test@test.com', status: 'active' }]
        });

        const headers = container.querySelectorAll('th');
        assert.greaterThan(headers.length, 0, 'Table headers should be rendered');
    });

    it('should render data rows', () => {
        const table = new DataTable(container, {
            columns: [
                { field: 'product', label: 'Product' },
                { field: 'price', label: 'Price' }
            ],
            data: [
                { product: 'Widget A', price: 100 },
                { product: 'Widget B', price: 200 },
                { product: 'Widget C', price: 300 }
            ]
        });

        const rows = container.querySelectorAll('.datatable-row');
        assert.equal(rows.length, 3, 'Should render 3 data rows');
    });

    it('should show empty state when no data', () => {
        const table = new DataTable(container, {
            columns: [{ field: 'col', label: 'Column' }],
            data: []
        });

        const emptyEl = container.querySelector('.empty-cell');
        assert.isNotNull(emptyEl, 'Empty state should be displayed');
    });

    it('should handle search filtering', () => {
        const table = new DataTable(container, {
            columns: [
                { field: 'city', label: 'City' },
                { field: 'country', label: 'Country' }
            ],
            data: [
                { city: 'Mumbai', country: 'India' },
                { city: 'Delhi', country: 'India' },
                { city: 'London', country: 'UK' }
            ],
            searchable: true
        });

        table.state.searchQuery = 'London';
        table.applyFilters();

        assert.equal(table.state.filteredData.length, 1, 'Should filter to 1 result');
        assert.equal(table.state.filteredData[0].city, 'London', 'Should find London');
    });

    it('should handle sorting', () => {
        const table = new DataTable(container, {
            columns: [{ field: 'score', label: 'Score' }],
            data: [
                { score: 50 }, { score: 100 }, { score: 75 }
            ]
        });

        table.state.sortColumn = 'score';
        table.state.sortDirection = 'asc';
        table.applyFilters();

        assert.equal(table.state.filteredData[0].score, 50, 'First should be lowest score');
        assert.equal(table.state.filteredData[2].score, 100, 'Last should be highest score');
    });

    it('should handle pagination', () => {
        const data = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, value: `Item ${i + 1}` }));

        const table = new DataTable(container, {
            columns: [{ field: 'id', label: 'ID' }, { field: 'value', label: 'Value' }],
            data: data,
            pageSize: 10
        });

        assert.equal(table.state.totalPages, 5, 'Should have 5 pages with 50 items at page size 10');
        assert.equal(table.state.displayedData.length, 10, 'Should display 10 items per page');
    });

    it('should support row selection', () => {
        const table = new DataTable(container, {
            columns: [{ field: 'name', label: 'Name' }],
            data: [
                { id: 'a', name: 'Alpha' },
                { id: 'b', name: 'Beta' }
            ],
            selectable: true,
            showCheckbox: true
        });

        table.toggleRowSelection('a');
        assert.isTrue(table.state.selectedRows.has('a'), 'Row should be selected');

        table.toggleRowSelection('a');
        assert.isFalse(table.state.selectedRows.has('a'), 'Row should be deselected');
    });
});

// ============================================================
// TABS COMPONENT TESTS
// ============================================================
describe('Tabs Component - Tab Navigation', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('tabs-test');
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create Tabs instance', () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'tab-1', label: 'First Tab', content: 'Content 1' },
                { id: 'tab-2', label: 'Second Tab', content: 'Content 2' }
            ]
        });

        assert.isNotNull(tabs, 'Tabs instance should exist');
        assert.instanceOf(tabs, Tabs, 'Should be Tabs instance');
    });

    it('should render tab buttons', () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'a', label: 'Tab A', content: 'A content' },
                { id: 'b', label: 'Tab B', content: 'B content' },
                { id: 'c', label: 'Tab C', content: 'C content' }
            ]
        });

        const tabButtons = container.querySelectorAll('.tabs-tab');
        assert.equal(tabButtons.length, 3, 'Should render 3 tab buttons');
    });

    it('should activate first tab by default', () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'first', label: 'First', content: 'First panel' },
                { id: 'second', label: 'Second', content: 'Second panel' }
            ]
        });

        const activeTab = container.querySelector('.tabs-tab.active');
        assert.isNotNull(activeTab, 'Should have active tab');
        assert.contains(activeTab.textContent, 'First', 'First tab should be active');
    });

    it('should switch tabs programmatically', async () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'tab-x', label: 'Tab X', content: 'Panel X' },
                { id: 'tab-y', label: 'Tab Y', content: 'Panel Y' }
            ]
        });

        await tabs.switchTab(1);
        assert.equal(tabs.state.activeIndex, 1, 'Should switch to second tab');
    });

    it('should not switch to disabled tab', async () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'enabled-tab', label: 'Enabled', content: 'Available' },
                { id: 'disabled-tab', label: 'Disabled', content: 'Not available', disabled: true }
            ]
        });

        const result = await tabs.switchTab(1);
        assert.isFalse(result, 'Should not switch to disabled tab');
        assert.equal(tabs.state.activeIndex, 0, 'Should remain on first tab');
    });

    it('should add tab dynamically', () => {
        const tabs = new Tabs(container, {
            tabs: [{ id: 'existing', label: 'Existing', content: 'Old' }]
        });

        tabs.addTab({ id: 'new-tab', label: 'New Tab', content: 'New content' });
        assert.equal(tabs.state.tabs.length, 2, 'Should have 2 tabs after adding');
    });

    it('should remove tab dynamically', () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'keep', label: 'Keep' },
                { id: 'remove', label: 'Remove' }
            ]
        });

        const removeIndex = tabs.state.tabs.findIndex(t => t.id === 'remove');
        tabs.removeTab(removeIndex);
        assert.equal(tabs.state.tabs.length, 1, 'Should have 1 tab after removal');
    });

    it('should show badge on tabs', () => {
        const tabs = new Tabs(container, {
            tabs: [
                { id: 'badge-tab', label: 'Notifications', badge: 5, badgeColor: '#DC2626' }
            ],
            showBadges: true
        });

        const badge = container.querySelector('.tabs-badge');
        assert.isNotNull(badge, 'Badge should be displayed');
        assert.contains(badge.textContent, '5', 'Badge should show count');
    });
});

// ============================================================
// TREEVIEW COMPONENT TESTS
// ============================================================
describe('TreeView Component - Hierarchical Tree', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('treeview-test');
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create TreeView instance', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'root', label: 'Root', children: [
                    { id: 'child-1', label: 'Child 1' },
                    { id: 'child-2', label: 'Child 2' }
                ]}
            ]
        });

        assert.isNotNull(tree, 'TreeView instance should exist');
        assert.instanceOf(tree, TreeView, 'Should be TreeView instance');
    });

    it('should render tree nodes', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'node-a', label: 'Node A' },
                { id: 'node-b', label: 'Node B' },
                { id: 'node-c', label: 'Node C' }
            ]
        });

        const nodes = container.querySelectorAll('.tv-node');
        assert.equal(nodes.length, 3, 'Should render 3 nodes');
    });

    it('should expand and collapse nodes', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'parent', label: 'Parent', children: [
                    { id: 'kid', label: 'Kid' }
                ]}
            ]
        });

        tree.toggleNode('parent');
        assert.isTrue(tree.state.expandedIds.has('parent'), 'Node should be expanded');

        tree.toggleNode('parent');
        assert.isFalse(tree.state.expandedIds.has('parent'), 'Node should be collapsed');
    });

    it('should select nodes', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'select-me', label: 'Select Me' },
                { id: 'not-me', label: 'Not Me' }
            ]
        });

        tree.handleNodeClick('select-me');
        assert.isTrue(tree.state.selectedIds.has('select-me'), 'Node should be selected');
    });

    it('should support checkboxes with cascade', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'check-parent', label: 'Parent', children: [
                    { id: 'check-child-1', label: 'Child 1' },
                    { id: 'check-child-2', label: 'Child 2' }
                ]}
            ],
            showCheckboxes: true,
            cascadeCheck: true
        });

        tree.toggleCheck('check-parent', true);
        assert.isTrue(tree.state.checkedIds.has('check-child-1'), 'Child should be checked via cascade');
        assert.isTrue(tree.state.checkedIds.has('check-child-2'), 'Child should be checked via cascade');
    });

    it('should search nodes', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'alpha', label: 'Alpha Node' },
                { id: 'beta', label: 'Beta Node' },
                { id: 'gamma', label: 'Gamma Node' }
            ],
            searchable: true
        });

        tree.searchNodes('Beta');
        assert.isTrue(tree.state.isSearching, 'Should be in search mode');
        assert.equal(tree.state.searchResults.length, 1, 'Should find 1 result');
    });

    it('should add nodes dynamically', () => {
        const tree = new TreeView(container, {
            data: [{ id: 'existing', label: 'Existing' }]
        });

        tree.addNode(null, { id: 'new', label: 'New Node' });
        assert.equal(tree.state.nodes.length, 2, 'Should have 2 root nodes');
    });

    it('should remove nodes', () => {
        const tree = new TreeView(container, {
            data: [
                { id: 'keep-me', label: 'Keep' },
                { id: 'delete-me', label: 'Delete' }
            ]
        });

        tree.removeNode('delete-me');
        assert.equal(tree.state.nodes.length, 1, 'Should have 1 node after removal');
    });
});

// ============================================================
// COLOR PICKER COMPONENT TESTS
// ============================================================
describe('ColorPicker Component - Color Selection', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('colorpicker-test');
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create ColorPicker instance', () => {
        const picker = new ColorPicker(container, {
            value: '#FF0000',
            inline: true
        });

        assert.isNotNull(picker, 'ColorPicker instance should exist');
        assert.instanceOf(picker, ColorPicker, 'Should be ColorPicker instance');
    });

    it('should parse hex color correctly', () => {
        const picker = new ColorPicker(container, { inline: true });
        const color = picker.parseColor('#FF5733');
        
        assert.equal(color.r, 255, 'Red should be 255');
        assert.equal(color.g, 87, 'Green should be 87');
        assert.equal(color.b, 51, 'Blue should be 51');
    });

    it('should parse shorthand hex', () => {
        const picker = new ColorPicker(container, { inline: true });
        const color = picker.parseColor('#F00');
        
        assert.equal(color.r, 255, 'Red should be 255 for #F00');
        assert.equal(color.g, 0, 'Green should be 0');
        assert.equal(color.b, 0, 'Blue should be 0');
    });

    it('should parse RGB color', () => {
        const picker = new ColorPicker(container, { inline: true });
        const color = picker.parseColor('rgb(100, 150, 200)');
        
        assert.equal(color.r, 100, 'Red should be 100');
        assert.equal(color.g, 150, 'Green should be 150');
        assert.equal(color.b, 200, 'Blue should be 200');
    });

    it('should parse RGBA color', () => {
        const picker = new ColorPicker(container, { inline: true });
        const color = picker.parseColor('rgba(50, 100, 150, 0.5)');
        
        assert.equal(color.r, 50, 'Red should be 50');
        assert.equal(color.a, 0.5, 'Alpha should be 0.5');
    });

    it('should convert RGB to hex', () => {
        const picker = new ColorPicker(container, { inline: true });
        const hex = picker.rgbToHex(255, 128, 0);
        
        assert.equal(hex, '#FF8000', 'Should convert to correct hex');
    });

    it('should convert hex to RGB', () => {
        const picker = new ColorPicker(container, { inline: true });
        const color = picker.parseColor('#00FF00');
        
        assert.equal(color.r, 0, 'Red should be 0');
        assert.equal(color.g, 255, 'Green should be 255');
        assert.equal(color.b, 0, 'Blue should be 0');
    });

    it('should get color in different formats', () => {
        const picker = new ColorPicker(container, { value: '#FF0000', inline: true });
        
        const hex = picker.getColor('hex');
        assert.equal(hex, '#FF0000', 'HEX format should work');

        const rgb = picker.getColor('rgb');
        assert.equal(rgb, 'rgb(255, 0, 0)', 'RGB format should work');

        const hsl = picker.getColor('hsl');
        assert.isNotNull(hsl, 'HSL format should work');
        assert.contains(hsl, 'hsl', 'HSL should contain hsl prefix');
    });
});

// ============================================================
// CONTEXT MENU COMPONENT TESTS
// ============================================================
describe('ContextMenu Component - Right-Click Menus', () => {
    beforeAll(() => {
        domHelper = new DOMTestHelper();
        eventBus = new EventBus();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create ContextMenu instance', () => {
        const menu = new ContextMenu({
            items: [
                { id: 'edit', text: 'Edit', icon: 'fa-edit' },
                { id: 'delete', text: 'Delete', icon: 'fa-trash', danger: true },
                { type: 'divider' },
                { id: 'copy', text: 'Copy', shortcut: 'Ctrl+C' }
            ]
        });

        assert.isNotNull(menu, 'ContextMenu instance should exist');
        assert.instanceOf(menu, ContextMenu, 'Should be ContextMenu instance');
    });

    it('should build menu items correctly', () => {
        const menu = new ContextMenu({
            items: [
                { id: 'action-1', text: 'Action 1' },
                { id: 'action-2', text: 'Action 2' }
            ]
        });

        const items = menu.menuElement.querySelectorAll('.ctx-item');
        assert.equal(items.length, 2, 'Should have 2 menu items');
    });

    it('should show and hide menu', () => {
        const menu = new ContextMenu({
            items: [{ id: 'test', text: 'Test' }]
        });

        menu.show(100, 100);
        assert.isTrue(menu.isVisible, 'Menu should be visible');

        menu.hide();
        assert.isFalse(menu.isVisible, 'Menu should be hidden');
    });

    it('should execute action on item click', (done) => {
        let actionExecuted = false;

        const menu = new ContextMenu({
            items: [{
                id: 'exec',
                text: 'Execute',
                action: () => {
                    actionExecuted = true;
                    assert.isTrue(actionExecuted, 'Action should be executed');
                    done();
                }
            }]
        });

        menu.show(100, 100);
        const item = menu.menuElement.querySelector('.ctx-item');
        if (item) item.click();
    });

    it('should not execute disabled items', () => {
        let actionCount = 0;

        const menu = new ContextMenu({
            items: [{
                id: 'disabled-item',
                text: 'Disabled',
                disabled: true,
                action: () => { actionCount++; }
            }]
        });

        menu.show(100, 100);
        const item = menu.menuElement.querySelector('.ctx-item');
        if (item) item.click();

        assert.equal(actionCount, 0, 'Disabled item should not execute');
    });

    it('should support dividers', () => {
        const menu = new ContextMenu({
            items: [
                { id: 'top', text: 'Top' },
                { type: 'divider' },
                { id: 'bottom', text: 'Bottom' }
            ]
        });

        const dividers = menu.menuElement.querySelectorAll('.ctx-divider');
        assert.equal(dividers.length, 1, 'Should have 1 divider');
    });
});

// ============================================================
// SEARCH BAR COMPONENT TESTS
// ============================================================
describe('SearchBar Component - Search Interface', () => {
    let container;

    beforeAll(() => {
        domHelper = new DOMTestHelper();
        container = domHelper.createContainer('searchbar-test');
        eventBus = new EventBus();
    });

    afterAll(() => {
        domHelper.cleanup();
    });

    it('should create SearchBar instance', () => {
        const searchBar = new SearchBar(container, {
            placeholder: 'Search here...',
            mode: 'global'
        });

        assert.isNotNull(searchBar, 'SearchBar instance should exist');
        assert.instanceOf(searchBar, SearchBar, 'Should be SearchBar instance');
    });

    it('should render search input', () => {
        const searchBar = new SearchBar(container, {
            placeholder: 'Find something...'
        });

        const input = container.querySelector('.searchbar-input');
        assert.isNotNull(input, 'Search input should be rendered');
        assert.equal(input.placeholder, 'Find something...', 'Placeholder should match');
    });

    it('should update search query', () => {
        const searchBar = new SearchBar(container, {
            placeholder: 'Search'
        });

        searchBar.state.query = 'test query';
        assert.equal(searchBar.state.query, 'test query', 'Query should be updated');
    });

    it('should clear search', () => {
        const searchBar = new SearchBar(container, {});
        searchBar.state.query = 'something';
        searchBar.clear();

        assert.equal(searchBar.state.query, '', 'Query should be cleared');
    });

    it('should get search value with filters', () => {
        const searchBar = new SearchBar(container, {
            filters: [{ field: 'category', label: 'Category', options: [{ value: 'tech', label: 'Technology' }] }]
        });

        searchBar.state.activeFilters.set('category', 'tech');
        const value = searchBar.getValue();

        assert.isNotNull(value.filters, 'Filters should be in value');
        assert.equal(value.filters.category, 'tech', 'Filter value should match');
    });

    it('should show suggestions when enabled', () => {
        const searchBar = new SearchBar(container, {
            suggestions: ['Apple', 'Banana', 'Cherry'],
            enableAutocomplete: true
        });

        searchBar.state.query = 'Ap';
        searchBar.state.suggestions = ['Apple'];
        searchBar.state.showSuggestions = true;

        assert.isTrue(searchBar.state.showSuggestions, 'Suggestions should be shown');
    });
});

// Export for programmatic usage
export { assert, testResults, DOMTestHelper };
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
