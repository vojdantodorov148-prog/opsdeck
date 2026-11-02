import { telegramAdminClient, sendTelegramMessage } from './_shared/telegram'

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; type?: string }
    from?: { username?: string; first_name?: string }
  }
}

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed.', { status: 405 })
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const supplied = request.headers.get('x-telegram-bot-api-secret-token') || ''
  if (!expected || !supplied || !safeEqual(expected, supplied)) return new Response('Unauthorized', { status: 401 })

  let update: TelegramUpdate
  try { update = await request.json() as TelegramUpdate } catch { return new Response('Bad request', { status: 400 }) }
  const message = update.message
  const chatId = message?.chat?.id
  const text = message?.text?.trim() || ''
  if (!chatId || message?.chat?.type !== 'private') return new Response('ok')

  const match = text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]+))?/i)
  if (!match) return new Response('ok')
  const code = match[1]
  if (!code) {
    await sendTelegramMessage(chatId, 'Отвори го Telegram connect линкот од Ops Deck → Team за да го поврзеш акаунтот.')
    return new Response('ok')
  }

  const admin = telegramAdminClient()
  const { data: link, error } = await admin
    .from('telegram_link_codes')
    .select('id,user_id,expires_at,used_at')
    .eq('code', code)
    .maybeSingle()
  if (error || !link || link.used_at || new Date(link.expires_at).getTime() <= Date.now()) {
    await sendTelegramMessage(chatId, 'Овој Ops Deck connect линк е невалиден или истечен. Побарај нов линк.')
    return new Response('ok')
  }

  const { error: connectionError } = await admin.from('telegram_connections').upsert({
    user_id: link.user_id,
    chat_id: chatId,
    telegram_username: message.from?.username || null,
    telegram_first_name: message.from?.first_name || null,
    active: true,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (connectionError) {
    await sendTelegramMessage(chatId, 'Не успеав да го поврзам Telegram акаунтот. Обиди се повторно со нов линк.')
    return new Response('ok')
  }

  await admin.from('telegram_link_codes').update({ used_at: new Date().toISOString() }).eq('id', link.id)
  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', link.user_id).maybeSingle()
  await sendTelegramMessage(chatId, `✅ Telegram е поврзан со Ops Deck${profile?.full_name ? ` за ${profile.full_name}` : ''}.\n\nЌе добиваш порака кога ќе ти биде доделена нова задача.`)
  return new Response('ok')
}
