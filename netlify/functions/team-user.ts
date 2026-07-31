import { createClient } from '@supabase/supabase-js'

type Event = {
  httpMethod: string
  headers: Record<string, string | undefined>
  body: string | null
}

const PAGE_KEYS = ['home','my_day','tasks','products','landings','creatives','testing','finance','brands','tools','notes','team','settings'] as const

type Payload = {
  action: 'create' | 'update' | 'delete'
  userId?: string
  email?: string
  password?: string
  fullName?: string
  jobTitle?: string
  roleKey?: 'admin' | 'manager' | 'member'
  pages?: string[]
}

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler = async (event: Event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Методот не е дозволен' })

  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return json(500, { error: 'Недостигаат Supabase серверски променливи.' })

  const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Недостига токен за авторизација.' })

  const verifier = createClient(url, anon, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await verifier.auth.getUser(token)
  if (authError || !authData.user) return json(401, { error: 'Невалидна сесија.' })

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: accessRows, error: accessError } = await admin
    .from('user_roles')
    .select('roles(role_permissions(permission_key))')
    .eq('user_id', authData.user.id)
  if (accessError) return json(500, { error: accessError.message })

  type RoleRow = { roles: { role_permissions: { permission_key: string }[] } | null }
  const canManage = ((accessRows ?? []) as unknown as RoleRow[])
    .some((row) => row.roles?.role_permissions.some((p) => p.permission_key === 'team.manage'))
  if (!canManage) return json(403, { error: 'Немате дозвола за управување со тимот.' })

  let payload: Payload
  try { payload = JSON.parse(event.body ?? '{}') as Payload } catch { return json(400, { error: 'Невалиден JSON.' }) }

  async function setRole(userId: string, roleKey: string) {
    const { data: role, error: roleError } = await admin.from('roles').select('id').eq('key', roleKey).single()
    if (roleError) throw roleError
    await admin.from('user_roles').delete().eq('user_id', userId)
    const { error } = await admin.from('user_roles').insert({ user_id: userId, role_id: role.id })
    if (error) throw error
  }

  async function setPages(userId: string, pages: string[]) {
    const selected = new Set(pages)
    const rows = PAGE_KEYS.map((page_key) => ({ user_id: userId, page_key, allowed: selected.has(page_key) }))
    const { error } = await admin.from('page_access').upsert(rows, { onConflict: 'user_id,page_key' })
    if (error) throw error
  }

  try {
    if (payload.action === 'create') {
      if (!payload.email || !payload.password || !payload.fullName || !payload.roleKey) {
        return json(400, { error: 'Недостигаат задолжителни полиња.' })
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: payload.fullName },
      })
      if (error || !data.user) throw error ?? new Error('Акаунтот не беше креиран.')
      await admin.from('profiles').update({ full_name: payload.fullName, job_title: payload.jobTitle || null, email: payload.email }).eq('id', data.user.id)
      await setRole(data.user.id, payload.roleKey)
      await setPages(data.user.id, payload.pages ?? [])
      return json(200, { userId: data.user.id })
    }

    if (payload.action === 'update') {
      if (!payload.userId || !payload.fullName || !payload.roleKey) return json(400, { error: 'Недостигаат задолжителни полиња.' })
      const { error } = await admin.from('profiles')
        .update({ full_name: payload.fullName, job_title: payload.jobTitle || null })
        .eq('id', payload.userId)
      if (error) throw error
      await setRole(payload.userId, payload.roleKey)
      await setPages(payload.userId, payload.pages ?? [])
      return json(200, { userId: payload.userId })
    }

    if (payload.action === 'delete') {
      if (!payload.userId) return json(400, { error: 'Недостига кориснички ID.' })
      if (payload.userId === authData.user.id) return json(400, { error: 'Не можете да го избришете сопствениот акаунт.' })
      const { error } = await admin.auth.admin.deleteUser(payload.userId)
      if (error) throw error
      return json(200, { userId: payload.userId })
    }

    return json(400, { error: 'Непозната акција.' })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Операцијата не успеа.' })
  }
}
