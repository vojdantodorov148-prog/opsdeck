import { supabase } from '@/lib/supabase'
import type { Department, TaskStatus, TaskWithRelations } from '@/types/db'
import { departmentFor, describeDeliverables, type DeliverableDraft } from '@/lib/deliverables'

const SELECT = `
  *,
  deliverables:task_deliverables(*),
  product:products(id,name),
  market:markets(id,code,name),
  assignee:profiles!tasks_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!tasks_created_by_fkey(id,full_name)
`

export interface TaskFilters {
  assignee?: string
  department?: Department
  product?: string
  market?: string
  status?: TaskStatus
  search?: string
  mineOnly?: string
}

export async function listTasks(filters: TaskFilters = {}) {
  let q = supabase.from('tasks').select(SELECT).order('created_at', { ascending: false }).limit(200)
  if (filters.mineOnly) q = q.eq('assigned_to', filters.mineOnly)
  if (filters.assignee) q = q.eq('assigned_to', filters.assignee)
  if (filters.department) q = q.eq('department', filters.department)
  if (filters.product) q = q.eq('product_id', filters.product)
  if (filters.market) q = q.eq('market_id', filters.market)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.search) q = q.ilike('title', `%${filters.search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function getTask(id: string) {
  const { data, error } = await supabase.from('tasks').select(SELECT).eq('id', id).single()
  if (error) throw error
  return data as unknown as TaskWithRelations
}

export interface AssignmentInput {
  title: string
  assignedTo: string
  deliverables: DeliverableDraft[]
  productId?: string | null
  marketId?: string | null
  dueDate?: string | null
  notes?: string | null
  testId?: string | null
}

/** One call. The database creates the deliverables, routes, notifies and logs. */
export async function createAssignment(input: AssignmentInput) {
  const { data, error } = await supabase.rpc('create_assignment', {
    p_title: input.title,
    p_assigned_to: input.assignedTo,
    p_deliverables: input.deliverables,
    p_product_id: input.productId ?? null,
    p_market_id: input.marketId ?? null,
    p_due_date: input.dueDate ?? null,
    p_notes: input.notes ?? null,
    p_test_id: input.testId ?? null,
  })
  if (error) throw error
  return data as string
}


export interface AssignmentBundleMarket {
  id: string
  name: string
  code?: string
}

export interface AssignmentBundleInput {
  productId?: string | null
  productName?: string | null
  markets: AssignmentBundleMarket[]
  assignedTo: string
  deliverables: DeliverableDraft[]
  dueDate?: string | null
  notes?: string | null
  testId?: string | null
}

const DEPARTMENT_TITLE: Record<Department, string> = {
  landing: 'Лендинг',
  creative: 'Креативи',
  testing: 'Тестирање',
  general: 'Општо',
}

/**
 * One Quick Action can contain several markets and several kinds of work.
 * We fan it out into one task per market and department so every item appears
 * in the correct factory while the user only submits the form once.
 */
export async function createAssignmentBundle(input: AssignmentBundleInput) {
  const grouped = new Map<Department, DeliverableDraft[]>()
  input.deliverables
    .filter((item) => item.quantity > 0)
    .forEach((item) => {
      const department = departmentFor(item.type)
      grouped.set(department, [...(grouped.get(department) ?? []), item])
    })

  const targets = input.markets.length > 0
    ? input.markets
    : [{ id: '', name: '', code: '' }]
  const splitByDepartment = grouped.size > 1
  const created: string[] = []

  for (const market of targets) {
    for (const [department, deliverables] of grouped) {
      const base = [input.productName, market.name].filter(Boolean).join(' — ')
      const fallback = describeDeliverables(deliverables) || 'Задача'
      const title = `${base || fallback}${splitByDepartment ? ` · ${DEPARTMENT_TITLE[department]}` : ''}`
      created.push(await createAssignment({
        title,
        assignedTo: input.assignedTo,
        deliverables,
        productId: input.productId ?? null,
        marketId: market.id || null,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        testId: input.testId ?? null,
      }))
    }
  }

  return created
}

/** My Day inline row: type, Enter, done. */
export async function createPersonalTask(title: string, scheduledDate: string | null, userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      created_by: userId,
      assigned_to: userId,
      scheduled_date: scheduledDate,
      source: 'personal',
      is_private: true,
      department: 'general',
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as unknown as TaskWithRelations
}

export async function updateTask(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status })
}

export async function rescheduleTask(id: string, scheduledDate: string | null) {
  return updateTask(id, { scheduled_date: scheduledDate })
}

export async function setDeliverableUrl(id: string, url: string | null) {
  const value = url?.trim()
  const normalized = value && !/^https?:\/\//i.test(value) ? `https://${value}` : value
  const { error } = await supabase
    .from('task_deliverables')
    .update({ url: normalized || null })
    .eq('id', id)
  if (error) throw error
}

export async function setDeliverableProgress(id: string, completed: number) {
  const { error } = await supabase
    .from('task_deliverables')
    .update({ completed_quantity: completed, status: completed > 0 ? 'doing' : 'todo' })
    .eq('id', id)
  if (error) throw error
}

export async function myWeek(from: string, to: string) {
  const { data, error } = await supabase.rpc('my_week', { p_from: from, p_to: to })
  if (error) throw error
  const ids = (data ?? []).map((t: { id: string }) => t.id)
  if (!ids.length) return [] as TaskWithRelations[]
  const { data: full, error: e2 } = await supabase.from('tasks').select(SELECT).in('id', ids)
  if (e2) throw e2
  return (full ?? []) as unknown as TaskWithRelations[]
}

export async function submitForReview(taskId: string, reviewerId: string) {
  const { error } = await supabase.from('task_reviews').insert({ task_id: taskId, reviewer_id: reviewerId })
  if (error) throw error
  await setTaskStatus(taskId, 'review')
}

export async function resolveReview(taskId: string, approve: boolean, comment?: string) {
  const { error } = await supabase
    .from('task_reviews')
    .update({ status: approve ? 'approved' : 'changes_requested', comment, updated_at: new Date().toISOString() })
    .eq('task_id', taskId)
    .eq('status', 'pending')
  if (error) throw error
  await setTaskStatus(taskId, approve ? 'done' : 'doing')
}

export async function listComments(taskId: string) {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*, author:profiles(full_name,avatar_url)')
    .eq('task_id', taskId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addComment(taskId: string, userId: string, content: string) {
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, user_id: userId, content })
  if (error) throw error
}
