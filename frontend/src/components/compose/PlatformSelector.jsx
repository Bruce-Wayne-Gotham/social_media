'use client'

import { PLATFORM, PLATFORM_COLORS } from '@/constants'
import { cn } from '@/lib/utils'

const PLATFORMS = [
  { value: PLATFORM.TELEGRAM,  label: 'Telegram' },
  { value: PLATFORM.REDDIT,    label: 'Reddit' },
  { value: PLATFORM.YOUTUBE,   label: 'YouTube' },
  { value: PLATFORM.PINTEREST, label: 'Pinterest' },
]

export default function PlatformSelector({ selectedPlatforms, onToggle, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Publish to</label>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map(({ value, label }) => {
          const active = selectedPlatforms.includes(value)
          const colors = PLATFORM_COLORS[value]
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? `${colors.bg} ${colors.text} border-transparent`
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}
