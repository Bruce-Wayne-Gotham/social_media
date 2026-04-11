'use client'

import { cn } from '@/lib/utils'

export default function ScheduleSection({
  scheduleMode,
  scheduledAt,
  onModeChange,
  onDateChange,
  error,
}) {
  const minDatetime = new Date(Date.now() + 60000).toISOString().slice(0, 16)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
      <div className="flex overflow-hidden rounded-lg border border-gray-200 w-fit">
        <button
          type="button"
          onClick={() => onModeChange('now')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            scheduleMode === 'now'
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          Post now
        </button>
        <button
          type="button"
          onClick={() => onModeChange('later')}
          className={cn(
            'border-l border-gray-200 px-4 py-2 text-sm font-medium transition-colors',
            scheduleMode === 'later'
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          Schedule for later
        </button>
      </div>

      {scheduleMode === 'later' && (
        <div className="mt-2">
          <input
            type="datetime-local"
            value={scheduledAt ?? ''}
            min={minDatetime}
            onChange={(e) => onDateChange(e.target.value || null)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
