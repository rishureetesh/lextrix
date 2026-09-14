-- Lextrix Phase 12 — snapshots, archive, lifecycle, region (ADR-031..035)
-- Additive migration 002

CREATE TABLE IF NOT EXISTS document_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document_heads(document_id),
  version_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  contents JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_id)
);

CREATE INDEX IF NOT EXISTS document_snapshots_doc_seq_idx
  ON document_snapshots (document_id, sequence DESC);

CREATE TABLE IF NOT EXISTS version_archive (
  version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  parent_id TEXT NULL,
  change_from_parent JSONB NULL,
  contents JSONB NOT NULL,
  meta JSONB NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, sequence)
);

CREATE INDEX IF NOT EXISTS version_archive_doc_seq_idx
  ON version_archive (document_id, sequence);

ALTER TABLE document_heads
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'active';

ALTER TABLE document_heads
  ADD COLUMN IF NOT EXISTS home_region TEXT NULL;

ALTER TABLE document_heads
  ADD COLUMN IF NOT EXISTS sealed_version_id TEXT NULL;

ALTER TABLE document_heads
  ADD COLUMN IF NOT EXISTS sealed_sequence INTEGER NULL;
