import { addDays, format, isSameDay, startOfWeek } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export function weekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Monday–Friday by default; the weekend appears only when work is parked there. */
export function weekDays(anchor: Date, includeWeekend = false) {
  const start = weekStart(anchor)
  return Array.from({ length: includeWeekend ? 7 : 5 }, (_, i) => addDays(start, i))
}

export function iso(date: Date) {
  return format(date, ISO)
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function weekLabel(anchor: Date) {
  const days = weekDays(anchor, true)
  const a = days[0]
  const b = days[6]
  const same = a.getMonth() === b.getMonth()
  return same
    ? `${format(a, 'd')}–${format(b, 'd MMM yyyy')}`
    : `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`
}

/**
 * Scheduled date wins over due date. Work with neither stays unscheduled
 * rather than being force-fed into a day the person never chose.
 */
export function laneFor(task: { scheduled_date: string | null }) {
  return task.scheduled_date ?? null
}
