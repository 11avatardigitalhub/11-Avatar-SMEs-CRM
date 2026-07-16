-- ============================================================
-- 11 AVATAR DIGITAL HUB - Database Migration V2
-- Enterprise-grade schema enhancements & optimizations
-- Adds training, referrals, retainer, WhatsApp, calendar modules
-- ============================================================
-- Version: 2.0.0
-- Author: 11 Avatar Digital Hub
-- License: GPL-3.0
-- ============================================================

-- ============================================================
-- NEW ENUMS
-- ============================================================

-- Training course status
CREATE TYPE training.course_status AS ENUM (
    'draft', 'published', 'archived', 'under_review'
);

-- Training difficulty
CREATE TYPE training.difficulty_level AS ENUM (
    'beginner', 'intermediate', 'advanced', 'expert'
);

-- Enrollment status
CREATE TYPE training.enrollment_status AS ENUM (
    'enrolled', 'in_progress', 'completed', 'failed', 'dropped', 'on_hold'
);

-- Content type
CREATE TYPE training.content_type AS ENUM (
    'video', 'document', 'quiz', 'assignment', 'live_session', 
    'interactive', 'webinar', 'reading'
);

-- Assessment type
CREATE TYPE training.assessment_type AS ENUM (
    'multiple_choice', 'true_false', 'short_answer', 
    'essay', 'coding', 'practical', 'peer_review'
);

-- Certification level
CREATE TYPE training.certification_level AS ENUM (
    'participation', 'completion', 'merit', 'distinction', 'excellence'
);

-- Retainer type
CREATE TYPE finance.retainer_type AS ENUM (
    'hourly', 'fixed', 'dedicated', 'project', 'support', 'consulting'
);

-- Retainer status
CREATE TYPE finance.retainer_status AS ENUM (
    'draft', 'active', 'paused', 'exhausted', 'expired', 'cancelled', 'renewed'
);

-- Billing cycle
CREATE TYPE finance.billing_cycle AS ENUM (
    'weekly', 'biweekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'
);

-- Referral status
CREATE TYPE crm.referral_status AS ENUM (
    'pending', 'qualified', 'converted', 'rejected', 'expired', 'fraud'
);

-- Commission status
CREATE TYPE finance.commission_status AS ENUM (
    'earned', 'approved', 'pending_payout', 'paid', 'cancelled', 'disputed'
);

-- Partner tier
CREATE TYPE crm.partner_tier AS ENUM (
    'bronze', 'silver', 'gold', 'platinum'
);

-- Calendar event status
CREATE TYPE calendar.event_status AS ENUM (
    'confirmed', 'tentative', 'cancelled', 'completed'
);

-- WhatsApp message status
CREATE TYPE communication.message_status AS ENUM (
    'pending', 'sent', 'delivered', 'read', 'failed', 'rejected'
);

-- WhatsApp message type
CREATE TYPE communication.whatsapp_message_type AS ENUM (
    'text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'template', 'interactive'
);

-- ============================================================
-- SCHEMA: training
-- ============================================================
CREATE SCHEMA IF NOT EXISTS training;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS calendar;

-- ============================================================
-- TABLE: training.courses
-- ============================================================
CREATE TABLE training.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    category VARCHAR(50) NOT NULL,
    difficulty training.difficulty_level NOT NULL DEFAULT 'beginner',
    status training.course_status NOT NULL DEFAULT 'draft',
    duration_hours DECIMAL(6,1) DEFAULT 0,
    thumbnail_url TEXT,
    trailer_url TEXT,
    instructor_id UUID REFERENCES core.users(id),
    co_instructor_id UUID REFERENCES core.users(id),
    prerequisites TEXT,
    price NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    is_free BOOLEAN GENERATED ALWAYS AS (price = 0) STORED,
    certificate_enabled BOOLEAN DEFAULT false,
    certificate_template_id UUID,
    max_enrollments INT,
    enrollment_count INT DEFAULT 0,
    completion_count INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INT DEFAULT 0,
    total_reviews INT DEFAULT 0,
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_courses_org ON training.courses(organization_id);
CREATE INDEX idx_courses_status ON training.courses(status);
CREATE INDEX idx_courses_category ON training.courses(category);
CREATE INDEX idx_courses_instructor ON training.courses(instructor_id);
CREATE INDEX idx_courses_title_trgm ON training.courses USING gin(title gin_trgm_ops);

