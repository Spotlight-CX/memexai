CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE mx_file
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_strategy TEXT,
  ADD COLUMN IF NOT EXISTS embedding_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mx_file_embedding_idx
  ON mx_file USING hnsw (embedding vector_cosine_ops);
