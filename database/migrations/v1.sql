-- ============================================================
-- 11 AVATAR DIGITAL HUB - Database Migration V1
-- Enterprise-grade initial database schema
-- PostgreSQL / Cloud SQL for structured data & reporting
-- ============================================================
-- Version: 1.0.0
-- Author: 11 Avatar Digital Hub
-- License: GPL-3.0
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================
-- ENUMS
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM (
    'super_admin', 'admin', 'manager', 'team_lead', 
    'sales_rep', 'support_agent', 'trainer', 'partner', 'client', 'viewer'
);

-- User status
CREATE TYPE user_status AS ENUM (
    'active', 'inactive', 'suspended', 'pending_verification', 'deleted'
);

-- Client status
CREATE TYPE client_status AS ENUM (
    'active', 'inactive', 'lead', 'prospect', 'churned', 'blacklisted'
);

-- Lead status
CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'proposal_sent', 
    'negotiation', 'won', 'lost', 'disqualified'
);

-- Lead source
CREATE TYPE lead_source AS ENUM (
    'website', 'referral', 'social_media', 'email_campaign',
    'cold_call', 'event', 'partner', 'advertisement', 'whatsapp', 'other'
);

-- Deal stage
CREATE TYPE deal_stage AS ENUM (
    'lead', 'contacted', 'qualified', 'proposal', 
    'negotiation', 'won', 'lost', 'on_hold'
);

-- Invoice status
CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'viewed', 'partial', 'paid', 
    'overdue', 'cancelled', 'refunded', 'disputed'
);

-- Invoice type
CREATE TYPE invoice_type AS ENUM (
    'B2B', 'B2C', 'EXPORT', 'SEZ', 'DEEMED_EXPORT', 'RCM'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 
    'refunded', 'partially_refunded', 'disputed', 'cancelled'
);

-- Payment method
CREATE TYPE payment_method AS ENUM (
    'upi', 'bank_transfer', 'cheque', 'cash', 'credit_card',
    'debit_card', 'neft', 'rtgs', 'imps', 'wallet', 'crypto'
);

-- Task status
CREATE TYPE task_status AS ENUM (
    'backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'
);

-- Task priority
CREATE TYPE task_priority AS ENUM (
    'critical', 'high', 'medium', 'low', 'optional'
);

-- Project status
CREATE TYPE project_status AS ENUM (
    'planning', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled', 'archived'
);

-- GST rate slab
CREATE TYPE gst_rate_slab AS ENUM ('0%', '5%', '12%', '18%', '28%', 'EXEMPT');

-- Notification channel
CREATE TYPE notification_channel AS ENUM (
    'in_app', 'email', 'sms', 'push', 'whatsapp', 'desktop'
);

-- ============================================================
-- SCHEMA: core
-- ============================================================
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS projects;
CREATE SCHEMA IF NOT EXISTS training;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reports;

-- ============================================================
-- TABLE: core.organizations
-- ============================================================
CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    trade_name VARCHAR(255),
    website VARCHAR(500),
    email VARCHAR(255),
    phone VARCHAR(20),
    gstin VARCHAR(15) UNIQUE,
    pan VARCHAR(10),
    cin VARCHAR(21),
    tan VARCHAR(10),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    logo_url TEXT,
    favicon_url TEXT,
    currency VARCHAR(3) DEFAULT 'INR',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    language VARCHAR(10) DEFAULT 'en',
    industry VARCHAR(100),
    fiscal_year_start VARCHAR(10) DEFAULT 'april',
    is_active BOOLEAN DEFAULT true,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: core.users
-- ============================================================
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE,
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200) GENERATED ALWAYS AS (
        COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    ) STORED,
    role user_role NOT NULL DEFAULT 'viewer',
    status user_status NOT NULL DEFAULT 'pending_verification',
    avatar_url TEXT,
    designation VARCHAR(100),
    department VARCHAR(100),
    reporting_to UUID REFERENCES core.users(id),
    employee_code VARCHAR(50),
    date_of_joining DATE,
    salary NUMERIC(15,2),
    commission_rate DECIMAL(5,2),
    target_revenue NUMERIC(15,2),
    permissions JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_method VARCHAR(20),
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT false,
    max_sessions INT DEFAULT 3,
    session_timeout_minutes INT DEFAULT 30,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_org ON core.users(organization_id);
CREATE INDEX idx_users_role ON core.users(role);
CREATE INDEX idx_users_status ON core.users(status);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_firebase ON core.users(firebase_uid);
CREATE INDEX idx_users_fullname_trgm ON core.users USING gin(full_name gin_trgm_ops);