-- ============================================================
-- TABLE: training.modules
-- ============================================================
CREATE TABLE training.modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES training.courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    duration_hours DECIMAL(6,1) DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    unlock_after_previous BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_modules_course ON training.modules(course_id, sort_order);

-- ============================================================
-- TABLE: training.lessons
-- ============================================================
CREATE TABLE training.lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES training.modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type training.content_type NOT NULL DEFAULT 'video',
    content_url TEXT,
    content_text TEXT,
    duration_minutes INT DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_preview BOOLEAN DEFAULT false,
    is_required BOOLEAN DEFAULT true,
    passing_score INT DEFAULT 70,
    max_attempts INT DEFAULT 3,
    points INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lessons_module ON training.lessons(module_id, sort_order);

-- ============================================================
-- TABLE: training.quiz_questions
-- ============================================================
CREATE TABLE training.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES training.lessons(id) ON DELETE CASCADE,
    question_type training.assessment_type NOT NULL DEFAULT 'multiple_choice',
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    points INT DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_lesson ON training.quiz_questions(lesson_id);

-- ============================================================
-- TABLE: training.enrollments
-- ============================================================
CREATE TABLE training.enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES training.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id),
    status training.enrollment_status NOT NULL DEFAULT 'enrolled',
    progress_percent DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    score DECIMAL(5,2),
    certificate_issued BOOLEAN DEFAULT false,
    certificate_id UUID,
    certificate_url TEXT,
    certificate_level training.certification_level,
    time_spent_minutes INT DEFAULT 0,
    attempts INT DEFAULT 1,
    notes TEXT,
    enrolled_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);

CREATE INDEX idx_enrollments_course ON training.enrollments(course_id);
CREATE INDEX idx_enrollments_user ON training.enrollments(user_id);
CREATE INDEX idx_enrollments_status ON training.enrollments(status);

-- ============================================================
-- TABLE: training.lesson_progress
-- ============================================================
CREATE TABLE training.lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES training.enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES training.lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    score DECIMAL(5,2),
    attempts INT DEFAULT 0,
    time_spent_seconds INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(enrollment_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_enrollment ON training.lesson_progress(enrollment_id);

-- ============================================================
-- TABLE: training.assessments
-- ============================================================
CREATE TABLE training.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES training.enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES training.lessons(id),
    assessment_type training.assessment_type NOT NULL,
    total_questions INT NOT NULL DEFAULT 0,
    correct_answers INT NOT NULL DEFAULT 0,
    score DECIMAL(5,2) NOT NULL DEFAULT 0,
    passing_score INT NOT NULL DEFAULT 70,
    passed BOOLEAN GENERATED ALWAYS AS (score >= passing_score) STORED,
    attempt_number INT NOT NULL DEFAULT 1,
    answers JSONB,
    time_taken_seconds INT,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    graded_by UUID REFERENCES core.users(id),
    graded_at TIMESTAMPTZ,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_enrollment ON training.assessments(enrollment_id);

-- ============================================================
-- TABLE: finance.retainers
-- ============================================================
CREATE TABLE finance.retainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID NOT NULL REFERENCES crm.clients(id),
    type finance.retainer_type NOT NULL,
    status finance.retainer_status NOT NULL DEFAULT 'draft',
    billing_cycle finance.billing_cycle NOT NULL DEFAULT 'monthly',
    sla_level VARCHAR(50) DEFAULT 'standard',
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    total_cycles INT DEFAULT 12,
    total_value NUMERIC(15,2),
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE,
    total_hours DECIMAL(8,1) DEFAULT 0,
    used_hours DECIMAL(8,1) DEFAULT 0,
    hourly_rate NUMERIC(15,2),
    rollover_policy VARCHAR(20) DEFAULT 'expire',
    total_tickets INT DEFAULT 0,
    used_tickets INT DEFAULT 0,
    auto_invoice BOOLEAN DEFAULT true,
    auto_send BOOLEAN DEFAULT false,
    generate_before_days INT DEFAULT 7,
    payment_terms VARCHAR(50) DEFAULT 'net_15',
    late_fee_enabled BOOLEAN DEFAULT true,
    late_fee_percentage DECIMAL(5,2) DEFAULT 2.5,
    late_fee_after_days INT DEFAULT 15,
    primary_contact VARCHAR(255),
    invoice_count INT DEFAULT 0,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT false
);

