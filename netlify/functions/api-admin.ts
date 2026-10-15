import { API_SCOPES, adminClient, bearerToken, browserVerifier, jsonResponse, makeApiKey, type ApiScope } from './_shared/ops-api'

async function requireAdmin(request: Request) {
  const token = bearerToken(request)
  if (!token) return null
  const verifier = browserVerifier()
  const { data, error } = await verifier.auth.getUser(token)
  if (error || !data.user) return null

  const admin = adminClient()
  const { data: roles, error: roleError } = await admin
    .from('user_roles')
    .select('roles(key)')
    .eq('user_id', data.user.id)
  if (roleError) throw roleError
  const allowed = ((roles ?? []) as unknown as Array<{ roles: { key: string } | null }>)
    .some((row) => row.roles && ['owner', 'admin'].includes(row.roles.key))
  if (!allowed) return null
  return { userId: data.user.id, admin }
}

function error(status: number, message: string, fields?: Record<string, string>) {
  return jsonResponse(status, { error: message, ...(fields ? { fields } : {}) })
}

export default async (request: Request) => {
  if (request.method !== 'POST') return error(405, 'Method not allowed.')
  let auth: Awaited<ReturnType<typeof requireAdmin>>
  try { auth = await requireAdmin(request) } catch (e) { return error(500, e instanceof Error ? e.message : 'Authorization failed.') }
  if (!auth) return error(403, 'Admin access required.')

  let payload: Record<string, unknown>
  try { payload = await request.json() as Record<string, unknown> } catch { return error(400, 'Invalid JSON.') }
  const action = typeof payload.action === 'string' ? payload.action : ''
  const { admin, userId } = auth

  try {
    if (action === 'list') {
      const [{ data: keys, error: keyError }, { data: users, error: userError }] = await Promise.all([
        admin.from('api_keys')
          .select('id,name,user_id,key_prefix,scopes,rate_limit_per_minute,created_at,last_used_at,revoked_at,user:profiles!api_keys_user_id_fkey(id,full_name,email)')
          .order('created_at', { ascending: false }),
        admin.from('profiles').select('id,full_name,email,active').eq('active', true).order('full_name'),
      ])
      if (keyError) throw keyError
      if (userError) throw userError
      return jsonResponse(200, { keys: keys ?? [], users: users ?? [], scopes: API_SCOPES })
    }

    if (action === 'audit') {
      const limit = Math.min(Math.max(Number(payload.limit ?? 100), 1), 250)
      const { data, error: auditError } = await admin
        .from('api_audit_logs')
        .select('id,key_name,user_id,method,endpoint,status_code,result,request_id,duration_ms,created_at,user:profiles!api_audit_logs_user_id_fkey(id,full_name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (auditError) throw auditError
      return jsonResponse(200, { logs: data ?? [] })
    }

    if (action === 'create') {
      const name = typeof payload.name === 'string' ? payload.name.trim() : ''
      const actingUserId = typeof payload.userId === 'string' ? payload.userId : ''
      const scopes = Array.isArray(payload.scopes) ? payload.scopes.filter((value): value is ApiScope => typeof value === 'string' && API_SCOPES.includes(value as ApiScope)) : []
      const fields: Record<string, string> = {}
      if (!name) fields.name = 'Name is required.'
      if (name.length > 120) fields.name = 'Maximum 120 characters.'
      if (!actingUserId) fields.userId = 'Choose a user.'
      if (!scopes.length) fields.scopes = 'Choose at least one scope.'
      if (Array.isArray(payload.scopes) && scopes.length !== payload.scopes.length) fields.scopes = 'One or more scopes are invalid.'
      const { data: profile } = actingUserId
        ? await admin.from('profiles').select('id,active').eq('id', actingUserId).maybeSingle()
        : { data: null }
      if (actingUserId && !profile?.active) fields.userId = 'Active user not found.'
      if (Object.keys(fields).length) return error(400, 'Validation failed.', fields)

      const key = makeApiKey()
      const { data, error: createError } = await admin.from('api_keys').insert({
        name,
        user_id: actingUserId,
        key_prefix: key.prefix,
        key_hash: key.hash,
        scopes: Array.from(new Set(scopes)),
        created_by: userId,
      }).select('id,name,user_id,key_prefix,scopes,rate_limit_per_minute,created_at,last_used_at,revoked_at').single()
      if (createError) throw createError
      return jsonResponse(201, { key: data, token: key.raw })
    }

    if (action === 'revoke') {
      const keyId = typeof payload.keyId === 'string' ? payload.keyId : ''
      if (!keyId) return error(400, 'keyId is required.', { keyId: 'Required.' })
      const { data, error: revokeError } = await admin.from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId)
        .is('revoked_at', null)
        .select('id')
        .maybeSingle()
      if (revokeError) throw revokeError
      if (!data) return error(404, 'Active API key not found.')
      return jsonResponse(200, { revoked: true })
    }

    return error(400, 'Unknown action.')
  } catch (e) {
    return error(500, e instanceof Error ? e.message : 'Server error.')
  }
}
