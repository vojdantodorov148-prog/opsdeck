import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Loading, EmptyState, ErrorNote } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { useSession, useUserId } from '@/features/auth/session'
import { listBrands } from '@/services/reference'
import {
  deleteCapitalAccount,
  deleteFinanceTransaction,
  deleteMonthlyRevenue,
  deleteSubscription,
  generateSubscriptions,
  listCapitalAccounts,
  listFinanceTransactions,
  listMonthlyRevenue,
  listSubscriptions,
  saveCapitalAccount,
  saveFinanceTransaction,
  saveMonthlyRevenue,
  saveSubscription,
} from '@/services/finance'
import type { CapitalAccount, FinanceKind, FinanceSubscription } from '@/types/db'
import { cn } from '@/lib/cn'

const TABS = [
  { key: 'pl', label: 'P&L' },
  { key: 'capital', label: 'Капитал' },
  { key: 'revenue', label: 'Месечни приходи' },
  { key: 'subscriptions', label: 'Претплати' },
] as const

type Tab = typeof TABS[number]['key']

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('mk-MK', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function Finance() {
  const { can } = useSession()
  const [tab, setTab] = useState<Tab>('pl')
  const [month, setMonth] = useState(currentMonth())

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Финансии"
        subtitle="P&L, капитал, месечни приходи и автоматски претплати на едно место."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-panel p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'h-9 rounded-lg px-3 text-sm transition',
                tab === item.key ? 'bg-white text-teal-700 shadow-sm font-medium' : 'text-ink-soft hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {(tab === 'pl' || tab === 'revenue') && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Месец
            <span className="flex rounded-xl border border-line bg-white px-3 py-2">
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="min-w-0 border-0 bg-transparent p-0 text-sm outline-none"
              />
            </span>
          </label>
        )}
      </div>

      {tab === 'pl' && <ProfitLoss month={month} canManage={can('finance.manage')} />}
      {tab === 'capital' && <Capital canManage={can('finance.manage')} />}
      {tab === 'revenue' && <Revenue month={month} canManage={can('finance.manage')} />}
      {tab === 'subscriptions' && <Subscriptions canManage={can('finance.manage')} />}
    </div>
  )
}

