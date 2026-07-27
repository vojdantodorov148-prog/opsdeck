import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Loading, ErrorNote, Progress, EmptyState } from '@/components/ui/Bits'
import { getCompanyVision, listMetrics, listObjectives, listPlans } from '@/services/vision'
import { listBrands } from '@/services/reference'
import { listTests } from '@/services/products'
import { cn } from '@/lib/cn'
import type { PlanHorizon } from '@/types/db'

const HORIZONS: { key: PlanHorizon; label: string }[] = [
  { key: 'now', label: 'Now' }, { key: 'next', label: 'Next' }, { key: 'later', label: 'Later' },
]

export function VisionCenter() {
  const [brandId, setBrandId] = useState<string | null>(null)

  const { data: brands = [], isLoading, error } = useQuery({ queryKey: ['brands'], queryFn: listBrands })
  const { data: vision } = useQuery({ queryKey: ['vision'], queryFn: getCompanyVision })
  const { data: objectives = [] } = useQuery({ queryKey: ['objectives', brandId], queryFn: () => listObjectives(brandId ?? undefined) })
  const { data: plans = [] } = useQuery({ queryKey: ['plans', brandId], queryFn: () => listPlans(brandId as string), enabled: Boolean(brandId) })
  const { data: metrics = [] } = useQuery({ queryKey: ['metrics', brandId], queryFn: () => listMetrics(brandId as string), enabled: Boolean(brandId) })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })

  if (error) return <ErrorNote error={error} />
  if (isLoading) return <Loading rows={5} />

  const brand = brands.find((b) => b.id === brandId)
  const latest = metrics[0]

  return (
    <div className="max-w-[900px]">
      <PageHeader
        title={brand ? brand.name : 'Vision Center'}
        subtitle={brand ? 'Where this brand is going.' : 'Operational pages answer what we are doing. This answers where we are going.'}
        action={brand ? <button className="btn-quiet" onClick={() => setBrandId(null)}>All brands</button> : undefined}
      />

      {!brand ? (
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">North star</h2>
            <p className="mt-2 text-lg leading-snug">{vision?.north_star ?? 'Not written yet.'}</p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Brands</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {brands.map((b) => (
                <button key={b.id} onClick={() => setBrandId(b.id)} className="panel p-5 text-left hover:border-teal-200 transition">
                  <p className="font-semibold">{b.name}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {objectives.filter((o) => o.brand_id === b.id && o.status === 'active').length} active objectives
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Company objectives</h2>
            <ObjectiveList objectives={objectives.filter((o) => !o.brand_id)} />
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Revenue" value={latest?.revenue} />
            <Metric label="Profit" value={latest?.profit} />
            <Metric label="Ad spend" value={latest?.ad_spend} />
            <Metric label="Active markets" value={tests.filter((t) => t.status === 'testing' || t.status === 'winner').length} raw />
          </section>
          {!latest && (
            <p className="text-xs text-ink-soft -mt-3">
              No figures entered for this period yet. Ops Deck does not invent numbers — connect Shopify or enter them manually.
            </p>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Objectives</h2>
            <ObjectiveList objectives={objectives} />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {HORIZONS.map((h) => (
              <div key={h.key} className="panel p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{h.label}</h3>
                <ul className="mt-3 space-y-2">
                  {plans.filter((p) => p.horizon === h.key).map((p) => (
                    <li key={p.id} className="text-sm">{p.title}</li>
                  ))}
                  {plans.filter((p) => p.horizon === h.key).length === 0 && <li className="text-sm text-ink-soft">Nothing here.</li>}
                </ul>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function ObjectiveList({ objectives }: { objectives: { id: string; title: string; description: string | null; progress: number; status: string }[] }) {
  if (objectives.length === 0) return <div className="panel"><EmptyState title="No objectives set" /></div>
  return (
    <ul className="space-y-3">
      {objectives.map((o) => (
        <li key={o.id} className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{o.title}</p>
              {o.description && <p className="mt-0.5 text-sm text-ink-soft">{o.description}</p>}
            </div>
            <span className={cn('text-sm font-semibold tabular-nums', o.status === 'at_risk' ? 'text-[#A0522D]' : 'text-teal-600')}>
              {o.progress}%
            </span>
          </div>
          <Progress value={o.progress} className="mt-3" />
        </li>
      ))}
    </ul>
  )
}

function Metric({ label, value, raw }: { label: string; value: number | null | undefined; raw?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {value === null || value === undefined ? '—' : raw ? value : value.toLocaleString()}
      </p>
    </div>
  )
}
