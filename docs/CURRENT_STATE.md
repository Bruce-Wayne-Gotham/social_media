# SocialHub - Current State (What Works Today)

This document describes what the app supports right now in this repository, what APIs exist, and the current limitations.

## What This Website Is
SocialHub is an agency-first social media management app foundation for:
- Managing multiple clients (brands) inside a workspace (agency).
- Connecting social profiles per client for LinkedIn, Instagram, and YouTube.
- Uploading media assets per client and reusing them in post creation.
- Creating posts for a client.
- Safe Mode approvals: posts must be approved before they can be queued/published.
- Tracking outbound links with UTM parameters and short links on the app domain.
- Scheduling and publishing via a Redis/BullMQ worker.
- Saving per-client content strategy settings for Autopilot v1.
- Generating AI-backed approval-ready drafts with internal risk checks.
- Billing workspaces with one free plan, one paid Stripe plan, workspace usage counters, and server-side plan enforcement.

## Agency User Journey (Current UX)
1. Log in (a default workspace and client exist for new users).
2. Create additional clients for each brand.
3. Select a client to manage social profile connections, content strategy, media assets, tracked links, and posts.
4. Save a content strategy with brand voice notes, do and do not rules, content pillars, CTA style, hashtags, banned terms, and an optional required disclaimer.
5. Generate Autopilot drafts for LinkedIn, Instagram, and/or YouTube.
6. Review pending work in the approvals inbox, comment on the thread, and approve or reject from the post detail panel.
7. Upload a file or paste a public media URL in the composer for manual posts.
8. Build a tracked link with UTM values and copy the app-domain short link.
9. Switch to "All clients" to get a planning view of scheduled posts in the calendar.
10. Share a client approval magic link when an external reviewer should only see one client inbox.
11. Review billing usage in the dashboard and upgrade the workspace through Stripe checkout when the free plan is too small.

## Supported Platforms
- LinkedIn
- Instagram (Instagram Business via Meta Graph)
- YouTube

## Key Concepts (Data Model)
- User: signs in via email/password and owns/joins workspaces.
- Workspace: typically an agency container.
- Client: a brand within a workspace, now including content strategy settings.
- Content Strategy: client-level notes and guardrails used by Autopilot v1.
- Media Asset: an uploaded file tied to a workspace/client and reusable across posts.
- Social Profile: a connected account/channel/page identity for a client.
  - Implementation note: social profiles are stored in the `social_accounts` table (legacy name) and referenced as `social_account_id`.
- Post: content + media asset/public media URL + hashtags + schedule time, scoped to a client.
- Post Targets: per-platform rows tracking publish status per selected target.
- Risk Flags: post-level results of the current banned-term and disclaimer checks.
- Tracked Link: a client-owned short link with original URL, resolved destination URL, UTM fields, optional post association, and creator metadata.
- Tracked Link Click: a basic click event row with referrer, user agent, and timestamp.
- Approval Events: audit log for approval lifecycle.
- Workspace Billing: workspace-level Stripe customer/subscription state plus the current free/pro plan code.

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

3. Manage client strategy
- From the dashboard Autopilot v1 panel, select a client and save its content strategy.
- Strategy fields currently include:
  - `brand_voice_notes`
  - `content_do`
  - `content_dont`
  - `content_pillars`
  - `cta_style`
  - `default_hashtags`
  - `banned_terms`
  - `required_disclaimer`

4. Generate Autopilot drafts
- The UI calls a client-scoped `generate-drafts` action.
- Draft generation calls the configured AI provider and records per-workspace usage for rate limiting and auditability.
- Every generated draft is stored with:
  - `approval_status=needs_approval`
  - `status=draft`
  - `generation_source=autopilot_ai`
- Risk checks run on the final draft content and currently flag:
  - banned terms found in the content
  - missing required disclaimer text
- Risk flags are visible in the inbox, history list, and post detail view.
- Autopilot generation is feature-flagged and rate-limited per workspace, with usage rows stored for each generation attempt.

