# SocialHub (Agency-First) - Stage-by-Stage Prompting Chats

This file is a copy/paste prompt playbook you can use to drive Codex (me) stage-by-stage while building an agency-first social media management app (LinkedIn + Instagram + YouTube) with Safe Mode (approval required).

The intent is to split a huge build into small, reliable, end-to-end increments. Each stage is a "chat" with:
- A clear goal
- Inputs you provide
- A single primary prompt to paste
- Optional follow-ups to keep scope contained

If you follow this playbook in order, we will avoid "big bang" rewrites and keep the app deployable at every stage.

## Project Constants (Locked In)
- Target customer: Agencies first, solo creators supported.
- Platforms for launch: LinkedIn + Instagram + YouTube.
- Publishing policy: Safe Mode (approval required) by default.
- Repo stack (current): Next.js frontend, Express REST backend, BullMQ worker, Postgres, Redis, Docker Compose.

## How To Use This Playbook
1. Start at Stage 0.
2. Paste the stage prompt into Codex.
3. Answer any small clarifying questions.
4. When the stage is complete, move to the next stage.

Rules that keep Codex effective:
- Keep each stage to a single theme. Do not merge stages.
- Prefer "make it work end-to-end" over "make it perfect".
- Ask Codex to run tests or at least run the app after each stage.
- Avoid fancy punctuation in UI copy; keep ASCII to prevent encoding issues.

## Standard Preamble (Paste At The Top Of Any Stage)
Use this preamble when you start a new chat thread with Codex.

```text
You are Codex working inside my repo at c:\\Users\\....\\social_media.
Constraints:
- Platforms: LinkedIn + Instagram + YouTube only (for now).
- Safe Mode: approval required before publish.
- Prioritize agencies over solo creators.
- Keep changes minimal and incremental; do not propose a rewrite.
- Prefer ASCII text in code and UI copy (avoid curly quotes).
Workflow:
- Inspect the codebase first (ripgrep, open relevant files).
- Propose the smallest implementation plan for this stage.
- Implement changes, then summarize what changed and how to test.
- Also update the README and the references md files with the changes on what support has been added and remove the not supported ones
```

---

## Stage 0 - Repo Reality Check + Gap Map (Read-Only)
Goal: Build a shared understanding of what exists today, what is missing for agency-first, and what the next 3 milestones are.

Inputs from you:
- None (Codex should inspect the repo).

Primary prompt:
```text
Using the Standard Preamble above, do a repo audit of the existing SocialHub app.
1) Summarize current user flows end-to-end (auth, connect accounts, create post, schedule, publish worker, dashboard).
2) Identify the top 10 gaps for agency-first (multi-client, multiple profiles per platform, approvals, roles, reporting, etc.).
3) Propose a 3-milestone roadmap (Milestone A/B/C) where each milestone is deployable and improves agency value.
4) For Milestone A only, list the exact tables that need to change, the API endpoints we will add/modify, and the key UI pages/components affected.
Do not implement anything in this stage.
```

Follow-up prompt (if the audit is too broad):
```text
Narrow the gap list to only what blocks agencies from using this today, and classify each gap as: schema, backend, worker, frontend, or ops.
```

---

## Stage 1 - Data Model For Agencies (Workspaces + Clients + Social Profiles + Approvals)
Goal: Redesign the schema so we can support agencies and multiple connected profiles per platform, and an approval gate before publishing.

Inputs from you:
- Decide terminology (pick one):
  - "Workspace" (agency) + "Client" (brand)
  - "Organization" + "Brand"

Primary prompt:
```text
Using the Standard Preamble above:
Design the minimal Postgres schema changes to support:
- Workspaces (agency) and Clients (brands)
- Workspace members with roles (owner, admin, member, client_approver)
- Many social profiles per client per platform (LinkedIn/Instagram/YouTube)
- Posts belonging to a client
- Approval workflow: draft -> needs_approval -> approved -> scheduled/publishing -> published/failed
- Per-target status for each social profile selected

Deliverables:
1) A schema diff: new tables + changes to existing tables (posts, post_targets, social_accounts).
2) Constraints and indexes (uniques, foreign keys) that prevent data corruption.
3) A migration plan that minimizes downtime (even if it's just "drop and recreate" for now, say it explicitly).
4) A short "why this design" explanation focused on agency needs.

Then implement it by editing infra/sql/schema.sql and any backend code that will crash immediately because of the schema change.
Keep it minimal; we will add endpoints and UI in later stages.
```

Follow-up prompt (if you want a truly minimal first cut):
```text
Reduce the schema to the smallest set that enables:
1 workspace -> many clients -> many social profiles; posts attach to client; post_targets attach to social_profile.
Defer roles/permissions to Stage 2.
```

---

## Stage 2 - Backend API: Workspaces, Clients, Social Profiles, Approvals
Goal: Add/modify REST endpoints to manage agency structures and enforce Safe Mode approval.

Inputs from you:
- Decide if you want clients to have their own logins immediately:
  - Option A: Not yet (workspace members only for now)
  - Option B: Yes (client approver accounts now)

