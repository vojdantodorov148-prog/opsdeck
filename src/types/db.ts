// Domain types. Regenerate the exhaustive version any time with:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
export type ProductStatus = 'research' | 'approved' | 'active' | 'paused' | 'archived'
export type TestStatus =
  | 'not_tested' | 'planned' | 'preparing' | 'ready' | 'testing' | 'winner' | 'stopped'
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'review' | 'done'
export type TaskSource = 'manual' | 'quick_action' | 'workflow' | 'review' | 'personal'
export type Department = 'landing' | 'creative' | 'testing' | 'general'
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested'
export type PlanHorizon = 'now' | 'next' | 'later'

export type DeliverableType =
  | 'product_page' | 'advertorial' | 'listicle' | 'quiz' | 'landing_localization' | 'other_landing'
  | 'static_ad' | 'video_ad' | 'ugc' | 'creative_concept' | 'image_variation'
  | 'hook_variation' | 'creative_localization' | 'other_creative'
  | 'research' | 'campaign' | 'general_task' | 'custom'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  job_title: string | null
  email: string | null
  active: boolean
}

export interface Brand { id: string; name: string; slug: string; logo_url: string | null; active: boolean }
export interface Market { id: string; code: string; name: string; currency: string; active: boolean; sort_order: number }

export interface Product {
  id: string
  brand_id: string | null
  name: string
  sku: string | null
  selling_price: number | null
  currency: string
  break_even_cpa: number | null
  cogs: number | null
  status: ProductStatus
  main_url: string | null
  supplier_url: string | null
  assets_url: string | null
  notes: string | null
}

export interface ProductMarketTest {
  id: string
  product_id: string
  market_id: string
  status: TestStatus
  owner_id: string | null
  planned_date: string | null
  start_date: string | null
  end_date: string | null
  landing_url: string | null
  campaign_url: string | null
  offer: string | null
  notes: string | null
}

export interface Deliverable {
  id: string
  task_id: string
  type: DeliverableType
  quantity: number
  completed_quantity: number
  status: 'todo' | 'doing' | 'done'
  url: string | null
  notes: string | null
  sort_order: number
}

export interface Task {
  id: string
  title: string
  description: string | null
  created_by: string | null
  assigned_to: string | null
  product_id: string | null
  market_id: string | null
  department: Department
  status: TaskStatus
  priority: number | null
  due_date: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  sort_order: number
  source: TaskSource
  product_market_test_id: string | null
  is_private: boolean
  created_at: string
  completed_at: string | null
}

export interface TaskWithRelations extends Task {
  deliverables: Deliverable[]
  product?: Pick<Product, 'id' | 'name'> | null
  market?: Pick<Market, 'id' | 'code' | 'name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  creator?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface Note {
  id: string
  author_id: string | null
  title: string | null
  content: string
  visibility: 'private' | 'team'
  product_id: string | null
  market_id: string | null
  task_id: string | null
  created_at: string
}

export interface Tool {
  id: string
  name: string
  description: string | null
  url: string
  icon: string | null
  category: string
  favorite: boolean
  sort_order: number
  active: boolean
}

export interface AppNotification {
  id: string
  user_id: string
  type: 'new_assignment' | 'review_needed' | 'decision_needed' | 'task_blocked' | 'mention'
  title: string
  message: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export interface ActivityEvent {
  id: string
  actor_id: string | null
  event_type: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: Pick<Profile, 'full_name' | 'avatar_url'> | null
}

export interface Objective {
  id: string
  brand_id: string | null
  title: string
  description: string | null
  status: 'planned' | 'active' | 'at_risk' | 'done'
  progress: number
  target_value: number | null
  current_value: number | null
  target_date: string | null
}

export interface StrategicPlan { id: string; brand_id: string; horizon: PlanHorizon; title: string; description: string | null }
export interface BrandMetric {
  id: string; brand_id: string; period_start: string; period_end: string
  revenue: number | null; profit: number | null; ad_spend: number | null
}
export interface UserLevel { user_id: string; total_xp: number; level: number }
