import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Search, ChevronDown } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { CommandBar } from './CommandBar'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { Avatar } from '@/components/ui/Avatar'
import { useSession } from '@/features/auth/session'
import { useCommandShortcut } from '@/hooks/useKeyboardShortcut'
import { useActions } from '@/app/actions'
import { GiveTaskModal } from '@/features/tasks/GiveTaskModal'
import { StartTestModal } from '@/features/testing/StartTestModal'
import { AddNoteModal } from '@/features/notes/AddNoteModal'
import { ContentEditor } from '@/features/content/ContentEditor'

const ROLE_LABEL: Record<string, string> = { owner: 'Сопственик', admin: 'Администратор', manager: 'Менаџер', member: 'Член' }

export function AppShell() {
  const { profile, roleKey, signOut } = useSession()
  const actions = useActions()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useCommandShortcut(() => setCmdOpen(true))
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  return (
    <div className="min-h-screen bg-canvas p-0 lg:p-6">
      <div className="mx-auto max-w-[1480px] bg-surface lg:rounded-3xl lg:border lg:border-line lg:shadow-app overflow-hidden flex min-h-screen lg:min-h-[calc(100vh-3rem)]">
        <div className="hidden lg:block w-[248px] shrink-0"><Sidebar /></div>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/20" onClick={() => setNavOpen(false)} />
            <div className="relative w-[260px] h-full"><Sidebar onNavigate={() => setNavOpen(false)} /></div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="flex items-center gap-3 px-5 lg:px-8 h-[76px] shrink-0">
            <button className="lg:hidden btn-ghost h-10 w-10 px-0" onClick={() => setNavOpen(true)} aria-label="Отвори навигација">
              <Menu size={20} />
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="flex-1 max-w-xl mx-auto flex items-center gap-3 h-11 px-3 rounded-xl border border-line bg-panel/70 text-ink-soft hover:border-teal-200 transition"
            >
              <kbd className="hidden sm:inline-flex items-center h-6 px-2 rounded-md bg-white border border-line text-[11px] font-medium">
                {isMac ? '⌘' : 'Ctrl'} K
              </kbd>
              <span className="text-sm">Пребарај или напиши команда…</span>
              <Search size={16} className="ml-auto sm:hidden" />
            </button>

            <div className="flex items-center gap-1 ml-auto">
              <NotificationBell />
              <div className="relative">
                <button className="flex items-center gap-2 h-10 pl-1 pr-2 rounded-xl hover:bg-teal-50 transition" onClick={() => setMenuOpen((value) => !value)}>
                  <Avatar name={profile?.full_name} url={profile?.avatar_url} size={32} />
                  <span className="hidden sm:block text-sm font-medium">{profile?.full_name?.split(' ')[0]}</span>
                  <ChevronDown size={15} className="text-ink-soft" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 z-50 panel shadow-float p-2">
                      <p className="px-3 py-2 text-xs text-ink-soft">Најавен како {ROLE_LABEL[roleKey ?? ''] ?? roleKey}</p>
                      <button className="w-full text-left px-3 h-9 rounded-lg text-sm row-hover" onClick={signOut}>Одјави се</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 lg:px-8 pb-10 overflow-y-auto scrollbar-thin">
            <Outlet />
          </main>
        </div>
      </div>

      <CommandBar
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onGiveTask={() => actions.open('give-task')}
        onStartTest={() => actions.open('start-test')}
        onAddNote={() => actions.open('add-note')}
      />
      <GiveTaskModal />
      <StartTestModal />
      <AddNoteModal />
      <ContentEditor />
    </div>
  )
}
