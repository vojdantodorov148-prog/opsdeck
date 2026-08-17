import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/db'
import { DEFAULT_MEMBER_PAGES, type PageKey } from '@/lib/pages'

export type PermissionKey =
  | 'team.manage' | 'tasks.assign'
  | 'products.manage' | 'testing.manage' | 'tools.manage' | 'settings.manage'
  | 'finance.manage' | 'brands.manage'

interface SessionState {
  session: Session | null
  profile: Profile | null
  permissions: Set<PermissionKey>
  pageAccess: Set<PageKey>
  hasPageAccessRules: boolean
  roleKey: string | null
  loading: boolean
  can: (key: PermissionKey) => boolean
  canPage: (key: PageKey) => boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set())
  const [pageAccess, setPageAccess] = useState<Set<PageKey>>(new Set())
  const [hasPageAccessRules, setHasPageAccessRules] = useState(false)
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadUser() {
    if (!session?.user) return
    const [{ data: p }, { data: roles }, { data: pages }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase
        .from('user_roles')
        .select('roles(key, rank, role_permissions(permission_key))')
        .eq('user_id', session.user.id),
      supabase.from('page_access').select('page_key,allowed').eq('user_id', session.user.id),
    ])
    setProfile((p as Profile) ?? null)

    const keys = new Set<PermissionKey>()
    let best: { key: string; rank: number } | null = null
    type Row = { roles: { key: string; rank: number; role_permissions: { permission_key: string }[] } | null }
    ;((roles ?? []) as unknown as Row[]).forEach((row) => {
      if (!row.roles) return
      if (!best || row.roles.rank > best.rank) best = { key: row.roles.key, rank: row.roles.rank }
      row.roles.role_permissions.forEach((permission) => keys.add(permission.permission_key as PermissionKey))
    })
    setPermissions(keys)
    setRoleKey(best ? (best as { key: string }).key : 'member')
    const pageRows = (pages ?? []) as { page_key: PageKey; allowed: boolean }[]
    setHasPageAccessRules(pageRows.length > 0)
    setPageAccess(new Set(pageRows.filter((p) => p.allowed).map((p) => p.page_key)))
  }

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setPermissions(new Set())
      setPageAccess(new Set())
      setHasPageAccessRules(false)
      setRoleKey(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      await loadUser()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Access changes made by an owner/admin take effect for the affected user
  // immediately, without requiring a sign-out or page refresh.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const channel = supabase
      .channel(`access-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'page_access', filter: `user_id=eq.${userId}` }, () => { void loadUser() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${userId}` }, () => { void loadUser() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const value = useMemo<SessionState>(() => ({
    session,
    profile,
    permissions,
    pageAccess,
    hasPageAccessRules,
    roleKey,
    loading,
    can: (key) => permissions.has(key),
    canPage: (key) => {
      if (roleKey === 'owner') return true
      if (!hasPageAccessRules) return DEFAULT_MEMBER_PAGES.includes(key)
      return pageAccess.has(key)
    },
    refreshProfile: loadUser,
    signOut: async () => { await supabase.auth.signOut() },
  }), [session, profile, permissions, pageAccess, hasPageAccessRules, roleKey, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}

export function useUserId() {
  return useSession().session?.user.id ?? ''
}
