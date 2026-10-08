/**
 * Wide contemporary isometric business campus. It is deliberately built as
 * lightweight SVG so it stays crisp, clickable and fast on Netlify.
 */
const S = 25
const COS = Math.cos(Math.PI / 6)
const SIN = 0.30 // flatter isometric projection keeps the whole campus inside the wide frame

export const VIEW = { x: -650, y: -210, w: 1300, h: 371.4 }

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
  accent: string
  style: 'studio' | 'tower' | 'lab' | 'hq' | 'pavilion'
}

export const BUILDINGS: BuildingSpec[] = [
  { id: 'landing', label: 'Лендинг студио', unit: 'во работа', to: '/landings', x: -9.5, y: 0.8, w: 4.8, d: 3.8, h: 2.1, accent: '#2FAE99', style: 'studio' },
  { id: 'creative', label: 'Креативно студио', unit: 'во работа', to: '/creatives', x: -5.5, y: -6.2, w: 4.8, d: 4.0, h: 3.0, accent: '#38A899', style: 'tower' },
  { id: 'testing', label: 'Тестирање', unit: 'активни тестови', to: '/testing', x: 2.3, y: -6.4, w: 4.8, d: 4.0, h: 2.5, accent: '#D49B49', style: 'lab' },
  { id: 'office', label: 'Главна канцеларија', unit: 'членови на тимот', to: '/team', x: -1.5, y: 0.4, w: 6.0, d: 4.8, h: 2.8, accent: '#238C7D', style: 'hq' },
  { id: 'tools', label: 'Центар за алатки', unit: 'поврзани алатки', to: '/tools', x: 6.1, y: 1.8, w: 4.0, d: 3.3, h: 1.8, accent: '#68AFA4', style: 'pavilion' },
]

const GROUND: [number, number][] = [[-13.3, -8.7], [13.3, -8.7], [13.3, 8.3], [-13.3, 8.3]]
const PATHS: [number, number][][] = [
  [[-12.5, -0.7], [12.3, -0.7], [12.3, 0.7], [-12.5, 0.7]],
  [[-1.0, -8.1], [0.45, -8.1], [0.45, 8.0], [-1.0, 8.0]],
  [[5.0, -7.8], [6.2, -7.8], [6.2, 7.0], [5.0, 7.0]],
]

const TREES: [number, number, number, string][] = [
  [-12, -6.5, .9, '#557862'], [-10.1, -7.6, .95, '#436B55'], [-7.7, -8.0, .78, '#6D9274'], [-2.2, -8.1, .72, '#527862'],
  [1.0, -8.1, .8, '#436B55'], [5.3, -8.0, .72, '#6D9274'], [9.4, -6.9, .95, '#527862'], [11.8, -3.7, .78, '#436B55'],
  [-12.0, 2.0, .8, '#6D9274'], [-10.7, 6.0, .96, '#527862'], [-7.6, 7.6, .86, '#436B55'], [-3.8, 8.0, .74, '#6D9274'],
  [2.0, 7.8, .8, '#527862'], [6.1, 7.4, .86, '#436B55'], [9.7, 6.3, .9, '#6D9274'], [11.7, 2.8, .8, '#527862'],
  [-6.8, -1.8, .58, '#527862'], [3.0, 4.7, .62, '#436B55'], [8.2, -.9, .58, '#6D9274'], [-8.0, 4.7, .62, '#436B55'],
]

