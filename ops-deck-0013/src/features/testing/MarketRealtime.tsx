import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/features/auth/session'

export function MarketRealtime() {
  const queryClient = useQueryClient()
  const { session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    const channel = supabase
      .channel('markets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['markets'] })
        void queryClient.invalidateQueries({ queryKey: ['tests'] })
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient, session?.user])

  return null
}
