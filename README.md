# SocialHub

SocialHub is a minimal SaaS MVP for drafting one post and publishing it across LinkedIn, Instagram, and YouTube workflows. The repository is split into a REST backend, a Redis-backed scheduling worker, and a Next.js frontend.

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
- OAuth-style social profile connection flow
- Workspaces and Clients (agency-friendly foundation)
- Client-scoped media asset uploads with signed one-time upload URLs
- Post creation with uploaded assets or public media URLs, hashtags, target platforms, and scheduling
- Safe Mode approvals with comments and audit thread
- Client approval magic links for external reviewers
- Client-scoped tracked links with UTM builder, short links, and click reporting
- Redis queue worker for scheduled publishing
- Platform adaptation service for LinkedIn, Instagram, and YouTube
- Dashboard for post history, approvals inbox, link tracking, and publish status
- Minimal agency dashboard: workspace/client selection, calendar planning view, and post review panel
- Password validation with friendly error messages and inline help tooltip

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

### How To Test Approvals + Media Uploads + Link Tracking (Local)

1. Recreate the database after schema changes: `docker compose down -v`
2. Start the stack: `docker compose up --build`
3. Register a user on the frontend and login.
4. Create or select a client.
5. Upload a media asset from the composer and confirm it appears in the asset shelf.
6. Create a post using the uploaded asset or a public media URL.
7. Request approval, add a comment, then approve or reject it from the dashboard.
8. Generate a client approval magic link and open it in a private window to review the same inbox externally.
9. Open the link tracking panel, build a tracked link with UTM values, copy the short link, then open `/l/<code>` and confirm the click totals increase.

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Social Accounts (Legacy)

- `GET /api/social-accounts`
- `POST /api/social-accounts/connect`
- `GET /api/social-accounts/oauth/:platform/start`
- `GET /api/social-accounts/oauth/:platform/callback`

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

### Clients

- `GET /api/clients/:clientId`
- `PATCH /api/clients/:clientId`
- `DELETE /api/clients/:clientId`
- `GET /api/clients/:clientId/posts`
- `POST /api/clients/:clientId/posts`
- `GET /api/clients/:clientId/media-assets`
- `POST /api/clients/:clientId/media-assets/upload-url`
- `GET /api/clients/:clientId/tracked-links`
- `GET /api/clients/:clientId/tracked-links/report`
- `POST /api/clients/:clientId/tracked-links`
- `POST /api/clients/:clientId/approval-links`

### Media Assets

- `PUT /api/media-assets/:assetId/upload?token=...`
- Static asset URL pattern: `/media/<storage_key>`

### Tracked Links

- `GET /api/tracked-links/:code/resolve`
- App short-link path: `/l/<code>`

### Social Profiles

- `GET /api/clients/:clientId/social-profiles`
- `GET /api/clients/:clientId/social-profiles/oauth/:platform/start`
- `DELETE /api/social-profiles/:socialProfileId`

### Approval Links

- `GET /api/approval-links/:token`
- `GET /api/approval-links/:token/posts/:postId`
- `POST /api/approval-links/:token/posts/:postId/comments`
- `POST /api/approval-links/:token/posts/:postId/approve`
- `POST /api/approval-links/:token/posts/:postId/reject`

## Notes

- Publisher modules currently include production-friendly service boundaries and request payload shaping. Replace the placeholder API calls with real platform credentials and endpoints before deploying.
- Tokens are encrypted at rest using application-level symmetric encryption.
- Media uploads currently use local backend storage plus signed one-time upload URLs. Swap the storage layer if you later move to S3/GCS.
- Tracked links currently record a basic click event with referrer and user agent. Expand this if you later need richer attribution.

## Project Docs

- Current capabilities and limitations: `docs/CURRENT_STATE.md`
- API reference: `docs/API_REFERENCE.md`