CREATE INDEX idx_retainers_org ON finance.retainers(organization_id);
CREATE INDEX idx_retainers_client ON finance.retainers(client_id);
CREATE INDEX idx_retainers_status ON finance.retainers(status);
CREATE INDEX idx_retainers_next_billing ON finance.retainers(next_billing_date);

-- ============================================================
-- TABLE: finance.retainer_invoices
-- ============================================================
CREATE TABLE finance.retainer_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retainer_id UUID NOT NULL REFERENCES finance.retainers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES finance.invoices(id) ON DELETE CASCADE,
    billing_period_start DATE,
    billing_period_end DATE,
    hours_used DECIMAL(8,1),
    amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'generated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retainer_invoices_retainer ON finance.retainer_invoices(retainer_id);

-- ============================================================
-- TABLE: crm.referrals
-- ============================================================
CREATE TABLE crm.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE,
    partner_id UUID REFERENCES crm.partners(id),
    referred_name VARCHAR(255) NOT NULL,
    referred_email VARCHAR(255),
    referred_phone VARCHAR(20),
    referred_company VARCHAR(255),
    source VARCHAR(50),
    status crm.referral_status NOT NULL DEFAULT 'pending',
    converted_to_lead_id UUID REFERENCES crm.leads(id),
    converted_to_client_id UUID REFERENCES crm.clients(id),
    converted_at TIMESTAMPTZ,
    deal_value NUMERIC(15,2),
    commission_type VARCHAR(20) DEFAULT 'percentage',
    commission_rate DECIMAL(5,2),
    commission_amount NUMERIC(15,2),
    commission_status finance.commission_status DEFAULT 'earned',
    level INT DEFAULT 1,
    parent_referral_id UUID REFERENCES crm.referrals(id),
    cookie_id VARCHAR(100),
    cookie_expires_at TIMESTAMPTZ,
    click_count INT DEFAULT 0,
    landing_page_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_org ON crm.referrals(organization_id);
CREATE INDEX idx_referrals_partner ON crm.referrals(partner_id);
CREATE INDEX idx_referrals_status ON crm.referrals(status);
CREATE INDEX idx_referrals_code ON crm.referrals(referral_code);
CREATE INDEX idx_referrals_parent ON crm.referrals(parent_referral_id);

-- ============================================================
-- TABLE: crm.partners
-- ============================================================
CREATE TABLE crm.partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    partner_code VARCHAR(20) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    website VARCHAR(500),
    tier crm.partner_tier NOT NULL DEFAULT 'bronze',
    commission_multiplier DECIMAL(3,2) DEFAULT 1.00,
    total_referrals INT DEFAULT 0,
    converted_referrals INT DEFAULT 0,
    conversion_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_referrals > 0 
        THEN ROUND((converted_referrals::DECIMAL / total_referrals) * 100, 2)
        ELSE 0 END
    ) STORED,
    total_earnings NUMERIC(15,2) DEFAULT 0,
    pending_earnings NUMERIC(15,2) DEFAULT 0,
    paid_earnings NUMERIC(15,2) DEFAULT 0,
    referral_link TEXT,
    promotion_code VARCHAR(20) UNIQUE,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(11),
    upi_vpa VARCHAR(100),
    pan VARCHAR(10),
    agreement_signed BOOLEAN DEFAULT false,
    agreement_url TEXT,
    is_active BOOLEAN DEFAULT true,
    joined_at DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_org ON crm.partners(organization_id);
