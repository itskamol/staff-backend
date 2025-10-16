-- Create monitoring schema for TimescaleDB
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Create active_windows hypertable
CREATE TABLE IF NOT EXISTS monitoring.active_windows (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    window_title VARCHAR(500),
    process_name VARCHAR(255),
    url VARCHAR(1000),
    datetime TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    organization_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, datetime)
);

-- Create visited_sites hypertable
CREATE TABLE IF NOT EXISTS monitoring.visited_sites (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    title VARCHAR(500),
    datetime TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER,
    organization_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, datetime)
);

-- Create screenshots hypertable
CREATE TABLE IF NOT EXISTS monitoring.screenshots (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    datetime TIMESTAMPTZ NOT NULL,
    organization_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, datetime)
);

-- Create user_sessions hypertable
CREATE TABLE IF NOT EXISTS monitoring.user_sessions (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('login', 'logout', 'lock', 'unlock', 'idle', 'active')),
    datetime TIMESTAMPTZ NOT NULL,
    organization_id INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, datetime)
);

-- Note: Hypertable creation and compression policies will be handled by TimescaleService
-- This is because they require the TimescaleDB extension to be loaded

-- Create indexes for active_windows
CREATE INDEX IF NOT EXISTS idx_active_windows_agent_id_datetime 
ON monitoring.active_windows (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_active_windows_organization_id_datetime 
ON monitoring.active_windows (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_active_windows_process_name 
ON monitoring.active_windows (process_name, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_active_windows_computer_uid 
ON monitoring.active_windows (computer_uid, datetime DESC);

-- Create indexes for visited_sites
CREATE INDEX IF NOT EXISTS idx_visited_sites_agent_id_datetime 
ON monitoring.visited_sites (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_visited_sites_organization_id_datetime 
ON monitoring.visited_sites (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_visited_sites_url_hash 
ON monitoring.visited_sites (md5(url), datetime DESC);

CREATE INDEX IF NOT EXISTS idx_visited_sites_computer_uid 
ON monitoring.visited_sites (computer_uid, datetime DESC);

-- Create indexes for screenshots
CREATE INDEX IF NOT EXISTS idx_screenshots_agent_id_datetime 
ON monitoring.screenshots (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_screenshots_organization_id_datetime 
ON monitoring.screenshots (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_screenshots_computer_uid 
ON monitoring.screenshots (computer_uid, datetime DESC);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_agent_id_datetime 
ON monitoring.user_sessions (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_organization_id_datetime 
ON monitoring.user_sessions (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_type 
ON monitoring.user_sessions (session_type, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_computer_uid 
ON monitoring.user_sessions (computer_uid, datetime DESC);

-- Enable RLS on monitoring tables
ALTER TABLE monitoring.active_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring.visited_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for monitoring tables
CREATE POLICY monitoring_active_windows_rls ON monitoring.active_windows
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

CREATE POLICY monitoring_visited_sites_rls ON monitoring.visited_sites
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

CREATE POLICY monitoring_screenshots_rls ON monitoring.screenshots
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

CREATE POLICY monitoring_user_sessions_rls ON monitoring.user_sessions
    USING (
        current_setting('app.current_role', true) = 'ADMIN'::text OR
        organization_id = current_setting('app.current_organization_id')::integer
    );

-- Create view for chunk status monitoring
CREATE OR REPLACE VIEW monitoring.chunk_status AS
SELECT 
    h.hypertable_name,
    c.chunk_name,
    c.range_start,
    c.range_end,
    c.is_compressed,
    pg_size_pretty(
        CASE 
            WHEN c.is_compressed THEN 
                COALESCE(cs.compressed_heap_size + cs.compressed_toast_size, 0)
            ELSE 
                pg_total_relation_size(c.chunk_name::regclass)
        END
    ) as chunk_size,
    CASE 
        WHEN c.is_compressed THEN 
            ROUND(
                (cs.uncompressed_heap_size::numeric / NULLIF(cs.compressed_heap_size + cs.compressed_toast_size, 0)) * 100, 
                2
            )
        ELSE NULL 
    END as compression_ratio
FROM timescaledb_information.hypertables h
JOIN timescaledb_information.chunks c ON h.hypertable_name = c.hypertable_name
LEFT JOIN timescaledb_information.compressed_chunk_stats cs ON c.chunk_name = cs.chunk_name
WHERE h.hypertable_schema = 'monitoring'
ORDER BY h.hypertable_name, c.range_start DESC;