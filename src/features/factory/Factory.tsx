import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Loading, EmptyState, ErrorNote } from '@/components/ui/Bits'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { listTasks } from '@/services/tasks'
import { useActions } from '@/app/actions'
import type { Department, TaskWithRelations } from '@/types/db'

const COPY: Record<'landing' | 'creative', { title: string; subtitle: string }> = {
  landing: { title: 'Landing Factory', subtitle: 'Every landing page, advertorial, listicle and quiz in production.' },
  creative: { title: 'Creative Factory', subtitle: 'Every static, video and UGC asset in production. Concept testing lives in the Creative Testing Calendar.' },
}

const SECTIONS: { key: string; label: string; match: (t: TaskWithRelations) => boolean }[] = [
  { key: 'attention', label: 'Needs attention', match: (t) => t.status === 'blocked' || (t.due_date !== null && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== 'done') },
  { key: 'progress', label: 'In progress', match: (t) => t.status === 'doing' || t.status === 'todo' },
  { key: 'review', label: 'Waiting for review', match: (t) => t.status === 'review' },
  { key: 'done', label: 'Recently completed', match: (t) => t.status === 'done' },
]

export function Factory({ department }: { department: 'landing' | 'creative' }) {
  const actions = useActions()
  const [openTask, setOpenTask] = useState<string | null>(null)

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', department as Department],
    queryFn: () => listTasks({ department }),
  })

  const used = new Set<string>()
  const grouped = SECTIONS.map((s) => {
    const list = tasks.filter((t) => !used.has(t.id) && s.match(t))
    list.forEach((t) => used.add(t.id))
    return { ...s, list: s.key === 'done' ? list.slice(0, 8) : list }
  }).filter((s) => s.list.length > 0)

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        title={COPY[department].title}
        subtitle={COPY[department].subtitle}
        action={<button className="btn-primary" onClick={() => actions.open('give-task')}>Give task</button>}
      />

      {error ? <ErrorNote error={error} />
        : isLoading ? <Loading rows={6} />
        : grouped.length === 0
          ? <div className="panel"><EmptyState title="Nothing in production" hint="Work routed to this department shows up here automatically." /></div>
          : (
            <div className="space-y-6">
              {grouped.map((s) => (
                <section key={s.key}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{s.label}</h2>
                  <div className="panel p-2"><TaskList tasks={s.list} onOpen={setOpenTask} /></div>
                </section>
              ))}
            </div>
          )}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
