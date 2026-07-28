/**
 * Wide, cozy isometric campus. Plain SVG keeps the home page fast and easy to
 * maintain while giving the product a distinct, gamified identity.
 */
const S = 25
const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)

export const VIEW = { x: -560, y: -275, w: 1120, h: 440 }

export function iso(x: number, y: number, z = 0) {
  return { x: (x - y) * COS * S, y: (x + y) * SIN * S - z * S }
}

const point = (value: { x: number; y: number }) => `${value.x.toFixed(1)},${value.y.toFixed(1)}`
const polygon = (points: { x: number; y: number }[]) => points.map(point).join(' ')

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
  accent: string
}

export const BUILDINGS: BuildingSpec[] = [
  { id: 'landing', label: 'Лендинг студио', unit: 'во работа', to: '/landings', x: -8.6, y: 0.5, w: 4.8, d: 4.1, h: 2.1, roof: '#394946', accent: '#50B9A6' },
  { id: 'creative', label: 'Креативно студио', unit: 'во работа', to: '/creatives', x: -4.5, y: -6.0, w: 4.7, d: 4.2, h: 3.2, roof: '#31423F', accent: '#67C9B7' },
  { id: 'testing', label: 'Тестирање', unit: 'активни тестови', to: '/testing', x: 2.9, y: -5.8, w: 4.8, d: 4.1, h: 2.5, roof: '#384946', accent: '#D7A95A' },
  { id: 'office', label: 'Главна канцеларија', unit: 'членови на тимот', to: '/team', x: -1.6, y: 0.3, w: 6.0, d: 5.0, h: 2.8, roof: '#283A37', accent: '#51B6A4' },
  { id: 'tools', label: 'Центар за алатки', unit: 'поврзани алатки', to: '/tools', x: 6.3, y: 1.7, w: 4.2, d: 3.5, h: 1.9, roof: '#3B4A47', accent: '#7FB8AE' },
]

const GROUND: [number, number][] = [[-12.5, -8.6], [12.5, -8.6], [12.5, 8.4], [-12.5, 8.4]]
const PATHS: [number, number][][] = [
  [[-11.4, -0.5], [11.6, -0.5], [11.6, 0.7], [-11.4, 0.7]],
  [[-1.1, -8.0], [0.25, -8.0], [0.25, 8.0], [-1.1, 8.0]],
  [[5.0, -7.6], [6.1, -7.6], [6.1, 7.2], [5.0, 7.2]],
]

const TREES: [number, number, number][] = [
  [-11, -5.5, .85], [-9.2, -7.0, .95], [-6.7, -7.6, .8], [-2.1, -8.0, .75],
  [1.2, -8.0, .85], [5.0, -7.9, .7], [9.3, -6.4, .95], [11.0, -3.4, .8],
  [-11.2, 2.0, .8], [-10.2, 6.0, .95], [-7.0, 7.6, .85], [-3.4, 7.9, .75],
  [1.8, 7.8, .8], [6.0, 7.6, .85], [9.7, 6.2, .9], [11.1, 2.4, .8],
  [-5.1, -1.4, .6], [3.3, 4.3, .62], [7.6, -1.5, .6], [-7.8, 4.9, .65],
]

function building(spec: BuildingSpec) {
  const { x, y, w, d, h } = spec
  const top = polygon([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)])
  const left = polygon([iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)])
  const right = polygon([iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)])
  const center = iso(x + w / 2, y + d / 2)

  const rows = Math.max(1, Math.round(h))
  let windows = ''
  for (let row = 0; row < rows; row++) {
    const zTop = h - (row * h) / rows - 0.18
    const zBottom = zTop - (h / rows) * 0.55
    const inset = 0.24
    windows +=
      `<polygon points="${polygon([iso(x + inset, y + d, zTop), iso(x + w - inset, y + d, zTop), iso(x + w - inset, y + d, zBottom), iso(x + inset, y + d, zBottom)])}" fill="url(#windowGlow)" opacity=".94"/>` +
      `<polygon points="${polygon([iso(x + w, y + inset, zTop), iso(x + w, y + d - inset, zTop), iso(x + w, y + d - inset, zBottom), iso(x + w, y + inset, zBottom)])}" fill="url(#windowGlow)" opacity=".72"/>`
  }

  const roofInset = 0.62
  const roofDeck = polygon([
    iso(x + roofInset, y + roofInset, h + .035),
    iso(x + w - roofInset, y + roofInset, h + .035),
    iso(x + w - roofInset, y + d - roofInset, h + .035),
    iso(x + roofInset, y + d - roofInset, h + .035),
  ])
  const roofCore = polygon([
    iso(x + w * .34, y + d * .34, h + .38),
    iso(x + w * .66, y + d * .34, h + .38),
    iso(x + w * .66, y + d * .66, h + .38),
    iso(x + w * .34, y + d * .66, h + .38),
  ])

  return (
    `<g data-building="${spec.id}" class="campus-building" tabindex="0" role="link" aria-label="${spec.label}">` +
    `<ellipse cx="${center.x.toFixed(1)}" cy="${(center.y + 9).toFixed(1)}" rx="${(w * S * .84).toFixed(1)}" ry="${(d * S * .38).toFixed(1)}" fill="#102825" opacity=".12"/>` +
    `<polygon points="${left}" fill="#BFC4BD"/>` +
    `<polygon points="${right}" fill="#A7AEA8"/>` +
    windows +
    `<polygon points="${top}" fill="${spec.roof}"/>` +
    `<polygon points="${roofDeck}" fill="#5A6A66" opacity=".82" stroke="${spec.accent}" stroke-width="1.2"/>` +
    `<polygon points="${roofCore}" fill="${spec.accent}" opacity=".75"/>` +
    `<polygon points="${top}" fill="url(#roofLight)" opacity=".24"/>` +
    `</g>`
  )
}

