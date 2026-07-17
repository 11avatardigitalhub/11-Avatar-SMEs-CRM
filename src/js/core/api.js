/* ==========================================
   11 AVATAR DIGITAL HUB
   API Handler - Network Communication Layer
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Centralized API communication
   - Firebase Firestore operations wrapper
   - Cloudflare Worker API calls
   - Request/Response interception
   - Automatic retry with exponential backoff
   - Request queuing for offline support
   - Response caching
   - Request deduplication
   - Authentication token management
   - Error normalization
   - Request timeout handling
   - Rate limiting awareness
   - Batch operations
   - File upload/download with progress
   ==========================================
   Architecture:
   
   APIHandler
   ├── FirestoreAPI (local Firebase SDK)
   ├── WorkerAPI (Cloudflare Worker endpoints)
   ├── StorageAPI (Firebase Storage)
   └── AuthAPI (Firebase Authentication)
   
   Each sub-API provides:
   - CRUD operations
   - Batch operations
   - Real-time listeners
   - Pagination support
   - Error handling
   ========================================== */

// ==========================================
// API HANDLER CLASS
// ==========================================
class APIHandler {
    
    /**
     * Initialize the API handler
     */
    constructor() {
        // Configuration
        this.config = {
            baseURL: Constants.APP.apiEndpoint,
            timeout: 30000, // 30 seconds
            maxRetries: 3,
            retryDelay: 1000, // Start with 1 second
            maxRetryDelay: 16000, // Max 16 seconds
            cacheEnabled: true,
            cacheDuration: 5 * 60 * 1000, // 5 minutes
            deduplicateRequests: true,
            offlineQueueEnabled: true,
            maxOfflineQueueSize: 100,
            rateLimitWindow: 60000, // 1 minute
            maxRequestsPerWindow: 100
        };
        
        // State
        this.pendingRequests = new Map();
        this.requestCache = new Map();
        this.offlineQueue = [];
        this.rateLimitCounter = 0;
        this.rateLimitResetTime = Date.now() + this.config.rateLimitWindow;
        
        // Auth token
        this.authToken = null;
        this.tokenRefreshPromise = null;
        
        // Bind methods
        this._handleOnline = this._handleOnline.bind(this);
        this._handleOffline = this._handleOffline.bind(this);
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the API handler
     * @private
     */
    _init() {
        console.log('🌐 Initializing API Handler...');
        
        // Setup network listeners
        window.addEventListener('online', this._handleOnline);
        window.addEventListener('offline', this._handleOffline);
        
        // Listen for auth changes to update token
        window.EventBus?.on('auth:login', (data) => {
            this.authToken = data?.user?.accessToken || null;
        });
        
        window.EventBus?.on('auth:logout', () => {
            this.authToken = null;
            this.requestCache.clear();
        });
        
        // Initialize token from current user
        const currentUser = FirebaseService.getCurrentUser();
        if (currentUser) {
            currentUser.getIdToken().then(token => {
                this.authToken = token;
            }).catch(() => {});
        }
        
        console.log('✅ API Handler initialized');
        console.log('🌐 Base URL:', this.config.baseURL);
    }
    
    // ==========================================
    // AUTHENTICATION
    // ==========================================
    
    /**
     * Get current authentication token
     * @returns {Promise<string|null>} JWT token
     */
    async getAuthToken(forceRefresh = false) {
        try {
            const user = FirebaseService.getCurrentUser();
            if (!user) return null;
            
            if (forceRefresh || !this.authToken) {
                this.authToken = await user.getIdToken(forceRefresh);
            }
            
            return this.authToken;
        } catch (error) {
            console.error('❌ Failed to get auth token:', error);
            return null;
        }
    }
    
    /**
     * Get authorization headers
     * @returns {Promise<Object>} Headers object
     */
    async getAuthHeaders() {
        const token = await this.getAuthToken();
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }
    
    // ==========================================
    // CORE REQUEST METHODS
    // ==========================================
    
    /**
     * Make an HTTP request with full error handling
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async request(url, options = {}) {
        const {
            method = 'GET',
            body = null,
            headers = {},
            timeout = this.config.timeout,
            retries = this.config.maxRetries,
            retryDelay = this.config.retryDelay,
            cache = this.config.cacheEnabled,
            cacheDuration = this.config.cacheDuration,
            deduplicate = this.config.deduplicateRequests,
            signal = null,
            onProgress = null
        } = options;
        
        // Check rate limiting
        if (!this._checkRateLimit()) {
            throw this._createError('RATE_LIMIT', 'Too many requests. Please try again later.');
        }
        
        // Check offline
        if (!navigator.onLine && this.config.offlineQueueEnabled) {
            return this._queueOfflineRequest(url, options);
        }
        
        // Generate request key for deduplication
        const requestKey = this._generateRequestKey(url, method, body);
        
        // Return pending request if deduplication enabled
        if (deduplicate && this.pendingRequests.has(requestKey)) {
            console.log('🔄 Returning pending request:', requestKey);
            return this.pendingRequests.get(requestKey);
        }
        
        // Check cache for GET requests
        if (method === 'GET' && cache) {
            const cachedResponse = this._getFromCache(requestKey);
            if (cachedResponse) {
                console.log('📦 Returning cached response:', requestKey);
                return cachedResponse;
            }
        }
        
        // Merge auth headers
        const authHeaders = await this.getAuthHeaders();
        const finalHeaders = { ...authHeaders, ...headers };
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Use provided signal if available
        const finalSignal = signal || controller.signal;
        
        // Build request
        const requestOptions = {
            method,
            headers: finalHeaders,
            signal: finalSignal,
            credentials: 'include'
        };
        
        if (body && method !== 'GET') {
            requestOptions.body = body instanceof FormData ? body : JSON.stringify(body);
        }
        
        // Create the request promise
        const requestPromise = this._executeRequest(url, requestOptions, requestKey, {
            cache,
            cacheDuration,
            retries,
            retryDelay,
            onProgress
        });
        
        // Store for deduplication
        if (deduplicate) {
            this.pendingRequests.set(requestKey, requestPromise);
            
            // Clean up after completion
            requestPromise.finally(() => {
                this.pendingRequests.delete(requestKey);
                clearTimeout(timeoutId);
            });
        }
        
        return requestPromise;
    }
    
    /**
     * Execute the actual fetch request with retry logic
     * @private
     */
    async _executeRequest(url, options, requestKey, config) {
        const { cache, cacheDuration, retries, retryDelay, onProgress } = config;
        
        let lastError = null;
        let attempt = 0;
        
        while (attempt <= retries) {
            try {
                // Make the fetch call
                const response = await fetch(url, options);
                
                // Handle non-OK responses
                if (!response.ok) {
                    const error = await this._handleErrorResponse(response);
                    throw error;
                }
                
                // Parse response
                let data;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else if (contentType && contentType.includes('text/')) {
                    data = await response.text();
                } else {
                    data = await response.blob();
                }
                
                // Cache successful GET responses
                if (options.method === 'GET' && cache) {
                    this._setToCache(requestKey, data, cacheDuration);
                }
                
                return data;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                // Don't retry if:
                // - Request was aborted
                // - It's a 4xx error (client error)
                // - We've exhausted retries
                if (error.name === 'AbortError') {
                    throw this._createError('TIMEOUT', 'Request timed out after ' + this.config.timeout + 'ms');
                }
                
                if (error.status && error.status >= 400 && error.status < 500) {
                    throw error; // Client errors, don't retry
                }
                
                if (attempt > retries) {
                    throw this._createError('MAX_RETRIES', `Request failed after ${retries} retries`, lastError);
                }
                
                // Calculate delay with exponential backoff
                const delay = Math.min(
                    retryDelay * Math.pow(2, attempt - 1),
                    this.config.maxRetryDelay
                );
                
                // Add jitter (±25%)
                const jitter = delay * 0.25 * (Math.random() * 2 - 1);
                const finalDelay = delay + jitter;
                
                console.warn(`⚠️ Request failed (attempt ${attempt}/${retries}), retrying in ${Math.round(finalDelay)}ms:`, url);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, finalDelay));
            }
        }
        
