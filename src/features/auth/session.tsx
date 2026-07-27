import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/db'

export type PermissionKey =
  | 'vision_center.read' | 'vision_center.write' | 'team.manage' | 'tasks.assign'
  | 'products.manage' | 'testing.manage' | 'tools.manage' | 'settings.manage'

interface SessionState {
  session: Session | null
  profile: Profile | null
  permissions: Set<PermissionKey>
  roleKey: string | null
  loading: boolean
  can: (key: PermissionKey) => boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set())
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null); setPermissions(new Set()); setRoleKey(null); setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase
          .from('user_roles')
          .select('roles(key, rank, role_permissions(permission_key))')
          .eq('user_id', session.user.id),
      ])
      if (cancelled) return
      setProfile((p as Profile) ?? null)

      const keys = new Set<PermissionKey>()
      let best: { key: string; rank: number } | null = null
      type Row = { roles: { key: string; rank: number; role_permissions: { permission_key: string }[] } | null }
      ;((roles ?? []) as unknown as Row[]).forEach((r) => {
        if (!r.roles) return
        if (!best || r.roles.rank > best.rank) best = { key: r.roles.key, rank: r.roles.rank }
        r.roles.role_permissions.forEach((rp) => keys.add(rp.permission_key as PermissionKey))
      })
      setPermissions(keys)
      setRoleKey(best ? (best as { key: string }).key : 'member')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [session])

  const value = useMemo<SessionState>(
    () => ({
      session, profile, permissions, roleKey, loading,
      can: (key) => permissions.has(key),
      signOut: async () => { await supabase.auth.signOut() },
    }),
    [session, profile, permissions, roleKey, loading],
  )

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
