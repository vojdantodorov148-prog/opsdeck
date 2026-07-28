import { supabase } from '@/lib/supabase'
import type { PageKey } from '@/lib/pages'

export interface TeamAccountInput {
  email: string
  password: string
  fullName: string
  jobTitle?: string
  roleKey: 'admin' | 'manager' | 'member'
  pages: PageKey[]
}

async function callTeamFunction(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Нема активна сесија.')

  const response = await fetch('/.netlify/functions/team-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({})) as { error?: string; userId?: string }
  if (!response.ok) throw new Error(body.error ?? 'Операцијата не успеа.')
  return body
}

export function createTeamAccount(input: TeamAccountInput) {
  return callTeamFunction({ action: 'create', ...input })
}

export function updateTeamAccount(userId: string, input: Omit<TeamAccountInput, 'email' | 'password'>) {
  return callTeamFunction({ action: 'update', userId, ...input })
}

export function deleteTeamAccount(userId: string) {
  return callTeamFunction({ action: 'delete', userId })
}

export async function listUserPageAccess() {
  const { data, error } = await supabase.from('page_access').select('*')
  if (error) throw error
  return data as { user_id: string; page_key: PageKey; allowed: boolean }[]
}

export async function listUserRoles() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, roles(key,label,rank)')
  if (error) throw error
  return data as unknown as { user_id: string; roles: { key: string; label: string; rank: number } | null }[]
}
