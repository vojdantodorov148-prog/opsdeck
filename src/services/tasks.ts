import { supabase } from '@/lib/supabase'
import type { Department, TaskStatus, TaskWithRelations } from '@/types/db'
import { departmentFor, describeDeliverables, type DeliverableDraft } from '@/lib/deliverables'

const SELECT = `
  *,
  deliverables:task_deliverables(*),
  product:products(id,name,main_url,brief,images:product_images(id,storage_path,sort_order)),
  market:markets(id,code,name),
  assignee:profiles!tasks_assigned_to_fkey(id,full_name,avatar_url),
  creator:profiles!tasks_created_by_fkey(id,full_name)
`

const TASK_REFERENCE_BUCKET = 'task-reference-images'
const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024

function withTaskImageUrls(task: TaskWithRelations): TaskWithRelations {
  const product = task.product
    ? {
        ...task.product,
        images: [...(task.product.images ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((image) => ({
            ...image,
            public_url: supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(image.storage_path).data.publicUrl,
          })),
      }
    : task.product
  const reference_image_url = task.reference_image_path
    ? supabase.storage.from(TASK_REFERENCE_BUCKET).getPublicUrl(task.reference_image_path).data.publicUrl
    : null
  return { ...task, product, reference_image_url }
}

function safeFileName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return base || 'task-image'
}

export async function attachTaskReferenceImage(taskIds: string[], file: File) {
  if (!taskIds.length) return null
  if (!file.type.startsWith('image/')) throw new Error('Избраниот фајл не е слика.')
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) throw new Error('Сликата е поголема од 10 MB.')

  const path = `${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage.from(TASK_REFERENCE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase.from('tasks').update({ reference_image_path: path }).in('id', taskIds)
  if (updateError) {
    await supabase.storage.from(TASK_REFERENCE_BUCKET).remove([path])
    throw updateError
  }
  return path
}

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
  return ((data ?? []) as unknown as TaskWithRelations[]).map(withTaskImageUrls)
}

export async function getTask(id: string) {
  const { data, error } = await supabase.from('tasks').select(SELECT).eq('id', id).single()
  if (error) throw error
  return withTaskImageUrls(data as unknown as TaskWithRelations)
}

export interface AssignmentInput {
  title: string
  assignedTo: string
  deliverables: DeliverableDraft[]
  productId?: string | null
  marketId?: string | null
  dueDate?: string | null
  dueTime?: string | null
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
    p_due_time: input.dueTime ?? null,
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
  dueTime?: string | null
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
      const base = input.productName?.trim() || ''
      const fallback = describeDeliverables(deliverables) || 'Задача'
      // Market is intentionally NOT part of the title. It is a first-class field
      // rendered separately everywhere, so a long product name can never hide it.
      const title = `${base || fallback}${splitByDepartment ? ` · ${DEPARTMENT_TITLE[department]}` : ''}`
      created.push(await createAssignment({
        title,
        assignedTo: input.assignedTo,
        deliverables,
        productId: input.productId ?? null,
        marketId: market.id || null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
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
  return withTaskImageUrls(data as unknown as TaskWithRelations)
}

export async function updateTask(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status })
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
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

export async function setTaskResultFolderUrl(taskId: string, url: string | null) {
  const value = url?.trim()
  const normalized = value && !/^https?:\/\//i.test(value) ? `https://${value}` : value
  const { error } = await supabase.rpc('set_task_result_folder_url', {
    p_task_id: taskId,
    p_url: normalized || null,
  })
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
  return ((full ?? []) as unknown as TaskWithRelations[]).map(withTaskImageUrls)
}

export async function completeTask(taskId: string) {
  const { error } = await supabase.rpc('complete_task', { p_task_id: taskId })
  if (error) throw error
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
