import { supabase } from '@/lib/supabase'
import type { ActivityEvent, AppNotification, Note, UserLevel } from '@/types/db'

export async function listNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', userId).is('read_at', null)
  if (error) throw error
}

export async function listActivity(limit = 12) {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*, actor:profiles(full_name,avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as ActivityEvent[]
}

export async function listNotes(scope: { productId?: string; taskId?: string; authorId?: string } = {}) {
  let q = supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(100)
  if (scope.productId) q = q.eq('product_id', scope.productId)
  if (scope.taskId) q = q.eq('task_id', scope.taskId)
  if (scope.authorId && !scope.productId && !scope.taskId) q = q.eq('author_id', scope.authorId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function addNote(note: Partial<Note>) {
  const { data, error } = await supabase.from('notes').insert(note).select().single()
  if (error) throw error
  return data as Note
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function getLevel(userId: string) {
  const { data, error } = await supabase.from('user_levels').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data ?? { user_id: userId, total_xp: 0, level: 1 }) as UserLevel
}

/** Level n starts at 100*(n-1)^2 XP. Gentle curve, no streak pressure. */
export function levelBounds(level: number) {
  const floor = 100 * (level - 1) ** 2
  const ceiling = 100 * level ** 2
  return { floor, ceiling }
}
