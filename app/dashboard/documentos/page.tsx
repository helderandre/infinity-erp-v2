'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { FormSheet } from '@/components/shared/form-sheet'
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
import {
  CompanyCategoriesProvider,
  useCompanyCategories,
} from '@/components/documents/company-categories-provider'
import { CompanyCategorySelect } from '@/components/documents/company-category-select'
import { CompanyCategoryAddButton } from '@/components/documents/company-category-add-button'
import { CompanyCategoryFormDialog } from '@/components/documents/company-category-form-dialog'
import { CompanyCategoryDeleteDialog } from '@/components/documents/company-category-delete-dialog'
import { CompanyCategorySectionHeader } from '@/components/documents/company-category-section-header'
import type { CompanyDocumentCategory } from '@/hooks/use-company-document-categories'

import {
  MarketingDesignCategoriesProvider,
  useMarketingDesignCategoriesContext,
} from '@/components/marketing/design-categories/marketing-design-categories-provider'
import { MarketingDesignCategorySelect } from '@/components/marketing/design-categories/marketing-design-category-select'
import { MarketingDesignCategoryAddButton } from '@/components/marketing/design-categories/marketing-design-category-add-button'
import { MarketingDesignCategoryFormDialog } from '@/components/marketing/design-categories/marketing-design-category-form-dialog'
import { MarketingDesignCategoryDeleteDialog } from '@/components/marketing/design-categories/marketing-design-category-delete-dialog'
import { MarketingDesignCategorySectionHeader } from '@/components/marketing/design-categories/marketing-design-category-section-header'
import type { MarketingDesignCategory } from '@/hooks/use-marketing-design-categories'
import { KIT_CATEGORY_TO_DESIGN_SLUG } from '@/lib/marketing/kit-category-map'
import {
  usePersonalDesigns,
  type PersonalDesign as PersonalDesignType,
} from '@/hooks/use-personal-designs'
import { PersonalDesignCard } from '@/components/marketing/personal-design-card'
import { PersonalDesignFormDialog } from '@/components/marketing/personal-design-form-dialog'
import { PersonalDesignPreviewDialog } from '@/components/marketing/personal-design-preview-dialog'

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

type Tab = 'documentos' | 'templates'

export default function BibliotecaPage() {
  return (
    <CompanyCategoriesProvider>
      <BibliotecaPageContent />
    </CompanyCategoriesProvider>
  )
}

function BibliotecaPageContent() {
  const [tab, setTab] = useState<Tab>('documentos')

  const tabs: { key: Tab; label: string; icon: typeof Library }[] = [
    { key: 'documentos', label: 'Documentos', icon: Library },
    { key: 'templates', label: 'Marketing', icon: FileImage },
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
      {tab === 'templates' && (
        <MarketingDesignCategoriesProvider>
          <MarketingTemplatesTab />
        </MarketingDesignCategoriesProvider>
      )}
    </div>
  )
}

// ─── Documentos Tab ───

