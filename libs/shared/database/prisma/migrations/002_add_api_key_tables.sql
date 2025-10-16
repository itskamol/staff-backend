-- Add API key management tables
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(255) UNIQUE NOT NULL,
    hashed_key TEXT NOT NULL,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    permissions TEXT DEFAULT '[]',
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    rotation_id UUID,
    rotation_started_at TIMESTAMPTZ,
    rotation_completed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add API key audit log table
CREATE TABLE api_key_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    key_id VARCHAR(255) NOT NULL,
    organization_id INTEGER REFERENCES organizations(id),
    metadata TEXT DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_rotation_id ON api_keys(rotation_id);

CREATE INDEX idx_api_key_audit_logs_key_id ON api_key_audit_logs(key_id);
CREATE INDEX idx_api_key_audit_logs_timestamp ON api_key_audit_logs(timestamp DESC);
CREATE INDEX idx_api_key_audit_logs_action ON api_key_audit_logs(action);