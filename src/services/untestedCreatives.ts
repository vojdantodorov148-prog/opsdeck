import { supabase } from '@/lib/supabase'

export const UNTESTED_CREATIVES_BUCKET = 'untested-creatives'
const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024

export interface UntestedCreative {
  id: string
  product_id: string
  source_type: 'upload' | 'drive'
  storage_path: string | null
  external_url: string | null
  original_name: string | null
  mime_type: string | null
  file_size: number | null
  label: string | null
  added_by: string | null
  tested_by: string | null
  testing_started_at: string | null
  delete_after: string | null
  created_at: string
  updated_at: string
  preview_url?: string | null
}

function safeFileName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return clean || 'creative'
}

function assertDriveUrl(raw: string) {
  let url: URL
  try { url = new URL(raw.trim()) } catch { throw new Error('Внеси валиден Google Drive линк.') }
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Линкот мора да биде Google Drive линк.')
  }
  return url.toString()
}

async function withSignedUrls(rows: UntestedCreative[]) {
  return Promise.all(rows.map(async (row) => {
    if (row.source_type !== 'upload' || !row.storage_path) return { ...row, preview_url: null }
    const { data, error } = await supabase.storage.from(UNTESTED_CREATIVES_BUCKET).createSignedUrl(row.storage_path, 24 * 60 * 60)
    if (error) return { ...row, preview_url: null }
    return { ...row, preview_url: data.signedUrl }
  }))
}

export async function listUntestedCreatives(productId: string) {
  const { data, error } = await supabase
    .from('product_untested_creatives')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return withSignedUrls((data ?? []) as UntestedCreative[])
}

export async function uploadUntestedCreatives(productId: string, files: File[]) {
  const uploaded: Array<{ path: string; rowId?: string }> = []
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error(`„${file.name}“ не е слика или видео.`)
      }
      if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
        throw new Error(`„${file.name}“ е поголем од 50 MB. За поголеми фајлови користи Google Drive линк.`)
      }

      const path = `${productId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(UNTESTED_CREATIVES_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (uploadError) throw uploadError
      uploaded.push({ path })

      const { data: row, error: rowError } = await supabase
        .from('product_untested_creatives')
        .insert({
          product_id: productId,
          source_type: 'upload',
          storage_path: path,
          original_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          label: file.name,
        })
        .select('id')
        .single()
      if (rowError) throw rowError
      uploaded[uploaded.length - 1].rowId = row.id as string
    }
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from(UNTESTED_CREATIVES_BUCKET).remove(uploaded.map((item) => item.path))
      const ids = uploaded.flatMap((item) => item.rowId ? [item.rowId] : [])
      if (ids.length) await supabase.from('product_untested_creatives').delete().in('id', ids)
    }
    throw error
  }
}

export async function addUntestedDriveLink(productId: string, input: { url: string; label?: string }) {
  const url = assertDriveUrl(input.url)
  const { error } = await supabase.from('product_untested_creatives').insert({
    product_id: productId,
    source_type: 'drive',
    external_url: url,
    label: input.label?.trim() || 'Google Drive folder',
    original_name: input.label?.trim() || null,
  })
  if (error) throw error
}

export async function setUntestedCreativeTesting(id: string, testing: boolean) {
  if (testing) {
    const { data: current, error: readError } = await supabase
      .from('product_untested_creatives')
      .select('testing_started_at')
      .eq('id', id)
      .single()
    if (readError) throw readError
    if (current.testing_started_at) return

    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('product_untested_creatives').update({
      testing_started_at: new Date().toISOString(),
      tested_by: auth.user?.id ?? null,
    }).eq('id', id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('product_untested_creatives').update({
    testing_started_at: null,
    tested_by: null,
  }).eq('id', id)
  if (error) throw error
}

export async function deleteUntestedCreative(item: UntestedCreative) {
  if (item.source_type === 'upload' && item.storage_path) {
    const { error: storageError } = await supabase.storage.from(UNTESTED_CREATIVES_BUCKET).remove([item.storage_path])
    if (storageError) throw storageError
  }
  const { error } = await supabase.from('product_untested_creatives').delete().eq('id', item.id)
  if (error) throw error
}

export function subscribeUntestedCreatives(productId: string, onChange: () => void) {
  const channel = supabase
    .channel(`untested-creatives-${productId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'product_untested_creatives', filter: `product_id=eq.${productId}`,
    }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
