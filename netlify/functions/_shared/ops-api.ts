import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const API_SCOPES = ['read', 'write:products', 'write:tasks', 'write:comments'] as const
export type ApiScope = typeof API_SCOPES[number]

export type ApiKeyContext = {
  id: string
  name: string
  userId: string
  keyPrefix: string
  scopes: ApiScope[]
  rateLimitPerMinute: number
  userName: string
}

export type ApiResult = {
  status: number
  body: unknown
  result?: string
  headers?: Record<string, string>
}

export type IdempotencyReservation = {
  rowId: string
  key: string
} | null

export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function serverEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !service) throw new Error('Missing server Supabase environment variables.')
  return { url, service }
}

export function adminClient() {
  const { url, service } = serverEnv()
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function browserVerifier() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !anon) throw new Error('Missing browser-safe Supabase environment variables.')
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function apiError(status: number, code: string, message: string, fields?: Record<string, string>): ApiResult {
  return {
    status,
    result: code,
    body: {
      error: {
        code,
        message,
        ...(fields && Object.keys(fields).length ? { fields } : {}),
      },
    },
  }
}

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export function makeApiKey() {
  const raw = `odk_live_${randomBytes(32).toString('base64url')}`
  return {
    raw,
    hash: sha256(raw),
    prefix: raw.slice(0, 18),
  }
}

export function safeTokenEquals(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function authenticateApiKey(admin: SupabaseClient, request: Request): Promise<ApiKeyContext | null> {
  const token = bearerToken(request)
  if (!token) return null
  const keyHash = sha256(token)
  const { data, error } = await admin
    .from('api_keys')
    .select('id,name,user_id,key_prefix,scopes,rate_limit_per_minute,revoked_at, user:profiles!api_keys_user_id_fkey(full_name,active)')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle()
  if (error || !data) return null

  const user = data.user as unknown as { full_name: string; active: boolean } | null
  if (!user?.active) return null

  return {
    id: data.id as string,
    name: data.name as string,
    userId: data.user_id as string,
    keyPrefix: data.key_prefix as string,
    scopes: (data.scopes ?? []) as ApiScope[],
    rateLimitPerMinute: Number(data.rate_limit_per_minute ?? 60),
    userName: user.full_name,
  }
}

export function hasScope(ctx: ApiKeyContext, scope: ApiScope) {
  return ctx.scopes.includes(scope)
}

export async function consumeRateLimit(admin: SupabaseClient, ctx: ApiKeyContext) {
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_key_id: ctx.id,
    p_limit: ctx.rateLimitPerMinute,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    count: Number(row?.request_count ?? 0),
    resetAt: String(row?.reset_at ?? ''),
  }
}

export async function touchApiKey(admin: SupabaseClient, keyId: string) {
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId)
}

export async function auditApiCall(admin: SupabaseClient, input: {
  ctx?: ApiKeyContext | null
  method: string
  endpoint: string
  status: number
  result: string
  requestId: string
  durationMs: number
  unknownKeyName?: string
}) {
  await admin.from('api_audit_logs').insert({
    api_key_id: input.ctx?.id ?? null,
    key_name: input.ctx?.name ?? input.unknownKeyName ?? 'unknown',
    user_id: input.ctx?.userId ?? null,
    method: input.method,
    endpoint: input.endpoint,
    status_code: input.status,
    result: input.result,
    request_id: input.requestId,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
  })
}

export async function reserveIdempotency(admin: SupabaseClient, ctx: ApiKeyContext, input: {
  idempotencyKey: string | null
  method: string
  endpoint: string
  rawBody: string
}): Promise<{ replay?: ApiResult; reservation?: IdempotencyReservation }> {
  if (!input.idempotencyKey) return { reservation: null }
  if (input.idempotencyKey.length > 200) {
    return { replay: apiError(400, 'validation_error', 'Invalid Idempotency-Key.', { 'Idempotency-Key': 'Maximum 200 characters.' }) }
  }

  const requestHash = sha256(`${input.method}\n${input.endpoint}\n${input.rawBody}`)
  const row = {
    api_key_id: ctx.id,
    idempotency_key: input.idempotencyKey,
    method: input.method,
    endpoint: input.endpoint,
    request_hash: requestHash,
  }
  const { data, error } = await admin.from('api_idempotency').insert(row).select('id').single()
  if (!error && data) return { reservation: { rowId: data.id as string, key: input.idempotencyKey } }

  if ((error as { code?: string } | null)?.code !== '23505') throw error
  const { data: existing, error: existingError } = await admin
    .from('api_idempotency')
    .select('id,method,endpoint,request_hash,status_code,response_body,completed_at')
    .eq('api_key_id', ctx.id)
    .eq('idempotency_key', input.idempotencyKey)
    .single()
  if (existingError) throw existingError
  if (existing.method !== input.method || existing.endpoint !== input.endpoint || existing.request_hash !== requestHash) {
    return { replay: apiError(409, 'idempotency_conflict', 'This Idempotency-Key was already used for a different request.') }
  }
  if (!existing.completed_at || existing.status_code == null) {
    return { replay: apiError(409, 'idempotency_in_progress', 'A request with this Idempotency-Key is already in progress.') }
  }
  return {
    replay: {
      status: Number(existing.status_code),
      body: existing.response_body,
      result: 'idempotent_replay',
      headers: { 'Idempotent-Replayed': 'true' },
    },
  }
}

export async function completeIdempotency(admin: SupabaseClient, reservation: IdempotencyReservation, result: ApiResult) {
  if (!reservation) return
  if (result.status >= 500) {
    await admin.from('api_idempotency').delete().eq('id', reservation.rowId)
    return
  }
  await admin.from('api_idempotency').update({
    status_code: result.status,
    response_body: result.body,
    completed_at: new Date().toISOString(),
  }).eq('id', reservation.rowId)
}

