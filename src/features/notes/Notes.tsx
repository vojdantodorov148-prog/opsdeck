import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader, EmptyState, Loading, ErrorNote } from '@/components/ui/Bits'
import { addNote, deleteNote, listNotes } from '@/services/signal'
import { useUserId } from '@/features/auth/session'

export function Notes() {
  const userId = useUserId()
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['notes', { author: userId }],
    queryFn: () => listNotes({ authorId: userId }),
    enabled: Boolean(userId),
  })

  const create = useMutation({
    mutationFn: () => addNote({ author_id: userId, content: draft.trim(), visibility: 'private' }),
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['notes'] }) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  return (
    <div className="max-w-[760px]">
      <PageHeader title="Notes" subtitle="Quick thinking space. Private unless you share it." />

      <div className="panel p-4 mb-5">
        <textarea
          rows={3} value={draft} placeholder="Write something down…"
          className="field h-auto py-2 resize-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) create.mutate() }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-ink-soft">⌘/Ctrl + Enter to save</span>
          <button className="btn-primary h-9" disabled={!draft.trim()} onClick={() => create.mutate()}>Save note</button>
        </div>
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={4} /> : notes.length === 0 ? (
        <div className="panel"><EmptyState title="No notes yet" hint="Anything you type above lands here." /></div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="panel p-4 flex gap-3">
              <p className="flex-1 text-sm whitespace-pre-wrap">{n.content}</p>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-ink-soft">{new Date(n.created_at).toLocaleDateString()}</p>
                <button className="btn-ghost h-8 w-8 px-0 mt-1" aria-label="Delete note" onClick={() => remove.mutate(n.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
