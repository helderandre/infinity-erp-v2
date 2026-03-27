"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Wand2,
  Download,
  Pencil,
  Check,
  X,
  Monitor,
  Smartphone,
  Printer,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getEntrySubmissions,
  updateEntrySubmission,
  getContractTemplates,
  type EntrySubmission,
} from "@/app/dashboard/recrutamento/actions"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConsultantPhotoCropper } from "@/components/consultants/consultant-photo-cropper"
import { ContractEditor } from "@/components/recrutamento/contract-editor"

// Number to Portuguese words (for commission %)
function numberToPortuguese(n: number): string {
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove']
  const tens = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  if (n === 0) return 'zero'
  if (n === 100) return 'cem'

  const parts: string[] = []
  const h = Math.floor(n / 100)
  const remainder = n % 100
  const t = Math.floor(remainder / 10)
  const u = remainder % 10

  if (h > 0) parts.push(hundreds[h])
  if (remainder >= 10 && remainder < 20) {
    parts.push(teens[remainder - 10])
  } else {
    if (t > 0) parts.push(tens[t])
    if (u > 0) parts.push(units[u])
  }

  return parts.join(' e ')
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-800" },
  approved: { label: "Aprovado", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800" },
}

export function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<EntrySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [viewing, setViewing] = useState<EntrySubmission | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [generatingContract, setGeneratingContract] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)

  // AI extraction from ID documents
  const handleAiExtract = useCallback(async () => {
    if (!viewing?.id_document_front_url || !viewing?.id_document_back_url) {
      toast.error('Frente e verso do CC são necessários para extracção.')
      return
    }
    setExtracting(true)
    try {
      const res = await fetch('/api/entry-form/extract-id-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front_url: viewing.id_document_front_url,
          back_url: viewing.id_document_back_url,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro na extracção')
      }
      const { extracted } = await res.json()

      if (extracted) {
        // Only merge fields that are reliably on the CC document
        // Don't override estado_civil, display_name, or other manual fields
        const ccFields = ['full_name', 'document_type', 'cc_number', 'cc_expiry', 'cc_issue_date', 'date_of_birth', 'nif', 'niss', 'naturalidade']
        const updates: Record<string, any> = {}
        for (const key of ccFields) {
          const val = extracted[key]
          if (val && val !== 'null') updates[key] = val
        }
        // Update local state
        setViewing(prev => prev ? { ...prev, ...updates } : prev)
        // Persist to database
        if (viewing?.id && Object.keys(updates).length > 0) {
          const { error } = await updateEntrySubmission(viewing.id, updates)
          if (error) {
            toast.error('Dados extraídos mas erro ao guardar na base de dados')
          } else {
            toast.success('Dados extraídos e guardados com sucesso!')
            fetchSubmissions() // Refresh the list
          }
        } else {
          toast.success('Dados extraídos com sucesso! Verifique os campos.')
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao extrair dados do documento.')
    } finally {
      setExtracting(false)
    }
  }, [viewing])

  // Contract generation via HTML templates
  const [contractTemplates, setContractTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [contractHtml, setContractHtml] = useState<string>('')
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [comissao, setComissao] = useState<string>('50')
  const [dataContrato, setDataContrato] = useState<string>(new Date().toISOString().slice(0, 10))

  const handleGenerateContract = useCallback(async () => {
    if (!viewing) return
    setGeneratingContract(true)
    try {
      // Fetch templates if not loaded
      let templates = contractTemplates
      if (templates.length === 0) {
        const { templates: t, error } = await getContractTemplates()
        if (error) throw new Error(error)
        templates = t
        setContractTemplates(t)
      }

      if (templates.length === 0) {
        // Auto-seed the default contract template
        try {
          const seedRes = await fetch('/api/entry-form/seed-contract-template', { method: 'POST' })
          if (seedRes.ok) {
            const { templates: t2, error: e2 } = await getContractTemplates()
            if (!e2 && t2.length > 0) {
              templates = t2
              setContractTemplates(t2)
            }
          }
        } catch {}

        if (templates.length === 0) {
          toast.error('Erro ao criar template de contrato.')
          return
        }
      }

      // Auto-select if only one, or use selected
      const tplId = selectedTemplateId || templates[0]?.id
      if (!tplId) { toast.error('Seleccione um template'); return }

      const template = templates.find((t: any) => t.id === tplId)
      if (!template) { toast.error('Template não encontrado'); return }

      // Build variables from submission — matches both short keys and long PDF keys
      const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
      const vars: Record<string, string> = {
        // Short keys (used in HTML templates)
        nome_completo: viewing.full_name || '',
        nome_profissional: viewing.display_name || '',
        tipo_documento: viewing.document_type || 'Cartão de Cidadão',
        cc_numero: viewing.cc_number || '',
        cc_validade: viewing.cc_expiry || '',
        cc_data_emissao: viewing.cc_issue_date || '',
        data_nascimento: viewing.date_of_birth || '',
        nif: viewing.nif || '',
        niss: viewing.niss || '',
        naturalidade: viewing.naturalidade || '',
        estado_civil: viewing.estado_civil || '',
        morada_completa: viewing.full_address || '',
        telemovel: viewing.professional_phone || '',
        email_pessoal: viewing.personal_email || '',
        email: viewing.personal_email || '',
        contacto_emergencia: viewing.emergency_contact_name || '',
        telefone_emergencia: viewing.emergency_contact_phone || '',
        data_contrato: dataContrato
          ? new Date(dataContrato).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
          : today,
        data_hoje: today,
        empresa: 'Infinity Group',
        comissao_percentagem: comissao,
        comissao_extenso: numberToPortuguese(parseInt(comissao) || 50),
        // Long keys (from original PDF placeholders)
        'Nome completo': viewing.full_name || '',
        'Morada Completa (Incluir código postal):': viewing.full_address || '',
        'Número do CC (Incluindo os 3 dígitos finais), BI ou Passaporte': viewing.cc_number || '',
        'Validade do documento de Identificação': viewing.cc_expiry || '',
        'Número de Contribuinte': viewing.nif || '',
      }

      // Replace variables in HTML
      let html = template.content_html as string
      for (const [key, value] of Object.entries(vars)) {
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }

      setContractHtml(html)
      setShowContractPreview(true)
      toast.success('Contrato gerado — revise e imprima como PDF')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar contrato.')
    } finally {
      setGeneratingContract(false)
    }
  }, [viewing, contractTemplates, selectedTemplateId])

  const handlePrintContract = (htmlOverride?: string) => {
    const html = htmlOverride || contractHtml
    const printWindow = window.open('', '_blank')
    if (!printWindow) { toast.error('Popup bloqueado — permita popups para imprimir'); return }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Contrato — ${viewing?.full_name || 'Consultor'}</title>
        <style>
          @page { size: A4; margin: 2.5cm 2.5cm 2.5cm 2.5cm; }
          body {
            font-family: 'Times New Roman', 'Georgia', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            text-align: justify;
            margin: 0;
            padding: 0;
          }
          h2, h3 { text-align: center; font-size: 12pt; margin-top: 1.5em; margin-bottom: 0.5em; page-break-after: avoid; break-after: avoid; }
          h2 { font-size: 14pt; }
          h3 + p { page-break-before: avoid; break-before: avoid; }
          p { margin: 0.5em 0; text-align: justify; orphans: 3; widows: 3; }
          ol { margin: 0.5em 0 0.5em 1.5em; page-break-before: avoid; break-before: avoid; }
          li { margin-bottom: 0.4em; text-align: justify; page-break-inside: avoid; break-inside: avoid; }
          strong { font-weight: bold; }
          .page-break { page-break-before: always !important; break-before: page !important; height: 0; margin: 0; padding: 0; }
          @media print {
            body { margin: 0; }
            .page-break { page-break-before: always !important; break-before: page !important; }
          }
        </style>
      </head><body>${html.replace(/<hr[^>]*data-page-break[^>]*>/gi, '<div class="page-break"></div>')}</body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    const status = filterStatus === "all" ? undefined : filterStatus
    const { submissions: data, error } = await getEntrySubmissions(status)
    if (error) toast.error("Erro ao carregar submissoes")
    else setSubmissions(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleAction = useCallback(
    async (id: string, action: "approved" | "rejected") => {
      setActionLoading(true)
      const { error } = await updateEntrySubmission(id, {
        status: action,
        notes: reviewNotes || undefined,
        reviewed_at: new Date().toISOString(),
      })
      setActionLoading(false)

      if (error) {
        toast.error("Erro ao actualizar submissao")
      } else {
        toast.success(
          action === "approved"
            ? "Submissao aprovada com sucesso"
            : "Submissao rejeitada"
        )
        setViewing(null)
        setReviewNotes("")
        fetchSubmissions()
      }
    },
    [reviewNotes, fetchSubmissions]
  )

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
          {([
            { value: "all", label: "Todas" },
            { value: "pending", label: "Pendentes", dot: "#f59e0b" },
            { value: "approved", label: "Aprovadas", dot: "#10b981" },
            { value: "rejected", label: "Rejeitadas", dot: "#ef4444" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap",
                filterStatus === opt.value
                  ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {opt.dot && <span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: opt.dot }} />}
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-xs ml-auto">
          {submissions.length} submiss{submissions.length === 1 ? "ão" : "ões"}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhuma submissão encontrada</h3>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou aguarde novas submissões.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead>Nome</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub, idx) => {
                const status = STATUS_MAP[sub.status] || STATUS_MAP.pending
                const dotColor = sub.status === "approved" ? "#10b981" : sub.status === "rejected" ? "#ef4444" : "#f59e0b"
                return (
                  <TableRow
                    key={sub.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-1"
                    style={{ animationDelay: `${idx * 20}ms`, animationFillMode: "backwards" }}
                    onClick={() => { setViewing(sub); setReviewNotes(sub.notes || "") }}
                  >
                    <TableCell>
                      <span className="font-medium text-sm">{sub.display_name || sub.full_name || 'Sem nome'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {sub.personal_email && <span>{sub.personal_email}</span>}
                        {sub.professional_phone && <span>{sub.professional_phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{sub.nif || "—"}</span></TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${dotColor}15`, color: dotColor }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(sub.submitted_at), "dd/MM/yyyy", { locale: pt })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) {
            setViewing(null)
            setReviewNotes("")
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          {/* Modern header with photo */}
          <div className="relative bg-neutral-900 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-white text-lg font-bold">
                  {viewing?.display_name || viewing?.full_name || 'Submissão'}
                </DialogTitle>
                <DialogDescription className="text-neutral-400 text-xs mt-1">
                  Submetido em{" "}
                  {viewing &&
                    format(new Date(viewing.submitted_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: pt,
                    })}
                </DialogDescription>
                {/* Document links + AI extract */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {viewing?.id_document_front_url && (
                    <a href={viewing.id_document_front_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-neutral-300 hover:bg-white/20 transition-colors">
                      <ImageIcon className="h-3 w-3" />CC Frente
                    </a>
                  )}
                  {viewing?.id_document_back_url && (
                    <a href={viewing.id_document_back_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-neutral-300 hover:bg-white/20 transition-colors">
                      <ImageIcon className="h-3 w-3" />CC Verso
                    </a>
                  )}
                  {viewing?.id_document_front_url && viewing?.id_document_back_url && (
                    <button onClick={handleAiExtract} disabled={extracting}
                      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] text-white hover:bg-white/25 transition-colors disabled:opacity-50">
                      {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      {extracting ? 'A extrair...' : 'Extrair com IA'}
                    </button>
                  )}
                  {/* Edit toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (editMode && viewing) {
                        // Save edited fields
                        fetch(`/api/entry-form/submissions/${viewing.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            full_name: viewing.full_name,
                            display_name: viewing.display_name,
                            document_type: viewing.document_type,
                            cc_number: viewing.cc_number,
                            cc_expiry: viewing.cc_expiry,
                            cc_issue_date: viewing.cc_issue_date,
                            date_of_birth: viewing.date_of_birth,
                            nif: viewing.nif,
                            niss: viewing.niss,
                            naturalidade: viewing.naturalidade,
                            estado_civil: viewing.estado_civil,
                            full_address: viewing.full_address,
                            professional_phone: viewing.professional_phone,
                            personal_email: viewing.personal_email,
                            emergency_contact_name: viewing.emergency_contact_name,
                            emergency_contact_phone: viewing.emergency_contact_phone,
                            email_suggestion_1: viewing.email_suggestion_1,
                            email_suggestion_2: viewing.email_suggestion_2,
                            email_suggestion_3: viewing.email_suggestion_3,
                            instagram_handle: viewing.instagram_handle,
                            facebook_page: viewing.facebook_page,
                          }),
                        })
                          .then(res => {
                            if (res.ok) {
                              toast.success('Dados guardados com sucesso')
                              fetchSubmissions()
                            } else {
                              toast.error('Erro ao guardar dados')
                            }
                          })
                          .catch(() => toast.error('Erro ao guardar dados'))
                      }
                      setEditMode(!editMode)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] transition-colors ml-auto',
                      editMode ? 'bg-white text-neutral-900' : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                    )}
                  >
                    {editMode ? <><Check className="h-3 w-3" />Guardar</> : <><Pencil className="h-3 w-3" />Editar</>}
                  </button>
                </div>
              </div>
              {/* Photo — clickable for preview */}
              {viewing?.professional_photo_url ? (
                <button type="button" onClick={() => setPhotoPreviewOpen(true)} className="shrink-0 group">
                  <img src={viewing.professional_photo_url} alt="Foto"
                    className="h-16 w-16 rounded-xl object-cover border-2 border-white/20 shadow-lg group-hover:border-white/40 transition-colors"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </button>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-neutral-500" />
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[55vh] px-6 py-4">
            {viewing && (
              <div className="space-y-5">
                {/* Dados de Identificação */}
                <Section title="Dados de Identificação" badge="ID">
                  <FieldChip label="Nome Completo" value={viewing.full_name} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, full_name: v } : prev)} />
                  <FieldChip label="Tipo Documento" value={viewing.document_type || 'Cartão de Cidadão'} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, document_type: v } : prev)} />
                  <FieldChip label="N.º Documento" value={viewing.cc_number} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, cc_number: v } : prev)} />
                  <FieldChip label="Validade CC" value={viewing.cc_expiry} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, cc_expiry: v } : prev)} />
                  <FieldChip label="Data Emissão" value={viewing.cc_issue_date} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, cc_issue_date: v } : prev)} />
                  <FieldChip label="Data de Nascimento" value={viewing.date_of_birth} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, date_of_birth: v } : prev)} />
                  <FieldChip label="NIF" value={viewing.nif} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, nif: v } : prev)} />
                  <FieldChip label="NISS" value={viewing.niss} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, niss: v } : prev)} />
                  <FieldChip label="Naturalidade" value={viewing.naturalidade} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, naturalidade: v } : prev)} />
                </Section>

                {/* Dados Pessoais (manual) */}
                <Section title="Dados Pessoais">
                  <FieldChip label="Nome Profissional" value={viewing.display_name} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, display_name: v } : prev)} />
                  <FieldChip label="Estado Civil" value={viewing.estado_civil} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, estado_civil: v } : prev)} />
                  <FieldChip label="Morada" value={viewing.full_address} wide editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, full_address: v } : prev)} />
                </Section>

                {/* Contactos */}
                <Section title="Contactos">
                  <FieldChip label="Telemóvel" value={viewing.professional_phone} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, professional_phone: v } : prev)} />
                  <FieldChip label="Email Pessoal" value={viewing.personal_email} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, personal_email: v } : prev)} />
                  <FieldChip label="Contacto Emergência" value={viewing.emergency_contact_name} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, emergency_contact_name: v } : prev)} />
                  <FieldChip label="Tel. Emergência" value={viewing.emergency_contact_phone} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, emergency_contact_phone: v } : prev)} />
                </Section>

                {/* Email RE/MAX */}
                <Section title="Sugestões Email RE/MAX">
                  <FieldChip label="Opção 1" value={viewing.email_suggestion_1} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, email_suggestion_1: v } : prev)} />
                  <FieldChip label="Opção 2" value={viewing.email_suggestion_2} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, email_suggestion_2: v } : prev)} />
                  <FieldChip label="Opção 3" value={viewing.email_suggestion_3} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, email_suggestion_3: v } : prev)} />
                </Section>

                {/* Experiência */}
                <Section title="Experiência">
                  <FieldChip label="Exp. Vendas" value={viewing.has_sales_experience ? "Sim" : "Não"} />
                  <FieldChip label="Exp. Imobiliária" value={viewing.has_real_estate_experience ? "Sim" : "Não"} />
                  {viewing.previous_agency && <FieldChip label="Agência Anterior" value={viewing.previous_agency} />}
                </Section>

                {/* Redes Sociais */}
                <Section title="Redes Sociais">
                  <FieldChip label="Instagram" value={viewing.instagram_handle} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, instagram_handle: v } : prev)} />
                  <FieldChip label="Facebook" value={viewing.facebook_page} editing={editMode}
                    onEdit={(v) => setViewing(prev => prev ? { ...prev, facebook_page: v } : prev)} />
                </Section>

                {/* Review Notes */}
                <div>
                  <Label htmlFor="review-notes" className="text-xs font-semibold">Notas de Revisão</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Notas sobre esta submissão..."
                    rows={3}
                    className="mt-1.5 text-sm"
                  />
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Photo Crop/Preview Dialog */}
          {viewing?.professional_photo_url && (
            <ConsultantPhotoCropper
              imageSrc={viewing.professional_photo_url}
              open={photoPreviewOpen}
              onOpenChange={setPhotoPreviewOpen}
              onCropDone={() => {
                toast.success('Foto recortada! (Guardar não implementado ainda)')
                setPhotoPreviewOpen(false)
              }}
              consultantName={viewing.display_name || viewing.full_name || 'Consultor'}
            />
          )}

          {viewing && (
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-t bg-neutral-50/50">
              {/* Left: Status actions */}
              <div className="flex items-center gap-2">
                {viewing.status !== "pending" && (
                  <Badge className={cn("text-xs px-2.5 py-0.5", STATUS_MAP[viewing.status]?.color)}>
                    {STATUS_MAP[viewing.status]?.label}
                  </Badge>
                )}
                {viewing.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 rounded-full h-8 text-xs"
                      onClick={() => handleAction(viewing.id, "rejected")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-full h-8 text-xs"
                      onClick={() => handleAction(viewing.id, "approved")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Aprovar
                    </Button>
                  </>
                )}
              </div>

              {/* Right: Contract generation */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Comissão</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={comissao}
                      onChange={(e) => setComissao(e.target.value)}
                      className="w-14 h-7 rounded-lg border bg-white px-2 pr-5 text-xs font-medium text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Data</label>
                  <input
                    type="date"
                    value={dataContrato}
                    onChange={(e) => setDataContrato(e.target.value)}
                    className="h-7 rounded-lg border bg-white px-2 text-xs font-medium"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={generatingContract}
                  onClick={handleGenerateContract}
                  className="rounded-full h-8 text-xs gap-1.5 bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  {generatingContract ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />A gerar...</>
                  ) : (
                    <><Download className="h-3.5 w-3.5" />Gerar Contrato</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Editor Dialog */}
      <Dialog open={showContractPreview} onOpenChange={setShowContractPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="bg-neutral-900 px-6 py-4">
            <DialogTitle className="text-white text-sm font-bold">
              Contrato — {viewing?.full_name || 'Consultor'}
            </DialogTitle>
            <p className="text-neutral-400 text-[11px] mt-0.5">
              Revise e edite o contrato antes de imprimir como PDF
            </p>
          </div>
          <ScrollArea className="max-h-[75vh]">
            <div className="p-4">
              <ContractEditor
                initialHtml={contractHtml}
                mode="generated"
                onPrint={(html) => {
                  handlePrintContract(html)
                }}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</h4>
        {badge && (
          <span className="inline-flex items-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[8px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  )
}

function FieldChip({
  label,
  value,
  wide,
  editing,
  onEdit,
}: {
  label: string
  value: string | null | undefined
  wide?: boolean
  editing?: boolean
  onEdit?: (value: string) => void
}) {
  const hasValue = !!value?.trim()

  if (editing && onEdit) {
    return (
      <div className={cn('space-y-0.5', wide && 'w-full')}>
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full h-8 rounded-lg border bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (hasValue) {
          navigator.clipboard.writeText(value!)
          toast.success(`"${label}" copiado!`)
        }
      }}
      className={cn(
        'group relative rounded-xl border bg-neutral-50/80 dark:bg-white/5 px-3 py-2 text-left transition-all',
        hasValue && 'hover:bg-neutral-100 dark:hover:bg-white/10 hover:shadow-sm cursor-copy',
        !hasValue && 'opacity-40 cursor-default',
        wide && 'w-full'
      )}
    >
      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
      <p className="text-sm font-medium leading-tight truncate">{value || '—'}</p>
    </button>
  )
}

