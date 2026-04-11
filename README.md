# SocialHub

Agency-first social media management platform. Agencies manage multiple clients (brands). Each client connects social profiles on Telegram, Reddit, YouTube, and Pinterest. Content is written, AI-adapted per platform, sent for approval, and only published after an explicit human approval.

---

## Project Structure

```
.
├── backend/          Express 5 REST API (Node.js 20)
├── frontend/         Next.js frontend
├── worker/           BullMQ + Redis scheduling worker
├── infra/
│   └── sql/
│       ├── schema.sql          DB source of truth
│       └── migrations/         numbered migration files
├── .claude/
│   ├── api-contract.md         response shapes — both sides must match
│   └── viresh-agent-context-v2.md
└── docker-compose.yml
```

---

## Stack

| Layer      | Tech                                        |
|------------|---------------------------------------------|
| Runtime    | Node.js 20, Express 5                       |
| Database   | PostgreSQL 16, `pg` (raw SQL, no ORM)       |
| Queue      | BullMQ + Redis 7                            |
| Validation | Zod                                         |
| Auth       | JWT (Bearer token)                          |
| AI         | OpenAI-compatible via `AI_BASE_URL`         |
| Frontend   | Next.js                                     |

---

## Local Setup

### Prerequisites

- Docker Desktop (or Docker Engine on Linux) running
- Docker Compose v2

### Steps

1. Copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp worker/.env.example worker/.env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Services:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:4000/api`
   - Postgres: `localhost:5432` (db: `socialhub`, user: `socialhub`, pass: `socialhub`)
   - Redis: `localhost:6379`

4. Reset DB after schema changes:

```bash
docker compose down -v && docker compose up --build
```

---

## Environment Variables

```
# Backend
DATABASE_URL                          postgres connection string
REDIS_URL                             redis connection string
JWT_SECRET                            JWT signing secret
TOKEN_ENCRYPTION_SECRET               32-byte symmetric key for token encryption at rest
APP_BASE_URL                          backend public URL (e.g. http://localhost:4000)
FRONTEND_URL                          frontend public URL (e.g. http://localhost:3000)
AI_BASE_URL                           OpenAI-compatible provider base URL
AI_API_KEY                            AI provider key
AI_MODEL                              model name
AI_STUB_MODE                          'true' to skip real AI calls and return stubs
NODE_ENV                              development | production
PORT                                  default 4000

# Optional — Autopilot
AUTOPILOT_AI_ENABLED                  'true' to enable draft generation
AUTOPILOT_AI_PROVIDER                 provider name
AUTOPILOT_AI_RATE_LIMIT_WINDOW_SECONDS
AUTOPILOT_AI_RATE_LIMIT_MAX_DRAFTS
AUTOPILOT_AI_RATE_LIMIT_MAX_REQUESTS
AUTOPILOT_REQUEST_TIMEOUT_MS
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_BASE_URL
OPENAI_PROJECT_ID

# Worker
DATABASE_URL
REDIS_URL
BACKEND_URL                           http://backend:4000 in docker, http://localhost:4000 locally
```

---

## API Reference

All requests: `Content-Type: application/json`
Auth: `Authorization: Bearer <token>`

Response envelopes:
```json
{ "data": {} }                                          // single object
{ "data": [], "meta": { "total": 0, "nextCursor": null } }  // list
{ "error": { "code": "ERROR_CODE", "message": "..." } }     // error
```

### Auth

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Workspaces

```
GET  /api/workspaces/current
GET  /api/workspaces/current/members
```

### Clients

```
GET    /api/clients
POST   /api/clients
GET    /api/clients/:clientId
PATCH  /api/clients/:clientId
DELETE /api/clients/:clientId
```

### Social Profiles

```
GET    /api/clients/:clientId/social-profiles
DELETE /api/social-profiles/:profileId
```

OAuth connect flow:
```
GET /api/oauth/:platform/connect?clientId=<id>      (platform: telegram|reddit|youtube|pinterest)
GET /api/oauth/:platform/callback?code=<code>&state=<state>
```

### Posts

```
GET    /api/clients/:clientId/posts          ?status&from&to&page&limit
POST   /api/clients/:clientId/posts
GET    /api/posts/:postId
PATCH  /api/posts/:postId
DELETE /api/posts/:postId
```

### Adaptation

```
POST   /api/posts/:postId/adapt                     (returns suggestions only — not saved)
PATCH  /api/posts/:postId/targets/:targetId         (saves adapted content)
```

### Approvals

```
POST  /api/posts/:postId/submit    { "comment": "..." }
POST  /api/posts/:postId/approve   { "comment": "..." }
POST  /api/posts/:postId/reject    { "comment": "..." }
POST  /api/posts/:postId/recall    { "comment": "..." }
```

### Stats & Calendar

```
GET  /api/clients/:clientId/stats
GET  /api/clients/:clientId/calendar?from=<date>&to=<date>
```

### Other

```
GET  /health
GET  /l/:code            tracked link redirect
```

---

## curl Cookbook

> Set `TOKEN` before running these commands:
> ```bash
> TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
>   -H "Content-Type: application/json" \
>   -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r '.data.token')
> ```

### Auth

**Register**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Viresh Kumar","email":"viresh@example.com","password":"secret123"}'
```

**Login**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viresh@example.com","password":"secret123"}'
```

**Me**
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### Workspaces

**Get current workspace**
```bash
curl http://localhost:4000/api/workspaces/current \
  -H "Authorization: Bearer $TOKEN"
```

**List members**
```bash
curl http://localhost:4000/api/workspaces/current/members \
  -H "Authorization: Bearer $TOKEN"
```

---

### Clients

**List clients**
```bash
curl http://localhost:4000/api/clients \
  -H "Authorization: Bearer $TOKEN"
```

**Create client**
```bash
curl -X POST http://localhost:4000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nike India","brandNotes":"Inspirational tone. Never mention competitors."}'
```

**Get client**
```bash
curl http://localhost:4000/api/clients/<clientId> \
  -H "Authorization: Bearer $TOKEN"
```

**Update client**
```bash
curl -X PATCH http://localhost:4000/api/clients/<clientId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brandNotes":"Updated brand notes."}'
```

**Delete client**
```bash
curl -X DELETE http://localhost:4000/api/clients/<clientId> \
  -H "Authorization: Bearer $TOKEN"
```

---

### Social Profiles

**List profiles for a client**
```bash
curl http://localhost:4000/api/clients/<clientId>/social-profiles \
  -H "Authorization: Bearer $TOKEN"
```

**Delete a profile**
```bash
curl -X DELETE http://localhost:4000/api/social-profiles/<profileId> \
  -H "Authorization: Bearer $TOKEN"
```

---

### Posts

**List posts for a client**
```bash
curl "http://localhost:4000/api/clients/<clientId>/posts?status=draft&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Create post**
```bash
curl -X POST http://localhost:4000/api/clients/<clientId>/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalContent": "We just launched our new running shoe.",
    "scheduledAt": "2026-04-06T09:00:00.000Z",
    "publishImmediately": false,
    "targetProfileIds": ["<profileId1>", "<profileId2>"]
  }'
```

**Get post**
```bash
curl http://localhost:4000/api/posts/<postId> \
  -H "Authorization: Bearer $TOKEN"
```

**Update post (draft only)**
```bash
curl -X PATCH http://localhost:4000/api/posts/<postId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"originalContent":"Updated content."}'
```

**Delete post**
```bash
curl -X DELETE http://localhost:4000/api/posts/<postId> \
  -H "Authorization: Bearer $TOKEN"
```

---

### Adaptation

**Get AI adaptations (not saved)**
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/adapt \
  -H "Authorization: Bearer $TOKEN"
```

**Save adaptation to a target**
```bash
curl -X PATCH http://localhost:4000/api/posts/<postId>/targets/<targetId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adaptedContent": "Our new running shoe is here. Built for speed. #Nike #Running",
    "adaptedTitle": "Nike Launches New Running Shoe"
  }'
