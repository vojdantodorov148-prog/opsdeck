import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight, File, FileImage, FileSpreadsheet, FileText, Folder, FolderOpen,
  Plus, Search, Trash2, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, ErrorNote, Loading } from '@/components/ui/Bits'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useSession, useUserId } from '@/features/auth/session'
import { listBrands } from '@/services/reference'
import {
  deleteBrandDocument, getBrandDocumentUrl, listBrandDocuments, uploadBrandDocument,
} from '@/services/brandDrive'
import type { Brand } from '@/types/db'
import { cn } from '@/lib/cn'

const CATEGORIES = ['Истражувања', 'Мокапи', 'Креативи', 'Документи', 'Друго']

function prettySize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FileIcon({ mime }: { mime: string | null }) {
  if (mime?.startsWith('image/')) return <FileImage size={18} />
  if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv')) return <FileSpreadsheet size={18} />
  if (mime?.includes('pdf') || mime?.includes('document') || mime?.includes('word') || mime?.startsWith('text/')) return <FileText size={18} />
  return <File size={18} />
}

export function Brands() {
  const { can } = useSession()
  const userId = useUserId()
  const qc = useQueryClient()
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [category, setCategory] = useState<string>('Сите')
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data: brands = [], isLoading: loadingBrands, error: brandError } = useQuery({
    queryKey: ['brands'], queryFn: listBrands,
  })
  const { data: documents = [], isLoading: loadingDocuments, error: documentError } = useQuery({
    queryKey: ['brand-documents'], queryFn: () => listBrandDocuments(),
  })

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    documents.forEach((doc) => map.set(doc.brand_id, (map.get(doc.brand_id) ?? 0) + 1))
    return map
  }, [documents])

  const visibleDocuments = useMemo(() => {
    if (!selectedBrand) return []
    const needle = search.trim().toLowerCase()
    return documents.filter((doc) => (
      doc.brand_id === selectedBrand.id
      && (category === 'Сите' || doc.category === category)
      && (!needle || doc.name.toLowerCase().includes(needle) || doc.category.toLowerCase().includes(needle))
    ))
  }, [documents, selectedBrand, category, search])

  const remove = useMutation({
    mutationFn: deleteBrandDocument,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-documents'] }); toast.success('Документот е избришан') },
    onError: (e: Error) => toast.error(e.message),
  })

  if (brandError) return <ErrorNote error={brandError} />

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Брендови"
        subtitle="Drive простор за истражувања, мокапи, документи и останати бренд материјали."
        action={selectedBrand ? <button className="btn-primary" onClick={() => setUploadOpen(true)}><Upload size={15} /> Прикачи документ</button> : undefined}
      />

      {selectedBrand ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button className="flex items-center gap-2 text-sm text-ink-soft hover:text-teal-700" onClick={() => { setSelectedBrand(null); setCategory('Сите'); setSearch('') }}>
              Брендови <ChevronRight size={15} /> <span className="font-medium text-ink">{selectedBrand.name}</span>
            </button>
            <label className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input className="field pl-9" placeholder="Пребарај документи" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((item) => {
              const count = documents.filter((doc) => doc.brand_id === selectedBrand.id && doc.category === item).length
              return (
                <button
                  key={item}
                  onClick={() => setCategory(category === item ? 'Сите' : item)}
                  className={cn('panel p-4 text-left transition hover:border-teal-200 hover:-translate-y-0.5', category === item && 'border-teal-300 bg-teal-50/50')}
                >
                  <Folder size={24} className="text-[#E0A64B]" fill="currentColor" />
                  <p className="mt-3 text-sm font-medium">{item}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{count} документи</p>
                </button>
              )
            })}
          </div>

          {documentError ? <ErrorNote error={documentError} /> : loadingDocuments ? <Loading rows={6} /> : visibleDocuments.length === 0 ? (
            <div className="panel"><EmptyState title="Нема документи во оваа папка" hint="Прикачете истражување, мокап, PDF, слика или друг бренд материјал." action={<button className="btn-primary" onClick={() => setUploadOpen(true)}><Plus size={15} /> Прикачи</button>} /></div>
          ) : (
            <div className="panel overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <tr><th className="px-4 py-3 text-left">Име</th><th className="px-4 py-3 text-left">Папка</th><th className="px-4 py-3 text-left">Прикачил</th><th className="px-4 py-3 text-left">Големина</th><th className="px-4 py-3 text-left">Датум</th><th className="w-12" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleDocuments.map((doc) => {
                    const canDelete = can('brands.manage') || doc.uploaded_by === userId
                    return (
                      <tr key={doc.id} className="row-hover">
                        <td className="px-4 py-3">
                          <button className="flex items-center gap-3 font-medium hover:text-teal-700" onClick={async () => {
                            const tab = window.open('about:blank', '_blank')
                            try {
                              const url = await getBrandDocumentUrl(doc.storage_path)
                              if (tab) tab.location.href = url
                              else window.open(url, '_blank', 'noopener,noreferrer')
                            } catch (error) {
                              tab?.close()
                              toast.error(error instanceof Error ? error.message : 'Документот не може да се отвори.')
                            }
                          }}>
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-panel text-teal-700"><FileIcon mime={doc.mime_type} /></span>
                            <span className="max-w-[340px] truncate">{doc.name}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{doc.category}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-ink-soft"><Avatar name={doc.uploader?.full_name} url={doc.uploader?.avatar_url} size={24} />{doc.uploader?.full_name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{prettySize(doc.file_size)}</td>
                        <td className="px-4 py-3 text-ink-soft">{new Date(doc.created_at).toLocaleDateString('mk-MK')}</td>
                        <td className="px-3 py-3 text-right">
                          {canDelete && <button className="p-1.5 rounded-lg text-ink-soft/45 hover:bg-[#FBEFEA] hover:text-[#A0522D]" onClick={() => window.confirm(`Да го избришам „${doc.name}“?`) && remove.mutate({ id: doc.id, storage_path: doc.storage_path })}><Trash2 size={15} /></button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : loadingBrands || loadingDocuments ? <Loading rows={5} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brands.map((brand) => (
            <button key={brand.id} onClick={() => setSelectedBrand(brand)} className="panel min-h-[150px] p-5 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-float">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF5D9] text-[#D59528]"><FolderOpen size={27} fill="currentColor" /></span>
                <span className="text-xs text-ink-soft">{counts.get(brand.id) ?? 0} фајлови</span>
              </div>
              <p className="mt-6 font-medium">{brand.name}</p>
              <p className="mt-1 text-xs text-ink-soft">Отвори бренд папка</p>
            </button>
          ))}
          {brands.length === 0 && <div className="panel sm:col-span-2 lg:col-span-3"><EmptyState title="Нема брендови" hint="Прво додајте бренд преку Производи или Supabase." /></div>}
        </div>
      )}

      {selectedBrand && <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} brand={selectedBrand} userId={userId} />}
    </div>
  )
}

