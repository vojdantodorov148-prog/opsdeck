import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adminClient,
  apiError,
  apiRequestId,
  auditApiCall,
  authenticateApiKey,
  completeIdempotency,
  consumeRateLimit,
  hasScope,
  isRecord,
  jsonResponse,
  optionalString,
  parseJson,
  rejectUnknownFields,
  reserveIdempotency,
  touchApiKey,
  type ApiKeyContext,
  type ApiResult,
} from './_shared/ops-api'

const BUCKET = 'untested-creatives'
const MAX_REMOTE_BYTES = 50 * 1024 * 1024

function success(body: unknown, status = 200): ApiResult {
  return { status, body, result: 'ok' }
}

function notFound(entity = 'Resource') {
  return apiError(404, 'not_found', `${entity} not found.`)
}

function safeFileName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return clean || 'creative'
}

function driveUrl(raw: unknown, field: string, errors: Record<string, string>) {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors[field] = 'Required Google Drive URL.'
    return null
  }
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) throw new Error('host')
    return url.toString()
  } catch {
    errors[field] = 'Must be a valid Google Drive https URL.'
    return null
  }
}

function httpUrl(raw: unknown, field: string, errors: Record<string, string>) {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors[field] = 'Required http(s) URL.'
    return null
  }
  try {
    const url = new URL(raw.trim())
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
    return url.toString()
  } catch {
    errors[field] = 'Must be a valid http(s) URL.'
    return null
  }
}

function isBlockedIp(address: string) {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ip = mapped || normalized
  if (isIP(ip) !== 4) return false
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
}

async function assertPublicUrl(url: URL) {
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Private/local URLs are not allowed.')
  if (isIP(host) && isBlockedIp(host)) throw new Error('Private/reserved IPs are not allowed.')
  if (!isIP(host)) {
    const addresses = await lookup(host, { all: true, verbatim: true })
    if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) throw new Error('URL resolves to a private/reserved address.')
  }
}

function contentDispositionName(value: string | null) {
  if (!value) return null
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (utf) {
    try { return decodeURIComponent(utf.replace(/^"|"$/g, '')) } catch { return utf }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1] ?? null
}

function fallbackExtension(contentType: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  }
  return map[contentType] || 'bin'
}

async function downloadCreative(rawUrl: string, requestedName?: string | null) {
  let current = new URL(rawUrl)
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    await assertPublicUrl(current)
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'OpsDeck-CreativeFetcher/1.0', Accept: '*/*' },
      signal: AbortSignal.timeout(30000),
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Creative redirect had no Location header.')
      current = new URL(location, current)
      continue
    }
    if (!response.ok) throw new Error(`Creative download failed with HTTP ${response.status}.`)

    const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    if (!(contentType.startsWith('image/') || contentType.startsWith('video/') || contentType === 'application/octet-stream')) {
      throw new Error('Remote URL must return an image or video file.')
    }
    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_REMOTE_BYTES) throw new Error('Remote creative is larger than 50 MB. Use a Google Drive folder link for larger files.')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Creative response had no body.')
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_REMOTE_BYTES) {
        await reader.cancel()
        throw new Error('Remote creative is larger than 50 MB. Use a Google Drive folder link for larger files.')
      }
      chunks.push(value)
    }

    const fromHeader = contentDispositionName(response.headers.get('content-disposition'))
    const fromPath = decodeURIComponent(current.pathname.split('/').filter(Boolean).pop() || '')
    let fileName = requestedName?.trim() || fromHeader || fromPath || `creative.${fallbackExtension(contentType)}`
    if (!fileName.includes('.')) fileName = `${fileName}.${fallbackExtension(contentType)}`

    return {
      buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
      contentType,
      fileName,
      size: total,
      sourceUrl: current.toString(),
    }
  }
  throw new Error('Too many redirects while downloading creative.')
}

