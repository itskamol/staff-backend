-- Add retention policy table
CREATE TABLE retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER REFERENCES organizations(id),
    resource_type VARCHAR(100) NOT NULL,
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    action VARCHAR(20) NOT NULL CHECK (action IN ('delete', 'archive')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add retention job table
CREATE TABLE retention_jobs (
    id VARCHAR(255) PRIMARY KEY,
    policy_id UUID NOT NULL REFERENCES retention_policies(id) ON DELETE CASCADE,
    file_path VARCHAR(1000) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('delete', 'archive')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for retention tables
CREATE INDEX idx_retention_policies_organization_id ON retention_policies(organization_id);
CREATE INDEX idx_retention_policies_resource_type ON retention_policies(resource_type);
CREATE INDEX idx_retention_policies_is_active ON retention_policies(is_active);

CREATE INDEX idx_retention_jobs_policy_id ON retention_jobs(policy_id);
CREATE INDEX idx_retention_jobs_status ON retention_jobs(status);
CREATE INDEX idx_retention_jobs_scheduled_for ON retention_jobs(scheduled_for);
CREATE INDEX idx_retention_jobs_processed_at ON retention_jobs(processed_at);

-- Enable RLS on retention tables
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for retention_policies
CREATE POLICY retention_policies_rls ON retention_policies
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        (organization_id IS NULL OR organization_id = current_setting('app.current_organization_id')::integer)
    );

-- Create RLS policies for retention_jobs (admin only for job management)
CREATE POLICY retention_jobs_rls ON retention_jobs
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        EXISTS (
            SELECT 1 FROM retention_policies rp 
            WHERE rp.id = policy_id 
            AND (rp.organization_id IS NULL OR rp.organization_id = current_setting('app.current_organization_id')::integer)
        )
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for retention_policies
CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default retention policies for common resource types
INSERT INTO retention_policies (resource_type, retention_days, action, is_active) VALUES
('screenshot', 90, 'archive', true),
('credential', 365, 'delete', true),
('profile', 180, 'archive', true),
('log', 30, 'delete', true),
('audit', 2555, 'archive', true); -- 7 years for audit logs