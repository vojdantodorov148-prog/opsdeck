import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, Loading, ErrorNote } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { deleteTool, listTools, saveTool } from '@/services/reference'
import { useSession } from '@/features/auth/session'
import { cn } from '@/lib/cn'

const CATEGORY_LABEL: Record<string, string> = {
  creation: 'Креирање', marketing: 'Маркетинг', work: 'Работа', testing: 'Тестирање', research: 'Истражување',
}

export function Tools() {
  const { can } = useSession()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { data: tools = [], isLoading, error } = useQuery({ queryKey: ['tools'], queryFn: listTools })

  const fav = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => saveTool({ id, favorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteTool(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tools'] }); toast.success('Апликацијата е избришана') },
    onError: (e: Error) => toast.error(e.message),
  })

  const categories = [...new Set(tools.map((tool) => tool.category))]

  return (
    <div className="max-w-[900px]">
      <PageHeader
        title="Алатки"
        subtitle="Сите апликации што ги користи тимот, на едно место."
        action={can('tools.manage') ? <button className="btn-primary" onClick={() => setEditing(true)}>Додај апликација</button> : undefined}
      />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : tools.length === 0 ? (
        <div className="panel"><EmptyState title="Нема додадени апликации" hint="Додајте ги алатките што ги користите секој ден." /></div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{CATEGORY_LABEL[category] ?? category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.filter((tool) => tool.category === category).map((tool) => (
                  <div key={tool.id} className="panel p-4 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={tool.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-sm hover:text-teal-700">
                        {tool.name} <ExternalLink size={13} className="text-ink-soft" />
                      </a>
                      {tool.description && <p className="mt-0.5 text-xs text-ink-soft line-clamp-2">{tool.description}</p>}
                    </div>
                    {can('tools.manage') && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          aria-label={tool.favorite ? 'Отстрани од омилени' : 'Додај во омилени'}
                          onClick={() => fav.mutate({ id: tool.id, favorite: !tool.favorite })}
                          className={cn('p-1 rounded-lg transition', tool.favorite ? 'text-teal-500' : 'text-ink-soft/40 hover:text-teal-400')}
                        >
                          <Star size={15} fill={tool.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          aria-label="Избриши апликација"
                          onClick={() => window.confirm(`Да ја избришам апликацијата „${tool.name}“?`) && remove.mutate(tool.id)}
                          className="p-1 rounded-lg text-ink-soft/35 transition hover:bg-[#FBEFEA] hover:text-[#A0522D]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <AddToolModal open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

function AddToolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', url: '', description: '', category: 'work' })
  const save = useMutation({
    mutationFn: () => saveTool(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tools'] }); toast.success('Апликацијата е додадена'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Додај апликација"
      footer={<div className="flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose}>Откажи</button>
        <button className="btn-primary" disabled={!form.name || !form.url || save.isPending} onClick={() => save.mutate()}>Додај</button>
      </div>}>
      <div className="space-y-3">
        <input className="field" placeholder="Име" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="field" placeholder="За што се користи" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CATEGORY_LABEL).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
      </div>
    </Modal>
  )
}