function tree(x: number, y: number, scale: number) {
  const base = iso(x, y)
  return (
    `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)}) scale(${scale})">` +
    `<ellipse cx="0" cy="3" rx="11" ry="5" fill="#102825" opacity=".10"/>` +
    `<rect x="-1.5" y="-11" width="3" height="13" rx="1.5" fill="#806E57"/>` +
    `<circle cx="0" cy="-18" r="10" fill="#527862"/>` +
    `<circle cx="-5" cy="-13" r="7.5" fill="#426B55"/>` +
    `<circle cx="6" cy="-14" r="7" fill="#6D9274"/>` +
    `<circle cx="1" cy="-22" r="6" fill="#7EA083"/>` +
    `</g>`
  )
}

function lamp(x: number, y: number) {
  const base = iso(x, y)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><rect x="-1" y="-22" width="2" height="22" fill="#83918D"/><circle cx="0" cy="-24" r="3.5" fill="#FFD18C"/><circle cx="0" cy="-24" r="9" fill="#FFD18C" opacity=".20"/></g>`
}

function fountain() {
  const base = iso(4.1, 1.0)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><ellipse rx="31" ry="14" fill="#B7DAD4" stroke="#8EBDB5" stroke-width="2"/><ellipse rx="21" ry="9" fill="#D9F0EC"/><path d="M0 0 C-8 -22 8 -22 0 0" fill="none" stroke="#78BCAF" stroke-width="3"/><circle cy="-20" r="3" fill="#BDEBE4"/></g>`
}

export function labelAnchors() {
  return BUILDINGS.map((buildingSpec) => {
    const top = iso(buildingSpec.x + buildingSpec.w / 2, buildingSpec.y + buildingSpec.d / 2, buildingSpec.h)
    return {
      id: buildingSpec.id,
      left: ((top.x - VIEW.x) / VIEW.w) * 100,
      top: ((top.y - 30 - VIEW.y) / VIEW.h) * 100,
    }
  })
}

export function buildCampusSvg() {
  const sorted = [...BUILDINGS].sort((a, b) => a.x + a.y - (b.x + b.y))
  return (
    `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="absolute inset-0 h-full w-full" role="img" aria-label="Кампус на компанијата">` +
    `<defs>` +
    `<linearGradient id="windowGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE4B2"/><stop offset="100%" stop-color="#EAB05D"/></linearGradient>` +
    `<linearGradient id="roofLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="lawn" x1=".1" y1="0" x2=".7" y2="1"><stop offset="0%" stop-color="#DDE9DF"/><stop offset="100%" stop-color="#BFCFBE"/></linearGradient>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F7FBFA"/><stop offset="100%" stop-color="#E8F1EF"/></linearGradient>` +
    `</defs>` +
    `<rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" fill="url(#sky)"/>` +
    `<polygon points="${polygon(GROUND.map(([x, y]) => iso(x, y)))}" fill="url(#lawn)" stroke="#B8C9BC" stroke-width="1.6"/>` +
    PATHS.map((path) => `<polygon points="${polygon(path.map(([x, y]) => iso(x, y)))}" fill="#DED9CC" stroke="#CFC9BC" stroke-width=".8"/>`).join('') +
    TREES.filter(([, y]) => y < -.5).map(([x, y, scale]) => tree(x, y, scale)).join('') +
    lamp(-6.1, -.9) + lamp(.8, -.9) + lamp(7.0, -.9) +
    sorted.map(building).join('') +
    fountain() +
    TREES.filter(([, y]) => y >= -.5).map(([x, y, scale]) => tree(x, y, scale)).join('') +
    lamp(-8.4, 4.8) + lamp(-1.7, 5.7) + lamp(7.8, 5.1) +
    `</svg>`
  )
}
