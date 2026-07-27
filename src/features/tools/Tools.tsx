import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Star } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, Loading, ErrorNote } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { listTools, saveTool } from '@/services/reference'
import { useSession } from '@/features/auth/session'
import { cn } from '@/lib/cn'

const CATEGORY_LABEL: Record<string, string> = {
  creation: 'Creation', marketing: 'Marketing', work: 'Work', testing: 'Testing', research: 'Research',
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

  const categories = [...new Set(tools.map((t) => t.category))]

  return (
    <div className="max-w-[900px]">
      <PageHeader
        title="Tools"
        subtitle="Everything the team opens during the day, in one place."
        action={can('tools.manage') ? <button className="btn-primary" onClick={() => setEditing(true)}>Add tool</button> : undefined}
      />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : tools.length === 0 ? (
        <div className="panel"><EmptyState title="No tools configured" hint="Add the apps your team uses every day." /></div>
      ) : (
        <div className="space-y-6">
          {categories.map((c) => (
            <section key={c}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{CATEGORY_LABEL[c] ?? c}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.filter((t) => t.category === c).map((t) => (
                  <div key={t.id} className="panel p-4 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-sm hover:text-teal-700">
                        {t.name} <ExternalLink size={13} className="text-ink-soft" />
                      </a>
                      {t.description && <p className="mt-0.5 text-xs text-ink-soft line-clamp-2">{t.description}</p>}
                    </div>
                    {can('tools.manage') && (
                      <button
                        aria-label={t.favorite ? 'Unfavourite' : 'Favourite'}
                        onClick={() => fav.mutate({ id: t.id, favorite: !t.favorite })}
                        className={cn('shrink-0 p-1 rounded-lg transition', t.favorite ? 'text-teal-500' : 'text-ink-soft/40 hover:text-teal-400')}
                      >
                        <Star size={15} fill={t.favorite ? 'currentColor' : 'none'} />
                      </button>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tools'] }); toast.success('Tool added'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Add tool"
      footer={<div className="flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!form.name || !form.url || save.isPending} onClick={() => save.mutate()}>Add tool</button>
      </div>}>
      <div className="space-y-3">
        <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="field" placeholder="What it's for" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </Modal>
  )
}
