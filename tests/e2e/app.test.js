/**
 * 11 AVATAR DIGITAL HUB - End-to-End Application Tests
 * Enterprise-grade E2E test suite for critical user flows
 * Tests: Authentication flow, Lead management, Invoice creation, Payment flow
 * 
 * @test E2EApplication
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

/**
 * E2E Test Configuration
 * Simulates complete user journeys through the application
 */
const E2E_CONFIG = {

    baseURL: 'https://11avatardigitalhub.github.io/lead2revenue',

    apiBaseURL: 'https://11avatar-api.11avatardigitalhub.workers.dev',
    timeout: 30000,
    retryCount: 2,
    screenshotOnFailure: false,
    headless: true,
    viewport: { width: 1440, height: 900 },
    credentials: {
        testUser: {
            email: 'e2e-test@11avatardigitalhub.cloud',
            password: 'E2ETest@2026!',
            name: 'E2E Test User',
            role: 'admin'
        },
        testClient: {
            companyName: 'E2E Test Corp',
            email: 'client@e2etest.com',
            phone: '9876543210',
            gstin: '27AABCG2194N1Z1'
        }
    }
};

/**
 * Comprehensive assertion library for E2E testing
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
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    isNull(value, message = 'Expected null value') {
        if (value !== null && value !== undefined) throw new Error(message);
    },
    isNotNull(value, message = 'Expected non-null value') {
        if (value === null || value === undefined) throw new Error(message);
    },
    contains(str, substring, message = 'Expected string to contain substring') {
        if (!str || !str.includes(substring)) throw new Error(`${message}: "${str}" missing "${substring}"`);
    },
    greaterThan(actual, expected, message = 'Expected greater value') {
        if (actual <= expected) throw new Error(`${message}: expected > ${expected}, got ${actual}`);
    },
    lengthOf(arr, length, message = 'Expected array length') {
        if (!Array.isArray(arr)) throw new Error(`${message}: not an array`);
        if (arr.length !== length) throw new Error(`${message}: expected ${length}, got ${arr.length}`);
    },
    isTrue(value, message = 'Expected true') { if (value !== true) throw new Error(message); },
    isFalse(value, message = 'Expected false') { if (value !== false) throw new Error(message); },
    elementExists(selector, message = 'Element should exist') {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`${message}: "${selector}" not found`);
    },
    elementNotExists(selector, message = 'Element should not exist') {
        const el = document.querySelector(selector);
        if (el) throw new Error(`${message}: "${selector}" should not exist`);
    },
    elementVisible(selector, message = 'Element should be visible') {
        const el = document.querySelector(selector);
        if (!el || el.offsetParent === null) throw new Error(`${message}: "${selector}" not visible`);
    },
    hasText(selector, text, message = 'Element should contain text') {
        const el = document.querySelector(selector);
        if (!el || !el.textContent.includes(text)) {
            throw new Error(`${message}: "${selector}" should contain "${text}"`);
        }
    },
    hasValue(selector, value, message = 'Input should have value') {
        const el = document.querySelector(selector);
        if (!el || el.value !== value) {
            throw new Error(`${message}: "${selector}" should have value "${value}"`);
        }
    },
    urlContains(path, message = 'URL should contain path') {
        if (!window.location.href.includes(path)) {
            throw new Error(`${message}: URL should contain "${path}"`);
        }
    }
};

/**
 * Mock API Server for E2E testing
 * Simulates all backend API responses
 */
class MockAPIServer {
    constructor() {
        this.routes = new Map();
        this.requestLog = [];
        this.authToken = null;
        this.dataStore = {
            leads: [],
            clients: [],
            invoices: [],
            payments: [],
            deals: [],
            tasks: []
        };
    }

    /**
     * Register a mock API route
     * @param {string} method - HTTP method
     * @param {string} path - API path pattern
     * @param {Function} handler - Response handler function
     */
    register(method, path, handler) {
        const key = `${method.toUpperCase()}:${path}`;
        this.routes.set(key, handler);
    }

