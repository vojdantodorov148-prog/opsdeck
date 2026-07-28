import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/ui/Drawer'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, Progress } from '@/components/ui/Bits'
import { DELIVERABLE_LABELS, progressOf } from '@/lib/deliverables'
import { DEPARTMENT, TASK_STATUS } from '@/lib/status'
import {
  addComment, getTask, listComments, resolveReview, setDeliverableProgress,
  setTaskStatus, submitForReview,
} from '@/services/tasks'
import { useSession, useUserId } from '@/features/auth/session'

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const { can } = useSession()
  const [comment, setComment] = useState('')

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId as string),
    enabled: Boolean(taskId),
  })
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => listComments(taskId as string),
    enabled: Boolean(taskId),
  })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['task', taskId] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['my-week'] })
    qc.invalidateQueries({ queryKey: ['level'] })
  }

  const progressMut = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => setDeliverableProgress(id, value),
    onSuccess: refresh,
  })
  const statusMut = useMutation({
    mutationFn: (status: Parameters<typeof setTaskStatus>[1]) => setTaskStatus(taskId as string, status),
    onSuccess: refresh,
  })
  const reviewMut = useMutation({
    mutationFn: (approve: boolean) => resolveReview(taskId as string, approve),
    onSuccess: () => { refresh(); toast.success('Прегледот е зачуван') },
  })
  const submitMut = useMutation({
    mutationFn: () => submitForReview(taskId as string, task?.created_by ?? userId),
    onSuccess: () => { refresh(); toast.success('Испратено за преглед') },
  })
  const commentMut = useMutation({
    mutationFn: () => addComment(taskId as string, userId, comment),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['comments', taskId] }) },
  })

  if (!taskId || !task) return <Drawer open={Boolean(taskId)} onClose={onClose} title="Се вчитува…"><div /></Drawer>

  const isPersonal = task.source === 'personal'
  const { total, done, pct } = progressOf(task.deliverables ?? [])
  const isReviewer = task.created_by === userId || can('tasks.assign')

  return (
    <Drawer
      open
      onClose={onClose}
      title={task.title}
      subtitle={
        isPersonal
          ? 'Лично'
          : [task.deliverables?.map((d) => `${d.quantity} ${DELIVERABLE_LABELS[d.type]}`).join(' · '), DEPARTMENT[task.department].label]
              .filter(Boolean).join('  —  ')
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'review' && isReviewer ? (
            <>
              <button className="btn-primary" onClick={() => reviewMut.mutate(true)}>Одобри</button>
              <button className="btn-quiet" onClick={() => reviewMut.mutate(false)}>Побарај измени</button>
            </>
          ) : task.status === 'done' ? (
            <button className="btn-quiet" onClick={() => statusMut.mutate('doing')}>Отвори повторно</button>
          ) : isPersonal ? (
            <button className="btn-primary" onClick={() => statusMut.mutate('done')}>Заврши</button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => submitMut.mutate()}>Испрати за преглед</button>
              <button className="btn-quiet" onClick={() => statusMut.mutate(task.status === 'blocked' ? 'doing' : 'blocked')}>
                {task.status === 'blocked' ? 'Одблокирај' : 'Блокирај'}
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={TASK_STATUS[task.status].className}>{TASK_STATUS[task.status].label}</Badge>
          {task.assignee && (
            <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <Avatar name={task.assignee.full_name} url={task.assignee.avatar_url} size={22} />
              {task.assignee.full_name}
            </span>
          )}
          {task.due_date && <span className="text-sm text-ink-soft">Рок {task.due_date}</span>}
        </div>

        {task.description && <p className="text-sm text-ink-soft whitespace-pre-wrap">{task.description}</p>}

        {total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Испораки</h3>
              <span className="text-xs text-ink-soft">{done} / {total}</span>
            </div>
            <Progress value={pct} className="mb-3" />
            <ul className="space-y-1.5">
              {(task.deliverables ?? []).map((d) => (
                <li key={d.id} className="flex items-center gap-3 h-11 px-3 rounded-xl border border-line">
                  <span className="flex-1 text-sm">{DELIVERABLE_LABELS[d.type]}</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-ghost h-8 w-8 px-0" aria-label="Намали завршена количина"
                      onClick={() => progressMut.mutate({ id: d.id, value: Math.max(0, d.completed_quantity - 1) })}
                    ><Minus size={14} /></button>
                    <span className="w-12 text-center text-sm tabular-nums">{d.completed_quantity}/{d.quantity}</span>
                    <button
                      className="btn-ghost h-8 w-8 px-0" aria-label="Зголеми завршена количина"
                      onClick={() => progressMut.mutate({ id: d.id, value: Math.min(d.quantity, d.completed_quantity + 1) })}
                    ><Plus size={14} /></button>
                  </div>
                  {d.completed_quantity >= d.quantity && <Check size={15} className="text-teal-600" />}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Коментари</h3>
          <ul className="space-y-3">
            {comments.map((c: { id: string; content: string; author?: { full_name: string; avatar_url: string | null } | null }) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar name={c.author?.full_name} url={c.author?.avatar_url} size={26} />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{c.author?.full_name ?? 'Некој'}</p>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">{c.content}</p>
                </div>
              </li>
            ))}
            {comments.length === 0 && <li className="text-sm text-ink-soft">Сѐ уште нема коментари.</li>}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="field flex-1" placeholder="Напиши коментар" value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && comment.trim() && commentMut.mutate()}
            />
            <button className="btn-quiet" disabled={!comment.trim()} onClick={() => commentMut.mutate()}>Испрати</button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
