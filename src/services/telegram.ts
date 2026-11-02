import { supabase } from '@/lib/supabase'

export interface TelegramConnection {
  user_id: string
  telegram_username: string | null
  telegram_first_name: string | null
  active: boolean
  connected_at: string
  updated_at: string
}

async function callTelegramAdmin(payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Нема активна сесија. Најави се повторно.')
  const response = await fetch('/.netlify/functions/telegram-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let body: Record<string, unknown> = {}
  try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {} } catch { /* keep empty */ }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `Telegram backend error (${response.status}).`)
  return body
}

export async function getTelegramStatus(userId: string) {
  const body = await callTelegramAdmin({ action: 'status', userId })
  return (body.connection ?? null) as TelegramConnection | null
}

export async function createTelegramConnectLink(userId: string) {
  const body = await callTelegramAdmin({ action: 'create_link', userId })
  return body as { url: string; expiresAt: string; botUsername: string }
}

export async function disconnectTelegram(userId: string) {
  await callTelegramAdmin({ action: 'disconnect', userId })
}

export async function sendTelegramTest(userId: string) {
  await callTelegramAdmin({ action: 'test', userId })
}
