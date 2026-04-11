import { cn } from '@/lib/utils'

export default function Input({
  label,
  error,
  placeholder,
  value,
  onChange,
  type = 'text',
  disabled = false,
  className,
  id,
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors',
          'focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10',
          disabled && 'cursor-not-allowed bg-gray-50 opacity-60',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-500/10',
          className
        )}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
