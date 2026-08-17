import { supabase } from '@/lib/supabase'
import type { BrandDocument } from '@/types/db'

export async function listBrandDocuments(brandId?: string) {
  let query = supabase
    .from('brand_documents')
    .select('*, brand:brands(id,name,logo_url), uploader:profiles(id,full_name,avatar_url)')
    .order('created_at', { ascending: false })
  if (brandId) query = query.eq('brand_id', brandId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as BrandDocument[]
}

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').toLowerCase()
}

export async function uploadBrandDocument(args: {
  brandId: string
  userId: string
  file: File
  category: string
  displayName?: string
  notes?: string
}) {
  const path = `${args.brandId}/${Date.now()}-${safeFileName(args.file.name)}`
  const { error: uploadError } = await supabase.storage
    .from('brand-drive')
    .upload(path, args.file, { contentType: args.file.type || undefined, upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.from('brand_documents').insert({
    brand_id: args.brandId,
    uploaded_by: args.userId,
    name: args.displayName?.trim() || args.file.name,
    storage_path: path,
    mime_type: args.file.type || null,
    file_size: args.file.size,
    category: args.category,
    notes: args.notes?.trim() || null,
  }).select().single()

  if (error) {
    await supabase.storage.from('brand-drive').remove([path])
    throw error
  }
  return data as BrandDocument
}

export async function getBrandDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from('brand-drive').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteBrandDocument(document: Pick<BrandDocument, 'id' | 'storage_path'>) {
  const { error: storageError } = await supabase.storage.from('brand-drive').remove([document.storage_path])
  if (storageError) throw storageError
  const { error } = await supabase.from('brand_documents').delete().eq('id', document.id)
  if (error) throw error
}