    /**
     * Handle an incoming API request
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {Object} data - Request body data
     * @returns {Promise<Object>} Response data
     */
    async handleRequest(method, path, data = null) {
        this.requestLog.push({ method, path, data, timestamp: Date.now() });
        const key = `${method.toUpperCase()}:${path}`;
        const handler = this.routes.get(key);
        
        if (handler) {
            try {
                const response = await handler(data, this.dataStore, this);
                return { success: true, data: response, status: 200 };
            } catch (error) {
                return { success: false, error: error.message, status: 400 };
            }
        }
        
        return { success: false, error: 'Route not found', status: 404 };
    }

    /**
     * Set authentication token for subsequent requests
     * @param {string} token - Auth token
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * Get request log for verification
     * @returns {Array} Request log entries
     */
    getRequestLog() {
        return [...this.requestLog];
    }

    /**
     * Clear request log
     */
    clearRequestLog() {
        this.requestLog = [];
    }

    /**
     * Reset all data stores
     */
    resetDataStore() {
        this.dataStore = {
            leads: [],
            clients: [],
            invoices: [],
            payments: [],
            deals: [],
            tasks: []
        };
    }

    /**
     * Seed test data into data stores
     */
    seedTestData() {
        this.dataStore.clients.push({
            id: 'client-001',
            companyName: 'Existing Client Corp',
            email: 'existing@client.com',
            phone: '9876543210',
            status: 'active',
            createdAt: new Date('2026-06-01').toISOString()
        });
        
        this.dataStore.leads.push({
            id: 'lead-001',
            name: 'Existing Lead',
            email: 'lead@test.com',
            status: 'qualified',
            source: 'website',
            createdAt: new Date('2026-07-01').toISOString()
        });
    }
}

/**
 * E2E Test Runner - simulates user interactions
 */
class E2ETestRunner {
    constructor(mockServer) {
        this.mockServer = mockServer;
        this.currentPage = null;
        this.sessionData = {};
        this.navigationHistory = [];
    }

    /**
     * Simulate navigating to a page
     * @param {string} url - Page URL
     */
    async navigateTo(url) {
        console.log(`  🌐 Navigating to: ${url}`);
        this.navigationHistory.push(url);
        this.currentPage = url;
        
        // Simulate page load delay
        await this.delay(100);
    }

    /**
     * Simulate user login
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login result
     */
    async login(email, password) {
        console.log(`  🔑 Logging in as: ${email}`);
        
        // Validate credentials against mock server
        const result = await this.mockServer.handleRequest('POST', '/api/auth/login', {
            email,
            password
        });

        if (result.success) {
            this.sessionData = {
                user: result.data.user,
                token: result.data.token,
                isAuthenticated: true
            };
            this.mockServer.setAuthToken(result.data.token);
            console.log(`  ✅ Login successful`);
        } else {
            console.log(`  ❌ Login failed: ${result.error}`);
        }

        return result;
    }

    /**
     * Simulate user logout
     */
    async logout() {
        console.log(`  🔒 Logging out`);
        this.sessionData = {};
        this.mockServer.setAuthToken(null);
    }

    /**
     * Simulate form submission
     * @param {Object} formData - Form field values
     * @param {string} endpoint - API endpoint
     * @returns {Promise<Object>} Submission result
     */
    async submitForm(formData, endpoint) {
        console.log(`  📝 Submitting form to: ${endpoint}`);
        const result = await this.mockServer.handleRequest('POST', endpoint, formData);
        
        if (result.success) {
            console.log(`  ✅ Form submitted successfully`);
        } else {
            console.log(`  ❌ Form submission failed: ${result.error}`);
        }
        
        return result;
    }

    /**
     * Simulate clicking a button
     * @param {string} selector - Button selector
     */
    async clickButton(selector) {
        console.log(`  🖱️  Clicking: ${selector}`);
        await this.delay(50);
    }

    /**
     * Simulate typing into an input
     * @param {string} selector - Input selector
     * @param {string} value - Text to type
     */
    async typeInput(selector, value) {
        console.log(`  ⌨️  Typing into ${selector}: "${value}"`);
        await this.delay(30);
    }

    /**
     * Simulate selecting a dropdown option
     * @param {string} selector - Select element selector
     * @param {string} value - Option value
     */
    async selectOption(selector, value) {
        console.log(`  📋 Selecting ${selector}: "${value}"`);
        await this.delay(20);
    }

