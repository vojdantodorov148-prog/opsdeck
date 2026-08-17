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
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Најава</h1>
        <p className="mt-1 text-sm text-ink-soft">Користете го вашиот службен акаунт.</p>
        <div className="mt-6 space-y-3">
          <input
            className="field" type="email" placeholder="ime@kompanija.mk" value={email}
            autoComplete="email" onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="field" type="password" placeholder="Лозинка" value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
          />
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? 'Се најавува…' : 'Најави се'}
          </button>
        </div>
      </div>
    </div>
  )
}