async function productExists(admin: SupabaseClient, productId: string) {
  const { data, error } = await admin.from('products').select('id').eq('id', productId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function signedCreative(admin: SupabaseClient, row: Record<string, unknown>) {
  let downloadUrl: string | null = null
  if (row.source_type === 'upload' && row.storage_path) {
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 60 * 60)
    downloadUrl = data?.signedUrl ?? null
  }
  return {
    id: row.id,
    product_id: row.product_id,
    source: row.source_type,
    label: row.label,
    file_name: row.original_name,
    mime_type: row.mime_type,
    file_size: row.file_size,
    drive_url: row.external_url,
    download_url: downloadUrl,
    testing: Boolean(row.testing_started_at),
    testing_started_at: row.testing_started_at,
    delete_after: row.delete_after,
    created_at: row.created_at,
  }
}

async function listCreatives(admin: SupabaseClient, productId: string): Promise<ApiResult> {
  if (!await productExists(admin, productId)) return notFound('Product')
  const { data, error } = await admin.from('product_untested_creatives').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return success(await Promise.all((data ?? []).map((row) => signedCreative(admin, row as Record<string, unknown>))))
}

async function getCreative(admin: SupabaseClient, productId: string, creativeId: string): Promise<ApiResult> {
  const { data, error } = await admin.from('product_untested_creatives').select('*').eq('id', creativeId).eq('product_id', productId).maybeSingle()
  if (error) throw error
  return data ? success(await signedCreative(admin, data as Record<string, unknown>)) : notFound('Untested creative')
}

async function createCreative(admin: SupabaseClient, ctx: ApiKeyContext, productId: string, body: unknown): Promise<ApiResult> {
  if (!await productExists(admin, productId)) return notFound('Product')
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const allowed = ['kind', 'url', 'label', 'file_name']
  const unknown = rejectUnknownFields(body, allowed)
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))

  const errors: Record<string, string> = {}
  const kind = body.kind
  if (kind !== 'drive' && kind !== 'file_url') errors.kind = 'Use drive or file_url.'
  const label = optionalString(body.label, 'label', errors, 240)
  const fileName = optionalString(body.file_name, 'file_name', errors, 255)

  if (kind === 'drive') {
    const url = driveUrl(body.url, 'url', errors)
    if (Object.keys(errors).length || !url) return apiError(400, 'validation_error', 'Invalid creative.', errors)
    const { data, error } = await admin.from('product_untested_creatives').insert({
      product_id: productId,
      source_type: 'drive',
      external_url: url,
      label: label || 'Google Drive folder',
      original_name: label,
      added_by: ctx.userId,
    }).select('*').single()
    if (error) throw error
    return success(await signedCreative(admin, data as Record<string, unknown>), 201)
  }

  const url = httpUrl(body.url, 'url', errors)
  if (Object.keys(errors).length || !url) return apiError(400, 'validation_error', 'Invalid creative.', errors)
  const downloaded = await downloadCreative(url, fileName)
  const path = `${productId}/${randomUUID()}-${safeFileName(downloaded.fileName)}`
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, downloaded.buffer, {
    contentType: downloaded.contentType,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError

  try {
    const { data, error } = await admin.from('product_untested_creatives').insert({
      product_id: productId,
      source_type: 'upload',
      storage_path: path,
      original_name: downloaded.fileName,
      mime_type: downloaded.contentType,
      file_size: downloaded.size,
      label: label || downloaded.fileName,
      added_by: ctx.userId,
    }).select('*').single()
    if (error) throw error
    return success(await signedCreative(admin, data as Record<string, unknown>), 201)
  } catch (error) {
    await admin.storage.from(BUCKET).remove([path])
    throw error
  }
}

async function patchCreative(admin: SupabaseClient, ctx: ApiKeyContext, productId: string, creativeId: string, body: unknown): Promise<ApiResult> {
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const unknown = rejectUnknownFields(body, ['testing'])
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  if (typeof body.testing !== 'boolean') return apiError(400, 'validation_error', 'Invalid testing value.', { testing: 'Must be true or false.' })

  const { data: current, error: currentError } = await admin
    .from('product_untested_creatives')
    .select('*')
    .eq('id', creativeId)
    .eq('product_id', productId)
    .maybeSingle()
  if (currentError) throw currentError
  if (!current) return notFound('Untested creative')

  if (body.testing === true && current.testing_started_at) {
    return success(await signedCreative(admin, current as Record<string, unknown>))
  }

  const { data, error } = await admin.from('product_untested_creatives').update(body.testing ? {
    testing_started_at: new Date().toISOString(),
    tested_by: ctx.userId,
  } : {
    testing_started_at: null,
    tested_by: null,
  }).eq('id', creativeId).eq('product_id', productId).select('*').single()
  if (error) throw error
  return success(await signedCreative(admin, data as Record<string, unknown>))
}

