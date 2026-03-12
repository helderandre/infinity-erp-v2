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
  Filter,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getEntrySubmissions,
  updateEntrySubmission,
  type EntrySubmission,
} from "@/app/dashboard/recrutamento/actions"

import { Card } from "@/components/ui/card"
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
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="text-muted-foreground h-4 w-4" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">
          {submissions.length} submiss{submissions.length === 1 ? "ao" : "oes"}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <div className="p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b py-3 last:border-0">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : submissions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Nenhuma submissao encontrada
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telemovel</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[80px]">Accoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => {
                const status = STATUS_MAP[sub.status] || STATUS_MAP.pending
                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.full_name}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {sub.personal_email || "-"}
                    </TableCell>
                    <TableCell>{sub.professional_phone || "-"}</TableCell>
                    <TableCell>{sub.nif || "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", status.color)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(sub.submitted_at), "dd/MM/yyyy HH:mm", {
                        locale: pt,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setViewing(sub)
                          setReviewNotes(sub.notes || "")
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
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