    /**
     * Wait for a condition to be met
     * @param {Function} condition - Condition function returning boolean
     * @param {number} timeout - Maximum wait time in ms
     */
    async waitFor(condition, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (condition()) return true;
            await this.delay(100);
        }
        throw new Error('Condition not met within timeout');
    }

    /**
     * Verify an API request was made
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @returns {boolean} Whether request was found
     */
    verifyAPIRequest(method, path) {
        const logs = this.mockServer.getRequestLog();
        const found = logs.some(log => 
            log.method.toUpperCase() === method.toUpperCase() && 
            log.path.includes(path)
        );
        
        if (!found) {
            console.log(`  ⚠️  Expected API call not found: ${method} ${path}`);
        }
        
        return found;
    }

    /**
     * Get current session state
     * @returns {Object} Session data
     */
    getSession() {
        return { ...this.sessionData };
    }

    /**
     * Delay helper for simulating async operations
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get the mock data store for verification
     * @returns {Object} Data store
     */
    getDataStore() {
        return this.mockServer.dataStore;
    }
}

// ============================================================
// GLOBAL TEST SETUP
// ============================================================

let mockServer;
let runner;

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
const totalSuites = 5;

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
    console.log('  E2E APPLICATION TEST SUMMARY');
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

    if (typeof window !== 'undefined') window.__E2E_TEST_RESULTS__ = testResults;
    if (typeof process !== 'undefined' && process.exit) process.exit(testResults.failed > 0 ? 1 : 0);
}

// ============================================================
// SETUP MOCK API ROUTES
// ============================================================