-- ============================================================
-- TABLE: core.sessions
-- ============================================================
CREATE TABLE core.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    refresh_token VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    device_os VARCHAR(50),
    browser VARCHAR(100),
    location_city VARCHAR(100),
    location_country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON core.sessions(user_id);
CREATE INDEX idx_sessions_token ON core.sessions(token);
CREATE INDEX idx_sessions_expires ON core.sessions(expires_at);

-- ============================================================
-- TABLE: core.api_keys
-- ============================================================
CREATE TABLE core.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit INT DEFAULT 1000,
    rate_limit_window INT DEFAULT 3600,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON core.api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON core.api_keys(key_hash);

-- ============================================================
-- TABLE: core.audit_logs
-- ============================================================
CREATE TABLE audit.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for audit logs (monthly)
CREATE TABLE audit.audit_logs_2026_01 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit.audit_logs_2026_02 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit.audit_logs_2026_03 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit.audit_logs_2026_04 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit.audit_logs_2026_05 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit.audit_logs_2026_06 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_audit_org ON audit.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit.audit_logs(action, created_at DESC);

-- ============================================================
-- TABLE: crm.clients
-- ============================================================
CREATE TABLE crm.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    client_code VARCHAR(20) UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    website VARCHAR(500),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    annual_revenue NUMERIC(15,2),
    status client_status NOT NULL DEFAULT 'lead',
    source lead_source,
    assigned_to UUID REFERENCES core.users(id),
    account_manager UUID REFERENCES core.users(id),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    billing_address JSONB,
    shipping_address JSONB,
    payment_terms VARCHAR(50) DEFAULT 'net_30',
    credit_limit NUMERIC(15,2),
    tax_exempt BOOLEAN DEFAULT false,
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    logo_url TEXT,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_deals INT DEFAULT 0,
    last_contacted_at TIMESTAMPTZ,
    onboarding_date DATE,
    churn_date DATE,
    churn_reason TEXT,
    satisfaction_score INT CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_clients_org ON crm.clients(organization_id);
CREATE INDEX idx_clients_status ON crm.clients(status);
CREATE INDEX idx_clients_assigned ON crm.clients(assigned_to);
CREATE INDEX idx_clients_gstin ON crm.clients(gstin);
CREATE INDEX idx_clients_name_trgm ON crm.clients USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_clients_tags ON crm.clients USING gin(tags);

-- ============================================================
-- TABLE: crm.contacts
-- ============================================================
CREATE TABLE crm.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
    salutation VARCHAR(10),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    full_name VARCHAR(200) GENERATED ALWAYS AS (
        COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    ) STORED,
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    designation VARCHAR(100),
    department VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    date_of_birth DATE,
    anniversary_date DATE,
    linkedin_url TEXT,
    twitter_url TEXT,
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_contacts_client ON crm.contacts(client_id);
CREATE INDEX idx_contacts_org ON crm.contacts(organization_id);
CREATE INDEX idx_contacts_email ON crm.contacts(email);
CREATE INDEX idx_contacts_name_trgm ON crm.contacts USING gin(full_name gin_trgm_ops);

-- ============================================================
-- TABLE: crm.leads
-- ============================================================
CREATE TABLE crm.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    lead_number VARCHAR(20) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200) GENERATED ALWAYS AS (
        COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    ) STORED,
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    status lead_status NOT NULL DEFAULT 'new',
    source lead_source,
    source_detail VARCHAR(255),
    assigned_to UUID REFERENCES core.users(id),
    converted_client_id UUID REFERENCES crm.clients(id),
    converted_at TIMESTAMPTZ,
    deal_value NUMERIC(15,2),
    deal_currency VARCHAR(3) DEFAULT 'INR',
    expected_close_date DATE,
    probability INT CHECK (probability >= 0 AND probability <= 100),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    industry VARCHAR(100),
    company_size VARCHAR(50),
    website VARCHAR(500),
    requirement TEXT,
    budget_range VARCHAR(50),
    timeline VARCHAR(50),
    competitors TEXT[],
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    score INT DEFAULT 0,
    last_contacted_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_leads_org ON crm.leads(organization_id);
CREATE INDEX idx_leads_status ON crm.leads(status);
CREATE INDEX idx_leads_assigned ON crm.leads(assigned_to);
CREATE INDEX idx_leads_source ON crm.leads(source);
CREATE INDEX idx_leads_email ON crm.leads(email);
CREATE INDEX idx_leads_phone ON crm.leads(phone);
CREATE INDEX idx_leads_name_trgm ON crm.leads USING gin(full_name gin_trgm_ops);
CREATE INDEX idx_leads_company_trgm ON crm.leads USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_leads_score ON crm.leads(score DESC);

