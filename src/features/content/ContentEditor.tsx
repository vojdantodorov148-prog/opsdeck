import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSession, useUserId } from '@/features/auth/session'

interface AppTextRow { key: string; value: string; original: string | null }

async function listAppTexts() {
  const { data, error } = await supabase.from('app_texts').select('key,value,original')
  if (error) throw error
  return (data ?? []) as AppTextRow[]
}

function cssPath(element: Element) {
  const parts: string[] = []
  let current: Element | null = element
  while (current && current.id !== 'root') {
    const parent: Element | null = current.parentElement
    if (!parent) break
    const same = Array.from(parent.children).filter((child) => child.tagName === current!.tagName)
    const index = same.indexOf(current) + 1
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`)
    current = parent
  }
  return parts.join('>')
}

function editableTextNode(target: Element): Text | null {
  const direct = Array.from(target.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
  if (direct) return direct as Text

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT
      if (parent.closest('svg,script,style,input,textarea,select,option,[data-content-editor],[data-no-copy-edit]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  return walker.nextNode() as Text | null
}

function keyFor(node: Text) {
  const parent = node.parentElement
  if (!parent) return ''
  const textNodes = Array.from(parent.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE)
  const index = textNodes.indexOf(node)
  return `${window.location.pathname}|${cssPath(parent)}|text:${index}`
}

function applyOverrides(root: HTMLElement, values: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT
      if (parent.closest('svg,script,style,input,textarea,select,option,[data-content-editor],[data-no-copy-edit]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode() as Text | null
  while (node) {
    const replacement = values.get(keyFor(node))
    if (replacement !== undefined && node.nodeValue !== replacement) node.nodeValue = replacement
    node = walker.nextNode() as Text | null
  }
}

export function ContentEditor() {
  const { can } = useSession()
  const userId = useUserId()
  const qc = useQueryClient()
  const [enabled, setEnabled] = useState(false)
  const [selected, setSelected] = useState<{ key: string; original: string; value: string } | null>(null)
  const [hovered, setHovered] = useState<HTMLElement | null>(null)

  const { data: rows = [] } = useQuery({
    queryKey: ['app-texts'],
    queryFn: listAppTexts,
    enabled: can('settings.manage'),
  })
  const values = useMemo(() => new Map(rows.map((row) => [row.key, row.value])), [rows])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    let applying = false
    const apply = () => {
      if (applying) return
      applying = true
      applyOverrides(root, values)
      applying = false
    }
    apply()
    const observer = new MutationObserver(() => requestAnimationFrame(apply))
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [values])

  useEffect(() => {
    if (!enabled) {
      hovered?.classList.remove('copy-edit-hover')
      setHovered(null)
      return
    }

    function move(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target || target.closest('[data-content-editor]')) return
      const node = editableTextNode(target)
      const next = node?.parentElement ?? null
      if (next === hovered) return
      hovered?.classList.remove('copy-edit-hover')
      next?.classList.add('copy-edit-hover')
      setHovered(next)
    }

    function click(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target || target.closest('[data-content-editor]')) return
      const node = editableTextNode(target)
      if (!node) return
      event.preventDefault()
      event.stopPropagation()
      const key = keyFor(node)
      const original = node.textContent?.trim() ?? ''
      setSelected({ key, original, value: values.get(key) ?? original })
    }

    document.addEventListener('mousemove', move, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('click', click, true)
      hovered?.classList.remove('copy-edit-hover')
    }
  }, [enabled, hovered, values])

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const { error } = await supabase.from('app_texts').upsert({
        key: selected.key,
        value: selected.value,
        original: selected.original,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-texts'] })
      toast.success('Текстот е зачуван')
      setSelected(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (!can('settings.manage')) return null

  return (
    <>
      <button
        data-content-editor
        className={`fixed bottom-3 right-3 z-[70] grid h-7 w-7 place-items-center rounded-full border shadow-sm transition ${
          enabled ? 'border-teal-500 bg-teal-500 text-white' : 'border-line bg-white/70 text-ink-soft/40 opacity-35 hover:opacity-100'
        }`}
        onClick={() => setEnabled((value) => !value)}
        title={enabled ? 'Исклучи уредување текст' : 'Уреди текст на страницата'}
        aria-label={enabled ? 'Исклучи уредување текст' : 'Уреди текст на страницата'}
      >
        <Pencil size={11} />
      </button>

      {enabled && (
        <div data-content-editor className="fixed bottom-3 right-12 z-[70] rounded-lg border border-teal-200 bg-white/95 px-2 py-1 text-[10px] text-teal-700 shadow-sm">
          Кликни на текст за да го измениш
        </div>
      )}

      {selected && (
        <div data-content-editor className="fixed inset-0 z-[80] grid place-items-center bg-ink/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-5 shadow-float">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Измени текст</h2>
                <p className="mt-1 text-xs text-ink-soft">Измената се зачувува за ова место во апликацијата.</p>
              </div>
              <button className="btn-ghost h-8 w-8 px-0" onClick={() => setSelected(null)} aria-label="Затвори"><X size={15} /></button>
            </div>
            <textarea
              autoFocus
              className="mt-4 min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              value={selected.value}
              onChange={(event) => setSelected({ ...selected, value: event.target.value })}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-quiet" onClick={() => setSelected(null)}>Откажи</button>
              <button className="btn-primary" onClick={() => save.mutate()} disabled={!selected.value.trim() || save.isPending}>
                <Save size={15} /> Зачувај
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
