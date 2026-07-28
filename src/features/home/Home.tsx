import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { UserPlus, FlaskConical, FileText, Wrench, CheckCircle2, Rocket } from 'lucide-react'
import { Campus } from './Campus'
import { Avatar } from '@/components/ui/Avatar'
import { Loading } from '@/components/ui/Bits'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { useActions } from '@/app/actions'
import { useSession, useUserId } from '@/features/auth/session'
import { myWeek, listTasks } from '@/services/tasks'
import { listActivity } from '@/services/signal'
import { getSetting, listProfiles, listTools } from '@/services/reference'
import { listTests } from '@/services/products'
import { iso, weekDays } from '@/lib/week'
import { TEST_STATUS } from '@/lib/status'
import type { TestStatus } from '@/types/db'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Добро утро'
  if (hour < 18) return 'Добар ден'
  return 'Добра вечер'
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'сега'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `пред ${minutes} мин.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `пред ${hours} ч.`
  const days = Math.floor(hours / 24)
  return `пред ${days} д.`
}

export function Home() {
  const { profile } = useSession()
  const userId = useUserId()
  const actions = useActions()
  const [openTask, setOpenTask] = useState<string | null>(null)

  const days = weekDays(new Date())
  const { data: week = [], isLoading } = useQuery({
    queryKey: ['my-week', iso(days[0]), userId],
    queryFn: () => myWeek(iso(days[0]), iso(days[days.length - 1])),
    enabled: Boolean(userId),
  })
  const { data: activity = [] } = useQuery({ queryKey: ['activity'], queryFn: () => listActivity(5) })
  const { data: landing = [] } = useQuery({ queryKey: ['tasks', 'landing'], queryFn: () => listTasks({ department: 'landing' }) })
  const { data: creative = [] } = useQuery({ queryKey: ['tasks', 'creative'], queryFn: () => listTasks({ department: 'creative' }) })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: tools = [] } = useQuery({ queryKey: ['tools'], queryFn: listTools })
  const { data: campus } = useQuery({ queryKey: ['setting', 'campus'], queryFn: () => getSetting<{ image_url?: string | null }>('campus') })

  const today = iso(new Date())
  const todayTasks = week
    .filter((task) => (task.scheduled_date ?? task.due_date ?? today) <= today && task.status !== 'done')
    .slice(0, 4)

  const counts = {
    landing: landing.filter((task) => task.status !== 'done').length,
    creative: creative.filter((task) => task.status !== 'done').length,
    testing: tests.filter((test) => test.status === 'testing').length,
    office: people.length,
    tools: tools.length,
  }

  return (
    <div className="max-w-[1200px]">
      <h1 className="text-[31px] leading-tight font-semibold tracking-tight">
        {greeting()}, {profile?.full_name?.split(' ')[0] ?? 'пријател'}.
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">Фокусирај се на најважното денес.</p>

      <div className="mt-3">
        <Campus counts={counts} imageUrl={campus?.image_url ?? import.meta.env.VITE_CAMPUS_IMAGE_URL} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel p-4">
          <header className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Мој ден</h2>
            <Link to="/my-day" className="btn-quiet h-7 px-2.5 text-[11px]">Види сѐ</Link>
          </header>
          {isLoading ? (
            <Loading rows={3} />
          ) : todayTasks.length === 0 ? (
            <p className="py-5 text-sm text-ink-soft text-center">Нема закажани задачи. Испланирај ја неделата во Мој ден.</p>
          ) : (
            <ul className="space-y-0.5">
              {todayTasks.map((task) => (
                <li key={task.id}>
                  <button className="w-full flex items-center gap-2.5 py-2 px-1 rounded-lg row-hover text-left" onClick={() => setOpenTask(task.id)}>
                    <span className="h-4 w-4 rounded-full border-2 border-line shrink-0" />
                    <span className="flex-1 text-[13px] truncate">{task.title}</span>
                    {task.assignee && <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size={22} />}
                    <span className="text-[11px] text-teal-600 tabular-nums w-[42px] text-right">{task.scheduled_time ? task.scheduled_time.slice(0, 5) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="font-semibold mb-2">Брза акција</h2>
          <div className="grid gap-1.5">
            <QuickAction icon={UserPlus} title="Додели задача" hint="Додели работа на член од тимот" onClick={() => actions.open('give-task')} />
            <QuickAction icon={FlaskConical} title="Започни тест" hint="Подготви продукт тест во маркет" onClick={() => actions.open('start-test')} />
            <QuickAction icon={FileText} title="Додај белешка" hint="Запиши нешто брзо" onClick={() => actions.open('add-note')} />
            <Link to="/tools" className="block"><QuickAction icon={Wrench} title="Отвори алатка" hint="Пристапи до апликациите" /></Link>
          </div>
        </section>

        <section className="panel p-4">
          <header className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Последни активности</h2>
            <Link to="/tasks" className="btn-quiet h-7 px-2.5 text-[11px]">Види сѐ</Link>
          </header>
          {activity.length === 0 ? (
            <p className="py-5 text-sm text-ink-soft text-center">Активностите ќе се појават тука додека тимот работи.</p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.slice(0, 4).map((event) => (
                <li key={event.id} className="flex items-center gap-2.5 py-2.5 first:pt-0">
                  <span className="grid place-items-center h-6 w-6 rounded-lg bg-panel text-teal-600 shrink-0">
                    {event.event_type === 'task.completed' ? <CheckCircle2 size={14} /> : event.event_type === 'test.status_changed' ? <FlaskConical size={14} /> : <Rocket size={14} />}
                  </span>
                  <p className="flex-1 text-[13px] truncate">{describeEvent(event)}</p>
                  <span className="text-[10px] text-ink-soft shrink-0">{relativeTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

function QuickAction({ icon: Icon, title, hint, onClick }: { icon: typeof UserPlus; title: string; hint: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-line hover:border-teal-200 hover:bg-teal-50/40 transition text-left">
      <span className="grid place-items-center h-8 w-8 rounded-lg bg-panel text-teal-600"><Icon size={16} strokeWidth={1.9} /></span>
      <span><span className="block text-[13px] font-medium">{title}</span><span className="block text-[11px] text-ink-soft">{hint}</span></span>
    </button>
  )
}

function describeEvent(event: { event_type: string; metadata: Record<string, unknown>; actor?: { full_name: string } | null }) {
  const who = event.actor?.full_name ?? 'Некој'
  const meta = event.metadata as { title?: string; product?: string; market?: string; to?: string }
  switch (event.event_type) {
    case 'task.completed': return `${who} ја заврши задачата ${meta.title ?? ''}`
    case 'task.created': return `${who} ја додели задачата ${meta.title ?? ''}`
    case 'test.status_changed': {
      const status = meta.to && meta.to in TEST_STATUS ? TEST_STATUS[meta.to as TestStatus].label : (meta.to ?? '')
      return `${who}: ${meta.product ?? ''} ${meta.market ?? ''} → ${status}`
    }
    default: return `${who} — ${event.event_type}`
  }
}
