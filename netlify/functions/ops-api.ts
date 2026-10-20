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
  imageExtension,
  isRecord,
  isoDueAt,
  jsonResponse,
  numberField,
  optionalString,
  optionalUrl,
  parseJson,
  publicImageUrl,
  rejectUnknownFields,
  requiredString,
  reserveIdempotency,
  touchApiKey,
  uploadRemoteProductImages,
  deleteProductImages,
  PRODUCT_IMAGE_BUCKET,
  type ApiKeyContext,
  type ApiResult,
} from './_shared/ops-api'

const PRODUCT_BRANDS = ['Alpine', 'Origon', 'Ветерче', 'Vitagen'] as const
const TASK_STATUSES = ['todo', 'doing', 'blocked', 'review', 'done'] as const
const LANDING_TYPES = ['product_page', 'advertorial', 'listicle', 'quiz', 'landing_localization', 'other_landing'] as const
const CREATIVE_TYPES = ['static_ad', 'video_ad', 'ugc', 'creative_concept', 'image_variation', 'hook_variation', 'creative_localization', 'other_creative'] as const
const ALL_DELIVERABLE_TYPES = [...LANDING_TYPES, ...CREATIVE_TYPES] as const

function routePath(request: Request) {
  const url = new URL(request.url)
  let path = url.pathname
  path = path.replace(/^\/api\/v1\/?/, '/')
  path = path.replace(/^\/\.netlify\/functions\/ops-api\/?/, '/')
  if (!path.startsWith('/')) path = `/${path}`
  return { path: path.replace(/\/+$/, '') || '/', url }
}

function success(body: unknown, status = 200): ApiResult {
  return { status, body, result: 'ok' }
}

function notFound(entity = 'Resource') {
  return apiError(404, 'not_found', `${entity} not found.`)
}

function normalizeBrand(name: string) {
  return name.trim().toLowerCase()
}

async function resolveBrand(admin: SupabaseClient, brand: string) {
  const requested = PRODUCT_BRANDS.find((item) => normalizeBrand(item) === normalizeBrand(brand))
  if (!requested) return null
  const slugMap: Record<(typeof PRODUCT_BRANDS)[number], string> = {
    Alpine: 'alpine-patches', Origon: 'origon', 'Ветерче': 'veterce', Vitagen: 'vitagen',
  }
  const { data } = await admin.from('brands').select('id,name,slug').eq('slug', slugMap[requested]).maybeSingle()
  return data ? { ...data, apiName: requested } : null
}

async function resolveMarket(admin: SupabaseClient, value: string) {
  const clean = value.trim()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)
  if (uuid) {
    const { data } = await admin.from('markets').select('id,code,name,currency,active').eq('active', true).eq('id', clean).maybeSingle()
    return data ?? null
  }
  const { data: byCode } = await admin.from('markets').select('id,code,name,currency,active').eq('active', true).ilike('code', clean).limit(1).maybeSingle()
  if (byCode) return byCode
  const { data: byName } = await admin.from('markets').select('id,code,name,currency,active').eq('active', true).ilike('name', clean).limit(1).maybeSingle()
  return byName ?? null
}

async function resolveProfile(admin: SupabaseClient, id: string) {
  const { data } = await admin.from('profiles').select('id,full_name,active').eq('id', id).eq('active', true).maybeSingle()
  return data ?? null
}

function productDto(admin: SupabaseClient, row: Record<string, unknown>) {
  const brand = row.brand as { name?: string; slug?: string } | null
  const images = (row.images as Array<{ storage_path: string; sort_order: number }> | null) ?? []
  const links = (row.links as Array<{ id: string; label: string; url: string; sort_order: number }> | null) ?? []
  return {
    id: row.id,
    name: row.name,
    brand: brand?.slug === 'alpine-patches' ? 'Alpine'
      : brand?.slug === 'origon' ? 'Origon'
        : brand?.slug === 'veterce' ? 'Ветерче'
          : brand?.slug === 'vitagen' ? 'Vitagen'
            : brand?.name ?? null,
    sku: row.sku,
    price: row.selling_price,
    currency: row.currency,
    status: row.status,
    brief: row.brief,
    image_urls: [...images].sort((a, b) => a.sort_order - b.sort_order).map((image) => publicImageUrl(admin, image.storage_path)),
    main_link: row.main_url,
    links: [...links].sort((a, b) => a.sort_order - b.sort_order).map((link) => ({ id: link.id, label: link.label, url: link.url })),
  }
}

