# SocialHub

SocialHub is a minimal agency-first SaaS MVP for managing client content workflows across LinkedIn, Instagram, and YouTube. The repository is split into a REST backend, a Redis-backed scheduling worker, and a Next.js frontend.

## Project Structure

```text
.
|-- backend
|-- frontend
|-- worker
|-- infra
|   `-- sql
|       `-- schema.sql
`-- docker-compose.yml
```

## Features

- Email/password authentication with JWTs
- OAuth-style social profile connection flow for LinkedIn, Instagram, and YouTube
- Workspaces and clients for agency teams
- Client-scoped media asset uploads with signed one-time upload URLs
- Post creation with uploaded assets or public media URLs, hashtags, target platforms, and scheduling
- Safe Mode approvals with comments and audit thread
- Client approval magic links for external reviewers
- Client-scoped tracked links with UTM builder, short links, and click reporting
- Redis queue worker for scheduled publishing
- Dashboard for post history, approvals inbox, link tracking, and publish status
- Stripe-backed billing MVP with one free plan, one paid plan, workspace usage counters, and server-side limits
- Client content strategy settings for Autopilot v1
- AI-backed Autopilot v1 draft generation into `needs_approval`
- Internal risk checks for banned terms and missing required disclaimers

## Local Setup

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux) running and set to **Linux containers**. On Windows ensure WSL 2 is installed/enabled and Docker Desktop is started before running any `docker compose` commands.
- Docker Compose v2 (`docker compose` ships with recent Docker Desktop). No local Node.js tooling is required because everything runs in containers.

1. Copy the example environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp worker/.env.example worker/.env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`

### Troubleshooting

- Error like `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` means the Docker daemon is not running. Start Docker Desktop (or run `sudo systemctl start docker` on Linux) and wait until it reports "Running", then retry `docker compose up --build`.
- If Docker Desktop is running but the error persists on Windows, open PowerShell and run `wsl --status` to confirm WSL 2 is installed. If it is not, enable WSL 2 and restart Docker Desktop.

### How To Test Approvals + Autopilot + Media Uploads + Link Tracking + Billing (Local)

1. Recreate the database after schema changes: `docker compose down -v`
2. Start the stack: `docker compose up --build`
3. Register a user on the frontend and login.
4. Create or select a client.
5. Open the Autopilot v1 panel, save a content strategy, then generate draft posts after enabling the provider env vars.
6. Confirm the generated drafts land in the approvals inbox with `needs_approval` status.
7. Add a banned term or required disclaimer in the strategy, generate again, and confirm the risk flags appear on the draft detail view when applicable.
8. Upload a media asset from the composer and confirm it appears in the asset shelf.
9. Create a manual post using the uploaded asset or a public media URL.
10. Request approval, add a comment, then approve or reject it from the dashboard.
11. Generate a client approval magic link and open it in a private window to review the same inbox externally.
12. Open the link tracking panel, build a tracked link with UTM values, copy the short link, then open `/l/<code>` and confirm the click totals increase.
13. Add Stripe env vars, open the billing panel, start checkout for the paid plan, and confirm the webhook upgrades the workspace plan and usage counters remain visible in the dashboard.

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Posts

- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:id`
- `PATCH /api/posts/:id`
- `POST /api/posts/:id/request-approval`
- `POST /api/posts/:id/comments`
- `POST /api/posts/:id/approve`
- `POST /api/posts/:id/reject`

### Workspaces

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/current`
- `PATCH /api/workspaces/current`
- `GET /api/workspaces/:workspaceId/clients`
- `POST /api/workspaces/:workspaceId/clients`

### Billing

- `GET /api/billing/workspaces/:workspaceId`
- `POST /api/billing/workspaces/:workspaceId/checkout`
- `POST /api/billing/webhooks/stripe`

### Clients

- `GET /api/clients/:clientId`
- `PATCH /api/clients/:clientId`
- `DELETE /api/clients/:clientId`
- `POST /api/clients/:clientId/generate-drafts`
- `GET /api/clients/:clientId/posts`
- `POST /api/clients/:clientId/posts`
- `GET /api/clients/:clientId/media-assets`
- `POST /api/clients/:clientId/media-assets/upload-url`
- `GET /api/clients/:clientId/tracked-links`
- `GET /api/clients/:clientId/tracked-links/report`
- `POST /api/clients/:clientId/tracked-links`
- `POST /api/clients/:clientId/approval-links`
- `GET /api/clients/:clientId/social-profiles`
- `GET /api/clients/:clientId/social-profiles/oauth/:platform/start`

### Media Assets

- `PUT /api/media-assets/:assetId/upload?token=...`
- Static asset URL pattern: `/media/<storage_key>`

### Tracked Links

