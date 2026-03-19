// @ts-nocheck
'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { AdminReportWithDetails } from '@/types/training'

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

interface ReportDetailDialogProps {
  report: AdminReportWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateStatus: (reportId: string, status: string, note?: string) => Promise<void>
}

export function ReportDetailDialog({ report, open, onOpenChange, onUpdateStatus }: ReportDetailDialogProps) {
  const [action, setAction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!report) return null

  const canAct = report.status !== 'resolved' && report.status !== 'dismissed'

  const handleAction = async (status: string) => {
    setIsSaving(true)
    try {
      await onUpdateStatus(report.id, status, note || undefined)
      setAction(null)
      setNote('')
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Report — {REASON_LABELS[report.reason] || report.reason}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('rounded-full text-[10px] px-2 py-0.5', REPORT_STATUS_BADGE[report.status])}>
              {REPORT_STATUS_LABELS[report.status] || report.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(report.created_at)}</span>
          </div>

          <div className="grid gap-2 text-sm">
            <div><span className="text-muted-foreground">Utilizador:</span> {report.user_name || '—'}</div>
            <div><span className="text-muted-foreground">Aula:</span> {report.lesson_title || '—'}</div>
            <div><span className="text-muted-foreground">Curso:</span> {report.course_title || '—'}</div>
          </div>

          {report.comment && (
            <div>
              <Label className="text-xs text-muted-foreground">Comentário do utilizador</Label>
              <p className="text-sm mt-1 p-3 rounded-md bg-muted/50">{report.comment}</p>
            </div>
          )}

          {report.resolution_note && (
            <div>
              <Label className="text-xs text-muted-foreground">Nota de resolução</Label>
              <p className="text-sm mt-1 p-3 rounded-md bg-muted/50">{report.resolution_note}</p>
            </div>
          )}

          {canAct && action && (
            <div>
              <Label className="text-xs">Nota de resolução (opcional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Adicionar nota..."
                className="mt-1"
                rows={3}
              />
            </div>
          )}
        </div>

        {canAct && (
          <DialogFooter className="gap-2 sm:gap-0">
            {!action ? (
              <>
                {report.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => handleAction('in_review')}>
                    Em Revisão
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setAction('resolved')}>
                  Resolver
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction('dismissed')}>
                  Dispensar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setAction(null); setNote('') }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => handleAction(action)} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Confirmar
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
