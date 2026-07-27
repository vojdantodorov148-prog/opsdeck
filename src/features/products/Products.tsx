import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader, Loading, EmptyState, ErrorNote, Badge } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { listProducts, listTests, saveProduct } from '@/services/products'
import { listBrands, listMarkets } from '@/services/reference'
import { PRODUCT_STATUS, TEST_STATUS } from '@/lib/status'
import { useSession } from '@/features/auth/session'
import type { ProductStatus } from '@/types/db'

export function Products() {
  const { can } = useSession()
  const [adding, setAdding] = useState(false)
  const { data: products = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Products"
        subtitle="The source of truth for pricing, margins and where each product is being sold."
        action={can('products.manage') ? <button className="btn-primary" onClick={() => setAdding(true)}>Add product</button> : undefined}
      />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : products.length === 0 ? (
        <div className="panel"><EmptyState title="No products yet" hint="Add the first one to start tracking markets." /></div>
      ) : (
        <div className="panel overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
                <th className="px-4 py-3 font-semibold text-right">Break-even CPA</th>
                <th className="px-4 py-3 font-semibold text-right">COGS</th>
                <th className="px-4 py-3 font-semibold">Markets</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const mine = tests.filter((t) => t.product_id === p.id && t.status !== 'not_tested')
                return (
                  <tr key={p.id} className="row-hover">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/products/${p.id}`} className="hover:text-teal-700">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.brand?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.selling_price ? `${p.selling_price} ${p.currency}` : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.break_even_cpa ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.cogs ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {mine.slice(0, 5).map((t) => {
                          const market = markets.find((m) => m.id === t.market_id)
                          return (
                            <span key={t.id} title={`${market?.name}: ${TEST_STATUS[t.status].label}`}
                              className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-line text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEST_STATUS[t.status].dot }} />
                              {market?.code}
                            </span>
                          )
                        })}
                        {mine.length === 0 && <span className="text-ink-soft text-xs">Not tested</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge className="bg-panel border-line text-ink-soft">{PRODUCT_STATUS[p.status]}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddProductModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands, enabled: open })
  const [form, setForm] = useState({ name: '', brand_id: '', selling_price: '', break_even_cpa: '', cogs: '', status: 'research' as ProductStatus, main_url: '' })

  const save = useMutation({
    mutationFn: () =>
      saveProduct({
        name: form.name,
        brand_id: form.brand_id || null,
        selling_price: form.selling_price ? Number(form.selling_price) : null,
        break_even_cpa: form.break_even_cpa ? Number(form.break_even_cpa) : null,
        cogs: form.cogs ? Number(form.cogs) : null,
        status: form.status,
        main_url: form.main_url || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product added'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Add product"
      footer={<div className="flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>Add product</button>
      </div>}>
      <div className="space-y-3">
        <input className="field" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="field" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
          <option value="">No brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input className="field" placeholder="Price" inputMode="decimal" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <input className="field" placeholder="Break-even CPA" inputMode="decimal" value={form.break_even_cpa} onChange={(e) => setForm({ ...form, break_even_cpa: e.target.value })} />
          <input className="field" placeholder="COGS" inputMode="decimal" value={form.cogs} onChange={(e) => setForm({ ...form, cogs: e.target.value })} />
        </div>
        <input className="field" placeholder="Main product page URL" value={form.main_url} onChange={(e) => setForm({ ...form, main_url: e.target.value })} />
        <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
          {Object.entries(PRODUCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </Modal>
  )
}
