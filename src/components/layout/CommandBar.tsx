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

export function CommandBar({ open, onClose, onGiveTask, onStartTest, onAddNote }: {
  open: boolean
  onClose: () => void
  onGiveTask: () => void
  onStartTest: () => void
  onAddNote: () => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: tools = [] } = useQuery({ queryKey: ['tools'], queryFn: listTools, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => { navigate(path); onClose() }
    const base: Command[] = [
      { id: 'p-home', label: 'Почетна', hint: 'Страница', run: go('/') },
      { id: 'p-day', label: 'Мој ден', hint: 'Страница', run: go('/my-day') },
      { id: 'p-tasks', label: 'Задачи', hint: 'Страница', run: go('/tasks') },
      { id: 'p-products', label: 'Производи', hint: 'Страница', run: go('/products') },
      { id: 'p-landing', label: 'Лендинг студио', hint: 'Страница', run: go('/landings') },
      { id: 'p-creative', label: 'Креативно студио', hint: 'Страница', run: go('/creatives') },
      { id: 'p-testing', label: 'Продукт тестирање', hint: 'Страница', run: go('/testing/products') },
      { id: 'p-finance', label: 'Финансии', hint: 'Страница', run: go('/finance') },
      { id: 'p-brands', label: 'Брендови', hint: 'Страница', run: go('/brands') },
      { id: 'p-notes', label: 'Белешки', hint: 'Страница', run: go('/notes') },
      { id: 'p-team', label: 'Тим', hint: 'Страница', run: go('/team') },
      { id: 'a-task', label: 'Додели задача', hint: 'Акција', run: () => { onClose(); onGiveTask() } },
      { id: 'a-test', label: 'Започни продукт тест', hint: 'Акција', run: () => { onClose(); onStartTest() } },
      { id: 'a-note', label: 'Додај белешка', hint: 'Акција', run: () => { onClose(); onAddNote() } },
    ]
    products.forEach((product) => base.push({ id: `pr-${product.id}`, label: product.name, hint: 'Производ', run: go(`/products/${product.id}`) }))
    people.forEach((person) => base.push({ id: `pe-${person.id}`, label: person.full_name, hint: 'Тим', run: go(`/team?member=${person.id}`) }))
    tools.forEach((tool) => base.push({
      id: `to-${tool.id}`,
      label: `Отвори ${tool.name}`,
      hint: 'Алатка',
      run: () => { window.open(tool.url, '_blank', 'noopener,noreferrer'); onClose() },
    }))
    return base
  }, [products, tools, people, navigate, onClose, onGiveTask, onStartTest, onAddNote])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands.slice(0, 8)
    return commands.filter((command) => command.label.toLowerCase().includes(needle)).slice(0, 10)
  }, [query, commands])

  return (
    <Modal open={open} onClose={onClose} title="Пребарај или напиши команда" width="max-w-xl">
      <div className="flex items-center gap-2 border border-line rounded-xl px-3 h-11 focus-within:border-teal-300">
        <Search size={17} className="text-ink-soft" />
        <input
          autoFocus
          value={query}
          placeholder="Производи, луѓе, страници, алатки…"
          className="flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => { setQuery(event.target.value); setCursor(0) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((value) => Math.min(value + 1, results.length - 1)) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)) }
            if (event.key === 'Enter') results[cursor]?.run()
          }}
        />
      </div>

      <ul className="mt-3 space-y-0.5">
        {results.length === 0 && <li className="px-3 py-6 text-sm text-ink-soft text-center">Нема резултати.</li>}
        {results.map((command, index) => (
          <li key={command.id}>
            <button
              className={cn('w-full flex items-center justify-between px-3 h-10 rounded-xl text-left text-sm', index === cursor ? 'bg-teal-50 text-teal-700' : 'hover:bg-panel')}
              onMouseEnter={() => setCursor(index)}
              onClick={command.run}
            >
              <span className="truncate">{command.label}</span>
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                {command.hint}
                {index === cursor && <CornerDownLeft size={13} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
