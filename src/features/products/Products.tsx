import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, EmptyState, ErrorNote, Badge } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { createProductBundle, deleteProduct, listProducts, type ProductAngleInput, type ProductHeadlineInput, type ProductWithRelations } from '@/services/products'
import { listBrands } from '@/services/reference'
import { PRODUCT_STATUS } from '@/lib/status'
import { useSession } from '@/features/auth/session'
import type { ProductStatus } from '@/types/db'

function brandDisplayName(slug: string | undefined, name: string) {
  if (slug === 'alpine-patches') return 'Alpine'
  if (slug === 'veterce') return 'Ветерче'
  return name
}

export function Products() {
  const { can } = useSession()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ProductWithRelations | null>(null)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const { data: products = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands })

  const brandOptions = useMemo(() => {
    const priority = ['alpine-patches', 'origon', 'veterce']
    return brands
      .filter((brand) => brand.active)
      .map((brand) => ({
        id: brand.id, name: brand.name, slug: brand.slug,
        count: products.filter((product) => product.brand_id === brand.id).length,
      }))
      .sort((a, b) => {
        const ai = priority.indexOf(a.slug)
        const bi = priority.indexOf(b.slug)
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        return a.name.localeCompare(b.name)
      })
  }, [brands, products])

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter((product) => {
      if (brandFilter !== 'all' && product.brand_id !== brandFilter) return false
      if (!needle) return true
      return [product.name, product.sku, product.brand?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [products, search, brandFilter])

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['tests'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Производот е избришан')
      setDeleting(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="max-w-[1180px]">
      <PageHeader
        title="Производи"
        subtitle="Продукт библиотека по бренд — со бриф, агли, Ad headlines, слики и клучни бројки."
        action={can('products.manage') ? <button className="btn-primary" onClick={() => setAdding(true)}>Додај производ</button> : undefined}
      />

      {!isLoading && !error && products.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBrandFilter('all')}
              className={`rounded-2xl border px-4 py-3 text-left min-w-[128px] transition ${brandFilter === 'all' ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-line bg-surface hover:bg-panel'}`}
            >
              <span className="block text-[11px] uppercase tracking-wide text-ink-soft">Сите</span>
              <span className="mt-0.5 block text-lg font-semibold tabular-nums">{products.length}</span>
            </button>
            {brandOptions.map((brand) => (
              <button
                key={brand.id}
                onClick={() => setBrandFilter(brand.id)}
                className={`rounded-2xl border px-4 py-3 text-left min-w-[128px] transition ${brandFilter === brand.id ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-line bg-surface hover:bg-panel'}`}
              >
                <span className="block text-[11px] uppercase tracking-wide text-ink-soft">Бренд</span>
                <span className="mt-0.5 block font-semibold">{brandDisplayName(brand.slug, brand.name)} <span className="text-ink-soft font-normal">({brand.count})</span></span>
              </button>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              className="field pl-9"
              placeholder="Пребарај по име, SKU или бренд…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      )}

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : products.length === 0 ? (
        <div className="panel"><EmptyState title="Сѐ уште нема производи" hint="Додај го првиот производ за да започнеш со работа." /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="panel"><EmptyState title="Нема резултати" hint="Пробај друг збор или избери друг бренд." /></div>
      ) : (
        <div className="panel overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Производ</th>
                <th className="px-4 py-3 font-semibold">Бренд</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold text-right">Продажна</th>
                <th className="px-4 py-3 font-semibold text-right">Break-even CPA</th>
                <th className="px-4 py-3 font-semibold text-right">Набавна</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                {can('products.manage') && <th className="px-3 py-3 font-semibold text-right">Акции</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredProducts.map((product) => {
                const image = product.images[0]?.public_url
                return (
                  <tr key={product.id} className="row-hover">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/products/${product.id}`} className="flex min-w-[230px] items-center gap-3 hover:text-teal-700">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel">
                          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={17} className="text-ink-soft/60" />}
                        </span>
                        <span className="line-clamp-2 leading-5">{product.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{product.brand ? brandDisplayName(product.brand.slug, product.brand.name) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{product.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.selling_price ? `${product.selling_price} ${product.currency}` : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.break_even_cpa ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.cogs ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className="bg-panel border-line text-ink-soft">{PRODUCT_STATUS[product.status]}</Badge></td>
                    {can('products.manage') && (
                      <td className="px-3 py-3 text-right">
                        <button
                          className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft/55 hover:bg-red-50 hover:text-red-600 transition"
                          aria-label={`Избриши ${product.name}`}
                          title="Избриши производ"
                          onClick={() => setDeleting(product)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddProductModal open={adding} onClose={() => setAdding(false)} />
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Избриши производ"
        description="Ова ќе ги избрише и сликите, аглите, Ad headlines, тестовите, линковите и белешките поврзани со производот."
        footer={<div className="flex justify-end gap-2">
          <button className="btn-quiet" onClick={() => setDeleting(null)}>Откажи</button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            disabled={!deleting || remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id)}
          >
            {remove.isPending ? 'Се брише…' : 'Избриши трајно'}
          </button>
        </div>}
      >
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
          Сигурно сакаш да го избришеш <strong>{deleting?.name}</strong>?
        </div>
      </Modal>
    </div>
  )
}

function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands, enabled: open })
  const [form, setForm] = useState({
    name: '', sku: '', brand_id: '', selling_price: '', break_even_cpa: '', cogs: '',
    status: 'research' as ProductStatus, main_url: '', brief: '',
  })
  const [angles, setAngles] = useState<ProductAngleInput[]>([])
  const [headlines, setHeadlines] = useState<ProductHeadlineInput[]>([])
  const [images, setImages] = useState<File[]>([])

  useEffect(() => {
    if (open) return
    setForm({ name: '', sku: '', brand_id: '', selling_price: '', break_even_cpa: '', cogs: '', status: 'research', main_url: '', brief: '' })
    setAngles([])
    setHeadlines([])
    setImages([])
  }, [open])

  const save = useMutation({
    mutationFn: () => createProductBundle({
      product: {
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
      headlines,
      images,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Производот е додаден')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const valid = Boolean(form.name.trim() && form.brand_id && form.brief.trim() && images.length)

  return (
    <Modal open={open} onClose={onClose} title="Додај производ" description="Бриф и најмалку една продукт слика се задолжителни." width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">* Задолжително: име, бренд, бриф и слика</p>
        <div className="flex gap-2">
          <button className="btn-quiet" onClick={onClose}>Откажи</button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Се зачувува…' : 'Додај производ'}</button>
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
        <HeadlineEditor headlines={headlines} onChange={setHeadlines} />
        <ImagePicker files={images} onChange={setImages} />
      </div>
    </Modal>
  )
}

export function AngleEditor({ angles, onChange }: { angles: ProductAngleInput[]; onChange: (angles: ProductAngleInput[]) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Агли <span className="normal-case font-normal">(опционално)</span></p>
          <p className="mt-1 text-xs text-ink-soft">Додај онолку различни маркетинг агли колку што ти треба.</p>
        </div>
        <button className="btn-quiet" type="button" onClick={() => onChange([...angles, { title: '', body: '' }])}><Plus size={14} /> Додај агол</button>
      </div>
      {angles.map((angle, index) => (
        <div key={index} className="rounded-2xl border border-line bg-panel/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              className="field flex-1"
              placeholder={`Име на агол ${index + 1}`}
              value={angle.title}
              onChange={(event) => onChange(angles.map((item, i) => i === index ? { ...item, title: event.target.value } : item))}
            />
            <button className="btn-ghost h-10 w-10 px-0 text-ink-soft hover:text-red-600" type="button" onClick={() => onChange(angles.filter((_, i) => i !== index))} aria-label="Тргни агол"><X size={16} /></button>
          </div>
          <textarea
            className="field min-h-[105px] resize-y"
            placeholder="Опис / идеја за овој агол…"
            value={angle.body}
            onChange={(event) => onChange(angles.map((item, i) => i === index ? { ...item, body: event.target.value } : item))}
          />
        </div>
      ))}
      {!angles.length && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">Нема додадени агли.</div>}
    </section>
  )
}

export function HeadlineEditor({ headlines, onChange }: { headlines: ProductHeadlineInput[]; onChange: (headlines: ProductHeadlineInput[]) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ad headline опции <span className="normal-case font-normal">(опционално)</span></p>
          <p className="mt-1 text-xs text-ink-soft">Зачувај headline опции што потоа можат директно да се изберат при доделување статичен оглас.</p>
        </div>
        <button className="btn-quiet" type="button" onClick={() => onChange([...headlines, { headline: '' }])}><Plus size={14} /> Додај headline</button>
      </div>
      {headlines.map((item, index) => (
        <div key={index} className="flex items-center gap-2 rounded-2xl border border-line bg-panel/40 p-3">
          <input
            className="field flex-1"
            placeholder={`Ad headline ${index + 1}`}
            value={item.headline}
            onChange={(event) => onChange(headlines.map((value, i) => i === index ? { ...value, headline: event.target.value } : value))}
          />
          <button className="btn-ghost h-10 w-10 px-0 text-ink-soft hover:text-red-600" type="button" onClick={() => onChange(headlines.filter((_, i) => i !== index))} aria-label="Тргни headline"><X size={16} /></button>
        </div>
      ))}
      {!headlines.length && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">Нема додадени Ad headline опции.</div>}
    </section>
  )
}

export function ImagePicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Слики на производ *</p>
        <p className="mt-1 text-xs text-ink-soft">Најмалку една. Првата слика ќе биде thumbnail во Производи. Максимум 10 MB по слика.</p>
      </div>
      <label className="flex min-h-[92px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-panel/30 px-4 text-sm text-ink-soft hover:border-teal-300 hover:bg-teal-50/40 transition">
        <ImageIcon size={18} /> Додај една или повеќе слики
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
            if (selected.length) onChange([...files, ...selected])
            event.currentTarget.value = ''
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {files.map((file, index) => (
            <NewImageThumb key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => onChange(files.filter((_, i) => i !== index))} primary={index === 0} />
          ))}
        </div>
      )}
    </section>
  )
}

export function NewImageThumb({ file, onRemove, primary = false }: { file: File; onRemove: () => void; primary?: boolean }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-panel">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {primary && <span className="absolute bottom-1 left-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[9px] font-medium text-white">Главна</span>}
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-ink shadow-sm opacity-0 group-hover:opacity-100 transition" aria-label="Тргни слика"><X size={14} /></button>
    </div>
  )
}
