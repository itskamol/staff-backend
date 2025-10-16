-- Add performance baseline table for storing baseline metrics
CREATE TABLE performance_baseline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_response_time_95th DECIMAL(10,3) NOT NULL,
    db_query_latency DECIMAL(10,3) NOT NULL,
    throughput_rps DECIMAL(10,3) NOT NULL,
    memory_usage DECIMAL(10,3) NOT NULL,
    cpu_usage DECIMAL(10,3) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    environment VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_performance_baseline_environment_timestamp ON performance_baseline(environment, timestamp DESC);
CREATE INDEX idx_performance_baseline_version ON performance_baseline(version);
CREATE INDEX idx_performance_baseline_timestamp ON performance_baseline(timestamp DESC);