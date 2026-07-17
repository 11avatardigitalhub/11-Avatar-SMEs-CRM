/* ==========================================
   11 AVATAR DIGITAL HUB
   Form & Data Validators
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Form field validation
   - Data type validation
   - Business rule validation
   - Custom validation rules
   - Real-time validation feedback
   - Error message generation
   - Form-level validation
   ========================================== */

const Validators = {

    // ==========================================
    // REQUIRED FIELD VALIDATION
    // ==========================================

    /**
     * Check if value is not empty
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    required(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    },

    /**
     * Get required error message
     * @param {string} fieldName - Field display name
     * @returns {string}
     */
    requiredMessage(fieldName) {
        return `${fieldName || 'This field'} is required`;
    },

    // ==========================================
    // STRING VALIDATION
    // ==========================================

    /**
     * Validate minimum length
     * @param {string} value - String value
     * @param {number} min - Minimum length
     * @returns {boolean}
     */
    minLength(value, min) {
        if (!value) return false;
        return value.trim().length >= min;
    },

    /**
     * Validate maximum length
     * @param {string} value - String value
     * @param {number} max - Maximum length
     * @returns {boolean}
     */
    maxLength(value, max) {
        if (!value) return true;
        return value.trim().length <= max;
    },

    /**
     * Validate string length range
     * @param {string} value - String value
     * @param {number} min - Minimum length
     * @param {number} max - Maximum length
     * @returns {boolean}
     */
    lengthBetween(value, min, max) {
        if (!value) return !min;
        const len = value.trim().length;
        return len >= min && len <= max;
    },

    /**
     * Validate string matches pattern
     * @param {string} value - String value
     * @param {RegExp} pattern - Regular expression
     * @returns {boolean}
     */
    pattern(value, pattern) {
        if (!value) return false;
        return pattern.test(value);
    },

    // ==========================================
    // EMAIL VALIDATION
    // ==========================================

    /**
     * Validate email format
     * @param {string} email - Email address
     * @returns {boolean}
     */
    email(email) {
        if (!email) return false;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
    },

    /**
     * Validate email with detailed check
     * @param {string} email - Email address
     * @returns {Object} Validation result with reason
     */
    emailDetailed(email) {
        if (!email || !email.trim()) {
            return { valid: false, message: 'Email address is required' };
        }

        const trimmed = email.trim();

        if (trimmed.length > 254) {
            return { valid: false, message: 'Email address is too long' };
        }

        if (!trimmed.includes('@')) {
            return { valid: false, message: 'Email must contain @ symbol' };
        }

        const [localPart, domain] = trimmed.split('@');

        if (!localPart || localPart.length > 64) {
            return { valid: false, message: 'Invalid email local part' };
        }

        if (!domain || !domain.includes('.')) {
            return { valid: false, message: 'Invalid email domain' };
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(trimmed)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }

        return { valid: true, message: 'Valid email' };
    },

    // ==========================================
    // MOBILE VALIDATION
    // ==========================================

    /**
     * Validate Indian mobile number (10 digits, starts with 6-9)
     * @param {string} mobile - Mobile number
     * @returns {boolean}
     */
    mobile(mobile) {
        if (!mobile) return false;
        const cleaned = mobile.replace(/\D/g, '');
        return /^[6-9]\d{9}$/.test(cleaned);
    },

    /**
     * Validate mobile with detailed check
     * @param {string} mobile - Mobile number
     * @returns {Object} Validation result
     */
    mobileDetailed(mobile) {
        if (!mobile || !mobile.trim()) {
            return { valid: false, message: 'Mobile number is required' };
        }

        const cleaned = mobile.replace(/\D/g, '');

        if (cleaned.length !== 10) {
            return { valid: false, message: 'Mobile must be exactly 10 digits' };
        }

        if (!/^[6-9]/.test(cleaned)) {
            return { valid: false, message: 'Mobile must start with 6, 7, 8, or 9' };
        }

        if (!/^\d{10}$/.test(cleaned)) {
            return { valid: false, message: 'Mobile must contain only digits' };
        }

        return { valid: true, message: 'Valid mobile' };
    },

    // ==========================================
    // PASSWORD VALIDATION
    // ==========================================

    /**
     * Validate password strength
     * @param {string} password - Password
     * @param {Object} options - Validation options
     * @returns {Object} Validation result with strength
     */
    password(password, options = {}) {
        const {
            minLength = 8,
            requireUppercase = true,
            requireLowercase = true,
            requireNumber = true,
            requireSpecial = true
        } = options;

        if (!password) {
            return { valid: false, strength: 'none', message: 'Password is required' };
        }

        const checks = {
            length: password.length >= minLength,
            uppercase: !requireUppercase || /[A-Z]/.test(password),
            lowercase: !requireLowercase || /[a-z]/.test(password),
            number: !requireNumber || /[0-9]/.test(password),
            special: !requireSpecial || /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const passedCount = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;

        let strength;
        if (passedCount <= 2) strength = 'weak';
        else if (passedCount <= 4) strength = 'medium';
        else strength = 'strong';

        const messages = [];
        if (!checks.length) messages.push(`At least ${minLength} characters`);
        if (!checks.uppercase) messages.push('One uppercase letter');
        if (!checks.lowercase) messages.push('One lowercase letter');
        if (!checks.number) messages.push('One number');
        if (!checks.special) messages.push('One special character');

        return {
            valid: passedCount === totalChecks,
            strength,
            checks,
            passedCount,
            totalChecks,
            message: messages.length > 0 ? messages[0] : 'Password is strong',
            allMessages: messages
        };
    },

    /**
     * Check if passwords match
     * @param {string} password - Password
     * @param {string} confirmPassword - Confirm password
     * @returns {Object} Validation result
     */
    passwordMatch(password, confirmPassword) {
        if (!confirmPassword) {
            return { valid: false, message: 'Please confirm your password' };
        }
        if (password !== confirmPassword) {
            return { valid: false, message: 'Passwords do not match' };
        }
        return { valid: true, message: 'Passwords match' };
    },

    // ==========================================
    // NAME VALIDATION
    // ==========================================

    /**
     * Validate person name
     * @param {string} name - Person name
     * @param {Object} options - Options
     * @returns {boolean}
     */
    name(name, options = {}) {
        const { minLength = 2, maxLength = 100 } = options;
        if (!name || !name.trim()) return false;
        const trimmed = name.trim();
        return trimmed.length >= minLength && trimmed.length <= maxLength;
    },

    /**
     * Validate business/company name
     * @param {string} name - Business name
     * @returns {boolean}
     */
    businessName(name) {
        if (!name || !name.trim()) return true; // Optional field
        return name.trim().length <= 200;
    },

    // ==========================================
    // NUMBER VALIDATION
    // ==========================================

    /**
     * Validate number is within range
     * @param {number} value - Number value
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {boolean}
     */
    numberRange(value, min, max) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (min !== undefined && num < min) return false;
        if (max !== undefined && num > max) return false;
        return true;
    },

    /**
     * Validate positive number
     * @param {number} value - Number value
     * @returns {boolean}
     */
    positiveNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },

    /**
     * Validate percentage (0-100)
     * @param {number} value - Percentage value
     * @returns {boolean}
     */
    percentage(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 100;
    },

    // ==========================================
    // GST & TAX VALIDATION
    // ==========================================

    /**
     * Validate GSTIN format
     * @param {string} gstin - GSTIN number
     * @returns {boolean}
     */
    gstin(gstin) {
        if (!gstin) return true; // Optional field
        const cleaned = gstin.trim().toUpperCase();
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned);
    },

    /**
     * Validate PAN format
     * @param {string} pan - PAN number
     * @returns {boolean}
     */
    pan(pan) {
        if (!pan) return true;
        const cleaned = pan.trim().toUpperCase();
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned);
    },

    // ==========================================
    // ADDRESS VALIDATION
    // ==========================================

    /**
     * Validate Indian pincode
     * @param {string} pincode - Pincode
     * @returns {boolean}
     */
    pincode(pincode) {
        if (!pincode) return true;
        const cleaned = pincode.replace(/\D/g, '');
        return /^\d{6}$/.test(cleaned);
    },

    // ==========================================
    // URL VALIDATION
    // ==========================================

    /**
     * Validate URL format
     * @param {string} url - URL string
     * @returns {boolean}
     */
    url(url) {
        if (!url) return true; // Optional field
        try {
            const urlObj = new URL(url);
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch {
            return /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/.test(url);
        }
    },

    // ==========================================
    // DATE VALIDATION
    // ==========================================

    /**
     * Validate date string format (YYYY-MM-DD)
     * @param {string} dateStr - Date string
     * @returns {boolean}
     */
    date(dateStr) {
        if (!dateStr) return true;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime());
    },

    /**
     * Validate date is not in the past
     * @param {string} dateStr - Date string
     * @returns {boolean}
     */
    futureDate(dateStr) {
        if (!dateStr) return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d >= today;
    },

    /**
     * Validate date range (from <= to)
     * @param {string} fromDate - From date
     * @param {string} toDate - To date
     * @returns {boolean}
     */
    dateRange(fromDate, toDate) {
        if (!fromDate || !toDate) return true;
        return new Date(fromDate) <= new Date(toDate);
    },

    // ==========================================
    // FILE VALIDATION
    // ==========================================

    /**
     * Validate file size
     * @param {File} file - File object
     * @param {number} maxSizeMB - Maximum size in MB
     * @returns {boolean}
     */
    fileSize(file, maxSizeMB = 5) {
        if (!file) return true;
        const maxBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxBytes;
    },

    /**
     * Validate file type
     * @param {File} file - File object
     * @param {string[]} allowedTypes - Allowed MIME types or extensions
     * @returns {boolean}
     */
    fileType(file, allowedTypes = []) {
        if (!file || allowedTypes.length === 0) return true;
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();

        return allowedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileName.endsWith(type);
            }
            return fileType === type || fileType.includes(type);
        });
    },

    // ==========================================
    // FORM VALIDATION
    // ==========================================

    /**
     * Validate a single field against rules
     * @param {*} value - Field value
     * @param {Array} rules - Array of validation rules
     * @returns {Object} Validation result
     * @example
     * Validators.validateField('test@email.com', [
     *   { type: 'required', message: 'Email is required' },
     *   { type: 'email', message: 'Invalid email format' }
     * ])
     */
    validateField(value, rules = []) {
        for (const rule of rules) {
            const { type, message, ...options } = rule;

            let valid = true;

            switch (type) {
                case 'required':
                    valid = this.required(value);
                    break;
                case 'email':
                    valid = this.email(value);
                    break;
                case 'mobile':
                    valid = this.mobile(value);
                    break;
                case 'minLength':
                    valid = this.minLength(value, options.min);
                    break;
                case 'maxLength':
                    valid = this.maxLength(value, options.max);
                    break;
                case 'pattern':
                    valid = this.pattern(value, options.regex);
                    break;
                case 'numberRange':
                    valid = this.numberRange(value, options.min, options.max);
                    break;
                case 'positiveNumber':
                    valid = this.positiveNumber(value);
                    break;
                case 'password':
                    valid = this.password(value, options).valid;
                    break;
                case 'gstin':
                    valid = this.gstin(value);
                    break;
                case 'pincode':
                    valid = this.pincode(value);
                    break;
                case 'url':
                    valid = this.url(value);
                    break;
                case 'date':
                    valid = this.date(value);
                    break;
                case 'custom':
                    valid = options.validator ? options.validator(value) : true;
                    break;
                default:
                    valid = true;
            }

            if (!valid) {
                return { valid: false, message: message || 'Invalid value', rule: type };
            }
        }

        return { valid: true, message: 'Valid' };
    },

    /**
     * Validate entire form against schema
     * @param {Object} formData - Form data object
     * @param {Object} schema - Validation schema
     * @returns {Object} Validation result with all errors
     * @example
     * Validators.validateForm(
     *   { email: 'test@test.com', password: '123' },
     *   {
     *     email: [
     *       { type: 'required', message: 'Email required' },
     *       { type: 'email', message: 'Invalid email' }
     *     ],
     *     password: [
     *       { type: 'required', message: 'Password required' },
     *       { type: 'minLength', min: 8, message: 'Min 8 characters' }
     *     ]
     *   }
     * )
     */
    validateForm(formData, schema) {
        const errors = {};
        let isValid = true;

        for (const [field, rules] of Object.entries(schema)) {
            const value = formData[field];
            const result = this.validateField(value, rules);

            if (!result.valid) {
                errors[field] = result.message;
                isValid = false;
            }
        }

        return {
            valid: isValid,
            errors: errors,
            errorCount: Object.keys(errors).length,
            firstError: Object.values(errors)[0] || null
        };
    },

    // ==========================================
    // BUSINESS RULES
    // ==========================================

    /**
     * Validate deal value is reasonable
     * @param {number} value - Deal value
     * @returns {boolean}
     */
    dealValue(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        return num >= 1000 && num <= 100000000; // ₹1,000 to ₹10 Crore
    },

    /**
     * Validate discount percentage
     * @param {number} value - Discount percentage
     * @returns {boolean}
     */
    discount(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        return num >= 0 && num <= 100;
    },

    /**
     * Validate GST rate
     * @param {number} rate - GST rate
     * @returns {boolean}
     */
    gstRate(rate) {
        const validRates = [0, 0.25, 3, 5, 12, 18, 28];
        return validRates.includes(parseFloat(rate));
    },

    // ==========================================
    // UTILITY
    // ==========================================

    /**
     * Check if all fields in object are valid
     * @param {Object} validationResults - Results from validateForm
     * @returns {boolean}
     */
    isFormValid(validationResults) {
        return validationResults && validationResults.valid === true;
    },

    /**
     * Get first error message from validation
     * @param {Object} validationResults - Results from validateForm
     * @returns {string|null}
     */
    getFirstError(validationResults) {
        return validationResults ? validationResults.firstError : null;
    },

    /**
     * Get error for specific field
     * @param {Object} validationResults - Results from validateForm
     * @param {string} fieldName - Field name
     * @returns {string|null}
     */
    getFieldError(validationResults, fieldName) {
        return validationResults?.errors?.[fieldName] || null;
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Validators = Validators;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
}

// ==========================================
// END OF VALIDATORS
// ==========================================

