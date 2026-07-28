import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings2 } from 'lucide-react'
import { PageHeader, Loading, ErrorNote, EmptyState } from '@/components/ui/Bits'
import { TestCellDrawer } from './TestCellDrawer'
import { MarketManagerModal } from './MarketManagerModal'
import { listProducts, listTests } from '@/services/products'
import { listMarkets } from '@/services/reference'
import { TEST_STATUS } from '@/lib/status'
import { useActions } from '@/app/actions'
import { cn } from '@/lib/cn'
import { useSession } from '@/features/auth/session'
import type { TestStatus } from '@/types/db'

const VIEWS = ['Матрица', 'Тековни', 'Историја'] as const
const PIPELINE: TestStatus[] = ['preparing', 'ready', 'testing']

export function ProductTesting() {
  const actions = useActions()
  const { can } = useSession()
  const [view, setView] = useState<(typeof VIEWS)[number]>('Матрица')
  const [cell, setCell] = useState<{ productId: string; marketId: string } | null>(null)
  const [managingMarkets, setManagingMarkets] = useState(false)

  const { data: products = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })

  const statusOf = (productId: string, marketId: string): TestStatus =>
    tests.find((t) => t.product_id === productId && t.market_id === marketId)?.status ?? 'not_tested'

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Продукт тестирање"
        subtitle="Секој производ во секој пазар. Креативните концепти се следат во Creative Testing Calendar."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(can('products.manage') || can('testing.manage')) && (
              <button className="btn-quiet h-10 gap-2" onClick={() => setManagingMarkets(true)}>
                <Settings2 size={15} />
                Управувај пазари
              </button>
            )}
            <button className="btn-primary" onClick={() => actions.open('start-test')}>Започни тест</button>
          </div>
        )}
      />

      <div className="flex gap-1 mb-4">
        {VIEWS.map((v) => (
          <button
            key={v} onClick={() => setView(v)}
            className={cn('h-9 px-3 rounded-xl text-sm transition', view === v ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-panel')}
          >
            {v}
          </button>
        ))}
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={6} /> : (
        <>
          {view === 'Матрица' && (
            <div className="panel overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface z-10 text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-soft font-semibold">Производ</th>
                    {markets.map((m) => (
                      <th key={m.id} className="px-2 py-3 text-[11px] uppercase tracking-wide text-ink-soft font-semibold text-center min-w-[92px]" title={m.name}>
                        {m.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="sticky left-0 bg-surface z-10 px-4 py-2 font-medium border-t border-line whitespace-nowrap">{p.name}</td>
                      {markets.map((m) => {
                        const s = statusOf(p.id, m.id)
                        const meta = TEST_STATUS[s]
                        return (
                          <td key={m.id} className="border-t border-line p-1">
                            <button
                              onClick={() => setCell({ productId: p.id, marketId: m.id })}
                              className={cn('w-full h-9 rounded-lg border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-medium transition hover:border-teal-200', meta.cell, meta.text)}
                              aria-label={`${p.name} во ${m.name}: ${meta.label}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                              {s === 'not_tested' ? '—' : meta.label}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'Тековни' && (
            <div className="grid gap-4 md:grid-cols-3">
              {PIPELINE.map((s) => {
                const list = tests.filter((t) => t.status === s)
                return (
                  <section key={s} className="panel p-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: TEST_STATUS[s].dot }} />
                      {TEST_STATUS[s].label}
                      <span className="ml-auto text-xs text-ink-soft tabular-nums">{list.length}</span>
                    </h2>
                    <ul className="space-y-1">
                      {list.map((t) => (
                        <li key={t.id}>
                          <button className="w-full text-left px-2 py-2 rounded-lg row-hover text-sm"
                            onClick={() => setCell({ productId: t.product_id, marketId: t.market_id })}>
                            {products.find((p) => p.id === t.product_id)?.name}
                            <span className="text-ink-soft"> · {markets.find((m) => m.id === t.market_id)?.code}</span>
                          </button>
                        </li>
                      ))}
                      {list.length === 0 && <li className="text-sm text-ink-soft px-2 py-2">Празно</li>}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}

          {view === 'Историја' && (
            <div className="panel p-2">
              {tests.filter((t) => t.status === 'winner' || t.status === 'stopped').length === 0 ? (
                <EmptyState title="Сѐ уште нема завршени тестови" hint="Победничките и стопираните тестови ќе се појават тука." />
              ) : (
                <ul className="divide-y divide-line">
                  {tests.filter((t) => t.status === 'winner' || t.status === 'stopped').map((t) => (
                    <li key={t.id}>
                      <button className="w-full flex items-center gap-3 py-3 px-2 rounded-xl row-hover text-left"
                        onClick={() => setCell({ productId: t.product_id, marketId: t.market_id })}>
                        <span className="flex-1 text-sm font-medium">{products.find((p) => p.id === t.product_id)?.name}</span>
                        <span className="text-sm text-ink-soft">{markets.find((m) => m.id === t.market_id)?.name}</span>
                        <span className={cn('inline-flex items-center gap-2 h-6 px-2.5 rounded-lg text-[11px] font-medium', TEST_STATUS[t.status].cell, TEST_STATUS[t.status].text)}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEST_STATUS[t.status].dot }} />
                          {TEST_STATUS[t.status].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <TestCellDrawer cell={cell} onClose={() => setCell(null)} />
      <MarketManagerModal open={managingMarkets} onClose={() => setManagingMarkets(false)} />
    </div>
  )
}
