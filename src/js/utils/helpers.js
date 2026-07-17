/* ==========================================
   11 AVATAR DIGITAL HUB
   Utility Helpers
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Common utility functions
   - DOM manipulation helpers
   - String formatting
   - Number formatting
   - Date manipulation
   - Array/object utilities
   - Debounce & throttle
   - ID generation
   - Deep clone
   - URL helpers
   - Storage wrappers
   ========================================== */

const Helpers = {
    
    // ==========================================
    // ID GENERATION
    // ==========================================
    
    /**
     * Generate a unique ID
     * @param {string} prefix - Optional prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
    },
    
    /**
     * Generate a short ID (8 characters)
     * @returns {string} Short unique ID
     */
    shortId() {
        return Math.random().toString(36).substring(2, 10);
    },
    
    /**
     * Generate a UUID v4
     * @returns {string} UUID
     */
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    // ==========================================
    // DOM HELPERS
    // ==========================================
    
    /**
     * Select a single DOM element
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element
     * @returns {Element|null}
     */
    $(selector, parent = document) {
        return parent.querySelector(selector);
    },
    
    /**
     * Select multiple DOM elements
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element
     * @returns {NodeList}
     */
    $$(selector, parent = document) {
        return parent.querySelectorAll(selector);
    },
    
    /**
     * Create a DOM element with attributes and children
     * @param {string} tag - HTML tag
     * @param {Object} attrs - Attributes
     * @param {...(string|Element)} children - Text or child elements
     * @returns {Element}
     */
    createElement(tag, attrs = {}, ...children) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(element.dataset, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Append children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Element) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    /**
     * Remove all children from an element
     * @param {Element} element - DOM element
     */
    empty(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },
    
    /**
     * Show an element
     * @param {Element} element - DOM element
     * @param {string} display - Display value
     */
    show(element, display = 'block') {
        if (element) {
            element.style.display = display;
        }
    },
    
    /**
     * Hide an element
     * @param {Element} element - DOM element
     */
    hide(element) {
        if (element) {
            element.style.display = 'none';
        }
    },
    
    /**
     * Toggle element visibility
     * @param {Element} element - DOM element
     * @param {string} display - Display value when shown
     */
    toggle(element, display = 'block') {
        if (element) {
            const isHidden = element.style.display === 'none';
            element.style.display = isHidden ? display : 'none';
        }
    },
    
    /**
     * Add class to element
     * @param {Element} element - DOM element
     * @param {...string} classes - Classes to add
     */
    addClass(element, ...classes) {
        if (element) {
            element.classList.add(...classes);
        }
    },
    
    /**
     * Remove class from element
     * @param {Element} element - DOM element
     * @param {...string} classes - Classes to remove
     */
    removeClass(element, ...classes) {
        if (element) {
            element.classList.remove(...classes);
        }
    },
    
    /**
     * Toggle class on element
     * @param {Element} element - DOM element
     * @param {string} className - Class to toggle
     * @param {boolean} force - Force add/remove
     */
    toggleClass(element, className, force) {
        if (element) {
            element.classList.toggle(className, force);
        }
    },
    
    /**
     * Check if element has class
     * @param {Element} element - DOM element
     * @param {string} className - Class to check
     * @returns {boolean}
     */
    hasClass(element, className) {
        return element ? element.classList.contains(className) : false;
    },
    
    // ==========================================
    // STRING HELPERS
    // ==========================================
    
    /**
     * Capitalize first letter
     * @param {string} str - Input string
     * @returns {string}
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    /**
     * Convert string to title case
     * @param {string} str - Input string
     * @returns {string}
     */
    titleCase(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    
    /**
     * Convert string to camelCase
     * @param {string} str - Input string
     * @returns {string}
     */
    camelCase(str) {
        if (!str) return '';
        return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    },
    
    /**
     * Convert string to kebab-case
     * @param {string} str - Input string
     * @returns {string}
     */
    kebabCase(str) {
        if (!str) return '';
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
    },
    
    /**
     * Truncate string with ellipsis
     * @param {string} str - Input string
     * @param {number} maxLength - Maximum length
     * @returns {string}
     */
    truncate(str, maxLength = 50) {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength - 3) + '...';
    },
    
    /**
     * Strip HTML tags from string
     * @param {string} html - HTML string
     * @returns {string} Plain text
     */
    stripHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    },
    
    /**
     * Escape HTML special characters
     * @param {string} str - Input string
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    },
    
    /**
     * Get initials from a name
     * @param {string} name - Full name
     * @param {number} count - Number of initials
     * @returns {string}
     */
    getInitials(name, count = 2) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, count);
    },
    
    /**
     * Generate a random string
     * @param {number} length - String length
     * @returns {string}
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // ==========================================
    // NUMBER HELPERS
    // ==========================================
    
    /**
     * Format number with commas (Indian format)
     * @param {number} num - Number to format
     * @returns {string}
     */
    formatIndianNumber(num) {
        if (num === null || num === undefined) return '0';
        const x = num.toString();
        const lastThree = x.substring(x.length - 3);
        const otherNumbers = x.substring(0, x.length - 3);
        if (otherNumbers !== '') {
            return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
        }
        return lastThree;
    },
    
    /**
     * Format currency
     * @param {number} amount - Amount
     * @param {string} currency - Currency symbol
     * @returns {string}
     */
    formatCurrency(amount, currency = '₹') {
        if (amount === null || amount === undefined || isNaN(amount)) return currency + '0';
        return currency + this.formatIndianNumber(Math.round(amount));
    },
    
    /**
     * Format percentage
     * @param {number} value - Value
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    formatPercent(value, decimals = 1) {
        if (value === null || value === undefined) return '0%';
        return Number(value).toFixed(decimals) + '%';
    },
    
    /**
     * Round number to decimal places
     * @param {number} num - Number
     * @param {number} decimals - Decimal places
     * @returns {number}
     */
    round(num, decimals = 2) {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    },
    
    /**
     * Get a random integer between min and max
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number}
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Clamp a number between min and max
     * @param {number} num - Number
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number}
     */
    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },
    
    // ==========================================
    // DATE HELPERS
    // ==========================================
    
    /**
     * Format date as YYYY-MM-DD
     * @param {Date|string} date - Date to format
     * @returns {string}
     */
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    },
    
    /**
     * Format date as DD MMM YYYY
     * @param {Date|string} date - Date to format
     * @returns {string}
     */
    formatDateReadable(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },
    
    /**
     * Format date and time
     * @param {Date|string} date - Date to format
     * @returns {string}
     */
    formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    },
    
    /**
     * Format time only
     * @param {Date|string} date - Date to format
     * @returns {string}
     */
    formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    },
    
    /**
     * Get relative time (e.g., "2 hours ago")
     * @param {Date|string} date - Date to compare
     * @returns {string}
     */
    timeAgo(date) {
        if (!date) return '';
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);
        
        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHr < 24) return `${diffHr} hr ago`;
        if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    },
    
    /**
     * Get today's date as YYYY-MM-DD
     * @returns {string}
     */
    today() {
        return new Date().toISOString().slice(0, 10);
    },
    
    /**
     * Get date after N days
     * @param {number} days - Number of days
     * @returns {string} YYYY-MM-DD
     */
    daysFromNow(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    },
    
    /**
     * Get number of days between two dates
     * @param {Date|string} date1 - First date
     * @param {Date|string} date2 - Second date
     * @returns {number}
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    
    /**
     * Check if date is today
     * @param {Date|string} date - Date to check
     * @returns {boolean}
     */
    isToday(date) {
        if (!date) return false;
        return this.formatDate(date) === this.today();
    },
    
    /**
     * Check if date is in the past
     * @param {Date|string} date - Date to check
     * @returns {boolean}
     */
    isPast(date) {
        if (!date) return false;
        return new Date(date) < new Date();
    },
    
    // ==========================================
    // ARRAY / OBJECT HELPERS
    // ==========================================
    
    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }
        return clonedObj;
    },
    
    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
        const output = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (this.isObject(source[key]) && this.isObject(target[key])) {
                    output[key] = this.deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            }
        }
        return output;
    },
    
    /**
     * Check if value is a plain object
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    },
    
    /**
     * Check if value is empty (null, undefined, empty string, empty array, empty object)
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },
    
    /**
     * Get value from object by dot-notation path
     * @param {Object} obj - Object
     * @param {string} path - Dot notation path
     * @param {*} defaultValue - Default value
     * @returns {*}
     */
    getByPath(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result === null || result === undefined) return defaultValue;
            result = result[key];
        }
        return result !== undefined ? result : defaultValue;
    },
    
    /**
     * Set value in object by dot-notation path
     * @param {Object} obj - Object
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     */
    setByPath(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = obj;
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        target[lastKey] = value;
    },
    
    /**
     * Group array by key
     * @param {Array} arr - Array to group
     * @param {string} key - Key to group by
     * @returns {Object}
     */
    groupBy(arr, key) {
        return arr.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
        }, {});
    },
    
    /**
     * Sort array by key
     * @param {Array} arr - Array to sort
     * @param {string} key - Key to sort by
     * @param {string} direction - 'asc' or 'desc'
     * @returns {Array}
     */
    sortBy(arr, key, direction = 'asc') {
        return [...arr].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },
    
    /**
     * Remove duplicates from array by key
     * @param {Array} arr - Array
     * @param {string} key - Key to check
     * @returns {Array}
     */
    uniqueBy(arr, key) {
        const seen = new Set();
        return arr.filter(item => {
            const val = item[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
        });
    },
    
    /**
     * Chunk array into smaller arrays
     * @param {Array} arr - Array to chunk
     * @param {number} size - Chunk size
     * @returns {Array}
     */
    chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    },
    
    // ==========================================
    // FUNCTION HELPERS
    // ==========================================
    
    /**
     * Debounce a function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function}
     */
    debounce(fn, delay = 300) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },
    
    /**
     * Throttle a function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function}
     */
    throttle(fn, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Memoize a function (cache results)
     * @param {Function} fn - Function to memoize
     * @returns {Function}
     */
    memoize(fn) {
        const cache = new Map();
        return function(...args) {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            const result = fn.apply(this, args);
            cache.set(key, result);
            return result;
        };
    },
    
    /**
     * Execute function once only
     * @param {Function} fn - Function
     * @returns {Function}
     */
    once(fn) {
        let called = false;
        let result;
        return function(...args) {
            if (!called) {
                called = true;
                result = fn.apply(this, args);
            }
            return result;
        };
    },
    
    // ==========================================
    // STORAGE HELPERS
    // ==========================================
    
    /**
     * Safe localStorage get
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value
     * @returns {*}
     */
    storageGet(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return JSON.parse(value);
        } catch (e) {
            return defaultValue;
        }
    },
    
    /**
     * Safe localStorage set
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    storageSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('localStorage set failed:', key, e);
        }
    },
    
    /**
     * Safe localStorage remove
     * @param {string} key - Storage key
     */
    storageRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage remove failed:', key, e);
        }
    },
    
    // ==========================================
    // URL HELPERS
    // ==========================================
    
    /**
     * Get URL parameter
     * @param {string} name - Parameter name
     * @returns {string|null}
     */
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },
    
    /**
     * Get hash parameter
     * @param {string} name - Parameter name
     * @returns {string|null}
     */
    getHashParam(name) {
        const hash = window.location.hash;
        const queryString = hash.split('?')[1];
        if (!queryString) return null;
        const params = new URLSearchParams(queryString);
        return params.get(name);
    },
    
    /**
     * Update URL without reload
     * @param {Object} params - Parameters to set
     */
    updateUrlParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
        window.history.replaceState({}, '', url);
    },
    
    /**
     * Parse query string into object
     * @param {string} queryString - Query string
     * @returns {Object}
     */
    parseQueryString(queryString) {
        const params = new URLSearchParams(queryString);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },
    
    /**
     * Build query string from object
     * @param {Object} params - Parameters
     * @returns {string}
     */
    buildQueryString(params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.set(key, value);
            }
        });
        return searchParams.toString();
    },
    
    // ==========================================
    // VALIDATION HELPERS
    // ==========================================
    
    /**
     * Validate Indian mobile number
     * @param {string} mobile - Mobile number
     * @returns {boolean}
     */
    isValidMobile(mobile) {
        return /^[6-9]\d{9}$/.test(mobile);
    },
    
    /**
     * Validate email
     * @param {string} email - Email address
     * @returns {boolean}
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    /**
     * Validate GSTIN
     * @param {string} gstin - GSTIN number
     * @returns {boolean}
     */
    isValidGSTIN(gstin) {
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
    },
    
    /**
     * Validate PAN
     * @param {string} pan - PAN number
     * @returns {boolean}
     */
    isValidPAN(pan) {
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
    },
    
    /**
     * Validate pincode
     * @param {string} pincode - Pincode
     * @returns {boolean}
     */
    isValidPincode(pincode) {
        return /^\d{6}$/.test(pincode);
    },
    
    /**
     * Validate URL
     * @param {string} url - URL
     * @returns {boolean}
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    // ==========================================
    // MISC HELPERS
    // ==========================================
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>}
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    },
    
    /**
     * Download data as file
     * @param {string} data - File content
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>}
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    /**
     * Read file as JSON
     * @param {File} file - File to read
     * @returns {Promise<Object>}
     */
    async readFileAsJSON(file) {
        const text = await this.readFileAsText(file);
        return JSON.parse(text);
    },
    
    /**
     * Convert bytes to human readable
     * @param {number} bytes - Bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    },
    
    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * Retry a function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum retries
     * @param {number} baseDelay - Base delay in ms
     * @returns {Promise<*>}
     */
    async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < maxRetries) {
                    const delay = baseDelay * Math.pow(2, i);
                    await this.sleep(delay);
                }
            }
        }
        throw lastError;
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Helpers = Helpers;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
}

// ==========================================
// END OF HELPERS
// ==========================================

