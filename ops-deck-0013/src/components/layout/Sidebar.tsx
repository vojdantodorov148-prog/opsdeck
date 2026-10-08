import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Home, Sun, CheckSquare, Package, Flag, Palette, FlaskConical,
  Wrench, FileText, Users, Settings, WalletCards, FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { useSession } from '@/features/auth/session'
import { LevelWidget } from '@/features/gamification/LevelWidget'
import type { PageKey } from '@/lib/pages'
import { getSetting } from '@/services/reference'

const NAV: { to: string; label: string; icon: typeof Home; page: PageKey; end?: boolean }[] = [
  { to: '/', label: 'Почетна', icon: Home, page: 'home', end: true },
  { to: '/my-day', label: 'Мој ден', icon: Sun, page: 'my_day' },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare, page: 'tasks' },
  { to: '/products', label: 'Производи', icon: Package, page: 'products' },
  { to: '/landings', label: 'Лендинг страници', icon: Flag, page: 'landings' },
  { to: '/creatives', label: 'Креативи', icon: Palette, page: 'creatives' },
  { to: '/testing', label: 'Тестирање', icon: FlaskConical, page: 'testing' },
  { to: '/finance', label: 'Финансии', icon: WalletCards, page: 'finance' },
  { to: '/brands', label: 'Брендови', icon: FolderKanban, page: 'brands' },
  { to: '/tools', label: 'Алатки', icon: Wrench, page: 'tools' },
  { to: '/notes', label: 'Белешки', icon: FileText, page: 'notes' },
  { to: '/team', label: 'Тим', icon: Users, page: 'team' },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, canPage } = useSession()
  const { data: branding } = useQuery({
    queryKey: ['setting', 'branding'],
    queryFn: () => getSetting<{ logo_url?: string | null }>('branding'),
  })

  return (
    <nav className="h-full flex flex-col bg-panel border-r border-line px-4 py-6" aria-label="Главна навигација">
      <div className="px-2"><Logo url={branding?.logo_url} /></div>

      <ul className="mt-8 space-y-1 flex-1 overflow-y-auto scrollbar-thin">
        {NAV.filter((item) => canPage(item.page)).map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) => cn(
                'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
                isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-white hover:text-ink',
              )}
            >
              <Icon size={19} strokeWidth={1.8} />
              {label}
            </NavLink>
          </li>
        ))}

        {can('settings.manage') && canPage('settings') && (
          <li className="pt-2">
            <NavLink
              to="/settings"
              onClick={onNavigate}
              className={({ isActive }) => cn(
                'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
                isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-white hover:text-ink',
              )}
            >
              <Settings size={19} strokeWidth={1.8} />
              Поставки
            </NavLink>
          </li>
        )}
      </ul>

      <LevelWidget />
    </nav>
  )
}
