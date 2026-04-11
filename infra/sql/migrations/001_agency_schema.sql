/*
  001_agency_schema.sql
  SocialHub API v2.0 — B0 Foundation Schema

  What this migration adds (safe to run multiple times via IF NOT EXISTS):

  workspaces
    + slug TEXT UNIQUE        (used in URL routing and Contract Workspace object)
    + updated_at TIMESTAMPTZ  (contract field, missing from original table)

  clients
    + slug TEXT               (unique per workspace, contract Client object)
    + brand_notes TEXT        (contract field; distinct from legacy brand_voice_notes)
    + logo_url TEXT           (contract field, was missing entirely)

  social_profiles (CREATE IF NOT EXISTS — new contract table)
    Full replacement shape for the old social_accounts structure.
    Columns: provider_id, provider_type, provider_meta, is_connected,
             connected_at, last_synced_at, token_expires_at, etc.
    NOTE: existing code that queries social_profiles with old column names
    (user_id, provider_account_id, expiry) will fail after this migration —
    see "routes that will crash" section of B0 deliverable.

  posts
    + workspace_id UUID       (nullable — populate from clients.workspace_id in B1)
    + original_content TEXT   (contract field; existing code uses "content")
    + scheduled_at TIMESTAMPTZ (contract field; existing code uses "scheduled_time")
    + publish_immediately BOOLEAN DEFAULT false
    + created_by UUID         (FK users; existing code uses user_id)
    Status constraint updated to:
      draft | needs_approval | approved | scheduled | publishing | published | failed

  post_targets
    + social_profile_id UUID  FK -> social_profiles (replaces social_account_id)
    + adapted_content TEXT
    + adapted_title TEXT
    + status TEXT             (pending | publishing | published | failed)
    + failure_reason TEXT
    + approved_at TIMESTAMPTZ
    + published_at TIMESTAMPTZ
    New unique constraint: (post_id, social_profile_id)
    Old publish_status column is left in place — existing code still reads it.

  approval_logs (CREATE IF NOT EXISTS — new table)
    Contract ApprovalLog shape: post_id, action, actor_id, actor_name, comment.
    Distinct from post_approval_events (legacy audit table, left untouched).
*/

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. workspaces — add slug and updated_at
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill slug from name for any existing rows (slugify: lower, spaces→hyphens)
UPDATE workspaces
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL now that existing rows are filled
ALTER TABLE workspaces
  ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspaces_slug_key' AND conrelid = 'workspaces'::regclass
  ) THEN
    ALTER TABLE workspaces ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. clients — add slug, brand_notes, logo_url
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS brand_notes TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Backfill slug for existing rows
UPDATE clients
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

ALTER TABLE clients
  ALTER COLUMN slug SET NOT NULL;

-- Unique slug per workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_workspace_id_slug_key' AND conrelid = 'clients'::regclass
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_workspace_id_slug_key UNIQUE (workspace_id, slug);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. social_profiles — new contract table (replaces social_accounts structure)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform          TEXT        NOT NULL CHECK (platform IN ('telegram','reddit','youtube','pinterest')),
  display_name      TEXT        NOT NULL,
  profile_image_url TEXT,
  provider_id       TEXT        NOT NULL,
  provider_type     TEXT        NOT NULL,
  provider_meta     JSONB       NOT NULL DEFAULT '{}',
  access_token      TEXT        NOT NULL,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  is_connected      BOOLEAN     NOT NULL DEFAULT TRUE,
  connected_at      TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, platform, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_social_profiles_client_id ON social_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_social_profiles_platform  ON social_profiles(platform);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. posts — new contract columns + updated status constraint
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS workspace_id        UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_content    TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_immediately BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by          UUID        REFERENCES users(id) ON DELETE SET NULL;

-- Backfill workspace_id from clients for existing posts
UPDATE posts p
SET workspace_id = c.workspace_id
FROM clients c
WHERE p.client_id = c.id AND p.workspace_id IS NULL;

-- Backfill original_content from content for existing posts
UPDATE posts
SET original_content = content
WHERE original_content IS NULL;

-- Backfill scheduled_at from scheduled_time
UPDATE posts
SET scheduled_at = scheduled_time
WHERE scheduled_at IS NULL AND scheduled_time IS NOT NULL;

-- Backfill created_by from user_id
UPDATE posts
SET created_by = user_id
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- Replace status check constraint to match contract values
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft','needs_approval','approved','scheduled','publishing','published','failed'));

CREATE INDEX IF NOT EXISTS idx_posts_workspace_id  ON posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_status        ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at  ON posts(scheduled_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. post_targets — new contract columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE post_targets
  ADD COLUMN IF NOT EXISTS social_profile_id UUID        REFERENCES social_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS adapted_content   TEXT,
  ADD COLUMN IF NOT EXISTS adapted_title     TEXT,
  ADD COLUMN IF NOT EXISTS status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','publishing','published','failed')),
  ADD COLUMN IF NOT EXISTS failure_reason    TEXT,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ;

-- New unique constraint: one target per (post, social_profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_targets_post_id_social_profile_id_key'
      AND conrelid = 'post_targets'::regclass
  ) THEN
    ALTER TABLE post_targets
      ADD CONSTRAINT post_targets_post_id_social_profile_id_key
      UNIQUE (post_id, social_profile_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_targets_social_profile_id ON post_targets(social_profile_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_status            ON post_targets(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. approval_logs — new contract table (distinct from post_approval_events)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  action     TEXT        NOT NULL CHECK (action IN ('submitted','approved','rejected','recalled')),
  actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT        NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_logs_post_id ON approval_logs(post_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. workspace_members — add surrogate id column (PK stays composite for now)
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: The contract specifies id uuid PK for workspace_members but the existing
-- composite PK (workspace_id, user_id) cannot be replaced without a full table
-- rewrite. An id column is added here for API response shaping; the composite
-- PK enforces uniqueness. Promote to PK in a future migration if needed.

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();

COMMIT;
