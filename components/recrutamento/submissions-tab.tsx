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
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getEntrySubmissions,
  updateEntrySubmission,
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
                      <span className="font-medium text-sm">{sub.full_name}</span>
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
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submissao de {viewing?.full_name}
            </DialogTitle>
            <DialogDescription>
              Submetido em{" "}
              {viewing &&
                format(new Date(viewing.submitted_at), "dd/MM/yyyy 'as' HH:mm", {
                  locale: pt,
                })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            {viewing && (
              <div className="flex flex-col gap-4">
                {/* Documents */}
                {(viewing.id_document_front_url ||
                  viewing.id_document_back_url ||
                  viewing.professional_photo_url) && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Documentos</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewing.id_document_front_url && (
                        <a
                          href={viewing.id_document_front_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          CC Frente
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {viewing.id_document_back_url && (
                        <a
                          href={viewing.id_document_back_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          CC Verso
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {viewing.professional_photo_url && (
                        <a
                          href={viewing.professional_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Foto Profissional
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Personal Data */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">
                    Dados Pessoais
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Nome Completo" value={viewing.full_name} />
                    <FieldDisplay label="Nome Profissional" value={viewing.display_name} />
                    <FieldDisplay label="Data de Nascimento" value={viewing.date_of_birth} />
                    <FieldDisplay label="Naturalidade" value={viewing.naturalidade} />
                    <FieldDisplay label="Estado Civil" value={viewing.estado_civil} />
                    <FieldDisplay label="NIF" value={viewing.nif} />
                    <FieldDisplay label="NISS" value={viewing.niss} />
                    <FieldDisplay label="N.o CC" value={viewing.cc_number} />
                    <FieldDisplay label="Validade CC" value={viewing.cc_expiry} />
                    <FieldDisplay label="Data Emissao CC" value={viewing.cc_issue_date} />
                  </div>
                </div>

                <Separator />

                {/* Contacts */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Contactos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Morada Completa" value={viewing.full_address} />
                    <FieldDisplay label="Telemovel Profissional" value={viewing.professional_phone} />
                    <FieldDisplay label="Email Pessoal" value={viewing.personal_email} />
                    <FieldDisplay label="Contacto Emergencia" value={viewing.emergency_contact_name} />
                    <FieldDisplay label="Tel. Emergencia" value={viewing.emergency_contact_phone} />
                  </div>
                </div>

                <Separator />

                {/* Email Suggestions */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">
                    Sugestoes de Email Profissional
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <FieldDisplay label="Opcao 1" value={viewing.email_suggestion_1} />
                    <FieldDisplay label="Opcao 2" value={viewing.email_suggestion_2} />
                    <FieldDisplay label="Opcao 3" value={viewing.email_suggestion_3} />
                  </div>
                </div>

                <Separator />

                {/* Experience */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Experiencia</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay
                      label="Experiencia em Vendas"
                      value={viewing.has_sales_experience ? "Sim" : "Nao"}
                    />
                    <FieldDisplay
                      label="Experiencia Imobiliaria"
                      value={viewing.has_real_estate_experience ? "Sim" : "Nao"}
                    />
                    {viewing.previous_agency && (
                      <FieldDisplay
                        label="Agencia Anterior"
                        value={viewing.previous_agency}
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {/* Social */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Redes Sociais</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Instagram" value={viewing.instagram_handle} />
                    <FieldDisplay label="Facebook" value={viewing.facebook_page} />
                  </div>
                </div>

                <Separator />

                {/* Review Notes */}
                <div>
                  <Label htmlFor="review-notes">Notas de Revisao</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Notas sobre esta submissao..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </ScrollArea>

          {viewing && viewing.status === "pending" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleAction(viewing.id, "rejected")}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Rejeitar
              </Button>
              <Button
                onClick={() => handleAction(viewing.id, "approved")}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Aprovar
              </Button>
            </DialogFooter>
          )}

          {viewing && viewing.status !== "pending" && (
            <DialogFooter>
              <Badge
                className={cn(
                  "text-sm px-3 py-1",
                  STATUS_MAP[viewing.status]?.color
                )}
              >
                {STATUS_MAP[viewing.status]?.label}
              </Badge>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FieldDisplay({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  )
}
