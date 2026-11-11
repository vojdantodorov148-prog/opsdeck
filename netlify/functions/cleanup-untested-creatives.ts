import { createClient } from '@supabase/supabase-js'

const BUCKET = 'untested-creatives'

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return new Response('Missing Supabase server environment variables.', { status: 500 })

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const now = new Date().toISOString()
  const { data: rows, error } = await admin
    .from('product_untested_creatives')
    .select('id,source_type,storage_path')
    .not('delete_after', 'is', null)
    .lte('delete_after', now)
    .order('delete_after', { ascending: true })
    .limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let deleted = 0
  const failures: Array<{ id: string; error: string }> = []
  for (const row of rows ?? []) {
    try {
      if (row.source_type === 'upload' && row.storage_path) {
        const { error: storageError } = await admin.storage.from(BUCKET).remove([row.storage_path])
        if (storageError) throw storageError
      }
      const { error: rowError } = await admin.from('product_untested_creatives').delete().eq('id', row.id)
      if (rowError) throw rowError
      deleted += 1
    } catch (cleanupError) {
      failures.push({ id: row.id as string, error: cleanupError instanceof Error ? cleanupError.message : 'Cleanup failed.' })
    }
  }

  return Response.json({ checked: rows?.length ?? 0, deleted, failures })
}
