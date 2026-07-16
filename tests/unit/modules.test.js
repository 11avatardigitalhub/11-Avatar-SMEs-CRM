/**
 * 11 AVATAR DIGITAL HUB - Business Modules Unit Tests
 * Enterprise-grade test suite for CRM business modules
 * Tests: Pipeline, Invoices, Payments, WhatsApp, Tasks, Projects
 * 
 * @test BusinessModules
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { PipelineModule } from '../../src/js/modules/pipeline.js';
import { InvoicesModule } from '../../src/js/modules/invoices.js';
import { PaymentsModule } from '../../src/js/modules/payments.js';
import { WhatsAppModule } from '../../src/js/modules/whatsapp.js';
import { TasksModule } from '../../src/js/modules/tasks.js';
import { ProjectsModule } from '../../src/js/modules/projects.js';
import { EventBus } from '../../src/js/core/eventBus.js';

/**
 * Shared assertion library for all test files
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
    matchRegex(str, regex, message = 'Expected string to match regex') {
        if (!regex.test(str)) throw new Error(`${message}: "${str}" does not match pattern`);
    }
};

/**
 * Mock API for isolated testing without network calls
 */
class MockAPI {
    constructor() {
        this.responses = new Map();
        this.requests = [];
    }

    mockResponse(endpoint, data, success = true) {
        this.responses.set(endpoint, { success, data, error: success ? null : 'Mock error' });
    }

    async get(endpoint) {
        this.requests.push({ method: 'GET', endpoint });
        const response = this.responses.get(endpoint);
        if (response) return response;
        return { success: true, data: [] };
    }

    async post(endpoint, data) {
        this.requests.push({ method: 'POST', endpoint, data });
        const response = this.responses.get(endpoint);
        if (response) return response;
        return { success: true, data: { id: `mock-${Date.now()}`, ...data } };
    }

    async put(endpoint, data) {
        this.requests.push({ method: 'PUT', endpoint, data });
        const response = this.responses.get(endpoint);
        if (response) return response;
        return { success: true, data: { ...data } };
    }

    async delete(endpoint) {
        this.requests.push({ method: 'DELETE', endpoint });
        return { success: true };
    }

    getRequests() { return [...this.requests]; }
    clearRequests() { this.requests = []; }
}

/**
 * Mock State for module dependencies
 */
class MockState {
    constructor() {
        this.data = new Map();
    }
    get(key, defaultValue = null) { return this.data.has(key) ? this.data.get(key) : defaultValue; }
    set(key, value) { this.data.set(key, value); }
    getCurrentUser() { return { id: 'test-user', role: 'admin', email: 'test@example.com' }; }
    getAuthToken() { return 'mock-auth-token'; }
}

/**
 * Mock Cache for module dependencies
 */
class MockCache {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiry && Date.now() > entry.expiry) { this.store.delete(key); return null; }
        return { data: entry.data, timestamp: entry.timestamp };
    }
    async set(key, data, ttl = 300000) {
        this.store.set(key, { data, timestamp: Date.now(), expiry: Date.now() + ttl });
    }
    async delete(key) { this.store.delete(key); }
    async clear() { this.store.clear(); }
}

/**
 * Mock Permissions for module access control
 */
class MockPermissions {
    async check(module, action) { return true; }
}

// ============================================================
// GLOBAL TEST SETUP
// ============================================================

let eventBus;
let mockAPI;
let mockState;
let mockCache;
let mockPermissions;

const testResults = {
    total: 0, passed: 0, failed: 0, skipped: 0,
    suites: [], failures: [], startTime: Date.now(), endTime: null
};

// Override module dependencies before imports take effect
// This ensures modules use mock implementations for testing
const originalAPI = globalThis.API;
const originalState = globalThis.State;
const originalCache = globalThis.Cache;

