-- Lextrix Phase 11 — production schema (ADR-023 / ADR-025)
-- Versioned migration 001

CREATE TABLE IF NOT EXISTS document_heads (
  document_id TEXT PRIMARY KEY,
  head_version_id TEXT NULL,
  head_sequence INTEGER NOT NULL DEFAULT -1,
  owner_epoch BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS versions (
  version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document_heads(document_id),
  sequence INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  parent_id TEXT NULL,
  change_from_parent JSONB NULL,
  contents JSONB NOT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, sequence)
);

CREATE INDEX IF NOT EXISTS versions_document_sequence_idx
  ON versions (document_id, sequence);

CREATE TABLE IF NOT EXISTS change_ids (
  document_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  version_id TEXT NOT NULL REFERENCES versions(version_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, change_id)
);

CREATE TABLE IF NOT EXISTS document_ownership (
  document_id TEXT PRIMARY KEY REFERENCES document_heads(document_id),
  owner_id TEXT NOT NULL,
  owner_epoch BIGINT NOT NULL,
  partition INTEGER NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_ownership_owner_idx
  ON document_ownership (owner_id);
