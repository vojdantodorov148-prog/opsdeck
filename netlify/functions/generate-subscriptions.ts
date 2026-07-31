import { createClient } from '@supabase/supabase-js'

export default async () => {
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    return new Response('Missing Supabase server environment variables.', { status: 500 })
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const { data, error } = await admin.rpc('generate_subscription_transactions', { p_month: month })
  if (error) return new Response(error.message, { status: 500 })
  return Response.json({ generated: data ?? 0 })
}