async function fetchProduct(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from('products')
    .select('id,name,sku,selling_price,currency,status,brief,main_url,brand_id,brand:brands(id,name,slug),images:product_images(id,storage_path,sort_order),links:product_links(id,label,url,sort_order)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Record<string, unknown> | null
}

function taskDueAt(row: Record<string, unknown>) {
  if (row.due_at) return row.due_at
  if (row.due_date && row.due_time) return `${row.due_date}T${String(row.due_time).slice(0, 8)}`
  return null
}

function taskSummary(row: Record<string, unknown>) {
  const product = row.product as { id?: string; name?: string } | null
  const market = row.market as { id?: string; code?: string; name?: string } | null
  const assignee = row.assignee as { id?: string; full_name?: string } | null
  return {
    id: row.id,
    title: row.title,
    product: product ? { id: product.id, name: product.name } : null,
    market: market ? { id: market.id, code: market.code, name: market.name } : null,
    category: row.department === 'creative' ? 'creatives' : row.department,
    assignee: assignee ? { id: assignee.id, name: assignee.full_name } : null,
    status: row.status,
    due_at: taskDueAt(row),
    note: row.description,
    result_folder_url: row.result_folder_url ?? null,
    created_at: row.created_at,
    completed_at: row.completed_at ?? null,
  }
}

async function fetchTask(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from('tasks')
    .select('*, product:products(id,name,sku,main_url), market:markets(id,code,name), assignee:profiles!tasks_assigned_to_fkey(id,full_name), creator:profiles!tasks_created_by_fkey(id,full_name), deliverables:task_deliverables(id,type,quantity,completed_quantity,status,url,notes,sort_order,angle_title,angle_body,ad_headline), comments:task_comments(id,content,created_at,user_id,author:profiles!task_comments_user_id_fkey(id,full_name))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Record<string, unknown> | null
}

function taskDetail(row: Record<string, unknown>) {
  const base = taskSummary(row)
  const deliverables = ((row.deliverables as Array<Record<string, unknown>>) ?? []).sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
  const comments = ((row.comments as Array<Record<string, unknown>>) ?? []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  return {
    ...base,
    created_by: row.creator ?? null,
    deliverables: deliverables.map((item) => ({
      id: item.id,
      type: item.type,
      count: item.quantity,
      completed_count: item.completed_quantity,
      status: item.status,
      link: item.url,
      note: item.notes,
      angle: item.angle_title || item.angle_body ? { title: item.angle_title, body: item.angle_body } : null,
      ad_headline: item.ad_headline ?? null,
    })),
    links: {
      result_folder_url: row.result_folder_url ?? null,
      deliverables: deliverables.filter((item) => item.url).map((item) => ({ deliverable_id: item.id, url: item.url })),
    },
    comments: comments.map((item) => {
      const author = item.author as { id?: string; full_name?: string } | null
      return { id: item.id, text: item.content, created_at: item.created_at, author: author ? { id: author.id, name: author.full_name } : null }
    }),
  }
}

async function listProducts(admin: SupabaseClient, url: URL): Promise<ApiResult> {
  const search = (url.searchParams.get('search') || '').trim()
  const brandFilter = (url.searchParams.get('brand') || '').trim()
  let brandId: string | null = null
  if (brandFilter) {
    const brand = await resolveBrand(admin, brandFilter)
    if (!brand) return apiError(400, 'validation_error', 'Invalid brand filter.', { brand: `Use one of: ${PRODUCT_BRANDS.join(', ')}` })
    brandId = brand.id as string
  }
  let query = admin
    .from('products')
    .select('id,name,sku,selling_price,currency,status,brief,main_url,brand_id,brand:brands(id,name,slug),images:product_images(id,storage_path,sort_order),links:product_links(id,label,url,sort_order)')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(500)
  if (brandId) query = query.eq('brand_id', brandId)
  if (search) query = query.or(`name.ilike.%${search.replace(/[,()]/g, ' ')}%,sku.ilike.%${search.replace(/[,()]/g, ' ')}%`)
  const { data, error } = await query
  if (error) throw error
  return success((data ?? []).map((row) => productDto(admin, row as unknown as Record<string, unknown>)))
}

async function getProduct(admin: SupabaseClient, id: string): Promise<ApiResult> {
  const row = await fetchProduct(admin, id)
  return row ? success(productDto(admin, row)) : notFound('Product')
}

function parseImageUrls(value: unknown, field: string, errors: Record<string, string>, required = false) {
  if (value == null) {
    if (required) errors[field] = 'Required array with at least one image URL.'
    return [] as string[]
  }
  if (!Array.isArray(value) || (required && value.length < 1) || value.length > 12) {
    errors[field] = required ? 'Must be an array with 1-12 image URLs.' : 'Must be an array with up to 12 image URLs.'
    return [] as string[]
  }
  const urls: string[] = []
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== 'string') { errors[`${field}[${i}]`] = 'Must be a URL string.'; continue }
    try {
      const url = new URL(value[i])
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
      urls.push(url.toString())
    } catch { errors[`${field}[${i}]`] = 'Must be a valid http(s) URL.' }
  }
  return urls
}

async function createProduct(admin: SupabaseClient, body: unknown): Promise<ApiResult> {
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const allowed = ['name', 'brand', 'price', 'currency', 'sku', 'brief', 'main_link', 'image_urls']
  const unknown = rejectUnknownFields(body, allowed)
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  const errors: Record<string, string> = {}
  const name = requiredString(body.name, 'name', errors, 240)
  const brandName = requiredString(body.brand, 'brand', errors, 50)
  const price = numberField(body.price, 'price', errors, { required: true, min: 0 })
  const currency = requiredString(body.currency, 'currency', errors, 8)?.toUpperCase() ?? null
  if (currency && !/^[A-Z]{3,8}$/.test(currency)) errors.currency = 'Use an uppercase currency code such as EUR or MKD.'
  const sku = optionalString(body.sku, 'sku', errors, 120)
  const brief = requiredString(body.brief, 'brief', errors, 50000)
  const mainLink = optionalUrl(body.main_link, 'main_link', errors)
  const imageUrls = parseImageUrls(body.image_urls, 'image_urls', errors, true)
  const brand = brandName ? await resolveBrand(admin, brandName) : null
  if (brandName && !brand) errors.brand = `Use one of: ${PRODUCT_BRANDS.join(', ')}`
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Validation failed.', errors)
  const productCurrency = (brand?.slug === 'veterce' ? 'MKD' : currency) as string

  const productId = crypto.randomUUID()
  const uploaded: Array<{ path: string; rowId: string }> = []
  try {
    const { error } = await admin.from('products').insert({
      id: productId,
      name,
      brand_id: brand!.id,
      selling_price: price,
      currency: productCurrency,
      sku,
      brief,
      main_url: mainLink,
      status: 'research',
    })
    if (error) throw error
    uploaded.push(...await uploadRemoteProductImages(admin, productId, imageUrls))
    const created = await fetchProduct(admin, productId)
    return success(productDto(admin, created!), 201)
  } catch (error) {
    if (uploaded.length) {
      await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove(uploaded.map((item) => item.path))
    }
    await admin.from('products').delete().eq('id', productId)
    const message = error instanceof Error ? error.message : 'Product creation failed.'
    return apiError(400, 'image_or_product_error', message, { image_urls: message })
  }
}

async function patchProduct(admin: SupabaseClient, id: string, body: unknown): Promise<ApiResult> {
  const existing = await fetchProduct(admin, id)
  if (!existing) return notFound('Product')
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const allowed = ['name', 'brief', 'main_link', 'image_urls', 'links']
  const unknown = rejectUnknownFields(body, allowed)
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  const errors: Record<string, string> = {}
  const patch: Record<string, unknown> = {}
  if ('name' in body) patch.name = requiredString(body.name, 'name', errors, 240)
  if ('brief' in body) patch.brief = requiredString(body.brief, 'brief', errors, 50000)
  if ('main_link' in body) patch.main_url = optionalUrl(body.main_link, 'main_link', errors)
  const imageUrls = 'image_urls' in body ? parseImageUrls(body.image_urls, 'image_urls', errors, true) : null
  let links: Array<{ label: string; url: string }> | null = null
  if ('links' in body) {
    if (!Array.isArray(body.links) || body.links.length > 30) errors.links = 'Must be an array with up to 30 links.'
    else {
      links = []
      body.links.forEach((item, index) => {
        if (!isRecord(item)) { errors[`links[${index}]`] = 'Must be an object.'; return }
        const extras = rejectUnknownFields(item, ['label', 'url'])
        if (extras) { errors[`links[${index}]`] = `Unknown fields: ${extras.join(', ')}`; return }
        const label = requiredString(item.label, `links[${index}].label`, errors, 120)
        const url = optionalUrl(item.url, `links[${index}].url`, errors)
        if (label && url) links!.push({ label, url })
      })
    }
  }
  if (!Object.keys(body).length) errors.body = 'At least one editable field is required.'
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Validation failed.', errors)

  let newImages: Array<{ path: string; rowId: string }> = []
  try {
    if (imageUrls) newImages = await uploadRemoteProductImages(admin, id, imageUrls, 1000)
    if (Object.keys(patch).length) {
      const { error } = await admin.from('products').update(patch).eq('id', id)
      if (error) throw error
    }
    if (links) {
      const { error: deleteError } = await admin.from('product_links').delete().eq('product_id', id)
      if (deleteError) throw deleteError
      if (links.length) {
        const { error: insertError } = await admin.from('product_links').insert(links.map((link, index) => ({ product_id: id, ...link, sort_order: index })))
        if (insertError) throw insertError
      }
    }
    if (imageUrls) {
      const oldImages = ((existing.images as Array<{ id: string; storage_path: string }>) ?? [])
      // Normalize new image order before old rows are removed.
      for (let i = 0; i < newImages.length; i += 1) {
        await admin.from('product_images').update({ sort_order: i }).eq('id', newImages[i].rowId)
      }
      await deleteProductImages(admin, oldImages)
    }
    const updated = await fetchProduct(admin, id)
    return success(productDto(admin, updated!))
  } catch (error) {
    if (newImages.length) {
      await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove(newImages.map((item) => item.path))
      await admin.from('product_images').delete().in('id', newImages.map((item) => item.rowId))
    }
    const message = error instanceof Error ? error.message : 'Product update failed.'
    return apiError(400, 'product_update_error', message)
  }
}

async function listTeam(admin: SupabaseClient): Promise<ApiResult> {
  const { data, error } = await admin.from('profiles').select('id,full_name').eq('active', true).order('full_name')
  if (error) throw error
  return success((data ?? []).map((member) => ({ id: member.id, name: member.full_name })))
}

async function listTasks(admin: SupabaseClient, url: URL): Promise<ApiResult> {
  let query = admin
    .from('tasks')
    .select('id,title,description,department,status,due_date,due_time,due_at,result_folder_url,created_at,completed_at,product:products(id,name),market:markets(id,code,name),assignee:profiles!tasks_assigned_to_fkey(id,full_name)')
    .order('created_at', { ascending: false })
    .limit(500)

  const assignee = (url.searchParams.get('assignee') || '').trim()
  const product = (url.searchParams.get('product') || '').trim()
  const market = (url.searchParams.get('market') || '').trim()
  const status = (url.searchParams.get('status') || '').trim()
  const category = (url.searchParams.get('category') || '').trim()
  const errors: Record<string, string> = {}

  if (assignee) {
    const profile = await resolveProfile(admin, assignee)
    if (!profile) errors.assignee = 'Use an active team member ID.'
    else query = query.eq('assigned_to', profile.id)
  }
  if (product) {
    const { data: productRow } = await admin.from('products').select('id').eq('id', product).maybeSingle()
    if (!productRow) errors.product = 'Use a valid product ID.'
    else query = query.eq('product_id', productRow.id)
  }
  if (market) {
    const marketRow = await resolveMarket(admin, market)
    if (!marketRow) errors.market = 'Use a market ID, code, or exact name.'
    else query = query.eq('market_id', marketRow.id)
  }
  if (status) {
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) errors.status = `Use one of: ${TASK_STATUSES.join(', ')}`
    else query = query.eq('status', status)
  }
  if (category) {
    if (!['landing', 'creatives'].includes(category)) errors.category = 'Use landing or creatives.'
    else query = query.eq('department', category === 'creatives' ? 'creative' : 'landing')
  }
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Invalid task filters.', errors)
  const { data, error } = await query
  if (error) throw error
  return success((data ?? []).map((row) => taskSummary(row as unknown as Record<string, unknown>)))
}

