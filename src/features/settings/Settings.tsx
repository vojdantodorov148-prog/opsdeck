import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/Bits'
import { getSetting } from '@/services/reference'
import { supabase } from '@/lib/supabase'

async function putSetting(key: string, value: unknown) {
  const { error } = await supabase.from('app_settings').upsert({ key, value })
  if (error) throw error
}

export function Settings() {
  const qc = useQueryClient()
  const [calendar, setCalendar] = useState('')
  const [campus, setCampus] = useState('')

  const { data: external } = useQuery({
    queryKey: ['setting', 'external_apps'],
    queryFn: () => getSetting<{ creative_testing_calendar?: string }>('external_apps'),
  })
  const { data: campusSetting } = useQuery({
    queryKey: ['setting', 'campus'],
    queryFn: () => getSetting<{ image_url?: string | null }>('campus'),
  })

  useEffect(() => { setCalendar(external?.creative_testing_calendar ?? '') }, [external])
  useEffect(() => { setCampus(campusSetting?.image_url ?? '') }, [campusSetting])

  const save = useMutation({
    mutationFn: async () => {
      await putSetting('external_apps', { creative_testing_calendar: calendar })
      await putSetting('campus', { image_url: campus || null })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['setting'] }); toast.success('Settings saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-[640px]">
      <PageHeader title="Settings" subtitle="External apps and campus artwork." />
      <div className="panel p-5 space-y-4">
        <label className="block">
          <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Creative Testing Calendar URL</span>
          <input className="field" value={calendar} onChange={(e) => setCalendar(e.target.value)} placeholder="https://" />
        </label>
        <label className="block">
          <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Campus image URL</span>
          <input className="field" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Leave empty to use the drawn campus" />
          <span className="mt-1.5 block text-xs text-ink-soft">
            Point this at a rendered isometric campus and the building hotspots position themselves over it.
          </span>
        </label>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>Save settings</button>
        </div>
      </div>
    </div>
  )
}
