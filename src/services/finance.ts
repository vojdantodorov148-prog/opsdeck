import { supabase } from '@/lib/supabase'
import type { FinanceAccount, FinanceAccountLog, FinanceEntry, FinanceKind } from '@/types/db'

export async function listFinanceAccounts() {
  const { data, error } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as FinanceAccount[]
}

export async function createFinanceAccount(input: { name: string; amount: number; currency: string; notes?: string | null }) {
  const { data, error } = await supabase.rpc('create_finance_account', {
    p_name: input.name,
    p_amount: input.amount,
    p_currency: input.currency,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function updateFinanceAccount(input: {
  id: string
  name: string
  amount: number
  currency: string
  notes?: string | null
  logNote?: string | null
}) {
  const { error } = await supabase.rpc('update_finance_account', {
    p_account_id: input.id,
    p_name: input.name,
    p_amount: input.amount,
    p_currency: input.currency,
    p_notes: input.notes ?? null,
    p_log_note: input.logNote ?? null,
  })
  if (error) throw error
}

export async function archiveFinanceAccount(id: string) {
  const { error } = await supabase.rpc('archive_finance_account', { p_account_id: id })
  if (error) throw error
}

export async function listFinanceAccountLogs(limit = 40) {
  const { data, error } = await supabase
    .from('finance_account_logs')
    .select('*, account:finance_accounts(id,name,currency), actor:profiles!finance_account_logs_changed_by_fkey(id,full_name)')
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as FinanceAccountLog[]
}

export async function listFinanceEntries(limit = 200) {
  const { data, error } = await supabase
    .from('finance_entries')
    .select('*, account:finance_accounts(id,name,currency), recurring:finance_recurring_rules(id,cadence,active,next_run_date)')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as FinanceEntry[]
}

export async function createFinanceEntry(input: {
  accountId: string
  kind: FinanceKind
  description: string
  amount: number
  transactionDate: string
  notes?: string | null
  repeat: boolean
  cadence: 'weekly' | 'monthly' | 'yearly'
}) {
  const { data, error } = await supabase.rpc('create_finance_entry', {
    p_account_id: input.accountId,
    p_kind: input.kind,
    p_description: input.description,
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_notes: input.notes ?? null,
    p_repeat: input.repeat,
    p_cadence: input.cadence,
  })
  if (error) throw error
  return data as string
}

export async function deleteFinanceEntry(id: string) {
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) throw error
}

export async function stopFinanceRecurring(id: string) {
  const { error } = await supabase.rpc('stop_finance_recurring', { p_rule_id: id })
  if (error) throw error
}
