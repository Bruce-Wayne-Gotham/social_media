'use client'

import { useState } from 'react'
import { Badge, Button } from '@/components/ui'
import { POST_STATUS } from '@/constants'
import { truncate, formatDateTime } from '@/lib/utils'

const DOT_COLORS = {
  [POST_STATUS.DRAFT]:          'bg-gray-300',
  [POST_STATUS.NEEDS_APPROVAL]: 'bg-amber-400',
  [POST_STATUS.APPROVED]:       'bg-blue-400',
  [POST_STATUS.SCHEDULED]:      'bg-blue-400',
  [POST_STATUS.PUBLISHING]:     'bg-blue-400',
  [POST_STATUS.PUBLISHED]:      'bg-green-400',
  [POST_STATUS.FAILED]:         'bg-red-400',
}

export { DOT_COLORS }

export default function PostCard({ post, variant = 'compact', onApprove, onReject }) {
  const [actionLoading, setActionLoading] = useState(null) // 'approve' | 'reject' | null
  const platforms = [...new Set((post.targets ?? []).map((t) => t.platform))]
  const isCompact = variant === 'compact'

  async function handleApprove() {
    setActionLoading('approve')
    try {
      await onApprove(post.id)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject() {
    setActionLoading('reject')
    try {
      await onReject(post.id)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-gray-300 transition-colors">
      {/* Row 1: platforms + status + scheduled time */}
      <div className="flex flex-wrap items-center gap-2">
        {platforms.map((platform) => (
          <Badge key={platform} platform={platform} />
        ))}
        <Badge status={post.status} />
        {post.scheduledAt && (
          <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
            {formatDateTime(post.scheduledAt)}
          </span>
        )}
      </div>

      {/* Row 2: content preview */}
      <p className="mt-2 text-sm text-gray-700">
        {truncate(post.originalContent, 80)}
      </p>

      {/* Row 3: approve / reject (needs_approval only) */}
      {isCompact && post.status === POST_STATUS.NEEDS_APPROVAL && (onApprove || onReject) && (
        <div
          className="mt-3 flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {onApprove && (
            <Button
              variant="secondary"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50"
              onClick={handleApprove}
              loading={actionLoading === 'approve'}
              disabled={actionLoading !== null}
            >
              Approve
            </Button>
          )}
          {onReject && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={actionLoading === 'reject'}
              disabled={actionLoading !== null}
            >
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