CREATE INDEX idx_partners_tier ON crm.partners(tier);
CREATE INDEX idx_partners_email ON crm.partners(email);

-- ============================================================
-- TABLE: finance.commissions
-- ============================================================
CREATE TABLE finance.commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    referral_id UUID NOT NULL REFERENCES crm.referrals(id),
    partner_id UUID NOT NULL REFERENCES crm.partners(id),
    amount NUMERIC(15,2) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    deal_value NUMERIC(15,2),
    status finance.commission_status NOT NULL DEFAULT 'earned',
    earned_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES core.users(id),
    payout_id UUID,
    payout_date DATE,
    payout_method payment_method,
    payout_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commissions_referral ON finance.commissions(referral_id);
CREATE INDEX idx_commissions_partner ON finance.commissions(partner_id);
CREATE INDEX idx_commissions_status ON finance.commissions(status);
CREATE INDEX idx_commissions_earned ON finance.commissions(earned_at DESC);

-- ============================================================
-- TABLE: calendar.events
-- ============================================================
CREATE TABLE calendar.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'meeting',
    status calendar.event_status NOT NULL DEFAULT 'confirmed',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    location TEXT,
    meeting_link TEXT,
    calendar_id VARCHAR(100),
    provider VARCHAR(50),
    provider_event_id VARCHAR(255),
    recurrence_rule TEXT,
    recurrence_end_date DATE,
    color VARCHAR(7),
    reminders JSONB DEFAULT '[{"type":"notification","minutes":15}]',
    organizer_id UUID REFERENCES core.users(id),
    linked_entity_type VARCHAR(50),
    linked_entity_id UUID,
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_events_org ON calendar.events(organization_id);
CREATE INDEX idx_events_time ON calendar.events(start_time, end_time);
CREATE INDEX idx_events_organizer ON calendar.events(organizer_id);
CREATE INDEX idx_events_linked ON calendar.events(linked_entity_type, linked_entity_id);
CREATE INDEX idx_events_provider ON calendar.events(provider, provider_event_id);

-- ============================================================
-- TABLE: calendar.event_attendees
-- ============================================================
CREATE TABLE calendar.event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id),
    contact_id UUID REFERENCES crm.contacts(id),
    email VARCHAR(255),
    name VARCHAR(255),
    response VARCHAR(20) DEFAULT 'pending',
    is_required BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_attendees_event ON calendar.event_attendees(event_id);

-- ============================================================
-- TABLE: communication.whatsapp_templates
-- ============================================================
CREATE TABLE communication.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    content TEXT NOT NULL,
    header_type VARCHAR(20),
    header_text TEXT,
    header_media_url TEXT,
    footer_text TEXT,
    button_texts TEXT[],
    variables TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    meta_template_id VARCHAR(100),
    meta_template_status VARCHAR(50),
    rejection_reason TEXT,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_templates_org ON communication.whatsapp_templates(organization_id);

-- ============================================================
-- TABLE: communication.whatsapp_messages
-- ============================================================
CREATE TABLE communication.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    wamid VARCHAR(100) UNIQUE,
    conversation_id VARCHAR(100),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type communication.whatsapp_message_type NOT NULL DEFAULT 'text',
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    caption TEXT,
    location_data JSONB,
    contact_data JSONB,
    interactive_data JSONB,
    template_name VARCHAR(255),
    template_language VARCHAR(10),
    status communication.message_status NOT NULL DEFAULT 'pending',
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_reason TEXT,
    error_code VARCHAR(50),
    billable BOOLEAN DEFAULT true,
    pricing JSONB,
    linked_entity_type VARCHAR(50),
    linked_entity_id UUID,
    contact_id UUID REFERENCES crm.contacts(id),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_org ON communication.whatsapp_messages(organization_id);
