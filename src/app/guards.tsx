import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession, type PermissionKey } from '@/features/auth/session'
import { APP_PAGES, type PageKey } from '@/lib/pages'
import { EmptyState } from '@/components/ui/Bits'

export function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { can, loading } = useSession()
  if (loading) return null
  if (!can(permission)) {
    return <EmptyState title="Немате пристап до оваа област" hint="Побарајте пристап од сопственик или администратор." />
  }
  return <>{children}</>
}

export function RequirePage({ page, children }: { page: PageKey; children: ReactNode }) {
  const { canPage, loading } = useSession()
  if (loading) return null
  if (!canPage(page)) {
    const fallback = APP_PAGES.find((item) => canPage(item.key))
    return fallback
      ? <Navigate to={fallback.path} replace />
      : <EmptyState title="Немате доделени страници" hint="Сопственикот или администраторот треба да ви додели пристап." />
  }
  return <>{children}</>
}
