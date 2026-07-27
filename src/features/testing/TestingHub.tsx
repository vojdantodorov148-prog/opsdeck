import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Grid3x3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/Bits'
import { getSetting } from '@/services/reference'

export function TestingHub() {
  const { data } = useQuery({
    queryKey: ['setting', 'external_apps'],
    queryFn: () => getSetting<{ creative_testing_calendar?: string }>('external_apps'),
  })
  const calendarUrl = data?.creative_testing_calendar

  return (
    <div className="max-w-[840px]">
      <PageHeader title="Testing" subtitle="Two separate systems. Product testing is here; creative testing is not." />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel p-6">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-teal-50 text-teal-600"><Grid3x3 size={19} /></span>
          <h2 className="mt-4 font-semibold">Product Testing</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Every product against every market. Status, owner, landing, campaign and offer.
          </p>
          <Link to="/testing/products" className="btn-primary mt-4">Open matrix</Link>
        </section>

        <section className="panel p-6">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-panel text-ink-soft"><ExternalLink size={19} /></span>
          <h2 className="mt-4 font-semibold">Creative Testing Calendar</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Concepts, hooks, angles and creative iterations. Runs as its own app.
          </p>
          {calendarUrl ? (
            <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="btn-quiet mt-4">
              Open calendar <ExternalLink size={14} />
            </a>
          ) : (
            <p className="mt-4 text-xs text-ink-soft">Set its URL in Settings to link it up.</p>
          )}
        </section>
      </div>
    </div>
  )
}