        throw lastError || this._createError('UNKNOWN', 'Request failed for unknown reason');
    }
    
    /**
     * Handle error HTTP responses
     * @private
     */
    async _handleErrorResponse(response) {
        let errorData;
        
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: response.statusText };
        }
        
        const error = new Error(errorData.message || `HTTP Error ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.data = errorData;
        error.code = errorData.code || `HTTP_${response.status}`;
        
        // Handle specific status codes
        switch (response.status) {
            case 401:
                error.code = 'UNAUTHORIZED';
                // Trigger token refresh or logout
                window.EventBus?.emit('auth:sessionExpired');
                break;
            case 403:
                error.code = 'FORBIDDEN';
                window.EventBus?.emit('auth:permissionDenied');
                break;
            case 404:
                error.code = 'NOT_FOUND';
                break;
            case 429:
                error.code = 'RATE_LIMIT';
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                error.code = 'SERVER_ERROR';
                break;
        }
        
        return error;
    }
    
    // ==========================================
    // HTTP METHOD SHORTCUTS
    // ==========================================
    
    /**
     * GET request
     */
    async get(url, params = {}, options = {}) {
        // Build query string
        if (params && Object.keys(params).length > 0) {
            const queryString = Object.entries(params)
                .filter(([key, value]) => value !== undefined && value !== null)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }
        
        return this.request(url, { ...options, method: 'GET' });
    }
    
    /**
     * POST request
     */
    async post(url, data = {}, options = {}) {
        return this.request(url, { ...options, method: 'POST', body: data });
    }
    
    /**
     * PUT request
     */
    async put(url, data = {}, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: data });
    }
    
    /**
     * PATCH request
     */
    async patch(url, data = {}, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body: data });
    }
    
    /**
     * DELETE request
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
    
    // ==========================================
    // FIRESTORE OPERATIONS
    // ==========================================
    
    /**
     * Get documents from a Firestore collection
     * @param {string} collection - Collection name
     * @param {Object} options - Query options
     */
    async getDocuments(collection, options = {}) {
        const {
            conditions = [],
            orderBy = 'createdAt',
            orderDir = 'desc',
            limit = 50,
            startAfter = null,
            page = 1,
            pageSize = 25
        } = options;
        
        try {
            const queryOptions = {
                orderBy,
                orderDir,
                limit: limit || pageSize,
                startAfter
            };
            
            const documents = await FirebaseService.queryDocuments(collection, conditions, queryOptions);
            
            return {
                data: documents,
                total: documents.length,
                page: page,
                pageSize: pageSize,
                hasMore: documents.length === (limit || pageSize)
            };
        } catch (error) {
            console.error(`❌ API: Failed to get documents from ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Get a single document by ID
     */
    async getDocument(collection, docId) {
        try {
            const document = await FirebaseService.getDocument(collection, docId);
            
            if (!document) {
                throw this._createError('NOT_FOUND', `Document not found in ${collection}: ${docId}`);
            }
            
            return document;
        } catch (error) {
            console.error(`❌ API: Failed to get document from ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Create a new document
     */
    async createDocument(collection, data, options = {}) {
        try {
            // Add client context if available
            const clientId = await this._getClientId();
            if (clientId) {
                data.clientId = clientId;
            }
            
            // Add user context
            const user = FirebaseService.getCurrentUser();
            if (user) {
                data.createdBy = user.uid;
                data.createdByName = user.displayName || user.email;
            }
            
            const docRef = await FirebaseService.createDocument(collection, data);
            
            // Emit event
            const eventName = `${collection.slice(0, -1)}:created`;
            window.EventBus?.emit(eventName, { 
                id: docRef.id, 
                data: { ...data, id: docRef.id },
                collection 
            });
            
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error(`❌ API: Failed to create document in ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Update an existing document
     */
    async updateDocument(collection, docId, data, options = {}) {
        try {
            await FirebaseService.updateDocument(collection, docId, data);
            
            // Emit event
            const eventName = `${collection.slice(0, -1)}:updated`;
            window.EventBus?.emit(eventName, { 
                id: docId, 
                data,
                collection 
            });
            
            return { id: docId, ...data };
        } catch (error) {
            console.error(`❌ API: Failed to update document in ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Delete a document
     */
    async deleteDocument(collection, docId) {
        try {
            await FirebaseService.deleteDocument(collection, docId);
            
            // Emit event
            const eventName = `${collection.slice(0, -1)}:deleted`;
            window.EventBus?.emit(eventName, { 
                id: docId,
                collection 
            });
            
            return { success: true, id: docId };
        } catch (error) {
            console.error(`❌ API: Failed to delete document from ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Batch create multiple documents
     */
    async batchCreate(collection, documents) {
        try {
            const batch = FirebaseService.getBatch();
            const results = [];
            
            documents.forEach(data => {
                const docRef = FirebaseService.collections[collection]().doc();
                batch.set(docRef, {
                    ...data,
                    createdAt: FirebaseService.timestamp(),
                    updatedAt: FirebaseService.timestamp()
                });
                results.push({ id: docRef.id, ...data });
            });
            
            await batch.commit();
            
            window.EventBus?.emit(`${collection}:batchCreated`, { 
                count: results.length,
                collection 
            });
            
            return results;
        } catch (error) {
            console.error(`❌ API: Batch create failed for ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Batch update multiple documents
     */
    async batchUpdate(collection, updates) {
        try {
            const batch = FirebaseService.getBatch();
            
            updates.forEach(({ docId, data }) => {
                const docRef = FirebaseService.collections[collection]().doc(docId);
                batch.update(docRef, {
                    ...data,
                    updatedAt: FirebaseService.timestamp()
                });
            });
            
            await batch.commit();
            
            return { success: true, count: updates.length };
        } catch (error) {
            console.error(`❌ API: Batch update failed for ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Batch delete multiple documents
     */
    async batchDelete(collection, docIds) {
        try {
            const batch = FirebaseService.getBatch();
            
            docIds.forEach(docId => {
                const docRef = FirebaseService.collections[collection]().doc(docId);
                batch.delete(docRef);
            });
            
            await batch.commit();
            
            return { success: true, count: docIds.length };
        } catch (error) {
            console.error(`❌ API: Batch delete failed for ${collection}:`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Listen to real-time updates on a collection
     */
    listenToCollection(collection, callback, options = {}) {
        const {
            conditions = [],
            orderBy = 'createdAt',
            orderDir = 'desc',
            limit = 100
        } = options;
        
        let query = FirebaseService.collections[collection]();
        
        conditions.forEach(([field, operator, value]) => {
            query = query.where(field, operator, value);
        });
        
        query = query.orderBy(orderBy, orderDir).limit(limit);
        
        const unsubscribe = query.onSnapshot(
            (snapshot) => {
                const documents = [];
                snapshot.docChanges().forEach(change => {
                    const doc = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'added') {
                        documents.push({ ...doc, _changeType: 'added' });
                    } else if (change.type === 'modified') {
                        documents.push({ ...doc, _changeType: 'modified' });
                    } else if (change.type === 'removed') {
                        documents.push({ ...doc, _changeType: 'removed' });
                    }
                });
                
                callback(documents, snapshot);
            },
            (error) => {
                console.error(`❌ API: Listener error for ${collection}:`, error);
                callback([], null, error);
            }
        );
        
        return unsubscribe;
    }
    
    // ==========================================
    // FILE OPERATIONS
    // ==========================================
    
    /**
     * Upload a file with progress tracking
     */
    async uploadFile(path, file, options = {}) {
        const { onProgress = null, metadata = {} } = options;
        
        try {
            const uploadTask = FirebaseService.storageRef.uploads().child(path).put(file, metadata);
            
            // Track progress
            if (onProgress) {
                uploadTask.on('state_changed', (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress({
                        progress: Math.round(progress),
                        bytesTransferred: snapshot.bytesTransferred,
                        totalBytes: snapshot.totalBytes,
                        state: snapshot.state
                    });
                });
            }
            
            // Wait for completion
            const snapshot = await uploadTask;
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            return {
                success: true,
                downloadURL,
                path,
                fileName: file.name,
                size: file.size,
                type: file.type
            };
        } catch (error) {
            console.error('❌ API: File upload failed:', error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Delete a file
     */
    async deleteFile(path) {
        try {
            await FirebaseService.deleteFile(path);
            return { success: true, path };
        } catch (error) {
            console.error('❌ API: File delete failed:', error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Get file download URL
     */
    async getFileURL(path) {
        try {
            const ref = FirebaseService.storage.ref(path);
            const url = await ref.getDownloadURL();
            return { url, path };
        } catch (error) {
            console.error('❌ API: Failed to get file URL:', error);
            throw this._normalizeError(error);
        }
    }
    
    // ==========================================
    // CLOUDFLARE WORKER API
    // ==========================================
    
    /**
     * Call Cloudflare Worker API
     */
    async callWorker(endpoint, data = {}, options = {}) {
        const url = `${this.config.baseURL}${endpoint}`;
        
        try {
            return await this.request(url, {
                ...options,
                body: data,
                method: options.method || 'POST',
                cache: false // Don't cache worker responses by default
            });
        } catch (error) {
            console.error(`❌ API: Worker call failed (${endpoint}):`, error);
            throw this._normalizeError(error);
        }
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        return this.get(`${this.config.baseURL}/api/health`);
    }
    
    // ==========================================
    // CACHE MANAGEMENT
    // ==========================================
    
    /**
     * Get response from cache
     * @private
     */
    _getFromCache(key) {
        if (!this.config.cacheEnabled) return null;
        
        const cached = this.requestCache.get(key);
        
        if (cached && Date.now() - cached.timestamp < cached.duration) {
            return cached.data;
        }
        
        if (cached) {
            this.requestCache.delete(key);
        }
        
        return null;
    }
    
    /**
     * Set response to cache
     * @private
     */
    _setToCache(key, data, duration) {
        this.requestCache.set(key, {
            data,
            timestamp: Date.now(),
            duration: duration || this.config.cacheDuration
        });
        
        // Clean old cache entries
        if (this.requestCache.size > 200) {
            const now = Date.now();
            for (const [cacheKey, value] of this.requestCache.entries()) {
                if (now - value.timestamp > value.duration) {
                    this.requestCache.delete(cacheKey);
                }
            }
        }
    }
    
    /**
     * Clear all cached responses
     */
    clearCache() {
        this.requestCache.clear();
        console.log('🗑️ API cache cleared');
    }
    
    // ==========================================
    // OFFLINE SUPPORT
    // ==========================================
    
    /**
     * Queue request for when back online
     * @private
     */
    async _queueOfflineRequest(url, options) {
        if (this.offlineQueue.length >= this.config.maxOfflineQueueSize) {
            throw this._createError('QUEUE_FULL', 'Offline queue is full');
        }
        
        const queuedRequest = {
            url,
            options,
            timestamp: Date.now(),
            id: this._generateRequestId()
        };
        
        this.offlineQueue.push(queuedRequest);
        
        // Save queue to localStorage
        this._saveOfflineQueue();
        
        console.log('📤 Queued offline request:', queuedRequest.id);
        
        // Return a promise that resolves when request is processed
        return new Promise((resolve, reject) => {
            queuedRequest.resolve = resolve;
            queuedRequest.reject = reject;
        });
    }
    
    /**
     * Process all queued offline requests
     * @private
     */
    async _processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        console.log(`📤 Processing ${this.offlineQueue.length} offline requests...`);
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        this._saveOfflineQueue();
        
        let successCount = 0;
        let failCount = 0;
        
        for (const item of queue) {
            try {
                const response = await this.request(item.url, item.options);
                item.resolve?.(response);
                successCount++;
            } catch (error) {
                console.error('❌ Failed to process offline request:', item.id, error);
                item.reject?.(error);
                failCount++;
            }
        }
        
        console.log(`📤 Offline queue processed: ${successCount} success, ${failCount} failed`);
    }
    
    /**
     * Save offline queue to localStorage
     * @private
     */
    _saveOfflineQueue() {
        try {
            const serializable = this.offlineQueue.map(item => ({
                url: item.url,
                options: {
                    method: item.options.method,
                    body: item.options.body,
                    headers: item.options.headers
                },
                timestamp: item.timestamp,
                id: item.id
            }));
            
            localStorage.setItem('api_offline_queue', JSON.stringify(serializable));
        } catch (error) {
            console.warn('⚠️ Failed to save offline queue:', error);
        }
    }
    
    /**
     * Load offline queue from localStorage
     * @private
     */
    _loadOfflineQueue() {
        try {
            const saved = localStorage.getItem('api_offline_queue');
            if (saved) {
                this.offlineQueue = JSON.parse(saved);
                console.log(`📤 Loaded ${this.offlineQueue.length} offline requests`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load offline queue:', error);
        }
    }
    
    /**
     * Handle coming back online
     * @private
     */
    _handleOnline() {
        console.log('📶 Back online, processing offline queue...');
        this._processOfflineQueue();
        window.EventBus?.emit(EVENTS.NETWORK_ONLINE);
    }
    
    /**
     * Handle going offline
     * @private
     */
    _handleOffline() {
        console.log('📶 Offline, requests will be queued');
        window.EventBus?.emit(EVENTS.NETWORK_OFFLINE);
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    /**
     * Generate unique request key for deduplication
     * @private
     */
    _generateRequestKey(url, method, body) {
        const parts = [method, url];
        
        if (body) {
            try {
                parts.push(JSON.stringify(body));
            } catch {
                parts.push(String(body));
            }
        }
        
        return parts.join('|');
    }
    
    /**
     * Generate unique request ID
     * @private
     */
    _generateRequestId() {
        return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    /**
     * Check rate limiting
     * @private
     */
    _checkRateLimit() {
        const now = Date.now();
        
        // Reset counter if window has passed
        if (now > this.rateLimitResetTime) {
            this.rateLimitCounter = 0;
            this.rateLimitResetTime = now + this.config.rateLimitWindow;
        }
        
        // Increment counter
        this.rateLimitCounter++;
        
        // Check if over limit
        return this.rateLimitCounter <= this.config.maxRequestsPerWindow;
    }
    
    /**
     * Get client ID for current user
     * @private
     */
    async _getClientId() {
        try {
            const profile = await FirebaseService.getCurrentUserProfile();
            return profile?.clientId || null;
        } catch {
            return null;
        }
    }
    
    /**
     * Create a standardized error object
     * @private
     */
    _createError(code, message, originalError = null) {
        const error = new Error(message);
        error.code = code;
        error.timestamp = new Date().toISOString();
        
        if (originalError) {
            error.originalError = originalError;
            error.stack = originalError.stack;
        }
        
        return error;
    }
    
    /**
     * Normalize any error to standard format
     * @private
     */
    _normalizeError(error) {
        if (error.code) return error;
        
        const normalized = new Error(error.message || 'An unexpected error occurred');
        normalized.code = error.code || 'UNKNOWN_ERROR';
        normalized.status = error.status || 500;
        normalized.timestamp = new Date().toISOString();
        normalized.originalError = error;
        
        return normalized;
    }
    
    /**
     * Get API statistics
     */
    getStats() {
        return {
            pendingRequests: this.pendingRequests.size,
            cachedResponses: this.requestCache.size,
            offlineQueueSize: this.offlineQueue.length,
            rateLimitRemaining: this.config.maxRequestsPerWindow - this.rateLimitCounter,
            rateLimitReset: new Date(this.rateLimitResetTime).toISOString(),
            baseURL: this.config.baseURL,
            online: navigator.onLine
        };
    }
    
    /**
     * Debug: Print API state
     */
    debug() {
        console.group('🌐 API Handler Debug');
        console.log('Stats:', this.getStats());
        console.log('Config:', this.config);
        console.log('Auth Token:', this.authToken ? 'Present' : 'None');
        console.groupEnd();
    }
    
    /**
     * Cleanup and destroy
     */
    destroy() {
        window.removeEventListener('online', this._handleOnline);
        window.removeEventListener('offline', this._handleOffline);
        
        this.pendingRequests.clear();
        this.requestCache.clear();
        this._saveOfflineQueue();
        
        console.log('🌐 API Handler destroyed');
    }
}

// ==========================================
// CREATE & EXPORT API HANDLER INSTANCE
// ==========================================
const api = new APIHandler();

// Load saved offline queue
api._loadOfflineQueue();

// Make available globally
window.API = api;

// Export for module usage
export default api;

console.log('🌐 API Handler ready');
console.log('🌐 Stats:', api.getStats());

// ==========================================
// END OF API HANDLER
// ==========================================

