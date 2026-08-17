import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useActions } from '@/app/actions'
import { listProducts, startProductTest, type PrepItem } from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { DELIVERABLE_GROUPS, DELIVERABLE_LABELS } from '@/lib/deliverables'
import { TEST_STATUS } from '@/lib/status'
import type { DeliverableType, TestStatus } from '@/types/db'

const CHOOSABLE: TestStatus[] = ['planned', 'preparing', 'ready', 'testing', 'winner', 'stopped']

export function StartTestModal() {
  const { active, close, context } = useActions()
  const open = active === 'start-test'
  const qc = useQueryClient()

  const [productId, setProductId] = useState('')
  const [marketId, setMarketId] = useState('')
  const [status, setStatus] = useState<TestStatus>('preparing')
  const [offer, setOffer] = useState('')
  const [prep, setPrep] = useState<{ type: DeliverableType; quantity: number; assigned_to: string }[]>([])

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  useEffect(() => {
    if (!open) return
    setProductId(context.productId ?? '')
    setMarketId(context.marketId ?? '')
    setStatus('preparing')
    setOffer('')
    setPrep([])
  }, [open, context.productId, context.marketId])

  const save = useMutation({
    mutationFn: () =>
      startProductTest({
        productId, marketId, status, offer: offer || null,
        prep: prep.filter((p) => p.assigned_to && p.quantity > 0) as PrepItem[],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['my-week'] })
      toast.success('Тестот е ажуриран и подготовката е доделена')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Започни продукт тест"
      description="Еден производ во еден пазар. Креативните концепти остануваат во Creative Testing Calendar."
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-quiet" onClick={close}>Откажи</button>
          <button className="btn-primary" disabled={!productId || !marketId || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Се зачувува…' : 'Зачувај тест'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Производ</span>
            <select className="field" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Избери производ</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Пазар</span>
            <select className="field" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              <option value="">Избери пазар</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Статус</span>
          <div className="flex flex-wrap gap-2">
            {CHOOSABLE.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`h-9 px-3 rounded-xl border text-sm transition ${
                  status === s ? 'border-teal-300 bg-teal-50 text-teal-700 font-medium' : 'border-line text-ink-soft hover:border-teal-200'
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: TEST_STATUS[s].dot }} />
                {TEST_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Понуда <span className="font-normal normal-case tracking-normal opacity-70">опционално</span>
          </span>
          <input className="field" placeholder="пр. 2+1 гратис, 39.90" value={offer} onChange={(e) => setOffer(e.target.value)} />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Што треба да се подготви</span>
            <button className="btn-ghost h-8 -mr-2" onClick={() => setPrep((p) => [...p, { type: 'advertorial', quantity: 1, assigned_to: '' }])}>
              <Plus size={15} /> Додај
            </button>
          </div>
          {prep.length === 0 && (
            <p className="text-sm text-ink-soft">Сѐ уште нема. Додај редови за подготовката што оди со тестот.</p>
          )}
          <div className="space-y-2">
            {prep.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number" min={1} value={row.quantity} aria-label="Количина" className="field w-16 text-center"
                  onChange={(e) => setPrep((p) => p.map((r, idx) => (idx === i ? { ...r, quantity: Number(e.target.value) || 1 } : r)))}
                />
                <select
                  className="field flex-1" value={row.type} aria-label="Тип на испорака"
                  onChange={(e) => setPrep((p) => p.map((r, idx) => (idx === i ? { ...r, type: e.target.value as DeliverableType } : r)))}
                >
                  {DELIVERABLE_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.types.map((t) => <option key={t} value={t}>{DELIVERABLE_LABELS[t]}</option>)}
                    </optgroup>
                  ))}
                </select>
                <select
                  className="field w-40" value={row.assigned_to} aria-label="Извршител"
                  onChange={(e) => setPrep((p) => p.map((r, idx) => (idx === i ? { ...r, assigned_to: e.target.value } : r)))}
                >
                  <option value="">Додели на…</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <button className="btn-ghost h-10 w-10 px-0" aria-label="Избриши ред" onClick={() => setPrep((p) => p.filter((_, idx) => idx !== i))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {prep.some((p) => p.assigned_to) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
              <span>Креира по една задача за секој член:</span>
              {[...new Set(prep.filter((p) => p.assigned_to).map((p) => p.assigned_to))].map((id) => {
                const person = people.find((p) => p.id === id)
                return <Avatar key={id} name={person?.full_name} url={person?.avatar_url} size={22} />
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
