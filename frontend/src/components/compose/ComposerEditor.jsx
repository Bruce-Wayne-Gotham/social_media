'use client'

export default function ComposerEditor({ content, onChange }) {
  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your content here..."
        rows={5}
        className="w-full min-h-32 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
      />
      <p className="mt-1 text-right text-sm text-gray-400">{content.length} chars</p>
    </div>
  )
}