async function dispatch(admin: SupabaseClient, ctx: ApiKeyContext, method: string, productId: string, creativeId: string | null, body: unknown): Promise<ApiResult> {
  if (method === 'GET') {
    if (!hasScope(ctx, 'read')) return apiError(403, 'forbidden', 'This API key does not have the read scope.')
    return creativeId ? getCreative(admin, productId, creativeId) : listCreatives(admin, productId)
  }
  if (method === 'POST' && !creativeId) {
    if (!hasScope(ctx, 'write:products')) return apiError(403, 'forbidden', 'This API key does not have write:products.')
    return createCreative(admin, ctx, productId, body)
  }
  if (method === 'PATCH' && creativeId) {
    if (!hasScope(ctx, 'write:products')) return apiError(403, 'forbidden', 'This API key does not have write:products.')
    return patchCreative(admin, ctx, productId, creativeId, body)
  }
  if (method === 'DELETE') return apiError(405, 'method_not_allowed', 'DELETE endpoints are intentionally disabled.')
  return apiError(404, 'not_found', 'API endpoint not found.')
}

export default async (request: Request) => {
  const started = Date.now()
  const requestId = apiRequestId()
  const admin = adminClient()
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')
  const routeMatch = path.match(/\/api\/v1\/products\/([^/]+)\/untested-creatives(?:\/([^/]+))?$/i)
  const productId = url.searchParams.get('product_id') || (routeMatch?.[1] ? decodeURIComponent(routeMatch[1]) : '')
  const creativeId = url.searchParams.get('creative_id') || (routeMatch?.[2] ? decodeURIComponent(routeMatch[2]) : null)
  const method = request.method.toUpperCase()
  const endpoint = `/products/${productId}/untested-creatives${creativeId ? `/${creativeId}` : ''}`
  let ctx: ApiKeyContext | null = null
  let result: ApiResult
  let reservation = null as Awaited<ReturnType<typeof reserveIdempotency>>['reservation']

  try {
    if (!productId) return jsonResponse(400, { error: { code: 'validation_error', message: 'Missing product ID.' }, request_id: requestId })

    ctx = await authenticateApiKey(admin, request)
    if (!ctx) {
      result = apiError(401, 'unauthorized', 'Missing, invalid, or revoked API key.')
      await auditApiCall(admin, { method, endpoint, status: result.status, result: result.result || 'unauthorized', requestId, durationMs: Date.now() - started, unknownKeyName: 'unknown' })
      return jsonResponse(result.status, { ...(result.body as object), request_id: requestId })
    }

    const limit = await consumeRateLimit(admin, ctx)
    if (!limit.allowed) {
      result = apiError(429, 'rate_limited', 'Rate limit exceeded for this API key.')
      await auditApiCall(admin, { ctx, method, endpoint, status: result.status, result: result.result || 'rate_limited', requestId, durationMs: Date.now() - started })
      return jsonResponse(result.status, { ...(result.body as object), request_id: requestId }, { 'Retry-After': '60', 'X-RateLimit-Reset': limit.resetAt })
    }

    await touchApiKey(admin, ctx.id)
    const rawBody = ['POST', 'PATCH'].includes(method) ? await request.text() : ''
    const parsed = parseJson(rawBody)
    if (parsed.error) result = parsed.error
    else if (method === 'POST') {
      const idem = await reserveIdempotency(admin, ctx, {
        idempotencyKey: request.headers.get('idempotency-key'), method, endpoint, rawBody,
      })
      if (idem.replay) result = idem.replay
      else {
        reservation = idem.reservation
        result = await dispatch(admin, ctx, method, productId, creativeId, parsed.value)
        await completeIdempotency(admin, reservation ?? null, result)
      }
    } else {
      result = await dispatch(admin, ctx, method, productId, creativeId, parsed.value)
    }
  } catch (error) {
    if (reservation) await admin.from('api_idempotency').delete().eq('id', reservation.rowId)
    result = apiError(500, 'internal_error', error instanceof Error ? error.message : 'Unexpected server error.')
  }

  try {
    await auditApiCall(admin, { ctx, method, endpoint, status: result.status, result: result.result || (result.status < 400 ? 'ok' : 'error'), requestId, durationMs: Date.now() - started })
  } catch { /* audit failures do not hide the API response */ }

  const responseBody = isRecord(result.body) ? { ...result.body, request_id: requestId } : { data: result.body, request_id: requestId }
  return jsonResponse(result.status, responseBody, result.headers)
}
