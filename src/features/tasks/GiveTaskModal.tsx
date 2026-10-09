import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImageIcon, Plus, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Bits'
import { useActions } from '@/app/actions'
import {
  addProductAdHeadline, addProductAngle, getProduct, listProducts,
} from '@/services/products'
import { listMarkets, listProfiles } from '@/services/reference'
import { attachTaskReferenceImage, createAssignmentBundle } from '@/services/tasks'
import {
  DELIVERABLE_GROUPS, DELIVERABLE_LABELS, describeDeliverables, departmentFor,
  type DeliverableDraft,
} from '@/lib/deliverables'
import { DEPARTMENT } from '@/lib/status'
import type { DeliverableType, Department, ProductAdHeadline, ProductAngle } from '@/types/db'

const ANGLE_TYPES: DeliverableType[] = ['advertorial', 'listicle', 'product_page']

interface ItemConfig {
  angleChoice: string
  newAngleTitle: string
  newAngleBody: string
  headlineChoice: string
  newHeadline: string
}

interface WorkItem {
  id: string
  type: DeliverableType
  quantity: number
  configs: ItemConfig[]
}

function blankConfig(): ItemConfig {
  return { angleChoice: '', newAngleTitle: '', newAngleBody: '', headlineChoice: '', newHeadline: '' }
}

function blankItem(type: DeliverableType = 'advertorial'): WorkItem {
  return { id: crypto.randomUUID(), type, quantity: 1, configs: [blankConfig()] }
}

function isConfigured(type: DeliverableType) {
  return ANGLE_TYPES.includes(type) || type === 'static_ad'
}

function resizeConfigs(configs: ItemConfig[], quantity: number) {
  return Array.from({ length: quantity }, (_, index) => configs[index] ?? blankConfig())
}