async function getTask(admin: SupabaseClient, id: string): Promise<ApiResult> {
  const row = await fetchTask(admin, id)
  return row ? success(taskDetail(row)) : notFound('Task')
}

async function createTask(admin: SupabaseClient, ctx: ApiKeyContext, body: unknown): Promise<ApiResult> {
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const allowed = ['product_id', 'market', 'category', 'assignee_id', 'deliverables', 'due_at', 'note']
  const unknown = rejectUnknownFields(body, allowed)
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  const errors: Record<string, string> = {}
  const productId = requiredString(body.product_id, 'product_id', errors, 80)
  const marketValue = requiredString(body.market, 'market', errors, 120)
  const category = requiredString(body.category, 'category', errors, 20)
  const assigneeId = requiredString(body.assignee_id, 'assignee_id', errors, 80)
  const dueAt = isoDueAt(body.due_at, 'due_at', errors)
  const note = optionalString(body.note, 'note', errors, 50000)
  if (category && !['landing', 'creatives'].includes(category)) errors.category = 'Use landing or creatives.'

  const { data: product } = productId ? await admin.from('products').select('id,name').eq('id', productId).maybeSingle() : { data: null }
  if (productId && !product) errors.product_id = 'Product not found.'
  const market = marketValue ? await resolveMarket(admin, marketValue) : null
  if (marketValue && !market) errors.market = 'Market not found. Use an ID, code, or exact name.'
  const assignee = assigneeId ? await resolveProfile(admin, assigneeId) : null
  if (assigneeId && !assignee) errors.assignee_id = 'Active team member not found.'

  const deliverables: Array<{ type: string; count: number }> = []
  if (!Array.isArray(body.deliverables) || !body.deliverables.length || body.deliverables.length > 50) {
    errors.deliverables = 'Must contain 1-50 deliverables.'
  } else {
    body.deliverables.forEach((item, index) => {
      if (!isRecord(item)) { errors[`deliverables[${index}]`] = 'Must be an object.'; return }
      const extras = rejectUnknownFields(item, ['type', 'count'])
      if (extras) { errors[`deliverables[${index}]`] = `Unknown fields: ${extras.join(', ')}`; return }
      const type = typeof item.type === 'string' ? item.type : ''
      const count = typeof item.count === 'number' && Number.isInteger(item.count) ? item.count : NaN
      if (!ALL_DELIVERABLE_TYPES.includes(type as (typeof ALL_DELIVERABLE_TYPES)[number])) errors[`deliverables[${index}].type`] = `Unsupported type.`
      if (!Number.isFinite(count) || count < 1 || count > 100) errors[`deliverables[${index}].count`] = 'Must be an integer from 1 to 100.'
      if (category === 'landing' && !LANDING_TYPES.includes(type as (typeof LANDING_TYPES)[number])) errors[`deliverables[${index}].type`] = 'This type does not belong to landing.'
      if (category === 'creatives' && !CREATIVE_TYPES.includes(type as (typeof CREATIVE_TYPES)[number])) errors[`deliverables[${index}].type`] = 'This type does not belong to creatives.'
      if (!errors[`deliverables[${index}].type`] && !errors[`deliverables[${index}].count`]) deliverables.push({ type, count })
    })
  }
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Validation failed.', errors)

  const taskId = crypto.randomUUID()
  const department = category === 'creatives' ? 'creative' : 'landing'
  const { error: taskError } = await admin.from('tasks').insert({
    id: taskId,
    title: product!.name,
    description: note,
    created_by: ctx.userId,
    assigned_to: assignee!.id,
    product_id: product!.id,
    market_id: market!.id,
    department,
    status: 'todo',
    due_date: dueAt!.dueDate,
    due_time: dueAt!.dueTime,
    due_at: dueAt!.canonical,
    source: 'quick_action',
  })
  if (taskError) throw taskError
  const { error: deliverableError } = await admin.from('task_deliverables').insert(deliverables.map((item, index) => ({
    task_id: taskId, type: item.type, quantity: item.count, sort_order: index,
  })))
  if (deliverableError) {
    await admin.from('tasks').delete().eq('id', taskId)
    throw deliverableError
  }
  const created = await fetchTask(admin, taskId)
  return success(taskDetail(created!), 201)
}

