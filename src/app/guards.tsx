import type { ReactNode } from 'react'
import { useSession, type PermissionKey } from '@/features/auth/session'
import { EmptyState } from '@/components/ui/Bits'

/**
 * Convenience only. The database policies in 0003_rls.sql are what actually
 * protect this data — removing this component would change nothing about access.
 */
export function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { can, loading } = useSession()
  if (loading) return null
  if (!can(permission)) {
    return <EmptyState title="You don't have access to this area" hint="Ask an owner or admin if you think you should." />
  }
  return <>{children}</>
}
