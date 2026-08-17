import { useEffect } from 'react'

/** Cmd+K on Mac, Ctrl+K elsewhere. */
export function useCommandShortcut(onTrigger: () => void) {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onTrigger()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onTrigger])
}
