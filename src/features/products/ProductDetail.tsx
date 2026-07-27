import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import { Loading, ErrorNote, Badge, EmptyState } from '@/components/ui/Bits'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { TestCellDrawer } from '@/features/testing/TestCellDrawer'
import { getProduct, listTests } from '@/services/products'
import { listMarkets } from '@/services/reference'
import { listTasks } from '@/services/tasks'
import { listNotes } from '@/services/signal'
import { PRODUCT_STATUS, TEST_STATUS } from '@/lib/status'
import { useActions } from '@/app/actions'

const TABS = ['Overview', 'Markets', 'Links', 'Active work', 'Notes'] as const

export function ProductDetail() {
  const { id = '' } = useParams()
  const actions = useActions()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [cell, setCell] = useState<{ productId: string; marketId: string } | null>(null)

  const { data: product, isLoading, error } = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id), enabled: Boolean(id) })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', { product: id }], queryFn: () => listTasks({ product: id }) })
  const { data: notes = [] } = useQuery({ queryKey: ['notes', { product: id }], queryFn: () => listNotes({ productId: id }) })

  if (error) return <ErrorNote error={error} />
  if (isLoading || !product) return <Loading rows={6} />

  const margin = product.selling_price && product.cogs ? product.selling_price - product.cogs : null
  const activeWork = tasks.filter((t) => t.status !== 'done')
  const links = [
    product.main_url ? { id: 'main', label: 'Product page', url: product.main_url } : null,
    product.supplier_url ? { id: 'sup', label: 'Supplier', url: product.supplier_url } : null,
    product.assets_url ? { id: 'as', label: 'Assets', url: product.assets_url } : null,
    ...(product.links ?? []),
  ].filter(Boolean) as { id: string; label: string; url: string }[]

  return (
    <div className="max-w-[1000px]">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-teal-700 mb-4">
        <ArrowLeft size={15} /> Products
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{product.brand?.name ?? 'No brand'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-panel border-line text-ink-soft">{PRODUCT_STATUS[product.status]}</Badge>
          <button className="btn-quiet" onClick={() => actions.open('start-test', { productId: id })}>Start test</button>
          <button className="btn-primary" onClick={() => actions.open('give-task', { productId: id })}>Give task</button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Price" value={product.selling_price ? `${product.selling_price} ${product.currency}` : '—'} />
        <Stat label="Break-even CPA" value={product.break_even_cpa ?? '—'} />
        <Stat label="COGS" value={product.cogs ?? '—'} />
        <Stat label="Gross margin" value={margin !== null ? `${margin.toFixed(2)} ${product.currency}` : '—'} />
      </div>

      <nav className="mt-6 flex gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-10 px-3 text-sm border-b-2 -mb-px transition ${tab === t ? 'border-teal-500 text-teal-700 font-medium' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="pt-5">
        {tab === 'Overview' && (
          <div className="panel p-5 text-sm text-ink-soft whitespace-pre-wrap">
            {product.notes || 'No overview written yet.'}
          </div>
        )}

        {tab === 'Markets' && (
          <div className="panel p-2">
            <ul className="divide-y divide-line">
              {markets.map((m) => {
                const t = tests.find((x) => x.product_id === id && x.market_id === m.id)
                const status = t?.status ?? 'not_tested'
                return (
                  <li key={m.id}>
                    <button className="w-full flex items-center gap-3 py-3 px-2 rounded-xl row-hover text-left"
                      onClick={() => setCell({ productId: id, marketId: m.id })}>
                      <span className="w-8 text-xs font-semibold text-ink-soft">{m.code}</span>
                      <span className="flex-1 text-sm">{m.name}</span>
                      <span className={`inline-flex items-center gap-2 h-6 px-2.5 rounded-lg text-[11px] font-medium ${TEST_STATUS[status].cell} ${TEST_STATUS[status].text}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEST_STATUS[status].dot }} />
                        {TEST_STATUS[status].label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {tab === 'Links' && (
          <div className="panel p-2">
            {links.length === 0 ? <EmptyState title="No links yet" hint="Add a product page, supplier or assets folder." /> : (
              <ul className="divide-y divide-line">
                {links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 py-3 px-2 rounded-xl row-hover text-sm">
                      <span className="flex-1">{l.label}</span>
                      <span className="text-ink-soft truncate max-w-[280px]">{l.url}</span>
                      <ExternalLink size={14} className="text-ink-soft" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'Active work' && (
          <div className="panel p-2">
            {activeWork.length === 0
              ? <EmptyState title="Nothing in production" hint="Work assigned against this product appears here." />
              : <TaskList tasks={activeWork} onOpen={setOpenTask} />}
          </div>
        )}

        {tab === 'Notes' && (
          <div className="panel p-5 space-y-3">
            <button className="btn-quiet" onClick={() => actions.open('add-note', { productId: id })}>Add note</button>
            {notes.length === 0 ? <p className="text-sm text-ink-soft">No notes on this product yet.</p> : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-1.5 text-[11px] text-ink-soft">{new Date(n.created_at).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
      <TestCellDrawer cell={cell} onClose={() => setCell(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
