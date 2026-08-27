import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { addWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, GripVertical, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, ErrorNote } from '@/components/ui/Bits'
import { TaskDrawer } from '@/features/tasks/TaskDrawer'
import { useUserId } from '@/features/auth/session'
import { createPersonalTask, myWeek, rescheduleTask, setTaskStatus } from '@/services/tasks'
import { dateMk, iso, isToday, weekdayMk, weekDays, weekLabel } from '@/lib/week'
import { DEPARTMENT } from '@/lib/status'
import { cn } from '@/lib/cn'
import type { TaskWithRelations } from '@/types/db'

export function MyDay() {
  const userId = useUserId()
  const qc = useQueryClient()
  const [anchor, setAnchor] = useState(new Date())
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ day: string; value: string } | null>(null)

  const days = weekDays(anchor)
  const from = iso(days[0])
  const to = iso(days[days.length - 1])

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['my-week', from, userId],
    queryFn: () => myWeek(from, to),
    enabled: Boolean(userId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-week'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const move = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string | null }) => rescheduleTask(id, date),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })
  const complete = useMutation({
    mutationFn: (id: string) => setTaskStatus(id, 'done'),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['level'] }) },
  })
  const add = useMutation({
    mutationFn: ({ title, date }: { title: string; date: string }) => createPersonalTask(title, date, userId),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const byDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()
    days.forEach((d) => map.set(iso(d), []))
    const unscheduled: TaskWithRelations[] = []
    tasks.forEach((t) => {
      const lane = t.scheduled_date
      if (lane && map.has(lane)) map.get(lane)!.push(t)
      else unscheduled.push(t)
    })
    map.forEach((list) =>
      list.sort((a, b) => (a.scheduled_time ?? '99').localeCompare(b.scheduled_time ?? '99')))
    return { map, unscheduled }
  }, [tasks, days])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    const target = e.over ? String(e.over.id) : null
    if (!target) return
    move.mutate({ id, date: target === 'unscheduled' ? null : target })
  }

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        title="Мој ден"
        subtitle="Твојата приватна недела. Само ти го гледаш овој распоред; службените задачи се додаваат автоматски."
        action={
          <div className="flex items-center gap-1">
            <button className="btn-quiet h-9 w-9 px-0" onClick={() => setAnchor((a) => addWeeks(a, -1))} aria-label="Претходна недела"><ChevronLeft size={16} /></button>
            <button className="btn-quiet h-9 px-3 text-xs" onClick={() => setAnchor(new Date())}>Оваа недела</button>
            <button className="btn-quiet h-9 w-9 px-0" onClick={() => setAnchor((a) => addWeeks(a, 1))} aria-label="Следна недела"><ChevronRight size={16} /></button>
          </div>
        }
      />

      <div className="-mt-3 mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{weekLabel(anchor)}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-ink-soft">
          <LockKeyhole size={12} /> Приватно за твојот акаунт
        </span>
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={8} /> : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="space-y-6">
            {days.map((day) => {
              const key = iso(day)
              const list = byDay.map.get(key) ?? []
              return (
                <DayLane key={key} id={key} today={isToday(day)} label={weekdayMk(day)} date={dateMk(day)}>
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={() => setOpenTask(t.id)} onComplete={() => complete.mutate(t.id)} />
                  ))}

                  {draft?.day === key ? (
                    <div className="flex items-center gap-3 h-11 px-3">
                      <span className="h-[18px] w-[18px] rounded-full border-2 border-line shrink-0" />
                      <input
                        autoFocus
                        className="flex-1 bg-transparent text-sm outline-none"
                        placeholder="Напиши и притисни Enter"
                        value={draft.value}
                        onChange={(e) => setDraft({ day: key, value: e.target.value })}
                        onBlur={() => setDraft(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setDraft(null)
                          if (e.key === 'Enter' && draft.value.trim()) {
                            add.mutate({ title: draft.value.trim(), date: key })
                            setDraft({ day: key, value: '' })
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 h-10 px-3 w-full text-sm text-ink-soft hover:text-teal-700 rounded-xl row-hover"
                      onClick={() => setDraft({ day: key, value: '' })}
                    >
                      <Plus size={15} /> Додај нешто
                    </button>
                  )}
                </DayLane>
              )
            })}

            {byDay.unscheduled.length > 0 && (
              <DayLane id="unscheduled" label="Нераспоредено" date="без избран ден">
                {byDay.unscheduled.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={() => setOpenTask(t.id)} onComplete={() => complete.mutate(t.id)} />
                ))}
              </DayLane>
            )}
          </div>
        </DndContext>
      )}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

function DayLane({ id, label, date, today, children }: {
  id: string; label: string; date: string; today?: boolean; children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section ref={setNodeRef} className={cn('rounded-2xl transition', isOver && 'ring-2 ring-teal-200 bg-teal-50/30')}>
      <header className="flex items-baseline gap-3 pb-2 border-b border-line">
        <h2 className={cn('text-sm font-semibold uppercase tracking-wide', today ? 'text-teal-600' : 'text-ink')}>{label}</h2>
        <span className="text-xs text-ink-soft">{date}</span>
        {today && <span className="ml-auto text-[11px] font-medium text-teal-600">Денес</span>}
      </header>
      <div className="pt-1">{children}</div>
    </section>
  )
}

function TaskRow({ task, onOpen, onComplete }: { task: TaskWithRelations; onOpen: () => void; onComplete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const label = task.source === 'personal' ? 'Лично' : DEPARTMENT[task.department].label

  return (
    <div
      ref={setNodeRef} style={style}
      className={cn('group flex items-center gap-3 h-11 px-3 rounded-xl row-hover', isDragging && 'opacity-60 shadow-float bg-white z-10 relative')}
    >
      <button
        className="grid place-items-center text-ink-soft/40 opacity-0 group-hover:opacity-100 cursor-grab"
        aria-label="Премести во друг ден" {...attributes} {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <button
        onClick={onComplete} aria-label={`Заврши ${task.title}`}
        className="h-[18px] w-[18px] rounded-full border-2 border-line hover:border-teal-400 hover:bg-teal-50 shrink-0 transition"
      />
      <span className="w-14 text-xs text-ink-soft tabular-nums shrink-0">
        {task.scheduled_time ? task.scheduled_time.slice(0, 5) : ''}
      </span>
      <button className="min-w-0 flex-1 text-left text-sm truncate" onClick={onOpen}>{task.title}</button>
      {task.market && (
        <span className="shrink-0 rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
          {task.market.code} · {task.market.name}
        </span>
      )}
      <span className="text-xs text-ink-soft shrink-0">{label}</span>
    </div>
  )
}