function setupMockAPIRoutes(server) {
    // Auth routes
    server.register('POST', '/api/auth/login', (data) => {
        if (data.email === E2E_CONFIG.credentials.testUser.email && 
            data.password === E2E_CONFIG.credentials.testUser.password) {
            return {
                token: 'e2e-test-token-' + Date.now(),
                expiresIn: 3600,
                user: {
                    id: 'e2e-user-001',
                    email: data.email,
                    name: E2E_CONFIG.credentials.testUser.name,
                    role: E2E_CONFIG.credentials.testUser.role
                }
            };
        }
        throw new Error('Invalid credentials');
    });

    server.register('POST', '/api/auth/register', (data) => {
        if (!data.email || !data.password) throw new Error('Email and password required');
        if (data.password.length < 8) throw new Error('Password too short');
        return {
            token: 'e2e-register-token-' + Date.now(),
            user: { id: `user-${Date.now()}`, email: data.email, name: data.name || '' }
        };
    });

    // Lead routes
    server.register('POST', '/api/leads/create', (data, store) => {
        if (!data.name) throw new Error('Lead name is required');
        if (!data.phone && !data.email) throw new Error('Phone or email required');
        
        const newLead = {
            id: `lead-${Date.now()}`,
            name: data.name,
            email: data.email || '',
            phone: data.phone || '',
            source: data.source || 'direct',
            status: 'new',
            createdAt: new Date().toISOString()
        };
        
        store.leads.push(newLead);
        return newLead;
    });

    server.register('GET', '/api/leads/list', (data, store) => {
        return {
            leads: store.leads,
            pagination: { total: store.leads.length, page: 1, totalPages: 1 }
        };
    });

    // Client routes
    server.register('POST', '/api/clients/create', (data, store) => {
        if (!data.companyName) throw new Error('Company name is required');
        
        const newClient = {
            id: `client-${Date.now()}`,
            companyName: data.companyName,
            email: data.email || '',
            phone: data.phone || '',
            gstin: data.gstin || '',
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        store.clients.push(newClient);
        return newClient;
    });

    // Invoice routes
    server.register('POST', '/api/invoices/create', (data, store) => {
        if (!data.clientId) throw new Error('Client ID is required');
        if (!data.items || data.items.length === 0) throw new Error('At least one item required');
        
        const client = store.clients.find(c => c.id === data.clientId);
        if (!client) throw new Error('Client not found');
        
        const subtotal = data.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
        const gstRate = data.gstRate || 18;
        const tax = Math.round(subtotal * (gstRate / 100));
        
        const newInvoice = {
            id: `inv-${Date.now()}`,
            invoiceNumber: `INV-2026-${String(store.invoices.length + 1).padStart(4, '0')}`,
            clientId: data.clientId,
            clientName: client.companyName,
            items: data.items,
            subtotal,
            totalTax: tax,
            total: subtotal + tax,
            status: 'draft',
            invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
            dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        
        store.invoices.push(newInvoice);
        return newInvoice;
    });

    // Payment routes
    server.register('POST', '/api/payments/record', (data, store) => {
        if (!data.invoiceId) throw new Error('Invoice ID is required');
        if (!data.amount || data.amount <= 0) throw new Error('Valid amount required');
        
        const invoice = store.invoices.find(inv => inv.id === data.invoiceId);
        if (!invoice) throw new Error('Invoice not found');
        
        const newPayment = {
            id: `pay-${Date.now()}`,
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method || 'upi',
            status: 'completed',
            paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        
        store.payments.push(newPayment);
        
        // Update invoice status
        const totalPaid = store.payments
            .filter(p => p.invoiceId === data.invoiceId)
            .reduce((sum, p) => sum + p.amount, 0);
        
        if (totalPaid >= invoice.total) {
            invoice.status = 'paid';
        } else if (totalPaid > 0) {
            invoice.status = 'partial';
        }
        
        return newPayment;
    });
}

// ============================================================
// E2E TEST SUITES
// ============================================================

describe('E2E: Authentication Flow', () => {
    beforeAll(() => {
        mockServer = new MockAPIServer();
        setupMockAPIRoutes(mockServer);
        runner = new E2ETestRunner(mockServer);
    });

    beforeEach(() => {
        mockServer.clearRequestLog();
    });

    afterAll(() => {
        runner.logout();
    });

    it('should navigate to login page', async () => {
        await runner.navigateTo('/login.html');
        assert.contains(runner.currentPage, 'login', 'Should be on login page');
    });

    it('should login with valid credentials', async () => {
        const result = await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );

        assert.isTrue(result.success, 'Login should succeed');
        assert.isNotNull(result.data.token, 'Token should be returned');
        assert.equal(result.data.user.role, 'admin', 'User should have admin role');
        assert.isTrue(runner.getSession().isAuthenticated, 'Session should be authenticated');
    });

    it('should reject login with invalid credentials', async () => {
        const result = await runner.login('wrong@email.com', 'WrongPassword1!');

        assert.isFalse(result.success, 'Login should fail');
        assert.isNotNull(result.error, 'Error message should be provided');
        assert.isFalse(runner.getSession().isAuthenticated, 'Session should not be authenticated');
    });

    it('should login and verify API request was made', async () => {
        const result = await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );

        assert.isTrue(result.success, 'Login should succeed');
        
        const requestFound = runner.verifyAPIRequest('POST', '/api/auth/login');
        assert.isTrue(requestFound, 'Login API request should be logged');
    });

    it('should maintain session after login', async () => {
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );

        const session = runner.getSession();
        assert.isNotNull(session.token, 'Session token should exist');
        assert.isNotNull(session.user, 'Session user should exist');
    });

    it('should clear session on logout', async () => {
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );

        await runner.logout();

        const session = runner.getSession();
        assert.isFalse(session.isAuthenticated, 'Session should be cleared');
        assert.isNull(session.token || null, 'Token should be null');
    });
});

