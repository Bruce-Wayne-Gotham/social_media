import { cn } from '@/lib/utils'
import { STATUS_COLORS, PLATFORM_COLORS } from '@/constants'

export default function Badge({ status, platform, label, className }) {
  let colors = { text: 'text-gray-600', bg: 'bg-gray-100' }
  let displayLabel = label

  if (status && STATUS_COLORS[status]) {
    colors = STATUS_COLORS[status]
    displayLabel = displayLabel ?? STATUS_COLORS[status].label
  } else if (platform && PLATFORM_COLORS[platform]) {
    colors = PLATFORM_COLORS[platform]
    displayLabel = displayLabel ?? PLATFORM_COLORS[platform].label
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors.bg,
        colors.text,
        className
      )}
    >
      {displayLabel}
    </span>
  )
}