Primary prompt:
```text
Using the Standard Preamble above:
Implement backend endpoints (Express) for:
- Workspaces: list/create, get current workspace
- Clients: CRUD within a workspace
- Social profiles: list/connect/disconnect per client (LinkedIn/Instagram/YouTube)
- Posts: create/update/list/get for a client
- Approvals: request approval, approve, reject (Safe Mode required)

Rules:
- Enforce that posts cannot enter "queued/publishing" unless approved.
- Store an audit trail for approval actions (who, when, what changed).

Deliverables:
1) Route list (method + path) and request/response JSON shapes.
2) Implementation in backend/src (routes/controllers/services/validators).
3) Basic authz checks (workspace membership).
4) Update README.md with the new API overview.
```

Follow-up prompt (if you want to avoid overbuilding authz early):
```text
For now, hardcode a single workspace per user and require that the authenticated user owns the client.
We will add proper RBAC later. Implement only the minimal checks to prevent cross-user access.
```

---

## Stage 3 - OAuth Connection Flow For Multiple Profiles (LinkedIn/Instagram/YouTube)
Goal: Make "connect account" work for agencies where a client can connect multiple profiles of the same platform.

Inputs from you:
- Confirm desired UX:
  - After OAuth callback, show a picker UI to select which pages/channels to connect, then store each as a "social profile".

Primary prompt:
```text
Using the Standard Preamble above:
Refactor the current social account model so we can store multiple connected profiles per platform per client.
Implementation requirements:
- Backend: OAuth callback must end up creating one or more Social Profiles tied to a specific Client.
- Frontend: after OAuth callback, user selects the Client and (if applicable) selects which profile(s) to connect.
- Store provider identifiers on the social profile (ex: linkedin member/org id, instagram business account id, youtube channel id).
- Support disconnecting a single connected profile.

Keep scope realistic:
- If a platform requires extra API calls to enumerate profiles/pages/channels, implement the minimal stub with TODOs and clear contracts.
- Do not attempt to perfectly cover every LinkedIn/Meta/Google edge case; focus on the data model and flow.
```

Follow-up prompt (if API limitations block enumeration):
```text
Implement "single profile per OAuth connection" now:
- Treat the authenticated identity as one connected social profile.
- Make the schema/UX support multiples even if we only connect one today.
```

---

## Stage 4 - Worker Publishing: Safe Mode + Per-Profile Targets + Retries
Goal: Publish jobs should target specific social profiles, respect approval, and be reliable.

Inputs from you:
- Decide retry policy:
  - Default: 3 retries with exponential backoff per target

Primary prompt:
```text
Using the Standard Preamble above:
Update the worker so it publishes using social_profile_id (not just platform).
Requirements:
- Only publish posts that are approved.
- Per-target retries with backoff and a clear failure reason saved on the target row.
- Idempotency: avoid duplicate publishes if the same job runs twice (best-effort with externalPostId checks).
- Keep the BullMQ queue but ensure jobs are added only after approval if scheduled, or after approval if immediate.

Deliverables:
1) Worker changes (worker/src) including query updates and token resolution for the new schema.
2) Backend changes needed so job enqueue timing matches Safe Mode.
3) A small "how to test locally" checklist in README.md.
```

---

## Stage 5 - Agency Dashboard UX: Workspace + Client Switcher + Calendar
Goal: Make the UI usable for agencies managing multiple clients and seeing an editorial calendar.

Inputs from you:
- Choose the first UI surface:
  - Option A: Dashboard-first (calendar + approvals)
  - Option B: Client-first (client list + settings + profiles)

Primary prompt:
```text
Using the Standard Preamble above:
Implement the minimal agency dashboard UX in Next.js:
- Workspace switcher (even if only 1 workspace exists today, structure it)
- Client selector + "create client"
- Client settings area: connected social profiles list, connect/disconnect
- Calendar view (week/month) that shows scheduled posts per client
- Post list should filter by client and show approval status

Constraints:
- Keep the UI simple but intentional.
- Do not introduce a new UI framework; use existing Tailwind setup.

Deliverables:
1) New/updated pages in frontend/src/app
2) Updated components in frontend/src/components
3) API integration updates in frontend/src/lib/api.js
4) A short "user journey" description for agencies
```

---

## Stage 6 - Approvals: Client Approver Portal + Comments + Audit Log
Goal: Safe Mode must feel real: clients can review, comment, and approve posts with an audit trail.

Inputs from you:
- Decide portal access:
  - Option A: Client approvers are normal users with a role
  - Option B: Magic link per client (later; more complex)

Primary prompt:
```text
Using the Standard Preamble above:
Implement the approvals experience end-to-end:
- Backend: approval endpoints + comments + audit log storage
- Frontend: approvals inbox, post detail view, comment thread, approve/reject actions
- Permissions: client_approver can only see assigned client(s)

Acceptance criteria:
- A post cannot be scheduled/published unless approved.
- Every approve/reject is recorded with timestamp + user id + optional comment.
```

---

## Stage 7 - Media Uploads (Cheap Storage) + Asset Library
Goal: Replace "media URL only" with a low-cost upload flow and a per-client asset library.

