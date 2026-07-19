'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getCandidates, getRecruiters, updateCandidate } from '@/app/dashboard/recrutamento/actions'
import type { CandidateSource, CandidateStatus, RecruitmentCandidate } from '@/types/recruitment'
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_DOT,
  PIPELINE_STAGES,
  TERMINAL_CANDIDATE_STATUSES,
  normalizeCandidateStatus,
} from '@/types/recruitment'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { CandidateKanbanCard } from './candidate-kanban-card'
import { CandidateSheet } from './candidate-sheet'
import { NewCandidateSheet } from './new-candidate-sheet'

interface Recruiter {
  id: string
  commercial_name: string
}

export function RecruitmentBoard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([])
  const [recruiters, setRecruiters] = useState<Recruiter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<CandidateStatus | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [lostPrompt, setLostPrompt] = useState<string | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [sourceFilter, setSourceFilter] = useState<CandidateSource | 'all'>('all')
  const [recruiterFilter, setRecruiterFilter] = useState<string>('all')

  // Deep-link: /dashboard/recrutamento/candidatos?candidato=<id> abre o sheet.
  const deepLinkApplied = useRef(false)
  useEffect(() => {
    if (deepLinkApplied.current) return
    const id = searchParams.get('candidato')
    if (id) setSelectedId(id)
    deepLinkApplied.current = true
  }, [searchParams])

  const openCandidate = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      const url = id ? `${pathname}?candidato=${id}` : pathname
      router.replace(url, { scroll: false })
    },
    [pathname, router],
  )

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const [{ candidates: data, error }, recs] = await Promise.all([
          getCandidates({ search: debounced || undefined }),
          recruiters.length ? Promise.resolve(null) : getRecruiters(),
        ])
        if (error) throw new Error(error)
        if (recs) setRecruiters(recs.recruiters)
        setCandidates(data)
      } catch (e) {
        console.error('Erro ao carregar recrutamento', e)
        toast.error('Não foi possível carregar o quadro de recrutamento')
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    // `recruiters` é carregado uma única vez — excluído de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced],
  )

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo(() => {
    const filtered = candidates.filter(
      (c) =>
        (sourceFilter === 'all' || c.source === sourceFilter) &&
        (recruiterFilter === 'all' || c.assigned_recruiter_id === recruiterFilter),
    )
    const byStage = new Map<CandidateStatus, RecruitmentCandidate[]>()
    PIPELINE_STAGES.forEach((s) => byStage.set(s, []))
    filtered.forEach((c) => byStage.get(normalizeCandidateStatus(c.status))?.push(c))
    return PIPELINE_STAGES.map((stage) => ({ stage, items: byStage.get(stage) ?? [] }))
  }, [candidates, sourceFilter, recruiterFilter])

  const move = useCallback(
    async (id: string, target: CandidateStatus, reason?: string | null) => {
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: target } : c)))
      const patch: Partial<RecruitmentCandidate> = { status: target }
      if (reason) patch.reason_no = reason
      const { error } = await updateCandidate(id, patch)
      if (error) {
        toast.error('Falha ao mover o candidato')
        void load({ silent: true })
      }
    },
    [load],
  )

  function onDrop(e: DragEvent<HTMLDivElement>, target: CandidateStatus) {
    e.preventDefault()
    setDragOverStage(null)
    const id = e.dataTransfer.getData('candidate_id') || draggedId
    setDraggedId(null)
    if (!id) return
    const current = candidates.find((c) => c.id === id)
    if (!current || normalizeCandidateStatus(current.status) === target) return
    // Largar em "Rejeitado" → pedir o motivo primeiro.
    if (target === 'rejeitado') {
      setLostReason('')
      setLostPrompt(id)
      return
    }
    void move(id, target)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Barra superior */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 shrink-0 flex-wrap">
        <div className="relative flex-1 max-w-xs min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar candidato…"
            className="pl-9 h-9 rounded-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as CandidateSource | 'all')}>
            <SelectTrigger className="h-9 w-auto rounded-full gap-1.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {CANDIDATE_SOURCES[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recruiters.length > 0 && (
            <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
              <SelectTrigger className="h-9 w-auto rounded-full gap-1.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os recrutadores</SelectItem>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <span className="flex-1" />
        <Button onClick={() => setNewOpen(true)} className="rounded-full h-9 gap-1.5">
          <Plus className="h-4 w-4" /> Novo candidato
        </Button>
      </div>

      {/* Quadro */}
      {loading ? (
        <div className="flex-1 grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto px-4 sm:px-6 pb-4">
          <div className="flex gap-3 min-w-max h-full">
            {columns.map(({ stage, items }) => {
              const color = CANDIDATE_STATUS_DOT[stage]
              const isTerminal = TERMINAL_CANDIDATE_STATUSES.includes(stage)
              const isOver = dragOverStage === stage
              return (
                <div
                  key={stage}
                  className={cn(
                    'flex-shrink-0 flex flex-col max-h-[calc(100dvh-230px)] min-h-[300px]',
                    isTerminal ? 'min-w-[210px] w-[210px]' : 'min-w-[245px] w-[245px]',
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverStage(stage)
                  }}
                  onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                  onDrop={(e) => onDrop(e, stage)}
                >
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl border border-b-0 border-border/30 backdrop-blur-sm bg-gradient-to-br to-transparent',
                      isOver && 'ring-2 ring-primary',
                    )}
                    style={{ backgroundImage: `linear-gradient(to bottom right, ${color}33, transparent)` }}
                  >
                    <div className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold truncate">{CANDIDATE_STATUSES[stage].label}</span>
                    </div>
                    <span
                      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'flex-1 rounded-b-2xl border border-t-0 border-border/30 bg-muted/20 p-2 space-y-2 min-h-[120px] overflow-y-auto transition-colors',
                      isOver && 'bg-primary/5 border-primary/30',
                    )}
                  >
                    {items.map((c) => (
                      <CandidateKanbanCard
                        key={c.id}
                        candidate={c}
                        dragging={draggedId === c.id}
                        onClick={() => openCandidate(c.id)}
                        onDragStart={setDraggedId}
                        onDragEnd={() => {
                          setDraggedId(null)
                          setDragOverStage(null)
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 text-center py-6">Sem candidatos</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <CandidateSheet
        candidateId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) openCandidate(null)
        }}
        onMutated={() => load({ silent: true })}
      />
      <NewCandidateSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        recruiters={recruiters}
        onCreated={(id) => {
          void load({ silent: true })
          openCandidate(id)
        }}
      />

      <Dialog open={!!lostPrompt} onOpenChange={(o) => { if (!o) setLostPrompt(null) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Mover para Rejeitado</DialogTitle>
            <DialogDescription>Regista o motivo (opcional).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Motivo…"
            rows={3}
            className="resize-none rounded-xl"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostPrompt(null)} className="rounded-full">
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (lostPrompt) void move(lostPrompt, 'rejeitado', lostReason.trim() || null)
                setLostPrompt(null)
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
