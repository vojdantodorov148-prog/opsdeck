import { supabase } from '@/lib/supabase'
import type { Product, ProductMarketTest, TestStatus } from '@/types/db'

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id,name,slug)')
    .neq('status', 'archived')
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as (Product & { brand: { id: string; name: string } | null })[]
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, brand:brands(id,name,slug), links:product_links(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as Product & {
    brand: { id: string; name: string } | null
    links: { id: string; label: string; url: string }[]
  }
}

export async function saveProduct(product: Partial<Product>) {
  const { data, error } = await supabase.from('products').upsert(product).select().single()
  if (error) throw error
  return data as Product
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