async function patchTask(admin: SupabaseClient, id: string, body: unknown): Promise<ApiResult> {
  const existing = await fetchTask(admin, id)
  if (!existing) return notFound('Task')
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const allowed = ['status', 'assignee_id', 'deliverable_links', 'result_folder_url']
  const unknown = rejectUnknownFields(body, allowed)
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  const errors: Record<string, string> = {}
  const patch: Record<string, unknown> = {}
  if ('status' in body) {
    if (typeof body.status !== 'string' || !TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) errors.status = `Use one of: ${TASK_STATUSES.join(', ')}`
    else patch.status = body.status
  }
  if ('assignee_id' in body) {
    if (typeof body.assignee_id !== 'string') errors.assignee_id = 'Must be a team member ID.'
    else {
      const profile = await resolveProfile(admin, body.assignee_id)
      if (!profile) errors.assignee_id = 'Active team member not found.'
      else patch.assigned_to = profile.id
    }
  }
  if ('result_folder_url' in body) patch.result_folder_url = optionalUrl(body.result_folder_url, 'result_folder_url', errors)

  const linkUpdates: Array<{ id: string; url: string | null }> = []
  if ('deliverable_links' in body) {
    if (!Array.isArray(body.deliverable_links) || body.deliverable_links.length > 100) errors.deliverable_links = 'Must be an array with up to 100 link updates.'
    else {
      const validIds = new Set(((existing.deliverables as Array<Record<string, unknown>>) ?? []).map((item) => String(item.id)))
      body.deliverable_links.forEach((item, index) => {
        if (!isRecord(item)) { errors[`deliverable_links[${index}]`] = 'Must be an object.'; return }
        const extras = rejectUnknownFields(item, ['deliverable_id', 'url'])
        if (extras) { errors[`deliverable_links[${index}]`] = `Unknown fields: ${extras.join(', ')}`; return }
        if (typeof item.deliverable_id !== 'string' || !validIds.has(item.deliverable_id)) { errors[`deliverable_links[${index}].deliverable_id`] = 'Deliverable does not belong to this task.'; return }
        const url = optionalUrl(item.url, `deliverable_links[${index}].url`, errors)
        if (!errors[`deliverable_links[${index}].url`]) linkUpdates.push({ id: item.deliverable_id, url })
      })
    }
  }
  if (!Object.keys(body).length) errors.body = 'At least one editable field is required.'
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Validation failed.', errors)

  if (Object.keys(patch).length) {
    const { error } = await admin.from('tasks').update(patch).eq('id', id)
    if (error) throw error
  }
  for (const item of linkUpdates) {
    const { error } = await admin.from('task_deliverables').update({ url: item.url }).eq('id', item.id).eq('task_id', id)
    if (error) throw error
  }
  const updated = await fetchTask(admin, id)
  return success(taskDetail(updated!))
}