function UploadModal({ open, onClose, brand, userId }: { open: boolean; onClose: () => void; brand: Brand; userId: string }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [displayName, setDisplayName] = useState('')
  const [notes, setNotes] = useState('')

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Изберете фајл.')
      return uploadBrandDocument({ brandId: brand.id, userId, file, category, displayName, notes })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-documents'] })
      toast.success('Документот е прикачен')
      setFile(null); setDisplayName(''); setNotes(''); setCategory(CATEGORIES[0]); onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal open={open} onClose={onClose} title={`Прикачи во ${brand.name}`} description="Максимална големина: 50 MB." footer={<div className="flex justify-end gap-2"><button className="btn-quiet" onClick={onClose}>Откажи</button><button className="btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Се прикачува…' : 'Прикачи'}</button></div>}>
      <div className="space-y-3">
        <label className="block rounded-2xl border-2 border-dashed border-line bg-panel/50 p-6 text-center cursor-pointer hover:border-teal-300">
          <Upload className="mx-auto text-teal-600" size={24} />
          <p className="mt-2 text-sm font-medium">{file?.name ?? 'Избери фајл'}</p>
          <p className="mt-1 text-xs text-ink-soft">PDF, слики, документи, табели и други фајлови</p>
          <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="text-sm text-ink-soft">Име во Drive<input className="field mt-1" placeholder={file?.name ?? 'Опционално'} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
        <label className="text-sm text-ink-soft">Папка<select className="field mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-sm text-ink-soft">Белешка<textarea className="field mt-1 h-20 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
    </Modal>
  )
}
