import { supabase } from '@/lib/supabase'
import type { BrandMetric, Objective, StrategicPlan } from '@/types/db'

export async function getCompanyVision() {
  const { data, error } = await supabase.from('company_vision').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as { id: number; north_star: string | null } | null
}

export async function listObjectives(brandId?: string) {
  let q = supabase.from('objectives').select('*').order('sort_order')
  if (brandId) q = q.eq('brand_id', brandId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Objective[]
}

export async function listPlans(brandId: string) {
  const { data, error } = await supabase
    .from('strategic_plans').select('*').eq('brand_id', brandId).order('sort_order')
  if (error) throw error
  return (data ?? []) as StrategicPlan[]
}

export async function listMetrics(brandId: string) {
  const { data, error } = await supabase
    .from('brand_metrics').select('*').eq('brand_id', brandId)
    .order('period_start', { ascending: false }).limit(12)
  if (error) throw error
  return (data ?? []) as BrandMetric[]
}

export async function saveMetric(metric: Partial<BrandMetric>) {
  const { error } = await supabase.from('brand_metrics').upsert(metric, { onConflict: 'brand_id,period_start,period_end' })
  if (error) throw error
}

export async function saveObjective(objective: Partial<Objective>) {
  const { error } = await supabase.from('objectives').upsert(objective)
  if (error) throw error
}
