-- ==========================================
-- 11 AVATAR DIGITAL HUB
-- Database Schema - Cloudflare D1 (SQLite)
-- Version: 2.0 Enterprise
-- ==========================================
-- Purpose:
-- - Relational database for structured queries
-- - Analytics & reporting data
-- - Search indexing
-- - Audit logging
-- - User sessions
-- ==========================================

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'client_owner',
    client_id TEXT,
    permissions TEXT DEFAULT '[]',
    email_verified INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    onboarding_complete INTEGER DEFAULT 0,
    provider TEXT DEFAULT 'email',
    preferences TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_users_status ON users(status);

-- ==========================================
-- CLIENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business TEXT,
    mobile TEXT,
    email TEXT,
    city TEXT,
    deal_value REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    lead_id TEXT,
    client_owner_id TEXT,
    mrr REAL DEFAULT 0,
    renewal_date TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (client_owner_id) REFERENCES users(id)
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_client_owner ON clients(client_owner_id);

-- ==========================================
-- LEADS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    business TEXT,
    website TEXT,
    city TEXT,
    source TEXT DEFAULT 'Direct',
    service TEXT,
    deal_value REAL DEFAULT 0,
    status TEXT DEFAULT 'New',
    score INTEGER DEFAULT 0,
    notes TEXT,
    followup_date TEXT,
    followup_notes TEXT,
    last_contact_date TEXT,
    close_date TEXT,
    assigned_to TEXT,
    client_id TEXT,
    social_data TEXT DEFAULT '{}',
    created_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_client ON leads(client_id);
CREATE INDEX idx_leads_followup ON leads(followup_date);
CREATE INDEX idx_leads_mobile ON leads(mobile);

