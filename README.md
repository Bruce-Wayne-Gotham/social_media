# SocialHub

SocialHub is a minimal SaaS MVP for drafting one post and publishing it across X, LinkedIn, and YouTube metadata workflows. The repository is split into a REST backend, a Redis-backed scheduling worker, and a Next.js frontend.

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
- OAuth-style social account connection flow stubs
- Post creation with media URL, hashtags, target platforms, and scheduling
- Redis queue worker for scheduled publishing
- Platform adaptation service for X, LinkedIn, and YouTube metadata
- Dashboard for post history and publish status

## Local Setup

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

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Social Accounts

- `GET /api/social-accounts`
- `POST /api/social-accounts/connect`
- `GET /api/social-accounts/oauth/:platform/start`
- `GET /api/social-accounts/oauth/:platform/callback`

### Posts

- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:id`

## Notes

- Publisher modules currently include production-friendly service boundaries and request payload shaping. Replace the placeholder API calls with real platform credentials and endpoints before deploying.
- Tokens are encrypted at rest using application-level symmetric encryption.
- For an MVP, media uploads are represented as URLs. Add object storage integration if you need direct file uploads.

