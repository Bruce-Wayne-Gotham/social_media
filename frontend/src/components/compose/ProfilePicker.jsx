'use client'

import Link from 'next/link'
import { PLATFORM_COLORS } from '@/constants'

export default function ProfilePicker({
  selectedPlatforms,
  profiles,
  selectedProfileIds,
  onProfileSelect,
  clientId,
}) {
  if (selectedPlatforms.length === 0) return null

  return (
    <div className="space-y-3">
      {selectedPlatforms.map((platform) => {
        const platformProfiles = profiles.filter(
          (sp) => sp.platform === platform && sp.isConnected
        )
        const colors = PLATFORM_COLORS[platform]
        const selectedId = selectedProfileIds[platform] ?? ''
        const selectedProfile = platformProfiles.find((sp) => sp.id === selectedId)

        return (
          <div key={platform}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {colors.label} account
            </label>

            {platformProfiles.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                No connected accounts.{' '}
                <Link
                  href={`/clients/${clientId}/settings`}
                  className="font-medium text-gray-900 underline hover:no-underline"
                >
                  Connect {colors.label} →
                </Link>
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => onProfileSelect(platform, e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select account…</option>
                {platformProfiles.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.displayName}
                  </option>
                ))}
              </select>
            )}

            {platform === 'reddit' && selectedProfile?.providerMeta?.subreddit && (
              <p className="mt-1 text-xs text-gray-500">
                Posting to {selectedProfile.providerMeta.subreddit}
              </p>
            )}
            {platform === 'pinterest' && selectedProfile?.providerMeta?.boardName && (
              <p className="mt-1 text-xs text-gray-500">
                Board: {selectedProfile.providerMeta.boardName}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