function DocumentosTab() {
  const { getLabel, getCategory, activeCategories } = useCompanyCategories()
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<CompanyDocument | null>(null)
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('angariacao')
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<{ file: File; name: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category management UI state
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<CompanyDocumentCategory | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<CompanyDocumentCategory | null>(null)
  /**
   * After the create-category dialog resolves, the new slug is assigned to
   * this ref target so we know whether to auto-select it in the filter or in
   * the upload dialog. `null` = no pending target.
   */
  const [pendingCategoryTarget, setPendingCategoryTarget] = useState<
    'filter' | 'upload' | 'edit' | null
  >(null)

  // Keep uploadCategory in sync with the first available active category
  useEffect(() => {
    if (activeCategories.length === 0) return
    if (!activeCategories.some((c) => c.slug === uploadCategory)) {
      setUploadCategory(activeCategories[0].slug)
    }
  }, [activeCategories, uploadCategory])

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
      let res: Response
      if (editFile) {
        const fd = new FormData()
        fd.append('name', editName)
        fd.append('category', editCategory)
        fd.append('file', editFile)
        res = await fetch(`/api/company-documents/${editDoc.id}`, {
          method: 'PUT',
          body: fd,
        })
      } else {
        res = await fetch(`/api/company-documents/${editDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName, category: editCategory }),
        })
      }
      if (!res.ok) throw new Error()
      toast.success('Documento actualizado')
      setEditDoc(null)
      setEditFile(null)
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
      for (const item of uploadFiles) {
        formData.append('files', item.file)
        formData.append('names', item.name)
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
        <CompanyCategorySelect
          value={category}
          onValueChange={setCategory}
          includeAllOption
          triggerClassName="w-[200px]"
        />
        <CompanyCategoryAddButton
          onClick={() => {
            setCategoryToEdit(null)
            setPendingCategoryTarget('filter')
            setCategoryFormOpen(true)
          }}
        />
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
                <CompanyCategorySectionHeader
                  slug={cat as string}
                  label={getLabel(cat as string)}
                  count={(docs as CompanyDocument[]).length}
                  category={getCategory(cat as string)}
                  onEdit={(c) => {
                    setCategoryToEdit(c)
                    setPendingCategoryTarget(null)
                    setCategoryFormOpen(true)
                  }}
                  onDelete={(c) => setCategoryToDelete(c)}
                  onAddDocument={(c) => {
                    setUploadCategory(c.slug)
                    setUploadOpen(true)
                  }}
                />
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
                    {getLabel(previewDoc.category)}
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

      {/* Upload Sheet */}
      <FormSheet
        open={uploadOpen}
        onOpenChange={(open) => { if (!open) { setUploadOpen(false); setUploadFiles([]) } else { setUploadOpen(true) } }}
        title="Carregar Documentos"
        description="Seleccione a categoria e os ficheiros para carregar."
      >
        <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CompanyCategorySelect
                    value={uploadCategory}
                    onValueChange={setUploadCategory}
                  />
                </div>
                <CompanyCategoryAddButton
                  onClick={() => {
                    setCategoryToEdit(null)
                    setPendingCategoryTarget('upload')
                    setCategoryFormOpen(true)
                  }}
                  label="Nova"
                />
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || [])
                if (f.length) {
                  const items = f.map((file) => ({ file, name: file.name.replace(/\.\w+$/, '').replace(/[_-]/g, ' ').trim() }))
                  setUploadFiles((p) => [...p, ...items])
                }
                e.target.value = ''
              }} />
            <button
              className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-6 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Clique para seleccionar ficheiros</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Imagens · Pode seleccionar vários</p>
            </button>
            {uploadFiles.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadFiles.map((item, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="flex-1 truncate">{item.file.name}</span>
                      <span className="shrink-0">{formatFileSize(item.file.size)}</span>
                      <button className="hover:text-destructive shrink-0" onClick={() => setUploadFiles((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <Input
                      value={item.name}
                      onChange={(e) => setUploadFiles((p) => p.map((it, j) => j === i ? { ...it, name: e.target.value } : it))}
                      placeholder="Nome do documento"
                      className="h-8 rounded-full text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full rounded-full gap-2" disabled={uploadFiles.length === 0 || uploading} onClick={handleUpload}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />A carregar...</> : <><Upload className="h-4 w-4" />Carregar {uploadFiles.length} ficheiro{uploadFiles.length !== 1 ? 's' : ''}</>}
            </Button>
          </div>
      </FormSheet>

      {/* Edit Sheet */}
      <FormSheet
        open={!!editDoc}
        onOpenChange={(open) => { if (!open) { setEditDoc(null); setEditFile(null) } }}
        title="Editar Documento"
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CompanyCategorySelect
                    value={editCategory}
                    onValueChange={setEditCategory}
                  />
                </div>
                <CompanyCategoryAddButton
                  onClick={() => {
                    setCategoryToEdit(null)
                    setPendingCategoryTarget('edit')
                    setCategoryFormOpen(true)
                  }}
                  label="Nova"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ficheiro</label>
              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setEditFile(f)
                  e.target.value = ''
                }}
              />
              {editFile ? (
                <div className="flex items-center gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{editFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(editFile.size)}</span>
                  <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setEditFile(null)} type="button">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs rounded-lg bg-muted/20 px-3 py-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground">{editDoc?.file_name}</span>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline shrink-0"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    Substituir
                  </button>
                </div>
              )}
            </div>
            <Button className="w-full rounded-full" disabled={saving} onClick={handleEdit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
      </FormSheet>

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

      {/* Category Create/Edit Dialog */}
      <CompanyCategoryFormDialog
        open={categoryFormOpen}
        onOpenChange={(next) => {
          setCategoryFormOpen(next)
          if (!next) {
            setCategoryToEdit(null)
            setPendingCategoryTarget(null)
          }
        }}
        category={categoryToEdit}
        onSaved={(slug) => {
          if (pendingCategoryTarget === 'filter') {
            setCategory(slug)
          } else if (pendingCategoryTarget === 'upload') {
            setUploadCategory(slug)
          } else if (pendingCategoryTarget === 'edit') {
            setEditCategory(slug)
          }
          setPendingCategoryTarget(null)
          fetchDocuments()
        }}
      />

      {/* Category Delete Dialog */}
      <CompanyCategoryDeleteDialog
        open={!!categoryToDelete}
        onOpenChange={(next) => !next && setCategoryToDelete(null)}
        category={categoryToDelete}
        onDeleted={() => {
          // If we were filtering by the just-deleted category, reset
          if (categoryToDelete && category === categoryToDelete.slug) {
            setCategory('all')
          }
          fetchDocuments()
        }}
      />
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

// Emoji fallback used only when a template row has no thumbnail — resolved
// lazily from the dynamic category label when available, otherwise shows a
// generic icon. The hardcoded DESIGN_CATEGORIES / DESIGN_CATEGORY_ICONS maps
// were removed in favour of `marketing_design_categories` (dynamic).

function MarketingTemplatesTab() {
  const [subTab, setSubTab] = useState<'personal' | 'team'>('personal')

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex items-center justify-center sm:justify-start gap-4">
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

      {subTab === 'personal' ? <KitConsultorTab /> : <TeamDesignsTab />}
    </>
  )
}

// ─── Team Designs Tab (CRUD) ───

interface TeamDesignFormState {
  id: string | null
  name: string
  category: string
  canva_url: string
  thumbnail_url: string
}

const EMPTY_TEAM_DESIGN: TeamDesignFormState = {
  id: null,
  name: '',
  category: 'placas',
  canva_url: '',
  thumbnail_url: '',
}

function TeamDesignsTab() {
  const { activeCategories, getLabel, getCategory } =
    useMarketingDesignCategoriesContext()
  const [templates, setTemplates] = useState<DesignTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<TeamDesignFormState>(EMPTY_TEAM_DESIGN)
  const [saving, setSaving] = useState(false)
  const [thumbUploading, setThumbUploading] = useState(false)
  const [deleteDesign, setDeleteDesign] = useState<DesignTemplate | null>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  // Category management dialogs
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<MarketingDesignCategory | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<MarketingDesignCategory | null>(null)
  const [pendingCategoryTarget, setPendingCategoryTarget] = useState<
    'filter' | 'form' | null
  >(null)

  // Default the form category to the first active category once loaded
  useEffect(() => {
    if (activeCategories.length === 0) return
    if (!activeCategories.some((c) => c.slug === form.category)) {
      setForm((p) => ({ ...p, category: activeCategories[0].slug }))
    }
  }, [activeCategories, form.category])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('team', 'true')
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/marketing/design-templates?${params}`)
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filtered = search
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates

  const grouped = filtered.reduce<Record<string, DesignTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  const openCreate = () => {
    setForm(EMPTY_TEAM_DESIGN)
    setFormOpen(true)
  }

  const openEdit = (t: DesignTemplate) => {
    setForm({
      id: t.id,
      name: t.name,
      category: t.category,
      canva_url: t.canva_url || '',
      thumbnail_url: t.thumbnail_url || '',
    })
    setFormOpen(true)
  }

  const handleThumbUpload = async (file: File) => {
    setThumbUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/marketing/design-templates/upload-thumbnail', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { url } = await res.json()
      setForm((p) => ({ ...p, thumbnail_url: url }))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar imagem')
    } finally {
      setThumbUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        canva_url: form.canva_url.trim() || null,
        thumbnail_url: form.thumbnail_url || null,
        is_team_design: true,
      }
      const url = form.id
        ? `/api/marketing/design-templates/${form.id}`
        : '/api/marketing/design-templates'
      const method = form.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(form.id ? 'Design actualizado' : 'Design criado')
      setFormOpen(false)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar design')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDesign) return
    try {
      const res = await fetch(`/api/marketing/design-templates/${deleteDesign.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Design eliminado')
      setDeleteDesign(null)
      fetchTemplates()
    } catch {
      toast.error('Erro ao eliminar design')
    }
  }

  return (
    <>
      {/* Filters + Add */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <div
          className={cn(
            'shrink-0',
            '[&_button[data-slot=select-trigger]]:w-9 [&_button[data-slot=select-trigger]]:h-9 [&_button[data-slot=select-trigger]]:px-0 [&_button[data-slot=select-trigger]]:justify-center',
            'sm:[&_button[data-slot=select-trigger]]:w-[200px] sm:[&_button[data-slot=select-trigger]]:h-auto sm:[&_button[data-slot=select-trigger]]:px-3 sm:[&_button[data-slot=select-trigger]]:justify-between'
          )}
        >
          <MarketingDesignCategorySelect
            value={category}
            onValueChange={setCategory}
            includeAllOption
          />
        </div>
        <MarketingDesignCategoryAddButton
          onClick={() => {
            setCategoryToEdit(null)
            setPendingCategoryTarget('filter')
            setCategoryFormOpen(true)
          }}
        />
        <Button
          className="rounded-full shrink-0 w-9 h-9 p-0 sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:gap-2"
          onClick={openCreate}
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
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
          title="Nenhum design encontrado"
          description={search ? 'Tente ajustar a pesquisa.' : 'Adicione o primeiro design da equipa.'}
          action={{ label: 'Adicionar', onClick: openCreate }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <MarketingDesignCategorySectionHeader
                slug={cat}
                label={getLabel(cat)}
                count={(items as DesignTemplate[]).length}
                category={getCategory(cat)}
                onEdit={(c) => {
                  setCategoryToEdit(c)
                  setPendingCategoryTarget(null)
                  setCategoryFormOpen(true)
                }}
                onDelete={(c) => setCategoryToDelete(c)}
                onAddDesign={(c) => {
                  setForm({ ...EMPTY_TEAM_DESIGN, category: c.slug })
                  setFormOpen(true)
                }}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'group relative rounded-xl border overflow-hidden hover:shadow-md transition-all',
                      t.canva_url ? 'cursor-pointer' : 'cursor-default'
                    )}
                    onClick={() => {
                      if (t.canva_url) window.open(t.canva_url, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    <div className="block">
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
                          <span className="text-3xl">📁</span>
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-medium truncate uppercase">{t.name}</p>
                      </div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(t) }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white text-destructive"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteDesign(t) }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Sheet */}
      <FormSheet
        open={formOpen}
        onOpenChange={(open) => { if (!open) setFormOpen(false) }}
        title={form.id ? 'Editar Design' : 'Adicionar Design'}
        description="Adicione o link Canva e a imagem de capa do design."
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Placa de Venda Standard"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MarketingDesignCategorySelect
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, category: v }))
                    }
                  />
                </div>
                <MarketingDesignCategoryAddButton
                  onClick={() => {
                    setCategoryToEdit(null)
                    setPendingCategoryTarget('form')
                    setCategoryFormOpen(true)
                  }}
                  label="Nova"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link Canva</label>
              <Input
                value={form.canva_url}
                onChange={(e) => setForm((p) => ({ ...p, canva_url: e.target.value }))}
                placeholder="https://www.canva.com/design/..."
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Imagem de capa</label>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleThumbUpload(file)
                  e.target.value = ''
                }}
              />
              {form.thumbnail_url ? (
                <div className="relative rounded-xl overflow-hidden border aspect-[4/3] bg-muted">
                  <img src={form.thumbnail_url} alt="Capa" className="w-full h-full object-cover" />
                  <button
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white"
                    onClick={() => thumbInputRef.current?.click()}
                    title="Alterar imagem"
                    type="button"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-6 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={thumbUploading}
                >
                  {thumbUploading ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground/40 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-medium">Carregar imagem</p>
                      <p className="text-[10px] text-muted-foreground mt-1">PNG, JPEG ou WebP · Máx 5MB</p>
                    </>
                  )}
                </button>
              )}
            </div>
            <Button className="w-full rounded-full" disabled={saving || thumbUploading} onClick={handleSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.id ? 'Guardar' : 'Adicionar')}
            </Button>
          </div>
      </FormSheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDesign} onOpenChange={(open) => !open && setDeleteDesign(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar design</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar &quot;{deleteDesign?.name}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Create/Edit Dialog */}
      <MarketingDesignCategoryFormDialog
        open={categoryFormOpen}
        onOpenChange={(next) => {
          setCategoryFormOpen(next)
          if (!next) {
            setCategoryToEdit(null)
            setPendingCategoryTarget(null)
          }
        }}
        category={categoryToEdit}
        onSaved={(slug) => {
          if (pendingCategoryTarget === 'filter') {
            setCategory(slug)
          } else if (pendingCategoryTarget === 'form') {
            setForm((p) => ({ ...p, category: slug }))
          }
          setPendingCategoryTarget(null)
          fetchTemplates()
        }}
      />

      {/* Category Delete Dialog */}
      <MarketingDesignCategoryDeleteDialog
        open={!!categoryToDelete}
        onOpenChange={(next) => !next && setCategoryToDelete(null)}
        category={categoryToDelete}
        onDeleted={() => {
          if (categoryToDelete && category === categoryToDelete.slug) {
            setCategory('all')
          }
          fetchTemplates()
        }}
      />
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
  const { activeCategories, getCategory } = useMarketingDesignCategoriesContext()
  const [items, setItems] = useState<AgentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [previewItem, setPreviewItem] = useState<AgentMaterial | null>(null)
  const [previewPageIdx, setPreviewPageIdx] = useState(0)

  // Personal designs — merged inline with kit items
  const personal = usePersonalDesigns(userId)

  // Filter / dialog state for the unified view
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [personalFormOpen, setPersonalFormOpen] = useState(false)
  const [personalFormDesign, setPersonalFormDesign] = useState<PersonalDesignType | null>(null)
  const [personalFormCategoryDefault, setPersonalFormCategoryDefault] = useState<string | undefined>()
  const [personalPreview, setPersonalPreview] = useState<PersonalDesignType | null>(null)
  const [personalDeleteTarget, setPersonalDeleteTarget] = useState<PersonalDesignType | null>(null)
  const [categoryDialogOpenFromKit, setCategoryDialogOpenFromKit] = useState(false)

  const fetchMaterials = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/consultants/${userId}/materials`)
      const data = await res.json()
      const HIDDEN_CATEGORIES = ['relatorio_imovel', 'estudo_mercado']
      const filtered = Array.isArray(data)
        ? data.filter((item: AgentMaterial) => !HIDDEN_CATEGORIES.includes(item.template.category))
        : []
      setItems(filtered)
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

  // Merge kit items + personal designs, grouped by dynamic design-category slug.
  // Kit items resolve via KIT_CATEGORY_TO_DESIGN_SLUG (fallback `outro`).
  const activeSlugSet = new Set(activeCategories.map((c) => c.slug))

  const resolveKitSlug = (kitCategory: string): string => {
    const raw = KIT_CATEGORY_TO_DESIGN_SLUG[
      kitCategory as keyof typeof KIT_CATEGORY_TO_DESIGN_SLUG
    ] as string | undefined
    return raw && activeSlugSet.has(raw) ? raw : 'outro'
  }

  const searchQ = search.trim().toLowerCase()
  const matchesSearch = (name: string) =>
    !searchQ || name.toLowerCase().includes(searchQ)
  const matchesFilter = (slug: string) =>
    categoryFilter === 'all' || categoryFilter === slug

  const mergedGroups = (() => {
    const map = new Map<
      string,
      { kit: AgentMaterial[]; personal: PersonalDesignType[] }
    >()
    const ensure = (slug: string) => {
      if (!map.has(slug)) map.set(slug, { kit: [], personal: [] })
      return map.get(slug)!
    }

    for (const item of items) {
      const slug = resolveKitSlug(item.template.category)
      if (!matchesFilter(slug)) continue
      if (!matchesSearch(item.template.name)) continue
      ensure(slug).kit.push(item)
    }
    for (const d of personal.items) {
      const slug = d.category?.slug ?? 'outro'
      const effective = activeSlugSet.has(slug) ? slug : 'outro'
      if (!matchesFilter(effective)) continue
      if (!matchesSearch(d.name)) continue
      ensure(effective).personal.push(d)
    }

    const ordered: {
      slug: string
      kit: AgentMaterial[]
      personal: PersonalDesignType[]
    }[] = []
    for (const cat of activeCategories) {
      const g = map.get(cat.slug)
      if (g && (g.kit.length > 0 || g.personal.length > 0)) {
        ordered.push({ slug: cat.slug, ...g })
      }
    }
    for (const [slug, g] of map.entries()) {
      if (!ordered.some((o) => o.slug === slug)) {
        ordered.push({ slug, ...g })
      }
    }
    return ordered
  })()

  const hasAnything = items.length > 0 || personal.items.length > 0
  const hasAnythingAfterFilter = mergedGroups.some(
    (g) => g.kit.length > 0 || g.personal.length > 0
  )

  const openPersonalCreate = (slug?: string) => {
    setPersonalFormDesign(null)
    setPersonalFormCategoryDefault(slug)
    setPersonalFormOpen(true)
  }
  const openPersonalEdit = (d: PersonalDesignType) => {
    setPersonalFormDesign(d)
    setPersonalFormCategoryDefault(undefined)
    setPersonalFormOpen(true)
  }
  const handlePersonalDelete = async () => {
    if (!personalDeleteTarget) return
    try {
      await personal.deleteDesign(personalDeleteTarget.id)
      toast.success('Design eliminado')
      setPersonalDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar design')
    }
  }

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

  if (loading || personal.loading || !userId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Progress — kit only */}
      {items.length > 0 && (
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
      )}

      {/* Unified filter bar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar kit ou designs pessoais…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
        <div
          className={cn(
            'shrink-0',
            '[&_button[data-slot=select-trigger]]:w-9 [&_button[data-slot=select-trigger]]:h-9 [&_button[data-slot=select-trigger]]:px-0 [&_button[data-slot=select-trigger]]:justify-center',
            'sm:[&_button[data-slot=select-trigger]]:w-[200px] sm:[&_button[data-slot=select-trigger]]:h-auto sm:[&_button[data-slot=select-trigger]]:px-3 sm:[&_button[data-slot=select-trigger]]:justify-between'
          )}
        >
          <MarketingDesignCategorySelect
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            includeAllOption
          />
        </div>
        <MarketingDesignCategoryAddButton
          onClick={() => setCategoryDialogOpenFromKit(true)}
        />
        <Button
          className="rounded-full shrink-0 w-9 h-9 p-0 sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:gap-2"
          onClick={() => openPersonalCreate()}
          title="Adicionar design"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Adicionar design</span>
        </Button>
      </div>

      {/* Unified grouped view — kit + personal together */}
      {!hasAnything ? (
        <EmptyState
          icon={Blocks}
          title="Sem designs"
          description="Adicione o teu primeiro design pessoal ou aguarde o kit da equipa."
          action={{ label: 'Adicionar design', onClick: () => openPersonalCreate() }}
        />
      ) : !hasAnythingAfterFilter ? (
        <EmptyState
          icon={FileImage}
          title="Nenhum design corresponde à pesquisa"
          description="Tente ajustar a pesquisa ou limpar o filtro de categoria."
        />
      ) : (
        <div className="space-y-6">
          {mergedGroups.map(({ slug, kit: kitGroup, personal: personalGroup }) => {
            const cat = getCategory(slug)
            const total = kitGroup.length + personalGroup.length
            return (
              <div key={slug} className="space-y-3">
                <MarketingDesignCategorySectionHeader
                  slug={slug}
                  label={cat?.label ?? slug}
                  count={total}
                  category={cat}
                  onAddDesign={(c) => openPersonalCreate(c.slug)}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {/* Kit items */}
                  {kitGroup.map(({ template, pages }) => {
                    const hasPages = pages.length > 0
                    const cover = pages[0]
                    return (
                      <div
                        key={`kit-${template.id}`}
                        className={cn(
                          'rounded-lg border p-2 space-y-1.5 transition-all',
                          hasPages
                            ? 'bg-card/50 border-border cursor-pointer hover:shadow-sm'
                            : 'bg-muted/10 border-dashed opacity-60'
                        )}
                        onClick={() => {
                          if (hasPages) {
                            setPreviewItem({ template, pages })
                            setPreviewPageIdx(0)
                          }
                        }}
                      >
                        {hasPages && cover ? (
                          <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
                            <img
                              src={cover.thumbnail_url || cover.file_url || ''}
                              alt={template.name}
                              className="w-full h-full object-cover"
                            />
                            {pages.length > 1 && (
                              <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                                {pages.length} pág.
                              </span>
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
                            variant="outline"
                            size="sm"
                            className="w-full rounded-full text-[10px] h-6 gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadTemplate(pages, template.name)
                            }}
                          >
                            <Download className="h-2.5 w-2.5" />
                            Descarregar{pages.length > 1 ? ` (${pages.length})` : ''}
                          </Button>
                        ) : (
                          <div className="h-6 flex items-center justify-center">
                            <span className="text-[9px] text-muted-foreground italic">Pendente</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Personal designs */}
                  {personalGroup.map((d) => (
                    <PersonalDesignCard
                      key={`personal-${d.id}`}
                      design={d}
                      onOpen={setPersonalPreview}
                      onEdit={openPersonalEdit}
                      onDelete={setPersonalDeleteTarget}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Personal design dialogs */}
      <PersonalDesignFormDialog
        open={personalFormOpen}
        onOpenChange={setPersonalFormOpen}
        design={personalFormDesign}
        defaultCategory={personalFormCategoryDefault}
        onCreateWithFile={async (fd) => { await personal.uploadDesign(fd) }}
        onCreateLink={async (payload) => { await personal.createLinkDesign(payload) }}
        onUpdate={async (id, payload) => { await personal.updateDesign(id, payload) }}
      />
      <PersonalDesignPreviewDialog
        design={personalPreview}
        onOpenChange={(open) => !open && setPersonalPreview(null)}
      />
      <AlertDialog
        open={!!personalDeleteTarget}
        onOpenChange={(open) => !open && setPersonalDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar design</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar &quot;{personalDeleteTarget?.name}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handlePersonalDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarketingDesignCategoryFormDialog
        open={categoryDialogOpenFromKit}
        onOpenChange={setCategoryDialogOpenFromKit}
        onSaved={(slug) => setCategoryFilter(slug)}
      />

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
