import * as MOCK_DATA from './mock-data'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api'

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Mutable in-memory store so mutations (approve, reject, etc.) persist during
// the session and the UI reflects state changes without a real backend.
let _posts = MOCK_DATA.POSTS.map((p) => ({ ...p }))
let _clients = MOCK_DATA.CLIENTS.map((c) => ({ ...c }))
let _socialProfiles = MOCK_DATA.SOCIAL_PROFILES.map((p) => ({ ...p }))
let _postIdCounter = 8
let _clientIdCounter = 4
let _profileIdCounter = 10

function _findPost(postId) {
  return _posts.find((p) => p.id === postId) ?? null
}

function _now() {
  return new Date().toISOString()
}

function _appendLog(post, action, comment) {
  const logId = `log_${Date.now()}`
  post.approvalLog = [
    ...(post.approvalLog ?? []),
    { id: logId, postId: post.id, action, actorId: 'user_001', actorName: 'Vishal Sharma', comment: comment ?? null, createdAt: _now() },
  ]
}

async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('socialhub_token') : null
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' })
  } catch {
    throw new Error(`Unable to reach API at ${API_BASE_URL}. Is the backend running?`)
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message ?? payload?.error ?? 'Request failed')
  return payload
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export async function getCurrentWorkspace() {
  if (USE_MOCK) {
    await delay(300)
    return { data: MOCK_DATA.WORKSPACE }
  }
  return apiFetch('/workspaces/current')
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function getClients(params = {}) {
  if (USE_MOCK) {
    await delay(600)
    return { data: _clients, meta: { total: _clients.length, nextCursor: null } }
  }
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/clients${qs ? `?${qs}` : ''}`)
}

export async function getClient(clientId) {
  if (USE_MOCK) {
    await delay(300)
    const client = _clients.find((c) => c.id === clientId)
    if (!client) throw new Error('CLIENT_NOT_FOUND')
    return { data: client }
  }
  return apiFetch(`/clients/${clientId}`)
}

export async function createClient(body) {
  if (USE_MOCK) {
    await delay(300)
    const existing = _clients.find((c) => c.name.toLowerCase() === body.name?.toLowerCase())
    if (existing) throw new Error('CLIENT_NAME_TAKEN')
    const slug = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const newClient = {
      id: `client_00${_clientIdCounter++}`,
      workspaceId: 'ws_001',
      name: body.name,
      slug,
      logoUrl: null,
      brandNotes: body.brandNotes ?? null,
      createdAt: _now(),
      updatedAt: _now(),
    }
    _clients = [..._clients, newClient]
    return { data: newClient }
  }
  return apiFetch('/clients', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateClient(clientId, body) {
  if (USE_MOCK) {
    await delay(300)
    const idx = _clients.findIndex((c) => c.id === clientId)
    if (idx === -1) throw new Error('CLIENT_NOT_FOUND')
    _clients[idx] = { ..._clients[idx], ...body, updatedAt: _now() }
    return { data: _clients[idx] }
  }
  return apiFetch(`/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deleteClient(clientId) {
  if (USE_MOCK) {
    await delay(300)
    _clients = _clients.filter((c) => c.id !== clientId)
    return null
  }
  return apiFetch(`/clients/${clientId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Social Profiles
// ---------------------------------------------------------------------------

export async function getSocialProfiles(clientId) {
  if (USE_MOCK) {
    await delay(600)
    const profiles = _socialProfiles.filter((sp) => sp.clientId === clientId)
    return { data: profiles }
  }
  return apiFetch(`/clients/${clientId}/social-profiles`)
}

export async function disconnectSocialProfile(profileId) {
  if (USE_MOCK) {
    await delay(300)
    const idx = _socialProfiles.findIndex((sp) => sp.id === profileId)
    if (idx === -1) throw new Error('SOCIAL_PROFILE_NOT_FOUND')
    _socialProfiles[idx] = { ..._socialProfiles[idx], isConnected: false, lastSyncedAt: null }
    return null
  }
  return apiFetch(`/social-profiles/${profileId}`, { method: 'DELETE' })
}

export async function connectMockProfile(clientId, platform) {
  if (USE_MOCK) {
    await delay(1000)
    const id = `sp_0${_profileIdCounter++}`
    const mockMeta = {
      telegram:  { channelUsername: `@mockChannel_${id}` },
      reddit:    { subreddit: `r/mock_${id}`, username: `mock_user_${id}` },
      youtube:   {},
      pinterest: { boardId: `board_${id}`, boardName: `Mock Board ${id}` },
    }
    const mockDisplayNames = {
      telegram: `@mockChannel_${id}`,
      reddit:   `r/mock_${id}`,
      youtube:  `Mock YouTube Channel`,
      pinterest:`Mock Pinterest Account`,
    }
    const mockProviderTypes = {
      telegram: 'channel', reddit: 'subreddit_mod', youtube: 'channel', pinterest: 'account',
    }
    const now = _now()
    const newProfile = {
      id,
      clientId,
      platform,
      displayName: mockDisplayNames[platform],
      profileImageUrl: null,
      providerId: `mock_${id}`,
      providerType: mockProviderTypes[platform],
      providerMeta: mockMeta[platform],
      isConnected: true,
      connectedAt: now,
      lastSyncedAt: now,
      createdAt: now,
    }
    _socialProfiles = [..._socialProfiles, newProfile]
    return { data: newProfile }
  }
  // Week 2: redirect to OAuth flow
  window.location.href = `${API_BASE_URL}/oauth/${platform}/connect?clientId=${clientId}`
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function getPosts(clientId, params = {}) {
  if (USE_MOCK) {
    await delay(600)
    let results = _posts.filter((p) => p.clientId === clientId)
    if (params.status) results = results.filter((p) => p.status === params.status)
    if (params.from) results = results.filter((p) => p.scheduledAt && p.scheduledAt >= params.from)
    if (params.to) results = results.filter((p) => p.scheduledAt && p.scheduledAt <= params.to)
    // List items omit approvalLog
    const listItems = results.map(({ approvalLog: _al, ...p }) => p)
    return { data: listItems, meta: { total: listItems.length, nextCursor: null } }
  }
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/clients/${clientId}/posts${qs ? `?${qs}` : ''}`)
}

export async function getPost(postId) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    return { data: post }
  }
  return apiFetch(`/posts/${postId}`)
}