CREATE INDEX idx_wa_messages_conversation ON communication.whatsapp_messages(conversation_id);
CREATE INDEX idx_wa_messages_from ON communication.whatsapp_messages(from_number);
CREATE INDEX idx_wa_messages_status ON communication.whatsapp_messages(status);
CREATE INDEX idx_wa_messages_created ON communication.whatsapp_messages(created_at DESC);
CREATE INDEX idx_wa_messages_linked ON communication.whatsapp_messages(linked_entity_type, linked_entity_id);

-- ============================================================
-- TABLE: communication.whatsapp_conversations
-- ============================================================
CREATE TABLE communication.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    contact_id UUID REFERENCES crm.contacts(id),
    client_id UUID REFERENCES crm.clients(id),
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INT DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    assigned_to UUID REFERENCES core.users(id),
    tags TEXT[],
    labels TEXT[],
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_conversations_org ON communication.whatsapp_conversations(organization_id);
CREATE INDEX idx_wa_conversations_phone ON communication.whatsapp_conversations(phone_number);
CREATE INDEX idx_wa_conversations_assigned ON communication.whatsapp_conversations(assigned_to);
CREATE INDEX idx_wa_conversations_last_msg ON communication.whatsapp_conversations(last_message_at DESC);

-- ============================================================
-- TABLE: core.settings
-- ============================================================
CREATE TABLE core.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, category, key)
);

CREATE INDEX idx_settings_org ON core.settings(organization_id, category);

-- ============================================================
-- NEW VIEWS
-- ============================================================

-- Training analytics view
CREATE OR REPLACE VIEW reports.v_training_analytics AS
SELECT
    c.organization_id,
    c.id AS course_id,
    c.title AS course_title,
    c.category,
    c.difficulty,
    c.status,
    COUNT(e.id) AS total_enrollments,
    COUNT(CASE WHEN e.status = 'completed' THEN 1 END) AS completions,
    COUNT(CASE WHEN e.status = 'in_progress' THEN 1 END) AS active_students,
    ROUND(AVG(e.progress_percent), 1) AS avg_progress,
    ROUND(AVG(e.score), 1) AS avg_score,
    ROUND(
        CASE WHEN COUNT(e.id) > 0 
        THEN (COUNT(CASE WHEN e.status = 'completed' THEN 1 END)::DECIMAL / COUNT(e.id)) * 100
        ELSE 0 END, 1
    ) AS completion_rate,
    SUM(c.price) AS total_revenue
FROM training.courses c
LEFT JOIN training.enrollments e ON c.id = e.course_id
WHERE c.deleted_at IS NULL
GROUP BY c.organization_id, c.id, c.title, c.category, c.difficulty, c.status;

-- Referral analytics view
CREATE OR REPLACE VIEW reports.v_referral_analytics AS
SELECT
    r.organization_id,
    p.id AS partner_id,
    p.name AS partner_name,
    p.tier,
    COUNT(r.id) AS total_referrals,
    COUNT(CASE WHEN r.status = 'converted' THEN 1 END) AS conversions,
    ROUND(
        CASE WHEN COUNT(r.id) > 0 
        THEN (COUNT(CASE WHEN r.status = 'converted' THEN 1 END)::DECIMAL / COUNT(r.id)) * 100
        ELSE 0 END, 1
    ) AS conversion_rate,
    COALESCE(SUM(r.deal_value), 0) AS total_deal_value,
    COALESCE(SUM(c.amount), 0) AS total_commissions,
    COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) AS paid_commissions
FROM crm.partners p
LEFT JOIN crm.referrals r ON p.id = r.partner_id
LEFT JOIN finance.commissions c ON r.id = c.referral_id
GROUP BY r.organization_id, p.id, p.name, p.tier;