- `GET /api/tracked-links/:code/resolve`
- App short-link path: `/l/<code>`

### Approval Links

- `GET /api/approval-links/:token`
- `GET /api/approval-links/:token/posts/:postId`
- `POST /api/approval-links/:token/posts/:postId/comments`
- `POST /api/approval-links/:token/posts/:postId/approve`
- `POST /api/approval-links/:token/posts/:postId/reject`

## Production Deploy

SocialHub is production-ready and can be deployed to managed platforms or self-hosted infrastructure.

### Quick Start (Railway - Recommended)

**Estimated Cost**: ~$20/month (includes PostgreSQL, Redis, Backend, Worker)

1. **Create Railway Project**
   - Sign up at [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Add PostgreSQL and Redis plugins

2. **Configure Services**
   - Deploy `backend`, `worker`, and `frontend` (or use Vercel for frontend)
   - Set environment variables from [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

3. **Set Up OAuth**
   - LinkedIn: https://www.linkedin.com/developers
   - Instagram: https://developers.facebook.com
   - YouTube: https://console.cloud.google.com
   - Add redirect URIs: `https://api.yourdomain.com/api/social-accounts/oauth/{platform}/callback`

4. **Deploy Database Schema**
   ```bash
   psql $DATABASE_URL < infra/sql/schema.sql
   ```

### Essential Environment Variables

**Backend** (30+ variables):
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `TOKEN_ENCRYPTION_SECRET`
- `APP_BASE_URL`, `FRONTEND_URL`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- Optional: `OPENAI_API_KEY` (for AI Autopilot)

**Worker** (15+ variables):
- `DATABASE_URL`, `REDIS_URL`, `TOKEN_ENCRYPTION_SECRET`
- `BACKEND_URL`
- OAuth credentials (same as backend)

**Frontend** (1 variable):
- `NEXT_PUBLIC_API_BASE_URL`

See complete list with descriptions in [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md).

### Deployment Options & Costs

| Platform | Monthly Cost | Best For |
|----------|--------------|----------|
| **Railway** | $20-30 | MVP, fast iteration |
| **DigitalOcean App Platform** | $42-47 | Established agencies |
| **Self-hosted VPS** | $18-25 | DevOps experience |

### Architecture

```
Frontend (Next.js) -> Backend (Express API) -> PostgreSQL
                            |
                            v
                      Redis Queue <- Worker (BullMQ)
```

### Key Features for Production

- ✅ SSL/TLS automatic (managed platforms)
- ✅ Database connection pooling and retries
- ✅ Worker auto-scaling with BullMQ
- ✅ OAuth token encryption at rest
- ✅ Idempotent database migrations
- ✅ Health check endpoints
- ✅ Per-target retry with exponential backoff
- ⚠️ Media storage: local filesystem (migrate to S3 for multi-instance)
- ⚠️ Logging: basic console logs (add Sentry/LogTail recommended)

### Complete Deployment Guide

For comprehensive production deployment including:
- Complete environment variables reference
- Secrets management strategy
- Database migration approach
- Worker scaling configuration
- Logging and error monitoring setup
- Cost estimates by scale
- Security checklist
- Disaster recovery procedures

**See**: [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

### Post-Deployment Checklist

- [ ] Database schema applied successfully
- [ ] All environment variables configured
- [ ] OAuth redirect URIs registered with platforms
- [ ] Health check endpoint responding (`/health`)
- [ ] Test post creation and approval flow
- [ ] Verify worker processing scheduled posts
- [ ] Test publishing to LinkedIn/Instagram/YouTube
- [ ] Set up uptime monitoring (UptimeRobot, BetterUptime)
- [ ] Configure error tracking (Sentry recommended)

## Notes

- Billing MVP now supports one free plan and one paid Stripe plan with server-side limits for clients, social profiles, posts per month, and AI credits.
- Dashboard billing counters are workspace-scoped and show current usage for seats, clients, profiles, posts this month, and AI credits this month.
- Autopilot v1 now calls a real provider behind a clean service boundary with a workspace feature flag, rate limiting, and usage tracking.
- Generated drafts never auto-publish. They are created directly in the approvals queue and can be disabled via `AUTOPILOT_AI_ENABLED=false` or the workspace feature flag.
- Publisher modules currently include production-friendly service boundaries and request payload shaping. Replace the placeholder API calls with real platform credentials and endpoints before deploying.
- Tokens are encrypted at rest using application-level symmetric encryption.
- Media uploads currently use local backend storage plus signed one-time upload URLs. Swap the storage layer if you later move to S3/GCS.
- Tracked links currently record a basic click event with referrer and user agent. Expand this if you later need richer attribution.

## Project Docs

- **Production deployment guide**: [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)
- Current capabilities and limitations: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)
- API reference: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)



