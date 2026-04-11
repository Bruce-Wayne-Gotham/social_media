# SocialHub API Contract
**Version:** 2.0.0
**Date:** 2026-04-04
**Authors:** Vishal + Viresh
**Platforms:** Telegram, Reddit, YouTube, Pinterest
**Strategy:** Frontend-first week 1 (mock), backend week 2 (real, integrated incrementally)

---

## How to use this document

- **Vishal:** Build `lib/mock-api.js` returning these exact shapes. Field names, types, and nesting must match exactly. Every page runs on mock data in week 1.
- **Viresh:** Build endpoints returning these exact shapes. Each endpoint is integrated the same day it is completed — sit together, swap mock, verify.
- **Both:** If a shape needs to change, update this file first. Never let code drift from this contract silently.

---

## Conventions

```
Field notation:
  fieldName          required, always present
  fieldName?         optional, may be null or absent
  id                 always a string UUID (uuid v4)
  timestamps         always ISO 8601 UTC strings: "2026-04-04T10:30:00.000Z"
  enums              always lowercase_snake_case strings
  pagination         cursor-based (see Pagination section)

HTTP rules:
  All requests:      Content-Type: application/json
  All responses:     Content-Type: application/json
  Auth:              Bearer token in Authorization header (JWT)
  Errors:            Always { "error": { "code": string, "message": string, "details"?: any } }
  Success - single:  { "data": <object> }
  Success - list:    { "data": [...], "meta": { "total": n, "nextCursor": string|null } }
```

---

## Enums (shared, locked)

```
PostStatus:
  "draft"
  "needs_approval"
  "approved"
  "scheduled"
  "publishing"
  "published"
  "failed"

Platform:
  "telegram"
  "reddit"
  "youtube"
  "pinterest"

TargetStatus:
  "pending"
  "publishing"
  "published"
  "failed"

ApprovalAction:
  "submitted"
  "approved"
  "rejected"
  "recalled"

MemberRole:
  "owner"
  "admin"
  "member"
  "client_approver"
```

---

## Platform-specific content constraints

These constraints drive the AI adaptation prompts and the composer validation.

```
Telegram:
  content:       max 4096 chars
  title:         null (no title)
  hashtags:      optional, 0-3 recommended
  tone:          direct, conversational, no corporate speak
  special:       supports markdown bold (*text*) and links

Reddit:
  title:         required, max 300 chars (the post title / headline)
  content:       optional body text, max 40000 chars (often left short)
  hashtags:      none (Reddit does not use hashtags)
  tone:          genuine, community-first, no promotional language
  special:       subreddit targeting required (stored as providerMeta.subreddit)

YouTube:
  title:         required, max 100 chars
  content:       description, max 5000 chars
  hashtags:      3-5 in description
  tone:          engaging, searchable, clear value proposition

Pinterest:
  title:         required, max 100 chars (pin title)
  content:       description, max 500 chars
  hashtags:      2-5 recommended
  tone:          aspirational, visual-first, action-oriented
  special:       board targeting required (stored as providerMeta.boardId)
```

---

## Core Objects

### Workspace

