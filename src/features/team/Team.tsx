import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, ErrorNote, EmptyState } from '@/components/ui/Bits'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { listProfiles } from '@/services/reference'
import { listTasks } from '@/services/tasks'
import { checkTeamBackend, createTeamAccount, deleteTeamAccount, listUserPageAccess, listUserRoles, updateTeamAccount } from '@/services/team'
import { createTelegramConnectLink, disconnectTelegram, getTelegramStatus, sendTelegramTest } from '@/services/telegram'
import { APP_PAGES, DEFAULT_MEMBER_PAGES, type PageKey } from '@/lib/pages'
import { useActions } from '@/app/actions'
import { useSession, useUserId } from '@/features/auth/session'

const ROLE_LABELS = { admin: 'Администратор', manager: 'Менаџер', member: 'Член' } as const
const ROLE_DISPLAY: Record<string, string> = { owner: 'Сопственик', ...ROLE_LABELS }
type EditableRole = keyof typeof ROLE_LABELS

export function Team() {
  const actions = useActions()
  const { can } = useSession()
  const currentUserId = useUserId()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(params.get('member'))
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [backendChecked, setBackendChecked] = useState(false)

  const { data: people = [], isLoading, error } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', 'all'], queryFn: () => listTasks({}) })
  const { data: roleRows = [] } = useQuery({ queryKey: ['team-roles'], queryFn: listUserRoles, enabled: can('team.manage') })
  const { data: accessRows = [] } = useQuery({ queryKey: ['page-access'], queryFn: listUserPageAccess, enabled: can('team.manage') })

  const person = people.find((profile) => profile.id === selected)
  const theirs = tasks.filter((task) => task.assigned_to === selected)
  const roleKey = roleRows.find((row) => row.user_id === selected)?.roles?.key ?? 'member'
  const role = (roleKey === 'owner' ? 'admin' : roleKey) as EditableRole
  const selectedAccessRows = accessRows.filter((row) => row.user_id === selected)
  const pages = selectedAccessRows.filter((row) => row.allowed).map((row) => row.page_key)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['profiles'] })
    qc.invalidateQueries({ queryKey: ['team-roles'] })
    qc.invalidateQueries({ queryKey: ['page-access'] })
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteTeamAccount(id),
    onSuccess: () => { refresh(); setSelected(null); toast.success('Акаунтот е избришан') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-[980px]">
      <PageHeader
        title="Тим"
        subtitle="Членови, тековна работа и пристап до страниците."
        action={can('team.manage') ? <button className="btn-primary" onClick={async () => {
          if (!backendChecked) {
            try { await checkTeamBackend(); setBackendChecked(true) }
            catch (e) { toast.error(e instanceof Error ? e.message : 'Team backend не е достапен'); return }
          }
          setAdding(true)
        }}><Plus size={16} /> Додај акаунт</button> : undefined}
      />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={4} /> : people.length === 0 ? (
        <div className="panel"><EmptyState title="Сѐ уште нема членови" hint="Додајте го првиот тимски акаунт." /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((profile) => {
            const active = tasks.filter((task) => task.assigned_to === profile.id && task.status !== 'done').length
            const memberRole = roleRows.find((row) => row.user_id === profile.id)?.roles?.key as EditableRole | undefined
            return (
              <button key={profile.id} onClick={() => setSelected(profile.id)} className="panel p-4 text-left hover:border-teal-200 transition">
                <div className="flex items-center gap-3">
                  <Avatar name={profile.full_name} url={profile.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{profile.full_name}</p>
                    <p className="text-xs text-ink-soft truncate">{profile.job_title ?? 'Тим'}</p>
                  {profile.email && <p className="text-[11px] text-ink-soft/70 truncate">{profile.email}</p>}
                  </div>
                  {can('team.manage') && <UserCog size={15} className="text-ink-soft/50" />}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                  <span>{active} активни {active === 1 ? 'задача' : 'задачи'}</span>
                  {memberRole && <span>{ROLE_DISPLAY[memberRole] ?? memberRole}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {person && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          title={person.full_name}
          subtitle={person.job_title ?? 'Тим'}
          width="max-w-xl"
          footer={
            <div className="flex items-center justify-between gap-3">
              {can('team.manage') && person.id !== currentUserId ? (
                <button
                  className="btn-quiet text-[#A0522D]"
                  onClick={() => window.confirm(`Да го избришам акаунтот на ${person.full_name}?`) && remove.mutate(person.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 size={15} /> Избриши акаунт
                </button>
              ) : <span />}
              <button className="btn-primary" onClick={() => actions.open('give-task')}>Додели задача</button>
            </div>
          }
        >
          <div className="space-y-7">
            {can('team.manage') && person.id !== currentUserId && roleKey !== 'owner' && (
              <AccountEditor
                userId={person.id}
                initial={{
                  fullName: person.full_name,
                  jobTitle: person.job_title ?? '',
                  roleKey: role,
                  pages: selectedAccessRows.length ? pages : DEFAULT_MEMBER_PAGES,
                  password: '',
                }}
                onSaved={refresh}
              />
            )}

            {can('team.manage') && <TelegramNotifications userId={person.id} name={person.full_name} />}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Тековна работа</h3>
              {theirs.filter((task) => task.status !== 'done').length === 0
                ? <p className="text-sm text-ink-soft">Нема отворени задачи.</p>
                : <TaskList tasks={theirs.filter((task) => task.status !== 'done')} onOpen={setOpenTask} />}
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Последно завршено</h3>
              {theirs.filter((task) => task.status === 'done').length === 0
                ? <p className="text-sm text-ink-soft">Сѐ уште нема.</p>
                : <TaskList tasks={theirs.filter((task) => task.status === 'done').slice(0, 6)} onOpen={setOpenTask} />}
            </section>
          </div>
        </Drawer>
      )}

      <AddAccountModal open={adding} onClose={() => setAdding(false)} onCreated={refresh} />
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

function PageChecks({ pages, onChange, includeSettings = false }: { pages: PageKey[]; onChange: (pages: PageKey[]) => void; includeSettings?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {APP_PAGES.filter((page) => includeSettings || page.key !== 'settings').map((page) => {
        const checked = pages.includes(page.key)
        return (
          <label key={page.key} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? pages.filter((key) => key !== page.key) : [...pages, page.key])}
            />
            {page.label}
          </label>
        )
      })}
    </div>
  )
}


function TelegramNotifications({ userId, name }: { userId: string; name: string }) {
  const qc = useQueryClient()
  const [connectUrl, setConnectUrl] = useState<string | null>(null)
  const { data: connection, isLoading } = useQuery({
    queryKey: ['telegram-status', userId],
    queryFn: () => getTelegramStatus(userId),
    refetchInterval: 3000,
  })

  const connect = useMutation({
    mutationFn: () => createTelegramConnectLink(userId),
    onSuccess: (data) => {
      setConnectUrl(data.url)
      toast.success('Telegram connect линкот е креиран')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const disconnect = useMutation({
    mutationFn: () => disconnectTelegram(userId),
    onSuccess: () => {
      setConnectUrl(null)
      qc.invalidateQueries({ queryKey: ['telegram-status', userId] })
      toast.success('Telegram е исклучен')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const test = useMutation({
    mutationFn: () => sendTelegramTest(userId),
    onSuccess: () => toast.success('Тест пораката е испратена'),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="rounded-2xl border border-line bg-panel/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Telegram известувања</h3>
          <p className="mt-1 text-sm text-ink-soft">Нова задача → Telegram порака, дури и кога Ops Deck не е отворен.</p>
        </div>
        {!isLoading && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${connection ? 'bg-teal-50 text-teal-700' : 'bg-white text-ink-soft border border-line'}`}>
            {connection ? 'Поврзан' : 'Не е поврзан'}
          </span>
        )}
      </div>

      {connection ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line bg-white/70 px-3 py-2.5 text-sm">
            <p className="font-medium">{connection.telegram_username ? `@${connection.telegram_username}` : connection.telegram_first_name || name}</p>
            <p className="mt-0.5 text-xs text-ink-soft">Поврзан на {new Date(connection.connected_at).toLocaleDateString('mk-MK')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-quiet" onClick={() => test.mutate()} disabled={test.isPending}>Испрати тест</button>
            <button className="btn-quiet text-[#A0522D]" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Исклучи Telegram</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <button className="btn-primary" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? 'Се креира…' : 'Креирај connect линк'}
          </button>
          {connectUrl && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
              <p className="text-sm font-medium">Испрати му го овој линк на {name}:</p>
              <p className="mt-2 break-all text-xs text-ink-soft">{connectUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-quiet" onClick={async () => {
                  await navigator.clipboard.writeText(connectUrl)
                  toast.success('Линкот е копиран')
                }}>Копирај линк</button>
                <a className="btn-quiet" href={connectUrl} target="_blank" rel="noreferrer">Отвори Telegram</a>
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">Линкот важи 15 минути. Корисникот само треба да го отвори и да притисне Start.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function AccountEditor({ userId, initial, onSaved }: {
  userId: string
  initial: { fullName: string; jobTitle: string; roleKey: EditableRole; pages: PageKey[]; password: string }
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const save = useMutation({
    mutationFn: () => updateTeamAccount(userId, form),
    onSuccess: () => {
      setForm((current) => ({ ...current, password: '' }))
      onSaved()
      toast.success('Промените се зачувани')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="rounded-2xl border border-line bg-panel/50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Акаунт и пристап</h3>
      <div className="mt-3 space-y-3">
        <input className="field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Име и презиме" />
        <input className="field" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Работна позиција" />
        <input className="field" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Нова лозинка (опционално)" />
        <select className="field" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value as EditableRole })}>
          {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Пристап до страници</p>
          <PageChecks pages={form.pages} includeSettings={form.roleKey === 'admin'} onChange={(pages) => setForm({ ...form, pages })} />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => save.mutate()} disabled={!form.fullName || save.isPending}>Зачувај пристап</button>
        </div>
      </div>
    </section>
  )
}

function AddAccountModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', jobTitle: '', roleKey: 'member' as EditableRole, pages: [...DEFAULT_MEMBER_PAGES],
  })
  const valid = useMemo(() => Boolean(form.email && form.password.length >= 6 && form.fullName), [form])
  const create = useMutation({
    mutationFn: () => createTeamAccount(form),
    onSuccess: () => {
      onCreated()
      toast.success('Акаунтот е креиран')
      setForm({ email: '', password: '', fullName: '', jobTitle: '', roleKey: 'member', pages: [...DEFAULT_MEMBER_PAGES] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Додај тимски акаунт"
      description="Креирај најава и избери кои страници може да ги користи."
      width="max-w-2xl"
      footer={<div className="flex justify-end gap-2"><button className="btn-quiet" onClick={onClose}>Откажи</button><button className="btn-primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>Креирај акаунт</button></div>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" placeholder="Име и презиме" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="field" placeholder="Работна позиција" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          <input className="field" type="email" placeholder="Е-пошта" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" type="password" placeholder="Привремена лозинка (мин. 6 знаци)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <select className="field" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value as EditableRole })}>
          {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Пристап до страници</p>
          <PageChecks pages={form.pages} includeSettings={form.roleKey === 'admin'} onChange={(pages) => setForm({ ...form, pages })} />
        </div>
      </div>
    </Modal>
  )
}