-- ==========================================
-- REVENUE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS revenue (
    id TEXT PRIMARY KEY,
    client TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    type TEXT DEFAULT 'Payment',
    source TEXT DEFAULT 'Client',
    invoice_id TEXT,
    client_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_revenue_date ON revenue(date);
CREATE INDEX idx_revenue_client ON revenue(client);
CREATE INDEX idx_revenue_type ON revenue(type);
CREATE INDEX idx_revenue_source ON revenue(source);

-- ==========================================
-- INVOICES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT,
    client TEXT NOT NULL,
    client_id TEXT,
    gstin TEXT,
    address TEXT,
    description TEXT,
    hsn TEXT,
    amount REAL NOT NULL DEFAULT 0,
    gst_rate REAL DEFAULT 18,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_invoices_number ON invoices(number);
CREATE INDEX idx_invoices_client ON invoices(client);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(date);

-- ==========================================
-- PROJECTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT,
    client_id TEXT,
    service TEXT,
    start_date TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'Planning',
    progress INTEGER DEFAULT 0,
    notes TEXT,
    lead_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_client ON projects(client_id);

-- ==========================================
-- RETAINERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS retainers (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_id TEXT,
    service TEXT,
    monthly_fee REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    start_date TEXT,
    end_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_retainers_status ON retainers(status);
CREATE INDEX idx_retainers_client ON retainers(client_id);

-- ==========================================
-- TASKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    related_type TEXT,
    related_id TEXT,
    related_name TEXT,
    assigned_to TEXT,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

-- ==========================================
-- APPOINTMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    with_name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    duration INTEGER DEFAULT 30,
    status TEXT DEFAULT 'Upcoming',
    notes TEXT,
    lead_id TEXT,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ==========================================
-- CAMPAIGNS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Email',
    status TEXT DEFAULT 'Draft',
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(type);

-- ==========================================
-- TRAINING SESSIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trainer TEXT,
    start_date TEXT,
    end_date TEXT,
    time_slot TEXT,
    platform TEXT DEFAULT 'Online',
    status TEXT DEFAULT 'Upcoming',
    attendee_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_training_status ON training_sessions(status);

-- ==========================================
-- TRAINING ATTENDEES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS training_attendees (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    converted_to_lead INTEGER DEFAULT 0,
    lead_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id)
);

CREATE INDEX idx_attendees_session ON training_attendees(session_id);
CREATE INDEX idx_attendees_mobile ON training_attendees(mobile);

-- ==========================================
-- REFERRALS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_client TEXT NOT NULL,
    referrer_id TEXT,
    referral_name TEXT NOT NULL,
    referral_mobile TEXT,
    referral_business TEXT,
    status TEXT DEFAULT 'Pending',
    reward_amount REAL DEFAULT 0,
    reward_status TEXT DEFAULT 'Pending',
    converted_lead_id TEXT,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- ==========================================
-- HISTORY / ACTIVITY LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    type TEXT NOT NULL,
    description TEXT,
    details TEXT,
    lead_id TEXT,
    lead_name TEXT,
    client_id TEXT,
    date TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_type ON activity_log(type);
CREATE INDEX idx_activity_date ON activity_log(date);
CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_lead ON activity_log(lead_id);

-- ==========================================
-- NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    data TEXT DEFAULT '{}',
    read INTEGER DEFAULT 0,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ==========================================
-- SESSIONS TABLE (User Login Sessions)
-- ==========================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT,
    ip_address TEXT,
    user_agent TEXT,
    browser TEXT,
    device TEXT,
    os TEXT,
    is_active INTEGER DEFAULT 1,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(is_active);

-- ==========================================
-- BACKUP LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS backup_logs (
    id TEXT PRIMARY KEY,
    file_name TEXT,
    collections TEXT,
    total_documents INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_status ON backup_logs(status);
CREATE INDEX idx_backup_created ON backup_logs(created_at);

-- ==========================================
-- SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    goal REAL DEFAULT 70000,
    currency TEXT DEFAULT '₹',
    tax REAL DEFAULT 18,
    service_fee REAL DEFAULT 20,
    discount REAL DEFAULT 0,
    round_up INTEGER DEFAULT 1,
    call_target INTEGER DEFAULT 30,
    followup_target INTEGER DEFAULT 10,
    meeting_target INTEGER DEFAULT 2,
    followup_days INTEGER DEFAULT 2,
    auto_backup INTEGER DEFAULT 1,
    email_notifications INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==========================================
-- SEARCH INDEX TABLE (FTS5 Full-Text Search)
-- ==========================================
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type,
    entity_id,
    name,
    mobile,
    email,
    business,
    notes,
    content='',
    contentless_delete=1
);

-- ==========================================
-- VIEWS FOR ANALYTICS
-- ==========================================

-- Revenue Summary View
CREATE VIEW IF NOT EXISTS v_revenue_summary AS
SELECT 
    date,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    type,
    source
FROM revenue
GROUP BY date, type, source;

-- Lead Pipeline View
CREATE VIEW IF NOT EXISTS v_lead_pipeline AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(deal_value) as total_value,
    AVG(deal_value) as avg_value
FROM leads
GROUP BY status;

-- Client Health View
CREATE VIEW IF NOT EXISTS v_client_health AS
SELECT 
    c.id,
    c.name,
    c.status,
    c.mrr,
    COUNT(p.id) as project_count,
    SUM(CASE WHEN p.status = 'Completed' THEN 1 ELSE 0 END) as completed_projects,
    COUNT(r.id) as retainer_count
FROM clients c
LEFT JOIN projects p ON p.client_id = c.id
LEFT JOIN retainers r ON r.client_id = c.id
GROUP BY c.id;

-- User Activity View
CREATE VIEW IF NOT EXISTS v_user_activity AS
SELECT 
    u.id,
    u.display_name,
    u.role,
    COUNT(a.id) as activity_count,
    MAX(a.timestamp) as last_activity
FROM users u
LEFT JOIN activity_log a ON a.user_id = u.id
GROUP BY u.id;

-- Monthly Revenue View
CREATE VIEW IF NOT EXISTS v_monthly_revenue AS
SELECT 
    substr(date, 1, 7) as month,
    COUNT(*) as transactions,
    SUM(amount) as total_revenue,
    AVG(amount) as avg_transaction
FROM revenue
GROUP BY month
ORDER BY month DESC;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Auto-update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trg_users_updated 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_clients_updated 
AFTER UPDATE ON clients
BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_leads_updated 
AFTER UPDATE ON leads
BEGIN
    UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_revenue_updated 
AFTER UPDATE ON revenue
BEGIN
    UPDATE revenue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-log lead status changes
CREATE TRIGGER IF NOT EXISTS trg_lead_status_change
AFTER UPDATE OF status ON leads
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO activity_log (id, user_id, type, description, lead_id, lead_name, date, timestamp)
    VALUES (
        'log_' || hex(randomblob(8)),
        NEW.updated_by,
        'status_change',
        'Lead status changed from ' || OLD.status || ' to ' || NEW.status,
        NEW.id,
        NEW.name,
        date('now'),
        CURRENT_TIMESTAMP
    );
END;

-- ==========================================
-- INITIAL SEED DATA
-- ==========================================

-- Default admin user (platform owner)
INSERT OR IGNORE INTO users (id, uid, email, display_name, role, status, email_verified)
VALUES ('admin_001', 'admin_001', '11avatardigitalhub@gmail.com', '11 Avatar Admin', 'platform_owner', 'active', 1);

-- Default settings for admin
INSERT OR IGNORE INTO settings (id, user_id) VALUES ('set_admin', 'admin_001');

-- ==========================================
-- END OF DATABASE SCHEMA
-- ==========================================
