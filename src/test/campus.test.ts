import { describe, expect, it } from 'vitest'
import { BUILDINGS, buildCampusSvg, labelAnchors } from '@/features/home/campusScene'

describe('campus scene', () => {
  it('gives every building a label anchor inside the frame', () => {
    const anchors = labelAnchors()
    expect(anchors).toHaveLength(BUILDINGS.length)
    anchors.forEach((a) => {
      expect(a.left).toBeGreaterThan(5)
      expect(a.left).toBeLessThan(95)
      expect(a.top).toBeGreaterThan(5)
      expect(a.top).toBeLessThan(95)
    })
  })

  it('keeps building footprints from colliding', () => {
    for (let i = 0; i < BUILDINGS.length; i++) {
      for (let j = i + 1; j < BUILDINGS.length; j++) {
        const a = BUILDINGS[i]
        const b = BUILDINGS[j]
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    }
  })

  it('draws every building as a clickable hotspot', () => {
    const svg = buildCampusSvg()
    BUILDINGS.forEach((b) => expect(svg).toContain(`data-building="${b.id}"`))
  })
})
