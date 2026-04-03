'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Search, Download, Eye, Upload, FileText, File, FileImage,
  FileSpreadsheet, Loader2, Trash2, MoreHorizontal, Pencil,
  FolderOpen, Library, Blocks, Check, ChevronRight, ChevronLeft,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ───

interface CompanyDocument {
  id: string
  name: string
  description: string | null
  category: string
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  file_extension: string | null
  download_count: number
  created_at: string
  uploaded_by_user: { commercial_name: string } | null
}


// ─── Constants ───

const CATEGORIES: Record<string, string> = {
  angariacao: 'Angariação',
  institucional: 'Institucionais',
  cliente: 'Cliente',
  contratos: 'Contratos',
  kyc: 'KYC',
  fiscal: 'Fiscal',
  marketing: 'Marketing',
  formacao: 'Formação',
  outro: 'Outros',
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: File,
  docx: File,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  webp: FileImage,
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

// ─── Main Page ───

type Tab = 'documentos' | 'templates' | 'kit'

export default function BibliotecaPage() {
  const [tab, setTab] = useState<Tab>('documentos')

  const tabs: { key: Tab; label: string; icon: typeof Library }[] = [
    { key: 'documentos', label: 'Documentos', icon: Library },
    { key: 'templates', label: 'Marketing', icon: FileImage },
    { key: 'kit', label: 'O Meu Kit', icon: Blocks },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Documentos e Marketing</h1>
          <p className="text-sm text-white/60 mt-1">Documentos, templates e materiais da empresa</p>
        </div>

        {/* Tab Pills */}
        <div className="relative flex gap-1 mt-5 bg-white/10 rounded-full p-1 w-fit mx-auto sm:mx-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all',
                'px-3 py-1.5 sm:px-4 sm:py-2',
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
              onClick={() => setTab(key)}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'documentos' && <DocumentosTab />}
      {tab === 'templates' && <MarketingTemplatesTab />}
      {tab === 'kit' && <KitConsultorTab />}
    </div>
  )
}

// ─── Documentos Tab ───

