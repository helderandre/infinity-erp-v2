"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Phone,
  Mail,
  Loader2,
  UserPlus,
  Clock,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getCandidates,
  createCandidate,
  getRecruiters,
} from "@/app/dashboard/recrutamento/actions"
import type {
  RecruitmentCandidate,
  CandidateSource,
  CandidateStatus,
} from "@/types/recruitment"
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  PIPELINE_STAGES,
} from "@/types/recruitment"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Recruiter {
  id: string
  commercial_name: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusDotColor(status: CandidateStatus): string {
  const colors: Record<CandidateStatus, string> = {
    prospect: "#64748b",
    in_contact: "#3b82f6",
    in_process: "#a855f7",
    decision_pending: "#f59e0b",
    joined: "#10b981",
    declined: "#ef4444",
    on_hold: "#f97316",
  }
  return colors[status]
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter()

  // Data
  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([])
  const [recruiters, setRecruiters] = useState<Recruiter[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSource, setFilterSource] = useState<string>("all")
  const [filterRecruiter, setFilterRecruiter] = useState<string>("all")

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCandidate, setNewCandidate] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "linkedin" as CandidateSource,
    source_detail: "",
    status: "prospect" as CandidateStatus,
    assigned_recruiter_id: "",
    first_contact_date: "",
    notes: "",
  })

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  // Fetch recruiters on mount
  useEffect(() => {
    async function loadRecruiters() {
      const res = await getRecruiters()
      if (res.recruiters) setRecruiters(res.recruiters)
    }
    loadRecruiters()
  }, [])

  // Fetch candidates when filters change
  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    const filters: {
      status?: CandidateStatus
      source?: CandidateSource
      recruiterId?: string
      search?: string
    } = {}
    if (filterStatus !== "all") filters.status = filterStatus as CandidateStatus
    if (filterSource !== "all") filters.source = filterSource as CandidateSource
    if (filterRecruiter !== "all") filters.recruiterId = filterRecruiter
    if (debouncedSearch) filters.search = debouncedSearch

    const { candidates: data, error } = await getCandidates(filters)
    if (error) {
      toast.error("Erro ao carregar candidatos")
    } else {
      setCandidates(data)
    }
    setLoading(false)
  }, [filterStatus, filterSource, filterRecruiter, debouncedSearch])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // Handlers
  const handleCreate = useCallback(async () => {
    if (!newCandidate.full_name.trim()) {
      toast.error("O nome completo e obrigatorio")
      return
    }
    setCreating(true)
    const { error } = await createCandidate({
      full_name: newCandidate.full_name.trim(),
      phone: newCandidate.phone || undefined,
      email: newCandidate.email || undefined,
      source: newCandidate.source,
      source_detail: newCandidate.source_detail || undefined,
      status: newCandidate.status,
      assigned_recruiter_id: newCandidate.assigned_recruiter_id || undefined,
      first_contact_date: newCandidate.first_contact_date || undefined,
      notes: newCandidate.notes || undefined,
    })
    setCreating(false)

    if (error) {
      toast.error("Erro ao criar candidato")
    } else {
      toast.success("Candidato criado com sucesso")
      setCreateOpen(false)
      setNewCandidate({
        full_name: "",
        phone: "",
        email: "",
        source: "linkedin",
        source_detail: "",
        status: "prospect",
        assigned_recruiter_id: "",
        first_contact_date: "",
        notes: "",
      })
      fetchCandidates()
    }
  }, [newCandidate, fetchCandidates])

  const navigateToDetail = useCallback(
    (id: string) => {
      router.push(`/dashboard/recrutamento/${id}`)
    },
    [router]
  )

  const terminalStatuses: CandidateStatus[] = ["joined", "declined"]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pipeline de Recrutamento
          </h1>
          <p className="text-muted-foreground text-sm">
            Vista Kanban do pipeline de candidatos
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/20">
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Pesquisar nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {CANDIDATE_STATUSES[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CANDIDATE_SOURCES[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterRecruiter} onValueChange={setFilterRecruiter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Recrutador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {recruiters.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.commercial_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Candidato
        </Button>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = candidates.filter(
              (c) => c.status === stage
            )
            const statusInfo = CANDIDATE_STATUSES[stage]
            const isTerminal = terminalStatuses.includes(stage)

            return (
              <div
                key={stage}
                className={cn(
                  "flex shrink-0 flex-col rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-3",
                  isTerminal ? "w-[220px]" : "w-[280px]"
                )}
              >
                {/* Column Header */}
                <div className="flex items-center gap-2 border-b p-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getStatusDotColor(stage) }}
                  />
                  <span className="text-sm font-medium">
                    {statusInfo.label}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {stageCandidates.length}
                  </Badge>
                </div>

                {/* Column Content */}
                <div className="flex max-h-[calc(100vh-380px)] flex-col gap-2 overflow-y-auto p-2">
                  {stageCandidates.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      Sem candidatos
                    </p>
                  ) : (
                    stageCandidates.map((candidate) => {
                      const daysSinceInteraction =
                        candidate.last_interaction_date
                          ? differenceInDays(
                              new Date(),
                              new Date(candidate.last_interaction_date)
                            )
                          : null

                      const initials = candidate.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()

                      return (
                        <Card
                          key={candidate.id}
                          className="rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
                          onClick={() => navigateToDetail(candidate.id)}
                        >
                          <CardContent
                            className={cn("p-3", isTerminal && "p-2")}
                          >
                            <div className="flex items-start gap-2">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "truncate font-medium",
                                    isTerminal ? "text-xs" : "text-sm"
                                  )}
                                >
                                  {candidate.full_name}
                                </p>
                                {!isTerminal && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-[10px] font-normal"
                                  >
                                    {CANDIDATE_SOURCES[candidate.source]}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {!isTerminal && (
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {candidate.phone && (
                                    <Phone className="text-muted-foreground h-3 w-3" />
                                  )}
                                  {candidate.email && (
                                    <Mail className="text-muted-foreground h-3 w-3" />
                                  )}
                                </div>
                                {candidate.recruiter && (
                                  <span className="text-muted-foreground max-w-[100px] truncate text-[10px]">
                                    {candidate.recruiter.commercial_name}
                                  </span>
                                )}
                              </div>
                            )}

                            {daysSinceInteraction !== null && (
                              <div
                                className={cn(
                                  "mt-1.5 flex items-center gap-1 text-[10px]",
                                  daysSinceInteraction > 7
                                    ? "text-red-600 font-medium"
                                    : "text-muted-foreground"
                                )}
                              >
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(
                                  new Date(candidate.last_interaction_date!),
                                  { locale: pt, addSuffix: true }
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateCandidateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        creating={creating}
        newCandidate={newCandidate}
        setNewCandidate={setNewCandidate}
        recruiters={recruiters}
        onCreate={handleCreate}
      />
    </div>
  )
}

// ─── Kanban Skeleton ─────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => (
        <div
          key={stage}
          className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-3"
        >
          <div className="flex items-center gap-2 border-b p-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-6 rounded" />
          </div>
          <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Create Candidate Dialog ─────────────────────────────────────────────────

function CreateCandidateDialog({
  open,
  onOpenChange,
  creating,
  newCandidate,
  setNewCandidate,
  recruiters,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  creating: boolean
  newCandidate: {
    full_name: string
    phone: string
    email: string
    source: CandidateSource
    source_detail: string
    status: CandidateStatus
    assigned_recruiter_id: string
    first_contact_date: string
    notes: string
  }
  setNewCandidate: React.Dispatch<
    React.SetStateAction<typeof newCandidate>
  >
  recruiters: Recruiter[]
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Novo Candidato
          </DialogTitle>
          <DialogDescription>
            Adicionar um novo candidato ao pipeline de recrutamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={newCandidate.full_name}
              onChange={(e) =>
                setNewCandidate((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder="Nome completo do candidato"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Telemovel</Label>
              <Input
                id="phone"
                value={newCandidate.phone}
                onChange={(e) =>
                  setNewCandidate((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+351 9XX XXX XXX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newCandidate.email}
                onChange={(e) =>
                  setNewCandidate((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Origem</Label>
              <Select
                value={newCandidate.source}
                onValueChange={(v) =>
                  setNewCandidate((p) => ({
                    ...p,
                    source: v as CandidateSource,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {CANDIDATE_SOURCES[s]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source_detail">Detalhe da Origem</Label>
              <Input
                id="source_detail"
                value={newCandidate.source_detail}
                onChange={(e) =>
                  setNewCandidate((p) => ({
                    ...p,
                    source_detail: e.target.value,
                  }))
                }
                placeholder="Ex: perfil LinkedIn, nome do evento..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Estado Inicial</Label>
              <Select
                value={newCandidate.status}
                onValueChange={(v) =>
                  setNewCandidate((p) => ({
                    ...p,
                    status: v as CandidateStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CANDIDATE_STATUSES[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Recrutador</Label>
              <Select
                value={newCandidate.assigned_recruiter_id || "none"}
                onValueChange={(v) =>
                  setNewCandidate((p) => ({
                    ...p,
                    assigned_recruiter_id: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {recruiters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="first_contact_date">Data Primeiro Contacto</Label>
            <Input
              id="first_contact_date"
              type="date"
              value={newCandidate.first_contact_date}
              onChange={(e) =>
                setNewCandidate((p) => ({
                  ...p,
                  first_contact_date: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={newCandidate.notes}
              onChange={(e) =>
                setNewCandidate((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Notas sobre o candidato..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button onClick={onCreate} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Candidato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
