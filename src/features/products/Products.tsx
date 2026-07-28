import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, EmptyState, ErrorNote, Badge } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { deleteProduct, listProducts, listTests, saveProduct } from '@/services/products'
import { listBrands, listMarkets } from '@/services/reference'
import { PRODUCT_STATUS, TEST_STATUS } from '@/lib/status'
import { useSession } from '@/features/auth/session'
import type { Product, ProductStatus } from '@/types/db'

type ProductRow = Product & { brand: { id: string; name: string } | null }

export function Products() {
  const { can } = useSession()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ProductRow | null>(null)
  const { data: products = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })

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
    <div className="max-w-[1100px]">
      <PageHeader
        title="Производи"
        subtitle="Главна база за цени, break-even, трошоци и пазари за секој производ."
        action={can('products.manage') ? <button className="btn-primary" onClick={() => setAdding(true)}>Додај производ</button> : undefined}
      />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : products.length === 0 ? (
        <div className="panel"><EmptyState title="Сѐ уште нема производи" hint="Додај го првиот производ за да започнеш со следење по пазари." /></div>
      ) : (
        <div className="panel overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Производ</th>
                <th className="px-4 py-3 font-semibold">Бренд</th>
                <th className="px-4 py-3 font-semibold text-right">Цена</th>
                <th className="px-4 py-3 font-semibold text-right">Break-even CPA</th>
                <th className="px-4 py-3 font-semibold text-right">COGS</th>
                <th className="px-4 py-3 font-semibold">Пазари</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                {can('products.manage') && <th className="px-3 py-3 font-semibold text-right">Акции</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => {
                const productTests = tests.filter((test) => test.product_id === product.id && test.status !== 'not_tested')
                return (
                  <tr key={product.id} className="row-hover">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/products/${product.id}`} className="hover:text-teal-700">{product.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{product.brand?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.selling_price ? `${product.selling_price} ${product.currency}` : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.break_even_cpa ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.cogs ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {productTests.slice(0, 5).map((test) => {
                          const market = markets.find((item) => item.id === test.market_id)
                          return (
                            <span key={test.id} title={`${market?.name}: ${TEST_STATUS[test.status].label}`}
                              className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-line text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEST_STATUS[test.status].dot }} />
                              {market?.code}
                            </span>
                          )
                        })}
                        {productTests.length === 0 && <span className="text-ink-soft text-xs">Не е тестиран</span>}
                      </div>
                    </td>
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
        description="Ова ќе ги избрише тестовите, линковите и белешките поврзани со производот. Постоечките задачи ќе останат, но без врска до производот."
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
  const [form, setForm] = useState({ name: '', brand_id: '', selling_price: '', break_even_cpa: '', cogs: '', status: 'research' as ProductStatus, main_url: '' })

  const save = useMutation({
    mutationFn: () => saveProduct({
      name: form.name,
      brand_id: form.brand_id || null,
      selling_price: form.selling_price ? Number(form.selling_price) : null,
      break_even_cpa: form.break_even_cpa ? Number(form.break_even_cpa) : null,
      cogs: form.cogs ? Number(form.cogs) : null,
      status: form.status,
      main_url: form.main_url || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Производот е додаден'); onClose() },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Додај производ"
      footer={<div className="flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose}>Откажи</button>
        <button className="btn-primary" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>Додај производ</button>
      </div>}>
      <div className="space-y-3">
        <input className="field" placeholder="Име на производ" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select className="field" value={form.brand_id} onChange={(event) => setForm({ ...form, brand_id: event.target.value })}>
          <option value="">Без бренд</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input className="field" placeholder="Цена" inputMode="decimal" value={form.selling_price} onChange={(event) => setForm({ ...form, selling_price: event.target.value })} />
          <input className="field" placeholder="Break-even CPA" inputMode="decimal" value={form.break_even_cpa} onChange={(event) => setForm({ ...form, break_even_cpa: event.target.value })} />
          <input className="field" placeholder="COGS" inputMode="decimal" value={form.cogs} onChange={(event) => setForm({ ...form, cogs: event.target.value })} />
        </div>
        <input className="field" placeholder="Главен линк на производот" value={form.main_url} onChange={(event) => setForm({ ...form, main_url: event.target.value })} />
        <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}>
          {Object.entries(PRODUCT_STATUS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
      </div>
    </Modal>
  )
}
