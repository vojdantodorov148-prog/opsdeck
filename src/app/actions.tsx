import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type ActionKey = 'give-task' | 'start-test' | 'add-note' | null

interface ActionsState {
  active: ActionKey
  open: (key: Exclude<ActionKey, null>, context?: ActionContext) => void
  close: () => void
  context: ActionContext
}

export interface ActionContext {
  productId?: string
  marketId?: string
  testId?: string
  taskId?: string
}

const Ctx = createContext<ActionsState | null>(null)

/** Quick Action lives at the app level so any screen can hand it context. */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActionKey>(null)
  const [context, setContext] = useState<ActionContext>({})

  const value = useMemo<ActionsState>(
    () => ({
      active,
      context,
      open: (key, ctx = {}) => { setContext(ctx); setActive(key) },
      close: () => { setActive(null); setContext({}) },
    }),
    [active, context],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useActions() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useActions must be used inside ActionsProvider')
  return ctx
}
