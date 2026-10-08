import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { useActions } from '@/app/actions'
import { useUserId } from '@/features/auth/session'
import { addNote } from '@/services/signal'
import { listProducts } from '@/services/products'

export function AddNoteModal() {
  const { active, close, context } = useActions()
  const open = active === 'add-note'
  const userId = useUserId()
  const qc = useQueryClient()

  const [content, setContent] = useState('')
  const [productId, setProductId] = useState('')
  const [shared, setShared] = useState(false)

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })

  useEffect(() => {
    if (!open) return
    setContent('')
    setProductId(context.productId ?? '')
    setShared(false)
  }, [open, context.productId])

  const save = useMutation({
    mutationFn: () =>
      addNote({
        author_id: userId,
        content,
        visibility: shared ? 'team' : 'private',
        product_id: productId || null,
        task_id: context.taskId ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Белешката е зачувана')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Додај белешка"
      footer={
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Share with the team
          </label>
          <button className="btn-primary" disabled={!content.trim() || save.isPending} onClick={() => save.mutate()}>Зачувај белешка</button>
        </div>
      }
    >
      <textarea
        autoFocus rows={6} value={content} placeholder="Запиши нешто…"
        className="field h-auto py-3 resize-none"
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && content.trim()) save.mutate() }}
      />
      <label className="block mt-4">
        <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Поврзи со производ <span className="font-normal normal-case tracking-normal opacity-70">опционално</span>
        </span>
        <select className="field" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Без производ</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
    </Modal>
  )
}