export function GiveTaskModal() {
  const { active, close, context } = useActions()
  const open = active === 'give-task'
  const qc = useQueryClient()

  const [productId, setProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [marketIds, setMarketIds] = useState<string[]>([])
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [items, setItems] = useState<WorkItem[]>([blankItem()])

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts, enabled: open })
  const { data: productDetail } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
    enabled: open && Boolean(productId),
  })
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: listMarkets, enabled: open })
  const { data: people = [] } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, enabled: open })

  useEffect(() => {
    if (!open) return
    setProductId(context.productId ?? '')
    setProductSearch('')
    setMarketIds(context.marketId ? [context.marketId] : [])
    setAssignee('')
    setDueDate('')
    setDueTime('')
    setNotes('')
    setReferenceImage(null)
    setItems([blankItem()])
  }, [open, context.productId, context.marketId])

  const productSummary = products.find((product) => product.id === productId)
  const product = productDetail ?? productSummary
  const selectedMarkets = markets.filter((market) => marketIds.includes(market.id))
  const productResults = useMemo(() => {
    const needle = productSearch.trim().toLowerCase()
    if (!needle) return []
    return products
      .filter((item) => [item.name, item.sku, item.brand?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
      .slice(0, 10)
  }, [products, productSearch])

  const departments = useMemo(() => {
    const values = new Set<Department>()
    items.filter((item) => item.quantity > 0).forEach((item) => values.add(departmentFor(item.type)))
    return [...values]
  }, [items])
  const generatedTasks = Math.max(1, selectedMarkets.length) * Math.max(1, departments.length)

  function selectProduct(id: string) {
    setProductId(id)
    setProductSearch('')
    setItems((current) => current.map((item) => ({ ...item, configs: resizeConfigs([], item.quantity) })))
  }

  function changeType(id: string, type: DeliverableType) {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, type, configs: isConfigured(type) ? resizeConfigs([], item.quantity) : [] }
      : item))
  }

  function changeQuantity(id: string, quantity: number) {
    const next = Math.min(99, Math.max(1, quantity || 1))
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, quantity: next, configs: isConfigured(item.type) ? resizeConfigs(item.configs, next) : [] }
      : item))
  }

  function patchConfig(itemId: string, index: number, patch: Partial<ItemConfig>) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item
      const configs = resizeConfigs(item.configs, item.quantity).map((config, configIndex) => configIndex === index ? { ...config, ...patch } : config)
      return { ...item, configs }
    }))
  }

  async function prepareDeliverables(): Promise<DeliverableDraft[]> {
    const prepared: DeliverableDraft[] = []
    const angleCache = new Map<string, ProductAngle>()
    const headlineCache = new Map<string, ProductAdHeadline>()

    for (const item of items.filter((value) => value.quantity > 0)) {
      if (ANGLE_TYPES.includes(item.type)) {
        for (let index = 0; index < item.quantity; index += 1) {
          const config = item.configs[index] ?? blankConfig()
          if (config.angleChoice === 'new') {
            if (!productId) throw new Error('Одбери производ пред да додадеш нов агол.')
            if (!config.newAngleTitle.trim() && !config.newAngleBody.trim()) throw new Error(`Внеси го новиот агол за ${DELIVERABLE_LABELS[item.type]} ${index + 1}.`)
            const key = `${config.newAngleTitle.trim()}\u0000${config.newAngleBody.trim()}`
            let angle = angleCache.get(key)
            if (!angle) {
              angle = await addProductAngle(productId, { title: config.newAngleTitle, body: config.newAngleBody })
              angleCache.set(key, angle)
            }
            prepared.push({ type: item.type, quantity: 1, angle_id: angle.id, angle_title: angle.title, angle_body: angle.body })
          } else if (config.angleChoice) {
            const angle = productDetail?.angles?.find((value) => value.id === config.angleChoice)
            prepared.push({
              type: item.type,
              quantity: 1,
              angle_id: angle?.id ?? null,
              angle_title: angle?.title ?? null,
              angle_body: angle?.body ?? null,
            })
          } else {
            prepared.push({ type: item.type, quantity: 1 })
          }
        }
        continue
      }

      if (item.type === 'static_ad') {
        for (let index = 0; index < item.quantity; index += 1) {
          const config = item.configs[index] ?? blankConfig()
          if (config.headlineChoice === 'new') {
            if (!productId) throw new Error('Одбери производ пред да додадеш нов Ad headline.')
            if (!config.newHeadline.trim()) throw new Error(`Внеси нов Ad headline за Статичен оглас ${index + 1}.`)
            const key = config.newHeadline.trim()
            let headline = headlineCache.get(key)
            if (!headline) {
              headline = await addProductAdHeadline(productId, key)
              headlineCache.set(key, headline)
            }
            prepared.push({ type: item.type, quantity: 1, ad_headline_id: headline.id, ad_headline: headline.headline })
          } else if (config.headlineChoice) {
            const headline = productDetail?.headlines?.find((value) => value.id === config.headlineChoice)
            prepared.push({
              type: item.type,
              quantity: 1,
              ad_headline_id: headline?.id ?? null,
              ad_headline: headline?.headline ?? null,
            })
          } else {
            prepared.push({ type: item.type, quantity: 1 })
          }
        }
        continue
      }

      prepared.push({ type: item.type, quantity: item.quantity })
    }

    return prepared
  }

  const save = useMutation({
    mutationFn: async () => {
      const deliverables = await prepareDeliverables()
      const ids = await createAssignmentBundle({
        productId: productId || null,
        productName: product?.name ?? null,
        markets: selectedMarkets.map(({ id, name, code }) => ({ id, name, code })),
        assignedTo: assignee,
        deliverables,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        notes: notes || null,
        testId: context.testId ?? null,
      })
      if (referenceImage) {
        try {
          await attachTaskReferenceImage(ids, referenceImage)
        } catch (error) {
          toast.error(`Задачата е креирана, но сликата не се прикачи: ${error instanceof Error ? error.message : 'непозната грешка'}`)
        }
      }
      return ids
    },
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['my-week'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      if (productId) qc.invalidateQueries({ queryKey: ['product', productId] })
      toast.success(`${ids.length} ${ids.length === 1 ? 'задача е доделена' : 'задачи се доделени'} на ${people.find((person) => person.id === assignee)?.full_name ?? 'тимот'}`)
      close()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const valid = Boolean(assignee && items.some((item) => item.quantity > 0))

  function toggleMarket(id: string) {
    setMarketIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  return (
    <Modal
      open={open}
      onClose={close}
      fullscreen
      title="Додели задача"
      description="Избери производ, пазари, конкретни агли/headlines и додели ја работата без нејаснотии."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            Ќе се креираат <span className="font-semibold text-ink">{generatedTasks}</span> задачи во{' '}
            <span className="font-medium text-ink">{departments.map((department) => DEPARTMENT[department].label).join(' + ') || 'Општо'}</span>
          </p>
          <div className="flex gap-2">
            <button className="btn-quiet" onClick={close}>Откажи</button>
            <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Се доделува…' : 'Додели задача'}
            </button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-[1180px] space-y-6 pb-4">
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="panel p-5 space-y-4">
            <Field label="Производ">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  className="field pl-9"
                  placeholder="Пребарај производ по име, SKU или бренд…"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                />
              </div>

              {productSearch.trim() && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-sm scrollbar-thin">
                  {productResults.length ? productResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectProduct(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-panel"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-panel">
                        {item.images[0]?.public_url
                          ? <img src={item.images[0].public_url} alt="" className="h-full w-full object-cover" />
                          : <ImageIcon size={16} className="text-ink-soft/60" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-ink-soft">{item.brand?.name ?? 'Без бренд'}{item.sku ? ` · ${item.sku}` : ''}</span>
                      </span>
                    </button>
                  )) : <p className="px-3 py-4 text-sm text-ink-soft">Нема производ што одговара на пребарувањето.</p>}
                </div>
              )}

              {product && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-teal-100 bg-white">
                    {product.images?.[0]?.public_url
                      ? <img src={product.images[0].public_url} alt="" className="h-full w-full object-cover" />
                      : <ImageIcon size={17} className="text-ink-soft/60" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{product.brand?.name ?? 'Без бренд'}{product.sku ? ` · SKU ${product.sku}` : ''}</p>
                  </div>
                  <button type="button" className="btn-ghost h-8 px-2.5 text-xs" onClick={() => selectProduct('')}>Тргни</button>
                </div>
              )}

              {product?.main_url && (
                <a href={product.main_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800">
                  Отвори го главниот продукт линк ↗
                </a>
              )}

              <div className="mt-4 border-t border-line pt-4">
                <Field label="Слика за задачата" optional>
                  {referenceImage ? (
                    <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/55 p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-teal-100 bg-white text-teal-700"><ImageIcon size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{referenceImage.name}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">Оваа слика ќе има предност пред главната product image.</p>
                      </div>
                      <button type="button" className="btn-ghost h-8 px-2.5 text-xs" onClick={() => setReferenceImage(null)}>Тргни</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="btn-quiet h-10 cursor-pointer px-3 text-sm">
                        <Upload size={15} /> Upload слика
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => setReferenceImage(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <p className="text-xs text-ink-soft">Ако не додадеш слика, задачата автоматски ќе ја користи главната слика од ПРОИЗВОДИ.</p>
                    </div>
                  )}
                </Field>
              </div>
            </Field>
          </div>

          <div className="panel p-5">
            <Field label="Пазари / држави" optional>
              <div className="rounded-2xl border border-line bg-panel/50 p-2.5">
                <div className="flex flex-wrap gap-2">
                  {markets.map((market) => {
                    const selected = marketIds.includes(market.id)
                    return (
                      <button
                        key={market.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleMarket(market.id)}
                        className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm transition ${selected ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-line bg-white hover:border-teal-200'}`}
                      >
                        <span className={`grid h-4 w-4 place-items-center rounded border ${selected ? 'border-teal-500 bg-teal-500 text-white' : 'border-line'}`}>
                          {selected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="font-medium">{market.code}</span>
                        <span className="text-xs opacity-70">{market.name}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>{marketIds.length ? `${marketIds.length} избрани пазари` : 'Без пазар — општа задача'}</span>
                  {marketIds.length > 0 && <button type="button" className="hover:text-teal-700" onClick={() => setMarketIds([])}>Исчисти</button>}
                </div>
              </div>
            </Field>
          </div>
        </section>

        <section className="panel p-5">
          <Field label="Испораки">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-line bg-panel/35 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number" min={1} max={99} value={item.quantity}
                      aria-label="Количина"
                      className="field w-20 text-center"
                      onChange={(event) => changeQuantity(item.id, Number(event.target.value) || 1)}
                    />
                    <span className="text-ink-soft text-sm">×</span>
                    <select className="field min-w-[230px] flex-1" value={item.type} aria-label="Тип на испорака" onChange={(event) => changeType(item.id, event.target.value as DeliverableType)}>
                      {DELIVERABLE_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.types.map((type) => <option key={type} value={type}>{DELIVERABLE_LABELS[type]}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button type="button" className="btn-ghost h-10 w-10 px-0" aria-label="Избриши испорака" onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {ANGLE_TYPES.includes(item.type) && (
                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Агол за секој лендер</p>
                        <p className="mt-1 text-xs text-ink-soft">Секој {DELIVERABLE_LABELS[item.type].toLowerCase()} може да има различен агол.</p>
                      </div>
                      {!productId ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Одбери производ за да избираш или зачувуваш агли.</p>
                      ) : (
                        resizeConfigs(item.configs, item.quantity).map((config, index) => (
                          <div key={index} className="rounded-xl border border-line bg-white p-3 space-y-2">
                            <div className="grid gap-2 md:grid-cols-[150px_1fr] md:items-center">
                              <span className="text-sm font-medium">{DELIVERABLE_LABELS[item.type]} #{index + 1}</span>
                              <select className="field" value={config.angleChoice} onChange={(event) => patchConfig(item.id, index, { angleChoice: event.target.value })}>
                                <option value="">Без конкретен агол</option>
                                {(productDetail?.angles ?? []).map((angle, angleIndex) => (
                                  <option key={angle.id} value={angle.id}>{angle.title || `Агол ${angleIndex + 1}`}</option>
                                ))}
                                <option value="new">+ Додај нов агол</option>
                              </select>
                            </div>
                            {config.angleChoice && config.angleChoice !== 'new' && (() => {
                              const angle = productDetail?.angles?.find((value) => value.id === config.angleChoice)
                              return angle?.body ? <p className="rounded-lg bg-panel px-3 py-2 text-xs leading-5 text-ink-soft whitespace-pre-wrap">{angle.body}</p> : null
                            })()}
                            {config.angleChoice === 'new' && (
                              <div className="grid gap-2 md:grid-cols-[1fr_1.5fr]">
                                <input className="field" placeholder="Име на нов агол" value={config.newAngleTitle} onChange={(event) => patchConfig(item.id, index, { newAngleTitle: event.target.value })} />
                                <textarea className="field min-h-[80px] resize-y" placeholder="Опис / идеја за новиот агол…" value={config.newAngleBody} onChange={(event) => patchConfig(item.id, index, { newAngleBody: event.target.value })} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {item.type === 'static_ad' && (
                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ad headline за секој статичен оглас</p>
                        <p className="mt-1 text-xs text-ink-soft">Избери зачуван headline или внеси нов; новиот автоматски ќе се зачува кај производот.</p>
                      </div>
                      {!productId ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Одбери производ за да избираш или зачувуваш Ad headlines.</p>
                      ) : (
                        resizeConfigs(item.configs, item.quantity).map((config, index) => (
                          <div key={index} className="rounded-xl border border-line bg-white p-3">
                            <div className="grid gap-2 md:grid-cols-[150px_1fr] md:items-center">
                              <span className="text-sm font-medium">Статичен оглас #{index + 1}</span>
                              <select className="field" value={config.headlineChoice} onChange={(event) => patchConfig(item.id, index, { headlineChoice: event.target.value })}>
                                <option value="">Без конкретен headline</option>
                                {(productDetail?.headlines ?? []).map((headline) => <option key={headline.id} value={headline.id}>{headline.headline}</option>)}
                                <option value="new">+ Додај нов headline</option>
                              </select>
                            </div>
                            {config.headlineChoice === 'new' && (
                              <input className="field mt-2" placeholder="Внеси нов Ad headline…" value={config.newHeadline} onChange={(event) => patchConfig(item.id, index, { newHeadline: event.target.value })} />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="btn-ghost -ml-1" onClick={() => setItems((current) => [...current, blankItem('static_ad')])}>
                <Plus size={15} /> Додај друг тип
              </button>
            </div>
          </Field>
        </section>

        <section className="panel p-5 space-y-5">
          <Field label="Додели на">
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setAssignee(person.id)}
                  className={`flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-xl border text-sm transition ${assignee === person.id ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-line hover:border-teal-200'}`}
                >
                  <Avatar name={person.full_name} url={person.avatar_url} size={26} />
                  {person.full_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_150px_1.4fr]">
            <Field label="Рок — датум" optional>
              <input type="date" className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label="Рок — час" optional>
              <input type="time" className="field" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} />
            </Field>
            <Field label="Белешки" optional>
              <input className="field" placeholder="Сѐ што треба да знае" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>

          {items.some((item) => item.quantity > 0) && (
            <Badge className="bg-panel border-line text-ink-soft">{describeDeliverables(items.map(({ type, quantity }) => ({ type, quantity })))}</Badge>
          )}
        </section>
      </div>
    </Modal>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}{optional && <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">опционално</span>}
      </span>
      {children}
    </div>
  )
}
