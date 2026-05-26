CREATE TABLE IF NOT EXISTS mx_dream_run (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  last_dreamed_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  files_touched INT,
  error TEXT,
  dream_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_dream_run_user_idx ON mx_dream_run (user_id);
CREATE INDEX IF NOT EXISTS mx_dream_run_status_idx ON mx_dream_run (status, last_started_at);

CREATE TABLE IF NOT EXISTS mx_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mx_config (key, value, description) VALUES
  ('dream_enabled', 'false', 'Master switch for the dream loop (opt-in)'),
  ('dream_interval_minutes', '60', 'How often the cron tick fires'),
  ('dream_grace_period_minutes', '30', 'Min quiet time after last write before dreaming'),
  ('dream_max_writes', '10', 'Max write/patch calls per dream run'),
  ('dream_concurrency', '3', 'Max concurrent dream runs per cron tick')
ON CONFLICT (key) DO NOTHING;
