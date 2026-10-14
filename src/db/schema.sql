-- Schema for the prototype. Small on purpose: five tables that mirror the GraphQL types.

CREATE TABLE IF NOT EXISTS companies (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('EMAIL', 'MEETING')),
  subject     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  body        TEXT NOT NULL,
  sentences   JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  company_id TEXT REFERENCES companies (id)
);

CREATE TABLE IF NOT EXISTS deals (
  id           TEXT PRIMARY KEY,
  note_id      TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  company_id   TEXT REFERENCES companies (id),
  stage        TEXT NOT NULL,
  amount_cents BIGINT,
  currency     TEXT NOT NULL DEFAULT 'USD',
  next_step    TEXT
);

CREATE TABLE IF NOT EXISTS facts (
  id                    TEXT PRIMARY KEY,
  note_id               TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  field                 TEXT NOT NULL,
  value                 TEXT NOT NULL,
  source_sentence_index INTEGER NOT NULL,
  quoted_text           TEXT NOT NULL,
  grounded              BOOLEAN NOT NULL,
  grounding_reason      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS facts_note_id_idx ON facts (note_id);
CREATE INDEX IF NOT EXISTS deals_company_id_idx ON deals (company_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals (stage);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON contacts (company_id);
CREATE INDEX IF NOT EXISTS notes_received_at_idx ON notes (received_at);
