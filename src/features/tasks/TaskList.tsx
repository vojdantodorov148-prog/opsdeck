import { Avatar } from '@/components/ui/Avatar'
import { Badge, Progress } from '@/components/ui/Bits'
import { DELIVERABLE_LABELS, progressOf } from '@/lib/deliverables'
import { TASK_STATUS } from '@/lib/status'
import type { TaskWithRelations } from '@/types/db'

export function TaskList({ tasks, onOpen }: { tasks: TaskWithRelations[]; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const { total, done, pct } = progressOf(t.deliverables ?? [])
        const summary = (t.deliverables ?? [])
          .map((d) => `${d.quantity} × ${DELIVERABLE_LABELS[d.type]}`)
          .join(' · ')
        return (
          <li key={t.id}>
            <button className="w-full flex items-center gap-4 py-3 px-2 rounded-xl row-hover text-left" onClick={() => onOpen(t.id)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="text-xs text-ink-soft truncate">{summary || (t.source === 'personal' ? 'Лично' : 'Општа задача')}</p>
              </div>
              {total > 0 && (
                <div className="hidden md:block w-28 shrink-0">
                  <Progress value={pct} />
                  <p className="mt-1 text-[11px] text-ink-soft text-right tabular-nums">{done}/{total}</p>
                </div>
              )}
              {t.due_date && <span className="hidden lg:block text-xs text-ink-soft shrink-0 w-20">Рок {t.due_date.slice(5)}</span>}
              {t.assignee && <Avatar name={t.assignee.full_name} url={t.assignee.avatar_url} size={26} />}
              <Badge className={TASK_STATUS[t.status].className}>{TASK_STATUS[t.status].label}</Badge>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