export async function createPost(clientId, body) {
  if (USE_MOCK) {
    await delay(300)
    const id = `post_00${_postIdCounter++}`
    const targets = (body.targetProfileIds ?? []).map((spId, i) => {
      const sp = MOCK_DATA.SOCIAL_PROFILES.find((s) => s.id === spId)
      return {
        id: `tgt_new_${id}_${i}`,
        postId: id,
        socialProfileId: spId,
        platform: sp?.platform ?? 'unknown',
        adaptedContent: null,
        adaptedTitle: null,
        status: 'pending',
        externalPostId: null,
        failureReason: null,
        approvedAt: null,
        publishedAt: null,
        socialProfile: sp ? { id: sp.id, displayName: sp.displayName, profileImageUrl: sp.profileImageUrl, platform: sp.platform, providerMeta: sp.providerMeta } : null,
      }
    })
    const newPost = {
      id,
      clientId,
      workspaceId: 'ws_001',
      status: 'draft',
      originalContent: body.originalContent,
      scheduledAt: body.scheduledAt ?? null,
      publishImmediately: body.publishImmediately ?? false,
      createdBy: { id: 'user_001', name: 'Vishal Sharma', avatarUrl: null },
      targets,
      approvalLog: [],
      createdAt: _now(),
      updatedAt: _now(),
    }
    _posts = [..._posts, newPost]
    return { data: newPost }
  }
  return apiFetch(`/clients/${clientId}/posts`, { method: 'POST', body: JSON.stringify(body) })
}

