import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Rocket, FlaskConical, Building2, Wrench } from 'lucide-react'
import { BUILDINGS, buildCampusSvg, labelAnchors } from './campusScene'

const ICONS = { landing: Flag, creative: Rocket, testing: FlaskConical, office: Building2, tools: Wrench }

export function Campus({
  counts,
  imageUrl,
}: {
  counts: Record<string, number | undefined>
  imageUrl?: string | null
}) {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const svg = useMemo(buildCampusSvg, [])
  const anchors = useMemo(labelAnchors, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    function activate(target: EventTarget | null) {
      const group = (target as Element | null)?.closest?.('[data-building]')
      const id = group?.getAttribute('data-building')
      const spec = BUILDINGS.find((building) => building.id === id)
      if (spec) navigate(spec.to)
    }
    const onClick = (event: MouseEvent) => activate(event.target)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') activate(event.target) }
    host.addEventListener('click', onClick)
    host.addEventListener('keydown', onKey)
    return () => { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey) }
  }, [navigate])


  return (
    <section aria-label="Кампус на компанијата" className="panel campus-frame overflow-hidden">
      <div className="relative w-full aspect-[21/6] min-h-[220px] max-h-[292px]">
        {imageUrl ? (
          <img src={imageUrl} alt="Кампус на компанијата" className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <div
            ref={hostRef}
            className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full [&_.campus-building]:cursor-pointer [&_.campus-building]:transition-transform [&_.campus-building]:duration-300 [&_.campus-building:hover]:-translate-y-1.5"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {BUILDINGS.map((building) => {
          const Icon = ICONS[building.id]
          const anchor = anchors.find((item) => item.id === building.id)
          const value = counts[building.id]
          return (
            <button
              key={building.id}
              onClick={() => navigate(building.to)}
              style={{ left: `${anchor?.left ?? 50}%`, top: `${anchor?.top ?? 50}%` }}
              className="campus-label absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-white/88 backdrop-blur-xl border border-white/80 shadow-card text-left transition duration-200 hover:shadow-float hover:-translate-y-[calc(50%+4px)]"
            >
              <span className="grid place-items-center h-7 w-7 rounded-lg bg-teal-50 text-teal-600 shrink-0"><Icon size={14} strokeWidth={2} /></span>
              <span className="leading-tight">
                <span className="block text-[11px] font-semibold whitespace-nowrap">{building.label}</span>
                <span className="block text-[9px] text-ink-soft whitespace-nowrap">{value === undefined ? '—' : `${value} ${building.unit}`}</span>
              </span>
              {(value ?? 0) > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_0_3px_rgba(56,168,153,.12)]" />}
            </button>
          )
        })}

        <div className="absolute bottom-2.5 right-3 hidden sm:block rounded-lg border border-white/60 bg-white/65 px-2.5 py-1.5 text-[9px] text-ink-soft backdrop-blur-lg">
          Кампусот расте заедно со компанијата
        </div>
      </div>
    </section>
  )
}
