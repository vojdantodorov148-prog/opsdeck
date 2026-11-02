import { telegramAdminClient, sendTelegramMessage } from './_shared/telegram'

type OutboxRow = {
  notification_id: string
  user_id: string
  task_id: string | null
  attempts: number
}

function taskUrl(taskId: string) {
  const base = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  return base ? `${base}/tasks?task=${encodeURIComponent(taskId)}` : undefined
}

function formatDue(task: { due_at?: string | null; due_date?: string | null; due_time?: string | null }) {
  if (task.due_at) {
    const value = new Date(task.due_at)
    if (!Number.isNaN(value.getTime())) {
      return new Intl.DateTimeFormat('mk-MK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Skopje' }).format(value)
    }
  }
  if (task.due_date) return `${task.due_date}${task.due_time ? ` · ${String(task.due_time).slice(0, 5)}` : ''}`
  return 'Без рок'
}

const DELIVERABLE_LABELS: Record<string, string> = {
  product_page: 'Продукт страница', advertorial: 'Адверторијал', listicle: 'Листикл', quiz: 'Квиз',
  landing_localization: 'Локализација на лендинг', other_landing: 'Друг лендинг', static_ad: 'Статичен оглас',
  video_ad: 'Видео оглас', ugc: 'UGC', creative_concept: 'Креативен концепт', image_variation: 'Варијација на слика',
  hook_variation: 'Варијација на хук', creative_localization: 'Локализација на креативи', other_creative: 'Друг креатив',
  research: 'Истражување', campaign: 'Кампања', general_task: 'Општа задача', custom: 'Прилагодено',
}

function deliverablesText(items: Array<{ type: string; quantity: number }>) {
  if (!items.length) return 'Општа задача'
  return items.map((item) => `${item.quantity} × ${DELIVERABLE_LABELS[item.type] ?? item.type}`).join('\n')
}

export default async () => {
  const admin = telegramAdminClient()
  const { data: claimed, error: claimError } = await admin.rpc('claim_telegram_notification_outbox', { p_limit: 30 })
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 })

  let sent = 0
  let failed = 0
  for (const row of (claimed ?? []) as OutboxRow[]) {
    try {
      if (!row.task_id) throw new Error('Task ID is missing from Telegram outbox row.')
      const [{ data: connection, error: connectionError }, { data: task, error: taskError }] = await Promise.all([
        admin.from('telegram_connections').select('chat_id,active').eq('user_id', row.user_id).maybeSingle(),
        admin.from('tasks').select(`
          id,title,description,due_date,due_time,due_at,status,
          product:products(name),
          market:markets(code,name),
          creator:profiles!tasks_created_by_fkey(full_name),
          deliverables:task_deliverables(type,quantity)
        `).eq('id', row.task_id).maybeSingle(),
      ])
      if (connectionError) throw connectionError
      if (taskError) throw taskError
      if (!connection?.active) {
        await admin.rpc('requeue_telegram_notification', {
          p_notification_id: row.notification_id,
          p_error: 'Telegram connection is inactive.',
          p_delay_seconds: 3600,
        })
        failed += 1
        continue
      }
      if (!task) throw new Error('Task not found.')

      const product = Array.isArray(task.product) ? task.product[0] : task.product
      const market = Array.isArray(task.market) ? task.market[0] : task.market
      const creator = Array.isArray(task.creator) ? task.creator[0] : task.creator
      const deliverables = (task.deliverables ?? []) as Array<{ type: string; quantity: number }>
      const lines = [
        '🔔 Нова задача',
        '',
        product?.name || task.title,
        market ? `${market.code} · ${market.name}` : null,
        '',
        deliverablesText(deliverables),
        `Рок: ${formatDue(task)}`,
        creator?.full_name ? `Доделено од: ${creator.full_name}` : null,
        task.description ? `\nБелешка: ${task.description}` : null,
      ].filter((line): line is string => Boolean(line))

      await sendTelegramMessage(connection.chat_id as string, lines.join('\n'), taskUrl(row.task_id))
      await admin.rpc('complete_telegram_notification', { p_notification_id: row.notification_id })
      sent += 1
    } catch (error) {
      const err = error as Error & { retryAfter?: number }
      const delay = err.retryAfter ? Math.max(15, err.retryAfter) : Math.min(900, Math.max(30, 30 * 2 ** Math.min(row.attempts, 5)))
      await admin.rpc('requeue_telegram_notification', {
        p_notification_id: row.notification_id,
        p_error: err.message || 'Telegram delivery failed.',
        p_delay_seconds: delay,
      })
      failed += 1
    }
  }

  return Response.json({ claimed: (claimed ?? []).length, sent, failed })
}
