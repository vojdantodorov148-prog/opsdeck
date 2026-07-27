export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
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
      {!compact && <span className="font-semibold tracking-tight text-[17px]">OPS DECK</span>}
    </div>
  )
}
