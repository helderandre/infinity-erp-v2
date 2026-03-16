"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getCandidates,
  createCandidate,
  deleteCandidate,
  getRecruiters,
  bulkUpdateStatus,
  bulkAssignRecruiter,
  exportCandidatesCsv,
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

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

// ─── Types ───────────────────────────────────────────────────────────────────

interface Recruiter {
  id: string
  commercial_name: string
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CandidatosPage() {
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

  // Pagination
  const [page, setPage] = useState(1)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [candidateToDelete, setCandidateToDelete] =
    useState<RecruitmentCandidate | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Bulk actions loading
  const [bulkLoading, setBulkLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [filterStatus, filterSource, filterRecruiter])

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

  // Paginated candidates
  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE))
  const paginatedCandidates = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return candidates.slice(start, start + PAGE_SIZE)
  }, [candidates, page])

  // Selection helpers
  const allPageSelected =
    paginatedCandidates.length > 0 &&
    paginatedCandidates.every((c) => selectedIds.has(c.id))

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        paginatedCandidates.forEach((c) => next.delete(c.id))
      } else {
        paginatedCandidates.forEach((c) => next.add(c.id))
      }
      return next
    })
  }, [allPageSelected, paginatedCandidates])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ─── Handlers ──────────────────────────────────────────────────────────────

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

  const handleDeleteSingle = useCallback(async () => {
    if (!candidateToDelete) return
    setDeleting(true)
    const { error } = await deleteCandidate(candidateToDelete.id)
    setDeleting(false)

    if (error) {
      toast.error("Erro ao eliminar candidato")
    } else {
      toast.success("Candidato eliminado com sucesso")
      setDeleteOpen(false)
      setCandidateToDelete(null)
      fetchCandidates()
    }
  }, [candidateToDelete, fetchCandidates])

  const handleBulkDelete = useCallback(async () => {
    setBulkLoading(true)
    const ids = Array.from(selectedIds)
    let errorCount = 0
    for (const id of ids) {
      const { error } = await deleteCandidate(id)
      if (error) errorCount++
    }
    setBulkLoading(false)
    setBulkDeleteOpen(false)

    if (errorCount > 0) {
      toast.error(`Erro ao eliminar ${errorCount} candidato(s)`)
    } else {
      toast.success(`${ids.length} candidato(s) eliminado(s) com sucesso`)
    }
    setSelectedIds(new Set())
    fetchCandidates()
  }, [selectedIds, fetchCandidates])

  const handleBulkStatus = useCallback(
    async (newStatus: string) => {
      setBulkLoading(true)
      const ids = Array.from(selectedIds)
      const { error } = await bulkUpdateStatus(
        ids,
        newStatus as CandidateStatus
      )
      setBulkLoading(false)

      if (error) {
        toast.error("Erro ao alterar estado")
      } else {
        toast.success(
          `Estado de ${ids.length} candidato(s) alterado com sucesso`
        )
        setSelectedIds(new Set())
        fetchCandidates()
      }
    },
    [selectedIds, fetchCandidates]
  )

  const handleBulkRecruiter = useCallback(
    async (recruiterId: string) => {
      setBulkLoading(true)
      const ids = Array.from(selectedIds)
      const { error } = await bulkAssignRecruiter(ids, recruiterId)
      setBulkLoading(false)

      if (error) {
        toast.error("Erro ao atribuir recrutador")
      } else {
        toast.success(
          `Recrutador atribuido a ${ids.length} candidato(s) com sucesso`
        )
        setSelectedIds(new Set())
        fetchCandidates()
      }
    },
    [selectedIds, fetchCandidates]
  )

  const handleExportCsv = useCallback(async () => {
    setExporting(true)
    const filters: {
      status?: CandidateStatus
      source?: CandidateSource
      recruiterId?: string
    } = {}
    if (filterStatus !== "all") filters.status = filterStatus as CandidateStatus
    if (filterSource !== "all") filters.source = filterSource as CandidateSource
    if (filterRecruiter !== "all") filters.recruiterId = filterRecruiter

    const { csv, error } = await exportCandidatesCsv(filters)
    setExporting(false)

    if (error) {
      toast.error("Erro ao exportar CSV")
      return
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `candidatos-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exportado com sucesso")
  }, [filterStatus, filterSource, filterRecruiter])

  const openDeleteDialog = useCallback(
    (e: React.MouseEvent, candidate: RecruitmentCandidate) => {
      e.stopPropagation()
      setCandidateToDelete(candidate)
      setDeleteOpen(true)
    },
    []
  )

  const navigateToDetail = useCallback(
    (id: string) => {
      router.push(`/dashboard/recrutamento/${id}`)
    },
    [router]
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Candidatos</h1>
          <p className="text-muted-foreground text-sm">
            {candidates.length} candidato{candidates.length !== 1 ? "s" : ""} no
            total
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Pesquisar nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
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

        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportar CSV
        </Button>

        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Candidato
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>

          <Select onValueChange={handleBulkStatus} disabled={bulkLoading}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Alterar Estado" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CANDIDATE_STATUSES[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={handleBulkRecruiter} disabled={bulkLoading}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Atribuir Recrutador" />
            </SelectTrigger>
            <SelectContent>
              {recruiters.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.commercial_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={bulkLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>

          {bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telemovel</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Recrutador</TableHead>
                <TableHead>Ultimo Contacto</TableHead>
                <TableHead className="w-[80px]">Accoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCandidates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-muted-foreground h-32 text-center"
                  >
                    Nenhum candidato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCandidates.map((candidate) => {
                  const statusInfo = CANDIDATE_STATUSES[candidate.status]
                  const isSelected = selectedIds.has(candidate.id)
                  return (
                    <TableRow
                      key={candidate.id}
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-muted/50"
                      )}
                      onClick={() => navigateToDetail(candidate.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(candidate.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar ${candidate.full_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {candidate.full_name}
                      </TableCell>
                      <TableCell>{candidate.phone || "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {candidate.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {CANDIDATE_SOURCES[candidate.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          —
                        </span>
                      </TableCell>
                      <TableCell>
                        {candidate.recruiter?.commercial_name || "-"}
                      </TableCell>
                      <TableCell>
                        {candidate.last_interaction_date
                          ? format(
                              new Date(candidate.last_interaction_date),
                              "dd/MM/yyyy",
                              { locale: pt }
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigateToDetail(candidate.id)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={(e) => openDeleteDialog(e, candidate)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Pagina {page} de {totalPages} ({candidates.length} resultados)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
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

      {/* Delete Single AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar candidato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar{" "}
              <strong>{candidateToDelete?.full_name}</strong>? Esta accao e
              irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete AlertDialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar candidatos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar{" "}
              <strong>{selectedIds.size}</strong> candidato
              {selectedIds.size !== 1 ? "s" : ""}? Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar {selectedIds.size} candidato
              {selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Table Skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card>
      <div className="p-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b py-3 last:border-0"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </Card>
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
            <Label htmlFor="create_full_name">Nome Completo *</Label>
            <Input
              id="create_full_name"
              value={newCandidate.full_name}
              onChange={(e) =>
                setNewCandidate((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder="Nome completo do candidato"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="create_phone">Telemovel</Label>
              <Input
                id="create_phone"
                value={newCandidate.phone}
                onChange={(e) =>
                  setNewCandidate((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+351 9XX XXX XXX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_email">Email</Label>
              <Input
                id="create_email"
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
              <Label htmlFor="create_source_detail">Detalhe da Origem</Label>
              <Input
                id="create_source_detail"
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
            <Label htmlFor="create_first_contact_date">
              Data Primeiro Contacto
            </Label>
            <Input
              id="create_first_contact_date"
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
            <Label htmlFor="create_notes">Notas</Label>
            <Textarea
              id="create_notes"
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