5. Upload media
- From the composer, upload a file for the current client.
- The backend creates a pending `media_assets` row and returns a signed one-time upload URL.
- The frontend uploads the raw file to that URL and then shows the ready asset in the composer asset shelf.

6. Create manual post
- Create a post from the dashboard composer.
- Posts can reference a `media_asset_id` or a direct `media_url`.
- Manual posts are created as `status=draft` and `approval_status=draft` (Safe Mode).

7. Agency dashboard planning
- Workspace switcher + client selector (includes an "All clients" planning view).
- Create client from the dashboard.
- Calendar view (week/month) shows scheduled posts and labels them by client.

8. Link tracking
- Link tracking panel is client-scoped.
- Users can create a tracked link from an original URL plus optional UTM values.
- If a post is currently selected in the dashboard, the new tracked link is associated to that post.
- The panel shows the generated app-domain short link, supports copy-to-clipboard, and lists recent links with click counts.
- Short links resolve through `/l/<code>` and store a click event before redirecting to the UTM-decorated destination URL.
- Reporting currently shows total clicks by client and a basic click breakdown by post.

9. Approval review
- Approvals inbox shows all posts in `needs_approval` for the current client selection.
- Post detail panel shows the full approval thread, comments, risk flags, and approve/reject actions.
- Recent posts are selectable so creators and approvers can review the audit trail on any post.

10. Approval + publishing
- API supports requesting approval, commenting, approving, rejecting.
- Only approval triggers enqueueing the worker job.
- Worker refuses to publish if the post is not approved.
- Worker resolves tokens by `post.client_id` and `post_targets.social_account_id` (social profile), not just by platform.
- Worker uses per-target retries with exponential backoff (default: 3 attempts) and stores the failure reason on the target row.
- Best-effort idempotency: already-published targets are skipped if they have an `external_post_id`.

11. Billing and plan limits
- The app supports one free plan and one paid plan (`Agency Pro`).
- Billing is workspace-scoped.
- The dashboard shows current usage counters for:
  - seats
  - clients
  - connected social profiles
  - posts created this month
  - AI credits used this month
- Stripe Checkout is used to start the paid subscription flow.
- Stripe webhooks update the workspace billing record after checkout/subscription changes.
- Limits are enforced server-side on:
  - creating clients
  - connecting social profiles
  - creating posts
  - generating Autopilot drafts
- Safe Mode remains enabled across both plans; billing does not bypass approval requirements.

## What Is NOT Implemented Yet (Known Gaps)
- Workspace-level feature management UI for toggling Autopilot generation (the backend flag exists; management is still an admin/data task).
- Client approver assignment management UI (permissions are enforced in the API, but assignment is still a data/admin task).
- Selecting specific connected social profiles in the composer (currently targets default/latest profile per platform).
- Robust page/channel enumeration for every provider edge case.
  - YouTube: best-effort channel enumeration, falls back to user identity.
  - LinkedIn: currently connects the member identity; org/page selection is a later stage.
- External object storage (uploads are stored locally by the backend right now).
- Rich attribution reporting and full invitation lifecycle.

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
- Media: `MEDIA_UPLOAD_DIR`, `MAX_MEDIA_UPLOAD_BYTES`
- Autopilot AI: `AUTOPILOT_AI_ENABLED`, `AUTOPILOT_AI_PROVIDER`, `AUTOPILOT_AI_RATE_LIMIT_MAX_REQUESTS`, `AUTOPILOT_AI_RATE_LIMIT_MAX_DRAFTS`, `AUTOPILOT_AI_RATE_LIMIT_WINDOW_SECONDS`, `AUTOPILOT_REQUEST_TIMEOUT_MS`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_PROJECT_ID`
- Billing: `BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`

Worker:
- `DATABASE_URL`, `REDIS_URL`
- OAuth refresh vars for LinkedIn/YouTube where applicable
- Retries:
  - `PUBLISH_RETRY_ATTEMPTS` (default 3)
  - `PUBLISH_RETRY_BASE_MS` (default 1000)

Frontend:
- `NEXT_PUBLIC_API_BASE_URL`