describe('E2E: Lead Management Flow', () => {
    beforeAll(() => {
        mockServer = new MockAPIServer();
        setupMockAPIRoutes(mockServer);
        runner = new E2ETestRunner(mockServer);
        mockServer.resetDataStore();
    });

    beforeEach(async () => {
        mockServer.clearRequestLog();
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );
    });

    afterAll(() => {
        runner.logout();
    });

    it('should create a new lead', async () => {
        await runner.navigateTo('/leads.html');
        
        const result = await runner.submitForm({
            name: 'E2E Lead Test',
            email: 'e2e-lead@test.com',
            phone: '9988776655',
            source: 'website',
            notes: 'Created during E2E testing'
        }, '/api/leads/create');

        assert.isTrue(result.success, 'Lead creation should succeed');
        assert.isNotNull(result.data.id, 'Lead ID should be returned');
        assert.equal(result.data.name, 'E2E Lead Test', 'Lead name should match');
        assert.equal(result.data.status, 'new', 'Lead status should be new');
    });

    it('should reject lead creation without name', async () => {
        const result = await runner.submitForm({
            email: 'no-name@test.com',
            phone: '9988776655'
        }, '/api/leads/create');

        assert.isFalse(result.success, 'Lead creation should fail without name');
        assert.contains(result.error, 'name', 'Error should mention name');
    });

    it('should reject lead creation without phone or email', async () => {
        const result = await runner.submitForm({
            name: 'No Contact Lead'
        }, '/api/leads/create');

        assert.isFalse(result.success, 'Lead creation should fail without contact');
    });

    it('should store lead in data store', async () => {
        await runner.submitForm({
            name: 'Store Test Lead',
            email: 'store@test.com',
            phone: '8899776655',
            source: 'referral'
        }, '/api/leads/create');

        const dataStore = runner.getDataStore();
        const storedLead = dataStore.leads.find(l => l.name === 'Store Test Lead');
        
        assert.isNotNull(storedLead, 'Lead should be in data store');
        assert.equal(storedLead.source, 'referral', 'Lead source should be stored');
    });

    it('should retrieve leads list', async () => {
        // Create a few leads first
        await runner.submitForm({ name: 'List Lead 1', email: 'list1@test.com', phone: '1111111111' }, '/api/leads/create');
        await runner.submitForm({ name: 'List Lead 2', email: 'list2@test.com', phone: '2222222222' }, '/api/leads/create');

        const result = await mockServer.handleRequest('GET', '/api/leads/list');
        
        assert.isTrue(result.success, 'List retrieval should succeed');
        assert.greaterThan(result.data.leads.length, 1, 'Should have multiple leads');
    });
});

describe('E2E: Client & Invoice Flow', () => {
    beforeAll(() => {
        mockServer = new MockAPIServer();
        setupMockAPIRoutes(mockServer);
        runner = new E2ETestRunner(mockServer);
        mockServer.resetDataStore();
        mockServer.seedTestData();
    });

    beforeEach(async () => {
        mockServer.clearRequestLog();
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );
    });

    afterAll(() => {
        runner.logout();
    });

    it('should create a new client', async () => {
        await runner.navigateTo('/clients.html');

        const result = await runner.submitForm({
            companyName: E2E_CONFIG.credentials.testClient.companyName,
            email: E2E_CONFIG.credentials.testClient.email,
            phone: E2E_CONFIG.credentials.testClient.phone,
            gstin: E2E_CONFIG.credentials.testClient.gstin
        }, '/api/clients/create');

        assert.isTrue(result.success, 'Client creation should succeed');
        assert.isNotNull(result.data.id, 'Client ID should be returned');
        assert.equal(result.data.companyName, 'E2E Test Corp', 'Company name should match');
    });

    it('should reject client creation without company name', async () => {
        const result = await runner.submitForm({
            email: 'noclient@test.com'
        }, '/api/clients/create');

        assert.isFalse(result.success, 'Client creation should fail without company name');
    });

    it('should create an invoice for a client', async () => {
        // First create a client
        const clientResult = await runner.submitForm({
            companyName: 'Invoice Test Client',
            email: 'invoice-client@test.com',
            phone: '9998887776'
        }, '/api/clients/create');

        assert.isTrue(clientResult.success, 'Client should be created');

        // Then create an invoice
        const invoiceResult = await runner.submitForm({
            clientId: clientResult.data.id,
            items: [
                { description: 'Web Development', rate: 50000, quantity: 1, gstRate: '18%' },
                { description: 'Hosting (Annual)', rate: 12000, quantity: 1, gstRate: '18%' }
            ],
            gstRate: 18,
            invoiceDate: '2026-07-16',
            dueDate: '2026-08-15'
        }, '/api/invoices/create');

        assert.isTrue(invoiceResult.success, 'Invoice creation should succeed');
        assert.isNotNull(invoiceResult.data.invoiceNumber, 'Invoice number should be generated');
        assert.contains(invoiceResult.data.invoiceNumber, 'INV-', 'Invoice number should have correct format');
        assert.equal(invoiceResult.data.subtotal, 62000, 'Subtotal should be ₹62,000');
        assert.equal(invoiceResult.data.totalTax, 11160, 'GST should be ₹11,160 (18% of ₹62,000)');
    });

    it('should reject invoice without items', async () => {
        const result = await runner.submitForm({
            clientId: 'client-001',
            items: []
        }, '/api/invoices/create');

        assert.isFalse(result.success, 'Invoice creation should fail without items');
    });
});

