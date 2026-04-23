'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { useDebounce } from '@/hooks/use-debounce'
import type { CourseEnrollmentDetail, CourseEnrollmentsResponse } from '@/types/training'

interface Props {
  courseId: string
}

function formatSeconds(s: number): string {
  if (!s || s < 60) return `${Math.round(s)}s`
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`
}

const STATUS_VARIANT: Record<string, string> = {
  enrolled: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  expired: 'bg-slate-100 text-slate-700',
}

const STATUS_LABEL: Record<string, string> = {
  enrolled: 'Inscrito',
  in_progress: 'Em progresso',
  completed: 'Concluído',
  failed: 'Falhou',
  expired: 'Expirado',
}

const SOURCE_LABEL: Record<string, string> = {
  auto_watch: 'Auto ≥90%',
  manual: 'Manual',
  admin_override: 'Override',
  quiz_pass: 'Quiz',
}

export function ActivityEnrollmentsTab({ courseId }: Props) {
  const [data, setData] = useState<CourseEnrollmentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selected, setSelected] = useState<CourseEnrollmentDetail | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '20' })
      if (status && status !== 'all') qs.set('status', status)
      if (debouncedSearch) qs.set('search', debouncedSearch)
      const res = await fetch(`/api/training/admin/courses/${courseId}/enrollments?${qs}`, {
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error('Erro ao carregar matriculados')
      const json: CourseEnrollmentsResponse = await res.json()
      setData(json)
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [courseId, page, status, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = data?.total_pages ?? 1

  const openDrillDown = (row: CourseEnrollmentDetail) => setSelected(row)

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            placeholder="Pesquisar por nome..."
            className="pl-8 h-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v) }}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="not_started">Não iniciado</SelectItem>
            <SelectItem value="in_progress">Em progresso</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilizador</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead className="text-right">Lições</TableHead>
              <TableHead className="text-right">Tempo total</TableHead>
              <TableHead>Última actividade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data?.length ? data.data.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openDrillDown(r)}
              >
                <TableCell>
                  <div className="font-medium truncate max-w-[220px]">{r.user_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.user_email ?? ''}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`${STATUS_VARIANT[r.status] ?? ''} border-0`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <Progress value={r.progress_percent} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{r.progress_percent}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{r.lessons_completed}/{r.lessons_total}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatSeconds(r.total_time_spent_seconds)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.last_activity_at ? new Date(r.last_activity_at).toLocaleString('pt-PT') : '—'}
                </TableCell>
              </TableRow>
            )) : !loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  Sem inscrições para este filtro.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.page} de {totalPages} — {data.total} inscrições
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm" variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Drill-down sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.user_name ?? 'Utilizador'}</SheetTitle>
            <SheetDescription>
              {selected?.user_email ?? ''} · Inscrito em {selected?.enrolled_at ? new Date(selected.enrolled_at).toLocaleDateString('pt-PT') : '—'}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progresso</p>
                  <p className="text-lg font-semibold">{selected.progress_percent}%</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo total</p>
                  <p className="text-lg font-semibold">{formatSeconds(selected.total_time_spent_seconds)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lições</p>
                  <p className="text-lg font-semibold">{selected.lessons_completed}/{selected.lessons_total}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold">{STATUS_LABEL[selected.status] ?? selected.status}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Lições</h4>
                <div className="rounded-md border divide-y">
                  {selected.lessons.map((l) => (
                    <div key={l.lesson_id} className="px-3 py-2 flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{l.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{l.module_title}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          {l.status === 'completed' ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5 py-0">
                              Concluído{l.completion_source ? ` · ${SOURCE_LABEL[l.completion_source] ?? l.completion_source}` : ''}
                            </Badge>
                          ) : l.status === 'in_progress' ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5 py-0">
                              {l.video_watch_percent}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">—</Badge>
                          )}
                        </div>
                        <div className="tabular-nums">{formatSeconds(l.time_spent_seconds)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.quiz_attempts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tentativas de quiz</h4>
                  <div className="rounded-md border divide-y">
                    {selected.quiz_attempts.map((a) => (
                      <div key={a.attempt_id} className="px-3 py-2 flex items-center gap-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{a.quiz_title}</p>
                          <p className="text-xs text-muted-foreground">Tentativa #{a.attempt_number} · {a.completed_at ? new Date(a.completed_at).toLocaleDateString('pt-PT') : '—'}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border-0 ${a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                        >
                          {a.score}% {a.passed ? '· aprovado' : '· reprovado'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