-- ============================================================
-- TABLE: crm.deals
-- ============================================================
CREATE TABLE crm.deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    deal_number VARCHAR(20) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID REFERENCES crm.clients(id),
    contact_id UUID REFERENCES crm.contacts(id),
    lead_id UUID REFERENCES crm.leads(id),
    stage deal_stage NOT NULL DEFAULT 'lead',
    value NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    probability INT CHECK (probability >= 0 AND probability <= 100) DEFAULT 50,
    expected_close_date DATE,
    actual_close_date DATE,
    assigned_to UUID REFERENCES core.users(id),
    source lead_source,
    products_services TEXT[],
    competitors TEXT[],
    next_step TEXT,
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    loss_reason TEXT,
    is_won BOOLEAN DEFAULT false,
    won_at TIMESTAMPTZ,
    is_lost BOOLEAN DEFAULT false,
    lost_at TIMESTAMPTZ,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_deals_org ON crm.deals(organization_id);
CREATE INDEX idx_deals_stage ON crm.deals(stage);
CREATE INDEX idx_deals_client ON crm.deals(client_id);
CREATE INDEX idx_deals_assigned ON crm.deals(assigned_to);
CREATE INDEX idx_deals_expected_close ON crm.deals(expected_close_date);
CREATE INDEX idx_deals_value ON crm.deals(value DESC);

-- ============================================================
-- TABLE: crm.activities
-- ============================================================
CREATE TABLE crm.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    priority task_priority DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INT,
    location TEXT,
    attendees TEXT[],
    outcome TEXT,
    is_reminder BOOLEAN DEFAULT false,
    reminder_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_entity ON crm.activities(entity_type, entity_id);
CREATE INDEX idx_activities_user ON crm.activities(user_id, created_at DESC);
CREATE INDEX idx_activities_due ON crm.activities(due_date) WHERE status != 'completed';

