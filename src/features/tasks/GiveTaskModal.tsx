import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Bits'
import { useActions } from '@/app/actions'
import { listProducts } from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { createAssignment } from '@/services/tasks'
import {
  DELIVERABLE_GROUPS, DELIVERABLE_LABELS, describeDeliverables, routeTask,
  type DeliverableDraft,
} from '@/lib/deliverables'
import { DEPARTMENT } from '@/lib/status'
import type { DeliverableType } from '@/types/db'

const BLANK: DeliverableDraft = { type: 'advertorial', quantity: 1 }

export function GiveTaskModal() {
  const { active, close, context } = useActions()
  const open = active === 'give-task'
  const qc = useQueryClient()

  const [productId, setProductId] = useState('')
  const [marketId, setMarketId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DeliverableDraft[]>([BLANK])

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  // Context inherits: opened from a product page, the product is already chosen.
  useEffect(() => {
    if (!open) return
    setProductId(context.productId ?? '')
    setMarketId(context.marketId ?? '')
    setAssignee('')
    setDueDate('')
    setNotes('')
    setItems([BLANK])
  }, [open, context.productId, context.marketId])

  const product = products.find((p) => p.id === productId)
  const market = markets.find((m) => m.id === marketId)
  const department = useMemo(() => routeTask(items), [items])

  const title = product && market ? `${product.name} — ${market.name}`
    : product ? product.name
    : describeDeliverables(items) || 'Task'

  const save = useMutation({
    mutationFn: () =>
      createAssignment({
        title,
        assignedTo: assignee,
        deliverables: items.filter((i) => i.quantity > 0),
        productId: productId || null,
        marketId: marketId || null,
        dueDate: dueDate || null,
        notes: notes || null,
        testId: context.testId ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['my-week'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      toast.success(`Assigned to ${people.find((p) => p.id === assignee)?.full_name ?? 'team'}`)
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = assignee && items.some((i) => i.quantity > 0)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Give a task"
      description="Pick what needs making and who makes it. Ops Deck files it everywhere else."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            Goes to <span className="font-medium text-ink">{DEPARTMENT[department].label}</span>
            {product && market ? ` · ${product.name} · ${market.code}` : ''}
          </p>
          <div className="flex gap-2">
            <button className="btn-quiet" onClick={close}>Cancel</button>
            <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Assigning…' : 'Assign task'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product">
            <select className="field" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">No product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Market">
            <select className="field" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              <option value="">No market</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Deliverables">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number" min={1} max={99} value={item.quantity}
                  aria-label="Quantity"
                  className="field w-16 text-center"
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: Number(e.target.value) || 1 } : it)))
                  }
                />
                <span className="text-ink-soft text-sm">×</span>
                <select
                  className="field flex-1" value={item.type} aria-label="Deliverable type"
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, type: e.target.value as DeliverableType } : it)))
                  }
                >
                  {DELIVERABLE_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.types.map((t) => <option key={t} value={t}>{DELIVERABLE_LABELS[t]}</option>)}
                    </optgroup>
                  ))}
                </select>
                {items.length > 1 && (
                  <button
                    className="btn-ghost h-10 w-10 px-0" aria-label="Remove deliverable"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button className="btn-ghost -ml-1" onClick={() => setItems((prev) => [...prev, { ...BLANK }])}>
              <Plus size={15} /> Add deliverable
            </button>
          </div>
        </Field>

        <Field label="Assign to">
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setAssignee(p.id)}
                className={`flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-xl border text-sm transition ${
                  assignee === p.id ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-line hover:border-teal-200'
                }`}
              >
                <Avatar name={p.full_name} url={p.avatar_url} size={26} />
                {p.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due" optional>
            <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Notes" optional>
            <input className="field" placeholder="Anything they need to know" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {items.some((i) => i.quantity > 0) && (
          <Badge className="bg-panel border-line text-ink-soft">{describeDeliverables(items)}</Badge>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}{optional && <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">optional</span>}
      </span>
      {children}
    </label>
  )
}
