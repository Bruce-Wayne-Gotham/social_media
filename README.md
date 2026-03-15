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
- Post creation with media URL, hashtags, target platforms, and scheduling
- Safe Mode approvals (posts must be approved before publishing)
- Redis queue worker for scheduled publishing
- Platform adaptation service for LinkedIn, Instagram, and YouTube
- Dashboard for post history and publish status
- Minimal agency dashboard: workspace/client selection and calendar planning view
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

### How To Test Approvals + Publishing (Local)

1. Start the stack: `docker compose up --build`
2. Register a user on the frontend and login.
3. Connect at least one social profile for a platform.
4. Create a post (it stays in `draft` because Safe Mode).
5. Submit it for approval via API (`POST /api/posts/:id/request-approval`).
6. Approve it via API (`POST /api/posts/:id/approve`).
7. Watch worker logs to confirm publishing attempts and retries (default: 3 attempts with exponential backoff).

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
- `POST /api/posts/:id/approve`
- `POST /api/posts/:id/reject`

### Workspaces

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/current`
- `GET /api/workspaces/:workspaceId/clients`
- `POST /api/workspaces/:workspaceId/clients`

### Clients

- `GET /api/clients/:clientId`
- `PATCH /api/clients/:clientId`
- `DELETE /api/clients/:clientId`
- `GET /api/clients/:clientId/posts`
- `POST /api/clients/:clientId/posts`

### Social Profiles

- `GET /api/clients/:clientId/social-profiles`
- `GET /api/clients/:clientId/social-profiles/oauth/:platform/start`
- `DELETE /api/social-profiles/:socialProfileId`

Note: Social profiles are stored in the `social_accounts` table (legacy name) and referenced as `social_account_id`.

## Notes

- Publisher modules currently include production-friendly service boundaries and request payload shaping. Replace the placeholder API calls with real platform credentials and endpoints before deploying.
- Tokens are encrypted at rest using application-level symmetric encryption.
- For an MVP, media uploads are represented as URLs. Add object storage integration if you need direct file uploads.

## Project Docs

- Current capabilities and limitations: `docs/CURRENT_STATE.md`
- API reference: `docs/API_REFERENCE.md`
