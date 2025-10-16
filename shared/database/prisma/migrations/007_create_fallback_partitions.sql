-- Migration: Create PostgreSQL partition tables for TimescaleDB fallback
-- This migration creates partitioned tables in PostgreSQL that mirror the TimescaleDB schema
-- These tables serve as fallback when TimescaleDB is unavailable

-- Create fallback schema
CREATE SCHEMA IF NOT EXISTS fallback;

-- Active Windows Fallback Table (Partitioned by date)
CREATE TABLE IF NOT EXISTS fallback.active_windows_fallback (
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
) PARTITION BY RANGE (datetime);

-- Create initial partitions for active windows (current month and next month)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current month partition
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'active_windows_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.active_windows_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Next month partition
    start_date := end_date;
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'active_windows_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.active_windows_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END $$;

-- Visited Sites Fallback Table (Partitioned by date)
CREATE TABLE IF NOT EXISTS fallback.visited_sites_fallback (
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
) PARTITION BY RANGE (datetime);

-- Create initial partitions for visited sites
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current month partition
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'visited_sites_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.visited_sites_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Next month partition
    start_date := end_date;
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'visited_sites_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.visited_sites_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END $$;

-- Screenshots Fallback Table (Partitioned by date)
CREATE TABLE IF NOT EXISTS fallback.screenshots_fallback (
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
) PARTITION BY RANGE (datetime);

-- Create initial partitions for screenshots
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current month partition
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'screenshots_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.screenshots_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Next month partition
    start_date := end_date;
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'screenshots_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.screenshots_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END $$;

-- User Sessions Fallback Table (Partitioned by date)
CREATE TABLE IF NOT EXISTS fallback.user_sessions_fallback (
    id UUID DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    computer_uid VARCHAR(255) NOT NULL,
    user_sid VARCHAR(255) NOT NULL,
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'IDLE', 'ACTIVE')),
    datetime TIMESTAMPTZ NOT NULL,
    organization_id INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, datetime)
) PARTITION BY RANGE (datetime);

-- Create initial partitions for user sessions
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current month partition
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'user_sessions_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.user_sessions_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Next month partition
    start_date := end_date;
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'user_sessions_fallback_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.user_sessions_fallback 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END $$;

