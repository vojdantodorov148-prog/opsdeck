import { supabase } from '@/lib/supabase'
import type {
  CapitalAccount, FinanceSubscription, FinanceTransaction, MonthlyRevenue,
} from '@/types/db'

function monthBounds(month: string) {
  const start = `${month}-01`
  const [year, rawMonth] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, rawMonth, 0)).toISOString().slice(0, 10)
  return { start, end }
}

export async function listFinanceTransactions(month: string) {
  const { start, end } = monthBounds(month)
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('*, brand:brands(id,name)')
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as FinanceTransaction[]
}

export async function saveFinanceTransaction(input: Partial<FinanceTransaction>) {
  const { data, error } = await supabase.from('finance_transactions').upsert(input).select().single()
  if (error) throw error
  return data as FinanceTransaction
}

export async function deleteFinanceTransaction(id: string) {
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) throw error
}

export async function listSubscriptions() {
  const { data, error } = await supabase
    .from('finance_subscriptions')
    .select('*')
    .order('active', { ascending: false })
    .order('name')
  if (error) throw error
  return (data ?? []) as FinanceSubscription[]
}

export async function saveSubscription(input: Partial<FinanceSubscription>) {
  const { data, error } = await supabase.from('finance_subscriptions').upsert(input).select().single()
  if (error) throw error
  return data as FinanceSubscription
}

export async function deleteSubscription(id: string) {
  const { error } = await supabase.from('finance_subscriptions').delete().eq('id', id)
  if (error) throw error
}

export async function generateSubscriptions(month: string) {
  const { data, error } = await supabase.rpc('generate_subscription_transactions', { p_month: `${month}-01` })
  if (error) throw error
  return Number(data ?? 0)
}

export async function listCapitalAccounts() {
  const { data, error } = await supabase.from('capital_accounts').select('*').order('name')
  if (error) throw error
  return (data ?? []) as CapitalAccount[]
}

export async function saveCapitalAccount(input: Partial<CapitalAccount>) {
  const { data, error } = await supabase.from('capital_accounts').upsert(input).select().single()
  if (error) throw error
  return data as CapitalAccount
}

export async function deleteCapitalAccount(id: string) {
  const { error } = await supabase.from('capital_accounts').delete().eq('id', id)
  if (error) throw error
}

export async function listMonthlyRevenue(month: string) {
  const { data, error } = await supabase
    .from('monthly_revenues')
    .select('*, brand:brands(id,name)')
    .eq('month', `${month}-01`)
    .order('source')
  if (error) throw error
  return (data ?? []) as unknown as MonthlyRevenue[]
}

export async function saveMonthlyRevenue(input: Partial<MonthlyRevenue>) {
  const { data, error } = await supabase.from('monthly_revenues').upsert(input).select().single()
  if (error) throw error
  return data as MonthlyRevenue
}

export async function deleteMonthlyRevenue(id: string) {
  const { error } = await supabase.from('monthly_revenues').delete().eq('id', id)
  if (error) throw error
}
