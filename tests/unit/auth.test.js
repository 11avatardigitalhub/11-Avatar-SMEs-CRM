/**
 * 11 AVATAR DIGITAL HUB - Auth Module Unit Tests
 * Enterprise-grade test suite for authentication & authorization
 * Tests: Auth, Login, Register, Permissions, Roles, Session, Middleware
 * 
 * @test AuthModules
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { Auth } from '../../src/js/auth/auth.js';
import { Login } from '../../src/js/auth/login.js';
import { Register } from '../../src/js/auth/register.js';
import { Permissions } from '../../src/js/auth/permissions.js';
import { Roles } from '../../src/js/auth/roles.js';
import { Session } from '../../src/js/auth/session.js';
import { Middleware } from '../../src/js/auth/middleware.js';
import { EventBus } from '../../src/js/core/eventBus.js';

/**
 * Test assertion utilities - consistent across all test files
 */
const assert = {
    ok(value, message = 'Expected truthy value') {
        if (!value) throw new Error(message);
    },
    equal(actual, expected, message = 'Values should be equal') {
        if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    notEqual(actual, expected, message = 'Values should not be equal') {
        if (actual === expected) throw new Error(`${message}: values should differ`);
    },
    deepEqual(actual, expected, message = 'Values should be deeply equal') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    isNull(value, message = 'Expected null value') {
        if (value !== null && value !== undefined) throw new Error(`${message}: expected null, got ${JSON.stringify(value)}`);
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
        if (!(value instanceof constructor)) throw new Error(`${message}: expected instance of ${constructor.name}`);
    },
    contains(str, substring, message = 'Expected string to contain substring') {
        if (!str.includes(substring)) throw new Error(`${message}: "${str}" does not contain "${substring}"`);
    },
    lengthOf(arr, length, message = 'Expected array length') {
        if (!Array.isArray(arr)) throw new Error(`${message}: value is not an array`);
        if (arr.length !== length) throw new Error(`${message}: expected length ${length}, got ${arr.length}`);
    },
    isTrue(value, message = 'Expected true') {
        if (value !== true) throw new Error(message);
    },
    isFalse(value, message = 'Expected false') {
        if (value !== false) throw new Error(message);
    }
};

/**
 * Mock Firebase Auth for testing
 * Simulates Firebase authentication without actual Firebase dependency
 */
class MockFirebaseAuth {
    constructor() {
        this.currentUser = null;
        this.authStateListeners = [];
        this.signInResults = [];
        this.signOutCalls = 0;
    }

    signInWithEmailAndPassword(email, password) {
        if (email === 'test@example.com' && password === 'Password123!') {
            const user = this.createMockUser(email);
            this.currentUser = user;
            this.notifyListeners(user);
            return Promise.resolve({ user });
        }
        return Promise.reject(new Error('auth/invalid-credential'));
    }

    createUserWithEmailAndPassword(email, password) {
        if (password.length < 8) {
            return Promise.reject(new Error('auth/weak-password'));
        }
        const user = this.createMockUser(email);
        this.currentUser = user;
        this.notifyListeners(user);
        return Promise.resolve({ user });
    }

    signInWithPopup() {
        const user = this.createMockUser('google@example.com');
        this.currentUser = user;
        this.notifyListeners(user);
        return Promise.resolve({ user });
    }

    signOut() {
        this.signOutCalls++;
        this.currentUser = null;
        this.notifyListeners(null);
        return Promise.resolve();
    }

    sendPasswordResetEmail(email) {
        if (email === 'test@example.com') {
            return Promise.resolve();
        }
        return Promise.reject(new Error('auth/user-not-found'));
    }

    onAuthStateChanged(callback) {
        this.authStateListeners.push(callback);
        return () => {
            this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
        };
    }

    createMockUser(email) {
        return {
            uid: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            email: email,
            displayName: email.split('@')[0],
            emailVerified: true,
            getIdToken: () => Promise.resolve(`mock-token-${Date.now()}`),
            getIdTokenResult: () => Promise.resolve({
                claims: { role: 'admin', organizationId: 'org-123' }
            }),
            delete: () => Promise.resolve(),
            updateProfile: () => Promise.resolve(),
            updateEmail: () => Promise.resolve(),
            updatePassword: () => Promise.resolve()
        };
    }

    notifyListeners(user) {
        this.authStateListeners.forEach(cb => cb(user));
    }
}

// ============================================================
// TEST SUITE SETUP
// ============================================================

let mockAuth;
let authInstance;
let loginInstance;
let registerInstance;
let permissionsInstance;
let rolesInstance;
let sessionInstance;
let middlewareInstance;
let eventBus;

const testResults = {
    total: 0, passed: 0, failed: 0, skipped: 0,
    suites: [], failures: [], startTime: null, endTime: null
};

function describe(name, fn) {
    console.log(`\n📁 Suite: ${name}`);
    console.log('───────────────────────────────────────────');
    
    const suiteResult = { name, passed: 0, failed: 0, skipped: 0 };
    let suitePassed = 0;
    let suiteFailed = 0;
    let suiteSkipped = 0;

    const suiteContext = {
        beforeAll: null, afterAll: null,
        beforeEach: null, afterEach: null,
        tests: []
    };

    const api = {
        beforeAll(cb) { suiteContext.beforeAll = cb; },
        afterAll(cb) { suiteContext.afterAll = cb; },
        beforeEach(cb) { suiteContext.beforeEach = cb; },
        afterEach(cb) { suiteContext.afterEach = cb; },
        it(name, testFn) { suiteContext.tests.push({ name, fn: testFn, skip: false }); },
        xit(name, testFn) { suiteContext.tests.push({ name, fn: testFn, skip: true }); }
    };

    fn.call(api);

    // Run the suite
    (async () => {
        if (suiteContext.beforeAll) {
            try { await suiteContext.beforeAll(); } catch (e) { console.error(`  ❌ beforeAll: ${e.message}`); return; }
        }

        for (const test of suiteContext.tests) {
            if (test.skip) {
                console.log(`  ⏭️  SKIP: ${test.name}`);
                testResults.skipped++; suiteSkipped++;
                continue;
            }
            testResults.total++;

            if (suiteContext.beforeEach) {
                try { await suiteContext.beforeEach(); } catch (e) { console.error(`  ❌ beforeEach: ${e.message}`); }
            }

            try {
                const start = performance.now();
                await test.fn();
                const duration = performance.now() - start;
                console.log(`  ✅ PASS: ${test.name} (${duration.toFixed(2)}ms)`);
                testResults.passed++; suitePassed++;
            } catch (error) {
                console.log(`  ❌ FAIL: ${test.name}`);
                console.log(`     Error: ${error.message}`);
                testResults.failed++; suiteFailed++;
                testResults.failures.push({ suite: name, test: test.name, error: error.message });
            }

            if (suiteContext.afterEach) {
                try { await suiteContext.afterEach(); } catch (e) { console.error(`  ❌ afterEach: ${e.message}`); }
            }
        }

        if (suiteContext.afterAll) {
            try { await suiteContext.afterAll(); } catch (e) { console.error(`  ❌ afterAll: ${e.message}`); }
        }

        suiteResult.passed = suitePassed;
        suiteResult.failed = suiteFailed;
        suiteResult.skipped = suiteSkipped;
        testResults.suites.push(suiteResult);
        console.log(`  📊 ${suitePassed} passed, ${suiteFailed} failed, ${suiteSkipped} skipped`);
    })();
}

// ============================================================
// AUTH MODULE TESTS
// ============================================================
describe('Auth - Authentication Manager', () => {
    beforeAll(() => {
        mockAuth = new MockFirebaseAuth();
        eventBus = new EventBus();
        authInstance = new Auth(mockAuth, eventBus);
    });

    afterAll(() => {
        authInstance.destroy();
        eventBus.destroy();
    });

    beforeEach(() => {
        mockAuth.currentUser = null;
    });

    it('should create Auth instance successfully', () => {
        assert.isNotNull(authInstance, 'Auth instance should exist');
        assert.instanceOf(authInstance, Auth, 'Should be Auth instance');
    });

    it('should return null when no user is signed in', () => {
        const user = authInstance.getCurrentUser();
        assert.isNull(user, 'Should return null when not authenticated');
    });

    it('should sign in with valid email and password', async () => {
        const result = await authInstance.signInWithEmail('test@example.com', 'Password123!');
        assert.isNotNull(result, 'Sign in result should exist');
        assert.isNotNull(result.user, 'User should be returned');
        assert.equal(result.user.email, 'test@example.com', 'Email should match');
    });

    it('should reject sign in with invalid credentials', async () => {
        try {
            await authInstance.signInWithEmail('wrong@example.com', 'WrongPassword1!');
            assert.ok(false, 'Should have thrown error');
        } catch (error) {
            assert.contains(error.message, 'invalid-credential', 'Should be invalid credential error');
        }
    });

    it('should create new user account', async () => {
        const result = await authInstance.createAccount('newuser@example.com', 'SecurePass123!');
        assert.isNotNull(result, 'Registration result should exist');
        assert.isNotNull(result.user, 'User should be returned');
        assert.equal(result.user.email, 'newuser@example.com', 'Email should match');
    });

    it('should reject weak passwords during registration', async () => {
        try {
            await authInstance.createAccount('user@example.com', '123');
            assert.ok(false, 'Should have thrown error');
        } catch (error) {
            assert.contains(error.message, 'weak-password', 'Should be weak password error');
        }
    });

    it('should sign out successfully', async () => {
        await authInstance.signInWithEmail('test@example.com', 'Password123!');
        assert.isNotNull(authInstance.getCurrentUser(), 'Should be signed in');

        await authInstance.signOut();
        assert.isNull(authInstance.getCurrentUser(), 'Should be signed out');
    });

    it('should send password reset email for valid user', async () => {
        try {
            await authInstance.sendPasswordReset('test@example.com');
            assert.ok(true, 'Should send reset email successfully');
        } catch (error) {
            assert.ok(false, 'Should not throw for valid email');
        }
    });

    it('should reject password reset for unknown user', async () => {
        try {
            await authInstance.sendPasswordReset('unknown@example.com');
            assert.ok(false, 'Should have thrown error');
        } catch (error) {
            assert.contains(error.message, 'user-not-found', 'Should be user not found error');
        }
    });

    it('should get Firebase ID token for authenticated user', async () => {
        await authInstance.signInWithEmail('test@example.com', 'Password123!');
        const token = await authInstance.getIdToken();
        assert.isNotNull(token, 'Token should be returned');
        assert.contains(token, 'mock-token-', 'Token should have correct format');
    });

    it('should check if user is authenticated', () => {
        assert.isFalse(authInstance.isAuthenticated(), 'Should not be authenticated initially');
        mockAuth.currentUser = mockAuth.createMockUser('test@example.com');
        assert.isTrue(authInstance.isAuthenticated(), 'Should be authenticated with user');
    });
});

// ============================================================
// LOGIN MODULE TESTS
// ============================================================
describe('Login - Login Controller', () => {
    beforeAll(() => {
        mockAuth = new MockFirebaseAuth();
        eventBus = new EventBus();
        loginInstance = new Login(mockAuth, eventBus);
    });

    afterAll(() => {
        loginInstance.destroy();
        eventBus.destroy();
    });

    it('should create Login instance', () => {
        assert.isNotNull(loginInstance, 'Login instance should exist');
    });

    it('should validate email format correctly', () => {
        assert.isTrue(loginInstance.validateEmail('valid@example.com'), 'Valid email should pass');
        assert.isFalse(loginInstance.validateEmail('invalid-email'), 'Invalid email should fail');
        assert.isFalse(loginInstance.validateEmail(''), 'Empty email should fail');
        assert.isFalse(loginInstance.validateEmail(null), 'Null email should fail');
    });

    it('should validate password requirements', () => {
        assert.isTrue(loginInstance.validatePassword('Password123!'), 'Strong password should pass');
        assert.isFalse(loginInstance.validatePassword('123'), 'Short password should fail');
        assert.isFalse(loginInstance.validatePassword(''), 'Empty password should fail');
    });

    it('should handle login form submission with valid data', async () => {
        const result = await loginInstance.submitLogin('test@example.com', 'Password123!');
        assert.isNotNull(result, 'Login result should exist');
        assert.isTrue(result.success, 'Login should succeed');
    });

    it('should handle login form submission with invalid data', async () => {
        const result = await loginInstance.submitLogin('', '');
        assert.isFalse(result.success, 'Login should fail with empty data');
        assert.isNotNull(result.error, 'Error message should be provided');
    });

    it('should emit login success event', (done) => {
        eventBus.on('auth:login:success', (data) => {
            assert.isNotNull(data, 'Event data should exist');
            assert.isNotNull(data.user, 'User should be in event data');
            done();
        });
        loginInstance.submitLogin('test@example.com', 'Password123!');
    });

    it('should emit login failure event', (done) => {
        eventBus.on('auth:login:failed', (data) => {
            assert.isNotNull(data, 'Event data should exist');
            assert.isNotNull(data.error, 'Error should be in event data');
            done();
        });
        loginInstance.submitLogin('wrong@example.com', 'wrong');
    });
});

// ============================================================
// PERMISSIONS MODULE TESTS
// ============================================================
describe('Permissions - RBAC Authorization', () => {
    beforeAll(() => {
        eventBus = new EventBus();
        permissionsInstance = new Permissions(eventBus);
    });

    afterAll(() => {
        permissionsInstance.destroy();
        eventBus.destroy();
    });

    it('should create Permissions instance', () => {
        assert.isNotNull(permissionsInstance, 'Permissions instance should exist');
    });

    it('should check permission for admin role', async () => {
        const hasAccess = await permissionsInstance.check('admin', 'users', 'read');
        assert.isTrue(hasAccess, 'Admin should have read access');
    });

    it('should check permission for viewer role', async () => {
        const hasAccess = await permissionsInstance.check('viewer', 'settings', 'write');
        assert.isFalse(hasAccess, 'Viewer should not have write access');
    });

    it('should check permission for specific resource', async () => {
        const hasAccess = await permissionsInstance.check('manager', 'leads', 'create');
        assert.isTrue(hasAccess, 'Manager should have create access for leads');
    });

    it('should validate permission string format', () => {
        assert.isTrue(permissionsInstance.isValidPermission('users:read'), 'Valid permission format');
        assert.isFalse(permissionsInstance.isValidPermission('invalid'), 'Invalid permission format');
        assert.isFalse(permissionsInstance.isValidPermission(''), 'Empty permission');
    });

    it('should get all permissions for a role', () => {
        const perms = permissionsInstance.getRolePermissions('admin');
        assert.isNotNull(perms, 'Permissions should exist');
        assert.greaterThan(perms.length, 0, 'Admin should have multiple permissions');
    });

    it('should check if role has specific permission', () => {
        assert.isTrue(permissionsInstance.roleHasPermission('admin', 'users:read'), 'Admin has users:read');
        assert.isFalse(permissionsInstance.roleHasPermission('viewer', 'settings:write'), 'Viewer lacks settings:write');
    });
});

// ============================================================
// ROLES MODULE TESTS
// ============================================================
describe('Roles - Role Management', () => {
    beforeAll(() => {
        eventBus = new EventBus();
        rolesInstance = new Roles(eventBus);
    });

    afterAll(() => {
        rolesInstance.destroy();
        eventBus.destroy();
    });

    it('should create Roles instance', () => {
        assert.isNotNull(rolesInstance, 'Roles instance should exist');
    });

    it('should list all available roles', () => {
        const roles = rolesInstance.getAllRoles();
        assert.isNotNull(roles, 'Roles should exist');
        assert.greaterThan(roles.length, 0, 'Should have multiple roles');
    });

    it('should get role by ID', () => {
        const role = rolesInstance.getRole('admin');
        assert.isNotNull(role, 'Admin role should exist');
        assert.equal(role.id, 'admin', 'Role ID should match');
    });

    it('should return null for non-existent role', () => {
        const role = rolesInstance.getRole('nonexistent-role');
        assert.isNull(role, 'Non-existent role should return null');
    });

    it('should get role hierarchy level', () => {
        const adminLevel = rolesInstance.getRoleLevel('admin');
        const viewerLevel = rolesInstance.getRoleLevel('viewer');
        assert.greaterThan(adminLevel, viewerLevel, 'Admin should be higher than viewer');
    });

    it('should check if role can manage another role', () => {
        assert.isTrue(rolesInstance.canManageRole('super_admin', 'admin'), 'Super admin can manage admin');
        assert.isFalse(rolesInstance.canManageRole('manager', 'admin'), 'Manager cannot manage admin');
    });

    it('should validate role assignment', () => {
        assert.isTrue(rolesInstance.isValidRole('admin'), 'Admin is valid role');
        assert.isFalse(rolesInstance.isValidRole('fake-role'), 'Fake role is invalid');
    });

    it('should get default role for new users', () => {
        const defaultRole = rolesInstance.getDefaultRole();
        assert.isNotNull(defaultRole, 'Default role should exist');
    });
});

// ============================================================
// SESSION MODULE TESTS
// ============================================================
describe('Session - Session Management', () => {
    beforeAll(() => {
        eventBus = new EventBus();
        sessionInstance = new Session(eventBus);
    });

    afterAll(() => {
        sessionInstance.destroy();
        eventBus.destroy();
    });

    it('should create Session instance', () => {
        assert.isNotNull(sessionInstance, 'Session instance should exist');
    });

    it('should create new session', () => {
        const session = sessionInstance.createSession('user-123', { role: 'admin' });
        assert.isNotNull(session, 'Session should be created');
        assert.isNotNull(session.token, 'Token should be generated');
        assert.isNotNull(session.expiresAt, 'Expiry should be set');
    });

    it('should validate active session', () => {
        const session = sessionInstance.createSession('user-456', { role: 'manager' });
        const isValid = sessionInstance.isValidSession(session.token);
        assert.isTrue(isValid, 'Session should be valid');
    });

    it('should reject invalid token', () => {
        const isValid = sessionInstance.isValidSession('invalid-token-12345');
        assert.isFalse(isValid, 'Invalid token should be rejected');
    });

    it('should reject expired session', () => {
        const expiredSession = sessionInstance.createSession('user-789', { role: 'viewer' }, -3600000);
        const isValid = sessionInstance.isValidSession(expiredSession.token);
        assert.isFalse(isValid, 'Expired session should be rejected');
    });

    it('should refresh session token', () => {
        const session = sessionInstance.createSession('user-abc', { role: 'admin' });
        const oldToken = session.token;
        const refreshedSession = sessionInstance.refreshSession(session.token);
        assert.isNotNull(refreshedSession, 'Refreshed session should exist');
        assert.notEqual(refreshedSession.token, oldToken, 'Token should change on refresh');
    });

    it('should destroy session', () => {
        const session = sessionInstance.createSession('user-xyz', { role: 'viewer' });
        sessionInstance.destroySession(session.token);
        const isValid = sessionInstance.isValidSession(session.token);
        assert.isFalse(isValid, 'Destroyed session should be invalid');
    });

    it('should track active session count', () => {
        const initialCount = sessionInstance.getActiveSessionCount();
        sessionInstance.createSession('user-1', {});
        sessionInstance.createSession('user-2', {});
        const newCount = sessionInstance.getActiveSessionCount();
        assert.equal(newCount, initialCount + 2, 'Count should increase by 2');
    });

    it('should enforce max concurrent sessions', () => {
        for (let i = 0; i < 10; i++) {
            sessionInstance.createSession(`user-${i}`, {});
        }
        const count = sessionInstance.getActiveSessionCount();
        const maxSessions = sessionInstance.getMaxSessions();
        assert.lessThan(count, maxSessions + 5, 'Should respect max session limit');
    });
});

// ============================================================
// MIDDLEWARE MODULE TESTS
// ============================================================
describe('Middleware - Auth Middleware', () => {
    beforeAll(() => {
        eventBus = new EventBus();
        sessionInstance = new Session(eventBus);
        middlewareInstance = new Middleware(sessionInstance, eventBus);
    });

    afterAll(() => {
        middlewareInstance.destroy();
        sessionInstance.destroy();
        eventBus.destroy();
    });

    it('should create Middleware instance', () => {
        assert.isNotNull(middlewareInstance, 'Middleware instance should exist');
    });

    it('should allow request with valid token', () => {
        const session = sessionInstance.createSession('user-auth', { role: 'admin' });
        const result = middlewareInstance.authenticate(session.token);
        assert.isTrue(result.authenticated, 'Request should be authenticated');
        assert.isNotNull(result.user, 'User info should be included');
    });

    it('should reject request with invalid token', () => {
        const result = middlewareInstance.authenticate('bad-token');
        assert.isFalse(result.authenticated, 'Request should not be authenticated');
        assert.isNotNull(result.error, 'Error should be provided');
    });

    it('should authorize based on role requirements', () => {
        const session = sessionInstance.createSession('user-role', { role: 'manager' });
        const authResult = middlewareInstance.authenticate(session.token);
        
        const authorized = middlewareInstance.authorize(authResult.user, ['admin']);
        assert.isFalse(authorized, 'Manager should not be authorized for admin route');
    });

    it('should authorize admin for admin routes', () => {
        const session = sessionInstance.createSession('admin-user', { role: 'admin' });
        const authResult = middlewareInstance.authenticate(session.token);
        
        const authorized = middlewareInstance.authorize(authResult.user, ['admin']);
        assert.isTrue(authorized, 'Admin should be authorized for admin route');
    });

    it('should handle multiple allowed roles', () => {
        const session = sessionInstance.createSession('multi-role', { role: 'viewer' });
        const authResult = middlewareInstance.authenticate(session.token);
        
        const authorized = middlewareInstance.authorize(authResult.user, ['admin', 'manager', 'viewer']);
        assert.isTrue(authorized, 'Viewer should be authorized when included in allowed roles');
    });

    it('should extract token from authorization header', () => {
        const session = sessionInstance.createSession('header-user', { role: 'admin' });
        const token = middlewareInstance.extractToken(`Bearer ${session.token}`);
        assert.equal(token, session.token, 'Token should be extracted correctly');
    });

    it('should handle missing authorization header', () => {
        const token = middlewareInstance.extractToken(null);
        assert.isNull(token, 'Null header should return null token');
    });

    it('should handle malformed authorization header', () => {
        const token = middlewareInstance.extractToken('InvalidFormat token123');
        assert.isNull(token, 'Malformed header should return null');
    });
});

// ============================================================
// PRINT TEST SUMMARY
// ============================================================
setTimeout(() => {
    testResults.endTime = Date.now();
    const duration = (testResults.endTime - testResults.startTime) / 1000;

    console.log('\n═══════════════════════════════════════════');
    console.log('  AUTH MODULE TEST SUMMARY');
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
            console.log(`  ${i + 1}. [${f.suite}] ${f.test}`);
            console.log(`     ${f.error}`);
        });
        console.log('');
    }

    // Export for CI/CD
    if (typeof window !== 'undefined') {
        window.__AUTH_TEST_RESULTS__ = testResults;
    }
    if (typeof process !== 'undefined' && process.exit) {
        process.exit(testResults.failed > 0 ? 1 : 0);
    }
}, 3000);

testResults.startTime = Date.now();

export { assert, testResults };
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
