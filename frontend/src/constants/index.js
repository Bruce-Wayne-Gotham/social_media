export const POST_STATUS = {
  DRAFT: 'draft',
  NEEDS_APPROVAL: 'needs_approval',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
}

export const PLATFORM = {
  TELEGRAM: 'telegram',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PINTEREST: 'pinterest',
}

export const ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  CLIENT_APPROVER: 'client_approver',
}

export const STATUS_COLORS = {
  draft:          { text: 'text-gray-600',   bg: 'bg-gray-100',   label: 'Draft' },
  needs_approval: { text: 'text-amber-700',  bg: 'bg-amber-100',  label: 'Needs approval' },
  approved:       { text: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Approved' },
  scheduled:      { text: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Scheduled' },
  publishing:     { text: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Publishing' },
  published:      { text: 'text-green-700',  bg: 'bg-green-100',  label: 'Published' },
  failed:         { text: 'text-red-700',    bg: 'bg-red-100',    label: 'Failed' },
}

export const PLATFORM_COLORS = {
  telegram:  { text: 'text-sky-700',    bg: 'bg-sky-50',    label: 'Telegram' },
  reddit:    { text: 'text-orange-700', bg: 'bg-orange-50', label: 'Reddit' },
  youtube:   { text: 'text-red-700',    bg: 'bg-red-50',    label: 'YouTube' },
  pinterest: { text: 'text-pink-700',   bg: 'bg-pink-50',   label: 'Pinterest' },
}

export const PLATFORM_CONSTRAINTS = {
  telegram:  { hasTitle: false, maxContent: 4096,  maxHashtags: 3 },
  reddit:    { hasTitle: true,  maxContent: 40000, maxHashtags: 0 },
  youtube:   { hasTitle: true,  maxContent: 5000,  maxHashtags: 5 },
  pinterest: { hasTitle: true,  maxContent: 500,   maxHashtags: 5 },
}
