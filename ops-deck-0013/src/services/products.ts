import { supabase } from '@/lib/supabase'
import type { Product, ProductAngle, ProductImage, ProductMarketTest, TestStatus } from '@/types/db'

export type ProductWithRelations = Product & {
  brand: { id: string; name: string; slug: string } | null
  images: ProductImage[]
  angles?: ProductAngle[]
  links?: { id: string; label: string; url: string }[]
}

export interface ProductAngleInput {
  id?: string
  title: string
  body: string
}

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function withPublicImageUrls<T extends { images?: ProductImage[] }>(product: T): T {
  if (!product.images) return product
  const images = [...product.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      ...image,
      public_url: supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(image.storage_path).data.publicUrl,
    }))
  return { ...product, images }
}

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id,name,slug), images:product_images(id,product_id,storage_path,alt_text,sort_order,created_at)')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as ProductWithRelations[]).map(withPublicImageUrls)
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id,name,slug), links:product_links(*), angles:product_angles(*), images:product_images(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  const product = withPublicImageUrls(data as unknown as ProductWithRelations)
  product.angles = [...(product.angles ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  return product
}

export async function saveProduct(product: Partial<Product>) {
  const { data, error } = await supabase.from('products').upsert(product).select().single()
  if (error) throw error
  return data as Product
}

function cleanAngles(angles: ProductAngleInput[]) {
  return angles
    .map((angle) => ({ title: angle.title.trim(), body: angle.body.trim() }))
    .filter((angle) => angle.title || angle.body)
}

async function replaceAngles(productId: string, angles: ProductAngleInput[]) {
  const { error: deleteError } = await supabase.from('product_angles').delete().eq('product_id', productId)
  if (deleteError) throw deleteError
  const cleaned = cleanAngles(angles)
  if (!cleaned.length) return
  const { error } = await supabase.from('product_angles').insert(
    cleaned.map((angle, index) => ({ product_id: productId, ...angle, sort_order: index })),
  )
  if (error) throw error
}

function safeFileName(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return base || 'image'
}

async function uploadImages(productId: string, files: File[], startOrder = 0) {
  const uploaded: { path: string; rowId?: string }[] = []
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      if (!file.type.startsWith('image/')) throw new Error(`„${file.name}“ не е слика.`)
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`„${file.name}“ е поголема од 10 MB.`)
      const path = `${productId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (uploadError) throw uploadError
      uploaded.push({ path })

      const { data: imageRow, error: rowError } = await supabase
        .from('product_images')
        .insert({ product_id: productId, storage_path: path, alt_text: null, sort_order: startOrder + index })
        .select('id')
        .single()
      if (rowError) throw rowError
      uploaded[uploaded.length - 1].rowId = imageRow.id
    }
    return uploaded
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(uploaded.map((item) => item.path))
      const ids = uploaded.flatMap((item) => item.rowId ? [item.rowId] : [])
      if (ids.length) await supabase.from('product_images').delete().in('id', ids)
    }
    throw error
  }
}

export async function createProductBundle(args: {
  product: Omit<Partial<Product>, 'id'>
  angles: ProductAngleInput[]
  images: File[]
}) {
  if (!args.product.brief?.trim()) throw new Error('Брифот е задолжителен.')
  if (!args.images.length) throw new Error('Додади најмалку една слика од производот.')

  const productId = crypto.randomUUID()
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...args.product, id: productId, brief: args.product.brief.trim() })
      .select('*')
      .single()
    if (error) throw error

    await replaceAngles(productId, args.angles)
    await uploadImages(productId, args.images, 0)
    return data as Product
  } catch (error) {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(
      (await supabase.from('product_images').select('storage_path').eq('product_id', productId)).data?.map((row) => row.storage_path) ?? [],
    )
    await supabase.from('products').delete().eq('id', productId)
    throw error
  }
}

export async function updateProductBundle(args: {
  product: Partial<Product> & { id: string }
  angles: ProductAngleInput[]
  newImages: File[]
  removeImages: ProductImage[]
  currentImageCount: number
}) {
  if (!args.product.brief?.trim()) throw new Error('Брифот е задолжителен.')
  const finalImageCount = args.currentImageCount - args.removeImages.length + args.newImages.length
  if (finalImageCount < 1) throw new Error('Производот мора да има најмалку една слика.')

  const { error } = await supabase
    .from('products')
    .update({ ...args.product, brief: args.product.brief.trim() })
    .eq('id', args.product.id)
  if (error) throw error

  await replaceAngles(args.product.id, args.angles)

  if (args.removeImages.length) {
    const paths = args.removeImages.map((image) => image.storage_path)
    const ids = args.removeImages.map((image) => image.id)
    const { error: removeStorageError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths)
    if (removeStorageError) throw removeStorageError
    const { error: removeRowsError } = await supabase.from('product_images').delete().in('id', ids)
    if (removeRowsError) throw removeRowsError
  }

  if (args.newImages.length) {
    await uploadImages(args.product.id, args.newImages, Math.max(0, args.currentImageCount - args.removeImages.length))
  }
}

export async function deleteProduct(id: string) {
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id)
  if (images?.length) {
    const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(images.map((image) => image.storage_path))
    if (storageError) throw storageError
  }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function listTests() {
  const { data, error } = await supabase.from('product_market_tests').select('*')
  if (error) throw error
  return (data ?? []) as ProductMarketTest[]
}

export async function getTest(productId: string, marketId: string) {
  const { data, error } = await supabase
    .from('product_market_tests')
    .select('*')
    .eq('product_id', productId)
    .eq('market_id', marketId)
    .maybeSingle()
  if (error) throw error
  return data as ProductMarketTest | null
}

export interface PrepItem { type: string; quantity: number; assigned_to: string }

export async function startProductTest(args: {
  productId: string
  marketId: string
  status: TestStatus
  ownerId?: string | null
  offer?: string | null
  notes?: string | null
  prep?: PrepItem[]
}) {
  const { data, error } = await supabase.rpc('start_product_test', {
    p_product_id: args.productId,
    p_market_id: args.marketId,
    p_status: args.status,
    p_owner_id: args.ownerId ?? null,
    p_offer: args.offer ?? null,
    p_notes: args.notes ?? null,
    p_prep: args.prep ?? [],
  })
  if (error) throw error
  return data as string
}

export async function updateTest(id: string, patch: Partial<ProductMarketTest>) {
  const { error } = await supabase.from('product_market_tests').update(patch).eq('id', id)
  if (error) throw error
}