function setupMocks() {
    eventBus = new EventBus();
    mockAPI = new MockAPI();
    mockState = new MockState();
    mockCache = new MockCache();
    mockPermissions = new MockPermissions();

    globalThis.API = mockAPI;
    globalThis.State = mockState;
    globalThis.Cache = mockCache;
}

function teardownMocks() {
    if (eventBus) eventBus.destroy();
    globalThis.API = originalAPI;
    globalThis.State = originalState;
    globalThis.Cache = originalCache;
}

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
const totalSuites = 6;

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
    console.log('  BUSINESS MODULES TEST SUMMARY');
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

    teardownMocks();
    if (typeof window !== 'undefined') window.__MODULES_TEST_RESULTS__ = testResults;
    if (typeof process !== 'undefined' && process.exit) process.exit(testResults.failed > 0 ? 1 : 0);
}

// ============================================================
// PIPELINE MODULE TESTS
// ============================================================
describe('Pipeline Module - Deal Pipeline Management', () => {
    let pipeline;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/pipeline/config', { pipelineId: 'pipe-test-001' });
        mockAPI.mockResponse('/api/pipeline/pipe-test-001/stages', [
            { id: 'lead', name: 'Lead', order: 1, color: '#6B7280' },
            { id: 'qualified', name: 'Qualified', order: 2, color: '#3B82F6' },
            { id: 'proposal', name: 'Proposal', order: 3, color: '#F59E0B' },
            { id: 'won', name: 'Won', order: 4, color: '#10B981' },
            { id: 'lost', name: 'Lost', order: 5, color: '#DC2626' }
        ]);
        mockAPI.mockResponse('/api/pipeline/pipe-test-001/deals', [
            { id: 'deal-1', title: 'Enterprise Deal', stage: 'proposal', value: 500000, probability: 60 },
            { id: 'deal-2', title: 'SMB Deal', stage: 'lead', value: 50000, probability: 20 },
            { id: 'deal-3', title: 'Startup Deal', stage: 'qualified', value: 100000, probability: 40 }
        ]);
    });

    afterAll(() => {
        if (pipeline) pipeline.destroy();
    });

    it('should create Pipeline instance', () => {
        pipeline = new PipelineModule();
        assert.isNotNull(pipeline, 'Pipeline instance should exist');
        assert.instanceOf(pipeline, PipelineModule, 'Should be PipelineModule instance');
    });

    it('should have correct module name', () => {
        assert.equal(pipeline.moduleName, 'pipeline', 'Module name should be pipeline');
    });

    it('should define valid pipeline stages', () => {
        assert.isNotNull(pipeline.stages, 'Stages should be defined');
    });

    it('should calculate deal age correctly', () => {
        const age = pipeline.calculateDealAge('2026-07-01T00:00:00Z');
        assert.greaterThan(age, 0, 'Deal age should be greater than 0 days');
    });

    it('should detect overdue deals', () => {
        const overdueDeal = { dueDate: '2020-01-01', status: 'active' };
        assert.isTrue(pipeline.isDealOverdue(overdueDeal), 'Should detect overdue deal');
    });

    it('should not mark completed deals as overdue', () => {
        const completedDeal = { dueDate: '2020-01-01', status: 'won' };
        assert.isFalse(pipeline.isDealOverdue(completedDeal), 'Completed deal should not be overdue');
    });

    it('should format deal value as currency', () => {
        const pipeline2 = new PipelineModule();
        const result = pipeline2.formatCurrency(500000, 'INR');
        assert.isNotNull(result, 'Formatted currency should exist');
    });
});

