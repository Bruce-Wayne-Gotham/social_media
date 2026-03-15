# SocialHub - API Reference (Current)

Base URL:
- Backend: `http://localhost:4000/api`

Auth:
- `POST /auth/register`
  - body: `{ "email": "user@x.com", "password": "..." }`
  - returns: `{ "token": "...", "user": { "id": "...", "email": "...", "createdAt": "..." } }`
- `POST /auth/login`
  - body: `{ "email": "user@x.com", "password": "..." }`
  - returns: `{ "token": "...", "user": { ... } }`
- `GET /auth/me`
  - returns: `{ "user": { "id", "email", "defaultWorkspaceId", "defaultClientId", "createdAt" } }`

Register Password Rules (Current):
- "At least 8 chars, with minimum one uppercase, lowercase, number, and special character."

Workspaces:
- `GET /workspaces`
  - returns: `{ "workspaces": [{ "id", "name", "role", "created_at" }] }`
- `POST /workspaces`
  - body: `{ "name": "Agency Name" }`
  - returns: `{ "workspace": { "id", "name", "role", "created_at" } }`
- `GET /workspaces/current`
  - returns: `{ "workspace": { "id", "name", "role", "created_at" } | null }`
- `GET /workspaces/:workspaceId/clients`
  - returns: `{ "clients": [{ "id", "workspace_id", "name", "created_at", "updated_at" }] }`
- `POST /workspaces/:workspaceId/clients`
  - body: `{ "name": "Client Name" }`
  - returns: `{ "client": { ... } }`

Clients:
- `GET /clients/:clientId`
  - returns: `{ "client": { ... } }`
- `PATCH /clients/:clientId`
  - body: `{ "name": "New Name" }`
  - returns: `{ "client": { ... } }`
- `DELETE /clients/:clientId`
  - returns: `{ "ok": true }`

Social Profiles:
- `GET /clients/:clientId/social-profiles`
  - returns: `{ "profiles": [{ "id", "client_id", "platform", "provider_account_id", "account_name", "expiry" }] }`
- `GET /clients/:clientId/social-profiles/oauth/:platform/start`
  - returns: `{ "platform": "linkedin|instagram|youtube", "authUrl": "https://..." }`
- `DELETE /social-profiles/:socialProfileId`
  - returns: `{ "ok": true }`

OAuth Connect Sessions:
- `GET /oauth-connect-sessions/:sessionId`
  - returns: `{ "session": { "id", "platform", "clientId", "candidates": [ ... ] } }`
- `POST /oauth-connect-sessions/:sessionId/consume`
  - body: `{ "clientId": "<uuid>", "providerAccountIds": ["..."] }`
  - returns: `{ "connected": [{ ... }] }`

Posts (Client-scoped):
- `GET /clients/:clientId/posts`
  - returns: `{ "posts": [...] }`
- `POST /clients/:clientId/posts`
  - body: `{ "content": "...", "mediaUrl": "", "hashtags": [], "scheduledTime": null, "platforms": ["linkedin"] }`
  - returns: `{ "post": { ... } }`

Posts (Legacy + shared):
- `GET /posts` (defaults to `users.default_client_id`)
- `POST /posts` (defaults to `users.default_client_id`)
- `GET /posts/:id`
- `PATCH /posts/:id`

Approvals (Safe Mode):
- `POST /posts/:id/request-approval`
  - body: `{ "note": "optional" }`
- `POST /posts/:id/approve`
  - body: `{ "note": "optional" }`
- `POST /posts/:id/reject`
  - body: `{ "note": "optional" }`

Worker Retry Policy (Current Default):
- Per target: 3 attempts with exponential backoff (1s, 2s, 4s)
- Tunables (worker env vars):
  - `PUBLISH_RETRY_ATTEMPTS` (default 3)
  - `PUBLISH_RETRY_BASE_MS` (default 1000)

Worker Token Resolution (Current):
- Note: social profiles are stored in the `social_accounts` table (legacy name).
- Targets can optionally specify `social_account_id` (social profile id) on `post_targets`.
- The worker resolves tokens by `post.client_id` and prefers `post_targets.social_account_id` when present.
