import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/Bits'
import { getSetting } from '@/services/reference'
import { supabase } from '@/lib/supabase'
import { useSession, useUserId } from '@/features/auth/session'

async function putSetting(key: string, value: unknown) {
  const { error } = await supabase.from('app_settings').upsert({ key, value })
  if (error) throw error
}

export function Settings() {
  const qc = useQueryClient()
  const userId = useUserId()
  const { profile, refreshProfile } = useSession()
  const [calendar, setCalendar] = useState('')
  const [marketingIntelligence, setMarketingIntelligence] = useState('')
  const [campus, setCampus] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')

  const { data: external } = useQuery({
    queryKey: ['setting', 'external_apps'],
    queryFn: () => getSetting<{ creative_testing_calendar?: string; marketing_intelligence?: string }>('external_apps'),
  })
  const { data: branding } = useQuery({
    queryKey: ['setting', 'branding'],
    queryFn: () => getSetting<{ logo_url?: string | null }>('branding'),
  })
  const { data: campusSetting } = useQuery({
    queryKey: ['setting', 'campus'],
    queryFn: () => getSetting<{ image_url?: string | null }>('campus'),
  })

  useEffect(() => {
    setCalendar(external?.creative_testing_calendar ?? '')
    setMarketingIntelligence(external?.marketing_intelligence ?? 'https://marketron-mi.pages.dev/#operator')
  }, [external])
  useEffect(() => { setCampus(campusSetting?.image_url ?? '') }, [campusSetting])
  useEffect(() => { setLogoUrl(branding?.logo_url ?? '') }, [branding])
  useEffect(() => {
    setFullName(profile?.full_name ?? '')
    setJobTitle(profile?.job_title ?? '')
    setAvatarUrl(profile?.avatar_url ?? '')
  }, [profile])

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        job_title: jobTitle || null,
        avatar_url: avatarUrl || null,
      }).eq('id', userId)
      if (error) throw error
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password })
        if (passwordError) throw passwordError
      }
    },
    onSuccess: async () => {
      await refreshProfile()
      setPassword('')
      toast.success('Профилот е зачуван')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveSystem = useMutation({
    mutationFn: async () => {
      await putSetting('external_apps', {
        creative_testing_calendar: calendar,
        marketing_intelligence: marketingIntelligence,
      })
      await putSetting('campus', { image_url: campus || null })
      await putSetting('branding', { logo_url: logoUrl || null })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['setting'] })
      toast.success('Поставките се зачувани')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-[760px]">
      <PageHeader title="Поставки" subtitle="Профил, лозинка, надворешни апликации и изглед на кампусот." />

      <section className="panel p-5">
        <h2 className="font-semibold">Мој профил</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Име и презиме"><input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
          <Field label="Работна позиција"><input className="field" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Пр. Креативен дизајнер" /></Field>
          <Field label="Линк до профилна слика"><input className="field" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://" /></Field>
          <Field label="Нова лозинка"><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Остави празно ако не ја менуваш" /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={() => saveProfile.mutate()} disabled={!fullName || saveProfile.isPending}>Зачувај профил</button>
        </div>
      </section>

      <section className="panel mt-5 p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Системски линкови</h2>
          <p className="mt-1 text-sm text-ink-soft">Истите линкови може да се менуваат и директно од страницата Тестирање.</p>
        </div>
        <Field label="Creative Testing Calendar URL">
          <input className="field" value={calendar} onChange={(e) => setCalendar(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Маркетинг Интелигенција URL">
          <input className="field" value={marketingIntelligence} onChange={(e) => setMarketingIntelligence(e.target.value)} placeholder="https://marketron-mi.pages.dev/#operator" />
        </Field>
        <Field label="URL на логото">
          <input className="field" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png" />
          <span className="mt-1.5 block text-xs text-ink-soft">Логото се прикажува горе лево. Најдобро работи квадратен PNG или SVG.</span>
        </Field>
        <Field label="URL на слика за кампусот">
          <input className="field" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Остави празно за вградениот кампус" />
          <span className="mt-1.5 block text-xs text-ink-soft">Користи широка слика со сооднос приближно 2.2:1.</span>
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => saveSystem.mutate()} disabled={saveSystem.isPending}>Зачувај системски поставки</button>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
