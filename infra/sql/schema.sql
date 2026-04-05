CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  default_workspace_id UUID,
  default_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'client_approver')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_billing (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free', 'pro')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_subscription_status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_voice_notes TEXT,
  content_do TEXT[] NOT NULL DEFAULT '{}',
  content_dont TEXT[] NOT NULL DEFAULT '{}',
  content_pillars TEXT[] NOT NULL DEFAULT '{}',
  cta_style TEXT,
  default_hashtags TEXT[] NOT NULL DEFAULT '{}',
  banned_terms TEXT[] NOT NULL DEFAULT '{}',
  required_disclaimer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS client_approver_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_default_workspace'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_default_workspace
      FOREIGN KEY (default_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_default_client'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_default_client
      FOREIGN KEY (default_client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'reddit', 'youtube', 'pinterest')),
  provider_account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, platform, provider_account_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL UNIQUE,
  public_url TEXT,
  upload_token_hash TEXT,
  upload_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_id ON media_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_client_id ON media_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);
CREATE INDEX IF NOT EXISTS idx_workspace_billing_plan_code ON workspace_billing(plan_code);
CREATE INDEX IF NOT EXISTS idx_workspace_billing_customer_id ON workspace_billing(stripe_customer_id);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  generation_source TEXT NOT NULL DEFAULT 'manual' CHECK (generation_source IN ('manual', 'autopilot_stub', 'autopilot_ai')),
  scheduled_time TIMESTAMPTZ,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'needs_approval', 'approved', 'rejected')),
  approval_requested_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'publishing', 'published', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS brand_voice_notes TEXT;
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS content_do TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS content_dont TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS content_pillars TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cta_style TEXT;
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_hashtags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS banned_terms TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS required_disclaimer TEXT;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS risk_flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS generation_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_generation_source_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_generation_source_check
  CHECK (generation_source IN ('manual', 'autopilot_stub', 'autopilot_ai'));

CREATE TABLE IF NOT EXISTS tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_client_id ON tracked_links(client_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_post_id ON tracked_links(post_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_short_code ON tracked_links(short_code);

CREATE TABLE IF NOT EXISTS tracked_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_link_clicks_link_id ON tracked_link_clicks(tracked_link_id);
CREATE INDEX IF NOT EXISTS idx_tracked_link_clicks_created_at ON tracked_link_clicks(created_at);

CREATE TABLE IF NOT EXISTS post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'reddit', 'youtube', 'pinterest')),
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  publish_status TEXT NOT NULL DEFAULT 'pending' CHECK (publish_status IN ('pending', 'queued', 'published', 'failed')),
  external_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uniq_post_targets_post_platform_legacy'
  ) THEN
    CREATE UNIQUE INDEX uniq_post_targets_post_platform_legacy
      ON post_targets(post_id, platform)
      WHERE social_account_id IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uniq_post_targets_post_social_account'
  ) THEN
    CREATE UNIQUE INDEX uniq_post_targets_post_social_account
      ON post_targets(post_id, social_account_id)
      WHERE social_account_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_media_asset_id ON posts(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_time ON posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posts_approval_status ON posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_client_id ON social_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_post_targets_post_id ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_client_approver_assignments_client_id ON client_approver_assignments(client_id);

CREATE TABLE IF NOT EXISTS post_approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_label TEXT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_approval_events
  DROP CONSTRAINT IF EXISTS post_approval_events_action_check;

ALTER TABLE post_approval_events
  ADD CONSTRAINT post_approval_events_action_check
  CHECK (action IN ('created', 'updated', 'requested', 'approved', 'rejected', 'unapproved', 'commented'));

CREATE INDEX IF NOT EXISTS idx_post_approval_events_post_id ON post_approval_events(post_id);

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS autopilot_generation_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS workspace_ai_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  provider_request_id TEXT,
  requested_count INT NOT NULL DEFAULT 0,
  generated_count INT NOT NULL DEFAULT 0,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed', 'disabled', 'rate_limited')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_ai_generation_usage_workspace_created_at
  ON workspace_ai_generation_usage(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS autopilot_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feature_key TEXT NOT NULL DEFAULT 'autopilot_generation',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  requested_draft_count INTEGER NOT NULL DEFAULT 0,
  generated_draft_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  provider_response_id TEXT,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'succeeded', 'failed', 'rate_limited', 'disabled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_generation_usage_workspace_id ON autopilot_generation_usage(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_generation_usage_client_id ON autopilot_generation_usage(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_generation_usage_feature_key ON autopilot_generation_usage(feature_key, status, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  label TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_magic_links_client_id ON approval_magic_links(client_id);
CREATE INDEX IF NOT EXISTS idx_approval_magic_links_expires_at ON approval_magic_links(expires_at);

CREATE TABLE IF NOT EXISTS oauth_connect_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'reddit', 'youtube', 'pinterest')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  profile_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_connect_sessions_user_id ON oauth_connect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connect_sessions_client_id ON oauth_connect_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connect_sessions_created_at ON oauth_connect_sessions(created_at);







ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS autopilot_generation_enabled BOOLEAN NOT NULL DEFAULT TRUE;

