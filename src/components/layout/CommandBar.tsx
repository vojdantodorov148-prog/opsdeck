import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, CornerDownLeft } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { listProducts } from '@/services/products'
import { listTools, listProfiles } from '@/services/reference'
import { cn } from '@/lib/cn'

export interface Command {
  id: string
  label: string
  hint: string
  run: () => void
}

/**
 * Deterministic search over pages, products, people and tools.
 * Structured this way so a natural-language parser can be dropped in front of
 * it later without touching the result handlers.
 */
export function CommandBar({ open, onClose, onGiveTask, onStartTest, onAddNote }: {
  open: boolean
  onClose: () => void
  onGiveTask: () => void
  onStartTest: () => void
  onAddNote: () => void
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: tools = [] } = useQuery({ queryKey: ['tools'], queryFn: listTools, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => { navigate(path); onClose() }
    const base: Command[] = [
      { id: 'p-home', label: 'Home', hint: 'Page', run: go('/') },
      { id: 'p-day', label: 'My Day', hint: 'Page', run: go('/my-day') },
      { id: 'p-tasks', label: 'Tasks', hint: 'Page', run: go('/tasks') },
      { id: 'p-products', label: 'Products', hint: 'Page', run: go('/products') },
      { id: 'p-landing', label: 'Landing Factory', hint: 'Page', run: go('/landings') },
      { id: 'p-creative', label: 'Creative Factory', hint: 'Page', run: go('/creatives') },
      { id: 'p-testing', label: 'Product Testing', hint: 'Page', run: go('/testing/products') },
      { id: 'p-notes', label: 'Notes', hint: 'Page', run: go('/notes') },
      { id: 'p-team', label: 'Team', hint: 'Page', run: go('/team') },
      { id: 'a-task', label: 'Give a task', hint: 'Action', run: () => { onClose(); onGiveTask() } },
      { id: 'a-test', label: 'Start a product test', hint: 'Action', run: () => { onClose(); onStartTest() } },
      { id: 'a-note', label: 'Add a note', hint: 'Action', run: () => { onClose(); onAddNote() } },
    ]
    products.forEach((p) => base.push({ id: `pr-${p.id}`, label: p.name, hint: 'Product', run: go(`/products/${p.id}`) }))
    people.forEach((p) => base.push({ id: `pe-${p.id}`, label: p.full_name, hint: 'Team', run: go(`/team?member=${p.id}`) }))
    tools.forEach((t) =>
      base.push({
        id: `to-${t.id}`, label: `Open ${t.name}`, hint: 'Tool',
        run: () => { window.open(t.url, '_blank', 'noopener,noreferrer'); onClose() },
      }))
    return base
  }, [products, tools, people, navigate, onClose, onGiveTask, onStartTest, onAddNote])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return commands.slice(0, 8)
    return commands.filter((c) => c.label.toLowerCase().includes(needle)).slice(0, 10)
  }, [q, commands])

  return (
    <Modal open={open} onClose={onClose} title="Search or type a command" width="max-w-xl">
      <div className="flex items-center gap-2 border border-line rounded-xl px-3 h-11 focus-within:border-teal-300">
        <Search size={17} className="text-ink-soft" />
        <input
          autoFocus value={q} placeholder="Products, people, pages, tools…"
          className="flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => { setQ(e.target.value); setCursor(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
            if (e.key === 'Enter') results[cursor]?.run()
          }}
        />
      </div>

      <ul className="mt-3 space-y-0.5">
        {results.length === 0 && <li className="px-3 py-6 text-sm text-ink-soft text-center">No matches.</li>}
        {results.map((c, i) => (
          <li key={c.id}>
            <button
              className={cn('w-full flex items-center justify-between px-3 h-10 rounded-xl text-left text-sm', i === cursor ? 'bg-teal-50 text-teal-700' : 'hover:bg-panel')}
              onMouseEnter={() => setCursor(i)}
              onClick={c.run}
            >
              <span className="truncate">{c.label}</span>
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                {c.hint}
                {i === cursor && <CornerDownLeft size={13} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
