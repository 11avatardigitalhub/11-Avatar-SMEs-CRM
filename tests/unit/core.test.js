/**
 * 11 AVATAR DIGITAL HUB - Core Module Unit Tests
 * Enterprise-grade test suite for core system modules
 * Tests: EventBus, State, Cache, API, Router, App initialization
 * 
 * @test CoreModules
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../../src/js/core/eventBus.js';
import { State } from '../../src/js/core/state.js';
import { Cache } from '../../src/js/core/cache.js';
import { API } from '../../src/js/core/api.js';
import { Router } from '../../src/js/core/router.js';

/**
 * Test Suite Configuration
 * Using minimal test framework pattern for zero-dependency testing
 */
const TEST_CONFIG = {
    timeout: 5000,
    retryCount: 2,
    verbose: true,
    stopOnFailure: false
};

/**
 * Test runner utility class
 * Provides assertion methods and test organization
 */
class TestRunner {
    constructor() {
        this.suites = [];
        this.currentSuite = null;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: [],
            failures: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Create a test suite
     * @param {string} name - Suite name
     * @param {Function} fn - Suite function containing tests
     */
    describe(name, fn) {
        const suite = {
            name,
            tests: [],
            beforeAll: null,
            afterAll: null,
            beforeEach: null,
            afterEach: null
        };

        this.currentSuite = suite;
        this.suites.push(suite);

        if (fn && typeof fn === 'function') {
            fn.call(this);
        }

        this.currentSuite = null;
    }

    /**
     * Define a test case
     * @param {string} name - Test name
     * @param {Function} fn - Test function
     */
    it(name, fn) {
        if (this.currentSuite) {
            this.currentSuite.tests.push({ name, fn, skip: false });
        }
    }

    /**
     * Skip a test case
     * @param {string} name - Test name
     * @param {Function} fn - Test function
     */
    xit(name, fn) {
        if (this.currentSuite) {
            this.currentSuite.tests.push({ name, fn, skip: true });
        }
    }

    /**
     * Run before all tests in suite
     * @param {Function} fn - Setup function
     */
    beforeAll(fn) {
        if (this.currentSuite) {
            this.currentSuite.beforeAll = fn;
        }
    }

    /**
     * Run after all tests in suite
     * @param {Function} fn - Teardown function
     */
    afterAll(fn) {
        if (this.currentSuite) {
            this.currentSuite.afterAll = fn;
        }
    }

    /**
     * Run before each test in suite
     * @param {Function} fn - Setup function
     */
    beforeEach(fn) {
        if (this.currentSuite) {
            this.currentSuite.beforeEach = fn;
        }
    }

    /**
     * Run after each test in suite
     * @param {Function} fn - Teardown function
     */
    afterEach(fn) {
        if (this.currentSuite) {
            this.currentSuite.afterEach = fn;
        }
    }

    /**
     * Run all test suites
     * @async
     * @returns {Object} Test results
     */
    async run() {
        this.results.startTime = Date.now();
        console.log('═══════════════════════════════════════════');
        console.log('  11 AVATAR DIGITAL HUB - Core Tests');
        console.log('═══════════════════════════════════════════\n');

        for (const suite of this.suites) {
            console.log(`\n📁 Suite: ${suite.name}`);
            console.log('───────────────────────────────────────────');

            // Run beforeAll
            if (suite.beforeAll) {
                try {
                    await suite.beforeAll();
                } catch (error) {
                    console.error(`  ❌ beforeAll failed: ${error.message}`);
                    continue;
                }
            }

            let suitePassed = 0;
            let suiteFailed = 0;
            let suiteSkipped = 0;

            for (const test of suite.tests) {
                if (test.skip) {
                    console.log(`  ⏭️  SKIP: ${test.name}`);
                    this.results.skipped++;
                    suiteSkipped++;
                    continue;
                }

                this.results.total++;

                // Run beforeEach
                if (suite.beforeEach) {
                    try {
                        await suite.beforeEach();
                    } catch (error) {
                        console.error(`  ❌ beforeEach failed: ${error.message}`);
                    }
                }

                try {
                    const startTime = performance.now();
                    await test.fn();
                    const duration = performance.now() - startTime;

                    console.log(`  ✅ PASS: ${test.name} (${duration.toFixed(2)}ms)`);
                    this.results.passed++;
                    suitePassed++;
                } catch (error) {
                    console.log(`  ❌ FAIL: ${test.name}`);
                    console.log(`     Error: ${error.message}`);
                    console.log(`     Stack: ${error.stack?.split('\n')[1]?.trim()}`);
                    
                    this.results.failed++;
                    this.results.failures.push({
                        suite: suite.name,
                        test: test.name,
                        error: error.message,
                        stack: error.stack
                    });
                    suiteFailed++;

                    if (TEST_CONFIG.stopOnFailure) {
                        break;
                    }
                }

                // Run afterEach
                if (suite.afterEach) {
                    try {
                        await suite.afterEach();
                    } catch (error) {
                        console.error(`  ❌ afterEach failed: ${error.message}`);
                    }
                }
            }

            const suiteResult = {
                name: suite.name,
                passed: suitePassed,
                failed: suiteFailed,
                skipped: suiteSkipped,
                total: suitePassed + suiteFailed + suiteSkipped
            };
            this.results.suites.push(suiteResult);

            console.log(`  📊 ${suitePassed} passed, ${suiteFailed} failed, ${suiteSkipped} skipped`);

            // Run afterAll
            if (suite.afterAll) {
                try {
                    await suite.afterAll();
                } catch (error) {
                    console.error(`  ❌ afterAll failed: ${error.message}`);
                }
            }
        }

        this.results.endTime = Date.now();
        this.printSummary();
        
        return this.results;
    }

    /**
     * Print test summary to console
     */
    printSummary() {
        const duration = this.results.endTime - this.results.startTime;

        console.log('\n═══════════════════════════════════════════');
        console.log('  TEST SUMMARY');
        console.log('═══════════════════════════════════════════');
        console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`  Total:   ${this.results.total}`);
        console.log(`  Passed:  ${this.results.passed} ✅`);
        console.log(`  Failed:  ${this.results.failed} ❌`);
        console.log(`  Skipped: ${this.results.skipped} ⏭️`);
        console.log('═══════════════════════════════════════════\n');

        if (this.results.failures.length > 0) {
            console.log('  FAILURES:');
            this.results.failures.forEach((failure, index) => {
                console.log(`  ${index + 1}. [${failure.suite}] ${failure.test}`);
                console.log(`     ${failure.error}`);
            });
            console.log('');
        }
    }
}

