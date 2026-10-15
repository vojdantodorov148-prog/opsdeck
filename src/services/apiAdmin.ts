import { supabase } from '@/lib/supabase'

export type ApiScope = 'read' | 'write:products' | 'write:tasks' | 'write:comments'

export type ApiKeyRow = {
  id: string
  name: string
  user_id: string
  key_prefix: string
  scopes: ApiScope[]
  rate_limit_per_minute: number
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  user: { id: string; full_name: string; email: string | null } | null
}

export type ApiUserRow = {
  id: string
  full_name: string
  email: string | null
  active: boolean
}

export type ApiAuditRow = {
  id: number
  key_name: string
  user_id: string | null
  method: string
  endpoint: string
  status_code: number
  result: string
  request_id: string
  duration_ms: number
  created_at: string
  user: { id: string; full_name: string } | null
}

async function call(payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Нема активна сесија.')
  const response = await fetch('/.netlify/functions/api-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let body: Record<string, unknown> = {}
  try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {} } catch { /* handled below */ }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `API admin error (${response.status}).`)
  return body
}

export async function listApiAdminData() {
  const body = await call({ action: 'list' })
  return {
    keys: (body.keys ?? []) as ApiKeyRow[],
    users: (body.users ?? []) as ApiUserRow[],
    scopes: (body.scopes ?? []) as ApiScope[],
  }
}

export async function listApiAudit(limit = 100) {
  const body = await call({ action: 'audit', limit })
  return (body.logs ?? []) as ApiAuditRow[]
}

export async function createApiKey(input: { name: string; userId: string; scopes: ApiScope[] }) {
  const body = await call({ action: 'create', ...input })
  return { key: body.key as ApiKeyRow, token: body.token as string }
}

export async function revokeApiKey(keyId: string) {
  await call({ action: 'revoke', keyId })
}
