"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNow, differenceInDays } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  Plus, Search, Pencil, Trash2, Loader2, UserPlus, Download,
  ChevronLeft, ChevronRight, Phone, Mail, Clock, X, Kanban, List,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getCandidates, createCandidate, deleteCandidate, getRecruiters,
  bulkUpdateStatus, bulkAssignRecruiter, exportCandidatesCsv,
} from "@/app/dashboard/recrutamento/actions"
import type { RecruitmentCandidate, CandidateSource, CandidateStatus } from "@/types/recruitment"
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES, PIPELINE_STAGES } from "@/types/recruitment"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ViewMode = "table" | "kanban"

interface Recruiter { id: string; commercial_name: string }

function getStatusDotColor(status: CandidateStatus): string {
  const colors: Record<CandidateStatus, string> = {
    prospect: "#64748b", in_contact: "#3b82f6", in_process: "#a855f7",
    decision_pending: "#f59e0b", joined: "#10b981", declined: "#ef4444", on_hold: "#f97316",
  }
  return colors[status]
}

export default function CandidatosPage() {
  const router = useRouter()

  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([])
  const [recruiters, setRecruiters] = useState<Recruiter[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("table")

  // Filters
  const [search, setSearch] = useState("")
  const debouncedSearch = useRef("")
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSource, setFilterSource] = useState("all")
  const [filterRecruiter, setFilterRecruiter] = useState("all")

  // Selection (table view)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Kanban drag-and-drop
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCandidate, setNewCandidate] = useState({
    full_name: "", phone: "", email: "", source: "linkedin" as CandidateSource,
    source_detail: "", status: "prospect" as CandidateStatus,
    assigned_recruiter_id: "", first_contact_date: "", notes: "",
  })

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { debouncedSearch.current = search; fetchData() }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search]) // eslint-disable-line

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ candidates: data }, { recruiters: recs }] = await Promise.all([
        getCandidates({
          search: debouncedSearch.current || undefined,
          status: filterStatus !== "all" ? (filterStatus as CandidateStatus) : undefined,
          source: filterSource !== "all" ? (filterSource as CandidateSource) : undefined,
          recruiterId: filterRecruiter !== "all" ? filterRecruiter : undefined,
        }),
        getRecruiters(),
      ])
      setCandidates(data)
      setRecruiters(recs)
    } catch { toast.error("Erro ao carregar candidatos") }
    finally { setLoading(false) }
  }, [filterStatus, filterSource, filterRecruiter])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = candidates
  const total = filtered.length

  const handleCreate = async () => {
    if (!newCandidate.full_name.trim()) { toast.error("Nome obrigatório"); return }
    setCreating(true)
    const { error } = await createCandidate({
      ...newCandidate, assigned_recruiter_id: newCandidate.assigned_recruiter_id || null,
      first_contact_date: newCandidate.first_contact_date || null,
    } as any)
    setCreating(false)
    if (error) { toast.error(error) } else {
      toast.success("Candidato criado"); setCreateOpen(false)
      setNewCandidate({ full_name: "", phone: "", email: "", source: "linkedin", source_detail: "", status: "prospect", assigned_recruiter_id: "", first_contact_date: "", notes: "" })
      fetchData()
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await deleteCandidate(deleteId)
    setDeleting(false)
    if (error) toast.error(error); else { toast.success("Candidato eliminado"); fetchData() }
    setDeleteId(null)
  }

  const navigateToDetail = (id: string) => router.push(`/dashboard/recrutamento/${id}`)

  // Kanban drag handlers
  const handleKanbanDrop = useCallback(async (targetStage: CandidateStatus) => {
    if (!draggedCandidateId) return
    const candidate = candidates.find(c => c.id === draggedCandidateId)
    if (!candidate || candidate.status === targetStage) { setDraggedCandidateId(null); setDragOverStage(null); return }
    // Optimistic update
    setCandidates(prev => prev.map(c => c.id === draggedCandidateId ? { ...c, status: targetStage } : c))
    setDraggedCandidateId(null); setDragOverStage(null)
    // Persist
    const { bulkUpdateStatus: updateFn } = await import("@/app/dashboard/recrutamento/actions")
    const { error } = await updateFn([draggedCandidateId], targetStage)
    if (error) { toast.error("Erro ao mover candidato"); fetchData() }
  }, [draggedCandidateId, candidates, fetchData])
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
  const terminalStatuses: CandidateStatus[] = ["joined", "declined"]

  return (
    <div className="space-y-6 p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Candidatos</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            {total} candidato{total !== 1 ? "s" : ""} no pipeline de recrutamento
          </p>
        </div>
        <Button
          size="sm"
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />Novo Candidato
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, email ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-full" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>

        {/* Status pills */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm overflow-x-auto">
          <button onClick={() => setFilterStatus("all")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap",
              filterStatus === "all" ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
            Todos
          </button>
          {PIPELINE_STAGES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap",
                filterStatus === s ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: getStatusDotColor(s) }} />
              {CANDIDATE_STATUSES[s].label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/30 border border-border/30 ml-auto">
          <button onClick={() => setViewMode("table")} className={cn("p-1.5 rounded-full transition-all", viewMode === "table" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-muted-foreground hover:text-foreground")}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("kanban")} className={cn("p-1.5 rounded-full transition-all", viewMode === "kanban" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-muted-foreground hover:text-foreground")}>
            <Kanban className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        viewMode === "kanban" ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map(s => (
              <div key={s} className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-3">
                <div className="flex items-center gap-2 border-b p-3"><Skeleton className="h-2.5 w-2.5 rounded-full" /><Skeleton className="h-4 w-20" /><Skeleton className="ml-auto h-5 w-6 rounded" /></div>
                <div className="flex flex-col gap-2 p-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        )
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <UserPlus className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-medium">Nenhum candidato encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou adicione um novo candidato.</p>
        </div>
      ) : viewMode === "table" ? (
        /* ═══════ TABLE VIEW ═══════ */
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="w-10"><Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={(c) => setSelectedIds(c ? new Set(filtered.map(f => f.id)) : new Set())} /></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Recrutador</TableHead>
                <TableHead>Último Contacto</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, idx) => {
                const statusInfo = CANDIDATE_STATUSES[c.status]
                const daysSince = c.last_interaction_date ? differenceInDays(new Date(), new Date(c.last_interaction_date)) : null
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-1"
                    style={{ animationDelay: `${idx * 20}ms`, animationFillMode: "backwards" }}
                    onClick={() => navigateToDetail(c.id)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={(checked) => {
                        const next = new Set(selectedIds)
                        if (checked) next.add(c.id); else next.delete(c.id)
                        setSelectedIds(next)
                      }} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px] font-bold">{getInitials(c.full_name)}</AvatarFallback></Avatar>
                        <span className="font-medium text-sm">{c.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${getStatusDotColor(c.status)}15`, color: getStatusDotColor(c.status) }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getStatusDotColor(c.status) }} />
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{CANDIDATE_SOURCES[c.source]}</span></TableCell>
                    <TableCell><span className="text-xs">{c.recruiter?.commercial_name || "—"}</span></TableCell>
                    <TableCell>
                      {daysSince !== null ? (
                        <span className={cn("text-xs", daysSince > 7 ? "text-red-600 font-medium" : "text-muted-foreground")}>
                          {formatDistanceToNow(new Date(c.last_interaction_date!), { locale: pt, addSuffix: true })}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">···</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => navigateToDetail(c.id)} className="text-xs gap-2"><Pencil className="h-3 w-3" />Ver detalhe</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteId(c.id)} className="text-xs gap-2 text-destructive"><Trash2 className="h-3 w-3" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ═══════ KANBAN VIEW (CRM-style) ═══════ */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageCandidates = filtered.filter(c => c.status === stage)
            const statusInfo = CANDIDATE_STATUSES[stage]
            const isTerminal = terminalStatuses.includes(stage)
            const isDragOver = dragOverStage === stage
            return (
              <div
                key={stage}
                className={cn("min-w-[280px] w-[280px] flex-shrink-0 flex flex-col", isTerminal && "min-w-[220px] w-[220px]")}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage) }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={() => handleKanbanDrop(stage)}
              >
                {/* Column header */}
                <div className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-t-2xl border border-b-0 border-border/30",
                  "bg-card/60 backdrop-blur-sm",
                  isDragOver && "ring-2 ring-primary ring-offset-0"
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getStatusDotColor(stage) }} />
                    <span className="text-sm font-medium truncate">{statusInfo.label}</span>
                    {isTerminal && (
                      <Badge variant={stage === "joined" ? "default" : "destructive"} className="text-[9px] h-4 px-1.5 py-0 font-medium rounded-full">
                        {stage === "joined" ? "Ganho" : "Perdido"}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs h-5 rounded-full">{stageCandidates.length}</Badge>
                </div>

                {/* Cards area */}
                <div className={cn(
                  "flex-1 rounded-b-2xl border border-t-0 border-border/30 bg-muted/10 p-2 space-y-2",
                  "min-h-[120px] transition-colors duration-200",
                  isDragOver && "bg-primary/5 border-primary/30"
                )}>
                  {stageCandidates.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60 italic">Sem candidatos</div>
                  ) : stageCandidates.map(candidate => {
                    const daysSince = candidate.last_interaction_date ? differenceInDays(new Date(), new Date(candidate.last_interaction_date)) : null
                    const slaOverdue = daysSince !== null && daysSince > 7
                    return (
                      <div
                        key={candidate.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("candidate_id", candidate.id); e.dataTransfer.effectAllowed = "move"; setDraggedCandidateId(candidate.id) }}
                        onDragEnd={() => { setDraggedCandidateId(null); setDragOverStage(null) }}
                        onClick={() => navigateToDetail(candidate.id)}
                        className={cn(
                          "bg-card rounded-2xl border border-border/20 p-3 shadow-sm cursor-grab active:cursor-grabbing",
                          "hover:shadow-lg hover:bg-card transition-all duration-200 select-none",
                          slaOverdue && "border-l-2 border-l-red-400",
                          draggedCandidateId === candidate.id && "opacity-40 scale-[0.98]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px] font-bold">{getInitials(candidate.full_name)}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-semibold text-sm leading-snug truncate", isTerminal && "text-xs")}>{candidate.full_name}</p>
                            {!isTerminal && <Badge variant="outline" className="mt-1 text-[10px] font-normal rounded-full">{CANDIDATE_SOURCES[candidate.source]}</Badge>}
                          </div>
                        </div>
                        {!isTerminal && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {candidate.phone && <Phone className="text-muted-foreground h-3 w-3" />}
                              {candidate.email && <Mail className="text-muted-foreground h-3 w-3" />}
                            </div>
                            {candidate.recruiter && <span className="text-muted-foreground max-w-[100px] truncate text-[10px]">{candidate.recruiter.commercial_name}</span>}
                          </div>
                        )}
                        {daysSince !== null && (
                          <div className={cn("mt-1.5 flex items-center gap-1 text-[10px]", slaOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(candidate.last_interaction_date!), { locale: pt, addSuffix: true })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Novo Candidato</DialogTitle>
            <DialogDescription>Adicionar um novo candidato ao pipeline de recrutamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Nome Completo *</Label><Input value={newCandidate.full_name} onChange={e => setNewCandidate(p => ({ ...p, full_name: e.target.value }))} placeholder="Nome completo" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Telemóvel</Label><Input value={newCandidate.phone} onChange={e => setNewCandidate(p => ({ ...p, phone: e.target.value }))} placeholder="+351 9XX XXX XXX" /></div>
              <div className="grid gap-2"><Label>Email</Label><Input type="email" value={newCandidate.email} onChange={e => setNewCandidate(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Origem</Label>
                <Select value={newCandidate.source} onValueChange={v => setNewCandidate(p => ({ ...p, source: v as CandidateSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map(s => <SelectItem key={s} value={s}>{CANDIDATE_SOURCES[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Recrutador</Label>
                <Select value={newCandidate.assigned_recruiter_id || "none"} onValueChange={v => setNewCandidate(p => ({ ...p, assigned_recruiter_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Nenhum</SelectItem>{recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Notas</Label><Textarea value={newCandidate.notes} onChange={e => setNewCandidate(p => ({ ...p, notes: e.target.value }))} placeholder="Notas..." rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="rounded-full">Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="rounded-full">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar candidato</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
