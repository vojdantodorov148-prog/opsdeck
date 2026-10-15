import { safeTokenEquals } from './_shared/ops-api'

const TOOLS = [
  {
    name: 'list_products',
    description: 'List Ops Deck products. Optionally filter by search text or brand.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        search: { type: 'string', maxLength: 240 },
        brand: { type: 'string', enum: ['Alpine', 'Origon', 'Ветерче', 'Vitagen'] },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Get one product by Ops Deck product ID.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1 } } },
  },
  {
    name: 'create_product',
    description: 'Create one product and download its image URLs into Ops Deck storage.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      required: ['name', 'brand', 'price', 'currency', 'brief', 'image_urls'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 240 },
        brand: { type: 'string', enum: ['Alpine', 'Origon', 'Ветерче', 'Vitagen'] },
        price: { type: 'number', minimum: 0 },
        currency: { type: 'string', pattern: '^[A-Za-z]{3,8}$' },
        sku: { type: ['string', 'null'], maxLength: 120 },
        brief: { type: 'string', minLength: 1, maxLength: 50000 },
        main_link: { type: ['string', 'null'], maxLength: 4000 },
        image_urls: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1 } },
        idempotency_key: { type: 'string', maxLength: 200, description: 'Stable key to make retries safe.' },
      },
    },
  },
  {
    name: 'update_product',
    description: 'Update product name, brief, main link, links, and/or replace its images.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['id'],
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1, maxLength: 240 },
        brief: { type: 'string', minLength: 1, maxLength: 50000 },
        main_link: { type: ['string', 'null'], maxLength: 4000 },
        image_urls: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1 } },
        links: { type: 'array', maxItems: 30, items: { type: 'object', additionalProperties: false, required: ['label', 'url'], properties: { label: { type: 'string', minLength: 1, maxLength: 120 }, url: { type: 'string', minLength: 1, maxLength: 4000 } } } },
      },
    },
  },
  {
    name: 'list_team',
    description: 'List active Ops Deck team members with IDs and names.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'list_tasks',
    description: 'List tasks with optional filters for assignee, product, market, status, or category.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        assignee: { type: 'string', description: 'Team member ID.' },
        product: { type: 'string', description: 'Product ID.' },
        market: { type: 'string', description: 'Market ID, code, or exact name.' },
        status: { type: 'string', enum: ['todo', 'doing', 'blocked', 'review', 'done'] },
        category: { type: 'string', enum: ['landing', 'creatives'] },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get one task including note, comments, deliverables, and finished-work links.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1 } } },
  },
  {
    name: 'create_task',
    description: 'Create exactly one Ops Deck task for a product, market, assignee, and category.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      required: ['product_id', 'market', 'category', 'assignee_id', 'deliverables', 'due_at'],
      properties: {
        product_id: { type: 'string', minLength: 1 },
        market: { type: 'string', minLength: 1 },
        category: { type: 'string', enum: ['landing', 'creatives'] },
        assignee_id: { type: 'string', minLength: 1 },
        deliverables: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', additionalProperties: false, required: ['type', 'count'], properties: { type: { type: 'string' }, count: { type: 'integer', minimum: 1, maximum: 100 } } } },
        due_at: { type: 'string', description: 'ISO 8601 timestamp including Z or timezone offset.' },
        note: { type: ['string', 'null'], maxLength: 50000 },
        idempotency_key: { type: 'string', maxLength: 200, description: 'Stable key to make retries safe.' },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Update task status, assignee, deliverable links, or the creative result-folder link.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['id'],
      properties: {
        id: { type: 'string', minLength: 1 },
        status: { type: 'string', enum: ['todo', 'doing', 'blocked', 'review', 'done'] },
        assignee_id: { type: 'string', minLength: 1 },
        result_folder_url: { type: ['string', 'null'], maxLength: 4000 },
        deliverable_links: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['deliverable_id', 'url'], properties: { deliverable_id: { type: 'string', minLength: 1 }, url: { type: ['string', 'null'], maxLength: 4000 } } } },
      },
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a task. The author is the Ops Deck user attached to the API key.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['task_id', 'text'],
      properties: {
        task_id: { type: 'string', minLength: 1 },
        text: { type: 'string', minLength: 1, maxLength: 10000 },
        idempotency_key: { type: 'string', maxLength: 200, description: 'Stable key to make retries safe.' },
      },
    },
  },
] as const

type JsonRpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown }

