import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Bits'
import { addMarket, deleteMarket, listMarkets } from '@/services/reference'
import type { Market } from '@/types/db'

export function MarketManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: listMarkets,
    enabled: open,
  })
  const [form, setForm] = useState({ code: '', name: '', currency: 'EUR' })
  const [deleting, setDeleting] = useState<Market | null>(null)

  const nextOrder = useMemo(
    () => (markets.length ? Math.max(...markets.map((market) => market.sort_order)) + 10 : 10),
    [markets],
  )

  const refreshMarkets = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['markets'] }),
      queryClient.invalidateQueries({ queryKey: ['tests'] }),
    ])
  }

  const create = useMutation({
    mutationFn: () => addMarket({ ...form, sort_order: nextOrder }),
    onSuccess: async () => {
      await refreshMarkets()
      setForm({ code: '', name: '', currency: 'EUR' })
      toast.success('Пазарот е додаден и е достапен низ целата апликација')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteMarket(id),
    onSuccess: async () => {
      await refreshMarkets()
      setDeleting(null)
      toast.success('Пазарот е избришан')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canCreate = form.code.trim().length >= 2 && form.name.trim().length >= 2

  return (
    <>
      <Modal
        open={open && !deleting}
        onClose={onClose}
        title="Управување со пазари"
        description="Пазарите додадени тука автоматски се појавуваат во продукт тестирање, задачи, креативи и лендинг страници."
        width="max-w-2xl"
      >
        <div className="rounded-2xl border border-line bg-panel/55 p-4">
          <h3 className="text-sm font-semibold">Додај нов пазар</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_110px_auto]">
            <input
              className="field uppercase"
              maxLength={5}
              placeholder="Код, пр. HR"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            />
            <input
              className="field"
              placeholder="Име, пр. Хрватска"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <input
              className="field uppercase"
              maxLength={5}
              placeholder="EUR"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
            />
            <button
              className="btn-primary h-10 px-3 disabled:opacity-40"
              disabled={!canCreate || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus size={15} />
              Додај
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Активни пазари</h3>
            <span className="text-xs text-ink-soft">{markets.length} вкупно</span>
          </div>
          {isLoading ? (
            <Loading rows={4} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {markets.map((market) => (
                <li key={market.id} className="flex items-center gap-3 bg-surface px-3 py-2.5">
                  <span className="grid h-8 min-w-12 place-items-center rounded-lg bg-teal-50 px-2 text-xs font-semibold text-teal-700">
                    {market.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{market.name}</p>
                    <p className="text-[11px] text-ink-soft">Валута: {market.currency}</p>
                  </div>
                  <button
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft/60 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Избриши ${market.name}`}
                    title="Избриши пазар"
                    onClick={() => setDeleting(market)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Избриши пазар"
        description="Оваа промена ќе важи насекаде во апликацијата."
        footer={(
          <div className="flex justify-end gap-2">
            <button className="btn-quiet" onClick={() => setDeleting(null)}>Откажи</button>
            <button
              className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              disabled={!deleting || remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending ? 'Се брише…' : 'Избриши пазар'}
            </button>
          </div>
        )}
      >
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
          Ќе се избрише <strong>{deleting?.name}</strong>, ќе се отстранат неговите продукт тестови, а постоечките задачи ќе останат без избран пазар.
        </div>
      </Modal>
    </>
  )
}