-- Create indexes for fallback tables
-- Active Windows indexes
CREATE INDEX IF NOT EXISTS idx_active_windows_fallback_agent_id_datetime 
ON fallback.active_windows_fallback (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_active_windows_fallback_organization_id_datetime 
ON fallback.active_windows_fallback (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_active_windows_fallback_process_name 
ON fallback.active_windows_fallback (process_name, datetime DESC);

-- Visited Sites indexes
CREATE INDEX IF NOT EXISTS idx_visited_sites_fallback_agent_id_datetime 
ON fallback.visited_sites_fallback (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_visited_sites_fallback_organization_id_datetime 
ON fallback.visited_sites_fallback (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_visited_sites_fallback_url_hash 
ON fallback.visited_sites_fallback (md5(url), datetime DESC);

-- Screenshots indexes
CREATE INDEX IF NOT EXISTS idx_screenshots_fallback_agent_id_datetime 
ON fallback.screenshots_fallback (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_screenshots_fallback_organization_id_datetime 
ON fallback.screenshots_fallback (organization_id, datetime DESC);

-- User Sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_fallback_agent_id_datetime 
ON fallback.user_sessions_fallback (agent_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_fallback_organization_id_datetime 
ON fallback.user_sessions_fallback (organization_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_fallback_session_type 
ON fallback.user_sessions_fallback (session_type, datetime DESC);

-- Function to automatically create new partitions
CREATE OR REPLACE FUNCTION fallback.create_monthly_partition(
    table_name TEXT,
    partition_date DATE
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS fallback.%I PARTITION OF fallback.%I 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, table_name, start_date, end_date);
    
    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create partitions for the next 3 months
CREATE OR REPLACE FUNCTION fallback.ensure_future_partitions() RETURNS VOID AS $$
DECLARE
    table_names TEXT[] := ARRAY['active_windows_fallback', 'visited_sites_fallback', 'screenshots_fallback', 'user_sessions_fallback'];
    table_name TEXT;
    i INTEGER;
BEGIN
    FOREACH table_name IN ARRAY table_names LOOP
        FOR i IN 1..3 LOOP
            PERFORM fallback.create_monthly_partition(
                table_name, 
                (CURRENT_DATE + (i || ' months')::INTERVAL)::DATE
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (older than retention period)
CREATE OR REPLACE FUNCTION fallback.cleanup_old_partitions(
    retention_months INTEGER DEFAULT 3
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := (CURRENT_DATE - (retention_months || ' months')::INTERVAL)::DATE;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'fallback' 
        AND tablename ~ '_\d{4}_\d{2}$'
        AND to_date(substring(tablename from '_(\d{4}_\d{2})$'), 'YYYY_MM') < cutoff_date
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.%I', partition_record.schemaname, partition_record.tablename);
        RAISE NOTICE 'Dropped old partition: %.%', partition_record.schemaname, partition_record.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to maintain partitions (requires pg_cron extension)
-- This is optional and requires pg_cron to be installed
DO $$
BEGIN
    -- Check if pg_cron extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule partition maintenance to run monthly
        PERFORM cron.schedule(
            'partition-maintenance',
            '0 2 1 * *', -- Run at 2 AM on the 1st of every month
            'SELECT fallback.ensure_future_partitions(); SELECT fallback.cleanup_old_partitions();'
        );
        RAISE NOTICE 'Scheduled partition maintenance job';
    ELSE
        RAISE NOTICE 'pg_cron extension not available, partition maintenance must be run manually';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule partition maintenance: %', SQLERRM;
END $$;

-- Create a view that combines TimescaleDB and fallback data (for unified queries)
CREATE OR REPLACE VIEW public.active_windows_unified AS
SELECT 
    id, agent_id, computer_uid, user_sid, window_title, 
    process_name, url, datetime, duration_seconds, organization_id, 
    created_at, 'timescale' as source
FROM monitoring.active_windows
UNION ALL
SELECT 
    id, agent_id, computer_uid, user_sid, window_title, 
    process_name, url, datetime, duration_seconds, organization_id, 
    created_at, 'fallback' as source
FROM fallback.active_windows_fallback;

CREATE OR REPLACE VIEW public.visited_sites_unified AS
SELECT 
    id, agent_id, computer_uid, user_sid, url, title, 
    datetime, duration_seconds, organization_id, created_at, 'timescale' as source
FROM monitoring.visited_sites
UNION ALL
SELECT 
    id, agent_id, computer_uid, user_sid, url, title, 
    datetime, duration_seconds, organization_id, created_at, 'fallback' as source
FROM fallback.visited_sites_fallback;

CREATE OR REPLACE VIEW public.screenshots_unified AS
SELECT 
    id, agent_id, computer_uid, user_sid, file_path, file_size,
    datetime, organization_id, created_at, 'timescale' as source
FROM monitoring.screenshots
UNION ALL
SELECT 
    id, agent_id, computer_uid, user_sid, file_path, file_size,
    datetime, organization_id, created_at, 'fallback' as source
FROM fallback.screenshots_fallback;

CREATE OR REPLACE VIEW public.user_sessions_unified AS
SELECT 
    id, agent_id, computer_uid, user_sid, session_type,
    datetime, organization_id, metadata, created_at, 'timescale' as source
FROM monitoring.user_sessions
UNION ALL
SELECT 
    id, agent_id, computer_uid, user_sid, session_type,
    datetime, organization_id, metadata, created_at, 'fallback' as source
FROM fallback.user_sessions_fallback;

-- Grant permissions
GRANT USAGE ON SCHEMA fallback TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fallback TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fallback TO PUBLIC;

-- Create monitoring table for tracking fallback usage
CREATE TABLE IF NOT EXISTS public.datasource_usage_log (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    datasource VARCHAR(20) NOT NULL CHECK (datasource IN ('timescale', 'postgres_fallback')),
    table_name VARCHAR(100) NOT NULL,
    record_count INTEGER DEFAULT 1,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasource_usage_log_created_at 
ON public.datasource_usage_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_datasource_usage_log_datasource 
ON public.datasource_usage_log (datasource, created_at DESC);

-- Function to log datasource usage
CREATE OR REPLACE FUNCTION public.log_datasource_usage(
    p_operation VARCHAR(100),
    p_datasource VARCHAR(20),
    p_table_name VARCHAR(100),
    p_record_count INTEGER DEFAULT 1,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.datasource_usage_log (
        operation, datasource, table_name, record_count, 
        execution_time_ms, error_message
    ) VALUES (
        p_operation, p_datasource, p_table_name, p_record_count,
        p_execution_time_ms, p_error_message
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON SCHEMA fallback IS 'PostgreSQL partition tables for TimescaleDB fallback';
COMMENT ON TABLE fallback.active_windows_fallback IS 'Fallback table for active windows when TimescaleDB is unavailable';
COMMENT ON TABLE fallback.visited_sites_fallback IS 'Fallback table for visited sites when TimescaleDB is unavailable';
COMMENT ON TABLE fallback.screenshots_fallback IS 'Fallback table for screenshots when TimescaleDB is unavailable';
COMMENT ON TABLE fallback.user_sessions_fallback IS 'Fallback table for user sessions when TimescaleDB is unavailable';
COMMENT ON FUNCTION fallback.create_monthly_partition IS 'Creates a new monthly partition for the specified table';
COMMENT ON FUNCTION fallback.ensure_future_partitions IS 'Ensures partitions exist for the next 3 months';
COMMENT ON FUNCTION fallback.cleanup_old_partitions IS 'Removes partitions older than the retention period';
COMMENT ON FUNCTION public.log_datasource_usage IS 'Logs datasource usage for monitoring and analytics';