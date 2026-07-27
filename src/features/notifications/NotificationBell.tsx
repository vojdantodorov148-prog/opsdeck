import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { listNotifications, markAllRead, markRead } from '@/services/signal'
import { useUserId } from '@/features/auth/session'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

export function NotificationBell() {
  const userId = useUserId()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => listNotifications(userId),
    enabled: Boolean(userId),
  })
  const unread = data.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, qc])

  return (
    <div className="relative">
      <button
        className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-teal-50 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell size={20} strokeWidth={1.8} className="text-ink-soft" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-teal-500 text-white text-[10px] font-semibold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50 panel shadow-float p-2 animate-fade-in">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-teal-600 hover:underline"
                  onClick={async () => {
                    await markAllRead(userId)
                    qc.invalidateQueries({ queryKey: ['notifications', userId] })
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {data.length === 0 && <p className="px-3 py-6 text-sm text-ink-soft text-center">Nothing needs you right now.</p>}
              {data.map((n) => (
                <button
                  key={n.id}
                  className={cn('w-full text-left px-3 py-2.5 rounded-xl row-hover', !n.read_at && 'bg-teal-50/40')}
                  onClick={async () => {
                    if (!n.read_at) { await markRead(n.id); qc.invalidateQueries({ queryKey: ['notifications', userId] }) }
                    setOpen(false)
                    if (n.entity_type === 'task' && n.entity_id) navigate(`/tasks?task=${n.entity_id}`)
                  }}
                >
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.message && <p className="text-xs text-ink-soft truncate">{n.message}</p>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