export function parseJson(raw: string): { value?: unknown; error?: ApiResult } {
  if (!raw.trim()) return { value: {} }
  try {
    return { value: JSON.parse(raw) as unknown }
  } catch {
    return { error: apiError(400, 'invalid_json', 'Request body must be valid JSON.') }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function rejectUnknownFields(value: Record<string, unknown>, allowed: string[]) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key))
  return extras.length ? extras : null
}

export function requiredString(value: unknown, field: string, errors: Record<string, string>, max = 10000) {
  if (typeof value !== 'string' || !value.trim()) {
    errors[field] = 'Required non-empty string.'
    return null
  }
  const clean = value.trim()
  if (clean.length > max) {
    errors[field] = `Maximum ${max} characters.`
    return null
  }
  return clean
}

export function optionalString(value: unknown, field: string, errors: Record<string, string>, max = 10000) {
  if (value == null) return null
  if (typeof value !== 'string') {
    errors[field] = 'Must be a string or null.'
    return null
  }
  const clean = value.trim()
  if (clean.length > max) errors[field] = `Maximum ${max} characters.`
  return clean || null
}

export function optionalUrl(value: unknown, field: string, errors: Record<string, string>) {
  const clean = optionalString(value, field, errors, 4000)
  if (!clean) return clean
  try {
    const url = new URL(clean)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
    return url.toString()
  } catch {
    errors[field] = 'Must be a valid http(s) URL.'
    return null
  }
}

export function numberField(value: unknown, field: string, errors: Record<string, string>, opts?: { required?: boolean; min?: number }) {
  if (value == null && !opts?.required) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors[field] = 'Must be a number.'
    return null
  }
  if (opts?.min != null && value < opts.min) errors[field] = `Must be at least ${opts.min}.`
  return value
}

export function isoDueAt(value: unknown, field: string, errors: Record<string, string>) {
  if (typeof value !== 'string' || !value.trim()) {
    errors[field] = 'Required ISO 8601 timestamp with timezone.'
    return null
  }
  const raw = value.trim()
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(raw) || Number.isNaN(Date.parse(raw))) {
    errors[field] = 'Must be ISO 8601 and include Z or an explicit timezone offset.'
    return null
  }
  const localMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}(?:\.\d+)?))?/)
  if (!localMatch) {
    errors[field] = 'Must include date and time.'
    return null
  }
  return {
    raw,
    canonical: new Date(raw).toISOString(),
    dueDate: localMatch[1],
    dueTime: `${localMatch[2]}:${(localMatch[3] || '00').slice(0, 2)}`,
  }
}

function isBlockedIp(address: string) {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ip = mapped || normalized
  if (isIP(ip) !== 4) return false
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
}

async function assertPublicUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) image URLs are allowed.')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Private/local image URLs are not allowed.')
  if (isIP(host) && isBlockedIp(host)) throw new Error('Private/reserved image IPs are not allowed.')
  if (!isIP(host)) {
    const addresses = await lookup(host, { all: true, verbatim: true })
    if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) throw new Error('Image hostname resolves to a private/reserved address.')
  }
}

export async function downloadImageFromUrl(rawUrl: string) {
  let current = new URL(rawUrl)
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    await assertPublicUrl(current)
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'OpsDeck-ImageFetcher/1.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(15000),
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Image redirect had no Location header.')
      current = new URL(location, current)
      continue
    }
    if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}.`)
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
    if (!allowedTypes.has(type)) throw new Error('URL must return a supported raster image (JPEG, PNG, WebP, GIF, or AVIF).')
    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_IMAGE_BYTES) throw new Error('Image is larger than 10 MB.')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Image response had no body.')
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new Error('Image is larger than 10 MB.')
      }
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    return { buffer, contentType: type, sourceUrl: current.toString() }
  }
  throw new Error('Too many image redirects.')
}

export function imageExtension(contentType: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'image/avif': 'avif',
  }
  return map[contentType] || 'img'
}

export function publicImageUrl(admin: SupabaseClient, path: string) {
  return admin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadRemoteProductImages(admin: SupabaseClient, productId: string, urls: string[], startOrder = 0) {
  const uploaded: { path: string; rowId: string }[] = []
  try {
    for (let index = 0; index < urls.length; index += 1) {
      const downloaded = await downloadImageFromUrl(urls[index])
      const ext = imageExtension(downloaded.contentType)
      const path = `${productId}/${randomUUID()}.${ext}`
      const { error: uploadError } = await admin.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, downloaded.buffer, {
        contentType: downloaded.contentType,
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError
      const { data: image, error: imageError } = await admin.from('product_images').insert({
        product_id: productId,
        storage_path: path,
        alt_text: null,
        sort_order: startOrder + index,
      }).select('id').single()
      if (imageError) {
        await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
        throw imageError
      }
      uploaded.push({ path, rowId: image.id as string })
    }
    return uploaded
  } catch (error) {
    if (uploaded.length) {
      await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove(uploaded.map((item) => item.path))
      await admin.from('product_images').delete().in('id', uploaded.map((item) => item.rowId))
    }
    throw error
  }
}

export async function deleteProductImages(admin: SupabaseClient, images: Array<{ id: string; storage_path: string }>) {
  if (!images.length) return
  await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove(images.map((image) => image.storage_path))
  await admin.from('product_images').delete().in('id', images.map((image) => image.id))
}

export function apiRequestId() {
  return randomUUID()
}