async function addComment(admin: SupabaseClient, ctx: ApiKeyContext, taskId: string, body: unknown): Promise<ApiResult> {
  const task = await fetchTask(admin, taskId)
  if (!task) return notFound('Task')
  if (!isRecord(body)) return apiError(400, 'validation_error', 'JSON object expected.', { body: 'Must be an object.' })
  const unknown = rejectUnknownFields(body, ['text'])
  if (unknown) return apiError(400, 'validation_error', 'Unknown fields.', Object.fromEntries(unknown.map((key) => [key, 'Unknown field.'])))
  const errors: Record<string, string> = {}
  const text = requiredString(body.text, 'text', errors, 10000)
  if (Object.keys(errors).length) return apiError(400, 'validation_error', 'Validation failed.', errors)
  const { data, error } = await admin.from('task_comments').insert({ task_id: taskId, user_id: ctx.userId, content: text }).select('id,content,created_at').single()
  if (error) throw error
  return success({ id: data.id, text: data.content, created_at: data.created_at, author: { id: ctx.userId, name: ctx.userName } }, 201)
}

async function dispatch(admin: SupabaseClient, ctx: ApiKeyContext, method: string, path: string, url: URL, body: unknown): Promise<ApiResult> {
  const productMatch = path.match(/^\/products\/([0-9a-f-]+)$/i)
  const taskMatch = path.match(/^\/tasks\/([0-9a-f-]+)$/i)
  const commentMatch = path.match(/^\/tasks\/([0-9a-f-]+)\/comments$/i)

  if (method === 'GET') {
    if (!hasScope(ctx, 'read')) return apiError(403, 'forbidden', 'This API key does not have the read scope.')
    if (path === '/products') return listProducts(admin, url)
    if (productMatch) return getProduct(admin, productMatch[1])
    if (path === '/team') return listTeam(admin)
    if (path === '/tasks') return listTasks(admin, url)
    if (taskMatch) return getTask(admin, taskMatch[1])
  }

  if (method === 'POST' && path === '/products') {
    if (!hasScope(ctx, 'write:products')) return apiError(403, 'forbidden', 'This API key does not have write:products.')
    return createProduct(admin, body)
  }
  if (method === 'PATCH' && productMatch) {
    if (!hasScope(ctx, 'write:products')) return apiError(403, 'forbidden', 'This API key does not have write:products.')
    return patchProduct(admin, productMatch[1], body)
  }
  if (method === 'POST' && path === '/tasks') {
    if (!hasScope(ctx, 'write:tasks')) return apiError(403, 'forbidden', 'This API key does not have write:tasks.')
    return createTask(admin, ctx, body)
  }
  if (method === 'PATCH' && taskMatch) {
    if (!hasScope(ctx, 'write:tasks')) return apiError(403, 'forbidden', 'This API key does not have write:tasks.')
    return patchTask(admin, taskMatch[1], body)
  }
  if (method === 'POST' && commentMatch) {
    if (!hasScope(ctx, 'write:comments')) return apiError(403, 'forbidden', 'This API key does not have write:comments.')
    return addComment(admin, ctx, commentMatch[1], body)
  }

  if (method === 'DELETE') return apiError(405, 'method_not_allowed', 'DELETE endpoints are intentionally disabled.')
  return apiError(404, 'not_found', 'API endpoint not found.')
}

