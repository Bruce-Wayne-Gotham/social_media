'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { PLATFORM_COLORS, PLATFORM_CONSTRAINTS } from '@/constants'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Diff: highlight words in adapted that don't appear in original
// ---------------------------------------------------------------------------

function DiffText({ original, adapted }) {
  const origSet = new Set(
    original
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  )
  const tokens = adapted.split(/(\s+)/)
  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>
        const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '')
        return clean && !origSet.has(clean) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5">{token}</mark>
        ) : (
          <span key={i}>{token}</span>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// State chip
// ---------------------------------------------------------------------------

const STATE_CHIP = {
  suggested: 'bg-gray-100 text-gray-600',
  accepted:  'bg-green-100 text-green-700',
  editing:   'bg-blue-100 text-blue-700',
  reset:     'bg-gray-100 text-gray-500',
}

const STATE_LABEL = {
  suggested: 'Suggested',
  accepted:  'Accepted',
  editing:   'Editing',
  reset:     'Reset',
}

// ---------------------------------------------------------------------------
// Per-platform accordion
// ---------------------------------------------------------------------------

function PlatformAccordion({
  platform,
  adaptation,
  targetState,
  originalContent,
  onStateChange,
  onContentChange,
  titleError,
}) {
  const [expanded, setExpanded] = useState(true)
  const [localTitleError, setLocalTitleError] = useState(null)

  const colors = PLATFORM_COLORS[platform]
  const constraints = PLATFORM_CONSTRAINTS[platform]
  const { state, content, title } = targetState
  const isEditable = state === 'editing'
  const displayContent = state === 'reset' ? originalContent : content
  const displayTitle = state === 'reset' ? null : title

  const shownTitleError = titleError || localTitleError

  function tryAccept() {
    if (constraints.hasTitle && !title?.trim()) {
      setLocalTitleError('Title is required for this platform.')
      return
    }
    setLocalTitleError(null)
    onStateChange('accepted')
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            !expanded && '-rotate-90'
          )}
        />
        <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold', colors.bg, colors.text)}>
          {colors.label}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-gray-500">{adaptation.charCount} chars</span>
          {adaptation.hashtagCount > 0 && (
            <span className="shrink-0 text-xs text-gray-400">{adaptation.hashtagCount} hashtags</span>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            STATE_CHIP[state]
          )}
        >
          {STATE_LABEL[state]}
        </span>
        {state === 'accepted' && <Check className="h-4 w-4 shrink-0 text-green-600" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          {/* Title input — only for platforms that require it */}
          {constraints.hasTitle && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
              <input
                type="text"
                value={displayTitle ?? ''}
                readOnly={!isEditable}
                onChange={(e) => {
                  setLocalTitleError(null)
                  onContentChange(content, e.target.value)
                }}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
                  isEditable
                    ? 'border-gray-300 bg-white focus:border-gray-900 focus:outline-none'
                    : 'cursor-default border-gray-200 bg-gray-50 text-gray-700'
                )}
                placeholder="Enter title…"
              />
              {shownTitleError && (
                <p className="mt-1 text-xs text-red-600">{shownTitleError}</p>
              )}
            </div>
          )}

          {/* Content area */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Content</label>
            {isEditable ? (
              <textarea
                value={displayContent}
                rows={4}
                onChange={(e) => onContentChange(e.target.value, title)}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
            ) : (
              <div
                className={cn(
                  'min-h-16 w-full rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap',
                  state === 'reset'
                    ? 'border-gray-200 bg-gray-50 text-gray-500 italic'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                )}
              >
                {state === 'suggested' ? (
                  <DiffText original={originalContent} adapted={displayContent} />
                ) : (
                  displayContent
                )}
              </div>
            )}
          </div>

          {/* AI notes */}
          {adaptation.notes && (
            <p className="text-xs text-gray-400">Note: {adaptation.notes}</p>
          )}

          {/* Action chips */}
          <div className="flex flex-wrap gap-2">
            {state !== 'accepted' && (
              <button
                type="button"
                onClick={tryAccept}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
              >
                Accept
              </button>
            )}
            {state === 'suggested' && (
              <button
                type="button"
                onClick={() => onStateChange('editing')}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Edit
              </button>
            )}
            {state !== 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setLocalTitleError(null)
                  onStateChange('reset')
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                Reset to original
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function AdaptationPanel({
  originalContent,
  adaptations,
  targetStates,
  onStateChange,
  onContentChange,
  titleErrors = {},
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">AI Suggestions</h3>
      {adaptations.map((adaptation) => {
        const ts = targetStates[adaptation.targetId]
        if (!ts) return null
        return (
          <PlatformAccordion
            key={adaptation.targetId}
            platform={adaptation.platform}
            adaptation={adaptation}
            targetState={ts}
            originalContent={originalContent}
            onStateChange={(newState) => onStateChange(adaptation.targetId, newState)}
            onContentChange={(content, title) =>
              onContentChange(adaptation.targetId, content, title)
            }
            titleError={titleErrors[adaptation.targetId] ?? null}
          />
        )
      })}
    </div>
  )
}