-- ============================================================
-- TABLE: finance.invoices
-- ============================================================
CREATE TABLE finance.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    reference_number VARCHAR(50),
    order_id VARCHAR(50),
    client_id UUID NOT NULL REFERENCES crm.clients(id),
    contact_id UUID REFERENCES crm.contacts(id),
    deal_id UUID REFERENCES crm.deals(id),
    project_id UUID,
    invoice_type invoice_type NOT NULL DEFAULT 'B2B',
    status invoice_status NOT NULL DEFAULT 'draft',
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_type VARCHAR(20),
    discount_value NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    taxable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    cgst_amount NUMERIC(15,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_amount NUMERIC(15,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    igst_amount NUMERIC(15,2) DEFAULT 0,
    utgst_rate DECIMAL(5,2) DEFAULT 0,
    utgst_amount NUMERIC(15,2) DEFAULT 0,
    cess_rate DECIMAL(5,2) DEFAULT 0,
    cess_amount NUMERIC(15,2) DEFAULT 0,
    total_tax NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    balance_amount NUMERIC(15,2) GENERATED ALWAYS AS (total - paid_amount) STORED,
    place_of_supply VARCHAR(100),
    is_inter_state BOOLEAN DEFAULT false,
    is_e_invoice BOOLEAN DEFAULT false,
    irn VARCHAR(64),
    ack_no VARCHAR(50),
    ack_date TIMESTAMPTZ,
    qr_code TEXT,
    eway_bill_number VARCHAR(12),
    notes TEXT,
    terms_conditions TEXT,
    attachments TEXT[],
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    payment_reminder_sent_at TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_invoices_org ON finance.invoices(organization_id);
CREATE INDEX idx_invoices_client ON finance.invoices(client_id);
CREATE INDEX idx_invoices_status ON finance.invoices(status);
CREATE INDEX idx_invoices_date ON finance.invoices(invoice_date DESC);
CREATE INDEX idx_invoices_due ON finance.invoices(due_date) WHERE status NOT IN ('paid', 'cancelled', 'refunded');
CREATE INDEX idx_invoices_number ON finance.invoices(invoice_number);
CREATE INDEX idx_invoices_deal ON finance.invoices(deal_id);

-- ============================================================
-- TABLE: finance.invoice_items
-- ============================================================
CREATE TABLE finance.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES finance.invoices(id) ON DELETE CASCADE,
    sr_no INT NOT NULL,
    description TEXT NOT NULL,
    hsn_sac_code VARCHAR(10),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'NOS',
    rate NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount NUMERIC(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    taxable_amount NUMERIC(15,2) DEFAULT 0,
    gst_rate gst_rate_slab DEFAULT '18%',
    cgst_amount NUMERIC(15,2) DEFAULT 0,
    sgst_amount NUMERIC(15,2) DEFAULT 0,
    igst_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON finance.invoice_items(invoice_id);

-- ============================================================
-- TABLE: finance.payments
-- ============================================================
CREATE TABLE finance.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(30) UNIQUE,
    invoice_id UUID REFERENCES finance.invoices(id),
    client_id UUID NOT NULL REFERENCES crm.clients(id),
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    gateway VARCHAR(50),
    gateway_payment_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    gateway_signature TEXT,
    transaction_id VARCHAR(255),
    utr_number VARCHAR(50),
    cheque_number VARCHAR(50),
    cheque_date DATE,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    upi_vpa VARCHAR(100),
    card_last_four VARCHAR(4),
    card_type VARCHAR(20),
    payment_date DATE,
    processing_fee NUMERIC(15,2) DEFAULT 0,
    net_amount NUMERIC(15,2) GENERATED ALWAYS AS (amount - processing_fee) STORED,
    description TEXT,
    receipt_url TEXT,
    refund_amount NUMERIC(15,2) DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMPTZ,
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_org ON finance.payments(organization_id);
CREATE INDEX idx_payments_invoice ON finance.payments(invoice_id);
CREATE INDEX idx_payments_client ON finance.payments(client_id);
CREATE INDEX idx_payments_status ON finance.payments(status);
CREATE INDEX idx_payments_date ON finance.payments(payment_date DESC);
CREATE INDEX idx_payments_method ON finance.payments(method);
CREATE INDEX idx_payments_gateway ON finance.payments(gateway, gateway_payment_id);

-- ============================================================
-- TABLE: projects.tasks
-- ============================================================
CREATE TABLE projects.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    task_number VARCHAR(20) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID,
    parent_task_id UUID REFERENCES projects.tasks(id),
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    type VARCHAR(50) DEFAULT 'task',
    assigned_to UUID REFERENCES core.users(id),
    assigned_by UUID REFERENCES core.users(id),
    client_id UUID REFERENCES crm.clients(id),
    deal_id UUID REFERENCES crm.deals(id),
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    estimated_hours DECIMAL(6,2),
    actual_hours DECIMAL(6,2) DEFAULT 0,
    billable BOOLEAN DEFAULT true,
    is_milestone BOOLEAN DEFAULT false,
    depends_on UUID[] DEFAULT '{}',
    blocked_by UUID[] DEFAULT '{}',
    sort_order INT DEFAULT 0,
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_tasks_org ON projects.tasks(organization_id);
CREATE INDEX idx_tasks_status ON projects.tasks(status);
CREATE INDEX idx_tasks_priority ON projects.tasks(priority);
CREATE INDEX idx_tasks_assigned ON projects.tasks(assigned_to);
CREATE INDEX idx_tasks_project ON projects.tasks(project_id);
CREATE INDEX idx_tasks_due ON projects.tasks(due_date) WHERE status NOT IN ('done', 'cancelled');
CREATE INDEX idx_tasks_parent ON projects.tasks(parent_task_id);

-- ============================================================
-- TABLE: projects.time_logs
-- ============================================================
CREATE TABLE projects.time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES projects.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INT,
    description TEXT,
    billable BOOLEAN DEFAULT true,
    hourly_rate NUMERIC(10,2),
    total_amount NUMERIC(15,2),
    approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES core.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_logs_task ON projects.time_logs(task_id);
CREATE INDEX idx_time_logs_user ON projects.time_logs(user_id, start_time DESC);

-- ============================================================
-- TABLE: notifications.notifications
-- ============================================================
CREATE TABLE notifications.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'system',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    channels notification_channel[] NOT NULL DEFAULT '{in_app}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    action_url TEXT,
    action_label VARCHAR(50),
    image_url TEXT,
    data JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications.notifications(status);
CREATE INDEX idx_notifications_category ON notifications.notifications(category);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION core.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all main tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_schema || '.' || table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('core', 'crm', 'finance', 'projects', 'training', 'notifications')
        AND table_type = 'BASE TABLE'
        AND column_name = 'updated_at'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_update_updated_at ON %I.%I;
            CREATE TRIGGER trg_update_updated_at 
            BEFORE UPDATE ON %I.%I 
            FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();
        ', split_part(t, '.', 1), split_part(t, '.', 2), split_part(t, '.', 1), split_part(t, '.', 2));
    END LOOP;
END $$;

-- Function to generate sequential numbers
CREATE OR REPLACE FUNCTION core.generate_sequence_number(
    p_organization_id UUID,
    p_prefix VARCHAR(5),
    p_table_name VARCHAR(50)
)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_year VARCHAR(2) := TO_CHAR(NOW(), 'YY');
    v_seq INT;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
    FROM core.sequences
    WHERE organization_id = p_organization_id
    AND prefix = p_prefix
    AND table_name = p_table_name;
    
    INSERT INTO core.sequences (organization_id, prefix, table_name, seq)
    VALUES (p_organization_id, p_prefix, p_table_name, v_seq)
    ON CONFLICT (organization_id, prefix, table_name) 
    DO UPDATE SET seq = v_seq, updated_at = NOW();
    
    v_number := p_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Sequence tracking table
CREATE TABLE core.sequences (
    organization_id UUID NOT NULL,
    prefix VARCHAR(5) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    seq INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, prefix, table_name)
);

-- ============================================================
-- VIEWS
-- ============================================================

-- Revenue summary view
CREATE OR REPLACE VIEW reports.v_revenue_summary AS
SELECT
    i.organization_id,
    DATE_TRUNC('month', i.invoice_date) AS month,
    i.currency,
    COUNT(DISTINCT i.id) AS total_invoices,
    COUNT(DISTINCT CASE WHEN i.status = 'paid' THEN i.id END) AS paid_invoices,
    SUM(i.subtotal) AS total_subtotal,
    SUM(i.total_tax) AS total_tax,
    SUM(i.total) AS total_revenue,
    SUM(i.paid_amount) AS total_collected,
    SUM(i.balance_amount) AS total_outstanding
FROM finance.invoices i
WHERE i.deleted = false
GROUP BY i.organization_id, DATE_TRUNC('month', i.invoice_date), i.currency
ORDER BY month DESC;

-- Pipeline summary view
CREATE OR REPLACE VIEW reports.v_pipeline_summary AS
SELECT
    d.organization_id,
    d.stage,
    COUNT(*) AS deal_count,
    SUM(d.value) AS total_value,
    AVG(d.probability) AS avg_probability,
    SUM(d.value * d.probability / 100) AS weighted_value,
    AVG(EXTRACT(DAY FROM (d.expected_close_date - d.created_at::DATE))) AS avg_days_in_stage
FROM crm.deals d
WHERE d.deleted = false AND d.stage NOT IN ('won', 'lost')
GROUP BY d.organization_id, d.stage
ORDER BY d.organization_id, 
    CASE d.stage 
        WHEN 'lead' THEN 1 WHEN 'contacted' THEN 2 
        WHEN 'qualified' THEN 3 WHEN 'proposal' THEN 4 
        WHEN 'negotiation' THEN 5 ELSE 6 
    END;

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default HSN codes
INSERT INTO finance.hsn_codes (code, description, gst_rate, chapter) VALUES
('998311', 'Information Technology Consulting Services', '18%', '99'),
('998312', 'Software Development Services', '18%', '99'),
('998313', 'Website Design & Development Services', '18%', '99'),
('998314', 'Digital Marketing Services', '18%', '99'),
('998315', 'Content Writing Services', '18%', '99'),
('998316', 'Graphic Design Services', '18%', '99'),
('998317', 'Video Production Services', '18%', '99'),
('998318', 'Social Media Management Services', '18%', '99');

COMMENT ON TABLE core.organizations IS 'Multi-tenant organization profiles';
COMMENT ON TABLE core.users IS 'User accounts with RBAC roles';
COMMENT ON TABLE crm.clients IS 'Client/company master data';
COMMENT ON TABLE crm.leads IS 'Lead/prospect tracking';
COMMENT ON TABLE crm.deals IS 'Sales pipeline & deal management';
COMMENT ON TABLE finance.invoices IS 'GST-compliant invoices';
COMMENT ON TABLE finance.payments IS 'Payment transactions';
COMMENT ON TABLE projects.tasks IS 'Task & project management';
COMMENT ON TABLE notifications.notifications IS 'Multi-channel notifications';

-- Migration version tracking
CREATE TABLE IF NOT EXISTS core.migrations (
    version VARCHAR(20) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100),
    checksum VARCHAR(64),
    execution_time_ms INT,
    success BOOLEAN DEFAULT true
);

INSERT INTO core.migrations (version, description, checksum) 
VALUES ('1.0.0', 'Initial schema with core, crm, finance, projects, notifications modules', 
        MD5('v1.0.0-initial-schema'));
