'use client'

import { PLATFORM_CONSTRAINTS } from '@/constants'

function TelegramPreview({ content, profile }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-200">
          <span className="text-xs font-bold text-sky-700">T</span>
        </div>
        <span className="text-sm font-semibold text-sky-900">
          {profile?.displayName ?? 'Telegram channel'}
        </span>
      </div>
      <div className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
        {content || <span className="text-gray-400">Your message will appear here…</span>}
      </div>
      <p className="mt-2 text-right text-xs text-sky-400">
        {content.length} / {PLATFORM_CONSTRAINTS.telegram.maxContent}
      </p>
    </div>
  )
}

function RedditPreview({ content, title, profile }) {
  const subreddit = profile?.providerMeta?.subreddit ?? 'r/subreddit'
  const displayTitle = title || (content ? content.slice(0, 100) : null)
  return (
    <div className="rounded-xl border border-orange-100 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
          {subreddit}
        </span>
        <span className="text-xs text-gray-400">· Posted by u/you</span>
      </div>
      <p className="mb-2 text-base font-semibold text-gray-900">
        {displayTitle ?? <span className="font-normal text-gray-400">Post title will appear here…</span>}
      </p>
      <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
        {content || <span className="text-gray-400">Post body here…</span>}
      </p>
      <div className="mt-3 flex gap-4 text-xs text-gray-400">
        <span>▲ 0 upvotes</span>
        <span>💬 0 comments</span>
        <span>↗ Share</span>
      </div>
    </div>
  )
}

function YouTubePreview({ content, title, profile }) {
  const displayTitle = title || (content ? content.slice(0, 100) : null)
  return (
    <div className="overflow-hidden rounded-xl border border-red-100 bg-white">
      <div className="flex h-32 items-center justify-center bg-gray-100">
        <span className="text-4xl text-gray-300">▶</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {displayTitle ?? <span className="font-normal text-gray-400">Video title here…</span>}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
            <span className="text-xs text-red-600">YT</span>
          </div>
          <span className="text-xs text-gray-500">
            {profile?.displayName ?? 'YouTube channel'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 line-clamp-3 whitespace-pre-wrap">
          {content || <span className="text-gray-400">Video description will appear here…</span>}
        </p>
      </div>
    </div>
  )
}

function PinterestPreview({ content, title, profile }) {
  const boardName = profile?.providerMeta?.boardName ?? 'Board'
  const displayTitle = title || (content ? content.slice(0, 100) : null)
  return (
    <div className="mx-auto w-48 overflow-hidden rounded-xl border border-pink-100 bg-white">
      <div className="flex aspect-square items-center justify-center bg-gray-100">
        <span className="text-3xl text-gray-300">📌</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2 mb-1">
          {displayTitle ?? <span className="font-normal text-gray-400">Pin title…</span>}
        </p>
        <p className="text-xs leading-relaxed text-gray-600 line-clamp-2 whitespace-pre-wrap">
          {content || <span className="text-gray-400">Description here…</span>}
        </p>
        <p className="mt-2 text-xs font-medium text-pink-500">{boardName}</p>
      </div>
    </div>
  )
}

export default function PlatformPreview({ platform, content, title, profile }) {
  switch (platform) {
    case 'telegram':  return <TelegramPreview content={content} profile={profile} />
    case 'reddit':    return <RedditPreview content={content} title={title} profile={profile} />
    case 'youtube':   return <YouTubePreview content={content} title={title} profile={profile} />
    case 'pinterest': return <PinterestPreview content={content} title={title} profile={profile} />
    default:          return null
  }
}
