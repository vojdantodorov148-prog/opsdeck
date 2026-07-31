import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './router'
import { ActionsProvider } from './actions'
import { SessionProvider, useSession } from '@/features/auth/session'
import { SignIn } from '@/features/auth/SignIn'
import { isConfigured } from '@/lib/supabase'
import { Logo } from '@/components/layout/Logo'
import { MarketRealtime } from '@/features/testing/MarketRealtime'
import { SharedDataRealtime } from '@/features/realtime/SharedDataRealtime'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

function Gate() {
  const { session, loading } = useSession()
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-ink-soft">Се вчитува…</div>
  if (!session) return <SignIn />
  return <RouterProvider router={router} />
}

function SetupNeeded() {
  return (
    <div className="min-h-screen grid place-items-center bg-canvas p-6">
      <div className="panel p-8 max-w-md">
        <Logo />
        <h1 className="mt-6 text-lg font-semibold">Поврзете го Supabase за да продолжите</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Копирајте го <code className="px-1 rounded bg-panel">.env.example</code> како <code className="px-1 rounded bg-panel">.env</code>,
          внесете ги <code className="px-1 rounded bg-panel">VITE_SUPABASE_URL</code> и{' '}
          <code className="px-1 rounded bg-panel">VITE_SUPABASE_ANON_KEY</code>, па рестартирајте ја апликацијата.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ActionsProvider>
          <MarketRealtime />
          <SharedDataRealtime />
          <Gate />
          <Toaster position="bottom-right" richColors closeButton />
        </ActionsProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
