import { cn } from '@/lib/utils'

const paddingClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export default function Card({ children, className, padding = 'md' }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}