```json
{
  "id": "ws_001",
  "name": "Acme Agency",
  "slug": "acme-agency",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### WorkspaceMember

```json
{
  "id": "wm_001",
  "workspaceId": "ws_001",
  "userId": "user_001",
  "role": "admin",
  "user": {
    "id": "user_001",
    "name": "Vishal Sharma",
    "email": "vishal@acme.com",
    "avatarUrl": null
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Client

```json
{
  "id": "client_001",
  "workspaceId": "ws_001",
  "name": "Nike India",
  "slug": "nike-india",
  "logoUrl": null,
  "brandNotes": "Inspirational tone. Never mention competitors.",
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-01-15T00:00:00.000Z"
}
```

### SocialProfile

```json
{
  "id": "sp_001",
  "clientId": "client_001",
  "platform": "youtube",
  "displayName": "Nike India Official",
  "profileImageUrl": "https://cdn.example.com/nike.jpg",
  "providerId": "UCxxx123",
  "providerType": "channel",
  "providerMeta": {},
  "isConnected": true,
  "connectedAt": "2026-01-20T00:00:00.000Z",
  "lastSyncedAt": "2026-04-01T00:00:00.000Z",
  "createdAt": "2026-01-20T00:00:00.000Z"
}
```

```
providerType values per platform:
  telegram:   "channel" | "group"
  reddit:     "user" | "subreddit_mod"
  youtube:    "channel"
  pinterest:  "account"

providerMeta per platform (stored as JSONB):
  telegram:   { "channelUsername": "@nikeindia" }
  reddit:     { "subreddit": "r/running", "username": "nikeindia_official" }
  youtube:    {}
  pinterest:  { "boardId": "123456", "boardName": "Running Inspiration" }
```

### Post (full object)

```json
{
  "id": "post_001",
  "clientId": "client_001",
  "workspaceId": "ws_001",
  "status": "needs_approval",
  "originalContent": "We just launched our new running shoe.",
  "scheduledAt": "2026-04-06T09:00:00.000Z",
  "publishImmediately": false,
  "createdBy": {
    "id": "user_001",
    "name": "Vishal Sharma",
    "avatarUrl": null
  },
  "targets": [
    {
      "id": "tgt_001",
      "postId": "post_001",
      "socialProfileId": "sp_001",
      "platform": "youtube",
      "adaptedContent": "Our new running shoe is here. Built for speed, designed for comfort.",
      "adaptedTitle": "Nike Launches New Running Shoe | Innovation in Every Step",
      "status": "pending",
      "externalPostId": null,
      "failureReason": null,
      "approvedAt": null,
      "publishedAt": null,
      "socialProfile": {
        "id": "sp_001",
        "displayName": "Nike India Official",
        "profileImageUrl": null,
        "platform": "youtube",
        "providerMeta": {}
      }
    }
  ],
  "approvalLog": [
    {
      "id": "log_001",
      "postId": "post_001",
      "action": "submitted",
      "actorId": "user_001",
      "actorName": "Vishal Sharma",
      "comment": "Ready for review.",
      "createdAt": "2026-04-04T11:00:00.000Z"
    }
  ],
  "createdAt": "2026-04-04T10:30:00.000Z",
  "updatedAt": "2026-04-04T11:00:00.000Z"
}
```

### Post (list item — lighter, no approvalLog)

Same as above but `approvalLog` field is omitted. `targets` array is included.

### AdaptResult (returned by adapt endpoint — NOT saved automatically)

```json
{
  "postId": "post_001",
  "adaptations": [
    {
      "targetId": "tgt_001",
      "socialProfileId": "sp_001",
      "platform": "youtube",
      "content": "Our new running shoe is here. Built for speed, designed for comfort. #Nike #Running #NewLaunch",
      "title": "Nike Launches New Running Shoe | Innovation in Every Step",
      "charCount": 96,
      "hashtagCount": 3,
      "notes": "Added searchable title. Description kept concise with 3 hashtags."
    }
  ]
}
```

### ClientStats

```json
{
  "clientId": "client_001",
  "period": "current_week",
  "postsThisWeek": 4,
  "pendingApprovals": 2,
  "scheduledUpcoming": 6,
  "publishedThisMonth": 18,
  "failedTotal": 1,
  "approvalRate": 0.92,
  "avgHoursToApproval": 3.4
}
```

### CalendarPost (lightweight, for calendar view only)

```json
{
  "id": "post_001",
  "status": "scheduled",
  "scheduledAt": "2026-04-06T09:00:00.000Z",
  "originalContent": "We just launched our new running shoe...",
  "platforms": ["youtube", "telegram"],
  "targetStatuses": {
    "youtube": "pending",
    "telegram": "pending"
  },
  "createdBy": {
    "id": "user_001",
    "name": "Vishal Sharma"
  }
}
```

---

## Endpoints

### Auth
Pre-existing. JWT in `Authorization: Bearer <token>`. Token payload: `{ userId, workspaceId }`.

---

### Workspaces

```
GET  /api/workspaces/current              → { data: Workspace }
GET  /api/workspaces/current/members      → { data: [WorkspaceMember], meta: { total } }
```

---

### Clients

```
GET    /api/clients                        → { data: [Client], meta: { total, nextCursor } }
POST   /api/clients                        → { data: Client }          201
GET    /api/clients/:clientId              → { data: Client }
PATCH  /api/clients/:clientId              → { data: Client }
DELETE /api/clients/:clientId              → 204
```

POST /api/clients body:
```json
{ "name": "Nike India", "brandNotes": "..." }
```

PATCH /api/clients/:clientId body (all optional):
```json
{ "name": "...", "brandNotes": "...", "logoUrl": "..." }
```

Errors:
```
409  CLIENT_NAME_TAKEN
422  VALIDATION_ERROR   { details: { name: "required" } }
403  FORBIDDEN
404  CLIENT_NOT_FOUND
```

---

### Social Profiles

```
GET    /api/clients/:clientId/social-profiles   → { data: [SocialProfile] }
DELETE /api/social-profiles/:profileId          → 204
```

OAuth connect flow:
```
Step 1 — frontend navigates to:
  GET /api/oauth/:platform/connect?clientId=<id>
  platform: "telegram" | "reddit" | "youtube" | "pinterest"
  Backend stores { clientId, userId } in Redis with 10min TTL, redirects to platform OAuth URL.

Step 2 — platform redirects back to:
  GET /api/oauth/:platform/callback?code=<code>&state=<state>
  Backend exchanges code, upserts SocialProfile row, redirects to:
  /clients/<clientId>/settings?connected=<platform>

Errors redirect to: /error?code=OAUTH_FAILED&platform=<platform>
```

---

### Posts

```
GET    /api/clients/:clientId/posts        → { data: [Post(list)], meta }
POST   /api/clients/:clientId/posts        → { data: Post }            201
GET    /api/posts/:postId                  → { data: Post(full) }
PATCH  /api/posts/:postId                  → { data: Post }
DELETE /api/posts/:postId                  → 204
```

GET params: `status?`, `from?`, `to?`, `page?`, `limit?` (default 20)

POST body:
```json
{
  "originalContent": "We just launched...",
  "scheduledAt": "2026-04-06T09:00:00.000Z",
  "publishImmediately": false,
  "targetProfileIds": ["sp_001", "sp_002"]
}
```

PATCH body (all optional, only when status=draft):
```json
{
  "originalContent": "...",
  "scheduledAt": "...",
  "publishImmediately": false,
  "targetProfileIds": ["sp_001"]
}
```

Errors:
```
409  POST_NOT_EDITABLE         (not in draft)
422  VALIDATION_ERROR
404  SOCIAL_PROFILE_NOT_FOUND
```

---

### Adaptation

```
POST   /api/posts/:postId/adapt                          → { data: AdaptResult }
PATCH  /api/posts/:postId/targets/:targetId              → { data: Target }
```

POST /adapt — does NOT save to DB. Returns suggestions only.

PATCH /targets/:targetId body:
```json
{
  "adaptedContent": "...",
  "adaptedTitle": "..."
}
```

Errors:
```
409  POST_NOT_EDITABLE
422  ADAPTED_TITLE_REQUIRED     (reddit, youtube, pinterest targets)
```

---

### Approvals

```
POST  /api/posts/:postId/submit    body: { comment? }   → { data: Post }
POST  /api/posts/:postId/approve   body: { comment? }   → { data: Post }
POST  /api/posts/:postId/reject    body: { comment? }   → { data: Post }
POST  /api/posts/:postId/recall    body: { comment? }   → { data: Post }
```

Errors:
```
409  POST_NOT_SUBMITTABLE     (targets missing adaptedContent)
409  INVALID_TRANSITION
403  FORBIDDEN                (approve/reject: needs owner|admin|client_approver role)
```

---

### Stats

```
GET  /api/clients/:clientId/stats   → { data: ClientStats }
```
Cached in Redis for 60s.

---

### Calendar

```
GET  /api/clients/:clientId/calendar?from=<date>&to=<date>   → { data: [CalendarPost] }
```

Rules: `from` and `to` required. Max range 90 days.
Errors: `422 CALENDAR_RANGE_TOO_LARGE`, `422 VALIDATION_ERROR`

---

## State Machine

```
  draft
    |-- [submit] --> needs_approval
    |                   |-- [approve] --> approved --> scheduled (if scheduledAt set)
    |                   |                          --> publishing (if publishImmediately)
    |                   |-- [reject]  --> draft
    |                   |-- [recall]  --> draft
    |
  approved --> scheduled --> publishing --> published
                                       --> failed (per target, after 3 retries)
```

Server-side rules (non-negotiable):
1. Post CANNOT move to approved/scheduled/publishing unless it came through needs_approval.
2. Post CANNOT be submitted unless ALL targets have non-null adaptedContent.
3. Only owner/admin/client_approver can call approve or reject.
4. Every transition writes an approval_log row.
5. Worker checks externalPostId before publishing (idempotency).
6. Worker skips any post where status != 'approved' or 'scheduled'.

---

## Error Codes (complete list)

```
AUTH_REQUIRED               401
FORBIDDEN                   403
CLIENT_NOT_FOUND            404
POST_NOT_FOUND              404
SOCIAL_PROFILE_NOT_FOUND    404
CLIENT_NAME_TAKEN           409
POST_NOT_EDITABLE           409
POST_NOT_SUBMITTABLE        409
INVALID_TRANSITION          409
ADAPTED_TITLE_REQUIRED      422
VALIDATION_ERROR            422
CALENDAR_RANGE_TOO_LARGE    422
RATE_LIMITED                429
INTERNAL_ERROR              500
```

---

## Pagination

Cursor-based on all list endpoints.
Request: `?page=<cursor>&limit=<n>`
Response meta: `{ "total": 34, "nextCursor": "base64string_or_null" }`

---

## Mock data for Vishal (week 1)

```js
// lib/mock-data.js — copy exactly, do not invent shapes

export const WORKSPACE = {
  id: "ws_001", name: "Acme Agency", slug: "acme-agency",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
}

export const CLIENTS = [
  { id: "client_001", workspaceId: "ws_001", name: "Nike India", slug: "nike-india", logoUrl: null, brandNotes: "Inspirational tone.", createdAt: "2026-01-15T00:00:00.000Z", updatedAt: "2026-01-15T00:00:00.000Z" },
  { id: "client_002", workspaceId: "ws_001", name: "Zomato", slug: "zomato", logoUrl: null, brandNotes: "Fun and casual.", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
  { id: "client_003", workspaceId: "ws_001", name: "HDFC Bank", slug: "hdfc-bank", logoUrl: null, brandNotes: "Formal and trustworthy.", createdAt: "2026-02-15T00:00:00.000Z", updatedAt: "2026-02-15T00:00:00.000Z" }
]

export const SOCIAL_PROFILES = [
  { id: "sp_001", clientId: "client_001", platform: "youtube", displayName: "Nike India Official", profileImageUrl: null, providerId: "UCxxx123", providerType: "channel", providerMeta: {}, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_002", clientId: "client_001", platform: "telegram", displayName: "@nikeindia", profileImageUrl: null, providerId: "-1001234567890", providerType: "channel", providerMeta: { channelUsername: "@nikeindia" }, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_003", clientId: "client_001", platform: "reddit", displayName: "r/running", profileImageUrl: null, providerId: "t5_running", providerType: "subreddit_mod", providerMeta: { subreddit: "r/running", username: "nikeindia_official" }, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_004", clientId: "client_001", platform: "pinterest", displayName: "Nike India Pins", profileImageUrl: null, providerId: "nikeindia_pins", providerType: "account", providerMeta: { boardId: "123456", boardName: "Running Inspiration" }, isConnected: false, connectedAt: null, lastSyncedAt: null, createdAt: "2026-01-20T00:00:00.000Z" }
]

export const POSTS = [
  {
    id: "post_001", clientId: "client_001", workspaceId: "ws_001",
    status: "needs_approval",
    originalContent: "We just launched our new running shoe. Built for speed, designed for comfort.",
    scheduledAt: "2026-04-06T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_001", postId: "post_001", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "Our new running shoe is here.", adaptedTitle: "Nike Launches New Running Shoe", status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } },
      { id: "tgt_002", postId: "post_001", socialProfileId: "sp_002", platform: "telegram", adaptedContent: "Just launched: our new running shoe. Check it out!", adaptedTitle: null, status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_002", displayName: "@nikeindia", profileImageUrl: null, platform: "telegram", providerMeta: { channelUsername: "@nikeindia" } } }
    ],
    approvalLog: [
      { id: "log_001", postId: "post_001", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: "Ready for review.", createdAt: "2026-04-04T11:00:00.000Z" }
    ],
    createdAt: "2026-04-04T10:30:00.000Z", updatedAt: "2026-04-04T11:00:00.000Z"
  },
  {
    id: "post_002", clientId: "client_001", workspaceId: "ws_001",
    status: "scheduled",
    originalContent: "Training season is here. Join the movement.",
    scheduledAt: "2026-04-07T10:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_003", postId: "post_002", socialProfileId: "sp_003", platform: "reddit", adaptedContent: "Training season is here. We put together some tips for the community.", adaptedTitle: "Training Season is Here — Tips from Nike India", status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_003", displayName: "r/running", profileImageUrl: null, platform: "reddit", providerMeta: { subreddit: "r/running" } } }
    ],
    approvalLog: [
      { id: "log_002", postId: "post_002", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-04-03T09:00:00.000Z" },
      { id: "log_003", postId: "post_002", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: "Approved.", createdAt: "2026-04-03T11:00:00.000Z" }
    ],
    createdAt: "2026-04-03T08:00:00.000Z", updatedAt: "2026-04-03T11:00:00.000Z"
  },
  {
    id: "post_003", clientId: "client_001", workspaceId: "ws_001",
    status: "draft",
    originalContent: "New collection dropping this weekend.",
    scheduledAt: null, publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [],
    approvalLog: [],
    createdAt: "2026-04-04T08:00:00.000Z", updatedAt: "2026-04-04T08:00:00.000Z"
  },
  {
    id: "post_004", clientId: "client_001", workspaceId: "ws_001",
    status: "published",
    originalContent: "Celebrating 10 years of Nike India.",
    scheduledAt: "2026-04-01T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_004", postId: "post_004", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "10 years of inspiring India.", adaptedTitle: "10 Years of Nike India", status: "published", externalPostId: "yt_abc123", failureReason: null, approvedAt: "2026-03-30T10:00:00.000Z", publishedAt: "2026-04-01T09:01:00.000Z", socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } }
    ],
    approvalLog: [
      { id: "log_004", postId: "post_004", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-03-29T10:00:00.000Z" },
      { id: "log_005", postId: "post_004", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: "Great post!", createdAt: "2026-03-30T10:00:00.000Z" }
    ],
    createdAt: "2026-03-29T09:00:00.000Z", updatedAt: "2026-04-01T09:01:00.000Z"
  },
  {
    id: "post_005", clientId: "client_001", workspaceId: "ws_001",
    status: "failed",
    originalContent: "Flash sale — 20% off all running gear.",
    scheduledAt: "2026-04-02T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_005", postId: "post_005", socialProfileId: "sp_004", platform: "pinterest", adaptedContent: "Flash sale! 20% off all running gear this weekend.", adaptedTitle: "Flash Sale — 20% Off Running Gear", status: "failed", externalPostId: null, failureReason: "Pinterest account not connected.", approvedAt: "2026-04-01T10:00:00.000Z", publishedAt: null, socialProfile: { id: "sp_004", displayName: "Nike India Pins", profileImageUrl: null, platform: "pinterest", providerMeta: {} } }
    ],
    approvalLog: [
      { id: "log_006", postId: "post_005", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-04-01T08:00:00.000Z" },
      { id: "log_007", postId: "post_005", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: null, createdAt: "2026-04-01T10:00:00.000Z" }
    ],
    createdAt: "2026-04-01T07:00:00.000Z", updatedAt: "2026-04-02T09:02:00.000Z"
  }
]

export const STATS = {
  clientId: "client_001",
  period: "current_week",
  postsThisWeek: 4,
  pendingApprovals: 1,
  scheduledUpcoming: 2,
  publishedThisMonth: 6,
  failedTotal: 1,
  approvalRate: 0.89,
  avgHoursToApproval: 2.8
}

export const MOCK_ADAPTATIONS = {
  postId: "post_003",
  adaptations: [
    { targetId: "tgt_new_1", socialProfileId: "sp_001", platform: "youtube", content: "New collection dropping this weekend. Be the first to get yours. #Nike #NewCollection #Weekend", title: "New Nike Collection Drops This Weekend", charCount: 96, hashtagCount: 3, notes: "Added searchable title. Hashtags optimised for YouTube discovery." },
    { targetId: "tgt_new_2", socialProfileId: "sp_002", platform: "telegram", content: "New collection dropping this weekend. Stay tuned!", title: null, charCount: 51, hashtagCount: 0, notes: "Kept short and direct for Telegram. No hashtags." },
    { targetId: "tgt_new_3", socialProfileId: "sp_003", platform: "reddit", content: "Dropping a new collection this weekend. Would love to hear what you all think of the direction we are taking with the new designs.", title: "New Nike India collection this weekend — thoughts?", charCount: 133, hashtagCount: 0, notes: "Conversational tone for Reddit. No hashtags. Title phrased as discussion starter." },
    { targetId: "tgt_new_4", socialProfileId: "sp_004", platform: "pinterest", content: "New collection this weekend. Discover the latest styles. #Nike #Fashion #NewArrival", title: "New Nike Collection — Weekend Drop", charCount: 83, hashtagCount: 3, notes: "Visual-first tone for Pinterest. Action-oriented." }
  ]
}
```

---

## Integration order (week 2 — one API at a time, swap mock same day)

```
Day 8:   Viresh ships #B1 (clients API)      → both sit, Vishal swaps clients mock
Day 9:   Viresh ships #B2 (posts + approvals) → both sit, Vishal swaps posts mock
Day 10:  Viresh ships #B3 (adapt endpoint)    → both sit, Vishal swaps adapt mock
Day 11:  Viresh ships #B4 (stats + calendar)  → both sit, Vishal swaps both mocks
Day 12:  Viresh ships #B5 (OAuth stubs)       → both sit, Vishal wires connect buttons
Day 13:  Buffer + smoke test together
```
