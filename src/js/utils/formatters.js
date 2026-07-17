/* ==========================================
   11 AVATAR DIGITAL HUB
   Data Formatters Utility
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Currency formatting (Indian & International)
   - Date & time formatting
   - Number formatting
   - GST calculation
   - Invoice number generation
   - Status label formatting
   - Phone number formatting
   - Address formatting
   - File size formatting
   - Percentage formatting
   ========================================== */

const Formatters = {

    // ==========================================
    // CURRENCY FORMATTING
    // ==========================================

    /**
     * Format amount in Indian Rupees (with Indian number system)
     * @param {number} amount - The amount to format
     * @param {Object} options - Formatting options
     * @param {boolean} options.showSymbol - Show ₹ symbol (default: true)
     * @param {boolean} options.showPaise - Show decimal paise (default: false)
     * @param {string} options.symbol - Custom currency symbol (default: '₹')
     * @returns {string} Formatted currency string
     * @example
     * Formatters.currency(50000)                    // "₹50,000"
     * Formatters.currency(125000.50)                // "₹1,25,000"
     * Formatters.currency(50000, {showSymbol:false}) // "50,000"
     */
    currency(amount, options = {}) {
        const {
            showSymbol = true,
            showPaise = false,
            symbol = '₹'
        } = options;

        if (amount === null || amount === undefined || isNaN(amount)) {
            return showSymbol ? symbol + '0' : '0';
        }

        const num = Math.abs(amount);
        const isNegative = amount < 0;
        const prefix = isNegative ? '-' : '';

        let formatted;

        if (showPaise) {
            formatted = this.indianNumberFormat(num);
        } else {
            formatted = this.indianNumberFormat(Math.round(num));
        }

        return prefix + (showSymbol ? symbol : '') + formatted;
    },

    /**
     * Format amount in Indian Number System (with commas)
     * Indian system: 1,00,000 (1 Lakh), 10,00,000 (10 Lakh), 1,00,00,000 (1 Crore)
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     * @example
     * Formatters.indianNumberFormat(50000)     // "50,000"
     * Formatters.indianNumberFormat(125000)    // "1,25,000"
     * Formatters.indianNumberFormat(10000000)  // "1,00,00,000"
     */
    indianNumberFormat(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';

        const parts = num.toString().split('.');
        const integerPart = parts[0];
        const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

        const lastThree = integerPart.substring(integerPart.length - 3);
        const otherNumbers = integerPart.substring(0, integerPart.length - 3);

        if (otherNumbers !== '') {
            return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree + decimalPart;
        }

        return lastThree + decimalPart;
    },

    /**
     * Format amount in words (Indian system)
     * @param {number} amount - Amount to convert
     * @returns {string} Amount in words
     * @example
     * Formatters.amountToWords(50000) // "Fifty Thousand Rupees Only"
     */
    amountToWords(amount) {
        if (!amount || amount === 0) return 'Zero Rupees Only';

        const num = Math.round(amount);
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                      'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        function convertHundreds(n) {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertHundreds(n % 100) : '');
        }

        function convertToWords(n) {
            if (n === 0) return '';
            if (n < 100) return convertHundreds(n);
            if (n < 1000) return convertHundreds(n);
            if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
            if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
            return convertToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
        }

        return convertToWords(num) + ' Rupees Only';
    },

    /**
     * Format amount in short form (K, L, Cr)
     * @param {number} amount - Amount to format
     * @returns {string} Short formatted amount
     * @example
     * Formatters.currencyShort(50000)    // "₹50K"
     * Formatters.currencyShort(500000)   // "₹5L"
     * Formatters.currencyShort(5000000)  // "₹50L"
     * Formatters.currencyShort(50000000) // "₹5Cr"
     */
    currencyShort(amount) {
        if (amount === null || amount === undefined) return '₹0';

        const absAmount = Math.abs(amount);

        if (absAmount >= 10000000) {
            return '₹' + (absAmount / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
        }
        if (absAmount >= 100000) {
            return '₹' + (absAmount / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
        }
        if (absAmount >= 1000) {
            return '₹' + (absAmount / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return '₹' + absAmount;
    },

    // ==========================================
    // DATE & TIME FORMATTING
    // ==========================================

    /**
     * Format date to DD MMM YYYY (e.g., "15 Jul 2024")
     * @param {Date|string|number} date - Date to format
     * @param {string} fallback - Fallback text if date is invalid
     * @returns {string} Formatted date
     */
    date(date, fallback = '-') {
        if (!date) return fallback;
        const d = new Date(date);
        if (isNaN(d.getTime())) return fallback;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    /**
     * Format date to DD/MM/YYYY
     * @param {Date|string|number} date - Date to format
     * @returns {string} Formatted date
     */
    dateShort(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },

    /**
     * Format date to YYYY-MM-DD (ISO format)
     * @param {Date|string|number} date - Date to format
     * @returns {string} ISO date string
     */
    dateISO(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    },

    /**
     * Format date with time (e.g., "15 Jul 2024, 10:30 AM")
     * @param {Date|string|number} date - Date to format
     * @returns {string} Formatted date and time
     */
    dateTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return this.date(d) + ', ' + this.time(d);
    },

    /**
     * Format time only (e.g., "10:30 AM")
     * @param {Date|string|number} date - Date to format
     * @returns {string} Formatted time
     */
    time(date) {
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
     * Format time in 24-hour format (e.g., "14:30")
     * @param {Date|string|number} date - Date to format
     * @returns {string} Formatted time
     */
    time24(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    /**
     * Get relative time description
     * @param {Date|string|number} date - Date to compare
     * @returns {string} Relative time
     */
    relativeTime(date) {
        if (!date) return '';
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 10) return 'Just now';
        if (diffSec < 60) return `${diffSec} sec ago`;
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHr === 1) return '1 hour ago';
        if (diffHr < 24) return `${diffHr} hours ago`;
        if (diffDay === 1) return 'Yesterday';
        if (diffDay < 7) return `${diffDay} days ago`;
        if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
        if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    },

    /**
     * Format date as day with ordinal (e.g., "15th July 2024")
     * @param {Date|string|number} date - Date to format
     * @returns {string} Formatted date with ordinal
     */
    dateOrdinal(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const day = d.getDate();
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

        let ordinal = 'th';
        if (day % 10 === 1 && day !== 11) ordinal = 'st';
        if (day % 10 === 2 && day !== 12) ordinal = 'nd';
        if (day % 10 === 3 && day !== 13) ordinal = 'rd';

        return `${day}${ordinal} ${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    // ==========================================
    // NUMBER FORMATTING
    // ==========================================

    /**
     * Format number with commas (International system)
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    number(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('en-IN');
    },

    /**
     * Format percentage
     * @param {number} value - Value (0-100)
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted percentage
     */
    percent(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        return Number(value).toFixed(decimals) + '%';
    },

    /**
     * Format decimal number
     * @param {number} num - Number to format
     * @param {number} places - Decimal places
     * @returns {string} Formatted decimal
     */
    decimal(num, places = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return Number(num).toFixed(places);
    },

    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    fileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    },

    // ==========================================
    // GST CALCULATION
    // ==========================================

    /**
     * Calculate GST amounts
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate (default: 18)
     * @returns {Object} GST calculation
     */
    calculateGST(amount, gstRate = 18) {
        const base = parseFloat(amount) || 0;
        const rate = parseFloat(gstRate) || 0;
        const halfRate = rate / 2;
        const cgst = Math.round(base * halfRate / 100);
        const sgst = Math.round(base * halfRate / 100);
        const totalGST = cgst + sgst;
        const total = base + totalGST;

        return {
            base: base,
            gstRate: rate,
            cgst: cgst,
            sgst: sgst,
            totalGST: totalGST,
            total: total,
            cgstFormatted: this.currency(cgst),
            sgstFormatted: this.currency(sgst),
            totalFormatted: this.currency(total)
        };
    },

    // ==========================================
    // ID & NUMBER GENERATION
    // ==========================================

    /**
     * Generate invoice number
     * @param {number} sequence - Sequence number
     * @param {string} prefix - Prefix (default: 'INV')
     * @returns {string} Invoice number
     * @example
     * Formatters.generateInvoiceNumber(1) // "INV-2024-001"
     */
    generateInvoiceNumber(sequence, prefix = 'INV') {
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
    },

    /**
     * Generate lead ID
     * @param {number} sequence - Sequence number
     * @returns {string} Lead ID
     */
    generateLeadId(sequence) {
        return 'LD' + String(sequence).padStart(4, '0');
    },

    /**
     * Generate client ID
     * @param {number} sequence - Sequence number
     * @returns {string} Client ID
     */
    generateClientId(sequence) {
        return 'CL' + String(sequence).padStart(4, '0');
    },

    // ==========================================
    // STATUS & LABEL FORMATTING
    // ==========================================

    /**
     * Get status label with proper formatting
     * @param {string} status - Status value
     * @param {string} type - Status type ('lead', 'client', 'invoice', 'project')
     * @returns {Object} Status info with label, icon, color
     */
    statusInfo(status, type = 'lead') {
        const statusMap = {
            lead: {
                'New': { label: 'New', icon: '🆕', color: '#3B82F6' },
                'Attempting Contact': { label: 'Contacting', icon: '📞', color: '#6366F1' },
                'Connected': { label: 'Connected', icon: '🔗', color: '#8B5CF6' },
                'Qualified': { label: 'Qualified', icon: '✅', color: '#10B981' },
                'Proposal Sent': { label: 'Proposal', icon: '📄', color: '#D4AF37' },
                'Negotiation': { label: 'Negotiating', icon: '🤝', color: '#F59E0B' },
                'Won': { label: 'Won', icon: '🏆', color: '#059669' },
                'Lost': { label: 'Lost', icon: '❌', color: '#EF4444' }
            },
            client: {
                'Active': { label: 'Active', icon: '✅', color: '#10B981' },
                'Paused': { label: 'Paused', icon: '⏸️', color: '#F59E0B' },
                'Ended': { label: 'Ended', icon: '🏁', color: '#EF4444' }
            },
            invoice: {
                'Paid': { label: 'Paid', icon: '✅', color: '#10B981' },
                'Pending': { label: 'Pending', icon: '⏳', color: '#F59E0B' },
                'Overdue': { label: 'Overdue', icon: '⚠️', color: '#EF4444' },
                'Draft': { label: 'Draft', icon: '📝', color: '#6B7280' }
            },
            project: {
                'Planning': { label: 'Planning', icon: '📋', color: '#3B82F6' },
                'In Progress': { label: 'In Progress', icon: '🚀', color: '#F59E0B' },
                'Review': { label: 'Review', icon: '🔍', color: '#8B5CF6' },
                'Completed': { label: 'Completed', icon: '✅', color: '#10B981' },
                'On Hold': { label: 'On Hold', icon: '⏸️', color: '#EF4444' }
            }
        };

        const typeMap = statusMap[type] || {};
        return typeMap[status] || { label: status || 'Unknown', icon: '📌', color: '#888' };
    },

    /**
     * Get priority info
     * @param {string} priority - Priority value
     * @returns {Object} Priority info
     */
    priorityInfo(priority) {
        const map = {
            'High': { label: 'High', icon: '🔴', color: '#EF4444' },
            'Medium': { label: 'Medium', icon: '🟡', color: '#F59E0B' },
            'Low': { label: 'Low', icon: '🟢', color: '#10B981' }
        };
        return map[priority] || { label: priority || 'Medium', icon: '⚪', color: '#888' };
    },

    // ==========================================
    // PHONE & ADDRESS FORMATTING
    // ==========================================

    /**
     * Format Indian mobile number (e.g., "+91 98765 43210")
     * @param {string} mobile - 10-digit mobile number
     * @returns {string} Formatted mobile
     */
    phone(mobile) {
        if (!mobile) return '';
        const cleaned = mobile.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
        }
        return mobile;
    },

    /**
     * Format address to single line
     * @param {Object} address - Address object
     * @returns {string} Formatted address
     */
    address(address) {
        if (!address) return '';
        const parts = [
            address.line1,
            address.line2,
            address.city,
            address.state,
            address.pincode
        ].filter(Boolean);
        return parts.join(', ');
    },

    // ==========================================
    // NAME FORMATTING
    // ==========================================

    /**
     * Get initials from name
     * @param {string} name - Full name
     * @param {number} count - Number of initials (default: 2)
     * @returns {string} Uppercase initials
     */
    initials(name, count = 2) {
        if (!name) return '?';
        return name.split(' ')
            .map(n => n.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, count);
    },

    /**
     * Format full name (title case)
     * @param {string} firstName - First name
     * @param {string} lastName - Last name
     * @returns {string} Full name
     */
    fullName(firstName, lastName) {
        const first = (firstName || '').trim();
        const last = (lastName || '').trim();
        if (first && last) return `${first} ${last}`;
        return first || last || '';
    },

    // ==========================================
    // DURATION FORMATTING
    // ==========================================

    /**
     * Format duration in minutes to human readable
     * @param {number} minutes - Duration in minutes
     * @returns {string} Formatted duration
     */
    duration(minutes) {
        if (!minutes || minutes <= 0) return '0 min';
        if (minutes < 60) return `${minutes} min`;
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
        return `${hrs} hr ${mins} min`;
    }
};

// ==========================================
// EXPORT
// ==========================================
if (typeof window !== 'undefined') {
    window.Formatters = Formatters;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatters;
}

// ==========================================
// END OF FORMATTERS
// ==========================================


