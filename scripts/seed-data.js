/* ==========================================
   11 AVATAR DIGITAL HUB
   Seed Data Generator
   Version: 2.0 Enterprise
   ==========================================
   Purpose:
   - Generate realistic demo/sample data
   - Pre-populate collections for new installations
   - Create admin user profiles
   - Sample leads, clients, revenue entries
   - Demonstration pipeline stages
   - Test notifications and history
   - Default settings configuration
   ==========================================
   Run: node scripts/seed-data.js
   ========================================== */

// ==========================================
// CONFIGURATION
// ==========================================
const SEED_CONFIG = {
    admin: {
        email: '11avatardigitalhub@gmail.com',
        name: '11 Avatar Admin',
        role: 'platform_owner'
    },
    counts: {
        users: 5,
        leads: 25,
        clients: 8,
        revenue: 15,
        projects: 6,
        invoices: 10,
        tasks: 12,
        appointments: 8,
        campaigns: 4,
        training: 3,
        referrals: 6,
        history: 30,
        notifications: 10
    }
};

// ==========================================
// SAMPLE DATA GENERATORS
// ==========================================

/**
 * Generate random Indian name
 */
function generateIndianName() {
    const firstNames = [
        'Rajesh', 'Priya', 'Amit', 'Neha', 'Vikram', 'Suresh', 'Anita', 'Rahul',
        'Deepika', 'Sanjay', 'Pooja', 'Rakesh', 'Sunita', 'Arun', 'Kavita', 'Manoj',
        'Lakshmi', 'Vijay', 'Anjali', 'Sandeep', 'Meena', 'Dinesh', 'Rekha', 'Ganesh'
    ];
    const lastNames = [
        'Sharma', 'Kapoor', 'Mehta', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Verma',
        'Reddy', 'Nair', 'Joshi', 'Malhotra', 'Chopra', 'Saxena', 'Agarwal', 'Bose'
    ];
    return firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + 
           lastNames[Math.floor(Math.random() * lastNames.length)];
}

/**
 * Generate random Indian mobile number
 */
