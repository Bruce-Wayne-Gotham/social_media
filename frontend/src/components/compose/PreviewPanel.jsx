'use client'

import { useState, useEffect } from 'react'
import { PLATFORM_COLORS } from '@/constants'
import { cn } from '@/lib/utils'
import PlatformPreview from './PlatformPreview'

export default function PreviewPanel({
  selectedPlatforms,
  content,
  profiles,
  selectedProfileIds,
  adaptations = [],
  targetStates = {},
}) {
  const [activeTab, setActiveTab] = useState(selectedPlatforms[0] ?? null)

  useEffect(() => {
    if (selectedPlatforms.length === 0) {
      setActiveTab(null)
    } else if (!selectedPlatforms.includes(activeTab)) {
      setActiveTab(selectedPlatforms[0])
    }
  }, [selectedPlatforms, activeTab])

  if (selectedPlatforms.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <div>
          <p className="text-sm font-medium text-gray-500">No platforms selected</p>
          <p className="mt-1 text-xs text-gray-400">Select a platform on the left to preview your post</p>
        </div>
      </div>
    )
  }

  const activeProfile = activeTab
    ? profiles.find((sp) => sp.id === selectedProfileIds[activeTab])
    : null

  // Compute what content/title to show for the active tab
  const adaptation = adaptations.find((a) => a.platform === activeTab)
  const targetState = adaptation ? targetStates[adaptation.targetId] : null
  const showAdapted = targetState && ['accepted', 'editing'].includes(targetState.state)
  const displayContent = showAdapted ? targetState.content : content
  const displayTitle = showAdapted ? targetState.title : null

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {selectedPlatforms.map((platform) => {
          const isActive = platform === activeTab
          const adaptation = adaptations.find((a) => a.platform === platform)
          const ts = adaptation ? targetStates[adaptation.targetId] : null
          const isAccepted = ts?.state === 'accepted'
          return (
            <button
              key={platform}
              type="button"
              onClick={() => setActiveTab(platform)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5',
                isActive
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {PLATFORM_COLORS[platform].label}
              {isAccepted && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Active preview */}
      {activeTab && (
        <PlatformPreview
          platform={activeTab}
          content={displayContent}
          title={displayTitle}
          profile={activeProfile}
        />
      )}

      {showAdapted && (
        <p className="mt-2 text-center text-xs text-gray-400">Showing adapted content</p>
      )}
    </div>
  )
}
