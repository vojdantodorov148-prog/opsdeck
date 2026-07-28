import { supabase } from '@/lib/supabase'
import type { Brand, Market, Profile, Tool } from '@/types/db'

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('active', true).order('full_name')
  if (error) throw error
  return data as Profile[]
}

export async function listMarkets() {
  const { data, error } = await supabase
    .from('markets').select('*').eq('active', true).order('sort_order')
  if (error) throw error
  return data as Market[]
}

export async function listBrands() {
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error) throw error
  return data as Brand[]
}

export async function listTools() {
  const { data, error } = await supabase
    .from('tools').select('*').eq('active', true).order('sort_order')
  if (error) throw error
  return data as Tool[]
}

export async function saveTool(tool: Partial<Tool>) {
  const { error } = await supabase.from('tools').upsert(tool)
  if (error) throw error
}

export async function deleteTool(id: string) {
  const { error } = await supabase.from('tools').delete().eq('id', id)
  if (error) throw error
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return (data?.value ?? null) as T | null
}

export async function addMarket(input: Pick<Market, 'code' | 'name' | 'currency'> & { sort_order?: number }) {
  const payload = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    currency: input.currency.trim().toUpperCase() || 'EUR',
    sort_order: input.sort_order ?? 0,
    active: true,
  }
  const { data, error } = await supabase.from('markets').insert(payload).select('*').single()
  if (error) throw error
  return data as Market
}

export async function deleteMarket(id: string) {
  const { error } = await supabase.from('markets').delete().eq('id', id)
  if (error) throw error
}