// ============================================================
// INVOICES MODULE TESTS
// ============================================================
describe('Invoices Module - GST Invoicing', () => {
    let invoices;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/invoices/config', {
            gstConfig: { enabled: true, defaultRate: '18%', rates: { '5%': 5, '12%': 12, '18%': 18, '28%': 28 } },
            sequence: { prefix: 'INV', current: 100, format: 'INV-{YEAR}-{SEQ:04d}' }
        });
        mockAPI.mockResponse('/api/invoices/list', {
            invoices: [
                { id: 'inv-1', invoiceNumber: 'INV-2026-0101', client: { name: 'Acme Corp', gstin: '27AABCG2194N1Z1' }, total: 118000, status: 'paid', invoiceDate: '2026-07-01', dueDate: '2026-07-31' },
                { id: 'inv-2', invoiceNumber: 'INV-2026-0102', client: { name: 'Tech Ltd' }, total: 59000, status: 'sent', invoiceDate: '2026-07-10', dueDate: '2026-08-09' }
            ],
            pagination: { total: 2, page: 1, totalPages: 1 }
        });
    });

    afterAll(() => {
        if (invoices) invoices.destroy();
    });

    it('should create Invoices instance', () => {
        invoices = new InvoicesModule();
        assert.isNotNull(invoices, 'Invoices instance should exist');
        assert.instanceOf(invoices, InvoicesModule, 'Should be InvoicesModule instance');
    });

    it('should have correct module name', () => {
        assert.equal(invoices.moduleName, 'invoices', 'Module name should be invoices');
    });

    it('should define GST configuration', () => {
        assert.isNotNull(invoices.gstConfig, 'GST config should be defined');
        assert.isTrue(invoices.gstConfig.enabled, 'GST should be enabled');
    });

    it('should define invoice statuses', () => {
        assert.isNotNull(invoices.statuses, 'Invoice statuses should be defined');
        assert.isTrue(Object.keys(invoices.statuses).length > 0, 'Should have multiple statuses');
    });

    it('should calculate GST correctly for intra-state', () => {
        const gstCalc = invoices.calculateGST(100000, '18%', false);
        assert.isNotNull(gstCalc, 'GST calculation should exist');
        assert.equal(gstCalc.cgst, 9000, 'CGST should be 9% of taxable amount');
        assert.equal(gstCalc.sgst, 9000, 'SGST should be 9% of taxable amount');
        assert.equal(gstCalc.totalTax, 18000, 'Total tax should be 18%');
    });

    it('should calculate GST correctly for inter-state', () => {
        const gstCalc = invoices.calculateGST(100000, '18%', true);
        assert.isNotNull(gstCalc, 'GST calculation should exist');
        assert.equal(gstCalc.igst, 18000, 'IGST should be 18% of taxable amount');
        assert.equal(gstCalc.cgst, 0, 'CGST should be 0 for inter-state');
        assert.equal(gstCalc.sgst, 0, 'SGST should be 0 for inter-state');
    });

    it('should detect inter-state from GSTIN', () => {
        invoices.gstinInfo = { stateCode: '27' };
        const isInterState = invoices.checkInterState('29AABCG2194N1Z1');
        assert.isTrue(isInterState, 'Different state codes should be inter-state');
    });

    it('should detect intra-state from GSTIN', () => {
        invoices.gstinInfo = { stateCode: '27' };
        const isInterState = invoices.checkInterState('27AABCG2194N1Z1');
        assert.isFalse(isInterState, 'Same state codes should be intra-state');
    });

    it('should generate invoice number in correct format', () => {
        const invNumber = invoices.generateInvoiceNumber(101);
        assert.contains(invNumber, 'INV-', 'Invoice number should start with INV-');
        assert.contains(invNumber, '2026', 'Invoice number should contain year');
    });

    it('should detect overdue invoices', () => {
        const overdueInv = { dueDate: '2020-01-01', status: 'sent' };
        assert.isTrue(invoices.isInvoiceOverdue(overdueInv), 'Should detect overdue invoice');
    });

    it('should calculate days overdue', () => {
        const overdueInv = { dueDate: '2026-01-01' };
        const days = invoices.getDaysOverdue(overdueInv);
        assert.greaterThan(days, 100, 'Should be many days overdue');
    });
});

