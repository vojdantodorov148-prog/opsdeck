import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Loading, ErrorNote, Badge, EmptyState } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { TestCellDrawer } from '@/features/testing/TestCellDrawer'
import { deleteProduct, getProduct, listTests, saveProduct } from '@/services/products'
import { listBrands, listMarkets } from '@/services/reference'
import { listTasks } from '@/services/tasks'
import { listNotes } from '@/services/signal'
import { PRODUCT_STATUS, TEST_STATUS } from '@/lib/status'
import { useActions } from '@/app/actions'
import { useSession } from '@/features/auth/session'
import { toast } from 'sonner'
import type { ProductStatus } from '@/types/db'

const TABS = ['Преглед', 'Пазари', 'Линкови', 'Активна работа', 'Белешки'] as const

export function ProductDetail() {
  const { id = '' } = useParams()
  const actions = useActions()
  const { can } = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Преглед')
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [cell, setCell] = useState<{ productId: string; marketId: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: product, isLoading, error } = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id), enabled: Boolean(id) })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', { product: id }], queryFn: () => listTasks({ product: id }) })
  const { data: notes = [] } = useQuery({ queryKey: ['notes', { product: id }], queryFn: () => listNotes({ productId: id }) })

  const remove = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['tests'] })
      toast.success('Производот е избришан')
      navigate('/products')
    },
    onError: (deleteError: Error) => toast.error(deleteError.message),
  })

  if (error) return <ErrorNote error={error} />
  if (isLoading || !product) return <Loading rows={6} />

  const margin = product.selling_price && product.cogs ? product.selling_price - product.cogs : null
  const activeWork = tasks.filter((t) => t.status !== 'done')
  const links = [
    product.main_url ? { id: 'main', label: 'Продукт страница', url: product.main_url } : null,
    product.supplier_url ? { id: 'sup', label: 'Supplier', url: product.supplier_url } : null,
    product.assets_url ? { id: 'as', label: 'Assets', url: product.assets_url } : null,
    ...(product.links ?? []),
  ].filter(Boolean) as { id: string; label: string; url: string }[]

  return (
    <div className="max-w-[1000px]">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-teal-700 mb-4">
        <ArrowLeft size={15} /> Производи
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{product.brand?.name ?? 'Без бренд'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-panel border-line text-ink-soft">{PRODUCT_STATUS[product.status]}</Badge>
          {can('products.manage') && (
            <>
              <button className="btn-quiet" onClick={() => setEditing(true)}><Pencil size={14} /> Измени</button>
              <button className="btn-ghost h-10 w-10 px-0 text-ink-soft hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Избриши производ" title="Избриши производ">
                <Trash2 size={16} />
              </button>
            </>
          )}
          <button className="btn-quiet" onClick={() => actions.open('start-test', { productId: id })}>Започни тест</button>
          <button className="btn-primary" onClick={() => actions.open('give-task', { productId: id })}>Додели задача</button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="SKU" value={product.sku ?? '—'} />
        <Stat label="Продажна" value={product.selling_price ? `${product.selling_price} ${product.currency}` : '—'} />
        <Stat label="Break-even CPA" value={product.break_even_cpa ?? '—'} />
        <Stat label="Набавна (COGS)" value={product.cogs ?? '—'} />
        <Stat label="Бруто маржа" value={margin !== null ? `${margin.toFixed(2)} ${product.currency}` : '—'} />
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
        {tab === 'Преглед' && (
          <div className="panel p-5 text-sm text-ink-soft whitespace-pre-wrap">
            {product.notes || 'Сѐ уште нема внесен преглед.'}
          </div>
        )}

        {tab === 'Пазари' && (
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

        {tab === 'Линкови' && (
          <div className="panel p-2">
            {links.length === 0 ? <EmptyState title="Сѐ уште нема линкови" hint="Додај продукт страница, добавувач или папка со материјали." /> : (
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

        {tab === 'Активна работа' && (
          <div className="panel p-2">
            {activeWork.length === 0
              ? <EmptyState title="Нема активна продукција" hint="Работата поврзана со овој производ ќе се појави тука." />
              : <TaskList tasks={activeWork} onOpen={setOpenTask} />}
          </div>
        )}

        {tab === 'Белешки' && (
          <div className="panel p-5 space-y-3">
            <button className="btn-quiet" onClick={() => actions.open('add-note', { productId: id })}>Додај белешка</button>
            {notes.length === 0 ? <p className="text-sm text-ink-soft">Сѐ уште нема белешки за овој производ.</p> : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-1.5 text-[11px] text-ink-soft">{new Date(n.created_at).toLocaleDateString('mk-MK')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
      <TestCellDrawer cell={cell} onClose={() => setCell(null)} />
      <EditProductModal open={editing} onClose={() => setEditing(false)} product={product} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Избриши производ"
        description="Оваа акција е трајна. Тестовите, линковите и белешките за производот ќе бидат избришани."
        footer={<div className="flex justify-end gap-2">
          <button className="btn-quiet" onClick={() => setConfirmDelete(false)}>Откажи</button>
          <button className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Се брише…' : 'Избриши трајно'}
          </button>
        </div>}
      >
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">Сигурно сакаш да го избришеш <strong>{product.name}</strong>?</p>
      </Modal>
    </div>
  )
}

function EditProductModal({ open, onClose, product }: {
  open: boolean
  onClose: () => void
  product: {
    id: string; name: string; sku: string | null; brand_id: string | null; selling_price: number | null
    break_even_cpa: number | null; cogs: number | null; status: ProductStatus; main_url: string | null
  }
}) {
  const qc = useQueryClient()
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands, enabled: open })
  const [form, setForm] = useState(() => ({
    name: product.name, sku: product.sku ?? '', brand_id: product.brand_id ?? '',
    selling_price: product.selling_price?.toString() ?? '', break_even_cpa: product.break_even_cpa?.toString() ?? '',
    cogs: product.cogs?.toString() ?? '', status: product.status, main_url: product.main_url ?? '',
  }))

  useEffect(() => {
    if (!open) return
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      brand_id: product.brand_id ?? '',
      selling_price: product.selling_price?.toString() ?? '',
      break_even_cpa: product.break_even_cpa?.toString() ?? '',
      cogs: product.cogs?.toString() ?? '',
      status: product.status,
      main_url: product.main_url ?? '',
    })
  }, [open, product])

  const save = useMutation({
    mutationFn: () => saveProduct({
      id: product.id,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      brand_id: form.brand_id || null,
      selling_price: form.selling_price ? Number(form.selling_price) : null,
      break_even_cpa: form.break_even_cpa ? Number(form.break_even_cpa) : null,
      cogs: form.cogs ? Number(form.cogs) : null,
      status: form.status,
      main_url: form.main_url.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', product.id] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Податоците за производот се зачувани')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Измени производ"
      footer={<div className="flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose}>Откажи</button>
        <button className="btn-primary" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Зачувај</button>
      </div>}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-3">
          <input className="field" placeholder="Име на производ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <select className="field" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
          <option value="">Без бренд</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input className="field" placeholder="Продажна" inputMode="decimal" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <input className="field" placeholder="Break-even CPA" inputMode="decimal" value={form.break_even_cpa} onChange={(e) => setForm({ ...form, break_even_cpa: e.target.value })} />
          <input className="field" placeholder="Набавна (COGS)" inputMode="decimal" value={form.cogs} onChange={(e) => setForm({ ...form, cogs: e.target.value })} />
        </div>
        <input className="field" placeholder="Главен линк на производот" value={form.main_url} onChange={(e) => setForm({ ...form, main_url: e.target.value })} />
        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
          {Object.entries(PRODUCT_STATUS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
      </div>
    </Modal>
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