export default async (request: Request) => {
  const started = Date.now()
  const requestId = apiRequestId()
  const admin = adminClient()
  const { path, url } = routePath(request)
  const method = request.method.toUpperCase()
  const endpoint = `${path}${url.search}`
  let ctx: ApiKeyContext | null = null
  let result: ApiResult
  let reservation = null as Awaited<ReturnType<typeof reserveIdempotency>>['reservation']

  try {
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
    else {
      if (method === 'POST') {
        const idem = await reserveIdempotency(admin, ctx, {
          idempotencyKey: request.headers.get('idempotency-key'), method, endpoint: path, rawBody,
        })
        if (idem.replay) result = idem.replay
        else {
          reservation = idem.reservation
          result = await dispatch(admin, ctx, method, path, url, parsed.value)
          await completeIdempotency(admin, reservation ?? null, result)
        }
      } else result = await dispatch(admin, ctx, method, path, url, parsed.value)
    }
  } catch (error) {
    if (reservation) await admin.from('api_idempotency').delete().eq('id', reservation.rowId)
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    result = apiError(500, 'internal_error', message)
  }

  try {
    await auditApiCall(admin, { ctx, method, endpoint, status: result.status, result: result.result || (result.status < 400 ? 'ok' : 'error'), requestId, durationMs: Date.now() - started })
  } catch { /* audit failure must not hide the API response */ }

  const body = isRecord(result.body) ? { ...result.body, request_id: requestId } : { data: result.body, request_id: requestId }
  return jsonResponse(result.status, body, result.headers)
}