function rpcResult(id: JsonRpc['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function rpcError(id: JsonRpc['id'], code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }
}

function bearer(request: Request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

function mcpBase(request: Request) {
  return process.env.DEPLOY_PRIME_URL || process.env.URL || new URL(request.url).origin
}

async function apiCall(request: Request, method: string, path: string, body?: Record<string, unknown>, idempotencyKey?: string) {
  const apiKey = process.env.OPS_DECK_API_KEY
  if (!apiKey) throw new Error('OPS_DECK_API_KEY is not configured for the MCP server.')
  const response = await fetch(`${mcpBase(request)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const raw = await response.text()
  let data: unknown = raw
  try { data = raw ? JSON.parse(raw) : null } catch { /* keep text */ }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? JSON.stringify(data)
      : `Ops Deck API returned HTTP ${response.status}: ${raw}`
    throw new Error(message)
  }
  return data
}

function qs(params: Record<string, unknown>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

async function callTool(request: Request, name: string, args: Record<string, unknown>) {
  let data: unknown
  switch (name) {
    case 'list_products':
      data = await apiCall(request, 'GET', `/api/v1/products${qs({ search: args.search, brand: args.brand })}`)
      break
    case 'get_product':
      data = await apiCall(request, 'GET', `/api/v1/products/${encodeURIComponent(String(args.id || ''))}`)
      break
    case 'create_product': {
      const { idempotency_key, ...body } = args
      data = await apiCall(request, 'POST', '/api/v1/products', body, typeof idempotency_key === 'string' ? idempotency_key : undefined)
      break
    }
    case 'update_product': {
      const { id, ...body } = args
      data = await apiCall(request, 'PATCH', `/api/v1/products/${encodeURIComponent(String(id || ''))}`, body)
      break
    }
    case 'list_team':
      data = await apiCall(request, 'GET', '/api/v1/team')
      break
    case 'list_tasks':
      data = await apiCall(request, 'GET', `/api/v1/tasks${qs(args)}`)
      break
    case 'get_task':
      data = await apiCall(request, 'GET', `/api/v1/tasks/${encodeURIComponent(String(args.id || ''))}`)
      break
    case 'create_task': {
      const { idempotency_key, ...body } = args
      data = await apiCall(request, 'POST', '/api/v1/tasks', body, typeof idempotency_key === 'string' ? idempotency_key : undefined)
      break
    }
    case 'update_task': {
      const { id, ...body } = args
      data = await apiCall(request, 'PATCH', `/api/v1/tasks/${encodeURIComponent(String(id || ''))}`, body)
      break
    }
    case 'add_comment': {
      const { task_id, idempotency_key, ...body } = args
      data = await apiCall(request, 'POST', `/api/v1/tasks/${encodeURIComponent(String(task_id || ''))}/comments`, body, typeof idempotency_key === 'string' ? idempotency_key : undefined)
      break
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

async function handleMessage(request: Request, message: JsonRpc) {
  const id = message.id
  if (message.method === 'initialize') {
    const requested = (message.params as { protocolVersion?: string } | undefined)?.protocolVersion
    const supported = requested === '2026-07-28' ? '2026-07-28' : '2025-11-25'
    return rpcResult(id, {
      protocolVersion: supported,
      capabilities: { tools: {} },
      serverInfo: { name: 'ops-deck', version: '1.0.0' },
    })
  }
  if (message.method === 'notifications/initialized') return null
  if (message.method === 'ping') return rpcResult(id, {})
  if (message.method === 'tools/list') return rpcResult(id, { tools: TOOLS })
  if (message.method === 'tools/call') {
    const params = message.params as { name?: string; arguments?: unknown } | undefined
    if (!params?.name) return rpcError(id, -32602, 'Missing tool name.')
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {}
    try {
      return rpcResult(id, await callTool(request, params.name, args))
    } catch (error) {
      return rpcResult(id, {
        content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool call failed.' }],
        isError: true,
      })
    }
  }
  return rpcError(id, -32601, `Method not found: ${message.method || '(missing)'}`)
}

export default async (request: Request) => {
  const mcpToken = process.env.OPS_DECK_MCP_TOKEN
  if (!mcpToken) return new Response('MCP is not configured.', { status: 503 })
  const supplied = bearer(request)
  if (!supplied || !safeTokenEquals(supplied, mcpToken)) return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })

  if (request.method === 'GET') {
    return new Response('This stateless MCP endpoint accepts Streamable HTTP POST requests.', { status: 405, headers: { Allow: 'POST' } })
  }
  if (request.method !== 'POST') return new Response('Method not allowed.', { status: 405, headers: { Allow: 'POST' } })

  let payload: unknown
  try { payload = await request.json() } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'Parse error.')), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const messages = Array.isArray(payload) ? payload : [payload]
  const responses = [] as unknown[]
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      responses.push(rpcError(null, -32600, 'Invalid Request.'))
      continue
    }
    const response = await handleMessage(request, raw as JsonRpc)
    if (response) responses.push(response)
  }

  if (!responses.length) return new Response(null, { status: 202 })
  return new Response(JSON.stringify(Array.isArray(payload) ? responses : responses[0]), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
