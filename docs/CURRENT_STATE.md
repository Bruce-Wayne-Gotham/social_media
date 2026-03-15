# SocialHub - Current State (What Works Today)

This document describes what the app supports right now in this repository, what APIs exist, and the current limitations.

## What This Website Is
SocialHub is an agency-first social media management app foundation for:
- Managing multiple clients (brands) inside a workspace (agency).
- Connecting social profiles per client for LinkedIn, Instagram, and YouTube.
- Creating posts for a client.
- Safe Mode approvals: posts must be approved before they can be queued/published.
- Scheduling and publishing via a Redis/BullMQ worker.

## Agency User Journey (Current UX)
1. Log in (a default workspace and client exist for new users).
2. Create additional clients for each brand.
3. Select a client to manage social profile connections.
4. Switch to "All clients" to get a planning view of scheduled posts in the calendar.
5. Create drafts per client and move them through approvals before publishing.

## Supported Platforms
- LinkedIn
- Instagram (Instagram Business via Meta Graph)
- YouTube

## Key Concepts (Data Model)
- User: signs in via email/password and owns/joins workspaces.
- Workspace: typically an agency container.
- Client: a brand within a workspace.
- Social Profile: a connected account/channel/page identity for a client.
  - Implementation note: social profiles are stored in the `social_accounts` table (legacy name) and referenced as `social_account_id`.
- Post: content + media URL + hashtags + schedule time, scoped to a client.
- Post Targets: per-platform rows tracking publish status per selected target.
- Approval Events: audit log for approval lifecycle.

## Current User Flows
1. Register/Login
- Create an account from the homepage.
- On registration, the backend creates:
  - a default workspace ("My Workspace")
  - a default client ("Default Client")
  - sets `users.default_workspace_id` and `users.default_client_id`
- Passwords must meet basic strength rules and errors are shown as a single friendly message.

2. Connect social profiles
- From dashboard, click Connect on a platform.
- OAuth completes, then the backend redirects to `/connect/callback?session=<id>`.
- The callback page lets you select:
  - which client to connect to
  - which detected profile(s) to connect (checkbox list)
- On submit, the backend stores 1+ social profiles for that platform/client.

3. Create post
- Create a post from the dashboard composer.
- Posts are created as `status=draft` and `approval_status=draft` (Safe Mode).

3a. Agency dashboard planning
- Workspace switcher + client selector (includes an "All clients" planning view).
- Create client from the dashboard.
- Calendar view (week/month) shows scheduled posts and labels them by client.

4. Approval + publishing
- API supports requesting approval, approving, rejecting.
- Only approval triggers enqueueing the worker job.
- Worker refuses to publish if the post is not approved.
- Worker resolves tokens by `post.client_id` and `post_targets.social_account_id` (social profile), not just by platform.
- Worker uses per-target retries with exponential backoff (default: 3 attempts) and stores the failure reason on the target row.
- Best-effort idempotency: already-published targets are skipped if they have an `external_post_id`.

## What Is NOT Implemented Yet (Known Gaps)
- True multi-client UI (client switcher, client settings page, approvals inbox UI).
- Selecting specific connected social profiles in the composer (currently targets default/latest profile per platform).
- Robust page/channel enumeration for every provider edge case.
  - YouTube: best-effort channel enumeration, falls back to user identity.
  - LinkedIn: currently connects the member identity; org/page selection is a later stage.
- Media uploads (currently URL only).
- Reporting, link tracking, team invitations, billing, and plan limits.

## Local Setup
See `README.md` for Docker Compose instructions.

Important:
- After schema changes, you must recreate the Postgres volume for the init script to run:
  - `docker compose down -v`
  - `docker compose up --build`

## Environment Variables (High-Level)
Backend:
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `TOKEN_ENCRYPTION_SECRET`
- OAuth: `LINKEDIN_CLIENT_ID/SECRET`, `INSTAGRAM_CLIENT_ID/SECRET`, `YOUTUBE_CLIENT_ID/SECRET`
- URLs: `APP_BASE_URL`, `FRONTEND_URL`

Worker:
- `DATABASE_URL`, `REDIS_URL`
- OAuth refresh vars for LinkedIn/YouTube where applicable
- Retries:
  - `PUBLISH_RETRY_ATTEMPTS` (default 3)
  - `PUBLISH_RETRY_BASE_MS` (default 1000)

Frontend:
- `NEXT_PUBLIC_API_BASE_URL`
