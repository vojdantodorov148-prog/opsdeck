import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft, ArrowUpRight, Clock3, History, Landmark,
  Plus, RefreshCw, Trash2, WalletCards, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, EmptyState, ErrorNote } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { useSession } from '@/features/auth/session'
import {
  archiveFinanceAccount,
  createFinanceAccount,
  createFinanceEntry,
  deleteFinanceEntry,
  listFinanceAccountLogs,
  listFinanceAccounts,
  listFinanceEntries,
  stopFinanceRecurring,
  updateFinanceAccount,
} from '@/services/finance'
import type { FinanceAccount, FinanceEntry, FinanceKind } from '@/types/db'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('mk-MK', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`
  }
}

function niceDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

function niceDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('mk-MK', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const CADENCE: Record<string, string> = {
  weekly: 'Неделно', monthly: 'Месечно', yearly: 'Годишно',
}

export function Finance() {
  const { can } = useSession()
  const canManage = can('finance.manage')
  const [accountModal, setAccountModal] = useState<FinanceAccount | 'new' | null>(null)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const accountsQuery = useQuery({ queryKey: ['finance-accounts'], queryFn: listFinanceAccounts })
  const entriesQuery = useQuery({ queryKey: ['finance-entries'], queryFn: () => listFinanceEntries(200) })

  const accounts = accountsQuery.data ?? []
  const entries = entriesQuery.data ?? []

  const totals = useMemo(() => {
    const map = new Map<string, number>()
    accounts.forEach((account) => map.set(account.currency, (map.get(account.currency) ?? 0) + Number(account.amount)))
    return [...map.entries()]
  }, [accounts])

  return (
    <div className="max-w-[1120px]">
      <PageHeader
        title="Финансии"
        subtitle="Само две работи: со колку капитал располагаме и кои пари влегле или излегле."
      />

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Капитал</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Салдо по сметка. Секое рачно менување останува во историјата.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-quiet" onClick={() => setHistoryOpen(true)}><History size={15} /> Историја</button>
            {canManage && <button className="btn-primary" onClick={() => setAccountModal('new')}><Plus size={15} /> Додај сметка</button>}
          </div>
        </div>

        {accountsQuery.error ? <ErrorNote error={accountsQuery.error} /> : accountsQuery.isLoading ? <Loading rows={3} /> : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {totals.length === 0 ? (
                <div className="rounded-xl border border-line bg-panel px-4 py-2 text-sm text-ink-soft">Вкупно: 0 EUR</div>
              ) : totals.map(([currency, total]) => (
                <div key={currency} className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2 text-sm">
                  <span className="text-teal-700">Вкупно · {currency}</span>{' '}
                  <strong className="ml-1 tabular-nums text-ink">{money(total, currency)}</strong>
                </div>
              ))}
            </div>

            {accounts.length === 0 ? (
              <div className="panel"><EmptyState title="Нема активни сметки" hint="Додај Кеш, ProCredit, Mercury или друга сметка." /></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => (
                  <article key={account.id} className="panel p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Landmark size={18} /></div>
                        <p className="truncate text-sm font-semibold">{account.name}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{money(Number(account.amount), account.currency)}</p>
                        {account.notes && <p className="mt-2 text-xs text-ink-soft line-clamp-2">{account.notes}</p>}
                      </div>
                      {canManage && <button className="btn-quiet h-8 px-2.5 text-xs" onClick={() => setAccountModal(account)}>Измени</button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Трансакции</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Приход или трошок. Салдото на избраната сметка се менува автоматски.</p>
          </div>
          {canManage && <button className="btn-primary" onClick={() => setTransactionOpen(true)}><Plus size={15} /> Додај трансакција</button>}
        </div>

        {entriesQuery.error ? <ErrorNote error={entriesQuery.error} /> : entriesQuery.isLoading ? <Loading rows={6} /> : entries.length === 0 ? (
          <div className="panel"><EmptyState title="Нема трансакции" hint="Додај го првиот приход или трошок." /></div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="hidden md:grid grid-cols-[110px_1fr_170px_150px_120px] gap-3 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <span>Датум</span><span>Трансакција</span><span>Сметка</span><span className="text-right">Износ</span><span className="text-right">Акции</span>
            </div>
            <ul className="divide-y divide-line">
              {entries.map((entry) => <TransactionRow key={entry.id} entry={entry} canManage={canManage} />)}
            </ul>
          </div>
        )}
      </section>

      <AccountModal
        open={accountModal !== null}
        account={accountModal === 'new' ? null : accountModal}
        onClose={() => setAccountModal(null)}
      />
      <TransactionModal open={transactionOpen} accounts={accounts} onClose={() => setTransactionOpen(false)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}

function TransactionRow({ entry, canManage }: { entry: FinanceEntry; canManage: boolean }) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => deleteFinanceEntry(entry.id),
    onSuccess: () => {
      invalidateFinance(qc)
      toast.success('Трансакцијата е избришана и салдото е вратено')
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const stop = useMutation({
    mutationFn: () => stopFinanceRecurring(entry.recurring_rule_id as string),
    onSuccess: () => {
      invalidateFinance(qc)
      toast.success('Повторувањето е стопирано')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const income = entry.kind === 'income'
  return (
    <li className="grid gap-2 px-4 py-3.5 row-hover md:grid-cols-[110px_1fr_170px_150px_120px] md:items-center md:gap-3">
      <span className="text-xs text-ink-soft tabular-nums">{niceDate(entry.transaction_date)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-lg ${income ? 'bg-teal-50 text-teal-700' : 'bg-[#FBEFEA] text-[#A0522D]'}`}>
            {income ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
          </span>
          <p className="min-w-0 truncate text-sm font-medium">{entry.description}</p>
          {entry.recurring_rule_id && (
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] ${entry.recurring?.active ? 'border-teal-100 bg-teal-50 text-teal-700' : 'border-line bg-panel text-ink-soft'}`}>
              <RefreshCw size={10} /> {entry.recurring?.active ? (CADENCE[entry.recurring.cadence] ?? 'Повторливо') : 'Стопирано'}
            </span>
          )}
        </div>
        {entry.notes && <p className="mt-1 truncate pl-8 text-xs text-ink-soft">{entry.notes}</p>}
      </div>
      <div className="flex items-center gap-2 text-sm"><WalletCards size={14} className="text-ink-soft" /> {entry.account?.name ?? 'Сметка'}</div>
      <span className={`text-right text-sm font-semibold tabular-nums ${income ? 'text-teal-700' : 'text-[#A0522D]'}`}>
        {income ? '+' : '−'}{money(Number(entry.amount), entry.currency)}
      </span>
      <div className="flex justify-end gap-1">
        {canManage && entry.recurring_rule_id && entry.recurring?.active && (
          <button className="btn-ghost h-8 w-8 px-0" title="Стопирај повторување" onClick={() => stop.mutate()} disabled={stop.isPending}><XCircle size={15} /></button>
        )}
        {canManage && (
          <button
            className="btn-ghost h-8 w-8 px-0 text-ink-soft hover:text-[#A0522D]"
            title="Избриши трансакција"
            onClick={() => window.confirm('Да ја избришам трансакцијата? Салдото на сметката автоматски ќе се врати.') && remove.mutate()}
            disabled={remove.isPending}
          ><Trash2 size={15} /></button>
        )}
      </div>
    </li>
  )
}

function AccountModal({ open, account, onClose }: { open: boolean; account: FinanceAccount | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', amount: '0', currency: 'EUR', notes: '', logNote: '' })

  useEffect(() => {
    setForm(account ? {
      name: account.name,
      amount: String(account.amount),
      currency: account.currency,
      notes: account.notes ?? '',
      logNote: '',
    } : { name: '', amount: '0', currency: 'EUR', notes: '', logNote: '' })
  }, [account, open])

  const save = useMutation({
    mutationFn: () => account
      ? updateFinanceAccount({
          id: account.id,
          name: form.name.trim(),
          amount: Number(form.amount),
          currency: form.currency.trim().toUpperCase(),
          notes: form.notes.trim() || null,
          logNote: form.logNote.trim() || null,
        })
      : createFinanceAccount({
          name: form.name.trim(),
          amount: Number(form.amount),
          currency: form.currency.trim().toUpperCase(),
          notes: form.notes.trim() || null,
        }),
    onSuccess: () => {
      invalidateFinance(qc)
      toast.success(account ? 'Сметката е ажурирана' : 'Сметката е додадена')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const archive = useMutation({
    mutationFn: () => archiveFinanceAccount(account?.id as string),
    onSuccess: () => {
      invalidateFinance(qc)
      toast.success('Сметката е тргната')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const amountChanged = account ? Number(form.amount) !== Number(account.amount) : false

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? `Измени · ${account.name}` : 'Додај сметка'}
      description={account ? 'Кога го менуваш салдото рачно, промената автоматски се запишува во Историја.' : 'Додај банка, кеш или друга сметка.'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>{account && <button className="btn-quiet text-[#A0522D]" disabled={archive.isPending} onClick={() => window.confirm('Да ја тргнам оваа сметка? Салдото мора да е 0.') && archive.mutate()}>Тргни сметка</button>}</div>
          <div className="flex gap-2"><button className="btn-quiet" onClick={onClose}>Откажи</button><button className="btn-primary" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Се зачувува…' : 'Зачувај'}</button></div>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm text-ink-soft">Име на сметка<input className="field mt-1" placeholder="Кеш, ProCredit, Mercury..." value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <label className="block text-sm text-ink-soft">Моментално салдо<input className="field mt-1" type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
          <label className="block text-sm text-ink-soft">Валута<input className="field mt-1" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></label>
        </div>
        {account && amountChanged && (
          <label className="block text-sm text-ink-soft">Причина за промена <span className="text-xs opacity-70">(опционално)</span><input className="field mt-1" placeholder="Пр. банкарска корекција, преброен кеш..." value={form.logNote} onChange={(event) => setForm({ ...form, logNote: event.target.value })} /></label>
        )}
        <label className="block text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
    </Modal>
  )
}

function TransactionModal({ open, accounts, onClose }: { open: boolean; accounts: FinanceAccount[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    kind: 'expense' as FinanceKind,
    accountId: '',
    description: '',
    amount: '',
    transactionDate: today(),
    notes: '',
    repeat: false,
    cadence: 'monthly' as 'weekly' | 'monthly' | 'yearly',
  })

  useEffect(() => {
    if (!open) return
    setForm({
      kind: 'expense', accountId: accounts[0]?.id ?? '', description: '', amount: '', transactionDate: today(), notes: '', repeat: false, cadence: 'monthly',
    })
  }, [open, accounts])

  const selected = accounts.find((account) => account.id === form.accountId)
  const save = useMutation({
    mutationFn: () => createFinanceEntry({
      accountId: form.accountId,
      kind: form.kind,
      description: form.description.trim(),
      amount: Number(form.amount),
      transactionDate: form.transactionDate,
      notes: form.notes.trim() || null,
      repeat: form.repeat,
      cadence: form.cadence,
    }),
    onSuccess: () => {
      invalidateFinance(qc)
      toast.success(form.kind === 'income' ? 'Приходот е додаден' : 'Трошокот е додаден')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const valid = Boolean(form.accountId && form.description.trim() && Number(form.amount) > 0 && form.transactionDate)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Додај трансакција"
      description="Избери приход или трошок и сметката веднаш ќе се ажурира."
      width="max-w-xl"
      footer={<div className="flex justify-end gap-2"><button className="btn-quiet" onClick={onClose}>Откажи</button><button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Се додава…' : 'Додај трансакција'}</button></div>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-panel p-1.5">
          <button type="button" className={`h-10 rounded-xl text-sm font-medium transition ${form.kind === 'income' ? 'bg-white text-teal-700 shadow-sm' : 'text-ink-soft'}`} onClick={() => setForm({ ...form, kind: 'income' })}><ArrowDownLeft size={15} className="mr-1.5 inline" /> Приход</button>
          <button type="button" className={`h-10 rounded-xl text-sm font-medium transition ${form.kind === 'expense' ? 'bg-white text-[#A0522D] shadow-sm' : 'text-ink-soft'}`} onClick={() => setForm({ ...form, kind: 'expense' })}><ArrowUpRight size={15} className="mr-1.5 inline" /> Трошок</button>
        </div>

        <label className="block text-sm text-ink-soft">Сметка
          <select className="field mt-1" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
            <option value="">Избери сметка</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money(Number(account.amount), account.currency)}</option>)}
          </select>
          {selected && <span className="mt-1 block text-xs text-ink-soft">Трансакцијата ќе го промени салдото на {selected.name}.</span>}
        </label>

        <label className="block text-sm text-ink-soft">Опис<input className="field mt-1" placeholder="Пр. Shopify исплата, Meta Ads, плата..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

        <div className="grid grid-cols-[1fr_160px] gap-3">
          <label className="block text-sm text-ink-soft">Износ<input className="field mt-1" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
          <label className="block text-sm text-ink-soft">Датум<input className="field mt-1" type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
        </div>

        <div className="rounded-2xl border border-line p-3.5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span><span className="block text-sm font-medium">Повторувај ја трансакцијата</span><span className="text-xs text-ink-soft">За subscriptions, плати или друг редовен приход/трошок.</span></span>
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.repeat} onChange={(event) => setForm({ ...form, repeat: event.target.checked })} />
          </label>
          {form.repeat && (
            <div className="mt-3 border-t border-line pt-3">
              <label className="block text-sm text-ink-soft">Колку често
                <select className="field mt-1" value={form.cadence} onChange={(event) => setForm({ ...form, cadence: event.target.value as typeof form.cadence })}>
                  <option value="weekly">Секоја недела</option>
                  <option value="monthly">Секој месец</option>
                  <option value="yearly">Секоја година</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <label className="block text-sm text-ink-soft">Белешка <span className="text-xs opacity-70">(опционално)</span><textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
    </Modal>
  )
}

function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['finance-account-logs'],
    queryFn: () => listFinanceAccountLogs(60),
    enabled: open,
  })

  return (
    <Modal open={open} onClose={onClose} title="Историја на капитал" description="Секое рачно ажурирање и секоја трансакција што го променила салдото." width="max-w-2xl">
      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={6} /> : logs.length === 0 ? <EmptyState title="Нема промени" /> : (
        <ul className="divide-y divide-line">
          {logs.map((log) => {
            const positive = Number(log.delta) >= 0
            return (
              <li key={log.id} className="flex items-start gap-3 py-3 first:pt-0">
                <span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-xl ${log.change_type === 'manual' ? 'bg-amber-50 text-amber-700' : positive ? 'bg-teal-50 text-teal-700' : 'bg-[#FBEFEA] text-[#A0522D]'}`}>
                  {log.change_type === 'manual' ? <Clock3 size={15} /> : log.change_type === 'created' ? <Landmark size={15} /> : <RefreshCw size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{log.account?.name ?? 'Сметка'}</p>
                    <span className="text-xs text-ink-soft">{niceDateTime(log.changed_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{log.note ?? 'Промена на салдо'}{log.actor?.full_name ? ` · ${log.actor.full_name}` : ''}</p>
                  <p className="mt-1 text-xs tabular-nums text-ink-soft">
                    {log.old_amount === null ? 'Почетно салдо' : `${money(Number(log.old_amount), log.account?.currency ?? 'EUR')} → `}
                    <strong className="text-ink">{money(Number(log.new_amount), log.account?.currency ?? 'EUR')}</strong>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  void qc.invalidateQueries({ queryKey: ['finance-entries'] })
  void qc.invalidateQueries({ queryKey: ['finance-account-logs'] })
}
