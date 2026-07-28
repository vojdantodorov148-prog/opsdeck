import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Bits'
import { useActions } from '@/app/actions'
import { listProducts } from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { createAssignmentBundle } from '@/services/tasks'
import {
  DELIVERABLE_GROUPS, DELIVERABLE_LABELS, describeDeliverables, departmentFor,
  type DeliverableDraft,
} from '@/lib/deliverables'
import { DEPARTMENT } from '@/lib/status'
import type { DeliverableType, Department } from '@/types/db'

const BLANK: DeliverableDraft = { type: 'advertorial', quantity: 1 }

export function GiveTaskModal() {
  const { active, close, context } = useActions()
  const open = active === 'give-task'
  const qc = useQueryClient()

  const [productId, setProductId] = useState('')
  const [marketIds, setMarketIds] = useState<string[]>([])
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DeliverableDraft[]>([BLANK])

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  useEffect(() => {
    if (!open) return
    setProductId(context.productId ?? '')
    setMarketIds(context.marketId ? [context.marketId] : [])
    setAssignee('')
    setDueDate('')
    setNotes('')
    setItems([BLANK])
  }, [open, context.productId, context.marketId])

  const product = products.find((p) => p.id === productId)
  const selectedMarkets = markets.filter((market) => marketIds.includes(market.id))
  const departments = useMemo(() => {
    const values = new Set<Department>()
    items.filter((item) => item.quantity > 0).forEach((item) => values.add(departmentFor(item.type)))
    return [...values]
  }, [items])
  const generatedTasks = Math.max(1, selectedMarkets.length) * Math.max(1, departments.length)

  const save = useMutation({
    mutationFn: () => createAssignmentBundle({
      productId: productId || null,
      productName: product?.name ?? null,
      markets: selectedMarkets.map(({ id, name, code }) => ({ id, name, code })),
      assignedTo: assignee,
      deliverables: items.filter((item) => item.quantity > 0),
      dueDate: dueDate || null,
      notes: notes || null,
      testId: context.testId ?? null,
    }),
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['my-week'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      toast.success(`${ids.length} ${ids.length === 1 ? 'задача е доделена' : 'задачи се доделени'} на ${people.find((p) => p.id === assignee)?.full_name ?? 'тимот'}`)
      close()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const valid = Boolean(assignee && items.some((item) => item.quantity > 0))

  function toggleMarket(id: string) {
    setMarketIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Додели задача"
      description="Избери еден или повеќе пазари и комбинирај различни лендинзи и креативи во една брза акција."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            Ќе се креираат <span className="font-semibold text-ink">{generatedTasks}</span> задачи во{' '}
            <span className="font-medium text-ink">{departments.map((department) => DEPARTMENT[department].label).join(' + ') || 'Општо'}</span>
          </p>
          <div className="flex gap-2">
            <button className="btn-quiet" onClick={close}>Откажи</button>
            <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Се доделува…' : 'Додели задача'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Производ">
          <select className="field" value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Без производ</option>
            {products.map((productItem) => <option key={productItem.id} value={productItem.id}>{productItem.name}</option>)}
          </select>
        </Field>

        <Field label="Пазари" optional>
          <div className="rounded-2xl border border-line bg-panel/50 p-2.5">
            <div className="flex flex-wrap gap-2">
              {markets.map((market) => {
                const selected = marketIds.includes(market.id)
                return (
                  <button
                    key={market.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMarket(market.id)}
                    className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm transition ${
                      selected ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-line bg-white hover:border-teal-200'
                    }`}
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded border ${selected ? 'border-teal-500 bg-teal-500 text-white' : 'border-line'}`}>
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="font-medium">{market.code}</span>
                    <span className="text-xs opacity-70">{market.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
              <span>{marketIds.length ? `${marketIds.length} избрани пазари` : 'Без пазар — општа задача'}</span>
              {marketIds.length > 0 && <button type="button" className="hover:text-teal-700" onClick={() => setMarketIds([])}>Исчисти</button>}
            </div>
          </div>
        </Field>

        <Field label="Испораки">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item.type}-${index}`} className="flex items-center gap-2">
                <input
                  type="number" min={1} max={99} value={item.quantity}
                  aria-label="Количина"
                  className="field w-16 text-center"
                  onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index
                    ? { ...value, quantity: Number(event.target.value) || 1 }
                    : value))}
                />
                <span className="text-ink-soft text-sm">×</span>
                <select
                  className="field flex-1" value={item.type} aria-label="Тип на испорака"
                  onChange={(event) => setItems((current) => current.map((value, itemIndex) => itemIndex === index
                    ? { ...value, type: event.target.value as DeliverableType }
                    : value))}
                >
                  {DELIVERABLE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((type) => <option key={type} value={type}>{DELIVERABLE_LABELS[type]}</option>)}
                    </optgroup>
                  ))}
                </select>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost h-10 w-10 px-0" aria-label="Избриши испорака"
                    onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-ghost -ml-1" onClick={() => setItems((current) => [...current, { ...BLANK }])}>
              <Plus size={15} /> Додај друг тип
            </button>
          </div>
        </Field>

        <Field label="Додели на">
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setAssignee(person.id)}
                className={`flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-xl border text-sm transition ${
                  assignee === person.id ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-line hover:border-teal-200'
                }`}
              >
                <Avatar name={person.full_name} url={person.avatar_url} size={26} />
                {person.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Рок" optional>
            <input type="date" className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Белешки" optional>
            <input className="field" placeholder="Сѐ што треба да знае" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        {items.some((item) => item.quantity > 0) && (
          <Badge className="bg-panel border-line text-ink-soft">{describeDeliverables(items)}</Badge>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}{optional && <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">опционално</span>}
      </span>
      {children}
    </div>
  )
}
