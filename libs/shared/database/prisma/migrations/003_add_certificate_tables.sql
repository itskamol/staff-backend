-- Add certificate management tables
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    common_name VARCHAR(255) NOT NULL,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    issuer_dn TEXT NOT NULL,
    subject_dn TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_revoked BOOLEAN DEFAULT FALSE,
    renewal_id UUID,
    renewal_started_at TIMESTAMPTZ,
    renewal_completed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add certificate distribution tracking
CREATE TABLE certificate_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id),
    gateway_id VARCHAR(255) NOT NULL,
    distributed_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add certificate audit log table
CREATE TABLE certificate_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    certificate_id UUID NOT NULL REFERENCES certificates(id),
    organization_id INTEGER REFERENCES organizations(id),
    metadata TEXT DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_certificates_serial_number ON certificates(serial_number);
CREATE INDEX idx_certificates_organization_id ON certificates(organization_id);
CREATE INDEX idx_certificates_valid_to ON certificates(valid_to);
CREATE INDEX idx_certificates_is_active ON certificates(is_active);
CREATE INDEX idx_certificates_is_revoked ON certificates(is_revoked);
CREATE INDEX idx_certificates_common_name ON certificates(common_name);

CREATE INDEX idx_certificate_distributions_certificate_id ON certificate_distributions(certificate_id);
CREATE INDEX idx_certificate_distributions_gateway_id ON certificate_distributions(gateway_id);
CREATE INDEX idx_certificate_distributions_status ON certificate_distributions(status);

CREATE INDEX idx_certificate_audit_logs_certificate_id ON certificate_audit_logs(certificate_id);
CREATE INDEX idx_certificate_audit_logs_timestamp ON certificate_audit_logs(timestamp DESC);
CREATE INDEX idx_certificate_audit_logs_action ON certificate_audit_logs(action);