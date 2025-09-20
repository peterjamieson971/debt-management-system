-- OAuth Tokens table for storing Gmail API credentials
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail',
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one OAuth connection per provider per email per organization
    UNIQUE(organization_id, provider, email)
);

-- Index for faster lookups
CREATE INDEX idx_oauth_tokens_org_provider ON oauth_tokens(organization_id, provider);
CREATE INDEX idx_oauth_tokens_email ON oauth_tokens(email);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's OAuth tokens"
ON oauth_tokens FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert OAuth tokens for their organization"
ON oauth_tokens FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update their organization's OAuth tokens"
ON oauth_tokens FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete their organization's OAuth tokens"
ON oauth_tokens FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

-- System Settings table for configurable application settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'ai', 'email', 'system', 'prompts', 'compliance'
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique settings per organization
    UNIQUE(organization_id, category, key)
);

-- Index for faster lookups
CREATE INDEX idx_system_settings_org_category ON system_settings(organization_id, category);
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
CREATE POLICY "Users can view their organization's settings"
ON system_settings FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

CREATE POLICY "System admins can manage settings"
ON system_settings FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

-- Workflow Executions table for tracking workflow runs
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id) ON DELETE CASCADE,
    workflow_id VARCHAR(100) NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'running',
    steps_executed INTEGER DEFAULT 0,
    results JSONB DEFAULT '[]',
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for workflow executions
CREATE INDEX idx_workflow_executions_case ON workflow_executions(case_id);
CREATE INDEX idx_workflow_executions_org ON workflow_executions(organization_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

-- Enable RLS
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_executions
CREATE POLICY "Users can view their organization's workflow executions"
ON workflow_executions FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can create workflow executions for their organization"
ON workflow_executions FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
    )
);

-- Update users table to include system_admin role
DO $$
BEGIN
    -- Check if the constraint exists and includes system_admin
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'users_role_check'
        AND check_clause LIKE '%system_admin%'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

        -- Add new constraint with system_admin
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'manager', 'collector', 'viewer', 'system_admin'));
    END IF;
END $$;

-- Add encryption key environment variable requirement comment
COMMENT ON TABLE oauth_tokens IS 'Requires ENCRYPTION_KEY environment variable for refresh token encryption';
COMMENT ON TABLE system_settings IS 'Supports encrypted values for sensitive configuration like API keys';

-- Insert default system settings for organizations
INSERT INTO system_settings (organization_id, category, key, value, description)
SELECT
    id as organization_id,
    'ai' as category,
    'model_routing_threshold' as key,
    '{"simple_max_tokens": 1000, "complex_min_tokens": 1001}' as value,
    'Token thresholds for routing between AI models' as description
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE organization_id = organizations.id
    AND category = 'ai'
    AND key = 'model_routing_threshold'
);

INSERT INTO system_settings (organization_id, category, key, value, description)
SELECT
    id as organization_id,
    'email' as category,
    'send_rate_limit' as key,
    '{"emails_per_minute": 10, "emails_per_hour": 100}' as value,
    'Rate limits for email sending to avoid spam detection' as description
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE organization_id = organizations.id
    AND category = 'email'
    AND key = 'send_rate_limit'
);

INSERT INTO system_settings (organization_id, category, key, value, description)
SELECT
    id as organization_id,
    'compliance' as category,
    'default_region' as key,
    '"UAE"' as value,
    'Default GCC region for compliance rules' as description
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE organization_id = organizations.id
    AND category = 'compliance'
    AND key = 'default_region'
);