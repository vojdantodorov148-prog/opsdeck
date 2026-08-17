import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Event = {
  httpMethod: string
  headers: Record<string, string | undefined>
  body: string | null
}

const PAGE_KEYS = [
  'home','my_day','tasks','products','landings','creatives','testing',
  'finance','brands','tools','notes','team','settings',
] as const

type RoleKey = 'admin' | 'manager' | 'member'

type Payload = {
  action: 'create' | 'update' | 'delete' | 'health'
  userId?: string
  email?: string
  password?: string
  fullName?: string
  jobTitle?: string
  roleKey?: RoleKey
  pages?: string[]
}

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
})

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? 'Непозната грешка')
  if (typeof error === 'string') return error
  try { return JSON.stringify(error) } catch { return 'Непозната грешка' }
}

function cleanPages(pages: string[] | undefined, roleKey: RoleKey) {
  const requested = new Set((pages ?? []).filter((page) => PAGE_KEYS.includes(page as (typeof PAGE_KEYS)[number])))
  if (roleKey !== 'admin') requested.delete('settings')
  return requested
}

async function findRole(admin: SupabaseClient, roleKey: RoleKey) {
  const { data, error } = await admin.from('roles').select('id,key,rank').eq('key', roleKey).single()
  if (error || !data) throw error ?? new Error('Улогата не постои.')
  return data as { id: number; key: RoleKey; rank: number }
}

async function applyAccess(
  admin: SupabaseClient,
  userId: string,
  input: { email?: string; fullName: string; jobTitle?: string; roleKey: RoleKey; pages?: string[] },
) {
  const role = await findRole(admin, input.roleKey)

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    full_name: input.fullName.trim(),
    job_title: input.jobTitle?.trim() || null,
    ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
    active: true,
  }, { onConflict: 'id' })
  if (profileError) throw profileError

  const { error: clearRoleError } = await admin.from('user_roles').delete().eq('user_id', userId)
  if (clearRoleError) throw clearRoleError

  const { error: roleError } = await admin.from('user_roles').insert({ user_id: userId, role_id: role.id })
  if (roleError) throw roleError

  const selected = cleanPages(input.pages, input.roleKey)
  const rows = PAGE_KEYS.map((page_key) => ({
    user_id: userId,
    page_key,
    allowed: selected.has(page_key),
    updated_at: new Date().toISOString(),
  }))
  const { error: pagesError } = await admin.from('page_access').upsert(rows, { onConflict: 'user_id,page_key' })
  if (pagesError) throw pagesError
}

async function getCallerRank(admin: SupabaseClient, userId: string) {
  const { data: assignments, error: assignmentsError } = await admin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
  if (assignmentsError) throw assignmentsError

  const roleIds = (assignments ?? []).map((row) => row.role_id as number)
  if (roleIds.length === 0) return { key: 'member', rank: 10 }

  const { data: roles, error: rolesError } = await admin
    .from('roles')
    .select('key,rank')
    .in('id', roleIds)
    .order('rank', { ascending: false })
    .limit(1)
  if (rolesError) throw rolesError

  return (roles?.[0] as { key: string; rank: number } | undefined) ?? { key: 'member', rank: 10 }
}

async function assertCanManage(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc('has_permission', { p_user: userId, p_key: 'team.manage' })
  if (error) throw error
  if (!data) throw new Error('Немате дозвола за управување со тимот.')
}

