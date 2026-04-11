'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
  parseISO,
} from 'date-fns'
import { CheckSquare, Activity } from 'lucide-react'
import { useClient } from '@/lib/client-context'
import {
  getClientStats,
  getPosts,
  getCalendarPosts,
  getRecentActivity,
  approvePost,
  rejectPost,
} from '@/lib/api'
import { Button, Skeleton, EmptyState, Avatar } from '@/components/ui'
import PostCard, { DOT_COLORS } from '@/components/posts/PostCard'
import { POST_STATUS } from '@/constants'
import { formatDate, formatRelative } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString()
}

function StatCard({ label, value, highlight }) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { selectedClient, selectedClientId, clients } = useClient()
  const router = useRouter()

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // ---- state ----
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)

  const [approvalPosts, setApprovalPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)

  const [calendarPosts, setCalendarPosts] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(true)

  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)

  // ---- load ----
  const loadData = useCallback(async (clientId) => {
    setStatsLoading(true)
    setPostsLoading(true)
    setCalendarLoading(true)
    setActivityLoading(true)
    setStatsError(null)

    const from = weekStart.toISOString()
    const to = weekEnd.toISOString()

    const [statsRes, postsRes, calRes, actRes] = await Promise.allSettled([
      getClientStats(clientId),
      getPosts(clientId, { status: POST_STATUS.NEEDS_APPROVAL }),
      getCalendarPosts(clientId, from, to),
      getRecentActivity(clientId, 5),
    ])

    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
    else setStatsError(statsRes.reason?.message ?? 'Failed to load stats')
    setStatsLoading(false)

    if (postsRes.status === 'fulfilled') setApprovalPosts(postsRes.value.data)
    setPostsLoading(false)

    if (calRes.status === 'fulfilled') setCalendarPosts(calRes.value.data)
    setCalendarLoading(false)

    if (actRes.status === 'fulfilled') setActivity(actRes.value.data)
    setActivityLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.title = selectedClient
      ? `${selectedClient.name} — SocialHub`
      : 'Overview — SocialHub'
  }, [selectedClient])

  useEffect(() => {
    if (selectedClientId) loadData(selectedClientId)
  }, [selectedClientId, loadData])

  // ---- approval actions ----
  async function handleApprove(postId) {
    await approvePost(postId)
    setApprovalPosts((prev) => prev.filter((p) => p.id !== postId))
    if (stats) setStats((s) => ({ ...s, pendingApprovals: Math.max(0, s.pendingApprovals - 1) }))
  }

  async function handleReject(postId) {
    await rejectPost(postId)
    setApprovalPosts((prev) => prev.filter((p) => p.id !== postId))
    if (stats) setStats((s) => ({ ...s, pendingApprovals: Math.max(0, s.pendingApprovals - 1) }))
  }

  // ---- calendar helpers ----
  function postsForDay(day) {
    return calendarPosts.filter(
      (p) => p.scheduledAt && isSameDay(parseISO(p.scheduledAt), day)
    )
  }

  // ---- no client yet ----
  // clients.length === 0 means they haven't loaded yet — show skeletons, not an error
  if (!selectedClientId && clients.length > 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Select a client to view the dashboard.</p>
      </div>
    )
  }

  const visibleApprovals = approvalPosts.slice(0, 3)
  const hasMoreApprovals = approvalPosts.length > 3

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* ── 1. Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedClient ? `${selectedClient.name} — Overview` : 'Overview'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Today is {formatDate(todayISO())}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => router.push('/compose')}>
          New post
        </Button>
      </div>

      {/* ── 2. Stats row ── */}
      <section>
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : statsError ? (
          <p className="text-sm text-red-600">{statsError}</p>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Posts this week" value={stats.postsThisWeek} />
            <StatCard
              label="Pending approvals"
              value={stats.pendingApprovals}
              highlight={stats.pendingApprovals > 0}
            />
            <StatCard label="Scheduled upcoming" value={stats.scheduledUpcoming} />
            <StatCard label="Published this month" value={stats.publishedThisMonth} />
          </div>
        ) : null}
      </section>

      {/* ── 3. Needs approval ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Needs approval{approvalPosts.length > 0 ? ` (${approvalPosts.length})` : ''}
          </h2>
          {hasMoreApprovals && (
            <Link
              href="/approvals"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              View all {approvalPosts.length} posts →
            </Link>
          )}
        </div>

        {postsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : approvalPosts.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="All caught up."
            description="Nothing needs approval."
          />
        ) : (
          <div className="space-y-3">
            {visibleApprovals.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="compact"
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Calendar strip ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">This week</h2>
        {calendarLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayPosts = postsForDay(day)
              const isToday = isSameDay(day, today)
              return (
                <button
                  key={day.toISOString()}
                  className={`flex flex-col items-center rounded-xl border p-2 cursor-pointer hover:border-gray-300 transition-colors ${
                    isToday
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                  onClick={() =>
                    router.push(`/calendar?date=${format(day, 'yyyy-MM-dd')}`)
                  }
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-gray-300' : 'text-gray-400'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-white' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                      {dayPosts.slice(0, 4).map((p) => (
                        <span
                          key={p.id}
                          className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[p.status] ?? 'bg-gray-300'}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 5. Recent activity ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent activity</h2>
        {activityLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Actions on posts will appear here."
          />
        ) : (
          <div className="space-y-3">
            {activity.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <Avatar name={entry.actorName} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">{entry.actorName}</span>{' '}
                    {entry.action} the post
                  </span>
                  {entry.postContent && (
                    <p className="text-xs text-gray-400 truncate">{entry.postContent}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatRelative(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
