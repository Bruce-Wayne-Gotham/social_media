import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(iso) {
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function formatDateTime(iso) {
  return format(parseISO(iso), "MMM d, yyyy 'at' h:mm a")
}

export function formatRelative(iso) {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true })
}

export function truncate(str, n) {
  if (!str || str.length <= n) return str
  return str.slice(0, n) + '...'
}

export function getInitials(name) {
  if (!name) return ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function pluralize(count, word) {
  return `${count} ${count === 1 ? word : word + 's'}`
}
