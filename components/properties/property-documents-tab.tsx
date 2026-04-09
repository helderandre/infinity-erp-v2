'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/shared/empty-state'
import { ComposeEmailDialog } from '@/components/email/compose-email-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FileText,
  Download,
  Eye,
  AlertTriangle,
  Calendar,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Mail,
  X,
  Upload,
  CheckSquare,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/constants'
import { toast } from 'sonner'

interface PropertyDoc {
  id: string
  file_name: string
  file_url: string
  valid_until: string | null
  status: string
  created_at: string
  doc_type: { id: string; name: string; category: string | null } | null
  uploaded_by_user: { id: string; commercial_name: string } | null
  owner_id?: string | null
}

interface PropertyDocumentsTabProps {
  propertyId: string
}

type ExpiryStatus = 'expired' | 'critical' | 'soon' | 'ok' | 'none'

function getExpiryStatus(validUntil: string | null): { status: ExpiryStatus; daysLeft: number | null } {
  if (!validUntil) return { status: 'none', daysLeft: null }
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(validUntil)
  expiry.setHours(0, 0, 0, 0)
  const diff = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { status: 'expired', daysLeft: diff }
  if (diff <= 14) return { status: 'critical', daysLeft: diff }
  if (diff <= 60) return { status: 'soon', daysLeft: diff }
  return { status: 'ok', daysLeft: diff }
}

const STATUS_STYLES: Record<ExpiryStatus, { dot: string; text: string; bg: string; label: string }> = {
  expired: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Expirado' },
  critical: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800', label: 'Crítico' },
  soon: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', label: 'Em breve' },
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Válido' },
  none: { dot: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800', label: 'Sem validade' },
}

// ─── Tab definitions ─────────────────────────────────────────────
type DocTab = 'todos' | 'imovel' | 'contratual' | 'proprietario'

const TABS: { key: DocTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'imovel', label: 'Imóvel' },
  { key: 'contratual', label: 'Contratual' },
  { key: 'proprietario', label: 'Proprietário' },
]

function tabFor(category: string | null | undefined): DocTab {
  const c = (category || '').toLowerCase()
  if (c.startsWith('proprietário') || c.startsWith('proprietario')) return 'proprietario'
  if (c.startsWith('contratual')) return 'contratual'
  // Imóvel + Jurídico + Jurídico Especial all go under "imovel"
  return 'imovel'
}

