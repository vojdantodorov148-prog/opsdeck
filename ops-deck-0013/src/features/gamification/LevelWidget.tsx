import { useQuery } from '@tanstack/react-query'
import { getLevel, levelBounds } from '@/services/signal'
import { useUserId } from '@/features/auth/session'
import { Progress } from '@/components/ui/Bits'

export function LevelWidget() {
  const userId = useUserId()
  const { data } = useQuery({
    queryKey: ['level', userId],
    queryFn: () => getLevel(userId),
    enabled: Boolean(userId),
  })
  if (!data) return null
  const { floor, ceiling } = levelBounds(data.level)
  const within = data.total_xp - floor
  const span = ceiling - floor

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-4">
      <p className="text-[15px] font-semibold">Ниво {data.level}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{within.toLocaleString('mk-MK')} / {span.toLocaleString('mk-MK')} XP</p>
      <Progress value={(within / span) * 100} className="mt-3" />
    </div>
  )
}
