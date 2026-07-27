import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Loading, EmptyState, ErrorNote } from '@/components/ui/Bits'
import { TaskList } from './TaskList'
import { TaskDrawer } from './TaskDrawer'
import { listTasks, type TaskFilters } from '@/services/tasks'
import { listProducts } from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { useActions } from '@/app/actions'
import { useUserId } from '@/features/auth/session'
import type { TaskStatus } from '@/types/db'

export function Tasks() {
  const userId = useUserId()
  const actions = useActions()
  const [params, setParams] = useSearchParams()
  const [openTask, setOpenTask] = useState<string | null>(params.get('task'))
  const [mine, setMine] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({})

  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets })

  const query = { ...filters, mineOnly: mine ? userId : undefined }
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', query],
    queryFn: () => listTasks(query),
  })

  function closeDrawer() {
    setOpenTask(null)
    if (params.get('task')) { params.delete('task'); setParams(params, { replace: true }) }
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        title="Tasks"
        subtitle="Everything the company is working on."
        action={<button className="btn-primary" onClick={() => actions.open('give-task')}>Give task</button>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-xl border border-line overflow-hidden">
          <button className={`h-9 px-3 text-sm ${!mine ? 'bg-teal-50 text-teal-700' : 'text-ink-soft'}`} onClick={() => setMine(false)}>All tasks</button>
          <button className={`h-9 px-3 text-sm ${mine ? 'bg-teal-50 text-teal-700' : 'text-ink-soft'}`} onClick={() => setMine(true)}>My tasks</button>
        </div>
        <select className="field w-auto h-9" value={filters.assignee ?? ''} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value || undefined }))}>
          <option value="">Anyone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select className="field w-auto h-9" value={filters.product ?? ''} onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value || undefined }))}>
          <option value="">Any product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="field w-auto h-9" value={filters.market ?? ''} onChange={(e) => setFilters((f) => ({ ...f, market: e.target.value || undefined }))}>
          <option value="">Any market</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="field w-auto h-9" value={filters.status ?? ''} onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as TaskStatus | undefined }))}>
          <option value="">Any status</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="review">Review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <input
          className="field w-auto h-9 flex-1 min-w-[160px]" placeholder="Search titles"
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
        />
      </div>

      <div className="panel p-2">
        {error ? <ErrorNote error={error} />
          : isLoading ? <div className="p-3"><Loading rows={6} /></div>
          : tasks.length === 0 ? <EmptyState title="No tasks match" hint="Loosen a filter, or give someone a task." />
          : <TaskList tasks={tasks} onOpen={setOpenTask} />}
      </div>

      <TaskDrawer taskId={openTask} onClose={closeDrawer} />
    </div>
  )
}
