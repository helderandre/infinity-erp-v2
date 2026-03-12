"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { format, isPast, parseISO } from "date-fns"
import { pt } from "date-fns/locale"
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MessageSquareText,
  Search,
  ExternalLink,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getAgents,
  getContentRequests,
  upsertContentRequest,
  updateRequestStatus,
} from "@/app/dashboard/marketing/redes-sociais/actions"
import type {
  MarketingContentRequest,
  RequestStatus,
  SocialPlatform,
  ContentType,
} from "@/types/marketing-social"
import {
  REQUEST_STATUS,
  SOCIAL_PLATFORMS,
  CONTENT_TYPES,
} from "@/types/marketing-social"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─── Types ──────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  commercial_name: string
  professional_email: string
  is_active: boolean
}

interface CreateFormData {
  agent_id: string
  title: string
  description: string
  platform: SocialPlatform
  content_type: ContentType
  deadline: string
  property_reference: string
  assigned_to: string
}

const EMPTY_FORM: CreateFormData = {
  agent_id: "",
  title: "",
  description: "",
  platform: "instagram",
  content_type: "post",
  deadline: "",
  property_reference: "",
  assigned_to: "",
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SocialPedidosTab() {
  const [requests, setRequests] = useState<MarketingContentRequest[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const [form, setForm] = useState<CreateFormData>(EMPTY_FORM)
  const [selectedRequest, setSelectedRequest] = useState<MarketingContentRequest | null>(null)
  const [editDraftUrl, setEditDraftUrl] = useState("")
  const [editDraftNotes, setEditDraftNotes] = useState("")
  const [changesNotes, setChangesNotes] = useState("")
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [reqResult, agentResult] = await Promise.all([
      getContentRequests(
        statusFilter !== "all" ? (statusFilter as RequestStatus) : undefined,
        agentFilter !== "all" ? agentFilter : undefined
      ),
      getAgents(),
    ])

    if (reqResult.error) toast.error("Erro ao carregar pedidos: " + reqResult.error)
    if (agentResult.error) toast.error("Erro ao carregar consultores: " + agentResult.error)

    setRequests(reqResult.requests)
    setAgents((agentResult.agents ?? []) as Agent[])
    setLoading(false)
  }, [statusFilter, agentFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Filtered Requests ──────────────────────────────────────────────────

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests
    const q = searchQuery.toLowerCase()
    return requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.agent?.commercial_name?.toLowerCase().includes(q) ||
        r.property_reference?.toLowerCase().includes(q)
    )
  }, [requests, searchQuery])

  // ─── Status Counts ──────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of Object.keys(REQUEST_STATUS)) counts[s] = 0
    for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1
    return counts
  }, [requests])

  // ─── Handlers ───────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.agent_id || !form.title.trim()) {
      toast.error("Preencha o consultor e o titulo.")
      return
    }
    setActionLoading("create")
    const { error } = await upsertContentRequest({
      agent_id: form.agent_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      platform: form.platform,
      content_type: form.content_type,
      deadline: form.deadline || null,
      property_reference: form.property_reference.trim() || null,
      assigned_to: form.assigned_to || null,
    })
    setActionLoading(null)
    if (error) {
      toast.error("Erro ao criar pedido: " + error)
      return
    }
    toast.success("Pedido criado com sucesso")
    setCreateOpen(false)
    setForm(EMPTY_FORM)
    fetchData()
  }

  async function handleStatusChange(id: string, newStatus: RequestStatus, notes?: string) {
    setActionLoading(id)
    const { error } = await updateRequestStatus(id, newStatus, notes)
    setActionLoading(null)
    if (error) {
      toast.error("Erro ao actualizar estado: " + error)
      return
    }
    toast.success(`Estado actualizado para "${REQUEST_STATUS[newStatus].label}"`)
    fetchData()
  }

  async function handleSaveDetail() {
    if (!selectedRequest) return
    setActionLoading("detail")
    const { error } = await upsertContentRequest({
      id: selectedRequest.id,
      agent_id: selectedRequest.agent_id,
      title: selectedRequest.title,
      draft_url: editDraftUrl || null,
      draft_notes: editDraftNotes || null,
      status: selectedRequest.status,
    })
    setActionLoading(null)
    if (error) {
      toast.error("Erro ao guardar: " + error)
      return
    }
    toast.success("Pedido actualizado")
    setDetailOpen(false)
    fetchData()
  }

  function openDetail(req: MarketingContentRequest) {
    setSelectedRequest(req)
    setEditDraftUrl(req.draft_url || "")
    setEditDraftNotes(req.draft_notes || "")
    setDetailOpen(true)
  }

  function openChangesDialog(id: string) {
    setCancelTarget(id)
    setChangesNotes("")
    setNotesDialogOpen(true)
  }

  function confirmChangesRequested() {
    if (!cancelTarget) return
    handleStatusChange(cancelTarget, "changes_requested", changesNotes || undefined)
    setNotesDialogOpen(false)
    setCancelTarget(null)
  }

  function openCancelDialog(id: string) {
    setCancelTarget(id)
    setCancelDialogOpen(true)
  }

  function confirmCancel() {
    if (!cancelTarget) return
    handleStatusChange(cancelTarget, "cancelled")
    setCancelDialogOpen(false)
    setCancelTarget(null)
  }

  // ─── Render Helpers ─────────────────────────────────────────────────────

  function renderDeadline(deadline: string | null) {
    if (!deadline) return <span className="text-muted-foreground text-sm">--</span>
    const date = parseISO(deadline)
    const overdue = isPast(date)
    return (
      <span className={cn("text-sm", overdue && "text-red-600 font-medium")}>
        {overdue && <AlertCircle className="inline mr-1 h-3.5 w-3.5" />}
        {format(date, "dd/MM/yyyy", { locale: pt })}
      </span>
    )
  }

  function renderActions(req: MarketingContentRequest) {
    const isLoading = actionLoading === req.id

    switch (req.status) {
      case "pending":
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleStatusChange(req.id, "in_progress")}
            >
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
              Iniciar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={() => openCancelDialog(req.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      case "in_progress":
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleStatusChange(req.id, "draft_ready")}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Rascunho Pronto
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={() => openCancelDialog(req.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      case "draft_ready":
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              disabled={isLoading}
              onClick={() => handleStatusChange(req.id, "approved")}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => openChangesDialog(req.id)}
            >
              <MessageSquareText className="mr-1 h-3.5 w-3.5" />
              Pedir Alteracoes
            </Button>
          </div>
        )
      case "changes_requested":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => handleStatusChange(req.id, "draft_ready")}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Rascunho Pronto
          </Button>
        )
      case "approved":
        return (
          <Button
            size="sm"
            variant="default"
            disabled={isLoading}
            onClick={() => handleStatusChange(req.id, "completed")}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Concluir
          </Button>
        )
      default:
        return null
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary Badges */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(REQUEST_STATUS) as RequestStatus[]).map((s) => (
          <Badge
            key={s}
            variant="secondary"
            className={cn("text-xs", REQUEST_STATUS[s].color)}
          >
            {REQUEST_STATUS[s].label}: {statusCounts[s] || 0}
          </Badge>
        ))}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por titulo, consultor ou ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(REQUEST_STATUS) as RequestStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUEST_STATUS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.commercial_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true) }}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Pedido
          </Button>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Clock className="mr-2 h-5 w-5 animate-spin" />
              A carregar pedidos...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquareText className="mb-2 h-10 w-10" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Accoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(req)}
                  >
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {req.title}
                      {req.property_reference && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({req.property_reference})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.agent?.commercial_name || "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SOCIAL_PLATFORMS[req.platform] || req.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CONTENT_TYPES[req.content_type] || req.content_type}
                    </TableCell>
                    <TableCell>{renderDeadline(req.deadline)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", REQUEST_STATUS[req.status]?.color)}>
                        {REQUEST_STATUS[req.status]?.label || req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {renderActions(req)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Conteudo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Consultor *</Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar consultor" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Post de novo imovel na Av. Liberdade"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes sobre o que pretende..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Plataforma</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v as SocialPlatform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {SOCIAL_PLATFORMS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Tipo de Conteudo</Label>
                <Select
                  value={form.content_type}
                  onValueChange={(v) => setForm({ ...form, content_type: v as ContentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTENT_TYPES) as ContentType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONTENT_TYPES[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Ref. Imovel</Label>
                <Input
                  value={form.property_reference}
                  onChange={(e) => setForm({ ...form, property_reference: e.target.value })}
                  placeholder="Ex: INF-001"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Atribuir a</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nao atribuido" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={actionLoading === "create"}>
                {actionLoading === "create" ? "A criar..." : "Criar Pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Detail / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Titulo:</span>
                  <p className="font-medium">{selectedRequest.title}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Consultor:</span>
                  <p className="font-medium">{selectedRequest.agent?.commercial_name || "--"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plataforma:</span>
                  <p>{SOCIAL_PLATFORMS[selectedRequest.platform]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p>{CONTENT_TYPES[selectedRequest.content_type]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prazo:</span>
                  <p>{selectedRequest.deadline ? format(parseISO(selectedRequest.deadline), "dd/MM/yyyy", { locale: pt }) : "--"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge className={cn("text-xs", REQUEST_STATUS[selectedRequest.status]?.color)}>
                    {REQUEST_STATUS[selectedRequest.status]?.label}
                  </Badge>
                </div>
                {selectedRequest.property_reference && (
                  <div>
                    <span className="text-muted-foreground">Ref. Imovel:</span>
                    <p>{selectedRequest.property_reference}</p>
                  </div>
                )}
                {selectedRequest.assigned?.commercial_name && (
                  <div>
                    <span className="text-muted-foreground">Atribuido a:</span>
                    <p>{selectedRequest.assigned.commercial_name}</p>
                  </div>
                )}
              </div>

              {selectedRequest.description && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Descricao:</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}

              {selectedRequest.approval_notes && (
                <div className="text-sm rounded-md bg-muted p-3">
                  <span className="font-medium text-muted-foreground">Notas de aprovacao:</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{selectedRequest.approval_notes}</p>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label>URL do Rascunho</Label>
                <div className="flex gap-2">
                  <Input
                    value={editDraftUrl}
                    onChange={(e) => setEditDraftUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  {editDraftUrl && (
                    <Button
                      size="icon"
                      variant="outline"
                      asChild
                    >
                      <a href={editDraftUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Notas do Rascunho</Label>
                <Textarea
                  value={editDraftNotes}
                  onChange={(e) => setEditDraftNotes(e.target.value)}
                  placeholder="Notas sobre o rascunho..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={handleSaveDetail} disabled={actionLoading === "detail"}>
                  {actionLoading === "detail" ? "A guardar..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Changes Requested Notes Dialog ────────────────────────────────── */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pedir Alteracoes</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Notas sobre as alteracoes pretendidas</Label>
              <Textarea
                value={changesNotes}
                onChange={(e) => setChangesNotes(e.target.value)}
                placeholder="Descreva as alteracoes necessarias..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmChangesRequested}>
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar este pedido? Esta accao nao pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmCancel}
            >
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
