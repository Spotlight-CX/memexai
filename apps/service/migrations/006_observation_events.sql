CREATE TABLE IF NOT EXISTS mx_observation_event (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INT,
  user_id TEXT,
  actor TEXT,
  tool_name TEXT,
  operation TEXT,
  physical_path TEXT,
  tool_call_id TEXT,
  error_code TEXT,
  trace_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_observation_event_created_idx ON mx_observation_event (created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_user_idx ON mx_observation_event (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_tool_idx ON mx_observation_event (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_status_idx ON mx_observation_event (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_path_idx ON mx_observation_event (physical_path, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_trace_idx ON mx_observation_event (trace_id);