describe('E2E: Payment Processing Flow', () => {
    beforeAll(() => {
        mockServer = new MockAPIServer();
        setupMockAPIRoutes(mockServer);
        runner = new E2ETestRunner(mockServer);
        mockServer.resetDataStore();
    });

    beforeEach(async () => {
        mockServer.clearRequestLog();
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );
    });

    afterAll(() => {
        runner.logout();
    });

    it('should process a payment for an invoice', async () => {
        // Create client
        const clientResult = await runner.submitForm({
            companyName: 'Payment Test Client',
            email: 'payment-client@test.com'
        }, '/api/clients/create');

        // Create invoice
        const invoiceResult = await runner.submitForm({
            clientId: clientResult.data.id,
            items: [{ description: 'Consulting', rate: 25000, quantity: 1 }],
            gstRate: 18
        }, '/api/invoices/create');

        // Record payment
        const paymentResult = await runner.submitForm({
            invoiceId: invoiceResult.data.id,
            amount: invoiceResult.data.total,
            method: 'upi',
            paymentDate: '2026-07-16'
        }, '/api/payments/record');

        assert.isTrue(paymentResult.success, 'Payment should be processed');
        assert.isNotNull(paymentResult.data.id, 'Payment ID should be returned');
        assert.equal(paymentResult.data.status, 'completed', 'Payment status should be completed');
    });

    it('should update invoice status after full payment', async () => {
        const clientResult = await runner.submitForm({
            companyName: 'Status Test Client',
            email: 'status-client@test.com'
        }, '/api/clients/create');

        const invoiceResult = await runner.submitForm({
            clientId: clientResult.data.id,
            items: [{ description: 'Service', rate: 10000, quantity: 1 }],
            gstRate: 18
        }, '/api/invoices/create');

        await runner.submitForm({
            invoiceId: invoiceResult.data.id,
            amount: invoiceResult.data.total,
            method: 'bank_transfer'
        }, '/api/payments/record');

        const dataStore = runner.getDataStore();
        const updatedInvoice = dataStore.invoices.find(inv => inv.id === invoiceResult.data.id);

        assert.isNotNull(updatedInvoice, 'Invoice should exist');
        assert.equal(updatedInvoice.status, 'paid', 'Invoice should be marked as paid');
    });

    it('should handle partial payment', async () => {
        const clientResult = await runner.submitForm({
            companyName: 'Partial Payment Client',
            email: 'partial@test.com'
        }, '/api/clients/create');

        const invoiceResult = await runner.submitForm({
            clientId: clientResult.data.id,
            items: [{ description: 'Large Project', rate: 100000, quantity: 1 }],
            gstRate: 18
        }, '/api/invoices/create');

        await runner.submitForm({
            invoiceId: invoiceResult.data.id,
            amount: 50000,
            method: 'upi'
        }, '/api/payments/record');

        const dataStore = runner.getDataStore();
        const partialInvoice = dataStore.invoices.find(inv => inv.id === invoiceResult.data.id);

        assert.isNotNull(partialInvoice, 'Invoice should exist');
        assert.equal(partialInvoice.status, 'partial', 'Invoice should show partial payment');
    });

    it('should reject payment without valid invoice', async () => {
        const result = await runner.submitForm({
            invoiceId: 'non-existent-invoice',
            amount: 5000,
            method: 'upi'
        }, '/api/payments/record');

        assert.isFalse(result.success, 'Payment should fail for invalid invoice');
    });

    it('should reject payment with zero or negative amount', async () => {
        const result = await runner.submitForm({
            invoiceId: 'inv-001',
            amount: 0,
            method: 'upi'
        }, '/api/payments/record');

        assert.isFalse(result.success, 'Payment should fail for zero amount');
    });
});

