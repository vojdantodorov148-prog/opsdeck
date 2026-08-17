import { useEffect, useState } from 'react'

export function Logo({ compact = false, url }: { compact?: boolean; url?: string | null }) {
  const candidate = url || import.meta.env.VITE_LOGO_URL || '/logo.png'
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [candidate])

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {!imageFailed ? (
        <img
          src={candidate}
          alt="OPS DECK"
          className="h-9 w-9 shrink-0 rounded-xl object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
          <defs>
            <linearGradient id="od" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3EC7B4" />
              <stop offset="100%" stopColor="#0B7C6D" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#od)" />
          <circle cx="16" cy="16" r="6.5" fill="#F7FAFA" />
          <path d="M16 2a14 14 0 0 1 12.1 7L22 12.5A7 7 0 0 0 16 9Z" fill="#ffffff" opacity=".55" />
        </svg>
      )}
      {!compact && <span className="truncate font-semibold tracking-tight text-[17px]">OPS DECK</span>}
    </div>
  )
}