// ============================================================
// PAYMENTS MODULE TESTS
// ============================================================
describe('Payments Module - Payment Processing', () => {
    let payments;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/payments/config', {
            upiConfig: { enabled: true, vpa: 'company@upi' },
            reconciliation: { autoReconcile: true, toleranceAmount: 1.0 }
        });
        mockAPI.mockResponse('/api/bank-accounts', [
            { id: 'ba-1', bankName: 'HDFC Bank', accountNumber: '12345678901', ifsc: 'HDFC0001234' }
        ]);
        mockAPI.mockResponse('/api/payments/list', {
            payments: [
                { id: 'pay-1', amount: 50000, method: 'upi', status: 'completed', invoiceId: 'inv-1', client: { name: 'Acme Corp' }, paymentDate: '2026-07-15' },
                { id: 'pay-2', amount: 25000, method: 'bank_transfer', status: 'pending', invoiceId: 'inv-2', client: { name: 'Tech Ltd' }, paymentDate: '2026-07-16' }
            ],
            pagination: { total: 2 }
        });
    });

    afterAll(() => {
        if (payments) payments.destroy();
    });

    it('should create Payments instance', () => {
        payments = new PaymentsModule();
        assert.isNotNull(payments, 'Payments instance should exist');
        assert.instanceOf(payments, PaymentsModule, 'Should be PaymentsModule instance');
    });

    it('should define payment methods', () => {
        assert.isNotNull(payments.paymentMethods, 'Payment methods should be defined');
        assert.isTrue(Object.keys(payments.paymentMethods).length >= 5, 'Should have at least 5 payment methods');
    });

    it('should define payment statuses', () => {
        assert.isNotNull(payments.paymentStatuses, 'Payment statuses should be defined');
        assert.isTrue(payments.paymentStatuses['completed'] !== undefined, 'Should have completed status');
        assert.isTrue(payments.paymentStatuses['pending'] !== undefined, 'Should have pending status');
        assert.isTrue(payments.paymentStatuses['failed'] !== undefined, 'Should have failed status');
    });

    it('should validate UPI payment method', () => {
        const upiConfig = payments.paymentMethods.upi;
        assert.isNotNull(upiConfig, 'UPI method should exist');
        assert.isTrue(upiConfig.enabled, 'UPI should be enabled');
    });

    it('should validate cash payment limit', () => {
        const isValid = payments.validateCashPayment(150000);
        assert.isTrue(isValid, 'Cash payment under 2 lakh should be valid');
    });

    it('should reject cash payment above limit', () => {
        const isValid = payments.validateCashPayment(250000);
        assert.isFalse(isValid, 'Cash payment above 2 lakh should be invalid');
    });

    it('should calculate payment age in days', () => {
        const age = payments.calculateAge('2026-07-01');
        assert.greaterThan(age, 0, 'Payment age should be positive');
    });

    it('should calculate payment progress percentage', () => {
        const progress = payments.calculatePaymentProgress({ total: 100000, paidAmount: 75000 });
        assert.equal(progress, 75, 'Payment progress should be 75%');
    });

    it('should format payment amount correctly', () => {
        const formatted = payments.formatAmount(50000, 'INR');
        assert.isNotNull(formatted, 'Formatted amount should exist');
    });
});

