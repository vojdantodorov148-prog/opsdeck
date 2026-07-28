import { describe, expect, it } from 'vitest'
import { departmentFor, routeTask, describeDeliverables, progressOf } from '@/lib/deliverables'

describe('automatic routing', () => {
  it('sends landing deliverables to the landing factory', () => {
    expect(departmentFor('advertorial')).toBe('landing')
    expect(departmentFor('product_page')).toBe('landing')
    expect(departmentFor('quiz')).toBe('landing')
  })

  it('sends creative deliverables to the creative factory', () => {
    expect(departmentFor('static_ad')).toBe('creative')
    expect(departmentFor('ugc')).toBe('creative')
    expect(departmentFor('hook_variation')).toBe('creative')
  })

  it('routes a mixed task by weight of work', () => {
    expect(routeTask([{ type: 'advertorial', quantity: 1 }, { type: 'static_ad', quantity: 4 }])).toBe('creative')
    expect(routeTask([{ type: 'product_page', quantity: 3 }, { type: 'video_ad', quantity: 1 }])).toBe('landing')
  })

  it('breaks ties in favour of the first deliverable chosen', () => {
    expect(routeTask([{ type: 'advertorial', quantity: 2 }, { type: 'static_ad', quantity: 2 }])).toBe('landing')
  })

  it('falls back to general with no deliverables', () => {
    expect(routeTask([])).toBe('general')
  })
})

describe('deliverable summaries', () => {
  it('reads the way a person would say it', () => {
    expect(describeDeliverables([{ type: 'advertorial', quantity: 2 }])).toBe('2 × Адверторијал')
    expect(describeDeliverables([{ type: 'product_page', quantity: 1 }, { type: 'advertorial', quantity: 2 }]))
      .toBe('1 × Продукт страница · 2 × Адверторијал')
  })
})

describe('progress', () => {
  it('counts completed units, not rows', () => {
    const p = progressOf([
      { quantity: 2, completed_quantity: 2 },
      { quantity: 2, completed_quantity: 1 },
    ])
    expect(p).toEqual({ total: 4, done: 3, pct: 75 })
  })

  it('never exceeds the quantity asked for', () => {
    expect(progressOf([{ quantity: 1, completed_quantity: 5 }]).pct).toBe(100)
  })

  it('handles an empty task', () => {
    expect(progressOf([]).pct).toBe(0)
  })
})
