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
export type FinanceKind = 'income' | 'expense'

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
  brief: string
  created_at: string
  updated_at: string
}

export interface ProductAngle {
  id: string
  product_id: string
  title: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProductAdHeadline {
  id: string
  product_id: string
  headline: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  alt_text: string | null
  sort_order: number
  created_at: string
  public_url?: string
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
  angle_id: string | null
  angle_title: string | null
  angle_body: string | null
  ad_headline_id: string | null
  ad_headline: string | null
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
  due_time: string | null
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
  product?: Pick<Product, 'id' | 'name' | 'main_url'> | null
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


export interface FinanceTransaction {
  id: string
  transaction_date: string
  kind: FinanceKind
  category: string
  description: string
  amount: number
  currency: string
  source: 'manual' | 'subscription' | 'monthly_revenue'
  subscription_id: string | null
  subscription_period: string | null
  monthly_revenue_id: string | null
  brand_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  brand?: Pick<Brand, 'id' | 'name'> | null
}

export interface FinanceSubscription {
  id: string
  name: string
  vendor: string | null
  category: string
  amount: number
  currency: string
  billing_day: number
  starts_on: string
  ends_on: string | null
  active: boolean
  notes: string | null
  created_by: string | null
}

export interface MonthlyRevenue {
  id: string
  month: string
  source: string
  amount: number
  currency: string
  brand_id: string | null
  notes: string | null
  created_by: string | null
  brand?: Pick<Brand, 'id' | 'name'> | null
}

export interface CapitalAccount {
  id: string
  name: string
  amount: number
  currency: string
  notes: string | null
  updated_by: string | null
  updated_at: string
}


export interface FinanceAccount {
  id: string
  name: string
  amount: number
  currency: string
  notes: string | null
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FinanceRecurringRule {
  id: string
  account_id: string
  kind: FinanceKind
  description: string
  amount: number
  currency: string
  cadence: 'weekly' | 'monthly' | 'yearly'
  next_run_date: string
  active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FinanceEntry {
  id: string
  transaction_date: string
  kind: FinanceKind
  description: string
  amount: number
  currency: string
  account_id: string
  notes: string | null
  recurring_rule_id: string | null
  recurrence_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  account?: Pick<FinanceAccount, 'id' | 'name' | 'currency'> | null
  recurring?: Pick<FinanceRecurringRule, 'id' | 'cadence' | 'active' | 'next_run_date'> | null
}

export interface FinanceAccountLog {
  id: string
  account_id: string
  change_type: 'created' | 'manual' | 'transaction' | 'archived'
  old_amount: number | null
  new_amount: number
  delta: number
  note: string | null
  transaction_id: string | null
  changed_by: string | null
  changed_at: string
  account?: Pick<FinanceAccount, 'id' | 'name' | 'currency'> | null
  actor?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface BrandDocument {
  id: string
  brand_id: string
  uploaded_by: string | null
  name: string
  storage_path: string
  mime_type: string | null
  file_size: number | null
  category: string
  notes: string | null
  created_at: string
  brand?: Pick<Brand, 'id' | 'name' | 'logo_url'> | null
  uploader?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}