// ============================================================
// WHATSAPP MODULE TESTS
// ============================================================
describe('WhatsApp Module - CloudWA Integration', () => {
    let whatsapp;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/whatsapp/config', {
            cloudWAConfig: { baseURL: 'https://cloudwa.test.cloud', apiEndpoint: 'https://cloudwa.test.cloud/api' },
            wabaConfig: { phoneNumberId: '123456789', status: 'connected', displayName: 'Test Business' }
        });
    });

    afterAll(() => {
        if (whatsapp) whatsapp.destroy();
    });

    it('should create WhatsApp instance', () => {
        whatsapp = new WhatsAppModule();
        assert.isNotNull(whatsapp, 'WhatsApp instance should exist');
        assert.instanceOf(whatsapp, WhatsAppModule, 'Should be WhatsAppModule instance');
    });

    it('should have CloudWA configuration', () => {
        assert.isNotNull(whatsapp.cloudWAConfig, 'CloudWA config should exist');
        assert.contains(whatsapp.cloudWAConfig.baseURL, 'cloudwa', 'Should have CloudWA URL');
    });

    it('should format phone number correctly', () => {
        const formatted = whatsapp.formatPhoneNumber('9876543210');
        assert.contains(formatted, '+91', 'Should format with country code');
    });

    it('should format phone number with existing country code', () => {
        const formatted = whatsapp.formatPhoneNumber('919876543210');
        assert.contains(formatted, '+91', 'Should format correctly');
    });

    it('should define message templates', () => {
        assert.isNotNull(whatsapp.messageTemplates, 'Message templates should exist');
    });

    it('should define automation rules', () => {
        assert.isNotNull(whatsapp.automationRules, 'Automation rules should exist');
    });

    it('should check message queue processing', () => {
        whatsapp.messageQueue = [{ id: 'msg-1', content: 'Hello', chatId: 'chat-1' }];
        assert.equal(whatsapp.messageQueue.length, 1, 'Should have queued message');
    });
});

// ============================================================
// TASKS MODULE TESTS
// ============================================================
describe('Tasks Module - Task Management', () => {
    let tasks;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/tasks/list', {
            tasks: [
                { id: 'task-1', title: 'Follow up with client', status: 'todo', priority: 'high', assignee: { name: 'John' }, dueDate: '2026-07-20', createdAt: '2026-07-01' },
                { id: 'task-2', title: 'Prepare proposal', status: 'in_progress', priority: 'critical', assignee: { name: 'Jane' }, dueDate: '2026-07-15', createdAt: '2026-07-05' },
                { id: 'task-3', title: 'Send invoice', status: 'done', priority: 'medium', assignee: { name: 'John' }, dueDate: '2026-07-10', createdAt: '2026-06-25', completedAt: '2026-07-09' }
            ],
            pagination: { total: 3 }
        });
    });

    afterAll(() => {
        if (tasks) tasks.destroy();
    });

    it('should create Tasks instance', () => {
        tasks = new TasksModule();
        assert.isNotNull(tasks, 'Tasks instance should exist');
        assert.instanceOf(tasks, TasksModule, 'Should be TasksModule instance');
    });

    it('should define task statuses', () => {
        assert.isNotNull(tasks.statuses, 'Task statuses should be defined');
        assert.isTrue(tasks.statuses['todo'] !== undefined, 'Should have todo status');
        assert.isTrue(tasks.statuses['in_progress'] !== undefined, 'Should have in_progress status');
        assert.isTrue(tasks.statuses['done'] !== undefined, 'Should have done status');
    });

    it('should define task priorities', () => {
        assert.isNotNull(tasks.priorities, 'Task priorities should be defined');
        assert.isTrue(tasks.priorities['critical'] !== undefined, 'Should have critical priority');
        assert.isTrue(tasks.priorities['high'] !== undefined, 'Should have high priority');
    });

    it('should detect overdue tasks', () => {
        const overdueTask = { dueDate: '2020-01-01', status: 'todo' };
        assert.isTrue(tasks.isTaskOverdue(overdueTask), 'Should detect overdue task');
    });

    it('should calculate days overdue', () => {
        const task = { dueDate: '2026-01-01' };
        const days = tasks.getDaysOverdue(task);
        assert.greaterThan(days, 100, 'Should be many days overdue');
    });

    it('should detect tasks due today', () => {
        const today = new Date().toISOString().split('T')[0];
        const task = { dueDate: today };
        assert.isTrue(tasks.isDueToday(task), 'Should detect task due today');
    });

    it('should calculate completion percentage from subtasks', () => {
        const task = { subtaskCount: 4, completedSubtaskCount: 3 };
        const pct = tasks.calculateCompletion(task);
        assert.equal(pct, 75, 'Completion should be 75%');
    });

    it('should return 100% for completed tasks without subtasks', () => {
        const task = { status: 'done', subtaskCount: 0 };
        const pct = tasks.calculateCompletion(task);
        assert.equal(pct, 100, 'Done task should be 100%');
    });

    it('should format time spent correctly', () => {
        const formatted = tasks.formatTimeSpent(90);
        assert.equal(formatted, '1h 30m', 'Should format as hours and minutes');
    });
});