describe('E2E: End-to-End Business Flow', () => {
    beforeAll(() => {
        mockServer = new MockAPIServer();
        setupMockAPIRoutes(mockServer);
        runner = new E2ETestRunner(mockServer);
        mockServer.resetDataStore();
    });

    beforeEach(async () => {
        mockServer.clearRequestLog();
        await runner.login(
            E2E_CONFIG.credentials.testUser.email,
            E2E_CONFIG.credentials.testUser.password
        );
    });

    afterAll(() => {
        runner.logout();
    });

    it('should complete full lead-to-payment business flow', async () => {
        // Step 1: Create a lead
        console.log('  📋 Step 1: Creating lead...');
        const leadResult = await runner.submitForm({
            name: 'Business Flow Lead',
            email: 'business-flow@test.com',
            phone: '7777777777',
            source: 'linkedin'
        }, '/api/leads/create');
        assert.isTrue(leadResult.success, 'Step 1: Lead creation should succeed');

        // Step 2: Convert lead to client
        console.log('  📋 Step 2: Creating client...');
        const clientResult = await runner.submitForm({
            companyName: 'Business Flow Corp',
            email: 'business-flow@test.com',
            phone: '7777777777',
            gstin: '27AABCG2194N1Z1'
        }, '/api/clients/create');
        assert.isTrue(clientResult.success, 'Step 2: Client creation should succeed');

        // Step 3: Create an invoice
        console.log('  📋 Step 3: Creating invoice...');
        const invoiceResult = await runner.submitForm({
            clientId: clientResult.data.id,
            items: [
                { description: 'CRM Implementation', rate: 150000, quantity: 1, gstRate: '18%' },
                { description: 'Training Session', rate: 25000, quantity: 2, gstRate: '18%' },
                { description: 'Annual Support', rate: 50000, quantity: 1, gstRate: '18%' }
            ],
            gstRate: 18,
            invoiceDate: '2026-07-16',
            dueDate: '2026-08-15',
            notes: 'Net 30 payment terms'
        }, '/api/invoices/create');
        assert.isTrue(invoiceResult.success, 'Step 3: Invoice creation should succeed');

        // Step 4: Process payment
        console.log('  📋 Step 4: Processing payment...');
        const paymentResult = await runner.submitForm({
            invoiceId: invoiceResult.data.id,
            amount: invoiceResult.data.total,
            method: 'bank_transfer',
            paymentDate: '2026-07-16'
        }, '/api/payments/record');
        assert.isTrue(paymentResult.success, 'Step 4: Payment should be processed');

        // Step 5: Verify final state
        console.log('  📋 Step 5: Verifying final state...');
        const dataStore = runner.getDataStore();
        
        const finalInvoice = dataStore.invoices.find(inv => inv.id === invoiceResult.data.id);
        assert.isNotNull(finalInvoice, 'Invoice should exist in data store');
        assert.equal(finalInvoice.status, 'paid', 'Invoice should be fully paid');

        const payments = dataStore.payments.filter(p => p.invoiceId === invoiceResult.data.id);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        assert.equal(totalPaid, finalInvoice.total, 'Total payments should equal invoice total');

        console.log('  🎉 Full business flow completed successfully!');
    });

    it('should verify all API calls in flow were made', async () => {
        const requestLog = mockServer.getRequestLog();
        
        const hasLeadCreate = requestLog.some(log => log.path === '/api/leads/create');
        const hasClientCreate = requestLog.some(log => log.path === '/api/clients/create');
        const hasInvoiceCreate = requestLog.some(log => log.path === '/api/invoices/create');
        const hasPaymentRecord = requestLog.some(log => log.path === '/api/payments/record');

        assert.isTrue(hasLeadCreate, 'Lead creation API should be called');
        assert.isTrue(hasClientCreate, 'Client creation API should be called');
        assert.isTrue(hasInvoiceCreate, 'Invoice creation API should be called');
        assert.isTrue(hasPaymentRecord, 'Payment record API should be called');
    });
});

// Export for programmatic usage
export { 
    assert, testResults, E2ETestRunner, MockAPIServer, 
    E2E_CONFIG, setupMockAPIRoutes 
};


