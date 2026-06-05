// @ts-nocheck
'use client'

import { useState } from 'react'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronLeft, ChevronRight, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ReportDetailDialog } from './report-detail-dialog'
import { useTrainingAdminReports } from '@/hooks/use-training-admin-reports'
import { formatDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { AdminReportWithDetails } from '@/types/training'

const PAGE_SIZE = 20

const REPORT_STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-500/15 text-red-600',
  in_review: 'bg-amber-500/15 text-amber-600',
  resolved: 'bg-emerald-500/15 text-emerald-600',
  dismissed: 'bg-slate-500/15 text-slate-500',
}

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_review: 'Em Revisão',
  resolved: 'Resolvido',
  dismissed: 'Dispensado',
}

const REASON_LABELS: Record<string, string> = {
  video_corrupted: 'Vídeo corrompido',
  audio_issues: 'Problemas de áudio',
  wrong_content: 'Conteúdo errado',
  file_corrupted: 'Ficheiro corrompido',
  broken_link: 'Link partido',
  other: 'Outro',
}

interface ReportsTableProps {
  courseId?: string
}

export function ReportsTable({ courseId }: ReportsTableProps) {
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedReport, setSelectedReport] = useState<AdminReportWithDetails | null>(null)

  const { reports, total, isLoading, updateStatus } = useTrainingAdminReports({
    status: statusFilter,
    reason: reasonFilter,
    courseId,
    page,
    limit: PAGE_SIZE,
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleUpdateStatus = async (reportId: string, status: string, note?: string) => {
    try {
      await updateStatus(reportId, status, note)
      toast.success('Report actualizado com sucesso')
    } catch {
      toast.error('Erro ao actualizar report')
    }
  }

  const handleQuickAction = async (report: AdminReportWithDetails, status: string) => {
    await handleUpdateStatus(report.id, status)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="in_review">Em Revisão</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="dismissed">Dispensado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motivos</SelectItem>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhum report encontrado"
          description="Não existem reports com os critérios seleccionados."
        />
      ) : (
        <>
          <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Aula</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Curso</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Motivo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Utilizador</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Data</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                    onClick={() => setSelectedReport(report)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{report.lesson_title || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{report.course_title || '—'}</TableCell>
                    <TableCell className="text-sm">{REASON_LABELS[report.reason] || report.reason}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('rounded-full text-[10px] px-2 py-0.5', REPORT_STATUS_BADGE[report.status])}>
                        {REPORT_STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.user_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(report.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {report.status === 'open' && (
                            <DropdownMenuItem onClick={() => handleQuickAction(report, 'in_review')}>
                              Marcar em revisão
                            </DropdownMenuItem>
                          )}
                          {report.status !== 'resolved' && report.status !== 'dismissed' && (
                            <>
                              <DropdownMenuItem onClick={() => handleQuickAction(report, 'resolved')}>
                                Resolver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickAction(report, 'dismissed')}>
                                Dispensar
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => setSelectedReport(report)}>
                            Ver detalhe
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground">
                {total} report{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <ReportDetailDialog
        report={selectedReport}
        open={!!selectedReport}
        onOpenChange={(open) => !open && setSelectedReport(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}