-- Retainer summary view
CREATE OR REPLACE VIEW reports.v_retainer_summary AS
SELECT
    r.organization_id,
    r.type,
    r.status,
    r.billing_cycle,
    COUNT(*) AS retainer_count,
    SUM(r.amount) AS total_monthly_value,
    SUM(r.total_value) AS total_contract_value,
    ROUND(AVG(CASE WHEN r.total_hours > 0 THEN (r.used_hours / r.total_hours) * 100 ELSE 0 END), 1) AS avg_utilization,
    COUNT(CASE WHEN r.status = 'active' AND r.end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS expiring_soon
FROM finance.retainers r
WHERE r.deleted = false
GROUP BY r.organization_id, r.type, r.status, r.billing_cycle;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

-- Calculate retainer utilization
CREATE OR REPLACE FUNCTION finance.update_retainer_utilization()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('hourly', 'dedicated', 'consulting') THEN
        UPDATE finance.retainers 
        SET used_hours = (
            SELECT COALESCE(SUM(duration_minutes), 0) / 60.0
            FROM projects.time_logs tl
            JOIN projects.tasks t ON tl.task_id = t.id
            WHERE t.client_id = NEW.client_id
            AND tl.start_time >= NEW.start_date
            AND (NEW.end_date IS NULL OR tl.start_time <= NEW.end_date)
        )
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update enrollment count on course
CREATE OR REPLACE FUNCTION training.update_enrollment_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE training.courses 
        SET enrollment_count = enrollment_count + 1,
            updated_at = NOW()
        WHERE id = NEW.course_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE training.courses 
        SET enrollment_count = GREATEST(enrollment_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.course_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE training.courses 
        SET completion_count = completion_count + 1,
            updated_at = NOW()
        WHERE id = NEW.course_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_enrollment_counts
AFTER INSERT OR UPDATE OR DELETE ON training.enrollments
FOR EACH ROW EXECUTE FUNCTION training.update_enrollment_counts();

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_date ON finance.invoices(organization_id, status, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org_status_date ON finance.payments(organization_id, status, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_deals_org_stage_value ON crm.deals(organization_id, stage, value DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_priority ON projects.tasks(organization_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_created ON crm.leads(organization_id, status, created_at DESC);

-- Partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_active_clients ON crm.clients(id) WHERE status = 'active' AND deleted = false;
CREATE INDEX IF NOT EXISTS idx_open_invoices ON finance.invoices(id) WHERE status IN ('sent', 'viewed', 'partial', 'overdue');
CREATE INDEX IF NOT EXISTS idx_pending_tasks ON projects.tasks(id) WHERE status NOT IN ('done', 'cancelled') AND deleted = false;
CREATE INDEX IF NOT EXISTS idx_active_retainers ON finance.retainers(id) WHERE status = 'active' AND deleted = false;

-- Full-text search indexes
ALTER TABLE crm.clients ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_clients_search ON crm.clients USING gin(search_vector);

CREATE OR REPLACE FUNCTION crm.update_client_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_client_search
BEFORE INSERT OR UPDATE ON crm.clients
FOR EACH ROW EXECUTE FUNCTION crm.update_client_search_vector();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default notification templates
INSERT INTO notifications.notification_templates (organization_id, name, category, title_template, body_template, channels) 
SELECT id, 'payment_received', 'payment', 'Payment Received 💰', 'Payment of {{amount}} received for invoice #{{invoiceNumber}}', '{in_app,email}'
FROM core.organizations
WHERE is_active = true;

INSERT INTO notifications.notification_templates (organization_id, name, category, title_template, body_template, channels)
SELECT id, 'task_assigned', 'task', 'New Task Assigned 📋', 'You have been assigned task: {{taskTitle}}', '{in_app,push}'
FROM core.organizations
WHERE is_active = true;

INSERT INTO notifications.notification_templates (organization_id, name, category, title_template, body_template, channels)
SELECT id, 'deal_won', 'deal', 'Deal Won! 🎉', 'Deal {{dealTitle}} worth {{dealValue}} has been won!', '{in_app,email,push}'
FROM core.organizations
WHERE is_active = true;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

INSERT INTO core.migrations (version, description, checksum) 
VALUES ('2.0.0', 'Added training, referral, retainer, WhatsApp, calendar modules with views, procedures, and performance indexes', 
        MD5('v2.0.0-module-enhancements'));
