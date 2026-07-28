import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/ui/Drawer'
import { getTest, listProducts, startProductTest, updateTest } from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { TEST_STATUS, TEST_STATUS_ORDER } from '@/lib/status'
import { useActions } from '@/app/actions'
import type { TestStatus } from '@/types/db'

export function TestCellDrawer({ cell, onClose }: {
  cell: { productId: string; marketId: string } | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const actions = useActions()
  const [offer, setOffer] = useState('')
  const [notes, setNotes] = useState('')

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: test } = useQuery({
    queryKey: ['test', cell?.productId, cell?.marketId],
    queryFn: () => getTest(cell!.productId, cell!.marketId),
    enabled: Boolean(cell),
  })

  useEffect(() => {
    setOffer(test?.offer ?? '')
    setNotes(test?.notes ?? '')
  }, [test?.id, test?.offer, test?.notes])

  const product = products.find((p) => p.id === cell?.productId)
  const market = markets.find((m) => m.id === cell?.marketId)
  const status: TestStatus = test?.status ?? 'not_tested'

  function refresh() {
    qc.invalidateQueries({ queryKey: ['tests'] })
    qc.invalidateQueries({ queryKey: ['test', cell?.productId, cell?.marketId] })
  }

  const setStatus = useMutation({
    mutationFn: (next: TestStatus) =>
      startProductTest({ productId: cell!.productId, marketId: cell!.marketId, status: next }),
    onSuccess: () => { refresh(); toast.success('Статусот е ажуриран') },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveDetails = useMutation({
    mutationFn: () => updateTest(test!.id, { offer, notes }),
    onSuccess: () => { refresh(); toast.success('Зачувано') },
  })

  if (!cell) return null

  return (
    <Drawer
      open
      onClose={onClose}
      title={product?.name ?? 'Производ'}
      subtitle={market?.name}
      footer={
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => actions.open('start-test', { productId: cell.productId, marketId: cell.marketId })}>
            Подготви тест
          </button>
          {test && <button className="btn-quiet" onClick={() => saveDetails.mutate()}>Зачувај детали</button>}
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Статус</h3>
          <div className="flex flex-wrap gap-2">
            {TEST_STATUS_ORDER.map((s) => (
              <button
                key={s} onClick={() => setStatus.mutate(s)}
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

        {test && (
          <>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-soft">Одговорен</dt>
                <dd className="mt-0.5">{people.find((p) => p.id === test.owner_id)?.full_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-soft">Започнат</dt>
                <dd className="mt-0.5">{test.start_date ?? '—'}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              {test.landing_url && (
                <a className="flex items-center gap-2 text-sm text-teal-700 hover:underline" href={test.landing_url} target="_blank" rel="noopener noreferrer">
                  Лендинг <ExternalLink size={13} />
                </a>
              )}
              {test.campaign_url && (
                <a className="flex items-center gap-2 text-sm text-teal-700 hover:underline" href={test.campaign_url} target="_blank" rel="noopener noreferrer">
                  Кампања <ExternalLink size={13} />
                </a>
              )}
            </div>

            <label className="block">
              <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Понуда</span>
              <input className="field" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="пр. 2+1 гратис" />
            </label>
            <label className="block">
              <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Белешки</span>
              <textarea className="field h-auto py-2 resize-none" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </>
        )}
      </div>
    </Drawer>
  )
}
