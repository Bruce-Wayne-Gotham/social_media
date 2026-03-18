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
- `PATCH /workspaces/current`
  - body: `{ "workspaceId": "<uuid>" }`
  - returns: `{ "workspace": { "id", "name", "role", "created_at" } }`
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
- `GET /clients/:clientId/media-assets`
  - returns: `{ "assets": [{ "id", "client_id", "original_filename", "content_type", "file_size_bytes", "public_url", "status" }] }`
- `POST /clients/:clientId/media-assets/upload-url`
  - body: `{ "fileName": "asset.png", "contentType": "image/png", "fileSizeBytes": 12345 }`
  - returns: `{ "assetId", "uploadUrl", "expiresAt", "maxBytes" }`
- `GET /clients/:clientId/tracked-links`
  - returns: `{ "links": [{ "id", "post_id", "original_url", "destination_url", "short_code", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "created_at", "click_count", "shortUrl" }] }`
- `GET /clients/:clientId/tracked-links/report`
  - returns: `{ "summary": { "totalLinks", "totalClicks" }, "byPost": [{ "postId", "totalClicks" }], "links": [...] }`
- `POST /clients/:clientId/tracked-links`
  - body: `{ "originalUrl": "https://example.com", "postId": "<uuid>|null", "utmSource": "instagram", "utmMedium": "social", "utmCampaign": "spring_launch", "utmContent": "reel_a", "utmTerm": "optional" }`
  - returns: `{ "link": { "id", "client_id", "post_id", "original_url", "destination_url", "short_code", "shortUrl", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "created_by", "created_at" } }`
- `POST /clients/:clientId/approval-links`
  - body: `{ "label": "optional", "expiresInDays": 7 }`
  - returns: `{ "approvalLink": { "url", "expiresAt", "clientId", "clientName" } }`

Media Assets:
- `PUT /media-assets/:assetId/upload?token=...`
  - body: raw binary upload
  - returns: `{ "asset": { "id", "public_url", "status" } }`
- Static asset URLs are served from `/media/<storage_key>`

Tracked Links:
- `GET /tracked-links/:code/resolve`
  - returns: `{ "url": "https://example.com?utm_source=..." }`
- App short-link path: `/l/<code>`
  - behavior: resolves the code, records a click event, and redirects to the stored destination URL

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
  - body: `{ "content": "...", "mediaAssetId": "<uuid>|null", "mediaUrl": "", "hashtags": [], "scheduledTime": null, "platforms": ["linkedin"] }`
  - returns: `{ "post": { ... } }`

Posts (Legacy + shared):
- `GET /posts` (defaults to `users.default_client_id`)
- `POST /posts` (defaults to `users.default_client_id`)
- `GET /posts/:id`
- `PATCH /posts/:id`

Approvals (Safe Mode):
- `POST /posts/:id/request-approval`
  - body: `{ "note": "optional" }`
- `POST /posts/:id/comments`
  - body: `{ "note": "required" }`
  - returns: `{ "post": { ..., "events": [...] } }`
- `POST /posts/:id/approve`
  - body: `{ "note": "optional" }`
- `POST /posts/:id/reject`
  - body: `{ "note": "optional" }`

Approval Magic Links:
- `GET /approval-links/:token`
  - returns: `{ "link": { "clientId", "clientName", "label", "expiresAt" }, "posts": [...] }`
- `GET /approval-links/:token/posts/:postId`
  - returns: `{ "link": { ... }, "post": { ..., "events": [...] } }`
- `POST /approval-links/:token/posts/:postId/comments`
  - body: `{ "note": "required" }`
- `POST /approval-links/:token/posts/:postId/approve`
  - body: `{ "note": "optional" }`
- `POST /approval-links/:token/posts/:postId/reject`
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
