/**
 * Campus geometry, kept free of React so the drawing can be unit-tested and
 * exported. Screen position is derived from world position, so moving a
 * building moves its label with it.
 */

const S = 26
const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)

export const VIEW = { x: -470, y: -300, w: 940, h: 580 }

export function iso(x: number, y: number, z = 0) {
  return { x: (x - y) * COS * S, y: (x + y) * SIN * S - z * S }
}

const p = (q: { x: number; y: number }) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`
const poly = (pts: { x: number; y: number }[]) => pts.map(p).join(' ')

export interface BuildingSpec {
  id: 'landing' | 'creative' | 'testing' | 'office' | 'tools'
  label: string
  unit: string
  to: string
  x: number
  y: number
  w: number
  d: number
  h: number
  roof: string
}

/** World coordinates chosen so the five buildings read left / top / right / centre / lower-right. */
export const BUILDINGS: BuildingSpec[] = [
  { id: 'landing',  label: 'Landing Factory',  unit: 'in progress',      to: '/landings',  x: -6.6, y:  1.4, w: 4.6, d: 4.0, h: 2.0, roof: '#4C5451' },
  { id: 'creative', label: 'Creative Factory', unit: 'in progress',      to: '/creatives', x: -3.6, y: -5.6, w: 4.4, d: 4.0, h: 3.2, roof: '#464E4B' },
  { id: 'testing',  label: 'Testing',          unit: 'active tests',     to: '/testing',   x:  3.4, y: -5.4, w: 4.6, d: 4.0, h: 2.4, roof: '#4C5451' },
  { id: 'office',   label: 'Main Office',      unit: 'team members',     to: '/team',      x: -1.4, y:  0.4, w: 5.6, d: 4.8, h: 2.6, roof: '#3C4442' },
  { id: 'tools',    label: 'Tool Center',      unit: 'tools connected',  to: '/tools',     x:  5.4, y:  2.4, w: 4.0, d: 3.4, h: 1.8, roof: '#4C5451' },
]

const TREES: [number, number, number][] = [
  [-9.2, -3.0, 1], [-8.0, -5.2, .85], [-6.0, -6.4, .95], [-1.6, -7.4, .8],
  [-9.4, 3.0, .95], [-8.2, 6.0, 1.05], [-5.6, 7.2, .9], [-2.2, 7.6, .8],
  [1.2, -7.6, .9], [4.0, -7.4, .8], [8.6, -5.4, 1], [9.4, -2.2, .85],
  [9.6, 2.0, .95], [8.0, 6.4, .9], [1.8, 7.2, .85], [-3.0, -1.8, .7],
  [2.4, 3.6, .7], [-8.6, 0.0, .75], [6.4, -1.6, .7],
]

const GROUND: [number, number][] = [[-11, -9], [11, -9], [11, 9], [-11, 9]]

const PATHS: [number, number][][] = [
  [[-9.4, -0.4], [9.4, -0.4], [9.4, 0.7], [-9.4, 0.7]],
  [[-0.9, -8.2], [0.2, -8.2], [0.2, 8.2], [-0.9, 8.2]],
  [[4.4, -7.4], [5.4, -7.4], [5.4, 7.4], [4.4, 7.4]],
]

function building(b: BuildingSpec) {
  const { x, y, w, d, h } = b
  const top = poly([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)])
  const left = poly([iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)])
  const right = poly([iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)])
  const c = iso(x + w / 2, y + d / 2)

  const rows = Math.max(1, Math.round(h))
  let glass = ''
  for (let r = 0; r < rows; r++) {
    const zTop = h - (r * h) / rows - 0.2
    const zBot = zTop - (h / rows) * 0.52
    const i = 0.24
    glass +=
      `<polygon points="${poly([iso(x + i, y + d, zTop), iso(x + w - i, y + d, zTop), iso(x + w - i, y + d, zBot), iso(x + i, y + d, zBot)])}" fill="url(#glow)" opacity=".92"/>` +
      `<polygon points="${poly([iso(x + w, y + i, zTop), iso(x + w, y + d - i, zTop), iso(x + w, y + d - i, zBot), iso(x + w, y + i, zBot)])}" fill="url(#glow)" opacity=".58"/>`
  }

  return (
    `<g data-building="${b.id}" class="campus-building" tabindex="0" role="link" aria-label="${b.label}">` +
    `<ellipse cx="${c.x.toFixed(1)}" cy="${(c.y + 7).toFixed(1)}" rx="${(w * S * 0.8).toFixed(1)}" ry="${(d * S * 0.36).toFixed(1)}" fill="#0F1B1A" opacity=".08"/>` +
    `<polygon points="${left}" fill="#CCC7BE"/>` +
    `<polygon points="${right}" fill="#B5AFA6"/>` +
    glass +
    `<polygon points="${top}" fill="${b.roof}"/>` +
    `<polygon points="${top}" fill="url(#sun)" opacity=".28"/>` +
    `</g>`
  )
}

function tree(x: number, y: number, s: number) {
  const b = iso(x, y)
  return (
    `<g transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${s})">` +
    `<ellipse cx="0" cy="2" rx="10" ry="4.5" fill="#0F1B1A" opacity=".07"/>` +
    `<rect x="-1.6" y="-10" width="3.2" height="12" rx="1.4" fill="#8A7A63"/>` +
    `<circle cx="0" cy="-16" r="10" fill="#6E9265"/>` +
    `<circle cx="-5" cy="-11" r="7.5" fill="#5D8256"/>` +
    `<circle cx="5.5" cy="-12" r="7" fill="#7DA271"/>` +
    `<circle cx="0" cy="-20" r="6.5" fill="#8AB07C"/>` +
    `</g>`
  )
}

