import { addDays, format, isSameDay, startOfWeek } from 'date-fns'

export const ISO = 'yyyy-MM-dd'
export const WEEKDAY_MK = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота', 'Недела']
export const MONTH_MK = ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек']

export function weekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function weekDays(anchor: Date, includeWeekend = false) {
  const start = weekStart(anchor)
  return Array.from({ length: includeWeekend ? 7 : 5 }, (_, index) => addDays(start, index))
}

export function iso(date: Date) {
  return format(date, ISO)
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function weekdayMk(date: Date) {
  const mondayIndex = (date.getDay() + 6) % 7
  return WEEKDAY_MK[mondayIndex]
}

export function dateMk(date: Date) {
  return `${date.getDate()} ${MONTH_MK[date.getMonth()]}`
}

export function weekLabel(anchor: Date) {
  const days = weekDays(anchor, true)
  const first = days[0]
  const last = days[6]
  const sameMonth = first.getMonth() === last.getMonth()
  return sameMonth
    ? `${first.getDate()}–${last.getDate()} ${MONTH_MK[last.getMonth()]} ${last.getFullYear()}`
    : `${first.getDate()} ${MONTH_MK[first.getMonth()]} – ${last.getDate()} ${MONTH_MK[last.getMonth()]} ${last.getFullYear()}`
}

export function laneFor(task: { scheduled_date: string | null }) {
  return task.scheduled_date ?? null
}
