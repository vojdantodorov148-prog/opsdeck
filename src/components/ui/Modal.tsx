import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Modal({
  open, onClose, title, description, children, footer, width = 'max-w-lg', fullscreen = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  fullscreen?: boolean
}) {
  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={cn('fixed inset-0 z-50 grid place-items-center', fullscreen ? 'p-0' : 'p-4')}>
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className={cn(
          'relative w-full bg-surface border border-line shadow-float animate-fade-in',
          fullscreen
            ? 'h-[100dvh] max-w-none rounded-none border-0 flex flex-col'
            : `rounded-3xl ${width}`,
        )}
      >
        <header className={cn('flex items-start gap-3 px-6 pt-6', fullscreen && 'shrink-0 pb-4 border-b border-line')}>
          <div className="flex-1 min-w-0">
            <h2 className={cn('font-semibold tracking-tight', fullscreen ? 'text-xl' : 'text-lg')}>{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button className="btn-ghost h-8 w-8 px-0 shrink-0" onClick={onClose} aria-label="Затвори"><X size={16} /></button>
        </header>
        <div className={cn(
          'px-6 py-5 overflow-y-auto scrollbar-thin',
          fullscreen ? 'flex-1 min-h-0' : 'max-h-[70vh]',
        )}>{children}</div>
        {footer && <footer className={cn('px-6 py-4 border-t border-line bg-panel/60', fullscreen ? 'shrink-0' : 'rounded-b-3xl')}>{footer}</footer>}
      </div>
    </div>
  )
}