function lamp(x: number, y: number) {
  const b = iso(x, y)
  return (
    `<g transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})">` +
    `<rect x="-1" y="-22" width="2" height="22" fill="#9AA39F"/>` +
    `<circle cx="0" cy="-24" r="3.4" fill="#FFD9A0"/>` +
    `<circle cx="0" cy="-24" r="8" fill="#FFD9A0" opacity=".18"/>` +
    `</g>`
  )
}

/** Where each label should float, in percent of the rendered box. */
export function labelAnchors() {
  return BUILDINGS.map((b) => {
    const top = iso(b.x + b.w / 2, b.y + b.d / 2, b.h)
    return {
      id: b.id,
      left: ((top.x - VIEW.x) / VIEW.w) * 100,
      top: ((top.y - 34 - VIEW.y) / VIEW.h) * 100,
    }
  })
}

export function buildCampusSvg() {
  const sorted = [...BUILDINGS].sort((a, b) => a.x + a.y - (b.x + b.y))
  return (
    `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" xmlns="http://www.w3.org/2000/svg" ` +
    `class="absolute inset-0 h-full w-full" role="img" aria-label="Isometric view of the company campus">` +
    `<defs>` +
    `<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE3B0"/><stop offset="100%" stop-color="#F3B96B"/></linearGradient>` +
    `<linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFF6E4"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="lawn" x1="0.1" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="#E6EDE3"/><stop offset="100%" stop-color="#CFDBCE"/></linearGradient>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FDFEFD"/><stop offset="100%" stop-color="#EEF4F2"/></linearGradient>` +
    `</defs>` +
    `<rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" fill="url(#sky)"/>` +
    `<polygon points="${poly(GROUND.map(([x, y]) => iso(x, y)))}" fill="url(#lawn)" stroke="#C4D2C6" stroke-width="1.5"/>` +
    PATHS.map((path) => `<polygon points="${poly(path.map(([x, y]) => iso(x, y)))}" fill="#E9E4D9"/>`).join('') +
    TREES.filter(([, y]) => y < -0.4).map(([x, y, s]) => tree(x, y, s)).join('') +
    lamp(-2.2, -0.9) + lamp(6.2, -0.9) +
    sorted.map(building).join('') +
    TREES.filter(([, y]) => y >= -0.4).map(([x, y, s]) => tree(x, y, s)).join('') +
    lamp(-5.6, 5.2) + lamp(2.6, 5.2) +
    `</svg>`
  )
}
