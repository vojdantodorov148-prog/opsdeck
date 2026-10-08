import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ArrowLeft, ImageIcon, Pencil, Trash2, X } from 'lucide-react'
import { Loading, ErrorNote, Badge, EmptyState } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { TestCellDrawer } from '@/features/testing/TestCellDrawer'
import { AngleEditor, ImagePicker } from '@/features/products/Products'
import { deleteProduct, getProduct, listTests, updateProductBundle, type ProductAngleInput, type ProductWithRelations } from '@/services/products'
import { listBrands, listMarkets } from '@/services/reference'
import { listTasks } from '@/services/tasks'
import { listNotes } from '@/services/signal'
import { PRODUCT_STATUS, TEST_STATUS } from '@/lib/status'
import { useActions } from '@/app/actions'
import { useSession } from '@/features/auth/session'
import { toast } from 'sonner'
import type { ProductImage, ProductStatus } from '@/types/db'

const TABS = ['Преглед', 'Пазари', 'Линкови', 'Активна работа', 'Белешки'] as const

function brandDisplayName(slug: string | undefined, name: string) {
  if (slug === 'alpine-patches') return 'Alpine'
  if (slug === 'veterce') return 'Ветерче'
  return name
}

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
  const activeWork = tasks.filter((task) => task.status !== 'done')
  const links = [
    product.main_url ? { id: 'main', label: 'Продукт страница', url: product.main_url } : null,
    product.supplier_url ? { id: 'sup', label: 'Supplier', url: product.supplier_url } : null,
    product.assets_url ? { id: 'as', label: 'Assets', url: product.assets_url } : null,
    ...(product.links ?? []),
  ].filter(Boolean) as { id: string; label: string; url: string }[]

  return (
    <div className="max-w-[1040px]">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-teal-700 mb-4">
        <ArrowLeft size={15} /> Производи
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-panel">
            {product.images[0]?.public_url
              ? <img src={product.images[0].public_url} alt="" className="h-full w-full object-cover" />
              : <ImageIcon size={20} className="text-ink-soft/60" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight">{product.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">{product.brand ? brandDisplayName(product.brand.slug, product.brand.name) : 'Без бренд'}</p>
          </div>
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
        {TABS.map((tabName) => (
          <button
            key={tabName} role="tab" aria-selected={tab === tabName}
            onClick={() => setTab(tabName)}
            className={`h-10 px-3 text-sm border-b-2 -mb-px transition ${tab === tabName ? 'border-teal-500 text-teal-700 font-medium' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {tabName}
          </button>
        ))}
      </nav>

      <div className="pt-5">
        {tab === 'Преглед' && (
          <div className="space-y-4">
            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold">Слики на производ</h2>
                  <p className="mt-0.5 text-xs text-ink-soft">Првата слика е thumbnail во листата Производи.</p>
                </div>
                <span className="text-xs text-ink-soft">{product.images.length} слики</span>
              </div>
              {product.images.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {product.images.map((image, index) => (
                    <div key={image.id} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-panel">
                      <img src={image.public_url} alt={image.alt_text ?? product.name} className="h-full w-full object-cover" />
                      {index === 0 && <span className="absolute bottom-2 left-2 rounded-lg bg-ink/75 px-2 py-1 text-[10px] font-medium text-white">Главна</span>}
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Нема слика" hint="Измени го производот и додади најмалку една слика." />}
            </section>

            <section className="panel p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Бриф</p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{product.brief || 'Сѐ уште нема внесен бриф.'}</div>
            </section>

            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Агли</p>
                <span className="text-xs text-ink-soft">{product.angles?.length ?? 0}</span>
              </div>
              {product.angles?.length ? (
                <div className="mt-3 space-y-3">
                  {product.angles.map((angle, index) => (
                    <div key={angle.id} className="rounded-2xl border border-line bg-panel/45 p-4">
                      <p className="font-medium">{angle.title || `Агол ${index + 1}`}</p>
                      {angle.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{angle.body}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-ink-soft">Нема додадени агли.</p>}
            </section>

            {product.notes && (
              <section className="panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Дополнителни белешки</p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{product.notes}</div>
              </section>
            )}
          </div>
        )}

        {tab === 'Пазари' && (
          <div className="panel p-2">
            <ul className="divide-y divide-line">
              {markets.map((market) => {
                const test = tests.find((item) => item.product_id === id && item.market_id === market.id)
                const status = test?.status ?? 'not_tested'
                return (
                  <li key={market.id}>
                    <button className="w-full flex items-center gap-3 py-3 px-2 rounded-xl row-hover text-left"
                      onClick={() => setCell({ productId: id, marketId: market.id })}>
                      <span className="w-8 text-xs font-semibold text-ink-soft">{market.code}</span>
                      <span className="flex-1 text-sm">{market.name}</span>
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
                {links.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 py-3 px-2 rounded-xl row-hover text-sm">
                      <span className="flex-1">{link.label}</span>
                      <span className="text-ink-soft truncate max-w-[280px]">{link.url}</span>
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
                {notes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="mt-1.5 text-[11px] text-ink-soft">{new Date(note.created_at).toLocaleDateString('mk-MK')}</p>
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
        description="Оваа акција е трајна. Сликите, аглите, тестовите, линковите и белешките за производот ќе бидат избришани."
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

function EditProductModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: ProductWithRelations }) {
  const qc = useQueryClient()
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands, enabled: open })
  const [form, setForm] = useState(() => ({
    name: product.name, sku: product.sku ?? '', brand_id: product.brand_id ?? '',
    selling_price: product.selling_price?.toString() ?? '', break_even_cpa: product.break_even_cpa?.toString() ?? '',
    cogs: product.cogs?.toString() ?? '', status: product.status, main_url: product.main_url ?? '', brief: product.brief ?? '',
  }))
  const [angles, setAngles] = useState<ProductAngleInput[]>(() => (product.angles ?? []).map((angle) => ({ id: angle.id, title: angle.title, body: angle.body })))
  const [newImages, setNewImages] = useState<File[]>([])
  const [removedImages, setRemovedImages] = useState<ProductImage[]>([])

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
      brief: product.brief ?? '',
    })
    setAngles((product.angles ?? []).map((angle) => ({ id: angle.id, title: angle.title, body: angle.body })))
    setNewImages([])
    setRemovedImages([])
  }, [open, product])

  const remainingImages = product.images.filter((image) => !removedImages.some((removed) => removed.id === image.id))
  const finalImageCount = remainingImages.length + newImages.length

  const save = useMutation({
    mutationFn: () => updateProductBundle({
      product: {
        id: product.id,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        brand_id: form.brand_id,
        selling_price: form.selling_price ? Number(form.selling_price) : null,
        break_even_cpa: form.break_even_cpa ? Number(form.break_even_cpa) : null,
        cogs: form.cogs ? Number(form.cogs) : null,
        status: form.status,
        main_url: form.main_url.trim() || null,
        brief: form.brief.trim(),
      },
      angles,
      newImages,
      removeImages: removedImages,
      currentImageCount: product.images.length,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', product.id] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Податоците за производот се зачувани')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const valid = Boolean(form.name.trim() && form.brand_id && form.brief.trim() && finalImageCount > 0)

  return (
    <Modal open={open} onClose={onClose} title="Измени производ" description="Бриф и најмалку една продукт слика се задолжителни." width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">Слики по зачувување: {finalImageCount}</p>
        <div className="flex gap-2">
          <button className="btn-quiet" onClick={onClose}>Откажи</button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Се зачувува…' : 'Зачувај'}</button>
        </div>
      </div>}>
      <div className="space-y-5">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Основни податоци</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-3">
            <input className="field" placeholder="Име на производ *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="field" placeholder="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
          </div>
          <select className="field" value={form.brand_id} onChange={(event) => setForm({ ...form, brand_id: event.target.value })}>
            <option value="">Одбери бренд *</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brandDisplayName(brand.slug, brand.name)}</option>)}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className="field" placeholder="Продажна" inputMode="decimal" value={form.selling_price} onChange={(event) => setForm({ ...form, selling_price: event.target.value })} />
            <input className="field" placeholder="Break-even CPA" inputMode="decimal" value={form.break_even_cpa} onChange={(event) => setForm({ ...form, break_even_cpa: event.target.value })} />
            <input className="field" placeholder="Набавна (COGS)" inputMode="decimal" value={form.cogs} onChange={(event) => setForm({ ...form, cogs: event.target.value })} />
          </div>
          <input className="field" placeholder="Главен линк на производот" value={form.main_url} onChange={(event) => setForm({ ...form, main_url: event.target.value })} />
          <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}>
            {Object.entries(PRODUCT_STATUS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
          </select>
        </section>

        <section className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Бриф *</p>
            <p className="mt-1 text-xs text-ink-soft">Главниот опис и позиционирање на продуктот.</p>
          </div>
          <textarea className="field min-h-[150px] resize-y" placeholder="Внеси го целосниот бриф за производот…" value={form.brief} onChange={(event) => setForm({ ...form, brief: event.target.value })} />
        </section>

        <AngleEditor angles={angles} onChange={setAngles} />

        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Постоечки слики</p>
            <p className="mt-1 text-xs text-ink-soft">Првата преостаната слика останува thumbnail.</p>
          </div>
          {remainingImages.length ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {remainingImages.map((image, index) => (
                <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-panel">
                  <img src={image.public_url} alt="" className="h-full w-full object-cover" />
                  {index === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[9px] font-medium text-white">Главна</span>}
                  <button
                    type="button"
                    onClick={() => setRemovedImages([...removedImages, image])}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-ink shadow-sm opacity-0 group-hover:opacity-100 transition"
                    aria-label="Тргни слика"
                  ><X size={14} /></button>
                </div>
              ))}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">Нема преостанати постоечки слики.</div>}
        </section>

        <ImagePicker files={newImages} onChange={setNewImages} />
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