function building(spec: BuildingSpec) {
  const { x, y, w, d, h } = spec
  const topPts = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)]
  const leftPts = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)]
  const rightPts = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)]
  const center = iso(x + w / 2, y + d / 2)
  const base = polygon([iso(x - .22, y - .22), iso(x + w + .22, y - .22), iso(x + w + .22, y + d + .22), iso(x - .22, y + d + .22)])

  const rows = Math.max(1, Math.round(h))
  const leftWindows: string[] = []
  const rightWindows: string[] = []
  for (let row = 0; row < rows; row++) {
    const zTop = h - row * h / rows - .18
    const zBottom = zTop - (h / rows) * .58
    for (let col = 0; col < Math.max(2, Math.round(w)); col++) {
      const a = .18 + col * (w - .36) / Math.max(2, Math.round(w))
      const b = .18 + (col + .72) * (w - .36) / Math.max(2, Math.round(w))
      leftWindows.push(`<polygon points="${polygon([iso(x + a, y + d + .012, zTop), iso(x + b, y + d + .012, zTop), iso(x + b, y + d + .012, zBottom), iso(x + a, y + d + .012, zBottom)])}" fill="url(#glassWarm)" opacity=".94"/>`)
    }
    for (let col = 0; col < Math.max(2, Math.round(d)); col++) {
      const a = .18 + col * (d - .36) / Math.max(2, Math.round(d))
      const b = .18 + (col + .72) * (d - .36) / Math.max(2, Math.round(d))
      rightWindows.push(`<polygon points="${polygon([iso(x + w + .012, y + a, zTop), iso(x + w + .012, y + b, zTop), iso(x + w + .012, y + b, zBottom), iso(x + w + .012, y + a, zBottom)])}" fill="url(#glassWarm)" opacity=".76"/>`)
    }
  }

  const roofInset = spec.style === 'hq' ? .48 : .62
  const roofDeck = polygon([
    iso(x + roofInset, y + roofInset, h + .04),
    iso(x + w - roofInset, y + roofInset, h + .04),
    iso(x + w - roofInset, y + d - roofInset, h + .04),
    iso(x + roofInset, y + d - roofInset, h + .04),
  ])
  const coreHeight = spec.style === 'tower' ? .54 : .32
  const roofCore = polygon([
    iso(x + w * .35, y + d * .35, h + coreHeight),
    iso(x + w * .65, y + d * .35, h + coreHeight),
    iso(x + w * .65, y + d * .65, h + coreHeight),
    iso(x + w * .35, y + d * .65, h + coreHeight),
  ])

  const greenRoof = spec.style === 'hq' || spec.style === 'studio'
    ? `<polygon points="${polygon([iso(x + .85, y + .82, h + .07), iso(x + w - .85, y + .82, h + .07), iso(x + w - .85, y + 1.3, h + .07), iso(x + .85, y + 1.3, h + .07)])}" fill="#77A57F" opacity=".9"/>`
    : ''

  return `<g data-building="${spec.id}" class="campus-building" tabindex="0" role="link" aria-label="${spec.label}">
    <ellipse cx="${center.x.toFixed(1)}" cy="${(center.y + 12).toFixed(1)}" rx="${(w * S * .9).toFixed(1)}" ry="${(d * S * .42).toFixed(1)}" fill="#12342F" opacity=".15" filter="url(#softBlur)"/>
    <polygon points="${base}" fill="#E5E1D8" stroke="#CBC8BE" stroke-width="1.2"/>
    <polygon points="${polygon(leftPts)}" fill="url(#concreteLeft)"/>
    <polygon points="${polygon(rightPts)}" fill="url(#concreteRight)"/>
    ${leftWindows.join('')}${rightWindows.join('')}
    <polygon points="${polygon(topPts)}" fill="url(#roofDark)"/>
    <polygon points="${roofDeck}" fill="#596965" opacity=".93" stroke="${spec.accent}" stroke-width="1.2"/>
    ${greenRoof}
    <polygon points="${roofCore}" fill="${spec.accent}" opacity=".76"/>
    <circle cx="${center.x.toFixed(1)}" cy="${(center.y - h * S - 6).toFixed(1)}" r="4" fill="${spec.accent}"/>
    <circle cx="${center.x.toFixed(1)}" cy="${(center.y - h * S - 6).toFixed(1)}" r="11" fill="${spec.accent}" opacity=".12"/>
  </g>`
}

function tree(x: number, y: number, scale: number, color: string) {
  const base = iso(x, y)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)}) scale(${scale})">
    <ellipse cx="0" cy="4" rx="12" ry="5" fill="#173B35" opacity=".12"/>
    <rect x="-1.6" y="-11" width="3.2" height="14" rx="1.6" fill="#7D6A51"/>
    <circle cx="0" cy="-19" r="10" fill="${color}"/>
    <circle cx="-6" cy="-14" r="7.2" fill="#426B55"/>
    <circle cx="6" cy="-15" r="7" fill="#76977C"/>
    <circle cx="1" cy="-23" r="5.8" fill="#8AAA8D"/>
  </g>`
}

function lamp(x: number, y: number) {
  const base = iso(x, y)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><rect x="-1" y="-22" width="2" height="22" fill="#667A75"/><circle cx="0" cy="-24" r="3.4" fill="#FFD391"/><circle cx="0" cy="-24" r="11" fill="#FFD391" opacity=".2"/></g>`
}

function person(x: number, y: number, color: string) {
  const base = iso(x, y)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><ellipse cy="2" rx="3.5" ry="1.5" fill="#173B35" opacity=".12"/><circle cy="-9" r="2.2" fill="#D7A982"/><path d="M-3 -6 Q0 -9 3 -6 L2 1 L-2 1 Z" fill="${color}"/></g>`
}

function car(x: number, y: number, color: string) {
  const base = iso(x, y)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><ellipse cy="4" rx="13" ry="4" fill="#173B35" opacity=".13"/><rect x="-11" y="-5" width="22" height="8" rx="3" fill="${color}"/><path d="M-5 -10 H5 L9 -5 H-9 Z" fill="#DCECE9" opacity=".9"/><circle cx="-7" cy="3" r="2.5" fill="#263B38"/><circle cx="7" cy="3" r="2.5" fill="#263B38"/></g>`
}