```

---

### Approvals

**Submit for approval**
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Ready for review."}'
```

**Approve**
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Looks good."}'
```

**Reject**
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Needs revision."}'
```

**Recall (back to draft)**
```bash
curl -X POST http://localhost:4000/api/posts/<postId>/recall \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Stats & Calendar

**Client stats**
```bash
curl http://localhost:4000/api/clients/<clientId>/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Calendar (max 90-day range)**
```bash
curl "http://localhost:4000/api/clients/<clientId>/calendar?from=2026-04-01&to=2026-04-30" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Health Check

```bash
curl http://localhost:4000/health
```

---

## Post State Machine

```
draft
  └─[submit]──► needs_approval
                  ├─[approve]──► approved ──► scheduled   (if scheduledAt set)
                  │                       └─► publishing  (if publishImmediately)
                  ├─[reject]───► draft
                  └─[recall]───► draft

approved ──► scheduled ──► publishing ──► published
                                      └─► failed  (per target, 3 retries)
```

Rules:
1. Cannot approve/schedule without going through `needs_approval` first.
2. Cannot submit unless ALL targets have non-null `adaptedContent`.
3. Only `owner` / `admin` / `client_approver` roles can approve or reject.
4. Every transition writes an `approval_log` row.
5. Worker checks `externalPostId` before publishing (idempotency guard).

---

## Error Codes

| Code                      | HTTP |
|---------------------------|------|
| AUTH_REQUIRED             | 401  |
| FORBIDDEN                 | 403  |
| CLIENT_NOT_FOUND          | 404  |
| POST_NOT_FOUND            | 404  |
| SOCIAL_PROFILE_NOT_FOUND  | 404  |
| CLIENT_NAME_TAKEN         | 409  |
| POST_NOT_EDITABLE         | 409  |
| POST_NOT_SUBMITTABLE      | 409  |
| INVALID_TRANSITION        | 409  |
| ADAPTED_TITLE_REQUIRED    | 422  |
| VALIDATION_ERROR          | 422  |
| CALENDAR_RANGE_TOO_LARGE  | 422  |
| RATE_LIMITED              | 429  |
| INTERNAL_ERROR            | 500  |

---

## Development Notes

- Raw SQL only — parameterised queries (`$1`, `$2`). No ORM, no interpolation.
- Safe Mode is sacred — publishing without `status = 'approved'` is never allowed.
- All status changes go through `post-state-machine.service.js`. No direct `UPDATE status` elsewhere.
- Every multi-table write is a transaction.
- Tokens are encrypted at rest with application-level symmetric encryption.
- AI calls can be stubbed with `AI_STUB_MODE=true`.
- Autopilot-generated drafts are always created in `needs_approval` — they never auto-publish.