/**
 * Assertion utilities
 * Provides common assertion methods for test validation
 */
const assert = {
    /**
     * Assert that a value is truthy
     * @param {*} value - Value to check
     * @param {string} [message] - Error message
     */
    ok(value, message = 'Expected truthy value') {
        if (!value) {
            throw new Error(message);
        }
    },

    /**
     * Assert strict equality
     * @param {*} actual - Actual value
     * @param {*} expected - Expected value
     * @param {string} [message] - Error message
     */
    equal(actual, expected, message = 'Values should be equal') {
        if (actual !== expected) {
            throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },

    /**
     * Assert deep equality
     * @param {*} actual - Actual value
     * @param {*} expected - Expected value
     * @param {string} [message] - Error message
     */
    deepEqual(actual, expected, message = 'Values should be deeply equal') {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(`${message}: expected ${expectedStr}, got ${actualStr}`);
        }
    },

    /**
     * Assert that a value is null
     * @param {*} value - Value to check
     * @param {string} [message] - Error message
     */
    isNull(value, message = 'Expected null value') {
        if (value !== null && value !== undefined) {
            throw new Error(`${message}: expected null, got ${JSON.stringify(value)}`);
        }
    },

    /**
     * Assert that a value is not null
     * @param {*} value - Value to check
     * @param {string} [message] - Error message
     */
    isNotNull(value, message = 'Expected non-null value') {
        if (value === null || value === undefined) {
            throw new Error(message);
        }
    },

    /**
     * Assert that a function throws an error
     * @param {Function} fn - Function to call
     * @param {string} [message] - Error message
     */
    throws(fn, message = 'Expected function to throw') {
        let threw = false;
        try {
            fn();
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    },

    /**
     * Assert that a function does not throw
     * @param {Function} fn - Function to call
     * @param {string} [message] - Error message
     */
    doesNotThrow(fn, message = 'Expected function not to throw') {
        try {
            fn();
        } catch (error) {
            throw new Error(`${message}: ${error.message}`);
        }
    },

    /**
     * Assert that a value is greater than another
     * @param {number} actual - Actual value
     * @param {number} expected - Expected minimum
     * @param {string} [message] - Error message
     */
    greaterThan(actual, expected, message = 'Expected greater value') {
        if (actual <= expected) {
            throw new Error(`${message}: expected > ${expected}, got ${actual}`);
        }
    },

    /**
     * Assert that a value is an instance of a class
     * @param {*} value - Value to check
     * @param {Function} constructor - Constructor function
     * @param {string} [message] - Error message
     */
    instanceOf(value, constructor, message = 'Expected correct instance') {
        if (!(value instanceof constructor)) {
            throw new Error(`${message}: expected instance of ${constructor.name}`);
        }
    },

    /**
     * Assert that a string contains a substring
     * @param {string} str - String to search in
     * @param {string} substring - Substring to find
     * @param {string} [message] - Error message
     */
    contains(str, substring, message = 'Expected string to contain substring') {
        if (!str.includes(substring)) {
            throw new Error(`${message}: "${str}" does not contain "${substring}"`);
        }
    },

    /**
     * Assert that an array has a specific length
     * @param {Array} arr - Array to check
     * @param {number} length - Expected length
     * @param {string} [message] - Error message
     */
    lengthOf(arr, length, message = 'Expected array length') {
        if (!Array.isArray(arr)) {
            throw new Error(`${message}: value is not an array`);
        }
        if (arr.length !== length) {
            throw new Error(`${message}: expected length ${length}, got ${arr.length}`);
        }
    }
};

// ============================================================
// TEST SUITES
// ============================================================

const runner = new TestRunner();

// ============================================================
// EventBus Tests
// ============================================================
runner.describe('EventBus - Event Management System', () => {
    let eventBus;

    runner.beforeEach(() => {
        eventBus = new EventBus();
    });

    runner.afterEach(() => {
        eventBus.destroy();
    });

    runner.it('should create EventBus instance', () => {
        assert.isNotNull(eventBus, 'EventBus instance should exist');
        assert.instanceOf(eventBus, EventBus, 'Should be EventBus instance');
    });

    runner.it('should register event listener', () => {
        let called = false;
        const unsubscribe = eventBus.on('test:event', () => {
            called = true;
        });

        assert.isNotNull(unsubscribe, 'Should return unsubscribe function');
        assert.equal(typeof unsubscribe, 'function', 'Should return function');
    });

    runner.it('should emit event and call listener', () => {
        let receivedData = null;

        eventBus.on('test:emit', (data) => {
            receivedData = data;
        });

        eventBus.emit('test:emit', { message: 'hello' });

        assert.isNotNull(receivedData, 'Listener should have been called');
        assert.equal(receivedData.message, 'hello', 'Should receive correct data');
    });

    runner.it('should call multiple listeners for same event', () => {
        let count = 0;

        eventBus.on('test:multi', () => { count++; });
        eventBus.on('test:multi', () => { count++; });
        eventBus.on('test:multi', () => { count++; });

        eventBus.emit('test:multi');

        assert.equal(count, 3, 'All three listeners should be called');
    });

    runner.it('should pass correct data to listeners', () => {
        let capturedData = null;

        eventBus.on('test:data', (data) => {
            capturedData = data;
        });

        const testData = { id: 123, name: 'Test', nested: { value: true } };
        eventBus.emit('test:data', testData);

        assert.deepEqual(capturedData, testData, 'Should receive exact same data');
    });

    runner.it('should unsubscribe listener correctly', () => {
        let count = 0;

        const unsubscribe = eventBus.on('test:unsub', () => {
            count++;
        });

        eventBus.emit('test:unsub');
        assert.equal(count, 1, 'Should be called first time');

        unsubscribe();
        eventBus.emit('test:unsub');
        assert.equal(count, 1, 'Should not be called after unsubscribe');
    });

    runner.it('should not throw when emitting event with no listeners', () => {
        assert.doesNotThrow(() => {
            eventBus.emit('test:no-listeners', { data: true });
        }, 'Should not throw for events with no listeners');
    });

    runner.it('should handle errors in listeners gracefully', () => {
        let secondCalled = false;

        eventBus.on('test:error', () => {
            throw new Error('Listener error');
        });

        eventBus.on('test:error', () => {
            secondCalled = true;
        });

        // Should not throw even though first listener throws
        assert.doesNotThrow(() => {
            eventBus.emit('test:error');
        }, 'Should handle listener errors gracefully');

        assert.ok(secondCalled, 'Second listener should still be called after first fails');
    });

    runner.it('should support event namespacing with wildcards', () => {
        let wildcardCalled = false;
        let specificCalled = false;

        eventBus.on('module:*', () => {
            wildcardCalled = true;
        });

        eventBus.on('module:specific', () => {
            specificCalled = true;
        });

        eventBus.emit('module:specific');

        assert.ok(wildcardCalled, 'Wildcard listener should be called');
        assert.ok(specificCalled, 'Specific listener should be called');
    });

    runner.it('should support one-time listeners with once', () => {
        let count = 0;

        eventBus.once('test:once', () => {
            count++;
        });

        eventBus.emit('test:once');
        eventBus.emit('test:once');
        eventBus.emit('test:once');

        assert.equal(count, 1, 'Once listener should only fire one time');
    });

    runner.it('should remove all listeners for an event with off', () => {
        let count = 0;

        eventBus.on('test:off', () => { count++; });
        eventBus.on('test:off', () => { count++; });

        eventBus.emit('test:off');
        assert.equal(count, 2, 'Both listeners should fire');

        eventBus.off('test:off');
        eventBus.emit('test:off');
        assert.equal(count, 2, 'No listeners should fire after off');
    });

    runner.it('should track listener count', () => {
        assert.equal(eventBus.listenerCount('test:count'), 0, 'Should start with 0 listeners');

        eventBus.on('test:count', () => {});
        assert.equal(eventBus.listenerCount('test:count'), 1, 'Should have 1 listener');

        eventBus.on('test:count', () => {});
        assert.equal(eventBus.listenerCount('test:count'), 2, 'Should have 2 listeners');

        eventBus.off('test:count');
        assert.equal(eventBus.listenerCount('test:count'), 0, 'Should have 0 after off');
    });

    runner.it('should clear all listeners on destroy', () => {
        eventBus.on('test:a', () => {});
        eventBus.on('test:b', () => {});
        eventBus.on('test:c', () => {});

        eventBus.destroy();

        assert.equal(eventBus.listenerCount('test:a'), 0, 'All listeners should be cleared');
        assert.equal(eventBus.listenerCount('test:b'), 0, 'All listeners should be cleared');
        assert.equal(eventBus.listenerCount('test:c'), 0, 'All listeners should be cleared');
    });

    runner.it('should emit event history for debugging', () => {
        eventBus.on('test:history', () => {});

        eventBus.emit('test:history', { step: 1 });
        eventBus.emit('test:history', { step: 2 });
        eventBus.emit('test:history', { step: 3 });

        const history = eventBus.getHistory();
        assert.ok(Array.isArray(history), 'History should be an array');
        assert.greaterThan(history.length, 0, 'History should have entries');
    });
});

// ============================================================
// State Management Tests
// ============================================================
runner.describe('State - Application State Management', () => {
    let state;

    runner.beforeEach(() => {
        state = new State();
    });

    runner.afterEach(() => {
        state.destroy();
    });

    runner.it('should create State instance', () => {
        assert.isNotNull(state, 'State instance should exist');
        assert.instanceOf(state, State, 'Should be State instance');
    });

    runner.it('should set and get state values', () => {
        state.set('user', { id: 1, name: 'John' });

        const user = state.get('user');
        assert.isNotNull(user, 'User should exist');
        assert.equal(user.id, 1, 'User ID should match');
        assert.equal(user.name, 'John', 'User name should match');
    });

    runner.it('should return default value for non-existent key', () => {
        const value = state.get('nonexistent', 'default');
        assert.equal(value, 'default', 'Should return default value');
    });

    runner.it('should check if key exists', () => {
        state.set('exists', true);
        assert.ok(state.has('exists'), 'Should return true for existing key');
        assert.ok(!state.has('nonexistent'), 'Should return false for non-existent key');
    });

    runner.it('should delete state keys', () => {
        state.set('temp', 'value');
        assert.ok(state.has('temp'), 'Key should exist before delete');

        state.delete('temp');
        assert.ok(!state.has('temp'), 'Key should not exist after delete');
    });

    runner.it('should clear all state', () => {
        state.set('a', 1);
        state.set('b', 2);
        state.set('c', 3);

        state.clear();

        assert.ok(!state.has('a'), 'All keys should be cleared');
        assert.ok(!state.has('b'), 'All keys should be cleared');
        assert.ok(!state.has('c'), 'All keys should be cleared');
    });

    runner.it('should subscribe to state changes', () => {
        let changedKey = null;
        let changedValue = null;

        state.subscribe((key, value) => {
            changedKey = key;
            changedValue = value;
        });

        state.set('test', 'new-value');

        assert.equal(changedKey, 'test', 'Should receive correct key');
        assert.equal(changedValue, 'new-value', 'Should receive correct value');
    });

    runner.it('should unsubscribe from state changes', () => {
        let callCount = 0;

        const unsubscribe = state.subscribe(() => {
            callCount++;
        });

        state.set('first', 1);
        assert.equal(callCount, 1, 'Should be called first time');

        unsubscribe();
        state.set('second', 2);
        assert.equal(callCount, 1, 'Should not be called after unsubscribe');
    });

    runner.it('should get entire state snapshot', () => {
        state.set('x', 10);
        state.set('y', 20);

        const snapshot = state.getSnapshot();
        assert.equal(snapshot.x, 10, 'Snapshot should contain x');
        assert.equal(snapshot.y, 20, 'Snapshot should contain y');
    });

    runner.it('should handle nested state paths', () => {
        state.set('user.profile.name', 'Alice');
        state.set('user.profile.age', 30);

        assert.equal(state.get('user.profile.name'), 'Alice', 'Nested get should work');
        assert.equal(state.get('user.profile.age'), 30, 'Nested get should work');

        const user = state.get('user');
        assert.equal(user.profile.name, 'Alice', 'Parent object should be accessible');
    });

    runner.it('should persist state to localStorage', () => {
        state.set('persistKey', 'persistValue');
        state.persist('persistKey');

        const newState = new State();
        newState.hydrate();

        assert.equal(newState.get('persistKey'), 'persistValue', 'State should persist across instances');
        newState.destroy();
    });

    runner.it('should batch multiple state updates', () => {
        let changeCount = 0;

        state.subscribe(() => {
            changeCount++;
        });

        state.batch(() => {
            state.set('batch1', 1);
            state.set('batch2', 2);
            state.set('batch3', 3);
        });

        assert.equal(changeCount, 1, 'Batch updates should trigger only one notification');
    });
});

// ============================================================
// Cache Tests
// ============================================================
runner.describe('Cache - Data Caching System', () => {
    let cache;

    runner.beforeEach(() => {
        cache = new Cache();
    });

    runner.afterEach(() => {
        cache.clear();
    });

    runner.it('should create Cache instance', () => {
        assert.isNotNull(cache, 'Cache instance should exist');
        assert.instanceOf(cache, Cache, 'Should be Cache instance');
    });

    runner.it('should set and get cache values', async () => {
        await cache.set('test-key', { data: 'cached-value' });

        const cached = await cache.get('test-key');
        assert.isNotNull(cached, 'Cached data should exist');
        assert.equal(cached.data, 'cached-value', 'Cached value should match');
    });

    runner.it('should return null for non-existent key', async () => {
        const value = await cache.get('nonexistent-key');
        assert.isNull(value, 'Should return null for missing key');
    });

    runner.it('should respect cache timeout', async () => {
        await cache.set('expiring-key', { data: 'temp' }, 50);

        const immediate = await cache.get('expiring-key');
        assert.isNotNull(immediate, 'Should exist before expiry');

        await new Promise(resolve => setTimeout(resolve, 60));

        const expired = await cache.get('expiring-key');
        assert.isNull(expired, 'Should be null after expiry');
    });

    runner.it('should delete cache entries', async () => {
        await cache.set('deletable', { data: true });
        
        const before = await cache.get('deletable');
        assert.isNotNull(before, 'Should exist before delete');

        await cache.delete('deletable');

        const after = await cache.get('deletable');
        assert.isNull(after, 'Should not exist after delete');
    });

    runner.it('should clear all cache entries', async () => {
        await cache.set('a', 1);
        await cache.set('b', 2);
        await cache.set('c', 3);

        await cache.clear();

        assert.isNull(await cache.get('a'), 'All entries should be cleared');
        assert.isNull(await cache.get('b'), 'All entries should be cleared');
        assert.isNull(await cache.get('c'), 'All entries should be cleared');
    });

    runner.it('should check if key exists', async () => {
        await cache.set('exists-check', true);
        
        const hasKey = await cache.has('exists-check');
        assert.ok(hasKey, 'Should return true for existing key');

        const noKey = await cache.has('no-key');
        assert.ok(!noKey, 'Should return false for missing key');
    });

    runner.it('should return cache size', async () => {
        await cache.set('size1', 1);
        await cache.set('size2', 2);
        await cache.set('size3', 3);

        const size = await cache.size();
        assert.equal(size, 3, 'Cache size should be 3');
    });

    runner.it('should generate unique cache keys', () => {
        const key1 = cache.generateKey('prefix');
        const key2 = cache.generateKey('prefix');

        assert.ok(key1 !== key2, 'Generated keys should be unique');
        assert.ok(key1.startsWith('prefix_'), 'Key should start with prefix');
    });
});

// ============================================================
// API Tests
// ============================================================
runner.describe('API - HTTP Client', () => {
    let api;

    runner.beforeEach(() => {
        api = new API('https://test-api.example.com');
    });

    runner.afterEach(() => {
        api.destroy();
    });

    runner.it('should create API instance', () => {
        assert.isNotNull(api, 'API instance should exist');
        assert.instanceOf(api, API, 'Should be API instance');
    });

    runner.it('should set base URL correctly', () => {
        assert.equal(api.baseURL, 'https://test-api.example.com', 'Base URL should be set');
    });

    runner.it('should set default headers', () => {
        api.setHeader('Authorization', 'Bearer test-token');
        assert.equal(api.headers['Authorization'], 'Bearer test-token', 'Header should be set');
    });

    runner.it('should remove headers', () => {
        api.setHeader('X-Custom', 'value');
        api.removeHeader('X-Custom');
        assert.isNull(api.headers['X-Custom'] || null, 'Header should be removed');
    });

    runner.it('should build query string correctly', () => {
        const params = { page: 1, limit: 20, search: 'test query' };
        const queryString = api.buildQueryString(params);
        
        assert.contains(queryString, 'page=1', 'Should contain page parameter');
        assert.contains(queryString, 'limit=20', 'Should contain limit parameter');
        assert.contains(queryString, 'search=test%20query', 'Should encode search parameter');
    });

    runner.it('should build full URL with parameters', () => {
        const url = api.buildURL('/api/clients', { status: 'active', page: 1 });
        assert.contains(url, '/api/clients', 'Should contain endpoint path');
        assert.contains(url, 'status=active', 'Should contain status parameter');
        assert.contains(url, 'page=1', 'Should contain page parameter');
    });

    runner.it('should create AbortController for requests', () => {
        const controller = api.createAbortController();
        assert.isNotNull(controller, 'Should create AbortController');
        assert.instanceOf(controller.signal, AbortSignal, 'Should have AbortSignal');
    });

    runner.it('should handle request timeouts', async () => {
        api.setTimeout(100);
        
        try {
            await api.get('/slow-endpoint');
            assert.ok(false, 'Should have thrown timeout error');
        } catch (error) {
            assert.contains(error.message, 'timeout', 'Error should mention timeout');
        }
    });
});

// ============================================================
// Router Tests
// ============================================================
runner.describe('Router - SPA Navigation', () => {
    let router;

    runner.beforeEach(() => {
        router = new Router();
    });

    runner.afterEach(() => {
        router.destroy();
    });

    runner.it('should create Router instance', () => {
        assert.isNotNull(router, 'Router instance should exist');
        assert.instanceOf(router, Router, 'Should be Router instance');
    });

    runner.it('should register routes', () => {
        router.addRoute('/dashboard', () => {});
        router.addRoute('/clients', () => {});
        router.addRoute('/settings', () => {});

        const routes = router.getRoutes();
        assert.lengthOf(routes, 3, 'Should have 3 routes registered');
    });

    runner.it('should match exact routes', () => {
        let matched = false;
        router.addRoute('/exact-path', () => { matched = true; });
        router.navigate('/exact-path');

        assert.ok(matched, 'Exact route should match');
    });

    runner.it('should match parameterized routes', () => {
        let params = null;
        router.addRoute('/clients/:id', (routeParams) => {
            params = routeParams;
        });
        router.navigate('/clients/123');

        assert.isNotNull(params, 'Params should be captured');
        assert.equal(params.id, '123', 'Route param should match');
    });

    runner.it('should handle 404 for unknown routes', () => {
        let notFoundCalled = false;
        router.setNotFoundHandler(() => {
            notFoundCalled = true;
        });
        router.navigate('/non-existent-path');

        assert.ok(notFoundCalled, '404 handler should be called');
    });

    runner.it('should support route guards', () => {
        let guardCalled = false;
        let routeCalled = false;

        router.addRoute('/protected', () => { routeCalled = true; }, {
            guard: () => {
                guardCalled = true;
                return false;
            }
        });

        router.navigate('/protected');

        assert.ok(guardCalled, 'Guard should be called');
        assert.ok(!routeCalled, 'Route should not be called when guard returns false');
    });

    runner.it('should track navigation history', () => {
        router.addRoute('/page1', () => {});
        router.addRoute('/page2', () => {});
        router.addRoute('/page3', () => {});

        router.navigate('/page1');
        router.navigate('/page2');
        router.navigate('/page3');

        const history = router.getHistory();
        assert.lengthOf(history, 3, 'Should track 3 navigations');
    });

    runner.it('should support query parameters', () => {
        let capturedQuery = null;
        router.addRoute('/search', (params, query) => {
            capturedQuery = query;
        });
        router.navigate('/search?q=test&page=1&sort=name');

        assert.isNotNull(capturedQuery, 'Query params should be captured');
        assert.equal(capturedQuery.q, 'test', 'Query param q should match');
        assert.equal(capturedQuery.page, '1', 'Query param page should match');
        assert.equal(capturedQuery.sort, 'name', 'Query param sort should match');
    });
});

// ============================================================
// RUN ALL TESTS
// ============================================================

/**
 * Execute all test suites and output results
 * Handles both browser and Node.js environments
 */
async function runAllTests() {
    try {
        console.log('Starting 11 Avatar Digital Hub Core Tests...\n');

        const results = await runner.run();

        // Export results for CI/CD integration
        if (typeof window !== 'undefined') {
            window.__TEST_RESULTS__ = results;
        }

        // Exit with appropriate code for CI/CD
        if (typeof process !== 'undefined' && process.exit) {
            process.exit(results.failed > 0 ? 1 : 0);
        }

        return results;
    } catch (error) {
        console.error('Test runner failed:', error);
        
        if (typeof process !== 'undefined' && process.exit) {
            process.exit(1);
        }
    }
}

// Auto-run tests when imported
if (typeof window !== 'undefined') {
    // Browser environment - run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAllTests);
    } else {
        runAllTests();
    }
} else if (typeof process !== 'undefined') {
    // Node.js environment - run immediately
    runAllTests();
}

// Export for programmatic usage
export { runner, assert, runAllTests, TestRunner };
export default runner;
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
