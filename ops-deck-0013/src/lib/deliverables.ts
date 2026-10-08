import type { DeliverableType, Department } from '@/types/db'

export const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  product_page: 'Продукт страница',
  advertorial: 'Адверторијал',
  listicle: 'Листикл',
  quiz: 'Квиз',
  landing_localization: 'Локализација на лендинг',
  other_landing: 'Друг лендинг',
  static_ad: 'Статичен оглас',
  video_ad: 'Видео оглас',
  ugc: 'UGC',
  creative_concept: 'Креативен концепт',
  image_variation: 'Варијација на слика',
  hook_variation: 'Варијација на хук',
  creative_localization: 'Локализација на креативи',
  other_creative: 'Друг креатив',
  research: 'Истражување',
  campaign: 'Кампања',
  general_task: 'Општа задача',
  custom: 'Прилагодено',
}

export const DELIVERABLE_GROUPS: { label: string; types: DeliverableType[] }[] = [
  { label: 'Лендинг', types: ['product_page', 'advertorial', 'listicle', 'quiz', 'landing_localization', 'other_landing'] },
  { label: 'Креативи', types: ['static_ad', 'video_ad', 'ugc', 'creative_concept', 'image_variation', 'hook_variation', 'creative_localization', 'other_creative'] },
  { label: 'Друго', types: ['research', 'campaign', 'general_task', 'custom'] },
]

const LANDING: DeliverableType[] = DELIVERABLE_GROUPS[0].types
const CREATIVE: DeliverableType[] = DELIVERABLE_GROUPS[1].types

export function departmentFor(type: DeliverableType): Department {
  if (LANDING.includes(type)) return 'landing'
  if (CREATIVE.includes(type)) return 'creative'
  if (type === 'research' || type === 'campaign') return 'testing'
  return 'general'
}

export interface DeliverableDraft { type: DeliverableType; quantity: number }

export function routeTask(items: DeliverableDraft[]): Department {
  if (!items.length) return 'general'
  const weight = new Map<Department, number>()
  items.forEach((item, index) => {
    const department = departmentFor(item.type)
    weight.set(department, (weight.get(department) ?? 0) + item.quantity * 1000 - index)
  })
  return [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export function describeDeliverables(items: DeliverableDraft[]): string {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} × ${DELIVERABLE_LABELS[item.type]}`)
    .join(' · ')
}

export function progressOf(items: { quantity: number; completed_quantity: number }[]) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  const done = items.reduce((sum, item) => sum + Math.min(item.completed_quantity, item.quantity), 0)
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}
