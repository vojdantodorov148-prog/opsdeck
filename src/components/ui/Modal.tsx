import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Modal({
  open, onClose, title, description, children, footer, width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
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
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className={cn('relative w-full bg-surface rounded-3xl border border-line shadow-float animate-fade-in', width)}
      >
        <header className="flex items-start gap-3 px-6 pt-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button className="btn-ghost h-8 w-8 px-0" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <footer className="px-6 py-4 border-t border-line bg-panel/60 rounded-b-3xl">{footer}</footer>}
      </div>
    </div>
  )
}
