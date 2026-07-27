import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Loading, ErrorNote, EmptyState } from '@/components/ui/Bits'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { listProfiles } from '@/services/reference'
import { listTasks } from '@/services/tasks'
import { useActions } from '@/app/actions'

export function Team() {
  const actions = useActions()
  const [params] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(params.get('member'))
  const [openTask, setOpenTask] = useState<string | null>(null)

  const { data: people = [], isLoading, error } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', 'all'], queryFn: () => listTasks({}) })

  const person = people.find((p) => p.id === selected)
  const theirs = tasks.filter((t) => t.assigned_to === selected)

  return (
    <div className="max-w-[900px]">
      <PageHeader title="Team" subtitle="Who is here and what they are carrying right now." />

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={4} /> : people.length === 0 ? (
        <div className="panel"><EmptyState title="No teammates yet" hint="People appear here once they sign in." /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const active = tasks.filter((t) => t.assigned_to === p.id && t.status !== 'done').length
            return (
              <button key={p.id} onClick={() => setSelected(p.id)} className="panel p-4 text-left hover:border-teal-200 transition">
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} url={p.avatar_url} size={40} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-ink-soft truncate">{p.job_title ?? 'Team'}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-soft">{active} active {active === 1 ? 'task' : 'tasks'}</p>
              </button>
            )
          })}
        </div>
      )}

      {person && (
        <Drawer
          open onClose={() => setSelected(null)}
          title={person.full_name}
          subtitle={person.job_title ?? 'Team'}
          width="max-w-lg"
          footer={<button className="btn-primary" onClick={() => actions.open('give-task')}>Give a task</button>}
        >
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Current work</h3>
              {theirs.filter((t) => t.status !== 'done').length === 0
                ? <p className="text-sm text-ink-soft">Nothing open.</p>
                : <TaskList tasks={theirs.filter((t) => t.status !== 'done')} onOpen={setOpenTask} />}
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Recently completed</h3>
              {theirs.filter((t) => t.status === 'done').length === 0
                ? <p className="text-sm text-ink-soft">Nothing yet.</p>
                : <TaskList tasks={theirs.filter((t) => t.status === 'done').slice(0, 6)} onOpen={setOpenTask} />}
            </section>
          </div>
        </Drawer>
      )}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
