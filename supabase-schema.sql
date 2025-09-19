-- Automated Debt Collection System Database Schema
-- For GCC Recruitment Agencies

-- Organizations (Multi-tenant support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'collector',
    full_name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debtors
CREATE TABLE debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50), -- 'SME', 'Enterprise', 'Multinational'
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    secondary_contacts JSONB DEFAULT '[]',
    address JSONB,
    country VARCHAR(2), -- 'AE', 'SA', 'KW', 'QA', 'BH', 'OM'
    language_preference VARCHAR(10) DEFAULT 'en', -- 'en', 'ar'
    risk_profile VARCHAR(50) DEFAULT 'medium',
    behavioral_score DECIMAL(3,2) DEFAULT 0.50,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AED',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    line_items JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'overdue', 'partial', 'paid', 'disputed', 'written_off'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Workflows
CREATE TABLE collection_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    debtor_segment VARCHAR(50), -- 'SME', 'Enterprise', 'Strategic', 'Transactional'
    stages JSONB NOT NULL, -- Array of stage definitions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Cases
CREATE TABLE collection_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_ids UUID[] NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    outstanding_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'resolved', 'escalated', 'legal'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    assigned_to UUID REFERENCES users(id),
    workflow_id UUID REFERENCES collection_workflows(id),
    current_stage INTEGER DEFAULT 1,
    ai_strategy JSONB DEFAULT '{}',
    payment_promise_date DATE,
    last_contact_date TIMESTAMPTZ,
    next_action_date TIMESTAMPTZ,
    escalation_date TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communication Logs
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- 'email', 'phone', 'sms', 'whatsapp', 'letter'
    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    status VARCHAR(50) DEFAULT 'sent', -- 'draft', 'sent', 'delivered', 'read', 'replied', 'bounced', 'failed'
    subject TEXT,
    content TEXT,
    ai_generated BOOLEAN DEFAULT false,
    sentiment_score DECIMAL(3,2),
    intent_classification VARCHAR(100),
    response_required BOOLEAN DEFAULT false,
    zapier_task_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id),
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_ids UUID[],
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AED',
    payment_method VARCHAR(50),
    reference_number VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Interactions
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id),
    interaction_type VARCHAR(50), -- 'email_generation', 'response_analysis', 'strategy_adjustment', 'voice_call'
    prompt TEXT,
    response TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10,6),
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_debtors_organization ON debtors(organization_id);
CREATE INDEX idx_debtors_email ON debtors(primary_contact_email);
CREATE INDEX idx_debtors_company ON debtors(company_name);
CREATE INDEX idx_invoices_debtor ON invoices(debtor_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_cases_status ON collection_cases(status);
CREATE INDEX idx_cases_assigned ON collection_cases(assigned_to);
CREATE INDEX idx_cases_debtor ON collection_cases(debtor_id);
CREATE INDEX idx_communications_case ON communication_logs(case_id);
CREATE INDEX idx_communications_debtor ON communication_logs(debtor_id);
CREATE INDEX idx_communications_channel ON communication_logs(channel);
CREATE INDEX idx_payments_debtor ON payments(debtor_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_entity ON analytics_events(entity_type, entity_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant security

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT
    USING (id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization" ON organizations
    FOR UPDATE
    USING (id = (auth.jwt() ->> 'organization_id')::UUID);

-- Users: Can only see users from their organization
CREATE POLICY "Users can view organization users" ON users
    FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert organization users" ON users
    FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update organization users" ON users
    FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Debtors: Organization-scoped access
CREATE POLICY "Users can view their organization's debtors" ON debtors
    FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert debtors for their organization" ON debtors
    FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization's debtors" ON debtors
    FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Invoices: Organization-scoped access
CREATE POLICY "Users can view their organization's invoices" ON invoices
    FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert invoices for their organization" ON invoices
    FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization's invoices" ON invoices
    FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Collection Cases: Organization-scoped access
CREATE POLICY "Users can view their organization's cases" ON collection_cases
    FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert cases for their organization" ON collection_cases
    FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization's cases" ON collection_cases
    FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Similar policies for other tables
CREATE POLICY "Users can view their organization's workflows" ON collection_workflows
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can view their organization's communications" ON communication_logs
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can view their organization's payments" ON payments
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can view their organization's ai_interactions" ON ai_interactions
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can view their organization's analytics" ON analytics_events
    FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debtors_updated_at BEFORE UPDATE ON debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_cases_updated_at BEFORE UPDATE ON collection_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_workflows_updated_at BEFORE UPDATE ON collection_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communication_logs_updated_at BEFORE UPDATE ON communication_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO organizations (id, name, email, subscription_tier) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'GCC Recruitment Solutions', 'admin@gccrecruitment.com', 'pro');

INSERT INTO users (id, organization_id, email, role, full_name) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'admin@gccrecruitment.com', 'admin', 'Ahmed Al-Rashid'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'collector@gccrecruitment.com', 'collector', 'Sarah Johnson');

INSERT INTO debtors (id, organization_id, company_name, company_type, primary_contact_email, country, language_preference) VALUES
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Dubai Tech Solutions', 'SME', 'finance@dubaitech.ae', 'AE', 'en'),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Riyadh Engineering Corp', 'Enterprise', 'accounts@riyadheng.sa', 'SA', 'ar');

INSERT INTO collection_workflows (id, organization_id, name, debtor_segment, stages) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Standard B2B Collection - SME', 'SME',
'[
  {
    "stage": 1,
    "name": "Friendly Reminder",
    "delay_days": -5,
    "actions": [
      {
        "type": "email",
        "template": "friendly_reminder",
        "language": "auto"
      }
    ]
  },
  {
    "stage": 2,
    "name": "First Notice",
    "delay_days": 3,
    "actions": [
      {
        "type": "email",
        "template": "first_notice",
        "language": "auto"
      }
    ]
  },
  {
    "stage": 3,
    "name": "Final Notice",
    "delay_days": 30,
    "actions": [
      {
        "type": "email",
        "template": "final_notice",
        "language": "auto",
        "require_read_receipt": true
      }
    ]
  }
]'::jsonb);

-- Create sample invoices and cases for testing
INSERT INTO invoices (id, organization_id, debtor_id, invoice_number, amount, issue_date, due_date, status) VALUES
('990e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', 'INV-2025-001', 15000.00, '2025-01-01', '2025-01-31', 'overdue'),
('990e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440002', 'INV-2025-002', 25000.00, '2025-01-15', '2025-02-14', 'pending');

INSERT INTO collection_cases (id, organization_id, debtor_id, invoice_ids, total_amount, outstanding_amount, workflow_id, assigned_to) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001',
 ARRAY['990e8400-e29b-41d4-a716-446655440001'], 15000.00, 15000.00, '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002');

-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;