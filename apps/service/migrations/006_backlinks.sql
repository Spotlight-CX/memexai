CREATE TABLE IF NOT EXISTS mx_backlink (
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  PRIMARY KEY (source_path, target_path)
);
CREATE INDEX IF NOT EXISTS mx_backlink_target_idx ON mx_backlink (target_path);
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS importance_score REAL NOT NULL DEFAULT 0;