function pond() {
  const base = iso(4.4, 1.0)
  return `<g transform="translate(${base.x.toFixed(1)} ${base.y.toFixed(1)})"><ellipse rx="37" ry="16" fill="#A8D9D1" stroke="#7CB9AF" stroke-width="2"/><ellipse rx="28" ry="11" fill="url(#water)"/><path d="M0 1 C-9 -24 9 -24 0 1" fill="none" stroke="#D9F6F0" stroke-width="3"/><circle cy="-21" r="3" fill="#E7FBF7"/></g>`
}

function plaza() {
  const center = iso(-.25, -.1)
  return `<g transform="translate(${center.x.toFixed(1)} ${center.y.toFixed(1)})"><ellipse rx="62" ry="28" fill="#DDD8CB" stroke="#C9C3B6"/><ellipse rx="42" ry="19" fill="#E9E5DC"/><circle r="6" fill="#2FAE99" opacity=".7"/></g>`
}

export function labelAnchors() {
  return BUILDINGS.map((buildingSpec) => {
    const top = iso(buildingSpec.x + buildingSpec.w / 2, buildingSpec.y + buildingSpec.d / 2, buildingSpec.h)
    return {
      id: buildingSpec.id,
      left: ((top.x - VIEW.x) / VIEW.w) * 100,
      top: ((top.y - 28 - VIEW.y) / VIEW.h) * 100,
    }
  })
}

export function buildCampusSvg() {
  const sorted = [...BUILDINGS].sort((a, b) => a.x + a.y - (b.x + b.y))
  return `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Кампус на компанијата">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EAF6F4"/><stop offset="54%" stop-color="#F7F8F4"/><stop offset="100%" stop-color="#DDECE8"/></linearGradient>
      <linearGradient id="lawn" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0%" stop-color="#C9DDC8"/><stop offset="55%" stop-color="#AFC9B4"/><stop offset="100%" stop-color="#8FB29A"/></linearGradient>
      <linearGradient id="concreteLeft" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#E8E7E2"/><stop offset="100%" stop-color="#BFC5C0"/></linearGradient>
      <linearGradient id="concreteRight" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C9CECA"/><stop offset="100%" stop-color="#9EA9A4"/></linearGradient>
      <linearGradient id="roofDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#344945"/><stop offset="100%" stop-color="#1E302D"/></linearGradient>
      <linearGradient id="glassWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF1CE"/><stop offset="52%" stop-color="#F7C879"/><stop offset="100%" stop-color="#D9923E"/></linearGradient>
      <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#D8F2ED"/><stop offset="100%" stop-color="#6EB8AB"/></linearGradient>
      <filter id="softBlur"><feGaussianBlur stdDeviation="4"/></filter>
      <radialGradient id="sunGlow"><stop offset="0%" stop-color="#FFF4D1" stop-opacity=".78"/><stop offset="100%" stop-color="#FFF4D1" stop-opacity="0"/></radialGradient>
    </defs>
    <rect x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}" fill="url(#sky)"/>
    <circle cx="430" cy="-115" r="280" fill="url(#sunGlow)"/>
    <polygon points="${polygon(GROUND.map(([x, y]) => iso(x, y)))}" fill="#6D8D79" opacity=".18" transform="translate(0 12)"/>
    <polygon points="${polygon(GROUND.map(([x, y]) => iso(x, y)))}" fill="url(#lawn)" stroke="#91AA97" stroke-width="1.6"/>
    ${PATHS.map((path) => `<polygon points="${polygon(path.map(([x, y]) => iso(x, y)))}" fill="#DCD7CB" stroke="#C5BFB4" stroke-width=".8"/>`).join('')}
    ${plaza()}
    ${TREES.filter(([, y]) => y < -.5).map(([x, y, scale, color]) => tree(x, y, scale, color)).join('')}
    ${lamp(-7.0, -.9)}${lamp(-2.0, -.9)}${lamp(2.5, -.9)}${lamp(7.3, -.9)}
    ${sorted.map(building).join('')}
    ${pond()}
    ${car(-8.8, -.1, '#4D8078')}${car(7.1, .2, '#D2A55E')}
    ${person(-2.0, 3.5, '#2FAE99')}${person(-.8, 4.0, '#647A98')}${person(4.0, 3.1, '#D49B49')}${person(-6.8, 3.7, '#925D71')}
    ${TREES.filter(([, y]) => y >= -.5).map(([x, y, scale, color]) => tree(x, y, scale, color)).join('')}
    ${lamp(-8.6, 4.8)}${lamp(-2.0, 5.8)}${lamp(7.8, 5.2)}
  </svg>`
}