function DocumentosTab() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<CompanyDocument | null>(null)
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('angariacao')
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search) params.set('search', search)
      const res = await fetch(`/api/company-documents?${params}`)
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const grouped = documents.reduce<Record<string, CompanyDocument[]>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = []
    acc[doc.category].push(doc)
    return acc
  }, {})

  const handleDownload = async (doc: CompanyDocument) => {
    fetch(`/api/company-documents/${doc.id}/download`, { method: 'POST' }).catch(() => {})
    await downloadFile(doc.file_path, doc.file_name)
  }

  const handleDelete = async () => {
    if (!deleteDoc) return
    try {
      const res = await fetch(`/api/company-documents/${deleteDoc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Documento eliminado')
      setDeleteDoc(null)
      fetchDocuments()
    } catch {
      toast.error('Erro ao eliminar documento')
    }
  }

  const handleEdit = async () => {
    if (!editDoc) return
    setSaving(true)
    try {
      const res = await fetch(`/api/company-documents/${editDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, category: editCategory }),
      })
      if (!res.ok) throw new Error()
      toast.success('Documento actualizado')
      setEditDoc(null)
      fetchDocuments()
    } catch {
      toast.error('Erro ao actualizar documento')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('category', uploadCategory)
      for (const file of uploadFiles) {
        formData.append('files', file)
      }
      const res = await fetch('/api/company-documents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      toast.success(`${data.uploaded} documento${data.uploaded !== 1 ? 's' : ''} carregado${data.uploaded !== 1 ? 's' : ''}`)
      setUploadOpen(false)
      setUploadFiles([])
      fetchDocuments()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar ficheiros')
    } finally {
      setUploading(false)
    }
  }

  const isPdf = (doc: CompanyDocument) => doc.file_extension === 'pdf' || doc.mime_type === 'application/pdf'
  const isImage = (doc: CompanyDocument) => doc.mime_type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(doc.file_extension || '')

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="rounded-full gap-2" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Carregar
        </Button>
      </div>

      {/* Stats */}
      {!loading && documents.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {documents.length} documento{documents.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Document List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum documento encontrado"
          description={search ? 'Tente ajustar a pesquisa.' : 'Carregue documentos para começar.'}
          action={
            <Button variant="outline" className="rounded-full gap-2" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />Carregar
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {(category === 'all' ? Object.entries(grouped) : [[category, documents]]).map(([cat, docs]) => (
            <div key={cat}>
              {category === 'all' && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {CATEGORIES[cat] || cat}
                  <span className="ml-1.5 text-muted-foreground/60">({(docs as CompanyDocument[]).length})</span>
                </h3>
              )}
              <div className="rounded-xl border overflow-hidden divide-y">
                {(docs as CompanyDocument[]).map((doc) => {
                  const Icon = FILE_ICONS[doc.file_extension || ''] || FileText
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (isPdf(doc) || isImage(doc)) setPreviewDoc(doc)
                        else handleDownload(doc)
                      }}
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="uppercase">{doc.file_extension}</span>
                          {doc.file_size && <><span>·</span><span>{formatFileSize(doc.file_size)}</span></>}
                          {doc.download_count > 0 && <><span>·</span><span>{doc.download_count} download{doc.download_count !== 1 ? 's' : ''}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(isPdf(doc) || isImage(doc)) && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setPreviewDoc(doc)} title="Pré-visualizar">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => handleDownload(doc)} title="Descarregar">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditDoc(doc); setEditName(doc.name); setEditCategory(doc.category) }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDoc(doc)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" />Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl rounded-2xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">{previewDoc?.name || 'Pré-visualização'}</DialogTitle>
          {previewDoc && (
            <>
              <div className="bg-muted/30">
                {isPdf(previewDoc) ? (
                  <iframe src={previewDoc.file_path} className="w-full h-[75vh]" title={previewDoc.name} />
                ) : isImage(previewDoc) ? (
                  <img src={previewDoc.file_path} alt={previewDoc.name} className="w-full h-auto max-h-[75vh] object-contain" />
                ) : null}
              </div>
              <div className="p-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{previewDoc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIES[previewDoc.category] || previewDoc.category}
                    {previewDoc.file_size && ` · ${formatFileSize(previewDoc.file_size)}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs" onClick={() => handleDownload(previewDoc)}>
                  <Download className="h-3.5 w-3.5" />Descarregar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) { setUploadOpen(false); setUploadFiles([]) } }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Carregar Documentos</DialogTitle>
            <DialogDescription>Seleccione a categoria e os ficheiros para carregar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) setUploadFiles((p) => [...p, ...f]); e.target.value = '' }} />
            <button
              className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-6 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Clique para seleccionar ficheiros</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Imagens · Pode seleccionar vários</p>
            </button>
            {uploadFiles.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {uploadFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                    <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setUploadFiles((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full rounded-full gap-2" disabled={uploadFiles.length === 0 || uploading} onClick={handleUpload}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />A carregar...</> : <><Upload className="h-4 w-4" />Carregar {uploadFiles.length} ficheiro{uploadFiles.length !== 1 ? 's' : ''}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(open) => !open && setEditDoc(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full rounded-full" disabled={saving} onClick={handleEdit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende eliminar "{deleteDoc?.name}"? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Marketing Templates Tab ───

interface DesignTemplate {
  id: string
  name: string
  category: string
  subcategory: string | null
  description: string | null
  canva_url: string | null
  thumbnail_url: string | null
  is_team_design: boolean
  sort_order: number
}

const DESIGN_CATEGORIES: Record<string, string> = {
  placas: 'Placas',
  cartoes: 'Cartões',
  badges: 'Badges',
  assinaturas: 'Assinaturas',
  relatorios: 'Relatórios',
  estudos: 'Estudos de Mercado',
  redes_sociais: 'Redes Sociais',
  outro: 'Outros',
}

const DESIGN_CATEGORY_ICONS: Record<string, string> = {
  placas: '🪧',
  cartoes: '💳',
  badges: '🏷️',
  assinaturas: '✉️',
  relatorios: '📊',
  estudos: '📈',
  redes_sociais: '📱',
  outro: '📁',
}

function MarketingTemplatesTab() {
  const [templates, setTemplates] = useState<DesignTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'personal' | 'team'>('personal')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('team', subTab === 'team' ? 'true' : 'false')
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/marketing/design-templates?${params}`)
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [subTab, category])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Filter by search
  const filtered = search
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates

  // Group by category
  const grouped = filtered.reduce<Record<string, DesignTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-muted/50 rounded-full p-1">
          <button
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              subTab === 'personal' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setSubTab('personal')}
          >
            Os meus designs
          </button>
          <button
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              subTab === 'team' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setSubTab('team')}
          >
            Designs da Equipa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {Object.entries(DESIGN_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-36 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Nenhum template encontrado"
          description={search ? 'Tente ajustar a pesquisa.' : 'Ainda não foram adicionados templates de marketing.'}
        />
      ) : subTab === 'personal' ? (
        /* Personal: grid of category cards (like old app) */
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-center">{DESIGN_CATEGORIES[cat] || cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {items.map((t) => (
                  <a
                    key={t.id}
                    href={t.canva_url || '#'}
                    target={t.canva_url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 border border-transparent hover:border-border hover:bg-muted/60 p-5 transition-all cursor-pointer"
                  >
                    <span className="text-2xl">{DESIGN_CATEGORY_ICONS[t.category] || '📁'}</span>
                    <span className="text-xs font-medium text-center">{t.name}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Team: thumbnail grid (like old app's "Designs da Equipa") */
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {DESIGN_CATEGORIES[cat] || cat}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map((t) => (
                  <a
                    key={t.id}
                    href={t.canva_url || '#'}
                    target={t.canva_url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="group rounded-xl border overflow-hidden hover:shadow-md transition-all"
                  >
                    {t.thumbnail_url ? (
                      <div className="aspect-[4/3] bg-muted overflow-hidden">
                        <img
                          src={t.thumbnail_url}
                          alt={t.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center">
                        <span className="text-3xl">{DESIGN_CATEGORY_ICONS[t.category] || '📁'}</span>
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-medium truncate uppercase">{t.name}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── O Meu Kit Tab (user-specific materials) ───

interface MaterialPage {
  id: string
  file_url: string | null
  thumbnail_url: string | null
  file_name: string
  page_index: number
  created_at: string
}

interface AgentMaterial {
  template: { id: string; name: string; category: string }
  pages: MaterialPage[]
}

const KIT_CATEGORY_LABELS: Record<string, string> = {
  cartao_visita: 'Cartão de Visita',
  cartao_digital: 'Cartão Digital',
  badge: 'Badge',
  placa_venda: 'Placa de Venda',
  placa_arrendamento: 'Placa de Arrendamento',
  assinatura_email: 'Assinatura de Email',
  relatorio_imovel: 'Relatório de Imóvel',
  estudo_mercado: 'Estudo de Mercado',
  outro: 'Outro',
}

function KitConsultorTab() {
  const { user } = useUser()
  const userId = user?.id || null
  const [items, setItems] = useState<AgentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [previewItem, setPreviewItem] = useState<AgentMaterial | null>(null)
  const [previewPageIdx, setPreviewPageIdx] = useState(0)

  const fetchMaterials = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/consultants/${userId}/materials`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const readyCount = items.filter(i => i.pages.length > 0).length
  const totalCount = items.length
  const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0

  const handleDownloadAll = async () => {
    const allPages = items.flatMap(i => i.pages.filter(p => p.file_url))
    if (allPages.length === 0) { toast.error('Nenhum material disponível'); return }
    toast.success(`A descarregar ${allPages.length} ficheiros...`)
    for (const page of allPages) {
      if (page.file_url) await downloadFile(page.file_url, page.file_name)
    }
  }

  const handleDownloadTemplate = async (pages: MaterialPage[], name: string) => {
    for (const p of pages.filter(p => p.file_url)) {
      await downloadFile(p.file_url!, p.file_name || `${name}-p${p.page_index}.png`)
    }
  }

  const previewPage = previewItem?.pages[previewPageIdx] || null
  const previewTotalPages = previewItem?.pages.length || 0

  // Group by category
  const grouped = items.reduce<Record<string, AgentMaterial[]>>((acc, item) => {
    const cat = item.template.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  if (loading || !userId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Blocks}
        title="Sem materiais"
        description="O teu kit de marketing ainda não foi criado. Contacta o departamento de marketing."
      />
    )
  }

  return (
    <>
      {/* Progress */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">O Meu Kit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {readyCount} de {totalCount} materiais prontos
            </p>
          </div>
          {readyCount > 0 && (
            <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs" onClick={handleDownloadAll}>
              <Download className="h-3.5 w-3.5" />Descarregar Todos
            </Button>
          )}
        </div>
        <Progress value={progressPct} className="h-2" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">{progressPct}% completo</span>
          {readyCount === totalCount && totalCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><Check className="h-3 w-3 mr-1" />Kit Completo</Badge>
          )}
        </div>
      </div>

      {/* Materials by Category */}
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {KIT_CATEGORY_LABELS[cat] || cat}
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {catItems.map(({ template, pages }) => {
              const hasPages = pages.length > 0
              const cover = pages[0]

              return (
                <div
                  key={template.id}
                  className={cn(
                    'rounded-lg border p-2 space-y-1.5 transition-all',
                    hasPages ? 'bg-card/50 border-border cursor-pointer hover:shadow-sm' : 'bg-muted/10 border-dashed opacity-60'
                  )}
                  onClick={() => hasPages && (() => { setPreviewItem({ template, pages }); setPreviewPageIdx(0) })()}
                >
                  {hasPages && cover ? (
                    <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
                      <img src={cover.thumbnail_url || cover.file_url || ''} alt={template.name} className="w-full h-full object-cover" />
                      {pages.length > 1 && (
                        <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">{pages.length} pág.</span>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-md bg-muted/30 flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-muted-foreground/20" />
                    </div>
                  )}
                  <p className="text-[10px] font-medium truncate">{template.name}</p>
                  {hasPages ? (
                    <Button
                      variant="outline" size="sm" className="w-full rounded-full text-[10px] h-6 gap-1"
                      onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(pages, template.name) }}
                    >
                      <Download className="h-2.5 w-2.5" />Descarregar{pages.length > 1 ? ` (${pages.length})` : ''}
                    </Button>
                  ) : (
                    <div className="h-6 flex items-center justify-center">
                      <span className="text-[9px] text-muted-foreground italic">Pendente</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">{previewItem?.template.name || 'Pré-visualização'}</DialogTitle>
          {previewItem && previewPage && (
            <>
              <div className="relative bg-muted/30">
                {previewPage.file_name?.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={previewPage.file_url || ''} className="w-full h-[70vh]" title={previewItem.template.name} />
                ) : (
                  <img src={previewPage.file_url || previewPage.thumbnail_url || ''} alt={previewItem.template.name} className="w-full h-auto max-h-[70vh] object-contain" />
                )}
                {previewTotalPages > 1 && (
                  <>
                    <button className={cn('absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70', previewPageIdx === 0 && 'opacity-30 pointer-events-none')} onClick={() => setPreviewPageIdx(i => Math.max(0, i - 1))}>
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button className={cn('absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70', previewPageIdx >= previewTotalPages - 1 && 'opacity-30 pointer-events-none')} onClick={() => setPreviewPageIdx(i => Math.min(previewTotalPages - 1, i + 1))}>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="p-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{previewItem.template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIT_CATEGORY_LABELS[previewItem.template.category] || previewItem.template.category}
                    {previewTotalPages > 1 && ` · Página ${previewPageIdx + 1} de ${previewTotalPages}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {previewTotalPages > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      {previewItem.pages.map((_, i) => (
                        <button key={i} className={cn('h-1.5 rounded-full transition-all', i === previewPageIdx ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30')} onClick={() => setPreviewPageIdx(i)} />
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs" onClick={() => handleDownloadTemplate(previewItem.pages, previewItem.template.name)}>
                    <Download className="h-3.5 w-3.5" />Descarregar{previewTotalPages > 1 ? ` Todos (${previewTotalPages})` : ''}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
