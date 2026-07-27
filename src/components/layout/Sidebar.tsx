import { NavLink } from 'react-router-dom'
import {
  Home, Sun, CheckSquare, Package, Flag, Palette, FlaskConical,
  Wrench, FileText, Users, Compass, Settings,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { useSession } from '@/features/auth/session'
import { LevelWidget } from '@/features/gamification/LevelWidget'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/my-day', label: 'My Day', icon: Sun },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/landings', label: 'Landings', icon: Flag },
  { to: '/creatives', label: 'Creatives', icon: Palette },
  { to: '/testing', label: 'Testing', icon: FlaskConical },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/team', label: 'Team', icon: Users },
] as const

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession()

  return (
    <nav className="h-full flex flex-col bg-panel border-r border-line px-4 py-6" aria-label="Main">
      <div className="px-2">
        <Logo />
      </div>

      <ul className="mt-8 space-y-1 flex-1 overflow-y-auto scrollbar-thin">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={'end' in rest ? rest.end : undefined}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
                  isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-white hover:text-ink',
                )
              }
            >
              <Icon size={19} strokeWidth={1.8} />
              {label}
            </NavLink>
          </li>
        ))}

        {can('vision_center.read') && (
          <li className="pt-2">
            <NavLink
              to="/vision"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
                  isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-white hover:text-ink',
                )
              }
            >
              <Compass size={19} strokeWidth={1.8} />
              Vision Center
            </NavLink>
          </li>
        )}

        {can('settings.manage') && (
          <li>
            <NavLink
              to="/settings"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] transition',
                  isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-ink-soft hover:bg-white hover:text-ink',
                )
              }
            >
              <Settings size={19} strokeWidth={1.8} />
              Settings
            </NavLink>
          </li>
        )}
      </ul>

      <LevelWidget />
    </nav>
  )
}
