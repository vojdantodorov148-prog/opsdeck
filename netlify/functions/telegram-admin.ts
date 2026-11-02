import { assertTeamManager, ensureTelegramWebhook, getTelegramConnection, sendTelegramMessage } from './_shared/telegram'

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' })

  let auth: Awaited<ReturnType<typeof assertTeamManager>>
  try { auth = await assertTeamManager(request) } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Authorization failed.' })
  }
  if (!auth) return json(403, { error: 'Team management access required.' })

  let payload: Record<string, unknown>
  try { payload = await request.json() as Record<string, unknown> } catch { return json(400, { error: 'Invalid JSON.' }) }
  const action = typeof payload.action === 'string' ? payload.action : ''
  const targetUserId = typeof payload.userId === 'string' ? payload.userId : ''
  if (!targetUserId) return json(400, { error: 'userId is required.' })

  const { admin, userId: actorId } = auth
  const { data: target, error: targetError } = await admin.from('profiles').select('id,full_name,active').eq('id', targetUserId).maybeSingle()
  if (targetError) return json(500, { error: targetError.message })
  if (!target?.active) return json(404, { error: 'Active team member not found.' })

  try {
    if (action === 'status') {
      const connection = await getTelegramConnection(admin, targetUserId)
      return json(200, { connection: connection?.active ? connection : null })
    }

    if (action === 'create_link') {
      const bot = await ensureTelegramWebhook()
      const code = crypto.randomUUID().replace(/-/g, '')
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await admin.from('telegram_link_codes').delete().eq('user_id', targetUserId).is('used_at', null)
      const { error } = await admin.from('telegram_link_codes').insert({
        user_id: targetUserId,
        code,
        created_by: actorId,
        expires_at: expiresAt,
      })
      if (error) throw error
      return json(200, {
        url: `https://t.me/${bot.username}?start=${code}`,
        expiresAt,
        botUsername: bot.username,
      })
    }

    if (action === 'disconnect') {
      const { error } = await admin
        .from('telegram_connections')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
      if (error) throw error
      return json(200, { disconnected: true })
    }

    if (action === 'test') {
      const { data: connection, error } = await admin
        .from('telegram_connections')
        .select('chat_id,active')
        .eq('user_id', targetUserId)
        .maybeSingle()
      if (error) throw error
      if (!connection?.active) return json(400, { error: 'Telegram is not connected for this user.' })
      await sendTelegramMessage(connection.chat_id as string, `✅ Ops Deck тест\n\nTelegram известувањата за ${target.full_name} работат.`)
      return json(200, { sent: true })
    }

    return json(400, { error: 'Unknown action.' })
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Telegram operation failed.' })
  }
}
