import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/Bits'
import { getSetting } from '@/services/reference'
import { supabase } from '@/lib/supabase'
import { useSession, useUserId } from '@/features/auth/session'
import { createApiKey, listApiAdminData, listApiAudit, revokeApiKey, type ApiScope } from '@/services/apiAdmin'

async function putSetting(key: string, value: unknown) {
  const { error } = await supabase.from('app_settings').upsert({ key, value })
  if (error) throw error
}

const SCOPE_LABELS: Record<ApiScope, string> = {
  read: 'read',
  'write:products': 'write:products',
  'write:tasks': 'write:tasks',
  'write:comments': 'write:comments',
}

export function Settings() {
  const qc = useQueryClient()
  const userId = useUserId()
  const { profile, refreshProfile, roleKey } = useSession()
  const isApiAdmin = roleKey === 'owner' || roleKey === 'admin'
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
    <div className="max-w-[1120px]">
      <PageHeader title="Поставки" subtitle="Профил, лозинка, надворешни апликации и системски пристап." />

      <div className="max-w-[760px]">
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

      {isApiAdmin && <ApiAccessAdmin />}
    </div>
  )
}

function ApiAccessAdmin() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [actingUser, setActingUser] = useState('')
  const [scopes, setScopes] = useState<ApiScope[]>(['read'])
  const [newToken, setNewToken] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({ queryKey: ['api-admin'], queryFn: listApiAdminData })
  const { data: audit = [], isLoading: auditLoading } = useQuery({ queryKey: ['api-audit'], queryFn: () => listApiAudit(100) })

  useEffect(() => {
    if (!actingUser && data?.users[0]) setActingUser(data.users[0].id)
  }, [actingUser, data?.users])

  const create = useMutation({
    mutationFn: () => createApiKey({ name: name.trim(), userId: actingUser, scopes }),
    onSuccess: async (result) => {
      setNewToken(result.token)
      setName('')
      await qc.invalidateQueries({ queryKey: ['api-admin'] })
      toast.success('API key е креиран. Копирај го сега — нема повторно да се прикаже.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['api-admin'] }),
        qc.invalidateQueries({ queryKey: ['api-audit'] }),
      ])
      toast.success('API key е отповикан')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleScope = (scope: ApiScope) => {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope])
  }

  return (
    <>
      <section className="panel mt-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><KeyRound size={18} /><h2 className="font-semibold">API keys</h2></div>
            <p className="mt-1 text-sm text-ink-soft">Server-to-server пристап без browser login. Raw key се прикажува само еднаш.</p>
          </div>
          <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Admin only</span>
        </div>

        {newToken && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Копирај го key-от сега</p>
                <p className="mt-1 text-xs text-amber-800">Ops Deck зачувува само hash. Овој token нема да може повторно да се прикаже.</p>
              </div>
              <button className="btn-quiet" onClick={() => setNewToken(null)}>Затвори</button>
            </div>
            <div className="mt-3 flex gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs">{newToken}</code>
              <button className="btn" onClick={() => { void navigator.clipboard.writeText(newToken); toast.success('API key е копиран') }}><Copy size={14} /> Copy</button>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-[1.1fr_1fr]">
          <Field label="Име на key">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Пр. Krsto MCP" />
          </Field>
          <Field label="Работи како корисник">
            <select className="field" value={actingUser} onChange={(e) => setActingUser(e.target.value)}>
              {(data?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.full_name}{user.email ? ` · ${user.email}` : ''}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Scopes</p>
          <div className="flex flex-wrap gap-2">
            {(['read', 'write:products', 'write:tasks', 'write:comments'] as ApiScope[]).map((scope) => (
              <label key={scope} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${scopes.includes(scope) ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-line bg-surface text-ink-soft'}`}>
                <input className="mr-2" type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                {SCOPE_LABELS[scope]}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={!name.trim() || !actingUser || !scopes.length || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Се креира…' : 'Креирај API key'}
          </button>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Активни и отповикани keys</h3>
            <button className="btn-quiet" onClick={() => qc.invalidateQueries({ queryKey: ['api-admin'] })}><RefreshCw size={14} /> Refresh</button>
          </div>
          {error ? <p className="text-sm text-red-600">{(error as Error).message}</p> : isLoading ? <p className="text-sm text-ink-soft">Се вчитува…</p> : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-panel text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <tr><th className="px-3 py-2">Key</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Scopes</th><th className="px-3 py-2">Последно користен</th><th className="px-3 py-2">Статус</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data?.keys ?? []).map((key) => (
                    <tr key={key.id}>
                      <td className="px-3 py-3"><div className="font-medium">{key.name}</div><code className="text-xs text-ink-soft">{key.key_prefix}…</code></td>
                      <td className="px-3 py-3">{key.user?.full_name ?? '—'}</td>
                      <td className="px-3 py-3"><div className="flex max-w-[330px] flex-wrap gap-1">{key.scopes.map((scope) => <code key={scope} className="rounded bg-panel px-1.5 py-0.5 text-[11px]">{scope}</code>)}</div></td>
                      <td className="px-3 py-3 text-ink-soft">{key.last_used_at ? formatDateTime(key.last_used_at) : 'Никогаш'}</td>
                      <td className="px-3 py-3">{key.revoked_at ? <span className="text-red-600">Отповикан</span> : <span className="text-teal-700">Активен</span>}</td>
                      <td className="px-3 py-3 text-right">{!key.revoked_at && <button className="btn-quiet text-red-600" disabled={revoke.isPending} onClick={() => revoke.mutate(key.id)}><Ban size={14} /> Revoke</button>}</td>
                    </tr>
                  ))}
                  {!data?.keys.length && <tr><td className="px-3 py-5 text-center text-ink-soft" colSpan={6}>Нема API keys.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel mt-5 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">API audit log</h2>
            <p className="mt-1 text-sm text-ink-soft">Последни 100 REST повици: key, endpoint, време и резултат.</p>
          </div>
          <button className="btn-quiet" onClick={() => qc.invalidateQueries({ queryKey: ['api-audit'] })}><RefreshCw size={14} /> Refresh</button>
        </div>
        {auditLoading ? <p className="text-sm text-ink-soft">Се вчитува…</p> : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-panel text-left uppercase tracking-wide text-ink-soft">
                <tr><th className="px-3 py-2">Време</th><th className="px-3 py-2">Key</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Request</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">ms</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{formatDateTime(log.created_at)}</td>
                    <td className="px-3 py-2 font-medium">{log.key_name}</td>
                    <td className="px-3 py-2">{log.user?.full_name ?? '—'}</td>
                    <td className="max-w-[380px] truncate px-3 py-2"><span className="mr-2 font-semibold">{log.method}</span>{log.endpoint}</td>
                    <td className="px-3 py-2"><span className={log.status_code < 400 ? 'text-teal-700' : 'text-red-600'}>{log.status_code} · {log.result}</span></td>
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{log.duration_ms}</td>
                  </tr>
                ))}
                {!audit.length && <tr><td className="px-3 py-5 text-center text-ink-soft" colSpan={6}>Нема API повици.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('mk-MK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
