import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
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
  const { data: activity = [] } = useQuery({ queryKey: ['activity'], queryFn: () => listActivity(6) })
  const { data: landing = [] } = useQuery({ queryKey: ['tasks', 'landing'], queryFn: () => listTasks({ department: 'landing' }) })
  const { data: creative = [] } = useQuery({ queryKey: ['tasks', 'creative'], queryFn: () => listTasks({ department: 'creative' }) })
  const { data: tests = [] } = useQuery({ queryKey: ['tests'], queryFn: listTests })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: tools = [] } = useQuery({ queryKey: ['tools'], queryFn: listTools })
  const { data: campus } = useQuery({ queryKey: ['setting', 'campus'], queryFn: () => getSetting<{ image_url?: string | null }>('campus') })

  const today = iso(new Date())
  const todayTasks = week
    .filter((t) => (t.scheduled_date ?? t.due_date ?? today) <= today && t.status !== 'done')
    .slice(0, 5)

  const counts = {
    landing: landing.filter((t) => t.status !== 'done').length,
    creative: creative.filter((t) => t.status !== 'done').length,
    testing: tests.filter((t) => t.status === 'testing').length,
    office: people.length,
    tools: tools.length,
  }

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-[34px] leading-tight font-semibold tracking-tight">
        {greeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'}.
      </h1>
      <p className="mt-1 text-[15px] text-ink-soft">Focus on what matters today.</p>

      <div className="mt-6">
        <Campus counts={counts} imageUrl={campus?.image_url ?? import.meta.env.VITE_CAMPUS_IMAGE_URL} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* My Day */}
        <section className="panel p-5">
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My Day</h2>
            <Link to="/my-day" className="btn-quiet h-8 text-xs">View all</Link>
          </header>
          {isLoading ? (
            <Loading rows={3} />
          ) : todayTasks.length === 0 ? (
            <p className="py-6 text-sm text-ink-soft text-center">Nothing scheduled. Plan your week in My Day.</p>
          ) : (
            <ul className="space-y-1">
              {todayTasks.map((t) => (
                <li key={t.id}>
                  <button className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg row-hover text-left" onClick={() => setOpenTask(t.id)}>
                    <span className="h-[18px] w-[18px] rounded-full border-2 border-line shrink-0" />
                    <span className="flex-1 text-sm truncate">{t.title}</span>
                    {t.assignee && <Avatar name={t.assignee.full_name} url={t.assignee.avatar_url} size={24} />}
                    <span className="text-xs text-teal-600 tabular-nums w-[52px] text-right">
                      {t.scheduled_time ? t.scheduled_time.slice(0, 5) : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick Action */}
        <section className="panel p-5">
          <h2 className="font-semibold mb-4">Quick Action</h2>
          <div className="space-y-2">
            <QuickAction icon={UserPlus} title="Give Task" hint="Assign work to someone" onClick={() => actions.open('give-task')} />
            <QuickAction icon={FlaskConical} title="Start Test" hint="Launch a new product test" onClick={() => actions.open('start-test')} />
            <QuickAction icon={FileText} title="Add Note" hint="Write something down" onClick={() => actions.open('add-note')} />
            <Link to="/tools" className="block">
              <QuickAction icon={Wrench} title="Open Tool" hint="Access your tools" />
            </Link>
          </div>
        </section>

        {/* Recent Updates */}
        <section className="panel p-5">
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Updates</h2>
            <Link to="/tasks" className="btn-quiet h-8 text-xs">View all</Link>
          </header>
          {activity.length === 0 ? (
            <p className="py-6 text-sm text-ink-soft text-center">Activity shows up here as the team works.</p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <span className="grid place-items-center h-7 w-7 rounded-lg bg-panel text-teal-600 shrink-0">
                    {e.event_type === 'task.completed' ? <CheckCircle2 size={15} /> :
                     e.event_type === 'test.status_changed' ? <FlaskConical size={15} /> : <Rocket size={15} />}
                  </span>
                  <p className="flex-1 text-sm truncate">{describeEvent(e)}</p>
                  <span className="text-xs text-ink-soft shrink-0">
                    {formatDistanceToNowStrict(new Date(e.created_at))} ago
                  </span>
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

function QuickAction({ icon: Icon, title, hint, onClick }: {
  icon: typeof UserPlus; title: string; hint: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-teal-200 hover:bg-teal-50/40 transition text-left"
    >
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-panel text-teal-600"><Icon size={17} strokeWidth={1.9} /></span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </button>
  )
}

function describeEvent(e: { event_type: string; metadata: Record<string, unknown>; actor?: { full_name: string } | null }) {
  const who = e.actor?.full_name ?? 'Someone'
  const m = e.metadata as { title?: string; product?: string; market?: string; to?: string }
  switch (e.event_type) {
    case 'task.completed': return `${who} completed ${m.title ?? 'a task'}`
    case 'task.created': return `${who} assigned ${m.title ?? 'a task'}`
    case 'test.status_changed': return `${who} set ${m.product} ${m.market} to ${m.to}`
    default: return `${who} — ${e.event_type}`
  }
}
