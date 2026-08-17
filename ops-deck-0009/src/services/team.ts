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

export interface TeamAccountUpdateInput {
  fullName: string
  jobTitle?: string
  roleKey: 'admin' | 'manager' | 'member'
  pages: PageKey[]
  password?: string
}

async function callTeamFunction(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Нема активна сесија. Најави се повторно.')

  let response: Response
  try {
    response = await fetch('/.netlify/functions/team-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Не можам да се поврзам со серверот за управување со тимот.')
  }

  const raw = await response.text()
  let body: { error?: string; userId?: string; requestId?: string } = {}
  try { body = raw ? JSON.parse(raw) as typeof body : {} } catch { /* Netlify may return HTML/text for runtime failures */ }

  if (!response.ok) {
    if (response.status === 404) throw new Error('Team backend функцијата не е deploy-ирана на Netlify.')
    const suffix = body.requestId ? ` · ID ${body.requestId.slice(0, 8)}` : ''
    throw new Error(`${body.error ?? `Серверска грешка (${response.status}).`}${suffix}`)
  }
  return body
}

export function createTeamAccount(input: TeamAccountInput) {
  return callTeamFunction({ action: 'create', ...input })
}

export function updateTeamAccount(userId: string, input: TeamAccountUpdateInput) {
  return callTeamFunction({ action: 'update', userId, ...input })
}

export function deleteTeamAccount(userId: string) {
  return callTeamFunction({ action: 'delete', userId })
}

export function checkTeamBackend() {
  return callTeamFunction({ action: 'health' })
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
