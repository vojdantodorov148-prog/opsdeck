import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Rocket, FlaskConical, Building2, Wrench } from 'lucide-react'
import { BUILDINGS, buildCampusSvg, labelAnchors } from './campusScene'

const ICONS = { landing: Flag, creative: Rocket, testing: FlaskConical, office: Building2, tools: Wrench }

/**
 * The campus is navigation, not a dashboard. It is plain SVG so it loads
 * instantly and can be edited without a 3D pipeline. Set a campus image URL in
 * Settings to drop a rendered illustration behind the same hotspots.
 */
export function Campus({ counts, imageUrl }: { counts: Record<string, number | undefined>; imageUrl?: string | null }) {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const svg = useMemo(buildCampusSvg, [])
  const anchors = useMemo(labelAnchors, [])

  // Clicking a building navigates. Delegated so the drawing stays a plain string.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    function activate(target: EventTarget | null) {
      const g = (target as Element | null)?.closest?.('[data-building]')
      const id = g?.getAttribute('data-building')
      const spec = BUILDINGS.find((b) => b.id === id)
      if (spec) navigate(spec.to)
    }
    const onClick = (e: MouseEvent) => activate(e.target)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') activate(e.target) }
    host.addEventListener('click', onClick)
    host.addEventListener('keydown', onKey)
    return () => { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey) }
  }, [navigate])

  return (
    <section aria-label="Company campus" className="panel overflow-hidden">
      <div className="relative w-full aspect-[16/11] sm:aspect-[940/580]">
        {imageUrl ? (
          <img src={imageUrl} alt="Company campus" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            ref={hostRef}
            className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full [&_.campus-building]:cursor-pointer [&_.campus-building]:transition-transform [&_.campus-building:hover]:-translate-y-1"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {BUILDINGS.map((b) => {
          const Icon = ICONS[b.id]
          const anchor = anchors.find((a) => a.id === b.id)
          const value = counts[b.id]
          return (
            <button
              key={b.id}
              onClick={() => navigate(b.to)}
              style={{ left: `${anchor?.left ?? 50}%`, top: `${anchor?.top ?? 50}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-xl bg-white/95 backdrop-blur border border-line shadow-card text-left transition hover:shadow-float hover:-translate-y-[calc(50%+3px)]"
            >
              <span className="grid place-items-center h-7 w-7 rounded-lg bg-teal-50 text-teal-600 shrink-0">
                <Icon size={15} strokeWidth={1.9} />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-semibold whitespace-nowrap">{b.label}</span>
                <span className="block text-[11px] text-ink-soft whitespace-nowrap">
                  {value === undefined ? '—' : `${value} ${b.unit}`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
