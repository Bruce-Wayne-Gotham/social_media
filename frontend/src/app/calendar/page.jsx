'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  isToday, addMonths, subMonths, addWeeks, subWeeks,
  parseISO,
} from 'date-fns'

import { useClient } from '@/lib/client-context'
import { getCalendarPosts } from '@/lib/api'
import { truncate, formatDateTime } from '@/lib/utils'
import { POST_STATUS } from '@/constants'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_COLORS = {
  [POST_STATUS.DRAFT]:          'bg-gray-300',
  [POST_STATUS.NEEDS_APPROVAL]: 'bg-amber-400',
  [POST_STATUS.APPROVED]:       'bg-blue-300',
  [POST_STATUS.SCHEDULED]:      'bg-blue-500',
  [POST_STATUS.PUBLISHING]:     'bg-blue-500',
  [POST_STATUS.PUBLISHED]:      'bg-green-500',
  [POST_STATUS.FAILED]:         'bg-red-500',
}

const LEGEND = [
  { label: 'Draft',          dot: 'bg-gray-300' },
  { label: 'Needs approval', dot: 'bg-amber-400' },
  { label: 'Scheduled',      dot: 'bg-blue-500' },
  { label: 'Published',      dot: 'bg-green-500' },
  { label: 'Failed',         dot: 'bg-red-500' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getViewRange(view, anchor) {
  if (view === 'month') {
    const monthStart = startOfMonth(anchor)
    const monthEnd   = endOfMonth(anchor)
    const from = startOfWeek(monthStart, { weekStartsOn: 1 })
    const to   = endOfWeek(monthEnd,   { weekStartsOn: 1 })
    return { from, to, days: eachDayOfInterval({ start: from, end: to }) }
  }
  const from = startOfWeek(anchor, { weekStartsOn: 1 })
  const to   = endOfWeek(anchor,   { weekStartsOn: 1 })
  return { from, to, days: eachDayOfInterval({ start: from, end: to }) }
}

function postsForDay(posts, day) {
  return posts.filter((p) => p.scheduledAt && isSameDay(parseISO(p.scheduledAt), day))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const { selectedClientId } = useClient()
  const router = useRouter()
  const [view, setView]               = useState('month')
  const [anchor, setAnchor]           = useState(() => new Date())
  const [posts, setPosts]             = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)   // month view popover
  const [selectedPost, setSelectedPost] = useState(null) // week view slide-over
  const popoverRef = useRef(null)

  const { from, to, days } = useMemo(
    () => getViewRange(view, anchor),
    [view, anchor]
  )

  useEffect(() => {
    document.title = 'Calendar — SocialHub'
  }, [])

  // Fetch calendar posts whenever client or visible range changes
  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    setError(null)
    setSelectedDay(null)
    setSelectedPost(null)
    getCalendarPosts(selectedClientId, from.toISOString(), to.toISOString())
      .then(({ data }) => setPosts(data))
      .catch((err) => setError(err.message ?? 'Failed to load calendar'))
      .finally(() => setLoading(false))
  }, [selectedClientId, from.toISOString(), to.toISOString()])

  // Close day popover when clicking outside
  useEffect(() => {
    if (!selectedDay) return
    function onMouseDown(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setSelectedDay(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [selectedDay])

  function prev() {
    setAnchor((d) => view === 'month' ? subMonths(d, 1) : subWeeks(d, 1))
  }

  function next() {
    setAnchor((d) => view === 'month' ? addMonths(d, 1) : addWeeks(d, 1))
  }

  function handleDayClick(day, dayPosts) {
    if (dayPosts.length === 0) return
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))
  }

  const periodLabel = view === 'month'
    ? format(anchor, 'MMMM yyyy')
    : `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`

  return (
    <div className="p-6 min-h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
          <p className="mt-0.5 text-sm text-gray-500">{periodLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / Week toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['month', 'week'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors
                  ${v !== 'month' ? 'border-l border-gray-200' : ''}
                  ${view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Prev / Today / Next */}
          <button
            onClick={prev}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={next}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {view === 'month' ? (
          <MonthView
            days={days}
            posts={posts}
            anchor={anchor}
            loading={loading}
            selectedDay={selectedDay}
            onDayClick={handleDayClick}
            popoverRef={popoverRef}
          />
        ) : (
          <WeekView
            days={days}
            posts={posts}
            loading={loading}
            selectedPost={selectedPost}
            onPostClick={(p) => setSelectedPost((prev) => prev?.id === p.id ? null : p)}
          />
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {LEGEND.map(({ label, dot }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loading && !error && posts.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No posts scheduled"
          description="Posts you schedule will appear on the calendar."
          action={{ label: 'Compose a post', onClick: () => router.push('/compose') }}
        />
      )}

      {/* ── Week slide-over ────────────────────────────────────────────── */}
      {selectedPost && view === 'week' && (
        <PostSlideOver post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthView({ days, posts, anchor, loading, selectedDay, onDayClick, popoverRef }) {
  const monthStart = startOfMonth(anchor)

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayPosts = postsForDay(posts, day)
          const inMonth  = isSameMonth(day, monthStart)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const todayDate  = isToday(day)
          const visible    = dayPosts.slice(0, 3)
          const overflow   = dayPosts.length - 3
          const isLastCol  = (i + 1) % 7 === 0
          const isLastRow  = i >= days.length - 7

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day, dayPosts)}
              className={[
                'relative min-h-[96px] p-2 border-b border-r border-gray-100 transition-colors',
                isLastCol  ? 'border-r-0' : '',
                isLastRow  ? 'border-b-0' : '',
                !inMonth   ? 'bg-gray-50' : 'bg-white',
                isSelected ? 'bg-blue-50' : '',
                dayPosts.length > 0 ? 'cursor-pointer hover:bg-blue-50/50' : '',
              ].join(' ')}
            >
              {/* Day number */}
              <div className="flex justify-end">
                <span
                  className={[
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    todayDate  ? 'bg-blue-500 text-white' :
                    inMonth    ? 'text-gray-700' : 'text-gray-400',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Dots / skeleton */}
              <div className="mt-1 flex flex-wrap items-center gap-0.5">
                {loading ? (
                  <>
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </>
                ) : (
                  <>
                    {visible.map((p) => (
                      <span
                        key={p.id}
                        className={`inline-block h-2 w-2 rounded-full ${DOT_COLORS[p.status] ?? 'bg-gray-300'}`}
                      />
                    ))}
                    {overflow > 0 && (
                      <span className="text-xs text-gray-400">+{overflow} more</span>
                    )}
                  </>
                )}
              </div>

              {/* Day popover */}
              {isSelected && dayPosts.length > 0 && (
                <DayPopover day={day} posts={dayPosts} popoverRef={popoverRef} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day popover (month view)
// ---------------------------------------------------------------------------

function DayPopover({ day, posts, popoverRef }) {
  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
    >
      <p className="mb-2 text-xs font-semibold text-gray-700">
        {format(day, 'EEEE, MMMM d')}
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {posts.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-100 p-2">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {(p.platforms ?? []).map((pl) => (
                <Badge key={pl} platform={pl} />
              ))}
              <Badge status={p.status} />
            </div>
            <p className="text-xs text-gray-600">{truncate(p.originalContent, 80)}</p>
            {p.scheduledAt && (
              <p className="mt-1 text-xs text-gray-400">{formatDateTime(p.scheduledAt)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function WeekView({ days, posts, loading, selectedPost, onPostClick }) {
  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`border-r border-gray-100 last:border-r-0 py-2 text-center
              ${isToday(day) ? 'bg-blue-50' : ''}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {format(day, 'EEE')}
            </p>
            <p className={`mt-0.5 text-sm font-semibold
              ${isToday(day) ? 'text-blue-600' : 'text-gray-800'}`}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day) => {
          const dayPosts = postsForDay(posts, day)
          return (
            <div
              key={day.toISOString()}
              className={`border-r border-gray-100 last:border-r-0 p-1.5 space-y-1.5
                ${isToday(day) ? 'bg-blue-50/30' : ''}`}
            >
              {loading
                ? [1, 2].map((j) => <Skeleton key={j} className="h-16 w-full rounded-lg" />)
                : dayPosts.map((p) => (
                    <WeekPostCard
                      key={p.id}
                      post={p}
                      active={selectedPost?.id === p.id}
                      onClick={() => onPostClick(p)}
                    />
                  ))
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekPostCard({ post, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-1.5 transition-colors
        ${active
          ? 'border-blue-300 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }`}
    >
      {/* Platform badges — tiny variant via className override */}
      <div className="mb-1 flex flex-wrap gap-0.5">
        {(post.platforms ?? []).map((pl) => (
          <Badge key={pl} platform={pl} className="px-1.5 py-0 text-[10px]" />
        ))}
      </div>
      <Badge status={post.status} className="px-1.5 py-0 text-[10px]" />
      {post.scheduledAt && (
        <p className="mt-0.5 text-[10px] text-gray-400">
          {format(parseISO(post.scheduledAt), 'h:mm a')}
        </p>
      )}
      <p className="mt-0.5 text-[11px] leading-tight text-gray-600">
        {truncate(post.originalContent, 50)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week view slide-over
// ---------------------------------------------------------------------------

function PostSlideOver({ post, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-40 h-full w-80 overflow-y-auto border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Post detail</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* Platforms + status */}
          <div className="flex flex-wrap items-center gap-2">
            {(post.platforms ?? []).map((pl) => (
              <Badge key={pl} platform={pl} />
            ))}
            <Badge status={post.status} />
          </div>

          {/* Scheduled time */}
          {post.scheduledAt && (
            <p className="text-xs text-gray-500">{formatDateTime(post.scheduledAt)}</p>
          )}

          {/* Content */}
          <p className="text-sm leading-relaxed text-gray-700">{post.originalContent}</p>

          {/* Platform targets */}
          {post.targetStatuses && Object.keys(post.targetStatuses).length > 0 && (
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500">Target statuses</p>
              {Object.entries(post.targetStatuses).map(([platform, status]) => (
                <div key={platform} className="flex items-center justify-between">
                  <Badge platform={platform} />
                  <Badge status={status} />
                </div>
              ))}
            </div>
          )}

          {/* Author */}
          {post.createdBy?.name && (
            <p className="text-xs text-gray-400">By {post.createdBy.name}</p>
          )}
        </div>
      </div>
    </>
  )
}