export const handler = async (event: Event) => {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`

  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Методот не е дозволен.', requestId })

    // Keep backward compatibility with the variables already configured in Netlify.
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !publishable || !secret) {
      const missing = [
        !url && 'SUPABASE_URL/VITE_SUPABASE_URL',
        !publishable && 'SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY',
        !secret && 'SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY',
      ].filter(Boolean)
      console.error('[team-user]', requestId, 'Missing env vars:', missing.join(', '))
      return json(500, { error: `Недостигаат серверски променливи: ${missing.join(', ')}`, requestId })
    }

    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Недостига токен за авторизација.', requestId })

    const verifier = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: authData, error: authError } = await verifier.auth.getUser(token)
    if (authError || !authData.user) {
      console.error('[team-user]', requestId, 'Auth verification failed:', messageOf(authError))
      return json(401, { error: 'Сесијата не е валидна. Најави се повторно.', requestId })
    }

    await assertCanManage(admin, authData.user.id)
    const callerRole = await getCallerRank(admin, authData.user.id)

    let payload: Payload
    try { payload = JSON.parse(event.body ?? '{}') as Payload } catch {
      return json(400, { error: 'Невалидни податоци во барањето.', requestId })
    }

    if (payload.action === 'health') {
      return json(200, { ok: true, requestId })
    }

    if (payload.action === 'create') {
      const email = payload.email?.trim().toLowerCase()
      const fullName = payload.fullName?.trim()
      const roleKey = payload.roleKey

      if (!email || !fullName || !roleKey || !payload.password || payload.password.length < 6) {
        return json(400, { error: 'Внеси име, е-пошта, улога и лозинка од најмалку 6 знаци.', requestId })
      }

      const targetRole = await findRole(admin, roleKey)
      if (callerRole.key !== 'owner' && targetRole.rank >= callerRole.rank) {
        return json(403, { error: 'Не можеш да креираш акаунт со иста или повисока улога од твојата.', requestId })
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: fullName, job_title: payload.jobTitle?.trim() || null },
      })
      if (createError || !created.user) {
        throw createError ?? new Error('Supabase не го креираше акаунтот.')
      }

      try {
        await applyAccess(admin, created.user.id, {
          email,
          fullName,
          jobTitle: payload.jobTitle,
          roleKey,
          pages: payload.pages,
        })
      } catch (setupError) {
        // Do not leave half-created accounts if profile/role/page setup fails.
        await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
        throw setupError
      }

      console.log('[team-user]', requestId, 'created', created.user.id)
      return json(200, { userId: created.user.id, requestId })
    }

    if (payload.action === 'update') {
      if (!payload.userId || !payload.fullName?.trim() || !payload.roleKey) {
        return json(400, { error: 'Недостигаат задолжителни полиња.', requestId })
      }

      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(payload.userId)
      if (targetError || !targetData.user) throw targetError ?? new Error('Корисникот не постои.')

      const currentTargetRole = await getCallerRank(admin, payload.userId)
      const nextRole = await findRole(admin, payload.roleKey)
      if (currentTargetRole.key === 'owner') return json(403, { error: 'Owner акаунтот не може да се менува од оваа форма.', requestId })
      if (callerRole.key !== 'owner' && (currentTargetRole.rank >= callerRole.rank || nextRole.rank >= callerRole.rank)) {
        return json(403, { error: 'Немаш дозвола да ја поставиш избраната улога.', requestId })
      }

      const authPatch: { user_metadata: Record<string, unknown>; password?: string } = {
        user_metadata: { ...targetData.user.user_metadata, full_name: payload.fullName.trim(), job_title: payload.jobTitle?.trim() || null },
      }
      if (payload.password) {
        if (payload.password.length < 6) return json(400, { error: 'Новата лозинка мора да има најмалку 6 знаци.', requestId })
        authPatch.password = payload.password
      }
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(payload.userId, authPatch)
      if (authUpdateError) throw authUpdateError

      await applyAccess(admin, payload.userId, {
        email: targetData.user.email ?? undefined,
        fullName: payload.fullName,
        jobTitle: payload.jobTitle,
        roleKey: payload.roleKey,
        pages: payload.pages,
      })

      console.log('[team-user]', requestId, 'updated', payload.userId)
      return json(200, { userId: payload.userId, requestId })
    }

    if (payload.action === 'delete') {
      if (!payload.userId) return json(400, { error: 'Недостига кориснички ID.', requestId })
      if (payload.userId === authData.user.id) return json(400, { error: 'Не можеш да го избришеш сопствениот акаунт.', requestId })

      const targetRole = await getCallerRank(admin, payload.userId)
      if (targetRole.key === 'owner') return json(403, { error: 'Owner акаунтот не може да се избрише.', requestId })
      if (callerRole.key !== 'owner' && targetRole.rank >= callerRole.rank) {
        return json(403, { error: 'Немаш дозвола да го избришеш овој акаунт.', requestId })
      }

      const { error } = await admin.auth.admin.deleteUser(payload.userId)
      if (error) throw error
      console.log('[team-user]', requestId, 'deleted', payload.userId)
      return json(200, { userId: payload.userId, requestId })
    }

    return json(400, { error: 'Непозната акција.', requestId })
  } catch (error) {
    const message = messageOf(error)
    console.error('[team-user]', requestId, message, error)
    const friendly = message.includes('already been registered') || message.includes('already registered')
      ? 'Веќе постои акаунт со оваа е-пошта.'
      : message.includes('Database error creating new user')
        ? 'Supabase не успеа да го креира корисникот во базата. Провери ја миграцијата 0009 и обиди се повторно.'
        : message
    return json(400, { error: friendly, requestId })
  }
}
