import type { DeliverableType, Department } from '@/types/db'

export const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  product_page: 'Product Page',
  advertorial: 'Advertorial',
  listicle: 'Listicle',
  quiz: 'Quiz',
  landing_localization: 'Landing Localization',
  other_landing: 'Other Landing',
  static_ad: 'Static Ad',
  video_ad: 'Video Ad',
  ugc: 'UGC',
  creative_concept: 'Creative Concept',
  image_variation: 'Image Variation',
  hook_variation: 'Hook Variation',
  creative_localization: 'Creative Localization',
  other_creative: 'Other Creative',
  research: 'Research',
  campaign: 'Campaign',
  general_task: 'General Task',
  custom: 'Custom',
}

export const DELIVERABLE_GROUPS: { label: string; types: DeliverableType[] }[] = [
  { label: 'Landing', types: ['product_page', 'advertorial', 'listicle', 'quiz', 'landing_localization', 'other_landing'] },
  { label: 'Creative', types: ['static_ad', 'video_ad', 'ugc', 'creative_concept', 'image_variation', 'hook_variation', 'creative_localization', 'other_creative'] },
  { label: 'Other', types: ['research', 'campaign', 'general_task', 'custom'] },
]

const LANDING: DeliverableType[] = DELIVERABLE_GROUPS[0].types
const CREATIVE: DeliverableType[] = DELIVERABLE_GROUPS[1].types

/**
 * Mirrors fn_department_for_deliverable in 0002_automation.sql.
 * Kept client-side only for optimistic UI; the database remains the source of truth.
 */
export function departmentFor(type: DeliverableType): Department {
  if (LANDING.includes(type)) return 'landing'
  if (CREATIVE.includes(type)) return 'creative'
  if (type === 'research' || type === 'campaign') return 'testing'
  return 'general'
}

export interface DeliverableDraft { type: DeliverableType; quantity: number }

/** The task lands where the bulk of the work lands. */
export function routeTask(items: DeliverableDraft[]): Department {
  if (!items.length) return 'general'
  const weight = new Map<Department, number>()
  items.forEach((i, index) => {
    const d = departmentFor(i.type)
    weight.set(d, (weight.get(d) ?? 0) + i.quantity * 1000 - index)
  })
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** "2 Advertorials · 1 Product Page" */
export function describeDeliverables(items: DeliverableDraft[]): string {
  return items
    .filter((i) => i.quantity > 0)
    .map((i) => `${i.quantity} ${DELIVERABLE_LABELS[i.type]}${i.quantity > 1 ? 's' : ''}`)
    .join(' · ')
}

export function progressOf(items: { quantity: number; completed_quantity: number }[]) {
  const total = items.reduce((s, i) => s + i.quantity, 0)
  const done = items.reduce((s, i) => s + Math.min(i.completed_quantity, i.quantity), 0)
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}
