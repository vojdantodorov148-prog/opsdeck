import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/features/auth/session'

const TABLE_QUERIES: Record<string, string[][]> = {
  finance_transactions: [['finance-transactions']],
  finance_subscriptions: [['finance-subscriptions'], ['finance-transactions']],
  monthly_revenues: [['monthly-revenue'], ['finance-transactions']],
  capital_accounts: [['capital-accounts']],
  brand_documents: [['brand-documents']],
}

export function SharedDataRealtime() {
  const queryClient = useQueryClient()
  const { session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    const channel = supabase.channel('shared-data-live')

    Object.entries(TABLE_QUERIES).forEach(([table, queryKeys]) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        queryKeys.forEach((queryKey) => { void queryClient.invalidateQueries({ queryKey }) })
      })
    })

    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [queryClient, session?.user])

  return null
}
