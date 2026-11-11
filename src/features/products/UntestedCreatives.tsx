import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, File as FileIcon, FolderOpen, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorNote, Loading } from '@/components/ui/Bits'
import { useSession } from '@/features/auth/session'
import {
  addUntestedDriveLink,
  deleteUntestedCreative,
  listUntestedCreatives,
  setUntestedCreativeTesting,
  subscribeUntestedCreatives,
  uploadUntestedCreatives,
  type UntestedCreative,
} from '@/services/untestedCreatives'

function formatBytes(value: number | null) {
  if (value == null) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function countdown(deleteAfter: string | null, now: number) {
  if (!deleteAfter) return null
  const diff = new Date(deleteAfter).getTime() - now
  if (diff <= 0) return 'чека автоматско бришење'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.max(0, Math.floor((diff % 3_600_000) / 60_000))
  return `${hours}ч ${minutes}м`
}

function isImage(item: UntestedCreative) {
  return item.mime_type?.startsWith('image/') ?? false
}

function isVideo(item: UntestedCreative) {
  return item.mime_type?.startsWith('video/') ?? false
}

export function UntestedCreatives({ productId }: { productId: string }) {
  const { can } = useSession()
  const canManage = can('products.manage')
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLabel, setDriveLabel] = useState('')
  const [now, setNow] = useState(Date.now())

  const query = useQuery({
    queryKey: ['untested-creatives', productId],
    queryFn: () => listUntestedCreatives(productId),
  })
  const items = query.data ?? []

  useEffect(() => subscribeUntestedCreatives(productId, () => {
    qc.invalidateQueries({ queryKey: ['untested-creatives', productId] })
  }), [productId, qc])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadUntestedCreatives(productId, files),
    onSuccess: (_data, files) => {
      qc.invalidateQueries({ queryKey: ['untested-creatives', productId] })
      toast.success(`${files.length} ${files.length === 1 ? 'креатива е прикачена' : 'креативи се прикачени'}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const addDrive = useMutation({
    mutationFn: () => addUntestedDriveLink(productId, { url: driveUrl, label: driveLabel }),
    onSuccess: () => {
      setDriveUrl('')
      setDriveLabel('')
      qc.invalidateQueries({ queryKey: ['untested-creatives', productId] })
      toast.success('Drive линкот е додаден')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const testing = useMutation({
    mutationFn: ({ item, checked }: { item: UntestedCreative; checked: boolean }) => setUntestedCreativeTesting(item.id, checked),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['untested-creatives', productId] })
      toast.success(vars.checked ? 'Означено како пуштено на тест — бришење за 24 часа' : 'Автоматското бришење е откажано')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: deleteUntestedCreative,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['untested-creatives', productId] })
      toast.success('Креативата е избришана')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const untested = useMemo(() => items.filter((item) => !item.testing_started_at).length, [items])
  const testingCount = items.length - untested

  if (query.error) return <ErrorNote error={query.error} />
  if (query.isLoading) return <Loading rows={5} />

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Нетестирани креативи</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Чувај готови креативи што сѐ уште не се пуштени. Фајловите се чуваат во оригинален квалитет, без компресија.
            </p>
          </div>
          <div className="flex gap-2 text-xs text-ink-soft">
            <span className="rounded-lg border border-line bg-panel px-2.5 py-1.5">Нетестирани: {untested}</span>
            <span className="rounded-lg border border-line bg-panel px-2.5 py-1.5">На тест: {testingCount}</span>
          </div>
        </div>

        {canManage && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel/40 p-4">
              <p className="text-sm font-medium">Директен upload</p>
              <p className="mt-1 text-xs text-ink-soft">Слики/видеа до 50 MB. Фајлот не се re-encode-ира и не губи квалитет.</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  event.currentTarget.value = ''
                  if (files.length) upload.mutate(files)
                }}
              />
              <button className="btn-primary mt-3" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
                <Upload size={15} /> {upload.isPending ? 'Се прикачува…' : 'Прикачи креативи'}
              </button>
            </div>

            <div className="rounded-2xl border border-line bg-panel/40 p-4">
              <p className="text-sm font-medium">Google Drive folder</p>
              <p className="mt-1 text-xs text-ink-soft">За големи видеа или цел folder — се чува само линкот и не троши Ops Deck storage.</p>
              <div className="mt-3 grid gap-2">
                <input className="field" placeholder="Име / опис (опционално)" value={driveLabel} onChange={(event) => setDriveLabel(event.target.value)} />
                <div className="flex gap-2">
                  <input className="field flex-1" placeholder="https://drive.google.com/drive/folders/..." value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} />
                  <button className="btn-quiet shrink-0" disabled={!driveUrl.trim() || addDrive.isPending} onClick={() => addDrive.mutate()}>
                    <FolderOpen size={15} /> Додај
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {items.length === 0 ? (
        <div className="panel"><EmptyState title="Нема нетестирани креативи" hint="Прикачи фајлови или додај Google Drive folder линк." /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const remaining = countdown(item.delete_after, now)
            const testingNow = Boolean(item.testing_started_at)
            const title = item.label || item.original_name || (item.source_type === 'drive' ? 'Google Drive folder' : 'Креатива')
            return (
              <article key={item.id} className={`panel overflow-hidden ${testingNow ? 'border-amber-200' : ''}`}>
                <div className="aspect-[4/3] bg-panel grid place-items-center overflow-hidden">
                  {item.source_type === 'drive' ? (
                    <FolderOpen size={34} className="text-ink-soft/55" />
                  ) : isImage(item) && item.preview_url ? (
                    <img src={item.preview_url} alt={title} className="h-full w-full object-contain" />
                  ) : isVideo(item) && item.preview_url ? (
                    <video src={item.preview_url} controls preload="metadata" className="h-full w-full object-contain" />
                  ) : (
                    <FileIcon size={34} className="text-ink-soft/55" />
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={title}>{title}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {item.source_type === 'drive' ? 'Google Drive' : [item.mime_type, formatBytes(item.file_size)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        className="btn-ghost h-8 w-8 px-0 text-ink-soft hover:text-red-600"
                        title="Избриши"
                        disabled={remove.isPending}
                        onClick={() => window.confirm(`Да ја избришам „${title}“?`) && remove.mutate(item)}
                      ><Trash2 size={14} /></button>
                    )}
                  </div>

                  {canManage && (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={testingNow}
                        disabled={testing.isPending}
                        onChange={(event) => testing.mutate({ item, checked: event.target.checked })}
                      />
                      <span className="flex-1">Пуштено на тест</span>
                    </label>
                  )}

                  {testingNow && (
                    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Автоматско бришење: {remaining ?? 'за 24 часа'}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {item.source_type === 'upload' && item.preview_url && (
                      <a className="btn-quiet flex-1 justify-center" href={item.preview_url} download={item.original_name ?? undefined} target="_blank" rel="noreferrer">
                        <Download size={14} /> Преземи
                      </a>
                    )}
                    {item.source_type === 'drive' && item.external_url && (
                      <a className="btn-quiet flex-1 justify-center" href={item.external_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> Отвори Drive
                      </a>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
