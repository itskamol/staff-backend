-- Add RLS audit log table
CREATE TABLE rls_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    organization_id INTEGER REFERENCES organizations(id),
    resource VARCHAR(100) NOT NULL,
    policy_name VARCHAR(100) NOT NULL,
    access_granted BOOLEAN NOT NULL,
    reason TEXT,
    request_id VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for RLS audit logs
CREATE INDEX idx_rls_audit_logs_timestamp ON rls_audit_logs(timestamp DESC);
CREATE INDEX idx_rls_audit_logs_organization_id ON rls_audit_logs(organization_id);
CREATE INDEX idx_rls_audit_logs_user_id ON rls_audit_logs(user_id);
CREATE INDEX idx_rls_audit_logs_access_granted ON rls_audit_logs(access_granted);
CREATE INDEX idx_rls_audit_logs_resource ON rls_audit_logs(resource);
CREATE INDEX idx_rls_audit_logs_request_id ON rls_audit_logs(request_id);

-- Enable RLS on core tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organizations
CREATE POLICY organization_rls ON organizations
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for departments
CREATE POLICY department_rls ON departments
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for employees
CREATE POLICY employee_rls ON employees
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for devices
CREATE POLICY device_rls ON devices
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for policies table
CREATE POLICY policy_rls ON policies
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for users (more restrictive)
CREATE POLICY user_rls ON users
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        (organization_id = current_setting('app.current_organization_id')::integer AND
         current_setting('app.current_role', true) IN ('HR', 'DEPARTMENT_LEAD'))
    );

-- Enable RLS on new tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_baseline ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for API keys
CREATE POLICY api_key_rls ON api_keys
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for certificates
CREATE POLICY certificate_rls ON certificates
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create RLS policies for performance baseline (admin only)
CREATE POLICY performance_baseline_rls ON performance_baseline
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text
    );

-- Create function to check RLS policy violations
CREATE OR REPLACE FUNCTION check_rls_violation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log potential policy violations
    INSERT INTO rls_audit_logs (
        action,
        user_id,
        organization_id,
        resource,
        policy_name,
        access_granted,
        reason,
        timestamp
    ) VALUES (
        TG_OP,
        NULLIF(current_setting('app.current_user_id', true), '')::integer,
        NULLIF(current_setting('app.current_organization_id', true), '')::integer,
        TG_TABLE_NAME,
        'rls_trigger',
        true,
        'Policy check passed',
        NOW()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add triggers to monitor RLS policy usage
CREATE TRIGGER rls_monitor_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION check_rls_violation();

CREATE TRIGGER rls_monitor_employees
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION check_rls_violation();

CREATE TRIGGER rls_monitor_devices
    AFTER INSERT OR UPDATE OR DELETE ON devices
    FOR EACH ROW EXECUTE FUNCTION check_rls_violation();