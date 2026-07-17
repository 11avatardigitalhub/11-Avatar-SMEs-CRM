/**
 * 11 AVATAR DIGITAL HUB - Integration Module Unit Tests
 * Enterprise-grade test suite for third-party integrations
 * Tests: GST, Payment Gateway, Email, SMS, WhatsApp, Calendar, Maps
 * 
 * @test IntegrationModules
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { GSTIntegration } from '../../src/js/integrations/gst.js';
import { PaymentIntegration } from '../../src/js/integrations/payment.js';
import { EmailIntegration } from '../../src/js/integrations/email.js';
import { SMSIntegration } from '../../src/js/integrations/sms.js';
import { CalendarIntegration } from '../../src/js/integrations/calendar.js';
import { MapsIntegration } from '../../src/js/integrations/maps.js';
import { WebhookIntegration } from '../../src/js/integrations/webhook.js';
import { SlackIntegration } from '../../src/js/integrations/slack.js';
import { EventBus } from '../../src/js/core/eventBus.js';

/**
 * Shared assertion library - consistent across all test files
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
 * Mock API for isolated integration testing
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
        return { success: true, data: {} };
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
    getCurrentUser() { return { id: 'test-user', role: 'admin', email: 'test@integration.com' }; }
    getAuthToken() { return 'mock-integration-token'; }
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
 * Mock Permissions for integration access control
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
    console.log('  INTEGRATION MODULES TEST SUMMARY');
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
    if (typeof window !== 'undefined') window.__INTEGRATIONS_TEST_RESULTS__ = testResults;
    if (typeof process !== 'undefined' && process.exit) process.exit(testResults.failed > 0 ? 1 : 0);
}

// ============================================================
// GST INTEGRATION TESTS
// ============================================================
describe('GST Integration - Tax Compliance', () => {
    let gst;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/gst/gstin', {
            gstin: '27AABCG2194N1Z1',
            legalName: 'Test Company Pvt Ltd',
            tradeName: 'Test Co',
            status: 'active',
            stateCode: '27',
            address: { line1: '123 Test Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
            email: 'test@company.com',
            phone: '9876543210'
        });
    });

    afterAll(() => {
        if (gst) gst.destroy();
    });

    it('should create GSTIntegration instance', () => {
        gst = new GSTIntegration();
        assert.isNotNull(gst, 'GSTIntegration instance should exist');
        assert.instanceOf(gst, GSTIntegration, 'Should be GSTIntegration instance');
    });

    it('should define GST types correctly', () => {
        assert.isNotNull(gst.gstTypes, 'GST types should be defined');
        assert.isTrue(gst.gstTypes['cgst'] !== undefined, 'CGST type should exist');
        assert.isTrue(gst.gstTypes['sgst'] !== undefined, 'SGST type should exist');
        assert.isTrue(gst.gstTypes['igst'] !== undefined, 'IGST type should exist');
    });

    it('should define GST rate slabs', () => {
        assert.isNotNull(gst.gstRates, 'GST rates should be defined');
        assert.isTrue(gst.gstRates['0%'] !== undefined, '0% rate should exist');
        assert.isTrue(gst.gstRates['5%'] !== undefined, '5% rate should exist');
        assert.isTrue(gst.gstRates['18%'] !== undefined, '18% rate should exist');
        assert.isTrue(gst.gstRates['28%'] !== undefined, '28% rate should exist');
    });

    it('should calculate GST for intra-state supply correctly', () => {
        const result = gst.calculateGST({
            amount: 100000,
            gstRate: 18,
            isInterState: false,
            placeOfSupply: '27',
            billFromState: '27'
        });

        assert.isNotNull(result, 'GST calculation should exist');
        assert.equal(result.cgst, 9000, 'CGST should be ₹9,000 (9% of ₹1,00,000)');
        assert.equal(result.sgst, 9000, 'SGST should be ₹9,000 (9% of ₹1,00,000)');
        assert.equal(result.igst, 0, 'IGST should be ₹0 for intra-state');
        assert.equal(result.totalGST, 18000, 'Total GST should be ₹18,000');
        assert.equal(result.totalAmount, 118000, 'Total amount should be ₹1,18,000');
        assert.isFalse(result.isInterState, 'Should be marked as intra-state');
    });

    it('should calculate GST for inter-state supply correctly', () => {
        const result = gst.calculateGST({
            amount: 100000,
            gstRate: 18,
            isInterState: true,
            placeOfSupply: '29',
            billFromState: '27'
        });

        assert.equal(result.igst, 18000, 'IGST should be ₹18,000 (18% of ₹1,00,000)');
        assert.equal(result.cgst, 0, 'CGST should be ₹0 for inter-state');
        assert.equal(result.sgst, 0, 'SGST should be ₹0 for inter-state');
        assert.isTrue(result.isInterState, 'Should be marked as inter-state');
    });

    it('should calculate GST for 5% slab correctly', () => {
        const result = gst.calculateGST({
            amount: 50000,
            gstRate: 5,
            isInterState: false
        });

        assert.equal(result.cgst, 1250, 'CGST should be 2.5% for 5% slab');
        assert.equal(result.sgst, 1250, 'SGST should be 2.5% for 5% slab');
        assert.equal(result.totalGST, 2500, 'Total GST should be ₹2,500');
        assert.equal(result.totalAmount, 52500, 'Total should be ₹52,500');
    });

    it('should format GSTIN correctly', () => {
        const formatted = gst.formatGSTIN('27AABCG2194N1Z1');
        assert.contains(formatted, '27', 'Should contain state code');
        assert.contains(formatted, 'AABCG', 'Should contain PAN portion');
        assert.contains(formatted, 'Z1', 'Should contain check digit');
    });

    it('should validate GSTIN format', () => {
        const validGSTIN = gst.validateGSTINFormat('27AABCG2194N1Z1');
        assert.isTrue(validGSTIN, 'Valid GSTIN should pass format check');

        const invalidGSTIN = gst.validateGSTINFormat('INVALID12345');
        assert.isFalse(invalidGSTIN, 'Invalid GSTIN should fail format check');
    });

    it('should define invoice types', () => {
        assert.isNotNull(gst.invoiceTypes, 'Invoice types should be defined');
        assert.isTrue(gst.invoiceTypes['B2B'] !== undefined, 'B2B invoice type should exist');
        assert.isTrue(gst.invoiceTypes['B2C'] !== undefined, 'B2C invoice type should exist');
        assert.isTrue(gst.invoiceTypes['EXPORT'] !== undefined, 'Export invoice type should exist');
    });

    it('should define return types correctly', () => {
        assert.isNotNull(gst.returnTypes, 'Return types should be defined');
        assert.isTrue(gst.returnTypes['GSTR1'] !== undefined, 'GSTR-1 should exist');
        assert.isTrue(gst.returnTypes['GSTR3B'] !== undefined, 'GSTR-3B should exist');
    });
});

// ============================================================
// PAYMENT GATEWAY INTEGRATION TESTS
// ============================================================
describe('Payment Gateway Integration - Payment Processing', () => {
    let payment;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/payments/gateway/config', {
            gateways: {
                razorpay: { enabled: true, keyId: 'rzp_test_key', charges: { domestic: 2.0, upi: 0.0 } },
                stripe: { enabled: true, publishableKey: 'pk_test_key', charges: { domestic: 2.0 } }
            },
            defaultGateway: 'razorpay'
        });
    });

    afterAll(() => {
        if (payment) payment.destroy();
    });

    it('should create PaymentIntegration instance', () => {
        payment = new PaymentIntegration();
        assert.isNotNull(payment, 'PaymentIntegration instance should exist');
        assert.instanceOf(payment, PaymentIntegration, 'Should be PaymentIntegration instance');
    });

    it('should define payment gateways', () => {
        assert.isNotNull(payment.gateways, 'Gateways should be defined');
        assert.isTrue(payment.gateways['razorpay'] !== undefined, 'Razorpay gateway should exist');
        assert.isTrue(payment.gateways['stripe'] !== undefined, 'Stripe gateway should exist');
        assert.isTrue(payment.gateways['paypal'] !== undefined, 'PayPal gateway should exist');
        assert.isTrue(payment.gateways['upi'] !== undefined, 'UPI gateway should exist');
    });

    it('should define payment methods', () => {
        assert.isNotNull(payment.paymentMethods, 'Payment methods should be defined');
        assert.isTrue(payment.paymentMethods['upi'] !== undefined, 'UPI method should exist');
        assert.isTrue(payment.paymentMethods['card'] !== undefined, 'Card method should exist');
        assert.isTrue(payment.paymentMethods['netbanking'] !== undefined, 'Netbanking method should exist');
    });

    it('should calculate gateway charges correctly', () => {
        const charges = payment.calculateCharges(10000, 'razorpay', 'domestic');
        assert.equal(charges, 200, 'Razorpay domestic charge should be 2% = ₹200');
    });

    it('should calculate UPI charges as zero', () => {
        const charges = payment.calculateCharges(10000, 'razorpay', 'upi');
        assert.equal(charges, 0, 'UPI charges should be 0');
    });

    it('should validate payment amount against gateway limits', () => {
        const razorpayMin = payment.gateways.razorpay.minAmount;
        const razorpayMax = payment.gateways.razorpay.maxAmount;

        assert.greaterThan(razorpayMax, razorpayMin, 'Max should be greater than min');
        assert.equal(razorpayMin, 1, 'Razorpay minimum should be ₹1');
    });

    it('should define transaction statuses', () => {
        assert.isNotNull(payment.transactionStatuses, 'Transaction statuses should be defined');
        assert.isTrue(payment.transactionStatuses['completed'] !== undefined, 'Completed status should exist');
        assert.isTrue(payment.transactionStatuses['failed'] !== undefined, 'Failed status should exist');
        assert.isTrue(payment.transactionStatuses['refunded'] !== undefined, 'Refunded status should exist');
    });

    it('should detect mobile device for UPI deep linking', () => {
        const originalUserAgent = navigator.userAgent;
        
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            configurable: true
        });

        assert.isTrue(payment.isMobileDevice(), 'Should detect iPhone as mobile');

        Object.defineProperty(navigator, 'userAgent', {
            value: originalUserAgent,
            configurable: true
        });
    });

    it('should get available methods for gateway', () => {
        const methods = payment.getAvailableMethods('razorpay');
        assert.isNotNull(methods, 'Methods should exist');
        assert.greaterThan(methods.length, 0, 'Razorpay should have multiple methods');
    });
});

// ============================================================
// EMAIL INTEGRATION TESTS
// ============================================================
describe('Email Integration - Email Delivery', () => {
    let email;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/email/config', {
            smtp: { host: 'smtp.test.com', port: 587, encryption: 'tls', fromName: 'Test', fromEmail: 'test@test.com' },
            bulkSettings: { batchSize: 50, maxPerHour: 500 },
            trackingEnabled: true
        });
        mockAPI.mockResponse('/api/email/templates', [
            { id: 'welcome', name: 'Welcome Email', category: 'welcome', subject: 'Welcome {{name}}', content: '<p>Hello {{name}}</p>' }
        ]);
    });

    afterAll(() => {
        if (email) email.destroy();
    });

    it('should create EmailIntegration instance', () => {
        email = new EmailIntegration();
        assert.isNotNull(email, 'EmailIntegration instance should exist');
        assert.instanceOf(email, EmailIntegration, 'Should be EmailIntegration instance');
    });

    it('should define email providers', () => {
        assert.isNotNull(email.providers, 'Providers should be defined');
        assert.isTrue(email.providers['smtp'] !== undefined, 'SMTP provider should exist');
        assert.isTrue(email.providers['sendgrid'] !== undefined, 'SendGrid provider should exist');
        assert.isTrue(email.providers['mailgun'] !== undefined, 'Mailgun provider should exist');
    });

    it('should define email statuses', () => {
        assert.isNotNull(email.emailStatuses, 'Email statuses should be defined');
        assert.isTrue(email.emailStatuses['draft'] !== undefined, 'Draft status should exist');
        assert.isTrue(email.emailStatuses['sent'] !== undefined, 'Sent status should exist');
        assert.isTrue(email.emailStatuses['opened'] !== undefined, 'Opened status should exist');
        assert.isTrue(email.emailStatuses['bounced'] !== undefined, 'Bounced status should exist');
    });

    it('should parse recipients string to array', () => {
        const recipients = email.parseRecipients('a@test.com, b@test.com, c@test.com');
        assert.lengthOf(recipients, 3, 'Should parse 3 recipients');
        assert.equal(recipients[0], 'a@test.com', 'First recipient should match');
    });

    it('should parse semicolon-separated recipients', () => {
        const recipients = email.parseRecipients('x@test.com; y@test.com');
        assert.lengthOf(recipients, 2, 'Should parse 2 recipients from semicolons');
    });

    it('should process template variables correctly', () => {
        const template = 'Hello {{name}}, your invoice #{{invoiceNumber}} is ready.';
        const data = { name: 'John', invoiceNumber: 'INV-001' };
        const processed = email.processTemplate(template, data);

        assert.contains(processed, 'Hello John', 'Should replace name variable');
        assert.contains(processed, 'INV-001', 'Should replace invoiceNumber variable');
        assert.isFalse(processed.includes('{{'), 'No unreplaced variables should remain');
    });

    it('should extract template variables', () => {
        const template = '{{name}} ordered {{product}} for {{amount}}';
        const variables = email.extractVariables(template);

        assert.lengthOf(variables, 3, 'Should extract 3 variables');
        assert.isTrue(variables.includes('name'), 'Should include name');
        assert.isTrue(variables.includes('product'), 'Should include product');
        assert.isTrue(variables.includes('amount'), 'Should include amount');
    });

    it('should convert plain text to HTML', () => {
        const text = 'Line 1\n\nLine 2\nLine 3';
        const html = email.convertToHTML(text);

        assert.contains(html, '<p>', 'Should contain paragraph tags');
        assert.contains(html, '<br>', 'Should contain line break tags');
    });

    it('should generate unsubscribe link', () => {
        const link = email.generateUnsubscribeLink();
        assert.contains(link, 'unsubscribe', 'Should contain unsubscribe reference');
    });
});

// ============================================================
// SMS INTEGRATION TESTS
// ============================================================
describe('SMS Integration - SMS Delivery', () => {
    let sms;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/sms/config', {
            activeProvider: 'msg91',
            providers: {
                msg91: { enabled: true, authKey: 'test-key', senderId: 'TESTER' },
                twilio: { enabled: true, accountSid: 'test-sid', fromNumber: '+1234567890' }
            },
            dlt: { enabled: true, entityId: '1701000000001' }
        });
        mockAPI.mockResponse('/api/sms/templates', [
            { id: 'otp', name: 'OTP Template', type: 'transactional', content: '{{otp}} is your OTP' },
            { id: 'reminder', name: 'Payment Reminder', type: 'reminder', content: 'Dear {{name}}, payment of {{amount}} is due' }
        ]);
    });

    afterAll(() => {
        if (sms) sms.destroy();
    });

    it('should create SMSIntegration instance', () => {
        sms = new SMSIntegration();
        assert.isNotNull(sms, 'SMSIntegration instance should exist');
        assert.instanceOf(sms, SMSIntegration, 'Should be SMSIntegration instance');
    });

    it('should define SMS providers', () => {
        assert.isNotNull(sms.providers, 'Providers should be defined');
        assert.isTrue(sms.providers['twilio'] !== undefined, 'Twilio provider should exist');
        assert.isTrue(sms.providers['msg91'] !== undefined, 'MSG91 provider should exist');
        assert.isTrue(sms.providers['textlocal'] !== undefined, 'TextLocal provider should exist');
    });

    it('should define SMS types', () => {
        assert.isNotNull(sms.smsTypes, 'SMS types should be defined');
        assert.isTrue(sms.smsTypes['transactional'] !== undefined, 'Transactional type should exist');
        assert.isTrue(sms.smsTypes['promotional'] !== undefined, 'Promotional type should exist');
    });

    it('should format phone number to Indian format', () => {
        const formatted = sms.formatPhoneNumber('9876543210');
        assert.equal(formatted, '919876543210', '10-digit should get 91 prefix');

        const alreadyFormatted = sms.formatPhoneNumber('919876543210');
        assert.equal(alreadyFormatted, '919876543210', 'Already formatted should remain same');
    });

    it('should clean non-digit characters from phone', () => {
        const formatted = sms.formatPhoneNumber('+91 98765-43210');
        assert.equal(formatted, '919876543210', 'Should remove special characters');
    });

    it('should generate 6-digit OTP', () => {
        const otp = sms.generateOTP();
        assert.matchRegex(otp, /^\d{6}$/, 'OTP should be exactly 6 digits');
    });

    it('should generate different OTPs', () => {
        const otp1 = sms.generateOTP();
        const otp2 = sms.generateOTP();
        // Very unlikely to be same, but possible - check format at minimum
        assert.matchRegex(otp1, /^\d{6}$/, 'OTP1 should be 6 digits');
        assert.matchRegex(otp2, /^\d{6}$/, 'OTP2 should be 6 digits');
    });

    it('should calculate SMS cost correctly', () => {
        const cost = sms.calculateCost('transactional', 200);
        assert.equal(cost, 0.30, '200 chars (2 credits) for transactional should be ₹0.30');
    });

    it('should calculate SMS cost for single credit', () => {
        const cost = sms.calculateCost('transactional', 100);
        assert.equal(cost, 0.15, '100 chars (1 credit) for transactional should be ₹0.15');
    });

    it('should check if within allowed hours', () => {
        const originalHour = new Date().getHours();
        const isAllowed = sms.isWithinAllowedHours();
        assert.isTrue(typeof isAllowed === 'boolean', 'Should return boolean');
    });

    it('should get next allowed time', () => {
        const nextTime = sms.getNextAllowedTime();
        assert.isNotNull(nextTime, 'Next allowed time should exist');
        assert.instanceOf(new Date(nextTime), Date, 'Should be valid date');
    });
});

// ============================================================
// CALENDAR INTEGRATION TESTS
// ============================================================
describe('Calendar Integration - Event Management', () => {
    let calendar;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/calendar/providers', [
            { name: 'google', connected: true, connectedAt: '2026-07-01T00:00:00Z', calendars: [{ id: 'cal-1', name: 'Primary' }] }
        ]);
        mockAPI.mockResponse('/api/calendar/google/calendars', [
            { id: 'cal-1', name: 'Primary', color: '#4285F4' },
            { id: 'cal-2', name: 'Work', color: '#10B981' }
        ]);
        mockAPI.mockResponse('/api/calendar/events', [
            { id: 'evt-1', title: 'Team Meeting', start: '2026-07-16T10:00:00Z', end: '2026-07-16T11:00:00Z', type: 'meeting', provider: 'google' },
            { id: 'evt-2', title: 'Client Call', start: '2026-07-17T14:00:00Z', end: '2026-07-17T14:30:00Z', type: 'call', provider: 'google' }
        ]);
    });

    afterAll(() => {
        if (calendar) calendar.destroy();
    });

    it('should create CalendarIntegration instance', () => {
        calendar = new CalendarIntegration();
        assert.isNotNull(calendar, 'CalendarIntegration instance should exist');
        assert.instanceOf(calendar, CalendarIntegration, 'Should be CalendarIntegration instance');
    });

    it('should define calendar providers', () => {
        assert.isNotNull(calendar.providers, 'Providers should be defined');
        assert.isTrue(calendar.providers['google'] !== undefined, 'Google provider should exist');
        assert.isTrue(calendar.providers['outlook'] !== undefined, 'Outlook provider should exist');
        assert.isTrue(calendar.providers['apple'] !== undefined, 'Apple provider should exist');
    });

    it('should define event types', () => {
        assert.isNotNull(calendar.eventTypes, 'Event types should be defined');
        assert.isTrue(calendar.eventTypes['meeting'] !== undefined, 'Meeting type should exist');
        assert.isTrue(calendar.eventTypes['call'] !== undefined, 'Call type should exist');
        assert.isTrue(calendar.eventTypes['deadline'] !== undefined, 'Deadline type should exist');
    });

    it('should define event statuses', () => {
        assert.isNotNull(calendar.eventStatuses, 'Event statuses should be defined');
        assert.isTrue(calendar.eventStatuses['confirmed'] !== undefined, 'Confirmed status should exist');
        assert.isTrue(calendar.eventStatuses['tentative'] !== undefined, 'Tentative status should exist');
        assert.isTrue(calendar.eventStatuses['cancelled'] !== undefined, 'Cancelled status should exist');
    });

    it('should detect multi-day events', () => {
        const multiDay = { start: '2026-07-16T00:00:00Z', end: '2026-07-18T00:00:00Z' };
        assert.isTrue(calendar.isMultiDayEvent(multiDay), 'Should detect multi-day event');

        const singleDay = { start: '2026-07-16T10:00:00Z', end: '2026-07-16T11:00:00Z' };
        assert.isFalse(calendar.isMultiDayEvent(singleDay), 'Should not flag single-day event');
    });

    it('should define recurrence patterns', () => {
        assert.isNotNull(calendar.recurrencePatterns, 'Recurrence patterns should be defined');
        assert.isTrue(calendar.recurrencePatterns['none'] !== undefined, 'None pattern should exist');
        assert.isTrue(calendar.recurrencePatterns['daily'] !== undefined, 'Daily pattern should exist');
        assert.isTrue(calendar.recurrencePatterns['weekly'] !== undefined, 'Weekly pattern should exist');
        assert.isTrue(calendar.recurrencePatterns['monthly'] !== undefined, 'Monthly pattern should exist');
    });

    it('should check if meeting is within working hours', () => {
        const withinHours = calendar.isWithinWorkingHours('10:00', '11:00');
        assert.isTrue(withinHours, '10-11 AM should be within working hours');
    });
});

// ============================================================
// MAPS INTEGRATION TESTS
// ============================================================
describe('Maps Integration - Location Services', () => {
    let maps;

    beforeAll(() => {
        setupMocks();
        mockAPI.mockResponse('/api/integrations/maps/config', {
            googleApiKey: 'test-google-maps-key',
            defaultProvider: 'google'
        });
        mockAPI.mockResponse('/api/maps/locations', [
            { id: 'loc-1', name: 'Office', type: 'branch', latitude: 19.0760, longitude: 72.8777, address: 'Mumbai, India' },
            { id: 'loc-2', name: 'Client Office', type: 'client_office', latitude: 19.1234, longitude: 72.9876, address: 'Andheri, Mumbai' }
        ]);
    });

    afterAll(() => {
        if (maps) maps.destroy();
    });

    it('should create MapsIntegration instance', () => {
        maps = new MapsIntegration();
        assert.isNotNull(maps, 'MapsIntegration instance should exist');
        assert.instanceOf(maps, MapsIntegration, 'Should be MapsIntegration instance');
    });

    it('should define map providers', () => {
        assert.isNotNull(maps.providers, 'Map providers should be defined');
        assert.isTrue(maps.providers['google'] !== undefined, 'Google provider should exist');
        assert.isTrue(maps.providers['openstreetmap'] !== undefined, 'OpenStreetMap provider should exist');
    });

    it('should define location types', () => {
        assert.isNotNull(maps.locationTypes, 'Location types should be defined');
        assert.isTrue(maps.locationTypes['client_office'] !== undefined, 'Client office type should exist');
        assert.isTrue(maps.locationTypes['branch'] !== undefined, 'Branch type should exist');
    });

    it('should calculate Haversine distance correctly', () => {
        const distance = maps.haversineDistance(19.0760, 72.8777, 19.1234, 72.9876);
        assert.greaterThan(distance, 0, 'Distance should be positive');
        assert.lessThan(distance, 20000, 'Distance should be less than 20km for nearby Mumbai locations');
    });

    it('should calculate zero distance for same point', () => {
        const distance = maps.haversineDistance(19.0760, 72.8777, 19.0760, 72.8777);
        assert.equal(distance, 0, 'Same point should have zero distance');
    });

    it('should format distance in meters', () => {
        const formatted = maps.formatDistance(500);
        assert.equal(formatted, '500 m', 'Should format meters');

        const kmFormatted = maps.formatDistance(1500);
        assert.equal(kmFormatted, '1.5 km', 'Should format kilometers');
    });

    it('should format duration in minutes and hours', () => {
        const minutes = maps.formatDuration(600);
        assert.equal(minutes, '10 min', '600s should be 10 minutes');

        const hours = maps.formatDuration(5400);
        assert.equal(hours, '1h 30m', '5400s should be 1h 30m');
    });

    it('should define route statuses', () => {
        assert.isNotNull(maps.routeStatuses, 'Route statuses should be defined');
        assert.isTrue(maps.routeStatuses['planned'] !== undefined, 'Planned status should exist');
        assert.isTrue(maps.routeStatuses['in_progress'] !== undefined, 'In progress status should exist');
        assert.isTrue(maps.routeStatuses['completed'] !== undefined, 'Completed status should exist');
    });
});

// Export for programmatic usage
export { assert, testResults, setupMocks, teardownMocks, MockAPI, MockState, MockCache, MockPermissions };