Inputs from you:
- Choose storage:
  - Cloudflare R2
  - Supabase Storage
  - S3-compatible (generic)

Primary prompt:
```text
Using the Standard Preamble above:
Add media upload support:
- Backend: signed upload URL endpoint (or direct upload proxy if needed), store media metadata
- Frontend: upload UI in composer, show uploaded assets
- DB: media_assets table tied to client/workspace, referenced by posts

Keep it minimal:
- Only support images + videos as files.
- Store the final CDN/public URL and use it for Instagram/YouTube publishing.
```

---

## Stage 8 - Link Tracking + UTM Builder (High-Value, Low-Complexity)
Goal: Agencies pay for reporting. We can add short links + UTM builder without relying on platform analytics APIs.

Inputs from you:
- Choose domain strategy:
  - Use app domain with /l/<code>
  - Bring-your-own-domain (later)

Primary prompt:
```text
Using the Standard Preamble above:
Implement link tracking:
- DB: tracked_links table (client_id, original_url, short_code, utm params, created_by)
- Backend: create link, resolve redirect endpoint, click events table
- Frontend: UTM builder + copy short link
- Reporting: basic clicks by client and by post

Make sure:
- Redirect endpoint is fast and safe (validate URL, prevent open redirect abuse with stored destinations only).
```

---

## Stage 9 - Reporting: Weekly/Monthly Client Report Pages + Export
Goal: Provide client-ready reports that reduce agency labor.

Inputs from you:
- Decide report type:
  - Option A: Web report page + share link
  - Option B: PDF export (later)

Primary prompt:
```text
Using the Standard Preamble above:
Implement reporting MVP:
- A per-client report page with date range filters
- Metrics we can compute without platform APIs:
  - posts published count, scheduled count, failed count
  - link clicks (from Stage 8)
  - time-to-approval and approval rate
- Add a shareable read-only link for clients (tokenized URL or role-based access)
```

---

## Stage 10 - Autopilot (Safe Mode): Strategy -> Drafts -> Approvals Queue
Goal: Reduce/replace the human social media manager by generating a plan and drafts, but always requiring approval.

Inputs from you:
- Choose AI provider now or later:
  - Option A: Later (build interfaces + stubs now)
  - Option B: Now (wire to provider via env vars)

Primary prompt:
```text
Using the Standard Preamble above:
Design and implement Autopilot v1 in Safe Mode:
- Per-client "Content Strategy" settings:
  - brand voice notes, do/dont, content pillars, CTA style, hashtags, banned terms
- "Generate drafts" action that creates N draft posts into needs_approval state
- An internal "risk checks" step that flags drafts containing banned terms or missing required disclaimers

Constraints:
- If AI integration is deferred, implement deterministic stub generation so the UX and database flow are real.
- Do not auto-publish anything. Everything ends in the approvals queue.
```

Follow-up prompt (when you're ready to connect real AI):
```text
Replace the stub generator with a real provider integration behind a clean interface.
Add rate limiting, per-workspace usage tracking, and a feature flag so we can disable it safely.
```

---

## Stage 11 - Billing + Plan Limits (Agency-Friendly)
Goal: Convert to paid: seat-based + client count + scheduled posts/month + AI usage limits.

Inputs from you:
- Choose pricing model:
  - Seats (team members)
  - Clients (brands)
  - Profiles (connected accounts)

Primary prompt:
```text
Using the Standard Preamble above:
Implement billing MVP:
- Stripe checkout + webhooks
- Plans with limits (seats/clients/profiles/posts/month/AI credits)
- Enforce limits server-side
- Show usage counters in the dashboard

Keep it incremental:
- Start with one paid plan + one free plan.
```

---

## Stage 12 - Deployment + Ops Checklist (Minimal Cost)
Goal: Deploy reliably with low cost and basic observability.

Inputs from you:
- Pick hosting:
  - Single VPS with Docker Compose
  - Render/Fly for backend+worker, Vercel for frontend

Primary prompt:
```text
Using the Standard Preamble above:
Create a production deployment plan for this repo:
- Environment variables list (frontend/backend/worker)
- Secrets handling
- Database migrations approach
- Worker scaling approach
- Basic logging and error monitoring

Deliverables:
- Update README.md with a "Production Deploy" section
- Provide a minimal cost estimate per month (ballpark) for the chosen hosting
```

---

## Stage 13 - UX/Marketing Polish (Onboarding That Converts Agencies)
Goal: Improve activation: agencies should reach "first client approved + scheduled" fast.

Inputs from you:
- Your product positioning one-liner (draft is fine).

Primary prompt:
```text
Using the Standard Preamble above:
Improve onboarding and marketing UX:
- Update the landing page copy and ProductTourPanel to emphasize agencies + approvals + reporting + Safe Mode autopilot.
- Add a first-run checklist on the dashboard:
  1) Create client
  2) Connect profiles
  3) Create draft
  4) Send for approval
  5) Schedule
- Add empty states and helpful tooltips where needed.

Keep copy ASCII only.
```

