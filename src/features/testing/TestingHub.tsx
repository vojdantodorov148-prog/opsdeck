import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Grid3x3, BrainCircuit, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { getSetting } from '@/services/reference'
import { useSession } from '@/features/auth/session'
import { supabase } from '@/lib/supabase'

interface ExternalApps {
  creative_testing_calendar?: string
  marketing_intelligence?: string
}

export function TestingHub() {
  const { can } = useSession()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [calendar, setCalendar] = useState('')
  const [intelligence, setIntelligence] = useState('')

  const { data } = useQuery({
    queryKey: ['setting', 'external_apps'],
    queryFn: () => getSetting<ExternalApps>('external_apps'),
  })

  useEffect(() => {
    setCalendar(data?.creative_testing_calendar ?? '')
    setIntelligence(data?.marketing_intelligence ?? 'https://marketron-mi.pages.dev/#operator')
  }, [data])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'external_apps',
        value: { creative_testing_calendar: calendar, marketing_intelligence: intelligence },
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['setting', 'external_apps'] })
      toast.success('Линковите се зачувани')
      setEditing(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-[980px]">
      <PageHeader
        title="Тестирање"
        subtitle="Три јасно одделени системи за продукт, креативи и маркетинг анализа."
        action={can('settings.manage') ? <button className="btn-quiet" onClick={() => setEditing(true)}><Pencil size={14} /> Измени линкови</button> : undefined}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <section className="panel p-6">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-teal-50 text-teal-600"><Grid3x3 size={19} /></span>
          <h2 className="mt-4 font-semibold">Продукт тестирање</h2>
          <p className="mt-1 text-sm text-ink-soft">Секој продукт во секој маркет: планиран, во подготовка, активен тест или победник.</p>
          <Link to="/testing/products" className="btn-primary mt-4">Отвори матрица</Link>
        </section>

        <ExternalCard
          icon={<ExternalLink size={19} />}
          title="Creative Testing Calendar"
          description="Концепти, хукови, агли и креативни варијации во посебната апликација."
          url={data?.creative_testing_calendar}
          button="Отвори календар"
        />

        <ExternalCard
          icon={<BrainCircuit size={19} />}
          title="Маркетинг Интелигенција"
          description="Оперативна маркетинг анализа и интелигенција во надворешната апликација."
          url={data?.marketing_intelligence ?? 'https://marketron-mi.pages.dev/#operator'}
          button="Отвори апликација"
        />
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Измени линкови за тестирање"
        footer={<div className="flex justify-end gap-2"><button className="btn-quiet" onClick={() => setEditing(false)}>Откажи</button><button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>Зачувај</button></div>}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Creative Testing Calendar</span>
            <input className="field" value={calendar} onChange={(e) => setCalendar(e.target.value)} placeholder="https://" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Маркетинг Интелигенција</span>
            <input className="field" value={intelligence} onChange={(e) => setIntelligence(e.target.value)} placeholder="https://marketron-mi.pages.dev/#operator" />
          </label>
        </div>
      </Modal>
    </div>
  )
}

function ExternalCard({ icon, title, description, url, button }: {
  icon: React.ReactNode
  title: string
  description: string
  url?: string
  button: string
}) {
  return (
    <section className="panel p-6">
      <span className="grid place-items-center h-10 w-10 rounded-xl bg-panel text-ink-soft">{icon}</span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-quiet mt-4">{button} <ExternalLink size={14} /></a>
      ) : (
        <p className="mt-4 text-xs text-ink-soft">Линкот не е поставен.</p>
      )}
    </section>
  )
}
