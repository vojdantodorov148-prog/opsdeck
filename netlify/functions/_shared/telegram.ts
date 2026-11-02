import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function telegramAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Missing Supabase server environment variables.')
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function telegramBrowserVerifier() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !publishable) throw new Error('Missing Supabase browser verification environment variables.')
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function bearerToken(request: Request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export async function assertTeamManager(request: Request) {
  const token = bearerToken(request)
  if (!token) return null
  const verifier = telegramBrowserVerifier()
  const { data, error } = await verifier.auth.getUser(token)
  if (error || !data.user) return null

  const admin = telegramAdminClient()
  const { data: allowed, error: permissionError } = await admin.rpc('has_permission', {
    p_user: data.user.id,
    p_key: 'team.manage',
  })
  if (permissionError) throw permissionError
  if (!allowed) return null
  return { admin, userId: data.user.id }
}

export async function telegramApi(method: string, body?: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const raw = await response.text()
  let parsed: { ok?: boolean; result?: unknown; description?: string; parameters?: { retry_after?: number } } = {}
  try { parsed = raw ? JSON.parse(raw) as typeof parsed : {} } catch { /* keep empty */ }
  if (!response.ok || parsed.ok === false) {
    const error = new Error(parsed.description || `Telegram API HTTP ${response.status}`) as Error & { retryAfter?: number }
    if (parsed.parameters?.retry_after) error.retryAfter = parsed.parameters.retry_after
    throw error
  }
  return parsed.result
}

export async function ensureTelegramWebhook() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not configured.')
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, _ and -.')
  }
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  if (!siteUrl) throw new Error('Netlify site URL is unavailable.')

  const me = await telegramApi('getMe') as { username?: string } | undefined
  if (!me?.username) throw new Error('Telegram bot username could not be loaded.')
  await telegramApi('setWebhook', {
    url: `${siteUrl}/.netlify/functions/telegram-webhook`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  })
  return { username: me.username, webhookUrl: `${siteUrl}/.netlify/functions/telegram-webhook` }
}

export async function sendTelegramMessage(chatId: string | number, text: string, taskUrl?: string) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(taskUrl ? {
      reply_markup: {
        inline_keyboard: [[{ text: 'Отвори ја задачата', url: taskUrl }]],
      },
    } : {}),
  })
}

export async function getTelegramConnection(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('telegram_connections')
    .select('user_id,telegram_username,telegram_first_name,active,connected_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