function generateMobile() {
    const prefixes = ['7', '8', '9'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    let number = prefix;
    for (let i = 0; i < 9; i++) {
        number += Math.floor(Math.random() * 10);
    }
    return number;
}

/**
 * Generate random Indian company name
 */
function generateCompany() {
    const companies = [
        'Sharma Realty', 'Kapoor Education', 'Mehta Manufacturing',
        'Patel Distributors', 'Singh Enterprises', 'Gupta Textiles',
        'Verma Pharmaceuticals', 'Reddy Constructions', 'Nair Technologies',
        'Joshi Financial Services', 'Malhotra Exports', 'Chopra Healthcare',
        'Agarwal Retail', 'Saxena Hospitality', 'Bose Logistics',
        'Kumar Automotive', 'Shah Electronics', 'Desai Foods'
    ];
    return companies[Math.floor(Math.random() * companies.length)];
}

/**
 * Generate random email from name
 */
function generateEmail(name) {
    const cleanName = name.toLowerCase().replace(/\s+/g, '.');
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'business.in'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${cleanName}@${domain}`;
}

/**
 * Generate random date within range
 */
function randomDate(start, end) {
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().slice(0, 10);
}

/**
 * Generate random amount
 */
function randomAmount(min, max) {
    return Math.round((Math.random() * (max - min) + min) / 1000) * 1000;
}

// ==========================================
// SEED DATA GENERATION
// ==========================================

/**
 * Generate users
 */
function generateUsers(count) {
    const users = [];
    
    // Admin user
    users.push({
        id: 'admin_001',
        uid: 'admin_001',
        email: SEED_CONFIG.admin.email,
        displayName: SEED_CONFIG.admin.name,
        role: 'platform_owner',
        clientId: null,
        permissions: ['all'],
        emailVerified: true,
        status: 'active',
        onboardingComplete: true,
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: new Date().toISOString()
    });
    
    // Client owners and team members
    for (let i = 0; i < count - 1; i++) {
        const name = generateIndianName();
        const role = i < 3 ? 'client_owner' : i < 4 ? 'client_admin' : 'executive';
        const clientId = i < 3 ? `client_${i + 1}` : `client_${Math.floor(i / 2)}`;
        
        users.push({
            id: `user_${i + 2}`,
            uid: `user_${i + 2}`,
            email: generateEmail(name),
            displayName: name,
            role: role,
            clientId: clientId,
            permissions: [],
            emailVerified: true,
            status: 'active',
            onboardingComplete: i < 2,
            createdAt: randomDate(new Date('2024-01-01'), new Date()),
            lastLogin: randomDate(new Date('2024-06-01'), new Date())
        });
    }
    
    return users;
}

/**
 * Generate leads
 */
function generateLeads(count) {
    const leads = [];
    const sources = ['WhatsApp', 'Website', 'Referral', 'Cold Calling', 'Facebook Ads', 'Google Ads', 'LinkedIn'];
    const services = ['SEO', 'Google Ads', 'Social Media', 'Website', 'Video Editing', 'CRO'];
    const statuses = ['New', 'Attempting Contact', 'Connected', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
    const statusWeights = [8, 5, 4, 3, 2, 1, 2, 3];
    
    // Build weighted status array
    const weightedStatuses = [];
    statuses.forEach((status, i) => {
        for (let j = 0; j < statusWeights[i]; j++) {
            weightedStatuses.push(status);
        }
    });
    
    for (let i = 0; i < count; i++) {
        const name = generateIndianName();
        const status = weightedStatuses[Math.floor(Math.random() * weightedStatuses.length)];
        const createdDate = randomDate(new Date('2024-01-01'), new Date());
        
        leads.push({
            id: `LD${String(i + 1).padStart(3, '0')}`,
            name: name,
            mobile: generateMobile(),
            email: generateEmail(name),
            business: generateCompany(),
            source: sources[Math.floor(Math.random() * sources.length)],
            service: services[Math.floor(Math.random() * services.length)],
            dealValue: randomAmount(10000, 500000),
            status: status,
            score: Math.floor(Math.random() * 100),
            notes: status === 'Won' ? 'Deal closed successfully!' : status === 'Lost' ? 'Client went with competitor' : '',
            followupDate: randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            lastContactDate: randomDate(new Date('2024-06-01'), new Date()),
            createdDate: createdDate,
            createdAt: createdDate,
            updatedAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return leads;
}

/**
 * Generate clients
 */
function generateClients(count) {
    const clients = [];
    
    for (let i = 0; i < count; i++) {
        const name = generateIndianName();
        const createdDate = randomDate(new Date('2024-01-01'), new Date());
        
        clients.push({
            id: `CL${String(i + 1).padStart(3, '0')}`,
            name: name,
            business: generateCompany(),
            mobile: generateMobile(),
            email: generateEmail(name),
            city: ['Mumbai', 'Delhi', 'Bangalore', 'Ahmedabad', 'Chennai', 'Pune', 'Hyderabad'][Math.floor(Math.random() * 7)],
            dealValue: randomAmount(50000, 500000),
            status: ['Active', 'Active', 'Active', 'Paused', 'Ended'][Math.floor(Math.random() * 5)],
            mrr: randomAmount(5000, 50000),
            renewalDate: randomDate(new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
            leadId: `LD${String(Math.floor(Math.random() * 25) + 1).padStart(3, '0')}`,
            createdDate: createdDate,
            createdAt: createdDate,
            updatedAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return clients;
}

/**
 * Generate revenue entries
 */
function generateRevenue(count) {
    const entries = [];
    const types = ['Payment', 'Payment', 'Payment', 'Retainer', 'Retainer', 'Project'];
    const sources = ['Client', 'Client', 'Referral', 'Training', 'Project'];
    
    for (let i = 0; i < count; i++) {
        const date = randomDate(new Date('2024-01-01'), new Date());
        
        entries.push({
            id: `REV${String(i + 1).padStart(3, '0')}`,
            client: generateIndianName(),
            amount: randomAmount(5000, 200000),
            date: date,
            type: types[Math.floor(Math.random() * types.length)],
            source: sources[Math.floor(Math.random() * sources.length)],
            createdAt: date,
            updatedAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    // Sort by date descending
    entries.sort((a, b) => b.date.localeCompare(a.date));
    
    return entries;
}

/**
 * Generate projects
 */
function generateProjects(count) {
    const projects = [];
    const statuses = ['Planning', 'In Progress', 'Review', 'Completed', 'On Hold'];
    
    for (let i = 0; i < count; i++) {
        const startDate = randomDate(new Date('2024-01-01'), new Date());
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        projects.push({
            id: `PRJ${String(i + 1).padStart(3, '0')}`,
            name: ['SEO', 'Google Ads', 'Social Media', 'Website', 'CRO', 'Video'][Math.floor(Math.random() * 6)] + ' Project',
            clientName: generateIndianName(),
            service: ['SEO', 'Google Ads', 'Social Media', 'Website', 'CRO'][Math.floor(Math.random() * 5)],
            startDate: startDate,
            dueDate: randomDate(new Date(startDate), new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
            status: status,
            progress: status === 'Completed' ? 100 : status === 'Review' ? 80 : status === 'In Progress' ? 50 : 10,
            createdAt: startDate,
            updatedAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return projects;
}

/**
 * Generate invoices
 */
function generateInvoices(count) {
    const invoices = [];
    const statuses = ['Paid', 'Paid', 'Paid', 'Pending', 'Pending', 'Overdue', 'Draft'];
    
    for (let i = 0; i < count; i++) {
        const date = randomDate(new Date('2024-01-01'), new Date());
        const amount = randomAmount(10000, 200000);
        const gstRate = [5, 12, 18, 28][Math.floor(Math.random() * 4)];
        const cgst = Math.round(amount * (gstRate / 2) / 100);
        const sgst = Math.round(amount * (gstRate / 2) / 100);
        
        invoices.push({
            id: `INV${String(i + 1).padStart(3, '0')}`,
            number: `INV-2024-${String(i + 1).padStart(3, '0')}`,
            date: date,
            dueDate: randomDate(new Date(date), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            client: generateIndianName(),
            gstin: `22AAAAA0000A${i + 1}Z5`,
            address: `${Math.floor(Math.random() * 999) + 1}, Business District, ${['Mumbai', 'Delhi', 'Bangalore'][Math.floor(Math.random() * 3)]}`,
            description: ['SEO Services', 'Google Ads Management', 'Social Media Campaign', 'Website Development', 'Consulting'][Math.floor(Math.random() * 5)],
            hsn: ['998313', '998314', '998315'][Math.floor(Math.random() * 3)],
            amount: amount,
            gstRate: gstRate,
            cgst: cgst,
            sgst: sgst,
            totalAmount: amount + cgst + sgst,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            createdAt: date,
            updatedAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return invoices;
}

/**
 * Generate tasks
 */
function generateTasks(count) {
    const tasks = [];
    const priorities = ['High', 'Medium', 'Low'];
    
    for (let i = 0; i < count; i++) {
        const dueDate = randomDate(new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
        
        tasks.push({
            id: `TSK${String(i + 1).padStart(3, '0')}`,
            title: ['Follow up with lead', 'Send proposal', 'Schedule meeting', 'Review contract', 'Prepare invoice', 'Client onboarding', 'Team meeting', 'Report generation'][Math.floor(Math.random() * 8)],
            description: 'Task description here...',
            dueDate: dueDate,
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            status: Math.random() > 0.3 ? 'Pending' : 'Completed',
            relatedType: Math.random() > 0.5 ? 'lead' : 'client',
            relatedName: generateIndianName(),
            createdAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return tasks;
}

/**
 * Generate appointments
 */
function generateAppointments(count) {
    const appointments = [];
    
    for (let i = 0; i < count; i++) {
        const date = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
        const hour = Math.floor(Math.random() * 8) + 9; // 9 AM to 5 PM
        
        appointments.push({
            id: `APT${String(i + 1).padStart(3, '0')}`,
            title: ['Discovery Call', 'Proposal Presentation', 'Contract Discussion', 'Review Meeting', 'Onboarding Call'][Math.floor(Math.random() * 5)],
            with: generateIndianName(),
            date: date,
            time: `${String(hour).padStart(2, '0')}:${['00', '30'][Math.floor(Math.random() * 2)]}`,
            duration: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
            status: date < new Date().toISOString().slice(0, 10) ? 'Completed' : 'Upcoming',
            notes: 'Meeting agenda to be prepared',
            createdAt: new Date().toISOString(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    return appointments;
}

/**
 * Generate history entries
 */
function generateHistory(count) {
    const entries = [];
    const types = ['call', 'whatsapp', 'meeting', 'lead', 'revenue', 'won', 'lost', 'followup'];
    const icons = { call: '📞', whatsapp: '💬', meeting: '📅', lead: '📋', revenue: '💰', won: '🏆', lost: '❌', followup: '🔄' };
    
    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const date = randomDate(new Date('2024-06-01'), new Date());
        
        entries.push({
            id: `HST${String(i + 1).padStart(3, '0')}`,
            type: type,
            desc: `${icons[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}: ${generateIndianName()}`,
            date: date,
            timestamp: new Date(date + 'T' + String(Math.floor(Math.random() * 12) + 8).padStart(2, '0') + ':00:00Z').toISOString(),
            userId: `user_${Math.floor(Math.random() * 5) + 1}`,
            leadId: Math.random() > 0.5 ? `LD${String(Math.floor(Math.random() * 25) + 1).padStart(3, '0')}` : null,
            leadName: generateIndianName(),
            clientId: `client_${Math.floor(Math.random() * 3) + 1}`
        });
    }
    
    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return entries;
}

/**
 * Generate notifications
 */
function generateNotifications(count) {
    const notifications = [];
    
    for (let i = 0; i < count; i++) {
        notifications.push({
            id: `NOT${String(i + 1).padStart(3, '0')}`,
            userId: `user_${Math.floor(Math.random() * 5) + 1}`,
            type: ['info', 'success', 'warning'][Math.floor(Math.random() * 3)],
            title: ['New lead assigned', 'Payment received', 'Meeting reminder', 'Task due', 'Deal won!'][Math.floor(Math.random() * 5)],
            message: 'Notification details here...',
            read: Math.random() > 0.5,
            createdAt: randomDate(new Date('2024-07-01'), new Date()),
            data: '{}'
        });
    }
    
    return notifications;
}

/**
 * Generate default settings
 */
function generateSettings(userId) {
    return {
        id: `set_${userId}`,
        userId: userId,
        goal: 70000,
        currency: '₹',
        tax: 18,
        serviceFee: 20,
        discount: 0,
        roundUp: true,
        callTarget: 30,
        followupTarget: 10,
        meetingTarget: 2,
        followupDays: 2,
        autoBackup: true,
        emailNotifications: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// ==========================================
// BUILD COMPLETE SEED DATA
// ==========================================

const seedData = {
    _metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0.0',
        description: 'Sample data for 11 Avatar Digital Hub CRM',
        totalRecords: 0
    },
    users: generateUsers(SEED_CONFIG.counts.users),
    leads: generateLeads(SEED_CONFIG.counts.leads),
    clients: generateClients(SEED_CONFIG.counts.clients),
    revenue: generateRevenue(SEED_CONFIG.counts.revenue),
    projects: generateProjects(SEED_CONFIG.counts.projects),
    invoices: generateInvoices(SEED_CONFIG.counts.invoices),
    tasks: generateTasks(SEED_CONFIG.counts.tasks),
    appointments: generateAppointments(SEED_CONFIG.counts.appointments),
    history: generateHistory(SEED_CONFIG.counts.history),
    notifications: generateNotifications(SEED_CONFIG.counts.notifications),
    settings: SEED_CONFIG.counts.users ? [generateSettings('admin_001')] : []
};

// Calculate total records
seedData._metadata.totalRecords = Object.values(seedData).reduce((sum, val) => {
    return sum + (Array.isArray(val) ? val.length : 0);
}, 0);

// ==========================================
// OUTPUT
// ==========================================

// Pretty print the seed data
console.log('🌱 Seed Data Generated Successfully!');
console.log('====================================');
console.log('📊 Collections Generated:');
console.log(`  👥 Users:        ${seedData.users.length}`);
console.log(`  📋 Leads:        ${seedData.leads.length}`);
console.log(`  👤 Clients:      ${seedData.clients.length}`);
console.log(`  💰 Revenue:      ${seedData.revenue.length}`);
console.log(`  🚀 Projects:     ${seedData.projects.length}`);
console.log(`  🧾 Invoices:     ${seedData.invoices.length}`);
console.log(`  ✅ Tasks:        ${seedData.tasks.length}`);
console.log(`  📅 Appointments: ${seedData.appointments.length}`);
console.log(`  📜 History:      ${seedData.history.length}`);
console.log(`  🔔 Notifications: ${seedData.notifications.length}`);
console.log(`  ⚙️  Settings:     ${seedData.settings.length}`);
console.log('====================================');
console.log(`📦 TOTAL RECORDS: ${seedData._metadata.totalRecords}`);
console.log('====================================');

// Export for use in Firebase/scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { seedData, SEED_CONFIG };
}

// For direct execution
if (typeof window !== 'undefined') {
    window.SeedData = seedData;
}

// ==========================================
// END OF SEED DATA GENERATOR
// ==========================================
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