function ProfitLoss({ month, canManage }: { month: string; canManage: boolean }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const [open, setOpen] = useState(false)
  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['finance-transactions', month],
    queryFn: () => listFinanceTransactions(month),
  })

  const generate = useMutation({
    mutationFn: () => generateSubscriptions(month),
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] })
      if (count > 0) toast.success(`Додадени се ${count} претплатнички трансакции`)
    },
    onError: () => undefined,
  })

  useEffect(() => {
    if (canManage) generate.mutate()
    // only once per month change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, canManage])

  const remove = useMutation({
    mutationFn: deleteFinanceTransaction,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance-transactions', month] }); toast.success('Трансакцијата е избришана') },
    onError: (e: Error) => toast.error(e.message),
  })

  const totals = useMemo(() => {
    const grouped = new Map<string, { income: number; expense: number }>()
    transactions.forEach((row) => {
      const value = grouped.get(row.currency) ?? { income: 0, expense: 0 }
      value[row.kind] += Number(row.amount)
      grouped.set(row.currency, value)
    })
    return [...grouped.entries()].map(([currency, value]) => ({ currency, ...value, net: value.income - value.expense }))
  }, [transactions])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {totals.length === 0 ? (
            <SummaryCard label="Нето резултат" value={money(0, 'EUR')} icon={WalletCards} />
          ) : totals.map((item) => (
            <div key={item.currency} className="contents">
              <SummaryCard label={`Приход · ${item.currency}`} value={money(item.income, item.currency)} icon={TrendingUp} positive />
              <SummaryCard label={`Трошок · ${item.currency}`} value={money(item.expense, item.currency)} icon={TrendingDown} />
              <SummaryCard label={`Нето · ${item.currency}`} value={money(item.net, item.currency)} icon={WalletCards} positive={item.net >= 0} />
            </div>
          ))}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button className="btn-quiet" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <RefreshCw size={15} /> Освежи претплати
            </button>
            <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Додај трансакција</button>
          </div>
        )}
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={6} /> : transactions.length === 0 ? (
        <div className="panel"><EmptyState title="Нема трансакции за овој месец" hint="Додајте приход, трошок или претплата." /></div>
      ) : (
        <div className="panel overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Датум</th>
                <th className="px-4 py-3 text-left">Опис</th>
                <th className="px-4 py-3 text-left">Категорија</th>
                <th className="px-4 py-3 text-left">Извор</th>
                <th className="px-4 py-3 text-right">Износ</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transactions.map((row) => (
                <tr key={row.id} className="row-hover">
                  <td className="px-4 py-3 text-ink-soft">{row.transaction_date}</td>
                  <td className="px-4 py-3 font-medium">{row.description}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.category}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {row.source === 'subscription' ? 'Претплата' : row.source === 'monthly_revenue' ? 'Месечен приход' : 'Рачно'}
                  </td>
                  <td className={cn('px-4 py-3 text-right font-medium tabular-nums', row.kind === 'income' ? 'text-teal-700' : 'text-[#A0522D]')}>
                    {row.kind === 'income' ? '+' : '−'}{money(Number(row.amount), row.currency)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canManage && row.source === 'manual' && (
                      <button
                        className="p-1.5 rounded-lg text-ink-soft/45 hover:bg-[#FBEFEA] hover:text-[#A0522D]"
                        aria-label="Избриши трансакција"
                        onClick={() => window.confirm('Да ја избришам трансакцијата?') && remove.mutate(row.id)}
                      ><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TransactionModal open={open} onClose={() => setOpen(false)} month={month} userId={userId} />
    </>
  )
}

function SummaryCard({ label, value, icon: Icon, positive = false }: {
  label: string; value: string; icon: typeof WalletCards; positive?: boolean
}) {
  return (
    <div className="panel min-w-[180px] px-4 py-3 flex items-center gap-3">
      <div className={cn('grid h-9 w-9 place-items-center rounded-xl', positive ? 'bg-teal-50 text-teal-700' : 'bg-[#FBEFEA] text-[#A0522D]')}>
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function TransactionModal({ open, onClose, month, userId }: { open: boolean; onClose: () => void; month: string; userId: string }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    transaction_date: `${month}-01`, kind: 'expense' as FinanceKind, category: '', description: '', amount: '', currency: 'EUR', notes: '',
  })

  useEffect(() => { setForm((value) => ({ ...value, transaction_date: `${month}-01` })) }, [month])

  const save = useMutation({
    mutationFn: () => saveFinanceTransaction({
      transaction_date: form.transaction_date,
      kind: form.kind,
      category: form.category.trim(),
      description: form.description.trim(),
      amount: Number(form.amount),
      currency: form.currency.trim().toUpperCase(),
      notes: form.notes.trim() || null,
      source: 'manual',
      created_by: userId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] })
      toast.success('Трансакцијата е додадена')
      onClose()
      setForm({ transaction_date: `${month}-01`, kind: 'expense', category: '', description: '', amount: '', currency: 'EUR', notes: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title="Додај трансакција" footer={<ModalFooter onClose={onClose} onSave={() => save.mutate()} disabled={!form.category || !form.description || Number(form.amount) <= 0 || save.isPending} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">Тип
          <select className="field mt-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FinanceKind })}>
            <option value="income">Приход</option><option value="expense">Трошок</option>
          </select>
        </label>
        <label className="text-sm text-ink-soft">Датум
          <span className="mt-1 flex w-full rounded-xl border border-line bg-white px-3 py-2">
            <input type="date" className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
          </span>
        </label>
        <label className="text-sm text-ink-soft">Опис<input className="field mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Категорија<input className="field mt-1" placeholder="Маркетинг, софтвер, плати..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Износ<input className="field mt-1" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Валута<input className="field mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
        <label className="sm:col-span-2 text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
    </Modal>
  )
}

function Capital({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const [editing, setEditing] = useState<CapitalAccount | null | 'new'>(null)
  const { data: accounts = [], isLoading, error } = useQuery({ queryKey: ['capital-accounts'], queryFn: listCapitalAccounts })
  const remove = useMutation({
    mutationFn: deleteCapitalAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capital-accounts'] }); toast.success('Капиталната ставка е избришана') },
    onError: (e: Error) => toast.error(e.message),
  })
  const grouped = useMemo(() => {
    const totals = new Map<string, number>()
    accounts.forEach((item) => totals.set(item.currency, (totals.get(item.currency) ?? 0) + Number(item.amount)))
    return [...totals.entries()]
  }, [accounts])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {grouped.length === 0 ? <SummaryCard label="Вкупен капитал" value={money(0, 'EUR')} icon={Landmark} positive />
            : grouped.map(([currency, total]) => <SummaryCard key={currency} label={`Вкупен капитал · ${currency}`} value={money(total, currency)} icon={Landmark} positive />)}
        </div>
        {canManage && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={15} /> Додај сметка</button>}
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={4} /> : accounts.length === 0 ? (
        <div className="panel"><EmptyState title="Нема внесен капитал" hint="Додајте банка, готовина, PayPal или друга сметка." /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div key={account.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{money(Number(account.amount), account.currency)}</p>
                  {account.notes && <p className="mt-2 text-xs text-ink-soft line-clamp-2">{account.notes}</p>}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button className="btn-ghost h-8 px-2" onClick={() => setEditing(account)}>Измени</button>
                    <button className="p-1.5 rounded-lg text-ink-soft/45 hover:bg-[#FBEFEA] hover:text-[#A0522D]" onClick={() => window.confirm('Да ја избришам сметката?') && remove.mutate(account.id)}><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CapitalModal open={editing !== null} account={editing === 'new' ? null : editing} userId={userId} onClose={() => setEditing(null)} />
    </>
  )
}

function CapitalModal({ open, account, userId, onClose }: { open: boolean; account: CapitalAccount | null; userId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', amount: '', currency: 'EUR', notes: '' })
  useEffect(() => {
    setForm(account ? { name: account.name, amount: String(account.amount), currency: account.currency, notes: account.notes ?? '' } : { name: '', amount: '', currency: 'EUR', notes: '' })
  }, [account, open])
  const save = useMutation({
    mutationFn: () => saveCapitalAccount({
      id: account?.id,
      name: form.name.trim(), amount: Number(form.amount), currency: form.currency.trim().toUpperCase(), notes: form.notes.trim() || null, updated_by: userId,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['capital-accounts'] }); toast.success('Капиталот е зачуван'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Modal open={open} onClose={onClose} title={account ? 'Измени капитал' : 'Додај капитал'} footer={<ModalFooter onClose={onClose} onSave={() => save.mutate()} disabled={!form.name || !form.amount || save.isPending} />}>
      <div className="space-y-3">
        <label className="text-sm text-ink-soft">Име на сметка<input className="field mt-1" placeholder="Банка, готовина, PayPal..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-ink-soft">Износ<input className="field mt-1" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="text-sm text-ink-soft">Валута<input className="field mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
        </div>
        <label className="text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
    </Modal>
  )
}

function Revenue({ month, canManage }: { month: string; canManage: boolean }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const [open, setOpen] = useState(false)
  const { data: entries = [], isLoading, error } = useQuery({ queryKey: ['monthly-revenue', month], queryFn: () => listMonthlyRevenue(month) })
  const remove = useMutation({
    mutationFn: deleteMonthlyRevenue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-revenue', month] })
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] })
      toast.success('Приходот е избришан')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach((item) => map.set(item.currency, (map.get(item.currency) ?? 0) + Number(item.amount)))
    return [...map.entries()]
  }, [entries])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {totals.length === 0 ? <SummaryCard label="Месечен приход" value={money(0, 'EUR')} icon={TrendingUp} positive />
            : totals.map(([currency, total]) => <SummaryCard key={currency} label={`Месечен приход · ${currency}`} value={money(total, currency)} icon={TrendingUp} positive />)}
        </div>
        {canManage && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Додај приход</button>}
      </div>

      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : entries.length === 0 ? (
        <div className="panel"><EmptyState title="Нема внесени приходи" hint="Внесете од каде дошол приходот и колку е за овој месец." /></div>
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-4 py-3 row-hover">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.source}</p>
                  <p className="text-xs text-ink-soft">{entry.brand?.name ?? 'Сите брендови'}{entry.notes ? ` · ${entry.notes}` : ''}</p>
                </div>
                <span className="font-medium text-teal-700 tabular-nums">{money(Number(entry.amount), entry.currency)}</span>
                {canManage && <button className="p-1.5 rounded-lg text-ink-soft/45 hover:bg-[#FBEFEA] hover:text-[#A0522D]" onClick={() => window.confirm('Да го избришам приходот?') && remove.mutate(entry.id)}><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <RevenueModal open={open} onClose={() => setOpen(false)} month={month} userId={userId} />
    </>
  )
}

function RevenueModal({ open, onClose, month, userId }: { open: boolean; onClose: () => void; month: string; userId: string }) {
  const qc = useQueryClient()
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: listBrands, enabled: open })
  const [form, setForm] = useState({ source: '', amount: '', currency: 'EUR', brand_id: '', notes: '' })
  const save = useMutation({
    mutationFn: () => saveMonthlyRevenue({
      month: `${month}-01`, source: form.source.trim(), amount: Number(form.amount), currency: form.currency.trim().toUpperCase(), brand_id: form.brand_id || null, notes: form.notes.trim() || null, created_by: userId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-revenue', month] })
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] })
      toast.success('Месечниот приход е зачуван')
      setForm({ source: '', amount: '', currency: 'EUR', brand_id: '', notes: '' })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Modal open={open} onClose={onClose} title="Додај месечен приход" description="Овој внес автоматски се појавува и во P&L табелата." footer={<ModalFooter onClose={onClose} onSave={() => save.mutate()} disabled={!form.source || Number(form.amount) <= 0 || save.isPending} />}>
      <div className="space-y-3">
        <label className="text-sm text-ink-soft">Извор<input className="field mt-1" placeholder="Shopify, wholesale, услуга..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-ink-soft">Износ<input className="field mt-1" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="text-sm text-ink-soft">Валута<input className="field mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
        </div>
        <label className="text-sm text-ink-soft">Бренд
          <select className="field mt-1" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
            <option value="">Сите брендови</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
    </Modal>
  )
}

function Subscriptions({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const userId = useUserId()
  const [editing, setEditing] = useState<FinanceSubscription | null | 'new'>(null)
  const { data: subscriptions = [], isLoading, error } = useQuery({ queryKey: ['finance-subscriptions'], queryFn: listSubscriptions })
  const save = useMutation({
    mutationFn: (input: Partial<FinanceSubscription>) => saveSubscription(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance-subscriptions'] }); qc.invalidateQueries({ queryKey: ['finance-transactions'] }); toast.success('Претплатата е ажурирана') },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance-subscriptions'] }); qc.invalidateQueries({ queryKey: ['finance-transactions'] }); toast.success('Претплатата е избришана') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Активните претплати автоматски создаваат трошок на нивниот ден за наплата.</p>
        {canManage && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={15} /> Додај претплата</button>}
      </div>
      {error ? <ErrorNote error={error} /> : isLoading ? <Loading rows={5} /> : subscriptions.length === 0 ? (
        <div className="panel"><EmptyState title="Нема претплати" hint="Додајте софтвер, алатки, хостинг и други месечни трошоци." /></div>
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {subscriptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-4 py-3 row-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <span className={cn('h-2 w-2 rounded-full', item.active ? 'bg-teal-500' : 'bg-line')} />
                  </div>
                  <p className="text-xs text-ink-soft">{item.vendor || item.category} · секој {item.billing_day}. ден</p>
                </div>
                <span className="font-medium tabular-nums">{money(Number(item.amount), item.currency)}</span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost h-8 px-2" onClick={() => setEditing(item)}>Измени</button>
                    <button className="btn-ghost h-8 px-2" onClick={() => save.mutate({ id: item.id, active: !item.active })}>{item.active ? 'Паузирај' : 'Активирај'}</button>
                    <button className="p-1.5 rounded-lg text-ink-soft/45 hover:bg-[#FBEFEA] hover:text-[#A0522D]" onClick={() => window.confirm('Да ја избришам претплатата и нејзините автоматски трансакции?') && remove.mutate(item.id)}><Trash2 size={15} /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SubscriptionModal open={editing !== null} item={editing === 'new' ? null : editing} userId={userId} onClose={() => setEditing(null)} />
    </>
  )
}

function SubscriptionModal({ open, item, userId, onClose }: { open: boolean; item: FinanceSubscription | null; userId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', vendor: '', category: 'Софтвер', amount: '', currency: 'EUR', billing_day: '1', starts_on: new Date().toISOString().slice(0, 10), ends_on: '', notes: '' })
  useEffect(() => {
    setForm(item ? {
      name: item.name, vendor: item.vendor ?? '', category: item.category, amount: String(item.amount), currency: item.currency,
      billing_day: String(item.billing_day), starts_on: item.starts_on, ends_on: item.ends_on ?? '', notes: item.notes ?? '',
    } : { name: '', vendor: '', category: 'Софтвер', amount: '', currency: 'EUR', billing_day: '1', starts_on: new Date().toISOString().slice(0, 10), ends_on: '', notes: '' })
  }, [item, open])
  const save = useMutation({
    mutationFn: () => saveSubscription({
      id: item?.id,
      name: form.name.trim(), vendor: form.vendor.trim() || null, category: form.category.trim(), amount: Number(form.amount),
      currency: form.currency.trim().toUpperCase(), billing_day: Number(form.billing_day), starts_on: form.starts_on,
      ends_on: form.ends_on || null, notes: form.notes.trim() || null, active: item?.active ?? true, created_by: item?.created_by ?? userId,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance-subscriptions'] }); qc.invalidateQueries({ queryKey: ['finance-transactions'] }); toast.success('Претплатата е зачувана'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Modal open={open} onClose={onClose} title={item ? 'Измени претплата' : 'Додај претплата'} footer={<ModalFooter onClose={onClose} onSave={() => save.mutate()} disabled={!form.name || Number(form.amount) <= 0 || !form.starts_on || save.isPending} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm text-ink-soft">Име<input className="field mt-1" placeholder="Adobe, Shopify, хостинг..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Добавувач<input className="field mt-1" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Категорија<input className="field mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Износ<input className="field mt-1" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Валута<input className="field mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Ден за наплата<input className="field mt-1" type="number" min="1" max="28" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: e.target.value })} /></label>
        <label className="text-sm text-ink-soft">Почнува од<span className="mt-1 flex w-full rounded-xl border border-line bg-white px-3 py-2"><input type="date" className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></span></label>
        <label className="text-sm text-ink-soft">Завршува (опционално)<span className="mt-1 flex w-full rounded-xl border border-line bg-white px-3 py-2"><input type="date" className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></span></label>
        <label className="sm:col-span-2 text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
    </Modal>
  )
}

function ModalFooter({ onClose, onSave, disabled }: { onClose: () => void; onSave: () => void; disabled: boolean }) {
  return <div className="flex justify-end gap-2"><button className="btn-quiet" onClick={onClose}>Откажи</button><button className="btn-primary" disabled={disabled} onClick={onSave}>Зачувај</button></div>
}
