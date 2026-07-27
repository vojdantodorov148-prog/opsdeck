import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Drawer({
  open, onClose, title, subtitle, children, footer, width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/15 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <aside
        role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        className={cn('relative h-full w-full bg-surface border-l border-line shadow-float flex flex-col animate-slide-in', width)}
      >
        <header className="flex items-start gap-3 px-6 py-5 border-b border-line">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft truncate">{subtitle}</p>}
          </div>
          <button className="btn-ghost h-8 w-8 px-0" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-6 py-4 bg-panel/60">{footer}</footer>}
      </aside>
    </div>
  )
}