export function PropertyDocumentsTab({ propertyId }: PropertyDocumentsTabProps) {
  const [propertyDocs, setPropertyDocs] = useState<PropertyDoc[]>([])
  const [ownerDocs, setOwnerDocs] = useState<PropertyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<PropertyDoc | null>(null)
  const [activeTab, setActiveTab] = useState<DocTab>('todos')

  // Selection mode (only active when user clicks "Seleccionar")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [extractingAll, setExtractingAll] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Edit / delete state
  const [editDoc, setEditDoc] = useState<PropertyDoc | null>(null)
  const [editName, setEditName] = useState('')
  const [editValidUntil, setEditValidUntil] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [deleteDoc, setDeleteDoc] = useState<PropertyDoc | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setPropertyDocs(data.property_documents || [])
        setOwnerDocs(data.owner_documents || [])
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const allDocs = useMemo(() => [...propertyDocs, ...ownerDocs], [propertyDocs, ownerDocs])

  // Counts per tab
  const tabCounts = useMemo(() => {
    const counts: Record<DocTab, number> = { todos: allDocs.length, imovel: 0, contratual: 0, proprietario: 0 }
    for (const doc of allDocs) {
      const t = tabFor(doc.doc_type?.category)
      counts[t]++
    }
    return counts
  }, [allDocs])

  // Filtered docs for active tab
  const visibleDocs = useMemo(() => {
    if (activeTab === 'todos') return allDocs
    return allDocs.filter((d) => tabFor(d.doc_type?.category) === activeTab)
  }, [allDocs, activeTab])

  // Selection helpers (operate on visible docs)
  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true)
    setSelected(new Set(visibleDocs.map((d) => d.id)))
  }, [visibleDocs])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelected(new Set())
  }, [])

  const selectedDocs = useMemo(
    () => allDocs.filter((d) => selected.has(d.id)),
    [allDocs, selected]
  )

  // Extract validity dates with AI
  const extractValidities = useCallback(async (docIds?: string[]) => {
    setExtractingAll(true)
    const tId = toast.loading(docIds ? `A extrair datas para ${docIds.length} documento(s)...` : 'A extrair datas com IA...')
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents/extract-validity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docIds ? { doc_ids: docIds } : {}),
      })
      const data = await res.json()
      toast.dismiss(tId)
      if (!res.ok) throw new Error(data.error || 'Erro')
      toast.success(`${data.updated} de ${data.total} datas extraídas`)
      fetchDocs()
    } catch (err: any) {
      toast.dismiss(tId)
      toast.error(err.message || 'Erro ao extrair datas')
    } finally {
      setExtractingAll(false)
    }
  }, [propertyId, fetchDocs])

  const extractSingleValidity = useCallback(async (docId: string) => {
    setExtractingId(docId)
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents/extract-validity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ids: [docId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const result = data.results?.[0]
      if (result?.valid_until) {
        toast.success(`Data extraída: ${formatDate(result.valid_until)}`)
      } else {
        toast.error('Não foi possível extrair a data deste documento')
      }
      fetchDocs()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao extrair data')
    } finally {
      setExtractingId(null)
    }
  }, [propertyId, fetchDocs])

  // Edit / delete handlers
  const openEdit = useCallback((doc: PropertyDoc) => {
    setEditDoc(doc)
    setEditName(doc.file_name)
    setEditValidUntil(doc.valid_until || '')
    setEditFile(null)
  }, [])

  const closeEdit = useCallback(() => {
    setEditDoc(null)
    setEditFile(null)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editDoc) return
    setSavingEdit(true)
    try {
      let res: Response
      if (editFile) {
        const fd = new FormData()
        fd.append('file', editFile)
        if (editName.trim()) fd.append('file_name', editName.trim())
        fd.append('valid_until', editValidUntil)
        res = await fetch(`/api/documents/${editDoc.id}`, { method: 'PUT', body: fd })
      } else {
        res = await fetch(`/api/documents/${editDoc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: editName.trim() || editDoc.file_name,
            valid_until: editValidUntil || null,
          }),
        })
      }
      if (!res.ok) throw new Error('Erro')
      toast.success('Documento actualizado')
      closeEdit()
      fetchDocs()
    } catch {
      toast.error('Erro ao actualizar documento')
    } finally {
      setSavingEdit(false)
    }
  }, [editDoc, editFile, editName, editValidUntil, closeEdit, fetchDocs])

  const confirmDelete = useCallback(async () => {
    if (!deleteDoc) return
    try {
      const res = await fetch(`/api/documents/${deleteDoc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Documento eliminado')
      setDeleteDoc(null)
      fetchDocs()
    } catch {
      toast.error('Erro ao eliminar documento')
    }
  }, [deleteDoc, fetchDocs])

  const confirmBulkDelete = useCallback(async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const tId = toast.loading(`A eliminar ${ids.length} documento(s)...`)
    let failed = 0
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
          if (!res.ok) failed++
        } catch {
          failed++
        }
      })
    )
    toast.dismiss(tId)
    if (failed === 0) {
      toast.success(`${ids.length} documento(s) eliminado(s)`)
    } else {
      toast.error(`${ids.length - failed} eliminado(s) · ${failed} falharam`)
    }
    setBulkDeleteOpen(false)
    exitSelectionMode()
    fetchDocs()
  }, [selected, exitSelectionMode, fetchDocs])

  // Bulk download
  const downloadSelected = useCallback(async () => {
    if (selectedDocs.length === 0) return
    toast.success(`A descarregar ${selectedDocs.length} documento(s)...`)
    for (const doc of selectedDocs) {
      try {
        const res = await fetch(doc.file_url)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.file_name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        await new Promise((r) => setTimeout(r, 200))
      } catch {
        window.open(doc.file_url, '_blank')
      }
    }
  }, [selectedDocs])

  // ─── Bulk upload with AI classification + validity extraction ──
  const handleBulkUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const tId = toast.loading(`A classificar ${files.length} ficheiro(s)...`)

    try {
      // 1. Classify
      const classifyForm = new FormData()
      Array.from(files).forEach((f) => classifyForm.append('files', f))
      const classifyRes = await fetch('/api/documents/classify', {
        method: 'POST',
        body: classifyForm,
      })
      if (!classifyRes.ok) throw new Error('Erro na classificação')
      const { data: classified } = await classifyRes.json()

      // 2. Upload each file with the classified doc_type_id
      toast.dismiss(tId)
      const uploadId = toast.loading(`A carregar ${files.length} ficheiro(s)...`)
      const uploadedIds: string[] = []
      const uploadedForLegalExtract: { file: File; docTypeName: string; docTypeCategory: string; docId: string }[] = []
      let skipped = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const match = classified?.find((c: any) => c.index === i)
        const docTypeId = match?.doc_type_id
        if (!docTypeId) {
          skipped++
          continue
        }

        const fd = new FormData()
        fd.append('file', file)
        fd.append('doc_type_id', docTypeId)
        fd.append('property_id', propertyId)

        const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: fd })
        if (uploadRes.ok) {
          const { id } = await uploadRes.json()
          if (id) {
            uploadedIds.push(id)
            uploadedForLegalExtract.push({
              file,
              docTypeName: match?.doc_type_name || '',
              docTypeCategory: match?.doc_type_category || '',
              docId: id,
            })
          }
        } else {
          skipped++
        }
      }

      toast.dismiss(uploadId)

      if (uploadedIds.length === 0) {
        toast.error(`Nenhum documento foi carregado (${skipped} falharam ou não classificados)`)
        return
      }

      toast.success(`${uploadedIds.length} documento(s) carregado(s)${skipped > 0 ? ` · ${skipped} ignorado(s)` : ''}`)

      // 3. Extract validity for the just-uploaded ones (background)
      const extractId = toast.loading('A extrair validades...')
      try {
        const extractRes = await fetch(`/api/properties/${propertyId}/documents/extract-validity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_ids: uploadedIds }),
        })
        const extractData = await extractRes.json()
        toast.dismiss(extractId)
        if (extractRes.ok) {
          toast.success(`${extractData.updated} de ${extractData.total} validades extraídas`)
        }
      } catch {
        toast.dismiss(extractId)
      }

      // 4. Extract legal_data (Caderneta Predial + Certidão CRP) → dev_property_legal_data
      // Filtra para os documentos legais relevantes
      const legalDocs = uploadedForLegalExtract.filter((d) => {
        const name = (d.docTypeName || '').toLowerCase()
        const cat = (d.docTypeCategory || '').toLowerCase()
        return (
          name.includes('caderneta') ||
          name.includes('certidão') ||
          name.includes('certidao') ||
          cat.includes('jurídico') ||
          cat.includes('juridico') ||
          cat.includes('imóvel') ||
          cat.includes('imovel')
        )
      })

      if (legalDocs.length > 0) {
        const legalId = toast.loading('A extrair dados legais (Caderneta/CRP)...')
        try {
          const legalForm = new FormData()
          const docTypesArr: { name: string; category: string }[] = []
          const docIdsArr: string[] = []
          for (const d of legalDocs) {
            legalForm.append('files', d.file)
            docTypesArr.push({ name: d.docTypeName, category: d.docTypeCategory })
            docIdsArr.push(d.docId)
          }
          legalForm.append('doc_types', JSON.stringify(docTypesArr))
          legalForm.append('property_id', propertyId)
          legalForm.append('doc_registry_ids', JSON.stringify(docIdsArr))

          const legalRes = await fetch('/api/documents/extract', {
            method: 'POST',
            body: legalForm,
          })
          toast.dismiss(legalId)
          if (legalRes.ok) {
            const j = await legalRes.json()
            if (j.legal_data_saved) {
              toast.success(`${j.legal_data_fields_set} campo(s) legal(is) extraído(s)`)
            }
          }
        } catch {
          toast.dismiss(legalId)
        }
      }

      fetchDocs()
    } catch (err: any) {
      toast.dismiss(tId)
      toast.error(err.message || 'Erro ao carregar documentos')
    } finally {
      setUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }, [propertyId, fetchDocs])

  // Alerts: expired + soon-expiring (sorted by urgency)
  const alerts = useMemo(() => {
    return allDocs
      .map((doc) => ({ doc, ...getExpiryStatus(doc.valid_until) }))
      .filter((d) => d.status === 'expired' || d.status === 'critical' || d.status === 'soon')
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
  }, [allDocs])

  // Group visible docs by category for display
  const groupedDocs = useMemo(() => {
    const groups: Record<string, PropertyDoc[]> = {}
    for (const doc of visibleDocs) {
      const cat = doc.doc_type?.category || 'Outros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(doc)
    }
    return groups
  }, [visibleDocs])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-10 rounded-full w-72" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={(e) => handleBulkUpload(e.target.files)}
      />

      {/* ─── Tabs + actions row ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); if (selectionMode) exitSelectionMode() }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all',
                activeTab === tab.key
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {tab.label}
              <span className={cn(
                'text-[9px] rounded-full px-1.5 py-0',
                activeTab === tab.key ? 'bg-white/20 dark:bg-neutral-900/20' : 'bg-muted-foreground/10'
              )}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {selectionMode ? (
            <>
              <span className="text-xs text-muted-foreground">
                {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={downloadSelected}
                disabled={selected.size === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Descarregar
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setComposeOpen(true)}
                disabled={selected.size === 0}
              >
                <Mail className="h-3.5 w-3.5" />
                Enviar por email
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selected.size === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={exitSelectionMode}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={() => extractValidities()}
                disabled={extractingAll || allDocs.length === 0}
              >
                {extractingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Extrair datas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={enterSelectionMode}
                disabled={visibleDocs.length === 0}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Seleccionar
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? 'A carregar...' : 'Adicionar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Two-column layout: alerts sidebar + docs list ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Alerts sidebar */}
        <aside className="space-y-3">
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Próximos Alertas</h3>
              {alerts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">{alerts.length}</Badge>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6 gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                <p className="text-xs text-muted-foreground">Nenhum documento a expirar nos próximos 60 dias.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(({ doc, status, daysLeft }) => {
                  const styles = STATUS_STYLES[status]
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={cn('w-full text-left rounded-lg border px-3 py-2 cursor-pointer hover:shadow-sm transition-all', styles.bg)}
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{doc.doc_type?.name || doc.file_name}</p>
                          {doc.doc_type?.category && (
                            <p className="text-[10px] text-muted-foreground truncate">{doc.doc_type.category}</p>
                          )}
                        </div>
                        <span className={cn('h-2 w-2 rounded-full mt-1 shrink-0', styles.dot)} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Clock className={cn('h-3 w-3', styles.text)} />
                        <p className={cn('text-[10px] font-medium', styles.text)}>
                          {status === 'expired'
                            ? `Expirado há ${Math.abs(daysLeft!)} ${Math.abs(daysLeft!) === 1 ? 'dia' : 'dias'}`
                            : daysLeft === 0
                              ? 'Expira hoje'
                              : `Expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Documents list */}
        <div>
        {visibleDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sem documentos"
            description={activeTab === 'todos'
              ? 'Os documentos carregados na angariação aparecerão aqui.'
              : 'Não existem documentos nesta categoria.'}
          />
        ) : (
          <div className="space-y-5">
          {Object.entries(groupedDocs).map(([category, docs]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
                <span className="ml-1.5 text-muted-foreground/60">({docs.length})</span>
              </h3>
              <div className="rounded-xl border overflow-hidden divide-y">
                {docs.map((doc) => {
                  const { status, daysLeft } = getExpiryStatus(doc.valid_until)
                  const styles = STATUS_STYLES[status]
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      {selectionMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(doc.id)}
                            onCheckedChange={() => toggleSelected(doc.id)}
                            aria-label="Seleccionar"
                          />
                        </div>
                      )}
                      <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.doc_type?.name || doc.file_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="truncate">{doc.file_name}</span>
                          {doc.uploaded_by_user?.commercial_name && (
                            <>
                              <span>·</span>
                              <span className="truncate">{doc.uploaded_by_user.commercial_name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {doc.valid_until ? (
                          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium', styles.bg, styles.text)}>
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(doc.valid_until)}</span>
                            {(status === 'expired' || status === 'critical') && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Sem validade</span>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          onClick={(e) => { e.stopPropagation(); extractSingleValidity(doc.id) }}
                          title="Extrair data com IA"
                          disabled={extractingId === doc.id}
                        >
                          {extractingId === doc.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          onClick={(e) => { e.stopPropagation(); window.open(doc.file_url, '_blank', 'noopener,noreferrer') }}
                          title="Abrir em nova aba"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch(doc.file_url)
                              const blob = await res.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = doc.file_name
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            } catch {
                              window.open(doc.file_url, '_blank', 'noopener,noreferrer')
                            }
                          }}
                          title="Descarregar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => openEdit(doc)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDoc(doc)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" />Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          </div>
        )}
        </div>
      </div>

      {/* Preview modal — portal so it escapes any transformed ancestor */}
      {previewDoc && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-card rounded-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{previewDoc.doc_type?.name || previewDoc.file_name}</p>
                <p className="text-xs text-muted-foreground truncate">{previewDoc.file_name}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-8"
                  onClick={() => window.open(previewDoc.file_url, '_blank', 'noopener,noreferrer')}
                >
                  Abrir em nova aba
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setPreviewDoc(null)}>
                  Fechar
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-muted/30 overflow-hidden min-h-0">
              {previewDoc.file_name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.file_url}
                  className="w-full h-full border-0"
                  title={previewDoc.file_name}
                />
              ) : (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                  <img src={previewDoc.file_url} alt={previewDoc.file_name} className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Compose email dialog with selected docs as attachments */}
      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        initialSubject={`Documentos do imóvel (${selectedDocs.length})`}
        initialAiInstruction={`Escreve um email curto e profissional em português de Portugal para enviar ${selectedDocs.length} documento(s) referente(s) a um imóvel. Lista os documentos pelo nome no corpo do email. Documentos: ${selectedDocs.map((d) => d.doc_type?.name || d.file_name).join(', ')}.`}
        initialPathAttachments={selectedDocs.map((d) => ({ filename: d.file_name, url: d.file_url }))}
        onSent={() => {
          setComposeOpen(false)
          exitSelectionMode()
        }}
      />

      {/* Edit dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) closeEdit() }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
            <DialogDescription>
              Altere o nome, a validade ou substitua o ficheiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do ficheiro</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Validade</label>
              <Input
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ficheiro</label>
              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setEditFile(null)}
                  >
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
            <Button className="w-full rounded-full" disabled={savingEdit} onClick={saveEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documentos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar {selected.size} documento{selected.size !== 1 ? 's' : ''}? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmBulkDelete}
            >
              Eliminar {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => { if (!o) setDeleteDoc(null) }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar &quot;{deleteDoc?.doc_type?.name || deleteDoc?.file_name}&quot;? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
