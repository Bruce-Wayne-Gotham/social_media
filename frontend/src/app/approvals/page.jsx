'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, AlertCircle } from 'lucide-react'
import { useClient } from '@/lib/client-context'
import { useToast } from '@/components/ui'
import { getPosts, getPost, approvePost, rejectPost } from '@/lib/api'
import { POST_STATUS, PLATFORM_COLORS, PLATFORM_CONSTRAINTS } from '@/constants'
import { Badge, Avatar, Button, Skeleton, EmptyState } from '@/components/ui'
import { truncate, formatRelative, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BORDER_COLORS = {
  [POST_STATUS.DRAFT]:          'border-gray-300',
  [POST_STATUS.NEEDS_APPROVAL]: 'border-amber-400',
  [POST_STATUS.APPROVED]:       'border-blue-400',
  [POST_STATUS.SCHEDULED]:      'border-blue-400',
  [POST_STATUS.PUBLISHING]:     'border-blue-400',
  [POST_STATUS.PUBLISHED]:      'border-green-400',
  [POST_STATUS.FAILED]:         'border-red-400',
}

const APPROVED_STATUSES = new Set([
  POST_STATUS.APPROVED, POST_STATUS.SCHEDULED,
  POST_STATUS.PUBLISHING, POST_STATUS.PUBLISHED,
])

const ACTION_LABELS = {
  submitted: 'submitted for review',
  approved:  'approved',
  rejected:  'rejected',
  recalled:  'recalled',
}

function filterPosts(posts, filter) {
  if (filter === POST_STATUS.NEEDS_APPROVAL) return posts.filter((p) => p.status === POST_STATUS.NEEDS_APPROVAL)
  if (filter === POST_STATUS.APPROVED)       return posts.filter((p) => APPROVED_STATUSES.has(p.status))
  return posts
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// PostListItem
// ---------------------------------------------------------------------------

function PostListItem({ post, isSelected, isChecked, onSelect, onCheck }) {
  const platforms = [...new Set((post.targets ?? []).map((t) => t.platform))]

  return (
    <div
      onClick={() => onSelect(post.id)}
      className={cn(
        'cursor-pointer border-l-4 px-4 py-3 transition-colors',
        isSelected
          ? 'border-blue-500 bg-blue-50/30 ring-inset ring-1 ring-blue-200'
          : `${BORDER_COLORS[post.status] ?? 'border-transparent'} hover:bg-gray-50`
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => { e.stopPropagation(); onCheck(post.id, e.target.checked) }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 accent-gray-900"
        />
        <div className="min-w-0 flex-1">
          {/* Platform badges */}
          {platforms.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {platforms.map((p) => <Badge key={p} platform={p} />)}
            </div>
          )}
          {/* Content preview */}
          <p className="text-sm leading-snug text-gray-800">
            {truncate(post.originalContent, 60)}
          </p>
          {/* Status + schedule */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge status={post.status} />
            {post.scheduledAt && (
              <span className="text-xs text-gray-400">{formatDateTime(post.scheduledAt)}</span>
            )}
          </div>
          {/* Requestor */}
          <p className="mt-1 text-xs text-gray-400">
            {post.createdBy?.name} · {formatRelative(post.createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PostDetail
// ---------------------------------------------------------------------------

function PostDetail({ post, loading, onApprove, onReject }) {
  const [comment, setComment] = useState('')
  const [confirmAction, setConfirmAction] = useState(null) // null | 'approve' | 'reject'
  const [acting, setActing] = useState(false)

  useEffect(() => {
    setComment('')
    setConfirmAction(null)
    setActing(false)
  }, [post?.id])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center p-6">
        <EmptyState
          icon={CheckSquare}
          title="Select a post to review"
          description="Click a post in the list to see its details and take action."
        />
      </div>
    )
  }

  const canAct = post.status === POST_STATUS.NEEDS_APPROVAL
  const platforms = [...new Set((post.targets ?? []).map((t) => t.platform))]

  const auditLog = [...(post.approvalLog ?? [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )

  async function handleConfirm() {
    if (!confirmAction || acting) return
    setActing(true)
    try {
      await (confirmAction === 'approve'
        ? onApprove(post.id, comment)
        : onReject(post.id, comment))
    } finally {
      setActing(false)
      setConfirmAction(null)
    }
  }

  return (
    <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200 my-5 mx-4">
      {/* Header */}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {platforms.map((p) => <Badge key={p} platform={p} />)}
          <Badge status={post.status} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Requested by{' '}
          <span className="font-medium text-gray-700">{post.createdBy?.name}</span>
          {' · '}{formatRelative(post.createdAt)}
        </p>
      </div>

      {/* Adapted content per target */}
      {(post.targets ?? []).length > 0 && (
        <div className="space-y-4 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Adapted content
          </h3>
          {post.targets.map((target) => {
            const hasTitle = PLATFORM_CONSTRAINTS[target.platform]?.hasTitle
            const colors = PLATFORM_COLORS[target.platform] ?? {}
            return (
              <div key={target.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge platform={target.platform} />
                  <span className="text-xs text-gray-500">
                    {target.socialProfile?.displayName ?? target.socialProfileId}
                  </span>
                </div>
                {hasTitle && target.adaptedTitle && (
                  <p className="text-sm font-medium text-gray-900">{target.adaptedTitle}</p>
                )}
                <div className={cn('rounded-lg p-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap', colors.bg ?? 'bg-gray-50')}>
                  {target.adaptedContent ?? (
                    <span className="italic text-gray-400">No adapted content</span>
                  )}
                </div>
                {target.failureReason && (
                  <p className="text-xs text-red-600">Failed: {target.failureReason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Original content */}
      <div className="p-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Original
        </h3>
        <div className="rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
          {post.originalContent}
        </div>
      </div>

      {/* Comment + actions */}
      {canAct && (
        <div className="space-y-3 p-5">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment (optional)"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />

          {confirmAction ? (
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-gray-700">
                {confirmAction === 'approve' ? 'Approve this post?' : 'Reject this post?'}
              </span>
              <Button
                size="sm"
                variant={confirmAction === 'approve' ? 'primary' : 'danger'}
                onClick={handleConfirm}
                loading={acting}
                disabled={acting}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAction(null)} disabled={acting}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setConfirmAction('reject')}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="border-green-200 text-green-700 hover:bg-green-50"
                onClick={() => setConfirmAction('approve')}
              >
                Approve
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Audit trail */}
      {auditLog.length > 0 && (
        <div className="p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Activity
          </h3>
          {auditLog.map((entry, i) => (
            <div key={entry.id} className="flex gap-3">
              {/* Avatar + connecting line */}
              <div className="flex flex-col items-center">
                <Avatar name={entry.actorName} size="sm" />
                {i < auditLog.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-gray-200 mb-1" />
                )}
              </div>
              {/* Content */}
              <div className={cn('min-w-0 flex-1 pt-0.5', i < auditLog.length - 1 ? 'pb-5' : 'pb-0')}>
                <p className="text-sm text-gray-800">
                  <span className="font-medium">{entry.actorName}</span>{' '}
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                {entry.comment && (
                  <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 text-sm text-gray-500">
                    "{entry.comment}"
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">{formatRelative(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalsPage() {
  const { selectedClientId, setPendingApprovalCount } = useClient()
  const { addToast } = useToast()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState(POST_STATUS.NEEDS_APPROVAL)
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [bulkProgress, setBulkProgress] = useState(null)

  useEffect(() => {
    document.title = 'Approvals — SocialHub'
  }, [])

  // Load all posts for this client
  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    setLoadError(null)
    getPosts(selectedClientId)
      .then(({ data }) => setPosts(data))
      .catch((err) => setLoadError(err.message ?? 'Failed to load posts'))
      .finally(() => setLoading(false))
  }, [selectedClientId])

  // Load full post detail (including approvalLog) when selection changes
  useEffect(() => {
    if (!selectedPostId) { setSelectedPost(null); return }
    setDetailLoading(true)
    getPost(selectedPostId)
      .then(({ data }) => setSelectedPost(data))
      .catch(() => setSelectedPost(null))
      .finally(() => setDetailLoading(false))
  }, [selectedPostId])

  // Keep sidebar badge in sync
  useEffect(() => {
    const count = posts.filter((p) => p.status === POST_STATUS.NEEDS_APPROVAL).length
    setPendingApprovalCount(count)
  }, [posts, setPendingApprovalCount])

  function applyPostUpdate(updated) {
    setPosts((prev) =>
      prev.map((p) => p.id === updated.id ? { ...p, status: updated.status, updatedAt: updated.updatedAt } : p)
    )
    setSelectedPost(updated)
  }

  async function handleApprove(postId, comment) {
    const { data } = await approvePost(postId, { comment: comment || undefined })
    applyPostUpdate(data)
    addToast('Post approved', 'success')
  }

  async function handleReject(postId, comment) {
    const { data } = await rejectPost(postId, { comment: comment || undefined })
    applyPostUpdate(data)
    addToast('Post rejected', 'info')
  }

  function handleCheck(postId, checked) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(postId) : next.delete(postId)
      return next
    })
  }

  async function handleBulkAction(action) {
    const ids = [...checkedIds]
    for (let i = 0; i < ids.length; i++) {
      setBulkProgress(`${action === 'approve' ? 'Approving' : 'Rejecting'} ${i + 1} of ${ids.length}…`)
      try {
        const { data } = await (action === 'approve'
          ? approvePost(ids[i], {})
          : rejectPost(ids[i], {}))
        setPosts((prev) =>
          prev.map((p) => p.id === data.id ? { ...p, status: data.status } : p)
        )
        if (selectedPostId === data.id) setSelectedPost(data)
      } catch {
        // continue on individual failure
      }
      if (i < ids.length - 1) await delay(200)
    }
    setBulkProgress(null)
    setCheckedIds(new Set())
    addToast(
      `${ids.length} post${ids.length !== 1 ? 's' : ''} ${action === 'approve' ? 'approved' : 'rejected'}`,
      'success'
    )
  }

  const filteredPosts = filterPosts(posts, filter)
  const needsApprovalCount = posts.filter((p) => p.status === POST_STATUS.NEEDS_APPROVAL).length

  const TABS = [
    { key: POST_STATUS.NEEDS_APPROVAL, label: 'Needs approval', count: needsApprovalCount },
    { key: POST_STATUS.APPROVED,       label: 'Approved',       count: null },
    { key: 'all',                      label: 'All',            count: null },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left panel — post list ── */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 pt-5 pb-3">
          <h1 className="text-lg font-bold text-gray-900">Approvals</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex shrink-0 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-colors',
                filter === tab.key
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk action bar — sticky, shown when 1+ checked */}
        {checkedIds.size > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
              {bulkProgress ?? `${checkedIds.size} selected`}
            </span>
            {!bulkProgress && (
              <>
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="shrink-0 rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  Approve all
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Reject all
                </button>
              </>
            )}
          </div>
        )}

        {/* Post list */}
        <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : loadError ? (
            <div className="flex h-48 items-center justify-center px-4 text-center">
              <EmptyState
                icon={AlertCircle}
                title="Failed to load posts"
                description={loadError}
              />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex h-48 items-center justify-center px-4">
              <EmptyState
                icon={CheckSquare}
                title={filter === POST_STATUS.NEEDS_APPROVAL ? 'All caught up' : 'Nothing here'}
                description={
                  filter === POST_STATUS.NEEDS_APPROVAL
                    ? 'No posts awaiting approval.'
                    : 'Nothing to show in this view.'
                }
              />
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostListItem
                key={post.id}
                post={post}
                isSelected={post.id === selectedPostId}
                isChecked={checkedIds.has(post.id)}
                onSelect={setSelectedPostId}
                onCheck={handleCheck}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel — post detail ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-2xl">
          <PostDetail
            post={selectedPost}
            loading={detailLoading}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      </div>
    </div>
  )
}