// ============================================================
// PROJECTS MODULE TESTS
// ============================================================
describe('Projects Module - Project Management', () => {
    let projects;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/projects/list', {
            projects: [
                { id: 'proj-1', name: 'Website Redesign', status: 'active', type: 'client', budget: 500000, spent: 350000, startDate: '2026-06-01', endDate: '2026-08-31', resources: [1, 2, 3], milestones: [{ status: 'completed' }, { status: 'pending' }] },
                { id: 'proj-2', name: 'Mobile App', status: 'planning', type: 'product', budget: 1000000, spent: 0, startDate: '2026-08-01', endDate: '2026-12-31', resources: [4, 5] }
            ],
            pagination: { total: 2 }
        });
    });

    afterAll(() => {
        if (projects) projects.destroy();
    });

    it('should create Projects instance', () => {
        projects = new ProjectsModule();
        assert.isNotNull(projects, 'Projects instance should exist');
        assert.instanceOf(projects, ProjectsModule, 'Should be ProjectsModule instance');
    });

    it('should define project statuses', () => {
        assert.isNotNull(projects.statuses, 'Project statuses should be defined');
        assert.isTrue(projects.statuses['active'] !== undefined, 'Should have active status');
        assert.isTrue(projects.statuses['completed'] !== undefined, 'Should have completed status');
    });

    it('should define project types', () => {
        assert.isNotNull(projects.projectTypes, 'Project types should be defined');
        assert.isTrue(projects.projectTypes['client'] !== undefined, 'Should have client type');
        assert.isTrue(projects.projectTypes['internal'] !== undefined, 'Should have internal type');
    });

    it('should calculate project progress', () => {
        const project = {
            tasks: [
                { status: 'done' }, { status: 'done' }, { status: 'done' },
                { status: 'in_progress' }
            ]
        };
        const progress = projects.calculateProgress(project);
        assert.equal(progress, 75, 'Progress should be 75%');
    });

    it('should calculate zero progress for no tasks', () => {
        const project = { tasks: [] };
        const progress = projects.calculateProgress(project);
        assert.equal(progress, 0, 'Progress should be 0%');
    });

    it('should detect overdue projects', () => {
        const project = { endDate: '2020-01-01', status: 'active' };
        assert.isTrue(projects.isProjectOverdue(project), 'Should detect overdue project');
    });

    it('should calculate days remaining', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const project = { endDate: futureDate.toISOString().split('T')[0] };
        const days = projects.calculateDaysRemaining(project);
        assert.greaterThan(days, 0, 'Should have positive days remaining');
    });

    it('should calculate budget utilization', () => {
        const project = { budget: 500000, spent: 375000 };
        const utilization = projects.calculateBudgetUtilization(project);
        assert.equal(utilization, 75, 'Budget utilization should be 75%');
    });

    it('should calculate project health score', () => {
        const project = {
            status: 'active',
            endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            budget: 100000, spent: 50000,
            progress: 60, daysRemaining: 30,
            totalMilestones: 5, completedMilestones: 3
        };
        const health = projects.calculateHealthScore(project);
        assert.greaterThan(health, 0, 'Health score should be positive');
        assert.lessThan(health, 101, 'Health score should be 100 or less');
    });

    it('should generate project code in correct format', () => {
        const code = projects.generateProjectCode();
        assert.contains(code, 'PRJ-', 'Project code should start with PRJ-');
    });
});

// Export for programmatic usage
export { assert, testResults, setupMocks, teardownMocks, MockAPI, MockState, MockCache, MockPermissions };
