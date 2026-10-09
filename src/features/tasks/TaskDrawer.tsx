import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, ExternalLink, ImageIcon, Link2, Minus, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/components/ui/Drawer'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, Progress } from '@/components/ui/Bits'
import { DELIVERABLE_LABELS, describeDeliverables, progressOf } from '@/lib/deliverables'
import { DEPARTMENT, TASK_STATUS } from '@/lib/status'
import {
  addComment, completeTask, deleteTask, getTask, listComments, setDeliverableProgress,
  setDeliverableUrl, setTaskResultFolderUrl, setTaskStatus, updateTask,
} from '@/services/tasks'
import { useSession, useUserId } from '@/features/auth/session'
import { listProfiles } from '@/services/reference'

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const { can } = useSession()
  const [comment, setComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setConfirmDelete(false) }, [taskId])

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
  const { data: people = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    enabled: Boolean(taskId) && can('tasks.assign'),
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
  const completeMut = useMutation({
    mutationFn: () => completeTask(taskId as string),
    onSuccess: () => { refresh(); toast.success('Задачата е завршена') },
    onError: (e: Error) => toast.error(e.message),
  })
  const commentMut = useMutation({
    mutationFn: () => addComment(taskId as string, userId, comment),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['comments', taskId] }) },
  })
  const assignMut = useMutation({
    mutationFn: (assignedTo: string | null) => updateTask(taskId as string, { assigned_to: assignedTo }),
    onSuccess: () => { refresh(); toast.success('Извршителот е ажуриран') },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: () => deleteTask(taskId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['my-week'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      toast.success('Задачата е избришана')
      setConfirmDelete(false)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!taskId || !task) return <Drawer open={Boolean(taskId)} onClose={onClose} title="Се вчитува…" centered width="max-w-5xl"><div /></Drawer>

  const isPersonal = task.source === 'personal'
  const { total, done, pct } = progressOf(task.deliverables ?? [])
  const canAssign = can('tasks.assign')
  const isAssignee = Boolean(userId && task.assigned_to === userId)
  const canWork = isAssignee || canAssign
  const canDelete = canAssign || task.created_by === userId
  const productBrief = task.product?.brief?.trim() ?? ''
  const productImageUrl = task.reference_image_url || task.product?.images?.[0]?.public_url || null
  const productImageSource = task.reference_image_url ? 'Слика додадена на задачата' : 'Главна слика од ПРОИЗВОДИ'

  async function copyProductBrief() {
    if (!productBrief) return
    try {
      await navigator.clipboard.writeText(productBrief)
      toast.success('Целиот product brief е копиран')
    } catch {
      toast.error('Brief-от не можеше да се копира')
    }
  }

  async function downloadProductImage() {
    if (!productImageUrl) return
    try {
      const response = await fetch(productImageUrl)
      if (!response.ok) throw new Error('download failed')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = imageDownloadName(task.product?.name ?? 'product-image', blob.type)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(productImageUrl, '_blank', 'noopener,noreferrer')
      toast.error('Сликата се отвори во нов таб бидејќи browser-от не дозволи директен download.')
    }
  }

  return (
    <Drawer
      open
      centered
      width="max-w-5xl"
      onClose={onClose}
      title={task.title}
      subtitle={
        isPersonal
          ? 'Лично'
          : [describeDeliverables(task.deliverables ?? []), DEPARTMENT[task.department].label]
              .filter(Boolean).join('  —  ')
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {task.status === 'done' ? (
              canWork ? <button className="btn-quiet" onClick={() => statusMut.mutate('doing')}>Отвори повторно</button> : null
            ) : isPersonal ? (
              isAssignee ? <button className="btn-primary" onClick={() => statusMut.mutate('done')}>Заврши</button> : null
            ) : canWork && task.assigned_to ? (
              <>
                <button className="btn-primary" disabled={completeMut.isPending} onClick={() => completeMut.mutate()}>
                  {completeMut.isPending ? 'Се завршува…' : 'Завршено'}
                </button>
                <button className="btn-quiet" onClick={() => statusMut.mutate(task.status === 'blocked' ? 'doing' : 'blocked')}>
                  {task.status === 'blocked' ? 'Одблокирај' : 'Блокирај'}
                </button>
              </>
            ) : task.assigned_to ? (
              <span className="text-xs text-ink-soft">Само доделениот член може да ја заврши задачата.</span>
            ) : (
              <span className="text-xs text-amber-700">Задачата нема извршител. Додели ја на член пред да се заврши.</span>
            )}
          </div>
          {canDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700">Избриши ја задачата трајно?</span>
                <button className="btn-quiet h-9" onClick={() => setConfirmDelete(false)}>Не</button>
                <button className="btn h-9 bg-red-600 text-white hover:bg-red-700" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
                  {deleteMut.isPending ? 'Се брише…' : 'Да, избриши'}
                </button>
              </div>
            ) : (
              <button className="btn-ghost h-9 px-3 text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Избриши
              </button>
            )
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
          {task.due_date && <span className="text-sm text-ink-soft">Рок {formatDue(task.due_date, task.due_time)}</span>}
        </div>

        {!isPersonal && (
          <div className={`rounded-2xl border p-3.5 ${task.market ? 'border-teal-200 bg-teal-50/70' : 'border-amber-200 bg-amber-50/60'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${task.market ? 'text-teal-700' : 'text-amber-700'}`}>Пазар / држава</p>
            {task.market ? (
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-semibold text-ink">{task.market.code}</span>
                <span className="text-sm font-medium text-ink">{task.market.name}</span>
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-amber-800">Нема избран пазар за оваа задача</p>
            )}
          </div>
        )}

        {canAssign && !isPersonal && (
          <div className="rounded-2xl border border-line bg-panel/60 p-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Доделено на</label>
            <select
              className="field h-10"
              value={task.assigned_to ?? ''}
              disabled={assignMut.isPending}
              onChange={(e) => assignMut.mutate(e.target.value || null)}
            >
              <option value="">Недоделена задача</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </select>
            {!task.assigned_to && <p className="mt-1.5 text-xs text-amber-700">Оваа задача нема извршител. Избери член за да може тој да ја означи како завршена.</p>}
          </div>
        )}

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
                <li key={d.id} className="rounded-xl border border-line px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{DELIVERABLE_LABELS[d.type]}</span>
                    <div className="flex items-center gap-1">
                      {canWork && (
                        <button
                          className="btn-ghost h-8 w-8 px-0" aria-label="Намали завршена количина"
                          onClick={() => progressMut.mutate({ id: d.id, value: Math.max(0, d.completed_quantity - 1) })}
                        ><Minus size={14} /></button>
                      )}
                      <span className="w-12 text-center text-sm tabular-nums">{d.completed_quantity}/{d.quantity}</span>
                      {canWork && (
                        <button
                          className="btn-ghost h-8 w-8 px-0" aria-label="Зголеми завршена количина"
                          onClick={() => progressMut.mutate({ id: d.id, value: Math.min(d.quantity, d.completed_quantity + 1) })}
                        ><Plus size={14} /></button>
                      )}
                    </div>
                    {d.completed_quantity >= d.quantity && <Check size={15} className="text-teal-600" />}
                  </div>
                  {(d.angle_title || d.angle_body) && (
                    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Агол</p>
                      {d.angle_title && <p className="mt-1 text-sm font-medium text-ink">{d.angle_title}</p>}
                      {d.angle_body && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink-soft">{d.angle_body}</p>}
                    </div>
                  )}
                  {d.ad_headline && (
                    <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Ad headline</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{d.ad_headline}</p>
                    </div>
                  )}
                  {task.department !== 'creative' && (
                    <DeliverableLink deliverableId={d.id} initialUrl={d.url} onSaved={refresh} editable={canWork} />
                  )}
                </li>
              ))}
            </ul>
            {task.department === 'creative' && (
              <TaskFolderLink taskId={task.id} initialUrl={task.result_folder_url} onSaved={refresh} editable={canWork} />
            )}
          </div>
        )}

        {productBrief && (
          <div className="rounded-2xl border border-line bg-panel/55 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Product brief</p>
                <p className="mt-1 truncate text-sm text-ink-soft">{oneLinePreview(productBrief)}</p>
              </div>
              <button type="button" className="btn-quiet h-9 shrink-0 px-3 text-xs" onClick={copyProductBrief}>
                <Copy size={14} /> Copy full brief
              </button>
            </div>
          </div>
        )}

        {productImageUrl && (
          <div className="rounded-2xl border border-line bg-white p-3.5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel">
                <img src={productImageUrl} alt="Product reference" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Product image</p>
                <p className="mt-1 truncate text-xs text-ink-soft">{productImageSource}</p>
              </div>
              <button type="button" className="btn-primary h-9 shrink-0 px-3 text-xs" onClick={downloadProductImage}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        )}

        {!productImageUrl && task.product && (
          <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-3.5">
            <div className="flex items-center gap-2 text-xs text-ink-soft"><ImageIcon size={14} /> Нема достапна product image за оваа задача.</div>
          </div>
        )}

        {task.product?.main_url && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Продукт линк</p>
                <p className="mt-1 text-sm font-medium text-ink">{task.product.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-soft">{task.product.main_url}</p>
              </div>
              <a
                href={task.product.main_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary h-9 shrink-0 px-3 text-xs"
              >
                <ExternalLink size={14} /> Отвори
              </a>
            </div>
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


function TaskFolderLink({ taskId, initialUrl, onSaved, editable }: { taskId: string; initialUrl: string | null; onSaved: () => void; editable: boolean }) {
  const [url, setUrl] = useState(initialUrl ?? '')

  useEffect(() => { setUrl(initialUrl ?? '') }, [initialUrl, taskId])

  const save = useMutation({
    mutationFn: () => setTaskResultFolderUrl(taskId, url),
    onSuccess: () => {
      onSaved()
      toast.success(url.trim() ? 'Folder линкот е зачуван' : 'Folder линкот е отстранет')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openUrl = url.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : ''

  return (
    <div className="mt-3 rounded-2xl border border-teal-100 bg-teal-50/45 p-3.5">
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Готови креативи</p>
        <p className="mt-0.5 text-xs text-ink-soft">Еден folder link за целата задача — без посебен линк за секој креатив.</p>
      </div>
      <div className="flex items-center gap-2">
        {editable ? (
          <>
            <div className="relative min-w-0 flex-1">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                className="field h-10 pl-8 pr-3 text-sm"
                placeholder="Залепи линк до folder со готови креативи"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') save.mutate() }}
              />
            </div>
            <button className="btn-quiet h-10 px-3" onClick={() => save.mutate()} disabled={save.isPending} aria-label="Зачувај folder линк">
              <Save size={14} /> Зачувај
            </button>
          </>
        ) : (
          <div className="min-w-0 flex-1 text-xs text-ink-soft">{url.trim() ? 'Folder линкот е достапен.' : 'Нема додаден folder линк.'}</div>
        )}
        {openUrl && (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="btn-primary h-10 shrink-0 px-3 text-xs">
            <ExternalLink size={14} /> Отвори folder
          </a>
        )}
      </div>
    </div>
  )
}

function DeliverableLink({ deliverableId, initialUrl, onSaved, editable }: { deliverableId: string; initialUrl: string | null; onSaved: () => void; editable: boolean }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const save = useMutation({
    mutationFn: () => setDeliverableUrl(deliverableId, url),
    onSuccess: () => { onSaved(); toast.success(url.trim() ? 'Линкот е зачуван' : 'Линкот е отстранет') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mt-2 flex items-center gap-2">
      {editable ? (
        <>
          <div className="relative min-w-0 flex-1">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              className="field h-9 pl-8 pr-3 text-xs"
              placeholder="Залепи линк до готовиот фајл"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') save.mutate() }}
            />
          </div>
          <button className="btn-quiet h-9 px-3" onClick={() => save.mutate()} disabled={save.isPending} aria-label="Зачувај линк"><Save size={14} /></button>
        </>
      ) : (
        <div className="min-w-0 flex-1 text-xs text-ink-soft">{url.trim() ? 'Готовиот линк е достапен за отворање.' : 'Нема додаден готов линк.'}</div>
      )}
      {url.trim() && (
        <a href={/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`} target="_blank" rel="noopener noreferrer" className="btn-primary h-9 px-3 text-xs">
          <ExternalLink size={14} /> Отвори
        </a>
      )}
    </div>
  )
}

function formatDue(date: string, time?: string | null) {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}${time ? ` во ${time.slice(0, 5)}` : ''}`
}


function oneLinePreview(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function imageDownloadName(productName: string, mimeType: string) {
  const base = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product-image'
  const ext = mimeType === 'image/png' ? 'png'
    : mimeType === 'image/webp' ? 'webp'
      : mimeType === 'image/gif' ? 'gif'
        : mimeType === 'image/svg+xml' ? 'svg'
          : 'jpg'
  return `${base}.${ext}`
}
