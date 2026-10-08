import { describe, expect, it } from 'vitest'
import { iso, laneFor, weekDays, weekStart } from '@/lib/week'

describe('My Day week', () => {
  it('starts on Monday regardless of the day you open it', () => {
    expect(iso(weekStart(new Date('2026-07-30T12:00:00Z')))).toBe('2026-07-27')
    expect(iso(weekStart(new Date('2026-07-26T12:00:00Z')))).toBe('2026-07-20')
  })

  it('shows Monday to Friday by default', () => {
    const days = weekDays(new Date('2026-07-29T12:00:00Z'))
    expect(days).toHaveLength(5)
    expect(iso(days[0])).toBe('2026-07-27')
    expect(iso(days[4])).toBe('2026-07-31')
  })

  it('keeps due date and scheduled date separate', () => {
    expect(laneFor({ scheduled_date: '2026-07-29' })).toBe('2026-07-29')
    expect(laneFor({ scheduled_date: null })).toBeNull()
  })
})