export async function updatePost(postId, body) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    if (post.status !== 'draft') throw new Error('POST_NOT_EDITABLE')

    if (body.targetProfileIds) {
      post.targets = body.targetProfileIds.map((spId, i) => {
        const sp = MOCK_DATA.SOCIAL_PROFILES.find((s) => s.id === spId)
        const existing = post.targets.find((t) => t.socialProfileId === spId)
        return existing ?? {
          id: `tgt_new_${postId}_${i}`,
          postId,
          socialProfileId: spId,
          platform: sp?.platform ?? 'unknown',
          adaptedContent: null,
          adaptedTitle: null,
          status: 'pending',
          externalPostId: null,
          failureReason: null,
          approvedAt: null,
          publishedAt: null,
          socialProfile: sp ? { id: sp.id, displayName: sp.displayName, profileImageUrl: sp.profileImageUrl, platform: sp.platform, providerMeta: sp.providerMeta } : null,
        }
      })
    }
    if (body.originalContent !== undefined) post.originalContent = body.originalContent
    if (body.scheduledAt !== undefined) post.scheduledAt = body.scheduledAt
    if (body.publishImmediately !== undefined) post.publishImmediately = body.publishImmediately
    post.updatedAt = _now()
    return { data: post }
  }
  return apiFetch(`/posts/${postId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deletePost(postId) {
  if (USE_MOCK) {
    await delay(300)
    _posts = _posts.filter((p) => p.id !== postId)
    return null
  }
  return apiFetch(`/posts/${postId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Adaptation
// ---------------------------------------------------------------------------

export async function adaptPost(postId) {
  if (USE_MOCK) {
    await delay(600)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    // Return mock adaptations shaped to the actual targets on this post
    const adaptations = post.targets.map((t) => ({
      targetId: t.id,
      socialProfileId: t.socialProfileId,
      platform: t.platform,
      content: `${post.originalContent} (adapted for ${t.platform})`,
      title: ['youtube', 'reddit', 'pinterest'].includes(t.platform) ? `${post.originalContent.slice(0, 60)} | ${t.platform}` : null,
      charCount: post.originalContent.length + 20,
      hashtagCount: t.platform === 'telegram' ? 0 : 3,
      notes: `Auto-adapted for ${t.platform} tone and constraints.`,
    }))
    return { data: { postId, adaptations } }
  }
  return apiFetch(`/posts/${postId}/adapt`, { method: 'POST' })
}

export async function saveAdaptation(postId, targetId, body) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    if (post.status !== 'draft') throw new Error('POST_NOT_EDITABLE')
    const target = post.targets.find((t) => t.id === targetId)
    if (!target) throw new Error('TARGET_NOT_FOUND')
    if (body.adaptedContent !== undefined) target.adaptedContent = body.adaptedContent
    if (body.adaptedTitle !== undefined) target.adaptedTitle = body.adaptedTitle
    post.updatedAt = _now()
    return { data: target }
  }
  return apiFetch(`/posts/${postId}/targets/${targetId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function submitPost(postId, body = {}) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    const missingAdapt = post.targets.some((t) => !t.adaptedContent)
    if (missingAdapt) throw new Error('POST_NOT_SUBMITTABLE')
    post.status = 'needs_approval'
    post.updatedAt = _now()
    _appendLog(post, 'submitted', body.comment)
    return { data: post }
  }
  return apiFetch(`/posts/${postId}/submit`, { method: 'POST', body: JSON.stringify(body) })
}

export async function approvePost(postId, body = {}) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    if (post.status !== 'needs_approval') throw new Error('INVALID_TRANSITION')
    post.status = post.publishImmediately ? 'publishing' : post.scheduledAt ? 'scheduled' : 'approved'
    post.updatedAt = _now()
    _appendLog(post, 'approved', body.comment)
    return { data: post }
  }
  return apiFetch(`/posts/${postId}/approve`, { method: 'POST', body: JSON.stringify(body) })
}

export async function rejectPost(postId, body = {}) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    if (post.status !== 'needs_approval') throw new Error('INVALID_TRANSITION')
    post.status = 'draft'
    post.updatedAt = _now()
    _appendLog(post, 'rejected', body.comment)
    return { data: post }
  }
  return apiFetch(`/posts/${postId}/reject`, { method: 'POST', body: JSON.stringify(body) })
}

export async function recallPost(postId, body = {}) {
  if (USE_MOCK) {
    await delay(300)
    const post = _findPost(postId)
    if (!post) throw new Error('POST_NOT_FOUND')
    if (post.status !== 'needs_approval') throw new Error('INVALID_TRANSITION')
    post.status = 'draft'
    post.updatedAt = _now()
    _appendLog(post, 'recalled', body.comment)
    return { data: post }
  }
  return apiFetch(`/posts/${postId}/recall`, { method: 'POST', body: JSON.stringify(body) })
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

export async function getRecentActivity(clientId, limit = 5) {
  if (USE_MOCK) {
    await delay(300)
    const entries = _posts
      .filter((p) => p.clientId === clientId)
      .flatMap((p) =>
        (p.approvalLog ?? []).map((log) => ({
          ...log,
          postId: p.id,
          postContent: p.originalContent,
        }))
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
    return { data: entries }
  }
  // Week 2: derive from posts list or add a dedicated endpoint
  return { data: [] }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getClientStats(clientId) {
  if (USE_MOCK) {
    await delay(300)
    return { data: { ...MOCK_DATA.STATS, clientId } }
  }
  return apiFetch(`/clients/${clientId}/stats`)
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function getCalendarPosts(clientId, from, to) {
  if (USE_MOCK) {
    await delay(600)
    const results = _posts
      .filter((p) => p.clientId === clientId && p.scheduledAt && p.scheduledAt >= from && p.scheduledAt <= to)
      .map((p) => ({
        id: p.id,
        status: p.status,
        scheduledAt: p.scheduledAt,
        originalContent: p.originalContent,
        platforms: [...new Set(p.targets.map((t) => t.platform))],
        targetStatuses: Object.fromEntries(p.targets.map((t) => [t.platform, t.status])),
        createdBy: p.createdBy,
      }))
    return { data: results }
  }
  const qs = new URLSearchParams({ from, to }).toString()
  return apiFetch(`/clients/${clientId}/calendar?${qs}`)
}
