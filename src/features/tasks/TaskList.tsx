import { ExternalLink, Link2 } from 'lucide-react'
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
        const links = (t.deliverables ?? []).filter((d) => Boolean(d.url))
        return (
          <li key={t.id} className="flex items-center gap-2 rounded-xl row-hover px-2">
            <button className="min-w-0 flex-1 flex items-center gap-4 py-3 text-left" onClick={() => onOpen(t.id)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {t.market && (
                    <span className="inline-flex shrink-0 items-center rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                      Пазар: {t.market.code} · {t.market.name}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-xs text-ink-soft">{summary || (t.source === 'personal' ? 'Лично' : 'Општа задача')}</span>
                </div>
              </div>
              {total > 0 && (
                <div className="hidden md:block w-28 shrink-0">
                  <Progress value={pct} />
                  <p className="mt-1 text-[11px] text-ink-soft text-right tabular-nums">{done}/{total}</p>
                </div>
              )}
              {t.due_date && <span className="hidden lg:block text-xs text-ink-soft shrink-0 w-32">Рок {formatDue(t.due_date, t.due_time)}</span>}
              {t.assignee && <Avatar name={t.assignee.full_name} url={t.assignee.avatar_url} size={26} />}
              <Badge className={TASK_STATUS[t.status].className}>{TASK_STATUS[t.status].label}</Badge>
            </button>

            <div className="hidden sm:flex shrink-0 items-center gap-1 pr-1">
              {links.length > 0 ? links.slice(0, 3).map((deliverable) => (
                <a
                  key={deliverable.id}
                  href={deliverable.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Отвори ${DELIVERABLE_LABELS[deliverable.type]}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal-100 bg-teal-50 px-2 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  <ExternalLink size={13} />
                  Отвори
                </a>
              )) : total > 0 ? (
                <button
                  onClick={() => onOpen(t.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-xs text-ink-soft hover:border-teal-200 hover:text-teal-700"
                >
                  <Link2 size={13} /> Додај линк
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function formatDue(date: string, time?: string | null) {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}${time ? ` ${time.slice(0, 5)}` : ''}`
}
