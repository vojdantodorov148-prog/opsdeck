import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/layout/Logo'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!email || !password) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) toast.error(error.message)
  }

  return (
    <div className="min-h-screen grid place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm panel p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">Use your company account.</p>
        <div className="mt-6 space-y-3">
          <input
            className="field" type="email" placeholder="you@company.com" value={email}
            autoComplete="email" onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field" type="password" placeholder="Password" value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
